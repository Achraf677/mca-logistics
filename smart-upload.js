/**
 * MCA Logistics — Smart Upload (drop unique : OCR + Storage en parallele)
 *
 * Avant : pour ajouter une carte grise / facture / RIB, l'admin uploadait DEUX
 * fois — une pour OCR (pre-remplit le form) + une pour la conservation (Storage).
 * Apres : un seul drop -> les deux operations partent en parallele, le form se
 * remplit + un badge passe au vert quand le doc est conserve. Si l'OCR echoue,
 * on garde quand meme le doc en Storage (et inversement).
 *
 * API publique :
 *
 *   window.SmartUpload.attachToInput(input, options)
 *   window.SmartUpload.processFile(file, options)
 *   window.SmartUpload.routeByType(result, ctx)  // helper : map type_detecte -> fields
 *
 * options = {
 *   mode             : 'auto' | 'facture' | 'ticket_carburant' | 'rib' | 'carte_grise' | 'permis'
 *                       (defaut: 'auto' — Gemini detecte le type + extrait en 1 appel)
 *   storageBucket    : nom du bucket Supabase (ex: 'salaries-docs')
 *   storagePath      : (file) => string  // construit le path Storage
 *   onOcrResult      : (result) => void  // payload OCR (cf. forme ci-dessous)
 *   onUploaded       : (info) => void    // { path, bucket, contentType, name, size }
 *   onError          : (err) => void     // erreur fatale (les 2 brins ont rate)
 *   onProgress       : (status) => void  // 'compress'|'ocr_start'|'ocr_done'|'ocr_failed'|'storage_start'|'storage_done'|'storage_failed'|'done'
 *   feedbackEl       : HTMLElement|null  // si fourni, on y rend une UI standard
 *   skipOcr          : bool              // force aucun appel OCR (juste storage)
 *   skipStorage      : bool              // force aucun appel storage (juste OCR)
 * }
 *
 * Forme du payload onOcrResult :
 *   - mode 'auto' : { type_detecte: 'facture'|'ticket_carburant'|'rib'|'carte_grise'|'permis'|'autre',
 *                     confidence: 'haute'|'moyenne'|'basse'|null,
 *                     data: { ...champs specifiques au type detecte } }
 *   - mode specifique (facture, rib, ...) : payload "data" pre-sanitize directement
 *     (retrocompat : on conserve l'ancienne signature pour les callers existants).
 *
 * Comportement :
 *   - upload Storage et appel OCR partent en `Promise.all`-like (independants).
 *   - chaque brin reussit ou echoue independamment ; au moins un succes => OK.
 *   - le file input n'est PAS reset auto (laisse le caller re-uploader si besoin).
 *   - si feedbackEl fourni, l'UI standard est ecrite dedans (badges colores).
 *
 * IMPORTANT : a charger APRES storage-uploader.js, supabase-client.js,
 * security-utils.js (pour escapeHtml) et AVANT les scripts de domaine.
 */
