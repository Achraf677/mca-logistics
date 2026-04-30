/**
 * MCA Logistics — Tests de regles metier critiques
 *
 * Tests rapides node:test (sans browser, sans DB) sur les fonctions pures
 * critiques. Pour les tests E2E (avec navigateur + DB), voir tests/e2e/.
 *
 * Lancer : node --test tests/business-rules.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Validation SIREN (CGI art. 289 II)
// ============================================================
/**
 * Valide un SIREN francais (9 chiffres, algorithme de Luhn).
 * @param {string} siren - Le numero SIREN (espaces toleres).
 * @returns {boolean} true si SIREN valide.
 * @example validerSIREN('552120222') // -> true
 */
function validerSIREN(siren) {
  if (typeof siren !== 'string') return false;
  var s = siren.replace(/\s+/g, '');
  if (!/^\d{9}$/.test(s)) return false;
  // Algorithme de Luhn pour SIREN
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    var d = parseInt(s[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

test('validerSIREN : 9 chiffres avec Luhn valide', () => {
  // 552120222 = SIREN Renault (test)
  assert.equal(validerSIREN('552120222'), true);
  assert.equal(validerSIREN('552 120 222'), true); // espaces tolerees
});

test('validerSIREN : refuse les SIREN invalides', () => {
  assert.equal(validerSIREN(''), false);
  assert.equal(validerSIREN('12345'), false);
  assert.equal(validerSIREN('1234567890'), false); // 10 chiffres
  assert.equal(validerSIREN('123456789'), false); // pas Luhn
  assert.equal(validerSIREN('abcdefghi'), false);
  assert.equal(validerSIREN(null), false);
  assert.equal(validerSIREN(undefined), false);
});

// ============================================================
// Validation TVA intracom FR (cle = (12 + 3 * (SIREN mod 97)) mod 97)
// ============================================================
function validerTVAIntracomFR(tva) {
  if (typeof tva !== 'string') return { valid: false, message: 'format' };
  var t = tva.replace(/\s+/g, '').toUpperCase();
  if (!/^FR\d{2}\d{9}$/.test(t)) return { valid: false, message: 'format' };
  var cle = parseInt(t.slice(2, 4), 10);
  var siren = t.slice(4);
  if (!validerSIREN(siren)) return { valid: false, message: 'siren invalide' };
  var expectedCle = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  if (cle !== expectedCle) return { valid: false, message: 'cle invalide' };
  return { valid: true };
}

test('validerTVAIntracomFR : TVA valide', () => {
  // FR + cle (44) + SIREN Renault valide
  // (12 + 3 * (552120222 % 97)) % 97 = ?
  var siren = '552120222';
  var sirenMod = parseInt(siren, 10) % 97;
  var cle = (12 + 3 * sirenMod) % 97;
  var tva = 'FR' + String(cle).padStart(2, '0') + siren;
  assert.equal(validerTVAIntracomFR(tva).valid, true);
});

test('validerTVAIntracomFR : refuse TVA mal formees', () => {
  assert.equal(validerTVAIntracomFR('').valid, false);
  assert.equal(validerTVAIntracomFR('FR').valid, false);
  assert.equal(validerTVAIntracomFR('FR12').valid, false);
  assert.equal(validerTVAIntracomFR('FR12123456789').valid, false); // mauvaise cle ou SIREN invalide
  assert.equal(validerTVAIntracomFR('XX12552120222').valid, false); // pas FR
});

// ============================================================
// Calcul TVA carburant deductible (CGI art. 298-4)
// ============================================================
function calculerTauxTVACarburant(genre, carburant) {
  // Genre VP (Voiture Particuliere) : 80% pour gazole/E85, 0% pour essence
  // Genre CTTE/N1/utilitaire : 100%
  var g = (genre || '').toUpperCase();
  var c = (carburant || '').toLowerCase();
  if (g === 'VP') {
    if (c === 'essence' || c === 'sp95' || c === 'sp98') return 0;
    if (c === 'gazole' || c === 'diesel' || c === 'gnv') return 80;
    if (c === 'electrique' || c === 'hybride') return 100;
    return 80; // default VP
  }
  if (['CTTE', 'CT', 'N1', 'N2', 'CAM', 'TCP'].includes(g)) return 100;
  return 100; // par defaut (vehicule professionnel)
}

test('calculerTauxTVACarburant : VP essence = 0%', () => {
  assert.equal(calculerTauxTVACarburant('VP', 'essence'), 0);
  assert.equal(calculerTauxTVACarburant('VP', 'sp95'), 0);
  assert.equal(calculerTauxTVACarburant('VP', 'sp98'), 0);
});

test('calculerTauxTVACarburant : VP gazole = 80%', () => {
  assert.equal(calculerTauxTVACarburant('VP', 'gazole'), 80);
  assert.equal(calculerTauxTVACarburant('VP', 'diesel'), 80);
});

test('calculerTauxTVACarburant : CTTE/N1 = 100%', () => {
  assert.equal(calculerTauxTVACarburant('CTTE', 'gazole'), 100);
  assert.equal(calculerTauxTVACarburant('N1', 'essence'), 100);
});

test('calculerTauxTVACarburant : VP electrique = 100%', () => {
  assert.equal(calculerTauxTVACarburant('VP', 'electrique'), 100);
  assert.equal(calculerTauxTVACarburant('VP', 'hybride'), 100);
});

// ============================================================
// Calculs HT/TTC/TVA
// ============================================================
function getMontantHTFromTTC(ttc, tauxTVA) {
  var total = Number(ttc) || 0;
  var rate = Number(tauxTVA) || 0;
  return Math.round((rate > 0 ? total / (1 + rate / 100) : total) * 100) / 100;
}

test('getMontantHTFromTTC : TVA 20% standard', () => {
  assert.equal(getMontantHTFromTTC(120, 20), 100);
  assert.equal(getMontantHTFromTTC(1200, 20), 1000);
});

test('getMontantHTFromTTC : TVA 10% restauration', () => {
  assert.equal(getMontantHTFromTTC(110, 10), 100);
});

test('getMontantHTFromTTC : 0% TVA', () => {
  assert.equal(getMontantHTFromTTC(100, 0), 100);
});

test('getMontantHTFromTTC : valeurs invalides retournent valeurs safe', () => {
  assert.equal(getMontantHTFromTTC(NaN, 20), 0);
  assert.equal(getMontantHTFromTTC(null, 20), 0);
  assert.equal(getMontantHTFromTTC(120, null), 120); // pas de TVA -> ttc = ht
});

// ============================================================
// Sanitize filename (Storage)
// ============================================================
function sanitizeFilename(name) {
  var s = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (s.length > 100) s = s.slice(-100);
  return s || 'file';
}

test('sanitizeFilename : caracteres speciaux remplaces', () => {
  assert.equal(sanitizeFilename('Carte Grise (1).pdf'), 'Carte_Grise__1_.pdf');
  assert.equal(sanitizeFilename('photo né&à#?.jpg'), 'photo_n_____.jpg');
  assert.equal(sanitizeFilename(''), 'file');
});

test('sanitizeFilename : longueur max 100', () => {
  var long = 'a'.repeat(150) + '.jpg';
  var clean = sanitizeFilename(long);
  assert.equal(clean.length <= 100, true);
});

// ============================================================
// UUID validation
// ============================================================
function isUuidLike(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

test('isUuidLike : UUID v4 valide', () => {
  assert.equal(isUuidLike('6c10b71d-8d2f-4de0-bf09-29abe101ccd1'), true);
  assert.equal(isUuidLike('00000000-0000-0000-0000-000000000000'), true);
});

test('isUuidLike : refuse les non-UUID', () => {
  assert.equal(isUuidLike(''), false);
  assert.equal(isUuidLike('id_xxx'), false);
  assert.equal(isUuidLike('123'), false);
  assert.equal(isUuidLike(null), false);
  assert.equal(isUuidLike(undefined), false);
});
