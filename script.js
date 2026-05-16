/* =====================================================
   DelivPro — script.js  (v20 — full featured + bugfixes)
   ===================================================== */

/* ===== UTILITAIRES ===== */
// MOVED -> script-core-date-prototype-extensions.js : 

// BUG-012 fix : escape HTML/attribute centralisés — source unique de vérité pour prévenir XSS.
// Exposés sur window + fonctions nommées hoistées (disponibles dans tous les scopes IIFE/helpers).
// MOVED -> script-core-utils.js : escapeHtml
// MOVED -> script-core-utils.js : escapeAttr
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.escHtml = escapeHtml; // alias attendu par certains call sites existants

// BUG-009 fix : validateurs SIRET (Luhn) + IBAN (mod-97)
// MOVED -> script-core-valider-siret.js : validerSIRET

// Validation SIREN (9 chiffres, Luhn) — utilisée pour la validation inline du formulaire livraison
// MOVED -> script-clients.js : validerSIREN

// MOVED -> script-core-bug-014-double-click-guard.js : 

// BUG-029 fix : garde popup blocker — toute ouverture passe par ouvrirPopupSecure() qui détecte le blocage et notifie.
// Centralisation : un seul site à auditer si on change le message / le fallback.
// MOVED -> script-core-ui.js : ouvrirPopupSecure
window.ouvrirPopupSecure = ouvrirPopupSecure;

// MOVED -> script-core-bug-018-lifecycle-patches.js : 

// MOVED -> script-core-storage-patches.js : emettreEvenementStockageLocal + STORAGE_CACHE

// MOVED -> script-core-storage-readers.js : dupliquerValeurStockage + lireStockageJSON

// MOVED -> script-core-log-mca.js : logMCA

// MOVED -> script-core-storage.js : charger
// loadSafe : alias global pour JSON.parse résilient du localStorage.
// Usage : loadSafe('factures_emises', []) ou loadSafe('params', {}).
// Toujours préférer à loadSafe(..., []) qui crash sur corruption.
// MOVED -> script-core-storage.js : loadSafe
window.loadSafe = loadSafe;
window.lireStockageJSON = lireStockageJSON;
// MOVED -> script-core-storage.js : sauvegarder
// MOVED -> script-core-storage.js : chargerObj

// BUG-050 fix : purge défensive de données corrompues ou de test résiduelles en localStorage.
// Exécuté une seule fois au chargement du script, avant toute lecture métier.
(function purgerDonneesCorrompuesAuBoot() {
  try {
    if (typeof localStorage === 'undefined') return;
    const MARQUEURS_INVALIDES = ['xxxxxxxGAR', 'xxxxxxGAR', 'undefined', '[object Object]'];
    const CLES_JSON = [
      'factures_emises', 'livraisons', 'clients', 'fournisseurs',
      'vehicules', 'salaries', 'employes', 'charges', 'entretiens',
      'paiements', 'avoirs_emis',
      'cloture_ajustements', 'audit_log'
    ];
    let purges = 0;
    CLES_JSON.forEach(function (cle) {
      const raw = localStorage.getItem(cle);
      if (!raw) return;
      // Marqueurs de corruption connus (données de test DEMO non purgées)
      const contientMarqueur = MARQUEURS_INVALIDES.some(function (m) {
        return raw.indexOf(m) !== -1;
      });
      if (contientMarqueur) {
        console.warn('[MCA] Purge "' + cle + '" (données de test détectées).');
        localStorage.removeItem(cle);
        purges++;
        return;
      }
      // JSON invalide
      try { JSON.parse(raw); }
      catch (_) {
        console.warn('[MCA] Purge "' + cle + '" (JSON invalide).');
        localStorage.removeItem(cle);
        purges++;
      }
    });
    if (purges > 0) {
      console.info('[MCA] ' + purges + ' clé(s) de stockage corrompue(s) purgée(s).');
    }
  } catch (e) {
    console.warn('[MCA] Purge boot stockage : échec silencieux.', e);
  }
})();

// genId — identifiant unique. Préfère crypto.randomUUID() (RFC 4122 v4, collision ~0).
// Fallback getRandomValues pour 16 octets aléatoires, puis Math.random en dernier recours.
// MOVED -> script-core-utils.js : genId
window.genId = genId;
// MOVED -> script-core-date-money-utils.js : dateToLocalISO + aujourdhui + euros + round2 + hasNegativeNumber
// MOVED -> script-core-utils.js : formatKm
// MOVED -> script-core-utils.js : formatDateExport
// MOVED -> script-heures.js : formatDateHeureExport
// MOVED -> script-core-audit.js : getAuditActorLabel
// MOVED -> script-core-audit.js : ajouterEntreeAudit
// MOVED -> script-core-audit.js : afficherJournalAudit
// MOVED -> script-exports.js : exporterJournalAuditCSV
// MOVED -> script-core-audit.js : viderJournalAudit
// MOVED -> script-salaries.js : notifierSalarieSiAbsente
// MOVED -> script-core-entreprise-export-helpers.js : getEntrepriseExportParams + renderFactureMentionsEntrepriseHeader + renderFacturePiedMentionsLegales + renderBlocInfosEntreprise + renderFooterEntreprise
// MOVED -> script-core-branding.js : getLogoEntrepriseExportSrc
// MOVED -> script-core-branding.js : renderLogoEntrepriseExport

// MOVED -> script-tva.js : formaterTaux
// MOVED -> script-vehicules.js : getVehiculeById
// MOVED -> script-entretiens.js : getTypeEntretienLabel
// MOVED -> script-tva.js : getTauxDeductibiliteVehicule
// MOVED -> script-carburant.js : getTauxDeductibiliteCarburant
// MOVED -> script-entretiens.js : getTauxDeductibiliteEntretien

// MOVED -> script-tva.js : calculerMontantTVAFromHT

// MOVED -> script-tva.js : parseTauxTVAValue

// MOVED -> script-charges.js : getChargeMontantHT

// MOVED -> script-tva.js : getChargeMontantTVA

// MOVED -> script-tva.js : getChargeTauxDeductibilite

// MOVED -> script-carburant.js : getCarburantMontantHT

// MOVED -> script-carburant.js : getCarburantMontantTVA

// MOVED -> script-entretiens.js : getEntretienMontantHT

// MOVED -> script-entretiens.js : getEntretienMontantTVA

// MOVED -> script-core-date-range-utils.js : normaliserDateISO

// MOVED -> script-tva.js : getTVAConfig

// MOVED -> script-tva.js : getTVARegimeLabel

// MOVED -> script-tva.js : getTVAActiviteLabel

// BUG-011 : retrouve la fiche client liée à une livraison via clientId (priorité) ou nom (fallback).
// MOVED -> script-clients.js : trouverClientParLivraison

// BUG-011 : mention TVA légale (CGI art. 242 nonies A II) selon régime et client destinataire.
// Retourne le texte à afficher sur le PDF / facture HTML. Si taux > 0 et pas d'exonération, retourne "TVA <taux>%".
// MOVED -> script-tva.js : choisirMentionTVALegale

// MOVED -> script-tva.js : getTVAExigibiliteLabel

// MOVED -> script-tva.js : getTVAPeriodiciteLabel

// MOVED -> script-tva.js : getTVADefaultPeriodInput

// MOVED -> script-tva.js : getTVADeclarationPeriodKeyFromDate

// MOVED -> script-tva.js : getTVADeclarationPeriodRangeFromKey

// MOVED -> script-tva.js : getTVADeclarationPeriodLabel

// MOVED -> script-tva.js : normaliserTVAPeriodeKey

// MOVED -> script-tva.js : getTVAPeriodKeysForRange

// MOVED -> script-tva.js : getTVASettlementPeriodKey

// MOVED -> script-tva.js : getTVASettlementLabel

// MOVED -> script-tva.js : getLivraisonTVAOperationType

// MOVED -> script-tva.js : getLivraisonTVAExigibiliteDate

// MOVED -> script-tva.js : buildTVACollecteeEntryFromLivraison

// MOVED -> script-tva.js : buildTVACollecteeData

// MOVED -> script-tva.js : buildTVADeductibleEntries

// MOVED -> script-tva.js : buildTVASettlementEntries

// MOVED -> script-tva.js : getTVASummaryForRange


// MOVED -> script-vehicules.js : ouvrirFicheVehiculeDepuisTableau
// MOVED -> script-entretiens.js : getLabelVehiculeEntretien
// MOVED -> script-salaries.js : getSalarieVehicule
// MOVED -> script-stats.js : getSalarieStatsMois
// MOVED -> script-salaries.js : getSalarieConformiteBadges
// MOVED -> script-salaries.js : ouvrirLivraisonsSalarie
// MOVED -> script-planning.js : ouvrirPlanningSalarie
// MOVED -> script-heures.js : ouvrirHeuresSalarie
// MOVED -> script-planning.js : ouvrirPlanningRecurrence
// MOVED -> script-core-ui.js : fermerInlineDropdowns
// MOVED -> script-core-ui.js : positionnerInlineDropdown
// MOVED -> script-core-ui.js : buildInlineActionsDropdown
// MOVED -> script-core-ui.js : toggleInlineDropdown
// MOVED -> script-carburant.js : syncChargeCarburant
// MOVED -> script-carburant.js : removeChargeCarburant
// MOVED -> script-carburant.js : enrichirPleinCarburant
// MOVED -> script-core-utils.js : calculerDureeJour
// MOVED -> script-livraisons.js : getMontantHTLivraison

// MOVED -> script-livraisons.js : getLivraisonStatutPaiement
// MOVED -> script-carburant.js : getMontantHTCarburant
// MOVED -> script-entretiens.js : getMontantHTEntretien
// MOVED -> script-core-date-range-inclusive.js : getDateRangeInclusive
// MOVED -> script-core-branding.js : getLogoEntreprise
// MOVED -> script-core-auth.js : getDefaultAdminAccounts
// MOVED -> script-core-auth.js : adminCompteEstConfigureLocal
// MOVED -> script-core-auth.js : getAdminAccounts
// MOVED -> script-core-auth.js : saveAdminAccounts
// MOVED -> script-core-security-helpers.js : getSecurityHelper + evaluerQualiteMotDePasseFort + btoaUnicodeSafe
// MOVED -> script-core-auth.js : getAdminSession
// MOVED -> script-core-admin-edit-locks-init.js : ADMIN_EDIT_LOCKS_KEY + ADMIN_EDIT_LOCK_TTL_MS
// MOVED -> script-core-auth.js : fermerMenuAdmin
// MOVED -> script-exports.js : fermerHeuresRapportsMenu
// MOVED -> script-exports.js : toggleHeuresRapportsMenu
// MOVED -> script-core-auth.js : toggleAdminMenu
// MOVED -> script-core-auth.js : setBoutonDeconnexionAdminEtat
// MOVED -> script-core-auth.js : redirigerVersLoginAdmin
// MOVED -> script-core-auth.js : purgerSessionAdminLocale
// MOVED -> script-core-auth.js : deconnexionAdmin
// MOVED -> script-core-branding.js : appliquerBranding

// MOVED -> script-core-storage.js : getCompanyAssetsStorageHelper

// MOVED -> script-core-branding.js : sanitiserNomFichierLogo

// MOVED -> script-core-branding.js : getLogoEntreprisePath

// MOVED -> script-core-image-compress.js : compresserFichierImage + compresserImage

/* ===== HT / TVA / TTC — Calculs bidirectionnels ===== */
// MOVED -> script-core-utils.js : calculerTTCDepuisHT
// MOVED -> script-core-utils.js : calculerHTDepuisTTC

/* ===== THÈME MODE CLAIR / SOMBRE ===== */
// MOVED -> script-core-branding.js : initTheme

// MOVED -> script-core-branding.js : toggleTheme

/* ===== MODAL CONFIRMATION STYLÉE ===== */
let _confirmResolve = null;
// MOVED -> script-core-ui.js : confirmDialog
// MOVED -> script-core-ui.js : confirmResolve
// MOVED -> script-core-ui.js : confirmReject

// BUG-010 fix : promptDialog stylée (remplace window.prompt). DOM créé à la volée, focus trap via listeners locaux.
// MOVED -> script-core-ui.js : promptDialog
window.promptDialog = promptDialog;

/* ===== SCROLL TO TOP ===== */
// MOVED -> script-core-ui-helpers.js (Phase X.H) : initScrollTop

/* ===== NOM ENTREPRISE DANS TOPBAR ===== */
// MOVED -> script-core-storage.js : chargerNomEntreprise

// MOVED -> script-salaries.js : rafraichirDependancesSalaries

// MOVED -> script-vehicules.js : getVehiculeParSalId

// MOVED -> script-salaries.js : mettreAJourKmVehiculeParSalarie

// MOVED -> script-salaries.js : getSalarieNomComplet

// MOVED -> script-vehicules.js : getVehiculeKmsParLivraisons

// MOVED -> script-vehicules.js : getVehiculePlusHautKmSaisi

// MOVED -> script-vehicules.js : calculerKilometrageVehiculeActuel

// MOVED -> script-entretiens.js : getPilotageEntretienVehicule

// MOVED -> script-livraisons.js : synchroniserAffectationLivraison

// MOVED -> script-livraisons.js : peuplerSelectsLivraisonEdition

let config = chargerObj('config', { coutKmEstime: 0.20 });

/* ===== ALERTES ADMIN ===== */
// MOVED -> script-alertes.js : ajouterAlerte

// MOVED -> script-alertes.js : compterAlertesNonLues

// MOVED -> script-alertes.js : afficherBadgeAlertes

let derniereAlerteSynchroAdmin = '';
let warmupAdminPromise = null;
const FAST_BOOT_ROLE_KEY = 'delivpro_fast_boot_role';
const PAGE_SALARIE_UNIFIED = 'espace-salarie';
const TAB_AUTH_PENDING_KEY = 'delivpro_tab_auth_pending';

// MOVED -> script-core-auth.js : nettoyerSessionAppCourante

// MOVED -> script-core-ticket-acces-onglet.js : consommerTicketAccesOnglet

// MOVED -> script-core-auth.js : notifierMajAutreAdmin

// MOVED -> script-core-auth.js : lancerWarmupAdmin

// MOVED -> script-core-auth.js : getRoleSessionCourant

// MOVED -> script-core-storage.js : chargerCadreSalarieUnifie

// MOVED -> script-salaries.js : activerModeSalarieUnifie

// MOVED -> script-core-admin-bootstrap-domcontent.js : 

// MOVED -> script-core-navigation.js : naviguerVers

// MOVED -> script-core-garde-fou-routes.js : 

// MOVED -> script-core-libelles-analyse-ht.js : appliquerLibellesAnalyseHT

// MOVED -> script-planning.js : toggleAbsenceTypeFields

// MOVED -> script-planning.js : initFormulairePlanningRapide

// MOVED -> script-core-ui-helpers.js (Phase X.H) : ouvrirMenuMobile + fermerMenuMobile

/* ===== MODALS ===== */
// BUG-006 fix : a11y — role="dialog", aria-modal, focus trap, Échap pour fermer, restauration focus.
const MODAL_FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const __modalFocusStack = [];

// MOVED -> script-core-ui.js : __appliquerA11yModale

// MOVED -> script-core-ui.js : __modalTrapKeydown

// MOVED -> script-core-ui.js : openModal
// MOVED -> script-core-ui.js : closeModal
// MOVED -> script-core-modal-click-outside.js : 

// MOVED -> script-core-maj-selects.js : mettreAJourSelects

/* ===== LIVRAISONS ===== */
// MOVED -> script-livraisons.js : ajouterLivraison

// MOVED -> script-livraisons.js : viderFormulaireLivraison

const STORAGE_REFRESH_QUEUE = new Map();

// MOVED -> script-core-storage.js : planifierRafraichissementStorage

// MOVED -> script-core-livraison-form-init.js : 

// MOVED -> script-core-auth.js : getPageActiveAdminId

// MOVED -> script-livraisons.js : rafraichirVueLivraisonsActive

// MOVED -> script-heures.js : rafraichirVueHeuresEtKm

// MOVED -> script-planning.js : rafraichirVuePlanningAdmin

// MOVED -> script-core-navigation.js : planifierRafraichissementSiPageActive

// MOVED -> script-core-auth.js : gererChangementStorageAdmin

// MOVED -> script-core-synchro-storage-listeners.js : 

// MOVED -> script-livraisons.js : afficherLivraisons

// MOVED -> script-core-livraisons-statut-paiement.js : changerStatutPaiement

// MOVED -> script-livraisons.js : getLivraisonInlineSelectClass

// MOVED -> script-livraisons.js : styliserSelectLivraison

// MOVED -> script-livraisons.js : changerStatutLivraison

// MOVED -> script-livraisons.js : supprimerLivraison

// MOVED -> script-core-reset-filtres-livraisons.js : resetFiltres

// MOVED -> script-livraisons.js : appliquerFiltresDatesLivraisons

// MOVED -> script-rentabilite.js : alerteRentabilite

