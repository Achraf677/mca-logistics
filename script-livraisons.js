/**
 * MCA Logistics — Module Livraisons
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L798 (script.js d'origine)
function getMontantHTLivraison(livraison) {
  const taux = parseFloat(livraison?.tauxTVA) || 0;
  if (livraison?.prixHT !== undefined && livraison?.prixHT !== null && livraison?.prixHT !== '') {
    return parseFloat(livraison.prixHT) || 0;
  }
  return (parseFloat(livraison?.prix) || 0) / (1 + taux / 100);
}

// L806 (script.js d'origine)
function getLivraisonStatutPaiement(livraison) {
  var statut = String(livraison?.statutPaiement || '').trim().toLowerCase();
  if (!statut) return 'en-attente';
  if (statut === 'en attente') return 'en-attente';
  return statut;
}

// L1251 (script.js d'origine)
function genNumLivraison() {
  const annee = new Date().getFullYear();
  const livs  = charger('livraisons');
  const max   = livs.map(l => parseInt((l.numLiv||'').split('-')[2], 10)||0).reduce((a,b)=>Math.max(a,b),0);
  return `LIV-${annee}-${String(max+1).padStart(4,'0')}`;
}

// L1430 (script.js d'origine)
function synchroniserAffectationLivraison(chaufId, vehId) {
  const salaries = charger('salaries');
  const vehicules = charger('vehicules');
  let salarie = chaufId ? salaries.find(function(item) { return item.id === chaufId; }) : null;
  let vehicule = vehId ? vehicules.find(function(item) { return item.id === vehId; }) : null;
  if (salarie && !vehicule) vehicule = getVehiculeParSalId(salarie.id);
  if (vehicule && !salarie && vehicule.salId) salarie = salaries.find(function(item) { return item.id === vehicule.salId; }) || null;
  return {
    chaufId: salarie ? salarie.id : '',
    chaufNom: salarie ? getSalarieNomComplet(salarie) : 'Non assigné',
    vehId: vehicule ? vehicule.id : '',
    vehNom: vehicule ? vehicule.immat : ''
  };
}

// L1445 (script.js d'origine)
function peuplerSelectsLivraisonEdition(chaufId, vehId) {
  const selChauf = document.getElementById('edit-liv-chauffeur');
  const selVeh = document.getElementById('edit-liv-vehicule');
  if (selChauf) {
    selChauf.innerHTML = '<option value="">-- Choisir --</option>';
    charger('salaries').forEach(function(salarie) {
      selChauf.innerHTML += '<option value="' + salarie.id + '">' + getSalarieNomComplet(salarie, { includeNumero: true }) + '</option>';
    });
    selChauf.value = chaufId || '';
  }
  if (selVeh) {
    selVeh.innerHTML = '<option value="">-- Choisir un véhicule --</option>';
    charger('vehicules').forEach(function(vehicule) {
      const label = vehicule.immat + (vehicule.modele ? ' — ' + vehicule.modele : '') + (vehicule.salNom ? ' (' + vehicule.salNom + ')' : '');
      selVeh.innerHTML += '<option value="' + vehicule.id + '">' + label + '</option>';
    });
    selVeh.value = vehId || '';
  }
}

// L2036 (script.js d'origine)
function ajouterLivraison() {
  const client      = document.getElementById('liv-client').value.trim();
  const clientSiren = (document.getElementById('liv-client-siren')?.value || '').replace(/\s+/g, '');
  const zoneGeo  = document.getElementById('liv-zone')?.value.trim() || document.getElementById('liv-depart').value.trim();
  const depart   = zoneGeo;
  const arrivee  = '';
  const distance = parseFloat(document.getElementById('liv-distance').value) || 0;
  const prixHT   = parseFloat(document.getElementById('liv-prix-ht')?.value) || 0;
  const tauxTVA  = parseFloat(document.getElementById('liv-taux-tva')?.value) || 20;
  const prix     = parseFloat(document.getElementById('liv-prix').value) || (prixHT * (1 + tauxTVA/100));
  const chaufId  = document.getElementById('liv-chauffeur').value;
  const vehId    = document.getElementById('liv-vehicule').value;
  const statut   = document.getElementById('liv-statut').value;
  const date     = document.getElementById('liv-date').value || aujourdhui();
  const notes    = document.getElementById('liv-notes').value.trim();

  if (!client) { afficherToast('⚠️ Le nom du client est obligatoire', 'error'); return; }
  if (!prix || isNaN(prix) || prix <= 0) {
    afficherToast('⚠️ Le prix est obligatoire pour calculer la rentabilité', 'error');
    return;
  }
  if (hasNegativeNumber(distance, prixHT, prix, tauxTVA)) {
    afficherToast('⚠️ Les montants et distances doivent être positifs', 'error');
    return;
  }

  // Si prix manquant → créer une alerte et continuer quand même
  if (!prix || isNaN(prix)) {
    ajouterAlerte('prix_manquant', `Livraison sans prix saisie — Client : ${client} (${date})`, { client, date });
    afficherBadgeAlertes();
  }

  const profit = prix - distance * config.coutKmEstime;
  const affectation = synchroniserAffectationLivraison(chaufId, vehId);
  const conflitPlanning = affectation.chaufId ? planningGetIndisponibilitePourDate(affectation.chaufId, date) : null;

  // BUG-006 fix : auto-création du client dans le carnet si le nom ne correspond
  // à aucun client existant. Évite les livraisons orphelines (sans clientId)
  // qui cassent l'agrégation CA par client + relances.
  // Priorité au clientId stocké par selectionnerClientLivraisonParId (lien fiable),
  // sinon fallback matching par nom (cas saisie manuelle).
  let clientId = null;
  let clientCreeAuto = false;
  let clientTvaSnapshot = '';
  let clientPaysSnapshot = '';
  try {
    const clientsExistants = charger('clients');
    // 1. Lien direct via __livSelectedClientId (utilisateur a cliqué sur une suggestion)
    if (window.__livSelectedClientId) {
      const direct = clientsExistants.find(c => c && c.id === window.__livSelectedClientId);
      if (direct && (direct.nom || '').toLowerCase() === client.toLowerCase()) {
        clientId = direct.id;
        clientTvaSnapshot = direct.tvaIntra || '';
        clientPaysSnapshot = direct.pays || 'FR';
      }
    }
    // 2. Fallback matching par nom (saisie libre, pas de suggestion cliquée)
    if (!clientId) {
      const cible = client.toLowerCase();
      const match = clientsExistants.find(c => (c.nom || '').toLowerCase() === cible);
      if (match) {
        clientId = match.id;
        clientTvaSnapshot = match.tvaIntra || '';
        clientPaysSnapshot = match.pays || 'FR';
      } else {
        const nouveau = {
          id: genId(),
          nom: client,
          type: 'pro',
          siren: clientSiren || '',
          creeLe: new Date().toISOString(),
          creeDepuis: 'livraison'
        };
        clientsExistants.push(nouveau);
        sauvegarder('clients', clientsExistants);
        clientId = nouveau.id;
        clientCreeAuto = true;
      }
    }
  } catch (_) { /* silencieux : ne bloque pas la création de la livraison */ }
  // Reset le state pour la prochaine modal
  window.__livSelectedClientId = null;
  window.__livSelectedClientTva = null;
  window.__livSelectedClientPays = null;

  // BUG-012/013 fix : champs lettre de voiture conforme arrêté 09/11/1999
  const getVal = (id) => (document.getElementById(id)?.value || '').trim();
  const expediteur = {
    nom: getVal('liv-exp-nom'),
    contact: getVal('liv-exp-contact'),
    adresse: getVal('liv-exp-adresse'),
    cp: getVal('liv-exp-cp'),
    ville: getVal('liv-exp-ville'),
    pays: getVal('liv-exp-pays') || 'FR'
  };
  const destinataire = {
    nom: getVal('liv-dest-nom'),
    contact: getVal('liv-dest-contact'),
    adresse: getVal('liv-dest-adresse'),
    cp: getVal('liv-dest-cp'),
    ville: getVal('liv-dest-ville'),
    pays: getVal('liv-dest-pays') || 'FR'
  };
  const marchandise = {
    nature: getVal('liv-marchandise-nature'),
    poidsKg: parseFloat(getVal('liv-marchandise-poids')) || 0,
    volumeM3: parseFloat(getVal('liv-marchandise-volume')) || 0,
    nbColis: parseInt(getVal('liv-marchandise-colis'), 10) || 0
  };
  const adr = {
    estADR: !!document.getElementById('liv-adr-est')?.checked,
    codeONU: getVal('liv-adr-onu'),
    classe: getVal('liv-adr-classe'),
    groupeEmballage: getVal('liv-adr-groupe')
  };

  const livraison = {
    id: genId(),
    numLiv: genNumLivraison(),
    client, clientSiren, clientId,
    clientTvaIntracom: clientTvaSnapshot, clientPays: clientPaysSnapshot,
    depart, arrivee, distance, prix, prixHT, tauxTVA, profit,
    chaufId: affectation.chaufId || null, chaufNom: affectation.chaufNom,
    vehId: affectation.vehId || null, vehNom: affectation.vehNom,
    statut, date, notes,
    statutPaiement: 'en-attente',
    modePaiement:   document.getElementById('liv-mode-paiement')?.value || '',
    heureDebut:     document.getElementById('liv-heure-debut')?.value || '',
    expediteur, destinataire, marchandise, adr,
    creeLe: new Date().toISOString()
  };

  const livraisons = charger('livraisons');
  livraisons.push(livraison);
  sauvegarder('livraisons', livraisons);
  enregistrerConduite(livraison);
  ajouterEntreeAudit('Création livraison', (livraison.numLiv || 'Livraison') + ' · ' + (livraison.client || 'Client') + ' · ' + euros(livraison.prix || 0));
  if (conflitPlanning) {
    ajouterAlerteSiAbsente(
      'planning_conflit_livraison',
      `⚠️ Livraison assignée malgré ${conflitPlanning.label.toLowerCase()} — ${livraison.chaufNom || 'salarié'} (${formatDateExport(date)})`,
      { salId: livraison.chaufId, salNom: livraison.chaufNom || '', livId: livraison.id, numLiv: livraison.numLiv }
    );
  }

  closeModal('modal-livraison');
  viderFormulaireLivraison();
  afficherLivraisons();
  if (clientCreeAuto && typeof afficherClients === 'function') {
    try { afficherClients(); } catch (_) {}
  }
  if (typeof afficherPlanningSemaine === 'function') afficherPlanningSemaine();
  if (conflitPlanning) {
    afficherToast(`⚠️ ${livraison.chaufNom || 'Ce salarié'} est noté ${conflitPlanning.label.toLowerCase()} le ${formatDateExport(date)}`, 'warning');
    return;
  }
  afficherToast(clientCreeAuto
    ? '✅ Livraison enregistrée + client « ' + client + ' » ajouté au carnet'
    : '✅ Livraison enregistrée !');
}

