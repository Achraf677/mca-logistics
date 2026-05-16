/**
 * MCA Logistics — PLANNING REWRITE FINAL — bare global assignments (toggle/peupler/filtrer/genererGrille/sauvegarder/etc.) (Phase X — extraction script.js)
 *
 * Extracted from script.js L3407-3815 (2026-05-16).
 */

/* ===== PLANNING REWRITE FINAL ===== */
toggleAbsenceTypeFields = function() {
  var type = document.getElementById('absence-type')?.value || 'travail';
  var startWrap = document.getElementById('absence-heure-debut-wrap');
  var endWrap = document.getElementById('absence-heure-fin-wrap');
  if (startWrap) startWrap.style.display = type === 'travail' ? '' : 'none';
  if (endWrap) endWrap.style.display = type === 'travail' ? '' : 'none';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (salarie) genererGrilleJours();
};

mettreAJourTotalHeuresPlanning = function() {
  var total = 0;
  JOURS.forEach(function(jour) {
    if ((document.getElementById('plan-type-' + jour)?.value || 'repos') !== 'travail') return;
    total += calculerDureeJour(
      document.getElementById('plan-debut-' + jour)?.value || '',
      document.getElementById('plan-fin-' + jour)?.value || ''
    );
  });
  var el = document.getElementById('plan-total-heures');
  if (el) el.textContent = total.toFixed(1) + ' h';
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
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle) modalTitle.textContent = 'Horaires hebdomadaires';
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
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle) modalTitle.textContent = 'Horaires hebdomadaires';
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
  if (!salarie) return afficherToast('Choisis un salarié', 'error');
  // Cote PC, ce form edite le PATTERN recurrent (planning hebdo type).
  // Ecriture dans planning.pattern (v2) + planning.semaine (legacy backward compat).
  var nouvelleSemaine = JOURS.map(function(jour) {
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
  });
  if (nouvelleSemaine.some(function(j) { return j.typeJour === 'travail' && j.heureDebut && j.heureFin && calculerDureeJour(j.heureDebut, j.heureFin) <= 0; })) {
    return afficherToast('Certaines heures sont invalides', 'error');
  }
  var plannings = charger('plannings');
  var index = plannings.findIndex(function(p) { return p.salId === salarie.id; });
  var existant = index > -1 ? plannings[index] : { salId: salarie.id };
  if (typeof migrerPlanningV2 === 'function') migrerPlanningV2(existant);
  var planning = Object.assign({}, existant, {
    salId: salarie.id,
    salNom: salarie.nom || '',
    semaine: nouvelleSemaine,
    pattern: { actif: true, semaine: nouvelleSemaine },
    semaines: existant.semaines || {},
    mis_a_jour: new Date().toISOString()
  });
  if (index > -1) plannings[index] = planning;
  else plannings.push(planning);
  sauvegarder('plannings', plannings);
  closeModal('modal-planning');
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning enregistré (récurrent toutes semaines)');
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
  if (!salarie) return afficherToast('Choisis un salarié', 'error');
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; });
  if (!planning || !planning.semaine || !planning.semaine.length) return afficherToast('Aucun planning existant à copier', 'error');
  genererGrilleJours();
};

afficherPlanning = function() {
  peuplerSelectPlanningModal();
};

reinitialiserFormulairePlanningRapide = function() {
  ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var search = document.getElementById('absence-sal-search');
  var select = document.getElementById('absence-sal');
  var type = document.getElementById('absence-type');
  var btn = document.getElementById('planning-submit-btn');
  if (search) search.value = '';
  if (select) select.value = '';
  if (type) type.value = 'travail';
  if (btn) btn.textContent = '+ Enregistrer';
  toggleAbsenceTypeFields();
};

initFormulairePlanningRapide = function() {
  peuplerAbsenceSal();
  toggleAbsenceTypeFields();
};

