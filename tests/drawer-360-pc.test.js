/**
 * MCA Logistics — Tests helpers KPI drawer 360° PC (Sprint H2.4)
 *
 * Tests purs des fonctions kpiClient / kpiVehicule / kpiFournisseur /
 * kpiConformiteSalarie exposées par script-drawer-360-pc-parite.js. Pas de
 * DOM, pas de localStorage : on injecte les données et les helpers (ex.
 * calculerDSO) en paramètres pour testabilité maximale.
 *
 * Lancer : node --test tests/drawer-360-pc.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  kpiClient,
  kpiVehicule,
  kpiFournisseur,
  kpiConformiteSalarie,
} = require('../script-drawer-360-pc-parite.js');
const { calculerDSO } = require('../script-core-dso.js');

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// =========================================================
// kpiClient
// =========================================================
test('kpiClient : nb livraisons + DSO + impayés sur livraisons attribuées par id', () => {
  const c = { id: 'c1', nom: 'Carrefour' };
  const livs = [
    { clientId: 'c1', statutPaiement: 'paye', dateLivraison: isoDaysAgo(40), datePaiement: isoDaysAgo(10) }, // delai 30
    { clientId: 'c1', statutPaiement: 'paye', dateLivraison: isoDaysAgo(50), datePaiement: isoDaysAgo(10) }, // delai 40
    { clientId: 'c1', statutPaiement: 'impaye', dateLivraison: isoDaysAgo(20) },
    { clientId: 'c2', statutPaiement: 'paye', dateLivraison: isoDaysAgo(30), datePaiement: isoDaysAgo(20) }, // autre client
  ];
  const r = kpiClient(c, livs, calculerDSO);
  assert.equal(r.nbLivr, 3);
  assert.equal(r.impayes, 1);
  assert.equal(r.dso, 35); // (30+40)/2
});

test('kpiClient : matching par nom (clientId absent)', () => {
  const c = { id: 'c1', nom: 'CARREFOUR' };
  const livs = [
    { client: 'Carrefour', statutPaiement: 'impaye', dateLivraison: isoDaysAgo(20) },
    { client: 'carrefour ', statutPaiement: 'impaye', dateLivraison: isoDaysAgo(15) },
    { client: 'Auchan', statutPaiement: 'paye' },
  ];
  const r = kpiClient(c, livs, calculerDSO);
  assert.equal(r.nbLivr, 2);
  assert.equal(r.impayes, 2);
});

test('kpiClient : DSO null si aucune livraison payée', () => {
  const c = { id: 'c1', nom: 'X' };
  const livs = [{ clientId: 'c1', statutPaiement: 'impaye' }];
  const r = kpiClient(c, livs, calculerDSO);
  assert.equal(r.dso, null);
  assert.equal(r.impayes, 1);
});

// =========================================================
// kpiVehicule
// =========================================================
test('kpiVehicule : coût total = carb + entretiens, coût/km, conso', () => {
  const veh = { id: 'v1', km: 60000, kmInitial: 50000, conso: 8 };
  const carbs = [
    { vehId: 'v1', total: 100, litres: 80, kmCompteur: 50000 },
    { vehId: 'v1', total: 120, litres: 90, kmCompteur: 51000 },
    { vehId: 'v1', total: 110, litres: 80, kmCompteur: 51200 }, // delta 51200-50000 = 1200
    { vehId: 'v2', total: 999 }, // autre véhicule
  ];
  const entrs = [
    { vehId: 'v1', ttc: 200 },
    { vehId: 'v1', montant: 50 },
  ];
  const r = kpiVehicule(veh, carbs, entrs);
  assert.equal(r.km, 60000);
  assert.equal(r.coutTotal, 100 + 120 + 110 + 200 + 50); // 580
  // kmRoules = 60000 - 50000 = 10000 -> 580/10000 = 0.058
  assert.ok(Math.abs(r.coutKm - 0.058) < 0.0001);
  // Conso : totalL = 80+90+80 = 250L sur delta 1200km -> 250/1200*100 = 20.83
  assert.ok(r.conso !== null);
  assert.ok(Math.abs(r.conso - 20.833) < 0.1);
});

test('kpiVehicule : coût/km null si km roulés = 0', () => {
  const veh = { id: 'v1', km: 50000, kmInitial: 50000 };
  const r = kpiVehicule(veh, [], []);
  assert.equal(r.coutKm, null);
  assert.equal(r.coutTotal, 0);
});

test('kpiVehicule : conso null si <2 pleins ou delta <100km', () => {
  const veh = { id: 'v1', km: 60000, kmInitial: 50000 };
  const r1 = kpiVehicule(veh, [{ vehId: 'v1', total: 100, litres: 80, kmCompteur: 50000 }], []);
  assert.equal(r1.conso, null);
  // Delta 50km insuffisant
  const r2 = kpiVehicule(veh, [
    { vehId: 'v1', total: 100, litres: 80, kmCompteur: 50000 },
    { vehId: 'v1', total: 100, litres: 80, kmCompteur: 50050 },
  ], []);
  assert.equal(r2.conso, null);
});

// =========================================================
// kpiFournisseur
// =========================================================
test('kpiFournisseur : nb charges, total, dernière facture, catégories triées', () => {
  const f = { id: 'f1', nom: 'TotalEnergies' };
  const charges = [
    { fournisseurId: 'f1', montantTTC: 100, date: '2026-04-01', categorie: 'Carburant' },
    { fournisseurId: 'f1', montant: 50, date: '2026-05-01', categorie: 'Carburant' },
    { fournisseurId: 'f1', montantTTC: 200, date: '2026-03-15', categorie: 'Entretien' },
    { fournisseurId: 'f2', montantTTC: 999, date: '2026-04-10' }, // autre fournisseur
  ];
  const r = kpiFournisseur(f, charges);
  assert.equal(r.nbCharges, 3);
  assert.equal(r.total, 350);
  assert.equal(r.derniereFacture, '2026-05-01');
  assert.deepEqual(r.categories, ['Carburant', 'Entretien']); // Carb 2x, Entretien 1x
});

test('kpiFournisseur : matching par nom si fournisseurId absent', () => {
  const f = { id: 'f1', nom: 'EDF' };
  const charges = [
    { fournisseur: 'EDF', montantTTC: 80, date: '2026-04-01' },
    { fournisseur: 'edf', montantTTC: 90, date: '2026-05-01' },
  ];
  const r = kpiFournisseur(f, charges);
  assert.equal(r.nbCharges, 2);
  assert.equal(r.total, 170);
});

// =========================================================
// kpiConformiteSalarie
// =========================================================
test('kpiConformiteSalarie : 100% si tous les docs valides', () => {
  const sal = {
    datePermis: isoDaysAgo(-365),    // expire dans 1 an
    dateAssurance: isoDaysAgo(-180),
    visiteMedicale: isoDaysAgo(-90),
  };
  assert.equal(kpiConformiteSalarie(sal, new Date()), 100);
});

test('kpiConformiteSalarie : 33% si 1 doc expiré sur 3', () => {
  const sal = {
    datePermis: isoDaysAgo(30),  // expiré
    dateAssurance: isoDaysAgo(60), // expiré
    visiteMedicale: isoDaysAgo(-90),
  };
  assert.equal(kpiConformiteSalarie(sal, new Date()), 33);
});

test('kpiConformiteSalarie : 0 si aucun doc renseigné', () => {
  assert.equal(kpiConformiteSalarie({}, new Date()), 0);
  assert.equal(kpiConformiteSalarie(null, new Date()), 0);
});
