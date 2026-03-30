(function () {
  var config = window.DELIVPRO_SUPABASE_CONFIG || {};
  var client = null;
  var INSPECTION_BUCKET = 'inspections-photos';

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

  function getStorageHelpers() {
    function normalizePath(path) {
      return String(path || '').replace(/^\/+/, '');
    }

    function getBucketClient() {
      var supabaseClient = buildClient();
      if (!supabaseClient) return null;
      return supabaseClient.storage.from(INSPECTION_BUCKET);
    }

    function buildPublicUrl(path) {
      var bucketClient = getBucketClient();
      var normalizedPath = normalizePath(path);
      if (!bucketClient || !normalizedPath) return '';
      var result = bucketClient.getPublicUrl(normalizedPath);
      return result && result.data ? result.data.publicUrl || '' : '';
    }

    async function uploadInspectionPhoto(path, fileBody) {
      var bucketClient = getBucketClient();
      var normalizedPath = normalizePath(path);
      if (!bucketClient) return { ok: false, reason: 'unavailable', error: { message: 'Client Supabase indisponible' } };
      if (!normalizedPath || !fileBody) return { ok: false, reason: 'invalid_payload', error: { message: 'Fichier inspection invalide' } };

      var uploadResult = await bucketClient.upload(normalizedPath, fileBody, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        upsert: true
      });

      if (uploadResult.error) {
        return { ok: false, reason: 'upload_error', error: uploadResult.error };
      }

      return {
        ok: true,
        path: normalizedPath,
        url: buildPublicUrl(normalizedPath)
      };
    }

    function extractPathFromPublicUrl(url) {
      var value = String(url || '').trim();
      if (!value) return '';
      var marker = '/storage/v1/object/public/' + INSPECTION_BUCKET + '/';
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
      bucket: INSPECTION_BUCKET,
      buildPublicUrl: buildPublicUrl,
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
      return getStorageHelpers();
    }
  };
})();
