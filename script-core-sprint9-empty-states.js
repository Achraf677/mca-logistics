/**
 * MCA Logistics — Sprint 9 — Empty states riches (Phase X — extraction script.js)
 *
 * Extracted from script.js L4904-5070 (2026-05-16).
 */

/* =========================================================================
   SPRINT 9 — Empty states riches
   ========================================================================= */
(function() {
  'use strict';

  /**
   * Construit le HTML d'un empty state riche.
   * config: { icon, title, description, ctaLabel, ctaAction, variant }
   * variant: 'default' | 'filtered' | 'search' | 'success'
   */
  function buildHtml(config) {
    const variant = config.variant || 'default';
    const iconHtml = config.icon || '📦';
    const title = config.title || 'Rien à afficher';
    const description = config.description || '';
    let ctaHtml = '';
    if (config.ctaLabel && config.ctaAction) {
      const cls = variant === 'filtered' || variant === 'search' ? 'btn btn-secondary' : 'btn btn-primary';
      ctaHtml = '<button type="button" class="' + cls + ' empty-state-cta" onclick="' + config.ctaAction + '">' + config.ctaLabel + '</button>';
    }
    return (
      '<div class="empty-state empty-state-' + variant + '">' +
        '<div class="empty-state-icon" aria-hidden="true">' + iconHtml + '</div>' +
        '<div class="empty-state-title">' + title + '</div>' +
        (description ? '<div class="empty-state-description">' + description + '</div>' : '') +
        (ctaHtml ? '<div class="empty-state-actions">' + ctaHtml + '</div>' : '') +
      '</div>'
    );
  }

  /**
   * Injecte un empty state dans un container DOM.
   */
  function render(container, config) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML = buildHtml(config);
  }

  /**
   * Génère une <tr><td colspan=N> avec un empty state dedans (pour tables).
   */
  function renderTableRow(colspan, config) {
    return '<tr><td colspan="' + (colspan || 1) + '" class="empty-state-cell">' + buildHtml(config) + '</td></tr>';
  }

  /**
   * Détermine si des filtres sont actifs sur la page livraisons.
   */
  function hasActiveLivraisonsFilters() {
    const ids = ['filtre-statut', 'filtre-date-debut', 'filtre-date-fin', 'filtre-paiement', 'filtre-chauffeur'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.value) return true;
    }
    return false;
  }

  function hasActiveLivraisonsSearch() {
    const el = document.getElementById('filtre-recherche-liv');
    return !!(el && el.value && el.value.trim());
  }

  /**
   * Actions CTA pour les empty states livraisons.
   */
  window.resetFiltresLivraisons = function() {
    ['filtre-statut', 'filtre-date-debut', 'filtre-date-fin', 'filtre-paiement', 'filtre-chauffeur'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  };

  window.resetRechercheLivraisons = function() {
    const el = document.getElementById('filtre-recherche-liv');
    if (el) el.value = '';
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  };

  // Exposer
  window.EmptyState = {
    buildHtml: buildHtml,
    render: render,
    renderTableRow: renderTableRow,
    hasActiveLivraisonsFilters: hasActiveLivraisonsFilters,
    hasActiveLivraisonsSearch: hasActiveLivraisonsSearch
  };

  /* ---------- Patch final render livraisons pour empty state riche ---------- */
  function init() {
    const orig = window.renderLivraisonsAdminFinal;
    if (typeof orig !== 'function' || orig.__emptyStated) return;

    const patched = function() {
      orig.apply(this, arguments);
      // Après le render, si le tbody contient l'empty basique, on le remplace
      const tb = document.getElementById('tb-livraisons');
      if (!tb) return;
      const basicEmpty = tb.querySelector('.empty-row');
      if (!basicEmpty) return;

      // Détection du contexte
      const totalLivraisons = (typeof charger === 'function' ? charger('livraisons') : []).length;
      const hasSearch = hasActiveLivraisonsSearch();
      const hasFilters = hasActiveLivraisonsFilters();

      let config;
      if (totalLivraisons === 0) {
        config = {
          icon: '📦',
          title: 'Aucune livraison pour le moment',
          description: 'Commence par enregistrer ta première livraison pour suivre tes revenus, tes trajets et ton activité.',
          ctaLabel: '+ Nouvelle livraison',
          ctaAction: 'openModal(\'modal-livraison\')',
          variant: 'default'
        };
      } else if (hasSearch && !hasFilters) {
        config = {
          icon: '🔍',
          title: 'Aucun résultat pour cette recherche',
          description: 'Essaye avec un autre terme ou efface la recherche pour voir toutes tes livraisons.',
          ctaLabel: 'Effacer la recherche',
          ctaAction: 'resetRechercheLivraisons()',
          variant: 'search'
        };
      } else if (hasFilters || hasSearch) {
        config = {
          icon: '🔎',
          title: 'Aucune livraison ne correspond aux filtres',
          description: 'Modifie les critères ou réinitialise les filtres pour élargir la recherche.',
          ctaLabel: 'Réinitialiser les filtres',
          ctaAction: 'resetFiltresLivraisons()',
          variant: 'filtered'
        };
      } else {
        // Filtre de période actif (mois courant sans livraison)
        config = {
          icon: '📅',
          title: 'Aucune livraison sur cette période',
          description: 'Navigue vers un autre mois ou crée une livraison pour cette période.',
          ctaLabel: '+ Nouvelle livraison',
          ctaAction: 'openModal(\'modal-livraison\')',
          variant: 'default'
        };
      }

      tb.innerHTML = renderTableRow(13, config);
    };

    patched.__paginated = true;
    patched.__sorted = true;
    patched.__emptyStated = true;
    window.renderLivraisonsAdminFinal = patched;
    /* WRAPPER S9 — empty states riches livraisons. H2.1 : pas de réassignement
       de window.afficherLivraisons (cf. WRAPPER S7). */

    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }
})();
