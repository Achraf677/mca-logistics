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
  // SENTRY_RELEASE auto-extrait de sw.js CACHE_VERSION (PR #50 M4) — un seul
  // endroit a bump : sw.js. Memoise dans window.__MCA_VERSION_PROMISE pour eviter
  // double fetch (Sentry init + affichage UI sidebar).
  var SENTRY_RELEASE = 'unknown';
  if (typeof window !== 'undefined') {
    if (!window.__MCA_VERSION_PROMISE) {
      window.__MCA_VERSION_PROMISE = fetch('/sw.js', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (txt) {
          var m = /CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(txt || '');
          var v = (m && m[1]) || 'unknown';
          window.__MCA_VERSION = v;
          // Hydrate l'affichage sidebar PC + footer mobile si presents
          try {
            var elPc = document.getElementById('sidebar-version-num');
            if (elPc) elPc.textContent = v.replace(/^mca-/, '').slice(0, 32);
            var elM = document.getElementById('m-app-version');
            if (elM) elM.textContent = v.replace(/^mca-/, '');
          } catch (_) {}
          return v;
        })
        .catch(function () { window.__MCA_VERSION = 'unknown'; return 'unknown'; });
    }
    window.__MCA_VERSION_PROMISE.then(function (v) { SENTRY_RELEASE = v; });
  }

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
  // Sentry release : extraite depuis sw.js (CACHE_VERSION) pour rester
  // synchronisee sans intervention manuelle. Best-effort : si fetch echoue,
  // on initialise quand meme avec le fallback ('unknown').
  // ============================================================
  function resolveReleaseThen(cb) {
    try {
      // Cache local pour eviter un fetch a chaque init (rare mais possible
      // avec Sentry qui se charge async)
      var cached = window.__MCA_SENTRY_RELEASE__;
      if (cached) { SENTRY_RELEASE = cached; cb(); return; }
    } catch (_) {}
    try {
      fetch('/sw.js', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (txt) {
          var m = txt && txt.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
          if (m && m[1]) {
            SENTRY_RELEASE = m[1];
            try { window.__MCA_SENTRY_RELEASE__ = m[1]; } catch (_) {}
          }
          cb();
        })
        .catch(function () { cb(); });
    } catch (_) { cb(); }
  }

  // ============================================================
  // Sentry init (charge le SDK uniquement si DSN configure)
  // ============================================================
  function initSentry() {
    if (!SENTRY_DSN) return; // inactif tant que pas configure
    resolveReleaseThen(_initSentryNow);
  }

  function _initSentryNow() {
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
  window.MCA.shouldLog = shouldLog;
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