/* ===== CHAUFFEURS ===== */
// MOVED -> script-salaries.js : ajouterChauffeur

// MOVED -> script-salaries.js : afficherChauffeurs

// MOVED -> script-salaries.js : changerStatutChauffeur

// MOVED -> script-salaries.js : supprimerChauffeur

/* ===== VÉHICULES ===== */
// MOVED -> script-vehicules.js : lireFinanceVehiculeDepuisForm

// MOVED -> script-vehicules.js : hydraterFinanceVehiculeDansForm

// MOVED -> script-vehicules.js : reinitialiserFinanceVehiculeForm

// MOVED -> script-vehicules.js : resetModalVehiculeToCreateMode

// MOVED -> script-vehicules.js : mettreAJourFinContratVehicule

// MOVED -> script-vehicules.js : mettreAJourInfosVehiculeFinancement

// MOVED -> script-vehicules.js : mettreAJourFormulaireVehicule

// MOVED -> script-rentabilite.js : getVehiculeMensualiteRentabilite

// BUG-046 fix : TVA déductible sur carburant selon genre (CGI art. 298-4-1° et 298-4 D)
// - VP (voiture particulière) : 80 % diesel, 80 % essence depuis 2022
// - VU/CTTE/CAM/TRR (utilitaire, camionnette, camion, tracteur) : 100 % gazole/GPL/GNV, 100 % essence (depuis 2022)
// - Électrique (tout genre) : 100 % de l'électricité de recharge
// - REM/SREM (remorque, semi-remorque) : pas de carburant propre, 0 %
// MOVED -> script-carburant.js : calculerTauxTVACarburant
// MOVED -> script-carburant.js : ajusterTVACarburantSelonGenre
window.ajusterTVACarburantSelonGenre = ajusterTVACarburantSelonGenre;
window.calculerTauxTVACarburant = calculerTauxTVACarburant;

// MOVED -> script-vehicules.js : ajouterVehicule

// MOVED -> script-vehicules.js : afficherVehicules

/* Ajoute une alerte seulement si elle n'existe pas déjà (évite les doublons) */
// MOVED -> script-alertes.js : ajouterAlerteSiAbsente

let affectVehId = null;
// MOVED -> script-vehicules.js : ouvrirAffectationVehicule

// MOVED -> script-vehicules.js : confirmerAffectationVehicule

// MOVED -> script-vehicules.js : supprimerVehicule

/* ===== ENTRETIENS (dans page Véhicules — historique simplifié) ===== */
// MOVED -> script-entretiens.js : afficherEntretiensVehicules

/* ===== CARBURANT ===== */
// MOVED -> script-carburant.js : ajouterCarburant

// MOVED -> script-carburant.js : afficherCarburant

// MOVED -> script-carburant.js : resetFiltresCarburant

// MOVED -> script-carburant.js : supprimerCarburant

// MOVED -> script-core-toggle-menu-carb.js : toggleMenuCarbAdmin

// MOVED -> script-carburant.js : actionCarburant

// MOVED -> script-carburant.js : voirRecuCarburant

// MOVED -> script-core-misc-click-handlers.js : 

/* ===== RELEVÉS KM — ADMIN ===== */
// MOVED -> script-core-releve-km.js : afficherReleveKm

let _editKmSalId = null, _editKmId = null;
// MOVED -> script-core-auth.js : ouvrirEditKmAdmin

// MOVED -> script-core-auth.js : confirmerEditKmAdmin

// MOVED -> script-core-auth.js : supprimerKmAdmin

/* Met à jour le km de départ mémorisé pour la prochaine saisie */
/* mettreAJourKmReport supprimé — v12fix3 */


/* ===== ALERTES ADMIN ===== */
// MOVED -> script-alertes.js : afficherAlertes

// MOVED -> script-livraisons.js : ouvrirLivraisonPourPrix

// MOVED -> script-alertes.js : validerAlerte

// MOVED -> script-alertes.js : ignorerAlerte

// MOVED -> script-alertes.js : viderAlertes

// MOVED -> script-core-chart-helpers.js : ensureChartJs + mcaChartGradient + mcaChartBaseOptions + _chartJsPromise

// MOVED -> script-core-dashboard-rafraichir.js : rafraichirDashboard
// MOVED -> script-core-periodes.js : getSemaineDebut

/* ===== RENTABILITÉ ===== */
let chartRentab = null;
var _rentMoisOffset = 0;
// MOVED -> script-core-periodes.js : getRentMoisRange
// MOVED -> script-core-periodes.js : navRentMois
// MOVED -> script-rentabilite.js : afficherRentabilite

/* ===== RENTABILITÉ — Export PDF ===== */
// MOVED -> script-rentabilite.js : genererRentabilitePDF

/* ===== STATISTIQUES ===== */
let chartCA=null,chartChauff=null,chartVeh=null,chartCAParChauff=null;
// Fallback defensif : si script-core-stats-helpers.js n'a pas charge (race
// condition cache busting / SW stale), on attache un stub minimal sur window
// pour eviter la ReferenceError "buildSimplePeriodeState is not defined" qui
// casse tout l'init de script.js (Sentry x3, mai 2026). Le helper canonique
// reste dans script-core-stats-helpers.js. NB : les autres init de _xxxPeriode
// plus bas passent toutes par window.buildSimplePeriodeState pour beneficier
// du fallback ici aussi.
if (typeof window.buildSimplePeriodeState !== 'function') {
  window.buildSimplePeriodeState = function(defaultMode) {
    return { mode: defaultMode || 'mois', offset: 0 };
  };
}
var _statsPeriode = window.buildSimplePeriodeState('mois');
// MOVED -> script-stats.js : getStatsMoisRange
// MOVED -> script-stats.js : navStatsMois
// MOVED -> script-stats.js : changerVueStats
// MOVED -> script-stats.js : navStatsPeriode
// MOVED -> script-stats.js : reinitialiserStatsPeriode
// MOVED -> script-stats.js : afficherStatistiques

/* ===== PRÉVISIONS ===== */
let chartPrev=null;
// MOVED -> script-core-utils.js : calculerPrevision

/* ===== GESTION SALARIÉS ===== */
let accessSalarieTargetId=null, editSalarieId=null;

// MOVED -> script-salaries.js : toggleFormulaireNewSalarie

// MOVED -> script-core-password-utils.js : genererMotDePasseFort + evaluerQualiteMotDePasse

// MOVED -> script-salaries.js : mettreAJourQualiteMdpSalarie

// MOVED -> script-salaries.js : genererMotDePasseSalarie

// MOVED -> script-salaries.js : getStatutAccesSalarieLocal

// MOVED -> script-salaries.js : genererEmailTechniqueSalarie

// MOVED -> script-clients.js : getSupabaseClientSafe

// MOVED -> script-salaries.js : construirePayloadSupabaseSalarie

// MOVED -> script-salaries.js : synchroniserSalarieVersSupabase

// MOVED -> script-salaries.js : supprimerSalarieDansSupabase

// MOVED -> script-salaries.js : hydraterSalarieLocalDepuisSupabase

// MOVED -> script-salaries.js : notifierSynchroSalarie

// MOVED -> script-salaries.js : provisionnerAccesSalarie

// Upload documents salarié (permis / cni / iban / vitale / medecine).
// En mode création : stockage en window.__salDocsTemp[type]
// En mode édition : sauvegarde directe sur le salarié via window._editSalarieId
window.__salDocsTemp = {};
// Upload doc salarie : pousse vers Supabase Storage (bucket salaries-docs).
// Le storage_path est stocke dans salarie.docs[type] au lieu du base64.
// Multi-device natif : ce qu'un admin upload, l'autre admin le voit instantanement.
// MOVED -> script-salaries.js : uploaderDocSalarie

// Visualise un document salarié (PDF embed ou image).
// Pour Storage : download blob + objectURL (plus fiable que signed URL embed).
// MOVED -> script-salaries.js : visualiserDocSalarie

// MOVED -> script-salaries.js : creerSalarie

// MOVED -> script-salaries.js : afficherSalaries

// MOVED -> script-salaries.js : ouvrirEditSalarie

// MOVED -> script-salaries.js : confirmerEditSalarie

// MOVED -> script-salaries.js : ouvrirGestionAccesSalarie

// MOVED -> script-core-auth.js : confirmerResetMdp

// MOVED -> script-salaries.js : toggleActifSalarie

// MOVED -> script-salaries.js : supprimerSalarie

/* ===== UTILITAIRES AFFICHAGE ===== */
// MOVED -> script-core-badge-statut.js : badgeStatut
// MOVED -> script-salaries.js : badgeChauffeur
// MOVED -> script-core-audit.js : togglePanneauAgent

// MOVED -> script-core-audit.js : majBadgeAgent

// MOVED -> script-core-audit.js : ajouterDecisionAgent

// MOVED -> script-core-audit.js : afficherDecisionsAgent

// MOVED -> script-core-audit.js : executerActionAgent

// MOVED -> script-core-toast.js : afficherToast

/* ===== INSPECTIONS ===== */
const INSPECTION_STORAGE_RETENTION_DAYS = 60;
const INSPECTION_STORAGE_CLEANUP_KEY = 'delivpro_inspection_storage_cleanup_at';

// MOVED -> script-inspections.js : getInspectionStorageAdminHelper

// MOVED -> script-inspections.js : getInspectionPhotoList

// MOVED -> script-inspections.js : getInspectionPhotoThumb

// MOVED -> script-inspections.js : getInspectionPhotoFull

// MOVED -> script-inspections.js : isInspectionPhotoBase64

// MOVED -> script-inspections.js : getInspectionRemotePhotoPaths

// MOVED -> script-inspections.js : supprimerPhotosInspectionDepuisStorage

// MOVED -> script-inspections.js : getInspectionReferenceDate

// MOVED -> script-inspections.js : nettoyerPhotosInspectionsAnciennes

// MOVED -> script-inspections.js : afficherInspections

// MOVED -> script-inspections.js : ouvrirModalInspectionAdmin

// MOVED -> script-inspections.js : ajouterInspectionAdmin

let _adminPhotos = [];

// MOVED -> script-salaries.js : filtrerInspParSalarieInput
// MOVED -> script-inspections.js : supprimerInspectionAdmin

/* ===== ÉDITION LIVRAISON ADMIN ===== */
let _editLivId = null;
// MOVED -> script-livraisons.js : confirmerEditLivraison

/* ===== ÉDITION CARBURANT ADMIN ===== */
let _editCarbId = null;
// MOVED -> script-carburant.js : ouvrirEditCarburantAdmin

// MOVED -> script-carburant.js : confirmerEditCarburantAdmin

// MOVED -> script-core-auth.js : voirPhotoAdmin
// MOVED -> script-core-auth.js : changerPhotoAdmin

/* ===== MESSAGERIE ADMIN ===== */
let _msgSalarieActif = null;

// MOVED -> script-messages.js : afficherMessagerie

// MOVED -> script-messages.js : supprimerConversation

/* Broadcast — gestion cible par poste / sélection */
// MOVED -> script-messages.js : majBroadcastSelection

// MOVED -> script-messages.js : filtrerBroadcastSalaries

// MOVED -> script-messages.js : majBroadcastCount

// MOVED -> script-messages.js : getBroadcastDestinataires

// MOVED -> script-messages.js : ouvrirConversation

// Ouvre une photo message en grand (signed URL fraiche, 10 min)
// MOVED -> script-messages.js : ouvrirPhotoMessageAdmin

// MOVED -> script-messages.js : envoyerMessageAdmin

// MOVED -> script-messages.js : mettreAJourBadgeMsgAdmin

/* ===== PLANNING HEBDOMADAIRE ===== */
const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

// MOVED -> script-planning.js : afficherPlanning

// MOVED -> script-core-grille-jours-planning.js : genererGrilleJours

// MOVED -> script-planning.js : toggleJourPlanning

// MOVED -> script-planning.js : ouvrirModalPlanning

// MOVED -> script-planning.js : ouvrirEditPlanning

// BUG-008 fix : contrôles Règlement CE 561/2006 (temps de conduite).
// Alertes non bloquantes affichées après sauvegarde planning + audit.
// MOVED -> script-core-conformite-ce561.js : verifierConformiteConduiteCE561

// MOVED -> script-planning.js : sauvegarderPlanning

// MOVED -> script-planning.js : supprimerPlanning

/* ===== VUE KANBAN LIVRAISONS ===== */
let _vueLivraisons = 'tableau'; // 'tableau' | 'kanban' | 'calendrier'

// MOVED -> script-livraisons.js : changerVueLivraisons

// MOVED -> script-core-kanban.js : afficherKanban + dragKanban + dropKanban

// MOVED -> script-core-calendrier-livraisons.js : afficherCalendrier + filtrerCalJour

/* ===== DUPLICATION LIVRAISON ===== */
// MOVED -> script-livraisons.js : dupliquerLivraison

/* ===== RÉCURRENCE LIVRAISON ===== */
// MOVED -> script-carburant.js : ouvrirRecurrence

// MOVED -> script-carburant.js : confirmerRecurrence

/* ===== PAGINATION GÉNÉRIQUE ===== */
// MOVED -> script-core-pagination.js : nettoyerPagination + paginer

// MOVED -> script-core-empty-states.js : emptyState
// MOVED -> script-core-favicon-badge.js : majBadgeFavicon

// MOVED -> script-core-csv-secure.js : csvCelluleSecurisee

// MOVED -> script-exports.js : exporterCSV


// MOVED -> script-livraisons.js : getLivraisonsFiltresActifs

// MOVED -> script-livraisons.js : getLivraisonsPeriodeActiveLabel

// MOVED -> script-exports.js : exporterLivraisons

// MOVED -> script-exports.js : exporterCharges

// MOVED -> script-entretiens.js : exporterEntretiens

/* ===== RAPPORT MENSUEL PDF ===== */
// MOVED -> script-exports.js : genererRapportMensuel

/* ===== ACCUSÉ DE LECTURE MESSAGERIE ===== */
/* ===== GOOGLE MAPS — CALCUL DISTANCE AUTO ===== */
// MOVED -> script-core-utils.js : calculerDistanceMaps

/* ===== HT/TVA DANS LE TABLEAU LIVRAISONS ===== */
// MOVED -> script-core-utils.js : formatPrixAvecHT

/* ===== BADGES NAV — INCIDENTS + RELANCES ===== */
// MOVED -> script-core-navigation.js : mettreAJourBadgesNav

/* ===== TAUX DE PONCTUALITÉ ===== */
// MOVED -> script-core-utils.js : calculerPonctualite

// MOVED -> script-core-ponctualite-card.js : afficherPonctualite

/* ===== TABLEAU DE BORD CLIENT ENRICHI ===== */
// MOVED -> script-clients.js : afficherClientsDashboard

/* ===== TABLEAU DE BORD FOURNISSEUR (miroir Clients) ===== */
// MOVED -> script-fournisseurs.js : afficherFournisseursDashboard

// Bascule l'affichage des champs Pro pour la modal Fournisseur (miroir
// du toggleChampsClientPro). Un fournisseur peut être Particulier (artisan,
// auto-entrepreneur sans SIREN, etc.) — auquel cas on masque les champs Pro.
window.toggleChampsFournisseurPro = function(isEdit) {
  var prefix = isEdit ? 'edit-frn' : 'frn';
  var radios = document.getElementsByName(isEdit ? 'edit-frn-type' : 'frn-type');
  var type = 'pro';
  for (var i = 0; i < radios.length; i++) if (radios[i].checked) { type = radios[i].value; break; }
  var bloc = document.getElementById(prefix + '-champs-pro');
  if (bloc) bloc.classList.toggle('is-hidden', type !== 'pro');
};

// Reset complet du formulaire 'Nouveau Fournisseur' avant ouverture.
// Garantit un état initial propre (Pro coché, bloc Pro visible, champs vides).
// MOVED -> script-fournisseurs.js : resetFormulaireFournisseur

// MOVED -> script-fournisseurs.js : ajouterFournisseur

let _editFournisseurId = null;
// MOVED -> script-fournisseurs.js : ouvrirEditFournisseur

// MOVED -> script-fournisseurs.js : confirmerEditFournisseur

// MOVED -> script-fournisseurs.js : supprimerFournisseur

// MOVED -> script-exports.js : exporterHistoriqueFournisseursCSV

// MOVED -> script-exports.js : genererRapportFournisseurs

/* ===== CONGÉS / ABSENCES DANS LE PLANNING ===== */
// MOVED -> script-core-toggle-type-jour.js : toggleTypeJour

/* ===== VUE COMPACTE TABLES ===== */
// MOVED -> script-core-ui-helpers.js (Phase X.H) : _vueCompacte + toggleVueCompacte

// MOVED -> script-core-modeles-messages.js (Phase X.I) : MODELES_MESSAGES + afficherModelesMessages + utiliserModele + togglePanelModeles

/* ===== RH — COMPTEUR HEURES ===== */
// MOVED -> script-salaries.js : calculerHeuresSalarie

