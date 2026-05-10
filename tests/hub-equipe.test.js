/**
 * MCA Logistics — Tests Hub Équipe (Sprint 22 / H2.4)
 *
 * Couvre les helpers purs de calcul des 4 KPIs du dashboard equipe :
 *   - calculerEffectif      (actifs / contrats)
 *   - calculerHeuresSemaineEquipe (reelles + planifiees fallback)
 *   - calculerLivraisons30j (nb + CA HT, statut='livre')
 *   - calculerConformite    (niveau ok/warn/critical, items)
 *
 * + helpers utilitaires :
 *   - rangeSemaineCourante         (lundi -> dimanche ISO)
 *   - calculerPlanifieesParSalarie (somme heures planifiees / salarie)
 *
 * Lancer : node --test tests/hub-equipe.test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculerEffectif,
  calculerHeuresSemaineEquipe,
  calculerLivraisons30j,
  calculerConformite,
  rangeSemaineCourante,
  calculerPlanifieesParSalarie
} = require('../script-equipe-hub.js');

// ============================================================
// calculerEffectif
// ============================================================
test('effectif : 2 actifs / 3 contrats (1 inactif)', () => {
  const sals = [
    { id: '1', nom: 'Dupont', actif: true, statut: 'actif' },
    { id: '2', nom: 'Martin', actif: true, statut: 'actif' },
    { id: '3', nom: 'Bernard', statut: 'inactif' }
  ];
  const r = calculerEffectif(sals);
  assert.equal(r.actifs, 2);
  assert.equal(r.total, 3);
  assert.match(r.label, /2 actifs/);
  assert.match(r.label, /3 contrats/);
});

test('effectif : exclut les archives', () => {
  const sals = [
    { id: '1', actif: true },
    { id: '2', actif: true, archive: true }
  ];
  const r = calculerEffectif(sals);
  assert.equal(r.total, 1);
  assert.equal(r.actifs, 1);
});

test('effectif : robuste a l\'absence d\'input', () => {
  assert.equal(calculerEffectif(null).actifs, 0);
  assert.equal(calculerEffectif(undefined).total, 0);
  assert.equal(calculerEffectif([]).actifs, 0);
});

test('effectif : 1 actif / 1 contrat (singulier)', () => {
  const r = calculerEffectif([{ id: '1', actif: true }]);
  assert.equal(r.label, '1 actif / 1 contrat');
});

// ============================================================
// calculerHeuresSemaineEquipe
// ============================================================
test('heures semaine : reelles seules quand pas de planifie', () => {
  const sals = [{ id: 's1', actif: true }];
  const heures = [
    { salId: 's1', date: '2026-05-04', heures: '8' },
    { salId: 's1', date: '2026-05-05', heures: '7.5' }
  ];
  const range = { debut: '2026-05-04', fin: '2026-05-10' };
  const r = calculerHeuresSemaineEquipe(sals, heures, range, {});
  assert.equal(r.reelles, 15.5);
  assert.equal(r.planifiees, 0);
  assert.equal(r.total, 15.5);
});

test('heures semaine : planifiees fallback quand reelles=0', () => {
  const sals = [{ id: 's1', actif: true }];
  const r = calculerHeuresSemaineEquipe(sals, [], { debut: '2026-05-04', fin: '2026-05-10' }, { s1: 35 });
  assert.equal(r.reelles, 0);
  assert.equal(r.planifiees, 35);
  assert.equal(r.total, 35);
});

test('heures semaine : reelles ecrasent planifiees (cas saisie partielle)', () => {
  // Comportement attendu : on garde le max du reel et on ajoute le delta planifie.
  // Implementation actuelle : total = reelles + max(0, planifiees - reelles).
  const sals = [{ id: 's1', actif: true }];
  const heures = [{ salId: 's1', date: '2026-05-04', heures: '8' }];
  const r = calculerHeuresSemaineEquipe(sals, heures, { debut: '2026-05-04', fin: '2026-05-10' }, { s1: 35 });
  assert.equal(r.reelles, 8);
  assert.equal(r.planifiees, 35);
  // 8 reelles + (35-8) planifies non encore couverts = 35
  assert.equal(r.total, 35);
});

test('heures semaine : ignore salaries inactifs', () => {
  const sals = [
    { id: 's1', actif: true },
    { id: 's2', statut: 'inactif' }
  ];
  const heures = [
    { salId: 's1', date: '2026-05-04', heures: '8' },
    { salId: 's2', date: '2026-05-04', heures: '8' }
  ];
  const r = calculerHeuresSemaineEquipe(sals, heures, { debut: '2026-05-04', fin: '2026-05-10' }, {});
  assert.equal(r.reelles, 8);
});

test('heures semaine : accepte salarieId (legacy) en plus de salId', () => {
  const sals = [{ id: 's1', actif: true }];
  const heures = [{ salarieId: 's1', date: '2026-05-04', heures: '5' }];
  const r = calculerHeuresSemaineEquipe(sals, heures, { debut: '2026-05-04', fin: '2026-05-10' }, {});
  assert.equal(r.reelles, 5);
});

test('heures semaine : virgule decimale parsable (saisie FR)', () => {
  const sals = [{ id: 's1', actif: true }];
  const heures = [{ salId: 's1', date: '2026-05-04', heures: '7,5' }];
  const r = calculerHeuresSemaineEquipe(sals, heures, { debut: '2026-05-04', fin: '2026-05-10' }, {});
  assert.equal(r.reelles, 7.5);
});

// ============================================================
// calculerLivraisons30j
// ============================================================
test('livraisons 30j : compte tous les statuts sauf annule, CA en HT (#109 audit)', () => {
  const ref = new Date('2026-05-09T12:00:00Z');
  const livraisons = [
    { date: '2026-05-08', statut: 'livre',      prixHT: 100 },
    { date: '2026-05-07', statut: 'livre',      prixHT: 200 },
    { date: '2026-05-06', statut: 'en-attente', prixHT: 300 }, // inclus apres fix #109
    { date: '2026-05-05', statut: 'annule',     prixHT: 999 }, // exclus
    { date: '2026-04-01', statut: 'livre',      prixHT: 50 }   // hors 30j
  ];
  const r = calculerLivraisons30j(livraisons, ref);
  assert.equal(r.nb, 3);
  assert.equal(r.ca, 600);
});

test('livraisons 30j : limite inclusive (J-30 et J)', () => {
  const ref = new Date('2026-05-09T12:00:00Z');
  const livraisons = [
    { date: '2026-04-09', statut: 'livre', prixHT: 100 }, // J-30 inclus
    { date: '2026-05-09', statut: 'livre', prixHT: 200 }  // J inclus
  ];
  const r = calculerLivraisons30j(livraisons, ref);
  assert.equal(r.nb, 2);
  assert.equal(r.ca, 300);
});

test('livraisons 30j : fallback prix TTC -> HT si prixHT manquant (#109)', () => {
  const ref = new Date('2026-05-09T12:00:00Z');
  const livraisons = [
    { date: '2026-05-08', statut: 'livre', prix: 120, tauxTVA: 20 } // 120 TTC -> 100 HT
  ];
  const r = calculerLivraisons30j(livraisons, ref);
  assert.equal(r.nb, 1);
  assert.equal(r.ca, 100);
});

test('livraisons 30j : input vide -> 0', () => {
  const r = calculerLivraisons30j([], new Date('2026-05-09'));
  assert.equal(r.nb, 0);
  assert.equal(r.ca, 0);
});

// ============================================================
// calculerConformite
// ============================================================
test('conformite : ok si rien d\'expire', () => {
  const ref = new Date('2026-05-09T00:00:00Z');
  const sals = [{ id: 's1', nom: 'Dupont', actif: true, datePermis: '2030-01-01', dateAssurance: '2027-01-01' }];
  const r = calculerConformite(sals, [], ref);
  assert.equal(r.niveau, 'ok');
  assert.equal(r.items.length, 0);
});

test('conformite : critical si 1 doc expire', () => {
  const ref = new Date('2026-05-09T00:00:00Z');
  const sals = [{ id: 's1', nom: 'Dupont', actif: true, datePermis: '2026-01-01' /* expire */ }];
  const r = calculerConformite(sals, [], ref);
  assert.equal(r.niveau, 'critical');
  assert.match(r.items[0].label, /Permis expir/);
});

