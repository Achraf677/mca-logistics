/* Phase 42 refonte HTML — Heures KPI grid counts */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function parseTime(t) {
    if (!t) return NaN;
    var parts = String(t).split(':');
    if (parts.length < 2) return NaN;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function update() {
    var kpiTotal = document.getElementById('heures-kpi-total');
    var kpiSup = document.getElementById('heures-kpi-sup');
    var kpiKm = document.getElementById('heures-kpi-km');
    var kpiCe561 = document.getElementById('heures-kpi-ce561');

    if (!kpiTotal && !kpiSup && !kpiKm) return;

    var plannings = lire('plannings_hebdo');
    var alertes = lire('alertes_admin');
    var livraisons = lire('livraisons');

    // Total heures planifiées (toute la semaine en cours)
    var now = new Date();
    var totalMinutes = 0;
    var totalSupMinutes = 0;
    var SEMAINE_HEURES = 35 * 60; // seuil 35h

    plannings.forEach(function (p) {
      if (!p || !p.jours) return;
      var heuresPersonne = 0;
      Object.keys(p.jours).forEach(function (j) {
        var jour = p.jours[j];
        if (!jour || !jour.heureDebut || !jour.heureFin) return;
        var start = parseTime(jour.heureDebut);
        var end = parseTime(jour.heureFin);
        if (!isNaN(start) && !isNaN(end) && end > start) {
          var durMin = end - start;
          totalMinutes += durMin;
          heuresPersonne += durMin;
        }
      });
      if (heuresPersonne > SEMAINE_HEURES) {
        totalSupMinutes += heuresPersonne - SEMAINE_HEURES;
      }
    });

    var totalH = Math.round(totalMinutes / 60);
    var supH = Math.round(totalSupMinutes / 60);
    if (kpiTotal) kpiTotal.textContent = totalH > 0 ? totalH + ' h' : '—';
    if (kpiSup) kpiSup.textContent = supH > 0 ? supH + ' h' : '—';

    // Km parcourus ce mois (livraisons)
    if (kpiKm) {
      var moisStart = new Date(now.getFullYear(), now.getMonth(), 1);
      var kmTotal = livraisons.filter(function (l) {
        if (!l) return false;
        var d = new Date(l.date || l.dateLivraison || '');
        return !isNaN(d.getTime()) && d >= moisStart;
      }).reduce(function (s, l) { return s + (parseFloat(l.distance) || 0); }, 0);
      kpiKm.textContent = kmTotal > 0 ? Math.round(kmTotal) + ' km' : '—';
    }

    // CE 561 alertes (alertes de type dépassement CE561)
    if (kpiCe561) {
      var ce561 = alertes.filter(function (a) {
        if (!a || a.traitee) return false;
        var t = (a.type || '').toLowerCase();
        return t.includes('ce561') || t.includes('561') || t.includes('depassement') || t.includes('conduite');
      }).length;
      kpiCe561.textContent = ce561 > 0 ? ce561 : '—';
    }
  }

  function tryAttach() {
    if (!document.getElementById('heures-kpi-total') && !document.getElementById('heures-kpi-km')) return false;
    update();
    if (!window.__refonteHeuresIv) {
      window.__refonteHeuresIv = setInterval(update, 5000);
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

  window.refonteHeuresUpdateCounts = update;
})();
