/**
 * MCA Logistics — Tests d'unification schemas (LDV / assurance / charges-FK)
 *
 * Tests des helpers de normalisation utilises par les readers PC et mobile
 * pour rendre la donnee visible des deux cotes pendant la phase dual-read.
 *
 * Lancer : node --test tests/data-schema-normalization.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLDV,
  normalizeVehicule,
  normalizeAbsence,
  migrerCleLegacy,
  findFournisseurByNom,
  findLivraisonByRef
} = require('../script-core-utils.js');

// localStorage stub pour tester migrerCleLegacy (Node n'a pas localStorage)
function setupLocalStorageStub() {
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    _dump: () => Object.assign({}, store)
  };
  return store;
}

// ============================================================
// normalizeLDV
// ============================================================

test('normalizeLDV : flat -> nested (cas livraison saisie mobile)', () => {
  const liv = {
    id: 'liv-1',
    expNom: 'Acme SAS',
    expContact: 'Jean Dupont · 0601020304',
    expAdresse: '12 rue de Lyon',
    expCp: '75012',
    expVille: 'Paris',
    expPays: 'FR',
    destNom: 'Beta SARL',
    destAdresse: '45 av. de la Republique',
    destCp: '69003',
    destVille: 'Lyon',
    destPays: 'FR',
    marchNature: 'Palettes alimentaires',
    marchPoids: 1500,
    marchVolume: 12.5,
    marchColis: 8,
    adrEst: true,
    adrOnu: 'UN1202',
    adrClasse: '3',
    adrGroupe: 'II'
  };
  normalizeLDV(liv);
  assert.equal(liv.expediteur.nom, 'Acme SAS');
  assert.equal(liv.expediteur.contact, 'Jean Dupont · 0601020304');
  assert.equal(liv.expediteur.adresse, '12 rue de Lyon');
  assert.equal(liv.expediteur.ville, 'Paris');
  assert.equal(liv.expediteur.pays, 'FR');
  assert.equal(liv.destinataire.nom, 'Beta SARL');
  assert.equal(liv.destinataire.cp, '69003');
  assert.equal(liv.marchandise.nature, 'Palettes alimentaires');
  assert.equal(liv.marchandise.poidsKg, 1500);
  assert.equal(liv.marchandise.volumeM3, 12.5);
  assert.equal(liv.marchandise.nbColis, 8);
  assert.equal(liv.adr.estADR, true);
  assert.equal(liv.adr.codeONU, 'UN1202');
  assert.equal(liv.adr.classe, '3');
  assert.equal(liv.adr.groupeEmballage, 'II');
});

test('normalizeLDV : nested -> flat (cas livraison saisie PC, lue par mobile)', () => {
  const liv = {
    id: 'liv-2',
    expediteur: { nom: 'Acme SAS', contact: 'X', adresse: 'A', cp: '75001', ville: 'Paris', pays: 'FR' },
    destinataire: { nom: 'Beta', adresse: 'B', cp: '69003', ville: 'Lyon', pays: 'FR' },
    marchandise: { nature: 'Pieces auto', poidsKg: 800, volumeM3: 5, nbColis: 12 },
    adr: { estADR: true, codeONU: 'UN1090', classe: '3', groupeEmballage: 'II' }
  };
  normalizeLDV(liv);
  assert.equal(liv.expNom, 'Acme SAS');
  assert.equal(liv.expContact, 'X');
  assert.equal(liv.expCp, '75001');
  assert.equal(liv.destNom, 'Beta');
  assert.equal(liv.destVille, 'Lyon');
  assert.equal(liv.marchNature, 'Pieces auto');
  assert.equal(liv.marchPoids, 800);
  assert.equal(liv.marchColis, 12);
  assert.equal(liv.adrEst, true);
  assert.equal(liv.adrEstADR, true);
  assert.equal(liv.adrOnu, 'UN1090');
  assert.equal(liv.adrCodeONU, 'UN1090');
  assert.equal(liv.adrClasse, '3');
  assert.equal(liv.adrGroupe, 'II');
  assert.equal(liv.adrGroupeEmballage, 'II');
});

test('normalizeLDV : idempotent (rerun safe)', () => {
  const liv = {
    expNom: 'X', expAdresse: 'A', expVille: 'Paris', expCp: '75001', expPays: 'FR',
    destNom: 'Y', destAdresse: 'B', destVille: 'Lyon', destCp: '69001', destPays: 'FR',
    marchNature: 'Palettes', marchPoids: 100, marchColis: 2,
    adrEst: false
  };
  normalizeLDV(liv);
  const snap1 = JSON.parse(JSON.stringify(liv));
  normalizeLDV(liv);
  normalizeLDV(liv);
  const snap2 = JSON.parse(JSON.stringify(liv));
  assert.deepEqual(snap2, snap1);
});

test('normalizeLDV : pas de mutation si deja nested ET flat (compat 2-cotes)', () => {
  const liv = {
    expNom: 'X', expediteur: { nom: 'X' },
    destNom: 'Y', destinataire: { nom: 'Y' },
    marchNature: 'P', marchandise: { nature: 'P' },
    adrEst: true, adr: { estADR: true }
  };
  normalizeLDV(liv);
  assert.equal(liv.expediteur.nom, 'X');
  assert.equal(liv.destinataire.nom, 'Y');
});

test('normalizeLDV : robuste sur input null/undefined/primitive', () => {
  assert.equal(normalizeLDV(null), null);
  assert.equal(normalizeLDV(undefined), undefined);
  assert.equal(normalizeLDV('foo'), 'foo');
  assert.equal(normalizeLDV(42), 42);
});

test('normalizeLDV : livraison vide ne crash pas', () => {
  const liv = { id: 'liv-x' };
  normalizeLDV(liv);
  // Ne cree pas d'objet vide non sollicite
  assert.equal(liv.expediteur, undefined);
  assert.equal(liv.destinataire, undefined);
  assert.equal(liv.marchandise, undefined);
  assert.equal(liv.adr, undefined);
});

test('normalizeLDV : pays par defaut FR si vide', () => {
  const liv = {
    expNom: 'Acme', expAdresse: 'A', expVille: 'Paris',
    destNom: 'Beta', destAdresse: 'B', destVille: 'Lyon'
  };
  normalizeLDV(liv);
  assert.equal(liv.expediteur.pays, 'FR');
  assert.equal(liv.destinataire.pays, 'FR');
});

test('normalizeLDV : ADR depuis nested vers flat correct', () => {
  const liv = { adr: { estADR: true, codeONU: 'UN3082', classe: '9', groupeEmballage: 'III' } };
  normalizeLDV(liv);
  assert.equal(liv.adrEst, true);
  assert.equal(liv.adrOnu, 'UN3082');
  assert.equal(liv.adrClasse, '9');
  assert.equal(liv.adrGroupe, 'III');
});

// ============================================================
// normalizeVehicule
// ============================================================

test('normalizeVehicule : flat -> nested (vehicule mobile)', () => {
  const v = { id: 'v1', immat: 'AB-123-CD', dateAssurance: '2026-12-31' };
  normalizeVehicule(v);
  assert.equal(v.assurance.dateExpiration, '2026-12-31');
  assert.equal(v.assurance.compagnie, '');
  assert.equal(v.assurance.numeroContrat, '');
});

test('normalizeVehicule : nested -> flat (vehicule PC, lu mobile)', () => {
  const v = {
    id: 'v2',
    immat: 'EF-456-GH',
    assurance: { compagnie: 'AXA', numeroContrat: '123-XYZ', dateExpiration: '2027-06-30' }
  };
  normalizeVehicule(v);
  assert.equal(v.dateAssurance, '2027-06-30');
});

test('normalizeVehicule : preserve compagnie/numero PC si mobile a override date', () => {
  // Cas reel : PC saisit compagnie+numero+date. Mobile re-edit et n'envoie
  // que dateAssurance flat (sans compagnie). On ne doit PAS perdre la compagnie.
  const v = {
    id: 'v3',
    dateAssurance: '2027-12-31',  // mobile re-saisie
    assurance: { compagnie: 'Allianz', numeroContrat: 'ABC-123', dateExpiration: '' }
  };
  normalizeVehicule(v);
  assert.equal(v.assurance.compagnie, 'Allianz');
  assert.equal(v.assurance.numeroContrat, 'ABC-123');
  assert.equal(v.assurance.dateExpiration, '2027-12-31');
});

test('normalizeVehicule : idempotent', () => {
  const v = { id: 'v4', dateAssurance: '2026-08-15' };
  normalizeVehicule(v);
  const snap1 = JSON.parse(JSON.stringify(v));
  normalizeVehicule(v);
  normalizeVehicule(v);
  const snap2 = JSON.parse(JSON.stringify(v));
  assert.deepEqual(snap2, snap1);
});

test('normalizeVehicule : robuste null/undefined', () => {
  assert.equal(normalizeVehicule(null), null);
  assert.equal(normalizeVehicule(undefined), undefined);
});

test('normalizeVehicule : vehicule sans assurance reste intact', () => {
  const v = { id: 'v5', immat: 'XY-789-Z' };
  normalizeVehicule(v);
  assert.equal(v.assurance, undefined);
  assert.equal(v.dateAssurance, undefined);
});

// ============================================================
// findFournisseurByNom (matching insensible casse + trim)
// ============================================================

test('findFournisseurByNom : match exact casse insensible', () => {
  const fournisseurs = [
    { id: 'f1', nom: 'TotalEnergies' },
    { id: 'f2', nom: 'Michelin' }
  ];
  assert.equal(findFournisseurByNom('totalenergies', fournisseurs).id, 'f1');
  assert.equal(findFournisseurByNom('TOTALENERGIES', fournisseurs).id, 'f1');
  assert.equal(findFournisseurByNom('  Michelin  ', fournisseurs).id, 'f2');
});

test('findFournisseurByNom : retourne null si pas trouve', () => {
  const fournisseurs = [{ id: 'f1', nom: 'TotalEnergies' }];
  assert.equal(findFournisseurByNom('Inconnu', fournisseurs), null);
});

test('findFournisseurByNom : robuste empty/null', () => {
  assert.equal(findFournisseurByNom('', []), null);
  assert.equal(findFournisseurByNom(null, []), null);
  assert.equal(findFournisseurByNom('X', null), null);
  assert.equal(findFournisseurByNom('  ', [{ id: 'f1', nom: 'X' }]), null);
});

test('findFournisseurByNom : ignore les fournisseurs sans nom', () => {
  const fournisseurs = [
    null,
    { id: 'f1' },
    { id: 'f2', nom: 'Match' }
  ];
  assert.equal(findFournisseurByNom('Match', fournisseurs).id, 'f2');
});

// ============================================================
// findLivraisonByRef
// ============================================================

test('findLivraisonByRef : match par numLiv', () => {
  const livs = [
    { id: 'l1', numLiv: 'LIV-2026-0001', client: 'Acme' },
    { id: 'l2', numLiv: 'LIV-2026-0002', client: 'Beta' }
  ];
  assert.equal(findLivraisonByRef('LIV-2026-0001', livs).id, 'l1');
  assert.equal(findLivraisonByRef('liv-2026-0002', livs).id, 'l2');
});

test('findLivraisonByRef : fallback par nom client', () => {
  const livs = [
    { id: 'l1', numLiv: 'LIV-2026-0001', client: 'Acme' },
    { id: 'l2', numLiv: 'LIV-2026-0002', client: 'Beta' }
  ];
  assert.equal(findLivraisonByRef('Beta', livs).id, 'l2');
});

test('findLivraisonByRef : null si rien ne matche', () => {
  assert.equal(findLivraisonByRef('XYZ', [{ id: 'l1', numLiv: 'X', client: 'Y' }]), null);
});

// ============================================================
// normalizeAbsence (R11 — Onglet 4 Planning, 2026-05-17)
// ============================================================

test('normalizeAbsence : admin (debut/fin) -> mirror mobile/DB', () => {
  const a = { id: 'a1', salId: 'sal-1', debut: '2026-06-01', fin: '2026-06-15', type: 'conge' };
  normalizeAbsence(a);
  assert.equal(a.dateDebut, '2026-06-01');
  assert.equal(a.dateFin, '2026-06-15');
  assert.equal(a.debut, '2026-06-01');
  assert.equal(a.fin, '2026-06-15');
  assert.equal(a.salId, 'sal-1');
});

test('normalizeAbsence : mobile (dateDebut/dateFin) -> remplit debut/fin canoniques', () => {
  const a = { id: 'a2', salId: 'sal-2', dateDebut: '2026-07-10', dateFin: '2026-07-12', type: 'maladie' };
  normalizeAbsence(a);
  assert.equal(a.debut, '2026-07-10');
  assert.equal(a.fin, '2026-07-12');
  assert.equal(a.dateDebut, '2026-07-10');
  assert.equal(a.dateFin, '2026-07-12');
});

test('normalizeAbsence : DB raw (date_debut/date_fin/salarie_id) -> remplit canoniques', () => {
  const a = { id: 'a3', salarie_id: 'sal-3', date_debut: '2026-08-01', date_fin: '2026-08-05',
              heure_debut: '08:00', heure_fin: '12:00', type: 'absence' };
  normalizeAbsence(a);
  assert.equal(a.debut, '2026-08-01');
  assert.equal(a.fin, '2026-08-05');
  assert.equal(a.salId, 'sal-3');
  assert.equal(a.heureDebut, '08:00');
  assert.equal(a.heureFin, '12:00');
});

test('normalizeAbsence : idempotent (rerun ne casse rien)', () => {
  const a = { id: 'a4', salId: 'sal-4', debut: '2026-09-01', fin: '2026-09-02', type: 'conge' };
  normalizeAbsence(a);
  const snap1 = JSON.stringify(a);
  normalizeAbsence(a);
  normalizeAbsence(a);
  assert.equal(JSON.stringify(a), snap1);
});

test('normalizeAbsence : null/undefined safe', () => {
  assert.equal(normalizeAbsence(null), null);
  assert.equal(normalizeAbsence(undefined), undefined);
  assert.equal(normalizeAbsence('string'), 'string');
});

// ============================================================
// migrerCleLegacy (R10 — Onglet 4 Planning, 2026-05-17)
// ============================================================

test('migrerCleLegacy : source legacy presente, cible vide -> migre', () => {
  setupLocalStorageStub();
  localStorage.setItem('plannings_hebdo', JSON.stringify([{ id: 1 }]));
  const did = migrerCleLegacy('plannings_hebdo', 'plannings');
  assert.equal(did, true);
  assert.equal(localStorage.getItem('plannings_hebdo'), null);
  assert.equal(localStorage.getItem('plannings'), JSON.stringify([{ id: 1 }]));
  delete global.localStorage;
});

test('migrerCleLegacy : cible deja peuplee -> conserve cible, supprime source', () => {
  setupLocalStorageStub();
  localStorage.setItem('plannings_hebdo', JSON.stringify([{ id: 1, vieux: true }]));
  localStorage.setItem('plannings', JSON.stringify([{ id: 2, recent: true }]));
  const did = migrerCleLegacy('plannings_hebdo', 'plannings');
  assert.equal(did, true);
  assert.equal(localStorage.getItem('plannings_hebdo'), null);
  assert.equal(localStorage.getItem('plannings'), JSON.stringify([{ id: 2, recent: true }]));
  delete global.localStorage;
});

test('migrerCleLegacy : source absente -> no-op', () => {
  setupLocalStorageStub();
  const did = migrerCleLegacy('plannings_hebdo', 'plannings');
  assert.equal(did, false);
  delete global.localStorage;
});

test('migrerCleLegacy : cible existe mais array vide -> migre quand meme', () => {
  setupLocalStorageStub();
  localStorage.setItem('plannings_hebdo', JSON.stringify([{ id: 1 }]));
  localStorage.setItem('plannings', JSON.stringify([]));
  migrerCleLegacy('plannings_hebdo', 'plannings');
  assert.equal(localStorage.getItem('plannings'), JSON.stringify([{ id: 1 }]));
  delete global.localStorage;
});

test('migrerCleLegacy : idempotent (deuxieme call no-op)', () => {
  setupLocalStorageStub();
  localStorage.setItem('plannings_hebdo', JSON.stringify([{ id: 1 }]));
  migrerCleLegacy('plannings_hebdo', 'plannings');
  const did2 = migrerCleLegacy('plannings_hebdo', 'plannings');
  assert.equal(did2, false);
  assert.equal(localStorage.getItem('plannings'), JSON.stringify([{ id: 1 }]));
  delete global.localStorage;
});