test('conformite : warn si doc expire dans <30j (assurance)', () => {
  const ref = new Date('2026-05-09T00:00:00Z');
  const sals = [{ id: 's1', nom: 'Dupont', actif: true, dateAssurance: '2026-05-20' /* J+11 */ }];
  const r = calculerConformite(sals, [], ref);
  assert.equal(r.niveau, 'warn');
  assert.match(r.items[0].label, /Assurance.*11j/);
});

test('conformite : warn si incident ouvert', () => {
  const ref = new Date('2026-05-09T00:00:00Z');
  const sals = [{ id: 's1', nom: 'Dupont', actif: true, datePermis: '2030-01-01' }];
  const incidents = [{ id: 'i1', statut: 'ouvert' }];
  const r = calculerConformite(sals, incidents, ref);
  assert.equal(r.niveau, 'warn');
  assert.match(r.items[0].label, /1 incident ouvert/);
});

test('conformite : critical eclipse warn (priorite)', () => {
  const ref = new Date('2026-05-09T00:00:00Z');
  const sals = [
    { id: 's1', nom: 'Dupont', actif: true, datePermis: '2026-01-01' /* critical */ },
    { id: 's2', nom: 'Martin', actif: true, datePermis: '2026-05-20' /* warn */ }
  ];
  const r = calculerConformite(sals, [], ref);
  assert.equal(r.niveau, 'critical');
  assert.equal(r.items.length, 2);
});

