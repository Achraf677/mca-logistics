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

  // Force police globale Chart.js sur DM Sans (eviter render italique/serif aleatoire)
  function ensureChartDefaults() {
    if (typeof window.Chart === 'undefined') return;
    if (window.__mcaChartDefaultsSet) return;
    try {
      window.Chart.defaults.color = '#adb5bd';
      window.Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
      window.Chart.defaults.font.family = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
      window.Chart.defaults.font.size = 11;
      window.Chart.defaults.font.style = 'normal';
      window.Chart.defaults.font.weight = '500';
      window.__mcaChartDefaultsSet = true;
    } catch (_) {}
  }

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
      // Phase 91.42 fix TZ : utiliser local YYYY-MM-DD au lieu de toISOString().slice(0,10) qui décale d'1 jour user CEST.
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      byDay[key] = { count: 0, ca: 0 };
      labels.push(d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    }
    // Phase 91.42 — getHT helper + filtre statut (exclut brouillons/annulées). Clés réelles = prixHT / montantHT, pas l.ht.
    var getHT = (typeof window.getMontantHTLivraison === 'function') ? window.getMontantHTLivraison : null;
    livs.forEach(function (l) {
      if (!l) return;
      var s = String(l.statut || '').toLowerCase();
      if (s === 'brouillon' || s === 'draft' || s === 'annule' || s === 'annulee') return;
      var dStr = l.dateLivraison || l.dateLiv || l.date;
      if (!dStr) return;
      try {
        // Format ISO court → suffixe T00:00:00 pour forcer parse local (sinon décale UTC).
        var dInput = (typeof dStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dStr)) ? dStr + 'T00:00:00' : dStr;
        var d = new Date(dInput);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (byDay[key]) {
          byDay[key].count += 1;
          // Phase 91.42 — utilise getMontantHTLivraison (fallback prixHT/montantHT/prix-via-TVA), pas les clés l.ht inexistantes
          var ht = getHT ? getHT(l) : Number(l.prixHT || l.montantHT || 0);
          if (!ht && l.prix) {
            var taux = parseFloat(l.tauxTVA || 20) / 100;
            ht = parseFloat(l.prix) / (1 + taux);
          }
          byDay[key].ca += Number(ht || 0);
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
    ensureChartDefaults();
    var ctxEl = document.getElementById('dash-area-chart');
    if (!ctxEl) return false;
    var data = buildAreaData(readLivraisons(), state.range);

    // Update stats footer + range label (Phase 18)
    var rangeLabel = document.getElementById('dash-area-range-label');
    if (rangeLabel) rangeLabel.textContent = String(state.range);
    var totalLiv = data.counts.reduce(function (s, v) { return s + v; }, 0);
    var totalCa = data.ca.reduce(function (s, v) { return s + v; }, 0);
    var moy = state.range > 0 ? (totalLiv / state.range) : 0;
    var setTxt = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('dash-stat-total', totalLiv);
    setTxt('dash-stat-moy', moy.toFixed(1).replace('.', ','));
    setTxt('dash-stat-ca', (totalCa / 1000).toFixed(1).replace('.', ','));

    // CA en k€ pour matcher mockup
    var caKE = data.ca.map(function (v) { return v / 1000; });

    var ctx = ctxEl.getContext('2d');
    var gradRed = ctx.createLinearGradient(0, 0, 0, 260);
    gradRed.addColorStop(0, 'rgba(230, 57, 70, 0.35)');
    gradRed.addColorStop(1, 'rgba(230, 57, 70, 0)');
    var gradGreen = ctx.createLinearGradient(0, 0, 0, 260);
    gradGreen.addColorStop(0, 'rgba(6, 214, 160, 0.22)');
    gradGreen.addColorStop(1, 'rgba(6, 214, 160, 0)');

    if (state.areaChart) {
      state.areaChart.data.labels = data.labels;
      state.areaChart.data.datasets[0].data = data.counts;
      state.areaChart.data.datasets[1].data = caKE;
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
            yAxisID: 'y',
            borderColor: '#e63946',
            backgroundColor: gradRed,
            tension: 0.4,
            fill: true,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: '#e63946',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 2,
          },
          {
            label: 'CA HT (k€)',
            data: caKE,
            yAxisID: 'y1',
            borderColor: '#06d6a0',
            backgroundColor: gradGreen,
            tension: 0.4,
            fill: true,
            borderWidth: 2,
            pointRadius: 2.5,
            pointBackgroundColor: '#06d6a0',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20,22,28,0.96)',
            borderColor: '#2a2f37',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleColor: '#f1f3f5',
            bodyColor: '#adb5bd',
            // Force police body normale (pas Syne display qui rendait italique/bizarre)
            titleFont: { family: '"DM Sans", system-ui, sans-serif', size: 13, weight: '700', style: 'normal' },
            bodyFont: { family: '"DM Sans", system-ui, sans-serif', size: 12, weight: '500', style: 'normal' },
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              title: function (items) { return items[0].label; },
              label: function (c) {
                // Audit 2026-05-17 : tooltips affichent le montant exact en € (pas k€ arrondi).
                // Dataset 0 = nb livraisons (entier), Dataset 1 = CA en k€ → reconverti en € exact.
                if (c.datasetIndex === 0) {
                  var n = c.parsed.y;
                  return ' ' + n + ' livraison' + (n > 1 ? 's' : '');
                }
                var ke = c.parsed.y;
                var euros = Math.round(ke * 1000);
                return ' ' + euros.toLocaleString('fr-FR') + ' € HT';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#adb5bd', font: { size: 10 }, padding: 8, maxRotation: 0, maxTicksLimit: 7 },
          },
          y: {
            beginAtZero: true,
            position: 'left',
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#adb5bd', font: { size: 10 }, padding: 8, precision: 0 },
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#adb5bd', font: { size: 10 }, padding: 8, callback: function (v) { return v + ' k€'; } },
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
    /* Phase 91.54.1 — skip si onglet pas visible */
    if (document.hidden) return false;
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
