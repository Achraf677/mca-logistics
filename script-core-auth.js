/**
 * MCA Logistics — Module Core-auth
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L701 (script.js d'origine)
function getDefaultAdminAccounts() {
  // BUG-020 fix : plus aucun mot de passe par défaut. Premier démarrage = setup obligatoire.
  return [
    { identifiant: 'achraf.chikri', nom: 'Achraf Chikri', motDePasse: '' },
    { identifiant: 'mohammed.chikri', nom: 'Mohammed Chikri', motDePasse: '' }
  ];
}

// L708 (script.js d'origine)
function adminCompteEstConfigureLocal(compte) {
  if (!compte) return false;
  const hash = typeof compte.motDePasseHash === 'string' ? compte.motDePasseHash.trim() : '';
  if (hash.length >= 10) return true;
  const legacy = typeof compte.motDePasse === 'string' ? compte.motDePasse.trim() : '';
  return legacy.length > 0;
}

// L715 (script.js d'origine)
function getAdminAccounts() {
  const comptesExistants = chargerObj('admin_accounts', null);
  if (Array.isArray(comptesExistants) && comptesExistants.length) {
    // BUG-052 : purge les comptes sans mot de passe configuré (hash vide ou trop court)
    const valides = comptesExistants.filter(adminCompteEstConfigureLocal);
    if (valides.length !== comptesExistants.length) {
      sauvegarder('admin_accounts', valides);
    }
    if (valides.length) return valides;
  }
  // BUG-020 : si une clé legacy 'mdp_admin' existe (migration), on l'utilise pour le 1er compte.
  // Sinon, comptes créés sans mot de passe → login.html force le setup initial.
  const legacyPassword = localStorage.getItem('mdp_admin') || '';
  const comptes = getDefaultAdminAccounts().map((compte, idx) => ({
    ...compte,
    motDePasse: idx === 0 && legacyPassword ? legacyPassword : compte.motDePasse
  }));
  sauvegarder('admin_accounts', comptes);
  return comptes;
}

// L735 (script.js d'origine)
function saveAdminAccounts(comptes) {
  // BUG-052 : ne jamais persister un compte admin sans mot de passe
  const valides = Array.isArray(comptes) ? comptes.filter(adminCompteEstConfigureLocal) : [];
  sauvegarder('admin_accounts', valides);
}

// L743 (script.js d'origine)
function getSessionTimeoutMinutesAdmin() {
  const security = getSecurityHelper();
  if (security && typeof security.getSessionTimeoutMinutes === 'function') {
    return security.getSessionTimeoutMinutes();
  }
  return 30;
}

// L784 (script.js d'origine)
function getAdminSession() {
  const identifiant = sessionStorage.getItem('admin_login') || '';
  const email = sessionStorage.getItem('admin_email') || '';
  const nomBrut = sessionStorage.getItem('admin_nom') || '';
  const nomNormalise = window.DelivProAuth && typeof window.DelivProAuth.normalizeAdminDisplayName === 'function'
    ? window.DelivProAuth.normalizeAdminDisplayName(nomBrut, identifiant, email)
    : (nomBrut || '');
  if (nomNormalise && nomNormalise !== nomBrut) {
    sessionStorage.setItem('admin_nom', nomNormalise);
  }
  return {
    identifiant: identifiant,
    email: email,
    authMode: sessionStorage.getItem('auth_mode') || 'local',
    nom: nomNormalise
  };
}

// L806 (script.js d'origine)
function getAdminActorKey() {
  const session = getAdminSession();
  return session.email || session.identifiant || 'admin';
}

// L811 (script.js d'origine)
function getAdminActorLabel() {
  const session = getAdminSession();
  return session.nom || session.identifiant || session.email || 'Admin';
}

// L816 (script.js d'origine)
function getAdminEditLocks() {
  const locks = chargerObj(ADMIN_EDIT_LOCKS_KEY, {});
  const now = Date.now();
  let changed = false;
  Object.keys(locks).forEach(function(key) {
    const lock = locks[key];
    const createdAt = lock && lock.createdAt ? Date.parse(lock.createdAt) : 0;
    if (!lock || !createdAt || Number.isNaN(createdAt) || now - createdAt > ADMIN_EDIT_LOCK_TTL_MS) {
      delete locks[key];
      changed = true;
    }
  });
  if (changed) sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  return locks;
}

// L832 (script.js d'origine)
function getAdminEditLockKey(type, id) {
  return `${type}:${id}`;
}

// L956 (script.js d'origine)
function fermerMenuAdmin() {
  document.getElementById('topbar-user-menu')?.classList.remove('open');
}

// L961 (script.js d'origine)
function toggleAdminMenu(event) {
  event?.stopPropagation();
  const menu = document.getElementById('topbar-user-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}

// L967 (script.js d'origine)
function setBoutonDeconnexionAdminEtat(enCours) {
  const btn = document.getElementById('btn-admin-logout');
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  btn.disabled = !!enCours;
  btn.textContent = enCours ? 'Déconnexion...' : btn.dataset.defaultLabel;
}

// L974 (script.js d'origine)
function redirigerVersLoginAdmin() {
  if (window.__delivproRedirectPending) return;
  window.__delivproRedirectPending = true;
  document.body.classList.add('app-booting');
  window.location.replace('login.html');
}

// L980 (script.js d'origine)
function purgerSessionAdminLocale() {
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('auth_mode');
  sessionStorage.removeItem('admin_login');
  sessionStorage.removeItem('admin_email');
  sessionStorage.removeItem('admin_nom');
  sessionStorage.removeItem('delivpro_fast_boot_role');
}

// L988 (script.js d'origine)
function deconnexionAdmin() {
  if (window.__delivproAdminLogoutPending) return;
  window.__delivproAdminLogoutPending = true;
  ajouterEntreeAudit('Déconnexion admin', 'Fin de session admin');
  setBoutonDeconnexionAdminEtat(true);
  sessionStorage.setItem('delivpro_logged_out', '1');
  sessionStorage.setItem('delivpro_pending_signout', '1');
  purgerSessionAdminLocale();
  fermerMenuAdmin();
  redirigerVersLoginAdmin();
}

// L1198 (script.js d'origine)
function nettoyerSessionAppCourante() {
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('auth_mode');
  sessionStorage.removeItem('admin_login');
  sessionStorage.removeItem('admin_email');
  sessionStorage.removeItem('admin_nom');
  sessionStorage.removeItem('salarie_id');
  sessionStorage.removeItem('salarie_numero');
  sessionStorage.removeItem(FAST_BOOT_ROLE_KEY);
  sessionStorage.removeItem(TAB_AUTH_PENDING_KEY);
}

// L1231 (script.js d'origine)
function notifierMajAutreAdmin(detail) {
  // Toast retire : avec la sync realtime native (Phase 2.x), les changements
  // sont propages instantanement et silencieusement. Plus besoin de notifier.
  return;
}

// L1237 (script.js d'origine)
function lancerWarmupAdmin() {
  if (warmupAdminPromise) return warmupAdminPromise;
  warmupAdminPromise = (async function() {
    let syncInitResult = null;
    if (window.DelivProRemoteStorage && window.DelivProRemoteStorage.init) {
      syncInitResult = await window.DelivProRemoteStorage.init();
    }
    if (!syncInitResult?.ok) {
      afficherToast('⚠️ Mode local actif: synchro distante inactive, mais la synchro locale entre onglets reste disponible.', 'error');
    }
    nettoyerPhotosInspectionsAnciennes(false).catch(function(error) {
      console.warn('Nettoyage automatique des photos d’inspection échoué', error);
    });
    return { syncInitResult: syncInitResult };
  })().catch(function(error) {
    console.warn('Warmup admin différé échoué', error);
    return { ok: false, error: error };
  });
  return warmupAdminPromise;
}

// L1258 (script.js d'origine)
function getRoleSessionCourant() {
  return sessionStorage.getItem('role') || '';
}

// L1669 (script.js d'origine)
function getPageActiveAdminId() {
  return document.querySelector('.page.active')?.id || '';
}

// L1684 (script.js d'origine)
function gererChangementStorageAdmin(key) {
  if (!key) return;

  if (key === 'livraisons') {
    planifierRafraichissementSiPageActive('page-livraisons', 'page-livraisons', rafraichirVueLivraisonsActive);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-livraisons', rafraichirDashboard);
    planifierRafraichissementSiPageActive('page-relances', 'page-relances-livraisons', afficherRelances);
    planifierRafraichissementSiPageActive('page-statistiques', 'page-statistiques-livraisons', afficherStatistiques);
    planifierRafraichissementSiPageActive('page-previsions', 'page-previsions-livraisons', calculerPrevision);
    planifierRafraichissementSiPageActive('page-rentabilite', 'page-rentabilite-livraisons', afficherRentabilite);
    planifierRafraichissementSiPageActive('page-tva', 'page-tva-livraisons', afficherTva);
    planifierRafraichissementSiPageActive('page-chauffeurs', 'page-chauffeurs-livraisons', afficherChauffeurs);
    planifierRafraichissementSiPageActive('page-clients', 'page-clients-livraisons', afficherClients);
    planifierRafraichissementSiPageActive('page-heures', 'page-heures-livraisons', rafraichirVueHeuresEtKm);
    planifierRafraichissementStorage('badge-alertes', afficherBadgeAlertes);
    return;
  }

  if (key === 'clients') {
    planifierRafraichissementSiPageActive('page-clients', 'page-clients', afficherClients);
    planifierRafraichissementSiPageActive('page-livraisons', 'page-livraisons-clients', rafraichirVueLivraisonsActive);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-clients', afficherClientsDashboard);
    return;
  }

  if (key === 'salaries') {
    planifierRafraichissementSiPageActive('page-salaries', 'page-salaries', afficherSalaries);
    planifierRafraichissementSiPageActive('page-planning', 'page-planning-salaries', rafraichirVuePlanningAdmin);
    planifierRafraichissementSiPageActive('page-heures', 'page-heures-salaries', rafraichirVueHeuresEtKm);
    planifierRafraichissementSiPageActive('page-vehicules', 'page-vehicules-salaries', afficherVehicules);
    planifierRafraichissementSiPageActive('page-livraisons', 'page-livraisons-salaries', rafraichirVueLivraisonsActive);
    planifierRafraichissementSiPageActive('page-alertes', 'page-alertes-salaries', afficherAlertes);
    planifierRafraichissementSiPageActive('page-incidents', 'page-incidents-salaries', afficherIncidents);
    planifierRafraichissementSiPageActive('page-chauffeurs', 'page-chauffeurs-salaries', afficherChauffeurs);
    return;
  }

  if (key === 'chauffeurs') {
    planifierRafraichissementSiPageActive('page-chauffeurs', 'page-chauffeurs', afficherChauffeurs);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-chauffeurs', rafraichirDashboard);
    planifierRafraichissementSiPageActive('page-livraisons', 'page-livraisons-chauffeurs', rafraichirVueLivraisonsActive);
    planifierRafraichissementSiPageActive('page-statistiques', 'page-statistiques-chauffeurs', afficherStatistiques);
    planifierRafraichissementSiPageActive('page-previsions', 'page-previsions-chauffeurs', calculerPrevision);
    return;
  }

  if (key === 'vehicules') {
    planifierRafraichissementSiPageActive('page-vehicules', 'page-vehicules', afficherVehicules);
    planifierRafraichissementSiPageActive('page-carburant', 'page-carburant-vehicules', afficherCarburant);
    planifierRafraichissementSiPageActive('page-entretiens', 'page-entretiens-vehicules', afficherEntretiens);
    planifierRafraichissementSiPageActive('page-livraisons', 'page-livraisons-vehicules', rafraichirVueLivraisonsActive);
    planifierRafraichissementSiPageActive('page-tva', 'page-tva-vehicules', afficherTva);
    planifierRafraichissementSiPageActive('page-chauffeurs', 'page-chauffeurs-vehicules', afficherChauffeurs);
    planifierRafraichissementSiPageActive('page-heures', 'page-heures-vehicules', rafraichirVueHeuresEtKm);
    return;
  }

  if (key === 'carburant') {
    planifierRafraichissementSiPageActive('page-carburant', 'page-carburant', afficherCarburant);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-carburant', rafraichirDashboard);
    planifierRafraichissementSiPageActive('page-vehicules', 'page-vehicules-carburant', afficherVehicules);
    planifierRafraichissementSiPageActive('page-tva', 'page-tva-carburant', afficherTva);
    planifierRafraichissementSiPageActive('page-rentabilite', 'page-rentabilite-carburant', afficherRentabilite);
    planifierRafraichissementSiPageActive('page-statistiques', 'page-statistiques-carburant', afficherStatistiques);
    planifierRafraichissementSiPageActive('page-previsions', 'page-previsions-carburant', calculerPrevision);
    return;
  }

  if (key === 'charges') {
    planifierRafraichissementSiPageActive('page-charges', 'page-charges', afficherCharges);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-charges', rafraichirDashboard);
    planifierRafraichissementSiPageActive('page-tva', 'page-tva-charges', afficherTva);
    planifierRafraichissementSiPageActive('page-rentabilite', 'page-rentabilite-charges', afficherRentabilite);
    planifierRafraichissementSiPageActive('page-statistiques', 'page-statistiques-charges', afficherStatistiques);
    planifierRafraichissementSiPageActive('page-previsions', 'page-previsions-charges', calculerPrevision);
    planifierRafraichissementSiPageActive('page-entretiens', 'page-entretiens-charges', afficherEntretiens);
    return;
  }

  if (key === 'entretiens') {
    planifierRafraichissementSiPageActive('page-entretiens', 'page-entretiens', afficherEntretiens);
    planifierRafraichissementSiPageActive('page-vehicules', 'page-vehicules-entretiens', afficherVehicules);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-entretiens', rafraichirDashboard);
    planifierRafraichissementSiPageActive('page-tva', 'page-tva-entretiens', afficherTva);
    planifierRafraichissementSiPageActive('page-charges', 'page-charges-entretiens', afficherCharges);
    return;
  }

  if (key === 'plannings' || key === 'absences_periodes') {
    planifierRafraichissementSiPageActive('page-planning', 'page-planning', rafraichirVuePlanningAdmin);
    planifierRafraichissementSiPageActive('page-heures', 'page-heures-planning', rafraichirVueHeuresEtKm);
    planifierRafraichissementSiPageActive('page-salaries', 'page-salaries-planning', afficherSalaries);
    return;
  }

  if (key === 'inspections') {
    planifierRafraichissementSiPageActive('page-inspections', 'page-inspections', afficherInspections);
    planifierRafraichissementSiPageActive('page-vehicules', 'page-vehicules-inspections', afficherVehicules);
    planifierRafraichissementSiPageActive('page-alertes', 'page-alertes-inspections', afficherAlertes);
    return;
  }

  if (key === 'incidents') {
    planifierRafraichissementSiPageActive('page-incidents', 'page-incidents', afficherIncidents);
    return;
  }

  if (key === 'alertes_admin') {
    planifierRafraichissementStorage('badge-alertes', afficherBadgeAlertes);
    planifierRafraichissementSiPageActive('page-alertes', 'page-alertes', afficherAlertes);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-alertes', rafraichirDashboard);
    return;
  }

  if (key === 'postes' || key === 'params_entreprise') {
    planifierRafraichissementSiPageActive('page-parametres', 'page-parametres', chargerParametres);
    if (key === 'params_entreprise') planifierRafraichissementStorage('branding-admin', appliquerBranding);
    return;
  }

  if (key && (key.indexOf('km_sal_') === 0 || key.indexOf('km_report_') === 0)) {
    planifierRafraichissementSiPageActive('page-salaries', 'page-salaries-km', afficherSalaries);
    planifierRafraichissementSiPageActive('page-vehicules', 'page-vehicules-km', afficherVehicules);
    planifierRafraichissementSiPageActive('page-alertes', 'page-alertes-km', afficherAlertes);
    planifierRafraichissementSiPageActive('page-heures', 'page-heures-km', rafraichirVueHeuresEtKm);
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-km', rafraichirDashboard);
  }

  if (key && key.indexOf('notifs_sal_') === 0) {
    planifierRafraichissementSiPageActive('page-dashboard', 'dashboard-notifs', rafraichirDashboard);
  }
}

// L1991 (script.js d'origine)
function ouvrirEditKmAdmin(salId, kmId) {
  _editKmSalId = salId; _editKmId = kmId;
  const entrees = charger('km_sal_'+salId);
  const e = entrees.find(x => x.id === kmId); if (!e) return;
  document.getElementById('admin-km-dep').value  = e.kmDepart;
  document.getElementById('admin-km-arr').value  = e.kmArrivee || '';
  document.getElementById('admin-km-date').value = e.date;
  document.getElementById('modal-edit-km').classList.add('open');
}

// L2001 (script.js d'origine)
function confirmerEditKmAdmin() {
  const dep  = parseFloat(document.getElementById('admin-km-dep').value);
  const arrRaw = document.getElementById('admin-km-arr').value;
  const arr  = arrRaw === '' ? null : parseFloat(arrRaw);
  const date = document.getElementById('admin-km-date').value;
  if (!dep) { afficherToast('⚠️ Km départ obligatoire', 'error'); return; }
  if (arr !== null && arr <= dep) { afficherToast('⚠️ Km arrivée doit être supérieur au km départ', 'error'); return; }

  const cle = 'km_sal_'+_editKmSalId;
  const entrees = charger(cle);
  const idx = entrees.findIndex(e => e.id === _editKmId);
  if (idx > -1) {
    entrees[idx].kmDepart  = dep;
    entrees[idx].kmArrivee = arr;
    entrees[idx].distance  = arr !== null ? arr - dep : 0;
    entrees[idx].date      = date;
    entrees[idx].modifieAdmin = true;
    sauvegarder(cle, entrees);
    if (arr !== null) mettreAJourKmVehiculeParSalarie(_editKmSalId, arr);
    else mettreAJourKmVehiculeParSalarie(_editKmSalId, dep);
    // Km de report automatique supprimé en v12fix3
  }
  closeModal('modal-edit-km');
  _editKmSalId = null; _editKmId = null;
  afficherReleveKm(); afficherToast('✅ Relevé mis à jour');
}

// L2028 (script.js d'origine)
async function supprimerKmAdmin(salId, kmId) {
  const _ok = await confirmDialog('Supprimer ce relevé ?', {titre:'Supprimer',icone:'🛣️',btnLabel:'Supprimer'});
  if (!_ok) return;
  const cle = 'km_sal_'+salId;
  const entrees = charger(cle).filter(e => e.id !== kmId);
  sauvegarder(cle, entrees);
  afficherReleveKm(); afficherToast('🗑️ Relevé supprimé');
}

// L2515 (script.js d'origine)
async function confirmerResetMdp() {
  const nouveau=document.getElementById('reset-mdp-val').value;
  if(!nouveau){afficherToast('⚠️ Mot de passe vide','error');return;}
  const qualiteMdp = evaluerQualiteMotDePasseFort(nouveau);
  if(!qualiteMdp.ok){afficherToast('⚠️ ' + qualiteMdp.message,'error');return;}
  const salaries=charger('salaries');
  const idx=salaries.findIndex(s=>s.id===accessSalarieTargetId);
  if(idx===-1){afficherToast('⚠️ Salarie introuvable','error');return;}
  if(salaries[idx].actif===false){afficherToast('⚠️ Reactivez d abord ce salarie avant de modifier son acces','error');return;}
  const provisionResult = await provisionnerAccesSalarie(salaries[idx], nouveau);
  if (provisionResult?.ok) {
    salaries[idx].mdpHash=await hasherMotDePasseLocal(nouveau);
    sauvegarder('salaries', salaries);
    closeModal('modal-reset-mdp');
    accessSalarieTargetId=null;
    afficherToast('✅ Acces salarie mis a jour');
    return;
  }
  afficherToast(`⚠️ Mise a jour de l'acces impossible (${provisionResult?.error?.message || provisionResult?.reason || 'erreur inconnue'})`, 'error');
}

// L2680 (script.js d'origine)
function voirPhotoAdmin(inspId, idx) {
  const inspections = loadSafe('inspections', []);
  const insp = inspections.find(i => i.id === inspId);
  if (!insp) return;
  _adminPhotos = getInspectionPhotoList(insp);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;flex-direction:column;gap:12px';
  overlay.innerHTML = `
    <img src="${getInspectionPhotoFull(_adminPhotos[idx])}" id="photo-plein-ecran" style="max-width:100%;max-height:80vh;border-radius:8px;object-fit:contain" />
    <div style="display:flex;gap:10px">
      ${_adminPhotos.map((_, i) => `<div onclick="changerPhotoAdmin(${i})" style="width:48px;height:48px;border-radius:6px;overflow:hidden;cursor:pointer;border:2px solid ${i===idx?'var(--accent)':'transparent'}"><img src="${getInspectionPhotoThumb(_adminPhotos[i])}" style="width:100%;height:100%;object-fit:cover"/></div>`).join('')}
    </div>
    <button onclick="this.closest('div[style]').remove()" style="background:rgba(255,255,255,.1);border:none;color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.9rem">✕ Fermer</button>`;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// L2696 (script.js d'origine)
function changerPhotoAdmin(idx) {
  const img = document.getElementById('photo-plein-ecran');
  if (img && _adminPhotos[idx]) img.src = getInspectionPhotoFull(_adminPhotos[idx]);
}

// L3888 (script.js d'origine)
function toggleParamMdp(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// L3893 (script.js d'origine)
async function changerMdpAdmin() {
  const actuel    = document.getElementById('param-mdp-actuel').value;
  const nouveau   = document.getElementById('param-mdp-nouveau').value;
  const confirmer = document.getElementById('param-mdp-confirmer').value;
  if (!actuel || !nouveau || !confirmer) { afficherToast('⚠️ Remplissez tous les champs', 'error'); return; }
  const sessionAdmin = getAdminSession();
  const comptes = getAdminAccounts();
  const idx = comptes.findIndex(c => c.identifiant === sessionAdmin.identifiant);
  if (idx === -1) { afficherToast('⚠️ Session administrateur introuvable', 'error'); return; }
  const motDePasseStocke = comptes[idx].motDePasseHash || comptes[idx].motDePasse || '';
  if (!await verifierMotDePasseLocal(actuel, motDePasseStocke)) { afficherToast('⚠️ Mot de passe actuel incorrect', 'error'); return; }
  const qualiteMdp = evaluerQualiteMotDePasseFort(nouveau);
  if (!qualiteMdp.ok) { afficherToast('⚠️ ' + qualiteMdp.message, 'error'); return; }
  if (nouveau !== confirmer) { afficherToast('⚠️ Les mots de passe ne correspondent pas', 'error'); return; }
  const client = getSupabaseClientSafe();
  const supabaseReady = !!(window.DelivProSupabase && window.DelivProSupabase.isReady && window.DelivProSupabase.isReady());
  if (supabaseReady) {
    if (sessionAdmin.authMode !== 'supabase' || !client) {
      afficherToast('⚠️ Connectez-vous via Supabase pour changer un mot de passe admin synchronisé.', 'error');
      return;
    }
  }
  if (supabaseReady) {
    const sessionResult = await client.auth.getSession();
    if (!sessionResult?.data?.session) {
      afficherToast('⚠️ Session Supabase administrateur introuvable. Reconnectez-vous.', 'error');
      return;
    }
    const updateResult = await client.auth.updateUser({ password: nouveau });
    if (updateResult.error) {
      afficherToast(`⚠️ Mot de passe Supabase non mis à jour (${updateResult.error.message})`, 'error');
      return;
    }
  }
  comptes[idx].motDePasseHash = await hasherMotDePasseLocal(nouveau);
  delete comptes[idx].motDePasse;
  saveAdminAccounts(comptes);
  ['param-mdp-actuel','param-mdp-nouveau','param-mdp-confirmer'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  afficherToast(supabaseReady ? '✅ Mot de passe administrateur mis à jour et synchronisé avec Supabase' : '✅ Mot de passe administrateur mis à jour pour votre compte');
}

// L4098 (script.js d'origine)
function majResumeSauvegardeAdmin() {
  const dateEl = document.getElementById('backup-stat-date');
  const last = localStorage.getItem('backup_admin_last_export');
  if (dateEl) dateEl.textContent = last ? formatDateHeureExport(last) : 'Jamais';
}

// L4104 (script.js d'origine)
function construireSauvegardeAdmin() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    data[key] = localStorage.getItem(key);
  }
  return {
    app: 'MCA Logistics',
    exportedAt: new Date().toISOString(),
    version: 'admin-backup-v1',
    data
  };
}

// L4121 (script.js d'origine)
async function importerSauvegardeAdmin(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
      afficherToast('Fichier de sauvegarde invalide', 'error');
      if (input) input.value = '';
      return;
    }
    const ok = await confirmDialog('Restaurer cette sauvegarde va remplacer les données actuelles de l’application sur ce navigateur. Continuer ?', { titre:'Restaurer une sauvegarde', icone:'💾', btnLabel:'Restaurer' });
    if (!ok) {
      if (input) input.value = '';
      return;
    }
    localStorage.clear();
    Object.entries(payload.data).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    localStorage.setItem('backup_admin_last_export', payload.exportedAt || new Date().toISOString());
    if (input) input.value = '';
    afficherToast('Sauvegarde restaurée');
    setTimeout(() => window.location.reload(), 300);
  } catch (err) {
    console.error(err);
    afficherToast('Impossible de restaurer ce fichier', 'error');
    if (input) input.value = '';
  }
}