// MOVED -> script-core-heures-semaine-range.js : getHeuresSemaineRange

var _heuresVue = 'semaine';
var _heuresJourOffset = 0;
var _heuresMoisOffset = 0;
var _heuresAnneeOffset = 0;

// MOVED -> script-heures.js : getHeuresPeriodeRange

// MOVED -> script-planning.js : getPlanningPeriodForDate

// MOVED -> script-planning.js : planningGetVehicleForSalarie

// MOVED -> script-planning.js : planningGetLivraisonsForDate

// MOVED -> script-incidents.js : planningGetOpenIncidentsForSalarie

// MOVED -> script-inspections.js : planningGetInspectionForDate

// MOVED -> script-planning.js : planningGetIndisponibilitePourDate

// MOVED -> script-planning.js : planningOuvrirSaisieRapide

// MOVED -> script-planning.js : togglePlanningQuickPanel

// MOVED -> script-planning.js : planningCalculerRecapPeriode

// MOVED -> script-planning.js : ouvrirRecapPlanningPeriode

// MOVED -> script-planning.js : planningOuvrirFicheSalarie

// MOVED -> script-heures.js : construireContexteHeures

// MOVED -> script-planning.js : getPlanningPeriodLabel

// MOVED -> script-heures.js : majHeuresPeriodeLabel

// MOVED -> script-heures.js : changerVueHeures

// MOVED -> script-heures.js : naviguerHeuresPeriode

// MOVED -> script-heures.js : reinitialiserHeuresPeriode

// MOVED -> script-heures.js : calculerHeuresSalarieSemaine

// MOVED -> script-heures.js : afficherCompteurHeures

// MOVED -> script-heures.js : resetFiltresHeures

// MOVED -> script-exports.js : exporterRecapHeures

/* ===== RH — NOTE INTERNE SALARIÉ ===== */
// MOVED -> script-core-storage.js : charger_note_interne

// MOVED -> script-core-storage.js : chargerNoteInterne

// MOVED -> script-core-note-interne.js : ouvrirNoteInterne

// MOVED -> script-core-ui.js : confirmerNoteInterne

/* ===== FLOTTE — PHOTO VÉHICULE ===== */

// Upload carte grise PDF (ou image) — pousse vers Supabase Storage (bucket vehicules-cartes-grises).
// Le storage_path est stocke sur le vehicule au lieu du base64. Multi-device natif.
// MOVED -> script-vehicules.js : uploaderCarteGriseVehicule

// Wrapper appelé par l'input du formulaire véhicule (création + édition).
// - En édition (window._editVehId set) : upload immediat vers Storage
// - En création : stocke le file en temp jusqu'au save final (qui declenchera l'upload avec l'id genere)
// MOVED -> script-vehicules.js : uploaderCarteGriseFromForm

// Reset visuel du champ carte grise (appelé à l'ouverture de la modal Création
// ou au reset après save).
// MOVED -> script-vehicules.js : resetCarteGriseFormUI

// Affiche le fichier déjà uploadé dans le formulaire d'édition véhicule.
// MOVED -> script-vehicules.js : prefillCarteGriseFormUI

// Visualise la carte grise dans une nouvelle fenêtre/onglet.
// Pour les PDFs en Storage : download blob + object URL (plus fiable que embed signed URL).
// MOVED -> script-vehicules.js : visualiserCarteGrise

// Helper : affiche un document (PDF ou image) dans une nouvelle fenetre
// MOVED -> script-core-doc-viewer.js (Phase X.K) : afficherDocumentDansFenetre

/* ===== FLOTTE — HISTORIQUE CONDUCTEURS ===== */
// MOVED -> script-salaries.js : ouvrirHistoriqueConducteurs
// MOVED -> script-core-livraisons-helpers.js (Phase X.G) : enregistrerConduite

// MOVED -> script-salaries.js : afficherHistoriqueConducteurs

/* ===== MESSAGES AUTOMATIQUES BEST EFFORT ===== */
// MOVED -> script-messages.js : verifierMessagesAuto

/* Côté admin : vérifier si un salarié commence bientôt (H-15min) ou vient de finir (H+30min) */
// MOVED -> script-planning.js : verifierTriggersPlanningAuto

// Vérifier toutes les minutes (Phase 91.54.1 : skip si onglet pas visible)
// MOVED -> script-core-planning-auto-trigger-tick.js : 

/* ===== MOBILE — SWIPE SIDEBAR ===== */
// MOVED -> script-core-navigation.js : initSwipeSidebar

// MOVED -> script-core-pull-to-refresh.js (Phase X.F) : initPullToRefresh

/* ===== PIÈCES JOINTES MESSAGERIE ===== */
// MOVED -> script-messages.js : envoyerMessageAvecPhoto

// Helper : apres render d'un container avec messages, resoud les signed URLs
// pour les <img data-photo-path="..." data-photo-bucket="...">.
// MOVED -> script-core-storage.js : resolveStorageImages
window.resolveStorageImages = resolveStorageImages;

/* ===== SON / VIBRATION MESSAGES ===== */
/* ===== FICHE TOURNÉE JOURNALIÈRE PDF ===== */
// MOVED -> script-core-fiche-tournee.js (Phase X.J) : genererFicheTournee

/* ===== GOOGLE MAPS — DISTANCE AUTO ===== */
/* ===== VUE COMPACTE / ÉTENDUE ===== */
// MOVED -> script-core-densite-tableau.js : initDensiteTableau

// MOVED -> script-core-msg-templates.js : insererTemplate + MSG_TEMPLATES

// MOVED -> script-messages.js : afficherTemplatesMsg

/* ===== MESSAGES AUTOMATIQUES "BEST EFFORT" ===== */
// MOVED -> script-messages.js : verifierMessagesAutomatiques

/* ===== TAUX DE PONCTUALITÉ ===== */
// MOVED -> script-tva.js : calculerTauxPonctualite

/* ===== TABLEAU DE BORD CLIENTS ===== */
// MOVED -> script-clients.js : afficherTopClients

/* ===== SUIVI CONGÉS / ABSENCES ===== */
/* ===== BROADCAST MESSAGE ===== */
// MOVED -> script-messages.js : envoyerBroadcast

/* ===== ALERTES PERMIS / ASSURANCE ===== */
// MOVED -> script-salaries.js : verifierDocumentsSalaries

// MOVED -> script-core-notifications-auto.js : verifierNotificationsAutomatiquesMois2

/* ===== TEMPLATES SMS ===== */
// MOVED -> script-core-templates-sms.js (Phase X.B) : TEMPLATES_SMS, afficherTemplatesSMS, copierTemplateSMS

/* ===== RACCOURCIS CLAVIER ===== */
// MOVED -> script-core-keyboard-shortcuts.js : 

/* ===== RECHERCHE UNIVERSELLE ===== */
// MOVED -> script-core-recherche.js : ouvrirRechercheGlobale
// MOVED -> script-core-recherche.js : fermerRechercheGlobale
// MOVED -> script-livraisons.js : rechercheOuvrirLivraison
// MOVED -> script-clients.js : rechercheOuvrirClient
// MOVED -> script-core-recherche.js : rechercheUniverselle
// MOVED -> script-core-recherche.js : fermerRecherche

/* ===== CARNET CLIENTS ===== */
let _clientHistoryCurrentId = null;

// MOVED -> script-clients.js : getClientHistoriqueSnapshot

// MOVED -> script-exports.js : genererRapportClients

// MOVED -> script-exports.js : exporterHistoriqueClientsCSV

// MOVED -> script-clients.js : ouvrirHistoriqueClient

// MOVED -> script-exports.js : exporterHistoriqueClientCourant

// BUG-007 fix : RGPD art. 20 — droit à la portabilité. Export JSON structuré de toutes les données du client.
// MOVED -> script-clients.js : collecterDonneesRGPDClient

// MOVED -> script-exports.js : exporterDonneesRGPDClientCourant

// afficherClients : alias historique. La vraie fonction de rendu est
// afficherClientsDashboard (ligne ~7232). Ce wrapper évite de casser les
// nombreux appels existants tout en garantissant un seul code de rendu.
// MOVED -> script-clients.js : afficherClients

// Bascule l'affichage des champs Pro (SIREN, TVA, paiement, IBAN, Secteur,
// Email facturation) selon le type de client. Appelée par les radios cl-type.
window.toggleChampsClientPro = function(isEdit) {
  var prefix = isEdit ? 'edit-cl' : 'cl';
  var radios = document.getElementsByName(isEdit ? 'edit-cl-type' : 'cl-type');
  var type = 'pro';
  for (var i = 0; i < radios.length; i++) if (radios[i].checked) { type = radios[i].value; break; }
  var bloc = document.getElementById(prefix + '-champs-pro');
  if (bloc) bloc.classList.toggle('is-hidden', type !== 'pro');
  // Pour Particulier : vider le secteur (au cas où une ancienne valeur 'particulier' subsiste)
  var secteurEl = document.getElementById(prefix + '-secteur');
  if (secteurEl && type === 'particulier' && secteurEl.value === 'particulier') secteurEl.value = '';
};

// MOVED -> script-clients.js : ajouterClient

// MOVED -> script-clients.js : supprimerClient

// MOVED -> script-clients.js : preFillLivraisonClient

/* Auto-complétion client dans modal livraison + création à la volée */
// MOVED -> script-clients.js : autoCompleteClient

// Pré-remplit la modal Nouvelle livraison avec TOUTES les infos du client
// sélectionné (SIREN, TVA intracom, adresse, zone) et stocke son ID pour
// liaison fiable à la sauvegarde (sans dépendre du matching par nom).
// MOVED -> script-clients.js : selectionnerClientLivraisonParId

// Compat : ancienne signature (nom, adresse) — appelée encore depuis quelques
// endroits historiques. Délègue à la version par ID si possible.
// MOVED -> script-clients.js : selectionnerClientLivraison

// MOVED -> script-clients.js : ouvrirCreationClientDepuisLivraison

// MOVED -> script-core-copier-semaine-planning.js : copierSemainePrecedente

// MOVED -> script-core-timer-inactivite.js : resetTimerInactivite

/* ===== PARAMÈTRES ADMIN ===== */
// MOVED -> script-core-auth.js : toggleParamMdp

// MOVED -> script-core-auth.js : changerMdpAdmin

// MOVED -> script-core-storage.js : sauvegarderObjectifCA

// Valeurs par défaut MCA LOGISTICS (Statuts SAS signés 22/03/2026, PV désignation
// gestionnaire transport 17/04/2026, dossier DREAL 2026-15119). Utilisées uniquement
// si aucun paramètre n'a encore été saisi côté utilisateur.
const MCA_DEFAULTS_ENTREPRISE = {
  nom: 'MCA LOGISTICS',
  formeJuridique: 'SAS',
  capital: 7200,
  capitalLibere: 3600,
  adresse: '17 rue de la Chapelle',
  codePostal: '67540',
  ville: 'Ostwald',
  pays: 'FR',
  rcsVille: 'Strasbourg',
  drealDossier: '2026-15119',
  gestionnaireNom: 'Mohammed CHIKRI',
  banque: 'Qonto',
  delaiPaiementDefaut: 30,
  tauxPenalitesRetard: 10.15
};

// MOVED -> script-core-storage.js : chargerParametres

/* ===== GESTION DES POSTES ===== */
// MOVED -> script-core-postes.js (Phase X.A) : getPostes / afficherPostes / ajouterPoste /
//   supprimerPoste / majSelectsPostes

// MOVED -> script-core-storage.js : sauvegarderParametres

// MOVED -> script-core-branding.js : changerLogoEntreprise

// MOVED -> script-core-branding.js : supprimerLogoEntreprise

// MOVED -> script-tva.js : sauvegarderTVA

// MOVED -> script-tva.js : chargerConfigurationTVAParametres

// MOVED -> script-core-tresorerie-config.js : chargerConfigurationTresorerieParametres + sauvegarderConfigurationTresorerie

// MOVED -> script-livraisons.js : sauvegarderObjectifLivraisons

// MOVED -> script-core-storage.js : sauvegarderMaxTentatives

// MOVED -> script-paiements.js : sauvegarderRelanceDelai

// MOVED -> script-core-branding.js : appliquerAccentColor

// MOVED -> script-core-auth.js : majResumeSauvegardeAdmin

// MOVED -> script-core-auth.js : construireSauvegardeAdmin

// MOVED -> script-exports.js : exporterSauvegardeAdmin

// MOVED -> script-core-auth.js : importerSauvegardeAdmin

/* ===== HT / TVA ===== */
// MOVED -> script-core-prix-ht.js : prixHT
// MOVED -> script-tva.js : getTauxTVA
/* ===== SOLDE TRÉSORERIE ===== */
// MOVED -> script-core-utils.js : calculerSoldeTresorerie

/* ===== CATÉGORIES DE CHARGES ===== */
// MOVED -> script-charges.js : resetFormulaireCharge
// MOVED -> script-charges.js : ajusterCategorieCharge
// MOVED -> script-charges.js : ouvrirModalCharge
// MOVED -> script-charges.js : ouvrirEditCharge
// MOVED -> script-charges.js : resetFiltresCharges
// MOVED -> script-charges.js : afficherCharges

// MOVED -> script-charges.js : ajouterCharge

// MOVED -> script-charges.js : supprimerCharge

// MOVED -> script-exports.js : exporterChargesPDF

/* ===== RELANCE PAIEMENT ===== */
// MOVED -> script-paiements.js : getRelanceTemplatesDefaut

// MOVED -> script-paiements.js : chargerTemplatesRelance

// MOVED -> script-paiements.js : peuplerTemplatesRelance

// MOVED -> script-paiements.js : ouvrirModalTemplatesRelance

// MOVED -> script-paiements.js : sauvegarderTemplatesRelance

// MOVED -> script-paiements.js : reinitialiserTemplatesRelance

// MOVED -> script-paiements.js : construireTexteRelancePersonnalise

// MOVED -> script-paiements.js : afficherRelances

// MOVED -> script-core-livraisons-helpers.js (Phase X.G) : marquerPaye
// MOVED -> script-paiements.js : marquerRelance

/* ===== TCO VÉHICULE ===== */
// MOVED -> script-core-utils.js : calculerTCO

// MOVED -> script-core-tco-ui.js (Phase X.D) : afficherTCO

/* ===== CARNET ENTRETIEN DÉTAILLÉ ===== */
// MOVED -> script-entretiens.js : afficherEntretiens

// Auto-fill du km actuel quand on sélectionne un véhicule dans la modal Entretien
// (le user veut pouvoir modifier mais avoir le km actuel pré-rempli).
// Le champ 'Prochain entretien' reste vide intentionnellement.
// MOVED -> script-entretiens.js : autoFillKmEntretien

// MOVED -> script-entretiens.js : ouvrirModalEntretien

// MOVED -> script-entretiens.js : ajouterEntretien

// MOVED -> script-entretiens.js : ouvrirEditEntretien

// MOVED -> script-entretiens.js : confirmerEditEntretien

// MOVED -> script-entretiens.js : supprimerEntretien

/* ===== BLOCAGE COMPTE après X tentatives ===== */
/* ===== INCIDENTS / RÉCLAMATIONS ===== */
// MOVED -> script-incidents.js : afficherIncidents

// MOVED -> script-incidents.js : ajouterIncident

// MOVED -> script-incidents.js : changerStatutIncident

// MOVED -> script-incidents.js : supprimerIncident

/* ===== HISTORIQUE MODIFICATIONS LIVRAISON ===== */
// MOVED -> script-livraisons.js : logModifLivraison

// MOVED -> script-salaries.js : nettoyerHistoriqueModifsLivraisons

// MOVED -> script-salaries.js : afficherHistoriqueModifs

/* ===== COMMENTAIRES INTERNES LIVRAISON ===== */
// MOVED -> script-livraisons.js : ajouterCommentaireLiv

// MOVED -> script-livraisons.js : afficherCommentairesLiv

/* ===== BON DE LIVRAISON PDF ===== */
// MOVED -> script-livraisons.js : genererBonLivraison

// MOVED -> script-charges.js : chargerFacturesEmises

// MOVED -> script-core-storage.js : sauvegarderFacturesEmises

// MOVED -> script-core-livraisons-helpers.js (Phase X.G) : getAnneeFactureReference

// MOVED -> script-core-utils.js : formatNumeroFacture

// BUG-001 — compteur facture persistant par année (CGI art. 289)
// La séquence ne régresse jamais, même après suppression.
// MOVED -> script-core-livraisons-helpers.js (Phase X.G) : COMPTEURS_FACTURES_KEY + incrementerCompteurFactureAnnee

// MOVED -> script-livraisons.js : assurerArchiveFactureLivraison

// MOVED -> script-livraisons.js : annulerArchiveFactureLivraison

// MOVED -> script-livraisons.js : genererFactureLivraison

