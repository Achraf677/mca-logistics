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
 *   compressImage(file, options)                -> Promise<File> (resize + JPEG)
 *   compressAndUpload(bucket, path, fileOrBlob, opts) -> { ok, path, error }
 *   makeThumbnail(file, options)                -> Promise<File> (vignette)
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

  // Buckets ou la compression auto est appliquee aux uploads d'images.
  // company-assets exclu (logo = qualite max). Buckets PDF/mixte gerent le skip
  // au cas par cas via le test mime image/* dans compressImage().
  var AUTO_COMPRESS_BUCKETS = {
    'inspections-photos': true,
    'incidents-photos': true,
    'carburant-recus': true,
    'messages-photos': true,
    'vehicules-cartes-grises': true, // auto-skip si PDF
    'vehicules-docs': true,          // auto-skip si PDF
    'salaries-docs': true            // auto-skip si PDF
  };

  // Defaults tunables — cible ~300 Ko apres compression.
  var COMPRESS_DEFAULTS = {
    maxDim: 1600,
    quality: 0.82,
    skipUnderBytes: 300 * 1024,
    mime: 'image/jpeg'
  };
  var THUMBNAIL_DEFAULTS = {
    maxDim: 400,
    quality: 0.7,
    mime: 'image/jpeg'
  };

  function _hasImageBitmap() {
    return typeof window.createImageBitmap === 'function';
  }

  function _formatBytes(n) {
    if (n < 1024) return n + ' o';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' Ko';
    return (n / (1024 * 1024)).toFixed(2) + ' Mo';
  }

  function _isImageFile(file) {
    return !!(file && typeof file.type === 'string' && file.type.indexOf('image/') === 0);
  }

  // Charge un File/Blob image dans un canvas, en respectant l'orientation EXIF
  // si ImageBitmap est dispo (Safari iOS < 14 : fallback sans EXIF).
  async function _loadIntoCanvas(file, maxDim) {
    var bitmap = null;
    var srcW, srcH;
    if (_hasImageBitmap()) {
      try {
        bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
        srcW = bitmap.width;
        srcH = bitmap.height;
      } catch (_) {
        bitmap = null;
      }
    }
    if (!bitmap) {
      // Fallback Image classique (pas de gestion EXIF — qualite moindre sur
      // certaines photos iPhone tournees, mais reste utilisable).
      bitmap = await new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image_load_failed')); };
        img.src = url;
      });
      srcW = bitmap.naturalWidth || bitmap.width;
      srcH = bitmap.naturalHeight || bitmap.height;
    }
    var w = srcW, h = srcH;
    var longest = Math.max(w, h);
    if (longest > maxDim) {
      var ratio = maxDim / longest;
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === 'function') {
      try { bitmap.close(); } catch (_) {}
    }
    return canvas;
  }

  function _canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) reject(new Error('canvas_toblob_failed'));
        else resolve(blob);
      }, mime, quality);
    });
  }

  function _replaceExtension(name, ext) {
    var base = String(name || 'image').replace(/\.[a-zA-Z0-9]+$/, '');
    return base + '.' + ext;
  }

  /**
   * Compresse une image (File ou Blob).
   *  - Si ce n'est pas une image (pas de mime image/*), retourne le file tel quel.
   *  - Si deja petite (< options.skipUnderBytes), retourne tel quel.
   *  - Sinon resize a max options.maxDim px sur le cote long, encode JPEG quality.
   *  - Retourne un File JPEG (meme nom, extension .jpg).
   */
  async function compressImage(file, options) {
    if (!file) return file;
    if (!_isImageFile(file)) return file;
    var opts = Object.assign({}, COMPRESS_DEFAULTS, options || {});
    var origSize = file.size || 0;
    if (origSize > 0 && origSize < opts.skipUnderBytes) return file;

    try {
      var canvas = await _loadIntoCanvas(file, opts.maxDim);
      var blob = await _canvasToBlob(canvas, opts.mime, opts.quality);
      if (!blob) return file;
      // Securite : si la "compression" produit un fichier plus gros (rare,
      // images deja optimisees ou tres petites), on garde l'original.
      if (origSize > 0 && blob.size >= origSize) return file;

      var ext = (opts.mime === 'image/webp') ? 'webp' : 'jpg';
      var newName = _replaceExtension(file.name || 'image', ext);
      var compressed;
      try {
        compressed = new File([blob], newName, { type: opts.mime, lastModified: Date.now() });
      } catch (_) {
        // Safari ancien : File constructor peut manquer -> renvoyer un Blob avec name.
        compressed = blob;
        try { compressed.name = newName; } catch (__) {}
      }
      try {
        var pct = origSize > 0 ? Math.round((1 - blob.size / origSize) * 100) : 0;
        // eslint-disable-next-line no-console
        console.info('[storage] Compression ' + (file.name || '?') + ': '
          + _formatBytes(origSize) + ' -> ' + _formatBytes(blob.size)
          + (pct > 0 ? ' (-' + pct + '%)' : ''));
      } catch (_) {}
      return compressed;
    } catch (e) {
      try { console.warn('[storage] compressImage failed, fallback original:', e && e.message); } catch (_) {}
      return file;
    }
  }

  /**
   * Genere une vignette (max 400 px cote long, quality 0.7 par defaut).
   * Retourne un File JPEG (suffixe _thumb).
   */
  async function makeThumbnail(file, options) {
    if (!_isImageFile(file)) return null;
    var opts = Object.assign({}, THUMBNAIL_DEFAULTS, options || {});
    try {
      var canvas = await _loadIntoCanvas(file, opts.maxDim);
      var blob = await _canvasToBlob(canvas, opts.mime, opts.quality);
      if (!blob) return null;
      var base = String(file.name || 'image').replace(/\.[a-zA-Z0-9]+$/, '');
      var ext = (opts.mime === 'image/webp') ? 'webp' : 'jpg';
      var name = base + '_thumb.' + ext;
      try {
        return new File([blob], name, { type: opts.mime, lastModified: Date.now() });
      } catch (_) {
        try { blob.name = name; } catch (__) {}
        return blob;
      }
    } catch (e) {
      try { console.warn('[storage] makeThumbnail failed:', e && e.message); } catch (_) {}
      return null;
    }
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

    // Compression auto : seulement pour les buckets cibles, et seulement si
    // le caller n'a pas explicitement demande skipCompression. Les non-images
    // (PDF en particulier) sont automatiquement bypasses dans compressImage().
    var skip = options.skipCompression === true;
    delete options.skipCompression;
    var compressOpts = options.compressOptions || null;
    delete options.compressOptions;

    var payload = blob;
    if (!skip && AUTO_COMPRESS_BUCKETS[bucket] && _isImageFile(blob)) {
      var compressed = await compressImage(blob, compressOpts);
      if (compressed && compressed !== blob) {
        payload = compressed;
        // Si le contentType n'a pas ete force par le caller, on aligne sur le
        // mime du blob compresse (image/jpeg dans la majorite des cas).
        if (!opts || !opts.contentType) {
          options.contentType = compressed.type || options.contentType;
        }
      }
    }

    var res = await client.storage.from(bucket).upload(path, payload, options);
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, path: path, fullPath: res.data && res.data.path || path };
  }

  /**
   * Helper haut-niveau : compresse + upload en un appel.
   * Identique a uploadBlob mais force la compression meme pour les buckets non
   * listes dans AUTO_COMPRESS_BUCKETS.
   */
  async function compressAndUpload(bucket, path, fileOrBlob, opts) {
    if (!fileOrBlob) return { ok: false, error: { message: 'Fichier manquant' } };
    var options = Object.assign({}, opts || {});
    var compressOpts = options.compressOptions || null;
    var payload = fileOrBlob;
    if (_isImageFile(fileOrBlob) && options.skipCompression !== true) {
      var compressed = await compressImage(fileOrBlob, compressOpts);
      if (compressed) payload = compressed;
    }
    // On a deja compresse manuellement -> evite la double passe dans uploadBlob.
    options.skipCompression = true;
    return await uploadBlob(bucket, path, payload, options);
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
