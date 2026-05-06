/**
 * MCA Logistics — Module Planning
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// ============================================================
// Helpers v2 (sprint-95pct) : pattern récurrent + saisies par semaine.
// Cf. mobile (M.migrerPlanningV2 / M.getSemaineDataForDate) — même logique.
// ============================================================

const _JOURS_FR_ORDRE = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

// Lundi de la semaine contenant `dateRef` (ou aujourd'hui), avec offset en semaines.
function lundiSemaineFromOffset(offset, dateRef) {
  const ref = dateRef ? new Date(dateRef) : new Date();
  const jour = ref.getDay();
  const decalLundi = jour === 0 ? -6 : 1 - jour;
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + decalLundi + (offset || 0) * 7);
}

// Migration boot (idempotente) : v1 (semaine[]) -> v2 (pattern + semaines{}).
function migrerPlanningV2(planning) {
  if (!planning || typeof planning !== 'object') return planning;
  if (!planning.pattern) {
    planning.pattern = {
      actif: !!(planning.semaine && planning.semaine.length),
      semaine: Array.isArray(planning.semaine) ? planning.semaine.slice() : []
    };
  }
  if (!planning.semaines || typeof planning.semaines !== 'object') {
    planning.semaines = {};
  }
  return planning;
}

// Retourne les 7 jours de la semaine commençant à `lundiDate` (objet Date).
// Source : semaines[lundiISO] si existe, sinon pattern.semaine, sinon legacy semaine[].
function getSemaineDataForDate(planning, lundiDate) {
  migrerPlanningV2(planning);
  const lundiISO = toLocalISODate(lundiDate);
  const overrideSemaine = planning.semaines && planning.semaines[lundiISO];
  const result = [];
  for (let i = 0; i < 7; i++) {
    const jourDate = new Date(lundiDate.getFullYear(), lundiDate.getMonth(), lundiDate.getDate() + i);
    const jourCle = _JOURS_FR_ORDRE[i];
    const dateISO = toLocalISODate(jourDate);
    let entry = null;
    if (Array.isArray(overrideSemaine)) {
      entry = overrideSemaine.find(j => j && (j.date === dateISO || j.jour === jourCle));
    }
    if (!entry && planning.pattern && planning.pattern.actif && Array.isArray(planning.pattern.semaine)) {
      const tmpl = planning.pattern.semaine.find(j => j && j.jour === jourCle);
      if (tmpl) entry = Object.assign({}, tmpl);
    }
    if (!entry && Array.isArray(planning.semaine)) {
      const legacy = planning.semaine.find(j => j && j.jour === jourCle);
      if (legacy) entry = Object.assign({}, legacy);
    }
    if (!entry) entry = { jour: jourCle };
    entry.date = dateISO;
    entry.jour = jourCle;
    result.push(entry);
  }
  return result;
}

// L1197 (script.js d'origine)
function ouvrirPlanningSalarie(salId) {
  var salarie = charger('salaries').find(function(item) { return item.id === salId; });
  naviguerVers('planning');
  setTimeout(function() {
    var filtre = document.getElementById('filtre-planning-salarie');
    if (filtre) filtre.value = salarie?.nom || '';
    if (typeof afficherPlanningSemaine === 'function') afficherPlanningSemaine();
  }, 120);
}

// L1207 (script.js d'origine)
function ouvrirPlanningRecurrence() {
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle) {
    modalTitle.textContent = '🔁 Horaires récurrents';
    // Marque la modal pour que ouvrirModalPlanning ne reset pas le titre
    modalTitle.dataset.recurrent = '1';
  }
  ouvrirModalPlanning();
  // Nettoie le marker au close
  var modal = document.getElementById('modal-planning');
  if (modal && !modal.dataset.recurrentBound) {
    modal.dataset.recurrentBound = '1';
    modal.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
        if (modalTitle) delete modalTitle.dataset.recurrent;
      }
    });
  }
}

// L2398 (script.js d'origine)
function toggleAbsenceTypeFields() {
  const type = document.getElementById('absence-type')?.value || 'conge';
  const debutWrap = document.getElementById('absence-heure-debut-wrap');
  const finWrap = document.getElementById('absence-heure-fin-wrap');
  if (debutWrap) debutWrap.style.display = type === 'travail' ? '' : 'none';
  if (finWrap) finWrap.style.display = type === 'travail' ? '' : 'none';
}

// L2406 (script.js d'origine)
function initFormulairePlanningRapide() {
  appliquerLibellesAnalyseHT();
  const panelTitle = document.querySelector('#page-planning .planning-panel-title');
  if (panelTitle) panelTitle.textContent = 'Ajouter une période planning';
  const btn = document.querySelector('#page-planning .planning-absence-form .btn-primary');
  if (btn) btn.textContent = '+ Enregistrer la période';

  const typeSelect = document.getElementById('absence-type');
  if (typeSelect && !typeSelect.querySelector('option[value="travail"]')) {
    typeSelect.insertAdjacentHTML('afterbegin', '<option value="travail">Travail</option>');
    typeSelect.onchange = toggleAbsenceTypeFields;
  }

  const finField = document.getElementById('absence-fin')?.closest('.planning-field');
  if (finField && !document.getElementById('absence-heure-debut')) {
    finField.insertAdjacentHTML('afterend', `
      <div class="planning-field" id="absence-heure-debut-wrap">
        <label>Heure début</label>
        <input type="time" id="absence-heure-debut" />
      </div>
      <div class="planning-field" id="absence-heure-fin-wrap">
        <label>Heure fin</label>
        <input type="time" id="absence-heure-fin" />
      </div>
    `);
  }

  const toolbar = document.querySelector('#page-planning .planning-table-toolbar');
  if (toolbar && !toolbar.querySelector('.planning-table-search')) {
    const toolbarInput = toolbar.querySelector('#filtre-planning-salarie');
    const firstBlock = toolbar.children[0];
    if (firstBlock) firstBlock.classList.add('planning-table-toolbar-main');
    if (toolbarInput) {
      const searchWrap = document.createElement('div');
      searchWrap.className = 'planning-table-search';
      toolbarInput.parentNode.insertBefore(searchWrap, toolbarInput);
      searchWrap.appendChild(toolbarInput);
    }
  }

  const weekTable = document.querySelector('#page-planning .table-wrapper table');
  if (weekTable) weekTable.classList.add('planning-week-grid');
  const weekWrapper = document.querySelector('#page-planning .table-wrapper');
  if (weekWrapper) weekWrapper.classList.add('planning-week-table');

  toggleAbsenceTypeFields();
}

// L2885 (script.js d'origine)
function rafraichirVuePlanningAdmin() {
  afficherPlanning();
  if (typeof afficherPlanningSemaine === 'function') afficherPlanningSemaine();
  if (typeof peuplerAbsenceSal === 'function') peuplerAbsenceSal();
  if (typeof afficherAbsencesPeriodes === 'function') afficherAbsencesPeriodes();
}

// L5350 (script.js d'origine)
function afficherPlanning() {
  const salaries  = charger('salaries');
  const plannings = loadSafe('plannings', []);
  const tb = document.getElementById('tb-planning');

  // Mettre à jour le select du modal
  const sel = document.getElementById('plan-salarie');
  if (sel) {
    const valeur = sel.value;
    sel.innerHTML = '<option value="">-- Choisir un salarié --</option>';
    salaries.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nom} (${s.numero})</option>`; });
    sel.value = valeur;
  }

  if (!salaries.length) { tb.innerHTML = '<tr><td colspan="9" class="empty-row">Aucun salarié</td></tr>'; return; }

  tb.innerHTML = salaries.map(s => {
    const plan = plannings.find(p => p.salId === s.id);
    const cellules = JOURS.map(j => {
      if (!plan) return '<td style="color:var(--text-muted);font-size:.75rem">—</td>';
      const jour = plan.semaine?.find(d => d.jour === j);
      if (!jour || !jour.travaille) return '<td style="color:var(--text-muted);font-size:.8rem;text-align:center">🔴</td>';
      return `<td style="text-align:center;font-size:.78rem"><span style="color:var(--green)">🟢</span>${jour.heureDebut ? '<br><span style="color:var(--muted)">'+jour.heureDebut+'</span>' : ''}</td>`;
    }).join('');
    return `<tr>
      <td><strong>${s.nom}</strong></td>
      ${cellules}
      <td>
        <button class="btn-icon" onclick="ouvrirEditPlanning('${s.id}')" title="Modifier">✏️</button>
        ${plan ? `<button class="btn-icon danger" onclick="supprimerPlanning('${s.id}')" title="Supprimer">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// L5435 (script.js d'origine)
function toggleJourPlanning(jour) {
  const cb  = document.getElementById('plan-travaille-'+jour);
  const det = document.getElementById('plan-horaires-'+jour);
  if (det) det.style.display = cb.checked ? 'grid' : 'none';
  mettreAJourTotalHeuresPlanning();
}

// L5442 (script.js d'origine)
function ouvrirModalPlanning() {
  peuplerSelectPlanningModal();
  const search = document.getElementById('plan-salarie-search');
  if (search) search.value = '';
  const sel = document.getElementById('plan-salarie');
  if (sel) sel.value = '';
  const grid = document.getElementById('plan-jours-grid');
  if (grid) grid.innerHTML = '';
  mettreAJourTotalHeuresPlanning();
  openModal('modal-planning');
}

// L5454 (script.js d'origine)
function ouvrirEditPlanning(salId) {
  const sel = document.getElementById('plan-salarie');
  if (!sel) return;
  peuplerSelectPlanningModal();
  sel.value = salId;
  const search = document.getElementById('plan-salarie-search');
  const sal = charger('salaries').find(s => s.id === salId);
  if (search) search.value = sal ? `${sal.nom}${sal.numero ? ' ('+sal.numero+')' : ''}` : '';
  genererGrilleJours();
  document.getElementById('modal-planning').classList.add('open');
}

// L5502 (script.js d'origine)
function sauvegarderPlanning() {
  const salId = document.getElementById('plan-salarie').value;
  if (!salId) { afficherToast('⚠️ Choisissez un salarié', 'error'); return; }

  const semaine = JOURS.map(jour => {
    const travaille = document.getElementById('plan-travaille-'+jour)?.checked || false;
    const typeJour  = document.getElementById('plan-type-'+jour)?.value || 'travail';
    return {
      jour,
      travaille,
      typeJour,
      heureDebut: travaille ? (document.getElementById('plan-debut-'+jour)?.value || '') : '',
      heureFin:   travaille ? (document.getElementById('plan-fin-'+jour)?.value   || '') : '',
      zone:       travaille ? (document.getElementById('plan-zone-'+jour)?.value  || '') : '',
      note:       travaille ? (document.getElementById('plan-note-'+jour)?.value  || '') : '',
    };
  });

  const plannings = loadSafe('plannings', []);
  const idx = plannings.findIndex(p => p.salId === salId);
  const sal = charger('salaries').find(s => s.id === salId);
  const entry = { salId, salNom: sal?.nom || '', semaine, mis_a_jour: new Date().toISOString() };

  if (idx > -1) plannings[idx] = entry;
  else          plannings.push(entry);
  localStorage.setItem('plannings', JSON.stringify(plannings));

  closeModal('modal-planning');
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast(`✅ Planning de ${sal?.nom || 'salarié'} enregistré`);

  // Contrôle CE 561/2006 après save (non bloquant)
  try {
    const conf = verifierConformiteConduiteCE561(semaine);
    if (!conf.ok && conf.warnings.length) {
      conf.warnings.forEach(function(w) { afficherToast(w, 'warning'); });
      if (typeof ajouterEntreeAudit === 'function') {
        ajouterEntreeAudit('Conformité CE 561/2006',
          'Planning ' + (sal?.nom || salId) + ' — ' + conf.warnings.length + ' alerte(s) temps de conduite');
      }
    }
  } catch (e) { console.warn('[CE561]', e); }
}

// L5548 (script.js d'origine)
async function supprimerPlanning(salId) {
  const _ok9 = await confirmDialog('Supprimer le planning de ce salarié ?', {titre:'Supprimer le planning',icone:'📅',btnLabel:'Supprimer'});
  if (!_ok9) return;
  const plannings = loadSafe('plannings', []).filter(p => p.salId !== salId);
  localStorage.setItem('plannings', JSON.stringify(plannings));
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('🗑️ Planning supprimé');
}

// L6390 (script.js d'origine)
function getPlanningPeriodForDate(salId, dateStr, periodes) {
  return (periodes || charger('absences_periodes')).find(function(item) {
    return item.salId === salId && dateStr >= item.debut && dateStr <= item.fin;
  }) || null;
}

// L6396 (script.js d'origine)
function planningGetVehicleForSalarie(salId) {
  return charger('vehicules').find(function(item) { return item.salId === salId; }) || null;
}

// L6400 (script.js d'origine)
function planningGetLivraisonsForDate(salId, dateStr) {
  return charger('livraisons').filter(function(item) {
    return item.chaufId === salId && item.date === dateStr;
  });
}

// L6410 (script.js d'origine)
function planningGetIndisponibilitePourDate(salId, dateStr) {
  if (!salId || !dateStr) return null;
  var periodes = charger('absences_periodes');
  var periode = getPlanningPeriodForDate(salId, dateStr, periodes);
  if (periode && ['conge', 'absence', 'maladie'].includes(periode.type)) {
    return {
      type: periode.type,
      label: getPlanningPeriodLabel(periode.type),
      detail: 'Période du ' + formatDateExport(periode.debut) + ' au ' + formatDateExport(periode.fin)
    };
  }
  var planning = charger('plannings').find(function(item) { return item.salId === salId; }) || { semaine: [] };
  var dateObj = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(dateObj.getTime())) return null;
  var jourIdx = (dateObj.getDay() + 6) % 7;
  var jourNom = JOURS[jourIdx];
  // Lecture v2 : helper combine semaines (override) + pattern + legacy.
  var lundiSemaine = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() - jourIdx);
  var semaineData = getSemaineDataForDate(planning, lundiSemaine);
  var jour = semaineData[jourIdx] || null;
  if (jour && ['conge', 'absence', 'maladie'].includes(jour.typeJour)) {
    return {
      type: jour.typeJour,
      label: getPlanningPeriodLabel(jour.typeJour),
      detail: 'Planning hebdomadaire'
    };
  }
  return null;
}

// L6436 (script.js d'origine)
function planningOuvrirSaisieRapide(salId, dateStr, typeHint) {
  var salarie = charger('salaries').find(function(item) { return item.id === salId; });
  if (!salarie) return;
  naviguerVers('planning');
  setTimeout(function() {
    togglePlanningQuickPanel(true);
    initFormulairePlanningRapide();
    var search = document.getElementById('absence-sal-search');
    var select = document.getElementById('absence-sal');
    var type = document.getElementById('absence-type');
    var debut = document.getElementById('absence-debut');
    var fin = document.getElementById('absence-fin');
    if (search) search.value = planningBuildEmployeeLabel(salarie);
    if (select) select.value = salarie.id;
    if (type) type.value = typeHint || 'travail';
    if (debut) debut.value = dateStr || '';
    if (fin) fin.value = dateStr || '';
    toggleAbsenceTypeFields();
    document.querySelector('#page-planning .planning-absence-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

// L6458 (script.js d'origine)
function togglePlanningQuickPanel(forceOpen) {
  var panel = document.getElementById('planning-quick-panel');
  var button = document.getElementById('planning-toggle-quick-btn');
  if (!panel || !button) return;
  var shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.style.display === 'none';
  panel.style.display = shouldOpen ? 'grid' : 'none';
  button.textContent = shouldOpen ? 'Fermer' : '+ Ajouter une période';
}

// L6467 (script.js d'origine)
function planningCalculerRecapPeriode(salId, debut, fin) {
  var salarie = charger('salaries').find(function(item) { return item.id === salId; });
  var planning = (charger('plannings') || []).find(function(item) { return item.salId === salId; }) || { semaine: [] };
  var periodes = charger('absences_periodes');
  var livraisons = charger('livraisons').filter(function(item) {
    return item.chaufId === salId && item.date >= debut && item.date <= fin;
  });
  var inspections = charger('inspections').filter(function(item) {
    return item.salId === salId && item.date >= debut && item.date <= fin;
  });
  var incidents = planningGetOpenIncidentsForSalarie(salId);
  var dates = planningBuildDateArray(debut, fin);
  var workDays = 0;
  var absenceDays = 0;
  var plannedHours = 0;
  var detailDays = [];

  dates.forEach(function(dateObj) {
    var dateStr = planningDateToLocalISO(dateObj);
    var resolved = (function() {
      var periodEntry = getPlanningPeriodForDate(salId, dateStr, periodes);
      if (periodEntry) return { source: 'period', entry: periodEntry };
      // Lecture v2 : helper combine semaines (override) + pattern + legacy.
      var jourIdx = (dateObj.getDay() + 6) % 7;
      var lundiSemaine = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() - jourIdx);
      var semaineData = getSemaineDataForDate(planning, lundiSemaine);
      var recurring = semaineData[jourIdx] || null;
      return { source: 'recurring', entry: recurring };
    })();
    var entry = resolved.entry;
    if (!entry) {
      detailDays.push({ date: dateStr, title: 'Non planifié', detail: '', type: 'rest' });
      return;
    }
    if (resolved.source === 'period') {
      if (entry.type === 'travail') {
        workDays += 1;
        var dureePeriode = calculerDureeJour(entry.heureDebut || '', entry.heureFin || '');
        if (dureePeriode > 0) plannedHours += dureePeriode;
        detailDays.push({ date: dateStr, title: 'Travail', detail: (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : ''), type: 'work' });
      } else {
        absenceDays += 1;
        detailDays.push({ date: dateStr, title: getPlanningPeriodLabel(entry.type), detail: '', type: entry.type });
      }
      return;
    }
    if (entry.typeJour === 'travail' && entry.travaille) {
      workDays += 1;
      var duree = calculerDureeJour(entry.heureDebut || '', entry.heureFin || '');
      if (duree > 0) plannedHours += duree;
      detailDays.push({ date: dateStr, title: 'Travail', detail: (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : ''), type: 'work' });
      return;
    }
    if (['conge', 'absence', 'maladie', 'repos'].includes(entry.typeJour)) {
      if (entry.typeJour !== 'repos') absenceDays += 1;
      detailDays.push({ date: dateStr, title: entry.typeJour === 'repos' ? 'Repos' : getPlanningPeriodLabel(entry.typeJour), detail: '', type: entry.typeJour });
      return;
    }
    detailDays.push({ date: dateStr, title: 'Non planifié', detail: '', type: 'rest' });
  });

  return {
    salarie: salarie,
    livraisons: livraisons,
    inspections: inspections,
    incidents: incidents,
    workDays: workDays,
    absenceDays: absenceDays,
    plannedHours: plannedHours,
    detailDays: detailDays
  };
}

// L6537 (script.js d'origine)
function ouvrirRecapPlanningPeriode(salId, debut, fin, label) {
  var recap = planningCalculerRecapPeriode(salId, debut, fin);
  var container = document.getElementById('planning-recap-content');
  var salarie = recap.salarie;
  if (!container || !salarie) return;
  var vehicule = planningGetVehicleForSalarie(salId);
  container.innerHTML =
    '<div class="planning-panel-title" style="margin-bottom:4px">' + planningEscapeHtml(getSalarieNomComplet(salarie)) + '</div>'
    + '<div class="planning-toolbar-sub" style="margin-bottom:14px">' + planningEscapeHtml(label || ('Du ' + formatDateExport(debut) + ' au ' + formatDateExport(fin))) + (vehicule ? ' · 🚐 ' + planningEscapeHtml(vehicule.immat + (vehicule.modele ? ' — ' + vehicule.modele : '')) : '') + '</div>'
    + '<div class="planning-recap-grid">'
      + '<div class="planning-recap-card"><div class="planning-recap-card-label">Jours planifiés</div><div class="planning-recap-card-value">' + recap.workDays + '</div></div>'
      + '<div class="planning-recap-card"><div class="planning-recap-card-label">Absences / congés</div><div class="planning-recap-card-value">' + recap.absenceDays + '</div></div>'
      + '<div class="planning-recap-card"><div class="planning-recap-card-label">Heures prévues</div><div class="planning-recap-card-value">' + recap.plannedHours.toFixed(1).replace('.', ',') + ' h</div></div>'
      + '<div class="planning-recap-card"><div class="planning-recap-card-label">Livraisons</div><div class="planning-recap-card-value">' + recap.livraisons.length + '</div></div>'
      + '<div class="planning-recap-card"><div class="planning-recap-card-label">Inspections</div><div class="planning-recap-card-value">' + recap.inspections.length + '</div></div>'
      + '<div class="planning-recap-card"><div class="planning-recap-card-label">Incidents ouverts</div><div class="planning-recap-card-value">' + recap.incidents.length + '</div></div>'
    + '</div>'
    + '<div class="planning-recap-section"><h4>Jours de la période</h4><div class="planning-recap-list">'
      + (recap.detailDays.length ? recap.detailDays.map(function(item) {
          return '<div class="planning-recap-item"><strong>' + planningEscapeHtml(formatDateExport(item.date)) + '</strong> · ' + planningEscapeHtml(item.title) + (item.detail ? '<div class="planning-week-meta" style="margin-top:4px">' + planningEscapeHtml(item.detail) + '</div>' : '') + '</div>';
        }).join('') : '<div class="planning-recap-empty">Aucune donnée sur cette période.</div>')
    + '</div></div>'
    + '<div class="planning-recap-section"><h4>Livraisons liées</h4><div class="planning-recap-list">'
      + (recap.livraisons.length ? recap.livraisons.map(function(item) {
          return '<div class="planning-recap-item"><strong>' + planningEscapeHtml(item.numLiv || 'Livraison') + '</strong> · ' + planningEscapeHtml(item.client || 'Client') + '<div class="planning-week-meta" style="margin-top:4px">' + planningEscapeHtml(formatDateExport(item.date)) + ' · ' + planningEscapeHtml(item.statut || '—') + ' · ' + euros(item.prix || 0) + '</div></div>';
        }).join('') : '<div class="planning-recap-empty">Aucune livraison sur cette période.</div>')
    + '</div></div>'
    + '<div class="planning-recap-section"><h4>Inspections & incidents</h4><div class="planning-recap-list">'
      + (recap.inspections.length ? recap.inspections.map(function(item) {
          return '<div class="planning-recap-item"><strong>Inspection</strong><div class="planning-week-meta" style="margin-top:4px">' + planningEscapeHtml(formatDateExport(item.date)) + (item.commentaire ? ' · ' + planningEscapeHtml(item.commentaire) : '') + '</div></div>';
        }).join('') : '<div class="planning-recap-empty">Aucune inspection sur cette période.</div>')
      + (recap.incidents.length ? recap.incidents.map(function(item) {
          return '<div class="planning-recap-item"><strong>🚨 Incident</strong><div class="planning-week-meta" style="margin-top:4px">' + planningEscapeHtml(item.description || 'Incident') + '</div></div>';
        }).join('') : '')
    + '</div></div>';
  openModal('modal-planning-recap');
}

// L6575 (script.js d'origine)
function planningOuvrirFicheSalarie(salId) {
  if (!salId) return;
  naviguerVers('salaries');
  setTimeout(function() { ouvrirEditSalarie(salId); }, 140);
}

// L6583 (script.js d'origine)
function getPlanningPeriodLabel(type) {
  return type === 'travail' ? 'Travail'
    : type === 'repos' ? 'Repos'
    : type === 'conge' ? 'Congé'
    : type === 'maladie' ? 'Maladie'
    : 'Absence';
}

// L6896 (script.js d'origine)
function verifierTriggersPlanningAuto() {
  const salaries  = charger('salaries').filter(s=>s.actif);
  const plannings = loadSafe('plannings', []);
  const maintenant= new Date();
  const auj       = maintenant.toLocalISODate();
  const jourSem   = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][maintenant.getDay()];
  const hMin      = maintenant.getHours()*60 + maintenant.getMinutes();

  salaries.forEach(s => {
    const plan = plannings.find(p=>p.salId===s.id);
    const jour = plan?.semaine?.find(j=>j.jour===jourSem);
    if (!jour?.travaille || !jour.heureDebut || !jour.heureFin) return;

    const [hd,md] = jour.heureDebut.split(':').map(Number);
    const [hf,mf] = jour.heureFin.split(':').map(Number);
    const debutMin = hd*60+md;
    const finMin   = hf*60+mf;

    const cleDep = `auto_msg_dep_${s.id}_${auj}`;
    const cleFin = `auto_msg_fin_${s.id}_${auj}`;

    // H-15min avant départ → message de rappel tournée
    if (hMin >= debutMin-15 && hMin < debutMin && !localStorage.getItem(cleDep)) {
      const msgs = loadSafe('messages_'+s.id, []);
      const prenom = s.nom.split(' ')[0];
      msgs.push({ id:genId(), auteur:'admin',
        texte:`Bonjour ${prenom} 👋 Votre tournée démarre à ${jour.heureDebut}. Pensez à faire votre inspection véhicule et votre relevé km de départ. Bonne journée !`,
        lu:false, auto:true, creeLe:new Date().toISOString() });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      localStorage.setItem(cleDep, '1');
    }

    // H+30min après fin → rappel km retour
    if (hMin >= finMin+30 && hMin < finMin+60 && !localStorage.getItem(cleFin)) {
      const msgs = loadSafe('messages_'+s.id, []);
      const prenom = s.nom.split(' ')[0];
      msgs.push({ id:genId(), auteur:'admin',
        texte:`Bonsoir ${prenom}, n'oubliez pas d'enregistrer votre km de retour et votre plein si vous en avez fait un. Merci 🙏`,
        lu:false, auto:true, creeLe:new Date().toISOString() });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      localStorage.setItem(cleFin, '1');
    }
  });
}

// L9573 (script.js d'origine)
function ajouterPeriodeAbsence() {
  var salId = document.getElementById('absence-sal') ? document.getElementById('absence-sal').value : '';
  var type  = document.getElementById('absence-type') ? document.getElementById('absence-type').value : 'conge';
  var debut = document.getElementById('absence-debut') ? document.getElementById('absence-debut').value : '';
  var fin   = document.getElementById('absence-fin') ? document.getElementById('absence-fin').value : '';
  if (!salId || !debut || !fin) { afficherToast('⚠️ Salarié, date début et date fin obligatoires','error'); return; }
  if (fin < debut) { afficherToast('⚠️ La date de fin doit être après la date de début','error'); return; }
  var absences = loadSafe('absences_periodes', []);
  absences.push({ id:genId(), salId:salId, type:type, debut:debut, fin:fin, creeLe:new Date().toISOString() });
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  if (document.getElementById('absence-debut')) document.getElementById('absence-debut').value = '';
  if (document.getElementById('absence-fin')) document.getElementById('absence-fin').value = '';
  if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  var typeLabel = type==='conge'?'Congé':type==='maladie'?'Maladie':'Absence';
  afficherToast('✅ ' + typeLabel + ' du ' + debut + ' au ' + fin);
}

// L9593 (script.js d'origine)
function afficherAbsencesPeriodes() {
  var cont = document.getElementById('liste-absences-periodes');
  if (!cont) return;
  var absences = loadSafe('absences_periodes', []);
  var salaries = charger('salaries');
  var typeColors = { conge:'#3498db', absence:'#e74c3c', maladie:'#9b59b6' };
  var typeLabels = { conge:'Congé', absence:'Absence', maladie:'Maladie' };
  if (!absences.length) { cont.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">Aucune période enregistrée</div>'; return; }
  cont.innerHTML = absences.sort(function(a,b){return new Date(b.debut)-new Date(a.debut);}).map(function(a) {
    var sal = salaries.find(function(s){return s.id===a.salId;});
    var nbJours = Math.max(1, Math.round((new Date(a.fin)-new Date(a.debut))/(1000*60*60*24))+1);
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:4px;background:' + (typeColors[a.type]||'#6b7280') + '10;border:1px solid ' + (typeColors[a.type]||'#6b7280') + '30;border-radius:8px;font-size:.82rem">' +
      '<span style="color:' + (typeColors[a.type]||'#6b7280') + ';font-weight:600">' + (typeLabels[a.type]||a.type) + '</span>' +
      '<strong>' + (sal?sal.nom:'?') + '</strong>' +
      '<span style="color:var(--text-muted)">' + a.debut + ' → ' + a.fin + ' (' + nbJours + 'j)</span>' +
      '<button onclick="supprimerAbsencePeriode(\'' + a.id + '\')" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--red);font-size:.85rem" title="Supprimer">✕</button></div>';
  }).join('');
}

// L9612 (script.js d'origine)
function supprimerAbsencePeriode(id) {
  var absences = loadSafe('absences_periodes', []).filter(function(a){return a.id!==id;});
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('🗑️ Période supprimée');
}

// L9628 (script.js d'origine)
function peuplerAbsenceSal() {
  var sel = document.getElementById('absence-sal');
  if (!sel) return;
  var salaries = charger('salaries');
  var v = sel.value;
  sel.innerHTML = '<option value="">-- Choisir --</option>';
  salaries.forEach(function(s) { sel.innerHTML += '<option value="' + s.id + '">' + s.nom + (s.poste ? ' — ' + s.poste : '') + (s.numero ? ' (' + s.numero + ')' : '') + '</option>'; });
  sel.value = v;
}

// L9638 (script.js d'origine)
function filtrerRechercheAbsence() {
  peuplerAbsenceSal();
  var search = (document.getElementById('absence-sal-search')?.value || '').trim().toLowerCase();
  var sel = document.getElementById('absence-sal');
  if (!sel || !search) return;
  var match = charger('salaries').find(function(s) {
    return [s.nom, s.prenom, s.nomFamille, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
  if (match) sel.value = match.id;
}

// L9649 (script.js d'origine)
function peuplerSelectPlanningModal() {
  const sel = document.getElementById('plan-salarie');
  if (!sel) return;
  const salaries = charger('salaries');
  const currentValue = sel.value;
  sel.innerHTML = '<option value="">-- Choisir un salarié --</option>';
  salaries.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nom}${s.numero ? ' ('+s.numero+')' : ''}</option>`; });
  sel.value = currentValue;
}

// L9659 (script.js d'origine)
function filtrerRecherchePlanningModal() {
  peuplerSelectPlanningModal();
  const search = (document.getElementById('plan-salarie-search')?.value || '').trim().toLowerCase();
  const sel = document.getElementById('plan-salarie');
  if (!sel || !search) return;
  const match = charger('salaries').find(s => [s.nom, s.prenom, s.nomFamille, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(search));
  if (match) {
    sel.value = match.id;
    genererGrilleJours();
  }
}

// L9673 (script.js d'origine)
function filtrerPlanningSemaine() {
  afficherPlanningSemaine();
}

// L9699 (script.js d'origine)
function changerVuePlanning(mode) {
  _planningPeriode.mode = ['jour', 'semaine', 'mois', 'annee'].includes(mode) ? mode : 'semaine';
  _planningPeriode.offset = 0;
  _planningSemaineOffset = 0;
  afficherPlanningSemaine();
}

// L9706 (script.js d'origine)
function naviguerPlanningPeriode(delta) {
  _planningPeriode.offset += delta || 0;
  _planningSemaineOffset = _planningPeriode.offset;
  afficherPlanningSemaine();
}

// L9712 (script.js d'origine)
function reinitialiserPlanningPeriode() {
  _planningPeriode.offset = 0;
  _planningSemaineOffset = 0;
  afficherPlanningSemaine();
}

// L9718 (script.js d'origine)
function afficherPlanningSemaine() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var planningRange = getPeriodeRange(_planningPeriode.mode, _planningPeriode.offset);
  var planningSelect = document.getElementById('vue-planning-select');
  if (planningSelect) planningSelect.value = _planningPeriode.mode;
  var salaries  = charger('salaries');
  var plannings = loadSafe('plannings', []);
  var absences  = loadSafe('absences_periodes', []);

  var JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // Calculer les 7 dates de la semaine
  lundi.setHours(0,0,0,0);
  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    d.setHours(0,0,0,0);
    datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var labelSemaine = planningRange.label || ('Semaine ' + getNumSemaine(lundi) + ' — ' + lundi.getFullYear());
  var labelDates = planningRange.datesLabel || ('Du ' + formatPeriodeDateFr(lundi) + ' au ' + formatPeriodeDateFr(dimanche));

  var elLabel = document.getElementById('planning-semaine-label');
  var elDates = document.getElementById('planning-semaine-dates');
  if (elLabel) elLabel.textContent = labelSemaine;
  if (elDates) elDates.textContent = labelDates;

  // Thead avec dates
  var thead = document.getElementById('thead-planning-semaine');
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + datesSemaine.map(function(d,i) {
      const _y = d.getFullYear();
      const _m = String(d.getMonth()+1).padStart(2,'0');
      const _d = String(d.getDate()).padStart(2,'0');
      var isAuj = (_y+'-'+_m+'-'+_d) === aujourdhui();
      return '<th style="text-align:center;' + (isAuj?'color:var(--accent);font-weight:800':'') + '">' + JOURS_COURTS[i] + ' ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '</th>';
    }).join('') + '</tr>';
  }

  // Corps
  var tb = document.getElementById('tb-planning-semaine');
  if (!tb) return;

  if (!salaries.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>'; return; }

  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var salariesFiltres = salaries.filter(function(s) {
    if (!filtre) return true;
    return [s.nom, s.prenom, s.nomFamille, s.numero, s.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });

  var totalPlanifies = 0;
  var totalAbsences = 0;
  salariesFiltres.forEach(function(s) {
    var plan = plannings.find(function(p){return p.salId===s.id;});
    var aUnJourTravaille = false;
    datesSemaine.forEach(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = absences.find(function(a) {
        return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin;
      });
      if (absJour) totalAbsences++;
      var jour = plan ? (plan.semaine||[]).find(function(j){return j.jour===JOURS[i];}) : null;
      if (jour && jour.travaille) aUnJourTravaille = true;
    });
    if (aUnJourTravaille) totalPlanifies++;
  });
  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
  if (!salariesFiltres.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>'; return; }

  var typeColors = { travail:'var(--green)', repos:'var(--text-muted)', conge:'#3498db', absence:'#e74c3c', maladie:'#9b59b6' };
  var typeIcons  = { travail:'🟢', repos:'⚪', conge:'🔵', absence:'🟡', maladie:'🟣' };

  tb.innerHTML = salariesFiltres.map(function(s) {
    var plan = plannings.find(function(p){return p.salId===s.id;});

    var cellules = datesSemaine.map(function(d, i) {
      var dateStr = dateToLocalISO(d);

      // Vérifier si une période d'absence couvre ce jour
      var absJour = absences.find(function(a) {
        return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin;
      });

      if (absJour) {
        var label = absJour.type === 'conge' ? 'Congé' : absJour.type === 'maladie' ? 'Maladie' : 'Absent';
        return '<td style="text-align:center;background:' + (typeColors[absJour.type]||'#e74c3c') + '10;color:' + (typeColors[absJour.type]||'#e74c3c') + ';font-size:.78rem;font-weight:600">' + (typeIcons[absJour.type]||'🟡') + ' ' + label + '</td>';
      }

      // Sinon, planning type de la semaine
      var jourNom = JOURS[i];
      var jour = plan ? (plan.semaine||[]).find(function(j){return j.jour===jourNom;}) : null;

      if (!jour || !jour.travaille) {
        if (jour && ['conge','absence','maladie'].includes(jour.typeJour)) {
          var lb = jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absent';
          return '<td style="text-align:center;color:' + (typeColors[jour.typeJour]||'#6b7280') + ';font-size:.78rem">' + (typeIcons[jour.typeJour]||'⚪') + ' ' + lb + '</td>';
        }
        return '<td style="text-align:center;color:var(--text-muted);font-size:.78rem">⚪ Repos</td>';
      }

      return '<td style="text-align:center;color:var(--green);font-size:.78rem">🟢 ' + (jour.heureDebut||'') + (jour.heureFin ? ' – ' + jour.heureFin : '') + '</td>';
    }).join('');

    return '<tr><td><strong>' + s.nom + '</strong>' + (s.poste ? '<br><span style="font-size:.72rem;color:var(--text-muted)">' + s.poste + '</span>' : '') + (s.numero ? '<br><span style="font-size:.72rem;color:var(--text-muted)">#' + s.numero + '</span>' : '') + '</td>' + cellules + '</tr>';
  }).join('');
}

// L11648 (script.js d'origine)
function planningBuildEmployeeLabel(salarie) {
  return getSalarieNomComplet(salarie, { includePoste: true });
}

// L11652 (script.js d'origine)
function planningFindEmployeeBySearch(value) {
  var query = (value || '').trim().toLowerCase();
  if (!query) return null;
  return charger('salaries').find(function(s) {
    return [
      planningBuildEmployeeLabel(s),
      s.nom,
      s.prenom,
      s.nomFamille,
      s.poste,
      s.numero
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  }) || null;
}

// L11667 (script.js d'origine)
function planningEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// L11676 (script.js d'origine)
function planningDateToLocalISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

// L11705 (script.js d'origine)
function planningResolveSelectedEmployee(searchId, selectId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  if (!search || !select) return null;
  var exact = (search.value || '').trim().toLowerCase();
  var found = exact ? charger('salaries').find(function(s) {
    return planningBuildEmployeeLabel(s).toLowerCase() === exact;
  }) || null : null;
  if (!found && exact) {
    found = planningFindEmployeeBySearch(search.value) || null;
  }
  if (found) {
    select.value = found.id;
    search.value = planningBuildEmployeeLabel(found);
    return found;
  }
  if (select.value) {
    return charger('salaries').find(function(s) { return s.id === select.value; }) || null;
  }
  return null;
}

// L11727 (script.js d'origine)
function planningRenderEmployeeSuggestions(searchId, selectId, suggestionsId, onSelect) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  var suggestions = document.getElementById(suggestionsId);
  if (!search || !select || !suggestions) return;
  var query = (search.value || '').trim().toLowerCase();
  if (document.activeElement !== search || query.length < 2) {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    return;
  }
  var matches = charger('salaries').filter(function(s) {
    return [
      planningBuildEmployeeLabel(s),
      s.nom,
      s.prenom,
      s.nomFamille,
      s.poste,
      s.numero
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  }).slice(0, 6);
  if (!matches.length) {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    return;
  }
  suggestions.innerHTML = matches.map(function(s) {
    return '<button type="button" data-salarie-id="' + planningEscapeHtml(s.id) + '" style="display:block;width:100%;padding:10px 12px;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--border);cursor:pointer;color:var(--text-primary)">'
      + '<span style="display:block;font-weight:600">' + planningEscapeHtml(getSalarieNomComplet(s)) + '</span>'
      + (s.poste ? '<span style="display:block;font-size:.78rem;color:var(--text-muted);margin-top:2px">' + planningEscapeHtml(s.poste) + '</span>' : '')
      + '</button>';
  }).join('');
  suggestions.style.display = 'block';
  Array.from(suggestions.querySelectorAll('[data-salarie-id]')).forEach(function(button) {
    button.addEventListener('click', function() {
      var salarie = charger('salaries').find(function(item) { return item.id === button.dataset.salarieId; });
      if (!salarie) return;
      select.value = salarie.id;
      search.value = planningBuildEmployeeLabel(salarie);
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      if (typeof onSelect === 'function') onSelect(salarie);
    });
  });
}

// L11773 (script.js d'origine)
function planningRenderWeekState(className, title, detail, note) {
  var extraHtml = arguments.length > 4 ? (arguments[4] || '') : '';
  var cellAttrs = arguments.length > 5 ? (arguments[5] || '') : '';
  return '<td' + (cellAttrs ? ' ' + cellAttrs : '') + '><div class="planning-week-state ' + className + '">' + '<span>' + title + '</span>' + (detail ? '<span class="planning-week-time">' + detail + '</span>' : '') + (note ? '<span class="planning-week-note">' + note + '</span>' : '') + extraHtml + '</div></td>';
}

// L11779 (script.js d'origine)
function planningGetWeekDates() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var dates = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    dates.push(d);
  }
  return { lundi: lundi, dates: dates, dimanche: dates[6] };
}

// L11790 (script.js d'origine)
function planningBuildDateArray(startIso, endIso) {
  var dates = [];
  if (!startIso || !endIso) return dates;
  var cursor = new Date(startIso + 'T00:00:00');
  var end = new Date(endIso + 'T00:00:00');
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// L11802 (script.js d'origine)
function planningGetDisplayedPeriod() {
  var mode = _planningPeriode.mode || 'semaine';
  var range = getPeriodeRange(mode, _planningPeriode.offset);
  if (mode === 'annee') {
    var year = parseInt((range.debut || '').slice(0, 4), 10) || new Date().getFullYear();
    return {
      mode: mode,
      range: range,
      months: Array.from({ length: 12 }, function(_, idx) {
        return {
          index: idx,
          year: year,
          label: new Date(year, idx, 1).toLocaleDateString('fr-FR', { month: 'short' })
        };
      })
    };
  }
  if (mode === 'mois') {
    var dates = planningBuildDateArray(range.debut, range.fin);
    var weeks = [];
    dates.forEach(function(dateObj) {
      var weekStart = getStartOfWeek(dateObj);
      var weekKey = planningDateToLocalISO(weekStart);
      var existing = weeks.find(function(item) { return item.key === weekKey; });
      if (!existing) {
        var weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        existing = {
          key: weekKey,
          start: weekStart,
          end: weekEnd,
          dates: [],
          label: 'Sem. ' + getNumSemaine(weekStart),
          meta: formatDateExport(weekStart).slice(0, 5) + ' → ' + formatDateExport(weekEnd).slice(0, 5)
        };
        weeks.push(existing);
      }
      existing.dates.push(dateObj);
    });
    return {
      mode: mode,
      range: range,
      weeks: weeks
    };
  }
  return {
    mode: mode,
    range: range,
    dates: planningBuildDateArray(range.debut, range.fin)
  };
}

// L11854 (script.js d'origine)
function reinitialiserFormulairePlanningRapide() {
  ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var search = document.getElementById('absence-sal-search');
  var select = document.getElementById('absence-sal');
  if (search) search.value = '';
  if (select) select.value = '';
  var type = document.getElementById('absence-type');
  if (type) type.value = 'travail';
  var btn = document.getElementById('planning-submit-btn');
  if (btn) btn.textContent = '+ Enregistrer';
  toggleAbsenceTypeFields();
}

// L13162 (script.js d'origine)
function planningPrepareEmployeeInput(searchId, suggestionsId) {
  var search = document.getElementById(searchId);
  var suggestions = document.getElementById(suggestionsId);
  if (search) {
    search.removeAttribute('list');
    search.setAttribute('autocomplete', 'off');
  }
  var legacyDatalist = document.getElementById(searchId === 'absence-sal-search' ? 'absence-sal-datalist' : 'plan-salarie-datalist');
  if (legacyDatalist) legacyDatalist.innerHTML = '';
  if (suggestions) {
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
  }
}

