// Phase 51 refonte HTML — Entretiens alert banner post-render
// Reads localStorage.vehicules to find vehicles with CT due < 30 days and shows a banner.
(function () {
  'use strict';

  function showAlertBanner() {
    var banner = document.getElementById('entr-alert-banner');
    var text = document.getElementById('entr-alert-banner-text');
    if (!banner || !text) return;

    var vehicules = [];
    try { vehicules = JSON.parse(localStorage.getItem('vehicules') || '[]'); } catch (e) {}
    if (!vehicules.length) return;

    var now = Date.now();
    var alerts = [];

    vehicules.forEach(function (v) {
      var nom = (v.marque || '') + ' ' + (v.modele || v.immatriculation || '');
      var immat = v.immatriculation || v.immat || '';

      // CT date
      var ctDate = v.date_prochain_ct || v.prochainCT || v.prochain_ct || null;
      if (ctDate) {
        var diff = Math.round((new Date(ctDate) - now) / 86400000);
        if (diff >= 0 && diff <= 30) {
          alerts.push('<strong>' + (immat || nom).trim() + '</strong> — CT dans ' + diff + ' jour' + (diff !== 1 ? 's' : ''));
        } else if (diff < 0) {
          alerts.push('<strong>' + (immat || nom).trim() + '</strong> — CT expiré');
        }
      }

      // Révision km — if km_prochain_entretien - km_actuel < 2000
      var kmActuel = parseInt(v.kilometrage || v.km_actuel || 0, 10);
      var kmProchain = parseInt(v.km_prochain_entretien || v.prochainEntretienKm || 0, 10);
      if (kmProchain && kmActuel && (kmProchain - kmActuel) < 2000) {
        alerts.push('<strong>' + (immat || nom).trim() + '</strong> — révision &lt; 2 000 km');
      }
    });

    if (!alerts.length) return;

    var count = alerts.length;
    text.innerHTML = count + ' véhicule' + (count > 1 ? 's' : '') + ' nécessit' + (count > 1 ? 'ent' : 'e') + ' une intervention — ' + alerts.join(', ');
    banner.style.display = 'flex';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(showAlertBanner, 200); });
  } else {
    setTimeout(showAlertBanner, 200);
  }

  // H18 — Section "Contrôles techniques à venir" (30j)
  function showCTAVenir() {
    var card = document.getElementById('entr-ct-venir-card');
    var tbody = document.getElementById('tb-ct-venir-body');
    var countEl = document.getElementById('entr-ct-venir-count');
    if (!card || !tbody) return;

    var vehicules = [];
    try { vehicules = JSON.parse(localStorage.getItem('vehicules') || '[]'); } catch (e) {}
    var now = Date.now();
    var rows = [];
    vehicules.forEach(function(v) {
      var ctDate = v.date_prochain_ct || v.prochainCT || v.prochain_ct || null;
      if (!ctDate) return;
      var diff = Math.round((new Date(ctDate) - now) / 86400000);
      if (diff > 60) return; // show up to 60 days out
      var nom = ((v.marque || '') + ' ' + (v.modele || '')).trim() || '—';
      var immat = v.immatriculation || v.immat || '—';
      var echeanceCls = diff < 0 ? 'color:#e63946;font-weight:700' : diff <= 15 ? 'color:#e67e22;font-weight:600' : 'color:var(--ds-text-muted)';
      var echeance = diff < 0 ? 'Expiré (' + Math.abs(diff) + 'j)' : 'Dans ' + diff + ' jour' + (diff > 1 ? 's' : '');
      rows.push({ diff: diff, html: '<tr><td>' + nom + '</td><td style="font-family:var(--font-mono,monospace)">' + immat + '</td><td>' + ctDate + '</td><td style="' + echeanceCls + '">' + echeance + '</td></tr>' });
    });

    rows.sort(function(a, b) { return a.diff - b.diff; });

    if (rows.length > 0) {
      tbody.innerHTML = rows.map(function(r) { return r.html; }).join('');
      if (countEl) countEl.textContent = '(' + rows.length + ' véhicule' + (rows.length > 1 ? 's' : '') + ')';
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  }

  function showAll() { showAlertBanner(); showCTAVenir(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(showAll, 200); });
  } else {
    setTimeout(showAll, 200);
  }

  // Re-check when navigating to page
  document.addEventListener('click', function (e) {
    var nav = e.target.closest && e.target.closest('.nav-item[data-page="entretiens"]');
    if (nav) setTimeout(showAll, 400);
  });
})();
