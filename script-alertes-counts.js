/* Phase 2 PR-H Alertes section-head counts (actives + reportees + traitees) */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function update() {
    var subActives = document.getElementById('alertes-section-sub-actives');
    var subReportees = document.getElementById('alertes-section-sub-reportees');
    var subTraitees = document.getElementById('alertes-section-sub-traitees');
    if (!subActives && !subReportees && !subTraitees) return;

    var alertes = lire('alertes_admin');
    var nowMs = Date.now();
    var actives = 0, reportees = 0, traitees = 0;

    alertes.forEach(function (a) {
      if (!a) return;
      if (a.traite === true || a.traitee === true) {
        traitees++;
        return;
      }
      var reportDate = a.reportee_jusqu_a || a.report_jusqu_a || a.reporte_jusqu_a;
      if (reportDate) {
        var ms = new Date(reportDate).getTime();
        if (!isNaN(ms) && ms > nowMs) { reportees++; return; }
      }
      actives++;
    });

    if (subActives) subActives.textContent = actives;
    if (subReportees) subReportees.textContent = reportees;
    if (subTraitees) subTraitees.textContent = traitees;
  }

  function tryAttach() {
    if (!document.getElementById('alertes-section-sub-actives')) return false;
    update();
    if (!window.__refonteAlertesIv) {
      window.__refonteAlertesIv = setInterval(update, 5000);
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

  window.refonteAlertesUpdateCounts = update;
})();
