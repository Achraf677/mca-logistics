/**
 * MCA Logistics — Module Core-periodes
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L1813 (script.js d'origine)
function getSemaineDebut() {
  const d=new Date(), j=d.getDay(), diff=d.getDate()-j+(j===0?-6:1);
  return new Date(new Date().setDate(diff)).toLocalISODate();
}

// L1821 (script.js d'origine)
function getRentMoisRange() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + _rentMoisOffset);
  var debut = d.toLocalISODate();
  var finDate = new Date(d.getFullYear(), d.getMonth()+1, 0);
  var fin = finDate.toLocalISODate();
  return { debut, fin, label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}), dates: formatDateExport(debut) + ' au ' + formatDateExport(fin) };
}

// L1830 (script.js d'origine)
function navRentMois(delta) {
  _rentMoisOffset = delta === 0 ? 0 : _rentMoisOffset + delta;
  afficherRentabilite();
}

// L3721 (script.js d'origine)
function getLundiDeSemaine(offset) {
  var d = new Date();
  var day = d.getDay(); // 0=dim
  var diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  d.setDate(diff + (offset||0) * 7);
  d.setHours(0,0,0,0);
  return d;
}

// L3740 (script.js d'origine)
function getNumSemaine(d) {
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

// L3756 (script.js d'origine)
function getStartOfWeek(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// L3767 (script.js d'origine)
function majPeriodeDisplay(labelId, datesId, range) {
  var lbl = document.getElementById(labelId);
  var dates = document.getElementById(datesId);
  if (lbl) lbl.textContent = (range.label || '').charAt(0).toUpperCase() + (range.label || '').slice(1);
  if (dates) dates.textContent = range.datesLabel || '';
}

// L3774 (script.js d'origine)
function isDateInRange(dateStr, range) {
  return !!dateStr && !!range && dateStr >= range.debut && dateStr <= range.fin;
}

// L3802 (script.js d'origine)
function changeSimplePeriode(state, mode, refreshFn, labelId, datesId, selectId) {
  state.mode = ['jour', 'semaine', 'mois', 'annee'].includes(mode) ? mode : state.mode;
  state.offset = 0;
  var select = selectId ? document.getElementById(selectId) : null;
  if (select) select.value = state.mode;
  majPeriodeDisplay(labelId, datesId, getPeriodeRange(state.mode, state.offset));
  if (typeof refreshFn === 'function') refreshFn();
}

// L3811 (script.js d'origine)
function navSimplePeriode(state, delta, refreshFn, labelId, datesId, selectId) {
  state.offset += delta || 0;
  var select = selectId ? document.getElementById(selectId) : null;
  if (select) select.value = state.mode;
  majPeriodeDisplay(labelId, datesId, getPeriodeRange(state.mode, state.offset));
  if (typeof refreshFn === 'function') refreshFn();
}

// L3819 (script.js d'origine)
function resetSimplePeriode(state, refreshFn, labelId, datesId, selectId) {
  state.offset = 0;
  navSimplePeriode(state, 0, refreshFn, labelId, datesId, selectId);
}

// L3828 (script.js d'origine)
function navInspSemaine(delta) { _inspPeriode.mode = 'semaine'; if (delta === 0) _inspPeriode.offset = 0; else _inspPeriode.offset += delta; navInspectionsPeriode(0); }

// L3841 (script.js d'origine)
function navCarbMois(delta) { _carbPeriode.mode = 'mois'; if (delta === 0) _carbPeriode.offset = 0; else _carbPeriode.offset += delta; navCarburantPeriode(0); }

// L3842 (script.js d'origine)
function getCarbMoisStr() { return getCarburantPeriodeRange().debut.slice(0,7); }

// L3848 (script.js d'origine)
function navEntrMois(delta) { _entrPeriode.mode = 'mois'; if (delta === 0) _entrPeriode.offset = 0; else _entrPeriode.offset += delta; navEntretiensPeriode(0); }

// L3849 (script.js d'origine)
function getEntrMoisStr() { return getEntretiensPeriodeRange().debut.slice(0,7); }

// L3852 (script.js d'origine)
function getPeriodeRange(mode, offset) {
  mode = mode || 'mois';
  offset = offset || 0;
  var base = new Date();
  base.setHours(0, 0, 0, 0);

  if (mode === 'jour') {
    base.setDate(base.getDate() + offset);
    var jour = dateToLocalISO(base);
    return {
      mode: mode,
      debut: jour,
      fin: jour,
      label: formatPeriodeDateFr(base),
      datesLabel: 'Du ' + formatPeriodeDateFr(base) + ' au ' + formatPeriodeDateFr(base)
    };
  }

  if (mode === 'semaine') {
    var lundi = getStartOfWeek(base);
    lundi.setDate(lundi.getDate() + (offset * 7));
    var dim = new Date(lundi);
    dim.setDate(lundi.getDate() + 6);
    return {
      mode: mode,
      debut: dateToLocalISO(lundi),
      fin: dateToLocalISO(dim),
      label: 'Semaine ' + getNumSemaine(lundi),
      datesLabel: 'Du ' + formatPeriodeDateFr(lundi) + ' au ' + formatPeriodeDateFr(dim)
    };
  }

  if (mode === 'annee') {
    var annee = base.getFullYear() + offset;
    var debutA = new Date(annee, 0, 1);
    var finA = new Date(annee, 11, 31);
    return {
      mode: mode,
      debut: dateToLocalISO(debutA),
      fin: dateToLocalISO(finA),
      label: String(annee),
      datesLabel: 'Du ' + formatPeriodeDateFr(debutA) + ' au ' + formatPeriodeDateFr(finA)
    };
  }

  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  var debut = new Date(base.getFullYear(), base.getMonth(), 1);
  var finD = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    mode: 'mois',
    debut: dateToLocalISO(debut),
    fin: dateToLocalISO(finD),
    label: debut.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),
    datesLabel: 'Du ' + formatPeriodeDateFr(debut) + ' au ' + formatPeriodeDateFr(finD)
  };
}

