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
  // Phase X.BW (2026-05-17) : renderLivraisonsAdminFinal extrait vers
  // script-core-admin-final-lock.js. Le pattern actuel : `const __X_v2 = function()`
  // puis `window.renderLivraisonsAdminFinal = __X_v2` pour préserver l'anti-collision H2.1.
  const src = stripComments(read('script-core-admin-final-lock.js'));
  const hardDefs = (src.match(/window\.renderLivraisonsAdminFinal\s*=\s*function\s*\(/g) || []).length
                 + (src.match(/window\.renderLivraisonsAdminFinal\s*=\s*__renderLivraisonsAdminFinal_v2/g) || []).length;
  assert.equal(hardDefs, 1,
    `script-core-admin-final-lock.js doit contenir exactement 1 def hard de window.renderLivraisonsAdminFinal (forme function(...) OU =__renderLivraisonsAdminFinal_v2). Trouvé: ${hardDefs}.`);
});

// ============================================================
// 3. naviguerVers — wrappers chaine avec idempotence
// ============================================================
test('H2.1 collisions — naviguerVers : tous les overrides sont des wrappers chaines (avec marqueur idempotent)', () => {
  // Phase X.BK-BP (2026-05-17) : les wrappers S16/S19/S22 sont maintenant dans
  // leurs modules extraits respectifs. Test mis à jour pour scanner ces fichiers.
  const files = [
    'script.js',
    'script-encaissement.js',
    'script-core-sprint16-calendrier-operationnel.js',
    'script-core-sprint19-centre-alertes.js',
    'script-core-sprint22-23-hubs.js',
  ];
  let totalOverrides = 0;
  for (const f of files) {
    let src;
    try { src = stripComments(read(f)); } catch (_) { continue; }
    const overrides = src.match(/window\.naviguerVers\s*=\s*(?:w|wrapped|wraplockNav)\s*;/g) || [];
    totalOverrides += overrides.length;
    const origCaptures = src.match(/(?:const|var)\s+orig\s*=\s*window\.naviguerVers/g) || [];
    assert.ok(origCaptures.length >= overrides.length,
      `${f} : chaque override de naviguerVers doit capturer 'orig = window.naviguerVers' avant. orig captures: ${origCaptures.length}, overrides: ${overrides.length}`);
  }
  assert.ok(totalOverrides >= 3 && totalOverrides <= 8,
    `Nombre de wrappers naviguerVers = ${totalOverrides} (attendu 3..8). Si > 8, refactoriser en registre de listeners style hooks modal.`);
});

// ============================================================
// 4. fermerFiche360 — canonique S20 + 1 fallback defensif S21
// ============================================================
test('H2.1 collisions — fermerFiche360 : 1 def canonique + 1 fallback guarded `if !function`', () => {
  // Phase X.BK-BP (2026-05-17) : S20 + S21 fallback déplacés vers leurs modules.
  const srcS20 = stripComments(read('script-core-sprint20-rh360.js'));
  const srcS21 = stripComments(read('script-core-sprint21-parc360.js'));
  const allDefs = (srcS20.match(/window\.fermerFiche360\s*=\s*function\s*\(/g) || []).length
                + (srcS21.match(/window\.fermerFiche360\s*=\s*function\s*\(/g) || []).length;
  assert.equal(allDefs, 2,
    `Attendu : 1 canonique (S20) + 1 fallback (S21 guarde par 'if (typeof window.fermerFiche360 !== \\'function\\')'). Trouvé: ${allDefs}`);
  // Verifie que le 2e def (S21) est precede d'un guard
  const guarded = srcS21.match(/if\s*\(\s*typeof\s+window\.fermerFiche360\s*!==\s*'function'\s*\)\s*\{\s*window\.fermerFiche360\s*=/);
  assert.ok(guarded, 'Le def fermerFiche360 de S21 doit etre dans un bloc if (typeof window.fermerFiche360 !== function) — fallback defensif.');
});

// ============================================================
// 5. afficherToast — 1 def canonique + 0 wrapper direct (Sprint 10
//    utilise addToastListener)
// ============================================================
test('H2.1 collisions — afficherToast : 1 declaration canonique + addToastListener registry', () => {
  // Phase X.AV (2026-05-17) : afficherToast extrait vers script-core-toast.js.
  // Le test vérifie maintenant ce module (canonical) au lieu de script.js.
  const src = stripComments(read('script-core-toast.js'));
  const decls = src.match(/^function afficherToast\s*\(/gm) || [];
  assert.equal(decls.length, 1,
    `script-core-toast.js doit contenir exactement 1 'function afficherToast'. Trouvé: ${decls.length}`);
  // Le registre doit etre present
  assert.ok(src.includes('window.addToastListener'), 'Le registre `addToastListener` doit etre present (pattern fan-out).');
  assert.ok(src.includes('__toastListeners'), '__toastListeners array doit exister pour le fan-out.');
  // window.afficherToast = afficherToast est OK : soit la ligne legacy de script-core-toast.js soit
  // la ré-exposition automatique par extract-module.cjs
  assert.ok(/window\.afficherToast\s*=\s*afficherToast/.test(src),
    'window.afficherToast = afficherToast; doit exister pour exposition globale.');
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
  // Phase X.BK-BP (2026-05-17) : les commentaires WRAPPER sont maintenant
  // répartis entre script.js (legacy) et les modules Sprint extraits.
  let total = 0;
  const files = [
    'script.js',
    'script-livraisons.js',
    'script-encaissement.js',
    'script-core-sprint16-calendrier-operationnel.js',
    'script-core-sprint19-centre-alertes.js',
    'script-core-sprint20-rh360.js',
    'script-core-sprint21-parc360.js',
    'script-core-sprint22-23-hubs.js',
    'script-core-toast.js',
  ];
  for (const f of files) {
    let src;
    try { src = read(f); } catch (_) { continue; }
    const matches = src.match(/\/\*\s*(?:WRAPPER|HELPER|CANONIQUE)\s+/g) || [];
    total += matches.length;
  }
  assert.ok(total >= 8,
    `Au moins 8 commentaires /* WRAPPER ... */, /* HELPER ... */ ou /* CANONIQUE ... */ attendus pour tracer les wrappers H2.1. Trouvé: ${total}`);
});
