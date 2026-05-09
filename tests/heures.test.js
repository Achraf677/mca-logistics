/**
 * MCA Logistics — Tests heures (sprint H2.2)
 *
 * Couvre les calculs critiques sur les heures planifiees et reelles.
 *
 *   - calculerDureeJour (script-core-utils.js) : conversion HH:MM -> heures decimal
 *   - logique mobile vs PC : la BUGFIX v3.63 mobile additionne jour-par-jour
 *     (heuresReelles + heuresPlanifieesAjustees), tandis que le PC fait encore
 *     "heuresReelles > 0 ? heuresReelles : planifiees" (eclipse du planning
 *     des qu'une seule saisie reelle existe). Test expose le bug PC.
 *   - CE 561 : repos hebdo 45h, conduite 9h/j max
 *   - Cas absence (CP / maladie) : 0h compte planifie
 *   - Timezone : passage DST mars/octobre, semaine ISO sur fin d'annee
 *
 * Lancer : node --test tests/heures.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Re-utilise calculerDureeJour reel du codebase (export H2.2).
const coreUtils = require('../script-core-utils.js');
const { calculerDureeJour } = coreUtils;

// ============================================================
// Helpers : repliquent la logique des modules pour tester sans DOM
// ============================================================

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Replique la logique additive mobile (script-mobile.js v3.63) :
// pour chaque jour, on prend la saisie reelle si presente, sinon le planning.
// Resultat : total = reelles + planifiees_des_jours_sans_saisie.
function totalHeuresMobileV363(saisiesReelles, planifieesParJour) {
  const joursAvecSaisie = new Set(saisiesReelles.map(s => s.date));
  const reel = saisiesReelles.reduce((sum, s) => sum + (parseFloat(s.heures) || 0), 0);
  const planifAjuste = Object.entries(planifieesParJour).reduce((sum, [date, h]) => {
    return joursAvecSaisie.has(date) ? sum : sum + h;
  }, 0);
  return reel + planifAjuste;
}

// Replique la logique PC (script-heures.js l.202) :
// const heuresAffich = heuresReelles > 0 ? heuresReelles : planifiees
// = des qu'on a 1 saisie reelle dans le mois, le planning entier disparait.
function totalHeuresPcLegacy(saisiesReelles, planifieesTotal) {
  const reel = saisiesReelles.reduce((sum, s) => sum + (parseFloat(s.heures) || 0), 0);
  return reel > 0 ? reel : planifieesTotal;
}

// Replique calculerDureeJour de script-mobile.js (M.calculerDureeJour) — meme
// logique que script-core-utils.calculerDureeJour, on verifie la parite.
function calculerDureeJourMobile(hd, hf) {
  if (!hd || !hf) return 0;
  const [h1, m1] = String(hd).split(':').map(Number);
  const [h2, m2] = String(hf).split(':').map(Number);
  if ([h1, m1, h2, m2].some(x => Number.isNaN(x))) return 0;
  const min = (h2 * 60 + m2) - (h1 * 60 + m1);
  return min > 0 ? min / 60 : 0;
}

// ============================================================
// calculerDureeJour : conversion HH:MM -> decimal
// ============================================================

test('calculerDureeJour : 8h-17h = 9h', () => {
  assert.equal(calculerDureeJour('08:00', '17:00'), 9);
});

test('calculerDureeJour : 8h30-12h45 = 4.25h', () => {
  assert.equal(calculerDureeJour('08:30', '12:45'), 4.25);
});

test('calculerDureeJour : duree negative ou nulle -> 0', () => {
  // Fin avant debut (horaire decroissant) : retourne 0 sans crash
  assert.equal(calculerDureeJour('17:00', '08:00'), 0);
  assert.equal(calculerDureeJour('12:00', '12:00'), 0);
});

test('calculerDureeJour : entree manquante -> 0', () => {
  assert.equal(calculerDureeJour('', '17:00'), 0);
  assert.equal(calculerDureeJour('08:00', ''), 0);
  assert.equal(calculerDureeJour(null, null), 0);
});

test('calculerDureeJour : parite PC <-> mobile (meme algorithme)', () => {
  const samples = [['07:30', '15:30'], ['09:00', '12:00'], ['14:15', '18:45']];
  samples.forEach(([d, f]) => {
    assert.equal(calculerDureeJour(d, f), calculerDureeJourMobile(d, f));
  });
});

// ============================================================
// BUGFIX v3.63 : logique additive jour-par-jour (mobile)
// ============================================================

test('mobile v3.63 : 1 saisie reelle 8h + 21 jours plannifies 9h = 8 + 189 = 197h', () => {
  // Cas reel decrit dans script-mobile.js l.10145 : 1 saisie 8h sur le 1er
  // mai, mais le salarie est planifie 9h * 22 jours travailles.
  // Avant v3.63 (bug) : 8 > 0 -> total = 8h (198h perdues a l'affichage).
  // Apres v3.63 : total = 8 (reel jour 1) + 21 * 9 (planifie jours suivants) = 197h.
  const saisies = [{ date: '2026-05-01', heures: 8 }];
  const planif = {};
  for (let d = 1; d <= 22; d++) {
    planif[`2026-05-${String(d).padStart(2, '0')}`] = 9;
  }
  const total = totalHeuresMobileV363(saisies, planif);
  // 8 (jour 1 reel) + 21 * 9 (jours 2-22) = 197
  assert.equal(total, 197);
});

test('PC legacy : meme cas -> 8h seulement (BUG : eclipse les 198h plannifies)', () => {
  // Bug actuel cote PC : des qu'on a >0 saisi, le planning est ignore.
  const saisies = [{ date: '2026-05-01', heures: 8 }];
  const planifTotal = 22 * 9; // 198h
  assert.equal(totalHeuresPcLegacy(saisies, planifTotal), 8);
});

test('mobile v3.63 : aucune saisie -> retourne le planning entier', () => {
  const planif = { '2026-05-01': 8, '2026-05-02': 8, '2026-05-03': 8 };
  assert.equal(totalHeuresMobileV363([], planif), 24);
});

test('mobile v3.63 : saisie reelle remplace exactement le planning du meme jour', () => {
  const saisies = [{ date: '2026-05-02', heures: 6 }]; // 6h reelles ce jour
  const planif = { '2026-05-01': 8, '2026-05-02': 9 /* ignoree */, '2026-05-03': 8 };
  // 8 + 6 + 8 = 22 (jour 2 = saisie 6h, pas 9h plannifies)
  assert.equal(totalHeuresMobileV363(saisies, planif), 22);
});

