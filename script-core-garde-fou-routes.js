/**
 * MCA Logistics — Garde-fou routes au boot (vérifie pages DOM ↔ routes) (Phase X — extraction script.js)
 *
 * Extracted from script.js L543-573 (2026-05-16).
 */

/* ===== GARDE-FOU ROUTES =====
   Au boot, vérifie que toutes les sections <section class="page" id="page-X">
   du DOM ont une route connue (case dans naviguerVers + entrée valide dans
   un hub OU un nav-item sidebar). Et inversement, qu'aucune route invoquée
   ne pointe vers une section absente. Évite les "404 silencieux" comme la
   page TVA récemment retrouvée. */
(function() {
  if (typeof document === 'undefined') return;
  function audit() {
    if (document.readyState === 'loading') {
      return document.addEventListener('DOMContentLoaded', audit);
    }
    var sectionsDOM = Array.from(document.querySelectorAll('section.page[id^="page-"]'))
      .map(function(s) { return s.id.replace(/^page-/, ''); });
    var hubsDebug = window.__s22Debug;
    var hubPages = hubsDebug ? hubsDebug.ALL_SUB_PAGES.slice() : [];
    var navItems = Array.from(document.querySelectorAll('.nav-item[data-page]'))
      .map(function(a) { return a.dataset.page; });
    var routesConnues = new Set(hubPages.concat(navItems).concat([
      'dashboard', 'espace-salarie'
    ]));
    sectionsDOM.forEach(function(p) {
      if (!routesConnues.has(p)) {
        console.warn('[ROUTES] Section #page-' + p + ' existe dans le DOM mais aucune route ne mène à elle (ni hub ni nav-item)');
      }
    });
    // Expose pour debug
    window.__routesDebug = { sectionsDOM: sectionsDOM, hubPages: hubPages, navItems: navItems };
  }
  audit();
})();
