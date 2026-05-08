const test = require('node:test');
const assert = require('node:assert/strict');

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getMontantHTFromTTC(ttc, tauxTVA) {
  const total = Number(ttc) || 0;
  const rate = Number(tauxTVA) || 0;
  return round2(rate > 0 ? total / (1 + rate / 100) : total);
}

function getMontantHTPrecisFromTTC(ttc, tauxTVA) {
  const total = Number(ttc) || 0;
  const rate = Number(tauxTVA) || 0;
  return rate > 0 ? total / (1 + rate / 100) : total;
}

function getTVAFromHT(ht, tauxTVA) {
  return (Number(ht) || 0) * ((Number(tauxTVA) || 0) / 100);
}

function getDeductibleVatAmount({ montantHT, tauxTVA, categorie, tauxDeductible }) {
  const brute = getTVAFromHT(montantHT, tauxTVA);
  if (categorie === 'carburant') {
    return round2(brute * ((Number(tauxDeductible) || 0) / 100));
  }
  if (categorie === 'tva') return 0;
  return round2(brute);
}

// Réplique la logique de getChargeMontantTVA (script-tva.js) fixée en v3.69 :
// si la charge a un montant TVA saisi manuellement (cas TVA mixte ex 150€ TTC
// dont 6€ de TVA réelle), on le préfère au recalcul HT × taux.
function getChargeVatAmount(charge) {
  if (!charge || charge.categorie === 'tva') return 0;
  const tvaSaisie = parseFloat(charge.tva);
  if (Number.isFinite(tvaSaisie) && tvaSaisie > 0) return tvaSaisie;
  const ht = parseFloat(charge.montantHT);
  const taux = parseFloat(charge.tauxTVA) || 0;
  if (!Number.isFinite(ht) || taux <= 0) return 0;
  return round2(ht * taux / 100);
}

function getServiceVatExigibilityDate({ modeExigibilite, paymentDate, invoiceDate }) {
  return modeExigibilite === 'debits' ? invoiceDate : paymentDate;
}

function getVatBalance({ collectee, deductible, alreadyPaid }) {
  const brute = round2((Number(collectee) || 0) - (Number(deductible) || 0));
  const paid = round2(Number(alreadyPaid) || 0);
  return {
    brute,
    remaining: round2(Math.max(0, brute - paid)),
    credit: brute < 0 ? round2(Math.abs(brute)) : 0
  };
}

test('HT stays separated from TTC for dashboard-style revenue display', () => {
  assert.equal(getMontantHTFromTTC(180, 20), 150);
});

test('fuel VAT is deductible at 80 percent while maintenance stays at 100 percent', () => {
  assert.equal(
    getDeductibleVatAmount({
      montantHT: getMontantHTPrecisFromTTC(74, 20),
      tauxTVA: 20,
      categorie: 'carburant',
      tauxDeductible: 80
    }),
    9.87
  );
  assert.equal(getDeductibleVatAmount({ montantHT: 85, tauxTVA: 20, categorie: 'entretien', tauxDeductible: 80 }), 17);
});

test('service VAT at encashment becomes due only on payment date', () => {
  assert.equal(
    getServiceVatExigibilityDate({
      modeExigibilite: 'encaissements',
      invoiceDate: '2026-04-10',
      paymentDate: '2026-05-03'
    }),
    '2026-05-03'
  );
});

test('service VAT on debits becomes due on invoice date', () => {
  assert.equal(
    getServiceVatExigibilityDate({
      modeExigibilite: 'debits',
      invoiceDate: '2026-04-10',
      paymentDate: '2026-05-03'
    }),
    '2026-04-10'
  );
});

test('VAT payment reduces remaining VAT due without changing collected or deductible totals', () => {
  const balance = getVatBalance({ collectee: 1058, deductible: 0, alreadyPaid: 400 });
  assert.deepEqual(balance, { brute: 1058, remaining: 658, credit: 0 });
});

test('negative VAT balance becomes VAT credit', () => {
  const balance = getVatBalance({ collectee: 100, deductible: 260, alreadyPaid: 0 });
  assert.deepEqual(balance, { brute: -160, remaining: 0, credit: 160 });
});

// Régression v3.69 : facture TVA mixte (150€ TTC dont seulement 6€ de TVA
// réelle car partie du montant n'est pas soumise à TVA). Le montant saisi
// manuellement doit primer sur le recalcul HT × taux.
test('mixed-VAT charge : manually entered VAT amount takes precedence', () => {
  const charge = { montantHT: 144, montant: 150, tauxTVA: 20, tva: 6 };
  assert.equal(getChargeVatAmount(charge), 6);
});

test('charge without manual VAT : falls back to HT × rate', () => {
  const charge = { montantHT: 100, tauxTVA: 20 };
  assert.equal(getChargeVatAmount(charge), 20);
});

test('charge with VAT field at 0 or undefined : falls back to recalc (avoid confusing 0 with "saved")', () => {
  assert.equal(getChargeVatAmount({ montantHT: 100, tauxTVA: 20, tva: 0 }), 20);
  assert.equal(getChargeVatAmount({ montantHT: 100, tauxTVA: 20, tva: '' }), 20);
  assert.equal(getChargeVatAmount({ montantHT: 100, tauxTVA: 20 }), 20);
});

