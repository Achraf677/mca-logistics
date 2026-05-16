/**
 * MCA Logistics — Badge HTML statut livraison (en-attente/cours/livre) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1639-1645 (2026-05-16).
 */

function badgeStatut(s) {
  return {
    'en-attente': '<span class="badge badge-attente">⏳ En attente</span>',
    'en-cours':   '<span class="badge badge-cours">En cours</span>',
    'livre':      '<span class="badge badge-livre">✅ Livré</span>'
  }[s] || s;
}

if (typeof window !== 'undefined') {
  window.badgeStatut = badgeStatut;
}