/* ============================================================
   Lettre de voiture — arrêté 09/11/1999 modifié + décret 2017-443
   + ADR 2025 chapitre 5.4 pour matières dangereuses
   Mentions obligatoires : date, nom+adresse expéditeur, nom+adresse
   destinataire, lieu+date chargement et déchargement, nature
   marchandise, poids brut, nombre de colis, prix transport, nom+
   immat transporteur, signatures.
   ============================================================ */
// MOVED -> script-core-lettre-voiture.js (Phase X.E) : genererLettreDeVoiture

/* ============================================================
   Registre des traitements RGPD — art. 30 UE 2016/679
   Production d'un document imprimable listant les traitements
   pré-configurés pour une entreprise transport + synthèse des
   données du responsable (nom, SIRET, adresse).
   ============================================================ */
// MOVED -> script-core-rgpd.js (Phase X.C) : genererRegistreRGPD

/* Auto-remplir le véhicule quand on choisit un salarié dans le modal livraison */
// MOVED -> script-vehicules.js : autoRemplirVehicule

// MOVED -> script-salaries.js : autoRemplirChauffeurDepuisVehicule

// MOVED -> script-vehicules.js : autoRemplirVehiculeEdit

// MOVED -> script-salaries.js : autoRemplirChauffeurDepuisVehiculeEdit

/* ===== MODIFIER CLIENT ===== */
let _editClientId = null;
// MOVED -> script-clients.js : ouvrirEditClient

// MOVED -> script-clients.js : confirmerEditClient

/* ===== EXPORT STATS PDF ===== */
// MOVED -> script-stats.js : exporterStatsPDF

/* ===== EXPORT HEURES PDF ===== */
// MOVED -> script-exports.js : exporterHeuresPDF

/* ===== MODIFIER VÉHICULE ===== */
// MOVED -> script-vehicules.js : ouvrirEditVehicule
window.ouvrirEditVehicule = ouvrirEditVehicule;

// MOVED -> script-vehicules.js : confirmerEditVehicule
window.confirmerEditVehicule = confirmerEditVehicule;

/* ===== ALIAS EXPORTS ===== */
// MOVED -> script-exports.js : exporterRecapHeuresPDF

/* ===== EXPORT PLANNING PDF ===== */
// MOVED -> script-exports.js : exporterPlanningPDF

/* ===== EXPORT ENTRETIENS PDF ===== */
// MOVED -> script-entretiens.js : exporterEntretiensPDF

/* ===== EXPORT VÉHICULES PDF ===== */
// MOVED -> script-exports.js : exporterVehiculesPDF

/* ===============================================
   AJOUTS v22+ — Fonctionnalités supplémentaires
   =============================================== */

/* ===== FORMAT PRIX COMPLET HT/TVA€/TTC ===== */
// MOVED -> script-core-utils.js : formatPrixComplet

/* ===== RELANCES — LETTRES PDF 3 NIVEAUX ===== */
// MOVED -> script-paiements.js : genererLettreRelance

/* ===== PLANNING — PÉRIODE ABSENCE ===== */
// MOVED -> script-planning.js : ajouterPeriodeAbsence

// MOVED -> script-planning.js : afficherAbsencesPeriodes

// MOVED -> script-planning.js : supprimerAbsencePeriode

/* ===== CHARGES → SYNCHRO ENTRETIEN ===== */
// MOVED -> script-entretiens.js : synchroChargeVersEntretien

/* ===== INCIDENTS — PEUPLER SELECT SALARIÉ ===== */
// MOVED -> script-incidents.js : peupleIncSalarie

/* ===== PEUPLER SELECT ABSENCE SAL ===== */
// MOVED -> script-planning.js : peuplerAbsenceSal

// MOVED -> script-planning.js : filtrerRechercheAbsence

// MOVED -> script-planning.js : peuplerSelectPlanningModal

// MOVED -> script-planning.js : filtrerRecherchePlanningModal

// MOVED -> script-heures.js : mettreAJourTotalHeuresPlanning

// MOVED -> script-planning.js : filtrerPlanningSemaine

/* ===============================================
   PLANNING SEMAINE — Navigation + Absences + PDF
   =============================================== */

var _planningSemaineOffset = 0; // 0 = semaine courante
var _planningPeriode = window.buildSimplePeriodeState('semaine');

// MOVED -> script-core-periodes.js : getLundiDeSemaine

// MOVED -> script-core-navigation.js : naviguerSemaine

// MOVED -> script-planning.js : changerVuePlanning

// MOVED -> script-planning.js : naviguerPlanningPeriode

// MOVED -> script-planning.js : reinitialiserPlanningPeriode

// MOVED -> script-planning.js : afficherPlanningSemaine

// MOVED -> script-core-periodes.js : getNumSemaine

/* ===== EXPORT PDF SEMAINE ===== */
// MOVED -> script-exports.js : exporterPlanningSemainePDF

/* ===============================================
   NAVIGATION PÉRIODE — Toutes les pages
   =============================================== */

// MOVED -> script-core-utils.js : formatPeriodeDateFr

// MOVED -> script-core-periodes.js : getStartOfWeek

// MOVED -> script-stats.js : buildSimplePeriodeState

// MOVED -> script-core-periodes.js : majPeriodeDisplay

// MOVED -> script-core-periodes.js : isDateInRange

/* --- LIVRAISONS : mois + semaine --- */
var _livPeriodeOffset = 0;
var _livPeriodeMode = 'mois';
var _livPeriodePersonnalisee = null;

// MOVED -> script-livraisons.js : syncLivPeriodeModeSelect

// MOVED -> script-livraisons.js : changerVuePeriodeLivraisons

// MOVED -> script-livraisons.js : navLivPeriode

// MOVED -> script-livraisons.js : reinitialiserLivPeriode

/* --- HEURES & KM : semaine --- */
var _heuresSemaineOffset = 0;
// MOVED -> script-heures.js : navHeuresSemaine
// MOVED -> script-heures.js : majHeuresSemaineLabel

/* --- INSPECTIONS / CHARGES / CARBURANT / ENTRETIENS --- */
var _inspPeriode = window.buildSimplePeriodeState('semaine');
var _chargesPeriode = window.buildSimplePeriodeState('mois');
var _carbPeriode = window.buildSimplePeriodeState('mois');
var _entrPeriode = window.buildSimplePeriodeState('mois');

// MOVED -> script-core-periodes.js : changeSimplePeriode

// MOVED -> script-core-periodes.js : navSimplePeriode

// MOVED -> script-core-periodes.js : resetSimplePeriode

// MOVED -> script-inspections.js : getInspectionsPeriodeRange
// MOVED -> script-inspections.js : changerVueInspections
// MOVED -> script-inspections.js : navInspectionsPeriode
// MOVED -> script-inspections.js : reinitialiserInspectionsPeriode
// MOVED -> script-core-periodes.js : navInspSemaine

// MOVED -> script-charges.js : getChargesPeriodeRange
// MOVED -> script-charges.js : changerVueCharges
// MOVED -> script-charges.js : navChargesPeriode
// MOVED -> script-charges.js : reinitialiserChargesPeriode
// MOVED -> script-charges.js : navChargesMois
// MOVED -> script-charges.js : getChargesMoisStr

// MOVED -> script-carburant.js : getCarburantPeriodeRange
// MOVED -> script-carburant.js : changerVueCarburant
// MOVED -> script-carburant.js : navCarburantPeriode
// MOVED -> script-carburant.js : reinitialiserCarburantPeriode
// MOVED -> script-core-periodes.js : navCarbMois
// MOVED -> script-core-periodes.js : getCarbMoisStr

// MOVED -> script-entretiens.js : getEntretiensPeriodeRange
// MOVED -> script-entretiens.js : changerVueEntretiens
// MOVED -> script-entretiens.js : navEntretiensPeriode
// MOVED -> script-entretiens.js : reinitialiserEntretiensPeriode
// MOVED -> script-core-periodes.js : navEntrMois
// MOVED -> script-core-periodes.js : getEntrMoisStr

/* --- Utilitaire getPeriodeRange --- */
// MOVED -> script-core-periodes.js : getPeriodeRange

/* --- EXPORT RELEVÉ KM PDF --- */
// MOVED -> script-exports.js : exporterReleveKmPDF

// MOVED -> script-exports.js : exporterRapportHeuresEtKmPDF

/* ===============================================
   ONGLET TVA — Récapitulatif mensuel
   =============================================== */

var _tvaPeriode = window.buildSimplePeriodeState('mois');
// MOVED -> script-tva.js : navTvaMois

// MOVED -> script-tva.js : getTvaMoisStr
// MOVED -> script-tva.js : getTvaPeriodeRange
// MOVED -> script-tva.js : changerVueTVA
// MOVED -> script-tva.js : navTvaPeriode
// MOVED -> script-tva.js : reinitialiserTVAPeriode

// MOVED -> script-tva.js : afficherTva

// MOVED -> script-tva.js : supprimerSourceDepuisTVA

// MOVED -> script-exports.js : exporterTvaCSV

/* === EXPORT TVA PDF === */
// MOVED -> script-exports.js : exporterTvaPDF

/* ===============================================
   CORRECTIONS & AJOUTS — Exports + Planning + Carburant
   =============================================== */

/* --- Livraisons export suit la période --- */
var _origGenererRapportMensuel = typeof genererRapportMensuel === 'function' ? genererRapportMensuel : null;
// MOVED -> script-exports.js : genererRapportMensuelPeriode

/* --- Charges export suit le mois navigué + HT/TVA/TTC --- */
var _origExporterChargesPDF = typeof exporterChargesPDF === 'function' ? exporterChargesPDF : null;
// MOVED -> script-exports.js : exporterChargesPDFMois

/* --- Carburant export PDF avec HT/TVA/TTC --- */
// MOVED -> script-carburant.js : exporterCarburantPDF
ajouterPeriodeAbsence = function() {
  var salId = document.getElementById('absence-sal') ? document.getElementById('absence-sal').value : '';
  var type = document.getElementById('absence-type') ? document.getElementById('absence-type').value : 'travail';
  var debut = document.getElementById('absence-debut') ? document.getElementById('absence-debut').value : '';
  var fin = document.getElementById('absence-fin') ? document.getElementById('absence-fin').value : '';
  var heureDebut = document.getElementById('absence-heure-debut') ? document.getElementById('absence-heure-debut').value : '';
  var heureFin = document.getElementById('absence-heure-fin') ? document.getElementById('absence-heure-fin').value : '';
  if (!salId || !debut || !fin) { afficherToast('⚠️ Salarié, date début et date fin obligatoires','error'); return; }
  if (fin < debut) { afficherToast('⚠️ La date de fin doit être après la date de début','error'); return; }
  if (type === 'travail') {
    if (!heureDebut || !heureFin) { afficherToast('⚠️ Renseignez les heures de travail','error'); return; }
    if (calculerDureeJour(heureDebut, heureFin) <= 0) { afficherToast('⚠️ Les heures de travail sont invalides','error'); return; }
    var plannings = loadSafe('plannings', []);
    var planIndex = plannings.findIndex(function(p){ return p.salId === salId; });
    var plan = planIndex > -1 ? plannings[planIndex] : { salId: salId, salNom: '', semaine: [] };
    var sal = charger('salaries').find(function(s){ return s.id === salId; });
    plan.salNom = sal ? sal.nom : (plan.salNom || '');
    plan.semaine = Array.isArray(plan.semaine) ? plan.semaine : [];
    getDateRangeInclusive(debut, fin).forEach(function(dateObj) {
      var dayIndex = (dateObj.getDay() + 6) % 7;
      var jourNom = JOURS[dayIndex];
      var jourIndex = plan.semaine.findIndex(function(j){ return j.jour === jourNom; });
      var jourData = { jour: jourNom, travaille: true, typeJour: 'travail', heureDebut: heureDebut, heureFin: heureFin };
      if (jourIndex > -1) plan.semaine[jourIndex] = { ...plan.semaine[jourIndex], ...jourData };
      else plan.semaine.push({ ...jourData, zone: '', note: '' });
    });
    plan.mis_a_jour = new Date().toISOString();
    if (planIndex > -1) plannings[planIndex] = plan;
    else plannings.push(plan);
    localStorage.setItem('plannings', JSON.stringify(plannings));
    ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    afficherPlanning();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('✅ Horaires de travail enregistrés');
    return;
  }
  var absences = loadSafe('absences_periodes', []);
  absences.push({ id: genId(), salId: salId, type: type, debut: debut, fin: fin, creeLe: new Date().toISOString() });
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  var typeLabel = type === 'conge' ? 'Congé' : type === 'maladie' ? 'Maladie' : 'Absence';
  afficherToast('✅ ' + typeLabel + ' du ' + debut + ' au ' + fin);
};

// MOVED -> script-core-admin-legacy-rentabilite-stats.js : afficherRentabilite + afficherStatistiques

// MOVED -> script-core-admin-legacy-planning-semaine.js : afficherPlanningSemaine
// MOVED -> script-core-admin-final-lock-iife.js : 
// MOVED -> script-core-admin-final-lock.js : ouvrirFenetreImpression + construireEnteteExport + peuplerAbsenceSal + filtrerRechercheAbsence + peuplerSelectPlanningModal + filtrerRecherchePlanningModal + badgePaiementLivraisonHtml + labelStatutLivraison + calculerPrevision

// MOVED -> script-core-admin-final-ux-exports.js : planningSyncSearchWithSelect + filtrerRechercheAbsence + filtrerRecherchePlanningModal + construireEnteteExport + badgePaiementLivraisonHtml + labelStatutLivraison + calculerPrevision

// MOVED -> script-core-planning-rewrite-final.js : toggleAbsenceTypeFields + peuplerAbsenceSal + filtrerRechercheAbsence + peuplerSelectPlanningModal + filtrerRecherchePlanningModal + mettreAJourTotalHeuresPlanning + toggleTypeJour + genererGrilleJours + ouvrirModalPlanning + ouvrirEditPlanning + sauvegarderPlanning + supprimerPlanning + copierSemainePrecedente + afficherPlanning + reinitialiserFormulairePlanningRapide + initFormulairePlanningRapide + ajouterPeriodeAbsence + afficherAbsencesPeriodes + editerPeriodeAbsence + supprimerAbsencePeriode + afficherPlanningSemaine + filtrerPlanningSemaine + exporterPlanningSemainePDF

/* ===== PLANNING REWRITE ===== */
// MOVED -> script-planning.js : planningBuildEmployeeLabel

// MOVED -> script-planning.js : planningFindEmployeeBySearch

// MOVED -> script-planning.js : planningEscapeHtml

// MOVED -> script-planning.js : planningDateToLocalISO

// MOVED -> script-core-planning-sync-search.js : planningSyncSearchWithSelect

// MOVED -> script-planning.js : planningResolveSelectedEmployee

// MOVED -> script-planning.js : planningRenderEmployeeSuggestions

// MOVED -> script-planning.js : planningRenderWeekState

// MOVED -> script-planning.js : planningGetWeekDates

// MOVED -> script-planning.js : planningBuildDateArray

// MOVED -> script-planning.js : planningGetDisplayedPeriod

// MOVED -> script-planning.js : reinitialiserFormulairePlanningRapide

toggleAbsenceTypeFields = function() {
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debutWrap = document.getElementById('absence-heure-debut-wrap');
  var finWrap = document.getElementById('absence-heure-fin-wrap');
  if (debutWrap) debutWrap.style.display = type === 'travail' ? '' : 'none';
  if (finWrap) finWrap.style.display = type === 'travail' ? '' : 'none';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  planningRenderEmployeeSuggestions('absence-sal-search', 'absence-sal', 'absence-sal-suggestions');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  planningRenderEmployeeSuggestions('plan-salarie-search', 'plan-salarie', 'plan-salarie-suggestions', function() {
    genererGrilleJours();
  });
  if (salarie) genererGrilleJours();
};

mettreAJourTotalHeuresPlanning = function() {
  var total = 0;
  var out = document.getElementById('plan-total-heures');
  JOURS.forEach(function(jour) {
    var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
    if (type !== 'travail') return;
    total += calculerDureeJour(
      document.getElementById('plan-debut-' + jour)?.value || '',
      document.getElementById('plan-fin-' + jour)?.value || ''
    );
  });
  if (out) out.textContent = total.toFixed(1) + ' h';
};

toggleTypeJour = function(jour) {
  var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
  var horaires = document.getElementById('plan-horaires-' + jour);
  if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
  mettreAJourTotalHeuresPlanning();
};

