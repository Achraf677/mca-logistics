/**
 * MCA Logistics — csvCelluleSecurisee — OWASP CSV injection guard (Phase X — extraction script.js)
 *
 * Extracted from script.js L1876-1888 (2026-05-16).
 */

/* ===== EXPORT CSV ===== */
// csvCelluleSecurisee — neutralise l'injection de formules Excel/LibreOffice (OWASP CSV Injection).
// Préfixe une apostrophe devant =, +, -, @, tab, CR : Excel n'exécute plus la formule, affiche le texte littéral.
// Puis échappe les guillemets et encadre si la cellule contient séparateur, guillemet ou saut de ligne.
function csvCelluleSecurisee(value, separator) {
  const sep = separator || ';';
  const raw = value == null ? '' : String(value);
  const neutralise = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  const needsQuote = neutralise.includes(sep) || neutralise.includes('"') || neutralise.includes('\n') || neutralise.includes('\r');
  const echappe = neutralise.replace(/"/g, '""');
  return needsQuote ? '"' + echappe + '"' : echappe;
}
window.csvCelluleSecurisee = csvCelluleSecurisee;

if (typeof window !== 'undefined') {
  window.csvCelluleSecurisee = csvCelluleSecurisee;
}