test('VAT settlement charge (categorie=tva) : always returns 0', () => {
  assert.equal(getChargeVatAmount({ categorie: 'tva', montantHT: 500, tauxTVA: 20, tva: 100 }), 0);
});

// ============================================================
// Parite mobile TVA — helpers periode (mois/trimestre) + range
// Reproduisent la logique de M.getTVAPeriodeRange / M.tvaIsoInRange
// dans script-mobile.js. Sert a verifier que la vue mensuelle ET la vue
// trimestrielle filtrent correctement sur la frontiere des dates.
// ============================================================
function getTVAPeriodeRange(mode, key) {
  const pad = (d) => String(d).padStart(2, '0');
  if (mode === 'trimestre') {
    const m = /^(\d{4})-T([1-4])$/.exec(key || '');
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const q = parseInt(m[2], 10) - 1;
    const start = new Date(year, q * 3, 1);
    const end = new Date(year, q * 3 + 3, 0);
    return {
      debut: start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-' + pad(start.getDate()),
      fin: end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-' + pad(end.getDate())
    };
  }
  const m2 = /^(\d{4})-(\d{2})$/.exec(key || '');
  if (!m2) return null;
  const year = parseInt(m2[1], 10);
  const month = parseInt(m2[2], 10) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    debut: start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-' + pad(start.getDate()),
    fin: end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-' + pad(end.getDate())
  };
}

function tvaIsoInRange(iso, range) {
  if (!iso || !range) return false;
  const d = (iso || '').slice(0, 10);
  return d >= range.debut && d <= range.fin;
}

test('mobile TVA : range mois standard couvre tout le mois', () => {
  const r = getTVAPeriodeRange('mois', '2026-05');
  assert.equal(r.debut, '2026-05-01');
  assert.equal(r.fin, '2026-05-31');
});

test('mobile TVA : range mois fevrier annee non bissextile', () => {
  const r = getTVAPeriodeRange('mois', '2026-02');
  assert.equal(r.debut, '2026-02-01');
  assert.equal(r.fin, '2026-02-28');
});

test('mobile TVA : range mois fevrier annee bissextile', () => {
  const r = getTVAPeriodeRange('mois', '2024-02');
  assert.equal(r.debut, '2024-02-01');
  assert.equal(r.fin, '2024-02-29');
});

test('mobile TVA : range trimestre T1 = janvier-mars', () => {
  const r = getTVAPeriodeRange('trimestre', '2026-T1');
  assert.equal(r.debut, '2026-01-01');
  assert.equal(r.fin, '2026-03-31');
});

test('mobile TVA : range trimestre T2 = avril-juin', () => {
  const r = getTVAPeriodeRange('trimestre', '2026-T2');
  assert.equal(r.debut, '2026-04-01');
  assert.equal(r.fin, '2026-06-30');
});

test('mobile TVA : range trimestre T4 = octobre-decembre', () => {
  const r = getTVAPeriodeRange('trimestre', '2026-T4');
  assert.equal(r.debut, '2026-10-01');
  assert.equal(r.fin, '2026-12-31');
});

test('mobile TVA : range cle invalide retourne null', () => {
  assert.equal(getTVAPeriodeRange('mois', '2026'), null);
  assert.equal(getTVAPeriodeRange('mois', ''), null);
  assert.equal(getTVAPeriodeRange('trimestre', '2026-T9'), null);
});

test('mobile TVA : isoInRange gere les bornes inclusives', () => {
  const r = getTVAPeriodeRange('mois', '2026-05');
  assert.equal(tvaIsoInRange('2026-05-01', r), true);
  assert.equal(tvaIsoInRange('2026-05-31', r), true);
  assert.equal(tvaIsoInRange('2026-04-30', r), false);
  assert.equal(tvaIsoInRange('2026-06-01', r), false);
});

test('mobile TVA : isoInRange tolere date avec heure (ISO timestamp)', () => {
  const r = getTVAPeriodeRange('mois', '2026-05');
  assert.equal(tvaIsoInRange('2026-05-15T14:30:00.000Z', r), true);
});

test('mobile TVA : isoInRange refuse vide ou null', () => {
  const r = getTVAPeriodeRange('mois', '2026-05');
  assert.equal(tvaIsoInRange('', r), false);
  assert.equal(tvaIsoInRange(null, r), false);
  assert.equal(tvaIsoInRange('2026-05-15', null), false);
});

// ============================================================
// Parite mobile TVA — Calcul TVA cote mobile depuis taux STRING
// Bug typique : tauxTVA stocke en string ("20" venant du HTML input)
// vs nombre. La fonction parseTauxTVAValue doit lisser le tout.
// ============================================================
function parseTauxTVAValueMobile(value, fallback) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback == null ? 20 : fallback;
  return parsed;
}

test('mobile TVA : taux string "20" → 20 (number)', () => {
  assert.equal(parseTauxTVAValueMobile('20'), 20);
  assert.equal(parseTauxTVAValueMobile('20.0'), 20);
  assert.equal(parseTauxTVAValueMobile('5,5'), 5); // virgule francaise -> tronque a 5 (parseFloat ne gere pas la virgule)
  assert.equal(parseTauxTVAValueMobile('5.5'), 5.5);
});

