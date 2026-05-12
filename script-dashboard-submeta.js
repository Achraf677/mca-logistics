/* Phase 59 polish — Dashboard section-head sub-meta date (mockup : "Mai 2026") */
(function () {
  'use strict';
  function update() {
    var el = document.getElementById('dashboard-section-sub-date');
    if (!el) return;
    var d = new Date();
    var mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][d.getMonth()];
    el.textContent = mois.charAt(0).toUpperCase() + mois.slice(1) + ' ' + d.getFullYear();
  }
  function tryAttach() {
    if (!document.getElementById('dashboard-section-sub-date')) return false;
    update();
    if (!window.__refonteDashSubMetaIv) {
      window.__refonteDashSubMetaIv = setInterval(update, 60 * 60 * 1000); // refresh every hour
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
})();
