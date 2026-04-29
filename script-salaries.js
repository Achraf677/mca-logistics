/**
 * MCA Logistics — Module Salaries
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L407 (script.js d'origine)
function notifierSalarieSiAbsente(salId, type, message, meta) {
  if (!salId || !message) return;
  const cle = 'notifs_sal_' + salId;
  const notifs = charger(cle);
  const signature = type + '|' + (meta?.stageKey || meta?.doc || meta?.livId || meta?.date || '');
  const existe = notifs.find(function(item) {
    return item.type === type && (item.meta?.signature || '') === signature;
  });
  if (existe) return;
  notifs.push({
    id: genId(),
    type: type,
    message: message,
    lu: false,
    creeLe: new Date().toISOString(),
    meta: Object.assign({}, meta || {}, { signature: signature })
  });
  sauvegarder(cle, notifs);
}

// L786 (script.js d'origine)
function getSalarieVehicule(salarie) {
  if (!salarie) return null;
  var vehicules = charger('vehicules');
  return vehicules.find(function(v) { return v.salId === salarie.id; })
    || vehicules.find(function(v) { return v.salNom && salarie.nom && v.salNom === salarie.nom; })
    || null;
}

// L794 (script.js d'origine)
function getSalarieConformiteBadges(salarie) {
  var badges = [];
  var now = new Date();
  var permisDate = salarie?.datePermis ? new Date(salarie.datePermis) : null;
  var assuranceDate = salarie?.dateAssurance ? new Date(salarie.dateAssurance) : null;
  var limitPermis = new Date(now); limitPermis.setDate(limitPermis.getDate() + 60);
  var limitAssurance = new Date(now); limitAssurance.setDate(limitAssurance.getDate() + 30);
  if (permisDate) {
    badges.push(permisDate < now
      ? '<span class="inline-badge-danger">🪪 Permis expiré</span>'
      : permisDate < limitPermis ? '<span class="inline-badge-warning">🪪 Permis proche</span>' : '');
  }
  if (assuranceDate) {
    badges.push(assuranceDate < now
      ? '<span class="inline-badge-danger">🛡️ Assurance expirée</span>'
      : assuranceDate < limitAssurance ? '<span class="inline-badge-warning">🛡️ Assurance proche</span>' : '');
  }
  var incidents = charger('incidents').filter(function(item) { return item.statut === 'ouvert' && (item.salId === salarie.id || item.chaufId === salarie.id); });
  if (incidents.length) badges.push('<span class="inline-badge-danger">🚨 ' + incidents.length + ' incident' + (incidents.length > 1 ? 's' : '') + '</span>');
  return badges.filter(Boolean).join('');
}

// L815 (script.js d'origine)
function ouvrirLivraisonsSalarie(salId) {
  var salarie = charger('salaries').find(function(item) { return item.id === salId; });
  naviguerVers('livraisons');
  setTimeout(function() {
    var filtre = document.getElementById('filtre-chauffeur');
    if (filtre) filtre.value = salId;
    var recherche = document.getElementById('filtre-recherche-liv');
    if (recherche && !filtre) recherche.value = salarie?.nom || '';
    if (typeof afficherLivraisons === 'function') afficherLivraisons();
  }, 120);
}

// L1505 (script.js d'origine)
function rafraichirDependancesSalaries() {
  mettreAJourSelects();
  if (typeof peuplerAbsenceSal === 'function') peuplerAbsenceSal();
  if (typeof peuplerSelectPlanningModal === 'function') peuplerSelectPlanningModal();
  if (typeof afficherPlanningSemaine === 'function') afficherPlanningSemaine();
  if (typeof afficherCompteurHeures === 'function') afficherCompteurHeures();
  if (typeof afficherChauffeurs === 'function') afficherChauffeurs();
  if (typeof afficherVehicules === 'function') afficherVehicules();
  if (typeof afficherMessagerie === 'function') afficherMessagerie();
  if (typeof afficherAlertes === 'function') afficherAlertes();
  if (typeof rafraichirDashboard === 'function') rafraichirDashboard();
}

// L1522 (script.js d'origine)
function mettreAJourKmVehiculeParSalarie(salId, km) {
  const valeur = parseFloat(km) || 0;
  if (!salId || !valeur) return;
  const vehicules = charger('vehicules');
  const idx = vehicules.findIndex(function(v) { return v.salId === salId; });
  if (idx === -1) return;
  const kmAvant = parseFloat(vehicules[idx].km) || 0;
  vehicules[idx].km = Math.max(parseFloat(vehicules[idx].km) || 0, valeur);
  if (!Number.isFinite(parseFloat(vehicules[idx].kmInitial))) vehicules[idx].kmInitial = kmAvant || valeur;
  sauvegarder('vehicules', vehicules);
}

// L1534 (script.js d'origine)
function getSalarieNomComplet(salarie, options) {
  if (!salarie) return '';
  const settings = options || {};
  let nom = String(salarie.nom || '').trim();
  let prenom = String(salarie.prenom || '').trim();
  if (nom && prenom) {
    const nomLower = nom.toLowerCase();
    const prenomLower = prenom.toLowerCase();
    if (nomLower === prenomLower) prenom = '';
    else if (nomLower.includes(prenomLower)) prenom = '';
    else if (prenomLower.includes(nomLower)) nom = prenom;
  }
  const morceaux = [];
  if (prenom) morceaux.push(prenom);
  if (nom) morceaux.push(nom);
  let label = morceaux.join(' ').replace(/\s+/g, ' ').trim() || nom || prenom || 'Salarié';
  if (settings.includePoste && salarie.poste) label += ' - ' + salarie.poste;
  if (settings.includeNumero && salarie.numero) label += ' (#' + salarie.numero + ')';
  return label;
}

// L1716 (script.js d'origine)
function activerModeSalarieUnifie() {
  document.body.classList.add('role-salarie-unified');
  chargerCadreSalarieUnifie();
  naviguerVers(PAGE_SALARIE_UNIFIED);
  requestAnimationFrame(function() {
    document.body.classList.remove('app-booting');
  });
}

// L2688 (script.js d'origine)
function ajouterChauffeur() {
  const nom    = document.getElementById('chauf-nom').value.trim();
  const prenom = document.getElementById('chauf-prenom')?.value.trim() || '';
  const nomComplet = prenom ? `${prenom} ${nom}` : nom;
  const tel = document.getElementById('chauf-tel').value.trim();
  const statut = document.getElementById('chauf-statut').value;
  if (!nom || !tel) { afficherToast('⚠️ Nom et téléphone obligatoires', 'error'); return; }
  const chauffeurs = charger('chauffeurs');
  chauffeurs.push({ id: genId(), nom: nomComplet, nomFamille: nom, prenom, tel, statut, creeLe: new Date().toISOString() });
  sauvegarder('chauffeurs', chauffeurs);
  closeModal('modal-chauffeur');
  ['chauf-nom','chauf-tel'].forEach(id => document.getElementById(id).value = '');
  afficherChauffeurs(); afficherToast('✅ Chauffeur ajouté !');
}

// L2703 (script.js d'origine)
function afficherChauffeurs() {
  const chauffeurs = charger('chauffeurs');
  const salaries   = charger('salaries');
  const vehicules  = charger('vehicules');
  const livraisons = charger('livraisons');
  const tb = document.getElementById('tb-chauffeurs');
  if (!tb) return; // page chauffeurs retirée par la refonte multi-onglets — no-op safe

  const salSansVeh = salaries.filter(s => !vehicules.find(v => v.salId === s.id));
  const sel = document.getElementById('sel-affecter-chauffeur');
  if (sel) {
    sel.innerHTML = '<option value="">-- Salariés sans véhicule --</option>';
    salSansVeh.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nom} (${s.numero})</option>`; });
  }

  if (!chauffeurs.length) { tb.innerHTML = emptyState('👤','Aucun chauffeur','Les chauffeurs sont créés automatiquement depuis la page Salariés.'); return; }
  tb.innerHTML = chauffeurs.map(c => {
    const livs = livraisons.filter(l => l.chaufId === c.id);
    const ca   = livs.reduce((s, l) => s + (l.prix||0), 0);
    const veh  = vehicules.find(v => v.salId === c.id);
    return `<tr>
      <td><strong>${c.nom}</strong></td><td>${c.tel}</td><td>${badgeChauffeur(c.statut)}</td>
      <td>${veh ? `<span style="color:var(--accent-2);font-size:0.82rem">🚐 ${veh.immat}</span>` : '<span style="color:var(--text-muted);font-size:0.82rem">—</span>'}</td>
      <td>${livs.length}</td><td>${euros(ca)}</td>
      <td style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <select class="btn-icon" data-tooltip="Statut chauffeur" onchange="changerStatutChauffeur('${c.id}',this.value)">
          <option value="disponible"   ${c.statut==='disponible'  ?'selected':''}>✅ Dispo</option>
          <option value="en-livraison" ${c.statut==='en-livraison'?'selected':''}>🚐 En route</option>
          <option value="inactif"      ${c.statut==='inactif'     ?'selected':''}>⏸️ Inactif</option>
        </select>
        ${buildInlineActionsDropdown('Actions', [
          { icon:'🗑️', label:'Supprimer', action:`supprimerChauffeur('${c.id}')`, danger:true }
        ])}
      </td></tr>`;
  }).join('');
}

// L2740 (script.js d'origine)
function changerStatutChauffeur(id, statut) {
  const ch = charger('chauffeurs'), i = ch.findIndex(c => c.id === id);
  if (i > -1) { ch[i].statut = statut; sauvegarder('chauffeurs', ch); }
}

// L2745 (script.js d'origine)
async function supprimerChauffeur(id) {
  const _ok4 = await confirmDialog('Supprimer ce chauffeur ?', {titre:'Supprimer',icone:'👤',btnLabel:'Supprimer'});
  if (!_ok4) return;
  sauvegarder('chauffeurs', charger('chauffeurs').filter(c => c.id !== id));
  afficherChauffeurs(); afficherToast('🗑️ Supprimé');
}

// L3933 (script.js d'origine)
function toggleFormulaireNewSalarie() {
  const el=document.getElementById('form-nouveau-salarie');
  if (el.style.display==='none') {
    el.style.display='block';
    ['nsal-nom','nsal-prenom','nsal-numero','nsal-mdp','nsal-tel'].forEach(id=>{ const champ=document.getElementById(id); if (champ) champ.value=''; });
    mettreAJourQualiteMdpSalarie('new');
    // Mettre à jour le select véhicule dans le formulaire
    const sv=document.getElementById('nsal-vehicule');
    if (sv) {
      const vehicules=charger('vehicules');
      sv.innerHTML='<option value="">-- Aucun pour l\'instant --</option>';
      vehicules.filter(v=>!v.salId).forEach(v=>{ sv.innerHTML+=`<option value="${v.id}">${v.immat} — ${v.modele}</option>`; });
    }
  } else { el.style.display='none'; }
}

// L3968 (script.js d'origine)
function mettreAJourQualiteMdpSalarie(mode) {
  const isAccess = mode === 'access';
  const input = document.getElementById(isAccess ? 'reset-mdp-val' : 'nsal-mdp');
  const hint = document.getElementById(isAccess ? 'reset-mdp-hint' : 'nsal-mdp-hint');
  if (!input || !hint) return;
  const evaluation = evaluerQualiteMotDePasse(input.value);
  hint.textContent = evaluation.texte;
  hint.style.color = evaluation.couleur;
}

// L3978 (script.js d'origine)
function genererMotDePasseSalarie(mode) {
  const isAccess = mode === 'access';
  const input = document.getElementById(isAccess ? 'reset-mdp-val' : 'nsal-mdp');
  if (!input) return;
  const numero = isAccess
    ? (document.getElementById('reset-mdp-numero')?.textContent || '')
    : (document.getElementById('nsal-numero')?.value || '');
  input.value = genererMotDePasseFort(numero || 'MCA');
  mettreAJourQualiteMdpSalarie(mode);
}

// L3989 (script.js d'origine)
function getStatutAccesSalarieLocal(salarie) {
  if (!salarie) return 'Fiche salarie introuvable.';
  if (salarie.actif === false) return 'Compte inactif. Reactivez le salarie avant de modifier son acces.';
  if (salarie.mdpHash) return 'Un mot de passe existe deja pour ce salarie.';
  return 'Aucun mot de passe defini pour le moment.';
}

// L3996 (script.js d'origine)
function genererEmailTechniqueSalarie(numero) {
  const base = String(numero || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
  return base ? `${base}@salarie.mca-logistics.fr` : '';
}

// L4007 (script.js d'origine)
function construirePayloadSupabaseSalarie(salarie) {
  if (!salarie) return null;
  const payload = {
    profile_id: salarie.profileId || null,
    numero: salarie.numero || null,
    nom: salarie.nomFamille || salarie.nom || null,
    prenom: salarie.prenom || null,
    poste: salarie.poste || null,
    permis: salarie.datePermis || null,
    assurance: salarie.dateAssurance || null,
    telephone: salarie.tel || null,
    email: salarie.email || genererEmailTechniqueSalarie(salarie.numero) || null,
    actif: salarie.actif !== false,
    updated_at: new Date().toISOString()
  };
  if (salarie.supabaseId) payload.id = salarie.supabaseId;
  return payload;
}

// L4026 (script.js d'origine)
async function synchroniserSalarieVersSupabase(salarie) {
  const client = getSupabaseClientSafe();
  const sessionAdmin = getAdminSession();
  if (!client || sessionAdmin.authMode !== 'supabase' || !salarie || !salarie.numero) return { ok: false, skipped: true };

  const payload = construirePayloadSupabaseSalarie(salarie);
  const previousNumero = salarie.previousNumero || null;
  let query = null;

  if (salarie.supabaseId) {
    query = client.from('salaries').update(payload).eq('id', salarie.supabaseId);
  } else if (previousNumero && previousNumero !== salarie.numero) {
    query = client.from('salaries').update(payload).eq('numero', previousNumero);
  } else {
    query = client.from('salaries').upsert(payload, { onConflict: 'numero' });
  }

  const { data, error } = await query
    .select('id, profile_id, numero, email, actif, nom, prenom, poste, permis, assurance, telephone')
    .single();

  if (error) return { ok: false, error: error };
  return { ok: true, record: data };
}

// L4051 (script.js d'origine)
async function supprimerSalarieDansSupabase(salarie) {
  const client = getSupabaseClientSafe();
  const sessionAdmin = getAdminSession();
  if (!client || sessionAdmin.authMode !== 'supabase' || !salarie) return { ok: false, skipped: true };
 
  // Étape 1 — Appel Edge Function : supprime auth.users + profiles + salaries en cascade
  if (window.DelivProAdminSupabase && window.DelivProAdminSupabase.deleteSalarieAccess) {
    const deleteAuthResult = await window.DelivProAdminSupabase.deleteSalarieAccess({
      salarieId: salarie.supabaseId || salarie.id || null,
      numero: salarie.numero || null
    });
    if (deleteAuthResult.ok) return { ok: true };
    console.warn('[MCA] Edge Function delete-salarie-access:', deleteAuthResult.error?.message || deleteAuthResult.reason);
  }
 
  // Étape 2 — Fallback : suppression directe dans la table salaries uniquement
  let query = client.from('salaries').delete();
  if (salarie.supabaseId)  query = query.eq('id', salarie.supabaseId);
  else if (salarie.id)     query = query.eq('id', salarie.id);
  else if (salarie.numero) query = query.eq('numero', salarie.numero);
  else return { ok: false, skipped: true };
 
  const { error } = await query;
  if (error) return { ok: false, error: error };
  return { ok: true };
}

// L4078 (script.js d'origine)
function hydraterSalarieLocalDepuisSupabase(salarie, record) {
  if (!salarie || !record) return salarie;
  salarie.supabaseId = record.id || salarie.supabaseId || '';
  salarie.profileId = record.profile_id || salarie.profileId || '';
  salarie.email = record.email || salarie.email || '';
  salarie.actif = record.actif !== false;
  return salarie;
}

// L4087 (script.js d'origine)
function notifierSynchroSalarie(resultat, actionLabel) {
  if (!resultat || resultat.skipped) return;
  // Succès sync Supabase = silencieux (opération normale, pas de bruit user)
  if (resultat.ok) return;
  const message = resultat.error?.message || 'Synchronisation Supabase indisponible';
  afficherToast(`⚠️ ${actionLabel} enregistré localement uniquement (${message})`, 'error');
}

// L4095 (script.js d'origine)
async function provisionnerAccesSalarie(salarie, password) {
  if (!salarie || !password) return { ok: false, reason: 'missing_data', error: { message: 'Donnees salarie manquantes' } };
  if (!window.DelivProAdminSupabase || !window.DelivProAdminSupabase.provisionSalarieAccess) {
    return { ok: false, reason: 'unavailable', error: { message: 'Provisioning Supabase indisponible' } };
  }
  const sessionAdmin = getAdminSession();
  if (sessionAdmin.authMode !== 'supabase') {
    return { ok: false, reason: 'admin_local_session', error: { message: 'Reconnectez-vous en admin via Supabase pour activer la synchro multi-appareils.' } };
  }

  const result = await window.DelivProAdminSupabase.provisionSalarieAccess({
    salarieId: salarie.supabaseId || null,
    numero: salarie.numero,
    nom: salarie.nomFamille || salarie.nom || '',
    prenom: salarie.prenom || '',
    email: salarie.email || genererEmailTechniqueSalarie(salarie.numero),
    password: password
  });

  if (!result.ok) return result;

  const salaries = charger('salaries');
  const idx = salaries.findIndex(function(item) { return item.id === salarie.id; });
  if (idx > -1) {
    salaries[idx].profileId = result.data?.profileId || salaries[idx].profileId || '';
    salaries[idx].supabaseId = result.data?.salarieId || salaries[idx].supabaseId || '';
    salaries[idx].email = result.data?.email || salaries[idx].email || '';
    salaries[idx].mdpHash = await hasherMotDePasseLocal(password);
    sauvegarder('salaries', salaries);
    return { ok: true, data: result.data || null, salarie: salaries[idx] };
  }

  return { ok: true, data: result.data || null, salarie: salarie };
}

// L4137 (script.js d'origine)
async function uploaderDocSalarie(input, type) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const okType = /^application\/pdf$|^image\//i.test(file.type);
  if (!okType) { afficherToast('Format non supporté (PDF ou image attendu)', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { afficherToast('Fichier trop lourd (5 Mo max)', 'error'); return; }

  const isEdit = input.id.startsWith('edit-');
  const labelEl = document.getElementById((isEdit ? 'edit-' : '') + 'nsal-doc-' + type + '-label');
  const wrapper = input.previousElementSibling;
  const cleanName = (window.DelivProStorage && window.DelivProStorage.sanitizeFilename)
    ? window.DelivProStorage.sanitizeFilename(file.name) : file.name;

  // Mode CREATION : on garde le blob en mémoire ; l'upload se fera dans creerSalarie
  // une fois le salarie.id genere.
  if (!isEdit || !window._editSalarieId) {
    const reader = new FileReader();
    reader.onload = e => {
      window.__salDocsTemp = window.__salDocsTemp || {};
      window.__salDocsTemp[type] = { data: e.target.result, type: file.type, nom: file.name };
      if (labelEl) labelEl.textContent = '✅ ' + file.name;
      if (wrapper && wrapper.classList) wrapper.classList.add('has-file');
    };
    reader.readAsDataURL(file);
    return;
  }

  // Mode EDITION : upload immediat vers Storage
  const salId = window._editSalarieId;
  const path = `${salId}/${type}/${Date.now()}_${cleanName}`;

  if (!window.DelivProStorage) {
    afficherToast('⚠️ Storage indisponible, document non enregistré', 'error');
    return;
  }

  if (labelEl) labelEl.textContent = '⏳ Envoi...';
  const up = await window.DelivProStorage.uploadBlob('salaries-docs', path, file, { contentType: file.type });
  if (!up.ok) {
    if (labelEl) labelEl.textContent = '❌ ' + (up.error?.message || 'echec');
    afficherToast('⚠️ Upload échoué : ' + (up.error?.message || 'erreur'), 'error');
    return;
  }

  // Met a jour salarie.docs[type] avec les metadata + insere dans salaries_documents
  const salaries = charger('salaries');
  const idx = salaries.findIndex(s => s.id === salId);
  if (idx > -1) {
    const previous = salaries[idx].docs && salaries[idx].docs[type];
    salaries[idx].docs = salaries[idx].docs || {};
    salaries[idx].docs[type] = {
      storage_path: path,
      bucket: 'salaries-docs',
      type: file.type,
      nom: file.name,
      taille: file.size,
      uploaded_at: new Date().toISOString()
    };
    sauvegarder('salaries', salaries);

    // Trace dans la table salaries_documents (pour audit/historique)
    try {
      const client = window.DelivProSupabase && window.DelivProSupabase.getClient();
      if (client) {
        await client.from('salaries_documents').insert({
          salarie_id: salId,
          type: type,
          storage_path: path,
          mime_type: file.type,
          taille_octets: file.size,
          nom_fichier: file.name
        });
      }
    } catch (_) {}

    // Supprime l'ancien fichier si on remplace un upload Storage existant
    if (previous && previous.storage_path && previous.storage_path !== path) {
      window.DelivProStorage.remove('salaries-docs', previous.storage_path).catch(function () {});
    }
  }

  if (labelEl) labelEl.textContent = '✅ ' + file.name;
  if (wrapper && wrapper.classList) wrapper.classList.add('has-file');
  afficherToast('✅ Document enregistré');
}

// L4225 (script.js d'origine)
async function visualiserDocSalarie(salId, type) {
  const sal = charger('salaries').find(s => s.id === salId);
  const doc = sal && sal.docs && sal.docs[type];
  if (!doc) { afficherToast('Aucun document de ce type', 'info'); return; }

  const isPdf = (doc.type || '').includes('pdf');
  const titreType = ({ permis:'Permis', cni:'CNI', iban:'IBAN', vitale:'Carte vitale', medecine:'Médecine du travail' })[type] || type;
  const label = sal.nom + ' — ' + titreType;

  // Cas legacy base64
  if (doc.data && String(doc.data).indexOf('data:') === 0) {
    afficherDocumentDansFenetre(doc.data, isPdf, label);
    return;
  }

  // Cas Storage : download blob + objectURL
  if (!doc.storage_path || !window.DelivProStorage) {
    afficherToast('Document indisponible', 'info');
    return;
  }
  afficherToast('⏳ Chargement du document...', 'info');
  const bucket = doc.bucket || 'salaries-docs';
  const dl = await window.DelivProStorage.download(bucket, doc.storage_path);
  if (!dl.ok) { afficherToast('⚠️ Lien indisponible : ' + (dl.error?.message || 'erreur'), 'error'); return; }
  const objectUrl = URL.createObjectURL(dl.blob);
  afficherDocumentDansFenetre(objectUrl, isPdf, label);
  setTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 300000);
}

// L4254 (script.js d'origine)
async function creerSalarie() {
  const nom    = document.getElementById('nsal-nom').value.trim();
  const prenom = document.getElementById('nsal-prenom')?.value.trim() || '';
  const nomComplet = prenom ? `${prenom} ${nom}` : nom;
  const numero = document.getElementById('nsal-numero').value.trim().toUpperCase();
  const mdp    = document.getElementById('nsal-mdp').value;
  const tel    = document.getElementById('nsal-tel').value.trim();
  const emailSaisi = document.getElementById('nsal-email')?.value.trim() || '';
  const poste  = document.getElementById('nsal-poste')?.value.trim() || '';
  const datePermis    = document.getElementById('nsal-date-permis')?.value || '';
  const dateAssurance = document.getElementById('nsal-date-assurance')?.value || '';
  const vehId  = document.getElementById('nsal-vehicule')?.value || '';
  const categoriePermis = document.getElementById('nsal-cat-permis')?.value || '';
  const getV = (id) => (document.getElementById(id)?.value || '').trim();
  const visiteMedicale = {
    date: getV('nsal-visite-date'),
    aptitude: getV('nsal-visite-aptitude'),
    dateExpiration: getV('nsal-visite-date-exp')
  };

  if (!nom||!numero||!mdp) { afficherToast('⚠️ Nom, numero et mot de passe obligatoires', 'error'); return; }
  const qualiteMdp = evaluerQualiteMotDePasseFort(mdp);
  if (!qualiteMdp.ok) { afficherToast('⚠️ ' + qualiteMdp.message, 'error'); return; }
  const salaries=charger('salaries');
  if (salaries.find(s=>s.numero===numero)) { afficherToast('⚠️ Ce numéro existe déjà', 'error'); return; }

  const salarie={
    id:genId(), nom:nomComplet, nomFamille:nom, prenom, numero,
    email: emailSaisi || genererEmailTechniqueSalarie(numero),
    emailPersonnel: emailSaisi || '',
    mdpHash:await hasherMotDePasseLocal(mdp),
    tel, poste, datePermis, dateAssurance, categoriePermis,
    visiteMedicale,
    actif:true, creeLe:new Date().toISOString()
  };
  // Upload des documents temp (permis, cni, iban, vitale, medecine) vers Supabase Storage.
  // Le base64 reste en localStorage en fallback si l'upload echoue (mode offline).
  if (window.__salDocsTemp && Object.keys(window.__salDocsTemp).length) {
    salarie.docs = {};
    const tempCopy = Object.assign({}, window.__salDocsTemp);
    window.__salDocsTemp = {};

    if (window.DelivProStorage) {
      const supaClient = window.DelivProSupabase && window.DelivProSupabase.getClient();
      for (const t of Object.keys(tempCopy)) {
        const d = tempCopy[t];
        if (!d || !d.data) continue;
        const cleanName = window.DelivProStorage.sanitizeFilename(d.nom || t);
        const path = `${salarie.id}/${t}/${Date.now()}_${cleanName}`;
        const up = await window.DelivProStorage.uploadDataUrl('salaries-docs', path, d.data, { contentType: d.type });
        if (up.ok) {
          salarie.docs[t] = { storage_path: path, bucket: 'salaries-docs', type: d.type, nom: d.nom, uploaded_at: new Date().toISOString() };
          if (supaClient) {
            try {
              await supaClient.from('salaries_documents').insert({
                salarie_id: salarie.id, type: t, storage_path: path,
                mime_type: d.type, nom_fichier: d.nom
              });
            } catch (_) {}
          }
        } else {
          // Fallback : on garde le base64 si l'upload echoue
          salarie.docs[t] = d;
          console.warn('[creerSalarie] upload doc', t, 'echoue, base64 conserve:', up.error?.message);
        }
      }
    } else {
      // Storage indisponible : fallback complet base64
      Object.assign(salarie.docs, tempCopy);
    }

    ['permis', 'cni', 'iban', 'vitale', 'medecine'].forEach(t => {
      const lbl = document.getElementById('nsal-doc-' + t + '-label');
      const inp = document.getElementById('nsal-doc-' + t);
      if (lbl) lbl.textContent = '📎 Choisir un fichier';
      if (inp) { inp.value = ''; const wrap = inp.previousElementSibling; if (wrap && wrap.classList) wrap.classList.remove('has-file'); }
    });
  }
  salaries.push(salarie);
  sauvegarder('salaries', salaries);

  // Ajouter comme chauffeur
  const chauffeurs=charger('chauffeurs');
  if (!chauffeurs.find(c=>c.id===salarie.id)) {
    chauffeurs.push({ id:salarie.id, nom:nomComplet, tel, statut:'disponible', creeLe:salarie.creeLe });
    sauvegarder('chauffeurs', chauffeurs);
  }

  // Affecter le véhicule si sélectionné
  if (vehId) {
    const vehicules=charger('vehicules');
    const vi=vehicules.findIndex(v=>v.id===vehId);
    if (vi>-1 && !vehicules[vi].salId) { vehicules[vi].salId=salarie.id; vehicules[vi].salNom=nomComplet; sauvegarder('vehicules', vehicules); }
  }

  const syncResult = await synchroniserSalarieVersSupabase(salarie);
  if (syncResult.ok && syncResult.record) {
    hydraterSalarieLocalDepuisSupabase(salarie, syncResult.record);
    sauvegarder('salaries', salaries);
  }
  const provisionResult = await provisionnerAccesSalarie(salarie, mdp);
  if (provisionResult?.ok && provisionResult.salarie) {
    salarie.profileId = provisionResult.salarie.profileId || salarie.profileId || '';
    salarie.supabaseId = provisionResult.salarie.supabaseId || salarie.supabaseId || '';
    salarie.email = provisionResult.salarie.email || salarie.email || '';
    salarie.mdpHash = provisionResult.salarie.mdpHash || salarie.mdpHash;
  }

  ['nsal-nom','nsal-prenom','nsal-numero','nsal-mdp','nsal-tel','nsal-email',
    'nsal-date-permis','nsal-date-assurance',
    'nsal-visite-date','nsal-visite-date-exp'
  ].forEach(id => { const el=document.getElementById(id); if (el) el.value=''; });
  ['nsal-poste','nsal-vehicule','nsal-cat-permis','nsal-visite-aptitude'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const transportSec = document.getElementById('nsal-transport-section');
  if (transportSec) transportSec.open = false;
  mettreAJourQualiteMdpSalarie('new');
  document.getElementById('form-nouveau-salarie').style.display='none';
  afficherSalaries();
  rafraichirDependancesSalaries();
  if (provisionResult?.ok) afficherToast(`✅ Salarie cree pour ${nomComplet} avec acces multi-appareils`);
  else if (provisionResult && !provisionResult.ok) afficherToast(`⚠️ Salarie cree pour ${nomComplet}, mais l'acces distant n'a pas pu etre active (${provisionResult.error?.message || provisionResult.reason || 'erreur inconnue'})`, 'error');
  else afficherToast(`✅ Salarie cree pour ${nomComplet}`);
  notifierSynchroSalarie(syncResult, 'Salarie');
}

// L4381 (script.js d'origine)
function afficherSalaries() {
  const salaries=charger('salaries'), vehicules=charger('vehicules');
  const tb=document.getElementById('tb-salaries');
  if (!tb) return;
  paginer.__reload_tb_salaries = afficherSalaries;
  if (!salaries.length) {
    nettoyerPagination('tb-salaries');
    tb.innerHTML=emptyState('👥','Aucun salarié','Créez votre premier salarié pour commencer.');
    return;
  }
  // Mettre à jour le select poste
  majSelectsPostes();
  paginer(salaries, 'tb-salaries', function(items) {
    return items.map(s=>{
    const veh=getSalarieVehicule(s);
    const stats = getSalarieStatsMois(s.id);
    const vehLabel=veh
      ? `<button type="button" class="table-link-button" onclick="ouvrirFicheVehiculeDepuisTableau('${veh.id}')" title="Ouvrir le véhicule" style="color:var(--accent-2);font-size:0.82rem">🚐 ${veh.immat}</button>`
      : `<span style="color:var(--text-muted);font-size:0.82rem">Non affecté</span>`;
    const badge=s.actif
      ? '<span class="badge badge-dispo">✅ Actif</span>'
      : '<span class="badge badge-inactif">⏸️ Inactif</span>';
    const noteInterne = charger_note_interne(s.id);
    const conformite = getSalarieConformiteBadges(s);
    const activite = `<div style="font-size:.82rem"><strong>${stats.livraisons}</strong> livr.</div><div style="font-size:.78rem;color:var(--text-muted)">${euros(stats.ca)} · ${stats.heures.toFixed(1)} h</div>`;
    return `<tr>
      <td><button type="button" class="table-link-button" onclick="ouvrirLivraisonsSalarie('${s.id}')" title="Voir ses livraisons"><strong>${s.nom}</strong></button>${noteInterne?'<span class="note-dot" title="Note interne"></span>':''}${s.poste?`<br><span style="color:var(--text-muted);font-size:0.78rem">${s.poste}</span>`:'<br><span style="color:var(--text-muted);font-size:0.78rem">Aucun poste</span>'}${conformite?`<div style="margin-top:6px">${conformite}</div>`:''}</td>
      <td><code style="background:var(--bg-dark);padding:2px 8px;border-radius:4px;font-size:0.85rem">${s.numero}</code></td>
      <td>${s.tel||'—'}</td><td>${vehLabel}</td><td>${activite}</td><td>${badge}</td>
      <td>
        ${buildInlineActionsDropdown('Actions', [
          { icon:'✏️', label:'Modifier la fiche', action:`ouvrirEditSalarie('${s.id}')` },
          { icon:'🔑', label:"Gérer l'accès", action:`ouvrirGestionAccesSalarie('${s.id}','${s.nom}')` },
          { icon:'📅', label:'Voir le planning', action:`ouvrirPlanningSalarie('${s.id}')` },
          { icon:'⏱️', label:'Voir heures & km', action:`ouvrirHeuresSalarie('${s.id}')` },
          { icon:'📋', label:'Fiche tournée', action:`genererFicheTournee('${s.id}')` },
          { icon:'📝', label:'Note interne', action:`ouvrirNoteInterne('${s.id}','${s.nom}')` },
          { icon:(s.actif?'⏸️':'▶️'), label:(s.actif?'Désactiver':'Activer'), action:`toggleActifSalarie('${s.id}')` },
          { icon:'🗑️', label:'Supprimer', action:`supprimerSalarie('${s.id}')`, danger:true }
        ])}
      </td></tr>`;
    }).join('');
  }, 12);
}

// L4426 (script.js d'origine)
async function ouvrirEditSalarie(id) {
  window._editSalarieId = id;
  editSalarieId = id;
  const sal=charger('salaries').find(s=>s.id===id); if(!sal) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('salarie', id, sal.nom || 'Salarié');
  if (!lockResult.ok) {
    afficherToast(`⚠️ Fiche salarié en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    editSalarieId = null;
    window._editSalarieId = null;
    return;
  }
  document.getElementById('edit-sal-nom').value    = sal.nomFamille || sal.nom;
  if (document.getElementById('edit-sal-prenom')) document.getElementById('edit-sal-prenom').value = sal.prenom || '';
  document.getElementById('edit-sal-numero').value = sal.numero;
  document.getElementById('edit-sal-tel').value    = sal.tel||'';
  if (document.getElementById('edit-sal-poste')) document.getElementById('edit-sal-poste').value = sal.poste||'';
  if (document.getElementById('edit-sal-date-permis')) document.getElementById('edit-sal-date-permis').value = sal.datePermis||'';
  if (document.getElementById('edit-sal-date-assurance')) document.getElementById('edit-sal-date-assurance').value = sal.dateAssurance||'';
  if (document.getElementById('edit-sal-cat-permis')) document.getElementById('edit-sal-cat-permis').value = sal.categoriePermis || '';
  const vm = sal.visiteMedicale || {};
  if (document.getElementById('edit-sal-visite-date')) document.getElementById('edit-sal-visite-date').value = vm.date || '';
  if (document.getElementById('edit-sal-visite-aptitude')) document.getElementById('edit-sal-visite-aptitude').value = vm.aptitude || '';
  if (document.getElementById('edit-sal-visite-date-exp')) document.getElementById('edit-sal-visite-date-exp').value = vm.dateExpiration || '';

  // Charger select véhicule
  const vehicules=charger('vehicules');
  const sve=document.getElementById('edit-sal-vehicule');
  if (sve) {
    const vehAct=vehicules.find(v=>v.salId===id);
    sve.innerHTML='<option value="">-- Retirer l\'affectation --</option>';
    vehicules.forEach(v=>{
      const pris = v.salId && v.salId !== id;
      if (!pris) sve.innerHTML+=`<option value="${v.id}" ${v.salId===id?'selected':''}>${v.immat} — ${v.modele}</option>`;
    });
  }
  document.getElementById('modal-edit-salarie').classList.add('open');
  afficherAlerteVerrouModal('modal-edit-salarie', '');
}

// L4466 (script.js d'origine)
async function confirmerEditSalarie() {
  surveillerConflitsEditionActifs();
  const lockState = verifierVerrouEdition('salarie', editSalarieId || window._editSalarieId);
  if (!lockState.ok) {
    afficherToast(`⚠️ Cette fiche salarié est verrouillée par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const nomFamille = document.getElementById('edit-sal-nom').value.trim();
  const prenom     = document.getElementById('edit-sal-prenom')?.value.trim()||'';
  const nomComplet = prenom ? `${prenom} ${nomFamille}` : nomFamille;
  const numero = document.getElementById('edit-sal-numero').value.trim().toUpperCase();
  const tel    = document.getElementById('edit-sal-tel').value.trim();
  const poste  = document.getElementById('edit-sal-poste')?.value.trim()||'';
  const vehId  = document.getElementById('edit-sal-vehicule')?.value||'';
  const datePermis    = document.getElementById('edit-sal-date-permis')?.value||'';
  const dateAssurance = document.getElementById('edit-sal-date-assurance')?.value||'';

  if (!nomFamille||!numero) { afficherToast('⚠️ Nom et numéro obligatoires', 'error'); return; }
  const salaries=charger('salaries');
  if (salaries.find(s=>s.numero===numero&&s.id!==editSalarieId)) { afficherToast('⚠️ Numéro déjà utilisé', 'error'); return; }
  const idx=salaries.findIndex(s=>s.id===editSalarieId);
  if (idx>-1) {
    const ancienNumero = salaries[idx].numero || null;
    salaries[idx].nom=nomComplet; salaries[idx].nomFamille=nomFamille; salaries[idx].prenom=prenom;
    salaries[idx].numero=numero; salaries[idx].email=genererEmailTechniqueSalarie(numero); salaries[idx].tel=tel; salaries[idx].poste=poste;
    salaries[idx].datePermis=datePermis; salaries[idx].dateAssurance=dateAssurance;
    salaries[idx].categoriePermis = document.getElementById('edit-sal-cat-permis')?.value || '';
    salaries[idx].visiteMedicale = {
      date: document.getElementById('edit-sal-visite-date')?.value || '',
      aptitude: document.getElementById('edit-sal-visite-aptitude')?.value || '',
      dateExpiration: document.getElementById('edit-sal-visite-date-exp')?.value || ''
    };
    salaries[idx].previousNumero = ancienNumero;
    sauvegarder('salaries', salaries);
    // Propager dans chauffeurs
    const ch=charger('chauffeurs'), ci=ch.findIndex(c=>c.id===editSalarieId);
    if(ci>-1){ch[ci].nom=nomComplet;ch[ci].tel=tel;sauvegarder('chauffeurs',ch);}
    // Mettre à jour affectation véhicule
    const vehicules=charger('vehicules');
    // Retirer l'ancienne affectation de ce salarié
    vehicules.forEach(v=>{ if(v.salId===editSalarieId){v.salId=null;v.salNom=null;} });
    // Attribuer le nouveau véhicule si sélectionné
    if (vehId) {
      const vi=vehicules.findIndex(v=>v.id===vehId);
      if(vi>-1){vehicules[vi].salId=editSalarieId;vehicules[vi].salNom=nomComplet;}
    }
    sauvegarder('vehicules', vehicules);

    const syncResult = await synchroniserSalarieVersSupabase(salaries[idx]);
    if (syncResult.ok && syncResult.record) {
      hydraterSalarieLocalDepuisSupabase(salaries[idx], syncResult.record);
      delete salaries[idx].previousNumero;
      sauvegarder('salaries', salaries);
    }
    notifierSynchroSalarie(syncResult, 'Modification salarie');
  }
  closeModal('modal-edit-salarie');
  editSalarieId=null; window._editSalarieId=null;
  afficherSalaries();
  rafraichirDependancesSalaries();
  afficherToast('✅ Fiche mise à jour');
}

// L4529 (script.js d'origine)
function ouvrirGestionAccesSalarie(id, nom) {
  accessSalarieTargetId = id;
  const salarie = charger('salaries').find(function(item) { return item.id === id; });
  const sessionAdmin = getAdminSession();
  document.getElementById('reset-mdp-nom').textContent = nom || salarie?.nom || 'Salarie';
  document.getElementById('reset-mdp-numero').textContent = salarie?.numero || '—';
  document.getElementById('reset-mdp-statut').textContent = sessionAdmin.authMode === 'supabase'
    ? 'Mode multi-appareils actif. Ce mot de passe mettra a jour le compte Supabase du salarie.'
    : 'Mode local admin. Le mot de passe sera mis a jour localement uniquement tant que vous ne vous reconnectez pas via Supabase.';
  document.getElementById('reset-mdp-val').value = '';
  genererMotDePasseSalarie('access');
  document.getElementById('modal-reset-mdp').classList.add('open');
}

// L4564 (script.js d'origine)
function toggleActifSalarie(id) {
  const salaries=charger('salaries'),idx=salaries.findIndex(s=>s.id===id);
  if(idx>-1){
    salaries[idx].actif=!salaries[idx].actif;
    sauvegarder('salaries',salaries);
    afficherSalaries();
    rafraichirDependancesSalaries();
    afficherToast(salaries[idx].actif?'✅ Activé':'⏸️ Désactivé');
    synchroniserSalarieVersSupabase(salaries[idx]).then(function(resultat){
      if (resultat.ok && resultat.record) {
        hydraterSalarieLocalDepuisSupabase(salaries[idx], resultat.record);
        sauvegarder('salaries', salaries);
      }
      notifierSynchroSalarie(resultat, 'Statut salarie');
    });
  }
}

// L4582 (script.js d'origine)
async function supprimerSalarie(id) {
  const sal = charger('salaries').find(s => s.id === id);
  const _ok1 = await confirmDialog(`Supprimer ${sal?.nom || 'ce salarié'} ? Toutes ses données seront effacées.`, {titre:'Supprimer le salarié',icone:'🗑️',btnLabel:'Supprimer'});
  if (!_ok1) return;

  const syncResult = await supprimerSalarieDansSupabase(sal);

  // 1. Supprimer de la liste salariés
  sauvegarder('salaries', charger('salaries').filter(s => s.id !== id));

  // 2. Supprimer de la liste chauffeurs
  sauvegarder('chauffeurs', charger('chauffeurs').filter(c => c.id !== id));

  // 3. Retirer l'affectation véhicule
  const vehicules = charger('vehicules');
  vehicules.forEach(v => { if (v.salId === id) { v.salId = null; v.salNom = null; } });
  sauvegarder('vehicules', vehicules);

  // 4. Supprimer ses données personnelles (km, carburant perso, inspections, messages, checklist, planning, notifs)
  const keysToRemove = [
    `km_sal_${id}`, `carb_sal_${id}`, `km_report_${id}`,
    `messages_${id}`, `notifs_sal_${id}`
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // 5. Supprimer ses checklists (toutes les dates)
  Object.keys(localStorage).filter(k => k.startsWith(`checklist_${id}_`)).forEach(k => localStorage.removeItem(k));

  // 6. Supprimer ses inspections du global
  const inspections = loadSafe('inspections', []).filter(i => i.salId !== id);
  localStorage.setItem('inspections', JSON.stringify(inspections));

  // 7. Supprimer son planning
  const plannings = loadSafe('plannings', []).filter(p => p.salId !== id);
  localStorage.setItem('plannings', JSON.stringify(plannings));

  // 8. Supprimer ses pleins du global carburant (garder les pleins admin)
  const carburant = charger('carburant').filter(p => !(p.salId === id && p.source === 'salarie'));
  sauvegarder('carburant', carburant);

  // 9. Anonymiser ses livraisons (garder l'historique mais retirer le lien)
  const livraisons = charger('livraisons');
  livraisons.forEach(l => { if (l.chaufId === id) { l.chaufId = null; l.chaufNom = (sal?.nom||'Salarié supprimé') + ' (archivé)'; } });
  sauvegarder('livraisons', livraisons);

  afficherSalaries();
  rafraichirDependancesSalaries();
  afficherToast(`🗑️ ${sal?.nom || 'Salarié'} et toutes ses données supprimés`);
  notifierSynchroSalarie(syncResult, 'Suppression salarie');
}

// L4641 (script.js d'origine)
function badgeChauffeur(s) {
  return { 'disponible':'<span class="badge badge-dispo">✅ Disponible</span>', 'en-livraison':'<span class="badge badge-actif">🚐 En livraison</span>', 'inactif':'<span class="badge badge-inactif">⏸️ Inactif</span>' }[s] || s;
}

// L4762 (script.js d'origine)
function filtrerInspParSalarieInput() {
  const input = document.getElementById('filtre-insp-sal-input')?.value.trim() || '';
  const hidden = document.getElementById('filtre-insp-sal');
  if (!input) { if (hidden) hidden.value = ''; afficherInspections(); return; }
  const sal = charger('salaries').find(s => s.nom.toLowerCase() === input.toLowerCase());
  if (hidden) hidden.value = sal ? sal.id : '';
  afficherInspections();
}

// L5604 (script.js d'origine)
function calculerHeuresSalarie(salId) {
  const plannings = loadSafe('plannings', []);
  const plan = plannings.find(p => p.salId === salId);
  if (!plan?.semaine) return { planifiees: 0, details: [] };

  let total = 0;
  const details = [];
  plan.semaine.forEach(j => {
    if (!j.travaille || !j.heureDebut || !j.heureFin) return;
    const duree = calculerDureeJour(j.heureDebut, j.heureFin);
    if (duree > 0) { total += duree * 60; details.push({ jour: j.jour, duree }); }
  });
  return { planifiees: total / 60, details };
}

// L5919 (script.js d'origine)
function ouvrirHistoriqueConducteurs(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId);
  if (!veh) return;
  document.getElementById('hist-cond-titre').textContent = `${veh.immat} — ${veh.modele||''}`;
  afficherHistoriqueConducteurs(vehId);
  openModal('modal-hist-conducteurs');
}

// L5942 (script.js d'origine)
function afficherHistoriqueConducteurs(vehId) {
  const cle  = 'conducteurs_veh_' + vehId;
  const hist = loadSafe(cle, []).reverse().slice(0, 50);
  // Afficher dans la modal ou dans un container inline
  const cont = document.getElementById('hist-conducteurs-modal') ||
               document.getElementById('hist-conducteurs-' + vehId);
  if (!cont) return;
  if (!hist.length) {
    cont.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:.85rem">Aucune conduite enregistrée pour ce véhicule.</div>';
    return;
  }
  cont.innerHTML = hist.map(h => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:.85rem">
      <div>
        <strong>${h.salNom}</strong>
        ${h.livNom ? `<span style="font-size:.78rem;color:var(--text-muted)"> · ${h.livNom}</span>` : ''}
        ${h.numLiv ? `<span style="font-size:.72rem;color:var(--text-muted)"> (${h.numLiv})</span>` : ''}
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        ${h.distance ? `<span style="font-size:.78rem;color:var(--accent)">${h.distance} km</span>` : ''}
        <span style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${h.date}</span>
      </div>
    </div>`).join('');
}

// L6186 (script.js d'origine)
function verifierDocumentsSalaries() {
  const salaries = charger('salaries');
  const auj = new Date();
  auj.setHours(0,0,0,0);

  salaries.forEach(s => {
    if (s.datePermis) {
      const d = new Date(s.datePermis);
      d.setHours(0,0,0,0);
      const diff = Math.ceil((d - auj) / (1000*60*60*24));
      if (diff < 0) {
        ajouterAlerteSiAbsente(
          'permis_expire_'+s.id,
          `⚠️ Permis expiré — ${s.nom} (expiré depuis ${Math.abs(diff)} jour(s))`,
          { salId:s.id, salNom:s.nom }
        );
      } else if (diff === 0) {
        ajouterAlerteSiAbsente(
          'permis_expire_'+s.id,
          `⚠️ Permis expire AUJOURD'HUI — ${s.nom}`,
          { salId:s.id, salNom:s.nom }
        );
      } else if (diff <= 60) {
        ajouterAlerteSiAbsente(
          'permis_proche_'+s.id,
          `🪪 Permis expire dans ${diff} jour(s) — ${s.nom} (${s.datePermis})`,
          { salId:s.id, salNom:s.nom }
        );
      }
    }
    if (s.dateAssurance) {
      const d = new Date(s.dateAssurance);
      d.setHours(0,0,0,0);
      const diff = Math.ceil((d - auj) / (1000*60*60*24));
      if (diff < 0) {
        ajouterAlerteSiAbsente(
          'assurance_expire_'+s.id,
          `⚠️ Assurance expirée — ${s.nom} (expirée depuis ${Math.abs(diff)} jour(s))`,
          { salId:s.id, salNom:s.nom }
        );
      } else if (diff === 0) {
        ajouterAlerteSiAbsente(
          'assurance_expire_'+s.id,
          `⚠️ Assurance expire AUJOURD'HUI — ${s.nom}`,
          { salId:s.id, salNom:s.nom }
        );
      } else if (diff <= 30) {
        ajouterAlerteSiAbsente(
          'assurance_proche_'+s.id,
          `🛡️ Assurance expire dans ${diff} jour(s) — ${s.nom} (${s.dateAssurance})`,
          { salId:s.id, salNom:s.nom }
        );
      }
    }
    // Alerte visite médicale (R.4624-10 — obligation employeur visite d'embauche + périodique)
    const docsExp = [
      { key: 'visite', dateStr: s.visiteMedicale?.dateExpiration, labelExp: 'Visite médicale expirée', labelProche: 'Visite médicale expire', seuil: 60 }
    ];
    docsExp.forEach(function(doc) {
      if (!doc.dateStr) return;
      const d = new Date(doc.dateStr);
      d.setHours(0,0,0,0);
      const diff = Math.ceil((d - auj) / (1000*60*60*24));
      if (diff < 0) {
        ajouterAlerteSiAbsente(
          doc.key + '_expire_' + s.id,
          '⚠️ ' + doc.labelExp + ' — ' + s.nom + ' (depuis ' + Math.abs(diff) + ' jour(s))',
          { salId: s.id, salNom: s.nom }
        );
      } else if (diff === 0) {
        ajouterAlerteSiAbsente(
          doc.key + '_expire_' + s.id,
          '⚠️ ' + doc.labelProche + ' AUJOURD\'HUI — ' + s.nom,
          { salId: s.id, salNom: s.nom }
        );
      } else if (diff <= doc.seuil) {
        ajouterAlerteSiAbsente(
          doc.key + '_proche_' + s.id,
          doc.labelProche + ' dans ' + diff + ' jour(s) — ' + s.nom + ' (' + doc.dateStr + ')',
          { salId: s.id, salNom: s.nom }
        );
      }
    });
    if (s.visiteMedicale?.aptitude === 'inapte') {
      ajouterAlerteSiAbsente(
        'visite_inapte_' + s.id,
        '🚨 Inaptitude médicale déclarée — ' + s.nom + ' · ne peut pas conduire',
        { salId: s.id, salNom: s.nom }
      );
    }
  });

  // Recalcul badge temps réel
  const toutes = charger('alertes_admin') || [];
  const nonTraitees = toutes.filter(a => !a.lu && !a.traitee).length;
  const badge = document.getElementById('badge-alertes');
  const kpi = document.getElementById('kpi-alertes');
  if (badge) {
    badge.textContent = nonTraitees;
    badge.style.display = nonTraitees > 0 ? 'inline-block' : 'none';
  }
  if (kpi) kpi.textContent = nonTraitees;
}

// L7094 (script.js d'origine)
function nettoyerHistoriqueModifsLivraisons() {
  // Throttle 1×/jour : sinon chaque DOMContentLoaded déclenche N removeItem sync = rafale egress au boot.
  const dernier = parseInt(localStorage.getItem('delivpro_modifs_cleanup_at') || '0', 10) || 0;
  if (Date.now() - dernier < 24 * 60 * 60 * 1000) return;
  const limite = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const aSupprimer = [];
  for (let i = 0; i < localStorage.length; i++) {
    const cle = localStorage.key(i);
    if (!cle || !cle.startsWith('modifs_liv_')) continue;
    try {
      const logs = loadSafe(cle, []);
      const derniereDate = Array.isArray(logs) && logs.length ? Date.parse(logs[logs.length - 1]?.date || logs[0]?.date || '') : 0;
      if (!derniereDate || Number.isNaN(derniereDate) || derniereDate < limite) aSupprimer.push(cle);
    } catch (_) {
      aSupprimer.push(cle);
    }
  }
  aSupprimer.forEach(cle => localStorage.removeItem(cle));
  localStorage.setItem('delivpro_modifs_cleanup_at', String(Date.now()));
}

// L7115 (script.js d'origine)
function afficherHistoriqueModifs(livId) {
  const cle  = 'modifs_liv_' + livId;
  const logs = loadSafe(cle, []).reverse();
  const cont = document.getElementById('historique-modifs-liv');
  if (!cont) return;
  if (!logs.length) { cont.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">Aucune modification enregistrée</div>'; return; }
  cont.innerHTML = logs.map(l => `
    <div class="modif-log">
      <span class="modif-log-date">${new Date(l.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
      <span class="modif-log-qui">${l.par}</span>
      <span><strong>${l.champ}</strong> : <span style="color:var(--red)">${l.ancienne||'—'}</span> → <span style="color:var(--green)">${l.nouvelle||'—'}</span></span>
    </div>`).join('');
}

// L7684 (script.js d'origine)
function autoRemplirChauffeurDepuisVehicule() {
  const selChauf = document.getElementById('liv-chauffeur');
  const vehId = document.getElementById('liv-vehicule')?.value || '';
  if (!selChauf || !vehId) return;
  const affectation = synchroniserAffectationLivraison(selChauf.value || '', vehId);
  if (affectation.chaufId) selChauf.value = affectation.chaufId;
}

// L7702 (script.js d'origine)
function autoRemplirChauffeurDepuisVehiculeEdit() {
  const selChauf = document.getElementById('edit-liv-chauffeur');
  if (!selChauf) return;
  const affectation = synchroniserAffectationLivraison(
    selChauf.value || '',
    document.getElementById('edit-liv-vehicule')?.value || ''
  );
  if (affectation.chaufId) selChauf.value = affectation.chaufId;
}

