/**
 * MCA Logistics — normaliserDateISO — parse robuste de date ISO (Phase X — extraction script.js)
 *
 * Extracted from script.js L322-327 (2026-05-16).
 */

function normaliserDateISO(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  var d = new Date(val);
  return Number.isNaN(d.getTime()) ? '' : dateToLocalISO(d);
}

if (typeof window !== 'undefined') {
  window.normaliserDateISO = normaliserDateISO;
}
