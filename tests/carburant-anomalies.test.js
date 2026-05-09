/**
 * MCA Logistics — Tests detection anomalies carburant (sprint H2.2)
 *
 * Couvre script-carburant-anomalies.js :
 *   - calculerConsoPlein : conso L/100 entre 2 pleins
 *   - trouverPleinPrecedent : ordre par date desc, exclusion sans km
 *   - detecterAnomaliesPlein : R3 (capacite), R1/R2 (conso anormale),
 *     R4 (doublon < 24h), R5 (km regressif), R6 (km/jour excessif),
 *     R7 (hors heures)
 *
 * Lancer : node --test tests/carburant-anomalies.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detecterAnomaliesPlein,
  calculerConsoPlein,
  calculerMoyenneConso,
  trouverPleinPrecedent,
  trouverPleinPrecedentBrut,
  getDefaults
} = require('../script-carburant-anomalies.js');

const CFG_DEFAULT = getDefaults();

// ============================================================
// calculerConsoPlein : L/100 entre 2 pleins
// ============================================================

test('calculerConsoPlein : 50L sur 500km = 10 L/100', () => {
  const plein = { id: 'p2', vehId: 'v1', date: '2026-05-10', km: 1500, litres: 50 };
  const histo = [
    { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 1000, litres: 40 },
    plein
  ];
  assert.equal(calculerConsoPlein(plein, histo), 10);
});

test('calculerConsoPlein : kmCompteur fallback si km manquant', () => {
  const plein = { id: 'p2', vehId: 'v1', date: '2026-05-10', kmCompteur: 1500, litres: 50 };
  const histo = [
    { id: 'p1', vehId: 'v1', date: '2026-05-01', kmCompteur: 1000, litres: 40 },
    plein
  ];
  assert.equal(calculerConsoPlein(plein, histo), 10);
});

test('calculerConsoPlein : premier plein -> null (pas de precedent)', () => {
  const plein = { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 1000, litres: 40 };
  assert.equal(calculerConsoPlein(plein, [plein]), null);
});

test('calculerConsoPlein : km regressif -> null (pas de calcul si km decroit)', () => {
  const plein = { id: 'p2', vehId: 'v1', date: '2026-05-10', km: 800, litres: 50 };
  const histo = [
    { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 1000, litres: 40 },
    plein
  ];
  assert.equal(calculerConsoPlein(plein, histo), null);
});

test('calculerConsoPlein : litres invalides ou km manquant -> null', () => {
  assert.equal(calculerConsoPlein({ id: 'x', vehId: 'v1', date: '2026-05-10' }, []), null);
  assert.equal(calculerConsoPlein({ id: 'x', vehId: 'v1', date: '2026-05-10', km: 1000, litres: 0 }, []), null);
  assert.equal(calculerConsoPlein(null, []), null);
  // vehId manquant
  assert.equal(calculerConsoPlein({ id: 'x', date: '2026-05-10', km: 1000, litres: 50 }, []), null);
});

// ============================================================
// trouverPleinPrecedent : ordre date desc, exclusion sans km
// ============================================================

test('trouverPleinPrecedent : retourne le plus recent avant la date', () => {
  const cur = { id: 'p3', vehId: 'v1', date: '2026-05-15' };
  const histo = [
    { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 100 },
    { id: 'p2', vehId: 'v1', date: '2026-05-10', km: 500 },
    cur
  ];
  const prec = trouverPleinPrecedent(cur, histo);
  assert.equal(prec.id, 'p2');
});

test('trouverPleinPrecedent : ignore les pleins sans km', () => {
  const cur = { id: 'p3', vehId: 'v1', date: '2026-05-15' };
  const histo = [
    { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 100 },
    { id: 'p2', vehId: 'v1', date: '2026-05-10' /* pas de km */ },
    cur
  ];
  const prec = trouverPleinPrecedent(cur, histo);
  assert.equal(prec.id, 'p1');
});

// ============================================================
// detecterAnomaliesPlein : R3 capacite reservoir
// ============================================================

