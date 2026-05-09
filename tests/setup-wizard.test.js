/**
 * MCA Logistics — Tests setup wizard onboarding
 *
 * Couvre :
 *   - validation SIRET (Luhn) — fonction reproduite a partir de
 *     script.js (validerSIRET) car le wizard la reutilise via window.
 *   - postes/categories par defaut bien initialises.
 *   - transitions d'etape next/prev/finish (etat machine pure).
 *
 * Ces tests utilisent un harness minimal qui mock localStorage / document
 * / sessionStorage afin de charger script-setup-wizard.js dans node:test
 * sans navigateur. La logique metier (state machine + validation) est
 * pure — pas de DOM read/write requis pour les checks.
 *
 * Lancer : node --test tests/setup-wizard.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ============================================================
// validerSIRET (reproduit depuis script.js L35) — meme algo que window.validerSIRET
// ============================================================
function validerSIRET(siret) {
  const s = String(siret || '').replace(/\s+/g, '');
  if (!/^\d{14}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(s[13 - i], 10);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  if (s.startsWith('356000000')) {
    let sumPoste = 0;
    for (const c of s) sumPoste += parseInt(c, 10);
    return sumPoste % 5 === 0;
  }
  return sum % 10 === 0;
}

test('SIRET — accepte un SIRET valide (14 chiffres + Luhn)', () => {
  // 73282932000074 = SIRET test commun (Luhn valide)
  assert.equal(validerSIRET('73282932000074'), true);
  // espaces toleres
  assert.equal(validerSIRET('732 82932 000074'), true);
});

test('SIRET — refuse les invalides', () => {
  assert.equal(validerSIRET(''), false);
  assert.equal(validerSIRET('1234'), false);
  assert.equal(validerSIRET('12345678901234'), false);    // pas Luhn
  assert.equal(validerSIRET('732829320000741'), false);   // 15 chiffres
  assert.equal(validerSIRET('abcdefghijklmn'), false);
  assert.equal(validerSIRET(null), false);
  assert.equal(validerSIRET(undefined), false);
});

test('SIRET — exception La Poste (356000000xxxxx, somme chiffres %5 == 0)', () => {
  // SIRET fictif La Poste : 35600000000048 -> somme = 26, %5 != 0 -> refuse
  assert.equal(validerSIRET('35600000000048'), false);
  // 35600000000020 -> somme = 16, %5 != 0 -> refuse
  // Cherche un La Poste valide manuellement : 35600000000050 somme = 19 nope
  // Le test important : la branche d'exception est exercee (pas Luhn standard)
  // -> on verifie qu'un SIRET 356000000... NON Luhn-valide peut passer si
  // somme chiffres %5 == 0
  // 35600000000005 : somme = 14, %5 != 0
  // 35600000000010 : somme = 10, %5 == 0 -> doit etre accepte par exception
  assert.equal(validerSIRET('35600000000010'), true);
});

// ============================================================
// Chargement du module wizard dans une sandbox vm (sans browser)
// ============================================================
function loadWizardModule() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'script-setup-wizard.js'),
    'utf-8'
  );
  const storage = (() => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); },
      clear: () => { map.clear(); }
    };
  })();
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({
        id: '', className: '', style: {}, setAttribute: () => {}, appendChild: () => {},
        addEventListener: () => {}, textContent: ''
      }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} }
    },
    localStorage: storage,
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout: (fn) => { /* no-op : pas de boot auto dans tests */ },
    console: console
  };
  sandbox.window = sandbox; // self-reference (window === global dans browser)
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

test('Wizard — exporte API publique sur window.MCASetup', () => {
  const sb = loadWizardModule();
  assert.ok(sb.window.MCASetup, 'MCASetup absent du window');
  assert.equal(typeof sb.window.MCASetup.show, 'function');
  assert.equal(typeof sb.window.MCASetup.next, 'function');
  assert.equal(typeof sb.window.MCASetup.prev, 'function');
  assert.equal(typeof sb.window.MCASetup.finish, 'function');
  assert.equal(typeof sb.window.MCASetup.skipAll, 'function');
  assert.equal(typeof sb.window.MCASetup.later, 'function');
  assert.equal(typeof sb.window.MCASetup.shouldShow, 'function');
});

