/* Phase 91.58 — Tabs internes Encaissement (3 onglets : Suivi / Détails / Analyse).
   Évite l'empilage vertical de 5 sections (5 viewports de scroll) signalé par Agent E. */
(function () {
  'use strict';

  function switchEncMainTab(tabId, btn) {
    var panels = document.querySelectorAll('.enc-main-panel[data-enc-panel]');
    panels.forEach(function (p) {
      var active = p.getAttribute('data-enc-panel') === tabId;
      p.hidden = !active;
    });
    var tabs = document.querySelectorAll('.enc-tabs-bar [data-enc-tab]');
    tabs.forEach(function (t) {
      var active = t.getAttribute('data-enc-tab') === tabId;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.setAttribute('tabindex', active ? '0' : '-1');
    });
    if (btn) try { btn.focus(); } catch (_) {}
    // Si on bascule sur "Analyse", forcer un re-render des charts (Chart.js a besoin
    // d'un container visible pour mesurer son canvas).
    if (tabId === 'analyse') {
      setTimeout(function () {
        if (typeof window.renderEncaissementCharts === 'function') {
          try { window.renderEncaissementCharts(); } catch (_) {}
        } else if (typeof window.afficherEncaissement === 'function') {
          try { window.afficherEncaissement(); } catch (_) {}
        }
      }, 50);
    }
  }

  window.switchEncMainTab = switchEncMainTab;

  // Navigation clavier (Arrow Left/Right) dans la tab-bar
  document.addEventListener('keydown', function (e) {
    if (!e.target || !e.target.matches('.enc-tabs-bar [role="tab"]')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    var tabs = Array.from(document.querySelectorAll('.enc-tabs-bar [role="tab"]'));
    var idx = tabs.indexOf(e.target);
    var next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    var nextTab = tabs[next];
    if (nextTab) nextTab.click();
  });
})();