test('conformite : visite medicale supportee', () => {
  const ref = new Date('2026-05-09T00:00:00Z');
  const sals = [{
    id: 's1', nom: 'Dupont', actif: true,
    visiteMedicale: { dateExpiration: '2026-04-01' /* expire */ }
  }];
  const r = calculerConformite(sals, [], ref);
  assert.equal(r.niveau, 'critical');
  assert.match(r.items[0].label, /Visite médicale expir/);
});

// ============================================================
// rangeSemaineCourante
// ============================================================
test('range semaine : lundi a dimanche en ISO', () => {
  const ref = new Date('2026-05-09T12:00:00Z'); // samedi
  const r = rangeSemaineCourante(ref);
  assert.equal(r.debut, '2026-05-04'); // lundi
  assert.equal(r.fin, '2026-05-10');   // dimanche
});

test('range semaine : un dimanche -> semaine en cours (pas la suivante)', () => {
  const ref = new Date('2026-05-10T12:00:00Z'); // dimanche
  const r = rangeSemaineCourante(ref);
  assert.equal(r.debut, '2026-05-04');
  assert.equal(r.fin, '2026-05-10');
});

// ============================================================
// calculerPlanifieesParSalarie
// ============================================================
test('planifiees : somme heures planning hebdo', () => {
  const sals = [{ id: 's1' }];
  const plannings = [{
    salId: 's1',
    semaine: [
      { jour: 'lundi', travaille: true, heureDebut: '08:00', heureFin: '12:00' },
      { jour: 'lundi', travaille: true, heureDebut: '13:00', heureFin: '17:00' },
      { jour: 'mardi', travaille: false, heureDebut: '08:00', heureFin: '12:00' },
      { jour: 'mercredi', travaille: true, typeJour: 'conge', heureDebut: '08:00', heureFin: '12:00' }
    ]
  }];
  const map = calculerPlanifieesParSalarie(sals, plannings, {});
  assert.equal(map['s1'], 8); // 4h matin + 4h aprem ; mardi off ; mercredi conge ignore
});

test('planifiees : 0 si pas de planning', () => {
  const map = calculerPlanifieesParSalarie([{ id: 's1' }], [], {});
  assert.equal(map['s1'], 0);
});
