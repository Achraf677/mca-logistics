/* Phase 48 — Véhicules fleet card grid (mockup-aligned)
   Additive only — reads from localStorage + tb-vehicules mutation,
   renders .fleet-cards-grid card layout matching previews/vehicules.html.
   No modification of script-vehicules.js.
   Table is kept hidden as a fallback for edit/delete actions. */
(function () {
  'use strict';

  var GRID_ID = 'fleet-cards-grid';
  var TABLE_WRAP_ID = 'vehicules-table-fallback';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function formatKm(n) {
    if (!n) return '—';
    return Number(n).toLocaleString('fr-FR') + ' km';
  }

  function formatDate(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) { return d; }
  }

  function ctStatus(dateCT) {
    if (!dateCT) return null;
    var now = new Date();
    var ct = new Date(dateCT);
    var diffMs = ct - now;
    var diffJ = Math.round(diffMs / 86400000);
    if (diffJ < 0) return { cls: 'badge-danger', label: 'CT expiré' };
    if (diffJ <= 30) return { cls: 'badge-warn', label: 'CT ' + diffJ + 'j' };
    return null;
  }

  function buildTruckSvg() {
    return '<svg width="150" height="50" viewBox="0 0 170 60" aria-hidden="true">'
      + '<rect x="22" y="14" width="96" height="28" rx="4" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1"/>'
      + '<rect x="118" y="20" width="32" height="22" rx="3" fill="#2a2f37" stroke="#f1f3f5" stroke-width="1"/>'
      + '<rect x="26" y="18" width="20" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>'
      + '<rect x="48" y="18" width="68" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>'
      + '<circle cx="42" cy="44" r="6" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>'
      + '<circle cx="130" cy="44" r="6" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>'
      + '<rect x="0" y="22" width="18" height="2" fill="#e63946" opacity="0.7"/>'
      + '<rect x="2" y="28" width="14" height="2" fill="#e63946" opacity="0.5"/>'
      + '</svg>';
  }

  function buildCard(v, salaries, carburant, entretiens) {
    // Chauffeur — Phase 91.82 (2026-05-17) : utilise getSalarieNomComplet
    // (script-salaries.js:104) au lieu du concat naïf, pour éviter le doublon
    // "Achraf Achraf Chikri" quand prenom == nom ou prenom inclus dans nom.
    var sal = v.salId ? salaries.find(function (s) { return s.id === v.salId; }) : null;
    var chauffeur = sal
      ? (typeof window.getSalarieNomComplet === 'function'
          ? window.getSalarieNomComplet(sal)
          : ((sal.prenom || '') + ' ' + (sal.nom || '')).trim())
      : '—';

    // Consommation 30j réelle — Phase 60 V7 polish : accepte vehiculeId/kmCompteur (seed) ET vehId/km (legacy)
    var now = new Date();
    var d30 = new Date(now - 30 * 86400000);
    function pVehId(p) { return p.vehId || p.vehiculeId; }
    function pKm(p) { return parseFloat(p.km != null ? p.km : p.kmCompteur) || 0; }
    var pleins = carburant.filter(function (p) {
      return p && pVehId(p) === v.id && p.litres && pKm(p) > 0;
    }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var consoStr = v.conso ? (v.conso + ' L/100') : '—';
    var consoHighPct = 0;
    if (pleins.length >= 2) {
      var totalL = 0, totalKm = 0;
      for (var i = 1; i < pleins.length; i++) {
        var delta = pKm(pleins[i]) - pKm(pleins[i - 1]);
        if (delta > 0 && delta < 5000 && pleins[i].litres) {
          totalL += parseFloat(pleins[i].litres) || 0;
          totalKm += delta;
        }
      }
      if (totalKm > 0) {
        var realConso = totalL / totalKm * 100;
        consoStr = realConso.toFixed(1) + ' L/100';
        var baseline = parseFloat(v.conso) || 0;
        if (baseline > 0 && realConso > baseline * 1.10) {
          consoHighPct = Math.round((realConso - baseline) / baseline * 100);
        }
      }
    }

    // CT badge — overridden by high-conso badge when applicable
    var ct = ctStatus(v.dateCT);
    var badgeHtml;
    if (consoHighPct >= 10) {
      badgeHtml = '<span class="fv-badge fv-badge-warn" style="color:var(--brand)">CONSO +' + consoHighPct + '%</span>';
    } else if (ct) {
      badgeHtml = '<span class="fv-badge fv-badge-' + ct.cls + '">' + ct.label + '</span>';
    } else {
      badgeHtml = '<span class="fv-badge fv-badge-ok">En service</span>';
    }

    // CT date style
    var ctVal = v.dateCT ? formatDate(v.dateCT) : '—';
    var ctStyle = '';
    if (v.dateCT) {
      var diffJ2 = Math.round((new Date(v.dateCT) - now) / 86400000);
      if (diffJ2 < 0) ctStyle = ' style="color:var(--brand)"';
      else if (diffJ2 <= 30) ctStyle = ' style="color:var(--brand)"';
    }

    // Kilométrage
    var kmActuel = v.kmActuel || v.km || 0;

    // Entretien action context
    var procheEnt = entretiens.filter(function (e) {
      return e.vehId === v.id && e.statut !== 'termine';
    }).length > 0;
    // Action button priority: CT imminent > Diagnostiquer (conso) > Entretien
    var actionBtn = '';
    if (ct && ct.cls === 'badge-warn') {
      actionBtn = '<button class="fv-action-btn fv-action-primary" onclick="ouvrirEditVehicule(\'' + v.id + '\')" title="Programmer CT">Programmer CT</button>';
    } else if (consoHighPct >= 10) {
      actionBtn = '<button class="fv-action-btn fv-action-secondary" onclick="ouvrirEditVehicule(\'' + v.id + '\')" title="Diagnostiquer surconsommation">Diagnostiquer</button>';
    } else if (procheEnt) {
      actionBtn = '<button class="fv-action-btn fv-action-secondary" onclick="ouvrirEditVehicule(\'' + v.id + '\')" title="Entretien planifié">Entretien</button>';
    }

    var immat = v.immat || '—';
    var modele = v.modele || '';
    var marque = v.marque || '';
    var display = marque ? marque : (modele || '');
    var subDisplay = marque && modele ? modele : '';

    return '<div class="fv-card" data-veh-id="' + v.id + '">'
      + '<div class="fv-top">'
      +   '<div>'
      +     '<div class="fv-immat">' + immat + '</div>'
      +     (display ? '<div class="fv-marque">' + display + '</div>' : '')
      +     (subDisplay ? '<div class="fv-modele">' + subDisplay + '</div>' : '')
      +   '</div>'
      +   badgeHtml
      + '</div>'
      + '<div class="fv-art">' + buildTruckSvg() + '</div>'
      + '<div class="fv-stats">'
      +   '<div class="fv-stat"><div class="fv-lab">Kilométrage</div><div class="fv-val">' + formatKm(kmActuel) + '</div></div>'
      +   '<div class="fv-stat"><div class="fv-lab">Conso 30j</div><div class="fv-val">' + consoStr + '</div></div>'
      +   '<div class="fv-stat"><div class="fv-lab">Chauffeur</div><div class="fv-val">' + chauffeur + '</div></div>'
      +   '<div class="fv-stat"><div class="fv-lab">Prochain CT</div><div class="fv-val"' + ctStyle + '>' + ctVal + '</div></div>'
      + '</div>'
      + '<div class="fv-foot">'
      +   '<a class="fv-link" href="#" onclick="ouvrirEditVehicule(\'' + v.id + '\');return false;">Voir le détail →</a>'
      +   actionBtn
      + '</div>'
      + '</div>';
  }

  function renderCards() {
    var grid = document.getElementById(GRID_ID);
    if (!grid) return;

    var vehicules = lire('vehicules');
    var salaries = lire('salaries');
    var carburant = lire('carburant');
    var entretiens = lire('entretiens');

    // Apply current search/filter if filtre-veh-search has value
    var searchVal = (document.getElementById('filtre-veh-search') || {}).value || '';
    if (searchVal.trim()) {
      var s = searchVal.trim().toLowerCase();
      vehicules = vehicules.filter(function (v) {
        return [v.immat, v.modele, v.marque].filter(Boolean).join(' ').toLowerCase().includes(s);
      });
    }

    if (!vehicules.length) {
      grid.innerHTML = '';
      // Show table fallback with empty state
      var tw = document.getElementById(TABLE_WRAP_ID);
      if (tw) tw.style.display = '';
      return;
    }

    // Hide table (cards are the primary view)
    var tw = document.getElementById(TABLE_WRAP_ID);
    if (tw) tw.style.display = 'none';

    grid.innerHTML = vehicules.map(function (v) {
      return buildCard(v, salaries, carburant, entretiens);
    }).join('');
  }

  function init() {
    renderCards();

    // Re-render when tb-vehicules changes (script-vehicules.js has rendered)
    var tb = document.getElementById('tb-vehicules');
    if (tb) {
      new MutationObserver(function () { renderCards(); }).observe(tb, { childList: true });
    }

    // Re-render on search input
    var search = document.getElementById('filtre-veh-search');
    if (search) {
      search.addEventListener('input', function () {
        setTimeout(renderCards, 50);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 400);
  }
})();
