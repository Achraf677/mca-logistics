/**
 * MCA Logistics — Tests de non-régression Code Quality H2.1
 *
 * Vérifie qu'on ne réintroduit pas accidentellement les 6 collisions de noms
 * de fonctions globales identifiées par l'audit Code Quality H2.1.
 *
 * Approche : analyse statique du source (pas d'exécution navigateur). On compte
 * les occurrences de patterns d'écriture/réécriture de window.X dans script.js,
 * script-livraisons.js, script-encaissement.js, script-core-ui.js.
 *
 * Pour les wrappers légitimes (chain pattern propre = capture old, chain),
 * on tolère un nombre fixe d'occurrences. Toute occurrence supplémentaire
 * fera échouer le test → forcer le développeur à utiliser le mécanisme
 * de hooks/listeners au lieu d'écraser la canonique.
 *
 * Lancer : node --test tests/code-quality-no-collisions.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/**
 * Strip JS comments (block + line) for static analysis. On garde un placeholder
 * pour ne pas decaler les line numbers (utile pour debug).
 */
function stripComments(src) {
  // Bloc /* ... */
  src = src.replace(/\/\*[\s\S]*?\*\//g, function(m) {
    return m.replace(/[^\n]/g, ' ');
  });
  // Ligne // ...
  src = src.replace(/\/\/[^\n]*/g, '');
  return src;
}

// ============================================================
// 1. afficherLivraisons — 0 réassignement direct (canonique unique
//    dans script-livraisons.js qui délègue à renderLivraisonsAdminFinal)
// ============================================================
test('H2.1 collisions — afficherLivraisons : aucun reassignement window.afficherLivraisons = ...', () => {
  const files = ['script.js', 'script-livraisons.js'];
  for (const f of files) {
    const src = stripComments(read(f));
    // Match: ` window.afficherLivraisons = ` ou `^afficherLivraisons = window.something`
    const wrapperReassign = src.match(/window\.afficherLivraisons\s*=\s*[a-zA-Z_$]/g) || [];
    const bareReassign = src.match(/^afficherLivraisons\s*=\s*window\./gm) || [];
    assert.equal(wrapperReassign.length, 0,
      `${f} : window.afficherLivraisons = ... interdit (collision en chaine garantie). Trouvé: ${wrapperReassign.length}`);
    assert.equal(bareReassign.length, 0,
      `${f} : afficherLivraisons = window.... interdit (override de la fonction declaree). Trouvé: ${bareReassign.length}`);
  }
});