genererGrilleJours = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  var grid = document.getElementById('plan-jours-grid');
  if (!grid) return;
  if (!salarie) {
    grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
    mettreAJourTotalHeuresPlanning();
    return;
  }
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; }) || { semaine: [] };
  grid.innerHTML = JOURS.map(function(jour, index) {
    var data = (planning.semaine || []).find(function(item) { return item.jour === jour; }) || {};
    var typeJour = data.typeJour || (data.travaille ? 'travail' : 'repos');
    return '<div class="planning-day-editor">'
      + '<div class="planning-day-top"><div class="planning-day-title">' + JOURS_COURTS[index] + ' - ' + jour.charAt(0).toUpperCase() + jour.slice(1) + '</div>'
      + '<select id="plan-type-' + jour + '" onchange="toggleTypeJour(\'' + jour + '\')">'
      + '<option value="travail"' + (typeJour === 'travail' ? ' selected' : '') + '>Travail</option>'
      + '<option value="repos"' + (typeJour === 'repos' ? ' selected' : '') + '>Repos</option>'
      + '<option value="conge"' + (typeJour === 'conge' ? ' selected' : '') + '>Congé</option>'
      + '<option value="absence"' + (typeJour === 'absence' ? ' selected' : '') + '>Absence</option>'
      + '<option value="maladie"' + (typeJour === 'maladie' ? ' selected' : '') + '>Maladie</option>'
      + '</select></div>'
      + '<div class="planning-day-grid" id="plan-horaires-' + jour + '" style="display:' + (typeJour === 'travail' ? 'grid' : 'none') + '">'
      + '<div><label>Début</label><input type="time" id="plan-debut-' + jour + '" value="' + (data.heureDebut || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Fin</label><input type="time" id="plan-fin-' + jour + '" value="' + (data.heureFin || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Zone</label><input type="text" id="plan-zone-' + jour + '" value="' + ((data.zone || '').replace(/"/g, '&quot;')) + '" placeholder="Tournée, secteur..." /></div>'
      + '<div class="wide"><label>Note</label><input type="text" id="plan-note-' + jour + '" value="' + ((data.note || '').replace(/"/g, '&quot;')) + '" placeholder="Information utile..." /></div>'
      + '</div></div>';
  }).join('');
  mettreAJourTotalHeuresPlanning();
};

ouvrirModalPlanning = function() {
  // Restaure le titre par défaut 'Gérer les horaires' (ouvrirPlanningRecurrence
  // peut le surcharger avec 'Horaires récurrents' avant nous → on reset ici)
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle && !modalTitle.dataset.recurrent) modalTitle.textContent = 'Gérer les horaires';
  peuplerSelectPlanningModal();
  var search = document.getElementById('plan-salarie-search');
  var select = document.getElementById('plan-salarie');
  var grid = document.getElementById('plan-jours-grid');
  if (search) search.value = '';
  if (select) select.value = '';
  if (grid) grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
  mettreAJourTotalHeuresPlanning();
  openModal('modal-planning');
};

ouvrirEditPlanning = function(salId) {
  peuplerSelectPlanningModal();
  var select = document.getElementById('plan-salarie');
  var search = document.getElementById('plan-salarie-search');
  var salarie = charger('salaries').find(function(s) { return s.id === salId; });
  if (select) select.value = salId;
  if (search && salarie) search.value = planningBuildEmployeeLabel(salarie);
  genererGrilleJours();
  openModal('modal-planning');
};

sauvegarderPlanning = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!salarie) {
    afficherToast('Choisis un salarié', 'error');
    return;
  }
  var planning = {
    salId: salarie.id,
    salNom: salarie.nom || '',
    semaine: JOURS.map(function(jour) {
      var typeJour = document.getElementById('plan-type-' + jour)?.value || 'repos';
      return {
        jour: jour,
        travaille: typeJour === 'travail',
        typeJour: typeJour,
        heureDebut: typeJour === 'travail' ? (document.getElementById('plan-debut-' + jour)?.value || '') : '',
        heureFin: typeJour === 'travail' ? (document.getElementById('plan-fin-' + jour)?.value || '') : '',
        zone: typeJour === 'travail' ? (document.getElementById('plan-zone-' + jour)?.value || '') : '',
        note: typeJour === 'travail' ? (document.getElementById('plan-note-' + jour)?.value || '') : ''
      };
    }),
    mis_a_jour: new Date().toISOString()
  };
  for (var i = 0; i < planning.semaine.length; i++) {
    var jour = planning.semaine[i];
    if (jour.typeJour === 'travail' && jour.heureDebut && jour.heureFin && calculerDureeJour(jour.heureDebut, jour.heureFin) <= 0) {
      afficherToast('Certaines heures sont invalides', 'error');
      return;
    }
  }
  var plannings = charger('plannings');
  var index = plannings.findIndex(function(item) { return item.salId === salarie.id; });
  if (index > -1) plannings[index] = planning;
  else plannings.push(planning);
  sauvegarder('plannings', plannings);
  closeModal('modal-planning');
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning enregistré');
};

supprimerPlanning = async function(salId) {
  var ok = await confirmDialog('Supprimer le planning hebdomadaire de ce salarié ?', { titre:'Supprimer le planning', icone:'📅', btnLabel:'Supprimer' });
  if (!ok) return;
  sauvegarder('plannings', charger('plannings').filter(function(p) { return p.salId !== salId; }));
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning supprimé');
};

copierSemainePrecedente = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!salarie) {
    afficherToast('Choisis un salarié', 'error');
    return;
  }
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; });
  if (!planning || !Array.isArray(planning.semaine) || !planning.semaine.length) {
    afficherToast('Aucun planning existant à copier', 'error');
    return;
  }
  genererGrilleJours();
};

afficherPlanning = function() {
  peuplerSelectPlanningModal();
};

initFormulairePlanningRapide = function() {
  peuplerAbsenceSal();
  var btn = document.getElementById('planning-submit-btn');
  if (btn && !document.getElementById('absence-edit-id')?.value) btn.textContent = '+ Enregistrer';
  var editBtn = document.getElementById('planning-edit-work-btn');
  if (editBtn) editBtn.textContent = 'Modifier les horaires';
  toggleAbsenceTypeFields();
};

ouvrirEditionTravailRapide = function() {
  var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!salarie) {
    afficherToast('Choisis un salarié à modifier', 'error');
    return;
  }
  ouvrirEditPlanning(salarie.id);
};

ajouterPeriodeAbsence = function() {
  var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debut = document.getElementById('absence-debut')?.value || '';
  var fin = document.getElementById('absence-fin')?.value || '';
  var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
  var heureFin = document.getElementById('absence-heure-fin')?.value || '';
  var editId = document.getElementById('absence-edit-id')?.value || '';
  if (!salarie || !debut || !fin) {
    afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
    return;
  }
  if (fin < debut) {
    afficherToast('La date de fin doit être postérieure à la date de début', 'error');
    return;
  }
  if (type === 'travail') {
    if (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0) {
      afficherToast('Renseigne des horaires de travail valides', 'error');
      return;
    }
    var periodesTravail = charger('absences_periodes');
    var payloadTravail = {
      id: editId || genId(),
      salId: salarie.id,
      salNom: salarie.nom || '',
      type: 'travail',
      debut: debut,
      fin: fin,
      heureDebut: heureDebut,
      heureFin: heureFin,
      creeLe: editId ? (periodesTravail.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };
    var indexTravail = periodesTravail.findIndex(function(a) { return a.id === payloadTravail.id; });
    if (indexTravail > -1) periodesTravail[indexTravail] = payloadTravail;
    else periodesTravail.push(payloadTravail);
    sauvegarder('absences_periodes', periodesTravail);
    reinitialiserFormulairePlanningRapide();
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast(editId ? 'Créneau de travail mis à jour' : 'Créneau de travail enregistré');
    return;
  }

  var absences = charger('absences_periodes');
  var payload = {
    id: editId || genId(),
    salId: salarie.id,
    salNom: salarie.nom || '',
    type: type,
    debut: debut,
    fin: fin,
    creeLe: editId ? (absences.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
    modifieLe: new Date().toISOString()
  };
  var indexAbs = absences.findIndex(function(a) { return a.id === payload.id; });
  if (indexAbs > -1) absences[indexAbs] = payload;
  else absences.push(payload);
  sauvegarder('absences_periodes', absences);
  reinitialiserFormulairePlanningRapide();
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast(editId ? 'Période mise à jour' : 'Période enregistrée');
};

afficherAbsencesPeriodes = function() {
  var container = document.getElementById('liste-absences-periodes');
  if (!container) return;
  var salaries = charger('salaries');
  var colors = { travail:'#2ecc71', repos:'#6b7280', conge:'#3498db', maladie:'#9b59b6', absence:'#f39c12' };
  var labels = { travail:'Travail', repos:'Repos', conge:'Congé', maladie:'Maladie', absence:'Absence' };
  var absences = charger('absences_periodes').sort(function(a, b) {
    return new Date(b.debut) - new Date(a.debut);
  });
  if (!absences.length) {
    container.innerHTML = '<div class="planning-empty-note">Aucune période enregistrée.</div>';
    return;
  }
  container.innerHTML = absences.map(function(absence) {
    var salarie = salaries.find(function(s) { return s.id === absence.salId; });
    var labelSal = planningBuildEmployeeLabel(salarie || { nom: absence.salNom || 'Salarié supprimé' });
    return '<div class="planning-period-item">'
      + '<span class="planning-period-dot" style="background:' + (colors[absence.type] || '#f39c12') + '"></span>'
      + '<div class="planning-period-content">'
      + '<div class="planning-period-title">' + (labels[absence.type] || 'Période') + ' - ' + labelSal + '</div>'
      + '<div class="planning-period-meta">Du ' + formatDateExport(absence.debut) + ' au ' + formatDateExport(absence.fin) + (absence.type === 'travail' && absence.heureDebut && absence.heureFin ? ' · ' + absence.heureDebut + ' - ' + absence.heureFin : '') + '</div>'
      + '</div>'
      + '<div class="planning-period-actions">'
      + '<button type="button" onclick="editerPeriodeAbsence(\'' + absence.id + '\')">Modifier</button>'
      + '<button type="button" class="danger" onclick="supprimerAbsencePeriode(\'' + absence.id + '\')">Supprimer</button>'
      + '</div></div>';
  }).join('');
};

editerPeriodeAbsence = function(id) {
  var absence = charger('absences_periodes').find(function(a) { return a.id === id; });
  if (!absence) return;
  peuplerAbsenceSal();
  var salarie = charger('salaries').find(function(s) { return s.id === absence.salId; });
  var editInput = document.getElementById('absence-edit-id');
  var search = document.getElementById('absence-sal-search');
  var select = document.getElementById('absence-sal');
  var type = document.getElementById('absence-type');
  var debut = document.getElementById('absence-debut');
  var fin = document.getElementById('absence-fin');
  var heureDebut = document.getElementById('absence-heure-debut');
  var heureFin = document.getElementById('absence-heure-fin');
  var btn = document.getElementById('planning-submit-btn');
  if (editInput) editInput.value = absence.id;
  if (search && salarie) search.value = planningBuildEmployeeLabel(salarie);
  if (select) select.value = absence.salId;
  if (type) type.value = absence.type;
  if (debut) debut.value = absence.debut;
  if (fin) fin.value = absence.fin;
  if (heureDebut) heureDebut.value = absence.heureDebut || '';
  if (heureFin) heureFin.value = absence.heureFin || '';
  if (btn) btn.textContent = 'Mettre à jour';
  toggleAbsenceTypeFields();
};

supprimerAbsencePeriode = async function(id) {
  var ok = await confirmDialog('Supprimer cette période ?', { titre:'Supprimer la période', icone:'📅', btnLabel:'Supprimer' });
  if (!ok) return;
  sauvegarder('absences_periodes', charger('absences_periodes').filter(function(a) { return a.id !== id; }));
  if (document.getElementById('absence-edit-id')?.value === id) reinitialiserFormulairePlanningRapide();
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Période supprimée');
};

afficherPlanningSemaine = function() {
  initFormulairePlanningRapide();
  var week = planningGetWeekDates();
  var salaries = charger('salaries');
  var plannings = charger('plannings');
  var absences = charger('absences_periodes');
  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var label = document.getElementById('planning-semaine-label');
  var datesLabel = document.getElementById('planning-semaine-dates');
  var thead = document.getElementById('thead-planning-semaine');
  var tbody = document.getElementById('tb-planning-semaine');
  if (label) label.textContent = 'Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear();
  if (datesLabel) datesLabel.textContent = formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + week.dates.map(function(dateObj, index) {
      var isToday = dateToLocalISO(dateObj) === aujourdhui();
      return '<th style="text-align:center;' + (isToday ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[index].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>';
    }).join('') + '</tr>';
  }
  if (!tbody) return;
  if (!salaries.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>';
    return;
  }
  var filtered = salaries.filter(function(salarie) {
    if (!filtre) return true;
    return [
      planningBuildEmployeeLabel(salarie),
      salarie.nom,
      salarie.prenom,
      salarie.numero,
      salarie.poste
    ].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });
  var totalPlanifies = 0;
  var totalAbsences = 0;
  tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var hasWork = false;
    var cells = week.dates.map(function(dateObj, index) {
      var dateStr = planningDateToLocalISO(dateObj);
      var periode = getPlanningPeriodForDate(salarie.id, dateStr, absences);
      if (periode) {
        if (periode.type === 'travail') {
          hasWork = true;
          return planningRenderWeekState('is-work', 'Travail', (periode.heureDebut || '') + (periode.heureFin ? ' - ' + periode.heureFin : ''), '');
        }
        if (periode.type !== 'repos') totalAbsences += 1;
        return planningRenderWeekState('is-' + periode.type, getPlanningPeriodLabel(periode.type), '', '');
      }
      var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[index]; }) || null;
      if (!jour) return planningRenderWeekState('is-rest', 'Repos', '', '');
      if (jour.typeJour === 'travail' && jour.travaille) {
        hasWork = true;
        return planningRenderWeekState('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || jour.note || '');
      }
      if (jour.typeJour === 'conge' || jour.typeJour === 'absence' || jour.typeJour === 'maladie') {
        return planningRenderWeekState('is-' + jour.typeJour, jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence', '', '');
      }
      return planningRenderWeekState('is-rest', 'Repos', '', '');
    }).join('');
    if (hasWork) totalPlanifies += 1;
    return '<tr>'
      + '<td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>'
      + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '')
      + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '')
      + '</div></td>'
      + cells
      + '</tr>';
  }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
  var kpiSal = document.getElementById('planning-kpi-salaries');
  var kpiPlan = document.getElementById('planning-kpi-planifies');
  var kpiAbs = document.getElementById('planning-kpi-absences');
  if (kpiSal) kpiSal.textContent = salaries.length;
  if (kpiPlan) kpiPlan.textContent = totalPlanifies;
  if (kpiAbs) kpiAbs.textContent = totalAbsences;
  afficherAbsencesPeriodes();
};

filtrerPlanningSemaine = function() {
  afficherPlanningSemaine();
};

exporterPlanningSemainePDF = function() {
  var week = planningGetWeekDates();
  var salaries = charger('salaries');
  var plannings = charger('plannings');
  var absences = charger('absences_periodes');
  var params = getEntrepriseExportParams();
  var dateExp = formatDateHeureExport();
  var titreSemaine = 'Semaine ' + getNumSemaine(week.lundi) + ' — ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
  var stateStyles = {
    travail: { bg:'#e9f8ef', border:'#b7e7c8', color:'#177245', label:'Travail' },
    repos: { bg:'#f4f5f7', border:'#d7dbe2', color:'#6b7280', label:'Repos' },
    conge: { bg:'#eaf3ff', border:'#c7defd', color:'#3498db', label:'Congé' },
    maladie: { bg:'#f4edff', border:'#dcc8fa', color:'#9b59b6', label:'Maladie' },
    absence: { bg:'#fdeeee', border:'#f7c7c7', color:'#e74c3c', label:'Absence' }
  };
  var getStateBlockStyle = function(style, extra) {
    return 'min-height:56px;display:flex;align-items:center;justify-content:center;padding:8px 6px;border-radius:12px;background:' + style.bg + ';border:1px solid ' + style.border + ';color:' + style.color + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;' + (extra || '');
  };
  var formatCellulePlanning = function(salarie, dateObj, dayIndex, planning) {
    var dateStr = dateToLocalISO(dateObj);
    var periode = getPlanningPeriodForDate(salarie.id, dateStr, absences);
    if (periode) {
      if (periode.type === 'travail') {
        var periodeStyle = stateStyles.travail;
        var horairePeriode = (periode.heureDebut || '') + (periode.heureFin ? ' - ' + periode.heureFin : '');
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodeStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">' + periodeStyle.label + '</span><span style="font-size:.76rem;font-weight:600">' + horairePeriode + '</span></div></td>';
      }
      var absStyle = stateStyles[periode.type] || stateStyles.absence;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(absStyle, 'font-size:.78rem;font-weight:700') + '">' + absStyle.label + '</div></td>';
    }
    var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[dayIndex]; });
    if (!jour) {
      var restStyle = stateStyles.repos;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(restStyle, 'font-size:.78rem') + '">Repos</div></td>';
    }
    if (jour.typeJour === 'travail' && jour.travaille) {
      var workStyle = stateStyles.travail;
      var horaire = (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : '');
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(workStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">' + workStyle.label + '</span><span style="font-size:.76rem;font-weight:600">' + horaire + '</span></div></td>';
    }
    var state = stateStyles[jour.typeJour] || stateStyles.repos;
    return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(state, 'font-size:.78rem;font-weight:700') + '">' + state.label + '</div></td>';
  };
  var rows = salaries.map(function(salarie, index) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var cells = week.dates.map(function(dateObj, dayIndex) {
      return formatCellulePlanning(salarie, dateObj, dayIndex, planning);
    }).join('');
    return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + '">'
      + '<td style="padding:10px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;min-width:170px">' + (salarie.nom || '') + (salarie.numero ? '<br><span style="font-size:.75rem;color:#6b7280">#' + salarie.numero + '</span>' : '') + (salarie.poste ? '<br><span style="font-size:.74rem;color:#9ca3af">' + salarie.poste + '</span>' : '') + '</td>'
      + cells + '</tr>';
  }).join('');
  var thead = week.dates.map(function(dateObj, dayIndex) {
    return '<th style="padding:10px 8px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #dfe3ea;min-width:92px">' + JOURS_COURTS[dayIndex] + '<div style="font-size:.76rem;color:#9ca3af;margin-top:2px">' + formatDateExport(dateObj).slice(0, 5) + '</div></th>';
  }).join('');
  var html = '<style>@page{size:landscape;margin:10mm}body,table,thead,tbody,tr,th,td,div,span{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}</style><div style="font-family:Segoe UI,Arial,sans-serif;width:100%;padding:22px 24px;color:#1a1d27;box-sizing:border-box">'
    + construireEnteteExport(params, 'Planning hebdomadaire', titreSemaine, dateExp)
    + renderBlocInfosEntreprise(params)
    + '<div style="margin:0 0 16px;font-size:.88rem;color:#4b5563">Période : <strong>' + formatDateExport(week.lundi) + '</strong> au <strong>' + formatDateExport(week.dimanche) + '</strong></div>'
    + '<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;table-layout:fixed"><thead><tr style="background:#f3f4f6"><th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;border-bottom:1px solid #dfe3ea;min-width:170px">Salarié</th>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
    + '</div>';
  ouvrirFenetreImpression('Planning ' + titreSemaine, html, 'width=1200,height=780');
  afficherToast('Rapport planning généré');
};

