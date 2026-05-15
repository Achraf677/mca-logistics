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
      var joursRestantsCls = diff < 0 ? 'color:#e63946;font-weight:700' : diff <= 15 ? 'color:#e67e22;font-weight:600' : 'color:var(--ds-text-muted)';
      var joursRestantsStr = diff < 0 ? 'Expiré (' + Math.abs(diff) + 'j)' : diff + ' j';
      var statBadge = diff < 0
        ? '<span class="badge" style="background:rgba(230,57,70,0.12);color:#e63946;border-color:rgba(230,57,70,0.35)">Expiré</span>'
        : diff <= 7
          ? '<span class="badge" style="background:rgba(230,57,70,0.12);color:#e63946;border-color:rgba(230,57,70,0.35)">Urgent</span>'
          : diff <= 30
            ? '<span class="badge" style="background:rgba(214,158,46,0.12);color:#c97d0e;border-color:rgba(214,158,46,0.35)">Bientôt</span>'
            : '<span class="badge ok">OK</span>';
      rows.push({ diff: diff, html: '<tr><td>' + nom + '</td><td style="font-family:var(--font-mono,monospace)">' + immat + '</td><td style="font-family:var(--font-mono,monospace)">' + ctDate + '</td><td style="' + joursRestantsCls + ';text-align:right;font-variant-numeric:tabular-nums">' + joursRestantsStr + '</td><td>' + statBadge + '</td></tr>' });
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

  // H19 — Historique véhicule (timeline)
  function initHistoriqueVehicule() {
    var sel = document.getElementById('entr-hist-vehicule-select');
    if (!sel) return;

    // Populate vehicle options
    var vehicules = [];
    try { vehicules = JSON.parse(localStorage.getItem('vehicules') || '[]'); } catch (e) {}
    sel.innerHTML = '<option value="">— Sélectionner un véhicule —</option>';
    vehicules.forEach(function (v) {
      var immat = v.immatriculation || v.immat || '';
      var label = ((v.marque || '') + ' ' + (v.modele || '')).trim() || immat;
      var opt = document.createElement('option');
      opt.value = immat;
      opt.textContent = immat ? label + (immat !== label ? ' (' + immat + ')' : '') : label;
      sel.appendChild(opt);
    });
  }

  function renderHistoriqueVehicule(immat) {
    var tl = document.getElementById('entr-hist-vehicule-timeline');
    if (!tl) return;
    if (!immat) {
      tl.innerHTML = '<div style="font-size:13px;color:var(--ds-text-muted,var(--text-muted))">Sélectionnez un véhicule pour afficher son historique.</div>';
      return;
    }

    var entretiens = [];
    try { entretiens = JSON.parse(localStorage.getItem('entretiens') || '[]'); } catch (e) {}

    var events = entretiens.filter(function (e) {
      var ev = e.vehImmat || e.immatriculation || e.vehicule || '';
      return ev.toLowerCase() === immat.toLowerCase();
    }).sort(function (a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });

    if (!events.length) {
      tl.innerHTML = '<div style="font-size:13px;color:var(--ds-text-muted,var(--text-muted))">Aucun entretien enregistré pour ce véhicule.</div>';
      return;
    }

    var typeColor = { vidange: '#2563eb', revision: '#7c3aed', pneu: '#d97706', frein: '#dc2626', ct: '#059669', autre: '#6b7280' };
    function colorOf(t) { var k = (t || '').toLowerCase(); for (var c in typeColor) if (k.indexOf(c) !== -1) return typeColor[c]; return typeColor.autre; }

    var html = '<div style="position:relative;padding-left:20px">';
    html += '<div style="position:absolute;left:7px;top:0;bottom:0;width:2px;background:var(--ds-border,var(--border))"></div>';
    events.forEach(function (e) {
      var col = colorOf(e.type);
      var desc = e.description || e.type || 'Entretien';
      var km = e.kilometrage ? ' · ' + Number(e.kilometrage).toLocaleString('fr-FR') + ' km' : '';
      var prix = e.montantTTC ? ' · ' + Number(e.montantTTC).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '';
      html += '<div style="position:relative;margin-bottom:14px;padding-left:16px">'
        + '<div style="position:absolute;left:-7px;top:3px;width:12px;height:12px;border-radius:50%;background:' + col + ';border:2px solid white"></div>'
        + '<div style="font-size:11px;color:var(--ds-text-muted,var(--text-muted))">' + (e.date || '—') + km + '</div>'
        + '<div style="font-size:13px;font-weight:600;color:var(--ds-text,var(--text))">' + desc + '</div>'
        + (prix ? '<div style="font-size:12px;color:var(--ds-text-muted,var(--text-muted))">' + prix + '</div>' : '')
        + '</div>';
    });
    html += '</div>';
    tl.innerHTML = html;
  }

  window.__entrHistVehicule = renderHistoriqueVehicule;

  function showAll() { showAlertBanner(); showCTAVenir(); initHistoriqueVehicule(); }

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
