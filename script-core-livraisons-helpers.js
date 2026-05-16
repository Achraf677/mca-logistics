/**
 * MCA Logistics — Livraisons helpers (Phase X.G — extraction script.js)
 *
 * Helpers opérationnels liés au cycle de vie d'une livraison :
 * - enregistrerConduite(livraison) : append historique conducteur côté véhicule
 * - marquerPaye(id) : passe statutPaiement='payé' + datePaiement=aujourd'hui + audit
 * - getAnneeFactureReference(livraison) : extrait l'année du datePaiement/date
 * - incrementerCompteurFactureAnnee(annee) : compteur persistant CGI art. 289
 *
 * Dependencies (globals) : loadSafe, charger, sauvegarder, aujourdhui,
 * ajouterEntreeAudit, afficherRelances, afficherTva, rafraichirDashboard,
 * afficherToast, euros, window.MCA (logging), window.Sentry (capture).
 *
 * Extracted from script.js L2882-2896 + L3436-3449 + L3504-3536 (Phase X.G).
 */

/* ===== FLOTTE — Historique conducteur (append-only, capped 100) ===== */
function enregistrerConduite(livraison) {
  if (!livraison.vehId || !livraison.chaufId) return;
  const cle = 'conducteurs_veh_' + livraison.vehId;
  const hist = loadSafe(cle, []);
  hist.push({
    salId:    livraison.chaufId,
    salNom:   livraison.chaufNom,
    date:     livraison.date,
    livNom:   livraison.client,
    numLiv:   livraison.numLiv || '',
    distance: livraison.distance || 0
  });
  if (hist.length > 100) hist.shift();
  localStorage.setItem(cle, JSON.stringify(hist));
}

/* ===== PAIEMENT — marquer une livraison comme payée ===== */
function marquerPaye(id) {
  const livs = charger('livraisons');
  const idx = livs.findIndex(l => l.id === id);
  if (idx > -1) {
    livs[idx].statutPaiement = 'payé';
    livs[idx].datePaiement = aujourdhui();
    sauvegarder('livraisons', livs);
    ajouterEntreeAudit('Paiement livraison', (livs[idx].numLiv || 'Livraison') + ' · ' + euros(livs[idx].prix || 0));
    if (typeof afficherRelances === 'function') afficherRelances();
    if (typeof afficherTva === 'function') afficherTva();
    if (typeof rafraichirDashboard === 'function') rafraichirDashboard();
    afficherToast('Marqué comme payé');
  }
}

/* ===== COMPTEUR FACTURE PAR ANNÉE — CGI art. 289 (séquence non régressive) ===== */
function getAnneeFactureReference(livraison) {
  const source = livraison?.datePaiement || livraison?.date || aujourdhui();
  const match = String(source || '').match(/^(\d{4})/);
  return match ? match[1] : String(new Date().getFullYear());
}

const COMPTEURS_FACTURES_KEY = 'compteurs_factures_annee';

function incrementerCompteurFactureAnnee(annee) {
  const key = String(annee || new Date().getFullYear());
  let compteurs = {};
  try { compteurs = loadSafe(COMPTEURS_FACTURES_KEY, {}) || {}; } catch (e) { compteurs = {}; }
  // Synchro de sécurité : si tableau factures contient un numéro plus grand (migration), on part de là
  try {
    const maxLive = (loadSafe('factures_emises', []) || [])
      .filter(f => String(f.annee || '') === key)
      .reduce((m, f) => Math.max(m, parseInt(f.sequence, 10) || 0), 0);
    if (maxLive > (compteurs[key] || 0)) compteurs[key] = maxLive;
  } catch (e) {
    if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
      console.warn('[script:incrementerCompteurFacture-syncMax]', e);
    }
    if (window.Sentry && window.Sentry.captureException) {
      try { window.Sentry.captureException(e); } catch (_) {}
    }
  }
  compteurs[key] = (compteurs[key] || 0) + 1;
  localStorage.setItem(COMPTEURS_FACTURES_KEY, JSON.stringify(compteurs));
  return compteurs[key];
}

if (typeof window !== 'undefined') {
  window.enregistrerConduite = enregistrerConduite;
  window.marquerPaye = marquerPaye;
  window.getAnneeFactureReference = getAnneeFactureReference;
  window.incrementerCompteurFactureAnnee = incrementerCompteurFactureAnnee;
  window.COMPTEURS_FACTURES_KEY = COMPTEURS_FACTURES_KEY;
}
