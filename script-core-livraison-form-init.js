/**
 * MCA Logistics — Auto-remplir véhicule depuis salarié dans modal livraison + init charges mois (Phase X — extraction script.js)
 *
 * Extracted from script.js L349-365 (2026-05-16).
 */

/* Auto-remplir le véhicule quand on choisit un salarié dans le modal livraison */
document.addEventListener('DOMContentLoaded', () => {
  const selChauf = document.getElementById('liv-chauffeur');
  if (selChauf) selChauf.addEventListener('change', () => {
    const chaufId = selChauf.value;
    const vehAff  = getVehiculeParSalId(chaufId);
    const selVeh  = document.getElementById('liv-vehicule');
    if (vehAff && selVeh && !selVeh.value) selVeh.value = vehAff.id;
  });

  if (document.getElementById('charges-mois-label')) {
    var rangeChargesInit = getChargesPeriodeRange();
    majPeriodeDisplay('charges-mois-label', 'charges-mois-dates', rangeChargesInit);
    var selectChargesInit = document.getElementById('vue-charges-select');
    if (selectChargesInit) selectChargesInit.value = _chargesPeriode.mode;
  }
});
