(function () {
  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function resolveLoginTarget(kind, identifier) {
    const client = getClient();
    if (!client || !identifier) return { ok: false, reason: 'unavailable' };

    const { data, error } = await client.rpc('find_login_email', {
      login_kind: kind,
      login_identifier: identifier
    });

    if (error) return { ok: false, reason: 'lookup_error', error: error };
    if (!Array.isArray(data) || !data.length) return { ok: false, reason: 'not_found' };

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

    const profile = await fetchOwnProfile();
    const salarie = kind === 'salarie' ? await fetchOwnSalarie() : null;

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

    if (sessionStorage.getItem('role') === 'admin') return true;

    const {
      data: { session }
    } = await client.auth.getSession();
    if (!session) return false;

    const profile = await fetchOwnProfile();
    if (!profile || profile.role !== 'admin') return false;

    sessionStorage.setItem('role', 'admin');
    sessionStorage.setItem('admin_login', profile.email || session.user.email || '');
    sessionStorage.setItem('admin_nom', profile.display_name || session.user.email || 'Admin');
    sessionStorage.removeItem('salarie_id');
    sessionStorage.removeItem('salarie_numero');
    return true;
  }

  async function ensureSalarieLegacySessionFromSupabase() {
    const client = getClient();
    if (!client) return false;

    if (sessionStorage.getItem('role') === 'salarie') return true;

    const {
      data: { session }
    } = await client.auth.getSession();
    if (!session) return false;

    const profile = await fetchOwnProfile();
    if (!profile || profile.role !== 'salarie') return false;

    const salarie = await fetchOwnSalarie();
    if (!salarie || salarie.actif === false) return false;

    sessionStorage.setItem('role', 'salarie');
    sessionStorage.setItem('salarie_id', salarie.id || '');
    sessionStorage.setItem('salarie_numero', salarie.numero || '');
    sessionStorage.removeItem('admin_login');
    sessionStorage.removeItem('admin_nom');
    return true;
  }

  window.DelivProAuth = {
    resolveLoginTarget: resolveLoginTarget,
    signIn: signIn,
    signOut: signOut,
    ensureAdminLegacySessionFromSupabase: ensureAdminLegacySessionFromSupabase,
    ensureSalarieLegacySessionFromSupabase: ensureSalarieLegacySessionFromSupabase
  };
})();
