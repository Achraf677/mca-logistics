/**
 * MCA Logistics — Module Incidents
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L7761 (script.js d'origine)
function planningGetOpenIncidentsForSalarie(salId) {
  return charger('incidents').filter(function(item) {
    return item.salId === salId && item.statut !== 'resolu' && item.statut !== 'clos';
  });
}

// L10871 (script.js d'origine)
function afficherIncidents() {
  let incidents = charger('incidents').sort((a,b)=>new Date(b.creeLe)-new Date(a.creeLe));
  const tb = document.getElementById('tb-incidents');
  if (!tb) return;
  paginer.__reload_tb_incidents = afficherIncidents;

  // Filtres
  const filtreSearch = (document.getElementById('filtre-inc-search')?.value || '').trim().toLowerCase();
  const filtreGravite = document.getElementById('filtre-inc-gravite')?.value || '';
  const filtreStatut = document.getElementById('filtre-inc-statut')?.value || '';
  if (filtreGravite) incidents = incidents.filter(i => (i.gravite || 'moyen') === filtreGravite);
  if (filtreStatut)  incidents = incidents.filter(i => (i.statut || 'ouvert') === filtreStatut);
  if (filtreSearch) {
    incidents = incidents.filter(i => [i.client, i.salNom, i.chaufNom, i.description, i.numLiv]
      .filter(Boolean).join(' ').toLowerCase().includes(filtreSearch));
  }

  if (!incidents.length) {
    nettoyerPagination('tb-incidents');
    tb.innerHTML = filtreSearch || filtreGravite || filtreStatut
      ? '<tr><td colspan="8" class="empty-row">Aucun résultat avec ces filtres</td></tr>'
      : emptyState('🚨','Aucun incident','Les réclamations clients et incidents de livraison apparaîtront ici.');
    return;
  }

  const statBadge = { ouvert:'<span class="incident-badge incident-ouvert">Ouvert</span>', encours:'<span class="incident-badge incident-encours">En cours</span>', traite:'<span class="incident-badge incident-traite">✅ Traité</span>' };

  // Type badge (mockup-aligned): uses i.type if set, falls back to gravite-derived
  const typeBadgeHtml = function(i) {
    var t = i.type || '';
    if (!t) {
      // derive from gravite
      var g = i.gravite || 'moyen';
      if (g === 'grave') t = 'accident';
      else if (g === 'faible') t = 'autre';
      else t = 'avarie';
    }
    var labels = { accident:'Accident', avarie:'Avarie', vol:'Vol', retard:'Retard', reclamation:'Réclamation', autre:'Autre' };
    var label = labels[t] || t;
    var cls = (t === 'accident') ? 'badge alert' : (t === 'vol' || t === 'autre') ? 'badge' : 'badge warn';
    return '<span class="' + cls + '">' + label + '</span>';
  };

  var livraisons = charger('livraisons');

  paginer(incidents, 'tb-incidents', function(items) {
    return items.map(i => {
      var vehImmat = '';
      if (i.livId) { var liv = livraisons.find(l => l.id === i.livId); vehImmat = (liv && (liv.vehImmat || liv.vehicule)) || ''; }
      var coutVal = parseFloat(i.cout || i.cost || i.montant || 0);
      var coutHtml = coutVal > 0 ? '<span class="amount">' + coutVal.toLocaleString('fr-FR', {minimumFractionDigits:0,maximumFractionDigits:0}) + ' €</span>' : '—';
      return `<tr>
    <td>${formatDateExport(i.date)}</td>
    <td>${typeBadgeHtml(i)}</td>
    <td style="font-family:var(--font-mono,monospace);font-size:.82rem">${vehImmat||'—'}</td>
    <td>${i.salNom||i.chaufNom||'—'}</td>
    <td style="font-size:.83rem">${i.description||'—'}</td>
    <td class="amount">${coutHtml}</td>
    <td>${statBadge[i.statut||'ouvert']||''}</td>
    <td>${buildInlineActionsDropdown('Actions', [
      { icon:'🔴', label:'Marquer ouvert', action:`changerStatutIncident('${i.id}','ouvert')` },
      { icon:'🟡', label:'Marquer en cours', action:`changerStatutIncident('${i.id}','encours')` },
      { icon:'✅', label:'Marquer traité', action:`changerStatutIncident('${i.id}','traite')` },
      { icon:'🗑️', label:'Supprimer', action:`supprimerIncident('${i.id}')`, danger:true }
    ])}</td>
  </tr>`;
    }).join('');
  }, 12);
}

// L10921 (script.js d'origine)
function ajouterIncident() {
  const date     = document.getElementById('inc-date')?.value || aujourdhui();
  const livId    = document.getElementById('inc-livraison')?.value || '';
  const salId    = document.getElementById('inc-salarie')?.value || '';
  const type     = document.getElementById('inc-type')?.value || 'avarie';
  // #51 audit Chrome : sanitize defense en profondeur (le rendu echappe deja
  // mais on retire <script>/<iframe>/on*= avant stockage pour eviter qu'un
  // futur renderer innerHTML execute du code injecte).
  const descRaw  = document.getElementById('inc-description')?.value.trim() || '';
  const desc     = (typeof window.sanitizeUserInput === 'function') ? window.sanitizeUserInput(descRaw) : descRaw;
  // #49 audit Chrome : avertir l'utilisateur si on a retire du contenu
  // (avant le fix, strip silencieux -> user perdait son texte sans le savoir).
  if (desc !== descRaw && typeof afficherToast === 'function') {
    afficherToast('ℹ️ Caractères dangereux (<script>, on=, etc.) retirés de la description.');
  }
  const gravite  = document.getElementById('inc-gravite')?.value || 'moyen';
  const cout     = parseFloat(document.getElementById('inc-cout')?.value || 0) || 0;

  if (!desc) { afficherToast('⚠️ Description obligatoire','error'); return; }

  const livraisons = charger('livraisons');
  const liv = livId ? livraisons.find(l=>l.id===livId) : null;
  const sal = salId ? charger('salaries').find(s=>s.id===salId) : null;
  const finalSalId  = salId || liv?.chaufId || '';
  const finalSalNom = sal?.nom || liv?.chaufNom || '';

  const incidents = charger('incidents');
  const incident  = { id:genId(), date, livId, salId:finalSalId, salNom:finalSalNom, client:liv?.client||'', chaufId:finalSalId, chaufNom:finalSalNom, description:desc, type, gravite, cout, statut:'ouvert', creeLe:new Date().toISOString() };
  incidents.push(incident);
  sauvegarder('incidents', incidents);
  ajouterEntreeAudit('Création incident', (incident.client || finalSalNom || 'Incident') + ' · ' + gravite);

  if (finalSalId) {
    const msgs = loadSafe('messages_'+finalSalId, []);
    msgs.push({ id:genId(), auteur:'admin', texte:`⚠️ Un incident a été signalé${liv?' sur votre livraison du '+date+' ('+liv.client+')':' vous concernant le '+date}. Motif : ${desc}`, lu:false, creeLe:new Date().toISOString() });
    localStorage.setItem('messages_'+finalSalId, JSON.stringify(msgs));
  }

  closeModal('modal-incident');
  afficherIncidents();
  afficherToast('✅ Incident enregistré');
}

// L10953 (script.js d'origine)
// Phase 91.42 — Ajout horodatage resoluLe quand statut = traite/clos pour KPIs/exports
function changerStatutIncident(id, statut) {
  const incidents = charger('incidents');
  const idx = incidents.findIndex(i=>i.id===id);
  if (idx > -1) {
    incidents[idx].statut = statut;
    if (statut === 'traite' || statut === 'clos' || statut === 'resolu') {
      incidents[idx].resoluLe = incidents[idx].resoluLe || new Date().toISOString();
    } else {
      // Réouverture : retire la résolution
      delete incidents[idx].resoluLe;
    }
    sauvegarder('incidents', incidents);
    afficherIncidents();
    afficherToast('✅ Statut mis à jour');
  }
}

// L10959 (script.js d'origine)
async function supprimerIncident(id) {
  const ok = await confirmDialog('Supprimer cet incident ?',{titre:'Supprimer',icone:'🚨',btnLabel:'Supprimer'});
  if (!ok) return;
  sauvegarder('incidents', charger('incidents').filter(i=>i.id!==id));
  afficherIncidents();
  afficherToast('Incident supprimé');
}

// Phase 56 — chips toolbar filter for incidents
window.incChipFilter = function(btn, statut, gravite) {
  var toolbar = document.getElementById('inc-chips-toolbar');
  if (toolbar) {
    toolbar.querySelectorAll('.inc-chip').forEach(function(c) {
      c.classList.remove('active');
      c.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
  var selStatut = document.getElementById('filtre-inc-statut');
  var selGravite = document.getElementById('filtre-inc-gravite');
  if (selStatut) selStatut.value = statut || '';
  if (selGravite) selGravite.value = gravite || '';
  if (typeof afficherIncidents === 'function') afficherIncidents();
};

// Phase 65 — Period navigation for Incidents (mockup-aligned, visual parity with Carburant/Entretiens)
(function() {
  var _vue = 'mois';
  var _offset = 0;

  function getLabel() {
    var now = new Date();
    if (_vue === 'mois') {
      var d = new Date(now.getFullYear(), now.getMonth() + _offset, 1);
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (_vue === 'annee') {
      return String(now.getFullYear() + _offset);
    }
    if (_vue === 'semaine') {
      var base = new Date(now);
      base.setDate(base.getDate() + _offset * 7 - ((base.getDay() + 6) % 7));
      var end = new Date(base); end.setDate(base.getDate() + 6);
      return base.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' – ' + end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    var d = new Date(now); d.setDate(d.getDate() + _offset);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  function getDates() {
    var now = new Date();
    if (_vue === 'mois') {
      var d = new Date(now.getFullYear(), now.getMonth() + _offset, 1);
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      var fmt = function(dt) { return ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2); };
      return fmt(d) + ' → ' + fmt(last);
    }
    return '';
  }

  function refresh() {
    var lbl = document.getElementById('inc-periode-label');
    var dts = document.getElementById('inc-periode-dates');
    if (lbl) lbl.textContent = getLabel();
    if (dts) dts.textContent = getDates();
  }

  window.navIncidentsPeriode = function(dir) { _offset += dir; refresh(); };
  window.reinitialiserIncidentsPeriode = function() { _offset = 0; refresh(); };
  window.changerVueIncidents = function(v) {
    _vue = v; _offset = 0;
    var chips = document.querySelectorAll('[data-period-target="filtre-inc-vue"] .chip-period');
    chips.forEach(function(c) { c.classList.toggle('active', c.getAttribute('data-period') === v); });
    refresh();
  };

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(refresh, 100);
  });
})();

// L12146 (script.js d'origine)
function peupleIncSalarie() {
  var sel = document.getElementById('inc-salarie');
  if (!sel) return;
  var salaries = charger('salaries');
  var v = sel.value;
  sel.innerHTML = '<option value="">— Aucun salarié spécifique —</option>';
  salaries.forEach(function(s) { sel.innerHTML += '<option value="' + s.id + '">' + s.nom + (s.poste?' ('+s.poste+')':'') + '</option>'; });
  sel.value = v;
}

