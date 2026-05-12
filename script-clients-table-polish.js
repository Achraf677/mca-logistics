/* Phase 47 + H10/H11 — Clients + Fournisseurs table post-render polish
   Additive only — MutationObserver rewrites Ville/SIREN + injects ENCOURS/STATUT
   (clients) and CATÉGORIE/À RÉGLER/DERN. FACTURE (fournisseurs).
   No modification of script-clients.js or script-fournisseurs.js. */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtSiren(s) {
    if (!s) return '—';
    var clean = String(s).replace(/\s+/g, '');
    if (clean.length === 9) return clean.slice(0, 3) + ' ' + clean.slice(3, 6) + ' ' + clean.slice(6);
    return clean || '—';
  }

  function fmtEur(v) {
    if (!v && v !== 0) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      if (isNaN(dt)) return '—';
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch (_) { return '—'; }
  }

  // Extract client/fournisseur id from first-cell onclick attr
  function extractId(row) {
    var btn = row.querySelector('td:first-child button[onclick]');
    if (!btn) return null;
    var m = (btn.getAttribute('onclick') || '').match(/\('([^']+)'\)/);
    return m ? m[1] : null;
  }

  function insertBeforeLast(row, td) {
    var last = row.querySelector('td:last-child');
    if (last) row.insertBefore(td, last);
    else row.appendChild(td);
  }

  // ── CLIENTS ───────────────────────────────────────────────────────────────

  function patchClientsRows() {
    // H10 — clients now renders correct columns directly (ville/siren/encours/statut).
    // Patching obsolète — no-op.
    return;
  }

  // ── FOURNISSEURS ──────────────────────────────────────────────────────────

  function patchFournisseursRows() {
    // H11 — fournisseurs now renders correct columns directly (catégorie/ville/à régler).
    // Patching obsolète — no-op.
    return;
  }

  // ── DROPDOWN MENU TOGGLE ──────────────────────────────────────────────────
  // Show ds-dropdown-menu when .open class is set by inline onclick

  function initDropdownMenus() {
    document.querySelectorAll('.ds-dropdown-menu').forEach(function (menu) {
      var obs = new MutationObserver(function () {
        menu.style.display = menu.classList.contains('open') ? 'block' : 'none';
      });
      obs.observe(menu, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // ── OBSERVERS ─────────────────────────────────────────────────────────────

  function observeTable(tbId, patchFn) {
    var tb = document.getElementById(tbId);
    if (!tb) return;
    var obs = new MutationObserver(function () { patchFn(); });
    obs.observe(tb, { childList: true, subtree: true });
    // Patch on first load if rows already present
    patchFn();
  }

  function init() {
    observeTable('tb-clients', patchClientsRows);
    observeTable('tb-fournisseurs', patchFournisseursRows);
    initDropdownMenus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Use a small delay to let legacy scripts render their first pass
    setTimeout(init, 300);
  }
})();
