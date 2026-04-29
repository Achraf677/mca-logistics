(function () {
  var STORAGE_SCOPE = 'global';
  var FLUSH_DELAY_MS = 500;
  var FAST_FLUSH_DELAY_MS = 200;
  var POLL_INTERVAL_MS = 300000;
  var RETRY_DELAY_MS = 600;
  var suppressLocalSync = false;
  var pendingChanges = {};
  var pendingRemovals = {};
  var flushTimer = null;
  var scheduledFlushDelay = null;
  var pollTimer = null;
  var initialized = false;
  var bootstrapPromise = null;
  var realtimeChannel = null;
  var lastRemoteUpdatedAt = '';
  var lastRemoteUpdatedBy = '';
  var lastErrorMessage = '';
  var currentUserId = '';

  var originalSetItem = Storage.prototype.setItem;
  var originalRemoveItem = Storage.prototype.removeItem;
  var originalClear = Storage.prototype.clear;

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  function isEligibleKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key.indexOf('sb-') === 0) return false;
    if (key.indexOf('supabase.') === 0) return false;
    if (key === 'admin_accounts') return false;
    if (key === 'mdp_admin') return false;
    if (key === 'theme') return false;
    if (key === 'accent_color') return false;
    if (key === 'logo_entreprise') return false;
    if (key === 'rentabilite_calculateur_v2') return false;
    if (key === 'delivpro_inspection_storage_cleanup_at') return false;
    if (key === 'backup_admin_last_export') return false;
    if (key === 's29_section_active') return false;
    if (key.indexOf('login_attempts_') === 0) return false;
    if (key.indexOf('msg_auto_') === 0) return false;
    return true;
  }

  function isPriorityKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (
      key === 'livraisons' ||
      key === 'salaries' ||
      key === 'vehicules' ||
      key === 'clients' ||
      key === 'carburant' ||
      key === 'plannings' ||
      key === 'absences_periodes' ||
      key === 'charges' ||
      key === 'entretiens' ||
      key === 'admin_edit_locks'
    ) return true;
    if (key.indexOf('messages_') === 0) return true;
    if (key.indexOf('km_sal_') === 0) return true;
    if (key.indexOf('km_report_') === 0) return true;
    return false;
  }

  function buildSnapshot() {
    var snapshot = {};
    for (var i = 0; i < window.localStorage.length; i += 1) {
      var key = window.localStorage.key(i);
      if (!isEligibleKey(key)) continue;
      snapshot[key] = window.localStorage.getItem(key);
    }
    return snapshot;
  }

  function emitStorageLikeEvent(key, oldValue, newValue) {
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: key,
        oldValue: oldValue,
        newValue: newValue,
        storageArea: window.localStorage,
        url: window.location.href
      }));
    } catch (_) {
      window.dispatchEvent(new CustomEvent('delivpro:storage-sync', {
        detail: {
          key: key,
          oldValue: oldValue,
          newValue: newValue
        }
      }));
    }
  }

  function applyRemoteSnapshot(snapshot, replaceMissing) {
    var data = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var nextKeys = {};

    suppressLocalSync = true;
    try {
      Object.keys(data).forEach(function (key) {
        if (!isEligibleKey(key)) return;
        nextKeys[key] = true;
        var nextValue = data[key];
        if (nextValue == null) return;
        var stringValue = typeof nextValue === 'string' ? nextValue : JSON.stringify(nextValue);
        var previousValue = window.localStorage.getItem(key);
        if (previousValue === stringValue) return;
        originalSetItem.call(window.localStorage, key, stringValue);
        emitStorageLikeEvent(key, previousValue, stringValue);
      });

      if (replaceMissing) {
        var toRemove = [];
        for (var i = 0; i < window.localStorage.length; i += 1) {
          var currentKey = window.localStorage.key(i);
          if (!isEligibleKey(currentKey)) continue;
          if (!nextKeys[currentKey]) toRemove.push(currentKey);
        }

        toRemove.forEach(function (key) {
          var previousValue = window.localStorage.getItem(key);
          originalRemoveItem.call(window.localStorage, key);
          emitStorageLikeEvent(key, previousValue, null);
        });
      }
    } finally {
      suppressLocalSync = false;
    }
  }

  async function hasAuthenticatedSession() {
    var client = getClient();
    if (!client) return false;
    try {
      var result = await client.auth.getSession();
      return !!(result && result.data && result.data.session && result.data.session.user);
    } catch (_) {
      return false;
    }
  }

  async function getCurrentUserId() {
    if (currentUserId) return currentUserId;
    var client = getClient();
    if (!client) return '';
    try {
      var userResult = await client.auth.getUser();
      currentUserId = userResult?.data?.user?.id || '';
      return currentUserId;
    } catch (_) {
      return '';
    }
  }

  async function fetchRemoteState() {
    var client = getClient();
    if (!client) return null;
    var result = await client
      .from('app_state')
      .select('scope, payload, updated_at, updated_by')
      .eq('scope', STORAGE_SCOPE)
      .maybeSingle();

    if (result.error) {
      lastErrorMessage = result.error.message || String(result.error);
      throw result.error;
    }
    return result.data || null;
  }

  function rememberRemoteState(record) {
    if (!record) return;
    lastRemoteUpdatedAt = record.updated_at ? String(record.updated_at) : lastRemoteUpdatedAt;
    lastRemoteUpdatedBy = record.updated_by ? String(record.updated_by) : lastRemoteUpdatedBy;
  }

  async function notifyRemoteUpdate(record, origin) {
    var updatedAt = record && record.updated_at ? String(record.updated_at) : '';
    if (!updatedAt) return;
    var userId = await getCurrentUserId();
    var updatedBy = record && record.updated_by ? String(record.updated_by) : '';
    var externalActor = !!updatedBy && !!userId && updatedBy !== userId;
    window.dispatchEvent(new CustomEvent('delivpro:remote-update', {
      detail: {
        updatedAt: updatedAt,
        updatedBy: updatedBy,
        externalActor: externalActor,
        origin: origin || 'remote'
      }
    }));
  }

  async function pushChanges(changes, removedKeys) {
    var client = getClient();
    if (!client) return { ok: false, skipped: true };

    var payload = changes && typeof changes === 'object' ? changes : {};
    var removals = Array.isArray(removedKeys) ? removedKeys : [];

    if (!Object.keys(payload).length && !removals.length) {
      return { ok: true, skipped: true };
    }

    var result = await client.rpc('app_state_apply', {
      p_scope: STORAGE_SCOPE,
      p_changes: payload,
      p_removed_keys: removals
    });

    if (result.error) {
      lastErrorMessage = result.error.message || String(result.error);
      return { ok: false, error: result.error };
    }
    lastErrorMessage = '';
    rememberRemoteState(result.data || null);
    return { ok: true, data: result.data || null };
  }

  async function flushPending() {
    flushTimer = null;
    scheduledFlushDelay = null;

    if (!initialized || suppressLocalSync) return;

    var changeKeys = Object.keys(pendingChanges);
    var removedKeys = Object.keys(pendingRemovals);
    if (!changeKeys.length && !removedKeys.length) return;

    var changes = pendingChanges;
    pendingChanges = {};
    pendingRemovals = {};

    var result = await pushChanges(changes, removedKeys);
    if (!result.ok) {
      Object.keys(changes).forEach(function (key) {
        pendingChanges[key] = changes[key];
      });
      removedKeys.forEach(function (key) {
        pendingRemovals[key] = true;
      });
      scheduleFlush(RETRY_DELAY_MS);
    }
  }

  function scheduleFlush(delay) {
    var nextDelay = typeof delay === 'number' ? delay : FLUSH_DELAY_MS;
    if (flushTimer) {
      if (scheduledFlushDelay != null && nextDelay >= scheduledFlushDelay) return;
      window.clearTimeout(flushTimer);
    }
    scheduledFlushDelay = nextDelay;
    flushTimer = window.setTimeout(function () {
      flushPending().catch(function () {});
    }, nextDelay);
  }

  function queueSet(key, value) {
    if (!initialized || suppressLocalSync || !isEligibleKey(key)) return;
    delete pendingRemovals[key];
    pendingChanges[key] = String(value);
    scheduleFlush(isPriorityKey(key) ? FAST_FLUSH_DELAY_MS : FLUSH_DELAY_MS);
  }

  function queueRemove(key) {
    if (!initialized || suppressLocalSync || !isEligibleKey(key)) return;
    delete pendingChanges[key];
    pendingRemovals[key] = true;
    scheduleFlush(isPriorityKey(key) ? FAST_FLUSH_DELAY_MS : FLUSH_DELAY_MS);
  }

  function subscribeRealtime() {
    var client = getClient();
    if (!client || realtimeChannel) return;

    realtimeChannel = client
      .channel('delivpro-app-state-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_state',
        filter: 'scope=eq.' + STORAGE_SCOPE
      }, function (payload) {
        var record = payload && payload.new ? payload.new : null;
        if (!record || !record.payload) return;
        rememberRemoteState(record);
        applyRemoteSnapshot(record.payload, true);
        notifyRemoteUpdate(record, 'realtime').catch(function () {});
      })
      .subscribe();
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = window.setInterval(function () {
      if (!initialized || suppressLocalSync) return;
      pullLatest().catch(function () {});
    }, POLL_INTERVAL_MS);
  }

  function startForegroundRefresh() {
    function pullSoon() {
      if (!initialized || suppressLocalSync) return;
      pullLatest().catch(function () {});
    }

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pullSoon();
      if (document.visibilityState === 'hidden') flushPending().catch(function () {});
    });
    window.addEventListener('beforeunload', function () {
      flushPending().catch(function () {});
    });
    window.addEventListener('pagehide', function () {
      flushPending().catch(function () {});
    });
  }

  async function pullLatest(forceApply) {
    if (!(await hasAuthenticatedSession())) {
      lastErrorMessage = 'missing_session';
      return { ok: false, skipped: true };
    }

    var remote = null;
    try {
      remote = await fetchRemoteState();
    } catch (error) {
      lastErrorMessage = error?.message || String(error);
      return { ok: false, error: error };
    }

    if (!remote || !remote.payload) return { ok: true, skipped: true };

    var remoteUpdatedAt = remote.updated_at ? String(remote.updated_at) : '';
    var shouldApply = !!forceApply || !lastRemoteUpdatedAt || !remoteUpdatedAt || remoteUpdatedAt !== lastRemoteUpdatedAt;

    rememberRemoteState(remote);
    if (shouldApply) applyRemoteSnapshot(remote.payload, true);
    if (shouldApply) {
      notifyRemoteUpdate(remote, forceApply ? 'pull-force' : 'poll').catch(function () {});
    }

    return { ok: true, data: remote, applied: shouldApply };
  }

  async function bootstrap() {
    if (initialized) return { ok: true, skipped: true };
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async function () {
      if (!(await hasAuthenticatedSession())) {
        lastErrorMessage = 'missing_session';
        return { ok: false, skipped: true };
      }

      var remote = null;
      try {
        remote = await fetchRemoteState();
      } catch (_) {
        lastErrorMessage = '';
        remote = null;
      }

      if (remote && remote.payload && Object.keys(remote.payload).length) {
        rememberRemoteState(remote);
        applyRemoteSnapshot(remote.payload, true);
      } else {
        var localSnapshot = buildSnapshot();
        if (Object.keys(localSnapshot).length) {
          await pushChanges(localSnapshot, []);
        }
      }

      initialized = true;
      subscribeRealtime();
      startPolling();
      startForegroundRefresh();
      return { ok: true };
    })();

    try {
      return await bootstrapPromise;
    } finally {
      bootstrapPromise = null;
    }
  }

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage) queueSet(key, value);
  };

  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    if (this === window.localStorage) queueRemove(key);
  };

  Storage.prototype.clear = function () {
    var keys = [];
    if (this === window.localStorage) {
      for (var i = 0; i < window.localStorage.length; i += 1) {
        var key = window.localStorage.key(i);
        if (isEligibleKey(key)) keys.push(key);
      }
    }

    originalClear.call(this);

    if (this === window.localStorage) {
      keys.forEach(function (key) {
        queueRemove(key);
      });
    }
  };

  async function pushFullSnapshot() {
    var snapshot = buildSnapshot();
    return await pushChanges(snapshot, []);
  }

  async function debugStatus() {
    var client = getClient();
    var session = null;
    if (client) {
      try {
        var sessionResult = await client.auth.getSession();
        session = sessionResult?.data?.session || null;
      } catch (_) {
        session = null;
      }
    }
    return {
      initialized: initialized,
      hasClient: !!client,
      hasSession: !!session,
      currentUserId: currentUserId || session?.user?.id || '',
      authMode: sessionStorage.getItem('auth_mode') || '',
      role: sessionStorage.getItem('role') || '',
      lastRemoteUpdatedAt: lastRemoteUpdatedAt,
      lastRemoteUpdatedBy: lastRemoteUpdatedBy,
      lastErrorMessage: lastErrorMessage,
      snapshotKeys: Object.keys(buildSnapshot()),
      pendingChangeCount: Object.keys(pendingChanges).length,
      pendingRemovalCount: Object.keys(pendingRemovals).length
    };
  }

  window.DelivProRemoteStorage = {
    init: bootstrap,
    flush: flushPending,
    pushFullSnapshot: pushFullSnapshot,
    debugStatus: debugStatus,
    pullLatest: pullLatest,
    buildSnapshot: buildSnapshot
  };
})();
