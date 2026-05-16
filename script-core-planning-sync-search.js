/**
 * MCA Logistics — planningSyncSearchWithSelect — sync input search ↔ select salarié (Phase X — extraction script.js)
 *
 * Extracted from script.js L3826-3844 (2026-05-16).
 */

function planningSyncSearchWithSelect(searchId, selectId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  var salaries = charger('salaries');
  if (select) {
    var currentValue = select.value;
    select.innerHTML = '<option value="">-- Choisir --</option>';
    salaries.forEach(function(s) {
      select.innerHTML += '<option value="' + s.id + '">' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '</option>';
    });
    if (salaries.some(function(s) { return s.id === currentValue; })) {
      select.value = currentValue;
    }
  }
  if (search && select && select.value) {
    var salarie = salaries.find(function(s) { return s.id === select.value; });
    if (salarie) search.value = planningBuildEmployeeLabel(salarie);
  }
}

if (typeof window !== 'undefined') {
  window.planningSyncSearchWithSelect = planningSyncSearchWithSelect;
}
