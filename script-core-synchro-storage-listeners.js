/**
 * MCA Logistics — Synchro storage listeners (storage + delivpro:storage-sync → STORAGE_CACHE clear + change handler) (Phase X — extraction script.js)
 *
 * Extracted from script.js L379-391 (2026-05-16).
 */

/* ===== SYNCHRO STORAGE (salarié → admin en temps réel) ===== */
window.addEventListener('storage', function(e) {
  if (e.key) STORAGE_CACHE.delete(e.key);
  else STORAGE_CACHE.clear();
  gererChangementStorageAdmin(e.key);
});

window.addEventListener('delivpro:storage-sync', function(e) {
  var key = e && e.detail ? e.detail.key : '';
  if (key) STORAGE_CACHE.delete(key);
  else STORAGE_CACHE.clear();
  gererChangementStorageAdmin(key);
});
