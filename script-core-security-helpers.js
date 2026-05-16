/**
 * MCA Logistics — Security helpers (helper + PWD evaluate/hash/verify + btoa unicode-safe) (Phase X — extraction script.js)
 *
 * Extracted from script.js L400-437 (2026-05-16).
 */

function getSecurityHelper() {
  return window.DelivProSecurity || null;
}
// MOVED -> script-core-auth.js : getSessionTimeoutMinutesAdmin
function evaluerQualiteMotDePasseFort(value) {
  const security = getSecurityHelper();
  if (security && typeof security.evaluatePassword === 'function') {
    return security.evaluatePassword(value, { minLength: 8 });
  }
  const motDePasse = String(value || '');
  if (!motDePasse) return { ok: false, message: 'Utilisez au moins 8 caractères avec majuscule, minuscule et chiffre.', color: 'var(--text-muted)' };
  if (motDePasse.length >= 8) return { ok: true, message: 'Mot de passe conforme.', color: 'var(--green)' };
  return { ok: false, message: 'Utilisez au moins 8 caractères.', color: 'var(--red)' };
}
// BUG-021 fix : fallback btoa casse sur Unicode (emoji, accents). UTF-8 encode avant btoa.
function btoaUnicodeSafe(str) {
  try {
    return btoa(unescape(encodeURIComponent(String(str || ''))));
  } catch (e) {
    try { return btoa(String(str || '')); } catch (_) { return ''; }
  }
}
async function hasherMotDePasseLocal(value) {
  const security = getSecurityHelper();
  if (security && typeof security.hashPassword === 'function') {
    return security.hashPassword(value);
  }
  return btoaUnicodeSafe(value);
}
async function verifierMotDePasseLocal(value, storedValue) {
  const security = getSecurityHelper();
  if (security && typeof security.verifyPassword === 'function') {
    return security.verifyPassword(value, storedValue);
  }
  const stored = String(storedValue || '');
  const plain = String(value || '');
  return stored === plain || stored === btoaUnicodeSafe(plain);
}

if (typeof window !== 'undefined') {
  window.getSecurityHelper = getSecurityHelper;
  window.evaluerQualiteMotDePasseFort = evaluerQualiteMotDePasseFort;
  window.btoaUnicodeSafe = btoaUnicodeSafe;
  window.hasherMotDePasseLocal = hasherMotDePasseLocal;
  window.verifierMotDePasseLocal = verifierMotDePasseLocal;
}
