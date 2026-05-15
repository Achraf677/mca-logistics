/* Phase 60 V7 polish — Réintégration legacy charges_categories.
   Page Paramètres > Comptabilité section "Catégories charges custom".
   CRUD inline : ajout par input + suppression chip × + render list. */
(function () {
  'use strict';

  var DEFAULTS = ['Carburant', 'Garage', 'Assurance', 'Péages', 'Parking', 'Formation', 'Maintenance', 'Autre'];

  function lire() {
    try {
      var raw = localStorage.getItem('charges_categories');
      if (!raw) return DEFAULTS.slice();
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return DEFAULTS.slice();
      return arr.filter(function (c) { return c && typeof c === 'string'; });
    } catch (_) { return DEFAULTS.slice(); }
  }

  function ecrire(cats) {
    try { localStorage.setItem('charges_categories', JSON.stringify(cats)); }
    catch (_) {}
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render() {
    var list = document.getElementById('param-cat-charges-list');
    if (!list) return;
    var cats = lire();
    list.innerHTML = cats.map(function (c) {
      var safe = escapeHtml(c);
      return '<span class="ds-chip" style="display:inline-flex;gap:6px;align-items:center;padding:4px 4px 4px 12px;background:var(--bg-card-hover,var(--bg-dark));border:1px solid var(--border);border-radius:14px;font-size:12px">'
        + safe
        + '<button type="button" onclick="window.supprimerCategorieCharge(\'' + safe.replace(/'/g, "\\'") + '\')" title="Supprimer" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 6px;line-height:1">×</button>'
        + '</span>';
    }).join('') || '<span style="color:var(--text-muted);font-size:12px">Aucune catégorie — utilisera la liste par défaut</span>';
  }

  function ajouterCategorieCharge() {
    var input = document.getElementById('param-cat-charge-new');
    if (!input) return;
    var val = (input.value || '').trim();
    if (!val) return;
    if (val.length > 50) val = val.slice(0, 50);
    var cats = lire();
    if (cats.indexOf(val) !== -1) {
      if (window.afficherToast) window.afficherToast('Catégorie déjà présente', 'warning');
      return;
    }
    cats.push(val);
    ecrire(cats);
    input.value = '';
    render();
    if (window.afficherToast) window.afficherToast('Catégorie ajoutée');
  }
  window.ajouterCategorieCharge = ajouterCategorieCharge;

  function supprimerCategorieCharge(nom) {
    var cats = lire().filter(function (c) { return c !== nom; });
    ecrire(cats);
    render();
    if (window.afficherToast) window.afficherToast('Catégorie supprimée');
  }
  window.supprimerCategorieCharge = supprimerCategorieCharge;

  // Re-render quand on switch sur Paramètres
  function observePage() {
    var page = document.getElementById('page-parametres');
    if (!page || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function () {
      if (page.classList.contains('active')) render();
    }).observe(page, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    render();
    observePage();
    // Enter key submit
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target && e.target.id === 'param-cat-charge-new') {
        e.preventDefault();
        ajouterCategorieCharge();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refonteChargesCategoriesRender = render;
})();
