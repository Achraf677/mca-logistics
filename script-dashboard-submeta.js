/* Phase 59 polish — Dashboard + Rentabilité section-head sub-meta date (mockup : "Mai 2026") */
(function () {
  'use strict';
  function moisLabel() {
    var d = new Date();
    var mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][d.getMonth()];
    return mois.charAt(0).toUpperCase() + mois.slice(1) + ' ' + d.getFullYear();
  }
  function update() {
    var lbl = moisLabel();
    var dashEl = document.getElementById('dashboard-section-sub-date');
    if (dashEl) dashEl.textContent = lbl;
    var rentEl = document.getElementById('rent-section-sub-mois');
    if (rentEl) rentEl.textContent = 'Mois de ' + lbl.toLowerCase();
  }
  function tryAttach() {
    if (!document.getElementById('dashboard-section-sub-date') && !document.getElementById('rent-section-sub-mois')) return false;
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
