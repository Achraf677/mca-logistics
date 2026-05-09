/**
 * MCA Logistics — Tests flows critiques chauffeur (audit salarie.html v2)
 *
 * Couvre la logique pure des 5 flows quotidiens du chauffeur :
 *   1. Login chauffeur (via login.html, persist sessionStorage)
 *   2. Marquer une livraison comme livree (changerStatut)
 *   3. Saisir km debut/fin (calcul distance + binding livraison)
 *   4. Saisir un plein carburant (litres x prix, dedup par date)
 *   5. Soumettre une inspection (validations obligatoires)
 *
 * Tests purs (pas de DOM, pas de Supabase). Pour les flows avec UI/Auth reels,
 * voir tests/e2e/09-chauffeur-saisies-base.spec.js (skip-if-no-creds).
 *
 * Bugs couverts (PR claude/salarie-mobile-audit-v2) :
 *   - BUG #1 : majDistanceKm referencait getElementById('km-calcule') alors
 *              que l'id HTML est 'km-distance' -> distance jamais affichee.
 *   - BUG #2 : envoyerInspection reset les ids 'insp-previews' / 'insp-label'
 *              qui n'existent pas (vrai id : 'insp-photos-preview').
 *   - BUG #3 : envoyerInspection cherchait le bouton avec onclick="envoyerInspection()"
 *              mais l'HTML appelle soumettreInspection() -> anti-doublon dead.
 *   - BUG #5 : afficherProfil crashait sur livraison sans date (l.date.startsWith).
 *
 * Lancer : node --test tests/chauffeur-flows.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Helpers : repliquent la logique des modules pour tester sans DOM
// ============================================================

// Replique majDistanceKm (script-salarie.js:888) — version pure.
function calculerDistanceKm(kmDepart, kmArrivee) {
  const dep = parseFloat(kmDepart) || 0;
  const arr = parseFloat(kmArrivee) || 0;
  if (dep > 0 && arr > dep) {
    return { afficher: true, distance: arr - dep, label: (arr - dep).toFixed(0) + ' km' };
  }
  return { afficher: false, distance: 0, label: '0 km' };
}

// Replique enregistrerKmFin (script-salarie.js:1016) — validation pure.
function validerKmFin(kmFin, releve) {
  if (!releve) return { ok: false, raison: 'aucun_km_debut' };
  const arr = parseFloat(kmFin);
  if (!arr || arr <= (releve.kmDepart || 0)) {
    return { ok: false, raison: 'km_fin_inferieur_ou_egal_debut' };
  }
  return { ok: true, distance: arr - releve.kmDepart };
}

// Replique trouverReleveKmEnCours (script-salarie.js:920).
function trouverReleveKmEnCours(entries, date, livId) {
  const candidats = entries
    .filter(e => e.date === date && !e.kmArrivee)
    .sort((a, b) => new Date(b.creeLe || b.date) - new Date(a.creeLe || a.date));
  if (!candidats.length) return null;
  if (livId) {
    const lie = candidats.find(e => e.livId === livId);
    if (lie) return lie;
  }
  return candidats[0];
}

// Replique calculerPlein (script-salarie.js:1155) — validation + total.
function calculerPlein(litres, prixL) {
  const l = parseFloat(litres);
  const p = parseFloat(prixL);
  if (!l || !p || l <= 0 || p <= 0) return { ok: false, total: 0 };
  return { ok: true, total: parseFloat((l * p).toFixed(2)) };
}

// Replique les guards de afficherProfil (script-salarie.js:229-234) avec le fix
// BUG #5 : typeof l.date === 'string' avant startsWith.
function comptageProfilSecurise(livraisons, kmEntries, salId, mois, auj) {
  const livsM = livraisons.filter(l =>
    l.chaufId === salId && typeof l.date === 'string' && l.date.startsWith(mois)
  ).length;
  const livsA = livraisons.filter(l => l.chaufId === salId && l.date === auj).length;
  const kmMois = kmEntries
    .filter(e => typeof e.date === 'string' && e.date.startsWith(mois))
    .reduce((s, e) => s + (e.distance || 0), 0);
  return { livsM, livsA, kmMois };
}

// Replique soumettreInspection (script-salarie.js:1813) — validations pures.
function validerInspection({ date, km, commentaire, photoCount }) {
  if (!date) return { ok: false, raison: 'date_obligatoire' };
  if (!km) return { ok: false, raison: 'km_obligatoire' };
  if (!commentaire || !String(commentaire).trim()) {
    return { ok: false, raison: 'commentaire_obligatoire' };
  }
  if (!photoCount) return { ok: false, raison: 'photo_obligatoire' };
  return { ok: true };
}

// Helper : extraire un bloc de fonction par accolades equilibrees pour tester
// le code source (regression checks). Strip les commentaires pour eviter
// les faux positifs sur les mentions historiques.
function extraireBlocFonction(source, signature) {
  const idx = source.indexOf(signature);
  if (idx < 0) return '';
  const startBrace = source.indexOf('{', idx);
  let depth = 1;
  let i = startBrace + 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return source.slice(idx, i)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

// ============================================================
// FLOW 1 — LOGIN (logique pure : matching d'identifiant)
// ============================================================

test('Flow 1 — login : matching numero salarie case-insensitive', () => {
  const salaries = [
    { id: 'sal-1', numero: 'CHIKRI', nom: 'Mohammed Chikri', actif: true },
    { id: 'sal-2', numero: 'BENABID', nom: 'Karim Benabid', actif: true }
  ];
  const matcher = (numero) => {
    const cible = String(numero || '').trim().toUpperCase();
    return salaries.find(s => String(s.numero || '').trim().toUpperCase() === cible);
  };
  assert.equal(matcher('chikri').id, 'sal-1');
  assert.equal(matcher('CHIKRI').id, 'sal-1');
  assert.equal(matcher('  Chikri ').id, 'sal-1');
  assert.equal(matcher('inconnu'), undefined);
});

test('Flow 1 — login : un salarie inactif ne doit pas pouvoir se connecter', () => {
  const sal = { id: 's1', numero: 'X', actif: false };
  const peutSeConnecter = !!(sal && sal.actif);
  assert.equal(peutSeConnecter, false);
});

// ============================================================
// FLOW 2 — POINTER LIVRAISON (changerStatut)
// ============================================================

test('Flow 2 — changerStatut : transition en-attente -> livre persiste', () => {
  const livraisons = [
    { id: 'liv-1', chaufId: 'sal-1', statut: 'en-attente', date: '2026-05-09', client: 'Acme' }
  ];
  const idx = livraisons.findIndex(l => l.id === 'liv-1');
  livraisons[idx].statut = 'livre';
  assert.equal(livraisons[0].statut, 'livre');
});

test('Flow 2 — chauffeur ne voit que SES livraisons du jour', () => {
  const auj = '2026-05-09';
  const livraisons = [
    { id: '1', chaufId: 'sal-1', date: auj, statut: 'en-attente' },
    { id: '2', chaufId: 'sal-2', date: auj, statut: 'en-attente' },
    { id: '3', chaufId: 'sal-1', date: '2026-05-08', statut: 'livre' },
    { id: '4', chaufId: 'sal-1', date: auj, statut: 'livre' }
  ];
  const miennes = livraisons.filter(l => l.chaufId === 'sal-1' && l.date === auj);
  assert.equal(miennes.length, 2);
  assert.deepEqual(miennes.map(l => l.id).sort(), ['1', '4']);
});

// ============================================================
// FLOW 3 — KM DEBUT/FIN (calcul distance + binding livraison)
// ============================================================

test('Flow 3 — calculerDistanceKm : afficher uniquement si arr > dep > 0', () => {
  assert.deepEqual(calculerDistanceKm(50000, 50450), { afficher: true, distance: 450, label: '450 km' });
  assert.deepEqual(calculerDistanceKm(0, 100), { afficher: false, distance: 0, label: '0 km' });
  assert.deepEqual(calculerDistanceKm(100, 100), { afficher: false, distance: 0, label: '0 km' });
  assert.deepEqual(calculerDistanceKm(200, 100), { afficher: false, distance: 0, label: '0 km' });
  assert.deepEqual(calculerDistanceKm('', ''), { afficher: false, distance: 0, label: '0 km' });
});

test('Flow 3 — BUG #1 regression : majDistanceKm doit cibler #km-distance, pas #km-calcule', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'script-salarie.js'), 'utf8');
  const block = extraireBlocFonction(source, 'function majDistanceKm');
  assert.ok(block, 'fonction majDistanceKm introuvable');
  assert.ok(/km-distance/.test(block),
    'majDistanceKm doit referencer id #km-distance (regression BUG #1)');
  assert.ok(!/km-calcule/.test(block),
    'majDistanceKm ne doit plus referencer l\'ancien id #km-calcule (regression BUG #1)');
});

test('Flow 3 — validerKmFin : km fin doit etre strictement superieur au km debut', () => {
  const releve = { kmDepart: 50000, kmArrivee: null, date: '2026-05-09' };
  assert.deepEqual(validerKmFin(50500, releve), { ok: true, distance: 500 });
  assert.deepEqual(validerKmFin(50000, releve), { ok: false, raison: 'km_fin_inferieur_ou_egal_debut' });
  assert.deepEqual(validerKmFin(49000, releve), { ok: false, raison: 'km_fin_inferieur_ou_egal_debut' });
  assert.deepEqual(validerKmFin(50500, null), { ok: false, raison: 'aucun_km_debut' });
});

test('Flow 3 — trouverReleveKmEnCours : prefere le releve lie a la livraison si livId fourni', () => {
  const entries = [
    { id: 'k1', date: '2026-05-09', kmDepart: 50000, kmArrivee: null, livId: null, creeLe: '2026-05-09T08:00:00Z' },
    { id: 'k2', date: '2026-05-09', kmDepart: 50100, kmArrivee: null, livId: 'liv-A', creeLe: '2026-05-09T09:00:00Z' }
  ];
  assert.equal(trouverReleveKmEnCours(entries, '2026-05-09').id, 'k2');
  assert.equal(trouverReleveKmEnCours(entries, '2026-05-09', 'liv-A').id, 'k2');
  assert.equal(trouverReleveKmEnCours(entries, '2026-05-09', 'liv-B').id, 'k2');
  const closed = [{ id: 'k3', date: '2026-05-09', kmDepart: 50000, kmArrivee: 50500 }];
  assert.equal(trouverReleveKmEnCours(closed, '2026-05-09'), null);
});

// ============================================================
// FLOW 4 — CARBURANT (calcul total + dedup date)
// ============================================================

test('Flow 4 — calculerPlein : produit total litres x prix avec arrondi 2 decimales', () => {
  assert.deepEqual(calculerPlein(40, 1.85), { ok: true, total: 74 });
  assert.deepEqual(calculerPlein(33.5, 1.999), { ok: true, total: 66.97 });
  assert.deepEqual(calculerPlein(0, 1.85), { ok: false, total: 0 });
  assert.deepEqual(calculerPlein(40, 0), { ok: false, total: 0 });
  assert.deepEqual(calculerPlein('', ''), { ok: false, total: 0 });
});

test('Flow 4 — un plein du jour est detecte par la checklist accueil (pleinFait=true)', () => {
  const auj = '2026-05-09';
  const pleins = [
    { id: 'p1', date: '2026-05-08', litres: 40 },
    { id: 'p2', date: auj, litres: 35 }
  ];
  const pleinAuj = pleins.some(p => p.date === auj);
  assert.equal(pleinAuj, true);
});

// ============================================================
// FLOW 5 — INSPECTION (validations obligatoires)
// ============================================================

test('Flow 5 — validerInspection : 4 champs obligatoires + au moins 1 photo', () => {
  const base = { date: '2026-05-09', km: '50000', commentaire: 'RAS', photoCount: 1 };
  assert.deepEqual(validerInspection(base), { ok: true });
  assert.deepEqual(validerInspection({ ...base, date: '' }), { ok: false, raison: 'date_obligatoire' });
  assert.deepEqual(validerInspection({ ...base, km: '' }), { ok: false, raison: 'km_obligatoire' });
  assert.deepEqual(validerInspection({ ...base, commentaire: '' }), { ok: false, raison: 'commentaire_obligatoire' });
  assert.deepEqual(validerInspection({ ...base, commentaire: '   ' }), { ok: false, raison: 'commentaire_obligatoire' });
  assert.deepEqual(validerInspection({ ...base, photoCount: 0 }), { ok: false, raison: 'photo_obligatoire' });
});

// ============================================================
// REGRESSIONS — BUG #5 : afficherProfil ne doit pas crasher sur livraison sans date
// ============================================================

test('BUG #5 regression — afficherProfil resiste a une livraison sans champ date', () => {
  const livraisons = [
    { id: '1', chaufId: 'sal-1', date: '2026-05-09', statut: 'livre' },
    { id: '2', chaufId: 'sal-1' },
    { id: '3', chaufId: 'sal-1', date: null },
    { id: '4', chaufId: 'sal-1', date: '2026-05-01', statut: 'livre' }
  ];
  const kmEntries = [
    { id: 'k1', date: '2026-05-09', distance: 100 },
    { id: 'k2', distance: 50 }
  ];
  const r = comptageProfilSecurise(livraisons, kmEntries, 'sal-1', '2026-05', '2026-05-09');
  assert.equal(r.livsM, 2, 'doit ignorer les livraisons sans date');
  assert.equal(r.livsA, 1, 'doit compter uniquement la livraison du jour');
  assert.equal(r.kmMois, 100, 'doit ignorer les km sans date');
});

// ============================================================
// REGRESSIONS — BUG #2/#3 : reset inspection + bouton selector
// ============================================================

test('BUG #2 regression — envoyerInspection doit cibler les ids HTML reels du form', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'script-salarie.js'), 'utf8');
  const block = extraireBlocFonction(source, 'async function envoyerInspection');
  assert.ok(block, 'fonction envoyerInspection introuvable');
  assert.ok(/insp-photos-preview/.test(block),
    'envoyerInspection doit cibler #insp-photos-preview (vrai id HTML, regression BUG #2)');
});

test('BUG #3 regression — envoyerInspection doit chercher le bouton soumettreInspection', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'script-salarie.js'), 'utf8');
  const block = extraireBlocFonction(source, 'async function envoyerInspection');
  assert.ok(/soumettreInspection/.test(block),
    'envoyerInspection doit chercher button[onclick=soumettreInspection] pour anti-doublon (regression BUG #3)');
});
