/**
 * MCA Logistics — Raccourcis clavier admin (Ctrl+N = livraison, Escape = close modals) (Phase X — extraction script.js)
 *
 * Extracted from script.js L935-944 (2026-05-16).
 */

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    // Ctrl+K est géré par la palette S15 (plus riche) — ne pas doubler
    if (e.key === 'n') { e.preventDefault(); openModal('modal-livraison'); }
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});
