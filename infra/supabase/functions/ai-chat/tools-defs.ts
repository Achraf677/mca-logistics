// TOOLS array (function declarations Gemini) extrait de index.ts.
// Inclut: lecture seule (40+) + propose_* CREATE (13) + propose_update_* (12) + propose_delete + memoire.

const UPDATE_FIELDS_LIVRAISON = {
  client_nom: { type: "string" }, client_id: { type: "string" },
  date_livraison: { type: "string", description: "YYYY-MM-DD" },
  distance_km: { type: "number" },
  prix_ht: { type: "number" }, taux_tva: { type: "number" }, prix_ttc: { type: "number" }, tva_montant: { type: "number" },
  salarie_id: { type: "string" }, vehicule_id: { type: "string" },
  statut: { type: "string", enum: ["en_attente", "en_cours", "livree", "litige"] },
  statut_paiement: { type: "string", enum: ["a_payer", "paye", "en_retard", "partiel"] },
  zone: { type: "string" }, depart: { type: "string" }, arrivee: { type: "string" }, notes: { type: "string" },
  date_paiement: { type: "string" },
};

const UPDATE_FIELDS_CHARGE = {
  categorie: { type: "string" }, description: { type: "string" }, date_charge: { type: "string" },
  montant_ht: { type: "number" }, taux_tva: { type: "number" }, montant_ttc: { type: "number" },
  vehicule_id: { type: "string" }, fournisseur_id: { type: "string" }, fournisseur_nom: { type: "string" },
  taux_deductibilite: { type: "number" },
  statut_paiement: { type: "string", enum: ["a_payer", "paye", "en_retard", "partiel"] },
  date_paiement: { type: "string" }, mode_paiement: { type: "string" },
};

const UPDATE_FIELDS_PAIEMENT = {
  livraison_id: { type: "string" }, client_id: { type: "string" },
  date_paiement: { type: "string" }, montant: { type: "number" },
  mode: { type: "string" }, reference: { type: "string" }, notes: { type: "string" }, frais: { type: "number" },
};

const UPDATE_FIELDS_CLIENT = {
  nom: { type: "string" }, prenom: { type: "string" }, type: { type: "string" }, secteur: { type: "string" },
  siren: { type: "string" }, tva_intracom: { type: "string" }, pays: { type: "string" },
  adresse: { type: "string" }, cp: { type: "string" }, ville: { type: "string" },
  telephone: { type: "string" }, email: { type: "string" }, email_fact: { type: "string" }, contact: { type: "string" },
  delai_paiement_jours: { type: "integer" }, notes: { type: "string" },
};

const UPDATE_FIELDS_FOURNISSEUR = {
  nom: { type: "string" }, prenom: { type: "string" }, type: { type: "string" }, secteur: { type: "string" },
  siren: { type: "string" }, tva_intracom: { type: "string" }, pays: { type: "string" },
  adresse: { type: "string" }, cp: { type: "string" }, ville: { type: "string" },
  telephone: { type: "string" }, email: { type: "string" }, email_fact: { type: "string" }, contact: { type: "string" },
  iban: { type: "string" }, bic: { type: "string" }, paiement_mode: { type: "string" },
  delai_paiement_jours: { type: "integer" }, notes: { type: "string" },
};

const UPDATE_FIELDS_VEHICULE = {
  immat: { type: "string" }, marque: { type: "string" }, modele: { type: "string" },
  salarie_id: { type: "string" }, kilometrage: { type: "number" }, km_initial: { type: "number" },
  date_ct: { type: "string" }, date_assurance: { type: "string" }, date_carte_grise: { type: "string" }, date_vidange: { type: "string" },
  carburant: { type: "string" }, conso: { type: "number" }, capacite_reservoir: { type: "number" },
  tva_carburant_deductible: { type: "number" }, mode_acquisition: { type: "string" }, date_acquisition: { type: "string" },
  entretien_interval_km: { type: "number" }, entretien_interval_mois: { type: "number" },
  ptac: { type: "integer" }, ptra: { type: "integer" }, essieux: { type: "integer" },
  crit_air: { type: "string" }, vin: { type: "string" },
};

