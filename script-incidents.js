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
      ? '<tr><td colspan="7" class="empty-row">Aucun résultat avec ces filtres</td></tr>'
      : emptyState('🚨','Aucun incident','Les réclamations clients et incidents de livraison apparaîtront ici.');
    return;
  }

  const statBadge = { ouvert:'<span class="incident-badge incident-ouvert">🔴 Ouvert</span>', encours:'<span class="incident-badge incident-encours">🟡 En cours</span>', traite:'<span class="incident-badge incident-traite">✅ Traité</span>' };
  const graviteBadge = {
    faible:'<span class="incident-badge incident-traite">🟢 Faible</span>',
    moyen:'<span class="incident-badge incident-encours">🟠 Moyen</span>',
    grave:'<span class="incident-badge incident-ouvert">🔴 Grave</span>'
  };

  paginer(incidents, 'tb-incidents', function(items) {
    return items.map(i => `<tr>
    <td>${formatDateExport(i.date)}</td>
    <td><strong>${i.client||'—'}</strong></td>
    <td>${i.salNom||i.chaufNom||'—'}</td>
    <td style="font-size:.83rem">${i.description||'—'}</td>
    <td>${graviteBadge[i.gravite||'moyen']||graviteBadge.moyen}</td>
    <td>${statBadge[i.statut||'ouvert']||''}</td>
    <td>${buildInlineActionsDropdown('Actions', [
      { icon:'🔴', label:'Marquer ouvert', action:`changerStatutIncident('${i.id}','ouvert')` },
      { icon:'🟡', label:'Marquer en cours', action:`changerStatutIncident('${i.id}','encours')` },
      { icon:'✅', label:'Marquer traité', action:`changerStatutIncident('${i.id}','traite')` },
      { icon:'🗑️', label:'Supprimer', action:`supprimerIncident('${i.id}')`, danger:true }
    ])}</td>
  </tr>`).join('');
  }, 12);
}

// L10921 (script.js d'origine)
function ajouterIncident() {
  const date     = document.getElementById('inc-date')?.value || aujourdhui();
  const livId    = document.getElementById('inc-livraison')?.value || '';
  const salId    = document.getElementById('inc-salarie')?.value || '';
  const desc     = document.getElementById('inc-description')?.value.trim() || '';
  const gravite  = document.getElementById('inc-gravite')?.value || 'moyen';

  if (!desc) { afficherToast('⚠️ Description obligatoire','error'); return; }

  const livraisons = charger('livraisons');
  const liv = livId ? livraisons.find(l=>l.id===livId) : null;
  const sal = salId ? charger('salaries').find(s=>s.id===salId) : null;
  const finalSalId  = salId || liv?.chaufId || '';
  const finalSalNom = sal?.nom || liv?.chaufNom || '';

  const incidents = charger('incidents');
  const incident  = { id:genId(), date, livId, salId:finalSalId, salNom:finalSalNom, client:liv?.client||'', chaufId:finalSalId, chaufNom:finalSalNom, description:desc, gravite, statut:'ouvert', creeLe:new Date().toISOString() };
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
function changerStatutIncident(id, statut) {
  const incidents = charger('incidents');
  const idx = incidents.findIndex(i=>i.id===id);
  if (idx>-1) { incidents[idx].statut=statut; sauvegarder('incidents',incidents); afficherIncidents(); afficherToast('✅ Statut mis à jour'); }
}

// L10959 (script.js d'origine)
async function supprimerIncident(id) {
  const ok = await confirmDialog('Supprimer cet incident ?',{titre:'Supprimer',icone:'🚨',btnLabel:'Supprimer'});
  if (!ok) return;
  sauvegarder('incidents', charger('incidents').filter(i=>i.id!==id));
  afficherIncidents();
  afficherToast('🗑️ Incident supprimé');
}

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