validerLivraisonLivree = async function(id) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return false;
  var ok = await confirmDialog('Confirmer cette livraison comme livrée ?', { titre:'Marquer livrée', icone:'📦', btnLabel:'Confirmer', danger:false });
  if (!ok) return false;
  livraisons[idx].statut = 'livre';
  livraisons[idx].dateLivraison = new Date().toISOString();
  sauvegarder('livraisons', livraisons);
  afficherLivraisons();
  rafraichirDashboard();
  afficherToast('Livraison marquée comme livrée');
  return true;
};

validerLivraisonPayee = async function(id) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return false;
  var liv = livraisons[idx];
  var msg = liv.statut !== 'livre'
    ? 'Marquer cette livraison comme payée ?\n(le statut de livraison reste inchangé)'
    : 'Confirmer cette livraison comme payée ?';
  var ok = await confirmDialog(msg, { titre:'Marquer payée', icone:'💳', btnLabel:'Encaisser', danger:false });
  if (!ok) return false;
  liv.statutPaiement = 'payé';
  liv.datePaiement = new Date().toISOString();
  sauvegarder('livraisons', livraisons);
  afficherLivraisons();
  rafraichirDashboard();
  afficherRelances();
  afficherToast('Livraison marquée comme payée');
  return true;
};

changerStatutPaiement = async function(id, statut, selectEl) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return;
  var ancienStatut = livraisons[idx].statutPaiement || 'en-attente';
  var ok = false;
  if (statut === 'payé') {
    ok = await validerLivraisonPayee(id);
  } else if (statut === 'en-attente') {
    ok = await confirmDialog('Remettre le paiement en attente ?', { titre:'Paiement', icone:'💳', btnLabel:'Confirmer', danger:false });
    if (ok) {
      livraisons[idx].statutPaiement = statut;
      delete livraisons[idx].datePaiement;
      sauvegarder('livraisons', livraisons);
      afficherLivraisons();
      afficherRelances();
      afficherToast('Paiement mis à jour');
    }
  } else {
    livraisons[idx].statutPaiement = statut;
    sauvegarder('livraisons', livraisons);
    afficherLivraisons();
    afficherRelances();
    afficherToast('Paiement mis à jour');
    ok = true;
  }
  // Si l'utilisateur a annulé la modal, restaurer la valeur du select
  if (!ok && selectEl) selectEl.value = ancienStatut;
};

changerStatutLivraison = async function(id, statut, selectEl) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return;
  var ancienStatut = livraisons[idx].statut || 'en-attente';
  var ok = false;
  if (statut === 'livre') {
    ok = await validerLivraisonLivree(id);
  } else {
    ok = await confirmDialog('Mettre à jour le statut de cette livraison ?', { titre:'Statut livraison', icone:'📦', btnLabel:'Confirmer', danger:false });
    if (ok) {
      livraisons[idx].statut = statut;
      delete livraisons[idx].dateLivraison;
      // Découplage : ne plus reset statutPaiement quand on remet en-cours/en-attente
      sauvegarder('livraisons', livraisons);
      afficherLivraisons();
      rafraichirDashboard();
      afficherToast('Statut livraison mis à jour');
    }
  }
  // Si annulé, restaurer le select
  if (!ok && selectEl) selectEl.value = ancienStatut;
};

/* H2.1 — réassignement supprimé : `afficherLivraisons` (script-livraisons.js)
   délègue déjà à `window.renderLivraisonsAdminFinal` via lookup dynamique,
   donc inutile de la rebinder ici. Évite les collisions en chaîne. */

