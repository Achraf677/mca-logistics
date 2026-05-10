/**
 * MCA Logistics — Empty States & Loading helpers (Jalon 1 #23)
 *
 * Helpers HTML reutilisables pour afficher les states vides ou en chargement
 * dans n'importe quelle table / liste / panel.
 *
 * Usage :
 *   container.innerHTML = MCA.emptyState({
 *     icon: '📦',
 *     title: 'Aucune livraison',
 *     sub: 'Crée ta première livraison pour démarrer.',
 *     cta: { label: '+ Nouvelle livraison', onclick: 'ouvrirModalLivraison()' }
 *   });
 *
 *   container.innerHTML = MCA.loadingSkeleton({ rows: 5, height: 14 });
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (!window.MCA) window.MCA = {};

  /**
   * Genere le HTML d'un empty state.
   * @param {Object} opts
   * @param {string} opts.icon  - Emoji ou icône SVG
   * @param {string} opts.title - Titre principal
   * @param {string} [opts.sub] - Sous-titre explicatif
   * @param {{label:string, onclick:string}} [opts.cta] - Bouton call-to-action
   */
  function emptyState(opts) {
    var o = opts || {};
    var icon = o.icon ? '<div class="empty-state-icon">' + esc(o.icon) + '</div>' : '';
    var title = o.title ? '<div class="empty-state-title">' + esc(o.title) + '</div>' : '';
    var sub = o.sub ? '<div class="empty-state-sub">' + esc(o.sub) + '</div>' : '';
    var cta = '';
    if (o.cta && o.cta.label) {
      var oc = o.cta.onclick ? ' onclick="' + esc(o.cta.onclick).replace(/"/g, '&quot;') + '"' : '';
      cta = '<button class="btn-primary"' + oc + '>' + esc(o.cta.label) + '</button>';
    }
    return '<div class="empty-state">' + icon + title + sub + cta + '</div>';
  }

  /**
   * Genere un skeleton de chargement (X bandes grises animees).
   * @param {Object} opts
   * @param {number} [opts.rows=4]   - Nombre de bandes
   * @param {number} [opts.height=14] - Hauteur de chaque bande en px
   * @param {string} [opts.gap=8]     - Espacement vertical en px
   */
  function loadingSkeleton(opts) {
    var o = opts || {};
    var rows = Math.max(1, parseInt(o.rows, 10) || 4);
    var h = parseInt(o.height, 10) || 14;
    var gap = parseInt(o.gap, 10) || 8;
    var html = '<div style="padding:16px">';
    for (var i = 0; i < rows; i++) {
      // Largeurs variables pour effet realiste
      var w = 60 + Math.floor(Math.random() * 40);
      html += '<div class="skeleton skeleton-bar" style="height:' + h + 'px;width:' + w + '%;margin-bottom:' + gap + 'px"></div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Genere un spinner circulaire centre.
   * @param {string} [label='Chargement…']
   */
  function loadingSpinner(label) {
    var l = label != null ? label : 'Chargement…';
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:12px">'
      + '<div class="mca-spinner"></div>'
      + (l ? '<div style="font-size:13px;color:var(--text-muted)">' + esc(l) + '</div>' : '')
      + '</div>';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  window.MCA.emptyState = emptyState;
  window.MCA.loadingSkeleton = loadingSkeleton;
  window.MCA.loadingSpinner = loadingSpinner;
  // Aliases compatibles pour onclick HTML
  window.mcaEmptyState = emptyState;
  window.mcaLoadingSkeleton = loadingSkeleton;
  window.mcaLoadingSpinner = loadingSpinner;
})();
