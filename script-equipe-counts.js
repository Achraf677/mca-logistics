/* Phase 2 PR-E Equipe section-head counts — Phase 46 : tab badges — Phase 54 : KPI grid */
(function () {
  'use strict';
  function lire(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (_) { return []; } }
  function update() {
    /* Phase 91.54 I.12 — skip si onglet pas visible (gain perf ~50% CPU idle) */
    if (document.hidden) return;
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
    // Tab count badges (Phase 46) — Phase 60 V6 CRITIQUE C1 : 'actifs' était undefined depuis refactor Phase 59 → use actifsList.length
    var actifs = actifsList.length;
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
    // Phase 82 : "+N ce mois" for chauffeurs actifs kpi-sub
    var kpiActifsSub = document.getElementById('equipe-kpi-actifs-sub');
    if (kpiActifsSub) {
      var moisStartAct = new Date(); moisStartAct.setDate(1); moisStartAct.setHours(0, 0, 0, 0);
      var newThisMois = salaries.filter(function (s) {
        if (!s) return false;
        var d = new Date(s.dateEmbauche || s.date_embauche || s.created_at || '');
        return !isNaN(d.getTime()) && d >= moisStartAct;
      }).length;
      if (newThisMois > 0) {
        kpiActifsSub.innerHTML = '<span class="up">+' + newThisMois + '</span> ce mois';
      } else {
        kpiActifsSub.textContent = 'Salariés en activité';
      }
    }
    if (kpiInc) kpiInc.textContent = incOuverts > 0 ? incOuverts : '0';
    if (kpiHeures) {
      var totalH = heures.reduce(function (s, h) { return s + (parseFloat(h.heures) || 0); }, 0);
      kpiHeures.textContent = totalH > 0 ? Math.round(totalH) + ' h' : '—';
    }
    if (kpiPermis) {
      var nowTs = Date.now();
      var seuil = 60 * 86400000;
      var prochesList = salaries.filter(function (s) {
        if (!s || !s.datePermis) return false;
        var d = new Date(s.datePermis).getTime();
        return d > nowTs && (d - nowTs) < seuil;
      }).sort(function (a, b) { return new Date(a.datePermis) - new Date(b.datePermis); });
      kpiPermis.textContent = prochesList.length > 0 ? prochesList.length : '0';
      // Phase 82 : "Prénom N. dans Nj" for permis kpi-sub (mockup-aligned)
      var kpiPermisSub = document.getElementById('equipe-kpi-permis-sub');
      if (kpiPermisSub) {
        if (prochesList.length > 0) {
          var first = prochesList[0];
          var parts = ((first.prenom || '') + ' ' + (first.nom || '')).trim().split(/\s+/);
          var shortName = parts.length >= 2 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : parts[0] || '—';
          var joursRestants = Math.round((new Date(first.datePermis).getTime() - nowTs) / 86400000);
          kpiPermisSub.textContent = shortName + ' dans ' + joursRestants + 'j';
        } else {
          kpiPermisSub.textContent = 'Dans les 60j';
        }
      }
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
