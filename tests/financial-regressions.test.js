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
