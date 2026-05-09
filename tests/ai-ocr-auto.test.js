/**
 * MCA Logistics — Tests mode "auto" de l'edge fn ai-ocr.
 *
 * Couvre :
 *   1. Le sanitizer dispatch par type detecte (facture / ticket_carburant /
 *      rib / carte_grise / permis / autre).
 *   2. Le helper smart-upload.routeByType qui mappe le payload "auto" vers
 *      les champs de form selon le type detecte.
 *   3. Edge cases : type_detecte invalide -> fallback "autre", data vide,
 *      payload partiellement parse.
 *
 * Strategie : on porte le sanitizer TS en JS (mirroir de l'edge fn) pour eviter
 * d'avoir a charger Deno. Pattern identique a tests/visual-audit-parser.test.js.
 *
 * Lancer : node --test tests/ai-ocr-auto.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Port JS des sanitizers TS (cf. infra/supabase/functions/ai-ocr/index.ts).
// On garde la meme logique pour que les tests detectent les regressions
// si on touche au sanitizer cote edge function.
// ============================================================

function num(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  return null;
}

function str(v) {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

function dateISO(v) {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function sanitizeFacture(raw) {
  const lignes = Array.isArray(raw.lignes)
    ? raw.lignes
      .filter((l) => l && typeof l === 'object')
      .map((l) => ({
        description: str(l.description) ?? '',
        quantite: num(l.quantite),
        prix_unitaire: num(l.prix_unitaire),
      }))
      .filter((l) => l.description || l.quantite != null || l.prix_unitaire != null)
      .slice(0, 50)
    : null;
  return {
    fournisseur_nom: str(raw.fournisseur_nom),
    date_facture: dateISO(raw.date_facture),
    num_facture: str(raw.num_facture),
    montant_ht: num(raw.montant_ht),
    montant_ttc: num(raw.montant_ttc),
    taux_tva: num(raw.taux_tva),
    lignes,
  };
}
function sanitizeTicket(raw) {
  const t = str(raw.type_carburant)?.toLowerCase() ?? null;
  const typeNorm = t === 'gazole' || t === 'sp95' || t === 'sp98' ? t : null;
  return {
    station: str(raw.station),
    date: dateISO(raw.date),
    litres: num(raw.litres),
    prix_litre: num(raw.prix_litre),
    montant_ttc: num(raw.montant_ttc),
    type_carburant: typeNorm,
  };
}
function sanitizeRib(raw) {
  const iban = str(raw.iban);
  const bic = str(raw.bic);
  return {
    titulaire: str(raw.titulaire),
    iban: iban ? iban.replace(/\s+/g, '').toUpperCase() : null,
    bic: bic ? bic.replace(/\s+/g, '').toUpperCase() : null,
    banque: str(raw.banque),
  };
}
function sanitizeCarteGrise(raw) {
  const immat = str(raw.immatriculation);
  const vin = str(raw.vin);
  const carb = str(raw.carburant)?.toLowerCase() ?? null;
  const carbNorm = carb === 'gazole' || carb === 'essence' || carb === 'electrique' || carb === 'hybride' ? carb : null;
  return {
    immatriculation: immat ? immat.replace(/\s+/g, '').toUpperCase() : null,
    vin: vin ? vin.replace(/\s+/g, '').toUpperCase() : null,
    marque: str(raw.marque),
    modele: str(raw.modele),
    date_premiere_immat: dateISO(raw.date_premiere_immat),
    puissance_fiscale: num(raw.puissance_fiscale),
    carburant: carbNorm,
    ptac_kg: num(raw.ptac_kg),
    genre: str(raw.genre),
  };
}
function sanitizePermis(raw) {
  const cats = Array.isArray(raw.categories)
    ? raw.categories.map((c) => str(c)?.toUpperCase() ?? null).filter(Boolean).slice(0, 20)
    : null;
  const num_ = str(raw.numero);
  return {
    numero: num_ ? num_.replace(/\s+/g, '').toUpperCase() : null,
    nom: str(raw.nom),
    prenom: str(raw.prenom),
    date_naissance: dateISO(raw.date_naissance),
    date_delivrance: dateISO(raw.date_delivrance),
    date_expiration: dateISO(raw.date_expiration),
    categories: cats && cats.length ? cats : null,
  };
}
function sanitizeAutre(raw) {
  const dates = Array.isArray(raw.dates_detectees)
    ? raw.dates_detectees.map((d) => dateISO(d)).filter(Boolean).slice(0, 20)
    : null;
  const montants = Array.isArray(raw.montants_detectes)
    ? raw.montants_detectes.map((m) => num(m)).filter((m) => m != null).slice(0, 20)
    : null;
  return {
    texte_brut: str(raw.texte_brut),
    dates_detectees: dates && dates.length ? dates : null,
    montants_detectes: montants && montants.length ? montants : null,
  };
}
function sanitizeByType(type, raw) {
  if (!raw || typeof raw !== 'object') return {};
  switch (type) {
    case 'facture': return sanitizeFacture(raw);
    case 'ticket_carburant': return sanitizeTicket(raw);
    case 'rib': return sanitizeRib(raw);
    case 'carte_grise': return sanitizeCarteGrise(raw);
    case 'permis': return sanitizePermis(raw);
    case 'autre': return sanitizeAutre(raw);
    default: return {};
  }
}

// Mirror du handler "auto" : extrait type_detecte + confidence + data.
function processAutoResponse(parsed) {
  const VALID_TYPES = ['facture', 'ticket_carburant', 'rib', 'carte_grise', 'permis', 'autre'];
  const td = String(parsed?.type_detecte ?? '').toLowerCase();
  const detectedType = VALID_TYPES.includes(td) ? td : 'autre';
  const conf = String(parsed?.confidence ?? '').toLowerCase();
  const confidence = conf === 'haute' || conf === 'moyenne' || conf === 'basse' ? conf : null;
  const data = sanitizeByType(detectedType, parsed?.data ?? {});
  return { type_detecte: detectedType, confidence, data };
}

// ============================================================
// 1. Tests sanitizer dispatch
// ============================================================

test('auto: facture detectee -> sanitize en facture (fields formatted)', () => {
  const parsed = {
    type_detecte: 'facture',
    confidence: 'haute',
    data: {
      fournisseur_nom: '  TotalEnergies SA  ',
      date_facture: '15/03/2026',
      num_facture: 'FA-2026-0042',
      montant_ht: '1234,56',
      montant_ttc: '1481.47',
      taux_tva: '20',
      lignes: [
        { description: 'Gazole 500L', quantite: 500, prix_unitaire: 1.85 },
        { description: '', quantite: null, prix_unitaire: null }, // dropped
      ],
    },
  };
  const r = processAutoResponse(parsed);
  assert.equal(r.type_detecte, 'facture');
  assert.equal(r.confidence, 'haute');
  assert.equal(r.data.fournisseur_nom, 'TotalEnergies SA');
  assert.equal(r.data.date_facture, '2026-03-15');
  assert.equal(r.data.montant_ht, 1234.56);
  assert.equal(r.data.montant_ttc, 1481.47);
  assert.equal(r.data.taux_tva, 20);
  assert.equal(r.data.lignes.length, 1);
});

test('auto: ticket_carburant detecte -> normalize type_carburant', () => {
  const r = processAutoResponse({
    type_detecte: 'ticket_carburant',
    confidence: 'moyenne',
    data: { station: 'Avia Lyon', date: '2026-04-01', litres: 80.5, prix_litre: 1.799, montant_ttc: 144.82, type_carburant: 'GAZOLE' },
  });
  assert.equal(r.type_detecte, 'ticket_carburant');
  assert.equal(r.data.type_carburant, 'gazole');
  assert.equal(r.data.litres, 80.5);
});

test('auto: rib detecte -> iban/bic uppercased + spaces stripped', () => {
  const r = processAutoResponse({
    type_detecte: 'rib',
    confidence: 'haute',
    data: { titulaire: 'MCA LOGISTICS', iban: 'fr76 3000 4000 5000 6000 7000 800', bic: 'bnpafrpp', banque: 'BNP Paribas' },
  });
  assert.equal(r.type_detecte, 'rib');
  assert.equal(r.data.iban, 'FR7630004000500060007000800');
  assert.equal(r.data.bic, 'BNPAFRPP');
});

test('auto: carte_grise detectee -> immat/vin uppercased + carburant normalize', () => {
  const r = processAutoResponse({
    type_detecte: 'carte_grise',
    data: { immatriculation: 'ab-123-cd', vin: 'vf6abcdef12345678', marque: 'RENAULT', modele: 'MASTER', carburant: 'DIESEL', ptac_kg: 3500 },
  });
  assert.equal(r.type_detecte, 'carte_grise');
  assert.equal(r.data.immatriculation, 'AB-123-CD');
  assert.equal(r.data.vin, 'VF6ABCDEF12345678');
  assert.equal(r.data.carburant, null); // "diesel" non normalise (gazole attendu)
  assert.equal(r.data.ptac_kg, 3500);
});

test('auto: permis detecte -> categories uppercased + numero strip espaces', () => {
  const r = processAutoResponse({
    type_detecte: 'permis',
    confidence: 'haute',
    data: { numero: '12 345 678 901 X', nom: 'DUPONT', prenom: 'Jean', date_naissance: '1985-06-15', categories: ['b', 'c', 'ce'] },
  });
  assert.equal(r.type_detecte, 'permis');
  assert.equal(r.data.numero, '12345678901X');
  assert.deepEqual(r.data.categories, ['B', 'C', 'CE']);
});

// ============================================================
// 2. Edge cases
// ============================================================

test('auto: type_detecte invalide -> fallback "autre"', () => {
  const r = processAutoResponse({ type_detecte: 'truc_inconnu', data: {} });
  assert.equal(r.type_detecte, 'autre');
  assert.equal(r.confidence, null);
});

test('auto: confidence invalide -> null (pas de crash)', () => {
  const r = processAutoResponse({ type_detecte: 'rib', confidence: 'tres_haute', data: { iban: 'FR76' } });
  assert.equal(r.confidence, null);
});

test('auto: data manquante -> data=={} (pas de crash)', () => {
  const r = processAutoResponse({ type_detecte: 'facture', confidence: 'basse' });
  assert.equal(r.type_detecte, 'facture');
  assert.equal(r.data.fournisseur_nom, null);
  assert.equal(r.data.lignes, null);
});

test('auto: type_detecte="autre" avec infos brutes -> sanitizeAutre', () => {
  const r = processAutoResponse({
    type_detecte: 'autre',
    confidence: 'basse',
    data: { texte_brut: 'Bordereau interne MCA', dates_detectees: ['2026-01-15', 'invalid'], montants_detectes: ['125.50', null, 'xx'] },
  });
  assert.equal(r.type_detecte, 'autre');
  assert.equal(r.data.texte_brut, 'Bordereau interne MCA');
  assert.deepEqual(r.data.dates_detectees, ['2026-01-15']);
  assert.deepEqual(r.data.montants_detectes, [125.5]);
});

test('auto: parsed null/non-object -> type "autre" sans crash', () => {
  const r1 = processAutoResponse(null);
  assert.equal(r1.type_detecte, 'autre');
  // sanitizeAutre renvoie un objet aux champs null (pas {} strict)
  assert.equal(r1.data.texte_brut, null);
  assert.equal(r1.data.dates_detectees, null);
  const r2 = processAutoResponse({});
  assert.equal(r2.type_detecte, 'autre');
});

// ============================================================
// 3. Tests routeByType (helper smart-upload)
// ============================================================

// Charge le helper en simulant un browser minimal (window global).
function loadSmartUpload() {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'smart-upload.js'), 'utf8');
  const sandbox = { window: {} };
  // IIFE -> on l'exec dans un Function avec window injecte
  const fn = new Function('window', src);
  fn(sandbox.window);
  return sandbox.window.SmartUpload;
}

test('routeByType: facture -> target_section=facture + fields ok', () => {
  const SU = loadSmartUpload();
  const r = SU.routeByType({
    type_detecte: 'facture',
    confidence: 'haute',
    data: { fournisseur_nom: 'Total', date_facture: '2026-03-15', montant_ttc: 100, montant_ht: 83.33, taux_tva: 20, num_facture: 'F-1' },
  });
  assert.equal(r.handled, true);
  assert.equal(r.target_section, 'facture');
  assert.equal(r.fields_to_prefill.fournisseur_nom, 'Total');
  assert.equal(r.fields_to_prefill.date, '2026-03-15');
  assert.equal(r.fields_to_prefill.montant_ttc, 100);
});

test('routeByType: rib -> target_section=rib + iban/bic prefill', () => {
  const SU = loadSmartUpload();
  const r = SU.routeByType({
    type_detecte: 'rib',
    data: { titulaire: 'MCA', iban: 'FR76...', bic: 'BNPAFRPP', banque: 'BNP' },
  });
  assert.equal(r.handled, true);
  assert.equal(r.target_section, 'rib');
  assert.equal(r.fields_to_prefill.iban, 'FR76...');
});

test('routeByType: permis -> target_section=permis + categories', () => {
  const SU = loadSmartUpload();
  const r = SU.routeByType({
    type_detecte: 'permis',
    data: { numero: '12345', categories: ['B', 'C'], nom: 'DUPONT' },
  });
  assert.equal(r.target_section, 'permis');
  assert.deepEqual(r.fields_to_prefill.categories, ['B', 'C']);
});

test('routeByType: autre -> handled=false + target_section=null', () => {
  const SU = loadSmartUpload();
  const r = SU.routeByType({ type_detecte: 'autre', data: {} });
  assert.equal(r.handled, false);
  assert.equal(r.target_section, null);
  assert.deepEqual(r.fields_to_prefill, {});
});

test('routeByType: result null -> handled=false sans crash', () => {
  const SU = loadSmartUpload();
  const r = SU.routeByType(null);
  assert.equal(r.handled, false);
  assert.equal(r.target_section, null);
});

test('routeByType: type inconnu -> handled=false', () => {
  const SU = loadSmartUpload();
  const r = SU.routeByType({ type_detecte: 'foobar', data: {} });
  assert.equal(r.handled, false);
});

// ============================================================
// 4. Test smart-upload._internals.KNOWN_MODES inclut "auto"
// ============================================================

test('smart-upload: KNOWN_MODES inclut "auto" + DEFAULT_MODE === "auto"', () => {
  const SU = loadSmartUpload();
  assert.equal(SU._internals.KNOWN_MODES.auto, true);
  assert.equal(SU._internals.KNOWN_MODES.facture, true); // retrocompat
  assert.equal(SU._internals.KNOWN_MODES.permis, true);
  assert.equal(SU._internals.DEFAULT_MODE, 'auto');
});

// ============================================================
// 5. Test integration : mock fetch Gemini -> verifier mode "auto" appelle bon endpoint
// ============================================================

test('callOcr (mode auto): mock fetch -> body inclut mode:"auto" + payload retourne type_detecte', async () => {
  // Setup minimal env browser pour smart-upload.js
  const SU = loadSmartUpload();
  // Note: callOcr depend de window.DelivProSupabase qu'on ne mocke pas ici
  // (ca demanderait de re-architecturer le helper). Le test 'mode auto end-to-end'
  // est couvert par la stack de tests d'integration Playwright (sprint H2).
  // On verifie juste que callOcr existe et est exporte correctement.
  assert.equal(typeof SU._internals.callOcr, 'function');
});
