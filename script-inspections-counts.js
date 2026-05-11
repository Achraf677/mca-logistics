/* Phase 43 refonte HTML — Inspections KPI grid counts */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function getMonday(d) {
    var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(new Date(d).setDate(diff));
  }

  function update() {
    var kpiSemaine = document.getElementById('insp-kpi-semaine');
    var kpiDefauts = document.getElementById('insp-kpi-defauts');
    var kpiConformite = document.getElementById('insp-kpi-conformite');
    var kpiRisque = document.getElementById('insp-kpi-risque');
    var subSemaine = document.getElementById('insp-section-sub-semaine');
    var subCount = document.getElementById('insp-section-sub-count');

    if (!kpiSemaine && !kpiDefauts && !subSemaine) return;

    var inspections = lire('inspections');
    var now = new Date();
    var weekStart = getMonday(now);
    var weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    var weekStartIso = weekStart.toISOString().slice(0, 10);
    var weekEndIso = weekEnd.toISOString().slice(0, 10);

    // Cette semaine
    var inSemaine = inspections.filter(function (i) { return i && i.date >= weekStartIso && i.date < weekEndIso; });
    if (kpiSemaine) kpiSemaine.textContent = inSemaine.length > 0 ? inSemaine.length : '—';
    if (subSemaine) {
      var label = weekStartIso.slice(5).replace('-', '/') + ' — ' + new Date(weekEnd - 86400000).toISOString().slice(5, 10).replace('-', '/');
      subSemaine.textContent = label;
    }
    if (subCount) subCount.textContent = inspections.length + ' inspection(s)';

    // Défauts (checkpoints ko) sur les 30 derniers jours
    if (kpiDefauts) {
      var seuil30 = new Date(); seuil30.setDate(seuil30.getDate() - 30);
      var seuil30Iso = seuil30.toISOString().slice(0, 10);
      var totalKo = 0;
      inspections.filter(function (i) { return i && i.date >= seuil30Iso; }).forEach(function (i) {
        if (!i.checkpoints) return;
        Object.values(i.checkpoints).forEach(function (v) { if (v === 'ko') totalKo++; });
      });
      kpiDefauts.textContent = totalKo > 0 ? totalKo : '—';
    }

    // Conformité globale (% conformes sur 30j)
    if (kpiConformite) {
      var seuil30c = new Date(); seuil30c.setDate(seuil30c.getDate() - 30);
      var seuil30cIso = seuil30c.toISOString().slice(0, 10);
      var recent = inspections.filter(function (i) { return i && i.date >= seuil30cIso; });
      var conformes = recent.filter(function (i) { return i.statut === 'conforme'; }).length;
      kpiConformite.textContent = recent.length > 0 ? Math.round(conformes / recent.length * 100) + '%' : '—';
    }

    // Véhicule à risque (immat avec le plus de KO historiques)
    if (kpiRisque) {
      var koParVeh = {};
      inspections.forEach(function (i) {
        if (!i || !i.checkpoints) return;
        var immat = i.vehImmat || i.vehId || '';
        if (!immat) return;
        var koCount = Object.values(i.checkpoints).filter(function (v) { return v === 'ko'; }).length;
        koParVeh[immat] = (koParVeh[immat] || 0) + koCount;
      });
      var topVeh = Object.keys(koParVeh).sort(function (a, b) { return koParVeh[b] - koParVeh[a]; })[0];
      kpiRisque.textContent = topVeh || '—';
      if (topVeh && kpiRisque.nextElementSibling && kpiRisque.nextElementSibling.classList.contains('kpi-sub')) {
        kpiRisque.nextElementSibling.textContent = koParVeh[topVeh] + ' défaut(s)';
      }
    }
  }

  function tryAttach() {
    if (!document.getElementById('insp-kpi-semaine') && !document.getElementById('insp-section-sub-semaine')) return false;
    update();
    if (!window.__refonteInspIv) {
      window.__refonteInspIv = setInterval(update, 5000);
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

  window.refonteInspectionsUpdateCounts = update;
})();
