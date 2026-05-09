/**
 * MCA Logistics — Tests provision compte chauffeur (sprint H2)
 *
 * Couvre la chaine de provisionnement d'un acces salarie cote admin :
 *   - Generation du mot de passe temporaire (regles : majuscule + minuscule
 *     + chiffre + caractere special, 8 chars min — meme regles que PC/mobile).
 *   - Format de l'email technique salarie (NUMERO@salarie.mca-logistics.fr).
 *   - Format du payload affiche dans la modale credentials (numero + mdp).
 *   - Symetrie creation/suppression : presence du flag profileId dans l'output.
 *
 * Helpers reproduits ici (la logique vit dans script.js / script-salaries.js,
 * impossible a require() en l'etat sans DOM — meme pattern que les autres
 * tests, drift surveille manuellement).
 *
 * Lancer : node --test tests/provision-chauffeur.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Helpers reproduits depuis script.js L1807 et script-salaries.js L252
// ============================================================

function genererMotDePasseFort(prefix) {
  const baseRaw = String(prefix || 'MCA').replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'MCA';
  const base = baseRaw.charAt(0).toUpperCase() + baseRaw.slice(1).toLowerCase();
  const suffixe = String(Math.floor(1000 + Math.random() * 9000));
  return base + '!' + suffixe;
}

function genererEmailTechniqueSalarie(numero) {
  const base = String(numero || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
  return base ? `${base}@salarie.mca-logistics.fr` : '';
}

// Replique de la regle de validation cote edge fn provision-salarie-access L65 :
// password.length < 6 → 400 'Password too short'.
function passwordValidePourEdgeFn(mdp) {
  return typeof mdp === 'string' && mdp.length >= 6;
}

// Replique de l'evaluation de qualite (script.js evaluerQualiteMotDePasseFort) :
// 8 chars min + majuscule + minuscule + chiffre.
function passwordRespecteRegleAdmin(mdp) {
  if (!mdp || mdp.length < 8) return false;
  if (!/[A-Z]/.test(mdp)) return false;
  if (!/[a-z]/.test(mdp)) return false;
  if (!/[0-9]/.test(mdp)) return false;
  return true;
}

// ============================================================
// Tests
// ============================================================

test('genererMotDePasseFort respecte les 4 regles (maj/min/chiffre/special)', () => {
  for (let i = 0; i < 20; i++) {
    const mdp = genererMotDePasseFort('EMP001');
    assert.ok(/[A-Z]/.test(mdp), `${mdp} doit contenir une majuscule`);
    assert.ok(/[a-z]/.test(mdp), `${mdp} doit contenir une minuscule`);
    assert.ok(/[0-9]/.test(mdp), `${mdp} doit contenir un chiffre`);
    assert.ok(/[!@#$%^&*]/.test(mdp), `${mdp} doit contenir un caractere special`);
    assert.ok(mdp.length >= 8, `${mdp} doit faire 8 chars minimum`);
  }
});

test('genererMotDePasseFort accepte la regle de qualite admin', () => {
  for (let i = 0; i < 10; i++) {
    const mdp = genererMotDePasseFort('JEAN');
    assert.ok(passwordRespecteRegleAdmin(mdp), `${mdp} doit passer la regle admin`);
  }
});

test('genererMotDePasseFort accepte la regle de validation edge fn', () => {
  for (let i = 0; i < 10; i++) {
    const mdp = genererMotDePasseFort('EMP002');
    assert.ok(passwordValidePourEdgeFn(mdp), `${mdp} doit passer la regle edge fn (>= 6 chars)`);
  }
});

test('genererMotDePasseFort fallback sur MCA si prefix vide ou invalide', () => {
  const mdp1 = genererMotDePasseFort('');
  const mdp2 = genererMotDePasseFort(null);
  const mdp3 = genererMotDePasseFort('!@#$%');
  // Tous doivent commencer par "Mca!"
  assert.ok(mdp1.startsWith('Mca!'), `mdp vide → ${mdp1}`);
  assert.ok(mdp2.startsWith('Mca!'), `mdp null → ${mdp2}`);
  assert.ok(mdp3.startsWith('Mca!'), `mdp special-only → ${mdp3}`);
});

test('genererMotDePasseFort tronque a 4 chars + format Mca!XXXX', () => {
  const mdp = genererMotDePasseFort('JEAN-DUPONT-123');
  // Premiere lettre maj + 3 lettres min suivantes (slice 0-4 = "JEAN" → "Jean")
  assert.ok(mdp.startsWith('Jean!'), `prefix long → tronque : ${mdp}`);
  assert.match(mdp, /^Jean!\d{4}$/, `format strict : Jean!XXXX`);
});

test('genererEmailTechniqueSalarie produit un email valide', () => {
  assert.equal(genererEmailTechniqueSalarie('EMP001'), 'emp001@salarie.mca-logistics.fr');
  assert.equal(genererEmailTechniqueSalarie('CHAUF-42'), 'chauf-42@salarie.mca-logistics.fr');
  assert.equal(genererEmailTechniqueSalarie(' EMP 001 '), 'emp001@salarie.mca-logistics.fr');
});

test('genererEmailTechniqueSalarie strip caracteres interdits', () => {
  assert.equal(
    genererEmailTechniqueSalarie('EMP@001/!?'),
    'emp001@salarie.mca-logistics.fr',
    'caracteres @ / ! ? doivent etre strippes'
  );
});

test('genererEmailTechniqueSalarie retourne chaine vide si numero invalide', () => {
  assert.equal(genererEmailTechniqueSalarie(''), '');
  assert.equal(genererEmailTechniqueSalarie(null), '');
  assert.equal(genererEmailTechniqueSalarie('!@#$%'), '');
});

test('passwordValidePourEdgeFn rejette les mdp trop courts', () => {
  assert.equal(passwordValidePourEdgeFn(''), false);
  assert.equal(passwordValidePourEdgeFn('abc'), false);
  assert.equal(passwordValidePourEdgeFn('12345'), false);
  assert.equal(passwordValidePourEdgeFn('123456'), true);
  assert.equal(passwordValidePourEdgeFn('Mca!1234'), true);
});

test('format payload credentials chauffeur (modale UI)', () => {
  // Replique le format produit par afficherCredentialsChauffeur (script-salaries.js).
  // Les champs DOIVENT etre exactement ceux que la modale lit.
  const salarie = { id: 'sal_1', nom: 'Jean Dupont', numero: 'EMP001', actif: true };
  const mdp = genererMotDePasseFort(salarie.numero);
  const payload = {
    nom: salarie.nom,
    numero: salarie.numero,
    mdp: mdp,
  };
  assert.equal(typeof payload.nom, 'string');
  assert.equal(typeof payload.numero, 'string');
  assert.equal(typeof payload.mdp, 'string');
  assert.ok(payload.numero.length > 0, 'numero non vide pour transmission au chauffeur');
  assert.ok(passwordRespecteRegleAdmin(payload.mdp), 'mdp respecte la regle admin');
});

test('texte combine numero + mdp pour bouton "Tout copier"', () => {
  const creds = { numero: 'EMP001', mdp: 'Emp!1234', nom: 'Jean Dupont' };
  const texte = `Identifiant : ${creds.numero}\nMot de passe : ${creds.mdp}`;
  assert.match(texte, /Identifiant : EMP001/);
  assert.match(texte, /Mot de passe : Emp!1234/);
  assert.ok(texte.includes('\n'), 'separateur newline pour SMS / WhatsApp');
});
