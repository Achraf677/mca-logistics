/**
 * MCA Logistics — Tests KPIs page Encaissement PC
 *
 * Couvre les calculs ajoutés par la refonte Encaissement PC v2 :
 *   - Encaissé ce mois : somme TTC des livraisons payées dans le mois courant
 *   - Top retard : nombre de clients avec DSO > 60j (mauvais payeurs)
 *
 * Helpers reproduits ici pour rester en pure logique (les originaux vivent
 * dans script-encaissement.js / script.js, scope IIFE non importable).
 *
 * Lancer : node --test tests/encaissement-kpis.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { calculerDSO } = require('../script-core-dso.js');

function isPaye(l) {
  var s = l && l.statutPaiement;
  return s === 'paye' || s === 'payé' || s === 'payee' || s === 'payée';
}
function ttc(l) { return parseFloat(l.prixTTC) || parseFloat(l.prix) || 0; }
function isoDaysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

// Reproduit la logique de script.js dashboard "Encaissements du mois"
function encaissementsMoisCourant(livraisons) {
  var moisCourant = new Date().toISOString().slice(0, 7);
  return livraisons
    .filter(function (l) { return isPaye(l) && (l.datePaiement || '').startsWith(moisCourant); })
    .reduce(function (s, l) { return s + ttc(l); }, 0);
}

// Reproduit la logique du KPI Top retard (clients DSO > 60j)
function topRetardCount(livraisons) {
  var dsoData = calculerDSO(livraisons);
  return Object.keys(dsoData.byClient || {}).filter(function (c) {
    return dsoData.byClient[c] > 60;
  }).length;
}

// =========================================================
// Encaissé ce mois
// =========================================================
test('Encaissé ce mois : somme TTC des livraisons payées dans le mois courant', () => {
  var moisCourant = new Date().toISOString().slice(0, 7);
  var moisPrec = (function () {
    var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  var livs = [
    { id: 1, statutPaiement: 'payé', datePaiement: moisCourant + '-05', prixTTC: 1200 },
    { id: 2, statutPaiement: 'payée', datePaiement: moisCourant + '-15', prixTTC: 800 },
    { id: 3, statutPaiement: 'payé', datePaiement: moisPrec + '-20', prixTTC: 5000 }, // mois précédent → exclu
    { id: 4, statutPaiement: 'en-attente', datePaiement: '', prixTTC: 999 }, // non payé → exclu
    { id: 5, statutPaiement: 'paye', datePaiement: moisCourant + '-28', prix: 300 }, // fallback prix
  ];
  assert.equal(encaissementsMoisCourant(livs), 1200 + 800 + 300);
});

test('Encaissé ce mois : retourne 0 si aucune livraison du mois courant', () => {
  var livs = [
    { id: 1, statutPaiement: 'payé', datePaiement: '2024-01-15', prixTTC: 1200 },
  ];
  assert.equal(encaissementsMoisCourant(livs), 0);
});

test('Encaissé ce mois : prixTTC prioritaire sur prix', () => {
  var moisCourant = new Date().toISOString().slice(0, 7);
  var livs = [
    { id: 1, statutPaiement: 'payé', datePaiement: moisCourant + '-10', prix: 100, prixTTC: 200 },
  ];
  assert.equal(encaissementsMoisCourant(livs), 200);
});

// =========================================================
// Top 5 retard (DSO > 60j)
// =========================================================
test('Top retard : count clients avec DSO > 60j', () => {
  // Carrefour : 70j moyenne (mauvais payeur)
  // Auchan    : 65j (mauvais payeur)
  // Lidl      : 30j (bon payeur)
  // Casino    : 90j (mauvais payeur)
  var livs = [
    { client: 'Carrefour', statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-80), datePaiement: isoDaysFromNow(-10) }, // 70j
    { client: 'Auchan',    statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-75), datePaiement: isoDaysFromNow(-10) }, // 65j
    { client: 'Lidl',      statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-40), datePaiement: isoDaysFromNow(-10) }, // 30j
    { client: 'Casino',    statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-85), datePaiement: isoDaysFromNow(0) }, // 85j
  ];
  assert.equal(topRetardCount(livs), 3); // Carrefour, Auchan, Casino
});

test('Top retard : 0 si tous les clients DSO <= 60j', () => {
  var livs = [
    { client: 'Lidl', statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-40), datePaiement: isoDaysFromNow(-10) },
    { client: 'Aldi', statutPaiement: 'paye', dateLivraison: isoDaysFromNow(-50), datePaiement: isoDaysFromNow(-10) }, // 40j
  ];
  assert.equal(topRetardCount(livs), 0);
});

test('Top retard : 0 si aucune livraison payée (DSO null)', () => {
  var livs = [
    { client: 'Carrefour', statutPaiement: 'en-attente', dateLivraison: isoDaysFromNow(-30) },
  ];
  assert.equal(topRetardCount(livs), 0);
});
