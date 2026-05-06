/**
 * MCA Logistics — Module Heures
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L373 (script.js d'origine)
function formatDateHeureExport(val) {
  const d = val ? new Date(val) : new Date();
  if (Number.isNaN(d.getTime())) return formatDateExport(val);
  return formatDateExport(d) + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

// L1210 (script.js d'origine)
function ouvrirHeuresSalarie(salId) {
  naviguerVers('heures');
  setTimeout(function() {
    var filtre = document.getElementById('filtre-heures-salarie');
    if (filtre) filtre.value = salId;
    if (typeof afficherCompteurHeures === 'function') afficherCompteurHeures();
    if (typeof afficherReleveKm === 'function') afficherReleveKm();
  }, 120);
}

// L2895 (script.js d'origine)
function rafraichirVueHeuresEtKm() {
  afficherCompteurHeures();
  afficherReleveKm();
}

// L6610 (script.js d'origine)
function getHeuresPeriodeRange() {
  if ((_heuresVue || 'semaine') === 'jour') return getPeriodeRange('jour', _heuresJourOffset || 0);
  if ((_heuresVue || 'semaine') === 'mois') return getPeriodeRange('mois', _heuresMoisOffset || 0);
  if ((_heuresVue || 'semaine') === 'annee') return getPeriodeRange('annee', _heuresAnneeOffset || 0);
  return { mode: 'semaine', ...getHeuresSemaineRange(), datesLabel: 'Du ' + formatPeriodeDateFr(getHeuresSemaineRange().lundi) + ' au ' + formatPeriodeDateFr(getHeuresSemaineRange().dimanche) };
}

// L6808 (script.js d'origine)
function construireContexteHeures(range) {
  const periodeRange = range || getHeuresPeriodeRange();
  const plannings = loadSafe('plannings', []);
  const absencesPeriodes = loadSafe('absences_periodes', []);
  const dates = getDateRangeInclusive(periodeRange.debut, periodeRange.fin);
  const planningsParSalarie = new Map();
  const absencesParSalarie = new Map();

  plannings.forEach(function(plan) {
    if (!plan || !plan.salId) return;
    planningsParSalarie.set(plan.salId, plan);
  });

  absencesPeriodes.forEach(function(periode) {
    if (!periode || !periode.salId) return;
    if (periode.fin < periodeRange.debut || periode.debut > periodeRange.fin) return;
    if (!absencesParSalarie.has(periode.salId)) absencesParSalarie.set(periode.salId, []);
    absencesParSalarie.get(periode.salId).push(periode);
  });

  return {
    range: periodeRange,
    dates: dates,
    planningsParSalarie: planningsParSalarie,
    absencesParSalarie: absencesParSalarie,
    absencesPeriodes: absencesPeriodes
  };
}

// L6845 (script.js d'origine)
function majHeuresPeriodeLabel() {
  const range = getHeuresPeriodeRange();
  const elL = document.getElementById('heures-semaine-label');
  const elD = document.getElementById('heures-semaine-dates');
  const prevBtn = document.getElementById('heures-prev-btn');
  const nextBtn = document.getElementById('heures-next-btn');
  const resetBtn = document.getElementById('heures-reset-btn');
  const totalCol = document.getElementById('heures-col-total');
  const detailCol = document.getElementById('heures-col-detail');
  const vue = document.getElementById('filtre-heures-vue');
  if (vue) vue.value = _heuresVue || 'semaine';
  if (elL) elL.textContent = range.mode === 'mois'
    ? range.label.charAt(0).toUpperCase() + range.label.slice(1)
    : range.label;
  if (elD) elD.textContent = range.datesLabel;
  if (prevBtn) prevBtn.textContent = 'Précédent';
  if (nextBtn) nextBtn.textContent = 'Suivant';
  if (resetBtn) resetBtn.textContent = 'Réinitialiser';
  if (totalCol) totalCol.textContent = range.mode === 'jour' ? 'H/jour' : range.mode === 'annee' ? 'H/année' : range.mode === 'mois' ? 'H/mois' : 'H/semaine';
  if (detailCol) detailCol.textContent = range.mode === 'jour' ? 'Détail du jour' : 'Détail période';
}

// L6867 (script.js d'origine)
function changerVueHeures(vue) {
  _heuresVue = ['jour', 'semaine', 'mois', 'annee'].includes(vue) ? vue : 'semaine';
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

// L6874 (script.js d'origine)
function naviguerHeuresPeriode(delta) {
  if ((_heuresVue || 'semaine') === 'jour') _heuresJourOffset += delta;
  else if ((_heuresVue || 'semaine') === 'mois') _heuresMoisOffset += delta;
  else if ((_heuresVue || 'semaine') === 'annee') _heuresAnneeOffset += delta;
  else _heuresSemaineOffset += delta;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

// L6884 (script.js d'origine)
function reinitialiserHeuresPeriode() {
  if ((_heuresVue || 'semaine') === 'jour') _heuresJourOffset = 0;
  else if ((_heuresVue || 'semaine') === 'mois') _heuresMoisOffset = 0;
  else if ((_heuresVue || 'semaine') === 'annee') _heuresAnneeOffset = 0;
  else _heuresSemaineOffset = 0;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

// L6894 (script.js d'origine)
function calculerHeuresSalarieSemaine(salId, contexte) {
  const ctx = contexte || construireContexteHeures();
  const range = ctx.range;
  const plan = ctx.planningsParSalarie.get(salId);
  const periodes = ctx.absencesParSalarie.get(salId) || [];
  const details = [];
  let total = 0;

  ctx.dates.forEach(dateObj => {
    const _fy = dateObj.getFullYear();
    const _fm = String(dateObj.getMonth()+1).padStart(2,'0');
    const _fd = String(dateObj.getDate()).padStart(2,'0');
    const dateStr = _fy+'-'+_fm+'-'+_fd;
    const periode = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periode) {
      if (periode.type === 'travail') {
        const dureePeriode = calculerDureeJour(periode.heureDebut || '', periode.heureFin || '');
        if (dureePeriode > 0) {
          total += dureePeriode;
          details.push({ date: dateStr, jour: JOURS[(dateObj.getDay() + 6) % 7], duree: dureePeriode });
        }
      }
      return;
    }
    if (!plan?.semaine) return;
    const jourNom = JOURS[(dateObj.getDay() + 6) % 7];
    const jourPlanning = plan.semaine.find(j => j.jour === jourNom);
    if (!jourPlanning || !jourPlanning.travaille || !jourPlanning.heureDebut || !jourPlanning.heureFin) return;
    const duree = calculerDureeJour(jourPlanning.heureDebut, jourPlanning.heureFin);
    if (duree <= 0) return;
    total += duree;
    details.push({ date: dateStr, jour: jourNom, duree });
  });

  return { planifiees: total, details };
}

// L6931 (script.js d'origine)
function afficherCompteurHeures() {
  const salaries = charger('salaries');
  const cont = document.getElementById('tb-heures');
  if (!cont) return;
  const range = getHeuresPeriodeRange();
  const contexteHeures = construireContexteHeures(range);
  const periode = document.getElementById('heures-periode-label');
  if (periode) periode.textContent = `${range.label} · ${range.datesLabel}`;

  const filtreSal = (document.getElementById('filtre-heures-salarie')?.value || '').trim().toLowerCase();

  // Afficher/masquer dates personnalisées
  const vue = document.getElementById('filtre-heures-vue')?.value || _heuresVue || 'semaine';
  const deb = document.getElementById('filtre-heures-debut');
  const fin = document.getElementById('filtre-heures-fin');
  if (deb) deb.style.display = vue === 'custom' ? 'inline-block' : 'none';
  if (fin) fin.style.display = vue === 'custom' ? 'inline-block' : 'none';

  const salFiltrees = filtreSal
    ? salaries.filter(function(s) {
        return [s.nom, s.prenom, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(filtreSal);
      })
    : salaries;
  if (!salFiltrees.length) {
    cont.innerHTML = emptyState('⏱️', 'Aucun salarié', filtreSal ? 'Aucun salarié ne correspond à cette recherche.' : 'Créez des salariés et définissez leur planning pour voir les heures.');
    return;
  }

  var totalEquipe = 0;
  // Heures réelles saisies via mobile (collection 'heures' partagée).
  // Si saisies sur la période -> les utiliser en priorité (réel vs planifié).
  const heuresSaisiesAll = charger('heures');
  cont.innerHTML = salFiltrees.map(s => {
    const { planifiees, details } = calculerHeuresSalarieSemaine(s.id, contexteHeures);
    const heuresReelles = heuresSaisiesAll
      .filter(h => (h.salId === s.id || h.salarieId === s.id) && h.date >= range.debut && h.date <= range.fin)
      .reduce((sum, h) => sum + (parseFloat(String(h.heures||'').replace(',', '.')) || 0), 0);
    const heuresAffich = heuresReelles > 0 ? heuresReelles : planifiees;
    totalEquipe += heuresAffich;
    const plan = contexteHeures.planningsParSalarie.get(s.id);
    const absencesPeriodes = contexteHeures.absencesPeriodes;
    const livraisons = charger('livraisons');

    const detailStr = details.length
      ? details.map(d => {
          const livJour = livraisons.filter(l => l.chaufId === s.id && l.date === d.date);
          const livLabel = livJour.length ? ' · ' + livJour.slice(0, 2).map(l => (l.client || l.numLiv || 'Livraison')).join(', ') : '';
          return `<div style="margin-bottom:4px"><strong>${JOURS_COURTS[(new Date(d.date + 'T00:00:00').getDay() + 6) % 7]}</strong> ${d.duree.toFixed(1)} h${livLabel}</div>`;
        }).join('')
      : '<span style="color:var(--text-muted)">—</span>';
    const absences = plan?.semaine?.filter(j=>['conge','absence','maladie'].includes(j.typeJour)) || [];
    const absencesPeriodeSemaine = absencesPeriodes.filter(a => a.salId===s.id && a.type !== 'travail' && a.fin >= range.debut && a.debut <= range.fin);
    const typeColors = { conge:'#3498db', absence:'#e74c3c', maladie:'#9b59b6' };
    const typeLabels = { conge:'🔵 Congé', absence:'🔴 Absence', maladie:'🟣 Maladie' };
    const absStr = absences.length
      ? absences.map(j=>`<span style="display:inline-block;background:${typeColors[j.typeJour]||'var(--muted)'}20;color:${typeColors[j.typeJour]||'var(--muted)'};padding:2px 8px;border-radius:12px;font-size:.72rem;margin:1px">${typeLabels[j.typeJour]||j.typeJour} ${j.jour.substring(0,3)}</span>`).join(' ')
      : '<span style="color:var(--text-muted);font-size:.78rem">—</span>';
    const absPeriodeStr = absencesPeriodeSemaine.map(a => `<span style="display:inline-block;background:${typeColors[a.type]||'var(--muted)'}20;color:${typeColors[a.type]||'var(--muted)'};padding:2px 8px;border-radius:12px;font-size:.72rem;margin:1px">${typeLabels[a.type]||a.type} ${formatDateExport(a.debut)} → ${formatDateExport(a.fin)}</span>`).join(' ');

    return `<tr>
      <td><strong>${s.nom}</strong></td>
      <td style="font-size:.78rem;color:var(--text-muted)">${s.poste||'—'}</td>
      <td><strong>${heuresAffich.toFixed(1)} h</strong>${heuresReelles > 0 ? `<div style="font-size:.7rem;color:var(--green);font-weight:500">réel · ${heuresReelles.toFixed(1)}h</div><div style="font-size:.66rem;color:var(--text-muted)">planifié ${planifiees.toFixed(1)}h</div>` : ''}</td>
      <td style="font-size:.78rem;color:var(--text-muted)">${detailStr}</td>
      <td>${absPeriodeStr || absStr}</td>
      <td><button class="btn-icon" onclick="ouvrirEditPlanning('${s.id}')" title="Planifier">📅</button></td>
    </tr>`;
  }).join('') + `<tr><td colspan="2"><strong>Total équipe</strong></td><td><strong>${totalEquipe.toFixed(1)} h</strong></td><td colspan="3"></td></tr>`;
}

// L6994 (script.js d'origine)
function resetFiltresHeures() {
  ['filtre-heures-salarie'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  _heuresVue = 'semaine';
  _heuresSemaineOffset = 0;
  _heuresMoisOffset = 0;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

// L10169 (script.js d'origine)
function mettreAJourTotalHeuresPlanning() {
  const el = document.getElementById('plan-total-heures');
  if (!el) return;
  let total = 0;
  JOURS.forEach(jour => {
    const typeJour = document.getElementById('plan-type-'+jour)?.value || 'travail';
    const travaille = document.getElementById('plan-travaille-'+jour)?.checked || false;
    if (!travaille || typeJour !== 'travail') return;
    total += calculerDureeJour(
      document.getElementById('plan-debut-'+jour)?.value || '',
      document.getElementById('plan-fin-'+jour)?.value || ''
    );
  });
  el.textContent = total.toFixed(1) + ' h';
}

// L10432 (script.js d'origine)
function navHeuresSemaine(delta) {
  _heuresVue = 'semaine';
  if (delta === 0) _heuresSemaineOffset = 0;
  else _heuresSemaineOffset += delta;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

// L10440 (script.js d'origine)
function majHeuresSemaineLabel() {
  majHeuresPeriodeLabel();
}