peuplerAbsenceSal = function() {
  var sel = document.getElementById('absence-sal');
  var datalist = document.getElementById('absence-sal-datalist');
  var search = document.getElementById('absence-sal-search');
  var salaries = charger('salaries');
  if (sel) {
    var currentValue = sel.value;
    sel.innerHTML = '<option value="">-- Choisir --</option>';
    salaries.forEach(function(s) {
      var label = s.nom + (s.poste ? ' - ' + s.poste : '') + (s.numero ? ' (' + s.numero + ')' : '');
      sel.innerHTML += '<option value="' + s.id + '">' + label + '</option>';
    });
    sel.value = currentValue;
  }
  if (datalist) {
    datalist.innerHTML = salaries.map(function(s) {
      var label = s.nom + (s.poste ? ' - ' + s.poste : '') + (s.numero ? ' (' + s.numero + ')' : '');
      return '<option value="' + label.replace(/"/g, '&quot;') + '"></option>';
    }).join('');
  }
  if (search && sel && sel.value) {
    var selected = salaries.find(function(s){ return s.id === sel.value; });
    if (selected) search.value = selected.nom + (selected.poste ? ' - ' + selected.poste : '') + (selected.numero ? ' (' + selected.numero + ')' : '');
  }
};

filtrerRechercheAbsence = function() {
  var search = (document.getElementById('absence-sal-search')?.value || '').trim().toLowerCase();
  var sel = document.getElementById('absence-sal');
  if (!sel) return;
  if (!search) {
    sel.value = '';
    return;
  }
  var match = charger('salaries').find(function(s) {
    return [s.nom, s.prenom, s.nomFamille, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
  if (match) sel.value = match.id;
};

initFormulairePlanningRapide = function() {
  appliquerLibellesAnalyseHT();
  var panelTitle = document.querySelector('#page-planning .planning-absence-form .planning-panel-title');
  if (panelTitle) panelTitle.textContent = 'Ajouter une période planning';
  var btn = document.querySelector('#page-planning .planning-absence-form .btn-primary');
  if (btn) btn.textContent = '+ Enregistrer la période';

  var typeSelect = document.getElementById('absence-type');
  if (typeSelect) {
    var currentType = typeSelect.value || 'travail';
    typeSelect.innerHTML = ''
      + '<option value="travail">Travail</option>'
      + '<option value="repos">Repos</option>'
      + '<option value="conge">Congé</option>'
      + '<option value="maladie">Maladie</option>'
      + '<option value="absence">Absence</option>';
    typeSelect.value = currentType;
    typeSelect.onchange = toggleAbsenceTypeFields;
  }

  var finField = document.getElementById('absence-fin')?.closest('.planning-field');
  if (finField && !document.getElementById('absence-heure-debut')) {
    finField.insertAdjacentHTML('afterend',
      '<div class="planning-field" id="absence-heure-debut-wrap">'
      + '<label>Heure début</label>'
      + '<input type="time" id="absence-heure-debut" />'
      + '</div>'
      + '<div class="planning-field" id="absence-heure-fin-wrap">'
      + '<label>Heure fin</label>'
      + '<input type="time" id="absence-heure-fin" />'
      + '</div>'
    );
  }

  var toolbar = document.querySelector('#page-planning .planning-table-toolbar');
  if (toolbar && !toolbar.querySelector('.planning-table-search')) {
    var toolbarInput = toolbar.querySelector('#filtre-planning-salarie');
    var firstBlock = toolbar.children[0];
    if (firstBlock) firstBlock.classList.add('planning-table-toolbar-main');
    if (toolbarInput) {
      var searchWrap = document.createElement('div');
      searchWrap.className = 'planning-table-search';
      toolbarInput.parentNode.insertBefore(searchWrap, toolbarInput);
      searchWrap.appendChild(toolbarInput);
    }
  }

  var weekTable = document.querySelector('#page-planning .table-wrapper table');
  if (weekTable) weekTable.classList.add('planning-week-grid');
  var weekWrapper = document.querySelector('#page-planning .table-wrapper');
  if (weekWrapper) weekWrapper.classList.add('planning-week-table');

  var searchInput = document.getElementById('absence-sal-search');
  var hiddenSelect = document.getElementById('absence-sal');
  if (searchInput) {
    if (hiddenSelect) hiddenSelect.style.display = 'none';
    var datalist = document.getElementById('absence-sal-datalist');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'absence-sal-datalist';
      searchInput.insertAdjacentElement('afterend', datalist);
    }
    searchInput.setAttribute('list', 'absence-sal-datalist');
    searchInput.placeholder = 'Rechercher ou sélectionner un salarié...';
  }

  peuplerAbsenceSal();
  toggleAbsenceTypeFields();
};

ajouterPeriodeAbsence = function() {
  var salId = document.getElementById('absence-sal') ? document.getElementById('absence-sal').value : '';
  var type = document.getElementById('absence-type') ? document.getElementById('absence-type').value : 'travail';
  var debut = document.getElementById('absence-debut') ? document.getElementById('absence-debut').value : '';
  var fin = document.getElementById('absence-fin') ? document.getElementById('absence-fin').value : '';
  var heureDebut = document.getElementById('absence-heure-debut') ? document.getElementById('absence-heure-debut').value : '';
  var heureFin = document.getElementById('absence-heure-fin') ? document.getElementById('absence-heure-fin').value : '';
  var editId = document.getElementById('absence-edit-id') ? document.getElementById('absence-edit-id').value : '';
  if (!salId || !debut || !fin) { afficherToast('Salarié, date début et date fin obligatoires', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit être après la date de début', 'error'); return; }

  if (type === 'travail') {
    if (!heureDebut || !heureFin) { afficherToast('Renseignez les heures de travail', 'error'); return; }
    if (calculerDureeJour(heureDebut, heureFin) <= 0) { afficherToast('Les heures de travail sont invalides', 'error'); return; }
    var sal = charger('salaries').find(function(s){ return s.id === salId; });
    var periodes = charger('absences_periodes');
    var payloadTravail = {
      id: editId || genId(),
      salId: salId,
      salNom: sal ? sal.nom : '',
      type: 'travail',
      debut: debut,
      fin: fin,
      heureDebut: heureDebut,
      heureFin: heureFin,
      creeLe: editId ? (periodes.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };
    var idxTravail = periodes.findIndex(function(a) { return a.id === payloadTravail.id; });
    if (idxTravail > -1) periodes[idxTravail] = payloadTravail;
    else periodes.push(payloadTravail);
    localStorage.setItem('absences_periodes', JSON.stringify(periodes));
    ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast(editId ? 'Créneau de travail mis à jour' : 'Créneau de travail enregistré');
    return;
  }

  var absences = loadSafe('absences_periodes', []);
  var payload = { id: editId || genId(), salId: salId, type: type, debut: debut, fin: fin, creeLe: editId ? (absences.find(function(a){ return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(), modifieLe: new Date().toISOString() };
  var idx = absences.findIndex(function(a){ return a.id === payload.id; });
  if (idx > -1) absences[idx] = payload;
  else absences.push(payload);
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = '';
  if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  var typeLabel = type === 'repos' ? 'Repos' : type === 'conge' ? 'Congé' : type === 'maladie' ? 'Maladie' : 'Absence';
  afficherToast(typeLabel + ' enregistré');
};

afficherPlanningSemaine = function() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var salaries = charger('salaries');
  var plannings = loadSafe('plannings', []);
  var absences = loadSafe('absences_periodes', []);
  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var labelSemaine = 'Semaine ' + getNumSemaine(lundi) + ' - ' + lundi.getFullYear();
  var labelDates = lundi.toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) + ' au ' + dimanche.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
  var elLabel = document.getElementById('planning-semaine-label');
  var elDates = document.getElementById('planning-semaine-dates');
  if (elLabel) elLabel.textContent = labelSemaine;
  if (elDates) elDates.textContent = labelDates;

  initFormulairePlanningRapide();

  var thead = document.getElementById('thead-planning-semaine');
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + datesSemaine.map(function(d, i) {
      var isAuj = dateToLocalISO(d) === aujourdhui();
      return '<th style="text-align:center;' + (isAuj ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[i].toUpperCase() + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '</th>';
    }).join('') + '</tr>';
  }

  var tb = document.getElementById('tb-planning-semaine');
  if (!tb) return;
  if (!salaries.length) { tb.innerHTML = emptyState('👤', 'Aucun salarié', 'Ajoutez un salarié pour planifier la semaine.'); return; }

  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var salariesFiltres = salaries.filter(function(s) {
    if (!filtre) return true;
    return [s.nom, s.prenom, s.nomFamille, s.numero, s.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });

  var totalPlanifies = 0;
  var totalAbsences = 0;
  salariesFiltres.forEach(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var aUnJourTravaille = false;
    datesSemaine.forEach(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = getPlanningPeriodForDate(s.id, dateStr, absences);
      if (absJour) {
        if (absJour.type === 'travail') aUnJourTravaille = true;
        else if (absJour.type !== 'repos') totalAbsences++;
        return;
      }
      var jour = plan ? (plan.semaine || []).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (jour && jour.travaille) aUnJourTravaille = true;
    });
    if (aUnJourTravaille) totalPlanifies++;
  });

  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
  if (!salariesFiltres.length) { tb.innerHTML = emptyState('🔍', 'Aucun résultat', 'Aucun salarié ne correspond à la recherche.'); return; }

  function renderCell(className, title, detail, note) {
    return '<td><div class="planning-week-state ' + className + '"><span>' + title + '</span>' + (detail ? '<span class="planning-week-time">' + detail + '</span>' : '') + (note ? '<span class="planning-week-note">' + note + '</span>' : '') + '</div></td>';
  }

  tb.innerHTML = salariesFiltres.map(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var cellules = datesSemaine.map(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = getPlanningPeriodForDate(s.id, dateStr, absences);
      if (absJour) {
        if (absJour.type === 'travail') {
          return renderPlanningCell('is-work', 'Travail', (absJour.heureDebut || '') + (absJour.heureFin ? ' - ' + absJour.heureFin : ''), '');
        }
        return renderPlanningCell('is-' + absJour.type, getPlanningPeriodLabel(absJour.type), '', '');
      }

      var jour = plan ? (plan.semaine || []).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (!jour || !jour.travaille) {
        if (jour && ['repos','conge','absence','maladie'].includes(jour.typeJour)) {
          var lb = jour.typeJour === 'repos' ? 'Repos' : jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence';
          return renderPlanningCell('is-' + jour.typeJour, lb, '', '');
        }
        return renderPlanningCell('is-rest', 'Repos', '', '');
      }

      return renderPlanningCell('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || '');
    }).join('');

    return '<tr><td><div class="planning-week-salarie"><strong>' + s.nom + '</strong>' + (s.poste ? '<span class="planning-week-meta">' + s.poste + '</span>' : '') + (s.numero ? '<span class="planning-week-meta">#' + s.numero + '</span>' : '') + '</div></td>' + cellules + '</tr>';
  }).join('');
};
window.__planningRewriteFinal && window.__planningRewriteFinal();

window.__planningPeriodOnlyFinal = function() {
  function planningEmployeeUsesPeriods(salId, periodes) {
    return (periodes || charger('absences_periodes')).some(function(item) { return item.salId === salId; });
  }

  function getPlanningDeleteButton(salId, dateStr, enabled) {
    if (!enabled) return '';
    return '<button type="button" class="planning-week-delete" title="Supprimer" onclick="event.stopPropagation();supprimerPlanningJour(\'' + salId + '\',\'' + dateStr + '\')">×</button>';
  }

  function planningBuildCellExtras(salarie, dateStr) {
    var extras = [];
    var livraisons = planningGetLivraisonsForDate(salarie.id, dateStr);
    if (livraisons.length) {
      extras.push('<div class="planning-week-extras planning-week-livraisons">' + livraisons.slice(0, 2).map(function(livraison) {
        return '<button type="button" class="planning-week-chip is-livraison" onclick="event.stopPropagation();ouvrirEditLivraison(\'' + livraison.id + '\')" title="' + planningEscapeHtml((livraison.numLiv || 'Livraison') + ' — ' + (livraison.client || '')) + '">' + planningEscapeHtml(livraison.numLiv || 'LIV') + '</button>';
      }).join('') + (livraisons.length > 2 ? '<span class="planning-week-chip is-more">+' + (livraisons.length - 2) + '</span>' : '') + '</div>');
    }
    var inspection = planningGetInspectionForDate(salarie.id, dateStr);
    if (!inspection) {
      extras.push('<div class="planning-week-indicator is-muted">Inspection à faire</div>');
    } else {
      extras.push('<div class="planning-week-indicator is-success">Inspection OK</div>');
    }
    return extras.join('');
  }

  function planningBuildSalarieMeta(salarie) {
    var vehicule = planningGetVehicleForSalarie(salarie.id);
    var incidents = planningGetOpenIncidentsForSalarie(salarie.id);
    return '<div class="planning-week-salarie">'
      + '<button type="button" class="planning-salarie-link" onclick="planningOuvrirFicheSalarie(\'' + salarie.id + '\')"><strong>' + planningEscapeHtml(getSalarieNomComplet(salarie)) + '</strong></button>'
      + (salarie.poste ? '<span class="planning-week-meta">' + planningEscapeHtml(salarie.poste) + '</span>' : '')
      + (vehicule ? '<span class="planning-week-meta">🚐 ' + planningEscapeHtml(vehicule.immat + (vehicule.modele ? ' — ' + vehicule.modele : '')) + '</span>' : '')
      + (salarie.numero ? '<span class="planning-week-meta">#' + planningEscapeHtml(salarie.numero) + '</span>' : '')
      + (incidents.length ? '<span class="planning-week-incident">🚨 ' + incidents.length + ' incident' + (incidents.length > 1 ? 's' : '') + '</span>' : '')
      + '</div>';
  }

  function planningRenderCellState(salarie, dateStr, className, title, detail, note, options) {
    var opts = options || {};
    var cellClass = ['planning-cell', opts.clickable !== false ? 'is-clickable' : '', opts.today ? 'is-today' : ''].filter(Boolean).join(' ');
    var attrs = 'class="' + cellClass + '" onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + (opts.typeHint || 'travail') + '\')"';
    var extras = planningBuildCellExtras(salarie, dateStr);
    return planningRenderWeekState(className, title, detail, note, extras, attrs);
  }

  function planningGetEntryForDate(salId, dateStr, periodes, planning) {
    var periodEntry = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periodEntry) return { source: 'period', entry: periodEntry };
    if (planningEmployeeUsesPeriods(salId, periodes)) return { source: 'period', entry: null };
    var dateObj = new Date(dateStr + 'T00:00:00');
    var jourNom = JOURS[(dateObj.getDay() + 6) % 7];
    var recurring = (planning?.semaine || []).find(function(item) { return item.jour === jourNom; }) || null;
    return { source: 'recurring', entry: recurring };
  }

  supprimerPlanningJour = async function(salId, dateStr) {
    var ok = await confirmDialog('Supprimer ce créneau de cette journée ?', { titre:'Supprimer le créneau', icone:'❌', btnLabel:'Supprimer' });
    if (!ok) return;

    var periodes = charger('absences_periodes');
    var periode = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periode && periode.type === 'travail') {
      var updated = periodes.filter(function(item) { return item.id !== periode.id; });
      if (periode.debut < dateStr) {
        updated.push({
          ...periode,
          id: genId(),
          fin: planningDateToLocalISO(new Date(new Date(dateStr + 'T00:00:00').getTime() - 86400000)),
          modifieLe: new Date().toISOString()
        });
      }
      if (periode.fin > dateStr) {
        updated.push({
          ...periode,
          id: genId(),
          debut: planningDateToLocalISO(new Date(new Date(dateStr + 'T00:00:00').getTime() + 86400000)),
          modifieLe: new Date().toISOString()
        });
      }
      sauvegarder('absences_periodes', updated.sort(function(a, b) { return new Date(a.debut) - new Date(b.debut); }));
      afficherPlanningSemaine();
      afficherCompteurHeures();
      return afficherToast('Créneau supprimé pour cette journée');
    }

    var plannings = charger('plannings');
    var planningIndex = plannings.findIndex(function(item) { return item.salId === salId; });
    if (planningIndex === -1) return;
    var jourNom = JOURS[(new Date(dateStr + 'T00:00:00').getDay() + 6) % 7];
    var semaine = Array.isArray(plannings[planningIndex].semaine) ? plannings[planningIndex].semaine : [];
    var jourIndex = semaine.findIndex(function(item) { return item.jour === jourNom; });
    if (jourIndex === -1) return;
    semaine[jourIndex] = {
      ...semaine[jourIndex],
      travaille: false,
      typeJour: 'repos',
      heureDebut: '',
      heureFin: '',
      zone: '',
      note: ''
    };
    plannings[planningIndex].semaine = semaine;
    plannings[planningIndex].mis_a_jour = new Date().toISOString();
    sauvegarder('plannings', plannings);
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Créneau hebdomadaire retiré');
  };

  initFormulairePlanningRapide = function() {
    peuplerAbsenceSal();
    toggleAbsenceTypeFields();
    var title = document.querySelector('#page-planning .planning-absence-form .planning-panel-title');
    var sub = document.querySelector('#page-planning .planning-absence-form .planning-toolbar-sub');
    var layout = document.querySelector('#page-planning .planning-absence-layout');
    var list = document.querySelector('#page-planning .planning-absence-list');
    var editBtn = document.getElementById('planning-edit-work-btn');
    var btn = document.getElementById('planning-submit-btn');
    if (title) title.textContent = 'Ajouter une période';
    if (sub) sub.textContent = 'Saisis uniquement des périodes datées. Rien ne se répète automatiquement hors des dates choisies.';
    if (layout) layout.style.gridTemplateColumns = 'minmax(0, 1fr)';
    if (list) list.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    var typeSelect = document.getElementById('absence-type');
    if (typeSelect) {
      var currentType = typeSelect.value;
      typeSelect.innerHTML = ''
        + '<option value="travail">Travail</option>'
        + '<option value="conge">Congé</option>'
        + '<option value="maladie">Maladie</option>'
        + '<option value="absence">Absence</option>';
      typeSelect.value = ['travail', 'conge', 'maladie', 'absence'].includes(currentType) ? currentType : 'travail';
    }
    if (btn && !document.getElementById('absence-edit-id')?.value) btn.textContent = '+ Enregistrer la période';
  };

  afficherAbsencesPeriodes = function() {
    var list = document.querySelector('#page-planning .planning-absence-list');
    if (list) list.style.display = 'none';
  };

  ouvrirEditionTravailRapide = function() {
    afficherToast('Les périodes de planning se gèrent directement dans le formulaire.', 'info');
  };

  reinitialiserFormulairePlanningRapide = function() {
    ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    if (document.getElementById('absence-type')) document.getElementById('absence-type').value = 'travail';
    var btn = document.getElementById('planning-submit-btn');
    if (btn) btn.textContent = '+ Enregistrer la période';
    toggleAbsenceTypeFields();
  };

  ajouterPeriodeAbsence = function() {
    try {
      var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
      var type = document.getElementById('absence-type')?.value || 'travail';
      var debut = document.getElementById('absence-debut')?.value || '';
      var fin = document.getElementById('absence-fin')?.value || '';
      var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
      var heureFin = document.getElementById('absence-heure-fin')?.value || '';
      var editId = document.getElementById('absence-edit-id')?.value || '';
      if (!salarie || !debut || !fin) return afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
      if (fin < debut) return afficherToast('La date de fin doit être postérieure à la date de début', 'error');
      if (type === 'travail' && (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0)) return afficherToast('Renseigne des horaires de travail valides', 'error');

      var periodes = charger('absences_periodes');
      var payload = {
        id: editId || genId(),
        salId: salarie.id,
        salNom: salarie.nom || '',
        type: type,
        debut: debut,
        fin: fin,
        heureDebut: type === 'travail' ? heureDebut : '',
        heureFin: type === 'travail' ? heureFin : '',
        creeLe: editId ? (periodes.find(function(item) { return item.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
        modifieLe: new Date().toISOString()
      };
      var index = periodes.findIndex(function(item) { return item.id === payload.id; });
      if (index > -1) periodes[index] = payload; else periodes.push(payload);
      sauvegarder('absences_periodes', periodes);
      reinitialiserFormulairePlanningRapide();
      if (typeof afficherAbsencesPeriodes === 'function') afficherAbsencesPeriodes();
      afficherPlanningSemaine();
      afficherCompteurHeures();
      rafraichirDashboard();
      afficherToast(editId ? 'Période mise à jour' : 'Période enregistrée');
    } catch (error) {
      console.error('ajouterPeriodeAbsence', error);
      afficherToast('⚠️ Enregistrement impossible pour cette période', 'error');
    }
  };

  afficherPlanningSemaine = function() {
    initFormulairePlanningRapide();
    var period = planningGetDisplayedPeriod();
    var range = period.range;
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var periodes = charger('absences_periodes');
    var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
    var planningSelect = document.getElementById('vue-planning-select');
    var label = document.getElementById('planning-semaine-label');
    var datesLabel = document.getElementById('planning-semaine-dates');
    var thead = document.getElementById('thead-planning-semaine');
    var tbody = document.getElementById('tb-planning-semaine');
    var table = document.querySelector('#page-planning .planning-week-grid');
    if (planningSelect) planningSelect.value = _planningPeriode.mode || 'semaine';
    if (table) table.classList.toggle('is-month-view', period.mode === 'mois');
    if (table) table.classList.toggle('is-day-view', period.mode === 'jour');
    if (label) label.textContent = range.label || '';
    if (datesLabel) datesLabel.textContent = range.datesLabel || '';
    if (thead) {
      if (period.mode === 'annee') {
        thead.innerHTML = '<tr><th>Salarié</th>' + period.months.map(function(month) {
          return '<th style="text-align:center">' + month.label + '</th>';
        }).join('') + '</tr>';
      } else if (period.mode === 'mois') {
        thead.innerHTML = '<tr><th>Salarié</th>' + period.weeks.map(function(week) {
          return '<th style="text-align:center"><div>' + week.label + '</div><div style="font-size:.68rem;color:var(--text-muted);font-weight:500;text-transform:none;letter-spacing:0">' + week.meta + '</div></th>';
        }).join('') + '</tr>';
      } else {
        thead.innerHTML = '<tr><th>Salarié</th>' + period.dates.map(function(dateObj, index) {
          var dayLabel = period.mode === 'jour'
            ? formatDateExport(dateObj)
            : (JOURS_COURTS[index % 7].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5));
          return '<th style="text-align:center">' + dayLabel + '</th>';
        }).join('') + '</tr>';
      }
    }
    if (!tbody) return;
    if (!salaries.length) {
      tbody.innerHTML = '<tr><td colspan="' + (period.mode === 'annee' ? 13 : period.mode === 'mois' ? ((period.weeks?.length || 0) + 1) : ((period.dates?.length || 0) + 1)) + '" class="empty-row">Aucun salarié</td></tr>';
      return;
    }
    var filtered = salaries.filter(function(salarie) {
      if (!filtre) return true;
      return [planningBuildEmployeeLabel(salarie), salarie.nom, salarie.prenom, salarie.numero, salarie.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
    });
    var totalPlanifies = 0;
    var totalAbsences = 0;
    tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var hasWork = false;
      var cells = '';
      if (period.mode === 'annee') {
        cells = period.months.map(function(month) {
          var workDays = 0;
          var absenceDays = 0;
          for (var day = 1; day <= 31; day++) {
            var dateObj = new Date(month.year, month.index, day);
            if (dateObj.getMonth() !== month.index) break;
            var resolved = planningGetEntryForDate(salarie.id, planningDateToLocalISO(dateObj), periodes, planning);
            var entry = resolved.entry;
            if (!entry) continue;
            if (resolved.source === 'period') {
              if (entry.type === 'travail') workDays += 1;
              else if (entry.type !== 'repos') absenceDays += 1;
            } else if (entry.typeJour === 'travail' && entry.travaille) {
              workDays += 1;
            } else if (['conge', 'absence', 'maladie'].includes(entry.typeJour)) {
              absenceDays += 1;
            }
          }
          if (workDays > 0) hasWork = true;
          totalAbsences += absenceDays;
          if (!workDays && !absenceDays) return planningRenderWeekState('is-rest', 'Non planifié', '', '', '', 'class="planning-cell"');
          var detail = workDays ? (workDays + ' j') : '';
          var note = absenceDays ? (absenceDays + ' abs.') : '';
          var className = workDays ? 'is-work' : 'is-absence';
          var title = workDays ? 'Planifié' : 'Absences';
          return planningRenderWeekState(
            className,
            title,
            detail,
            note,
            '',
            'class="planning-cell" onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + planningDateToLocalISO(month.start) + '\',\'' + planningDateToLocalISO(month.end) + '\',\'' + planningEscapeHtml(month.label + ' ' + month.year).replace(/'/g, '&#39;') + '\')"'
          );
        }).join('');
      } else if (period.mode === 'mois') {
        cells = period.weeks.map(function(week) {
          var workDays = 0;
          var absenceDays = 0;
          var livraisonCount = 0;
          var inspectionCount = 0;
          week.dates.forEach(function(dateObj) {
            var dateStr = planningDateToLocalISO(dateObj);
            var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
            var entry = resolved.entry;
            if (entry) {
              if (resolved.source === 'period') {
                if (entry.type === 'travail') workDays += 1;
                else if (entry.type !== 'repos') absenceDays += 1;
              } else if (entry.typeJour === 'travail' && entry.travaille) {
                workDays += 1;
              } else if (['conge', 'absence', 'maladie'].includes(entry.typeJour)) {
                absenceDays += 1;
              }
            }
            livraisonCount += planningGetLivraisonsForDate(salarie.id, dateStr).length;
            if (planningGetInspectionForDate(salarie.id, dateStr)) inspectionCount += 1;
          });
          if (workDays > 0) hasWork = true;
          totalAbsences += absenceDays;
          var detail = workDays ? (workDays + ' j planifiés') : (absenceDays ? 'Absence / congé' : '');
          var noteParts = [];
          if (livraisonCount) noteParts.push(livraisonCount + ' livr.');
          if (inspectionCount) noteParts.push(inspectionCount + ' insp.');
          if (absenceDays) noteParts.push(absenceDays + ' abs.');
          var note = noteParts.join(' · ');
          var className = workDays ? 'is-work' : (absenceDays ? 'is-absence' : 'is-rest');
          var title = workDays ? 'Semaine active' : (absenceDays ? 'Indisponibilité' : 'Non planifié');
          return planningRenderWeekState(className, title, detail, note, '', 'class="planning-cell planning-cell-month" onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + planningDateToLocalISO(week.start) + '\',\'' + planningDateToLocalISO(week.end) + '\',\'' + planningEscapeHtml(week.label + ' · ' + week.meta).replace(/'/g, '&#39;') + '\')"');
        }).join('');
      } else {
        cells = period.dates.map(function(dateObj) {
          var dateStr = planningDateToLocalISO(dateObj);
          var isToday = dateStr === aujourdhui();
          var recapLabel = formatDateExport(dateObj);
          var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
          var entry = resolved.entry;
          if (!entry) {
            var emptyCell = planningRenderCellState(salarie, dateStr, 'is-rest', period.mode === 'jour' ? 'Aucun créneau' : 'Non planifié', '', '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
            if (period.mode === 'jour') emptyCell = emptyCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return emptyCell;
          }
          if (resolved.source === 'period') {
            if (entry.type === 'travail') {
              hasWork = true;
              var workedPeriodCell = planningRenderCellState(salarie, dateStr, 'is-work', period.mode === 'jour' ? 'Journée travaillée' : 'Travail', (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : ''), '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : '')).replace('<div class="planning-week-state is-work">', '<div class="planning-week-state is-work">' + getPlanningDeleteButton(salarie.id, dateStr, true));
              if (period.mode === 'jour') workedPeriodCell = workedPeriodCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
              return workedPeriodCell;
            }
            if (entry.type === 'repos') {
              var reposCell = planningRenderCellState(salarie, dateStr, 'is-repos', 'Repos', '', '', { today: isToday, typeHint: 'repos' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
              if (period.mode === 'jour') reposCell = reposCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'repos\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
              return reposCell;
            }
            totalAbsences += 1;
            var periodAbsCell = planningRenderCellState(salarie, dateStr, 'is-' + entry.type, getPlanningPeriodLabel(entry.type), '', '', { today: isToday, typeHint: entry.type }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
            if (period.mode === 'jour') periodAbsCell = periodAbsCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + entry.type + '\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return periodAbsCell;
          }
          if (entry.typeJour === 'travail' && entry.travaille) {
            hasWork = true;
            var workedRecurringCell = planningRenderCellState(salarie, dateStr, 'is-work', period.mode === 'jour' ? 'Journée travaillée' : 'Travail', (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : ''), entry.zone || entry.note || '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : '')).replace('<div class="planning-week-state is-work">', '<div class="planning-week-state is-work">' + getPlanningDeleteButton(salarie.id, dateStr, true));
            if (period.mode === 'jour') workedRecurringCell = workedRecurringCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return workedRecurringCell;
          }
          if (['repos', 'conge', 'absence', 'maladie'].includes(entry.typeJour)) {
            if (entry.typeJour !== 'repos') totalAbsences += 1;
            var statusCell = planningRenderCellState(salarie, dateStr, 'is-' + entry.typeJour, entry.typeJour === 'repos' ? 'Repos' : getPlanningPeriodLabel(entry.typeJour), '', '', { today: isToday, typeHint: entry.typeJour }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
            if (period.mode === 'jour') statusCell = statusCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + entry.typeJour + '\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return statusCell;
          }
          var fallbackCell = planningRenderCellState(salarie, dateStr, 'is-rest', period.mode === 'jour' ? 'Aucun créneau' : 'Non planifié', '', '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
          if (period.mode === 'jour') fallbackCell = fallbackCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
          return fallbackCell;
        }).join('');
      }
      if (hasWork) totalPlanifies += 1;
      return '<tr><td>' + planningBuildSalarieMeta(salarie) + '</td>' + cells + '</tr>';
    }).join('') : '<tr><td colspan="' + (period.mode === 'annee' ? 13 : period.mode === 'mois' ? ((period.weeks?.length || 0) + 1) : ((period.dates?.length || 0) + 1)) + '" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
    var kpiSal = document.getElementById('planning-kpi-salaries');
    var kpiPlan = document.getElementById('planning-kpi-planifies');
    var kpiAbs = document.getElementById('planning-kpi-absences');
    if (kpiSal) kpiSal.textContent = salaries.length;
    if (kpiPlan) kpiPlan.textContent = totalPlanifies;
    if (kpiAbs) kpiAbs.textContent = totalAbsences;
  };

  exporterPlanningSemainePDF = function() {
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var periodes = charger('absences_periodes');
    var params = getEntrepriseExportParams();
    var dateExp = formatDateHeureExport();
    var titreSemaine = 'Semaine ' + getNumSemaine(week.lundi) + ' — ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
    var stateStyles = {
      travail: { bg:'#e9f8ef', border:'#b7e7c8', color:'#177245', label:'Travail' },
      repos: { bg:'#f4f5f7', border:'#d7dbe2', color:'#6b7280', label:'Repos' },
      conge: { bg:'#eaf3ff', border:'#c7defd', color:'#3498db', label:'Congé' },
      maladie: { bg:'#f4edff', border:'#dcc8fa', color:'#9b59b6', label:'Maladie' },
      absence: { bg:'#fdeeee', border:'#f7c7c7', color:'#e74c3c', label:'Absence' }
    };
    function getStateBlockStyle(style, extra) {
      return 'min-height:56px;display:flex;align-items:center;justify-content:center;padding:8px 6px;border-radius:12px;background:' + style.bg + ';border:1px solid ' + style.border + ';color:' + style.color + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;' + (extra || '');
    }
    function formatCellulePlanning(salarie, dateObj, planning) {
      var dateStr = planningDateToLocalISO(dateObj);
      var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
      var entry = resolved.entry;
      if (!entry) {
        var restStyle = stateStyles.repos;
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(restStyle, 'font-size:.78rem') + '">Repos</div></td>';
      }
      if (resolved.source === 'period') {
        if (entry.type === 'travail') {
          var workStyle = stateStyles.travail;
          var horaire = (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '');
          return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(workStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">Travail</span><span style="font-size:.76rem;font-weight:600">' + horaire + '</span></div></td>';
        }
        if (entry.type === 'repos') {
          var periodRestStyle = stateStyles.repos;
          return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodRestStyle, 'font-size:.78rem') + '">Repos</div></td>';
        }
        var periodStyle = stateStyles[entry.type] || stateStyles.absence;
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodStyle, 'font-size:.78rem;font-weight:700') + '">' + getPlanningPeriodLabel(entry.type) + '</div></td>';
      }
      if (entry.typeJour === 'travail' && entry.travaille) {
        var recurringWorkStyle = stateStyles.travail;
        var recurringHoraire = (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '');
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(recurringWorkStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">Travail</span><span style="font-size:.76rem;font-weight:600">' + recurringHoraire + '</span></div></td>';
      }
      var recurringStyle = stateStyles[entry.typeJour] || stateStyles.repos;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(recurringStyle, 'font-size:.78rem;font-weight:700') + '">' + getPlanningPeriodLabel(entry.typeJour || 'repos') + '</div></td>';
    }
    var rows = salaries.map(function(salarie, index) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var cells = week.dates.map(function(dateObj) {
        return formatCellulePlanning(salarie, dateObj, planning);
      }).join('');
      return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + '"><td style="padding:10px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;min-width:170px">' + (salarie.nom || '') + (salarie.poste ? '<br><span style="font-size:.74rem;color:#9ca3af">' + salarie.poste + '</span>' : '') + '</td>' + cells + '</tr>';
    }).join('');
    var thead = week.dates.map(function(dateObj, dayIndex) {
      return '<th style="padding:10px 8px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #dfe3ea;min-width:92px">' + JOURS_COURTS[dayIndex] + '<div style="font-size:.76rem;color:#9ca3af;margin-top:2px">' + formatDateExport(dateObj).slice(0, 5) + '</div></th>';
    }).join('');
    var html = '<style>@page{size:landscape;margin:10mm}body,table,thead,tbody,tr,th,td,div,span{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}</style><div style="font-family:Segoe UI,Arial,sans-serif;width:100%;padding:22px 24px;color:#1a1d27;box-sizing:border-box">'
      + construireEnteteExport(params, 'Planning hebdomadaire', titreSemaine, dateExp)
      + '<div style="margin:0 0 16px;font-size:.88rem;color:#4b5563">Période : <strong>' + formatDateExport(week.lundi) + '</strong> au <strong>' + formatDateExport(week.dimanche) + '</strong></div>'
      + '<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;table-layout:fixed"><thead><tr style="background:#f3f4f6"><th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;border-bottom:1px solid #dfe3ea;min-width:170px">Salarié</th>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
      + '</div>';
    ouvrirFenetreImpression('Planning ' + titreSemaine, html, 'width=1200,height=780');
    afficherToast('Rapport planning généré');
  };
};

window.__planningPeriodOnlyFinal();

// MOVED -> script-planning.js : planningPrepareEmployeeInput

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal');
  planningPrepareEmployeeInput('absence-sal-search', 'absence-sal-suggestions');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  planningRenderEmployeeSuggestions('absence-sal-search', 'absence-sal', 'absence-sal-suggestions');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie');
  planningPrepareEmployeeInput('plan-salarie-search', 'plan-salarie-suggestions');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  planningRenderEmployeeSuggestions('plan-salarie-search', 'plan-salarie', 'plan-salarie-suggestions', function() {
    genererGrilleJours();
  });
  if (salarie) genererGrilleJours();
};

// MOVED -> script-core-planning-suggestions-close.js : 

/* ===== RENTABILITE — Calculateur avancé ===== */
var RENTABILITE_STORAGE_KEY = 'rentabilite_calculateur_v2';

// MOVED -> script-rentabilite.js : getRentabiliteDefaults

// MOVED -> script-rentabilite.js : chargerRentabiliteConfig

// MOVED -> script-rentabilite.js : sauvegarderRentabiliteConfig

// MOVED -> script-rentabilite.js : rentabiliteGetContainer

// MOVED -> script-rentabilite.js : rentabiliteWireEvents

// MOVED -> script-rentabilite.js : getRentabiliteLivraisonLabel

// MOVED -> script-rentabilite.js : rentabiliteGetSelectedLivraison

// MOVED -> script-rentabilite.js : rentabiliteGetVehiculeActif

// MOVED -> script-rentabilite.js : rentabiliteGetMoisReference

// MOVED -> script-rentabilite.js : rentabiliteGetChargesReellesMois

// MOVED -> script-rentabilite.js : rentabiliteGetPrixCarburantMoyen

// MOVED -> script-rentabilite.js : rentabiliteUpdateFuelHelper

// MOVED -> script-rentabilite.js : rentabiliteAppliquerPrixCarburantReel

// MOVED -> script-rentabilite.js : rentabiliteChargerDepuisVehicule

// MOVED -> script-rentabilite.js : rentabiliteChargerChargesReelles

// MOVED -> script-rentabilite.js : rentabiliteHasChargeDoublonLLD

// MOVED -> script-rentabilite.js : rentabiliteApplyLivraisonToConfig

// MOVED -> script-rentabilite.js : rentabiliteRenderLivraisonsSelect

// MOVED -> script-rentabilite.js : rentabiliteToggleMode

// MOVED -> script-rentabilite.js : rentabiliteRenderCharges

// MOVED -> script-rentabilite.js : rentabiliteFillInputs

// MOVED -> script-rentabilite.js : rentabiliteReadFromDom

// MOVED -> script-rentabilite.js : calculerRentabiliteAvancee

// MOVED -> script-rentabilite.js : rentabiliteFormatJours

// MOVED -> script-rentabilite.js : rentabiliteRenderAlerts

// MOVED -> script-rentabilite.js : rentabiliteRenderResults

// MOVED -> script-rentabilite.js : rentabiliteSyncFromDom

// MOVED -> script-rentabilite.js : ajouterChargeRentabilite

supprimerChargeRentabilite = async function(id) {
  var ok = await confirmDialog('Supprimer cette charge ?', { titre: 'Supprimer la charge', icone: '💸', btnLabel: 'Supprimer' });
  if (!ok) return;
  var config = chargerRentabiliteConfig();
  config.autresCharges = (config.autresCharges || []).filter(function(item) { return item.id !== id; });
  sauvegarderRentabiliteConfig(config);
  rentabiliteRenderCharges(config);
  rentabiliteSyncFromDom();
};

afficherRentabilite = function() {
  rentabiliteWireEvents();
  var config = chargerRentabiliteConfig();
  if (config.modeCalcul === 'livraison') {
    config = rentabiliteApplyLivraisonToConfig(config);
    sauvegarderRentabiliteConfig(config);
  }
  rentabiliteFillInputs(config);
  rentabiliteRenderResults(calculerRentabiliteAvancee(config), config);
};

genererRentabilitePDF = function() {
  var config = chargerRentabiliteConfig();
  if (config.modeCalcul === 'livraison') config = rentabiliteApplyLivraisonToConfig(config, { forceDaysMinOne: false });
  var results = calculerRentabiliteAvancee(config);
  if (results.joursInvalides) {
    afficherToast('Renseignez au moins 1 jour / occurrence avant de générer le rapport', 'error');
    return;
  }
  var params = getEntrepriseExportParams();
  var dateExp = formatDateHeureExport();
  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:28px;color:#1a1d27">'
    + construireEnteteExport(params, 'Rapport de rentabilité', 'Calculateur financier', dateExp)
    + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:18px 0">'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:.75rem;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Activité</div><div style="display:grid;gap:8px;font-size:.92rem"><div>Mode : <strong>' + (config.modeCalcul === 'livraison' ? 'Livraison ciblée' : 'Simulation manuelle') + '</strong></div><div>' + (config.modeCalcul === 'livraison' ? 'Distance livraison' : 'Km / jour') + ' : <strong>' + results.kmJour + '</strong></div><div>Prix / km HT : <strong>' + parseFloat(results.prixKm || 0).toFixed(2).replace('.', ',') + ' €</strong></div><div>' + (config.modeCalcul === 'livraison' ? 'Occurrences mensuelles' : 'Jours travaillés') + ' : <strong>' + results.joursTravailles + '</strong></div>' + (results.livraison ? '<div>Livraison : <strong>' + planningEscapeHtml(getRentabiliteLivraisonLabel(results.livraison)) + '</strong></div><div>CA HT par livraison : <strong>' + euros(results.caLivraisonHT || 0) + '</strong></div>' : '') + '</div></div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:.75rem;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Coûts mensuels</div><div style="display:grid;gap:8px;font-size:.92rem"><div>Répartition charges fixes : <strong>' + (config.repartitionCharges === 'prorata' ? 'Proratisée' : 'Mois complet') + '</strong></div><div>Carburant HT : <strong>' + euros(results.coutCarburant) + '</strong></div><div>Charges fixes imputées HT : <strong>' + euros(results.chargesFixes) + '</strong></div><div>Charges fixes mensuelles HT : <strong>' + euros(results.chargesFixesMensuelles) + '</strong></div><div>Coût total HT : <strong>' + euros(results.coutTotal) + '</strong></div></div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px">'
    + [
      ['CA HT', euros(results.caHT), '#177245'],
      ['CA TTC', euros(results.caTTC), '#2563eb'],
      ['Bénéfice net', euros(results.beneficeNet), results.beneficeNet >= 0 ? '#177245' : '#e74c3c'],
      ['Seuil de rentabilité', rentabiliteFormatJours(results.seuilJours), '#ffd60a'],
      ['Point mort', results.pointMortCA != null ? euros(results.pointMortCA) : 'Non atteignable', '#7c3aed'],
      ['Coût / km', euros(results.coutParKm) + '/km', '#4b5563'],
      ['Marge / km', euros(results.margeParKm) + '/km', results.margeParKm >= 0 ? '#177245' : '#e74c3c'],
      ['Revenu journalier', euros(results.revenuJournalier), '#111827'],
      ['Coût variable / jour', euros(results.coutVariableJournalier), '#f97316']
    ].map(function(item) {
      return '<div style="background:#f8fafc;border-radius:14px;padding:14px;border-top:3px solid ' + item[2] + '"><div style="font-size:.75rem;color:#6b7280;margin-bottom:6px">' + item[0] + '</div><div style="font-size:1.05rem;font-weight:800;color:' + item[2] + '">' + item[1] + '</div></div>';
    }).join('')
    + '</div>'
    + '<div style="padding:14px 16px;border-radius:14px;background:' + (results.beneficeNet >= 0 ? '#ecfdf5' : '#fef2f2') + ';border:1px solid ' + (results.beneficeNet >= 0 ? '#bbf7d0' : '#fecaca') + ';font-size:.92rem">'
    + (results.seuilJours != null ? 'Votre activité devient rentable à partir de <strong>' + rentabiliteFormatJours(results.seuilJours) + '</strong> par mois.' : 'Votre activité n’atteint pas le seuil de rentabilité avec les paramètres actuels.')
    + '</div>'
    + renderFooterEntreprise(params, dateExp, 'Rapport de rentabilité')
    + '</div>';
  ouvrirFenetreImpression('Rentabilité - ' + (params.nom || 'Entreprise'), html, 'width=1024,height=760');
  afficherToast('Rapport rentabilité généré');
};


// MOVED -> script-core-synchro-admin-polling.js : 

// MOVED -> script-core-sidebar-hierarchique.js : 

// MOVED -> script-core-sprint3-command-palette.js : 

// MOVED -> script-core-sprint4-hero-sante.js : 

// MOVED -> script-core-sprint5-side-drawer.js : 

// MOVED -> script-core-sprint6-bulk-actions.js : 

// MOVED -> script-core-sprint7-pagination-search.js : 

// MOVED -> script-core-sprint8-tri-colonnes.js : 

// MOVED -> script-core-sprint9-empty-states.js : 

// MOVED -> script-core-sprint10-toasts-stacked.js : 

// MOVED -> script-core-sprint11-formulaires-intelligents.js : 

// MOVED -> script-core-sprint15-productivite-pgi.js : 

// MOVED -> script-core-sprint16-calendrier-operationnel.js : 

// MOVED -> script-core-sprint18-tri-universel-th.js : 

// MOVED -> script-core-sprint19-centre-alertes.js : 

// MOVED -> script-core-sprint20-rh360.js : 

// MOVED -> script-core-sprint21-parc360.js : 

// MOVED -> script-core-sprint22-23-hubs.js : 

// MOVED -> script-core-sprint25-drawer-360.js : 

// MOVED -> script-core-sprint26-timeline-stats-signature.js : 

// MOVED -> script-core-sprint28-bugs-cleanup.js : 

// MOVED -> script-core-sprint29-parametres-pro.js : 

// MOVED -> script-core-form-livraison-enhancements.js : 
