(function () {
  var config = window.DELIVPRO_SUPABASE_CONFIG || {};
  var client = null;

  function buildClient() {
    if (client) return client;
    if (!window.supabase || !config.url || !config.publishableKey) return null;

    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return client;
  }

  window.DelivProSupabase = {
    getClient: function () {
      return buildClient();
    },
    isReady: function () {
      return !!buildClient();
    },
    getConfig: function () {
      return {
        url: config.url || '',
        publishableKey: config.publishableKey || ''
      };
    }
  };
})();
