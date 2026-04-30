/**
 * MCA Logistics — Watchdog au boot
 *
 * Verifie au demarrage que les fonctions globales critiques sont bien
 * definies. Si une manque, alerte console + Sentry pour qu'on le voie
 * immediatement (au lieu de decouvrir le bug 2 jours plus tard quand
 * un user clique sur un bouton qui appelle une fonction inexistante).
 *
 * A charger en DERNIER (apres tous les modules) dans admin.html / salarie.html.
 */

(function () {
  'use strict';

  var ADMIN_REQUIRED = [
    // Navigation
    'naviguerVers',
    // Storage helpers
    'charger', 'sauvegarder', 'loadSafe',
    // Modals
    'openModal', 'closeModal',
    // UI feedback
    'afficherToast',
    // Auth
    'genId',
    // Modules metier (entry points principaux)
    'afficherDashboard', 'rafraichirDashboard',
    'afficherLivraisons', 'ajouterLivraison',
    'afficherClients', 'ajouterClient',
    'afficherVehicules', 'ajouterVehicule',
    'afficherSalaries', 'creerSalarie',
    'afficherCharges', 'ajouterCharge',
    'afficherCarburant', 'ajouterCarburant',
    'afficherEntretiens', 'ajouterEntretien',
    'afficherInspections',
    'afficherIncidents',
    'afficherTva',
    'afficherStatistiques',
    'afficherRentabilite',
    'afficherPlanning',
    'afficherAlertes',
    // Adapters / sync
    'createSupabaseEntityAdapter',
    // Repo
    'Repo',
    // Storage
    'DelivProStorage',
    // Monitoring
    'MCA'
  ];

  var SALARIE_REQUIRED = [
    'changerOnglet',
    'afficherAccueil',
    'envoyerMessageSal',
    'envoyerPhotoSal',
    'chargerMessagesSal',
    'chargerHistoriqueCarburant',
    'getMonVehicule',
    'DelivProSupabase',
    'MCA'
  ];

  function isAdminPage() {
    return /admin\.html$/i.test(location.pathname) || location.pathname === '/' || location.pathname === '/index.html';
  }
  function isSalariePage() {
    return /salarie\.html$/i.test(location.pathname);
  }

  function checkRequired(list, label) {
    var missing = [];
    list.forEach(function (name) {
      if (typeof window[name] === 'undefined') missing.push(name);
    });
    if (!missing.length) {
      console.info('[watchdog] ' + label + ' : ' + list.length + ' fonctions critiques OK');
      return;
    }
    var msg = '[watchdog] ' + label + ' : ' + missing.length + ' fonctions critiques MANQUANTES : ' + missing.join(', ');
    console.error(msg);
    if (window.MCA && window.MCA.captureMessage) {
      window.MCA.captureMessage('Watchdog : fonctions manquantes', 'error', { page: label, missing: missing });
    }
  }

  function runWatchdog() {
    try {
      if (isAdminPage()) checkRequired(ADMIN_REQUIRED, 'admin');
      else if (isSalariePage()) checkRequired(SALARIE_REQUIRED, 'salarie');
    } catch (e) {
      console.warn('[watchdog] erreur :', e);
    }
  }

  // Lance le watchdog 3s apres le boot (laisse le temps a tous les modules
  // de se charger, lazy stubs y compris).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(runWatchdog, 3000);
    });
  } else {
    setTimeout(runWatchdog, 3000);
  }

  window.MCA = window.MCA || {};
  window.MCA.runWatchdog = runWatchdog;
})();
