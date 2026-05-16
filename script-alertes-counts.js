/* Phase 2 PR-H Alertes section-head counts (actives + reportees + traitees) */
/* Phase 36 — KPI grid counts (critiques / avertissements / info) */
/* Phase 83 — KPI subs dynamic text + brand color on critiques/alertes */
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

  // Short labels for alert types (for kpi-sub display)
  var TYPE_LABEL = {
    ct_expire: 'CT expiré', permis_expire: 'Permis expiré', assurance_expire: 'Assurance expirée',
    charge_retard_paiement: 'Retard paiement', carburant_anomalie: 'Anomalie carburant',
    ct_proche: 'CT', permis_proche: 'Permis', assurance_proche: 'Assurance',
    vidange: 'Vidange', prix_manquant: 'Prix manquant', planning_manquant: 'Planning',
    inspection_manquante: 'Inspection', relance_auto: 'Relance client'
  };

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function update() {
    /* Phase 91.54 I.12 — skip si onglet pas visible (gain perf ~50% CPU idle) */
    if (document.hidden) return;
    var subActives = document.getElementById('alertes-section-sub-actives');
    var subReportees = document.getElementById('alertes-section-sub-reportees');
    var subTraitees = document.getElementById('alertes-section-sub-traitees');
    var subEch30 = document.getElementById('alertes-section-sub-echeances30');
    var kpiCrit = document.getElementById('alertes-kpi-critiques');
    var kpiAlert = document.getElementById('alertes-kpi-alertes');
    var kpiInfo = document.getElementById('alertes-kpi-info');
    if (!subActives && !subReportees && !subTraitees && !subEch30) return;

    var alertes = lire('alertes_admin');
    var nowMs = Date.now();
    var seuil30j = 30 * 86400000;
    var actives = 0, reportees = 0, traitees = 0, echeances30 = 0;
    var critiques = 0, alertesCnt = 0, infoCnt = 0;
    var firstCritique = null;
    var alerteTypes = {};

    // Phase 59 mockup-aligned : compte les échéances dans les 30 jours (CT, permis, assurance, vidange)
    var ECHEANCE_TYPES = { ct_expire: 1, ct_proche: 1, permis_expire: 1, permis_proche: 1, assurance_expire: 1, assurance_proche: 1, vidange: 1 };

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
      if (sev === 'critique') {
        critiques++;
        if (!firstCritique) firstCritique = a;
      } else if (sev === 'alerte') {
        alertesCnt++;
        if (a.type && TYPE_LABEL[a.type]) alerteTypes[TYPE_LABEL[a.type]] = true;
      } else infoCnt++;
      // Échéances dans les 30 jours
      if (ECHEANCE_TYPES[a.type]) {
        var echDate = a.echeance || a.dateEcheance || a.date_echeance;
        if (echDate) {
          var echMs = new Date(echDate).getTime();
          if (!isNaN(echMs) && echMs > nowMs && (echMs - nowMs) <= seuil30j) {
            echeances30++;
          }
        } else if (sev === 'critique' || sev === 'alerte') {
          echeances30++;
        }
      }
    });

    if (subActives) subActives.textContent = actives;
    if (subReportees) subReportees.textContent = reportees;
    if (subTraitees) subTraitees.textContent = traitees;
    if (subEch30) subEch30.textContent = echeances30;

    // Phase 60 polish V5 — pluriels conditionnels mockup-aligned
    var wrapActives = document.getElementById('alertes-sub-actives-wrap');
    if (wrapActives) {
      wrapActives.innerHTML = '<span id="alertes-section-sub-actives">' + actives + '</span> alerte' + (actives > 1 ? 's' : '') + ' active' + (actives > 1 ? 's' : '');
    }
    var wrapEch30 = document.getElementById('alertes-sub-echeances30-wrap');
    if (wrapEch30) {
      wrapEch30.innerHTML = '<span id="alertes-section-sub-echeances30">' + echeances30 + '</span> échéance' + (echeances30 > 1 ? 's' : '') + ' dans les 30 jours';
    }

    if (kpiCrit) kpiCrit.textContent = critiques;
    if (kpiAlert) kpiAlert.textContent = alertesCnt;
    if (kpiInfo) kpiInfo.textContent = infoCnt;

    // Phase 83 : KPI subs dynamic text (mockup-aligned)
    var kpiCritSub = document.getElementById('alertes-kpi-critiques-sub');
    if (kpiCritSub) {
      if (critiques > 0 && firstCritique) {
        var typeLabel = TYPE_LABEL[firstCritique.type] || firstCritique.type || 'Alerte critique';
        var echDate = firstCritique.echeance || firstCritique.dateEcheance || firstCritique.date_echeance || '';
        var suffix = '';
        if (echDate) {
          var echMs = new Date(echDate).getTime();
          if (!isNaN(echMs)) {
            var joursJ = Math.round((echMs - nowMs) / 86400000);
            suffix = joursJ >= 0 ? ' dans ' + joursJ + 'j' : ' expiré';
          }
        }
        kpiCritSub.textContent = typeLabel + suffix;
      } else {
        kpiCritSub.textContent = 'Action immédiate requise';
      }
    }
    var kpiAlertSub = document.getElementById('alertes-kpi-alertes-sub');
    if (kpiAlertSub) {
      var alerteKeys = Object.keys(alerteTypes);
      kpiAlertSub.textContent = alerteKeys.length > 0 ? alerteKeys.slice(0, 3).join(', ') : 'À traiter cette semaine';
    }
    var kpiInfoSub = document.getElementById('alertes-kpi-info-sub');
    if (kpiInfoSub) {
      var firstInfoMsg = null;
      alertes.forEach(function (a) {
        if (!a || a.traite === true || a.traitee === true || firstInfoMsg) return;
        if ((SEVERITY_MAP[a.type] || 'info') === 'info') {
          // Phase 91.55 Bug F — slice 36 tronquait noms (Achraf → Achra). 60 + ellipse intelligente.
          var rawMsg = a.message || a.titre || '';
          var msg = rawMsg.length > 60 ? rawMsg.slice(0, 57) + '…' : rawMsg;
          if (msg) firstInfoMsg = msg;
        }
      });
      kpiInfoSub.textContent = firstInfoMsg || 'Notifications légères';
    }

    // Phase 83 : colors on kpi-lbl + kpi-val (mockup-aligned)
    var critLbl = document.getElementById('alertes-kpi-critiques-lbl');
    var alertLbl = document.getElementById('alertes-kpi-alertes-lbl');
    var brandColor = 'var(--brand, #e63946)';
    var warnColor = '#d4b67a';
    if (critLbl) critLbl.style.color = critiques > 0 ? brandColor : '';
    if (kpiCrit) kpiCrit.style.color = critiques > 0 ? brandColor : '';
    if (alertLbl) alertLbl.style.color = alertesCnt > 0 ? warnColor : '';


    // Phase 67 : title-row sub-meta (alertes-titlerow-actives + critiques-wrap)
    var trActives = document.getElementById('alertes-titlerow-actives');
    if (trActives) trActives.textContent = actives;
    var trCritWrap = document.getElementById('alertes-titlerow-critiques-wrap');
    var trCrit = document.getElementById('alertes-titlerow-critiques');
    if (trCritWrap && trCrit) {
      trCrit.textContent = critiques;
      trCritWrap.style.display = critiques > 0 ? '' : 'none';
    }
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