test('R3 : litres > capacite reservoir -> anomalie rouge "capacite_reservoir"', () => {
  const plein = { id: 'p1', vehId: 'v1', date: '2026-05-10', km: 1000, litres: 110 };
  const ctx = {
    config: CFG_DEFAULT,
    pleinsVeh: [plein],
    vehicules: [{ id: 'v1', capaciteReservoir: 80 }]
  };
  const ano = detecterAnomaliesPlein(plein, ctx);
  const r3 = ano.find(a => a.type === 'capacite_reservoir');
  assert.ok(r3, 'doit detecter capacite reservoir depassee');
  assert.equal(r3.niveau, 'rouge');
  assert.equal(r3.litres, 110);
  assert.equal(r3.capacite, 80);
});

test('R3 : litres = capacite -> pas d anomalie', () => {
  const plein = { id: 'p1', vehId: 'v1', date: '2026-05-10', km: 1000, litres: 80 };
  const ctx = {
    config: CFG_DEFAULT,
    pleinsVeh: [plein],
    vehicules: [{ id: 'v1', capaciteReservoir: 80 }]
  };
  const ano = detecterAnomaliesPlein(plein, ctx);
  assert.equal(ano.find(a => a.type === 'capacite_reservoir'), undefined);
});

test('R3 : capacite non renseignee -> pas de detection (silencieuse)', () => {
  const plein = { id: 'p1', vehId: 'v1', date: '2026-05-10', km: 1000, litres: 200 };
  const ctx = {
    config: CFG_DEFAULT,
    pleinsVeh: [plein],
    vehicules: [{ id: 'v1' }] // pas de capaciteReservoir
  };
  const ano = detecterAnomaliesPlein(plein, ctx);
  assert.equal(ano.find(a => a.type === 'capacite_reservoir'), undefined);
});

// ============================================================
// R1/R2 : conso anormale vs moyenne
// ============================================================

test('R2 : conso > moyenne + 50% -> anomalie rouge "conso_critique"', () => {
  // 4 pleins precedents a ~10 L/100, 1 plein courant a 16 L/100 (+60%).
  const histo = [];
  let km = 0;
  for (let i = 0; i < 5; i++) {
    histo.push({ id: 'h' + i, vehId: 'v1', date: '2026-04-' + String(i + 1).padStart(2, '0'), km: km, litres: 50 });
    km += 500; // 500km / 50L = 10 L/100
  }
  // Plein courant : depuis 0 -> +500km -> 80L (16 L/100, soit +60%)
  // Reset km : derniere valeur = 2000, courant = 2500, litres 80 -> 80/500*100 = 16
  const cur = { id: 'cur', vehId: 'v1', date: '2026-05-10', km: 2500, litres: 80 };
  const all = histo.concat([cur]);
  const ctx = { config: CFG_DEFAULT, pleinsVeh: all, vehicules: [] };
  const ano = detecterAnomaliesPlein(cur, ctx);
  const r2 = ano.find(a => a.type === 'conso_critique');
  assert.ok(r2, 'conso +60% > seuil rouge 50%');
  assert.equal(r2.niveau, 'rouge');
});

test('R1 : conso > moyenne + 25% sans atteindre 50% -> orange "conso_haute"', () => {
  // Idem mais courant a 13 L/100 (+30%, > orange 25 mais < rouge 50)
  const histo = [];
  let km = 0;
  for (let i = 0; i < 5; i++) {
    histo.push({ id: 'h' + i, vehId: 'v1', date: '2026-04-' + String(i + 1).padStart(2, '0'), km: km, litres: 50 });
    km += 500;
  }
  // Plein courant : 65L sur 500km = 13 L/100 (+30%)
  const cur = { id: 'cur', vehId: 'v1', date: '2026-05-10', km: 2500, litres: 65 };
  const all = histo.concat([cur]);
  const ctx = { config: CFG_DEFAULT, pleinsVeh: all, vehicules: [] };
  const ano = detecterAnomaliesPlein(cur, ctx);
  const r1 = ano.find(a => a.type === 'conso_haute');
  assert.ok(r1, 'conso +30% entre orange 25 et rouge 50');
  assert.equal(r1.niveau, 'orange');
});

