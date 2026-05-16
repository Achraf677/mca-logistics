/**
 * MCA Logistics — Chart.js lazy loader + base options + gradient helper (Phase X — extraction script.js)
 *
 * Extracted from script.js L1408-1473 (2026-05-16).
 */

/* ===== Chart.js lazy loader — charge 197KB uniquement au premier graphique ===== */
let _chartJsPromise = null;
function ensureChartJs() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (_chartJsPromise) return _chartJsPromise;
  _chartJsPromise = new Promise(function(resolve, reject) {
    const s = document.createElement('script');
    s.src = 'chart.min.js';
    s.async = false;
    s.onload = function() { resolve(); };
    s.onerror = function() { _chartJsPromise = null; reject(new Error('Chart.js load failed')); };
    document.head.appendChild(s);
  });
  return _chartJsPromise;
}

/* ===== HELPERS CHART.JS — gradient fill + animations smooth partagés ===== */
function mcaChartGradient(canvas, colorHex, opacityTop, opacityBottom) {
  if (!canvas) return colorHex;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return colorHex;
  const height = canvas.clientHeight || canvas.height || 280;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  const hexToRgb = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return '245,166,35';
    const i = parseInt(m[1], 16);
    return [(i>>16)&255, (i>>8)&255, i&255].join(',');
  };
  const rgb = hexToRgb(colorHex);
  gradient.addColorStop(0, `rgba(${rgb},${opacityTop != null ? opacityTop : 0.55})`);
  gradient.addColorStop(1, `rgba(${rgb},${opacityBottom != null ? opacityBottom : 0.02})`);
  return gradient;
}
function mcaChartBaseOptions(isLight, extra) {
  const tickColor = isLight ? '#334155' : '#e2e8f0';
  const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)';
  const legendColor = isLight ? '#0f172a' : '#f8fafc';
  const tooltipBg = isLight ? 'rgba(17,24,39,0.95)' : 'rgba(10,13,20,0.95)';
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: legendColor, font: { weight: '600', size: 12 }, boxWidth: 14, padding: 14 } },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(230,57,70,0.4)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { weight: '700' },
        bodyFont: { size: 12 },
        displayColors: true,
        boxPadding: 4
      }
    },
    scales: {
      x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } } }
    }
  }, extra || {});
}

// _chartJsPromise reste module-scoped (let réassigné, pas exposé window)
if (typeof window !== 'undefined') {
  window.ensureChartJs = ensureChartJs;
  window.mcaChartGradient = mcaChartGradient;
  window.mcaChartBaseOptions = mcaChartBaseOptions;
}
