/* Phase 2 PR-E Equipe section-head counts — Phase 46 : tab badges — Phase 54 : KPI grid */
(function () {
  'use strict';
  function lire(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (_) { return []; } }
  function update() {
    var subActifs = document.getElementById('equipe-section-sub-actifs');
    var subPostes = document.getElementById('equipe-section-sub-postes');
    var subAdmins = document.getElementById('equipe-section-sub-admins');
    var subHeures = document.getElementById('equipe-section-sub-heures');
    if (!subActifs && !subPostes) return;
    var salaries = lire('salaries');
    var postes = lire('postes');
    var incidents = lire('incidents');
    var heures = lire('heures');
    // Phase 59 mockup-aligned : chauffeurs vs admins (au lieu de salarié(s) actif(s) + poste(s))
    var actifsList = salaries.filter(function (s) { return !s || s.actif !== false; });
    var chauffeurs = actifsList.filter(function (s) { return !s.role || s.role === 'chauffeur' || s.role === 'salarie'; }).length;
    var admins = actifsList.filter(function (s) { return s.role === 'admin' || s.role === 'manager'; }).length;
    if (subActifs) subActifs.textContent = chauffeurs > 0 ? chauffeurs : actifsList.length;
    if (subAdmins) subAdmins.textContent = admins;
    if (subPostes) subPostes.textContent = postes.length;
    if (subHeures) {
      var now = new Date();
      var moisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      var moisH = heures.filter(function (h) { return h && h.date && new Date(h.date).getTime() >= moisStart; })
        .reduce(function (s, h) { return s + (parseFloat(h.heures) || 0); }, 0);
      subHeures.textContent = Math.round(moisH);
    }
    // Tab count badges (Phase 46)
    var salCount = document.getElementById('equipe-tab-sal-count');
    var incCount = document.getElementById('equipe-tab-inc-count');
    var incOuverts = incidents.filter(function (i) { return i && !i.resolu && !i.archive; }).length;
    if (salCount) salCount.textContent = actifs > 0 ? actifs : '';
    if (incCount) incCount.textContent = incOuverts > 0 ? incOuverts : '';
    // KPI grid (Phase 54)
    var kpiActifs = document.getElementById('equipe-kpi-actifs');
    var kpiHeures = document.getElementById('equipe-kpi-heures');
    var kpiInc = document.getElementById('equipe-kpi-incidents');
    var kpiPermis = document.getElementById('equipe-kpi-permis');
    if (kpiActifs) kpiActifs.textContent = actifs > 0 ? actifs : '—';
    if (kpiInc) kpiInc.textContent = incOuverts > 0 ? incOuverts : '0';
    if (kpiHeures) {
      var totalH = heures.reduce(function (s, h) { return s + (parseFloat(h.heures) || 0); }, 0);
      kpiHeures.textContent = totalH > 0 ? Math.round(totalH) + ' h' : '—';
    }
    if (kpiPermis) {
      var now = Date.now();
      var seuil = 60 * 86400000;
      var proches = salaries.filter(function (s) {
        if (!s || !s.datePermis) return false;
        var d = new Date(s.datePermis).getTime();
        return d > now && (d - now) < seuil;
      }).length;
      kpiPermis.textContent = proches > 0 ? proches : '0';
    }
  }
  function tryAttach() {
    if (!document.getElementById('equipe-section-sub-actifs')) return false;
    update();
    // Re-update toutes les 5s (pas de MutationObserver simple sur equipe-kpis-row car KPIs render plus tard)
    if (!window.__refonteEquipeIv) {
      window.__refonteEquipeIv = setInterval(update, 5000);
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
  window.refonteEquipeUpdateCounts = update;
})();
