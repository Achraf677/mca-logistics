/**
 * MCA Logistics — Reset filtres page Livraisons (statut/paiement/dates) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1076-1084 (2026-05-16).
 */

function resetFiltres() {
  ['filtre-statut','filtre-paiement','filtre-date-debut','filtre-date-fin','filtre-recherche-liv','filtre-chauffeur'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  _livPeriodePersonnalisee = null;
  var range = getPeriodeRange(_livPeriodeMode, _livPeriodeOffset);
  majPeriodeDisplay('liv-periode-label', 'liv-periode-dates', range);
  afficherLivraisons();
}

if (typeof window !== 'undefined') {
  window.resetFiltres = resetFiltres;
}
