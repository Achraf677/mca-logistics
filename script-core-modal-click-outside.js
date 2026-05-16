/**
 * MCA Logistics — Modal close on click outside (sauf data-persist=true) (Phase X — extraction script.js)
 *
 * Extracted from script.js L330-336 (2026-05-16).
 */

// Phase 91.18 — click hors modal ferme la modale, SAUF pour celles marquées data-persist="true"
// (modal-livraison, modal-edit-livraison : user doit cliquer ✕/Annuler/Brouillon/Enregistrer).
document.addEventListener('click', e => {
  if (!e.target.classList.contains('modal-overlay')) return;
  if (e.target.dataset && e.target.dataset.persist === 'true') return;
  closeModal(e.target.id);
});