ajouterPeriodeAbsence = function() {
  var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debut = document.getElementById('absence-debut')?.value || '';
  var fin = document.getElementById('absence-fin')?.value || '';
  var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
  var heureFin = document.getElementById('absence-heure-fin')?.value || '';
  var editId = document.getElementById('absence-edit-id')?.value || '';
  if (!salarie || !debut || !fin) return afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
  if (fin < debut) return afficherToast('La date de fin doit être postérieure à la date de début', 'error');

  if (type === 'travail') {
    if (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0) {
      return afficherToast('Renseigne des horaires valides', 'error');
    }
    var plannings = charger('plannings');
    var indexPlan = plannings.findIndex(function(p) { return p.salId === salarie.id; });
    var planning = indexPlan > -1 ? plannings[indexPlan] : { salId: salarie.id, salNom: salarie.nom || '', semaine: [] };
    planning.salNom = salarie.nom || '';
    planning.semaine = Array.isArray(planning.semaine) ? planning.semaine : [];
    getDateRangeInclusive(debut, fin).forEach(function(dateObj) {
      var jourNom = JOURS[(dateObj.getDay() + 6) % 7];
      var indexJour = planning.semaine.findIndex(function(j) { return j.jour === jourNom; });
      var dataJour = {
        jour: jourNom,
        travaille: true,
        typeJour: 'travail',
        heureDebut: heureDebut,
        heureFin: heureFin,
        zone: indexJour > -1 ? (planning.semaine[indexJour].zone || '') : '',
        note: indexJour > -1 ? (planning.semaine[indexJour].note || '') : ''
      };
      if (indexJour > -1) planning.semaine[indexJour] = { ...planning.semaine[indexJour], ...dataJour };
      else planning.semaine.push(dataJour);
    });
    planning.mis_a_jour = new Date().toISOString();
    if (indexPlan > -1) plannings[indexPlan] = planning;
    else plannings.push(planning);
    sauvegarder('plannings', plannings);
    reinitialiserFormulairePlanningRapide();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    return afficherToast('Créneau de travail enregistré');
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
  var colors = { repos:'#6b7280', conge:'#3498db', maladie:'#9b59b6', absence:'#f39c12' };
  var labels = { repos:'Repos', conge:'Congé', maladie:'Maladie', absence:'Absence' };
  var absences = charger('absences_periodes').sort(function(a, b) { return new Date(b.debut) - new Date(a.debut); });
  if (!absences.length) {
    container.innerHTML = '<div class="planning-empty-note">Aucune période enregistrée.</div>';
    return;
  }
  container.innerHTML = absences.map(function(absence) {
    var salarie = salaries.find(function(s) { return s.id === absence.salId; });
    var labelSal = planningBuildEmployeeLabel(salarie || { nom: absence.salNom || 'Salarié supprimé' });
    return '<div class="planning-period-item">'
      + '<span class="planning-period-dot" style="background:' + (colors[absence.type] || '#f39c12') + '"></span>'
      + '<div class="planning-period-content"><div class="planning-period-title">' + (labels[absence.type] || 'Période') + ' - ' + labelSal + '</div>'
      + '<div class="planning-period-meta">Du ' + formatDateExport(absence.debut) + ' au ' + formatDateExport(absence.fin) + '</div></div>'
      + '<div class="planning-period-actions"><button type="button" onclick="editerPeriodeAbsence(\'' + absence.id + '\')">Modifier</button><button type="button" class="danger" onclick="supprimerAbsencePeriode(\'' + absence.id + '\')">Supprimer</button></div>'
      + '</div>';
  }).join('');
};

editerPeriodeAbsence = function(id) {
  var absence = charger('absences_periodes').find(function(a) { return a.id === id; });
  if (!absence) return;
  peuplerAbsenceSal();
  var salarie = charger('salaries').find(function(s) { return s.id === absence.salId; });
  if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = absence.id;
  if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = absence.salId;
  if (document.getElementById('absence-sal-search') && salarie) document.getElementById('absence-sal-search').value = planningBuildEmployeeLabel(salarie);
  if (document.getElementById('absence-type')) document.getElementById('absence-type').value = absence.type;
  if (document.getElementById('absence-debut')) document.getElementById('absence-debut').value = absence.debut;
  if (document.getElementById('absence-fin')) document.getElementById('absence-fin').value = absence.fin;
  if (document.getElementById('planning-submit-btn')) document.getElementById('planning-submit-btn').textContent = 'Mettre à jour';
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
    return [planningBuildEmployeeLabel(salarie), salarie.nom, salarie.prenom, salarie.numero, salarie.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });
  var totalPlanifies = 0;
  var totalAbsences = 0;
  tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var hasWork = false;
    var cells = week.dates.map(function(dateObj, index) {
      var dateStr = dateToLocalISO(dateObj);
      var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
      if (absence) {
        totalAbsences += 1;
        return planningRenderWeekState('is-' + absence.type, absence.type === 'conge' ? 'Congé' : absence.type === 'maladie' ? 'Maladie' : 'Absence', '', '');
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
    return '<tr><td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>' + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '') + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '') + '</div></td>' + cells + '</tr>';
  }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
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
  var cols = week.dates.map(function(dateObj, index) {
    return '<th style="padding:8px 10px;text-align:center;color:#6b7280">' + JOURS_COURTS[index] + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>';
  }).join('');
  var rows = salaries.map(function(salarie, index) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var cells = week.dates.map(function(dateObj, dayIndex) {
      var dateStr = dateToLocalISO(dateObj);
      var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
      if (absence) return '<td style="padding:8px 10px;text-align:center">' + (absence.type === 'conge' ? 'Congé' : absence.type === 'maladie' ? 'Maladie' : 'Absence') + '</td>';
      var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[dayIndex]; });
      if (!jour) return '<td style="padding:8px 10px;text-align:center">Repos</td>';
      if (jour.typeJour === 'travail' && jour.travaille) return '<td style="padding:8px 10px;text-align:center">' + (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : '') + '</td>';
      return '<td style="padding:8px 10px;text-align:center">' + (jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : jour.typeJour === 'absence' ? 'Absence' : 'Repos') + '</td>';
    }).join('');
    return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + ';border-bottom:1px solid #e5e7eb"><td style="padding:8px 10px;font-weight:600">' + (salarie.nom || '') + (salarie.numero ? '<br><span style="font-size:.75rem;color:#6b7280">#' + salarie.numero + '</span>' : '') + '</td>' + cells + '</tr>';
  }).join('');
  var html = '<html><head><meta charset="utf-8"><title>Planning hebdomadaire</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111827">'
    + '<h1 style="margin:0 0 6px;font-size:22px">' + params.nom + '</h1>'
    + '<div style="color:#6b7280;margin-bottom:16px">Planning hebdomadaire - Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear() + '</div>'
    + renderBlocInfosEntreprise(params)
    + '<div style="margin-bottom:16px;font-size:14px;color:#374151">Période : ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche) + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left">Salarié</th>' + cols + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
    + '</body></html>';
  var popup = ouvrirPopupSecure('', '_blank');
  if (!popup) return afficherToast('Autorise les popups pour générer le PDF', 'error');
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(function() { popup.print(); }, 250);
  afficherToast('Rapport planning généré');
};

