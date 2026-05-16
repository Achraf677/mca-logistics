/**
 * MCA Logistics — STORAGE_CACHE + emettreEvenementStockageLocal + Storage.prototype patches (setItem/removeItem/clear) (Phase X — extraction script.js)
 *
 * Extracted from script.js L49-90 (2026-05-16).
 */

const STORAGE_CACHE = new Map();
let lastStorageWarningAt = 0;

function emettreEvenementStockageLocal(cle, oldValue, newValue) {
  window.dispatchEvent(new CustomEvent('delivpro:storage-sync', {
    detail: {
      key: cle || '',
      oldValue: oldValue == null ? null : String(oldValue),
      newValue: newValue == null ? null : String(newValue)
    }
  }));
}

if (!window.__delivproStoragePatched) {
  window.__delivproStoragePatched = true;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;

  Storage.prototype.setItem = function(cle, valeur) {
    const ancienneValeur = this === window.localStorage ? this.getItem(cle) : null;
    STORAGE_CACHE.delete(String(cle));
    const resultat = nativeSetItem.call(this, cle, valeur);
    if (this === window.localStorage) emettreEvenementStockageLocal(String(cle), ancienneValeur, valeur);
    return resultat;
  };

  Storage.prototype.removeItem = function(cle) {
    const ancienneValeur = this === window.localStorage ? this.getItem(cle) : null;
    STORAGE_CACHE.delete(String(cle));
    const resultat = nativeRemoveItem.call(this, cle);
    if (this === window.localStorage) emettreEvenementStockageLocal(String(cle), ancienneValeur, null);
    return resultat;
  };

  Storage.prototype.clear = function() {
    STORAGE_CACHE.clear();
    const resultat = nativeClear.call(this);
    if (this === window.localStorage) emettreEvenementStockageLocal('', null, null);
    return resultat;
  };
}

if (typeof window !== 'undefined') {
  window.emettreEvenementStockageLocal = emettreEvenementStockageLocal;
  window.STORAGE_CACHE = STORAGE_CACHE;
}
