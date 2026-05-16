/**
 * MCA Logistics — Admin legacy afficherPlanningSemaine (vue planning semaine ISO) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1739-1831 (2026-05-16).
 */

afficherPlanningSemaine = function() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var planningRange = getPeriodeRange(_planningPeriode.mode, _planningPeriode.offset);
  var planningSelect = document.getElementById('vue-planning-select');
  if (planningSelect) planningSelect.value = _planningPeriode.mode;
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
  var labelSemaine = planningRange.label || ('Semaine ' + getNumSemaine(lundi) + ' — ' + lundi.getFullYear());
  var labelDates = planningRange.datesLabel || ('Du ' + formatPeriodeDateFr(lundi) + ' au ' + formatPeriodeDateFr(dimanche));
  var elLabel = document.getElementById('planning-semaine-label');
  var elDates = document.getElementById('planning-semaine-dates');
  if (elLabel) elLabel.textContent = labelSemaine;
  if (elDates) elDates.textContent = labelDates;

  initFormulairePlanningRapide();

  var thead = document.getElementById('thead-planning-semaine');
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + datesSemaine.map(function(d,i) {
      var isAuj = dateToLocalISO(d) === aujourdhui();
      return '<th style="text-align:center;' + (isAuj ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[i] + ' ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '</th>';
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
      var absJour = absences.find(function(a) { return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin; });
      if (absJour) totalAbsences++;
      var jour = plan ? (plan.semaine||[]).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (jour && jour.travaille) aUnJourTravaille = true;
    });
    if (aUnJourTravaille) totalPlanifies++;
  });

  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
  if (!salariesFiltres.length) { tb.innerHTML = emptyState('🔍', 'Aucun résultat', 'Aucun salarié ne correspond à la recherche.'); return; }

  var typeIcons = { travail:'🟢', repos:'⚪', conge:'🔵', absence:'🟡', maladie:'🟣' };
  const renderPlanningCell = function(className, title, detail, note) {
    return '<td><div class="planning-week-state ' + className + '"><span>' + title + '</span>' + (detail ? '<span class="planning-week-time">' + detail + '</span>' : '') + (note ? '<span class="planning-week-note">' + note + '</span>' : '') + '</div></td>';
  };

  tb.innerHTML = salariesFiltres.map(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var cellules = datesSemaine.map(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = absences.find(function(a) { return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin; });
      if (absJour) {
        var labelAbs = absJour.type === 'conge' ? 'Congé' : absJour.type === 'maladie' ? 'Maladie' : 'Absence';
        return renderCell('is-' + absJour.type, (typeIcons[absJour.type] || '🟡') + ' ' + labelAbs, '', '');
      }

      var jour = plan ? (plan.semaine||[]).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (!jour || !jour.travaille) {
        if (jour && ['conge','absence','maladie'].includes(jour.typeJour)) {
          var lb = jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence';
          return renderCell('is-' + jour.typeJour, (typeIcons[jour.typeJour] || '⚪') + ' ' + lb, '', '');
        }
        return renderCell('is-rest', 'Repos', '', '');
      }

      return renderCell('is-work', 'Travail', (jour.heureDebut||'') + (jour.heureFin ? ' – ' + jour.heureFin : ''), jour.zone || '');
    }).join('');

    return '<tr><td><div class="planning-week-salarie"><strong>' + s.nom + '</strong>' + (s.poste ? '<span class="planning-week-meta">' + s.poste + '</span>' : '') + (s.numero ? '<span class="planning-week-meta">#' + s.numero + '</span>' : '') + '</div></td>' + cellules + '</tr>';
  }).join('');
};

if (typeof window !== 'undefined') {
  window.afficherPlanningSemaine = afficherPlanningSemaine;
}
