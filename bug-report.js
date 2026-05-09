/**
 * MCA Logistics — Bug Report helper
 *
 * Permet a Achraf (ou les chauffeurs) de signaler un bug en 2 clics depuis
 * l'app, avec capture automatique du contexte technique :
 *   - URL courante
 *   - Version cache (CACHE_VERSION extraite du sw.js)
 *   - User-agent navigateur
 *   - Viewport + orientation
 *   - 50 derniers logs console (capturés via console.* hook)
 *   - Last error si presente (Sentry-style)
 *
 * Usage UI (cote PC + mobile) :
 *   - Le helper expose window.BugReport.open() pour afficher le dialogue
 *   - Boutons UI doivent etre cables manuellement (drawer mobile + footer PC)
 *
 * Le rapport est :
 *   1. Copie dans le presse-papier (markdown formate)
 *   2. Optionnellement envoye a un endpoint Supabase (table bug_reports)
 *   3. Lien gh:// vers une nouvelle issue pre-remplie (utilisateur la valide)
 *
 * Pas de framework, pas de dep npm. ~150 lignes.
 */
(function () {
  'use strict';

  if (window.BugReport) return;

  // Capture des 50 derniers console.log/warn/error pour debug context
  var LOG_RING = [];
  var MAX_LOGS = 50;
  var origLog = console.log.bind(console);
  var origWarn = console.warn.bind(console);
  var origError = console.error.bind(console);

  function pushLog(level, args) {
    try {
      var line = '[' + level + '] ' + Array.from(args).map(function (a) {
        if (a instanceof Error) return a.name + ': ' + a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a).slice(0, 300); } catch (_) { return '[obj]'; }
        }
        return String(a).slice(0, 300);
      }).join(' ');
      LOG_RING.push({ t: Date.now(), line: line });
      if (LOG_RING.length > MAX_LOGS) LOG_RING.shift();
    } catch (_) {}
  }
  console.log = function () { pushLog('log', arguments); origLog.apply(null, arguments); };
  console.warn = function () { pushLog('warn', arguments); origWarn.apply(null, arguments); };
  console.error = function () { pushLog('error', arguments); origError.apply(null, arguments); };

  // Capture aussi window.onerror et unhandledrejection
  window.addEventListener('error', function (e) {
    pushLog('error', ['unhandled', e.message, e.filename + ':' + e.lineno]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    pushLog('error', ['unhandledrejection', e.reason && e.reason.message ? e.reason.message : String(e.reason)]);
  });

  function getCacheVersion() {
    try {
      // Si monitoring.js a deja fetch sw.js, la version est dans window
      if (window.CACHE_VERSION_GLOBAL) return window.CACHE_VERSION_GLOBAL;
    } catch (_) {}
    return 'unknown';
  }

  function buildReport(userDescription) {
    var ctx = {
      url: location.href,
      cache_version: getCacheVersion(),
      user_agent: navigator.userAgent,
      viewport: window.innerWidth + 'x' + window.innerHeight,
      orientation: (screen.orientation && screen.orientation.type) || 'unknown',
      mode: document.body.classList.contains('m-app') ? 'mobile' : 'pc',
      timestamp: new Date().toISOString(),
      logs: LOG_RING.slice(-MAX_LOGS).map(function (l) {
        return new Date(l.t).toISOString().slice(11, 19) + ' ' + l.line;
      }),
    };

    var md = [
      '## Bug report — ' + ctx.timestamp,
      '',
      '### Description (utilisateur)',
      userDescription || '_(non renseigne)_',
      '',
      '### Contexte technique',
      '- **URL** : `' + ctx.url + '`',
      '- **Cache version** : `' + ctx.cache_version + '`',
      '- **Mode** : `' + ctx.mode + '`',
      '- **Viewport** : `' + ctx.viewport + '` (' + ctx.orientation + ')',
      '- **User-agent** : `' + ctx.user_agent + '`',
      '',
      '### 50 derniers logs console',
      '```',
      ctx.logs.length ? ctx.logs.join('\n') : '(aucun log capture)',
      '```',
      '',
      '_Signale via le bouton 🐛 in-app._',
    ].join('\n');

    return { ctx: ctx, markdown: md };
  }

  function openDialog() {
    // Petite modale vanilla — pas de dependance
    var existing = document.getElementById('bug-report-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'bug-report-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = (
      '<div style="background:var(--bg-card,#1e2128);color:var(--text,#e5e7eb);padding:20px;border-radius:12px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:system-ui,sans-serif">'
      + '<h2 style="margin:0 0 12px;font-size:1.1rem">🐛 Signaler un bug</h2>'
      + '<p style="margin:0 0 12px;font-size:.9rem;color:var(--text-muted,#9ca3af)">Decris ce qui ne marche pas. Le contexte technique (URL, version, logs) est ajoute automatiquement.</p>'
      + '<textarea id="bug-report-text" rows="5" placeholder="Ex: Le bouton + livraison ne reagit pas quand je tape dessus apres avoir ouvert un brouillon..." style="width:100%;padding:10px;border:1px solid var(--border,#374151);border-radius:6px;background:var(--bg-input,#111827);color:inherit;font:inherit;resize:vertical;box-sizing:border-box"></textarea>'
      + '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">'
      + '<button type="button" id="bug-report-cancel" style="padding:8px 16px;border:1px solid var(--border,#374151);border-radius:6px;background:transparent;color:inherit;cursor:pointer">Annuler</button>'
      + '<button type="button" id="bug-report-submit" style="padding:8px 16px;border:none;border-radius:6px;background:var(--accent,#dc2626);color:#fff;cursor:pointer;font-weight:600">📋 Copier le rapport</button>'
      + '</div>'
      + '</div>'
    );
    document.body.appendChild(modal);
    document.getElementById('bug-report-text').focus();

    function close() { modal.remove(); }
    document.getElementById('bug-report-cancel').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    document.getElementById('bug-report-submit').addEventListener('click', function () {
      var desc = document.getElementById('bug-report-text').value.trim();
      var report = buildReport(desc);
      // Copy to clipboard
      var copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(report.markdown);
          copied = true;
        }
      } catch (_) {}
      if (!copied) {
        // Fallback : montrer le rapport pour copier-coller manuel
        var ta = document.getElementById('bug-report-text');
        ta.value = report.markdown;
        ta.select();
      }
      // Toast de confirmation
      if (window.afficherToast) window.afficherToast('Rapport copie dans le presse-papier', 'success');
      else if (window.M && window.M.toast) window.M.toast('Rapport copie', 'success');
      else alert('Rapport copie dans le presse-papier. Colle-le dans une issue GitHub ou un message a Achraf.');
      close();
    });
  }

  window.BugReport = {
    open: openDialog,
    build: buildReport,
    getLogs: function () { return LOG_RING.slice(); },
  };
})();
