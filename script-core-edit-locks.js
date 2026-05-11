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

// ============================================================================
// EditLocks V2 — verrous d'edition stockes cote serveur (table edit_locks)
// PR #51 (Sprint H2 / 2026-05-09) — remplace progressivement les helpers
// localStorage ci-dessus pour les forms collaboratifs PC/mobile.
//
// API (toutes async, exposees via window.EditLocksV2) :
//   - acquireLock(table, rowId)   -> { success, owner?, expires_at?, lock? }
//   - releaseLock(table, rowId)   -> ignore les erreurs
//   - refreshLock(table, rowId)   -> { success } (a appeler toutes les 60s)
//   - pollLockStatus(table, rowId)-> { locked, owner?, expires_in_s? }
//   - forceUnlock(table, rowId)   -> admin only, DELETE direct
//   - openEditWithLock(table, rowId, openFn) -> wrapper UX complet
// ============================================================================
(function () {
  if (typeof window === 'undefined') return;

  const LOCK_DURATION_S = 5 * 60;       // 5 min defaut (cf migration 042)
  const REFRESH_INTERVAL_MS = 60 * 1000; // refresh toutes les 60s pendant edit

  function _sb() {
    if (window.DelivProSupabase && typeof window.DelivProSupabase.getClient === 'function') {
      return window.DelivProSupabase.getClient();
    }
    return null;
  }

  function _currentUserName() {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_nom'))
      || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_login'))
      || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('salarie_nom'))
      || 'Utilisateur';
  }

  // #101 audit Chrome : tab_id pour distinguer les onglets du meme user.
  // sessionStorage est par tab (vs localStorage qui est partage). On genere un
  // ID unique au boot du tab et on le compare dans acquireLock pour declencher
  // un conflit meme entre 2 tabs du meme user (anti-ecrasement multi-onglet).
  function _currentTabId() {
    if (typeof sessionStorage === 'undefined') return 'no-tab';
    var t = sessionStorage.getItem('mca_edit_lock_tab_id');
    if (!t) {
      t = 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      try { sessionStorage.setItem('mca_edit_lock_tab_id', t); } catch (_) {}
    }
    return t;
  }

  async function _currentUserId() {
    const sb = _sb();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getUser();
      return data && data.user ? data.user.id : null;
    } catch (_) { return null; }
  }

  function _isAdmin() {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('role') === 'admin';
  }

  // Tente UPSERT en s'assurant que le lock existant est : (a) expire, ou
  // (b) detenu par moi-meme (re-acquisition / refresh). Sinon retourne le
  // current owner pour affichage modale conflit.
  async function acquireLock(tableName, rowId) {
    const sb = _sb();
    if (!sb) return { success: true, fallback: 'no_supabase' };
    if (!tableName || rowId == null) return { success: false, reason: 'invalid_args' };
    const userId = await _currentUserId();
    if (!userId) return { success: true, fallback: 'no_session' };
    const userName = _currentUserName();
    const tabId = _currentTabId();
    const rid = String(rowId);

    // 1. Lire le lock courant (si existe)
    const { data: existing } = await sb.from('edit_locks')
      .select('user_id,user_name,expires_at,acquired_at')
      .eq('table_name', tableName).eq('row_id', rid)
      .maybeSingle();

    const now = Date.now();
    if (existing) {
      const expiresMs = new Date(existing.expires_at).getTime();
      const isMine = existing.user_id === userId;
      const isExpired = expiresMs < now;
      // #101 audit Chrome : meme user dans un autre tab = conflit aussi.
      // On utilise acquired_at comme proxy pour comparer les tabs (le tab actuel
      // a un sessionStorage.tab_id different de celui qui detient le lock).
      // Heuristique : si meme user mais lock pris il y a > 5s, c'est probablement
      // un autre tab encore actif.
      const localTabAcquired = sessionStorage.getItem('mca_edit_lock_' + tableName + '_' + rid);
      const isMyTab = isMine && localTabAcquired === existing.acquired_at;
      if (!isMyTab && !isExpired) {
        return {
          success: false,
          owner: existing.user_name + (isMine ? ' (autre onglet)' : ''),
          owner_user_id: existing.user_id,
          expires_at: existing.expires_at,
          expires_in_s: Math.max(0, Math.round((expiresMs - now) / 1000)),
          same_user: isMine
        };
      }
    }

    // 2. UPSERT (insert ou take-over) — le PRIMARY KEY (table_name, row_id) garantit unicite
    const expiresAt = new Date(now + LOCK_DURATION_S * 1000).toISOString();
    const acquiredAt = new Date(now).toISOString();
    try { sessionStorage.setItem('mca_edit_lock_' + tableName + '_' + rid, acquiredAt); } catch (_) {}
    const { data, error } = await sb.from('edit_locks')
      .upsert({
        table_name: tableName, row_id: rid,
        user_id: userId, user_name: userName,
        acquired_at: acquiredAt, expires_at: expiresAt
      }, { onConflict: 'table_name,row_id' })
      .select().maybeSingle();

    if (error) {
      console.warn('[edit-locks] acquireLock', error);
      return { success: true, fallback: 'db_error', error: String(error.message || error) };
    }
    return { success: true, lock: data };
  }

  async function releaseLock(tableName, rowId) {
    const sb = _sb();
    if (!sb || !tableName || rowId == null) return { success: true };
    const userId = await _currentUserId();
    if (!userId) return { success: true };
    try {
      await sb.from('edit_locks')
        .delete()
        .eq('table_name', tableName).eq('row_id', String(rowId))
        .eq('user_id', userId);
    } catch (e) { console.warn('[edit-locks] releaseLock', e); }
    return { success: true };
  }

  async function refreshLock(tableName, rowId) {
    const sb = _sb();
    if (!sb || !tableName || rowId == null) return { success: false };
    const userId = await _currentUserId();
    if (!userId) return { success: false };
    const expiresAt = new Date(Date.now() + LOCK_DURATION_S * 1000).toISOString();
    try {
      const { error } = await sb.from('edit_locks')
        .update({ expires_at: expiresAt })
        .eq('table_name', tableName).eq('row_id', String(rowId))
        .eq('user_id', userId);
      if (error) return { success: false, error: String(error.message || error) };
    } catch (e) { return { success: false, error: String(e) }; }
    return { success: true };
  }

  async function pollLockStatus(tableName, rowId) {
    const sb = _sb();
    if (!sb || !tableName || rowId == null) return { locked: false };
    try {
      const { data } = await sb.from('edit_locks')
        .select('user_id,user_name,expires_at')
        .eq('table_name', tableName).eq('row_id', String(rowId))
        .maybeSingle();
      if (!data) return { locked: false };
      const expiresMs = new Date(data.expires_at).getTime();
      const now = Date.now();
      if (expiresMs < now) return { locked: false, expired: true };
      const myId = await _currentUserId();
      return {
        locked: true,
        owner: data.user_name || 'Inconnu',
        owner_user_id: data.user_id,
        is_mine: data.user_id === myId,
        expires_at: data.expires_at,
        expires_in_s: Math.max(0, Math.round((expiresMs - now) / 1000))
      };
    } catch (e) {
      console.warn('[edit-locks] pollLockStatus', e);
      return { locked: false, error: String(e) };
    }
  }

  // Force unlock : admin only — DELETE inconditionnel
  async function forceUnlock(tableName, rowId) {
    if (!_isAdmin()) return { success: false, reason: 'not_admin' };
    const sb = _sb();
    if (!sb || !tableName || rowId == null) return { success: false, reason: 'invalid_args' };
    try {
      const { error } = await sb.from('edit_locks')
        .delete()
        .eq('table_name', tableName).eq('row_id', String(rowId));
      if (error) return { success: false, error: String(error.message || error) };
    } catch (e) { return { success: false, error: String(e) }; }
    return { success: true };
  }

  // Helper UX : ouvre une modale de conflit "X est en train de modifier"
  // avec un bouton "Forcer le deverrouillage" admin-only. Retourne :
  //   - 'forced'    si user a clique "Forcer"
  //   - 'cancelled' si user annule
  function _showConflictModal(tableName, rowId, ownerName, expiresInS) {
    return new Promise(function (resolve) {
      const old = document.getElementById('mca-edit-lock-conflict');
      if (old) old.remove();
      const overlay = document.createElement('div');
      overlay.id = 'mca-edit-lock-conflict';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,sans-serif';
      const minutes = Math.max(1, Math.ceil(expiresInS / 60));
      overlay.innerHTML = ''
        + '<div style="background:var(--m-card,#fff);color:var(--m-text,#1a1a1a);border-radius:14px;max-width:380px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
        + '  <div style="font-size:1.6rem;margin-bottom:8px">🔒</div>'
        + '  <div style="font-weight:700;font-size:1.05rem;margin-bottom:6px">Fiche verrouillée</div>'
        + '  <div style="font-size:.9rem;line-height:1.5;margin-bottom:18px">'
        + '    <strong>' + escHtml(ownerName) + '</strong> est en train de modifier cette ligne.'
        + '    <br>Réessayez dans ' + minutes + ' min.'
        + '  </div>'
        + '  <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">'
        + (_isAdmin() ? '    <button type="button" data-action="force" style="background:#e63946;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer">Forcer le déverrouillage</button>' : '')
        + '    <button type="button" data-action="cancel" style="background:transparent;border:1px solid currentColor;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:600">Fermer</button>'
        + '  </div>'
        + '</div>';
      function close(result) {
        try { overlay.remove(); } catch (_) {}
        resolve(result);
      }
      overlay.addEventListener('click', function (e) {
        const a = e.target && e.target.getAttribute && e.target.getAttribute('data-action');
        if (a === 'force') {
          forceUnlock(tableName, rowId).then(function (r) {
            if (r && r.success) close('forced');
            else { alert('Impossible de forcer : ' + (r && r.error || 'erreur inconnue')); close('cancelled'); }
          });
        } else if (a === 'cancel' || e.target === overlay) {
          close('cancelled');
        }
      });
      document.body.appendChild(overlay);
    });
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // Wrapper UX complet : tente acquireLock, si conflit affiche modale,
  // si OK appelle openFn() puis configure refresh interval + auto-release
  // a la fermeture du modal. openFn doit retourner une fonction de close
  // hook ou un { onClose } object — sinon utilise un MutationObserver naif.
  //
  // Usage : EditLocksV2.openEditWithLock('livraisons', livId, () => openModal());
  async function openEditWithLock(tableName, rowId, openFn) {
    const r = await acquireLock(tableName, rowId);
    if (!r.success) {
      const action = await _showConflictModal(tableName, rowId, r.owner || 'un autre utilisateur', r.expires_in_s || 60);
      if (action === 'forced') {
        // retry after force unlock
        const r2 = await acquireLock(tableName, rowId);
        if (!r2.success) return { opened: false, reason: 'still_locked' };
      } else {
        return { opened: false, reason: 'conflict' };
      }
    }
    // Refresh interval
    const intervalId = setInterval(function () {
      refreshLock(tableName, rowId).catch(function () {});
    }, REFRESH_INTERVAL_MS);
    // Appel openFn (peut etre sync ou async)
    let openResult;
    try { openResult = await Promise.resolve(openFn()); }
    catch (e) {
      clearInterval(intervalId);
      releaseLock(tableName, rowId).catch(function () {});
      throw e;
    }
    // Hook close : si openFn retourne { onClose: cb }, on cable
    const cleanup = function () {
      clearInterval(intervalId);
      releaseLock(tableName, rowId).catch(function () {});
    };
    if (openResult && typeof openResult === 'object' && typeof openResult.onClose === 'function') {
      openResult.onClose(cleanup);
    } else {
      // Fallback : tracker global pour appel manuel via EditLocksV2.releaseLock()
      window.__editLocksV2Cleanup = window.__editLocksV2Cleanup || {};
      window.__editLocksV2Cleanup[tableName + ':' + rowId] = cleanup;
    }
    return { opened: true, cleanup: cleanup };
  }

  // Helper : appel manuel en fin de modal (cf openEditWithLock fallback)
  function manualCleanup(tableName, rowId) {
    const key = tableName + ':' + String(rowId);
    const cb = window.__editLocksV2Cleanup && window.__editLocksV2Cleanup[key];
    if (cb) {
      try { cb(); } catch (_) {}
      delete window.__editLocksV2Cleanup[key];
    } else {
      // Pas de cleanup tracke -> juste release
      releaseLock(tableName, rowId).catch(function () {});
    }
  }

  // Badge HTML pour la liste — appele par les renderers de tables/cards
  // Usage : await EditLocksV2.renderBadge('livraisons', livId) -> '<span ...>Achraf</span>' ou ''
  async function renderBadge(tableName, rowId) {
    const status = await pollLockStatus(tableName, rowId);
    if (!status.locked || status.is_mine) return '';
    return '<span class="mca-edit-lock-badge" title="Édition en cours" '
      + 'style="display:inline-block;background:#e63946;color:#fff;border-radius:10px;padding:2px 8px;font-size:.7rem;font-weight:600;margin-left:6px;vertical-align:middle">'
      + '🔒 ' + escHtml(status.owner) + '</span>';
  }

  window.EditLocksV2 = {
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    refreshLock: refreshLock,
    pollLockStatus: pollLockStatus,
    forceUnlock: forceUnlock,
    openEditWithLock: openEditWithLock,
    manualCleanup: manualCleanup,
    renderBadge: renderBadge,
    LOCK_DURATION_S: LOCK_DURATION_S,
    REFRESH_INTERVAL_MS: REFRESH_INTERVAL_MS
  };

  // Auto-cleanup a la fermeture / deconnexion : libere tous les locks tracked
  window.addEventListener('beforeunload', function () {
    if (!window.__editLocksV2Cleanup) return;
    Object.keys(window.__editLocksV2Cleanup).forEach(function (k) {
      try { window.__editLocksV2Cleanup[k](); } catch (_) {}
    });
  });

  // Export Node (tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      LOCK_DURATION_S: LOCK_DURATION_S,
      REFRESH_INTERVAL_MS: REFRESH_INTERVAL_MS,
      // Pour tests : expose aussi la logique d'expiration pure
      isExpired: function (expiresAt, nowMs) {
        return new Date(expiresAt).getTime() < (nowMs || Date.now());
      },
      shouldAcquire: function (existing, currentUserId, nowMs) {
        if (!existing) return { acquire: true, reason: 'no_existing' };
        const expiresMs = new Date(existing.expires_at).getTime();
        const isMine = existing.user_id === currentUserId;
        const isExpired = expiresMs < (nowMs || Date.now());
        if (isMine) return { acquire: true, reason: 'same_user' };
        if (isExpired) return { acquire: true, reason: 'expired' };
        return { acquire: false, reason: 'conflict', owner: existing.user_name };
      }
    };
  }
})();
