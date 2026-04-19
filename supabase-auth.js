(function () {
  var LOGIN_TARGET_CACHE_KEY = 'delivpro_login_target_cache_v1';
  var LOGIN_TARGET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  function getKnownAdminName(identifierOrEmail) {
    var value = String(identifierOrEmail || '').trim().toLowerCase();
    if (!value) return '';
    if (value === 'achraf.chikri' || value === 'admin.achraf@mca-logistics.fr' || value === 'admin.achraf') {
      return 'Achraf Chikri';
    }
    if (value === 'mohammed.chikri' || value === 'admin.mohammed@mca-logistics.fr' || value === 'admin.mohammed') {
      return 'Mohammed Chikri';
    }
    return '';
  }

  function normalizeAdminDisplayName(displayName, identifier, email) {
    var known = getKnownAdminName(identifier) || getKnownAdminName(email) || getKnownAdminName(displayName);
    if (known) return known;

    var candidate = String(displayName || '').trim();
    if (!candidate) {
      return String(identifier || email || 'Admin').trim() || 'Admin';
    }

    var normalized = candidate.toLowerCase();
    if (normalized === 'admin.achraf' || normalized === 'admin.mohammed') {
      return getKnownAdminName(candidate) || candidate;
    }

    return candidate;
  }

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  function readLoginTargetCache() {
    try {
      var raw = window.localStorage.getItem(LOGIN_TARGET_CACHE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeLoginTargetCache(cache) {
    try {
      window.localStorage.setItem(LOGIN_TARGET_CACHE_KEY, JSON.stringify(cache || {}));
    } catch (_) {}
  }

  function buildLoginTargetCacheKey(kind, identifier) {
    return String(kind || '') + ':' + String(identifier || '').trim().toLowerCase();
  }

  function getCachedLoginTarget(kind, identifier) {
    var cache = readLoginTargetCache();
    var key = buildLoginTargetCacheKey(kind, identifier);
    var entry = cache[key];
    if (!entry || !entry.target || !entry.savedAt) return null;
    var age = Date.now() - Number(entry.savedAt);
    if (!Number.isFinite(age) || age > LOGIN_TARGET_CACHE_TTL_MS) {
      delete cache[key];
      writeLoginTargetCache(cache);
      return null;
    }
    return entry.target;
  }

  function cacheLoginTarget(kind, identifier, target) {
    if (!target || !target.email) return;
    var cache = readLoginTargetCache();
    cache[buildLoginTargetCacheKey(kind, identifier)] = {
      target: target,
      savedAt: Date.now()
    };
    writeLoginTargetCache(cache);
  }

  async function resolveLoginTarget(kind, identifier) {
    const client = getClient();
    if (!client || !identifier) return { ok: false, reason: 'unavailable' };

    var cachedTarget = getCachedLoginTarget(kind, identifier);
    if (cachedTarget && cachedTarget.email) {
      return { ok: true, target: cachedTarget, cached: true };
    }

    const { data, error } = await client.rpc('find_login_email', {
      login_kind: kind,
      login_identifier: identifier
    });

    if (error) return { ok: false, reason: 'lookup_error', error: error };
    if (!Array.isArray(data) || !data.length) return { ok: false, reason: 'not_found' };

    cacheLoginTarget(kind, identifier, data[0]);

    return { ok: true, target: data[0] };
  }

  async function fetchOwnProfile() {
    const client = getClient();
    if (!client) return null;
    const {
      data: { user }
    } = await client.auth.getUser();
    if (!user) return null;

    const { data } = await client
      .from('profiles')
      .select('id, role, email, display_name')
      .eq('id', user.id)
      .maybeSingle();

    return data || null;
  }

  async function fetchOwnSalarie() {
    const client = getClient();
    if (!client) return null;
    const {
      data: { user }
    } = await client.auth.getUser();
    if (!user) return null;

    const { data } = await client
      .from('salaries')
      .select('id, numero, nom, prenom, email, actif, poste')
      .eq('profile_id', user.id)
      .maybeSingle();

    return data || null;
  }

  async function signIn(kind, identifier, password) {
    const client = getClient();
    if (!client) return { ok: false, reason: 'unavailable' };

    const resolved = await resolveLoginTarget(kind, identifier);
    if (!resolved.ok) return resolved;

    const target = resolved.target;
    const { data, error } = await client.auth.signInWithPassword({
      email: target.email,
      password: password
    });

    if (error) return { ok: false, reason: 'invalid_credentials', error: error };

    const profile = kind === 'admin' ? await fetchOwnProfile() : null;
    const salarie = kind === 'salarie' ? await fetchOwnSalarie() : null;
    if (kind === 'admin') {
      target.display_name = normalizeAdminDisplayName(
        target.display_name || profile?.display_name || '',
        identifier,
        target.email || profile?.email || data.user?.email || ''
      );
    }

    return {
      ok: true,
      session: data.session || null,
      user: data.user || null,
      target: target,
      profile: profile,
      salarie: salarie
    };
  }

  async function signOut() {
    const client = getClient();
    if (!client) return;
    try {
      await client.auth.signOut();
    } catch (_) {}
  }

  async function ensureAdminLegacySessionFromSupabase() {
    const client = getClient();
    if (!client) return false;

    if (sessionStorage.getItem('role') === 'admin' && sessionStorage.getItem('auth_mode') === 'supabase') {
      const existingSession = await client.auth.getSession();
      if (existingSession?.data?.session) return true;
    }

    const {
      data: { session }
    } = await client.auth.getSession();
    if (!session) return false;

    const profile = await fetchOwnProfile();
    if (!profile || profile.role !== 'admin') return false;

    const savedIdentifiant = sessionStorage.getItem('admin_login') || localStorage.getItem('last_admin_identifiant') || '';
    var adminLabel = normalizeAdminDisplayName(
      profile.display_name || '',
      savedIdentifiant,
      profile.email || session.user.email || ''
    );
    sessionStorage.setItem('role', 'admin');
    sessionStorage.setItem('auth_mode', 'supabase');
    sessionStorage.setItem('admin_login', savedIdentifiant || profile.email || session.user.email || '');
    sessionStorage.setItem('admin_email', profile.email || session.user.email || '');
    sessionStorage.setItem('admin_nom', adminLabel || 'Admin');
    sessionStorage.removeItem('salarie_id');
    sessionStorage.removeItem('salarie_numero');
    return true;
  }

  async function ensureSalarieLegacySessionFromSupabase() {
    const client = getClient();
    if (!client) return false;

    if (sessionStorage.getItem('role') === 'salarie' && sessionStorage.getItem('auth_mode') === 'supabase') {
      const existingSession = await client.auth.getSession();
      if (existingSession?.data?.session) return true;
    }

    const {
      data: { session }
    } = await client.auth.getSession();
    if (!session) return false;

    const profile = await fetchOwnProfile();
    if (!profile || profile.role !== 'salarie') return false;

    const salarie = await fetchOwnSalarie();
    if (!salarie || salarie.actif === false) return false;

    sessionStorage.setItem('role', 'salarie');
    sessionStorage.setItem('auth_mode', 'supabase');
    sessionStorage.setItem('salarie_id', salarie.id || '');
    sessionStorage.setItem('salarie_numero', salarie.numero || '');
    sessionStorage.removeItem('admin_login');
    sessionStorage.removeItem('admin_email');
    sessionStorage.removeItem('admin_nom');
    return true;
  }

  async function restoreLegacySessionFromSupabase(expectedRole) {
    const client = getClient();
    if (!client) return '';

    const expected = expectedRole === 'admin' || expectedRole === 'salarie'
      ? expectedRole
      : '';
    const currentRole = sessionStorage.getItem('role');
    const currentAuthMode = sessionStorage.getItem('auth_mode');
    if (currentAuthMode === 'supabase' && currentRole && (!expected || currentRole === expected)) {
      try {
        const existingSession = await client.auth.getSession();
        if (existingSession?.data?.session) return currentRole;
      } catch (_) {}
    }

    const {
      data: { session }
    } = await client.auth.getSession();
    if (!session) return '';

    const profile = await fetchOwnProfile();
    if (!profile || !profile.role) return '';

    if (profile.role === 'admin') {
      if (expected && expected !== 'admin') return '';
      const savedIdentifiant = sessionStorage.getItem('admin_login') || localStorage.getItem('last_admin_identifiant') || '';
      var adminLabel = normalizeAdminDisplayName(
        profile.display_name || '',
        savedIdentifiant,
        profile.email || session.user.email || ''
      );
      sessionStorage.setItem('role', 'admin');
      sessionStorage.setItem('auth_mode', 'supabase');
      sessionStorage.setItem('admin_login', savedIdentifiant || profile.email || session.user.email || '');
      sessionStorage.setItem('admin_email', profile.email || session.user.email || '');
      sessionStorage.setItem('admin_nom', adminLabel || 'Admin');
      sessionStorage.removeItem('salarie_id');
      sessionStorage.removeItem('salarie_numero');
      return 'admin';
    }

    if (profile.role === 'salarie') {
      if (expected && expected !== 'salarie') return '';
      const salarie = await fetchOwnSalarie();
      if (!salarie || salarie.actif === false) return '';
      sessionStorage.setItem('role', 'salarie');
      sessionStorage.setItem('auth_mode', 'supabase');
      sessionStorage.setItem('salarie_id', salarie.id || '');
      sessionStorage.setItem('salarie_numero', salarie.numero || '');
      sessionStorage.removeItem('admin_login');
      sessionStorage.removeItem('admin_email');
      sessionStorage.removeItem('admin_nom');
      return 'salarie';
    }

    return '';
  }

  window.DelivProAuth = {
    normalizeAdminDisplayName: normalizeAdminDisplayName,
    resolveLoginTarget: resolveLoginTarget,
    signIn: signIn,
    signOut: signOut,
    restoreLegacySessionFromSupabase: restoreLegacySessionFromSupabase,
    ensureAdminLegacySessionFromSupabase: ensureAdminLegacySessionFromSupabase,
    ensureSalarieLegacySessionFromSupabase: ensureSalarieLegacySessionFromSupabase
  };
})();
