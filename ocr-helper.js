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

  const TESSERACT_CDN = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
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

  async function ensureLoaded() {
    if (_loaded) return;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = (async () => {
      await loadScript(TESSERACT_CDN);
      if (typeof Tesseract === 'undefined') throw new Error('Tesseract non disponible');
      _worker = await Tesseract.createWorker('fra', 1, {
        // logger optionnel, peut etre branche pour afficher progress
      });
      _loaded = true;
    })();
    try {
      await _loadingPromise;
    } finally {
      _loadingPromise = null;
    }
  }

  async function recognize(input, opts = {}) {
    await ensureLoaded();
    if (opts.onProgress && _worker) {
      // Le worker recree avec un logger custom n'est pas trivial dans v5.
      // Pour l'instant on fait juste l'appel basique, le user voit "..." pendant.
    }
    const { data } = await _worker.recognize(input);
    return { text: data.text || '', confidence: data.confidence || 0 };
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
