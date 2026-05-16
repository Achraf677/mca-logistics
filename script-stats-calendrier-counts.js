/* Phase 2 PR-I Stats + Calendrier section-head counts (period mirror + livraisons count) */
/* Phase 88 — Stats KPI subs : % vs mois préc (mockup-aligned) */
(function () {
  'use strict';

  var MOIS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

  function pctSub(cur, prev, suffix) {
    if (prev <= 0 || cur <= 0) return '';
    var d = Math.round((cur - prev) / prev * 100);
    if (d > 0) return '<span class="up">+' + d + '%</span> vs ' + suffix;
    if (d < 0) return '<span class="down">' + d + '%</span> vs ' + suffix;
    return '= vs ' + suffix;
  }

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
    // Phase 59 polish — CA sub-meta (mockup format "CA 38 420 €")
    var subCa = document.getElementById('stats-section-sub-ca');
    if (subCa) {
      var kpiCa = document.getElementById('stats-ca-periode') || document.getElementById('stats-ca-ht-periode');
      if (kpiCa && kpiCa.textContent) {
        subCa.textContent = kpiCa.textContent.trim();
      } else {
        // Fallback : compute from livraisons localStorage
        try {
          var livs = JSON.parse(localStorage.getItem('livraisons') || '[]');
          var now = new Date();
          var moisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          var totalCa = livs.filter(function(l) {
            if (!l) return false;
            var d = new Date(l.date || l.dateLivraison || '');
            return !isNaN(d.getTime()) && d.getTime() >= moisStart;
          }).reduce(function(s, l) { return s + (parseFloat(l.prixHT || l.prix || 0)); }, 0);
          subCa.textContent = totalCa.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        } catch (_) {}
      }
    }

    // Phase 88 : Stats KPI subs % vs mois préc (mockup-aligned)
    try {
      var livraisons = JSON.parse(localStorage.getItem('livraisons') || '[]');
      var now2 = new Date();
      var moisCurStart = new Date(now2.getFullYear(), now2.getMonth(), 1).getTime();
      var moisCurEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 0, 23, 59, 59).getTime();
      var moisPrevStart = new Date(now2.getFullYear(), now2.getMonth() - 1, 1).getTime();
      var moisPrevEnd = new Date(now2.getFullYear(), now2.getMonth(), 0, 23, 59, 59).getTime();
      var prevMoisNom = MOIS_FR[new Date(now2.getFullYear(), now2.getMonth() - 1, 1).getMonth()];

      function livsInRange(start, end) {
        return livraisons.filter(function(l) {
          if (!l) return false;
          var d = new Date(l.date || l.dateLivraison || '');
          return !isNaN(d.getTime()) && d.getTime() >= start && d.getTime() <= end;
        });
      }
      var curLivs = livsInRange(moisCurStart, moisCurEnd);
      var prevLivs = livsInRange(moisPrevStart, moisPrevEnd);
      var curCa = curLivs.reduce(function(s, l) { return s + (parseFloat(l.prixHT || l.prix || 0)); }, 0);
      var prevCa = prevLivs.reduce(function(s, l) { return s + (parseFloat(l.prixHT || l.prix || 0)); }, 0);
      var curPanier = curLivs.length > 0 ? curCa / curLivs.length : 0;
      var prevPanier = prevLivs.length > 0 ? prevLivs.reduce(function(s, l) { return s + (parseFloat(l.prixHT || l.prix || 0)); }, 0) / prevLivs.length : 0;
      var curKm = curLivs.reduce(function(s, l) { return s + (parseFloat(l.distance || 0)); }, 0);
      var prevKm = prevLivs.reduce(function(s, l) { return s + (parseFloat(l.distance || 0)); }, 0);

      var subCaEl = document.getElementById('stats-ca-sub');
      if (subCaEl) {
        var h = pctSub(curCa, prevCa, prevMoisNom);
        if (h) subCaEl.innerHTML = h; else subCaEl.textContent = 'Montant hors taxes';
      }
      var subLivEl = document.getElementById('stats-livraisons-sub');
      if (subLivEl) {
        var h2 = pctSub(curLivs.length, prevLivs.length, prevMoisNom);
        if (h2) subLivEl.innerHTML = h2;
      }
      var subPanierEl = document.getElementById('stats-panier-sub');
      if (subPanierEl) {
        var h3 = pctSub(curPanier, prevPanier, prevMoisNom);
        if (h3) subPanierEl.innerHTML = h3; else subPanierEl.textContent = 'Moyenne hors taxes';
      }
      var subKmEl = document.getElementById('stats-km-sub');
      if (subKmEl) {
        var h4 = pctSub(curKm, prevKm, prevMoisNom);
        if (h4) subKmEl.innerHTML = h4;
      }
    } catch (_) {}
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
    // cal16-kpi-feries n'est jamais mis à jour par le calendrier — on compte les cellules directement
    var feriesCells = document.querySelectorAll('#cal16-grid .cal16-day-ferie');
    var cntFer = feriesCells.length;
    // Mettre à jour l'élément KPI pour cohérence sidebar
    var kpiFerEl = document.getElementById('cal16-kpi-feries');
    if (kpiFerEl) kpiFerEl.textContent = cntFer > 0 ? String(cntFer) : '—';
    // Phase 67 : cal16-kpi-pai (Encaissé) — somme livraisons livrées ce mois
    var kpiPai = document.getElementById('cal16-kpi-pai');
    if (kpiPai) {
      try {
        var now = new Date();
        var moisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        var moisEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        var livs = JSON.parse(localStorage.getItem('livraisons') || '[]') || [];
        var totalPai = livs.filter(function(l) {
          if (!l) return false;
          var s = (l.statut || l.status || '').toLowerCase();
          if (s !== 'livre' && s !== 'livré' && s !== 'livree' && s !== 'livrée') return false;
          var d = new Date(l.date || l.dateLivraison || '');
          return !isNaN(d.getTime()) && d.getTime() >= moisStart && d.getTime() <= moisEnd;
        }).reduce(function(sum, l) {
          return sum + (parseFloat(l.prix || l.prixTTC || l.prixHT || 0));
        }, 0);
        kpiPai.textContent = totalPai > 0
          ? totalPai.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
          : '—';
      } catch (_) {}
    }
    if (cntLiv === 0 && cntEch === 0 && cntFer === 0) {
      // Fallback : afficher la période si les KPIs ne sont pas encore prêts
      var label = document.getElementById('cal16-label');
      var labelTxt = label && label.textContent ? label.textContent.trim() : '';
      subPeriode.textContent = labelTxt || '—';
      return;
    }
    var parts = [];
    if (cntLiv > 0) parts.push(cntLiv + ' livraison' + (cntLiv > 1 ? 's' : ''));
    if (cntEch > 0) parts.push(cntEch + ' échéance' + (cntEch > 1 ? 's' : ''));
    if (cntFer > 0) parts.push(cntFer + ' jour' + (cntFer > 1 ? 's' : '') + ' férié' + (cntFer > 1 ? 's' : ''));
    subPeriode.textContent = parts.join(' · ') + (parts.length ? ' ce mois' : '—');
  }

  function update() { updateStats(); updateCalendrier(); }

  function tryAttach() {
    if (!document.getElementById('stats-section-sub-periode') && !document.getElementById('calendrier-section-sub-periode')) return false;
    update();
    if (!window.__refonteStatsCalIv) {
      window.__refonteStatsCalIv = setInterval(update, 1500);
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
  document.querySelectorAll('.stats-granularity').forEach(function (c) {
    c.classList.remove('active');
    c.setAttribute('aria-selected', 'false');
  });
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  var modeMap = { mois: 'mois', trimestre: 'annee', annee: 'annee' };
  var mode = modeMap[granularity] || 'mois';
  if (typeof window.changerVueStats === 'function') window.changerVueStats(mode);
};
