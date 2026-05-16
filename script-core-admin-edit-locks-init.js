/**
 * MCA Logistics — Admin edit locks constants + listeners (pagehide/beforeunload/storage cross-tab) (Phase X — extraction script.js)
 *
 * Extracted from script.js L212-256 (2026-05-16).
 */

const ADMIN_EDIT_LOCKS_KEY = 'admin_edit_locks';
const ADMIN_EDIT_LOCK_TTL_MS = 20 * 60 * 1000;
const adminHeldEditLocks = new Set();
let derniereAlerteConflitEdition = '';

// MOVED -> script-core-auth.js : getAdminActorKey

// MOVED -> script-core-auth.js : getAdminActorLabel

// MOVED -> script-core-auth.js : getAdminEditLocks

// MOVED -> script-core-auth.js : getAdminEditLockKey

// MOVED -> script-core-edit-locks.js : synchroniserVerrousEdition

// MOVED -> script-core-edit-locks.js : actualiserVerrousEditionDistance

// MOVED -> script-core-ui.js : getModalIdForLockType

// MOVED -> script-alertes.js : afficherAlerteVerrouModal

// MOVED -> script-core-edit-locks.js : surveillerConflitsEditionActifs

// MOVED -> script-core-edit-locks.js : prendreVerrouEdition

// MOVED -> script-core-edit-locks.js : verifierVerrouEdition

// MOVED -> script-core-edit-locks.js : libererVerrouEdition

// MOVED -> script-core-edit-locks.js : libererTousVerrousEdition

// MOVED -> script-core-ui.js : getEditLockContextForModal

window.addEventListener('pagehide', libererTousVerrousEdition);
window.addEventListener('beforeunload', libererTousVerrousEdition);
window.addEventListener('storage', function(event) {
  if (event.key === ADMIN_EDIT_LOCKS_KEY) {
    surveillerConflitsEditionActifs();
  }
});
window.addEventListener('delivpro:storage-sync', function(event) {
  if (event.detail?.key === ADMIN_EDIT_LOCKS_KEY) {
    surveillerConflitsEditionActifs();
  }
});

if (typeof window !== 'undefined') {
  window.ADMIN_EDIT_LOCKS_KEY = ADMIN_EDIT_LOCKS_KEY;
  window.ADMIN_EDIT_LOCK_TTL_MS = ADMIN_EDIT_LOCK_TTL_MS;
}