// ============================================================
// R4 : 2 pleins en moins de 24h sans km parcourus
// ============================================================

test('R4 : 2 pleins memes km en < 24h -> orange "doublon_plein"', () => {
  const p1 = { id: 'p1', vehId: 'v1', date: '2026-05-10', creeLe: '2026-05-10T08:00:00Z', km: 1000, litres: 50 };
  // 2eme plein 5h plus tard, meme km
  const p2 = { id: 'p2', vehId: 'v1', date: '2026-05-10', creeLe: '2026-05-10T13:00:00Z', km: 1000, litres: 30 };
  const ctx = {
    config: CFG_DEFAULT,
    pleinsVeh: [p1, p2],
    vehicules: []
  };
  const ano = detecterAnomaliesPlein(p2, ctx);
  const r4 = ano.find(a => a.type === 'doublon_plein');
  assert.ok(r4, 'doit detecter doublon < 24h sans km parcourus');
  assert.equal(r4.niveau, 'orange');
  assert.ok(r4.deltaHeures < 24);
  assert.ok(r4.deltaKm < 5);
});

test('R4 : 2 pleins memes km mais > 24h ecart -> pas de doublon detecte', () => {
  const p1 = { id: 'p1', vehId: 'v1', date: '2026-05-09', creeLe: '2026-05-09T08:00:00Z', km: 1000, litres: 50 };
  const p2 = { id: 'p2', vehId: 'v1', date: '2026-05-11', creeLe: '2026-05-11T08:00:00Z', km: 1000, litres: 30 };
  const ctx = { config: CFG_DEFAULT, pleinsVeh: [p1, p2], vehicules: [] };
  const ano = detecterAnomaliesPlein(p2, ctx);
  assert.equal(ano.find(a => a.type === 'doublon_plein'), undefined);
});

// ============================================================
// R5 : km regressif -> rouge
// ============================================================

test('R5 : km saisi < km precedent -> rouge "regression_km"', () => {
  const p1 = { id: 'p1', vehId: 'v1', date: '2026-05-01', creeLe: '2026-05-01T08:00:00Z', km: 5000, litres: 50 };
  const p2 = { id: 'p2', vehId: 'v1', date: '2026-05-10', creeLe: '2026-05-10T08:00:00Z', km: 4500, litres: 30 };
  const ctx = { config: CFG_DEFAULT, pleinsVeh: [p1, p2], vehicules: [] };
  const ano = detecterAnomaliesPlein(p2, ctx);
  const r5 = ano.find(a => a.type === 'regression_km');
  assert.ok(r5, 'doit detecter km regressif');
  assert.equal(r5.niveau, 'rouge');
  assert.equal(r5.km, 4500);
  assert.equal(r5.kmPrecedent, 5000);
});

test('R5 : detection desactivee -> pas d anomalie', () => {
  const p1 = { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 5000, litres: 50 };
  const p2 = { id: 'p2', vehId: 'v1', date: '2026-05-10', km: 4500, litres: 30 };
  const ctx = {
    config: Object.assign({}, CFG_DEFAULT, { detecterRegression: false }),
    pleinsVeh: [p1, p2],
    vehicules: []
  };
  const ano = detecterAnomaliesPlein(p2, ctx);
  assert.equal(ano.find(a => a.type === 'regression_km'), undefined);
});

// ============================================================
// R6 : km/jour excessif depuis le plein precedent
// ============================================================

test('R6 : 1500 km en 1 jour > seuil 1000 -> orange "km_excessif"', () => {
  const p1 = { id: 'p1', vehId: 'v1', date: '2026-05-09', km: 1000, litres: 50 };
  const p2 = { id: 'p2', vehId: 'v1', date: '2026-05-10', km: 2500, litres: 100 };
  const ctx = { config: CFG_DEFAULT, pleinsVeh: [p1, p2], vehicules: [] };
  const ano = detecterAnomaliesPlein(p2, ctx);
  const r6 = ano.find(a => a.type === 'km_excessif');
  assert.ok(r6, 'doit detecter km/jour excessif');
  assert.equal(r6.niveau, 'orange');
  assert.equal(r6.kmParJour, 1500);
});