test('mobile TVA : taux invalide → fallback', () => {
  assert.equal(parseTauxTVAValueMobile(undefined), 20);
  assert.equal(parseTauxTVAValueMobile(null, 10), 10);
  assert.equal(parseTauxTVAValueMobile('abc', 0), 0);
  assert.equal(parseTauxTVAValueMobile('', 20), 20);
});

// ============================================================
// Parite mobile TVA — Calcul KPI complet sur une periode
// Replique la logique de la route 'tva' mobile pour valider la coherence
// des totaux affiches dans les 4 KPI cards (Collectée / Déductible /
// Versée / Solde).
// ============================================================
function calculTVAKpiMois({ livraisons, charges, carburant, versements }) {
  let tvaCollectee = 0;
  livraisons.forEach(l => {
    const ht = Number(l.ht) || 0;
    const ttc = Number(l.ttc) || ht * 1.2;
    const tva = Number(l.tva) || (ttc - ht);
    tvaCollectee += tva;
  });
  let tvaDeductible = 0;
  charges.forEach(c => {
    const taux = Number(c.tauxTVA) || 0;
    const ttc = Number(c.ttc) || 0;
    const ht = Number(c.ht) || (taux > 0 ? ttc / (1 + taux / 100) : ttc);
    const tva = Number(c.tva) > 0 ? Number(c.tva) : (taux > 0 ? +(ht * taux / 100).toFixed(2) : 0);
    tvaDeductible += tva;
  });
  carburant.forEach(p => {
    const ttc = Number(p.ttc) || 0;
    const taux = Number(p.tauxTVA) || 20;
    const ht = taux > 0 ? +(ttc / (1 + taux / 100)).toFixed(2) : ttc;
    const tvaBrute = +(ttc - ht).toFixed(2);
    const tauxDed = Number(p.tauxDed) || 80;
    tvaDeductible += +(tvaBrute * tauxDed / 100).toFixed(2);
  });
  const totalVersements = versements.reduce((s, v) => s + (Number(v.montant) || 0), 0);
  const soldeBrut = round2(tvaCollectee - tvaDeductible);
  const aReverser = soldeBrut > 0 ? Math.max(0, round2(soldeBrut - totalVersements)) : 0;
  const tvaCredit = soldeBrut < 0 ? Math.abs(soldeBrut) : 0;
  return { tvaCollectee: round2(tvaCollectee), tvaDeductible: round2(tvaDeductible), totalVersements: round2(totalVersements), soldeBrut, aReverser, tvaCredit };
}

test('mobile TVA : KPI mois cas nominal (1 livraison + 1 charge + 1 plein)', () => {
  const k = calculTVAKpiMois({
    livraisons: [{ ht: 1000, ttc: 1200 }], // collectee = 200
    charges: [{ tauxTVA: 20, ttc: 120 }],   // deductible = 20
    carburant: [{ ttc: 60, tauxTVA: 20, tauxDed: 80 }], // tva brute=10, deductible=8
    versements: []
  });
  assert.equal(k.tvaCollectee, 200);
  assert.equal(k.tvaDeductible, 28);
  assert.equal(k.soldeBrut, 172);
  assert.equal(k.aReverser, 172);
  assert.equal(k.tvaCredit, 0);
});

test('mobile TVA : KPI avec versement reduit le reste a verser', () => {
  const k = calculTVAKpiMois({
    livraisons: [{ ht: 1000, ttc: 1200 }],
    charges: [],
    carburant: [],
    versements: [{ montant: 100 }, { montant: 50 }]
  });
  assert.equal(k.tvaCollectee, 200);
  assert.equal(k.totalVersements, 150);
  assert.equal(k.aReverser, 50);
  assert.equal(k.tvaCredit, 0);
});

test('mobile TVA : KPI deductible > collectee → credit TVA', () => {
  const k = calculTVAKpiMois({
    livraisons: [{ ht: 100, ttc: 120 }], // 20
    charges: [{ tauxTVA: 20, ttc: 600 }], // 100
    carburant: [],
    versements: []
  });
  assert.equal(k.tvaCollectee, 20);
  assert.equal(k.tvaDeductible, 100);
  assert.equal(k.soldeBrut, -80);
  assert.equal(k.aReverser, 0);
  assert.equal(k.tvaCredit, 80);
});

// ============================================================
// Parite mobile TVA — Export CSV : escape correct des champs
// Bug evite : un libelle contenant ; ou " ou \n casse le CSV pour Excel.
// ============================================================
function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[";\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

test('mobile TVA : CSV escape preserve les caracteres simples', () => {
  assert.equal(csvEscape('Hello'), 'Hello');
  assert.equal(csvEscape(''), '');
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(42), '42');
});

test('mobile TVA : CSV escape protege ; et "', () => {
  assert.equal(csvEscape('a;b'), '"a;b"');
  assert.equal(csvEscape('a"b'), '"a""b"');
  assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
});
