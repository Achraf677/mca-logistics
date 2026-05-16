/**
 * MCA Logistics — prixHT — conversion TTC → HT depuis taux TVA (Phase X — extraction script.js)
 *
 * Extracted from script.js L2015-2017 (2026-05-16).
 */

function prixHT(prixTTC, tauxTVA) {
  return prixTTC / (1 + tauxTVA / 100);
}

if (typeof window !== 'undefined') {
  window.prixHT = prixHT;
}
