/**
 * MCA Logistics — logMCA wrapper console.log conditionnel (mca_debug flag) (Phase X — extraction script.js)
 *
 * Extracted from script.js L53-57 (2026-05-16).
 */

// logMCA — wrapper console.log conditionnel. Désactivé en prod (BUG-034).
// Activer via : localStorage.setItem('mca_debug', '1') puis recharger.
window.__MCA_DEBUG = window.__MCA_DEBUG || (function(){ try { return localStorage.getItem('mca_debug') === '1'; } catch(e){ return false; } })();
function logMCA() { if (window.__MCA_DEBUG && typeof console !== 'undefined' && console.log) console.log.apply(console, arguments); }
window.logMCA = logMCA;

if (typeof window !== 'undefined') {
  window.logMCA = logMCA;
}