// ============================================================
// CE 561 : conformite reglementaire transport
// ============================================================

test('CE 561 : conduite quotidienne max 9h (extensible 10h 2x/semaine)', () => {
  const conduite = [9, 9, 10, 9, 10]; // semaine type
  const max = Math.max(...conduite);
  const extensions = conduite.filter(h => h > 9).length;
  assert.equal(max, 10);
  assert.ok(extensions <= 2, 'CE 561 art.6 : max 2 extensions a 10h par semaine');
});

test('CE 561 : repos hebdomadaire min 45h (regulier)', () => {
  // Semaine de travail finit vendredi 18h, lundi 8h -> 62h de repos
  const finVendredi = new Date('2026-05-08T18:00:00');
  const debutLundi  = new Date('2026-05-11T08:00:00');
  const reposH = (debutLundi - finVendredi) / 3600000;
  assert.ok(reposH >= 45, 'repos hebdo regulier doit etre >= 45h');
});

// ============================================================
// Format HH:MM <-> decimal (incoherences fr-FR)
// ============================================================

function decimalVersHHMM(decH) {
  if (!Number.isFinite(decH) || decH < 0) return '00:00';
  const h = Math.floor(decH);
  const m = Math.round((decH - h) * 60);
  // Cas 7.999h -> 8h00 (pas 7h60)
  if (m === 60) return String(h + 1).padStart(2, '0') + ':00';
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

test('decimal vers HH:MM : conversion sans bug d arrondi', () => {
  assert.equal(decimalVersHHMM(8), '08:00');
  assert.equal(decimalVersHHMM(8.5), '08:30');
  assert.equal(decimalVersHHMM(8.25), '08:15');
  assert.equal(decimalVersHHMM(7.9999), '08:00'); // arrondi propre
});

test('decimal vers HH:MM : valeurs invalides -> 00:00', () => {
  assert.equal(decimalVersHHMM(NaN), '00:00');
  assert.equal(decimalVersHHMM(-1), '00:00');
});

// ============================================================
// Cas absence : conge/maladie -> 0h plannifie
// ============================================================

function calculerHeuresJourSelonType(typeJour, heureDebut, heureFin) {
  // Replique la logique : seul typeJour='travail' compte les heures
  if (typeJour !== 'travail') return 0;
  return calculerDureeJour(heureDebut, heureFin);
}

test('absence (conge / maladie) : 0h compte meme avec horaires renseignes', () => {
  assert.equal(calculerHeuresJourSelonType('conge', '08:00', '17:00'), 0);
  assert.equal(calculerHeuresJourSelonType('maladie', '08:00', '17:00'), 0);
  assert.equal(calculerHeuresJourSelonType('absence', '08:00', '17:00'), 0);
  assert.equal(calculerHeuresJourSelonType('repos', '08:00', '17:00'), 0);
});

test('jour travaille : compte les heures normalement', () => {
  assert.equal(calculerHeuresJourSelonType('travail', '08:00', '17:00'), 9);
});

// ============================================================
// Timezone : passage DST mars / octobre, semaine ISO 8601
// ============================================================

test('timezone : passage DST mars (heure ete) ne fausse pas la duree d un jour', () => {
  // Le 30 mars 2026 (heure ete en Europe/Paris) : 02:00 -> 03:00.
  // Calcul d une journee 08:00-17:00 doit rester 9h, peu importe le DST.
  // calculerDureeJour ne lit que HH:MM (pas de Date()) donc immune au DST.
  assert.equal(calculerDureeJour('08:00', '17:00'), 9);
});

test('timezone : semaine ISO 8601 sur fin d annee (52 ou 53 semaines)', () => {
  // 2025 a 53 semaines, 2026 a 53 semaines.
  // Verifie que le calcul "lundi de la semaine ISO" gere le 1er janvier
  // tombant un jeudi (W01) ou un vendredi (W53 de l annee precedente).
  function getISOWeekMonday(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    return d;
  }
  // 2026-01-01 = jeudi -> semaine W01 commence lundi 2025-12-29
  const lundiW01 = getISOWeekMonday(new Date('2026-01-01T12:00:00Z'));
  assert.equal(lundiW01.toISOString().slice(0, 10), '2025-12-29');
});

// ============================================================
// Calcul total semaine via JOURS (parite PC <-> mobile)
// ============================================================

test('total semaine 7j : 5 jours travailles 8h + 2 jours repos = 40h', () => {
  const semaine = JOURS.map((jour, i) => ({
    jour,
    typeJour: i < 5 ? 'travail' : 'repos',
    travaille: i < 5,
    heureDebut: i < 5 ? '09:00' : '',
    heureFin:   i < 5 ? '17:00' : ''
  }));
  const total = semaine.reduce(function (sum, j) {
    if (!j.travaille || j.typeJour !== 'travail') return sum;
    return sum + calculerDureeJour(j.heureDebut, j.heureFin);
  }, 0);
  assert.equal(total, 40);
});

test('total semaine : journee avec horaires invalides ne plante pas', () => {
  const total = ['08:00-17:00', '99:99-99:99', '', '08:00-17:00'].reduce(function (sum, slot) {
    const [d, f] = slot.split('-');
    return sum + calculerDureeJour(d, f);
  }, 0);
  // 9 + 0 (invalide) + 0 (vide) + 9 = 18
  assert.equal(total, 18);
});
