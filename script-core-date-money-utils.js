/**
 * MCA Logistics — Utilities core : dateToLocalISO + aujourdhui + euros + round2 + hasNegativeNumber (Phase X — extraction script.js)
 *
 * Extracted from script.js L150-167 (2026-05-16).
 */

function dateToLocalISO(date)  {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function aujourdhui()          { return dateToLocalISO(new Date()); }
function euros(n)              { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(parseFloat(n||0)); }
function round2(n)             { return Math.round((parseFloat(n || 0) + Number.EPSILON) * 100) / 100; }
function hasNegativeNumber()   {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (typeof value === 'number' && Number.isFinite(value) && value < 0) return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.dateToLocalISO = dateToLocalISO;
  window.aujourdhui = aujourdhui;
  window.euros = euros;
  window.round2 = round2;
  window.hasNegativeNumber = hasNegativeNumber;
}
