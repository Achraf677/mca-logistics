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
    // Phase 59 polish (mockup format) : "X livraisons · Y échéances · Z jours fériés ce mois"
    function readNum(id) {
      var el = document.getElementById(id);
      if (!el) return 0;
      var n = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10);
      return isNaN(n) ? 0 : n;
    }
    var cntLiv = readNum('cal16-kpi-liv');
    var cntEch = readNum('cal16-kpi-ech');
    var cntFer = readNum('cal16-kpi-feries');
    if (cntLiv === 0 && cntEch === 0 && cntFer === 0) {
      // Fallback : afficher la période si les KPIs ne sont pas encore prêts
      var label = document.getElementById('cal16-label');
      var sub = document.getElementById('cal16-sub');
      var labelTxt = label && label.textContent ? label.textContent.trim() : '';
      var subTxt = sub && sub.textContent ? sub.textContent.trim() : '';
      subPeriode.textContent = (labelTxt + (subTxt ? ' (' + subTxt + ')' : '')) || '—';
      return;
    }
    var parts = [];
    parts.push(cntLiv + ' livraison' + (cntLiv > 1 ? 's' : ''));
    if (cntEch > 0) parts.push(cntEch + ' échéance' + (cntEch > 1 ? 's' : ''));
    if (cntFer > 0) parts.push(cntFer + ' jour' + (cntFer > 1 ? 's' : '') + ' férié' + (cntFer > 1 ? 's' : ''));
    subPeriode.textContent = parts.join(' · ') + ' ce mois';
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

/* Phase 57 : setStatsGranularity — chips Mois/Trimestre/Année dans section-head */
window.setStatsGranularity = function (btn, granularity) {
  document.querySelectorAll('.stats-granularity').forEach(function (c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var modeMap = { mois: 'mois', trimestre: 'annee', annee: 'annee' };
  var mode = modeMap[granularity] || 'mois';
  if (typeof window.changerVueStats === 'function') window.changerVueStats(mode);
};
