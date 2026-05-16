/**
 * MCA Logistics — getHeuresSemaineRange (lundi-dimanche, semaine ISO) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1921-1933 (2026-05-16).
 */

function getHeuresSemaineRange() {
  const lundi = getLundiDeSemaine(_heuresSemaineOffset || 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return {
    lundi,
    dimanche,
    debut: dateToLocalISO(lundi),
    fin: dateToLocalISO(dimanche),
    label: `Semaine ${getNumSemaine(lundi)}`,
    datesLabel: `${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  };
}

if (typeof window !== 'undefined') {
  window.getHeuresSemaineRange = getHeuresSemaineRange;
}
