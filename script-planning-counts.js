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
    try { plannings = JSON.parse(localStorage.getItem('plannings') || '[]') || []; } catch (_) {}

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

    var planifiesCnt = 0;
    if (kpiPlanifies || document.getElementById('planning-overview-planifies')) {
      planifiesCnt = plannings.filter(function (p) { return p && p.jours && Object.keys(p.jours || {}).some(function (j) { return p.jours[j] && p.jours[j].heureDebut; }); }).length;
      var planifiesVal = planifiesCnt || (actifs > 0 ? actifs : '—');
      if (kpiPlanifies) kpiPlanifies.textContent = planifiesVal;
      // Phase 81 : kpi-sub "X% de l'effectif" dynamique (mockup-aligned)
      var kpiPlanifiesSub = document.getElementById('planning-kpi-planifies-sub');
      if (kpiPlanifiesSub && actifs > 0 && planifiesCnt > 0) {
        kpiPlanifiesSub.textContent = Math.round(planifiesCnt / actifs * 100) + '% de l\'effectif';
      }
      var ov = document.getElementById('planning-overview-planifies');
      if (ov) ov.textContent = planifiesVal;
    }

    if (kpiAbsences || document.getElementById('planning-overview-absences')) {
      try {
        var absences = JSON.parse(localStorage.getItem('absences_periodes') || '[]') || [];
        var nowWeekStart = getMonday(new Date());
        var nowWeekEnd = new Date(nowWeekStart); nowWeekEnd.setDate(nowWeekEnd.getDate() + 6);
        var absWeek = absences.filter(function (a) {
          if (!a || a.statut === 'refuse' || a.statut === 'refused') return false;
          var start = a.debut || a.date_debut || a.dateDebut || '';
          var end = a.fin || a.date_fin || a.dateFin || start;
          if (!start) return false;
          var weekStartISO = nowWeekStart.getFullYear() + '-' + String(nowWeekStart.getMonth() + 1).padStart(2, '0') + '-' + String(nowWeekStart.getDate()).padStart(2, '0');
          var weekEndISO = nowWeekEnd.getFullYear() + '-' + String(nowWeekEnd.getMonth() + 1).padStart(2, '0') + '-' + String(nowWeekEnd.getDate()).padStart(2, '0');
          return start <= weekEndISO && end >= weekStartISO;
        }).length;
        if (kpiAbsences) {
          kpiAbsences.textContent = absWeek;
          // Phase 81 : warning color when absences > 0 (mockup: color:var(--warning))
          kpiAbsences.style.color = absWeek > 0 ? 'var(--ds-warning, var(--warning, #ffd60a))' : '';
        }
        var ovAbs = document.getElementById('planning-overview-absences');
        if (ovAbs) ovAbs.textContent = absWeek;
      } catch (_) {
        if (kpiAbsences) kpiAbsences.textContent = '—';
      }
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
