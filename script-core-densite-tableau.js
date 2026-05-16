/**
 * MCA Logistics — Toggle densité tables (compact/étendu) avec persistance localStorage (Phase X — extraction script.js)
 *
 * Extracted from script.js L2055-2064 (2026-05-16).
 */

// var au lieu de let : evite les TDZ erratique observees dans Sentry (1 event,
// probable race condition navigateur sur let top-level + initDensiteTableau
// appelee en DOMContentLoaded). var est hoisté avec valeur undefined → safe.
var _tableauCompact = false;
function initDensiteTableau() {
  _tableauCompact = localStorage.getItem('tableau_compact') === '1';
  if (_tableauCompact) document.querySelectorAll('.data-table').forEach(t => t.classList.add('compact'));
  const btn = document.getElementById('btn-densite');
  if (btn) { btn.textContent = _tableauCompact ? '⊞ Étendu' : '⊟ Compact'; btn.classList.toggle('active', _tableauCompact); }
}

if (typeof window !== 'undefined') {
  window.initDensiteTableau = initDensiteTableau;
}
