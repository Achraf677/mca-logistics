/**
 * MCA Logistics — Stubs pour modules charges en lazy
 *
 * Cree au boot des stubs (placeholders) pour les fonctions des modules
 * dont le chargement est differe a la 1ere utilisation. A la premiere
 * invocation, le stub charge le module via lazy-loader.js puis appelle
 * la vraie fonction (qui a ecrase le stub au load).
 *
 * Modules differes :
 *  - script-exports.js : 27 fonctions, ~78 Ko, utilisees uniquement quand
 *    l'utilisateur clique sur un bouton Exporter (CSV/PDF).
 *
 * IMPORTANT : a charger APRES lazy-loader.js et AVANT script.js.
 */

(function () {
  'use strict';
  if (!window.lazyCreateStub) {
    console.warn('[lazy-stubs] lazyCreateStub non disponible (lazy-loader.js manquant ?)');
    return;
  }

  // ============================================================
  // Module : script-exports (27 fonctions exports)
  // ============================================================
  var EXPORTS_FUNCTIONS = [
    'exporterJournalAuditCSV',
    'fermerHeuresRapportsMenu',
    'toggleHeuresRapportsMenu',
    'exporterCSV',
    'exporterLivraisons',
    'exporterCharges',
    'genererRapportMensuel',
    'exporterHistoriqueFournisseursCSV',
    'genererRapportFournisseurs',
    'exporterRecapHeures',
    'genererRapportClients',
    'exporterHistoriqueClientsCSV',
    'exporterHistoriqueClientCourant',
    'exporterDonneesRGPDClientCourant',
    'exporterSauvegardeAdmin',
    'exporterChargesPDF',
    'exporterHeuresPDF',
    'exporterRecapHeuresPDF',
    'exporterPlanningPDF',
    'exporterVehiculesPDF',
    'exporterPlanningSemainePDF',
    'exporterReleveKmPDF',
    'exporterRapportHeuresEtKmPDF',
    'exporterTvaCSV',
    'exporterTvaPDF',
    'genererRapportMensuelPeriode',
    'exporterChargesPDFMois'
  ];

  EXPORTS_FUNCTIONS.forEach(function (fnName) {
    window[fnName] = window.lazyCreateStub('script-exports', fnName);
  });

  console.info('[lazy-stubs] ' + EXPORTS_FUNCTIONS.length + ' stubs exports prets');
})();