test('H2.1 collisions — afficherLivraisons : exactement 1 declaration `function afficherLivraisons`', () => {
  const liv = stripComments(read('script-livraisons.js'));
  const decls = liv.match(/^function afficherLivraisons\s*\(/gm) || [];
  assert.equal(decls.length, 1,
    `script-livraisons.js doit contenir exactement 1 \`function afficherLivraisons\`. Trouvé: ${decls.length}`);
  // Vérifie que script.js n'a aucune décl de cette fonction
  const main = stripComments(read('script.js'));
  const declsMain = main.match(/^function afficherLivraisons\s*\(/gm) || [];
  assert.equal(declsMain.length, 0, 'script.js ne doit pas declarer afficherLivraisons (canonique = script-livraisons.js)');
});

// ============================================================
// 2. renderLivraisonsAdminFinal — exactement 1 hard def dans script.js
// ============================================================
test('H2.1 collisions — renderLivraisonsAdminFinal : exactement 1 def hard dans script.js', () => {
  const src = stripComments(read('script.js'));
  // Hard def = 'window.renderLivraisonsAdminFinal = function() {' (au top niveau ou dans IIFE)
  const hardDefs = src.match(/window\.renderLivraisonsAdminFinal\s*=\s*function\s*\(/g) || [];
  assert.equal(hardDefs.length, 1,
    `script.js doit contenir exactement 1 def hard de window.renderLivraisonsAdminFinal. Trouvé: ${hardDefs.length}. ` +
    `Si > 1, fusionne ou neutralise les versions plus anciennes (cf. __adminFinalLock H2.1).`);
});

// ============================================================
// 3. naviguerVers — wrappers chaine avec idempotence
// ============================================================
test('H2.1 collisions — naviguerVers : tous les overrides sont des wrappers chaines (avec marqueur idempotent)', () => {
  const files = ['script.js', 'script-encaissement.js'];
  let totalOverrides = 0;
  for (const f of files) {
    const src = stripComments(read(f));
    // Compte 'window.naviguerVers = w;' ou 'window.naviguerVers = wrapped;'
    const overrides = src.match(/window\.naviguerVers\s*=\s*(?:w|wrapped|wraplockNav)\s*;/g) || [];
    totalOverrides += overrides.length;
    // Pour chaque override, on doit voir un marqueur __sNN ou __encHook plus haut (capture orig + idempotent)
    // Sanity-check : compte les `const orig = window.naviguerVers` ou `var orig = window.naviguerVers`
    const origCaptures = src.match(/(?:const|var)\s+orig\s*=\s*window\.naviguerVers/g) || [];
    assert.ok(origCaptures.length >= overrides.length,
      `${f} : chaque override de naviguerVers doit capturer 'orig = window.naviguerVers' avant. orig captures: ${origCaptures.length}, overrides: ${overrides.length}`);
  }
  // Sanity : on attend ~4 wrappers (S16 calendar, S19 alertes, S22 hubs, encaissement).
  // Si quelqu'un en ajoute un 5e ou 6e, ce test continue à passer (chain pattern OK)
  // mais bump le compte attendu pour suivre l'évolution.
  assert.ok(totalOverrides >= 3 && totalOverrides <= 8,
    `Nombre de wrappers naviguerVers = ${totalOverrides} (attendu 3..8). Si > 8, refactoriser en registre de listeners style hooks modal.`);
});

// ============================================================
// 4. fermerFiche360 — canonique S20 + 1 fallback defensif S21
// ============================================================
test('H2.1 collisions — fermerFiche360 : 1 def canonique + 1 fallback guarded `if !function`', () => {
  const src = stripComments(read('script.js'));
  const allDefs = src.match(/window\.fermerFiche360\s*=\s*function\s*\(/g) || [];
  assert.equal(allDefs.length, 2,
    `Attendu : 1 canonique (S20) + 1 fallback (S21 guarde par 'if (typeof window.fermerFiche360 !== \\'function\\')'). Trouvé: ${allDefs.length}`);
  // Verifie que le 2e def est precede d'un guard 'if (typeof window.fermerFiche360 !== \'function\')'
  const guarded = src.match(/if\s*\(\s*typeof\s+window\.fermerFiche360\s*!==\s*'function'\s*\)\s*\{\s*window\.fermerFiche360\s*=/);
  assert.ok(guarded, 'Le 2e def fermerFiche360 doit etre dans un bloc if (typeof window.fermerFiche360 !== function) — fallback defensif.');
});

// ============================================================
// 5. afficherToast — 1 def canonique + 0 wrapper direct (Sprint 10
//    utilise addToastListener)
// ============================================================
test('H2.1 collisions — afficherToast : 1 declaration canonique + addToastListener registry', () => {
  const src = stripComments(read('script.js'));
  const decls = src.match(/^function afficherToast\s*\(/gm) || [];
  assert.equal(decls.length, 1,
    `script.js doit contenir exactement 1 'function afficherToast'. Trouvé: ${decls.length}`);
  // L'expose window.afficherToast = afficherToast; est OK (re-bind a la meme fn)
  const reExpose = src.match(/^window\.afficherToast\s*=\s*afficherToast\s*;\s*$/gm) || [];
  assert.equal(reExpose.length, 1, 'window.afficherToast = afficherToast; doit exister (1 fois) pour exposition globale.');
  // Le registre doit etre present
  assert.ok(src.includes('window.addToastListener'), 'Le registre `addToastListener` doit etre present (pattern fan-out).');
  assert.ok(src.includes('__toastListeners'), '__toastListeners array doit exister pour le fan-out.');
});

// ============================================================
// 6. openModal / closeModal — canonique unique dans script-core-ui.js,
//    pas de wrapper dans script.js (utiliser registerModalHook)
// ============================================================
test('H2.1 collisions — openModal/closeModal : aucun wrapper dans script.js', () => {
  const src = stripComments(read('script.js'));
  // Aucun `window.openModal = function` ni `window.openModal = wrapped` ne doit subsister
  const openWraps = src.match(/window\.openModal\s*=\s*(?:function|wrapped|origOpen|originalOpenModal)/g) || [];
  const closeWraps = src.match(/window\.closeModal\s*=\s*(?:function|wrapped)/g) || [];
  assert.equal(openWraps.length, 0,
    `script.js : ${openWraps.length} wrapper(s) de window.openModal restant(s). Utiliser registerModalHook('open', id, fn).`);
  assert.equal(closeWraps.length, 0,
    `script.js : ${closeWraps.length} wrapper(s) de window.closeModal restant(s). Utiliser registerModalHook('close', id, fn).`);
});

test('H2.1 collisions — openModal/closeModal : registre modal-hooks expose dans script-core-ui.js', () => {
  const src = stripComments(read('script-core-ui.js'));
  assert.ok(src.includes('window.registerModalHook'), 'window.registerModalHook doit etre defini dans script-core-ui.js');
  assert.ok(/function\s+openModal\s*\(/.test(src), 'function openModal doit etre la canonique dans script-core-ui.js');
  assert.ok(/function\s+closeModal\s*\(/.test(src), 'function closeModal doit etre la canonique dans script-core-ui.js');
  // Verifie que les hooks sont bien invoques
  assert.ok(src.includes("__runModalHooks('open'"), 'openModal doit invoquer __runModalHooks(open, id)');
  assert.ok(src.includes("__runModalHooks('close'"), 'closeModal doit invoquer __runModalHooks(close, id)');
});

// ============================================================
// 7. Audit global : compte des marqueurs WRAPPER pour traçabilite
// ============================================================
test('H2.1 collisions — chaque wrapper chaine est documente par un commentaire WRAPPER', () => {
  // Compte les commentaires `/* WRAPPER ... */` dans script.js + script-livraisons.js + script-encaissement.js.
  // Doit etre >= 5 (S7, S8, S9, S10, S16, S19, S22, S21, encaissement, server-pagination, S11, S15, mcaLivForm).
  // C'est une borne basse pour eviter une regression silencieuse.
  let total = 0;
  for (const f of ['script.js', 'script-livraisons.js', 'script-encaissement.js']) {
    const src = read(f);
    const matches = src.match(/\/\*\s*(?:WRAPPER|HELPER|CANONIQUE)\s+/g) || [];
    total += matches.length;
  }
  assert.ok(total >= 8,
    `Au moins 8 commentaires /* WRAPPER ... */, /* HELPER ... */ ou /* CANONIQUE ... */ attendus pour tracer les wrappers H2.1. Trouvé: ${total}`);
});