if (typeof window !== 'undefined') {
  window.toggleAbsenceTypeFields = toggleAbsenceTypeFields;
  window.peuplerAbsenceSal = peuplerAbsenceSal;
  window.filtrerRechercheAbsence = filtrerRechercheAbsence;
  window.peuplerSelectPlanningModal = peuplerSelectPlanningModal;
  window.filtrerRecherchePlanningModal = filtrerRecherchePlanningModal;
  window.mettreAJourTotalHeuresPlanning = mettreAJourTotalHeuresPlanning;
  window.toggleTypeJour = toggleTypeJour;
  window.genererGrilleJours = genererGrilleJours;
  window.ouvrirModalPlanning = ouvrirModalPlanning;
  window.ouvrirEditPlanning = ouvrirEditPlanning;
  window.sauvegarderPlanning = sauvegarderPlanning;
  window.supprimerPlanning = supprimerPlanning;
  window.copierSemainePrecedente = copierSemainePrecedente;
  window.afficherPlanning = afficherPlanning;
  window.reinitialiserFormulairePlanningRapide = reinitialiserFormulairePlanningRapide;
  window.initFormulairePlanningRapide = initFormulairePlanningRapide;
  window.ajouterPeriodeAbsence = ajouterPeriodeAbsence;
  window.afficherAbsencesPeriodes = afficherAbsencesPeriodes;
  window.editerPeriodeAbsence = editerPeriodeAbsence;
  window.supprimerAbsencePeriode = supprimerAbsencePeriode;
  window.afficherPlanningSemaine = afficherPlanningSemaine;
  window.filtrerPlanningSemaine = filtrerPlanningSemaine;
  window.exporterPlanningSemainePDF = exporterPlanningSemainePDF;
}