(function () {
  'use strict';

  if (window.SmartUpload) return;

  var OCR_ENDPOINT = '/functions/v1/ai-ocr';
  var OCR_TIMEOUT_MS = 60000;
  var MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB cap aligne sur edge fn (PDF)

  // Modes connus de l'edge fn ai-ocr. "auto" = detection type + extraction en 1
  // appel (Phase 1 mode auto, ajout 2026-05-09). Les modes specifiques restent
  // supportes pour retrocompat des callers existants (script-ai-chat.js).
  var KNOWN_MODES = {
    auto: true,
    facture: true,
    ticket_carburant: true,
    rib: true,
    carte_grise: true,
    permis: true,
  };
  var DEFAULT_MODE = 'auto';

  function escapeHtml(s) {
    if (window.MCASecurity && typeof window.MCASecurity.escapeHtml === 'function') {
      return window.MCASecurity.escapeHtml(s);
    }
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isImage(file) {
    return !!(file && typeof file.type === 'string' && file.type.indexOf('image/') === 0);
  }
  function isPdf(file) {
    if (!file) return false;
    if (file.type === 'application/pdf') return true;
    return /\.pdf$/i.test(file.name || '');
  }

  function getSupabaseClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient() : null;
  }
  function getSupabaseConfig() {
    return window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig() : null;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var commaIdx = result.indexOf(',');
        if (commaIdx < 0) return reject(new Error('Lecture fichier echouee'));
        resolve(result.slice(commaIdx + 1));
      };
      reader.onerror = function () { reject(new Error('Lecture fichier echouee')); };
      reader.readAsDataURL(file);
    });
  }

  // Compresse l'image avant OCR pour reduire le payload (et donc le cout Gemini).
  // Skip pour PDF (Gemini lit en natif jusqu'a 1000 pages).
  async function compressForOcr(file) {
    if (!file || isPdf(file) || !isImage(file)) return file;
    if (!window.DelivProStorage || typeof window.DelivProStorage.compressImage !== 'function') {
      return file;
    }
    try {
      return await window.DelivProStorage.compressImage(file, {
        maxDim: 1600,
        quality: 0.82,
        skipUnderBytes: 1024 * 1024,
        mime: 'image/jpeg',
      });
    } catch (_) { return file; }
  }

  // Recupere un access token frais (refresh si <60s d'expiration).
  async function getAccessToken() {
    var client = getSupabaseClient();
    if (!client) throw new Error('Supabase pas pret');
    try {
      var sessionData = await client.auth.getSession();
      var sess = sessionData && sessionData.data && sessionData.data.session;
      if (!sess) throw new Error('Session expiree, reconnecte-toi.');
      var expAt = sess.expires_at ? sess.expires_at * 1000 : 0;
      if (expAt && expAt - Date.now() < 60000) {
        try {
          var refreshed = await client.auth.refreshSession();
          var rsess = refreshed && refreshed.data && refreshed.data.session;
          return rsess ? rsess.access_token : sess.access_token;
        } catch (_) { return sess.access_token; }
      }
      return sess.access_token;
    } catch (e) {
      if (e && e.message) throw e;
      throw new Error('Session expiree, reconnecte-toi.');
    }
  }

  // Appelle l'edge fn ai-ocr. Retourne { ok, data, error }.
  async function callOcr(file, mode) {
    if (!KNOWN_MODES[mode]) {
      return { ok: false, error: { message: 'mode OCR inconnu: ' + mode } };
    }
    var compressed;
    try { compressed = await compressForOcr(file); } catch (_) { compressed = file; }
    var base64 = await fileToBase64(compressed);
    var mime = compressed.type || file.type || (isPdf(file) ? 'application/pdf' : 'image/jpeg');

    var token;
    try { token = await getAccessToken(); }
    catch (e) { return { ok: false, error: { message: e && e.message ? e.message : String(e) } }; }
    if (!token) return { ok: false, error: { message: 'Session expiree' } };

    var config = getSupabaseConfig();
    var baseUrl = config && config.url ? config.url : '';
    if (!baseUrl) return { ok: false, error: { message: 'Supabase URL manquante' } };

    var ctrl = new AbortController();
    var timeoutId = setTimeout(function () { ctrl.abort(); }, OCR_TIMEOUT_MS);
    try {
      var r = await fetch(baseUrl + OCR_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_base64: base64, mime: mime, mode: mode }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      var body = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        return { ok: false, error: { message: body.error || body.message || ('HTTP ' + r.status), hint: body.hint } };
      }
      if (body && body.success === false) {
        return { ok: false, error: { message: body.error || 'Echec extraction', hint: body.hint } };
      }
      // En mode auto, on retourne aussi type_detecte + confidence au caller
      // (via raw). Pour les modes specifiques, raw.type_detecte sera undefined.
      return {
        ok: true,
        data: (body && body.data) || {},
        type_detecte: body && body.type_detecte ? body.type_detecte : null,
        confidence: body && body.confidence ? body.confidence : null,
        raw: body,
      };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e && e.name === 'AbortError') {
        return { ok: false, error: { message: 'Timeout OCR (' + Math.round(OCR_TIMEOUT_MS / 1000) + 's)' } };
      }
      return { ok: false, error: { message: 'Reseau OCR indisponible' } };
    }
  }

  // Upload Storage. Retourne { ok, path, contentType, ... }.
  async function callStorage(file, bucket, pathFn) {
    if (!window.DelivProStorage) {
      return { ok: false, error: { message: 'Storage indisponible' } };
    }
    if (!bucket) return { ok: false, error: { message: 'Bucket manquant' } };
    var path;
    try { path = (typeof pathFn === 'function') ? pathFn(file) : String(pathFn || ''); }
    catch (e) { return { ok: false, error: { message: 'storagePath() throw: ' + (e && e.message) } }; }
    if (!path) return { ok: false, error: { message: 'Storage path vide' } };
    try {
      var up = await window.DelivProStorage.uploadBlob(bucket, path, file, { contentType: file.type });
      if (!up.ok) return { ok: false, error: up.error || { message: 'upload echec' } };
      return {
        ok: true,
        path: up.path || path,
        bucket: bucket,
        contentType: file.type,
        name: file.name,
        size: file.size,
      };
    } catch (e) {
      return { ok: false, error: { message: e && e.message ? e.message : String(e) } };
    }
  }

  // ---------- UI feedback (optionnel, si feedbackEl fourni) ----------

  function buildFeedbackUI(feedbackEl) {
    if (!feedbackEl) return null;
    feedbackEl.classList.add('smart-upload-feedback');
    feedbackEl.innerHTML =
      '<span class="smart-upload-spinner" aria-hidden="true"></span>' +
      '<span class="smart-upload-status">Pret a uploader…</span>' +
      '<span class="smart-upload-pills">' +
        '<span class="smart-upload-pill smart-upload-pill-ocr" data-state="idle">🤖 OCR</span>' +
        '<span class="smart-upload-pill smart-upload-pill-storage" data-state="idle">💾 Conservation</span>' +
      '</span>';
    return {
      root: feedbackEl,
      status: feedbackEl.querySelector('.smart-upload-status'),
      ocrPill: feedbackEl.querySelector('.smart-upload-pill-ocr'),
      storagePill: feedbackEl.querySelector('.smart-upload-pill-storage'),
      spinner: feedbackEl.querySelector('.smart-upload-spinner'),
    };
  }

  function updatePill(el, state, label) {
    if (!el) return;
    el.setAttribute('data-state', state);
    if (label) el.textContent = label;
  }

  // ---------- Coeur : processFile orchestre OCR + Storage en parallele ----------

  async function processFile(file, options) {
    options = options || {};
    // Defaut: mode 'auto' (detection type + extraction unifie). Les callers qui
    // veulent forcer un type specifique passent explicitement options.mode.
    var mode = options.mode || DEFAULT_MODE;
    var bucket = options.storageBucket || null;
    var pathFn = options.storagePath || null;
    var fbUI = options.feedbackEl ? buildFeedbackUI(options.feedbackEl) : null;
    var emit = function (status) {
      if (typeof options.onProgress === 'function') {
        try { options.onProgress(status); } catch (_) {}
      }
    };

    if (!file) {
      var err = new Error('Aucun fichier fourni');
      if (typeof options.onError === 'function') options.onError(err);
      throw err;
    }
    if (file.size > MAX_FILE_BYTES) {
      var errSize = new Error('Fichier trop lourd (' + (file.size / 1024 / 1024).toFixed(1) + ' MB > ' + (MAX_FILE_BYTES / 1024 / 1024) + ' MB)');
      if (fbUI) {
        fbUI.root.setAttribute('data-state', 'error');
        if (fbUI.status) fbUI.status.textContent = '❌ ' + errSize.message;
      }
      if (typeof options.onError === 'function') options.onError(errSize);
      throw errSize;
    }

    var okType = isImage(file) || isPdf(file);
    if (!okType) {
      var errType = new Error('Format non supporte (image ou PDF attendu)');
      if (fbUI) {
        fbUI.root.setAttribute('data-state', 'error');
        if (fbUI.status) fbUI.status.textContent = '❌ ' + errType.message;
      }
      if (typeof options.onError === 'function') options.onError(errType);
      throw errType;
    }

    if (fbUI) {
      fbUI.root.setAttribute('data-state', 'busy');
      if (fbUI.status) fbUI.status.textContent = '📤 Envoi en cours…';
      updatePill(fbUI.ocrPill, options.skipOcr ? 'skipped' : 'busy', options.skipOcr ? '⊘ OCR' : '🤖 OCR…');
      updatePill(fbUI.storagePill, options.skipStorage ? 'skipped' : 'busy', options.skipStorage ? '⊘ Stockage' : '💾 Stockage…');
    }
    emit('start');

    // Lance les 2 brins en parallele. Aucun n'est bloquant pour l'autre :
    // on attend les 2 promesses settled puis on dispatche les callbacks.
    var ocrPromise = options.skipOcr || !mode
      ? Promise.resolve({ ok: false, skipped: true })
      : (function () {
          emit('ocr_start');
          return callOcr(file, mode);
        })();

    var storagePromise = options.skipStorage || !bucket
      ? Promise.resolve({ ok: false, skipped: true })
      : (function () {
          emit('storage_start');
          return callStorage(file, bucket, pathFn);
        })();

    var results = await Promise.all([
      ocrPromise.catch(function (e) { return { ok: false, error: { message: e && e.message ? e.message : String(e) } }; }),
      storagePromise.catch(function (e) { return { ok: false, error: { message: e && e.message ? e.message : String(e) } }; }),
    ]);
    var ocrRes = results[0];
    var storageRes = results[1];

    // Dispatch OCR
    if (ocrRes.ok) {
      emit('ocr_done');
      updatePill(fbUI && fbUI.ocrPill, 'ok', '✅ OCR');
      if (typeof options.onOcrResult === 'function') {
        // Mode 'auto' : on passe { type_detecte, confidence, data } au callback.
        // Modes specifiques : retrocompat — on passe juste data (l'ancienne signature).
        var payload = (mode === 'auto')
          ? { type_detecte: ocrRes.type_detecte, confidence: ocrRes.confidence, data: ocrRes.data }
          : ocrRes.data;
        try { options.onOcrResult(payload); } catch (e) { console.warn('[smart-upload] onOcrResult:', e); }
      }
    } else if (ocrRes.skipped) {
      // rien a dire
    } else {
      emit('ocr_failed');
      updatePill(fbUI && fbUI.ocrPill, 'fail', '⚠️ OCR rate');
      console.warn('[smart-upload] OCR failed:', ocrRes.error);
    }

    // Dispatch Storage
    if (storageRes.ok) {
      emit('storage_done');
      updatePill(fbUI && fbUI.storagePill, 'ok', '✅ Conserve');
      if (typeof options.onUploaded === 'function') {
        try { options.onUploaded(storageRes); } catch (e) { console.warn('[smart-upload] onUploaded:', e); }
      }
    } else if (storageRes.skipped) {
      // rien a dire
    } else {
      emit('storage_failed');
      updatePill(fbUI && fbUI.storagePill, 'fail', '⚠️ Stockage rate');
      console.warn('[smart-upload] Storage failed:', storageRes.error);
    }

    // Etat global UI : tout vert si les 2 succes (ou skipped) ET au moins un actif
    var ocrOK = ocrRes.ok || ocrRes.skipped;
    var storageOK = storageRes.ok || storageRes.skipped;
    var allOk = ocrOK && storageOK && (ocrRes.ok || storageRes.ok);
    var anyOk = ocrRes.ok || storageRes.ok;

    if (fbUI) {
      if (allOk) {
        fbUI.root.setAttribute('data-state', 'ok');
        if (fbUI.status) fbUI.status.textContent = '✅ Tout est OK';
      } else if (anyOk) {
        fbUI.root.setAttribute('data-state', 'partial');
        var partialMsg = '⚠️ Partiel — ';
        if (storageRes.ok && !ocrRes.ok && !ocrRes.skipped) partialMsg += 'doc conserve, OCR rate (formulaire a remplir manuellement).';
        else if (ocrRes.ok && !storageRes.ok && !storageRes.skipped) partialMsg += 'OCR OK, doc non conserve (reessaye).';
        else partialMsg += 'voir details';
        if (fbUI.status) fbUI.status.textContent = partialMsg;
      } else {
        fbUI.root.setAttribute('data-state', 'error');
        var msg = '❌ Echec — ';
        if (storageRes.error && storageRes.error.message) msg += storageRes.error.message;
        else if (ocrRes.error && ocrRes.error.message) msg += ocrRes.error.message;
        else msg += 'inconnu';
        if (fbUI.status) fbUI.status.textContent = msg;
      }
    }

    emit('done');

    // Si les 2 ont rate, declenche onError. Sinon on est en succes ou partiel.
    if (!anyOk && (!ocrRes.skipped || !storageRes.skipped)) {
      var errAll = new Error('Upload echoue : ' +
        (storageRes.error && storageRes.error.message ? storageRes.error.message : '') +
        ' | ' + (ocrRes.error && ocrRes.error.message ? ocrRes.error.message : ''));
      if (typeof options.onError === 'function') options.onError(errAll);
    }

    return {
      ocr: ocrRes,
      storage: storageRes,
      anyOk: anyOk,
      allOk: allOk,
    };
  }

  // ---------- Helper : attache a un <input type="file"> ----------

  function attachToInput(input, options) {
    if (!input) return;
    if (input._smartUploadAttached) return; // idempotent
    input._smartUploadAttached = true;

    // Force accept image+pdf pour aligner les flows.
    if (!input.accept) input.accept = 'image/*,application/pdf';

    input.addEventListener('change', async function (e) {
      var file = e.target && e.target.files && e.target.files[0];
      if (!file) return;
      try {
        await processFile(file, options);
      } catch (_) {
        // onError deja appele dans processFile
      } finally {
        // Reset l'input pour permettre la re-selection du meme fichier
        try { e.target.value = ''; } catch (_) {}
      }
    });
  }

  // ---------- Helper : route le resultat 'auto' vers les bons champs de form ----------
  //
  // Recoit le payload onOcrResult mode auto ({ type_detecte, confidence, data })
  // et un contexte form ({ section: 'charges'|'salaries'|'vehicules'|'carburant' })
  // optionnel. Retourne :
  //   {
  //     fields_to_prefill : { ...mapping cle->valeur a appliquer au form... },
  //     target_section    : 'rib'|'permis'|'carte_grise'|'facture'|'ticket'|null,
  //     handled           : bool  // true si le type est exploitable, false si 'autre'
  //   }
  //
  // Les noms de champs renvoyes sont alignes sur les conventions MCA (snake_case
  // pour DB, le caller fait le mapping vers ses inputs HTML). Si le type n'est
  // pas pertinent pour la section, target_section reste null et handled=false.
  function routeByType(result, ctx) {
    ctx = ctx || {};
    if (!result || !result.type_detecte) {
      return { fields_to_prefill: {}, target_section: null, handled: false };
    }
    var t = String(result.type_detecte);
    var d = (result.data && typeof result.data === 'object') ? result.data : {};
    if (t === 'autre') {
      return { fields_to_prefill: {}, target_section: null, handled: false };
    }
    if (t === 'facture') {
      return {
        fields_to_prefill: {
          fournisseur_nom: d.fournisseur_nom || null,
          date: d.date_facture || null,
          montant_ttc: d.montant_ttc || null,
          montant_ht: d.montant_ht || null,
          taux_tva: d.taux_tva || null,
          num_facture: d.num_facture || null,
        },
        target_section: 'facture',
        handled: true,
      };
    }
    if (t === 'ticket_carburant') {
      return {
        fields_to_prefill: {
          station: d.station || null,
          date: d.date || null,
          litres: d.litres || null,
          prix_litre: d.prix_litre || null,
          montant_ttc: d.montant_ttc || null,
          type_carburant: d.type_carburant || null,
        },
        target_section: 'ticket',
        handled: true,
      };
    }
    if (t === 'rib') {
      return {
        fields_to_prefill: {
          titulaire: d.titulaire || null,
          iban: d.iban || null,
          bic: d.bic || null,
          banque: d.banque || null,
        },
        target_section: 'rib',
        handled: true,
      };
    }
    if (t === 'carte_grise') {
      return {
        fields_to_prefill: {
          immatriculation: d.immatriculation || null,
          vin: d.vin || null,
          marque: d.marque || null,
          modele: d.modele || null,
          date_premiere_immat: d.date_premiere_immat || null,
          puissance_fiscale: d.puissance_fiscale || null,
          carburant: d.carburant || null,
          ptac_kg: d.ptac_kg || null,
          genre: d.genre || null,
        },
        target_section: 'carte_grise',
        handled: true,
      };
    }
    if (t === 'permis') {
      return {
        fields_to_prefill: {
          numero: d.numero || null,
          nom: d.nom || null,
          prenom: d.prenom || null,
          date_naissance: d.date_naissance || null,
          date_delivrance: d.date_delivrance || null,
          date_expiration: d.date_expiration || null,
          categories: d.categories || null,
        },
        target_section: 'permis',
        handled: true,
      };
    }
    return { fields_to_prefill: {}, target_section: null, handled: false };
  }

  window.SmartUpload = {
    attachToInput: attachToInput,
    processFile: processFile,
    routeByType: routeByType,
    // Expose interne pour tests unitaires
    _internals: {
      callOcr: callOcr,
      callStorage: callStorage,
      isPdf: isPdf,
      isImage: isImage,
      KNOWN_MODES: KNOWN_MODES,
      DEFAULT_MODE: DEFAULT_MODE,
    },
  };
})();
