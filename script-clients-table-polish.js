/* Phase 47 — Clients + Fournisseurs table post-render polish
   Additive only — MutationObserver rewrites col 2 (Ville) + col 4 (SIREN)
   after afficherClientsDashboard() / afficherFournisseursDashboard() render.
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

  // Extract client/fournisseur id from first-cell onclick attr
  function extractId(row) {
    var btn = row.querySelector('td:first-child button[onclick]');
    if (!btn) return null;
    var m = (btn.getAttribute('onclick') || '').match(/\('([^']+)'\)/);
    return m ? m[1] : null;
  }

  // ── CLIENTS ───────────────────────────────────────────────────────────────

  function patchClientsRows() {
    var tb = document.getElementById('tb-clients');
    if (!tb) return;
    var clients = lire('clients');
    if (!clients.length) return;

    var byId = {};
    clients.forEach(function (c) { if (c.id) byId[c.id] = c; });

    Array.from(tb.querySelectorAll('tr')).forEach(function (row) {
      var cells = row.querySelectorAll('td');
      if (cells.length < 4) return; // empty-row guard

      var cid = extractId(row);
      var c = cid ? (byId[cid] || null) : null;
      if (!c) return;

      // col 2 (index 1) → Ville
      var villeCell = cells[1];
      if (villeCell && !villeCell.dataset.patched) {
        villeCell.textContent = c.ville || (c.cp ? c.cp : '—');
        villeCell.dataset.patched = '1';
        villeCell.removeAttribute('style');
      }

      // col 4 (index 3) → SIREN
      var sirenCell = cells[3];
      if (sirenCell && !sirenCell.dataset.patched) {
        sirenCell.textContent = fmtSiren(c.siren);
        sirenCell.dataset.patched = '1';
        sirenCell.classList.add('mono');
        sirenCell.removeAttribute('style');
      }
    });
  }

  // ── FOURNISSEURS ──────────────────────────────────────────────────────────

  function patchFournisseursRows() {
    var tb = document.getElementById('tb-fournisseurs');
    if (!tb) return;
    var fournisseurs = lire('fournisseurs');
    if (!fournisseurs.length) return;

    var byId = {};
    fournisseurs.forEach(function (f) { if (f.id) byId[f.id] = f; });

    Array.from(tb.querySelectorAll('tr')).forEach(function (row) {
      var cells = row.querySelectorAll('td');
      if (cells.length < 4) return;

      var fid = extractId(row);
      var f = fid ? (byId[fid] || null) : null;
      if (!f) return;

      var villeCell = cells[1];
      if (villeCell && !villeCell.dataset.patched) {
        villeCell.textContent = f.ville || (f.cp ? f.cp : '—');
        villeCell.dataset.patched = '1';
        villeCell.removeAttribute('style');
      }

      var sirenCell = cells[3];
      if (sirenCell && !sirenCell.dataset.patched) {
        sirenCell.textContent = fmtSiren(f.siren);
        sirenCell.dataset.patched = '1';
        sirenCell.classList.add('mono');
        sirenCell.removeAttribute('style');
      }
    });
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
