/* Phase 2 PR-G Planning section-head counts (semaine + nb planifies) */
/* Phase 37 — KPI grid (effectif / planifiés / absences / heures) */
(function () {
  'use strict';

  function update() {
    var subSemaine = document.getElementById('planning-section-sub-semaine');
    var subActifs = document.getElementById('planning-section-sub-actifs');
    var kpiEffectif = document.getElementById('planning-kpi-effectif');
    var kpiPlanifies = document.getElementById('planning-kpi-planifies');
    var kpiAbsences = document.getElementById('planning-kpi-absences');
    var kpiHeures = document.getElementById('planning-kpi-heures');
    if (!subSemaine && !subActifs) return;

    var salaries = [];
    var plannings = [];
    try { salaries = JSON.parse(localStorage.getItem('salaries') || '[]') || []; } catch (_) {}
    try { plannings = JSON.parse(localStorage.getItem('plannings_hebdo') || '[]') || []; } catch (_) {}

    var actifs = salaries.filter(function (s) { return s && s.actif !== false; }).length;

    if (subSemaine) {
      var label = document.getElementById('planning-semaine-label');
      var dates = document.getElementById('planning-semaine-dates');
      var labelTxt = label && label.textContent ? label.textContent.trim() : '';
      var datesTxt = dates && dates.textContent ? dates.textContent.trim() : '';
      subSemaine.textContent = labelTxt + (datesTxt ? ' (' + datesTxt + ')' : '') || '—';
    }

    if (subActifs) {
      var rows = document.querySelectorAll('.planning-row, .planning-salarie-row, [data-planning-salarie]');
      subActifs.textContent = rows && rows.length ? rows.length : actifs;
    }

    if (kpiEffectif) kpiEffectif.textContent = actifs || '—';

    if (kpiPlanifies) {
      var planifiesCnt = plannings.filter(function (p) { return p && p.jours && Object.keys(p.jours || {}).some(function (j) { return p.jours[j] && p.jours[j].heureDebut; }); }).length;
      kpiPlanifies.textContent = planifiesCnt || (actifs > 0 ? actifs : '—');
    }

    if (kpiAbsences) {
      try {
        var absences = JSON.parse(localStorage.getItem('absences_periodes') || '[]') || [];
        var nowIso = new Date().toISOString().slice(0, 10);
        var nowWeekStart = getMonday(new Date());
        var nowWeekEnd = new Date(nowWeekStart); nowWeekEnd.setDate(nowWeekEnd.getDate() + 6);
        var absWeek = absences.filter(function (a) {
          if (!a || a.statut === 'refuse') return false;
          var start = a.date_debut || a.dateDebut || '';
          var end = a.date_fin || a.dateFin || start;
          return start <= nowWeekEnd.toISOString().slice(0, 10) && end >= nowWeekStart.toISOString().slice(0, 10);
        }).length;
        kpiAbsences.textContent = absWeek;
      } catch (_) { kpiAbsences.textContent = '—'; }
    }

    if (kpiHeures) {
      var totalH = 0;
      plannings.forEach(function (p) {
        if (!p || !p.jours) return;
        Object.keys(p.jours).forEach(function (j) {
          var jour = p.jours[j];
          if (!jour || !jour.heureDebut || !jour.heureFin) return;
          var start = parseTime(jour.heureDebut);
          var end = parseTime(jour.heureFin);
          if (!isNaN(start) && !isNaN(end) && end > start) totalH += (end - start) / 60;
        });
      });
      kpiHeures.textContent = totalH > 0 ? Math.round(totalH) + ' h' : '—';
    }
  }

  function getMonday(d) {
    var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function parseTime(t) {
    if (!t) return NaN;
    var parts = String(t).split(':');
    if (parts.length < 2) return NaN;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function tryAttach() {
    if (!document.getElementById('planning-section-sub-semaine') && !document.getElementById('planning-section-sub-actifs') && !document.getElementById('planning-kpi-effectif')) return false;
    update();
    if (!window.__refontePlanningIv) {
      window.__refontePlanningIv = setInterval(update, 5000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) { var r = 0, iv = setInterval(function(){ if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
    });
  } else {
    if (!tryAttach()) { var r = 0, iv = setInterval(function(){ if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
  }

  window.refontePlanningUpdateCounts = update;
})();
