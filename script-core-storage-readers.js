/**
 * MCA Logistics — dupliquerValeurStockage + lireStockageJSON — readers localStorage avec cache (Phase X — extraction script.js)
 *
 * Extracted from script.js L51-86 (2026-05-16).
 */

function dupliquerValeurStockage(valeur) {
  if (valeur === null || valeur === undefined) return valeur;
  if (typeof valeur !== 'object') return valeur;
  // PERF: JSON.parse(JSON.stringify) est ~3x plus rapide que structuredClone
  // pour des données JSON pures (localStorage = toujours JSON-safe).
  return JSON.parse(JSON.stringify(valeur));
}

function lireStockageJSON(cle, fallback) {
  const raw = localStorage.getItem(cle);
  const cached = STORAGE_CACHE.get(cle);

  // PERF: cache hit → JSON.parse direct sur le raw string mis en cache
  // (saute l'étape JSON.stringify du deep-clone). ~2x plus rapide que l'ancien
  // dupliquerValeurStockage(cached.value) qui faisait stringify→parse.
  if (cached && cached.raw === raw) {
    if (raw === null) return dupliquerValeurStockage(cached.value);
    try { return JSON.parse(raw); } catch (_) { return dupliquerValeurStockage(cached.value); }
  }

  if (raw === null) {
    STORAGE_CACHE.set(cle, { raw: null, value: fallback });
    return dupliquerValeurStockage(fallback);
  }

  try {
    const parsed = JSON.parse(raw);
    STORAGE_CACHE.set(cle, { raw, value: parsed });
    // 1ère lecture : retourne un nouveau parse (copie fraîche pour mutations sûres)
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[DelivPro] Donnée locale invalide pour "${cle}", fallback utilisé.`, error);
    STORAGE_CACHE.set(cle, { raw, value: fallback });
    return dupliquerValeurStockage(fallback);
  }
}

if (typeof window !== 'undefined') {
  window.dupliquerValeurStockage = dupliquerValeurStockage;
  window.lireStockageJSON = lireStockageJSON;
}
