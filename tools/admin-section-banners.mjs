// Replace minimal section comments with prominent banner comments
// for easier navigation via Ctrl+F in admin.html.
import { readFileSync, writeFileSync } from 'node:fs';

const SECTIONS = [
  ['DASHBOARD',     'Vue d\'ensemble + KPI hero + circular health gauge'],
  ['LIVRAISONS',    'Tableau / Kanban / Calendrier des courses + filtres'],
  ['CLIENTS',       'Carnet clients (B2B)'],
  ['FOURNISSEURS',  'Carnet fournisseurs (miroir clients)'],
  ['VÉHICULES',     'Flotte : immatriculation, CT, kms, finances par véhicule'],
  ['CARBURANT',     'Suivi pleins, anomalies, prix moyen, TVA déductible'],
  ['RENTABILITÉ',   'Marge par véhicule / client / chauffeur / tournée + simulateur'],
  ['STATISTIQUES',  'CA, livraisons, panier moyen, km totaux + graphes'],
  ['ÉQUIPE',        'Hub équipe : Salariés / Heures / Planning / Incidents'],
  ['SALARIÉS',      'Fiches chauffeurs + documents + accès app'],
  ['ALERTES',       'Centre d\'alertes : CT, permis, conso, échéances'],
  ['TVA',           'Récap TVA collectée / déductible (CA3)'],
  ['PARAMÈTRES',    'Config entreprise + comptabilité + sécurité + à propos'],
  ['ENCAISSEMENT',  'Factures à encaisser, DSO, relances'],
  ['CHARGES',       'Charges d\'exploitation (carburant, entretien, etc.)'],
  ['INCIDENTS',     'Incidents & réclamations clients'],
  ['ENTRETIENS',    'Carnet d\'entretien véhicules'],
  ['HEURES',        'Heures & Km (CE 561, plannings réels)'],
  ['CALENDRIER',    'Calendrier opérationnel mensuel'],
  ['PLANNING',      'Planning hebdomadaire équipe'],
  ['INSPECTIONS',   'Inspections quotidiennes véhicules'],
  ['BROUILLONS IA', 'Validation des actions proposées par l\'IA'],
];

let html = readFileSync('admin.html', 'utf8');
let count = 0;

for (const [name, desc] of SECTIONS) {
  // Match existing <!-- NAME --> or <!-- NAME — etc -->
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<!-- ${escaped}( —[^-]*)? -->`, 'g');
  const banner = `<!-- ============================================================
         ${name.padEnd(40)} : ${desc}
         ============================================================ -->`;
  const before = (html.match(re) || []).length;
  if (before > 0) {
    html = html.replace(re, banner);
    count += before;
  }
}

writeFileSync('admin.html', html, 'utf8');
console.log(`✓ ${count} section banners installed`);
