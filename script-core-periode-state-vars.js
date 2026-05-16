/**
 * MCA Logistics — Top-level period state vars (liv/heures/insp/charges/carb/entr) + comments (Phase X — extraction script.js)
 *
 * Extracted from script.js L1284-1361 (2026-05-16).
 */

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
