/**
 * Tests parite KPIs dashboard PC/mobile (Bug #6 audit Chrome).
 *
 * Verifie que MCAKpis (script-core-dashboard-kpis.js) retourne les memes
 * valeurs cote PC et cote mobile pour le meme dataset, et que la convention
 * de schema (prix=TTC, prixHT=HT prioritaire) est respectee.
 *
 * Reference scenario : livraison HT 150 € / TVA 30 € / TTC 180 €.
 *   - PC affichait CA HT 150 € (correct)
 *   - mobile affichait CA HT 180 € (incorrect — traitait prix comme HT)
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const Kpis = require('../script-core-dashboard-kpis.js');

test('getMontantHT : prixHT explicite prioritaire', () => {
  const liv = { prix: 180, prixHT: 150, tauxTVA: 20 };
  assert.equal(Math.round(Kpis.getMontantHT(liv) * 100) / 100, 150);
});

test('getMontantHT : prix=TTC, divise par (1+TVA/100)', () => {
  const liv = { prix: 180, tauxTVA: 20 };
  assert.equal(Math.round(Kpis.getMontantHT(liv) * 100) / 100, 150);
});

test('getMontantHT : sans tauxTVA -> defaut 20%', () => {
  const liv = { prix: 120 };
  assert.equal(Math.round(Kpis.getMontantHT(liv) * 100) / 100, 100);
});

test('getMontantHT : null/undefined -> 0', () => {
  assert.equal(Kpis.getMontantHT(null), 0);
  assert.equal(Kpis.getMontantHT(undefined), 0);
  assert.equal(Kpis.getMontantHT({}), 0);
});

test('getMontantTTC : prix prioritaire si renseigne', () => {
  const liv = { prix: 180, prixHT: 150, tauxTVA: 20 };
  assert.equal(Kpis.getMontantTTC(liv), 180);
});

test('getMontantTTC : reconstruit depuis prixHT * (1+TVA/100)', () => {
  const liv = { prixHT: 150, tauxTVA: 20 };
  assert.equal(Math.round(Kpis.getMontantTTC(liv) * 100) / 100, 180);
});

test('calcCAMois : HT et TTC corrects pour livraison reference', () => {
  const livs = [{ date: '2026-05-09', prix: 180, prixHT: 150, tauxTVA: 20 }];
  const r = Kpis.calcCAMois(livs, '2026-05', []);
  assert.equal(Math.round(r.caHT * 100) / 100, 150);
  assert.equal(r.caTTC, 180);
  assert.equal(r.nbLivraisons, 1);
});

test('calcCAMois : filtre sur le mois', () => {
  const livs = [
    { date: '2026-05-09', prix: 180, prixHT: 150 },
    { date: '2026-04-15', prix: 120, prixHT: 100 }
  ];
  const r = Kpis.calcCAMois(livs, '2026-05');
  assert.equal(Math.round(r.caHT * 100) / 100, 150);
  assert.equal(r.nbLivraisons, 1);
});

test('calcCAMois : avoirs deduits', () => {
  const livs = [{ date: '2026-05-09', prixHT: 150, prix: 180 }];
  const avoirs = [{ date: '2026-05-10', montantHT: 50, montantTTC: 60 }];
  const r = Kpis.calcCAMois(livs, '2026-05', avoirs);
  assert.equal(Math.round(r.caHT * 100) / 100, 100);
  assert.equal(r.caTTC, 120);
});

test('calcChargesMois : ventile par categorie + cumul carburant', () => {
  const charges = [
    { date: '2026-05-01', categorie: 'carburant', montantHT: 80 },
    { date: '2026-05-02', categorie: 'entretien', montantHT: 60 },
    { date: '2026-05-03', categorie: 'salaires', montantHT: 200 },
    { date: '2026-05-04', categorie: 'autres', montantHT: 40 }
  ];
  const carburant = [{ date: '2026-05-05', total: 120, tauxTVA: 20 }];
  const r = Kpis.calcChargesMois(charges, carburant, '2026-05');
  assert.equal(Math.round(r.carburant * 100) / 100, 180); // 80 + 100 (120 TTC -> 100 HT)
  assert.equal(r.entretien, 60);
  assert.equal(r.salaires, 200);
  assert.equal(r.autres, 40);
  assert.equal(Math.round(r.total * 100) / 100, 480);
});

test('calcBenefice : caHT - charges', () => {
  assert.equal(Kpis.calcBenefice(150, 250), -100);
  assert.equal(Kpis.calcBenefice(500, 300), 200);
});

test('calcAlertesActives : filtre lu/traitee/ignoree/repousseJusquA', () => {
  const futur = new Date(Date.now() + 86400000).toISOString();
  const passe = new Date(Date.now() - 86400000).toISOString();
  const arr = [
    { lu: false, traitee: false, ignoree: false }, // active
    { lu: true }, // exclu
    { traitee: true }, // exclu
    { ignoree: true }, // exclu
    { meta: { repousseJusquA: futur } }, // exclu (reportee dans futur)
    { meta: { repousseJusquA: passe } } // active (report passe)
  ];
  assert.equal(Kpis.calcAlertesActives(arr), 2);
});

test('parite PC/mobile : meme dataset = memes resultats', () => {
  // Scenario reproduit du bug audit : PC affichait correctement, mobile faussait.
  const dataset = {
    livraisons: [
      { date: '2026-05-09', prix: 180, prixHT: 150, tauxTVA: 20 },
      { date: '2026-05-12', prix: 240, prixHT: 200, tauxTVA: 20 }
    ],
    charges: [
      { date: '2026-05-03', categorie: 'salaires', montantHT: 300 },
      { date: '2026-05-05', categorie: 'autres', montant: 60, tauxTVA: 20 }
    ],
    carburant: [{ date: '2026-05-10', total: 120, tauxTVA: 20 }],
    alertes_admin: [
      { lu: false, traitee: false, ignoree: false, type: 'ct_expire' }
    ]
  };
  const r = Kpis.calcKpisDashboard(dataset, '2026-05');
  assert.equal(Math.round(r.caHT * 100) / 100, 350);
  assert.equal(r.caTTC, 420);
  assert.equal(Math.round(r.charges.carburant * 100) / 100, 100);
  assert.equal(r.charges.salaires, 300);
  assert.equal(Math.round(r.charges.autres * 100) / 100, 50);
  assert.equal(Math.round(r.charges.total * 100) / 100, 450);
  assert.equal(Math.round(r.benefice * 100) / 100, -100);
  assert.equal(r.alertes, 1);
});

test('regression bug audit : prix=180 sans prixHT explicite donne caHT=150', () => {
  // Bug d'origine : mobile faisait `parseNum(l.prix) || parseNum(l.prixHT)`
  // -> retournait 180 au lieu de 150 quand seul prix etait renseigne.
  const livs = [{ date: '2026-05-09', prix: 180, tauxTVA: 20 }];
  const r = Kpis.calcCAMois(livs, '2026-05');
  assert.equal(Math.round(r.caHT * 100) / 100, 150);
  assert.equal(r.caTTC, 180);
});

test('regression bug audit : alertes count identique cote PC et mobile', () => {
  const arr = [
    { lu: false, traitee: false, ignoree: false, type: 'a' },
    { lu: false, traitee: false, ignoree: false, type: 'b' },
    { lu: true, type: 'c' },
    { traitee: true, type: 'd' }
  ];
  assert.equal(Kpis.calcAlertesActives(arr), 2);
});