const UPDATE_FIELDS_SALARIE = {
  nom: { type: "string" }, prenom: { type: "string" }, nom_famille: { type: "string" },
  numero: { type: "string" }, poste: { type: "string" },
  permis: { type: "string" }, categorie_permis: { type: "string" }, date_permis: { type: "string" },
  assurance: { type: "string" }, date_assurance: { type: "string" },
  telephone: { type: "string" }, email: { type: "string" }, email_personnel: { type: "string" },
  actif: { type: "boolean" },
};

const UPDATE_FIELDS_CARBURANT = {
  vehicule_id: { type: "string" }, salarie_id: { type: "string" },
  date_plein: { type: "string" }, litres: { type: "number" },
  prix_ht: { type: "number" }, taux_tva: { type: "number" }, prix_ttc: { type: "number" },
  kilometrage: { type: "number" }, type_carburant: { type: "string" },
};

const UPDATE_FIELDS_ENTRETIEN = {
  vehicule_id: { type: "string" }, date_entretien: { type: "string" },
  type: { type: "string" }, description: { type: "string" },
  cout_ht: { type: "number" }, taux_tva: { type: "number" }, cout_ttc: { type: "number" },
  kilometrage: { type: "number" }, prochain_km: { type: "number" }, prochaine_date: { type: "string" },
};

const UPDATE_FIELDS_INCIDENT = {
  salarie_id: { type: "string" }, livraison_id: { type: "string" },
  gravite: { type: "string", enum: ["mineur", "moyen", "grave", "critique"] },
  description: { type: "string" }, date_incident: { type: "string" },
  statut: { type: "string", enum: ["ouvert", "en_cours", "clos"] },
};

const UPDATE_FIELDS_PLANNING = {
  salarie_id: { type: "string" }, jour: { type: "string" },
  travaille: { type: "boolean" }, type_jour: { type: "string" },
  heure_debut: { type: "string" }, heure_fin: { type: "string" },
  zone: { type: "string" }, note: { type: "string" },
};

const UPDATE_FIELDS_INSPECTION = {
  salarie_id: { type: "string" }, vehicule_id: { type: "string" },
  date_inspection: { type: "string" }, semaine_label: { type: "string" },
  commentaire: { type: "string" }, statut: { type: "string" },
};

function makeUpdateTool(name: string, label: string, fieldsObj: Record<string, unknown>) {
  return {
    name,
    description: `PROPOSE la MODIFICATION d'un(e) ${label} existant(e) (target_id obligatoire). Ne renseigne QUE les colonnes a changer. Retourne une proposition pour confirmation UI, n'ecrit PAS directement.`,
    parameters: {
      type: "object",
      properties: {
        target_id: { type: "string", description: `UUID du ${label} a modifier (obligatoire)` },
        ...fieldsObj,
      },
      required: ["target_id"],
    },
  };
}

const UPDATE_TOOLS = [
  makeUpdateTool("propose_update_livraison", "livraison", UPDATE_FIELDS_LIVRAISON),
  makeUpdateTool("propose_update_charge", "charge", UPDATE_FIELDS_CHARGE),
  makeUpdateTool("propose_update_paiement", "paiement", UPDATE_FIELDS_PAIEMENT),
  makeUpdateTool("propose_update_client", "client", UPDATE_FIELDS_CLIENT),
  makeUpdateTool("propose_update_fournisseur", "fournisseur", UPDATE_FIELDS_FOURNISSEUR),
  makeUpdateTool("propose_update_vehicule", "vehicule", UPDATE_FIELDS_VEHICULE),
  makeUpdateTool("propose_update_salarie", "salarie", UPDATE_FIELDS_SALARIE),
  makeUpdateTool("propose_update_carburant", "plein carburant", UPDATE_FIELDS_CARBURANT),
  makeUpdateTool("propose_update_entretien", "entretien", UPDATE_FIELDS_ENTRETIEN),
  makeUpdateTool("propose_update_incident", "incident", UPDATE_FIELDS_INCIDENT),
  makeUpdateTool("propose_update_planning_creneau", "creneau de planning", UPDATE_FIELDS_PLANNING),
  makeUpdateTool("propose_update_inspection", "inspection", UPDATE_FIELDS_INSPECTION),
];

