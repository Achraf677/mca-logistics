/**
 * MCA Logistics — Tests routing SmartUpload mode "auto" -> form fields.
 *
 * Couvre :
 *   1. routeByType : facture / ticket_carburant / rib / permis / carte_grise
 *      -> target_section + fields_to_prefill exhaustifs (Phase 2 Phase câblage).
 *   2. mapTypeCarburant : variations OCR string ('Gazole'|'SP95'|'GNV'|...) -> code MCA.
 *   3. routeByType edge cases : data partielle, type 'autre', type inconnu.
 *
 * Le helper window.SmartUpload est charge en sandbox (pattern identique a
 * tests/ai-ocr-auto.test.js). MCASmartUploadHelpers est aussi charge pour
 * couvrir mapTypeCarburant qui est la fonction centrale du dispatch type ->
 * code MCA (cote PC ET cote mobile).
 *
 * Lancer : node --test tests/smart-upload-routing.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ============================================================
// Bootstrap : charge smart-upload.js + script-core-smart-upload.js dans un
// sandbox window minimaliste (pas de DOM, pas de fetch).
// ============================================================

function loadHelpers() {
  const sandbox = {
    window: {},
    document: {
      addEventListener: () => {},
      readyState: 'complete',
      // Stubs minimaux pour bootPCWiring qui appelle getElementById
      getElementById: () => null,
      querySelector: () => null,
    },
    setTimeout: () => 0,
    console: console,
  };
  const smartSrc = fs.readFileSync(path.join(__dirname, '..', 'smart-upload.js'), 'utf8');
  const helperSrc = fs.readFileSync(path.join(__dirname, '..', 'script-core-smart-upload.js'), 'utf8');
  // smart-upload.js est une IIFE, on injecte window
  new Function('window', smartSrc)(sandbox.window);
  // helper utilise document + setTimeout (idempotent : si bootPCWiring re-execute,
  // ne casse rien car nos stubs renvoient null pour tous les querySelector)
  new Function('window', 'document', 'setTimeout', helperSrc)(sandbox.window, sandbox.document, sandbox.setTimeout);
  return {
    SU: sandbox.window.SmartUpload,
    H: sandbox.window.MCASmartUploadHelpers,
  };
}

// ============================================================
// 1. routeByType : 5 types attendus (Phase 2)
// ============================================================

test('routeByType: facture -> target_section=facture + 6 champs', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({
    type_detecte: 'facture',
    confidence: 'haute',
    data: {
      fournisseur_nom: 'TotalEnergies',
      date_facture: '2026-04-01',
      montant_ttc: 240,
      montant_ht: 200,
      taux_tva: 20,
      num_facture: 'FAC-2026-001',
    },
  });
  assert.equal(r.handled, true);
  assert.equal(r.target_section, 'facture');
  assert.equal(r.fields_to_prefill.fournisseur_nom, 'TotalEnergies');
  assert.equal(r.fields_to_prefill.date, '2026-04-01');
  assert.equal(r.fields_to_prefill.montant_ttc, 240);
  assert.equal(r.fields_to_prefill.montant_ht, 200);
  assert.equal(r.fields_to_prefill.taux_tva, 20);
  assert.equal(r.fields_to_prefill.num_facture, 'FAC-2026-001');
});

test('routeByType: ticket_carburant -> target_section=ticket + champs station/litres/prix', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({
    type_detecte: 'ticket_carburant',
    data: {
      station: 'Total Lyon',
      date: '2026-04-15',
      litres: 45.2,
      prix_litre: 1.829,
      montant_ttc: 82.67,
      type_carburant: 'gazole',
    },
  });
  assert.equal(r.handled, true);
  assert.equal(r.target_section, 'ticket');
  assert.equal(r.fields_to_prefill.station, 'Total Lyon');
  assert.equal(r.fields_to_prefill.litres, 45.2);
  assert.equal(r.fields_to_prefill.prix_litre, 1.829);
  assert.equal(r.fields_to_prefill.type_carburant, 'gazole');
});

test('routeByType: rib -> target_section=rib + iban/bic/titulaire', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({
    type_detecte: 'rib',
    data: {
      titulaire: 'MCA LOGISTICS',
      iban: 'FR76 1234 5678 9012 3456 7890 123',
      bic: 'BNPAFRPPXXX',
      banque: 'BNP Paribas',
    },
  });
  assert.equal(r.target_section, 'rib');
  assert.equal(r.fields_to_prefill.iban, 'FR76 1234 5678 9012 3456 7890 123');
  assert.equal(r.fields_to_prefill.bic, 'BNPAFRPPXXX');
  assert.equal(r.fields_to_prefill.titulaire, 'MCA LOGISTICS');
});

test('routeByType: carte_grise -> target_section=carte_grise + immat/vin/marque', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({
    type_detecte: 'carte_grise',
    data: {
      immatriculation: 'AA-123-BB',
      vin: 'VF1XXXXXXXXXXXXXX',
      marque: 'Renault',
      modele: 'Master',
      date_premiere_immat: '2022-03-15',
      ptac_kg: 3500,
      carburant: 'diesel',
    },
  });
  assert.equal(r.target_section, 'carte_grise');
  assert.equal(r.fields_to_prefill.immatriculation, 'AA-123-BB');
  assert.equal(r.fields_to_prefill.vin, 'VF1XXXXXXXXXXXXXX');
  assert.equal(r.fields_to_prefill.marque, 'Renault');
  assert.equal(r.fields_to_prefill.ptac_kg, 3500);
});

test('routeByType: permis -> target_section=permis + numero/categories/date_expiration', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({
    type_detecte: 'permis',
    data: {
      numero: '1234567890',
      nom: 'DUPONT',
      prenom: 'Jean',
      date_expiration: '2030-05-12',
      categories: ['B', 'BE'],
    },
  });
  assert.equal(r.target_section, 'permis');
  assert.equal(r.fields_to_prefill.numero, '1234567890');
  assert.deepEqual(r.fields_to_prefill.categories, ['B', 'BE']);
  assert.equal(r.fields_to_prefill.date_expiration, '2030-05-12');
});

// ============================================================
// 2. routeByType edge cases (resilience aux donnees partielles)
// ============================================================

test('routeByType: type "autre" -> handled=false, target_section=null', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({ type_detecte: 'autre', data: { texte_brut: 'Lorem ipsum' } });
  assert.equal(r.handled, false);
  assert.equal(r.target_section, null);
  assert.deepEqual(r.fields_to_prefill, {});
});

test('routeByType: type inconnu -> handled=false (fallback safe)', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({ type_detecte: 'foobar_xyz', data: { foo: 'bar' } });
  assert.equal(r.handled, false);
});

test('routeByType: payload null -> handled=false sans crash', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType(null);
  assert.equal(r.handled, false);
  assert.equal(r.target_section, null);
});

test('routeByType: facture data partielle -> remplit ce qui est dispo, le reste reste null', () => {
  const { SU } = loadHelpers();
  const r = SU.routeByType({
    type_detecte: 'facture',
    data: { fournisseur_nom: 'OnlyFournisseur' },
  });
  assert.equal(r.handled, true);
  assert.equal(r.fields_to_prefill.fournisseur_nom, 'OnlyFournisseur');
  assert.equal(r.fields_to_prefill.date, null);
  assert.equal(r.fields_to_prefill.montant_ttc, null);
});

// ============================================================
// 3. mapTypeCarburant : robustesse aux variations OCR
// ============================================================

test('mapTypeCarburant: gazole/diesel/gasoil -> diesel', () => {
  const { H } = loadHelpers();
  assert.equal(H.mapTypeCarburant('Gazole'), 'diesel');
  assert.equal(H.mapTypeCarburant('GAZOLE B7'), 'diesel');
  assert.equal(H.mapTypeCarburant('Gasoil'), 'diesel');
  assert.equal(H.mapTypeCarburant('Diesel'), 'diesel');
});

test('mapTypeCarburant: SP95/SP98/Essence/E10/E85 -> essence', () => {
  const { H } = loadHelpers();
  assert.equal(H.mapTypeCarburant('SP95'), 'essence');
  assert.equal(H.mapTypeCarburant('SP98'), 'essence');
  assert.equal(H.mapTypeCarburant('Essence'), 'essence');
  assert.equal(H.mapTypeCarburant('E10'), 'essence');
  assert.equal(H.mapTypeCarburant('E85'), 'essence');
});

test('mapTypeCarburant: GNV/BioGNV -> gnv ; Hybride -> hybride ; Hydrogene -> hydrogene', () => {
  const { H } = loadHelpers();
  assert.equal(H.mapTypeCarburant('GNV'), 'gnv');
  assert.equal(H.mapTypeCarburant('BioGNV'), 'gnv');
  assert.equal(H.mapTypeCarburant('Electrique'), 'electrique');
  assert.equal(H.mapTypeCarburant('Hybride rechargeable'), 'hybride');
  assert.equal(H.mapTypeCarburant('H2'), 'hydrogene');
  assert.equal(H.mapTypeCarburant('Hydrogene'), 'hydrogene');
});

test('mapTypeCarburant: vide / inconnu -> chaine vide', () => {
  const { H } = loadHelpers();
  assert.equal(H.mapTypeCarburant(''), '');
  assert.equal(H.mapTypeCarburant(null), '');
  assert.equal(H.mapTypeCarburant('foobar'), '');
});

// ============================================================
// 4. Smoke : MCASmartUploadHelpers expose les bonnes fonctions publiques
// ============================================================

test('helper exports: applyAutoResultToPCForm, applyAutoResultToMobileForm, mapTypeCarburant', () => {
  const { H } = loadHelpers();
  assert.equal(typeof H.applyAutoResultToPCForm, 'function');
  assert.equal(typeof H.applyAutoResultToMobileForm, 'function');
  assert.equal(typeof H.mapTypeCarburant, 'function');
  assert.equal(typeof H.setIfEmpty, 'function');
});