// L2197 (script.js d'origine)
function viderFormulaireLivraison() {
  ['liv-client','liv-client-siren','liv-zone','liv-depart','liv-arrivee','liv-distance','liv-prix','liv-prix-ht','liv-notes','liv-heure-debut',
    // BUG-012/013 : champs lettre de voiture
    'liv-exp-nom','liv-exp-contact','liv-exp-adresse','liv-exp-cp','liv-exp-ville',
    'liv-dest-nom','liv-dest-contact','liv-dest-adresse','liv-dest-cp','liv-dest-ville',
    'liv-marchandise-nature','liv-marchandise-poids','liv-marchandise-volume','liv-marchandise-colis',
    'liv-adr-onu','liv-adr-classe'
  ].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['liv-chauffeur','liv-vehicule','liv-mode-paiement','liv-adr-groupe'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const expPays = document.getElementById('liv-exp-pays'); if (expPays) expPays.value = 'FR';
  const destPays = document.getElementById('liv-dest-pays'); if (destPays) destPays.value = 'FR';
  const adrChk = document.getElementById('liv-adr-est');
  if (adrChk) { adrChk.checked = false; const det = document.getElementById('liv-adr-details'); if (det) det.style.display = 'none'; }
  // liv-ldv-section n'est plus un <details> collapsible — lettre de voiture toujours visible en full-page
  const tvaSel = document.getElementById('liv-taux-tva'); if (tvaSel) tvaSel.value = '20';
  document.getElementById('liv-statut').value = 'en-attente';
  document.getElementById('liv-date').value   = aujourdhui();
  const sug = document.getElementById('client-suggestions');
  if (sug) sug.innerHTML = '';
}

// L2259 (script.js d'origine)
function rafraichirVueLivraisonsActive() {
  if (_vueLivraisons === 'kanban') afficherKanban();
  else if (_vueLivraisons === 'calendrier') afficherCalendrier();
  else afficherLivraisons();
}

// L2428 (script.js d'origine)
function afficherLivraisons() {
  if (typeof window.renderLivraisonsAdminFinal === 'function') {
    return window.renderLivraisonsAdminFinal();
  }
}

// L2445 (script.js d'origine)
function getLivraisonInlineSelectClass(type, valeur) {
  const normalized = String(valeur || '').toLowerCase();
  if (type === 'statut') {
    if (normalized === 'livre') return 'is-success';
    if (normalized === 'en-cours') return 'is-info';
    return 'is-warn';
  }
  if (normalized === 'paye' || normalized === 'payé') return 'is-success';
  if (normalized === 'litige') return 'is-danger';
  return 'is-warn';
}

// L2457 (script.js d'origine)
function styliserSelectLivraison(selectEl, type) {
  if (!selectEl) return;
  selectEl.classList.remove('is-success', 'is-info', 'is-warn', 'is-danger');
  selectEl.classList.add(getLivraisonInlineSelectClass(type, selectEl.value));
}

// L2463 (script.js d'origine)
function changerStatutLivraison(id, statut) {
  const livraisons = charger('livraisons'), idx = livraisons.findIndex(l => l.id === id);
  if (idx > -1) {
    livraisons[idx].statut = statut;
    sauvegarder('livraisons', livraisons);
    ajouterEntreeAudit('Statut livraison', (livraisons[idx].numLiv || 'Livraison') + ' · ' + statut);
    afficherToast('✅ Statut mis à jour');
  }
}

// L2473 (script.js d'origine)
async function supprimerLivraison(id) {
  const _ok = await confirmDialog('Supprimer cette livraison ?', {titre:'Supprimer',icone:'📦',btnLabel:'Supprimer'});
  if (!_ok) return;
  const livraisons = charger('livraisons');
  const livraison = livraisons.find(function(item) { return item.id === id; }) || null;
  annulerArchiveFactureLivraison(livraison);
  sauvegarder('livraisons', livraisons.filter(function(l) { return l.id !== id; }));
  if (livraison) ajouterEntreeAudit('Suppression livraison', (livraison.numLiv || 'Livraison') + ' · ' + (livraison.client || 'Client'));
  afficherLivraisons(); afficherToast('🗑️ Supprimé');
}

// L2494 (script.js d'origine)
function appliquerFiltresDatesLivraisons() {
  var deb = document.getElementById('filtre-date-debut')?.value || '';
  var fin = document.getElementById('filtre-date-fin')?.value || '';
  if (!deb || !fin) {
    afficherToast('⚠️ Renseigne les deux dates pour valider la période', 'error');
    return;
  }
  if (deb > fin) {
    afficherToast('⚠️ La date de début doit être antérieure à la date de fin', 'error');
    return;
  }
  _livPeriodePersonnalisee = { debut: deb, fin: fin };
  var label = deb === fin ? 'Jour sélectionné' : 'Période personnalisée';
  var datesLabel = 'Du ' + formatDateExport(deb) + ' au ' + formatDateExport(fin);
  var labelEl = document.getElementById('liv-periode-label');
  var datesEl = document.getElementById('liv-periode-dates');
  if (labelEl) labelEl.textContent = label;
  if (datesEl) datesEl.textContent = datesLabel;
  afficherLivraisons();
  afficherToast('✅ Période validée');
}

// L2696 (script.js d'origine)
function ouvrirLivraisonPourPrix(client) {
  // Ouvre le modal livraison pré-rempli avec le client
  openModal('modal-livraison');
  if (client) {
    const el = document.getElementById('liv-client');
    if (el) el.value = client;
  }
}

// L3441 (script.js d'origine)
function confirmerEditLivraison() {
  surveillerConflitsEditionActifs();
  const id     = document.getElementById('edit-liv-id').value;
  const lockState = verifierVerrouEdition('livraison', id);
  if (!lockState.ok) {
    afficherToast(`⚠️ Cette livraison est verrouillée par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const client = document.getElementById('edit-liv-client').value.trim();
  if (!client) { afficherToast('⚠️ Client obligatoire', 'error'); return; }
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return;
  const ancien = { ...livraisons[idx] };

  const zoneGeo = document.getElementById('edit-liv-zone')?.value.trim() || document.getElementById('edit-liv-depart').value.trim();
  livraisons[idx].client   = client;
  livraisons[idx].depart   = zoneGeo;
  livraisons[idx].arrivee  = '';
  livraisons[idx].distance = parseFloat(document.getElementById('edit-liv-distance').value) || 0;
  livraisons[idx].prixHT   = parseFloat(document.getElementById('edit-liv-prix-ht')?.value) || 0;
  livraisons[idx].tauxTVA  = parseFloat(document.getElementById('edit-liv-taux-tva')?.value) || 20;
  livraisons[idx].prix     = parseFloat(document.getElementById('edit-liv-prix').value) || 0;
  if (hasNegativeNumber(livraisons[idx].distance, livraisons[idx].prixHT, livraisons[idx].prix, livraisons[idx].tauxTVA)) {
    afficherToast('⚠️ Les montants et distances doivent être positifs', 'error');
    return;
  }
  const affectation = synchroniserAffectationLivraison(
    document.getElementById('edit-liv-chauffeur')?.value || '',
    document.getElementById('edit-liv-vehicule')?.value || ''
  );
  livraisons[idx].chaufId = affectation.chaufId || null;
  livraisons[idx].chaufNom = affectation.chaufNom;
  livraisons[idx].vehId = affectation.vehId || null;
  livraisons[idx].vehNom = affectation.vehNom;
  livraisons[idx].date     = document.getElementById('edit-liv-date').value;
  livraisons[idx].modePaiement = document.getElementById('edit-liv-mode-paiement')?.value || '';
  livraisons[idx].statut   = document.getElementById('edit-liv-statut').value;
  livraisons[idx].notes    = document.getElementById('edit-liv-notes').value.trim();
  livraisons[idx].profit   = livraisons[idx].prix - livraisons[idx].distance * config.coutKmEstime;

  // Logger les modifications
  const champs = { client:'Client', prix:'Prix', statut:'Statut', distance:'Distance', depart:'Zone géographique' };
  Object.entries(champs).forEach(([k,label]) => {
    if (String(ancien[k]||'') !== String(livraisons[idx][k]||'')) {
      logModifLivraison(id, label, ancien[k], livraisons[idx][k]);
    }
  });

  sauvegarder('livraisons', livraisons);
  if (ancien.prix !== livraisons[idx].prix) {
    ajouterAlerte('livraison_modif',
      `Livraison modifiée — ${client} : ${ancien.prix ? euros(ancien.prix) : '—'} → ${euros(livraisons[idx].prix)}`,
      { client });
    afficherBadgeAlertes();
  }
  ajouterEntreeAudit('Modification livraison', (livraisons[idx].numLiv || 'Livraison') + ' · ' + (livraisons[idx].client || 'Client'));
  closeModal('modal-edit-livraison');
  afficherLivraisons();
  afficherToast('✅ Livraison mise à jour');
}

// L3660 (script.js d'origine)
function changerVueLivraisons(vue) {
  _vueLivraisons = vue;
  document.querySelectorAll('.btn-view').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-vue-' + vue);
  if (btn) btn.classList.add('active');
  document.getElementById('vue-tableau').style.display    = vue === 'tableau'    ? 'block' : 'none';
  document.getElementById('vue-kanban').style.display     = vue === 'kanban'     ? 'block' : 'none';
  document.getElementById('vue-calendrier').style.display = vue === 'calendrier' ? 'block' : 'none';
  if (vue === 'kanban')     afficherKanban();
  if (vue === 'calendrier') afficherCalendrier();
  if (vue === 'tableau')    afficherLivraisons();
}

// L3835 (script.js d'origine)
function dupliquerLivraison(id) {
  const livraisons = charger('livraisons');
  const source = livraisons.find(l => l.id === id);
  if (!source) return;
  const copie = {
    ...source,
    id: genId(),
    numLiv: genNumLivraison(),
    statut: 'en-attente',
    statutPaiement: 'en-attente',
    date: aujourdhui(),
    creeLe: new Date().toISOString()
  };
  livraisons.push(copie);
  sauvegarder('livraisons', livraisons);
  afficherLivraisons();
  afficherToast(`📋 Livraison dupliquée → ${copie.numLiv}`);
}

// L3980 (script.js d'origine)
function getLivraisonsFiltresActifs() {
  let livraisons = charger('livraisons');
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
  const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';

  if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
  if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) {
    livraisons = livraisons.filter(l =>
      (l.client || '').toLowerCase().includes(filtreRecherche) ||
      (l.chaufNom || '').toLowerCase().includes(filtreRecherche) ||
      (l.numLiv || '').toLowerCase().includes(filtreRecherche) ||
      (l.depart || '').toLowerCase().includes(filtreRecherche) ||
      (l.arrivee || '').toLowerCase().includes(filtreRecherche)
    );
  }
  return livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
}

// L4006 (script.js d'origine)
function getLivraisonsPeriodeActiveLabel() {
  const deb = document.getElementById('filtre-date-debut')?.value || '';
  const fin = document.getElementById('filtre-date-fin')?.value || '';
  if (deb && fin) return 'Du ' + formatDateExport(deb) + ' au ' + formatDateExport(fin);
  const label = document.getElementById('liv-periode-dates')?.textContent?.trim();
  return label || 'Toutes les livraisons';
}

// L4181 (script.js d'origine)
async function ouvrirEditLivraison(id) {
  window._editLivId = id;
  const livraisons = charger('livraisons');
  const l = livraisons.find(x => x.id === id);
  if (!l) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('livraison', id, l.numLiv || 'Livraison');
  if (!lockResult.ok) {
    afficherToast(`⚠️ Livraison en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    window._editLivId = null;
    return;
  }
  document.getElementById('edit-liv-id').value      = id;
  document.getElementById('edit-liv-client').value  = l.client||'';
  const zoneGeo = l.depart && l.arrivee && l.depart !== l.arrivee
    ? (l.depart + ' → ' + l.arrivee)
    : (l.arrivee || l.depart || '');
  const editZone = document.getElementById('edit-liv-zone');
  if (editZone) editZone.value = zoneGeo;
  document.getElementById('edit-liv-depart').value  = l.depart||'';
  document.getElementById('edit-liv-arrivee').value = l.arrivee||'';
  document.getElementById('edit-liv-distance').value= l.distance||'';
  const elHT = document.getElementById('edit-liv-prix-ht'); if (elHT) elHT.value = l.prixHT||'';
  const elTVA = document.getElementById('edit-liv-taux-tva'); if (elTVA) elTVA.value = l.tauxTVA||'20';
  document.getElementById('edit-liv-prix').value    = l.prix||'';
  peuplerSelectsLivraisonEdition(l.chaufId || '', l.vehId || '');
  document.getElementById('edit-liv-date').value    = l.date||'';
  const editModePaiement = document.getElementById('edit-liv-mode-paiement');
  if (editModePaiement) editModePaiement.value = l.modePaiement || '';
  document.getElementById('edit-liv-statut').value  = l.statut||'en-attente';
  document.getElementById('edit-liv-notes').value   = l.notes||'';
  // Charger histor. modifs et commentaires
  afficherHistoriqueModifs(id);
  afficherCommentairesLiv(id);
  document.getElementById('modal-edit-livraison').classList.add('open');
  afficherAlerteVerrouModal('modal-edit-livraison', '');
}

// L4749 (script.js d'origine)
function rechercheOuvrirLivraison(id) {
  if (!id) return;
  naviguerVers('livraisons');
  setTimeout(function() { ouvrirEditLivraison(id); }, 180);
}

// L5227 (script.js d'origine)
function sauvegarderObjectifLivraisons() {
  const val = parseInt(document.getElementById('param-objectif-livraisons')?.value, 10) || 0;
  localStorage.setItem('objectif_livraisons_mensuel', val);
  afficherToast('✅ Objectif ' + val + ' livraisons/mois enregistré');
}

// L5434 (script.js d'origine)
function logModifLivraison(livId, champ, ancienne, nouvelle) {
  const cle  = 'modifs_liv_' + livId;
  const logs = loadSafe(cle, []);
  logs.push({ date:new Date().toISOString(), champ, ancienne: String(ancienne), nouvelle: String(nouvelle), par:'Admin' });
  if (logs.length > 20) logs.shift();
  localStorage.setItem(cle, JSON.stringify(logs));
}

// L5447 (script.js d'origine)
function ajouterCommentaireLiv(livId) {
  const input = document.getElementById('commentaire-liv-input');
  const texte = input?.value.trim();
  if (!texte) return;
  const cle  = 'commentaires_liv_' + livId;
  const list = loadSafe(cle, []);
  list.push({ id:genId(), texte, date:new Date().toISOString(), par:'Admin' });
  localStorage.setItem(cle, JSON.stringify(list));
  if (input) input.value = '';
  afficherCommentairesLiv(livId);
  afficherToast('💬 Commentaire ajouté');
}

// L5460 (script.js d'origine)
function afficherCommentairesLiv(livId) {
  const cle  = 'commentaires_liv_' + livId;
  const list = loadSafe(cle, []).reverse();
  const cont = document.getElementById('commentaires-liv-list');
  if (!cont) return;
  if (!list.length) { cont.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted)">Aucun commentaire</div>'; return; }
  cont.innerHTML = list.map(c => `
    <div style="background:rgba(255,255,255,.03);border-radius:7px;padding:8px 12px;margin-bottom:6px;font-size:.85rem">
      <div style="color:var(--text-muted);font-size:.72rem;margin-bottom:3px">${c.par} · ${new Date(c.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
      ${c.texte}
    </div>`).join('');
}

// L5474 (script.js d'origine)
function genererBonLivraison(livId) {
  const livraisons = charger('livraisons');
  const l = livraisons.find(x => x.id === livId);
  if (!l) return;
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const siret = params.siret || '—';
  const adresse = params.adresse || '';
  const tel = params.tel || '';
  const dateExp = formatDateHeureExport();
  const logo = renderLogoEntrepriseExport();

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1d27">
      <!-- EN-TÊTE -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #f5a623">
        <div>
          <div style="font-size:1.6rem;font-weight:800;color:#f5a623;letter-spacing:1px">${nom}</div>
          ${adresse ? `<div style="font-size:.85rem;color:#6b7280;margin-top:4px">${adresse}</div>` : ''}
          ${tel     ? `<div style="font-size:.85rem;color:#6b7280">📞 ${tel}</div>` : ''}
          ${siret !== '—' ? `<div style="font-size:.78rem;color:#9ca3af;margin-top:2px">SIRET : ${siret}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;text-align:right">
          ${logo || ''}
          <div>
          <div style="font-size:1.1rem;font-weight:700;color:#1a1d27">BON DE LIVRAISON</div>
          <div style="font-size:1.3rem;font-weight:800;color:#f5a623">${l.numLiv || '—'}</div>
          <div style="font-size:.82rem;color:#6b7280;margin-top:4px">Date : ${formatDateExport(l.date) || '—'}</div>
          ${l.heureDebut ? `<div style="font-size:.82rem;color:#6b7280">Heure : ${l.heureDebut}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- INFOS LIVRAISON -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div style="background:#f8f9fc;border-radius:10px;padding:16px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Client</div>
          <div style="font-size:1rem;font-weight:700">${l.client || '—'}</div>
          ${l.arrivee ? `<div style="font-size:.85rem;color:#6b7280;margin-top:4px">📍 ${l.arrivee}</div>` : ''}
        </div>
        <div style="background:#f8f9fc;border-radius:10px;padding:16px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Exécution</div>
          <div style="font-size:.88rem"><strong>Chauffeur :</strong> ${l.chaufNom || '—'}</div>
          <div style="font-size:.88rem;margin-top:4px"><strong>Véhicule :</strong> ${l.vehNom || '—'}</div>
          ${l.distance ? `<div style="font-size:.88rem;margin-top:4px"><strong>Distance :</strong> ${l.distance} km</div>` : ''}
        </div>
      </div>

      <!-- DÉPART / ARRIVÉE -->
      ${(l.depart || l.arrivee) ? `
      <div style="background:#fff8ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin-bottom:24px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:10px">Itinéraire</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${l.depart  ? `<div style="flex:1;min-width:180px"><div style="font-size:.72rem;color:#9ca3af">DÉPART</div><div style="font-weight:600">📍 ${l.depart}</div></div>` : ''}
          ${l.depart && l.arrivee ? `<div style="font-size:1.2rem;color:#f5a623">→</div>` : ''}
          ${l.arrivee ? `<div style="flex:1;min-width:180px"><div style="font-size:.72rem;color:#9ca3af">ARRIVÉE</div><div style="font-weight:600">🏁 ${l.arrivee}</div></div>` : ''}
        </div>
      </div>` : ''}

      <!-- PRIX HT/TVA -->
      <div style="border:2px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px">
        <div style="background:#f3f4f6;padding:10px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af">Tarification</div>
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:.9rem">Prestation de livraison (TTC)</div>
            <div style="font-size:1.4rem;font-weight:800;color:#f5a623">\${l.prix ? new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(l.prix) : 'Sur devis'}</div>
          </div>
          \${l.prix ? (() => {
            const taux = parseFloat(localStorage.getItem('taux_tva')||'20');
            const ht   = l.prix / (1 + taux/100);
            const tvaM = l.prix - ht;
            return \`<div style="display:flex;justify-content:space-between;font-size:.82rem;color:#6b7280;padding-top:8px;border-top:1px solid #e5e7eb">
              <span>Montant HT</span><span style="font-weight:600">\${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(ht)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.82rem;color:#6b7280;margin-top:4px">
              <span>TVA \${taux}%</span><span>\${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(tvaM)}</span>
            </div>\`;
          })() : ''}
          \${l.modePaiement ? \`<div style="font-size:.82rem;color:#6b7280;margin-top:8px">Mode de paiement : \${l.modePaiement}</div>\` : ''}
        </div>
      </div>

      <!-- SIGNATURES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;min-height:90px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Signature chauffeur</div>
          <div style="margin-top:8px;font-size:.8rem;color:#9ca3af">${l.chaufNom || ''}</div>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;min-height:90px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Signature client</div>
          <div style="margin-top:8px;font-size:.8rem;color:#9ca3af">Lu et approuvé</div>
        </div>
      </div>

      ${l.notes ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:.85rem;color:#166534"><strong>Notes :</strong> ${l.notes}</div>` : ''}

      <!-- PIED DE PAGE -->
      <div style="border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
        <span>Généré par ${nom}</span>
        <span>Exporté le ${dateExp}</span>
        <span>Page 1/1</span>
      </div>
    </div>`;

  const zone = document.getElementById('print-bon');
  zone.innerHTML = html;

  // Ouvrir dans une nouvelle fenêtre pour impression/sauvegarde PDF
  ouvrirFenetreImpression(`Bon de livraison ${l.numLiv||''}`, html, 'width=800,height=900');
}

// L5620 (script.js d'origine)
function assurerArchiveFactureLivraison(livraison) {
  const factures = chargerFacturesEmises();
  const annee = getAnneeFactureReference(livraison);
  const montantHT = round2(getMontantHTLivraison(livraison));
  const montantTTC = round2(parseFloat(livraison.prix) || 0);
  const montantTVA = round2(montantTTC - montantHT);
  const nowIso = new Date().toISOString();
  let facture = factures.find(function(item) { return item.livId === livraison.id; }) || null;
  if (!facture) {
    const nextSeq = incrementerCompteurFactureAnnee(annee);
    facture = {
      id: genId(),
      livId: livraison.id,
      annee: annee,
      sequence: nextSeq,
      numero: formatNumeroFacture(annee, nextSeq),
      creeLe: nowIso,
      statut: 'émise'
    };
    factures.push(facture);
  }
  facture.client = livraison.client || 'Client';
  facture.numLiv = livraison.numLiv || '';
  facture.dateLivraison = livraison.date || '';
  facture.datePaiement = livraison.datePaiement || '';
  facture.modePaiement = livraison.modePaiement || '';
  facture.statutPaiement = livraison.statutPaiement || 'en-attente';
  facture.montantHT = montantHT;
  facture.montantTVA = montantTVA;
  facture.montantTTC = montantTTC;
  facture.misAJourLe = nowIso;
  if (!facture.numero) facture.numero = formatNumeroFacture(annee, facture.sequence || 1);
  sauvegarderFacturesEmises(factures);
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(function(item) { return item.id === livraison.id; });
  if (idx > -1) {
    livraisons[idx].factureNumero = facture.numero;
    livraisons[idx].factureId = facture.id;
    sauvegarder('livraisons', livraisons);
  }
  return facture;
}

// L5663 (script.js d'origine)
function annulerArchiveFactureLivraison(livraison) {
  if (!livraison?.id) return;
  const factures = chargerFacturesEmises();
  const facture = factures.find(function(item) { return item.livId === livraison.id; });
  if (!facture) return;
  facture.statut = 'annulée';
  facture.annuleeLe = new Date().toISOString();
  facture.annulationMotif = 'Livraison supprimée';
  sauvegarderFacturesEmises(factures);
}

// L5674 (script.js d'origine)
function genererFactureLivraison(livId) {
  const livraison = charger('livraisons').find(function(item) { return item.id === livId; });
  if (!livraison) return;
  const params = getEntrepriseExportParams();
  const profile = getTVAConfig();
  const siret = String(params.siret || '').replace(/\s+/g, '');
  if (!/^\d{14}$/.test(siret)) {
    afficherToast('⚠️ Renseigne un SIRET valide dans Paramètres avant de générer une facture', 'error');
    naviguerVers('parametres');
    return;
  }
  const dateFacture = formatDateExport(livraison.date || aujourdhui());
  const datePaiement = livraison.datePaiement ? formatDateExport(livraison.datePaiement) : 'En attente';
  const tauxTVA = parseFloat(livraison.tauxTVA ?? profile.defaultRate ?? 20) || 0;
  const montantHT = round2(getMontantHTLivraison(livraison));
  const montantTVA = round2((parseFloat(livraison.prix) || 0) - montantHT);
  const montantTTC = round2(parseFloat(livraison.prix) || 0);
  const facture = assurerArchiveFactureLivraison(livraison);
  const numeroFacture = facture.numero;
  const clientFiche = (typeof trouverClientParLivraison === 'function') ? trouverClientParLivraison(livraison) : null;
  const mentionTVA = choisirMentionTVALegale(profile, clientFiche || { pays: livraison.clientPays, tvaIntracom: livraison.clientTvaIntracom }, tauxTVA);
  // BUG-002 fix : template unifié avec mentions légales complètes (CGI 242 nonies A + L441-10 + D441-5)
  const adresseEntreprise = [params.adresseLigne, (params.codePostal + ' ' + params.ville).trim(), params.pays && params.pays !== 'FR' ? params.pays : '']
    .filter(Boolean).join(', ') || params.adresse;
  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:28px;color:#111827">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px">'
    + '<div><div style="font-size:1.7rem;font-weight:900;color:#f5a623;margin-bottom:8px">' + planningEscapeHtml(params.nom || 'MCA Logistics') + '</div>'
    + '<div style="font-size:.92rem;line-height:1.6;color:#4b5563">'
    + (adresseEntreprise ? '<div>' + planningEscapeHtml(adresseEntreprise) + '</div>' : '')
    + (params.tel ? '<div>Tél. : ' + planningEscapeHtml(params.tel) + '</div>' : '')
    + (params.email ? '<div>Email : ' + planningEscapeHtml(params.email) + '</div>' : '')
    + '<div>SIRET : ' + planningEscapeHtml(siret) + '</div>'
    + (params.tvaIntracom ? '<div>TVA intracom : ' + planningEscapeHtml(params.tvaIntracom) + '</div>' : '')
    + '</div>'
    + renderFactureMentionsEntrepriseHeader(params)
    + '</div>'
    + '<div style="text-align:right"><div style="font-size:.82rem;text-transform:uppercase;color:#6b7280;letter-spacing:.08em">Facture</div>'
    + '<div style="font-size:1.2rem;font-weight:800;margin-top:6px">' + planningEscapeHtml(numeroFacture) + '</div>'
    + '<div style="margin-top:10px;font-size:.88rem;color:#4b5563">Date d\'émission : <strong>' + dateFacture + '</strong></div>'
    + (livraison.date ? '<div style="font-size:.88rem;color:#4b5563">Date de livraison : <strong>' + planningEscapeHtml(formatDateExport(livraison.date)) + '</strong></div>' : '')
    + '<div style="font-size:.88rem;color:#4b5563">Échéance : <strong>' + planningEscapeHtml(datePaiement) + '</strong></div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px">'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fff">'
    + '<div style="font-size:.75rem;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Facturé à</div>'
    + renderFactureClientBlock(livraison, clientFiche)
    + '</div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fff">'
    + '<div style="font-size:.75rem;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Prestation</div>'
    + '<div style="font-size:.92rem;color:#374151">Transport / livraison</div>'
    + '<div style="font-size:.82rem;color:#6b7280;margin-top:6px">' + planningEscapeHtml((livraison.numLiv || 'Livraison') + (livraison.date ? ' · ' + formatDateExport(livraison.date) : '')) + '</div>'
    + (livraison.chaufNom ? '<div style="font-size:.82rem;color:#6b7280;margin-top:4px">Chauffeur : ' + planningEscapeHtml(livraison.chaufNom) + '</div>' : '')
    + '</div>'
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">'
    + '<thead><tr style="background:#f8fafc"><th style="padding:12px 14px;text-align:left;font-size:.78rem;text-transform:uppercase;color:#6b7280">Description</th><th style="padding:12px 14px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280">HT</th><th style="padding:12px 14px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280">TVA</th><th style="padding:12px 14px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280">TTC</th></tr></thead>'
    + '<tbody><tr>'
    + '<td style="padding:14px;border-top:1px solid #e5e7eb">Prestation de livraison' + (livraison.notes ? '<div style="font-size:.78rem;color:#6b7280;margin-top:6px">' + planningEscapeHtml(livraison.notes) + '</div>' : '') + '</td>'
    + '<td style="padding:14px;border-top:1px solid #e5e7eb;text-align:right;font-weight:700">' + euros(montantHT) + '</td>'
    + '<td style="padding:14px;border-top:1px solid #e5e7eb;text-align:right">' + euros(montantTVA) + '</td>'
    + '<td style="padding:14px;border-top:1px solid #e5e7eb;text-align:right;font-weight:800">' + euros(montantTTC) + '</td>'
    + '</tr></tbody></table>'
    + '<div style="display:flex;justify-content:flex-end;margin-bottom:18px"><div style="min-width:320px;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fafafa">'
    + '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Total HT</span><strong>' + euros(montantHT) + '</strong></div>'
    + '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>' + planningEscapeHtml(mentionTVA) + '</span><strong>' + euros(montantTVA) + '</strong></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:1.04rem;border-top:1px solid #d1d5db;padding-top:10px"><span>Total TTC</span><strong style="color:#f59e0b">' + euros(montantTTC) + '</strong></div>'
    + '</div></div>'
    + renderFacturePiedMentionsLegales(params, livraison, clientFiche)
    + '<div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:12px;font-size:.8rem;color:#6b7280;line-height:1.6">'
    + '<div>Mode de paiement : ' + planningEscapeHtml(livraison.modePaiement || 'À définir') + '</div>'
    + '<div>Statut de paiement : ' + planningEscapeHtml((livraison.statutPaiement || 'en-attente').replace('en-attente', 'En attente')) + '</div>'
    + '<div>Document généré le ' + formatDateHeureExport() + '</div>'
    + '</div>'
    + '</div>';
  facture.derniereGenerationLe = new Date().toISOString();
  facture.dateFacture = livraison.date || aujourdhui();
  const factures = chargerFacturesEmises();
  const idxFacture = factures.findIndex(function(item) { return item.id === facture.id; });
  if (idxFacture > -1) {
    factures[idxFacture] = facture;
    sauvegarderFacturesEmises(factures);
  }
  ouvrirFenetreImpression('Facture ' + numeroFacture, html, 'width=980,height=820');
  ajouterEntreeAudit('Génération facture', numeroFacture + ' · ' + (livraison.client || 'Client') + ' · ' + euros(montantTTC));
  afficherToast('📄 Facture générée');
}

// L6141 (script.js d'origine)
function syncLivPeriodeModeSelect() {
  var select = document.getElementById('liv-periode-mode');
  if (select) select.value = _livPeriodeMode || 'mois';
}

// L6146 (script.js d'origine)
function changerVuePeriodeLivraisons(mode) {
  _livPeriodeMode = ['jour', 'semaine', 'mois', 'annee'].includes(mode) ? mode : 'mois';
  _livPeriodeOffset = 0;
  navLivPeriode(0);
}

// L6152 (script.js d'origine)
function navLivPeriode(mode, delta) {
  _livPeriodePersonnalisee = null;
  if (typeof mode === 'string') {
    if (mode === 'reset') return reinitialiserLivPeriode();
    _livPeriodeMode = ['jour', 'semaine', 'mois', 'annee'].includes(mode) ? mode : 'mois';
    _livPeriodeOffset += (delta || 0);
  } else {
    _livPeriodeOffset += (mode || 0);
  }
  var range = getPeriodeRange(_livPeriodeMode, _livPeriodeOffset);
  syncLivPeriodeModeSelect();
  var deb = document.getElementById('filtre-date-debut');
  var fin = document.getElementById('filtre-date-fin');
  if (deb) deb.value = range.debut;
  if (fin) fin.value = range.fin;
  majPeriodeDisplay('liv-periode-label', 'liv-periode-dates', range);
  if (_vueLivraisons === 'kanban') afficherKanban();
  else if (_vueLivraisons === 'calendrier') afficherCalendrier();
  else afficherLivraisons();
}

// L6173 (script.js d'origine)
function reinitialiserLivPeriode() {
  _livPeriodePersonnalisee = null;
  _livPeriodeOffset = 0;
  navLivPeriode(0);
}

