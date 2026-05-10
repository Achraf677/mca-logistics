(function () {
  var config = window.DELIVPRO_SUPABASE_CONFIG || {};
  var client = null;
  var INSPECTION_BUCKET = 'inspections-photos';
  var COMPANY_ASSETS_BUCKET = 'company-assets';

  function buildClient() {
    if (client) return client;
    if (!window.supabase || !config.url || !config.publishableKey) return null;

    // #72 audit Chrome : JWT en localStorage = lisible par tout script (XSS).
    // Mitigation pragmatique : wrapper localStorage qui ajoute un TTL 8h
    // d'inactivite. Si dernier touch > 8h, on clear le token a la prochaine
    // lecture (= redirige vers login). Limite la fenetre d'exploit en cas
    // de XSS pendant que l'utilisateur etait deconnecte.
    var TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 heures
    var TOKEN_TS_KEY = 'mca_token_lastTouch';
    function checkTtl() {
      try {
        var ts = parseInt(localStorage.getItem(TOKEN_TS_KEY), 10);
        if (ts && (Date.now() - ts) > TOKEN_TTL_MS) {
          // Inactif depuis trop longtemps : on purge tout token Supabase
          var keys = [];
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && (k.indexOf('sb-') === 0 || k.indexOf('supabase.auth.') === 0)) keys.push(k);
          }
          keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
          localStorage.removeItem(TOKEN_TS_KEY);
        }
      } catch (_) {}
    }
    checkTtl();
    var ttlStorage = {
      getItem: function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
      setItem: function (k, v) {
        try {
          localStorage.setItem(k, v);
          localStorage.setItem(TOKEN_TS_KEY, String(Date.now()));
        } catch (_) {}
      },
      removeItem: function (k) {
        try { localStorage.removeItem(k); } catch (_) {}
      }
    };

    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: ttlStorage
      }
    });

    return client;
  }

  function getStorageHelpers(bucketName) {
    function normalizePath(path) {
      return String(path || '').replace(/^\/+/, '');
    }

    function getBucketClient() {
      var supabaseClient = buildClient();
      if (!supabaseClient) return null;
      return supabaseClient.storage.from(bucketName);
    }

    function buildPublicUrl(path) {
      // Conserve pour buckets publics (ex : company-assets). Ne pas utiliser
      // pour inspections-photos depuis migration 027 (bucket prive).
      var bucketClient = getBucketClient();
      var normalizedPath = normalizePath(path);
      if (!bucketClient || !normalizedPath) return '';
      var result = bucketClient.getPublicUrl(normalizedPath);
      return result && result.data ? result.data.publicUrl || '' : '';
    }

    async function createSignedUrl(path, expiresIn) {
      var bucketClient = getBucketClient();
      var normalizedPath = normalizePath(path);
      if (!bucketClient || !normalizedPath) {
        return { ok: false, reason: 'invalid_payload', error: { message: 'Chemin invalide' } };
      }
      var ttl = (typeof expiresIn === 'number' && expiresIn > 0) ? expiresIn : 300;
      var result = await bucketClient.createSignedUrl(normalizedPath, ttl);
      if (result.error) {
        return { ok: false, reason: 'signed_url_error', error: result.error };
      }
      return {
        ok: true,
        signedUrl: result.data && result.data.signedUrl ? result.data.signedUrl : '',
        expiresIn: ttl
      };
    }

    async function uploadInspectionPhoto(path, fileBody, options) {
      var bucketClient = getBucketClient();
      var normalizedPath = normalizePath(path);
      if (!bucketClient) return { ok: false, reason: 'unavailable', error: { message: 'Client Supabase indisponible' } };
      if (!normalizedPath || !fileBody) return { ok: false, reason: 'invalid_payload', error: { message: 'Fichier inspection invalide' } };
      var uploadOptions = options && typeof options === 'object' ? options : {};

      var uploadResult = await bucketClient.upload(normalizedPath, fileBody, {
        cacheControl: uploadOptions.cacheControl || '3600',
        contentType: uploadOptions.contentType || 'image/jpeg',
        upsert: uploadOptions.upsert !== false
      });

      if (uploadResult.error) {
        return { ok: false, reason: 'upload_error', error: uploadResult.error };
      }

      // Bucket prive depuis migration 027 : on ne renvoie que le path.
      // L'URL signee est generee a la demande au moment de l'affichage.
      return {
        ok: true,
        path: normalizedPath
      };
    }

    function extractPathFromPublicUrl(url) {
      var value = String(url || '').trim();
      if (!value) return '';
      var marker = '/storage/v1/object/public/' + bucketName + '/';
      var index = value.indexOf(marker);
      if (index === -1) return '';
      var encodedPath = value.slice(index + marker.length).split('?')[0];
      if (!encodedPath) return '';
      try {
        return decodeURIComponent(encodedPath);
      } catch (_) {
        return encodedPath;
      }
    }

    async function removeInspectionPhotos(paths) {
      var bucketClient = getBucketClient();
      var normalizedPaths = Array.isArray(paths)
        ? paths.map(normalizePath).filter(Boolean)
        : [];

      if (!bucketClient) return { ok: false, reason: 'unavailable', error: { message: 'Client Supabase indisponible' } };
      if (!normalizedPaths.length) return { ok: true, data: [] };

      var result = await bucketClient.remove(normalizedPaths);
      if (result.error) {
        return { ok: false, reason: 'remove_error', error: result.error };
      }

      return { ok: true, data: result.data || [] };
    }

    return {
      bucket: bucketName,
      buildPublicUrl: buildPublicUrl,
      createSignedUrl: createSignedUrl,
      extractPathFromPublicUrl: extractPathFromPublicUrl,
      uploadInspectionPhoto: uploadInspectionPhoto,
      removeInspectionPhotos: removeInspectionPhotos
    };
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
    },
    getInspectionStorage: function () {
      return getStorageHelpers(INSPECTION_BUCKET);
    },
    getCompanyAssetsStorage: function () {
      return getStorageHelpers(COMPANY_ASSETS_BUCKET);
    }
  };
})();
