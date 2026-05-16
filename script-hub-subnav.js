/* Phase 91.70 — Hub sub-nav (Finance + Parc auto)
   Affiche en tête de chaque page Finance ou Parc auto une barre de tabs latérale
   permettant de naviguer entre pages sœurs du même hub sans passer par la sidebar.
   Marque automatiquement l'onglet actif basé sur le data-page de la section parente. */
(function () {
  'use strict';

  function markActive() {
    document.querySelectorAll('.hub-subnav').forEach(function (nav) {
      var section = nav.closest('section.page');
      if (!section) return;
      var pageId = section.id.replace(/^page-/, '');
      nav.querySelectorAll('.hub-subnav__tab').forEach(function (a) {
        var target = a.getAttribute('data-page');
        var isActive = target === pageId;
        a.classList.toggle('is-active', isActive);
        if (isActive) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    });
  }

  function handleClick(e) {
    var t = e.target && e.target.closest && e.target.closest('.hub-subnav__tab');
    if (!t) return;
    var page = t.getAttribute('data-page');
    if (!page) return;
    e.preventDefault();
    if (typeof window.naviguerVers === 'function') {
      try { window.naviguerVers(page); } catch (_) {}
    }
  }

  function init() {
    document.addEventListener('click', handleClick, true);
    markActive();
    // Re-mark quand la section visible change
    var obs = new MutationObserver(markActive);
    document.querySelectorAll('section.page').forEach(function (s) {
      obs.observe(s, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshHubSubnav = markActive;
})();
