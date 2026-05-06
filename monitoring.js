/**
 * MCA Logistics — Module monitoring (Sentry + mode debug)
 *
 * 1) SENTRY : capture automatique des erreurs JS en prod.
 *    Pour activer, renseigner SENTRY_DSN ci-dessous (recupere depuis sentry.io).
 *    Tant que SENTRY_DSN est vide, le module est inactif (pas d'envoi).
 *
 * 2) MODE DEBUG : logs detailles toggleable sans deploiement.
 *    Activer en console : MCA.debug.enable()
 *    Desactiver        : MCA.debug.disable()
 *    Status            : MCA.debug.status()
 *    Categories actives : storage, sync, auth, ui, api (par defaut toutes si actif)
 *    Filtre par categorie : MCA.debug.enable('sync,storage')
 *
 *    Dans le code : MCA.log('sync', 'pulled', count) — n'affiche QUE si debug actif
 *    et categorie autorisee.
 *
 * Charge en PREMIER dans admin.html / salarie.html / login.html (avant tout
 * autre script) pour capturer les erreurs des autres modules.
 */

(function () {
  'use strict';

  // ============================================================
  // Configuration Sentry
  // ============================================================
  // Pour activer, mettre votre DSN ici (recupere depuis sentry.io > Project Settings > Client Keys).
  // Format : https://<key>@<org>.ingest.sentry.io/<project-id>
  // Ce DSN est PUBLIC (cote client) et c'est normal — Sentry est concu pour ca.
  var SENTRY_DSN = 'https://8bea3bf0802736fd11390c85471aa446@o4511305319907328.ingest.de.sentry.io/4511305336029264';
  var SENTRY_ENV = (typeof location !== 'undefined' && location.hostname === 'localhost')
    ? 'development'
    : 'production';
  var SENTRY_RELEASE = 'v3.69-20260505'; // bump avec le cache version

  // ============================================================
  // Mode debug (logs categorises togglables sans deploy)
  // ============================================================
  var DEBUG_KEY = 'mca_debug';

  function getDebugConfig() {
    try {
      var v = window.localStorage.getItem(DEBUG_KEY);
      if (!v || v === '0' || v === 'false') return null;
      if (v === '1' || v === 'true' || v === 'on' || v === 'all') return { categories: '*' };
      // Liste de categories : "sync,storage"
      return { categories: v.split(',').map(function (s) { return s.trim().toLowerCase(); }) };
    } catch (_) { return null; }
  }

  function debugEnable(categories) {
    var val = categories ? String(categories) : '1';
    try { window.localStorage.setItem(DEBUG_KEY, val); } catch (_) {}
    console.info('[MCA debug] active. Categories :', val);
    return val;
  }

  function debugDisable() {
    try { window.localStorage.removeItem(DEBUG_KEY); } catch (_) {}
    console.info('[MCA debug] desactive');
  }

  function debugStatus() {
    var cfg = getDebugConfig();
    return cfg ? { enabled: true, categories: cfg.categories } : { enabled: false };
  }

  function shouldLog(category) {
    var cfg = getDebugConfig();
    if (!cfg) return false;
    if (cfg.categories === '*') return true;
    return cfg.categories.indexOf((category || '').toLowerCase()) >= 0;
  }

  function log(category /*, ...args */) {
    if (!shouldLog(category)) return;
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift('[MCA:' + category + ']');
    console.log.apply(console, args);
  }

  function warn(category /*, ...args */) {
    if (!shouldLog(category)) return;
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift('[MCA:' + category + ']');
    console.warn.apply(console, args);
  }

  // ============================================================
  // Sentry init (charge le SDK uniquement si DSN configure)
  // ============================================================
  function initSentry() {
    if (!SENTRY_DSN) return; // inactif tant que pas configure

    var script = document.createElement('script');
    script.src = 'https://browser.sentry-cdn.com/8.40.0/bundle.min.js';
    script.crossOrigin = 'anonymous';
    // Note : pas d'integrity SRI car Sentry CDN met a jour la version
    // periodiquement ; un hash fixe se desyncroniserait. La CSP whitelist
    // browser.sentry-cdn.com en script-src, ce qui suffit comme garantie.
    script.onload = function () {
      if (!window.Sentry) { console.warn('[MCA monitoring] Sentry SDK non charge'); return; }
      window.Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENV,
        release: SENTRY_RELEASE,
        tracesSampleRate: 0.0,         // pas de tracing (perf monitoring) pour rester gratuit
        replaysSessionSampleRate: 0.0, // pas de session replay
        replaysOnErrorSampleRate: 0.0,
        ignoreErrors: [
          // Erreurs benignes / hors notre controle
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          'Non-Error promise rejection captured',
          'Network request failed',
        ],
        beforeSend: function (event) {
          // Strip des donnees sensibles potentielles
          if (event.request && event.request.cookies) delete event.request.cookies;
          return event;
        }
      });

      // Tagger l'utilisateur connecte (admin / salarie)
      try {
        var role = sessionStorage.getItem('role') || 'anonymous';
        var actor = sessionStorage.getItem('admin_actor_label') || sessionStorage.getItem('salarie_nom') || 'inconnu';
        window.Sentry.setUser({ role: role, actor: actor });
        window.Sentry.setTag('role', role);
      } catch (_) {}

      console.info('[MCA monitoring] Sentry actif (env=' + SENTRY_ENV + ', release=' + SENTRY_RELEASE + ')');
    };
    script.onerror = function () { console.warn('[MCA monitoring] echec chargement Sentry SDK'); };
    document.head.appendChild(script);
  }

  // ============================================================
  // Capture manuelle (utilisable par le code metier sans dependance dure a Sentry)
  // ============================================================
  function captureException(err, context) {
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      try {
        window.Sentry.withScope(function (scope) {
          if (context) scope.setExtras(context);
          window.Sentry.captureException(err);
        });
      } catch (_) {}
    }
    console.error('[MCA error]', err, context || '');
  }

  function captureMessage(msg, level, context) {
    if (window.Sentry && typeof window.Sentry.captureMessage === 'function') {
      try {
        window.Sentry.withScope(function (scope) {
          if (context) scope.setExtras(context);
          window.Sentry.captureMessage(msg, level || 'info');
        });
      } catch (_) {}
    }
    console.log('[MCA ' + (level || 'info') + ']', msg, context || '');
  }

  // ============================================================
  // Expose API publique
  // ============================================================
  window.MCA = window.MCA || {};
  window.MCA.log = log;
  window.MCA.warn = warn;
  window.MCA.captureException = captureException;
  window.MCA.captureMessage = captureMessage;
  window.MCA.debug = {
    enable: debugEnable,
    disable: debugDisable,
    status: debugStatus,
    log: log,
    warn: warn
  };

  // Init Sentry au load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSentry);
  } else {
    initSentry();
  }

  // Capture des erreurs non gerees comme fallback (au cas ou Sentry pas charge)
  window.addEventListener('error', function (event) {
    if (window.Sentry) return; // Sentry s'en charge nativement
    if (shouldLog('error')) console.error('[MCA error fallback]', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (window.Sentry) return;
    if (shouldLog('error')) console.error('[MCA promise reject]', event.reason);
  });
})();
