/* ==========================================================================
   MCA Logistics — Charges Charts (Phase 48)
   Graphiques Évolution 6 mois + Répartition par catégorie.
   Observe la page Charges pour init charts après navigation.
   ========================================================================== */

(function () {
  'use strict';

  var _evolChart = null;
  var _donutChart = null;
  var _initialized = false;

  function getMoisLabel() {
    var el = document.getElementById('charges-mois-label');
    return el ? el.textContent.trim() : '';
  }

  function lireCharges() {
    try { return JSON.parse(localStorage.getItem('charges') || '[]'); } catch (_) { return []; }
  }

  function aggregateByMonth(charges) {
    var byMonth = {};
    charges.forEach(function (c) {
      var d = c.date ? new Date(c.date) : null;
      if (!d || isNaN(d)) return;
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var mont = parseFloat(c.montant) || parseFloat(c.montantTTC) || 0;
      byMonth[key] = (byMonth[key] || 0) + mont;
    });
    return byMonth;
  }

  function last6MonthsKeys() {
    var now = new Date();
    var keys = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return keys;
  }

  var MOIS_FR = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  function moisFr(key) {
    var parts = key.split('-');
    return MOIS_FR[parseInt(parts[1], 10) - 1] || key;
  }

  function aggregateByCat(charges) {
    var sums = {};
    charges.forEach(function (c) {
      var cat = (c.categorie || c.cat || 'autre').toLowerCase();
      var mont = parseFloat(c.montant) || parseFloat(c.montantTTC) || 0;
      sums[cat] = (sums[cat] || 0) + mont;
    });
    return sums;
  }

  function filterCurrentMonth(charges) {
    var labelEl = document.getElementById('charges-mois-label');
    if (!labelEl) return charges;
    var label = labelEl.textContent.trim();
    if (!label) return charges;
    var moisMap = { 'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11 };
    var parts = label.toLowerCase().split(' ');
    var moisIdx = moisMap[parts[0]];
    var year = parseInt(parts[1], 10);
    if (moisIdx === undefined || isNaN(year)) return charges;
    return charges.filter(function (c) {
      var d = c.date ? new Date(c.date) : null;
      return d && d.getFullYear() === year && d.getMonth() === moisIdx;
    });
  }

  function renderCharts() {
    var c1 = document.getElementById('charges-evol-chart');
    var c2 = document.getElementById('charges-donut-chart');
    if (!c1 || !c2) return;

    var allCharges = lireCharges();
    var byMonth = aggregateByMonth(allCharges);
    var keys = last6MonthsKeys();
    var labels = keys.map(moisFr);
    var data = keys.map(function (k) { return Math.round((byMonth[k] || 0)); });

    var tooltipCfg = {
      backgroundColor: 'rgba(34,38,45,0.96)',
      borderColor: '#4a5263',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      titleFont: { family: '"Syne",sans-serif', size: 13, weight: 800 },
      bodyFont: { size: 12 }
    };

    // Destroy existing charts
    if (_evolChart) { try { _evolChart.destroy(); } catch (_) {} }
    if (_donutChart) { try { _donutChart.destroy(); } catch (_) {} }

    var ctx1 = c1.getContext('2d');
    var grad = ctx1.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, 'rgba(230,57,70,0.30)');
    grad.addColorStop(1, 'rgba(230,57,70,0)');

    Chart.defaults.color = '#adb5bd';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.font.family = '"DM Sans",system-ui,sans-serif';
    Chart.defaults.font.size = 11;

    _evolChart = new Chart(c1, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Charges HT',
          data: data,
          borderColor: '#e63946',
          backgroundColor: grad,
          tension: 0.4,
          fill: true,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#e63946',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({}, tooltipCfg, {
            callbacks: { label: function (c) { return ' ' + c.parsed.y.toLocaleString('fr-FR') + ' €'; } }
          })
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { padding: 8, callback: function (v) { return (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) + ' €'; } }
          },
          x: { grid: { display: false }, ticks: { padding: 8 } }
        }
      }
    });

    // Donut — current month
    var moisCharges = filterCurrentMonth(allCharges);
    var byCat = aggregateByCat(moisCharges);
    var catLabels = Object.keys(byCat).map(function (k) { return k.charAt(0).toUpperCase() + k.slice(1); });
    var catData = Object.values(byCat);
    var catColors = ['#e63946', '#4cc9f0', '#d4b67a', '#9bb1a4', '#06d6a0', '#f4a261', '#6c757d', '#b5838d', '#a9d6e5'];

    // Update repartition mois label
    var labelEl = document.getElementById('charges-repartition-mois');
    if (labelEl) {
      var ml = document.getElementById('charges-mois-label');
      var txt = (ml && ml.textContent.trim()) || '';
      if (!txt) {
        var now = new Date();
        txt = MOIS_FR[now.getMonth()] + ' ' + now.getFullYear();
      }
      if (txt) labelEl.textContent = txt;
    }

    _donutChart = new Chart(c2, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData.length ? catData : [1],
          backgroundColor: catData.length ? catColors.slice(0, catData.length) : ['#2a2f37'],
          borderColor: '#2a2f37',
          borderWidth: 3,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 10, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
          tooltip: Object.assign({}, tooltipCfg, {
            callbacks: {
              label: function (c) {
                var total = c.chart.data.datasets[0].data.reduce(function (a, b) { return a + b; }, 0);
                return ' ' + c.label + ' : ' + c.parsed.toLocaleString('fr-FR') + ' € (' + (total ? ((c.parsed / total) * 100).toFixed(1) : 0) + '%)';
              }
            }
          })
        }
      }
    });
  }

  function initChartsWhenReady() {
    var page = document.getElementById('page-charges');
    if (!page) return;
    if (typeof window.ensureChartJs !== 'function') return;

    var obs = new MutationObserver(function () {
      var visible = page.classList.contains('active') || page.style.display !== 'none';
      if (visible && !_initialized) {
        _initialized = true;
        window.ensureChartJs().then(function () {
          setTimeout(renderCharts, 300);
        }).catch(function (e) { console.warn('[charges-charts]', e); });
      }
    });

    obs.observe(page, { attributes: true, attributeFilter: ['class', 'style'] });

    // Also hook into afficherCharges if available
    var origAfficher = window.afficherCharges;
    window.afficherCharges = function () {
      if (typeof origAfficher === 'function') origAfficher.apply(this, arguments);
      if (typeof Chart !== 'undefined') setTimeout(renderCharts, 100);
    };

    // Initial check if already on charges page
    var visible = page.classList.contains('active') || page.style.display !== 'none';
    if (visible) {
      _initialized = true;
      window.ensureChartJs().then(function () { setTimeout(renderCharts, 500); }).catch(function (e) { console.warn('[charges-charts]', e); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChartsWhenReady);
  } else {
    setTimeout(initChartsWhenReady, 500);
  }
})();
