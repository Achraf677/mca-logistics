/**
 * MCA Logistics — Validation SIRET (Luhn + exception La Poste 356000000XXXXX) (Phase X — extraction script.js)
 *
 * Extracted from script.js L35-52 (2026-05-16).
 */

function validerSIRET(siret) {
  const s = String(siret || '').replace(/\s+/g, '');
  if (!/^\d{14}$/.test(s)) return false;
  // Algorithme de Luhn : positions impaires (depuis la droite) ×1, paires ×2
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(s[13 - i], 10);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  // Exception La Poste : SIRET 356000000XXXXX accepté par DGFiP si somme chiffres = multiple de 5
  if (s.startsWith('356000000')) {
    let sumPoste = 0;
    for (const c of s) sumPoste += parseInt(c, 10);
    return sumPoste % 5 === 0;
  }
  return sum % 10 === 0;
}

if (typeof window !== 'undefined') {
  window.validerSIRET = validerSIRET;
}