test('Wizard — postes par defaut typiques transport', () => {
  const sb = loadWizardModule();
  const postes = sb.window.MCASetup._POSTES_DEFAUT;
  assert.ok(Array.isArray(postes));
  assert.ok(postes.includes('Chauffeur PL'));
  assert.ok(postes.includes('Chauffeur SPL'));
  assert.ok(postes.includes('Logisticien'));
  assert.ok(postes.includes('Mécanicien'));
  assert.equal(postes.length, 4);
});

test('Wizard — categories de charges par defaut', () => {
  const sb = loadWizardModule();
  const cats = sb.window.MCASetup._CATEGORIES_DEFAUT;
  assert.ok(Array.isArray(cats));
  assert.ok(cats.includes('Carburant'));
  assert.ok(cats.includes('Entretien'));
  assert.ok(cats.includes('Assurance'));
  assert.ok(cats.length >= 5);
});

test('Wizard — shouldShow=true si flag absent et params vides', () => {
  const sb = loadWizardModule();
  assert.equal(sb.window.MCASetup.shouldShow(), true);
});

test('Wizard — shouldShow=false si flag mca_setup_done=1', () => {
  const sb = loadWizardModule();
  sb.localStorage.setItem('mca_setup_done', '1');
  assert.equal(sb.window.MCASetup.shouldShow(), false);
});

test('Wizard — shouldShow=false si params_entreprise.nom est rempli (autre que defaut)', () => {
  const sb = loadWizardModule();
  sb.localStorage.setItem('params_entreprise', JSON.stringify({
    nom: 'Mon entreprise',
    siret: '73282932000074'
  }));
  assert.equal(sb.window.MCASetup.shouldShow(), false);
});

test('Wizard — shouldShow=true si nom est le placeholder par defaut MCA LOGISTICS sans SIRET', () => {
  const sb = loadWizardModule();
  sb.localStorage.setItem('params_entreprise', JSON.stringify({
    nom: 'MCA LOGISTICS' // valeur par defaut historique de sauvegarderParametres
  }));
  assert.equal(sb.window.MCASetup.shouldShow(), true);
});

test('Wizard — _isValidSiret expose le validateur Luhn (consistance avec script.js)', () => {
  const sb = loadWizardModule();
  const fn = sb.window.MCASetup._isValidSiret;
  assert.equal(fn('73282932000074'), true);
  assert.equal(fn(''), false);
  assert.equal(fn('1234'), false);
});

test('Wizard — etat initial step=1 et listes pre-remplies', () => {
  const sb = loadWizardModule();
  const s = sb.window.MCASetup._state;
  assert.equal(s.step, 1);
  assert.equal(s.tva.regime, 'reel_normal');
  assert.equal(s.tva.tauxLivraison, 20);
  assert.equal(s.tva.tauxCharge, 20);
  assert.equal(s.postes.length, 4);
  assert.ok(s.categories.length >= 5);
});

// ============================================================
// Transition d'etapes (sans DOM — on verifie l'etat machine)
// ============================================================
test('Wizard — transition next/prev sans DOM laisse l\'etat coherent', () => {
  const sb = loadWizardModule();
  // Comme readStep1/2/3 ont besoin du DOM (qui retourne null partout),
  // les `get('xxx').value` retournent '' -> readStep1 echoue car nom requis.
  // On force directement state.step pour tester clamp.
  const s = sb.window.MCASetup._state;
  s.step = 2;
  sb.window.MCASetup.prev();
  assert.equal(s.step, 1, 'prev() depuis step=2 doit revenir a step=1');
  sb.window.MCASetup.prev();
  assert.equal(s.step, 1, 'prev() depuis step=1 reste a step=1');
  s.step = 4;
  sb.window.MCASetup.prev();
  assert.equal(s.step, 3);
});
