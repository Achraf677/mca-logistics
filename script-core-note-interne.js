/**
 * MCA Logistics — Ouvrir modal note interne salarié (Phase X — extraction script.js)
 *
 * Extracted from script.js L2348-2353 (2026-05-16).
 */

function ouvrirNoteInterne(salId, salNom) {
  document.getElementById('note-interne-sal-id').value  = salId;
  document.getElementById('note-interne-sal-nom').textContent = salNom;
  document.getElementById('note-interne-texte').value   = chargerNoteInterne(salId);
  openModal('modal-note-interne');
}

if (typeof window !== 'undefined') {
  window.ouvrirNoteInterne = ouvrirNoteInterne;
}
