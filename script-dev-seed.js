// MCA LOGISTICS — Dev seed MAX (Phase 11 refonte visuelle)
//
// Injecte un dataset complet et réaliste sur 12 mois pour rendre TOUTES les
// pages visuellement pleines (dashboard, livraisons, planning, alertes,
// clients/fournisseurs, véhicules, carburant, entretiens, inspections,
// équipe, heures, incidents, charges, rentabilité, encaissement, TVA, stats,
// calendrier).
//
// Activation :
//   - ?seed=1                            → seed une fois puis reload
//   - ?reset=1                           → clear tout + reload (clean state)
//   - ?reseed=1                          → reset + seed (regen depuis 0)
//   - localStorage 'mca_dev_seeded' = '1' → seed conservé entre visites
//
// Console:
//   __mcaDevSeed.reset()  / .reseed()  / .summary()

(function () {
  'use strict';

  // ============ DOMAIN GUARD — refuse de tourner sur prod ============
  // Whitelist : localhost, 127.0.0.1, *.pages.dev (preview deploys Cloudflare).
  // Le domaine prod final (mca-logistics.fr) n'a PAS le droit au seed.
  const host = window.location.hostname || '';
  const SEED_ALLOWED = (
    host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('.pages.dev')
    || host.endsWith('.localhost')
  );
  if (!SEED_ALLOWED) {
    // Sur prod, expose juste un helper d'info, ne fait RIEN d'autre
    window.__mcaDevSeed = {
      info() {
        console.warn('[mca-dev-seed] DISABLED on prod domain (' + host + '). ' +
          'Seed only runs on localhost / 127.0.0.1 / *.pages.dev.');
      },
    };
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const wantSeed = params.get('seed') === '1';
  const wantReset = params.get('reset') === '1';
  const wantReseed = params.get('reseed') === '1';

  // Phase 91.21 — DÉSACTIVE auto-seed (le flag localStorage 'mca_dev_seeded' réinjectait
  // les données fake sur chaque reload après un premier ?seed=1). On nettoie le flag aussi.
  try { localStorage.removeItem('mca_dev_seeded'); } catch (_) {}

  // Quick handlers via URL
  if (wantReset) {
    clearAll();
    cleanUrl(['reset']);
    window.location.reload();
    return;
  }
  if (wantReseed) {
    clearAll();
    cleanUrl(['reseed']);
    window.history.replaceState({}, '', window.location.pathname + '?seed=1');
    window.location.reload();
    return;
  }

  // Seed UNIQUEMENT si ?seed=1 explicite dans l'URL (plus de re-trigger auto).
  if (!wantSeed) {
    expose();
    return;
  }

  if (wantSeed) {
    seed();
    localStorage.setItem('mca_dev_seeded', '1');
    cleanUrl(['seed']);
    window.location.reload();
  } else {
    expose();
  }

  // ============ utils ============
  function cleanUrl(keys) {
    const url = new URL(window.location.href);
    keys.forEach(k => url.searchParams.delete(k));
    window.history.replaceState({}, '', url.toString());
  }
  function uid() { return 'dev-' + Math.random().toString(36).slice(2, 11); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function isoDT(d) { return d.toISOString(); }
  function offsetDate(days) { const d = new Date(); d.setDate(d.getDate() + days); return isoDate(d); }
  function offsetDT(days, hours, mins) { const d = new Date(); d.setDate(d.getDate() + days); if (hours != null) d.setHours(hours, mins || 0, 0, 0); return isoDT(d); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randFloat(min, max, dec) { dec = dec == null ? 2 : dec; const v = Math.random() * (max - min) + min; return Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN(arr, n) { const c = arr.slice(); const out = []; for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return out; }
  function chance(p) { return Math.random() < p; }

  function clearAll() {
    // Phase 60 V7 — clearAll EXHAUSTIF pour éliminer toute data fantôme legacy
    // Couvre TOUTES les clés utilisées par toutes les versions historiques.
    const exactKeys = [
      // Entités métier principales
      'livraisons', 'clients', 'fournisseurs', 'vehicules', 'salaries',
      'carburant', 'charges', 'entretiens', 'inspections', 'incidents',
      'paiements', 'alertes_admin', 'plannings_hebdo', 'plannings',
      'absences_periodes', 'postes', 'chauffeurs',
      // Encaissement / facturation legacy (différentes versions)
      'encaissements', 'encaissements_manuels', 'factures_emises',
      'avoirs', 'avoirs_emis', 'acomptes', 'relances', 'relances_log',
      // Heures / temps
      'heures', 'heures_pointage',
      // TVA / config compta
      'tva_declarations', 'tva_config',
      // Logs et brouillons
      'audit_log', 'agent_decisions',
      // Config entreprise / params
      'config_entreprise', 'params', 'params_entreprise',
      'config_anomalies_carburant', 'config_rentabilite',
      'charges_categories', 'taux_tva', 'max_tentatives',
      'session_timeout_min', 'relance_delai',
      'objectif_ca_mensuel', 'objectif_livraisons_mensuel',
      'rentabilite_calculateur_v2',
      // Notes / messages
      'notes_internes',
      // Logos
      'logo_entreprise', 'logo_entreprise_path', 'logo_entreprise_url',
      // Admin / accounts
      'admin_accounts',
      // Flags / cleanup
      'mca_dev_seeded', 'mca_setup_done', 'mca_setup_skipped_until',
      'mca_setup_completed', 'mca_debug', 'mca_pagination_mode',
      'mca_mobile_theme', 'mca_legacy_docs_migrated_v1',
      'delivpro_modifs_cleanup_at', 'backup_admin_last_export',
      // Migration flags (tous les *_migrated_v1)
      // Ces clés bloquent les re-migrations
    ];
    exactKeys.forEach(k => localStorage.removeItem(k));

    // Préfixes (clés dynamiques)
    const prefixes = ['km_sal_', 'notifs_sal_', 'messages_', 'documents_livraison_'];
    Object.keys(localStorage).forEach(k => {
      if (prefixes.some(p => k.startsWith(p))) localStorage.removeItem(k);
      // Migration flags génériques
      if (k.endsWith('_migrated_v1') || k.endsWith('_migrated_v2')) localStorage.removeItem(k);
    });
  }

  function expose() {
    window.__mcaDevSeed = {
      reset() { clearAll(); window.location.reload(); },
      reseed() { clearAll(); window.location.href = window.location.pathname + '?seed=1'; },
      summary() {
        const keys = ['livraisons', 'clients', 'fournisseurs', 'vehicules', 'salaries',
          'carburant', 'charges', 'alertes_admin', 'plannings_hebdo',
          'entretiens', 'inspections', 'incidents', 'heures_pointage', 'tva_declarations', 'paiements'];
        const s = {};
        keys.forEach(k => { s[k] = safeRead(k).length; });
        console.table(s);
        return s;
      },
    };
  }

  // ============ SEED MASTER ============
  function seed() {
    // ----- 25 CLIENTS -----
    const CLIENTS = [
      { id: uid(), nom: 'Amazon France', type: 'professionnel', secteur: 'ecommerce', ville: 'Roubaix', adresse: '1 rue d\'Amazonia', codePostal: '59100', email: 'logistique@amazon.fr', tel: '0123456789', siren: '487773327', delaiPaiement: 30, dateCreation: offsetDT(-720) },
      { id: uid(), nom: 'Carrefour Hyper', type: 'professionnel', secteur: 'commerce', ville: 'Lille', adresse: '50 avenue de Dunkerque', codePostal: '59000', email: 'achats@carrefour.fr', tel: '0320111111', siren: '652014051', delaiPaiement: 45, dateCreation: offsetDT(-650) },
      { id: uid(), nom: 'Decathlon Logistics', type: 'professionnel', secteur: 'ecommerce', ville: 'Villeneuve d\'Ascq', adresse: '4 boulevard de Mons', codePostal: '59650', email: 'log@decathlon.com', tel: '0320222222', siren: '500569405', delaiPaiement: 30, dateCreation: offsetDT(-600) },
      { id: uid(), nom: 'Boulanger', type: 'professionnel', secteur: 'commerce', ville: 'Lesquin', adresse: '2 rue de la Voyette', codePostal: '59810', email: 'sav@boulanger.fr', tel: '0320333333', siren: '350378254', delaiPaiement: 60, dateCreation: offsetDT(-580) },
      { id: uid(), nom: 'Leroy Merlin', type: 'professionnel', secteur: 'commerce', ville: 'Lens', adresse: 'ZAC du Cornet', codePostal: '62300', email: 'log@leroymerlin.fr', tel: '0321444444', siren: '353087001', delaiPaiement: 45, dateCreation: offsetDT(-550) },
      { id: uid(), nom: 'Auchan Nord', type: 'professionnel', secteur: 'commerce', ville: 'Roncq', adresse: '200 rue de Lille', codePostal: '59223', email: 'log@auchan.fr', tel: '0320555555', siren: '410409460', delaiPaiement: 30, dateCreation: offsetDT(-520) },
      { id: uid(), nom: 'Castorama', type: 'professionnel', secteur: 'commerce', ville: 'Templemars', adresse: 'CD 41', codePostal: '59175', email: 'log@castorama.fr', tel: '0320666666', siren: '451678568', delaiPaiement: 45, dateCreation: offsetDT(-490) },
      { id: uid(), nom: 'Intermarché Lille', type: 'professionnel', secteur: 'commerce', ville: 'Lille', adresse: '12 rue Faidherbe', codePostal: '59000', email: 'log@intermarche.fr', tel: '0320777777', siren: '779507981', delaiPaiement: 30, dateCreation: offsetDT(-460) },
      { id: uid(), nom: 'Société TBM', type: 'professionnel', secteur: 'industrie', ville: 'Tourcoing', adresse: 'ZI de la Marlière', codePostal: '59200', email: 'contact@tbm.fr', tel: '0320888888', siren: '433651124', delaiPaiement: 60, dateCreation: offsetDT(-430) },
      { id: uid(), nom: 'Brico Dépôt', type: 'professionnel', secteur: 'commerce', ville: 'Hénin-Beaumont', adresse: 'Centre commercial Noyelles', codePostal: '62110', email: 'log@bricodepot.fr', tel: '0321999999', siren: '481621269', delaiPaiement: 45, dateCreation: offsetDT(-400) },
      { id: uid(), nom: 'IKEA Lomme', type: 'professionnel', secteur: 'commerce', ville: 'Lomme', adresse: '11 av. de l\'Europe', codePostal: '59160', email: 'log@ikea.fr', tel: '0359000000', siren: '315084885', delaiPaiement: 30, dateCreation: offsetDT(-380) },
      { id: uid(), nom: 'Saint-Maclou', type: 'professionnel', secteur: 'commerce', ville: 'Wattignies', adresse: '15 rue Pasteur', codePostal: '59139', email: 'log@saintmaclou.fr', tel: '0320101010', siren: '775662345', delaiPaiement: 45, dateCreation: offsetDT(-350) },
      { id: uid(), nom: 'BUT', type: 'professionnel', secteur: 'commerce', ville: 'Englos', adresse: 'CC Auchan', codePostal: '59320', email: 'log@but.fr', tel: '0320202020', siren: '622777654', delaiPaiement: 30, dateCreation: offsetDT(-320) },
      { id: uid(), nom: 'Conforama', type: 'professionnel', secteur: 'commerce', ville: 'Roncq', adresse: 'ZI Briqueteries', codePostal: '59223', email: 'log@conforama.fr', tel: '0320303030', siren: '414819000', delaiPaiement: 45, dateCreation: offsetDT(-290) },
      { id: uid(), nom: 'Maisons du Monde', type: 'professionnel', secteur: 'commerce', ville: 'Wasquehal', adresse: '47 rue de Lannoy', codePostal: '59290', email: 'log@maisonsdumonde.fr', tel: '0320404040', siren: '441718861', delaiPaiement: 30, dateCreation: offsetDT(-260) },
      { id: uid(), nom: 'Bricomarché', type: 'professionnel', secteur: 'commerce', ville: 'Liévin', adresse: 'Av Maréchal Foch', codePostal: '62800', email: 'log@bricomarche.com', tel: '0321505050', siren: '777825001', delaiPaiement: 60, dateCreation: offsetDT(-220) },
      { id: uid(), nom: 'Action Discount', type: 'professionnel', secteur: 'commerce', ville: 'Marcq-en-Baroeul', adresse: 'CC Bois Blancs', codePostal: '59700', email: 'log@action.fr', tel: '0320606060', siren: '809506013', delaiPaiement: 30, dateCreation: offsetDT(-190) },
      { id: uid(), nom: 'Lidl Nord', type: 'professionnel', secteur: 'commerce', ville: 'Hellemmes', adresse: '5 rue Salvador Allende', codePostal: '59260', email: 'log@lidl.fr', tel: '0320707070', siren: '343262321', delaiPaiement: 45, dateCreation: offsetDT(-160) },
      { id: uid(), nom: 'Aldi Marché', type: 'professionnel', secteur: 'commerce', ville: 'Tourcoing', adresse: 'rue de Mouvaux', codePostal: '59200', email: 'log@aldi.fr', tel: '0320808080', siren: '503234123', delaiPaiement: 30, dateCreation: offsetDT(-130) },
      { id: uid(), nom: 'Picard Surgelés', type: 'professionnel', secteur: 'commerce', ville: 'Lambersart', adresse: '11 av Pasteur', codePostal: '59130', email: 'log@picard.fr', tel: '0320909090', siren: '562122120', delaiPaiement: 45, dateCreation: offsetDT(-100) },
      { id: uid(), nom: 'Grand Frais', type: 'professionnel', secteur: 'commerce', ville: 'Annœullin', adresse: 'ZAC du Carembault', codePostal: '59112', email: 'log@grandfrais.com', tel: '0320121212', siren: '434502201', delaiPaiement: 30, dateCreation: offsetDT(-80) },
      { id: uid(), nom: 'Société TPL Logistique', type: 'professionnel', secteur: 'industrie', ville: 'Béthune', adresse: 'ZI Est', codePostal: '62400', email: 'contact@tpl-log.fr', tel: '0321131313', siren: '512876541', delaiPaiement: 60, dateCreation: offsetDT(-60) },
      { id: uid(), nom: 'Mr. Bricolage', type: 'professionnel', secteur: 'commerce', ville: 'Wattrelos', adresse: '85 rue Carnot', codePostal: '59150', email: 'log@mr-bricolage.fr', tel: '0320141414', siren: '602987541', delaiPaiement: 45, dateCreation: offsetDT(-40) },
      { id: uid(), nom: 'Particulier Dupont', type: 'particulier', ville: 'Arras', adresse: '12 rue Saint-Vaast', codePostal: '62000', email: 'dupont@gmail.com', tel: '0612345678', delaiPaiement: 0, dateCreation: offsetDT(-25) },
      { id: uid(), nom: 'Particulier Lefèvre', type: 'particulier', ville: 'Douai', adresse: '5 rue du Canteleu', codePostal: '59500', email: 'lefevre.j@laposte.net', tel: '0612345679', delaiPaiement: 0, dateCreation: offsetDT(-15) },
    ];

    // ----- 15 FOURNISSEURS -----
    const FOURNISSEURS = [
      { id: uid(), nom: 'TotalEnergies Carburant', type: 'professionnel', categorie: 'carburant', ville: 'Lille', tel: '0320001001', siren: '542051180', dateCreation: offsetDT(-700), derniereCharge: offsetDate(-3) },
      { id: uid(), nom: 'BP Carburant Pro', type: 'professionnel', categorie: 'carburant', ville: 'Roubaix', tel: '0320001002', siren: '775684431', dateCreation: offsetDT(-650), derniereCharge: offsetDate(-8) },
      { id: uid(), nom: 'AXA Assurance Flotte', type: 'professionnel', categorie: 'assurance', ville: 'Paris', tel: '0140755050', siren: '775673351', dateCreation: offsetDT(-800), derniereCharge: offsetDate(-15) },
      { id: uid(), nom: 'SCI Bureau Ostwald', type: 'professionnel', categorie: 'loyer', ville: 'Ostwald', tel: '0388121212', siren: '892341255', dateCreation: offsetDT(-900), derniereCharge: offsetDate(-5) },
      { id: uid(), nom: 'Crédit Mutuel', type: 'professionnel', categorie: 'banque', ville: 'Strasbourg', tel: '0388801010', siren: '588505354', dateCreation: offsetDT(-1000), derniereCharge: offsetDate(-2) },
      { id: uid(), nom: 'Pennylane SAS', type: 'professionnel', categorie: 'comptabilite', ville: 'Paris', tel: '0143331212', siren: '850890315', dateCreation: offsetDT(-500), derniereCharge: offsetDate(-7) },
      { id: uid(), nom: 'Garage Renault Pro', type: 'professionnel', categorie: 'entretien', ville: 'Lille', tel: '0320404040', siren: '441518000', dateCreation: offsetDT(-450), derniereCharge: offsetDate(-12) },
      { id: uid(), nom: 'CarGlass', type: 'professionnel', categorie: 'entretien', ville: 'Roubaix', tel: '0320505050', siren: '320501654', dateCreation: offsetDT(-400), derniereCharge: offsetDate(-45) },
      { id: uid(), nom: 'Orange Pro', type: 'professionnel', categorie: 'telecom', ville: 'Paris', tel: '3900', siren: '380129866', dateCreation: offsetDT(-600), derniereCharge: offsetDate(-4) },
      { id: uid(), nom: 'OVH Cloud', type: 'professionnel', categorie: 'hosting', ville: 'Roubaix', tel: '0820320363', siren: '424761419', dateCreation: offsetDT(-300), derniereCharge: offsetDate(-1) },
      { id: uid(), nom: 'Norauto Pro', type: 'professionnel', categorie: 'entretien', ville: 'Lille', tel: '0320606060', siren: '378500165', dateCreation: offsetDT(-350), derniereCharge: offsetDate(-25) },
      { id: uid(), nom: 'Office Dépôt', type: 'professionnel', categorie: 'fournitures', ville: 'Wattrelos', tel: '0320707070', siren: '402568974', dateCreation: offsetDT(-200), derniereCharge: offsetDate(-18) },
      { id: uid(), nom: 'GROUPAMA Mutuelle', type: 'professionnel', categorie: 'sociales', ville: 'Paris', tel: '0143335555', siren: '343115135', dateCreation: offsetDT(-550), derniereCharge: offsetDate(-9) },
      { id: uid(), nom: 'INPI Service', type: 'professionnel', categorie: 'autre', ville: 'Courbevoie', tel: '0820210211', siren: '180020001', dateCreation: offsetDT(-180), derniereCharge: offsetDate(-150) },
      { id: uid(), nom: 'Total Lubrifiants', type: 'professionnel', categorie: 'entretien', ville: 'Paris', tel: '0140600000', siren: '542051180', dateCreation: offsetDT(-280), derniereCharge: offsetDate(-30) },
    ];

    // ----- 12 VÉHICULES -----
    const VEHICULES = [
      { id: uid(), immat: 'FG-788-FB', modele: 'OPEL MOVANO L2H2', km: 87500, conso: 10, capaciteReservoir: 80, modeAcquisition: 'occasion', prixAchatHT: 24000, dureeAmortissement: 5, dateAcquisition: '2024-05-18', dateCT: offsetDate(370), dateProchainCT: '2028-05-18', dateFinAssurance: offsetDate(180), entretienIntervalKm: 15000, entretienIntervalMois: 12, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'KH-234-LM', modele: 'RENAULT MASTER 130', km: 145000, conso: 11.5, capaciteReservoir: 100, modeAcquisition: 'lld', loyerMensuelHT: 480, dateAcquisition: '2023-09-01', dateCT: offsetDate(330), dateProchainCT: '2027-09-01', dateFinAssurance: offsetDate(120), entretienIntervalKm: 20000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'AB-456-CD', modele: 'MERCEDES SPRINTER 314', km: 62000, conso: 9.5, capaciteReservoir: 75, modeAcquisition: 'credit', creditMensualiteHT: 620, dateAcquisition: '2025-01-15', dateCT: offsetDate(420), dateProchainCT: '2029-01-15', dateFinAssurance: offsetDate(220), entretienIntervalKm: 15000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'XY-789-ZW', modele: 'PEUGEOT BOXER 350', km: 198000, conso: 10.5, capaciteReservoir: 90, modeAcquisition: 'achat', prixAchatHT: 18000, dureeAmortissement: 4, dateAcquisition: '2022-03-10', dateCT: offsetDate(4), dateProchainCT: offsetDate(4), dateFinAssurance: offsetDate(60), entretienIntervalKm: 15000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'EF-123-GH', modele: 'IVECO DAILY 35S14', km: 34000, conso: 11, capaciteReservoir: 90, modeAcquisition: 'lld', loyerMensuelHT: 510, dateAcquisition: '2025-08-20', dateCT: offsetDate(480), dateProchainCT: '2029-08-20', dateFinAssurance: offsetDate(310), entretienIntervalKm: 20000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'JK-567-MN', modele: 'CITROEN JUMPER L3H2', km: 112000, conso: 10.8, capaciteReservoir: 90, modeAcquisition: 'occasion', prixAchatHT: 19500, dureeAmortissement: 5, dateAcquisition: '2024-02-12', dateCT: offsetDate(270), dateProchainCT: '2028-02-12', dateFinAssurance: offsetDate(45), entretienIntervalKm: 18000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'OP-901-QR', modele: 'FORD TRANSIT CUSTOM', km: 28000, conso: 9, capaciteReservoir: 80, modeAcquisition: 'credit', creditMensualiteHT: 560, dateAcquisition: '2025-11-05', dateCT: offsetDate(540), dateProchainCT: '2029-11-05', dateFinAssurance: offsetDate(280), entretienIntervalKm: 15000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'ST-234-UV', modele: 'VOLKSWAGEN CRAFTER', km: 78000, conso: 10.2, capaciteReservoir: 75, modeAcquisition: 'achat', prixAchatHT: 28000, dureeAmortissement: 6, dateAcquisition: '2023-12-20', dateCT: offsetDate(220), dateProchainCT: '2027-12-20', dateFinAssurance: offsetDate(150), entretienIntervalKm: 20000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'WX-678-YZ', modele: 'RENAULT TRAFIC', km: 56000, conso: 8.5, capaciteReservoir: 70, modeAcquisition: 'lld', loyerMensuelHT: 410, dateAcquisition: '2024-08-08', dateCT: offsetDate(180), dateProchainCT: '2028-08-08', dateFinAssurance: offsetDate(95), entretienIntervalKm: 15000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'CD-345-EF', modele: 'FIAT DUCATO L4H2', km: 92000, conso: 11.2, capaciteReservoir: 90, modeAcquisition: 'occasion', prixAchatHT: 21000, dureeAmortissement: 5, dateAcquisition: '2023-06-15', dateCT: offsetDate(150), dateProchainCT: '2027-06-15', dateFinAssurance: offsetDate(180), entretienIntervalKm: 18000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'GH-789-IJ', modele: 'MAN TGE 5.180', km: 18000, conso: 11.5, capaciteReservoir: 100, modeAcquisition: 'credit', creditMensualiteHT: 720, dateAcquisition: '2026-01-20', dateCT: offsetDate(660), dateProchainCT: '2030-01-20', dateFinAssurance: offsetDate(340), entretienIntervalKm: 25000, tvaCarburantDeductible: 100, statut: 'actif' },
      { id: uid(), immat: 'KL-012-MN', modele: 'RENAULT MASTER (Réserve)', km: 235000, conso: 12, capaciteReservoir: 100, modeAcquisition: 'achat', prixAchatHT: 12000, dureeAmortissement: 8, dateAcquisition: '2020-04-10', dateCT: offsetDate(110), dateProchainCT: '2026-04-10', dateFinAssurance: offsetDate(-30), entretienIntervalKm: 20000, tvaCarburantDeductible: 100, statut: 'reserve' },
    ];

    // ----- 8 SALARIÉS -----
    const SALARIES = [
      { id: uid(), nom: 'Karim Benali', poste: 'Chauffeur livreur', telephone: '0612345601', email: 'karim.benali@mca.fr', actif: true, dateEmbauche: '2023-01-15', permis: 'C', dateExpirationPermis: offsetDate(22), salaireHoraire: 13.5, contrat: 'CDI', statut: 'temps_plein' },
      { id: uid(), nom: 'Mohamed Tahar', poste: 'Chauffeur livreur', telephone: '0612345602', email: 'mohamed.tahar@mca.fr', actif: true, dateEmbauche: '2023-06-01', permis: 'B', dateExpirationPermis: offsetDate(35), salaireHoraire: 13.2, contrat: 'CDI', statut: 'temps_plein' },
      { id: uid(), nom: 'Jean Lefèvre', poste: 'Chauffeur livreur', telephone: '0612345603', email: 'jean.lefevre@mca.fr', actif: true, dateEmbauche: '2024-03-15', permis: 'C', dateExpirationPermis: offsetDate(620), salaireHoraire: 13.0, contrat: 'CDI', statut: 'temps_plein' },
      { id: uid(), nom: 'Antoine Martin', poste: 'Chauffeur livreur', telephone: '0612345604', email: 'antoine.martin@mca.fr', actif: true, dateEmbauche: '2024-11-20', permis: 'B', dateExpirationPermis: offsetDate(820), salaireHoraire: 12.8, contrat: 'CDI', statut: 'temps_plein' },
      { id: uid(), nom: 'Sofiane El Khattabi', poste: 'Chauffeur livreur', telephone: '0612345605', email: 'sofiane.el@mca.fr', actif: true, dateEmbauche: '2025-02-10', permis: 'C', dateExpirationPermis: offsetDate(900), salaireHoraire: 13.3, contrat: 'CDI', statut: 'temps_plein' },
      { id: uid(), nom: 'Lucas Bernard', poste: 'Chauffeur livreur', telephone: '0612345606', email: 'lucas.bernard@mca.fr', actif: true, dateEmbauche: '2025-09-01', permis: 'B', dateExpirationPermis: offsetDate(550), salaireHoraire: 12.5, contrat: 'CDD', statut: 'temps_plein' },
      { id: uid(), nom: 'Aurélie Renard', poste: 'Assistante administrative', telephone: '0612345607', email: 'aurelie.renard@mca.fr', actif: true, dateEmbauche: '2024-05-15', permis: 'B', salaireHoraire: 14.0, contrat: 'CDI', statut: 'temps_partiel' },
      { id: uid(), nom: 'Achraf Chikri', poste: 'Gérant', telephone: '0612345608', email: 'chikriachraf67@gmail.com', actif: true, dateEmbauche: '2023-01-01', permis: 'B', contrat: 'Mandataire social', statut: 'temps_plein' },
    ];
    const chauffeurs = SALARIES.filter(s => s.poste === 'Chauffeur livreur');

    // ----- 500 LIVRAISONS sur 12 mois -----
    const LIVRAISONS = [];
    const STATUTS_BIASED = ['livre','livre','livre','livre','livre','livre','livre','livre','en-cours','en-attente','retard'];
    const STATUTS_PAIEMENT = ['paye','paye','paye','paye','en-attente','en-attente','retard'];
    const VILLES_DEPART = ['Roubaix','Lille','Tourcoing','Lens','Arras','Villeneuve d\'Ascq','Roncq','Marcq-en-Baroeul'];
    for (let i = 0; i < 500; i++) {
      const client = pick(CLIENTS);
      const vehicule = pick(VEHICULES.filter(v => v.statut === 'actif'));
      const chauf = pick(chauffeurs);
      const daysAgo = randInt(0, 365);
      const distance = randInt(8, 420);
      const prixKm = randFloat(1.6, 2.6, 2);
      const prixHT = Math.round(distance * prixKm * 100) / 100;
      const tauxTVA = 20;
      const prixTTC = Math.round(prixHT * (1 + tauxTVA/100) * 100) / 100;
      // ~3% brouillons (pour montrer la chip "Brouillons" peuplee dans la toolbar)
      let statut;
      if (chance(0.03)) statut = 'brouillon';
      else if (daysAgo > 7) statut = 'livre';
      else statut = pick(STATUTS_BIASED);
      const statutPaie = statut === 'brouillon'
        ? 'brouillon'
        : (daysAgo > 60 ? 'paye' : (statut !== 'livre' ? 'en-attente' : pick(STATUTS_PAIEMENT)));
      LIVRAISONS.push({
        id: uid(),
        numLiv: 'L-' + new Date().getFullYear() + '-' + String(i + 1).padStart(4, '0'),
        date: offsetDate(-daysAgo),
        dateLivraison: offsetDate(-daysAgo),
        clientId: client.id,
        client: client.nom,
        vehiculeId: vehicule.id,
        vehImmat: vehicule.immat,
        chaufId: chauf.id,
        chaufNom: chauf.nom,
        depart: pick(VILLES_DEPART),
        arrivee: client.ville,
        distance,
        prix: prixHT,
        prixHT,
        prixTTC,
        ht: prixHT,
        ttc: prixTTC,
        tva: Math.round((prixTTC - prixHT) * 100) / 100,
        tauxTVA,
        statut,
        statutPaiement: statutPaie,
        datePaiement: statutPaie === 'paye' ? offsetDate(-Math.max(0, daysAgo - randInt(15, 45))) : null,
        creeLe: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      });
    }

    // ----- 250 PLEINS CARBURANT sur 12 mois -----
    const CARBURANT = [];
    for (let i = 0; i < 250; i++) {
      const vehicule = pick(VEHICULES.filter(v => v.statut === 'actif'));
      const daysAgo = randInt(0, 365);
      const litres = randInt(40, 95);
      const prixL = randFloat(1.55, 1.85, 3);
      const total = Math.round(litres * prixL * 100) / 100;
      // 5% anomalies (prix anormal ou conso > 30%)
      const isAnomalie = chance(0.05);
      CARBURANT.push({
        id: uid(),
        date: offsetDate(-daysAgo),
        vehiculeId: vehicule.id,
        vehImmat: vehicule.immat,
        litres,
        prixLitre: prixL,
        prixL: prixL,
        total,
        montant: total,
        kmCompteur: vehicule.km - randInt(0, 30000),
        tvaDeductible: vehicule.tvaCarburantDeductible || 100,
        anomalie: isAnomalie,
        stationService: pick(['Total Roubaix','BP Lille','Esso Lens','Total Arras','Avia Tourcoing','Total Lesquin']),
      });
    }

    // ----- 120 CHARGES sur 12 mois -----
    const CHARGES = [];
    const TEMPLATES = [
      { nom: 'Assurance flotte mensuelle', categorie: 'assurance', montantHT: 850, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[2].id },
      { nom: 'Loyer dépôt Ostwald', categorie: 'loyer', montantHT: 1200, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[3].id },
      { nom: 'Frais bancaires Crédit Mutuel', categorie: 'banque', montantHT: 45, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[4].id },
      { nom: 'Pennylane comptabilité', categorie: 'comptabilite', montantHT: 89, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[5].id },
      { nom: 'Téléphone pro Orange', categorie: 'telecom', montantHT: 65, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[8].id },
      { nom: 'Hébergement OVH', categorie: 'hosting', montantHT: 25, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[9].id },
      { nom: 'Entretien Renault Pro', categorie: 'entretien', montantHT: 380, recurrence: 'ponctuel', fournisseurId: FOURNISSEURS[6].id },
      { nom: 'Mutuelle équipe Groupama', categorie: 'sociales', montantHT: 380, recurrence: 'mensuel', fournisseurId: FOURNISSEURS[12].id },
      { nom: 'INPI dépôt marque', categorie: 'autre', montantHT: 250, recurrence: 'ponctuel', fournisseurId: FOURNISSEURS[13].id },
      { nom: 'Norauto pneus + révision', categorie: 'entretien', montantHT: 420, recurrence: 'ponctuel', fournisseurId: FOURNISSEURS[10].id },
      { nom: 'Office Dépôt fournitures bureau', categorie: 'fournitures', montantHT: 95, recurrence: 'ponctuel', fournisseurId: FOURNISSEURS[11].id },
    ];
    // 12 mois × récurrentes mensuelles
    const MENSUELS = TEMPLATES.filter(t => t.recurrence === 'mensuel');
    for (let m = 11; m >= 0; m--) {
      MENSUELS.forEach(tpl => {
        const day = randInt(1, 28);
        const date = new Date();
        date.setMonth(date.getMonth() - m);
        date.setDate(day);
        const montantHT = tpl.montantHT + randInt(-20, 30);
        CHARGES.push({
          id: uid(),
          date: isoDate(date),
          description: tpl.nom + ' — ' + pad(date.getMonth() + 1) + '/' + date.getFullYear(),
          fournisseur: FOURNISSEURS.find(f => f.id === tpl.fournisseurId)?.nom || '',
          fournisseurId: tpl.fournisseurId,
          categorie: tpl.categorie,
          montantHT,
          montant: Math.round(montantHT * 1.2 * 100) / 100,
          tauxTVA: 20,
          montantTTC: Math.round(montantHT * 1.2 * 100) / 100,
          statut: m > 0 ? 'paye' : (chance(0.3) ? 'a_payer' : 'paye'),
          statutPaiement: m > 0 ? 'paye' : (chance(0.3) ? 'a_payer' : 'paye'),
          recurrent: true,
        });
      });
    }
    // Charges ponctuelles aléatoires
    for (let i = 0; i < 35; i++) {
      const tpl = pick(TEMPLATES.filter(t => t.recurrence === 'ponctuel'));
      const daysAgo = randInt(0, 365);
      const montantHT = tpl.montantHT + randInt(-50, 120);
      CHARGES.push({
        id: uid(),
        date: offsetDate(-daysAgo),
        description: tpl.nom,
        fournisseur: FOURNISSEURS.find(f => f.id === tpl.fournisseurId)?.nom || '',
        fournisseurId: tpl.fournisseurId,
        categorie: tpl.categorie,
        montantHT,
        montant: Math.round(montantHT * 1.2 * 100) / 100,
        tauxTVA: 20,
        montantTTC: Math.round(montantHT * 1.2 * 100) / 100,
        statut: daysAgo > 30 ? 'paye' : pick(['paye','a_payer']),
        statutPaiement: daysAgo > 30 ? 'paye' : pick(['paye','a_payer']),
        recurrent: false,
      });
    }

    // ----- 60 ENTRETIENS -----
    const ENTRETIENS = [];
    const TYPES_ENTRETIEN = ['Révision','Vidange','Pneus','Freins','Distribution','Climatisation','Contrôle technique','Échappement','Embrayage','Filtres'];
    for (let i = 0; i < 60; i++) {
      const vehicule = pick(VEHICULES);
      const daysAgo = randInt(-60, 720);
      const type = pick(TYPES_ENTRETIEN);
      const cout = randInt(80, 850);
      const fait = daysAgo > 0;
      ENTRETIENS.push({
        id: uid(),
        vehiculeId: vehicule.id,
        vehImmat: vehicule.immat,
        type,
        description: type + ' ' + vehicule.modele,
        datePrevue: offsetDate(daysAgo > 0 ? -daysAgo : -daysAgo),
        date: offsetDate(daysAgo > 0 ? -daysAgo : -daysAgo),
        cout: fait ? cout : null,
        kmCompteur: vehicule.km - randInt(0, 15000),
        statut: fait ? 'fait' : 'prevu',
        fait,
        garage: pick(['Renault Pro','Norauto','Garage Local','CarGlass','Concession']),
      });
    }

    // ----- 80 INSPECTIONS hebdo -----
    const INSPECTIONS = [];
    for (let i = 0; i < 80; i++) {
      const vehicule = pick(VEHICULES.filter(v => v.statut === 'actif'));
      const chauf = pick(chauffeurs);
      const daysAgo = randInt(0, 365);
      INSPECTIONS.push({
        id: uid(),
        vehiculeId: vehicule.id,
        vehImmat: vehicule.immat,
        chaufId: chauf.id,
        chaufNom: chauf.nom,
        date: offsetDate(-daysAgo),
        type: 'hebdomadaire',
        defauts: chance(0.1) ? [pick(['pneu avant gauche','feu arrière','essuie-glace','niveau huile'])] : [],
        statut: chance(0.1) ? 'defaut' : 'ok',
        photos: chance(0.7) ? ['inspection-' + i + '-a.jpg', 'inspection-' + i + '-b.jpg'] : [],
      });
    }

    // ----- 30 INCIDENTS -----
    const INCIDENTS = [];
    const TYPES_INC = ['Retard livraison','Colis endommagé','Adresse erronée','Refus client','Accident léger','Panne mécanique','Erreur facturation','Réclamation client'];
    for (let i = 0; i < 30; i++) {
      const client = pick(CLIENTS);
      const chauf = pick(chauffeurs);
      const daysAgo = randInt(0, 365);
      const gravite = chance(0.15) ? 'grave' : chance(0.5) ? 'moyen' : 'faible';
      INCIDENTS.push({
        id: uid(),
        date: offsetDate(-daysAgo),
        clientId: client.id,
        client: client.nom,
        chaufId: chauf.id,
        chaufNom: chauf.nom,
        type: pick(TYPES_INC),
        description: pick(TYPES_INC) + ' — ' + client.nom,
        gravite,
        statut: daysAgo > 30 ? 'traite' : pick(['ouvert','encours','traite']),
      });
    }

    // ----- 30 ALERTES ADMIN -----
    const ALERTES = [
      { id: uid(), niveau: 'critical', titre: 'CT véhicule', message: 'CT véhicule ' + VEHICULES[3].immat + ' expire dans 4 jours', type: 'ct', categorie: 'vehicule', meta: { vehId: VEHICULES[3].id }, creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'critical', titre: 'Assurance', message: 'Assurance véhicule ' + VEHICULES[11].immat + ' expirée', type: 'assurance', categorie: 'vehicule', meta: { vehId: VEHICULES[11].id }, creeLe: isoDT(new Date(Date.now() - 86400000)) },
      { id: uid(), niveau: 'haute', titre: 'Permis Karim', message: 'Karim Benali — permis C à renouveler dans 22 jours', type: 'permis', categorie: 'salarie', meta: { salId: SALARIES[0].id }, creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'warn', titre: 'Permis Mohamed', message: 'Mohamed Tahar — permis B expire dans 35 jours', type: 'permis', categorie: 'salarie', meta: { salId: SALARIES[1].id }, creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'warn', titre: 'Conso anormale', message: 'Conso anormale Master 130 (' + VEHICULES[1].immat + ') — +18% vs moyenne 30 jours', type: 'conso', categorie: 'carburant', meta: { vehId: VEHICULES[1].id }, creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'warn', titre: 'Impayé Boulanger', message: 'Boulanger : facture L-2026-0124 en retard de paiement (45 jours)', type: 'paiement', categorie: 'encaissement', creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'warn', titre: 'TVA échéance', message: 'TVA à reverser au 15/05 — 4 436 €', type: 'tva', categorie: 'tva', creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'info', titre: 'Inspection OK', message: 'Inspection hebdo flotte OK — 5 véhicules contrôlés, 0 défaut', type: 'inspection', categorie: 'inspection', creeLe: isoDT(new Date()) },
      { id: uid(), niveau: 'info', titre: 'Sauvegarde', message: 'Sauvegarde quotidienne effectuée à 03:00', type: 'systeme', categorie: 'systeme', lu: true, creeLe: isoDT(new Date()) },
    ];
    // Plus d'alertes traitées historiques
    for (let i = 0; i < 21; i++) {
      ALERTES.push({
        id: uid(),
        niveau: pick(['info','warn','warn','haute']),
        titre: 'Alerte ' + (i + 10),
        message: pick(['Entretien à programmer','Document à uploader','Suivi à faire','Validation requise']) + ' — ' + pad(randInt(1, 28)) + '/' + pad(randInt(1, 12)),
        type: pick(['entretien','document','suivi','validation']),
        categorie: pick(['vehicule','salarie','document','client']),
        traitee: true,
        creeLe: isoDT(new Date(Date.now() - randInt(30, 200) * 86400000)),
      });
    }

    // ----- PLANNINGS HEBDO -----
    const PLANNINGS_HEBDO = chauffeurs.map(s => ({
      id: uid(),
      salarieId: s.id,
      salarieNom: s.nom,
      semaine: [
        { jour: 'lun', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'mar', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'mer', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'jeu', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'ven', travaille: true, heureDebut: '07:00', heureFin: '15:00' },
        { jour: 'sam', travaille: chance(0.3), heureDebut: '08:00', heureFin: '13:00' },
        { jour: 'dim', travaille: false },
      ],
    }));

    // ----- HEURES POINTAGE (30 derniers jours × chauffeurs) -----
    const HEURES = [];
    for (let d = 0; d < 30; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      chauffeurs.forEach(s => {
        if (isWeekend && !chance(0.3)) return;
        const arrivee = randInt(6, 8) + ':' + pick(['00','15','30','45']);
        const depart = randInt(15, 17) + ':' + pick(['00','15','30','45']);
        HEURES.push({
          id: uid(),
          salarieId: s.id,
          salarieNom: s.nom,
          date: isoDate(date),
          arrivee,
          depart,
          kmDebut: randInt(50000, 200000),
          kmFin: randInt(50050, 200400),
        });
      });
    }

    // ----- 12 DÉCLARATIONS TVA mensuelles -----
    const TVA_DEC = [];
    for (let m = 11; m >= 0; m--) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      const livMois = LIVRAISONS.filter(l => {
        try {
          const dl = new Date(l.date);
          return dl.getMonth() === date.getMonth() && dl.getFullYear() === date.getFullYear();
        } catch { return false; }
      });
      const collectee = livMois.reduce((s, l) => s + (l.tva || 0), 0);
      const chargesMois = CHARGES.filter(c => {
        try {
          const dc = new Date(c.date);
          return dc.getMonth() === date.getMonth() && dc.getFullYear() === date.getFullYear();
        } catch { return false; }
      });
      const deductible = chargesMois.reduce((s, c) => s + ((c.montantTTC || 0) - (c.montantHT || 0)), 0);
      TVA_DEC.push({
        id: uid(),
        mois: pad(date.getMonth() + 1),
        annee: date.getFullYear(),
        periode: pad(date.getMonth() + 1) + '/' + date.getFullYear(),
        tvaCollectee: Math.round(collectee * 100) / 100,
        tvaDeductible: Math.round(deductible * 100) / 100,
        tvaAReverser: Math.round((collectee - deductible) * 100) / 100,
        statut: m > 0 ? 'declaree' : 'a_declarer',
      });
    }

    // ----- PAIEMENTS (encaissements) -----
    const PAIEMENTS = [];
    LIVRAISONS.filter(l => l.statutPaiement === 'paye' && l.datePaiement).forEach(l => {
      PAIEMENTS.push({
        id: uid(),
        livraisonId: l.id,
        clientId: l.clientId,
        client: l.client,
        date: l.datePaiement,
        montant: l.prixTTC,
        moyen: pick(['virement','virement','virement','cheque','espece','cb']),
        reference: 'VIR-' + randInt(100000, 999999),
      });
    });

    // ----- FACTURES ÉMISES (legacy) — Phase 60 V7 polish seed pour section Encaissement -----
    const FACTURES_EMISES = LIVRAISONS.filter(l => l.statutPaiement === 'paye' || (l.dateFacture && chance(0.8))).map((l, idx) => ({
      id: uid(),
      numero: 'F-' + (2026000 + idx + 1),
      livraisonId: l.id,
      client: l.client,
      clientId: l.clientId,
      date: l.dateFacture || l.date,
      montantHT: l.prixHT || (l.prixTTC ? Math.round(l.prixTTC / 1.2) : 0),
      montantTTC: l.prixTTC || 0,
      statut: l.statutPaiement === 'paye' ? 'payee' : 'en_attente'
    }));

    // ----- AVOIRS ÉMIS (legacy) — quelques avoirs ponctuels -----
    const AVOIRS_EMIS = [];
    for (let i = 0; i < 4; i++) {
      const liv = pick(LIVRAISONS);
      const d = new Date();
      d.setDate(d.getDate() - randInt(5, 60));
      AVOIRS_EMIS.push({
        id: uid(),
        numero: 'AV-2026-' + (i + 1).toString().padStart(3, '0'),
        livraisonId: liv.id,
        client: liv.client,
        clientId: liv.clientId,
        date: d.toISOString().slice(0, 10),
        motif: pick(['Erreur facturation', 'Geste commercial', 'Livraison partielle', 'Litige résolu']),
        montantHT: Math.round((liv.prixHT || 100) * 0.15),
        montantTTC: Math.round((liv.prixTTC || 120) * 0.15)
      });
    }

    // ----- ACOMPTES (legacy) — quelques acomptes reçus -----
    const ACOMPTES = [];
    for (let i = 0; i < 6; i++) {
      const liv = pick(LIVRAISONS);
      const d = new Date();
      d.setDate(d.getDate() - randInt(3, 45));
      ACOMPTES.push({
        id: uid(),
        livId: liv.id,
        livRef: liv.numLiv || ('L-' + liv.id.slice(0, 6)),
        client: liv.client,
        date: d.toISOString().slice(0, 10),
        montant: Math.round((liv.prixTTC || 500) * 0.3),
        mode: pick(['Virement', 'Chèque', 'Espèces', 'CB']),
        note: pick(['Acompte commande', '30% à la commande', 'Provision déplacement', ''])
      });
    }

    // ----- RELANCES LOG (legacy) — historique relances envoyées -----
    const RELANCES_LOG = [];
    LIVRAISONS.filter(l => l.statutPaiement !== 'paye' && chance(0.3)).slice(0, 12).forEach((l, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - randInt(1, 30));
      RELANCES_LOG.push({
        id: uid(),
        livId: l.id,
        livRef: l.numLiv || ('L-' + l.id.slice(0, 6)),
        factureNum: 'F-' + (2026000 + idx + 100),
        client: l.client,
        clientId: l.clientId,
        date: d.toISOString().slice(0, 10),
        type: pick(['Standard', 'Standard', '2ème relance', 'Mise en demeure']),
        canal: pick(['Email', 'Email', 'Téléphone', 'SMS']),
        statut: 'envoyee'
      });
    });

    // ----- CONFIG ENTREPRISE -----
    const CONFIG = {
      nom: 'MCA Logistics',
      siret: '10289809500017',
      formeJuridique: 'SAS',
      codeAPE: '4941B',
      tvaNum: 'FR42102898095',
      adresse: '17 rue de la Chapelle',
      codePostal: '67540',
      ville: 'Ostwald',
      telephone: '0388123456',
      emailPro: 'contact@mca-logistics.fr',
      capitalSocial: 7200,
      capitalLibere: 3600,
      regimeTVA: 'reel_normal',
      periodiciteTVA: 'mensuel',
    };

    // INJECT ALL
    localStorage.setItem('livraisons', JSON.stringify(LIVRAISONS));
    localStorage.setItem('clients', JSON.stringify(CLIENTS));
    localStorage.setItem('fournisseurs', JSON.stringify(FOURNISSEURS));
    localStorage.setItem('vehicules', JSON.stringify(VEHICULES));
    localStorage.setItem('salaries', JSON.stringify(SALARIES));
    // Phase 60 V7 polish — Maintenir 'chauffeurs' synchrone avec salaries (legacy compat script-stats.js + script-salaries.js).
    localStorage.setItem('chauffeurs', JSON.stringify(chauffeurs));
    localStorage.setItem('carburant', JSON.stringify(CARBURANT));
    localStorage.setItem('charges', JSON.stringify(CHARGES));
    localStorage.setItem('alertes_admin', JSON.stringify(ALERTES));
    localStorage.setItem('plannings_hebdo', JSON.stringify(PLANNINGS_HEBDO));
    localStorage.setItem('config_entreprise', JSON.stringify(CONFIG));
    localStorage.setItem('entretiens', JSON.stringify(ENTRETIENS));
    localStorage.setItem('inspections', JSON.stringify(INSPECTIONS));
    localStorage.setItem('incidents', JSON.stringify(INCIDENTS));
    localStorage.setItem('heures_pointage', JSON.stringify(HEURES));
    localStorage.setItem('tva_declarations', JSON.stringify(TVA_DEC));
    localStorage.setItem('paiements', JSON.stringify(PAIEMENTS));
    // Phase 60 V7 polish — seed legacy localStorage (factures émises, avoirs, acomptes, relances)
    localStorage.setItem('factures_emises', JSON.stringify(FACTURES_EMISES));
    localStorage.setItem('avoirs_emis', JSON.stringify(AVOIRS_EMIS));
    localStorage.setItem('acomptes', JSON.stringify(ACOMPTES));
    localStorage.setItem('relances_log', JSON.stringify(RELANCES_LOG));

    console.log('[mca-dev-seed MAX] Injected :');
    console.table({
      livraisons: LIVRAISONS.length,
      clients: CLIENTS.length,
      fournisseurs: FOURNISSEURS.length,
      vehicules: VEHICULES.length,
      salaries: SALARIES.length,
      carburant: CARBURANT.length,
      charges: CHARGES.length,
      entretiens: ENTRETIENS.length,
      inspections: INSPECTIONS.length,
      incidents: INCIDENTS.length,
      alertes: ALERTES.length,
      heures: HEURES.length,
      tva: TVA_DEC.length,
      paiements: PAIEMENTS.length,
      factures: FACTURES_EMISES.length,
      avoirs: AVOIRS_EMIS.length,
      acomptes: ACOMPTES.length,
      relances: RELANCES_LOG.length,
    });
  }
})();
