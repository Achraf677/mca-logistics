/* Phase 39 — Clients + Fournisseurs : chips toolbar filter
   Additive only — chip filter post-render + KPI grid 4-col.
   KPI values are computed by script-clients-fournisseurs-counts.js (Phase 38).
   No modification of script-clients.js or script-fournisseurs.js legacy. */
(function () {
  'use strict';

  function lire(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (_) { return fallback; }
  }

  // ── CHIP FILTER : CLIENTS ─────────────────────────────────────────────────────

  window._cliActiveChip = 'tous';

  window._applyCliChip = function () {
    var chip = window._cliActiveChip || 'tous';
    if (chip === 'tous') {
      var tb = document.getElementById('tb-clients');
      if (tb) Array.from(tb.querySelectorAll('tr')).forEach(function (r) { r.style.display = ''; });
      return;
    }

    var clients    = lire('clients', []);
    var livraisons = lire('livraisons', []);
    var now = Date.now();
    var d90 = now - 90 * 86400000;

    var actifsIds = new Set();
    livraisons.forEach(function (l) {
      var d = new Date(l.date || l.dateLivraison || l.date_livraison || '').getTime();
      if (!isNaN(d) && d >= d90) {
        if (l.clientId) actifsIds.add(l.clientId);
        if (l.client)   actifsIds.add(l.client);
      }
    });

    var cliMap = {};
    clients.forEach(function (c) { if (c.id) cliMap[c.id] = c; if (c.nom) cliMap[c.nom] = c; });

    var tb = document.getElementById('tb-clients');
    if (!tb) return;

    Array.from(tb.querySelectorAll('tr')).forEach(function (row) {
      var btn = row.querySelector('td:first-child button[onclick]');
      if (!btn) { row.style.display = ''; return; }
      var m = (btn.getAttribute('onclick') || '').match(/ouvrirHistoriqueClient\('([^']+)'\)/);
      var cid = m ? m[1] : null;
      var c = cid ? (cliMap[cid] || null) : null;
      if (!c) { row.style.display = ''; return; }

      var show = true;
      if (chip === 'actifs90j') {
        show = actifsIds.has(c.id) || actifsIds.has(c.nom);
      } else if (chip === 'inactifs') {
        show = !actifsIds.has(c.id) && !actifsIds.has(c.nom);
      } else if (chip === 'risque') {
        show = livraisons.some(function (l) {
          return (l.clientId === c.id || l.client === c.nom) &&
                 (l.statutPaiement === 'en-attente' || l.statutPaiement === 'retard' ||
                  l.statutPaiement === 'impayé' || l.statutPaiement === 'impaye');
        });
      }
      row.style.display = show ? '' : 'none';
    });
  };

  window.cliChipFilter = function (chip) {
    window._cliActiveChip = chip;
    document.querySelectorAll('#cli-chips-toolbar .ds-chip').forEach(function (b) {
      b.classList.toggle('active', b.dataset.chip === chip);
    });
    if (typeof window.afficherClientsDashboard === 'function') window.afficherClientsDashboard();
    else window._applyCliChip();
  };

  // ── CHIP FILTER : FOURNISSEURS ────────────────────────────────────────────────

  window._frnActiveChip = 'tous';

  window._applyFrnChip = function () {
    var chip = window._frnActiveChip || 'tous';
    if (chip === 'tous') {
      var tb = document.getElementById('tb-fournisseurs');
      if (tb) Array.from(tb.querySelectorAll('tr')).forEach(function (r) { r.style.display = ''; });
      return;
    }

    var fournisseurs = lire('fournisseurs', []);
    var frnMap = {};
    fournisseurs.forEach(function (f) { if (f.id) frnMap[f.id] = f; if (f.nom) frnMap[f.nom] = f; });

    var tb = document.getElementById('tb-fournisseurs');
    if (!tb) return;

    Array.from(tb.querySelectorAll('tr')).forEach(function (row) {
      var firstCell = row.querySelector('td:first-child');
      if (!firstCell) return;
      var nom = (firstCell.querySelector('strong') || firstCell).textContent.trim();
      var f = frnMap[nom] || null;

      var show = true;
      if (f && chip !== 'tous') {
        var secteur = (f.secteur || '').toLowerCase();
        if      (chip === 'carburant') show = secteur === 'carburant';
        else if (chip === 'garage')    show = secteur === 'garage';
        else if (chip === 'assurance') show = secteur === 'assurance';
      } else if (!f) {
        show = true;
      }
      row.style.display = show ? '' : 'none';
    });
  };

  window.frnChipFilter = function (chip) {
    window._frnActiveChip = chip;
    document.querySelectorAll('#frn-chips-toolbar .ds-chip').forEach(function (b) {
      b.classList.toggle('active', b.dataset.chip === chip);
    });
    if (typeof window.afficherFournisseursDashboard === 'function') window.afficherFournisseursDashboard();
    else window._applyFrnChip();
  };

  // ── MONKEY-PATCH : inject chip filter after each render ──────────────────────

  function patchFunctions() {
    if (typeof window.afficherClientsDashboard === 'function' && !window._cliChipPatched) {
      var _origCli = window.afficherClientsDashboard;
      window.afficherClientsDashboard = function () {
        _origCli.apply(this, arguments);
        window._applyCliChip && window._applyCliChip();
      };
      window._cliChipPatched = true;
    }
    if (typeof window.afficherFournisseursDashboard === 'function' && !window._frnChipPatched) {
      var _origFrn = window.afficherFournisseursDashboard;
      window.afficherFournisseursDashboard = function () {
        _origFrn.apply(this, arguments);
        window._applyFrnChip && window._applyFrnChip();
      };
      window._frnChipPatched = true;
    }
    return window._cliChipPatched && window._frnChipPatched;
  }

  var _retries = 0;
  function tryPatch() {
    if (patchFunctions() || ++_retries > 40) return;
    setTimeout(tryPatch, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryPatch);
  } else {
    tryPatch();
  }

})();
