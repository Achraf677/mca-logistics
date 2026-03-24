(function () {
  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function provisionSalarieAccess(payload) {
    var client = getClient();
    if (!client) return { ok: false, reason: 'unavailable' };

    var result = await client.functions.invoke('provision-salarie-access', {
      body: payload
    });

    if (result.error) {
      return { ok: false, reason: 'invoke_error', error: result.error };
    }

    return { ok: true, data: result.data || null };
  }

  window.DelivProAdminSupabase = {
    provisionSalarieAccess: provisionSalarieAccess
  };
})();
