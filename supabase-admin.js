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
      var detailedMessage =
        result.data?.error ||
        result.error?.context?.error ||
        result.error?.message ||
        'invoke_error';
      return {
        ok: false,
        reason: 'invoke_error',
        error: {
          message: detailedMessage,
          raw: result.error
        },
        data: result.data || null
      };
    }

    return { ok: true, data: result.data || null };
  }

  window.DelivProAdminSupabase = {
    provisionSalarieAccess: provisionSalarieAccess
  };
})();