const DELETE_TOOL = {
  name: "propose_delete",
  description: "PROPOSE la SUPPRESSION d'une entite (entity + id). Tool generique. La raison est OBLIGATOIRE et doit faire au moins 10 caracteres (justification metier). Retourne une proposition pour confirmation UI rouge avec long-press, n'ecrit PAS directement.",
  parameters: {
    type: "object",
    properties: {
      entity: {
        type: "string",
        enum: [
          "clients", "fournisseurs", "vehicules", "salaries", "livraisons",
          "charges", "paiements", "carburant", "entretiens", "incidents",
          "plannings_hebdo", "inspections", "alertes_admin",
        ],
        description: "Nom de table cible (entites supprimables)",
      },
      id: { type: "string", description: "UUID de la ligne a supprimer" },
      raison: { type: "string", description: "Justification metier ≥10 caracteres (obligatoire)" },
    },
    required: ["entity", "id", "raison"],
  },
};

const DRAFT_TOOL = {
  name: "propose_to_drafts",
  description: "Quand l'admin demande explicitement de mettre une operation en BROUILLON IA (ne pas executer maintenant, reviser plus tard), utilise ce tool. Sinon les propose_* normaux suffisent (l'admin peut quand meme les mettre en brouillon via l'UI).",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", description: "Type d'action (create_X / update_X / delete_entity)" },
      payload: { type: "object", description: "Payload complet de l'operation" },
      reasoning: { type: "string", description: "Pourquoi cette operation : justifie en 1-2 phrases" },
    },
    required: ["action", "payload", "reasoning"],
  },
};

