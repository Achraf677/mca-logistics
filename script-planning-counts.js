/* Phase 2 PR-G Planning section-head counts (semaine + nb planifies) */
(function () {
  'use strict';

  function update() {
    var subSemaine = document.getElementById('planning-section-sub-semaine');
    var subActifs = document.getElementById('planning-section-sub-actifs');
    if (!subSemaine && !subActifs) return;

    if (subSemaine) {
      var label = document.getElementById('planning-semaine-label');
      var dates = document.getElementById('planning-semaine-dates');
      var labelTxt = label && label.textContent ? label.textContent.trim() : '';
      var datesTxt = dates && dates.textContent ? dates.textContent.trim() : '';
      subSemaine.textContent = labelTxt + (datesTxt ? ' (' + datesTxt + ')' : '') || '—';
    }

    if (subActifs) {
      var rows = document.querySelectorAll('.planning-row, .planning-salarie-row, [data-planning-salarie]');
      if (rows && rows.length) {
        subActifs.textContent = rows.length;
      } else {
        try {
          var salaries = JSON.parse(localStorage.getItem('salaries') || '[]') || [];
          var actifs = salaries.filter(function (s) { return s && s.actif !== false; }).length;
          subActifs.textContent = actifs;
        } catch (_) { subActifs.textContent = '0'; }
      }
    }
  }

  function tryAttach() {
    if (!document.getElementById('planning-section-sub-semaine') && !document.getElementById('planning-section-sub-actifs')) return false;
    update();
    if (!window.__refontePlanningIv) {
      window.__refontePlanningIv = setInterval(update, 5000);
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

  window.refontePlanningUpdateCounts = update;
})();
