(function () {
  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  // ─── Helper : appel Edge Function ────────────────────────────────────────
  async function callEdgeFunction(slug, payload) {
    var client = getClient();
    if (!client) return { ok: false, reason: 'unavailable' };

    var sessionResult = await client.auth.getSession();
    var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    if (!session || !session.access_token) {
      return { ok: false, reason: 'missing_session', error: { message: 'Session admin Supabase introuvable' } };
    }

    var config = window.DELIVPRO_SUPABASE_CONFIG || {};
    var projectUrl = config.url || '';
    var publishableKey = config.publishableKey || '';
    var functionUrl = projectUrl
      ? projectUrl.replace('.supabase.co', '.functions.supabase.co') + '/' + slug
      : '';

    if (!functionUrl || !publishableKey) {
      return { ok: false, reason: 'missing_config', error: { message: 'Configuration Supabase incomplete' } };
    }

    var response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
        'apikey': publishableKey
      },
      body: JSON.stringify(payload || {})
    });

    var data = null;
    try { data = await response.json(); } catch (_) { data = null; }

    if (!response.ok) {
      return {
        ok: false,
        reason: 'invoke_error',
        error: {
          message: data && data.error ? data.error : ('HTTP ' + response.status),
          status: response.status
        },
        data: data
      };
    }

    return { ok: true, data: data || null };
  }

  // ─── Provisioner l'accès salarié (création / reset mdp) ──────────────────
  async function provisionSalarieAccess(payload) {
    return callEdgeFunction('provision-salarie-access', payload);
  }

  // ─── Supprimer l'accès salarié (compte Auth + profil) ────────────────────
  // Appelle l'Edge Function delete-salarie-access qui supprime le compte
  // dans auth.users via la service role key — ce que le front ne peut pas faire.
  async function deleteSalarieAccess(payload) {
    return callEdgeFunction('delete-salarie-access', payload);
  }

  window.DelivProAdminSupabase = {
    provisionSalarieAccess: provisionSalarieAccess,
    deleteSalarieAccess: deleteSalarieAccess
  };
})();
