/**
 * MCA Logistics — OCR Helper (Tesseract.js wrapper, gratuit + offline)
 *
 * Lazy loader pour Tesseract.js (chargé on-demand depuis CDN unpkg).
 * Premier appel : ~4 Mo de modèle FR téléchargés + cachés via service worker.
 * Appels suivants : OCR local en 1-3s.
 *
 * Parsers spécialisés : carte grise FR, facture FR, RIB FR.
 *
 * Expose window.MCAocr = {
 *   isReady() -> bool
 *   ensureLoaded() -> Promise<void>  // charge Tesseract si pas déjà fait
 *   recognize(imageFile|HTMLCanvas|HTMLImageElement) -> Promise<{text, confidence}>
 *   parseCarteGrise(text) -> {immat, marque, modele, vin, dateMEC, puissance}
 *   parseFacture(text) -> {fournisseur, numFacture, date, ht, tva, ttc}
 *   parseRIB(text) -> {iban, bic, titulaire}
 *   parsePermis(text) -> {numero, dateDelivrance, dateExpiration, categories}
 * }
 */
(function () {
  'use strict';

  if (window.MCAocr) return;

  // Fallback CDN list : jsdelivr en 1er (plus fiable, déjà autorisé en CSP/SW),
  // unpkg en backup. Le 1er qui charge gagne.
  const TESSERACT_CDNS = [
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'
  ];
  let _loaded = false;
  let _loadingPromise = null;
  let _worker = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadAnyCDN(urls) {
    let lastErr = null;
    for (const url of urls) {
      try { await loadScript(url); return; }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Aucun CDN disponible pour Tesseract');
  }

  // Logger verbose : permet d'afficher chaque étape du chargement OCR dans
  // l'UI mobile (le user n'a pas accès à la console iOS Safari).
  // Brancher via window.MCAocr._onLog = (msg) => domEl.textContent = msg;
  function ocrLog(msg) {
    try {
      if (window.MCAocr && typeof window.MCAocr._onLog === 'function') {
        window.MCAocr._onLog(msg);
      } else {
        console.log('[OCR]', msg);
      }
    } catch (_) {}
  }

  async function ensureLoaded() {
    if (_loaded) return;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = (async () => {
      ocrLog('1/4 chargement script CDN...');
      try { await loadAnyCDN(TESSERACT_CDNS); }
      catch (e) { throw new Error('CDN bloqué : ' + (e?.message || 'load failed')); }
      ocrLog('2/4 script chargé (Tesseract=' + (typeof Tesseract) + ')');
      if (typeof Tesseract === 'undefined') throw new Error('Tesseract.min.js non disponible (script chargé mais window.Tesseract absent)');
      ocrLog('3/4 createWorker fra...');
      try {
        _worker = await Tesseract.createWorker('fra', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
          logger: m => ocrLog((m.status || 'progress') + ' ' + Math.round((m.progress || 0) * 100) + '%'),
          errorHandler: e => ocrLog('ERR worker : ' + (e?.message || e?.name || 'inconnu')),
        });
      } catch (e) {
        const detail = e?.message || e?.name || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        throw new Error('createWorker a échoué : ' + (detail || 'erreur silencieuse iOS (CSP worker-src ?)'));
      }
      ocrLog('4/4 worker prêt ✅');
      _loaded = true;
    })();
    try {
      await _loadingPromise;
    } finally {
      _loadingPromise = null;
    }
  }

  async function recognize(input, opts = {}) {
    // Support PDF : extrait texte natif si PDF bureautique, sinon render
    // page 1 en canvas + OCR.
    if (input instanceof File && input.type === 'application/pdf') {
      return await recognizePDF(input, opts);
    }
    await ensureLoaded();
    const { data } = await _worker.recognize(input);
    return { text: data.text || '', confidence: data.confidence || 0 };
  }

  // PDF.js lazy-loader (gratuit, offline une fois chargé)
  const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs';
  let _pdfjsLoaded = false;
  async function ensurePdfJs() {
    if (_pdfjsLoaded) return;
    if (window.pdfjsLib) { _pdfjsLoaded = true; return; }
    // pdfjs-dist v4 est en module ESM, on l'importe dynamiquement
    const mod = await import(PDFJS_CDN);
    mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    window.pdfjsLib = mod;
    _pdfjsLoaded = true;
  }

  async function recognizePDF(file, opts = {}) {
    await ensurePdfJs();
    const arrayBuf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuf }).promise;
    const nbPages = Math.min(pdf.numPages, opts.maxPages || 5); // limite 5 pages
    let allText = '';
    let needsOcr = false;
    // Étape 1 : tente extraction texte natif (PDF bureautique)
    for (let i = 1; i <= nbPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(it => it.str).join(' ');
      allText += pageText + '\n';
    }
    // Si on a moins de 50 chars de texte, c'est probablement un PDF scanné -> OCR
    if (allText.trim().length < 50) {
      needsOcr = true;
      allText = '';
      await ensureLoaded(); // charge Tesseract
      for (let i = 1; i <= nbPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // x2 pour bonne qualité OCR
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        const { data } = await _worker.recognize(canvas);
        allText += (data.text || '') + '\n';
      }
    }
    return { text: allText, confidence: needsOcr ? 70 : 100, source: needsOcr ? 'ocr' : 'native' };
  }

  // --------- Parsers spécialisés ---------

  // Carte grise FR — extraction des champs clés (codes Cerfa B/D.1/D.3/E/J/A)
  function parseCarteGrise(text) {
    const out = { immat: '', marque: '', modele: '', vin: '', dateMEC: '', puissance: '' };
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const join = lines.join('\n');

    // Immatriculation : format AA-123-BB ou AA123BB (ancienne)
    const mImmat = join.match(/[A-Z]{2}[\s-]?\d{3}[\s-]?[A-Z]{2}/i);
    if (mImmat) out.immat = mImmat[0].replace(/\s/g, '').toUpperCase();

    // VIN : 17 caractères alphanumériques
    const mVin = join.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    if (mVin) out.vin = mVin[1].toUpperCase();

    // Date 1ère MEC : code B (date au format JJ/MM/AAAA)
    const mDateMEC = join.match(/\bB\s*[:.]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i)
      || join.match(/(\d{2}[\/.-]\d{2}[\/.-]\d{4})/);
    if (mDateMEC) {
      const parts = mDateMEC[1].split(/[\/.-]/);
      out.dateMEC = parts[2] + '-' + parts[1] + '-' + parts[0]; // ISO
    }

    // Marque : code D.1 (Renault, Peugeot...)
    const mMarque = join.match(/\bD\.?1\s*[:.]?\s*([A-Z][A-Z\s-]{2,20})/i);
    if (mMarque) out.marque = mMarque[1].trim();

    // Modèle : code D.3
    const mModele = join.match(/\bD\.?3\s*[:.]?\s*([A-Z0-9][A-Z0-9\s-]{1,30})/i);
    if (mModele) out.modele = mModele[1].trim();

    // Puissance fiscale : code P.6 (en CV)
    const mPuiss = join.match(/\bP\.?6\s*[:.]?\s*(\d{1,2})/i);
    if (mPuiss) out.puissance = mPuiss[1];

    return out;
  }

  // Facture FR — fournisseur (header), n° facture, date, montants HT/TVA/TTC
  function parseFacture(text) {
    const out = { fournisseur: '', numFacture: '', date: '', ht: 0, tva: 0, ttc: 0, tauxTva: 20 };
    const lines = text.split(/\r?\n/).map(l => l.trim());

    // Fournisseur : 1ère ligne non vide qui n'est pas "FACTURE"
    const headerLines = lines.slice(0, 8).filter(l => l && !/^facture/i.test(l) && !/siret|tva|tel|email/i.test(l));
    if (headerLines.length) out.fournisseur = headerLines[0].slice(0, 60);

    // N° facture : "Facture N°" ou "N° XXX"
    const mNum = text.match(/(?:facture\s*(?:n[°o]?|num)|n[°o])\s*[:.]?\s*([A-Z0-9-/]{2,20})/i);
    if (mNum) out.numFacture = mNum[1];

    // Date facture
    const mDate = text.match(/(?:date|le)\s*[:.]?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i)
      || text.match(/(\d{2}[\/.-]\d{2}[\/.-]\d{4})/);
    if (mDate) {
      const parts = mDate[1].split(/[\/.-]/);
      out.date = parts[2] + '-' + parts[1] + '-' + parts[0];
    }

    // TTC : "Total TTC" ou "Net à payer" ou "TOTAL"
    const mTtc = text.match(/(?:total\s+ttc|net\s+(?:à|a)\s+payer|montant\s+ttc)\s*[:.]?\s*([\d\s.,]+)\s*€?/i);
    if (mTtc) out.ttc = parseMoney(mTtc[1]);

    // HT : "Total HT" ou "HT"
    const mHt = text.match(/(?:total\s+ht|montant\s+ht|sous-?total)\s*[:.]?\s*([\d\s.,]+)\s*€?/i);
    if (mHt) out.ht = parseMoney(mHt[1]);

    // TVA : "TVA 20%" ou "Total TVA"
    const mTva = text.match(/(?:total\s+)?tva\s*(?:\(?(\d{1,2}(?:[.,]\d)?)\s*%\)?)?\s*[:.]?\s*([\d\s.,]+)\s*€?/i);
    if (mTva) {
      if (mTva[1]) out.tauxTva = parseFloat(mTva[1].replace(',', '.'));
      out.tva = parseMoney(mTva[2]);
    }

    // Reconstitue HT/TVA depuis TTC si manquants
    if (out.ttc > 0 && out.ht === 0 && out.tva === 0) {
      out.ht = +(out.ttc / (1 + out.tauxTva / 100)).toFixed(2);
      out.tva = +(out.ttc - out.ht).toFixed(2);
    } else if (out.ttc > 0 && out.ht > 0 && out.tva === 0) {
      out.tva = +(out.ttc - out.ht).toFixed(2);
    }
    return out;
  }

  // RIB FR — IBAN (FR + 25 chiffres avec espaces) + BIC (8-11 caractères)
  function parseRIB(text) {
    const out = { iban: '', bic: '', titulaire: '' };
    // IBAN FR : FR76 1234 5678 ... (27 caractères au total avec FR)
    const mIban = text.replace(/\s/g, '').match(/FR\d{2}[A-Z0-9]{23}/i);
    if (mIban) {
      out.iban = mIban[0].toUpperCase().replace(/(.{4})/g, '$1 ').trim();
    }
    // BIC : 8 ou 11 caractères, lettres+chiffres
    const mBic = text.match(/\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\b/);
    if (mBic) out.bic = mBic[0];
    // Titulaire : 1ère ligne non vide en haut
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const t = lines.find(l => l.length > 3 && !/iban|bic|rib|banque|code/i.test(l));
    if (t) out.titulaire = t.slice(0, 60);
    return out;
  }

  // Permis de conduire FR — n°, date délivrance, expiration, catégories
  function parsePermis(text) {
    const out = { numero: '', dateDelivrance: '', dateExpiration: '', categories: [] };
    // Numéro permis : 12 caractères alphanumériques (nouveau format)
    const mNum = text.match(/\b\d{2}[A-Z]{2}\d{5}\b/i) || text.match(/\b[A-Z0-9]{12,15}\b/i);
    if (mNum) out.numero = mNum[0].toUpperCase();
    // Catégories : B, C, D, BE, etc. (lettres seules ou avec E)
    const mCats = text.match(/\b(A1?|A2|B[E1]?|C[E1]?|D[E1]?)\b/g);
    if (mCats) out.categories = [...new Set(mCats)];
    // Dates au format JJ.MM.AAAA ou JJ/MM/AAAA
    const dates = (text.match(/\d{2}[\/.-]\d{2}[\/.-]\d{4}/g) || []).map(d => {
      const p = d.split(/[\/.-]/);
      return p[2] + '-' + p[1] + '-' + p[0];
    });
    // Heuristique : 1ère date = délivrance, dernière = expiration
    if (dates.length >= 1) out.dateDelivrance = dates[0];
    if (dates.length >= 2) out.dateExpiration = dates[dates.length - 1];
    return out;
  }

  function parseMoney(s) {
    if (!s) return 0;
    // FR : "1 234,56" ou "1.234,56" -> 1234.56
    let clean = String(s).replace(/\s|€/g, '');
    // Si 2 séparateurs, le dernier est décimal
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      clean = clean.replace(/,/g, '');
    }
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  window.MCAocr = {
    isReady: () => _loaded,
    ensureLoaded: ensureLoaded,
    recognize: recognize,
    parseCarteGrise: parseCarteGrise,
    parseFacture: parseFacture,
    parseRIB: parseRIB,
    parsePermis: parsePermis,
  };
})();