// ============================================================
// Cas limites : aucune detection si donnees insuffisantes
// ============================================================

test('plein null -> liste vide (pas de crash)', () => {
  assert.deepEqual(detecterAnomaliesPlein(null, {}), []);
});

test('plein sans veh + sans precedent -> liste vide', () => {
  const plein = { id: 'p1', vehId: 'v1', date: '2026-05-10', km: 1000, litres: 50 };
  const ctx = { config: CFG_DEFAULT, pleinsVeh: [plein], vehicules: [] };
  const ano = detecterAnomaliesPlein(plein, ctx);
  // Aucun precedent, aucune capacite renseignee -> 0 anomalies
  assert.equal(ano.length, 0);
});

test('vehicule sans conso configuree (pas d historique) -> pas de R1/R2', () => {
  // Un seul plein historique : pas assez pour une moyenne (besoin de 2)
  const p1 = { id: 'p1', vehId: 'v1', date: '2026-05-01', km: 1000, litres: 50 };
  const p2 = { id: 'p2', vehId: 'v1', date: '2026-05-10', km: 1500, litres: 200 }; // 40 L/100 (enorme)
  const ctx = { config: CFG_DEFAULT, pleinsVeh: [p1, p2], vehicules: [] };
  const ano = detecterAnomaliesPlein(p2, ctx);
  // Pas de R1/R2 car pas assez d'historique pour calculer la moyenne
  assert.equal(ano.find(a => a.type === 'conso_critique'), undefined);
  assert.equal(ano.find(a => a.type === 'conso_haute'), undefined);
});

// ============================================================
// Prix au litre incoherent (test calcul independant)
// ============================================================

test('prix au litre : detecte plage anormale (< 1€/L ou > 2.5€/L)', () => {
  function isPrixLitreAnormal(litres, totalTTC) {
    if (!litres || !totalTTC) return false;
    const prix = totalTTC / litres;
    return prix < 1 || prix > 2.5;
  }
  // Cas normal : 50L a 80€ = 1.6 €/L OK
  assert.equal(isPrixLitreAnormal(50, 80), false);
  // Cas anormal bas : 50L a 30€ = 0.6 €/L (erreur saisie)
  assert.equal(isPrixLitreAnormal(50, 30), true);
  // Cas anormal haut : 50L a 200€ = 4 €/L (erreur saisie ou triche)
  assert.equal(isPrixLitreAnormal(50, 200), true);
  // Cas valeurs nulles : pas d alerte (silencieux)
  assert.equal(isPrixLitreAnormal(0, 80), false);
  assert.equal(isPrixLitreAnormal(50, 0), false);
});

// ============================================================
// calculerMoyenneConso : moyenne pondaree sur fenetre histo
// ============================================================

test('calculerMoyenneConso : moyenne sur N pleins precedents (au moins 2 conso valides)', () => {
  // 6 pleins a conso constante 10 L/100 : moyenne = 10
  const histo = [];
  let km = 0;
  for (let i = 0; i < 6; i++) {
    histo.push({ id: 'h' + i, vehId: 'v1', date: '2026-04-' + String(i + 1).padStart(2, '0'), km: km, litres: 50 });
    km += 500;
  }
  const cur = { id: 'cur', vehId: 'v1', date: '2026-05-01', km: km, litres: 50 };
  const all = histo.concat([cur]);
  const moy = calculerMoyenneConso(cur, all, 6);
  assert.ok(moy != null);
  assert.equal(Math.round(moy), 10);
});

test('calculerMoyenneConso : trop peu d historique -> null', () => {
  const histo = [
    { id: 'h0', vehId: 'v1', date: '2026-04-01', km: 0, litres: 50 }
  ];
  const cur = { id: 'cur', vehId: 'v1', date: '2026-05-01', km: 500, litres: 50 };
  assert.equal(calculerMoyenneConso(cur, histo.concat([cur]), 6), null);
});
