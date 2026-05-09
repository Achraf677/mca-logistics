/**
 * MCA Logistics — Module Core-i18n
 *
 * Sprint H2.5 — Terminologie unifiee.
 * Constantes de libelles UI partagees PC <-> mobile pour eviter les divergences
 * (ex: "Salarié" vs "Chauffeur" vs "Salarié affecté"). Chaque cle reflete une
 * action ou un statut et doit etre utilisee a la place de la chaine en clair
 * dans les futurs ajouts.
 *
 * Regles :
 *  - "Chauffeur" : role au volant d'une livraison/vehicule precis.
 *  - "Salarié" : contexte RH global (heures, planning, absences, incidents RH).
 *  - "Encaisser" : action sur un revenu (livraison/facture).
 *  - "Payer" : action sur une depense (charge fournisseur).
 *  - "Régler" : BANNI (ambigu).
 *  - "Enregistrer" : submit par defaut (forms).
 *  - "Confirmer" : reserve aux dialogs de confirmation.
 *  - "Sauvegarder" / "Valider" : BANNIS cote UI (la fonction sauvegarder()
 *    JS interne reste, c'est une autre couche storage).
 *  - Statut paiement livraison : afficher "À payer" (et non "En attente" ni
 *    "À encaisser"). Valeur DB inchangee ("en-attente").
 *  - Conso : "L/100 km" (typo francaise avec espace).
 *
 * Charge AVANT script-mobile.js / script.js. Toutes les cles sont publiees
 * sur window.LABELS (scope global, pas de bundler).
 */

(function() {
  'use strict';

  var LABELS = {
    // Roles
    chauffeur: 'Chauffeur',
    chauffeurAffecte: 'Chauffeur affecté',
    chauffeurAttribue: 'Chauffeur attribué',
    salarie: 'Salarié',

    // Actions paiement
    encaisser: 'Encaisser',     // revenu (livraison/facture)
    payer: 'Payer',             // depense (charge)
    paye: 'Payé',
    aPayer: 'À payer',          // statut affiche partout pour paiement en attente

    // Submit
    enregistrer: 'Enregistrer',
    confirmer: 'Confirmer',
    annuler: 'Annuler',

    // Conso vehicule
    conso100km: 'L/100 km'
  };

  // Helper a utiliser dans les composants : retourne le libelle UI standardise
  // pour un statut paiement livraison brut (data value "en-attente"|"payé"|"litige").
  function libelleStatutPaiementLiv(statut) {
    if (statut === 'payé') return LABELS.paye;
    if (statut === 'litige') return 'Litige';
    return LABELS.aPayer; // "En attente" et tout le reste -> "À payer"
  }

  // Expose au scope global (pattern MCA, pas de modules ES).
  window.LABELS = LABELS;
  window.libelleStatutPaiementLiv = libelleStatutPaiementLiv;
})();
