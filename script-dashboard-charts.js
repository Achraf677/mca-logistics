/* ==========================================================================
   MCA Logistics — Dashboard charts (Phase 10)

   Rend les 2 charts du bas du dashboard alignes sur mockup previews :
   - Area chart : Activité N derniers jours (livraisons + CA, ligne + fill rouge)
   - Donut : Statuts livraisons (livré / en cours / en attente / retard)

   Lazy : attend window.Chart (chargé via ensureChartJs() de script.js) et
   ne render que quand #page-dashboard est .active.
   ========================================================================== */

(function () {
  'use strict';

  var state = { range: 14, areaChart: null, donutChart: null };

  function readLivraisons() {
    if (typeof window.charger === 'function') {
      try { return window.charger('livraisons') || []; } catch (_) {}
    }
    try { return JSON.parse(localStorage.getItem('livraisons') || '[]') || []; }
    catch (_) { return []; }
  }

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function getStatut(l) {
    return String(l.statut || l.status || 'en-attente').toLowerCase();
  }

  function isEnRetard(l) {
    var s = getStatut(l);
    if (s === 'livre' || s === 'livré' || s === 'livree') return false;
    var d = l.dateLivraison || l.dateLiv || l.date;
    if (!d) return false;
    try {
      var t = new Date(d).getTime();
      var today = startOfDay(new Date()).getTime();
      return t < today;
    } catch (_) { return false; }
  }

  // ============ Area chart (activité par jour) ============
  function buildAreaData(livs, days) {
    var labels = [];
    var counts = [];
    var ca = [];
    var today = startOfDay(new Date());
    var byDay = {};
    for (var i = 0; i < days; i++) {
      var d = new Date(today.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      var key = d.toISOString().slice(0, 10);
      byDay[key] = { count: 0, ca: 0 };
      labels.push(d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    }
    livs.forEach(function (l) {
      var dStr = l.dateLivraison || l.dateLiv || l.date;
      if (!dStr) return;
      try {
        var d = new Date(dStr);
        var key = d.toISOString().slice(0, 10);
        if (byDay[key]) {
          byDay[key].count += 1;
          byDay[key].ca += Number(l.ht || l.prix_ht || 0);
        }
      } catch (_) {}
    });
    Object.keys(byDay).sort().forEach(function (k) {
      counts.push(byDay[k].count);
      ca.push(Math.round(byDay[k].ca));
    });
    return { labels: labels, counts: counts, ca: ca };
  }

  function renderAreaChart() {
    if (typeof window.Chart === 'undefined') return false;
    var ctxEl = document.getElementById('dash-area-chart');
    if (!ctxEl) return false;
    var data = buildAreaData(readLivraisons(), state.range);

    var ctx = ctxEl.getContext('2d');
    var gradRed = ctx.createLinearGradient(0, 0, 0, 220);
    gradRed.addColorStop(0, 'rgba(230, 57, 70, 0.35)');
    gradRed.addColorStop(1, 'rgba(230, 57, 70, 0)');

    if (state.areaChart) {
      state.areaChart.data.labels = data.labels;
      state.areaChart.data.datasets[0].data = data.counts;
      state.areaChart.data.datasets[1].data = data.ca;
      state.areaChart.update('none');
      return true;
    }

    state.areaChart = new window.Chart(ctxEl, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Livraisons',
            data: data.counts,
            borderColor: '#e63946',
            backgroundColor: gradRed,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#e63946',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            yAxisID: 'y',
          },
          {
            label: 'CA HT (€)',
            data: data.ca,
            borderColor: '#4cc9f0',
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            borderDash: [4, 4],
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: { color: '#9aa1ab', font: { size: 11, weight: '600' }, boxWidth: 10, boxHeight: 10, padding: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(20,22,28,0.95)',
            borderColor: '#2a2f37',
            borderWidth: 1,
            titleColor: '#f1f3f5',
            bodyColor: '#adb5bd',
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9aa1ab', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#9aa1ab', font: { size: 10 }, precision: 0 },
            beginAtZero: true,
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: { color: '#9aa1ab', font: { size: 10 }, callback: function (v) { return (v / 1000).toFixed(0) + 'k€'; } },
            beginAtZero: true,
          },
        },
      },
    });
    return true;
  }

  // ============ Donut statuts ============
  function buildStatutData(livs) {
    var c = { livre: 0, encours: 0, attente: 0, retard: 0 };
    livs.forEach(function (l) {
      if (isEnRetard(l)) { c.retard += 1; return; }
      var s = getStatut(l);
      if (s === 'livre' || s === 'livré' || s === 'livree') c.livre += 1;
      else if (s === 'en-cours' || s === 'en cours') c.encours += 1;
      else c.attente += 1;
    });
    return c;
  }

  function renderDonut() {
    if (typeof window.Chart === 'undefined') return false;
    var ctxEl = document.getElementById('dash-statuts-chart');
    if (!ctxEl) return false;
    var c = buildStatutData(readLivraisons());
    var total = c.livre + c.encours + c.attente + c.retard;

    var totalEl = document.getElementById('dash-statuts-total');
    if (totalEl) totalEl.textContent = total + ' livraison' + (total > 1 ? 's' : '');

    var labels = ['Livré', 'En cours', 'En attente', 'Retard'];
    var values = [c.livre, c.encours, c.attente, c.retard];
    var colors = ['#06d6a0', '#4cc9f0', '#ffd60a', '#e63946'];

    if (state.donutChart) {
      state.donutChart.data.datasets[0].data = values;
      state.donutChart.update('none');
    } else {
      state.donutChart = new window.Chart(ctxEl, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderColor: '#14171c',
            borderWidth: 2,
          }],
        },
        options: {
          responsive: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(20,22,28,0.95)',
              borderColor: '#2a2f37',
              borderWidth: 1,
              titleColor: '#f1f3f5',
              bodyColor: '#adb5bd',
            },
          },
        },
      });
    }

    // Legend custom
    var legend = document.getElementById('dash-statuts-legend');
    if (legend) {
      legend.innerHTML = labels.map(function (lbl, i) {
        return '<div class="dash-statuts-legend-item">'
          + '<span class="dot" style="background:' + colors[i] + '"></span>'
          + '<span class="label">' + lbl + '</span>'
          + '<span class="count">' + values[i] + '</span>'
          + '</div>';
      }).join('');
    }
    return true;
  }

  // ============ Public API ============
  function renderAll() {
    var ok1 = renderAreaChart();
    var ok2 = renderDonut();
    return ok1 || ok2;
  }

  function setRange(r) {
    state.range = r;
    // Update chip-mini active state
    document.querySelectorAll('.dash-chart-activity .chip-mini').forEach(function (b) {
      b.classList.toggle('active', String(b.getAttribute('data-range')) === String(r));
    });
    // Force area chart recreate (range change)
    if (state.areaChart) { try { state.areaChart.destroy(); } catch (_) {} state.areaChart = null; }
    renderAreaChart();
  }

  function tryRender() {
    if (!document.getElementById('dash-area-chart')) return false;
    if (typeof window.Chart === 'undefined') return false;
    return renderAll();
  }

  function setupHook() {
    // Initial render quand Chart.js disponible
    var attempts = 0;
    var iv = setInterval(function () {
      if (tryRender() || ++attempts > 60) clearInterval(iv);
    }, 500);

    // Re-render quand on rejoint le dashboard
    var page = document.getElementById('page-dashboard');
    if (page && typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        if (page.classList.contains('active')) {
          setTimeout(renderAll, 100);
        }
      });
      obs.observe(page, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHook);
  } else {
    setupHook();
  }

  window.refonteDashboardCharts = { render: renderAll, setRange: setRange };
})();
