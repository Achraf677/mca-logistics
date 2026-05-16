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
    // Phase 85 : semaine kpi-sub "N véhicule(s) contrôlé(s)" (mockup-aligned)
    var kpiSemaineSub = document.getElementById('insp-kpi-semaine-sub');
    if (kpiSemaineSub) {
      var semVehSet = new Set();
      inSemaine.forEach(function (i) { if (i.vehImmat || i.vehId) semVehSet.add(i.vehImmat || i.vehId); });
      var nbVehS = semVehSet.size;
      kpiSemaineSub.textContent = nbVehS > 0 ? nbVehS + ' véhicule' + (nbVehS > 1 ? 's' : '') + ' contrôlé' + (nbVehS > 1 ? 's' : '') : 'Inspections réalisées';
    }
    if (subSemaine) {
      // Phase 59 mockup format : "Semaine N"
      var semNum = (function() {
        var d = new Date(weekStart);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        var yearStart = new Date(d.getFullYear(), 0, 4);
        return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
      })();
      subSemaine.textContent = 'Semaine ' + semNum;
    }
    // Phase 59 mockup : compteurs distincts véhicules + inspections semaine
    if (subCount) subCount.textContent = inSemaine.length;
    var subVehicules = document.getElementById('insp-section-sub-vehicules');
    if (subVehicules) {
      var vehSet = new Set();
      inSemaine.forEach(function (i) { if (i.vehImmat || i.vehId) vehSet.add(i.vehImmat || i.vehId); });
      subVehicules.textContent = vehSet.size;
    }

    // Défauts (checkpoints ko) sur les 30 derniers jours
    if (kpiDefauts) {
      var seuil30 = new Date(); seuil30.setDate(seuil30.getDate() - 30);
      var seuil30Iso = seuil30.toISOString().slice(0, 10);
      var totalKo = 0;
      var defVehSet = new Set();
      inspections.filter(function (i) { return i && i.date >= seuil30Iso; }).forEach(function (i) {
        if (!i.checkpoints) return;
        var hasKo = false;
        Object.values(i.checkpoints).forEach(function (v) { if (v === 'ko') { totalKo++; hasKo = true; } });
        if (hasKo && (i.vehImmat || i.vehId)) defVehSet.add(i.vehImmat || i.vehId);
      });
      kpiDefauts.textContent = totalKo > 0 ? totalKo : '—';
      // Phase 85 : defauts kpi-sub "N véhicule(s) touché(s)" (mockup-aligned)
      var kpiDefautsSub = document.getElementById('insp-kpi-defauts-sub');
      if (kpiDefautsSub) {
        var nbVehD = defVehSet.size;
        kpiDefautsSub.textContent = nbVehD > 0 ? nbVehD + ' véhicule' + (nbVehD > 1 ? 's' : '') + ' touché' + (nbVehD > 1 ? 's' : '') : 'Points KO (30j)';
      }
    }

    // Conformité globale (% conformes sur 30j)
    if (kpiConformite) {
      var seuil30c = new Date(); seuil30c.setDate(seuil30c.getDate() - 30);
      var seuil30cIso = seuil30c.toISOString().slice(0, 10);
      var recent = inspections.filter(function (i) { return i && i.date >= seuil30cIso; });
      var conformes = recent.filter(function (i) { return i.statut === 'conforme'; }).length;
      var conformitePct = recent.length > 0 ? Math.round(conformes / recent.length * 100) : -1;
      kpiConformite.textContent = conformitePct >= 0 ? conformitePct + '%' : '—';
      // Phase 85 : conformite kpi-sub "+N% vs S[N-1]" (mockup-aligned)
      var kpiConformiteSub = document.getElementById('insp-kpi-conformite-sub');
      if (kpiConformiteSub && conformitePct >= 0) {
        var prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        var prevWeekEnd = new Date(weekStart);
        var prevWeekStartIso = prevWeekStart.toISOString().slice(0, 10);
        var prevWeekEndIso = prevWeekEnd.toISOString().slice(0, 10);
        var prevWeekInsp = inspections.filter(function (i) { return i && i.date >= prevWeekStartIso && i.date < prevWeekEndIso; });
        var prevConformes = prevWeekInsp.filter(function (i) { return i.statut === 'conforme'; }).length;
        var prevPct = prevWeekInsp.length > 0 ? Math.round(prevConformes / prevWeekInsp.length * 100) : -1;
        var semNum = (function() {
          var d = new Date(weekStart); d.setHours(0,0,0,0);
          d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
          var yearStart = new Date(d.getFullYear(), 0, 4);
          return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
        })();
        var prevSemNum = semNum - 1;
        if (prevPct >= 0) {
          var delta = conformitePct - prevPct;
          if (delta > 0) {
            kpiConformiteSub.innerHTML = '<span class="up">+' + delta + '%</span> vs S' + prevSemNum;
          } else if (delta < 0) {
            kpiConformiteSub.innerHTML = '<span class="down">' + delta + '%</span> vs S' + prevSemNum;
          } else {
            kpiConformiteSub.textContent = '= vs S' + prevSemNum;
          }
        } else {
          kpiConformiteSub.textContent = '30 derniers jours';
        }
      }
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
