/**
 * MCA Logistics — Module Tva
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L483 (script.js d'origine)
function validerTVAIntracomFR(tva) {
  const val = String(tva || '').replace(/\s+/g, '').toUpperCase();
  if (!val) return { valid: true, empty: true };
  const m = /^FR([A-Z0-9]{2})(\d{9})$/.exec(val);
  if (!m) return { valid: false, raison: 'format', message: 'Format attendu : FR + 2 caractères + 9 chiffres du SIREN.' };
  const cle = m[1];
  const siren = m[2];
  if (!/^\d{2}$/.test(cle)) {
    return { valid: true, normalized: val, note: 'Clé alphanumérique non vérifiée (format "new TVA").' };
  }
  const attendu = String((12 + 3 * (parseInt(siren, 10) % 97)) % 97).padStart(2, '0');
  if (attendu !== cle) {
    return {
      valid: false,
      raison: 'checksum',
      message: 'Clé TVA incorrecte. Attendu : FR' + attendu + siren + '.',
      attendu: 'FR' + attendu + siren
    };
  }
  return { valid: true, normalized: val };
}

// L740 (script.js d'origine)
function formaterTaux(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 2) + ' %' : '—';
}

// L748 (script.js d'origine)
function getTauxDeductibiliteVehicule(vehId, fallback) {
  const veh = vehId ? getVehiculeById(vehId) : null;
  if (veh && veh.tvaCarbDeductible !== undefined && veh.tvaCarbDeductible !== null && veh.tvaCarbDeductible !== '') {
    return parseFloat(veh.tvaCarbDeductible) || 0;
  }
  return parseFloat(fallback) || 0;
}

// L758 (script.js d'origine)
function calculerMontantTVAFromHT(ht, tauxTVA) {
  var base = parseFloat(ht) || 0;
  var taux = parseFloat(tauxTVA) || 0;
  return base * taux / 100;
}

// L764 (script.js d'origine)
function parseTauxTVAValue(value, fallback) {
  var parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback == null ? 20 : fallback;
  return parsed;
}

// L778 (script.js d'origine)
function getChargeMontantTVA(charge) {
  if ((charge?.categorie || '') === 'tva') return 0;
  return calculerMontantTVAFromHT(getChargeMontantHT(charge), parseTauxTVAValue(charge?.tauxTVA, 0));
}

// L783 (script.js d'origine)
function getChargeTauxDeductibilite(charge) {
  if (!charge) return 100;
  if (charge.categorie === 'carburant') return getTauxDeductibiliteVehicule(charge.vehId, 80);
  return 100;
}

// L804 (script.js d'origine)
function getTVAConfig() {
  var cfg = chargerObj('tva_config', {});
  var defaultRate = parseTauxTVAValue(cfg.defaultRate != null ? cfg.defaultRate : localStorage.getItem('taux_tva'), 20);
  var regime = cfg.regime || 'reel_normal';
  return {
    regime: regime,
    activiteType: cfg.activiteType || 'service',
    exigibiliteServices: cfg.exigibiliteServices || 'encaissements',
    periodicite: cfg.periodicite || 'mensuelle',
    defaultRate: defaultRate,
    isVatEnabled: regime !== 'franchise_base'
  };
}

// L818 (script.js d'origine)
function getTVARegimeLabel(regime) {
  return {
    franchise_base: 'Franchise en base',
    reel_simplifie: 'Régime réel simplifié',
    reel_normal: 'Régime réel normal'
  }[regime] || 'Régime réel normal';
}

// L826 (script.js d'origine)
function getTVAActiviteLabel(type) {
  return type === 'goods' ? 'Livraisons de biens' : 'Prestations de services';
}

// L849 (script.js d'origine)
function choisirMentionTVALegale(profile, client, tauxDefaut) {
  const UE = new Set(['FR','DE','BE','NL','LU','IT','ES','PT','AT','IE','DK','SE','FI','EE','LV','LT','PL','CZ','SK','HU','SI','HR','BG','RO','GR','CY','MT']);
  const t = (tauxDefaut == null) ? 20 : Number(tauxDefaut);
  if (!profile || !profile.isVatEnabled || profile.regime === 'franchise_base') {
    return 'TVA non applicable, art. 293 B du CGI';
  }
  const cp = String((client && client.pays) || 'FR').toUpperCase();
  if (cp && cp !== 'FR') {
    if (UE.has(cp) && client && client.tvaIntracom) {
      return 'Exonération TVA — livraison intracommunautaire (art. 262 ter I du CGI)';
    }
    if (!UE.has(cp)) {
      return 'Exonération TVA — exportation hors UE (art. 262 I du CGI)';
    }
  }
  return 'TVA ' + (typeof formaterTaux === 'function' ? formaterTaux(t) : (t + '%'));
}

// L867 (script.js d'origine)
function getTVAExigibiliteLabel(profile) {
  if (!profile || !profile.isVatEnabled) return 'TVA non applicable';
  if ((profile.activiteType || 'service') === 'goods') return 'TVA exigible à la livraison / facturation';
  return profile.exigibiliteServices === 'debits'
    ? 'TVA exigible à la facturation (débits)'
    : 'TVA exigible à l’encaissement';
}

// L875 (script.js d'origine)
function getTVAPeriodiciteLabel(periodicite) {
  return {
    mensuelle: 'Mensuelle (CA3)',
    trimestrielle: 'Trimestrielle',
    annuelle: 'Annuelle (CA12)'
  }[periodicite] || 'Mensuelle (CA3)';
}

// L883 (script.js d'origine)
function getTVADefaultPeriodInput(dateStr) {
  var activePage = document.querySelector('.page.active')?.id || '';
  if (activePage === 'page-tva') return getTvaMoisStr();
  var normalized = normaliserDateISO(dateStr || aujourdhui());
  return normalized ? normalized.slice(0, 7) : aujourdhui().slice(0, 7);
}

// L890 (script.js d'origine)
function getTVADeclarationPeriodKeyFromDate(dateStr, profile) {
  var normalized = normaliserDateISO(dateStr);
  if (!normalized) return '';
  var year = parseInt(normalized.slice(0, 4), 10);
  var month = parseInt(normalized.slice(5, 7), 10);
  var periodicite = profile?.periodicite || 'mensuelle';
  if (periodicite === 'annuelle') return String(year);
  if (periodicite === 'trimestrielle') return year + '-T' + (Math.floor((month - 1) / 3) + 1);
  return normalized.slice(0, 7);
}

// L901 (script.js d'origine)
function getTVADeclarationPeriodRangeFromKey(periodKey) {
  if (!periodKey) return null;
  if (/^\d{4}-\d{2}$/.test(periodKey)) {
    var year = parseInt(periodKey.slice(0, 4), 10);
    var month = parseInt(periodKey.slice(5, 7), 10) - 1;
    var start = new Date(year, month, 1);
    var end = new Date(year, month + 1, 0);
    return { debut: dateToLocalISO(start), fin: dateToLocalISO(end) };
  }
  if (/^\d{4}-T[1-4]$/.test(periodKey)) {
    var yearQ = parseInt(periodKey.slice(0, 4), 10);
    var quarter = parseInt(periodKey.slice(-1), 10) - 1;
    var startQ = new Date(yearQ, quarter * 3, 1);
    var endQ = new Date(yearQ, quarter * 3 + 3, 0);
    return { debut: dateToLocalISO(startQ), fin: dateToLocalISO(endQ) };
  }
  if (/^\d{4}$/.test(periodKey)) {
    return { debut: periodKey + '-01-01', fin: periodKey + '-12-31' };
  }
  return null;
}

// L923 (script.js d'origine)
function getTVADeclarationPeriodLabel(periodKey) {
  if (!periodKey) return 'Période non renseignée';
  if (/^\d{4}-\d{2}$/.test(periodKey)) {
    var d = new Date(periodKey + '-01T00:00:00');
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  if (/^\d{4}-T[1-4]$/.test(periodKey)) {
    return 'Trimestre ' + periodKey.slice(-1) + ' ' + periodKey.slice(0, 4);
  }
  if (/^\d{4}$/.test(periodKey)) return 'Année ' + periodKey;
  return periodKey;
}

// L936 (script.js d'origine)
function normaliserTVAPeriodeKey(rawValue, fallbackDate, profile) {
  if (rawValue && /^\d{4}-T[1-4]$/.test(rawValue)) return rawValue;
  if (rawValue && /^\d{4}$/.test(rawValue)) return rawValue;
  if (rawValue && /^\d{4}-\d{2}$/.test(rawValue)) return getTVADeclarationPeriodKeyFromDate(rawValue + '-01', profile);
  return getTVADeclarationPeriodKeyFromDate(fallbackDate || aujourdhui(), profile);
}

// L943 (script.js d'origine)
function getTVAPeriodKeysForRange(range, profile) {
  if (!range) return [];
  var current = new Date(range.debut + 'T00:00:00');
  var end = new Date(range.fin + 'T00:00:00');
  current.setDate(1);
  end.setDate(1);
  var keys = new Set();
  while (current <= end) {
    keys.add(getTVADeclarationPeriodKeyFromDate(dateToLocalISO(current), profile));
    current.setMonth(current.getMonth() + 1);
  }
  return Array.from(keys).filter(Boolean);
}

// L957 (script.js d'origine)
function getTVASettlementPeriodKey(charge, profile) {
  return normaliserTVAPeriodeKey(charge?.tvaPeriodeKey || charge?.tvaPeriode || '', charge?.date || aujourdhui(), profile);
}

// L961 (script.js d'origine)
function getTVASettlementLabel(charge, profile) {
  return getTVADeclarationPeriodLabel(getTVASettlementPeriodKey(charge, profile));
}

// L965 (script.js d'origine)
function getLivraisonTVAOperationType(livraison, profile) {
  var raw = livraison?.operationTypeTVA || livraison?.natureTVA || livraison?.natureOperation || '';
  if (['goods', 'biens', 'livraison_biens'].includes(raw)) return 'goods';
  if (['service', 'services', 'prestation', 'prestation_services'].includes(raw)) return 'service';
  return profile?.activiteType === 'goods' ? 'goods' : 'service';
}

// L972 (script.js d'origine)
function getLivraisonTVAExigibiliteDate(livraison, profile) {
  if (!profile?.isVatEnabled) return '';
  var operationType = getLivraisonTVAOperationType(livraison, profile);
  var referenceDate = normaliserDateISO(livraison?.dateFacture || livraison?.date);
  if (operationType === 'goods') return referenceDate;
  if ((profile.exigibiliteServices || 'encaissements') === 'debits') return referenceDate;
  if ((livraison?.statutPaiement || '') !== 'payé') return '';
  return normaliserDateISO(livraison?.datePaiement);
}

// L982 (script.js d'origine)
function buildTVACollecteeEntryFromLivraison(livraison, profile) {
  if (!profile?.isVatEnabled) return null;
  var totalTTC = parseFloat(livraison?.prix) || 0;
  if (totalTTC <= 0) return null;
  var taux = parseTauxTVAValue(livraison?.tauxTVA, profile.defaultRate);
  if (taux <= 0) return null;
  var baseHT = getMontantHTLivraison(livraison);
  var montantTVA = round2(totalTTC - baseHT);
  if (montantTVA <= 0) return null;
  var issueDate = normaliserDateISO(livraison?.date);
  var exigibiliteDate = getLivraisonTVAExigibiliteDate(livraison, profile);
  return {
    id: livraison.id,
    sourceType: 'livraison',
    libelle: (livraison.numLiv ? livraison.numLiv + ' — ' : '') + (livraison.client || 'Livraison'),
    issueDate: issueDate,
    paymentDate: normaliserDateISO(livraison?.datePaiement),
    exigibiliteDate: exigibiliteDate,
    operationType: getLivraisonTVAOperationType(livraison, profile),
    tauxTVA: taux,
    baseHT: round2(baseHT),
    tva: montantTVA,
    ttc: round2(totalTTC),
    raw: livraison
  };
}

// L1009 (script.js d'origine)
function buildTVACollecteeData(range, profile) {
  var eligible = [];
  var pending = [];
  charger('livraisons').forEach(function(livraison) {
    var entry = buildTVACollecteeEntryFromLivraison(livraison, profile);
    if (!entry) return;
    if (entry.exigibiliteDate && isDateInRange(entry.exigibiliteDate, range)) {
      eligible.push(entry);
      return;
    }
    if (!entry.issueDate || !isDateInRange(entry.issueDate, range)) return;
    if (!entry.exigibiliteDate || entry.exigibiliteDate > range.fin) {
      pending.push(entry);
    }
  });
  return { eligible: eligible, pending: pending };
}

// L1027 (script.js d'origine)
function buildTVADeductibleEntries(range, profile) {
  if (!profile?.isVatEnabled) return [];
  var entries = [];
  charger('charges').filter(function(c) {
    return isDateInRange(c.date, range)
      && c.categorie !== 'tva'
      && !c.carburantId
      && !c.entretienId;
  }).forEach(function(c) {
    var taux = parseTauxTVAValue(c.tauxTVA, profile.defaultRate);
    var ht = getChargeMontantHT(c);
    var tva = getChargeMontantTVA(c) * (getChargeTauxDeductibilite(c) / 100);
    if (tva <= 0) return;
    entries.push({
      sourceType: 'charge',
      id: c.id,
      date: normaliserDateISO(c.date),
      tauxTVA: taux,
      libelle: c.description || 'Charge',
      baseHT: round2(ht),
      tva: round2(tva),
      ttc: round2(parseFloat(c.montant) || 0),
      raw: c
    });
  });
  charger('carburant').filter(function(p) { return isDateInRange(p.date, range); }).forEach(function(p) {
    var tauxTVA = parseTauxTVAValue(p.tauxTVA, 20);
    var ht = getCarburantMontantHT(p);
    var tvaDeductible = getCarburantMontantTVA(p) * (getTauxDeductibiliteCarburant(p) / 100);
    if (tvaDeductible <= 0) return;
    entries.push({
      sourceType: 'carburant',
      id: p.id,
      date: normaliserDateISO(p.date),
      tauxTVA: tauxTVA,
      libelle: (p.vehNom || 'Carburant') + ' — ' + ((p.typeCarburant || p.type || 'gasoil') === 'essence' ? 'Essence' : 'Gasoil') + ' (' + formaterTaux(getTauxDeductibiliteCarburant(p)) + ')',
      baseHT: round2(ht),
      tva: round2(tvaDeductible),
      ttc: round2(parseFloat(p.total) || 0),
      raw: p
    });
  });
  charger('entretiens').filter(function(e) { return isDateInRange(e.date, range); }).forEach(function(e) {
    var taux = parseTauxTVAValue(e.tauxTVA, profile.defaultRate);
    var ht = getEntretienMontantHT(e);
    var tvaDeductible = getEntretienMontantTVA(e) * (getTauxDeductibiliteEntretien(e) / 100);
    if (tvaDeductible <= 0) return;
    entries.push({
      sourceType: 'entretien',
      id: e.id,
      date: normaliserDateISO(e.date),
      tauxTVA: taux,
      libelle: getTypeEntretienLabel(e.type) + ' — ' + (e.description || 'Entretien') + ' (' + formaterTaux(getTauxDeductibiliteEntretien(e)) + ')',
      baseHT: round2(ht),
      tva: round2(tvaDeductible),
      ttc: round2(parseFloat(e.cout) || 0),
      raw: e
    });
  });
  return entries.sort(function(a, b) { return new Date((b.date || '')) - new Date((a.date || '')); });
}

// L1089 (script.js d'origine)
function buildTVASettlementEntries(range, profile) {
  var keys = new Set(getTVAPeriodKeysForRange(range, profile));
  return charger('charges')
    .filter(function(c) { return c.categorie === 'tva' && keys.has(getTVASettlementPeriodKey(c, profile)); })
    .map(function(c) {
      return {
        id: c.id,
        paymentDate: normaliserDateISO(c.date),
        periodKey: getTVASettlementPeriodKey(c, profile),
        periodLabel: getTVASettlementLabel(c, profile),
        montant: round2(parseFloat(c.montant) || 0),
        description: c.description || 'Versement TVA',
        raw: c
      };
    })
    .sort(function(a, b) { return new Date((b.paymentDate || '')) - new Date((a.paymentDate || '')); });
}

// L1107 (script.js d'origine)
function getTVASummaryForRange(range) {
  var profile = getTVAConfig();
  if (!profile.isVatEnabled) {
    return {
      profile: profile,
      collectee: [],
      pending: [],
      deductible: [],
      settlements: [],
      totalCollectee: 0,
      totalDeductible: 0,
      totalTVAPlanifiee: 0,
      soldeBrut: 0,
      tvaDueBrute: 0,
      tvaReverser: 0,
      tvaCredit: 0
    };
  }
  var collecteeData = buildTVACollecteeData(range, profile);
  var deductible = buildTVADeductibleEntries(range, profile);
  var settlements = buildTVASettlementEntries(range, profile);
  var totalCollectee = collecteeData.eligible.reduce(function(sum, item) { return sum + item.tva; }, 0);
  var totalDeductible = deductible.reduce(function(sum, item) { return sum + item.tva; }, 0);
  var totalTVAPlanifiee = settlements.reduce(function(sum, item) { return sum + item.montant; }, 0);
  var soldeBrut = round2(totalCollectee - totalDeductible);
  return {
    profile: profile,
    collectee: collecteeData.eligible,
    pending: collecteeData.pending,
    deductible: deductible,
    settlements: settlements,
    totalCollectee: round2(totalCollectee),
    totalDeductible: round2(totalDeductible),
    totalTVAPlanifiee: round2(totalTVAPlanifiee),
    soldeBrut: round2(soldeBrut),
    tvaDueBrute: Math.max(0, round2(soldeBrut)),
    tvaReverser: soldeBrut >= 0 ? Math.max(0, round2(soldeBrut - totalTVAPlanifiee)) : 0,
    tvaCredit: soldeBrut < 0 ? Math.abs(round2(soldeBrut)) : 0
  };
}

// L6732 (script.js d'origine)
function calculerTauxPonctualite() {
  const livraisons = charger('livraisons');
  const total  = livraisons.filter(l => l.statut !== 'en-attente').length;
  const livres = livraisons.filter(l => l.statut === 'livre').length;
  if (!total) return { taux: 0, livres, total };
  return { taux: Math.round(livres / total * 100), livres, total };
}

// L7744 (script.js d'origine)
function sauvegarderTVA() {
  const taux = parseFloat(document.getElementById('param-taux-tva')?.value) || 20;
  localStorage.setItem('taux_tva', taux);
  afficherToast('✅ Taux TVA enregistré : ' + taux + '%');
}

// L7750 (script.js d'origine)
function chargerConfigurationTVAParametres() {
  var profile = getTVAConfig();
  var map = {
    'param-tva-regime': profile.regime,
    'param-tva-activite': profile.activiteType,
    'param-tva-exigibilite': profile.exigibiliteServices,
    'param-tva-periodicite': profile.periodicite,
    'param-tva-taux-defaut': String(profile.defaultRate)
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = map[id];
  });
  var helper = document.getElementById('param-tva-helper');
  if (helper) {
    helper.textContent = profile.isVatEnabled
      ? getTVARegimeLabel(profile.regime) + ' · ' + getTVAActiviteLabel(profile.activiteType) + ' · ' + getTVAExigibiliteLabel(profile) + ' · Déclaration ' + getTVAPeriodiciteLabel(profile.periodicite).toLowerCase() + '.'
      : 'Franchise en base : aucune TVA facturée ni récupérée.';
  }
}

// L7788 (script.js d'origine)
function sauvegarderConfigurationTVA() {
  var regime = document.getElementById('param-tva-regime')?.value || 'reel_normal';
  var activiteType = document.getElementById('param-tva-activite')?.value || 'service';
  var exigibiliteServices = document.getElementById('param-tva-exigibilite')?.value || 'encaissements';
  var periodicite = document.getElementById('param-tva-periodicite')?.value || 'mensuelle';
  var defaultRate = parseTauxTVAValue(document.getElementById('param-tva-taux-defaut')?.value, 20);
  sauvegarder('tva_config', {
    regime: regime,
    activiteType: activiteType,
    exigibiliteServices: exigibiliteServices,
    periodicite: periodicite,
    defaultRate: defaultRate
  });
  localStorage.setItem('taux_tva', String(defaultRate));
  chargerConfigurationTVAParametres();
  afficherTva();
  rafraichirDashboard();
  ajouterEntreeAudit('Configuration TVA', getTVARegimeLabel(regime) + ' · ' + getTVAActiviteLabel(activiteType) + ' · ' + getTVAPeriodiciteLabel(periodicite));
  afficherToast('✅ Configuration TVA enregistrée');
}

// L7903 (script.js d'origine)
function getTauxTVA() {
  return parseFloat(localStorage.getItem('taux_tva') || '20');
}

// L9429 (script.js d'origine)
function navTvaMois(delta) {
  _tvaPeriode.mode = 'mois';
  if (delta === 0) _tvaPeriode.offset = 0;
  else _tvaPeriode.offset += delta;
  majPeriodeDisplay('tva-mois-label', 'tva-mois-dates', getPeriodeRange(_tvaPeriode.mode, _tvaPeriode.offset));
  afficherTva();
}

// L9437 (script.js d'origine)
function getTvaMoisStr() {
  return getPeriodeRange(_tvaPeriode.mode, _tvaPeriode.offset).debut.slice(0,7);
}

// L9440 (script.js d'origine)
function getTvaPeriodeRange() { return getPeriodeRange(_tvaPeriode.mode, _tvaPeriode.offset); }

// L9441 (script.js d'origine)
function changerVueTVA(mode) { changeSimplePeriode(_tvaPeriode, mode, afficherTva, 'tva-mois-label', 'tva-mois-dates', 'vue-tva-select'); }

// L9442 (script.js d'origine)
function navTvaPeriode(delta) { navSimplePeriode(_tvaPeriode, delta, afficherTva, 'tva-mois-label', 'tva-mois-dates', 'vue-tva-select'); }

// L9443 (script.js d'origine)
function reinitialiserTVAPeriode() { resetSimplePeriode(_tvaPeriode, afficherTva, 'tva-mois-label', 'tva-mois-dates', 'vue-tva-select'); }

// L9445 (script.js d'origine)
function afficherTva() {
  var range = getTvaPeriodeRange();
  var summary = getTVASummaryForRange(range);
  var profile = summary.profile;
  var periodSelect = document.getElementById('vue-tva-select');
  if (periodSelect) periodSelect.value = _tvaPeriode.mode;
  majPeriodeDisplay('tva-mois-label', 'tva-mois-dates', range);

  var collectTitle = document.getElementById('tva-collectee-title');
  if (collectTitle) {
    collectTitle.textContent = profile.isVatEnabled
      ? ((profile.activiteType === 'goods' || profile.exigibiliteServices === 'debits')
          ? '📤 TVA Collectée (exigible à la facture / livraison)'
          : '📤 TVA Collectée (exigible à l’encaissement)')
      : '📤 TVA Collectée';
  }
  var dedTitle = document.getElementById('tva-deductible-title');
  if (dedTitle) dedTitle.textContent = '📥 TVA Déductible (charges, carburant, entretiens)';

  var modeInfo = document.getElementById('tva-mode-info');
  if (modeInfo) {
    modeInfo.innerHTML = profile.isVatEnabled
      ? '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><div><div style="font-size:.92rem;font-weight:700">Mode TVA actif</div><div style="font-size:.82rem;color:var(--text-muted)">' + getTVARegimeLabel(profile.regime) + ' · ' + getTVAActiviteLabel(profile.activiteType) + ' · ' + getTVAExigibiliteLabel(profile) + '.</div></div><div style="font-size:.8rem;color:var(--text-muted)">Déclaration ' + getTVAPeriodiciteLabel(profile.periodicite).toLowerCase() + '</div></div>'
      : '<div style="font-size:.9rem;color:var(--text-muted)">Franchise en base : aucune TVA collectée ni déductible sur cette période.</div>';
  }

  var tbColl = document.getElementById('tb-tva-collectee');
  if (tbColl) {
    var rows = '';
    summary.collectee.forEach(function(entry) {
      rows += '<tr>'
        + '<td>' + formatDateExport(entry.exigibiliteDate) + '</td>'
        + '<td style="font-weight:700">' + entry.tauxTVA + ' %</td>'
        + '<td><button type="button" class="table-link-button" onclick="ouvrirEditLivraison(\'' + entry.id + '\')">' + planningEscapeHtml(entry.libelle) + '</button></td>'
        + '<td>' + euros(entry.baseHT) + '</td>'
        + '<td style="font-weight:700;color:var(--green)">' + euros(entry.tva) + '</td>'
        + '<td>' + euros(entry.ttc) + '</td>'
        + '<td><button type="button" class="btn-icon danger" onclick="supprimerSourceDepuisTVA(\'livraison\', \'' + entry.id + '\')" title="Supprimer">🗑️</button></td>'
        + '</tr>';
    });
    if (!rows) rows = '<tr><td colspan="7" class="empty-row">Aucune TVA collectée exigible sur cette période</td></tr>';
    else rows += '<tr style="background:rgba(46,204,113,.08);font-weight:700"><td>TOTAL</td><td></td><td></td><td></td><td style="color:var(--green)">' + euros(summary.totalCollectee) + '</td><td>' + euros(summary.collectee.reduce(function(sum, item) { return sum + item.ttc; }, 0)) + '</td><td></td></tr>';
    tbColl.innerHTML = rows;
  }

  var nonExigibleInfo = document.getElementById('tva-non-exigible-info');
  if (nonExigibleInfo) {
    if (!summary.pending.length) {
      nonExigibleInfo.innerHTML = '';
    } else {
      var totalPending = summary.pending.reduce(function(sum, item) { return sum + item.tva; }, 0);
      var pendingRows = summary.pending.map(function(item) {
        var detail = item.paymentDate ? 'Paiement prévu le ' + formatDateExport(item.paymentDate) : 'Aucun encaissement enregistré à ce jour';
        return '<div style="display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-top:1px solid var(--border)"><div><strong>' + planningEscapeHtml(item.libelle) + '</strong><div style="font-size:.78rem;color:var(--text-muted)">' + detail + '</div></div><div style="font-weight:700;color:var(--accent)">' + euros(item.tva) + '</div></div>';
      }).join('');
      nonExigibleInfo.innerHTML = '<div style="margin-top:4px;padding:14px 16px;border-radius:12px;background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.22)"><div style="font-size:.88rem;font-weight:700;margin-bottom:6px">📅 Facturé mais non encore exigible</div><div style="font-size:.8rem;color:var(--text-muted);margin-bottom:6px">' + summary.pending.length + ' livraison(s) facturées sur la période restent hors TVA collectée tant qu’elles ne sont pas exigibles.</div><div style="font-size:.82rem;font-weight:700;color:var(--accent);margin-bottom:4px">TVA concernée : ' + euros(totalPending) + '</div>' + pendingRows + '</div>';
    }
  }

  var tbDed = document.getElementById('tb-tva-deductible');
  if (tbDed) {
    var rows2 = '';
    summary.deductible.forEach(function(entry) {
      var openAction = entry.sourceType === 'charge'
        ? "ouvrirEditCharge('" + entry.id + "')"
        : entry.sourceType === 'carburant'
          ? "ouvrirEditCarburantAdmin('" + entry.id + "')"
          : "ouvrirEditEntretien('" + entry.id + "')";
      var deleteAction = "supprimerSourceDepuisTVA('" + entry.sourceType + "', '" + entry.id + "')";
      rows2 += '<tr>'
        + '<td>' + formatDateExport(entry.date) + '</td>'
        + '<td style="font-weight:700">' + entry.tauxTVA + ' %</td>'
        + '<td><button type="button" class="table-link-button" onclick="' + openAction + '">' + planningEscapeHtml(entry.libelle) + '</button></td>'
        + '<td>' + euros(entry.baseHT) + '</td>'
        + '<td style="font-weight:700;color:var(--accent)">' + euros(entry.tva) + '</td>'
        + '<td>' + euros(entry.ttc) + '</td>'
        + '<td><button type="button" class="btn-icon danger" onclick="' + deleteAction + '" title="Supprimer">🗑️</button></td>'
        + '</tr>';
    });
    if (!rows2) rows2 = '<tr><td colspan="7" class="empty-row">Aucune TVA déductible sur cette période</td></tr>';
    else rows2 += '<tr style="background:rgba(245,166,35,.08);font-weight:700"><td>TOTAL</td><td></td><td></td><td></td><td style="color:var(--accent)">' + euros(summary.totalDeductible) + '</td><td></td><td></td></tr>';
    tbDed.innerHTML = rows2;
  }

  var setT = function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
  setT('tva-collectee', euros(summary.totalCollectee));
  setT('tva-deductible', euros(summary.totalDeductible));
  window.__lastTvaBrutSolde = summary.soldeBrut;

  var soldeEl = document.getElementById('tva-solde-detail');
  if (soldeEl) {
    var settlementsHtml = summary.settlements.length
      ? '<div style="margin-top:18px"><div style="font-size:.82rem;font-weight:700;margin-bottom:8px">Règlements TVA liés à cette période déclarative</div><div style="display:grid;gap:8px">' + summary.settlements.map(function(item) {
          return '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--bg-dark);border:1px solid var(--border)"><div><div style="font-weight:600">' + planningEscapeHtml(item.description) + '</div><div style="font-size:.78rem;color:var(--text-muted)">' + item.periodLabel + ' · Paiement ' + formatDateExport(item.paymentDate) + '</div></div><div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--blue)">' + euros(item.montant) + '</strong><button type="button" class="btn-icon danger" onclick="supprimerSourceDepuisTVA(\'charge\', \'' + item.id + '\')" title="Supprimer">🗑️</button></div></div>';
        }).join('') + '</div></div>'
      : '<div style="margin-top:16px;font-size:.82rem;color:var(--text-muted);text-align:center">Aucun versement TVA enregistré pour cette période déclarative.</div>';
    soldeEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;text-align:center">'
      + '<div style="padding:16px;background:rgba(46,204,113,.06);border-radius:10px;border:1px solid rgba(46,204,113,.2)"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">TVA Collectée</div><div style="font-size:1.3rem;font-weight:800;color:var(--green)">' + euros(summary.totalCollectee) + '</div></div>'
      + '<div style="padding:16px;background:rgba(245,166,35,.06);border-radius:10px;border:1px solid rgba(245,166,35,.2)"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">TVA Déductible</div><div style="font-size:1.3rem;font-weight:800;color:var(--accent)">' + euros(summary.totalDeductible) + '</div></div>'
      + '<div style="padding:16px;background:rgba(79,142,247,.06);border-radius:10px;border:1px solid rgba(79,142,247,.2)"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">Déjà planifiée / réglée</div><div style="font-size:1.3rem;font-weight:800;color:var(--blue)">' + euros(summary.totalTVAPlanifiee) + '</div></div>'
      + '<div style="padding:16px;background:' + (summary.soldeBrut >= 0 ? 'rgba(231,76,60,.06)' : 'rgba(155,89,182,.08)') + ';border-radius:10px;border:1px solid ' + (summary.soldeBrut >= 0 ? 'rgba(231,76,60,.2)' : 'rgba(155,89,182,.25)') + '"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">' + (summary.soldeBrut >= 0 ? 'Reste non planifié' : 'Crédit de TVA') + '</div><div style="font-size:1.3rem;font-weight:800;color:' + (summary.soldeBrut >= 0 ? 'var(--red)' : 'var(--purple)') + '">' + euros(summary.soldeBrut >= 0 ? summary.tvaReverser : summary.tvaCredit) + '</div></div>'
      + '</div>'
      + '<div style="margin-top:16px;font-size:.82rem;color:var(--text-muted);text-align:center">' + (summary.soldeBrut >= 0
          ? 'TVA due brute : ' + euros(summary.tvaDueBrute) + ' · Planifiée / réglée : ' + euros(summary.totalTVAPlanifiee) + ' · Reste non planifié : ' + euros(summary.tvaReverser)
          : 'Crédit de TVA disponible : ' + euros(summary.tvaCredit)) + '</div>'
      + settlementsHtml;
  }
}

// L9554 (script.js d'origine)
async function supprimerSourceDepuisTVA(type, id) {
  if (!id) return;
  if (type === 'livraison') {
    await supprimerLivraison(id);
  } else if (type === 'charge') {
    await supprimerCharge(id);
  } else if (type === 'carburant') {
    await supprimerCarburant(id);
  } else if (type === 'entretien') {
    await supprimerEntretien(id);
  }
  afficherTva();
}

