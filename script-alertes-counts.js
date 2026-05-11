/* Phase 2 PR-H Alertes section-head counts (actives + reportees + traitees) */
/* Phase 36 — KPI grid counts (critiques / avertissements / info) */
(function () {
  'use strict';

  // Mirrors CATEGORIES severity map from script-alertes.js (types stable)
  var SEVERITY_MAP = {
    ct_expire: 'critique', permis_expire: 'critique', assurance_expire: 'critique',
    charge_retard_paiement: 'critique', carburant_anomalie: 'critique',
    ct_proche: 'alerte', permis_proche: 'alerte', assurance_proche: 'alerte',
    vidange: 'alerte', prix_manquant: 'alerte', planning_manquant: 'alerte',
    inspection_manquante: 'alerte', relance_auto: 'alerte',
    livraison_modif: 'info', carburant_modif: 'info', km_modif: 'info',
    inspection: 'info'
  };

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function update() {
    var subActives = document.getElementById('alertes-section-sub-actives');
    var subReportees = document.getElementById('alertes-section-sub-reportees');
    var subTraitees = document.getElementById('alertes-section-sub-traitees');
    var kpiCrit = document.getElementById('alertes-kpi-critiques');
    var kpiAlert = document.getElementById('alertes-kpi-alertes');
    var kpiInfo = document.getElementById('alertes-kpi-info');
    if (!subActives && !subReportees && !subTraitees) return;

    var alertes = lire('alertes_admin');
    var nowMs = Date.now();
    var actives = 0, reportees = 0, traitees = 0;
    var critiques = 0, alertesCnt = 0, infoCnt = 0;

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
      var sev = SEVERITY_MAP[a.type] || 'info';
      if (sev === 'critique') critiques++;
      else if (sev === 'alerte') alertesCnt++;
      else infoCnt++;
    });

    if (subActives) subActives.textContent = actives;
    if (subReportees) subReportees.textContent = reportees;
    if (subTraitees) subTraitees.textContent = traitees;
    if (kpiCrit) kpiCrit.textContent = critiques;
    if (kpiAlert) kpiAlert.textContent = alertesCnt;
    if (kpiInfo) kpiInfo.textContent = infoCnt;
  }

  function tryAttach() {
    if (!document.getElementById('alertes-section-sub-actives') && !document.getElementById('alertes-kpi-critiques')) return false;
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
