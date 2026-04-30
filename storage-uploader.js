/**
 * Storage Uploader — Helpers Supabase Storage
 *
 * Utilitaires generiques pour uploader, telecharger et supprimer des fichiers
 * dans les buckets Supabase Storage. Utilise par les adapters d'entites pour
 * migrer les fichiers stockes en base64 dans localStorage vers Storage.
 *
 * window.DelivProStorage = {
 *   uploadDataUrl(bucket, path, dataUrl, opts)  -> { ok, path, error }
 *   uploadBlob(bucket, path, blob, opts)        -> { ok, path, error }
 *   getSignedUrl(bucket, path, expiresIn)       -> { ok, signedUrl, error }
 *   download(bucket, path)                      -> { ok, blob, error }
 *   remove(bucket, path)                        -> { ok, error }
 *   dataUrlToBlob(dataUrl)                      -> Blob
 *   isStoragePath(value)                        -> boolean (heuristique)
 * }
 *
 * IMPORTANT : a charger APRES supabase-client.js et AVANT script.js.
 */

(function () {
  'use strict';

  if (window.DelivProStorage) return;

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) return null;
    var commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    var meta = dataUrl.substring(5, commaIdx);
    var data = dataUrl.substring(commaIdx + 1);
    var mime = (meta.split(';')[0] || 'application/octet-stream').trim();
    var isBase64 = meta.indexOf(';base64') >= 0;
    var binary;
    try {
      binary = isBase64 ? atob(data) : decodeURIComponent(data);
    } catch (e) {
      return null;
    }
    var len = binary.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i += 1) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function isStoragePath(value) {
    // Un storage_path ressemble a "bucket-folder/<uuid>/<type>/<filename>"
    // alors qu'un base64 commence par "data:"
    if (typeof value !== 'string' || !value.length) return false;
    if (value.indexOf('data:') === 0) return false;
    if (value.indexOf('http://') === 0 || value.indexOf('https://') === 0) return false;
    return value.indexOf('/') > 0;
  }

  async function uploadBlob(bucket, path, blob, opts) {
    var client = getClient();
    if (!client) return { ok: false, error: { message: 'Supabase client indisponible' } };
    if (!bucket || !path || !blob) return { ok: false, error: { message: 'Parametres manquants' } };

    var options = Object.assign({
      upsert: true,
      cacheControl: '3600',
      contentType: blob.type || 'application/octet-stream'
    }, opts || {});

    var res = await client.storage.from(bucket).upload(path, blob, options);
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, path: path, fullPath: res.data && res.data.path || path };
  }

  async function uploadDataUrl(bucket, path, dataUrl, opts) {
    var blob = dataUrlToBlob(dataUrl);
    if (!blob) return { ok: false, error: { message: 'Data URL invalide' } };
    return await uploadBlob(bucket, path, blob, opts);
  }

  // Cache memoire des signed URLs pour eviter les round-trips reseau repetes.
  // Key = bucket + ':' + path. Expire 60s avant l'expiration reelle (safety).
  var signedUrlCache = new Map();

  async function getSignedUrl(bucket, path, expiresIn) {
    var client = getClient();
    if (!client) return { ok: false, error: { message: 'Supabase client indisponible' } };
    if (!bucket || !path) return { ok: false, error: { message: 'Parametres manquants' } };

    var cacheKey = bucket + ':' + path;
    var cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ok: true, signedUrl: cached.url, cached: true };
    }

    var ttl = (typeof expiresIn === 'number' && expiresIn > 0) ? expiresIn : 3600; // 1h par defaut
    var res = await client.storage.from(bucket).createSignedUrl(path, ttl);
    if (res.error) return { ok: false, error: res.error };
    var url = res.data && res.data.signedUrl;
    if (url) {
      signedUrlCache.set(cacheKey, {
        url: url,
        expiresAt: Date.now() + ((ttl - 60) * 1000) // marge de securite 60s
      });
    }
    return { ok: true, signedUrl: url };
  }

  function invalidateSignedUrl(bucket, path) {
    if (!bucket || !path) return;
    signedUrlCache.delete(bucket + ':' + path);
  }

  async function download(bucket, path) {
    var client = getClient();
    if (!client) return { ok: false, error: { message: 'Supabase client indisponible' } };
    var res = await client.storage.from(bucket).download(path);
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, blob: res.data };
  }

  async function remove(bucket, path) {
    var client = getClient();
    if (!client) return { ok: false, error: { message: 'Supabase client indisponible' } };
    var paths = Array.isArray(path) ? path : [path];
    var res = await client.storage.from(bucket).remove(paths);
    if (res.error) return { ok: false, error: res.error };
    return { ok: true };
  }

  function sanitizeFilename(name) {
    var s = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    if (s.length > 100) s = s.slice(-100);
    return s || 'file';
  }

  // Feature detection : WebP supporte par le navigateur ?
  // WebP = ~30% plus petit que JPEG a qualite equivalente.
  // Tous browsers modernes supportent WebP (Chrome, Firefox, Safari 14+, Edge).
  var _webpSupported = null;
  function supportsWebP() {
    if (_webpSupported !== null) return _webpSupported;
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      _webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (_) { _webpSupported = false; }
    return _webpSupported;
  }

  // Compresse un canvas en blob optimal (WebP si possible, JPEG sinon).
  // Retourne { blob, mime, ext }
  function canvasToOptimalBlob(canvas, quality) {
    var q = (typeof quality === 'number') ? quality : 0.78;
    var useWebP = supportsWebP();
    var mime = useWebP ? 'image/webp' : 'image/jpeg';
    var ext = useWebP ? 'webp' : 'jpg';
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        // Si WebP fail (rare), fallback JPEG
        if (!blob && useWebP) {
          canvas.toBlob(function (b) {
            resolve({ blob: b, mime: 'image/jpeg', ext: 'jpg' });
          }, 'image/jpeg', q);
        } else {
          resolve({ blob: blob, mime: mime, ext: ext });
        }
      }, mime, q);
    });
  }

  window.DelivProStorage = {
    uploadDataUrl: uploadDataUrl,
    uploadBlob: uploadBlob,
    getSignedUrl: getSignedUrl,
    invalidateSignedUrl: invalidateSignedUrl,
    download: download,
    remove: remove,
    dataUrlToBlob: dataUrlToBlob,
    isStoragePath: isStoragePath,
    sanitizeFilename: sanitizeFilename,
    supportsWebP: supportsWebP,
    canvasToOptimalBlob: canvasToOptimalBlob
  };
})();
