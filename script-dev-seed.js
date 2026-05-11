// MCA LOGISTICS — Dev seed (Solution B refonte visuelle)
//
// Injecte des données fictives en localStorage pour rendre le dashboard
// visuellement "plein" lors des screenshots Playwright. Activé via :
//   - ?seed=1 dans l'URL              → seed une fois puis reload
//   - localStorage.setItem('mca_dev_seeded', '1')  → garde le seed
//
// Sécurité : ne tourne PAS si données métier réelles présentes (livraisons.length > 0).
// Idempotent : ne re-seed pas si flag mca_dev_seeded déjà à '1'.

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const wantSeed = params.get('seed') === '1';
  const alreadySeeded = localStorage.getItem('mca_dev_seeded') === '1';

  if (!wantSeed && !alreadySeeded) return;

  // Anti-écrasement : si déjà des livraisons réelles, on n'écrase pas
  function safeRead(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }
  if (safeRead('livraisons').length > 0 && !wantSeed) return;

  if (wantSeed && !alreadySeeded) {
    seed();
    localStorage.setItem('mca_dev_seeded', '1');
    // Retire le query param et reload pour appliquer
    const url = new URL(window.location.href);
    url.searchParams.delete('seed');
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  }

  function uid() { return 'dev-' + Math.random().toString(36).slice(2, 11); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function offsetDate(days) { const d = new Date(); d.setDate(d.getDate() + days); return isoDate(d); }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function seed() {
    // 10 clients
    const CLIENTS = [
      { id: uid(), nom: 'Amazon France', type: 'professionnel', secteur: 'ecommerce', ville: 'Roubaix', email: 'logistique@amazon.fr', tel: '0123456789', delaiPaiement: 30 },
      { id: uid(), nom: 'Carrefour Hyper', type: 'professionnel', secteur: 'commerce', ville: 'Lille', email: 'achats@carrefour.fr', tel: '0320111111', delaiPaiement: 45 },
      { id: uid(), nom: 'Decathlon Logistics', type: 'professionnel', secteur: 'ecommerce', ville: 'Villeneuve d\'Ascq', email: 'log@decathlon.com', tel: '0320222222', delaiPaiement: 30 },
      { id: uid(), nom: 'Boulanger', type: 'professionnel', secteur: 'commerce', ville: 'Lesquin', email: 'sav@boulanger.fr', tel: '0320333333', delaiPaiement: 60 },
      { id: uid(), nom: 'Leroy Merlin', type: 'professionnel', secteur: 'commerce', ville: 'Lens', email: 'log@leroymerlin.fr', tel: '0321444444', delaiPaiement: 45 },
      { id: uid(), nom: 'Auchan Nord', type: 'professionnel', secteur: 'commerce', ville: 'Roncq', email: 'log@auchan.fr', tel: '0320555555', delaiPaiement: 30 },
      { id: uid(), nom: 'Castorama', type: 'professionnel', secteur: 'commerce', ville: 'Templemars', email: 'log@castorama.fr', tel: '0320666666', delaiPaiement: 45 },
      { id: uid(), nom: 'Intermarché Lille', type: 'professionnel', secteur: 'commerce', ville: 'Lille', email: 'log@intermarche.fr', tel: '0320777777', delaiPaiement: 30 },
      { id: uid(), nom: 'Société TBM', type: 'professionnel', secteur: 'industrie', ville: 'Tourcoing', email: 'contact@tbm.fr', tel: '0320888888', delaiPaiement: 60 },
      { id: uid(), nom: 'Particulier Dupont', type: 'particulier', ville: 'Arras', email: 'dupont@gmail.com', tel: '0612345678', delaiPaiement: 0 },
    ];

    // 5 véhicules
    const VEHICULES = [
      { id: uid(), immatriculation: 'FG-788-FB', modele: 'OPEL MOVANO', km: 87500, conso: 10, capaciteReservoir: 80, modeAcquisition: 'occasion', prixAchatHT: 24000, dureeAmortissement: 5, dateAcquisition: '2024-05-18', dateCT: '2026-05-18', dateProchainCT: '2028-05-18', entretienIntervalKm: 15000, entretienIntervalMois: 12, tvaCarburantDeductible: 100 },
      { id: uid(), immatriculation: 'KH-234-LM', modele: 'RENAULT MASTER 130', km: 145000, conso: 11.5, capaciteReservoir: 100, modeAcquisition: 'lld', loyerMensuelHT: 480, dateAcquisition: '2023-09-01', dateCT: '2025-09-01', entretienIntervalKm: 20000, tvaCarburantDeductible: 100 },
      { id: uid(), immatriculation: 'AB-456-CD', modele: 'MERCEDES SPRINTER 314', km: 62000, conso: 9.5, capaciteReservoir: 75, modeAcquisition: 'credit', creditMensualiteHT: 620, dateAcquisition: '2025-01-15', dateCT: '2027-01-15', entretienIntervalKm: 15000, tvaCarburantDeductible: 100 },
      { id: uid(), immatriculation: 'XY-789-ZW', modele: 'PEUGEOT BOXER', km: 198000, conso: 10.5, capaciteReservoir: 90, modeAcquisition: 'achat', prixAchatHT: 18000, dureeAmortissement: 4, dateAcquisition: '2022-03-10', dateCT: '2024-03-10', dateProchainCT: '2026-05-15', entretienIntervalKm: 15000, tvaCarburantDeductible: 100 }, // CT expire bientôt !
      { id: uid(), immatriculation: 'EF-123-GH', modele: 'IVECO DAILY', km: 34000, conso: 11, capaciteReservoir: 90, modeAcquisition: 'lld', loyerMensuelHT: 510, dateAcquisition: '2025-08-20', dateCT: '2027-08-20', entretienIntervalKm: 20000, tvaCarburantDeductible: 100 },
    ];

    // 5 salariés (chauffeurs)
    const SALARIES = [
      { id: uid(), nom: 'Karim Benali', poste: 'Chauffeur livreur', telephone: '0612345601', email: 'karim.benali@mca.fr', actif: true, dateEmbauche: '2023-01-15', permis: 'C', dateExpirationPermis: '2027-06-30' },
      { id: uid(), nom: 'Mohamed Tahar', poste: 'Chauffeur livreur', telephone: '0612345602', email: 'mohamed.tahar@mca.fr', actif: true, dateEmbauche: '2023-06-01', permis: 'B', dateExpirationPermis: '2026-06-15' }, // expire bientôt
      { id: uid(), nom: 'Jean Lefèvre', poste: 'Chauffeur livreur', telephone: '0612345603', email: 'jean.lefevre@mca.fr', actif: true, dateEmbauche: '2024-03-15', permis: 'C', dateExpirationPermis: '2028-12-31' },
      { id: uid(), nom: 'Antoine Martin', poste: 'Chauffeur livreur', telephone: '0612345604', email: 'antoine.martin@mca.fr', actif: true, dateEmbauche: '2024-11-20', permis: 'B', dateExpirationPermis: '2029-03-01' },
      { id: uid(), nom: 'Achraf Chikri', poste: 'Gérant', telephone: '0612345605', email: 'chikriachraf67@gmail.com', actif: true, dateEmbauche: '2023-01-01', permis: 'B' },
    ];

    // 100+ livraisons sur 6 mois
    const LIVRAISONS = [];
    const STATUTS = ['livre', 'livre', 'livre', 'livre', 'livre', 'en-cours', 'en-attente', 'retard'];
    const STATUTS_PAIEMENT = ['paye', 'paye', 'paye', 'en-attente', 'en-attente', 'retard'];
    for (let i = 0; i < 142; i++) {
      const client = pick(CLIENTS);
      const vehicule = pick(VEHICULES);
      const chauffeur = pick(SALARIES.filter(s => s.poste === 'Chauffeur livreur'));
      const daysAgo = randInt(0, 180);
      const distance = randInt(15, 350);
      const prixHT = Math.round(distance * randInt(180, 280) / 100 * 10) / 10;
      const tauxTVA = 20;
      const prixTTC = Math.round(prixHT * (1 + tauxTVA / 100) * 100) / 100;
      LIVRAISONS.push({
        id: uid(),
        numLiv: 'L-2026-' + pad(i + 1).padStart(4, '0'),
        date: offsetDate(-daysAgo),
        clientId: client.id,
        client: client.nom,
        vehiculeId: vehicule.id,
        vehImmat: vehicule.immatriculation,
        chaufId: chauffeur.id,
        chaufNom: chauffeur.nom,
        depart: pick(['Roubaix', 'Lille', 'Tourcoing', 'Lens', 'Arras', 'Villeneuve']),
        arrivee: client.ville,
        distance,
        prix: prixHT,
        prixHT,
        prixTTC,
        tauxTVA,
        statut: pick(STATUTS),
        statutPaiement: daysAgo > 60 ? 'paye' : pick(STATUTS_PAIEMENT),
        creeLe: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      });
    }

    // 50 pleins carburant
    const CARBURANT = [];
    for (let i = 0; i < 50; i++) {
      const vehicule = pick(VEHICULES);
      const daysAgo = randInt(0, 90);
      const litres = randInt(40, 80);
      const prixL = 1.65 + Math.random() * 0.15;
      CARBURANT.push({
        id: uid(),
        date: offsetDate(-daysAgo),
        vehiculeId: vehicule.id,
        vehImmat: vehicule.immatriculation,
        litres,
        prixLitre: Math.round(prixL * 100) / 100,
        total: Math.round(litres * prixL * 100) / 100,
        kmCompteur: vehicule.km - randInt(0, 5000),
        tvaDeductible: vehicule.tvaCarburantDeductible || 100,
      });
    }

    // 25 charges diverses (assurance, loyer, frais bancaires, etc.)
    const CHARGES = [];
    const CATEGORIES = [
      { nom: 'Assurance flotte', categorie: 'assurance', montantHT: 850 },
      { nom: 'Location dépôt', categorie: 'loyer', montantHT: 1200 },
      { nom: 'Frais bancaires', categorie: 'banque', montantHT: 45 },
      { nom: 'Comptabilité Pennylane', categorie: 'comptabilite', montantHT: 89 },
      { nom: 'Téléphone pro', categorie: 'telecom', montantHT: 65 },
      { nom: 'Internet bureau', categorie: 'telecom', montantHT: 39 },
      { nom: 'Hébergement Cloudflare', categorie: 'hosting', montantHT: 25 },
      { nom: 'INPI dépôt marque', categorie: 'autre', montantHT: 250 },
      { nom: 'Mutuelle équipe', categorie: 'sociales', montantHT: 380 },
    ];
    for (let i = 0; i < 25; i++) {
      const tpl = pick(CATEGORIES);
      const daysAgo = randInt(0, 180);
      CHARGES.push({
        id: uid(),
        date: offsetDate(-daysAgo),
        description: tpl.nom + ' — ' + pad(new Date(Date.now() - daysAgo * 86400000).getMonth() + 1) + '/' + (new Date(Date.now() - daysAgo * 86400000).getFullYear()),
        categorie: tpl.categorie,
        montantHT: tpl.montantHT + randInt(-20, 50),
        tauxTVA: 20,
        montantTTC: Math.round(tpl.montantHT * 1.2 * 100) / 100,
        statutPaiement: daysAgo > 30 ? 'paye' : pick(['paye', 'a_payer']),
      });
    }

    // 12 alertes admin actives
    const ALERTES = [
      { id: uid(), niveau: 'critical', message: 'CT véhicule XY-789-ZW expire dans 4 jours', type: 'ct', meta: { vehId: VEHICULES[3].id }, creeLe: new Date().toISOString() },
      { id: uid(), niveau: 'warn', message: 'Karim Benali — permis catégorie C à renouveler dans 22 jours', type: 'permis', meta: { salId: SALARIES[0].id }, creeLe: new Date().toISOString() },
      { id: uid(), niveau: 'warn', message: 'Mohamed Tahar — permis B expire dans 35 jours', type: 'permis', meta: { salId: SALARIES[1].id }, creeLe: new Date().toISOString() },
      { id: uid(), niveau: 'info', message: 'Conso anormale Master 130 (KH-234-LM) — +18% vs moyenne 30 jours', type: 'conso', meta: { vehId: VEHICULES[1].id }, creeLe: new Date().toISOString() },
      { id: uid(), niveau: 'warn', message: 'Boulanger : facture L-2026-0124 en retard de paiement (45 jours)', type: 'paiement', creeLe: new Date().toISOString() },
      { id: uid(), niveau: 'info', message: 'Inspection hebdo flotte OK — 5 véhicules contrôlés, 0 défaut', type: 'inspection', creeLe: new Date().toISOString() },
    ];

    // Plannings de la semaine (5 chauffeurs)
    const PLANNINGS_HEBDO = SALARIES.filter(s => s.poste === 'Chauffeur livreur').map(s => ({
      id: uid(),
      salarieId: s.id,
      semaine: [
        { jour: 'lun', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'mar', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'mer', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'jeu', travaille: true, heureDebut: '07:00', heureFin: '16:00' },
        { jour: 'ven', travaille: true, heureDebut: '07:00', heureFin: '15:00' },
        { jour: 'sam', travaille: false },
        { jour: 'dim', travaille: false },
      ],
    }));

    // Config entreprise
    const CONFIG_ENTREPRISE = {
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
    };

    // Inject everything
    localStorage.setItem('livraisons', JSON.stringify(LIVRAISONS));
    localStorage.setItem('clients', JSON.stringify(CLIENTS));
    localStorage.setItem('vehicules', JSON.stringify(VEHICULES));
    localStorage.setItem('salaries', JSON.stringify(SALARIES));
    localStorage.setItem('carburant', JSON.stringify(CARBURANT));
    localStorage.setItem('charges', JSON.stringify(CHARGES));
    localStorage.setItem('alertes_admin', JSON.stringify(ALERTES));
    localStorage.setItem('plannings_hebdo', JSON.stringify(PLANNINGS_HEBDO));
    localStorage.setItem('config_entreprise', JSON.stringify(CONFIG_ENTREPRISE));

    console.log('[mca-dev-seed] Seeded ' + LIVRAISONS.length + ' livraisons, ' + CLIENTS.length + ' clients, ' +
                VEHICULES.length + ' véhicules, ' + SALARIES.length + ' salariés, ' +
                CARBURANT.length + ' pleins, ' + CHARGES.length + ' charges, ' +
                ALERTES.length + ' alertes.');
  }

  // Expose pour debug + reset manuel
  window.__mcaDevSeed = {
    reset() {
      ['livraisons', 'clients', 'vehicules', 'salaries', 'carburant', 'charges',
       'alertes_admin', 'plannings_hebdo', 'config_entreprise', 'mca_dev_seeded'].forEach(k => localStorage.removeItem(k));
      window.location.reload();
    },
    reseed() {
      this.reset();
      setTimeout(() => { window.location.href = window.location.pathname + '?seed=1'; }, 100);
    },
  };
})();
