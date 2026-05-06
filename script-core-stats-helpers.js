/**
 * MCA Logistics — Helpers Stats (boot)
 *
 * Helpers extraits de script-stats.js pour rester chargés au boot, car
 * utilisés depuis d'autres modules (notamment script-salaries.js → fiche
 * salarié). Le reste de script-stats.js (afficherStatistiques, exporter,
 * navigation, etc.) est lazy-loadé via lazy-stubs.js (Sprint C bundle
 * splitting, 2026-05-06).
 *
 * À charger AU BOOT dans admin.html, AVANT script-salaries.js.
 */

// Stats mensuelles d'un salarié (livraisons, CA, heures réelles ou planifiées).
// Utilisé par : script-salaries.js (carte fiche salarié), script-stats.js
// (vue d'ensemble), script-mobile.js (mobile éventuellement).
function getSalarieStatsMois(salId) {
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var debut = (typeof planningDateToLocalISO === 'function')
    ? planningDateToLocalISO(monthStart)
    : monthStart.toISOString().slice(0, 10);
  var fin = (typeof planningDateToLocalISO === 'function')
    ? planningDateToLocalISO(monthEnd)
    : monthEnd.toISOString().slice(0, 10);
  var livraisons = charger('livraisons').filter(function(item) {
    return item.chaufId === salId && item.date >= debut && item.date <= fin;
  });
  var heuresPlanifiees = 0;
  try {
    if (typeof construireContexteHeures === 'function' && typeof calculerHeuresSalarieSemaine === 'function') {
      var contexte = construireContexteHeures({ mode: 'mois', debut: debut, fin: fin, label: '', datesLabel: '' });
      heuresPlanifiees = calculerHeuresSalarieSemaine(salId, contexte).planifiees || 0;
    }
  } catch (_) { /* fallback silencieux */ }
  // Cumul heures réelles saisies via mobile (collection 'heures' partagée).
  // Si saisies présentes -> on les utilise (priorité réel). Sinon planning.
  var heuresReelles = 0;
  try {
    heuresReelles = charger('heures')
      .filter(function(h) { return (h.salId === salId || h.salarieId === salId) && h.date >= debut && h.date <= fin; })
      .reduce(function(sum, h) { return sum + (parseFloat(String(h.heures||'').replace(',', '.')) || 0); }, 0);
  } catch (_) { /* fallback silencieux */ }
  return {
    livraisons: livraisons.length,
    ca: livraisons.reduce(function(sum, item) { return sum + (parseFloat(item.prix || item.prixTTC) || 0); }, 0),
    heures: heuresReelles > 0 ? heuresReelles : heuresPlanifiees,
    heuresReelles: heuresReelles,
    heuresPlanifiees: heuresPlanifiees
  };
}
