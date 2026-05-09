/**
 * MCA Logistics — Tests calcul DSO (Days Sales Outstanding)
 *
 * Sprint H3.4 — couvre :
 *   - Calcul moyen sur 4 livraisons payees (delais 25/30/35/40 -> DSO 33)
 *   - Detail par client (Carrefour J+50 vs autres J+25)
 *   - Cas vide / aucune livraison payee -> dso null
 *   - Exclusion des delais aberrants (< 0 ou > 365j)
 *
 * Lancer : node --test tests/dso.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Le helper expose un export module pour les tests Node, et window.calculerDSO en runtime
const { calculerDSO } = require('../script-core-dso.js');

// Helper : forge une date ISO YYYY-MM-DD a N jours d'aujourd'hui (negatif = passe)
function isoDaysFromNow(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

// Helper : forge une livraison payee avec un delai donne
function liv(client, delaiJours, daysAgoLivraison) {
  // Par defaut, livraison il y a 30j et paiement (30 - delai) j
  const livDay = daysAgoLivraison ?? 30;
  return {
    client,
    statutPaiement: 'paye',
    dateLivraison: isoDaysFromNow(-livDay),
    datePaiement: isoDaysFromNow(-livDay + delaiJours),
  };
}

// =========================================================
// Cas 1 : 4 livraisons payees avec delais 25/30/35/40 -> DSO 33
// =========================================================
test('DSO : 4 livraisons (delais 25/30/35/40) -> moyenne 33', () => {
  const livraisons = [
    liv('A', 25),
    liv('B', 30),
    liv('C', 35),
    liv('D', 40),
  ];
  const r = calculerDSO(livraisons);
  assert.equal(r.count, 4);
  assert.equal(r.dso, 33); // (25+30+35+40)/4 = 32.5 -> arrondi 33
});

// =========================================================
// Cas 2 : Detail par client (Carrefour J+50 vs autres J+25)
// =========================================================
test('DSO byClient : Carrefour lent (J+50) vs autres (J+25)', () => {
  const livraisons = [
    liv('Carrefour', 50),
    liv('Carrefour', 50),
    liv('Lidl', 25),
    liv('Auchan', 25),
  ];
  const r = calculerDSO(livraisons);
  assert.equal(r.count, 4);
  assert.equal(r.byClient.Carrefour, 50);
  assert.equal(r.byClient.Lidl, 25);
  assert.equal(r.byClient.Auchan, 25);
  // Global = (50+50+25+25)/4 = 37.5 -> 38
  assert.equal(r.dso, 38);
});

// =========================================================
// Cas 3 : Aucune livraison payee -> dso null
// =========================================================
test('DSO : aucune livraison payee -> dso null', () => {
  const r = calculerDSO([]);
  assert.equal(r.dso, null);
  assert.equal(r.count, 0);
  assert.deepEqual(r.byClient, {});
});

test('DSO : que des livraisons non payees -> dso null', () => {
  const livraisons = [
    { client: 'A', statutPaiement: 'en-attente', dateLivraison: isoDaysFromNow(-30), datePaiement: null },
    { client: 'B', statutPaiement: 'litige', dateLivraison: isoDaysFromNow(-30), datePaiement: null },
  ];
  const r = calculerDSO(livraisons);
  assert.equal(r.dso, null);
  assert.equal(r.count, 0);
});

// =========================================================
// Cas 4 : Exclusion delais aberrants (> 365j ou < 0)
// =========================================================
test('DSO : delai aberrant > 365j -> exclu', () => {
  const livraisons = [
    liv('Normal', 30, 30),
    // Delai 400 j (livraison il y a 500j, paiement il y a 100j)
    {
      client: 'Aberrant',
      statutPaiement: 'paye',
      dateLivraison: isoDaysFromNow(-500),
      datePaiement: isoDaysFromNow(-100),
    },
  ];
  // Periode 600j pour inclure la livraison anormale dans le scope temporel
  const r = calculerDSO(livraisons, { periodeJours: 600 });
  // L'aberrant doit etre exclu : count=1, dso=30
  assert.equal(r.count, 1);
  assert.equal(r.dso, 30);
  assert.equal(r.byClient.Aberrant, undefined);
});

test('DSO : delai negatif (paiement avant livraison) -> exclu', () => {
  const livraisons = [
    liv('Normal', 30),
    {
      client: 'Inverse',
      statutPaiement: 'paye',
      dateLivraison: isoDaysFromNow(-10),
      datePaiement: isoDaysFromNow(-20), // paiement 10j AVANT livraison
    },
  ];
  const r = calculerDSO(livraisons);
  assert.equal(r.count, 1);
  assert.equal(r.dso, 30);
  assert.equal(r.byClient.Inverse, undefined);
});

// =========================================================
// Bonus : variantes statut + livraison hors fenetre
// =========================================================
test('DSO : accepte les variantes "payé"/"payee"/"payée"', () => {
  const livraisons = [
    { client: 'A', statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-30), datePaiement: isoDaysFromNow(-5) },
    { client: 'B', statutPaiement: 'payé', dateLivraison: isoDaysFromNow(-30), datePaiement: isoDaysFromNow(-5) },
    { client: 'C', statutPaiement: 'payee', dateLivraison: isoDaysFromNow(-30), datePaiement: isoDaysFromNow(-5) },
    { client: 'D', statutPaiement: 'payée', dateLivraison: isoDaysFromNow(-30), datePaiement: isoDaysFromNow(-5) },
  ];
  const r = calculerDSO(livraisons);
  assert.equal(r.count, 4);
  assert.equal(r.dso, 25);
});

test('DSO : exclut les livraisons hors periode (>90j par defaut)', () => {
  const livraisons = [
    liv('Recent', 30, 30),
    // Livraison il y a 200j, paiement il y a 170j
    {
      client: 'Vieux',
      statutPaiement: 'paye',
      dateLivraison: isoDaysFromNow(-200),
      datePaiement: isoDaysFromNow(-170),
    },
  ];
  const r = calculerDSO(livraisons); // periode 90j defaut
  assert.equal(r.count, 1);
  assert.equal(r.byClient.Recent, 30);
  assert.equal(r.byClient.Vieux, undefined);
});
