/**
 * MCA Logistics — Changer statut paiement livraison + audit log (Phase X — extraction script.js)
 *
 * Extracted from script.js L1066-1075 (2026-05-16).
 */

function changerStatutPaiement(id, statut) {
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(l => l.id === id);
  if (idx > -1) {
    livraisons[idx].statutPaiement = statut;
    sauvegarder('livraisons', livraisons);
    ajouterEntreeAudit('Paiement livraison', (livraisons[idx].numLiv || 'Livraison') + ' · statut ' + statut);
    afficherToast('Paiement mis à jour');
  }
}

if (typeof window !== 'undefined') {
  window.changerStatutPaiement = changerStatutPaiement;
}
