/* Phase 42 refonte HTML — Incidents KPI grid counts */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtEuros(n) {
    return Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function update() {
    var kpiOuverts = document.getElementById('inc-kpi-ouverts');
    var kpiResolus = document.getElementById('inc-kpi-resolus');
    var kpiCout = document.getElementById('inc-kpi-cout');
    var kpiDelai = document.getElementById('inc-kpi-delai');
    var subOuverts = document.getElementById('inc-section-sub-ouverts');
    var subResolus = document.getElementById('inc-section-sub-resolus');

    if (!kpiOuverts && !kpiResolus && !subOuverts) return;

    var incidents = lire('incidents');
    var now = new Date();
    var moisStart = new Date(now.getFullYear(), now.getMonth(), 1);

    var ouverts = incidents.filter(function (i) { return i && i.statut !== 'traite'; });
    var resolus = incidents.filter(function (i) {
      if (!i || i.statut !== 'traite') return false;
      var d = new Date(i.resolviLe || i.modifieLe || i.creeLe || '');
      return !isNaN(d.getTime()) && d >= moisStart;
    });

    if (kpiOuverts) kpiOuverts.textContent = ouverts.length > 0 ? ouverts.length : '—';
    if (kpiResolus) kpiResolus.textContent = resolus.length > 0 ? resolus.length : '—';
    if (subOuverts) subOuverts.textContent = ouverts.length;
    if (subResolus) subResolus.textContent = resolus.length;

    // Phase 59 — sub-meta "en attente expertise" (mockup-aligned)
    var subExpertise = document.getElementById('inc-section-sub-expertise');
    if (subExpertise) {
      var expertise = incidents.filter(function (i) {
        if (!i) return false;
        var s = i.statut || '';
        var sousStatut = (i.sousStatut || i.sous_statut || '').toLowerCase();
        // En attente expertise = statut 'encours' avec sous-statut expertise OU tag specifique
        return (s === 'encours' || s === 'en-cours') && (sousStatut.includes('expertise') || (i.tags || []).indexOf('expertise') !== -1);
      });
      subExpertise.textContent = expertise.length;
    }

    // Coût total (si champ cout présent dans les données)
    if (kpiCout) {
      var totalCout = incidents.reduce(function (s, i) { return s + parseFloat(i && (i.cout || i.cost || i.montant) || 0); }, 0);
      kpiCout.textContent = totalCout > 0 ? fmtEuros(totalCout) : '—';
    }

    // Délai moyen résolution (incidents résolus des 30 derniers jours)
    if (kpiDelai) {
      var seuil30 = new Date(); seuil30.setDate(seuil30.getDate() - 30);
      var resolus30 = incidents.filter(function (i) {
        if (!i || i.statut !== 'traite') return false;
        var d = new Date(i.resolviLe || i.modifieLe || '');
        return !isNaN(d.getTime()) && d >= seuil30;
      });
      if (resolus30.length > 0) {
        var totalJours = resolus30.reduce(function (s, i) {
          var cree = new Date(i.creeLe || '');
          var resolvi = new Date(i.resolviLe || i.modifieLe || '');
          var diff = (!isNaN(cree.getTime()) && !isNaN(resolvi.getTime())) ? (resolvi - cree) / 86400000 : 0;
          return s + diff;
        }, 0);
        kpiDelai.textContent = (totalJours / resolus30.length).toFixed(1) + ' j';
      } else {
        kpiDelai.textContent = '—';
      }
    }
  }

  function tryAttach() {
    if (!document.getElementById('inc-kpi-ouverts') && !document.getElementById('inc-section-sub-ouverts')) return false;
    update();
    if (!window.__refonteIncIv) {
      window.__refonteIncIv = setInterval(update, 5000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) { var r = 0, iv = setInterval(function () { if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
    });
  } else {
    if (!tryAttach()) { var r = 0, iv = setInterval(function () { if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
  }

  window.refonteIncidentsUpdateCounts = update;
})();