export const TOOLS = [{
  functionDeclarations: [
    {
      name: "search_livraisons",
      description: "Cherche des livraisons (limite a 25 resultats les plus recents). Tous les filtres sont optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "Date min YYYY-MM-DD" },
          date_max: { type: "string", description: "Date max YYYY-MM-DD" },
          client_nom: { type: "string", description: "Nom client (recherche partielle insensible casse)" },
          statut_paiement: { type: "string", enum: ["a_payer", "paye", "en_retard", "partiel"] },
          statut: { type: "string", enum: ["en_attente", "en_cours", "livree", "litige"] },
        },
      },
    },
    {
      name: "search_charges",
      description: "Cherche des charges/depenses (limite 25). Tous filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD" },
          date_max: { type: "string", description: "YYYY-MM-DD" },
          categorie: { type: "string" },
          fournisseur_nom: { type: "string", description: "Recherche partielle insensible casse" },
          statut_paiement: { type: "string", enum: ["a_payer", "paye", "en_retard", "partiel"] },
        },
      },
    },
    {
      name: "search_clients",
      description: "Cherche des clients par nom (recherche partielle).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nom client ou ville" },
          type: { type: "string", enum: ["pro", "particulier"] },
        },
      },
    },
    {
      name: "search_fournisseurs",
      description: "Cherche des fournisseurs par nom.",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
    {
      name: "search_vehicules",
      description: "Liste les vehicules. Filtre par immatriculation ou marque.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Immatriculation ou marque" } },
      },
    },
    {
      name: "search_salaries",
      description: "Liste les salaries. Filtre par nom ou poste.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          actif_seulement: { type: "boolean", default: true },
        },
      },
    },
    {
      name: "search_carburant",
      description: "Liste les pleins de carburant. Filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          vehicule_id: { type: "string" },
        },
      },
    },
    {
      name: "get_stats",
      description: "Calcule des statistiques agregees sur une periode : CA, charges, marge, nb livraisons, conso carburant. Utilise CA quand on parle de chiffre d'affaires.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string", description: "YYYY-MM-DD (defaut: debut mois courant)" },
          date_max: { type: "string", description: "YYYY-MM-DD (defaut: aujourd'hui)" },
        },
      },
    },
    {
      name: "top_clients_ca",
      description: "Top N clients par chiffre d'affaires HT sur une periode (agregat des livraisons par client_nom).",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          limit: { type: "integer", description: "Nb de clients a retourner (1-20, defaut 5)" },
        },
      },
    },
    {
      name: "livraisons_impayees_retard",
      description: "Livraisons dont le delai de paiement client est depasse (calcul deterministe : today - (date_livraison + clients.delai_paiement_jours, defaut 30)). Limite 25.",
      parameters: {
        type: "object",
        properties: {
          min_jours_retard: { type: "integer", description: "Defaut 1" },
          client_nom: { type: "string" },
        },
      },
    },
    {
      name: "vehicules_echeances_proches",
      description: "Vehicules dont CT, assurance ou date_carte_grise expire dans X jours (inclut les deja expires). Trie par jours_restants ASC.",
      parameters: {
        type: "object",
        properties: { dans_n_jours: { type: "integer", description: "Defaut 30" } },
      },
    },
    {
      name: "inspections_non_validees",
      description: "Inspections vehicule en attente de validation admin (statut='soumise'). Limite 25.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          salarie_id: { type: "string" },
        },
      },
    },
    {
      name: "rentabilite_tournee",
      description: "Rentabilite par salarie (proxy 'tournee') sur une periode : CA HT, charges (vehicules rattaches) + carburant, marge brute, eur/km. Trie marge desc.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          salarie_id: { type: "string" },
        },
      },
    },
    {
      name: "match_factures_pennylane_mca",
      description: "Matching DETERMINISTE entre factures clients Pennylane et livraisons MCA d'un mois donne. A utiliser pour eviter d'inventer des correspondances. Score 0-1 base sur montant TTC ±0.50€, date ±5j, nom client similar.",
      parameters: {
        type: "object",
        properties: { mois: { type: "string", description: "YYYY-MM (defaut: mois precedent)" } },
      },
    },
    {
      name: "search_inspections",
      description: "Liste les inspections vehicule hebdomadaires. Filtres : date, salarie, vehicule, statut.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          salarie_id: { type: "string" },
          vehicule_id: { type: "string" },
          statut: { type: "string" },
        },
      },
    },
    {
      name: "search_entretiens",
      description: "Liste les entretiens vehicule. Filtres : date, vehicule, type d'entretien (vidange, freins, etc).",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          vehicule_id: { type: "string" },
          type: { type: "string" },
        },
      },
    },
    {
      name: "search_incidents",
      description: "Liste les incidents (sinistres, litiges, problemes chauffeur). Filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          salarie_id: { type: "string" },
          gravite: { type: "string", enum: ["mineur", "moyen", "grave", "critique"] },
          statut: { type: "string", enum: ["ouvert", "en_cours", "clos"] },
        },
      },
    },
    {
      name: "search_alertes",
      description: "Liste les alertes admin (permis expirant, CT, assurance, anomalies detectees, etc).",
      parameters: {
        type: "object",
        properties: {
          niveau: { type: "string", enum: ["info", "warning", "error", "critical"] },
          lue: { type: "boolean" },
          resolved: { type: "boolean" },
        },
      },
    },
    {
      name: "get_planning_semaine",
      description: "Recupere le planning d'une semaine (qui travaille, quels horaires, qui est en absence/conge). Si date_ref non fournie, utilise la semaine courante.",
      parameters: {
        type: "object",
        properties: { date_ref: { type: "string" } },
      },
    },
    {
      name: "get_anomalies_carburant",
      description: "Detecte les anomalies sur les pleins carburant : conso L/100km hors moyenne vehicule, pleins rapproches, litres > capacite reservoir, prix au litre incoherent.",
      parameters: {
        type: "object",
        properties: { date_min: { type: "string" }, date_max: { type: "string" } },
      },
    },
    {
      name: "qonto_organization",
      description: "Recupere les comptes bancaires Qonto de MCA et leurs soldes courants.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "qonto_search_transactions",
      description: "Liste les transactions bancaires Qonto (virements recus/emis, prelevements, cartes). Filtres optionnels.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          side: { type: "string", enum: ["debit", "credit"] },
          label_search: { type: "string" },
          min_amount: { type: "number" },
        },
      },
    },
    {
      name: "pennylane_factures_clients",
      description: "Liste les factures clients officielles dans Pennylane (la source de verite compta). Permet de croiser avec MCA.",
      parameters: {
        type: "object",
        properties: {
          date_min: { type: "string" },
          date_max: { type: "string" },
          paid_only: { type: "boolean" },
          unpaid_only: { type: "boolean" },
        },
      },
    },
    {
      name: "pennylane_factures_fournisseurs",
      description: "Liste les factures fournisseurs dans Pennylane.",
      parameters: { type: "object", properties: { date_min: { type: "string" }, date_max: { type: "string" } } },
    },
    {
      name: "pennylane_search_clients",
      description: "Liste les clients de Pennylane (utile pour comparer avec les clients MCA et detecter les divergences).",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
    {
      name: "pennylane_search_fournisseurs",
      description: "Liste les fournisseurs de Pennylane.",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
    {
      name: "ors_distance",
      description: "Calcule la distance routiere et la duree entre 2 adresses (avec geocoding automatique). Profil camion poids-lourd par defaut.",
      parameters: {
        type: "object",
        properties: {
          depart: { type: "string" },
          arrivee: { type: "string" },
          profile: { type: "string", enum: ["driving-hgv", "driving-car"] },
        },
        required: ["depart", "arrivee"],
      },
    },
    {
      name: "ors_optimize_tournee",
      description: "Optimise une tournee multi-stops (TSP) pour un camion. Donne l'ordre optimal et la distance/duree totale.",
      parameters: {
        type: "object",
        properties: {
          depart: { type: "string" },
          arrets: { type: "array", items: { type: "string" } },
          retour: { type: "string" },
        },
        required: ["depart", "arrets"],
      },
    },
    {
      name: "sentry_recent_issues",
      description: "Liste les bugs JS / erreurs recentes en prod sur le site MCA (capturees par Sentry).",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["1h", "24h", "7d", "14d", "30d"] },
          unresolved_only: { type: "boolean" },
        },
      },
    },
    {
      name: "audit_coherence_donnees",
      description: "Mode detective : scanne la DB et retourne un rapport priorise des incoherences (livraisons livrees sans date, charges sans fournisseur, vehicules CT/assurance expires, salaries sans permis, TVA mal calculee, plannings orphelins, etc).",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "get_audit_log",
      description: "Lit la table audit_log_entries (qui a fait quoi quand). Utilise pour 'qui a modifie X', 'historique de cette livraison', etc.",
      parameters: {
        type: "object",
        properties: {
          table_name: { type: "string" },
          operation: { type: "string", enum: ["INSERT", "UPDATE", "DELETE"] },
          actor_role: { type: "string", enum: ["admin", "salarie"] },
          row_id: { type: "string" },
          date_min: { type: "string" },
          date_max: { type: "string" },
        },
      },
    },
    {
      name: "get_livraison_detail",
      description: "Detail complet d'une livraison : tout le record + paiements rattaches + incidents lies + noms resolus (salarie/vehicule).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          num_liv: { type: "string" },
        },
      },
    },
    {
      name: "get_vehicule_historique",
      description: "Historique complet d'un vehicule : 10 derniers entretiens + 10 dernieres inspections + 10 derniers pleins carburant + 10 dernieres charges + 5 dernieres livraisons + totaux 12 mois.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, immat: { type: "string" } },
      },
    },
    {
      name: "propose_livraison",
      description: "PROPOSE la creation d'une livraison (ne cree PAS directement). Retourne une proposition que l'admin doit confirmer via une carte UI.",
      parameters: {
        type: "object",
        properties: {
          client_nom: { type: "string" },
          date_livraison: { type: "string" },
          distance_km: { type: "number" },
          prix_ht: { type: "number" },
          taux_tva: { type: "number" },
          salarie_nom: { type: "string" },
          vehicule_immat: { type: "string" },
          depart: { type: "string" },
          arrivee: { type: "string" },
          notes: { type: "string" },
        },
        required: ["client_nom", "date_livraison", "prix_ht"],
      },
    },
    {
      name: "propose_charge",
      description: "PROPOSE la creation d'une charge/depense. NE cree PAS directement.",
      parameters: {
        type: "object",
        properties: {
          categorie: { type: "string" },
          description: { type: "string" },
          date_charge: { type: "string" },
          montant_ht: { type: "number" },
          taux_tva: { type: "number" },
          fournisseur_nom: { type: "string" },
          vehicule_immat: { type: "string" },
        },
        required: ["categorie", "date_charge", "montant_ht"],
      },
    },
    {
      name: "propose_paiement",
      description: "PROPOSE l'enregistrement d'un paiement client sur une livraison.",
      parameters: {
        type: "object",
        properties: {
          livraison_num_liv: { type: "string" },
          montant: { type: "number" },
          mode: { type: "string" },
          date_paiement: { type: "string" },
          reference: { type: "string" },
          frais: { type: "number" },
        },
        required: ["livraison_num_liv", "montant"],
      },
    },
    {
      name: "propose_marquer_alerte_resolue",
      description: "PROPOSE de marquer une alerte admin comme resolue.",
      parameters: {
        type: "object",
        properties: { alerte_id: { type: "string" } },
        required: ["alerte_id"],
      },
    },
    {
      name: "propose_client",
      description: "PROPOSE la creation d'un client.",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string" }, prenom: { type: "string" },
          type: { type: "string", enum: ["pro", "particulier"] },
          secteur: { type: "string" }, siren: { type: "string" }, tva_intracom: { type: "string" },
          adresse: { type: "string" }, cp: { type: "string" }, ville: { type: "string" },
          telephone: { type: "string" }, email: { type: "string" }, email_fact: { type: "string" },
          contact: { type: "string" }, delai_paiement_jours: { type: "integer" }, notes: { type: "string" },
        },
        required: ["nom"],
      },
    },
    {
      name: "propose_fournisseur",
      description: "PROPOSE la creation d'un fournisseur.",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string" }, prenom: { type: "string" },
          type: { type: "string", enum: ["Pro", "Particulier"] },
          secteur: { type: "string" }, siren: { type: "string" }, tva_intracom: { type: "string" },
          adresse: { type: "string" }, cp: { type: "string" }, ville: { type: "string" },
          telephone: { type: "string" }, email: { type: "string" }, email_fact: { type: "string" },
          contact: { type: "string" }, iban: { type: "string" }, bic: { type: "string" },
          paiement_mode: { type: "string" }, delai_paiement_jours: { type: "integer" }, notes: { type: "string" },
        },
        required: ["nom"],
      },
    },
    {
      name: "propose_vehicule",
      description: "PROPOSE la creation d'un vehicule.",
      parameters: {
        type: "object",
        properties: {
          immat: { type: "string" }, marque: { type: "string" }, modele: { type: "string" },
          salarie_id: { type: "string" }, kilometrage: { type: "number" }, km_initial: { type: "number" },
          date_ct: { type: "string" }, date_assurance: { type: "string" },
          date_carte_grise: { type: "string" }, date_vidange: { type: "string" },
          carburant: { type: "string" }, conso: { type: "number" }, capacite_reservoir: { type: "number" },
          tva_carburant_deductible: { type: "number" }, mode_acquisition: { type: "string" },
          date_acquisition: { type: "string" }, entretien_interval_km: { type: "number" },
          entretien_interval_mois: { type: "number" }, ptac: { type: "integer" }, ptra: { type: "integer" },
          essieux: { type: "integer" }, crit_air: { type: "string" }, vin: { type: "string" },
        },
        required: ["immat"],
      },
    },
    {
      name: "propose_salarie",
      description: "PROPOSE la creation d'un salarie.",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string" }, prenom: { type: "string" }, nom_famille: { type: "string" },
          numero: { type: "string" }, poste: { type: "string" },
          permis: { type: "string" }, categorie_permis: { type: "string" }, date_permis: { type: "string" },
          assurance: { type: "string" }, date_assurance: { type: "string" },
          telephone: { type: "string" }, email: { type: "string" }, email_personnel: { type: "string" },
        },
        required: ["nom"],
      },
    },
    {
      name: "propose_carburant",
      description: "PROPOSE la creation d'un plein carburant.",
      parameters: {
        type: "object",
        properties: {
          vehicule_id: { type: "string" }, vehicule_immat: { type: "string" },
          salarie_id: { type: "string" }, date_plein: { type: "string" },
          litres: { type: "number" }, prix_ht: { type: "number" },
          taux_tva: { type: "number" }, prix_ttc: { type: "number" },
          kilometrage: { type: "number" }, type_carburant: { type: "string" },
        },
      },
    },
    {
      name: "propose_entretien",
      description: "PROPOSE la creation d'un entretien vehicule.",
      parameters: {
        type: "object",
        properties: {
          vehicule_id: { type: "string" }, vehicule_immat: { type: "string" },
          date_entretien: { type: "string" }, type: { type: "string" }, description: { type: "string" },
          cout_ht: { type: "number" }, taux_tva: { type: "number" }, cout_ttc: { type: "number" },
          kilometrage: { type: "number" }, prochain_km: { type: "number" }, prochaine_date: { type: "string" },
        },
      },
    },
    {
      name: "propose_incident",
      description: "PROPOSE la creation d'un incident (accrochage, sinistre, litige, etc.).",
      parameters: {
        type: "object",
        properties: {
          salarie_id: { type: "string" }, livraison_id: { type: "string" },
          gravite: { type: "string", enum: ["mineur", "moyen", "grave", "critique"] },
          description: { type: "string" }, date_incident: { type: "string" },
          statut: { type: "string", enum: ["ouvert", "en_cours", "clos"] },
        },
        required: ["description"],
      },
    },
    {
      name: "propose_planning_creneau",
      description: "PROPOSE la creation d'un creneau de planning hebdomadaire pour un salarie.",
      parameters: {
        type: "object",
        properties: {
          salarie_id: { type: "string" }, jour: { type: "string" },
          travaille: { type: "boolean" }, type_jour: { type: "string" },
          heure_debut: { type: "string" }, heure_fin: { type: "string" },
          zone: { type: "string" }, note: { type: "string" },
        },
        required: ["salarie_id", "jour"],
      },
    },
    {
      name: "propose_inspection",
      description: "PROPOSE la creation d'une inspection vehicule (controle hebdomadaire).",
      parameters: {
        type: "object",
        properties: {
          salarie_id: { type: "string" }, vehicule_id: { type: "string" },
          date_inspection: { type: "string" }, semaine_label: { type: "string" },
          commentaire: { type: "string" }, statut: { type: "string" },
        },
        required: ["salarie_id"],
      },
    },
    ...UPDATE_TOOLS,
    DELETE_TOOL,
    DRAFT_TOOL,
    {
      name: "add_memory_fact",
      description: "Memorise un fait important sur le business pour le retenir dans toutes les conversations futures. Ne l'utilise QUE pour des faits de long terme.",
      parameters: {
        type: "object",
        properties: {
          fact_text: { type: "string", description: "Phrase courte, factuelle, en francais. Max 500 caracteres." },
          category: {
            type: "string",
            enum: ["general", "client", "fournisseur", "salarie", "vehicule", "finance", "compta", "preference_user", "pattern"],
          },
          importance: { type: "integer", description: "1=mineur, 5=critique. Defaut 3." },
        },
        required: ["fact_text"],
      },
    },
    {
      name: "delete_memory_fact",
      description: "Supprime un fait memorise (par son id).",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_memory_facts",
      description: "Liste les faits memorises (filtre optionnel par categorie).",
      parameters: {
        type: "object",
        properties: { category: { type: "string" } },
      },
    },
  ],
}];
