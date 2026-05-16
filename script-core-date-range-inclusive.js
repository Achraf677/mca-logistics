/**
 * MCA Logistics — getDateRangeInclusive — itère sur dates entre deux ISO (Phase X — extraction script.js)
 *
 * Extracted from script.js L394-404 (2026-05-16).
 */

function getDateRangeInclusive(debut, fin) {
  const dates = [];
  if (!debut || !fin) return dates;
  const current = new Date(debut + 'T00:00:00');
  const end = new Date(fin + 'T00:00:00');
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

if (typeof window !== 'undefined') {
  window.getDateRangeInclusive = getDateRangeInclusive;
}
