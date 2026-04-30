/**
 * MCA Logistics — Module Core-edit-locks
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L757 (script.js d'origine)
function synchroniserVerrousEdition() {
  if (window.DelivProRemoteStorage && typeof window.DelivProRemoteStorage.flush === 'function') {
    window.DelivProRemoteStorage.flush().catch(function () {});
  }
}

// L763 (script.js d'origine)
async function actualiserVerrousEditionDistance() {
  if (window.DelivProRemoteStorage && typeof window.DelivProRemoteStorage.pullLatest === 'function') {
    try {
      await window.DelivProRemoteStorage.pullLatest();
    } catch (_) {}
  }
}

// L775 (script.js d'origine)
function surveillerConflitsEditionActifs() {
  const modals = [
    { id: 'modal-edit-salarie', type: 'salarie', entityId: editSalarieId || window._editSalarieId },
    { id: 'modal-edit-livraison', type: 'livraison', entityId: window._editLivId },
    { id: 'modal-edit-client', type: 'client', entityId: _editClientId },
    { id: 'modal-vehicule', type: 'vehicule', entityId: window._editVehId }
  ];

  modals.forEach(function(entry) {
    const modal = document.getElementById(entry.id);
    if (!modal?.classList.contains('open') || !entry.entityId) {
      afficherAlerteVerrouModal(entry.id, '');
      return;
    }
    const lockState = verifierVerrouEdition(entry.type, entry.entityId);
    if (!lockState.ok) {
      const lock = lockState.lock || {};
      const signature = `${entry.type}:${entry.entityId}:${lock.actorKey || ''}:${lock.createdAt || ''}`;
      const message = `Modification en cours par ${lock.actorLabel || 'un autre admin'}. Évite d'enregistrer cette fiche tant que le verrou n'est pas libéré.`;
      afficherAlerteVerrouModal(entry.id, message);
      if (signature !== derniereAlerteConflitEdition) {
        derniereAlerteConflitEdition = signature;
        afficherToast(`⚠️ ${lock.actorLabel || 'Un autre admin'} modifie déjà cette fiche`, 'error');
      }
      return;
    }
    afficherAlerteVerrouModal(entry.id, '');
  });
}

// L805 (script.js d'origine)
function prendreVerrouEdition(type, id, label) {
  if (!type || !id || sessionStorage.getItem('role') !== 'admin') return { ok: true };
  const locks = getAdminEditLocks();
  const lockKey = getAdminEditLockKey(type, id);
  const actorKey = getAdminActorKey();
  const existing = locks[lockKey];
  if (existing && existing.actorKey && existing.actorKey !== actorKey) {
    return { ok: false, lock: existing };
  }
  locks[lockKey] = {
    actorKey: actorKey,
    actorLabel: getAdminActorLabel(),
    type: type,
    id: id,
    label: label || '',
    createdAt: new Date().toISOString()
  };
  sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  adminHeldEditLocks.add(lockKey);
  synchroniserVerrousEdition();
  return { ok: true, lock: locks[lockKey] };
}

// L828 (script.js d'origine)
function verifierVerrouEdition(type, id) {
  if (!type || !id || sessionStorage.getItem('role') !== 'admin') return { ok: true };
  const locks = getAdminEditLocks();
  const lock = locks[getAdminEditLockKey(type, id)];
  const actorKey = getAdminActorKey();
  if (!lock || !lock.actorKey || lock.actorKey === actorKey) return { ok: true };
  return { ok: false, lock: lock };
}

// L837 (script.js d'origine)
function libererVerrouEdition(type, id) {
  if (!type || !id) return;
  const locks = getAdminEditLocks();
  const lockKey = getAdminEditLockKey(type, id);
  const lock = locks[lockKey];
  if (lock && lock.actorKey === getAdminActorKey()) {
    delete locks[lockKey];
    sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
    synchroniserVerrousEdition();
  }
  adminHeldEditLocks.delete(lockKey);
}

// L850 (script.js d'origine)
function libererTousVerrousEdition() {
  if (!adminHeldEditLocks.size) return;
  const locks = getAdminEditLocks();
  const actorKey = getAdminActorKey();
  adminHeldEditLocks.forEach(function(lockKey) {
    const lock = locks[lockKey];
    if (lock && lock.actorKey === actorKey) delete locks[lockKey];
  });
  adminHeldEditLocks.clear();
  sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  synchroniserVerrousEdition();
}

