/* Phase 2 PR-E Equipe section-head counts */
(function () {
  'use strict';
  function lire(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (_) { return []; } }
  function update() {
    var subActifs = document.getElementById('equipe-section-sub-actifs');
    var subPostes = document.getElementById('equipe-section-sub-postes');
    if (!subActifs && !subPostes) return;
    var salaries = lire('salaries');
    var postes = lire('postes');
    var actifs = salaries.filter(function (s) { return !s || s.actif !== false; }).length;
    if (subActifs) subActifs.textContent = actifs;
    if (subPostes) subPostes.textContent = postes.length;
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
