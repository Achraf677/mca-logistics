/**
 * MCA Logistics — Health Check
 *
 * Module de diagnostic rapide. Permet de verifier en un clin d'oeil
 * que tous les modules sont charges, les sync OK, le Storage accessible.
 *
 * Utilisation en console F12 :
 *   MCA.healthCheck()        -> rapport en table console
 *   MCA.healthCheck.json()   -> objet JSON
 *
 * Ou depuis un onglet admin parametres : bouton "Diagnostic systeme".
 */

(function () {
  'use strict';

  function getCounts() {
    var counts = {};
    var keys = ['livraisons', 'clients', 'fournisseurs', 'salaries', 'vehicules',
      'carburant', 'entretiens', 'charges', 'paiements', 'incidents',
      'inspections', 'plannings', 'absences_periodes', 'alertes_admin'];
    keys.forEach(function (k) {
      try {
        var raw = localStorage.getItem(k);
        if (!raw) { counts[k] = 0; return; }
        var arr = JSON.parse(raw);
        counts[k] = Array.isArray(arr) ? arr.length : '?';
      } catch (_) { counts[k] = 'err'; }
    });
    return counts;
  }

  function checkModules() {
    var modules = [
      'createSupabaseEntityAdapter', 'DelivProEntityAdapters',
      'DelivProClientsAdapter', 'DelivProVehiculesAdapter', 'DelivProSalariesAdapter',
      'DelivProStorage', 'DelivProSupabase', 'Repo',
      'naviguerVers', 'charger', 'sauvegarder', 'openModal', 'closeModal',
      'afficherToast', 'genId', 'rafraichirDashboard',
      'lazyLoadModule', 'MCA'
    ];
    var status = {};
    modules.forEach(function (m) {
      status[m] = (typeof window[m] !== 'undefined') ? '✅' : '❌';
    });
    return status;
  }

  function checkAdaptersStatus() {
    var statuses = {};
    var adapters = ['clients', 'vehicules', 'salaries'];
    adapters.forEach(function (n) {
      var key = 'DelivPro' + n.charAt(0).toUpperCase() + n.slice(1) + 'Adapter';
      var a = window[key];
      if (a && typeof a.debugStatus === 'function') {
        try { statuses[n] = a.debugStatus(); } catch (e) { statuses[n] = { error: e.message }; }
      } else {
        statuses[n] = '?';
      }
    });
    if (window.DelivProEntityAdapters) {
      ['livraisons', 'charges', 'carburant', 'entretiens', 'paiements', 'incidents'].forEach(function (n) {
        var a = window.DelivProEntityAdapters[n];
        if (a && typeof a.debugStatus === 'function') {
          try { statuses[n] = a.debugStatus(); } catch (e) { statuses[n] = { error: e.message }; }
        }
      });
    }
    return statuses;
  }

  function checkSentry() {
    return {
      sdk_loaded: !!window.Sentry,
      session_user: window.Sentry && window.Sentry.getCurrentScope ? !!window.Sentry.getCurrentScope() : '?',
      mode_debug: window.MCA && window.MCA.debug ? window.MCA.debug.status() : '?'
    };
  }

  function check() {
    var report = {
      timestamp: new Date().toISOString(),
      version: (typeof CACHE_VERSION !== 'undefined') ? CACHE_VERSION : 'unknown',
      role: sessionStorage.getItem('role') || 'anonymous',
      counts_localStorage: getCounts(),
      modules: checkModules(),
      adapters: checkAdaptersStatus(),
      sentry: checkSentry(),
      service_worker: 'serviceWorker' in navigator ? 'available' : 'unavailable',
      online: navigator.onLine
    };

    console.group('🔍 MCA Health Check');
    console.log('Timestamp:', report.timestamp);
    console.log('Role:', report.role);
    console.log('Online:', report.online);
    console.table(report.counts_localStorage);
    console.table(report.modules);
    console.log('Adapters:', report.adapters);
    console.log('Sentry:', report.sentry);
    console.groupEnd();

    return report;
  }

  function checkJson() { return JSON.stringify(check(), null, 2); }
  check.json = checkJson;

  window.MCA = window.MCA || {};
  window.MCA.healthCheck = check;
})();
