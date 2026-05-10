/* Phase 2 PR-I Stats + Calendrier section-head counts (period mirror + livraisons count) */
(function () {
  'use strict';

  function updateStats() {
    var subPeriode = document.getElementById('stats-section-sub-periode');
    var subLivraisons = document.getElementById('stats-section-sub-livraisons');
    if (!subPeriode && !subLivraisons) return;

    if (subPeriode) {
      var label = document.getElementById('stats-mois-label');
      var dates = document.getElementById('stats-mois-dates');
      var labelTxt = label && label.textContent ? label.textContent.trim() : '';
      var datesTxt = dates && dates.textContent ? dates.textContent.trim() : '';
      subPeriode.textContent = (labelTxt + (datesTxt ? ' (' + datesTxt + ')' : '')) || '—';
    }

    if (subLivraisons) {
      var kpi = document.getElementById('stats-livraisons-periode');
      if (kpi && kpi.textContent) {
        var num = parseInt(kpi.textContent.replace(/[^\d]/g, ''), 10);
        subLivraisons.textContent = isNaN(num) ? '0' : String(num);
      }
    }
  }

  function updateCalendrier() {
    var subPeriode = document.getElementById('calendrier-section-sub-periode');
    if (!subPeriode) return;
    var label = document.getElementById('cal16-label');
    var sub = document.getElementById('cal16-sub');
    var labelTxt = label && label.textContent ? label.textContent.trim() : '';
    var subTxt = sub && sub.textContent ? sub.textContent.trim() : '';
    subPeriode.textContent = (labelTxt + (subTxt ? ' (' + subTxt + ')' : '')) || '—';
  }

  function update() { updateStats(); updateCalendrier(); }

  function tryAttach() {
    if (!document.getElementById('stats-section-sub-periode') && !document.getElementById('calendrier-section-sub-periode')) return false;
    update();
    if (!window.__refonteStatsCalIv) {
      window.__refonteStatsCalIv = setInterval(update, 5000);
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

  window.refonteStatsCalUpdateCounts = update;
})();
