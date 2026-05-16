/**
 * MCA Logistics — Vérification conformité conduite CE 561/2006 (max journalier 9h, hebdo 48h/56h) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1849-1881 (2026-05-16).
 */

function verifierConformiteConduiteCE561(semaine) {
  const warnings = [];
  if (!Array.isArray(semaine)) return { ok: true, warnings: warnings, totalHebdoMin: 0 };
  let totalHebdoMin = 0;
  let nbJoursSupA9h = 0;
  (semaine || []).forEach(function(j) {
    if (!j || !j.travaille || j.typeJour && j.typeJour !== 'travail') return;
    const hd = String(j.heureDebut || '').trim();
    const hf = String(j.heureFin || '').trim();
    if (!hd || !hf) return;
    const [h1, m1] = hd.split(':').map(function(x){ return parseInt(x, 10) || 0; });
    const [h2, m2] = hf.split(':').map(function(x){ return parseInt(x, 10) || 0; });
    let minJour = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (minJour < 0) minJour += 24 * 60;
    if (minJour > 9 * 60) {
      nbJoursSupA9h++;
      warnings.push('⚠️ ' + j.jour + ' : ' + (minJour / 60).toFixed(1) + 'h — dépasse le max journalier de 9h (CE 561/2006 art. 6.1)');
    }
    if (minJour > 10 * 60) {
      warnings.push('🛑 ' + j.jour + ' : ' + (minJour / 60).toFixed(1) + 'h — dépasse le plafond absolu 10h (même avec dérogation 2×/sem)');
    }
    totalHebdoMin += minJour;
  });
  if (nbJoursSupA9h > 2) {
    warnings.push('🛑 ' + nbJoursSupA9h + ' jours > 9h cette semaine — max 2 dérogations autorisées (CE 561/2006 art. 6.1)');
  }
  if (totalHebdoMin > 56 * 60) {
    warnings.push('Semaine : ' + (totalHebdoMin / 60).toFixed(1) + 'h — dépasse la limite 56h/sem (CE 561/2006 art. 6.2)');
  } else if (totalHebdoMin > 48 * 60) {
    warnings.push('⚠️ Semaine : ' + (totalHebdoMin / 60).toFixed(1) + 'h — au-delà de la moyenne 48h/sem recommandée (directive 2002/15/CE)');
  }
  return { ok: warnings.length === 0, warnings: warnings, totalHebdoMin: totalHebdoMin };
}

if (typeof window !== 'undefined') {
  window.verifierConformiteConduiteCE561 = verifierConformiteConduiteCE561;
}
