/**
 * MCA Logistics — Sidebar hiérarchique repliable (toggleNavSection + persistance) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4890-4952 (2026-05-16).
 */

/* ================================================================
   SPRINT 2 — SIDEBAR HIÉRARCHIQUE REPLIABLE
   Gère l'ouverture/fermeture des sections de la sidebar admin
   avec persistance localStorage (clé: nav_sections_collapsed).
   ================================================================ */
(function() {
  const LS_KEY = 'nav_sections_collapsed';

  function lireEtatReplie() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[nav-sections] lireEtatReplie localStorage parse', e);
      return [];
    }
  }

  function ecrireEtatReplie(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (e) { /* quota ou mode privé — on ignore */ }
  }

  window.toggleNavSection = function(id) {
    const section = document.querySelector('.nav-section[data-section="' + id + '"]');
    if (!section) return;
    section.classList.toggle('collapsed');
    const isCollapsed = section.classList.contains('collapsed');

    // Met à jour aria-expanded sur le header
    const header = section.querySelector('.nav-section-header');
    if (header) header.setAttribute('aria-expanded', String(!isCollapsed));

    // Persiste l'état
    const list = lireEtatReplie();
    const idx = list.indexOf(id);
    if (isCollapsed && idx === -1) list.push(id);
    else if (!isCollapsed && idx !== -1) list.splice(idx, 1);
    ecrireEtatReplie(list);
  };

  function initNavSections() {
    const list = lireEtatReplie();
    list.forEach(function(id) {
      const section = document.querySelector('.nav-section[data-section="' + id + '"]');
      if (section) {
        section.classList.add('collapsed');
        const header = section.querySelector('.nav-section-header');
        if (header) header.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavSections);
  } else {
    initNavSections();
  }

})();
