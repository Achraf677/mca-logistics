/**
 * MCA Logistics — Tests rentabilite (sprint H2.2)
 *
 * Couvre les calculs critiques :
 *   - Mensualite vehicule selon mode acquisition (LLD / credit / achat) :
 *     script-rentabilite.js -> getVehiculeMensualiteRentabilite
 *   - Marge brute par vehicule, allocation prorata (livraisons / CA / km),
 *     marge par chauffeur, marge par tournee :
 *     script-rentabilite-multi.js -> calculerRentabilite{ParVehicule,ParClient,
 *     ParChauffeur,ParTournee}
 *   - Cas limites : vehicule sans km, salarie sans livraison, charges sans
 *     rattachement, aucune livraison sur la periode.
 *
 * Approche :
 *   - require() direct du fichier source (exports ajoutes en sprint H2.2 via
 *     `if (typeof module !== 'undefined')`).
 *   - Pour rentabilite-multi qui appelle `charger()` au scope global, on
 *     injecte un fake `globalThis.charger` avant le require, qui retourne
 *     les datasets de test.
 *
 * Lancer : node --test tests/rentabilite.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Setup : injecter un fake `charger` AVANT le require pour que
// les fonctions appellent notre dataset de test au lieu de tomber sur le
// scope global "charger" non defini.
// ============================================================

let __dataset = {};
globalThis.charger = function (key) {
  return __dataset[key] || [];
};

const rentabiliteSimple = require('../script-rentabilite.js');
const rentabiliteMulti  = require('../script-rentabilite-multi.js');

const {
  getVehiculeMensualiteRentabilite,
  getRentabiliteDefaults
} = rentabiliteSimple;

const {
  getMontantHTLiv,
  getTourneeId,
  calculerRentabiliteParVehicule,
  calculerRentabiliteParClient,
  calculerRentabiliteParChauffeur,
  calculerRentabiliteParTournee
} = rentabiliteMulti;

function setDataset(data) { __dataset = data || {}; }

const RANGE = { debut: '2026-05-01', fin: '2026-05-31' };

// ============================================================
// getVehiculeMensualiteRentabilite — pure function
// ============================================================

test('mensualite vehicule LLD : retourne loyer mensuel HT', () => {
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'lld', loyerMensuelHT: 450 }), 450);
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'location', loyerMensuelHT: '320' }), 320);
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'loa', loyerMensuelHT: 500 }), 500);
});

test('mensualite vehicule credit : retourne mensualite HT', () => {
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'credit', creditMensualiteHT: 380 }), 380);
});

test('mensualite vehicule achat : amortissement = prix / (duree * 12)', () => {
  // Achat 24000 € sur 5 ans (60 mois) -> 400 €/mois
  assert.equal(
    getVehiculeMensualiteRentabilite({ modeAcquisition: 'achat', prixAchatHT: 24000, dureeAmortissement: 5 }),
    400
  );
  assert.equal(
    getVehiculeMensualiteRentabilite({ modeAcquisition: 'occasion', prixAchatHT: 12000, dureeAmortissement: 4 }),
    250
  );
});

test('mensualite vehicule : 0 si parametres manquants ou cas limite', () => {
  assert.equal(getVehiculeMensualiteRentabilite(null), 0);
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'achat' }), 0); // pas de prix
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'achat', prixAchatHT: 12000, dureeAmortissement: 0 }), 0);
  assert.equal(getVehiculeMensualiteRentabilite({ modeAcquisition: 'inconnu', loyerMensuelHT: 500 }), 0);
});

test('rentabilite defaults : structure complete et types', () => {
  const d = getRentabiliteDefaults();
  assert.equal(d.modeCalcul, 'manuel');
  assert.equal(d.repartitionCharges, 'mensuel');
  assert.equal(d.tva, 20);
  assert.deepEqual(d.autresCharges, []);
});

// ============================================================
// getMontantHTLiv (rentabilite-multi)
// ============================================================

test('getMontantHTLiv : prixHT prioritaire si renseigne', () => {
  assert.equal(getMontantHTLiv({ prixHT: 100, prix: 120, tauxTVA: 20 }), 100);
});

test('getMontantHTLiv : derive HT depuis TTC + tauxTVA', () => {
  const ht = getMontantHTLiv({ prix: 120, tauxTVA: 20 });
  assert.equal(Math.round(ht * 100) / 100, 100);
});

test('getMontantHTLiv : null/undefined safe', () => {
  assert.equal(getMontantHTLiv(null), 0);
  assert.equal(getMontantHTLiv({}), 0);
});

// ============================================================
// getTourneeId (rentabilite-multi)
// ============================================================

test('getTourneeId : chauffeur + date jour = identifiant stable', () => {
  assert.equal(getTourneeId({ chaufId: 'chf-1', date: '2026-05-12' }), 'chf-1__2026-05-12');
  // ISO complet : seul le YYYY-MM-DD est garde
  assert.equal(getTourneeId({ chaufId: 'chf-1', date: '2026-05-12T08:30:00Z' }), 'chf-1__2026-05-12');
});

test('getTourneeId : chauffeur manquant -> sans-chauffeur', () => {
  assert.equal(getTourneeId({ date: '2026-05-12' }), 'sans-chauffeur__2026-05-12');
});

test('getTourneeId : date manquante -> null', () => {
  assert.equal(getTourneeId({ chaufId: 'chf-1' }), null);
  assert.equal(getTourneeId(null), null);
});

// ============================================================
// calculerRentabiliteParVehicule
// ============================================================

test('rent par vehicule : marge brute = CA HT - couts directs (carburant + charges + entretien)', () => {
  setDataset({
    vehicules: [{ id: 'veh-1', immat: 'AB-123-CD', modele: 'Renault Master' }],
    livraisons: [
      { id: 'liv-1', vehId: 'veh-1', date: '2026-05-10', prixHT: 200, distance: 80 },
      { id: 'liv-2', vehId: 'veh-1', date: '2026-05-15', prixHT: 300, distance: 120 }
    ],
    carburant: [
      { id: 'p-1', vehId: 'veh-1', date: '2026-05-12', total: 120, tauxTVA: 20 } // 100 HT
    ],
    charges: [
      { id: 'c-1', vehId: 'veh-1', date: '2026-05-08', categorie: 'assurance', montant: 60, tauxTVA: 20 } // 50 HT
    ],
    entretiens: [
      { id: 'e-1', vehId: 'veh-1', date: '2026-05-14', cout: 80 }
    ]
  });
  const res = calculerRentabiliteParVehicule(RANGE);
  assert.equal(res.length, 1);
  const v = res[0];
  assert.equal(v.ca, 500);
  assert.equal(v.coutCarburant, 100);
  assert.equal(v.coutCharges, 50);
  assert.equal(v.coutEntretien, 80);
  assert.equal(v.coutTotal, 230);
  assert.equal(v.marge, 270);
  assert.equal(Math.round(v.margePct * 10) / 10, 54);
  assert.equal(v.kmTotal, 200);
});

test('rent par vehicule : charge sans rattachement (vehId vide) exclue du calcul direct', () => {
  setDataset({
    vehicules: [{ id: 'veh-1', immat: 'XX-999-XX' }],
    livraisons: [{ id: 'l1', vehId: 'veh-1', date: '2026-05-10', prixHT: 100, distance: 50 }],
    carburant: [],
    charges: [
      { id: 'c-orph', vehId: '', date: '2026-05-10', categorie: 'admin', montant: 240, tauxTVA: 20 }
    ],
    entretiens: []
  });
  const res = calculerRentabiliteParVehicule(RANGE);
  // La charge orpheline ne doit pas apparaitre dans coutCharges
  const v = res.find(s => s.vehId === 'veh-1');
  assert.equal(v.coutCharges, 0);
  assert.equal(v.marge, 100);
});

test('rent par vehicule : categorie tva et salaires exclues', () => {
  setDataset({
    vehicules: [{ id: 'veh-1', immat: 'AB-1' }],
    livraisons: [{ id: 'l1', vehId: 'veh-1', date: '2026-05-10', prixHT: 100, distance: 50 }],
    carburant: [],
    charges: [
      { id: 'tva-1', vehId: 'veh-1', date: '2026-05-10', categorie: 'tva', montant: 50, tauxTVA: 20 },
      { id: 'sal-1', vehId: 'veh-1', date: '2026-05-10', categorie: 'salaires', montant: 1000, tauxTVA: 0 }
    ],
    entretiens: []
  });
  const res = calculerRentabiliteParVehicule(RANGE);
  const v = res.find(s => s.vehId === 'veh-1');
  assert.equal(v.coutCharges, 0); // tva et salaires exclus de la rent par vehicule
});

test('rent par vehicule : sans km -> margePct = 0% si CA = 0', () => {
  setDataset({
    vehicules: [{ id: 'veh-1', immat: 'AB-1' }],
    livraisons: [],
    carburant: [{ id: 'p-1', vehId: 'veh-1', date: '2026-05-12', total: 60, tauxTVA: 20 }],
    charges: [],
    entretiens: []
  });
  const res = calculerRentabiliteParVehicule(RANGE);
  const v = res.find(s => s.vehId === 'veh-1');
  assert.equal(v.ca, 0);
  assert.equal(v.kmTotal, 0);
  assert.equal(v.margePct, 0);
  // Marge negative = pure consommation carburant
  assert.equal(Math.round(v.marge), -50);
});

// ============================================================
// calculerRentabiliteParClient (allocation prorata)
// ============================================================

test('rent par client : repartition charges au prorata du nb de livraisons (defaut)', () => {
  // Pas de config_rentabilite en localStorage en Node -> methodeRepartition = 'livraisons' (default)
  setDataset({
    clients: [
      { id: 'cli-A', nom: 'Client A' },
      { id: 'cli-B', nom: 'Client B' }
    ],
    livraisons: [
      { id: 'l1', clientId: 'cli-A', date: '2026-05-01', prixHT: 100, distance: 50 },
      { id: 'l2', clientId: 'cli-A', date: '2026-05-02', prixHT: 100, distance: 50 },
      { id: 'l3', clientId: 'cli-B', date: '2026-05-03', prixHT: 100, distance: 50 }
    ],
    carburant: [{ id: 'p1', date: '2026-05-04', total: 360, tauxTVA: 20 }], // 300 HT a repartir
    charges: [],
    entretiens: []
  });
  const res = calculerRentabiliteParClient(RANGE);
  const a = res.find(s => s.clientNom === 'Client A');
  const b = res.find(s => s.clientNom === 'Client B');
  // 300 € reparti : A = 2/3 = 200, B = 1/3 = 100
  assert.equal(Math.round(a.coutRepartis), 200);
  assert.equal(Math.round(b.coutRepartis), 100);
  assert.equal(a.ca, 200);
  assert.equal(b.ca, 100);
  assert.equal(a.marge, 0); // 200 CA - 200 cout = 0
  assert.equal(b.marge, 0);
});

test('rent par client : charge imputee directement a une livraison va au client de la livraison', () => {
  setDataset({
    clients: [{ id: 'cli-A', nom: 'A' }, { id: 'cli-B', nom: 'B' }],
    livraisons: [
      { id: 'l1', clientId: 'cli-A', date: '2026-05-01', prixHT: 1000, distance: 100 },
      { id: 'l2', clientId: 'cli-B', date: '2026-05-02', prixHT: 1000, distance: 100 }
    ],
    carburant: [],
    charges: [
      // Charge imputee a l1 (peage par exemple)
      { id: 'c1', livraisonId: 'l1', date: '2026-05-01', montant: 60, tauxTVA: 20 }
    ],
    entretiens: []
  });
  const res = calculerRentabiliteParClient(RANGE);
  const a = res.find(s => s.clientNom === 'A');
  const b = res.find(s => s.clientNom === 'B');
  // 50 HT impute exclusivement au client A
  assert.equal(a.coutImpute, 50);
  assert.equal(b.coutImpute, 0);
  // Pas de charges non imputees a repartir
  assert.equal(a.coutRepartis, 0);
});

// ============================================================
// calculerRentabiliteParChauffeur
// ============================================================

test('rent par chauffeur : CA = livraisons effectuees, salaire = charges salaires avec salId', () => {
  setDataset({
    salaries: [{ id: 'chf-1', nom: 'Dupont' }],
    livraisons: [
      { id: 'l1', chaufId: 'chf-1', vehId: 'veh-1', date: '2026-05-01', prixHT: 500, distance: 100 },
      { id: 'l2', chaufId: 'chf-1', vehId: 'veh-1', date: '2026-05-02', prixHT: 500, distance: 100 }
    ],
    carburant: [{ id: 'p1', vehId: 'veh-1', date: '2026-05-03', total: 240, tauxTVA: 20 }], // 200 HT
    charges: [
      { id: 'sal-1', salId: 'chf-1', categorie: 'salaires', date: '2026-05-31', montant: 2400, tauxTVA: 20 } // 2000 HT
    ]
  });
  const res = calculerRentabiliteParChauffeur(RANGE);
  const c = res.find(s => s.chaufNom === 'Dupont');
  assert.equal(c.ca, 1000);
  assert.equal(Math.round(c.coutSalaire), 2000);
  // Toutes les livs sont du chauffeur sur veh-1 -> 100% du carburant lui revient
  assert.equal(Math.round(c.coutCarburant), 200);
  assert.equal(Math.round(c.marge), 1000 - 2000 - 200);
  assert.equal(c.salairManquant, false);
});

test('rent par chauffeur : aucune charge salaires -> salairManquant true et coutSalaire = 0', () => {
  setDataset({
    salaries: [{ id: 'chf-1', nom: 'X' }],
    livraisons: [{ id: 'l1', chaufId: 'chf-1', date: '2026-05-01', prixHT: 100, distance: 10 }],
    carburant: [],
    charges: []
  });
  const res = calculerRentabiliteParChauffeur(RANGE);
  const c = res.find(s => s.chaufKey === 'chf-1');
  assert.equal(c.coutSalaire, 0);
  assert.equal(c.salairManquant, true);
  assert.equal(c.marge, 100);
});

test('rent par chauffeur : carburant reparti au prorata des livs sur chaque vehicule', () => {
  setDataset({
    salaries: [
      { id: 'chf-A', nom: 'A' },
      { id: 'chf-B', nom: 'B' }
    ],
    livraisons: [
      // veh-1 : 2 livs A + 1 liv B (3 total) -> A = 2/3, B = 1/3
      { id: 'l1', chaufId: 'chf-A', vehId: 'veh-1', date: '2026-05-01', prixHT: 100, distance: 10 },
      { id: 'l2', chaufId: 'chf-A', vehId: 'veh-1', date: '2026-05-02', prixHT: 100, distance: 10 },
      { id: 'l3', chaufId: 'chf-B', vehId: 'veh-1', date: '2026-05-03', prixHT: 100, distance: 10 }
    ],
    carburant: [{ id: 'p1', vehId: 'veh-1', date: '2026-05-04', total: 360, tauxTVA: 20 }], // 300 HT
    charges: []
  });
  const res = calculerRentabiliteParChauffeur(RANGE);
  const a = res.find(s => s.chaufKey === 'chf-A');
  const b = res.find(s => s.chaufKey === 'chf-B');
  assert.equal(Math.round(a.coutCarburant), 200);
  assert.equal(Math.round(b.coutCarburant), 100);
});

// ============================================================
// calculerRentabiliteParTournee
// ============================================================

test('rent par tournee : groupage chaufId + date, salaire reparti prorata livs', () => {
  setDataset({
    salaries: [{ id: 'chf-1', nom: 'Dupont' }],
    vehicules: [{ id: 'veh-1', immat: 'AB-1' }],
    livraisons: [
      { id: 'l1', chaufId: 'chf-1', vehId: 'veh-1', date: '2026-05-10', prixHT: 100, distance: 50 },
      { id: 'l2', chaufId: 'chf-1', vehId: 'veh-1', date: '2026-05-10', prixHT: 200, distance: 80 },
      { id: 'l3', chaufId: 'chf-1', vehId: 'veh-1', date: '2026-05-15', prixHT: 300, distance: 120 }
    ],
    carburant: [{ id: 'p1', vehId: 'veh-1', date: '2026-05-10', total: 60, tauxTVA: 20 }], // 50 HT le 10
    charges: [
      { id: 'sal-1', salId: 'chf-1', categorie: 'salaires', date: '2026-05-31', montant: 1200, tauxTVA: 20 } // 1000 HT
    ]
  });
  const res = calculerRentabiliteParTournee(RANGE);
  // 2 tournees : chf-1 / 2026-05-10 (2 livs, 300 CA), chf-1 / 2026-05-15 (1 liv, 300 CA)
  const t1 = res.find(t => t.date === '2026-05-10');
  const t2 = res.find(t => t.date === '2026-05-15');
  assert.equal(t1.nbLivraisons, 2);
  assert.equal(t1.ca, 300);
  assert.equal(Math.round(t1.coutCarburant), 50); // carburant du jour
  // Salaire 1000 HT reparti : t1=2/3, t2=1/3 (3 livs total chauffeur)
  assert.ok(Math.abs(t1.coutSalaire - (1000 * 2 / 3)) < 0.01);
  assert.ok(Math.abs(t2.coutSalaire - (1000 * 1 / 3)) < 0.01);
  // Carburant tournee 2 = 0 (pas de plein le 15)
  assert.equal(t2.coutCarburant, 0);
});

test('rent par tournee : aucune livraison -> tableau vide', () => {
  setDataset({ salaries: [], vehicules: [], livraisons: [], carburant: [], charges: [] });
  const res = calculerRentabiliteParTournee(RANGE);
  assert.equal(res.length, 0);
});

// ============================================================
// Periode hors range : exclusion
// ============================================================

test('rent par vehicule : livraisons hors range exclues', () => {
  setDataset({
    vehicules: [{ id: 'veh-1', immat: 'AB-1' }],
    livraisons: [
      { id: 'in', vehId: 'veh-1', date: '2026-05-15', prixHT: 100, distance: 10 },
      { id: 'out', vehId: 'veh-1', date: '2026-04-15', prixHT: 999, distance: 999 }
    ],
    carburant: [], charges: [], entretiens: []
  });
  const res = calculerRentabiliteParVehicule(RANGE);
  const v = res.find(s => s.vehId === 'veh-1');
  assert.equal(v.ca, 100);
  assert.equal(v.nbLivraisons, 1);
});
