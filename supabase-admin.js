(function () {
  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function provisionSalarieAccess(payload) {
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
      ? projectUrl.replace('.supabase.co', '.functions.supabase.co') + '/provision-salarie-access'
      : '';

    if (!functionUrl || !publishableKey) {
      return { ok: false, reason: 'missing_config', error: { message: 'Configuration Supabase incomplète' } };
    }

    var response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
        'apikey': publishableKey
      },
      body: JSON.stringify(payload)
    });

    var data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

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

  window.DelivProAdminSupabase = {
    provisionSalarieAccess: provisionSalarieAccess
  };
})();
