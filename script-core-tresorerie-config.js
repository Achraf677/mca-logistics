/**
 * MCA Logistics — Configuration trésorerie Paramètres (charger + sauvegarder) (Phase X — extraction script.js)
 *
 * Extracted from script.js L2766-2795 (2026-05-16).
 */

function chargerConfigurationTresorerieParametres() {
  var cfg = (typeof chargerObj === 'function') ? chargerObj('treso_config', {}) : {};
  var map = {
    'param-treso-solde-depart': cfg.soldeDepart || 0,
    'param-treso-echeance-tva': cfg.echeanceTVA || ''
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = map[id];
  });
  var helper = document.getElementById('param-treso-helper');
  if (helper) {
    helper.textContent = 'Base de trésorerie : ' + euros(cfg.soldeDepart || 0)
      + (cfg.echeanceTVA ? ' · Échéance TVA : ' + formatDateExport(cfg.echeanceTVA) : '');
  }
}

// MOVED -> script-tva.js : sauvegarderConfigurationTVA

function sauvegarderConfigurationTresorerie() {
  var cfg = chargerObj('treso_config', {});
  cfg.soldeDepart = parseFloat(document.getElementById('param-treso-solde-depart')?.value || '0') || 0;
  cfg.echeanceTVA = document.getElementById('param-treso-echeance-tva')?.value || '';
  delete cfg.chargesSalariales;
  sauvegarder('treso_config', cfg);
  chargerConfigurationTresorerieParametres();
  rafraichirDashboard();
  ajouterEntreeAudit('Configuration trésorerie', 'Base ' + euros(cfg.soldeDepart || 0) + (cfg.echeanceTVA ? ' · Échéance TVA ' + formatDateExport(cfg.echeanceTVA) : ''));
  afficherToast('✅ Configuration de trésorerie enregistrée');
}

if (typeof window !== 'undefined') {
  window.chargerConfigurationTresorerieParametres = chargerConfigurationTresorerieParametres;
  window.sauvegarderConfigurationTresorerie = sauvegarderConfigurationTresorerie;
}
