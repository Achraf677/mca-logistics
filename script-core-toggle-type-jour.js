/**
 * MCA Logistics — toggleTypeJour — type jour planning (travail/congé/absence/maladie) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1713-1731 (2026-05-16).
 */

function toggleTypeJour(jour) {
  const sel = document.getElementById('plan-type-'+jour);
  const row = document.getElementById('plan-row-'+jour);
  if (!sel || !row) return;
  const type = sel.value;
  row.className = type === 'travail' ? '' : type === 'conge' ? 'jour-conge' : type === 'absence' ? 'jour-absence' : 'jour-maladie';
  // Afficher/masquer les champs horaires selon le type
  const horaires = document.getElementById('plan-horaires-'+jour);
  if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
  const cb = document.getElementById('plan-travaille-'+jour);
  if (cb) cb.checked = type === 'travail';
  mettreAJourTotalHeuresPlanning();
}

/* ===== CONNEXION TCO DANS LA PAGE VÉHICULES ===== */
// MOVED -> script-core-tco-ui.js (Phase X.D) : ouvrirTCO

/* ===== CONNEXION HISTOR. MODIFS DANS MODAL EDIT LIVRAISON ===== */
// MOVED -> script-livraisons.js : ouvrirEditLivraison

if (typeof window !== 'undefined') {
  window.toggleTypeJour = toggleTypeJour;
}
