/* =====================================================
   DelivPro â€” script.js  (v20 â€” full featured + bugfixes)
   ===================================================== */

/* ===== UTILITAIRES ===== */
const STORAGE_CACHE = new Map();
let lastStorageWarningAt = 0;

if (!window.__delivproStoragePatched) {
  window.__delivproStoragePatched = true;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;

  Storage.prototype.setItem = function(cle, valeur) {
    STORAGE_CACHE.delete(String(cle));
    return nativeSetItem.call(this, cle, valeur);
  };

  Storage.prototype.removeItem = function(cle) {
    STORAGE_CACHE.delete(String(cle));
    return nativeRemoveItem.call(this, cle);
  };

  Storage.prototype.clear = function() {
    STORAGE_CACHE.clear();
    return nativeClear.call(this);
  };
}

function dupliquerValeurStockage(valeur) {
  if (valeur === null || valeur === undefined) return valeur;
  if (typeof valeur !== 'object') return valeur;
  if (typeof structuredClone === 'function') return structuredClone(valeur);
  return JSON.parse(JSON.stringify(valeur));
}

function lireStockageJSON(cle, fallback) {
  const raw = localStorage.getItem(cle);
  const cached = STORAGE_CACHE.get(cle);

  if (cached && cached.raw === raw) {
    return dupliquerValeurStockage(cached.value);
  }

  if (raw === null) {
    STORAGE_CACHE.set(cle, { raw: null, value: fallback });
    return dupliquerValeurStockage(fallback);
  }

  try {
    const parsed = JSON.parse(raw);
    STORAGE_CACHE.set(cle, { raw, value: parsed });
    return dupliquerValeurStockage(parsed);
  } catch (error) {
    console.warn(`[DelivPro] DonnÃ©e locale invalide pour "${cle}", fallback utilisÃ©.`, error);
    STORAGE_CACHE.set(cle, { raw, value: fallback });
    return dupliquerValeurStockage(fallback);
  }
}

function charger(cle)          { return lireStockageJSON(cle, []); }
function sauvegarder(cle, val) {
  try {
    const raw = JSON.stringify(val);
    localStorage.setItem(cle, raw);
    STORAGE_CACHE.set(cle, { raw, value: dupliquerValeurStockage(val) });
    return true;
  } catch (error) {
    console.error(`[DelivPro] Impossible d'enregistrer "${cle}" dans le stockage local.`, error);
    const maintenant = Date.now();
    if (maintenant - lastStorageWarningAt > 4000 && typeof afficherToast === 'function') {
      lastStorageWarningAt = maintenant;
      afficherToast('âš ï¸ Enregistrement local impossible. VÃ©rifiez lâ€™espace navigateur disponible.', 'error');
    }
    return false;
  }
}
function chargerObj(cle, def)  { return lireStockageJSON(cle, def); }
function genId()               { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function aujourdhui()          { return new Date().toISOString().split('T')[0]; }
function euros(n)              { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(parseFloat(n||0)); }
function formatKm(n)           { return new Intl.NumberFormat('fr-FR').format(Math.round(parseFloat(n||0)))+' km'; }
function formatDateExport(val) {
  if (!val) return 'â€”';
  const source = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val + 'T00:00:00' : val;
  const d = new Date(source);
  if (Number.isNaN(d.getTime())) return val;
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}
function formatDateHeureExport(val) {
  const d = val ? new Date(val) : new Date();
  if (Number.isNaN(d.getTime())) return formatDateExport(val);
  return formatDateExport(d) + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function getEntrepriseExportParams() {
  const params = chargerObj('params_entreprise', {});
  const sessionAdmin = getAdminSession();
  return {
    nom: params.nom || 'MCA Logistics',
    nomAdmin: sessionAdmin.nom || params.nomAdmin || '',
    siret: params.siret || '',
    adresse: params.adresse || '',
    tel: params.tel || '',
    email: params.email || ''
  };
}
function renderBlocInfosEntreprise(params) {
  return '';
}
function renderFooterEntreprise(params, dateExp, extra) {
  return `<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between;gap:12px"><span>${extra || params.nom}</span><span>${dateExp}</span></div>`;
}
function getLogoEntrepriseExportSrc() {
  return getLogoEntreprise()
    || document.querySelector('.logo-icon img')?.src
    || document.querySelector('#param-logo-preview img')?.src
    || '';
}
function renderLogoEntrepriseExport() {
  return '';
}
function calculerAmortissementVehicule(veh) {
  const ht = parseFloat(veh?.prixAchatHT) || 0;
  const duree = parseFloat(veh?.dureeAmortissement) || 0;
  const mode = veh?.modeAmortissement === 'degressif' ? 'degressif' : 'lineaire';
  const valeurRebut = parseFloat(veh?.valeurMiseAuRebut) || 0;
  const baseAmortissable = Math.max(0, ht - valeurRebut);
  if (!baseAmortissable || !duree) {
    return { annuel: 0, mensuel: 0, cumule: 0, reste: baseAmortissable, mode, prorataPremierExercice: 0 };
  }
  const annees = parseFloat(duree) || 0;
  const coefficientDegressif = annees >= 7 ? 2.25 : annees >= 5 ? 1.75 : annees >= 3 ? 1.25 : 1;
  const tauxLineaire = annees > 0 ? 1 / annees : 0;
  const tauxAnnuel = mode === 'degressif' ? (tauxLineaire * coefficientDegressif) : tauxLineaire;
  const annuel = baseAmortissable * tauxAnnuel;
  const mensuel = annuel / 12;
  const dateAcq = veh?.dateAcquisition ? new Date(veh.dateAcquisition + 'T00:00:00') : null;
  let moisEcoules = 0;
  let prorataPremierExercice = 0;
  if (dateAcq && !Number.isNaN(dateAcq.getTime())) {
    const now = new Date();
    moisEcoules = Math.max(0, (now.getFullYear() - dateAcq.getFullYear()) * 12 + (now.getMonth() - dateAcq.getMonth()));
    if (now.getDate() < dateAcq.getDate()) moisEcoules = Math.max(0, moisEcoules - 1);
    const finExercice = new Date(dateAcq.getFullYear(), 11, 31);
    const debutExercice = new Date(dateAcq.getFullYear(), 0, 1);
    const joursExercice = Math.max(1, Math.round((finExercice - debutExercice) / 86400000) + 1);
    const joursRestants = Math.max(0, Math.round((finExercice - dateAcq) / 86400000) + 1);
    prorataPremierExercice = joursRestants / joursExercice;
  }
  const dateRebut = veh?.dateMiseAuRebut ? new Date(veh.dateMiseAuRebut + 'T00:00:00') : null;
  if (dateRebut && dateAcq && !Number.isNaN(dateRebut.getTime()) && dateRebut > dateAcq) {
    const moisRebut = Math.max(0, (dateRebut.getFullYear() - dateAcq.getFullYear()) * 12 + (dateRebut.getMonth() - dateAcq.getMonth()));
    moisEcoules = Math.min(moisEcoules, moisRebut);
  }
  const cumule = Math.min(baseAmortissable, mensuel * Math.min(moisEcoules, Math.round(duree * 12)));
  return {
    annuel,
    mensuel,
    cumule,
    reste: Math.max(0, baseAmortissable - cumule),
    mode,
    prorataPremierExercice
  };
}
function formaterTaux(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 2) + ' %' : 'â€”';
}
function getVehiculeById(vehId) {
  return charger('vehicules').find(v => v.id === vehId) || null;
}
function getTypeEntretienLabel(type) {
  return {
    revision: 'RÃ©vision',
    vidange: 'Vidange',
    pneus: 'Pneus',
    plaquettes: 'Plaquettes de frein',
    courroie: 'Courroie de distribution',
    freins: 'Freins',
    carrosserie: 'Carrosserie',
    autre: 'Autre'
  }[type] || 'Autre';
}
function getTauxDeductibiliteVehicule(vehId, fallback) {
  const veh = vehId ? getVehiculeById(vehId) : null;
  if (veh && veh.tvaCarbDeductible !== undefined && veh.tvaCarbDeductible !== null && veh.tvaCarbDeductible !== '') {
    return parseFloat(veh.tvaCarbDeductible) || 0;
  }
  return parseFloat(fallback) || 0;
}
function getTauxDeductibiliteCarburant(plein) {
  const typeCarburant = plein?.typeCarburant || plein?.type || 'gasoil';
  const fallback = typeCarburant === 'essence' ? 100 : 80;
  return getTauxDeductibiliteVehicule(plein?.vehId, fallback);
}
function getTauxDeductibiliteEntretien(entretien) {
  return getTauxDeductibiliteVehicule(entretien?.vehId, 100);
}
function calculerDureeJour(heureDebut, heureFin) {
  if (!heureDebut || !heureFin) return 0;
  const [hd, md] = heureDebut.split(':').map(Number);
  const [hf, mf] = heureFin.split(':').map(Number);
  const duree = (hf * 60 + mf) - (hd * 60 + md);
  return duree > 0 ? duree / 60 : 0;
}
function getMontantHTLivraison(livraison) {
  const taux = parseFloat(livraison?.tauxTVA) || 0;
  if (livraison?.prixHT !== undefined && livraison?.prixHT !== null && livraison?.prixHT !== '') {
    return parseFloat(livraison.prixHT) || 0;
  }
  return (parseFloat(livraison?.prix) || 0) / (1 + taux / 100);
}
function getMontantHTCarburant(plein) {
  if (plein?.totalHT !== undefined && plein?.totalHT !== null && plein?.totalHT !== '') {
    return parseFloat(plein.totalHT) || 0;
  }
  return (parseFloat(plein?.total) || 0) / 1.2;
}
function getMontantHTEntretien(entretien) {
  if (entretien?.coutHT !== undefined && entretien?.coutHT !== null && entretien?.coutHT !== '') {
    return parseFloat(entretien.coutHT) || 0;
  }
  const taux = parseFloat(entretien?.tauxTVA) || 0;
  return (parseFloat(entretien?.cout) || 0) / (1 + taux / 100);
}
function getDateRangeInclusive(debut, fin) {
  const dates = [];
  if (!debut || !fin) return dates;
  const current = new Date(debut + 'T00:00:00');
  const end = new Date(fin + 'T00:00:00');
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
function getLogoEntreprise() {
  return localStorage.getItem('logo_entreprise') || '';
}
function getDefaultAdminAccounts() {
  return [
    { identifiant: 'achraf.chikri', nom: 'Achraf Chikri', motDePasse: 'admin123' },
    { identifiant: 'mohammed.chikri', nom: 'Mohammed Chikri', motDePasse: 'admin123' }
  ];
}
function getAdminAccounts() {
  const comptesExistants = chargerObj('admin_accounts', null);
  if (Array.isArray(comptesExistants) && comptesExistants.length) return comptesExistants;
  const legacyPassword = localStorage.getItem('mdp_admin') || 'admin123';
  const comptes = getDefaultAdminAccounts().map((compte, idx) => ({
    ...compte,
    motDePasse: idx === 0 ? legacyPassword : compte.motDePasse
  }));
  sauvegarder('admin_accounts', comptes);
  return comptes;
}
function saveAdminAccounts(comptes) {
  sauvegarder('admin_accounts', comptes);
}
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
const ADMIN_EDIT_LOCKS_KEY = 'admin_edit_locks';
const ADMIN_EDIT_LOCK_TTL_MS = 20 * 60 * 1000;
const adminHeldEditLocks = new Set();
let derniereAlerteConflitEdition = '';

function getAdminActorKey() {
  const session = getAdminSession();
  return session.email || session.identifiant || 'admin';
}

function getAdminActorLabel() {
  const session = getAdminSession();
  return session.nom || session.identifiant || session.email || 'Admin';
}

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

function getAdminEditLockKey(type, id) {
  return `${type}:${id}`;
}

function synchroniserVerrousEdition() {
  if (window.DelivProRemoteStorage && typeof window.DelivProRemoteStorage.flush === 'function') {
    window.DelivProRemoteStorage.flush().catch(function () {});
  }
}

async function actualiserVerrousEditionDistance() {
  if (window.DelivProRemoteStorage && typeof window.DelivProRemoteStorage.pullLatest === 'function') {
    try {
      await window.DelivProRemoteStorage.pullLatest();
    } catch (_) {}
  }
}

function getModalIdForLockType(type) {
  return {
    salarie: 'modal-edit-salarie',
    livraison: 'modal-edit-livraison',
    client: 'modal-edit-client',
    vehicule: 'modal-vehicule'
  }[type] || '';
}

function afficherAlerteVerrouModal(modalId, message) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const body = modal.querySelector('.modal-body');
  if (!body) return;
  let banner = modal.querySelector('.edit-lock-alert');
  if (!message) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'edit-lock-alert';
    banner.style.cssText = 'margin-bottom:14px;padding:12px 14px;border-radius:10px;border:1px solid rgba(231,76,60,.35);background:rgba(231,76,60,.1);color:#ffb3aa;font-size:.84rem;line-height:1.4';
    body.insertBefore(banner, body.firstChild);
  }
  banner.textContent = message;
}

function surveillerConflitsEditionActifs() {
  const modals = [
    { id: 'modal-edit-salarie', type: 'salarie', entityId: editSalarieId || window._editSalarieId },
    { id: 'modal-edit-livraison', type: 'livraison', entityId: window._editLivId },
    { id: 'modal-edit-client', type: 'client', entityId: _editClientId },
    { id: 'modal-vehicule', type: 'vehicule', entityId: window._editVehId }
  ];

  modals.forEach(function(entry) {
    const modal = document.getElementById(entry.id);
    if (!modal?.classList.contains('open') || !entry.entityId) {
      afficherAlerteVerrouModal(entry.id, '');
      return;
    }
    const lockState = verifierVerrouEdition(entry.type, entry.entityId);
    if (!lockState.ok) {
      const lock = lockState.lock || {};
      const signature = `${entry.type}:${entry.entityId}:${lock.actorKey || ''}:${lock.createdAt || ''}`;
      const message = `Modification en cours par ${lock.actorLabel || 'un autre admin'}. Ã‰vite d'enregistrer cette fiche tant que le verrou n'est pas libÃ©rÃ©.`;
      afficherAlerteVerrouModal(entry.id, message);
      if (signature !== derniereAlerteConflitEdition) {
        derniereAlerteConflitEdition = signature;
        afficherToast(`âš ï¸ ${lock.actorLabel || 'Un autre admin'} modifie dÃ©jÃ  cette fiche`, 'error');
      }
      return;
    }
    afficherAlerteVerrouModal(entry.id, '');
  });
}

function prendreVerrouEdition(type, id, label) {
  if (!type || !id || sessionStorage.getItem('role') !== 'admin') return { ok: true };
  const locks = getAdminEditLocks();
  const lockKey = getAdminEditLockKey(type, id);
  const actorKey = getAdminActorKey();
  const existing = locks[lockKey];
  if (existing && existing.actorKey && existing.actorKey !== actorKey) {
    return { ok: false, lock: existing };
  }
  locks[lockKey] = {
    actorKey: actorKey,
    actorLabel: getAdminActorLabel(),
    type: type,
    id: id,
    label: label || '',
    createdAt: new Date().toISOString()
  };
  sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  adminHeldEditLocks.add(lockKey);
  synchroniserVerrousEdition();
  return { ok: true, lock: locks[lockKey] };
}

function verifierVerrouEdition(type, id) {
  if (!type || !id || sessionStorage.getItem('role') !== 'admin') return { ok: true };
  const locks = getAdminEditLocks();
  const lock = locks[getAdminEditLockKey(type, id)];
  const actorKey = getAdminActorKey();
  if (!lock || !lock.actorKey || lock.actorKey === actorKey) return { ok: true };
  return { ok: false, lock: lock };
}

function libererVerrouEdition(type, id) {
  if (!type || !id) return;
  const locks = getAdminEditLocks();
  const lockKey = getAdminEditLockKey(type, id);
  const lock = locks[lockKey];
  if (lock && lock.actorKey === getAdminActorKey()) {
    delete locks[lockKey];
    sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
    synchroniserVerrousEdition();
  }
  adminHeldEditLocks.delete(lockKey);
}

function libererTousVerrousEdition() {
  if (!adminHeldEditLocks.size) return;
  const locks = getAdminEditLocks();
  const actorKey = getAdminActorKey();
  adminHeldEditLocks.forEach(function(lockKey) {
    const lock = locks[lockKey];
    if (lock && lock.actorKey === actorKey) delete locks[lockKey];
  });
  adminHeldEditLocks.clear();
  sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  synchroniserVerrousEdition();
}

function getEditLockContextForModal(modalId) {
  if (modalId === 'modal-edit-salarie' && (editSalarieId || window._editSalarieId)) {
    return { type: 'salarie', id: editSalarieId || window._editSalarieId };
  }
  if (modalId === 'modal-edit-livraison' && window._editLivId) {
    return { type: 'livraison', id: window._editLivId };
  }
  if (modalId === 'modal-edit-client' && _editClientId) {
    return { type: 'client', id: _editClientId };
  }
  if (modalId === 'modal-vehicule' && window._editVehId) {
    return { type: 'vehicule', id: window._editVehId };
  }
  return null;
}

window.addEventListener('pagehide', libererTousVerrousEdition);
window.addEventListener('beforeunload', libererTousVerrousEdition);
window.addEventListener('storage', function(event) {
  if (event.key === ADMIN_EDIT_LOCKS_KEY) {
    surveillerConflitsEditionActifs();
  }
});
window.addEventListener('delivpro:storage-sync', function(event) {
  if (event.detail?.key === ADMIN_EDIT_LOCKS_KEY) {
    surveillerConflitsEditionActifs();
  }
});
function fermerMenuAdmin() {
  document.getElementById('topbar-user-menu')?.classList.remove('open');
}
function toggleAdminMenu(event) {
  event?.stopPropagation();
  const menu = document.getElementById('topbar-user-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}
function setBoutonDeconnexionAdminEtat(enCours) {
  const btn = document.getElementById('btn-admin-logout');
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  btn.disabled = !!enCours;
  btn.textContent = enCours ? 'DÃ©connexion...' : btn.dataset.defaultLabel;
}
function redirigerVersLoginAdmin() {
  document.body.classList.add('app-booting');
  window.location.href = 'login.html';
}
function deconnexionAdmin() {
  if (window.__delivproAdminLogoutPending) return;
  window.__delivproAdminLogoutPending = true;
  setBoutonDeconnexionAdminEtat(true);
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('auth_mode');
  sessionStorage.removeItem('admin_login');
  sessionStorage.removeItem('admin_email');
  sessionStorage.removeItem('admin_nom');
  fermerMenuAdmin();
  if (window.DelivProAuth && window.DelivProAuth.signOut) {
    const fallback = setTimeout(() => {
      redirigerVersLoginAdmin();
    }, 1200);
    window.DelivProAuth.signOut().finally(() => {
      clearTimeout(fallback);
      redirigerVersLoginAdmin();
    });
    return;
  }
  redirigerVersLoginAdmin();
}
function appliquerBranding() {
  const logo = getLogoEntreprise();
  const iconTargets = document.querySelectorAll('.logo-icon');
  iconTargets.forEach(el => {
    el.innerHTML = logo ? `<img src="${logo}" alt="Logo" />` : 'ðŸš';
  });
  const preview = document.getElementById('param-logo-preview');
  if (preview) preview.innerHTML = logo ? `<img src="${logo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:12px" />` : 'ðŸš';
  const link = document.querySelector("link[rel='icon']") || document.createElement('link');
  link.rel = 'icon';
  link.href = logo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>ðŸš</text></svg>";
  document.head.appendChild(link);
}
/* GÃ©nÃ¨re un numÃ©ro de livraison unique LIV-AAAA-XXXX */
function genNumLivraison() {
  const annee = new Date().getFullYear();
  const livs  = charger('livraisons');
  const max   = livs.map(l => parseInt((l.numLiv||'').split('-')[2])||0).reduce((a,b)=>Math.max(a,b),0);
  return `LIV-${annee}-${String(max+1).padStart(4,'0')}`;
}

/* Compression image base64 avant stockage */
function compresserImage(base64, callback) {
  const img = new Image();
  img.onload = () => {
    const max = 800;
    let w = img.width, h = img.height;
    if (w > max || h > max) { const r = Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r); }
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    callback(c.toDataURL('image/jpeg',0.72));
  };
  img.src = base64;
}

/* ===== HT / TVA / TTC â€” Calculs bidirectionnels ===== */
function calculerTTCDepuisHT(prefix) {
  const ht   = parseFloat(document.getElementById(prefix+'-prix-ht')?.value || document.getElementById(prefix+'-montant-ht')?.value || document.getElementById(prefix+'-cout-ht')?.value) || 0;
  const taux = parseFloat(document.getElementById(prefix+'-taux-tva')?.value) || 0;
  const ttc  = ht * (1 + taux / 100);
  const tvaM = ttc - ht;
  const elTTC = document.getElementById(prefix+'-prix') || document.getElementById(prefix+'-montant') || document.getElementById(prefix+'-cout');
  if (elTTC) elTTC.value = ttc.toFixed(2);
  const elTVA = document.getElementById(prefix+'-montant-tva');
  if (elTVA) elTVA.textContent = ht > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' â‚¬' : '';
  if (prefix === 'liv') alerteRentabilite();
}
function calculerHTDepuisTTC(prefix) {
  const ttc  = parseFloat(document.getElementById(prefix+'-prix')?.value || document.getElementById(prefix+'-montant')?.value || document.getElementById(prefix+'-cout')?.value) || 0;
  const taux = parseFloat(document.getElementById(prefix+'-taux-tva')?.value) || 0;
  const ht   = ttc / (1 + taux / 100);
  const tvaM = ttc - ht;
  const elHT = document.getElementById(prefix+'-prix-ht') || document.getElementById(prefix+'-montant-ht') || document.getElementById(prefix+'-cout-ht');
  if (elHT) elHT.value = ht.toFixed(2);
  const elTVA = document.getElementById(prefix+'-montant-tva');
  if (elTVA) elTVA.textContent = ttc > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' â‚¬' : '';
  if (prefix === 'liv') alerteRentabilite();
}

/* ===== THÃˆME MODE CLAIR / SOMBRE ===== */
function initTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = 'â˜€ï¸';
  }
  // Appliquer couleur accent personnalisÃ©e
  const accent = localStorage.getItem('accent_color');
  if (accent) document.documentElement.style.setProperty('--accent', accent);
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = isLight ? 'â˜€ï¸' : 'ðŸŒ™';
}

/* ===== MODAL CONFIRMATION STYLÃ‰E ===== */
let _confirmResolve = null;
function confirmDialog(msg, { titre='Confirmation', icone='âš ï¸', btnLabel='Confirmer', danger=true } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-icon').textContent  = icone;
    document.getElementById('confirm-title').textContent = titre;
    document.getElementById('confirm-msg').textContent   = msg;
    const btn = document.getElementById('confirm-ok-btn');
    btn.textContent = btnLabel;
    btn.style.background = danger ? 'var(--red)' : 'var(--accent)';
    btn.style.color = danger ? '#fff' : '#000';
    document.getElementById('modal-confirm').classList.add('open');
  });
}
function confirmResolve() { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) _confirmResolve(true); }
function confirmReject()  { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) _confirmResolve(false); }

/* ===== SCROLL TO TOP ===== */
function initScrollTop() {
  const main = document.getElementById('mainContent');
  const btn  = document.getElementById('btn-scroll-top');
  if (!main || !btn) return;
  main.addEventListener('scroll', () => {
    btn.classList.toggle('visible', main.scrollTop > 300);
  });
  btn.onclick = () => main.scrollTo({ top:0, behavior:'smooth' });
}

/* ===== NOM ENTREPRISE DANS TOPBAR ===== */
function chargerNomEntreprise() {
  const params = chargerObj('params_entreprise', {});
  const sessionAdmin = getAdminSession();
  const nom = params.nom || 'MCA Logistics';
  const el  = document.getElementById('sidebar-nom-entreprise');
  if (el) el.textContent = nom;
  const adminLabel = sessionAdmin.nom || 'Admin';
  const label = document.getElementById('topbar-admin-label');
  if (label) label.textContent = adminLabel;
  const avatar = document.getElementById('topbar-avatar-text');
  if (avatar) avatar.textContent = adminLabel[0].toUpperCase();
}

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

function getVehiculeParSalId(salId) {
  return charger('vehicules').find(v => v.salId === salId) || null;
}

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
  let label = morceaux.join(' ').replace(/\s+/g, ' ').trim() || nom || prenom || 'SalariÃ©';
  if (settings.includePoste && salarie.poste) label += ' - ' + salarie.poste;
  if (settings.includeNumero && salarie.numero) label += ' (#' + salarie.numero + ')';
  return label;
}

function getVehiculeKmsParLivraisons(vehId) {
  return charger('livraisons')
    .filter(l => l.vehId === vehId)
    .reduce((sum, l) => sum + (parseFloat(l.distance) || 0), 0);
}

function getVehiculePlusHautKmSaisi(veh) {
  const livraisons = charger('livraisons');
  let maxKm = 0;
  charger('salaries').forEach(function(salarie) {
    charger('km_sal_' + salarie.id).forEach(function(entry) {
      const livraisonLiee = entry.livId ? livraisons.find(l => l.id === entry.livId) : null;
      const concerneVehicule = (livraisonLiee && livraisonLiee.vehId === veh.id) || (veh.salId && salarie.id === veh.salId);
      if (!concerneVehicule) return;
      maxKm = Math.max(maxKm, parseFloat(entry.kmDepart) || 0, parseFloat(entry.kmArrivee) || 0);
    });
  });
  charger('inspections').forEach(function(insp) {
    if (insp.vehId !== veh.id) return;
    maxKm = Math.max(maxKm, parseFloat(insp.km) || 0);
  });
  return maxKm;
}

function calculerKilometrageVehiculeActuel(veh) {
  if (!veh) return 0;
  const kmReference = parseFloat(veh.km) || 0;
  const kmInitial = parseFloat(veh.kmInitial);
  const kmLivraisons = Number.isFinite(kmInitial)
    ? kmInitial + getVehiculeKmsParLivraisons(veh.id)
    : 0;
  const kmSaisi = getVehiculePlusHautKmSaisi(veh);
  return Math.max(kmReference, Number.isFinite(kmInitial) ? kmInitial : 0, kmLivraisons, kmSaisi);
}

function getPilotageEntretienVehicule(veh) {
  if (!veh) return { kmActuel: 0, prochainKm: 0, dateEcheance: '', estEnRetard: false, estProche: false };
  const kmActuel = calculerKilometrageVehiculeActuel(veh);
  const intervalKm = parseFloat(veh.entretienIntervalKm) || 0;
  const intervalMois = parseFloat(veh.entretienIntervalMois) || 0;
  const entretiensVehicule = charger('entretiens')
    .filter(function(e) { return e.vehId === veh.id; })
    .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  const dernier = entretiensVehicule[0] || null;
  const dernierKm = parseFloat(dernier?.km) || 0;
  const prochainKm = parseFloat(dernier?.prochainKm) || (intervalKm ? ((dernierKm || kmActuel || (parseFloat(veh.kmInitial) || 0)) + intervalKm) : 0);
  let dateEcheance = '';
  if (intervalMois) {
    const baseDate = dernier?.date || veh.dateAcquisition || '';
    if (baseDate) {
      const d = new Date(baseDate + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + intervalMois);
        dateEcheance = d.toISOString().slice(0, 10);
      }
    }
  }
  const auj = aujourdhui();
  const kmRestants = prochainKm ? (prochainKm - kmActuel) : null;
  return {
    kmActuel,
    prochainKm,
    dateEcheance,
    estEnRetard: Boolean((prochainKm && kmActuel >= prochainKm) || (dateEcheance && dateEcheance < auj)),
    estProche: Boolean((prochainKm && kmRestants !== null && kmRestants > 0 && kmRestants <= 1000) || (dateEcheance && dateEcheance >= auj && dateEcheance <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))),
    kmRestants
  };
}

function synchroniserAffectationLivraison(chaufId, vehId) {
  const salaries = charger('salaries');
  const vehicules = charger('vehicules');
  let salarie = chaufId ? salaries.find(function(item) { return item.id === chaufId; }) : null;
  let vehicule = vehId ? vehicules.find(function(item) { return item.id === vehId; }) : null;
  if (salarie && !vehicule) vehicule = getVehiculeParSalId(salarie.id);
  if (vehicule && !salarie && vehicule.salId) salarie = salaries.find(function(item) { return item.id === vehicule.salId; }) || null;
  return {
    chaufId: salarie ? salarie.id : '',
    chaufNom: salarie ? getSalarieNomComplet(salarie) : 'Non assignÃ©',
    vehId: vehicule ? vehicule.id : '',
    vehNom: vehicule ? vehicule.immat : ''
  };
}

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
    selVeh.innerHTML = '<option value="">-- Choisir un vÃ©hicule --</option>';
    charger('vehicules').forEach(function(vehicule) {
      const label = vehicule.immat + (vehicule.modele ? ' â€” ' + vehicule.modele : '') + (vehicule.salNom ? ' (' + vehicule.salNom + ')' : '');
      selVeh.innerHTML += '<option value="' + vehicule.id + '">' + label + '</option>';
    });
    selVeh.value = vehId || '';
  }
}

let config = chargerObj('config', { coutKmEstime: 0.20 });

/* ===== ALERTES ADMIN ===== */
function ajouterAlerte(type, message, meta) {
  const alertes = charger('alertes_admin');
  alertes.push({ id: genId(), type, message, meta: meta || {}, lu: false, traitee: false, creeLe: new Date().toISOString() });
  sauvegarder('alertes_admin', alertes);
}

function compterAlertesNonLues() {
  return charger('alertes_admin').filter(a => !a.lu && !a.traitee).length;
}

function afficherBadgeAlertes() {
  const n = compterAlertesNonLues();
  const el = document.getElementById('badge-alertes');
  if (!el) return;
  el.textContent = n > 0 ? n : '';
  el.style.display = n > 0 ? 'inline-flex' : 'none';
  mettreAJourBadgeMsgAdmin();
}

let derniereAlerteSynchroAdmin = '';
let warmupAdminPromise = null;

function notifierMajAutreAdmin(detail) {
  if (!detail || !detail.externalActor) return;
  if (sessionStorage.getItem('role') !== 'admin') return;
  const updatedAt = detail.updatedAt || '';
  if (!updatedAt || updatedAt === derniereAlerteSynchroAdmin) return;
  derniereAlerteSynchroAdmin = updatedAt;
  afficherToast('ðŸ”„ Un autre admin a mis Ã  jour les donnÃ©es. La page a Ã©tÃ© resynchronisÃ©e.', 'info');
}

function lancerWarmupAdmin() {
  if (warmupAdminPromise) return warmupAdminPromise;
  warmupAdminPromise = (async function() {
    let syncInitResult = null;
    if (window.DelivProRemoteStorage && window.DelivProRemoteStorage.init) {
      syncInitResult = await window.DelivProRemoteStorage.init();
    }
    if (!syncInitResult?.ok) {
      afficherToast('âš ï¸ Session Supabase absente: vous Ãªtes en mode local, la synchro multi-appareils est inactive.', 'error');
    }

    const importResult = await importerSalariesDepuisSupabase();
    if (importResult?.ok) {
      rafraichirDependancesSalaries();
      const pageActive = document.querySelector('.page.active')?.id || '';
      if (pageActive === 'page-salaries') afficherSalaries();
      if (pageActive === 'page-dashboard') rafraichirDashboard();
    }
    return { syncInitResult: syncInitResult, importResult: importResult };
  })().catch(function(error) {
    console.warn('Warmup admin diffÃ©rÃ© Ã©chouÃ©', error);
    return { ok: false, error: error };
  });
  return warmupAdminPromise;
}

/* ===== NAVIGATION ===== */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.__delivproAdminBootstrapped) return;
  window.__delivproAdminBootstrapped = true;
  window.addEventListener('delivpro:remote-update', function(event) {
    notifierMajAutreAdmin(event.detail || {});
  });
  if (window.DelivProAuth) {
    await window.DelivProAuth.ensureAdminLegacySessionFromSupabase();
  }
  if (sessionStorage.getItem('role') !== 'admin') {
    window.location.href = 'login.html';
    return;
  }
  getAdminAccounts();
  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.querySelectorAll('input[type="date"]').forEach(el => { el.value = aujourdhui(); });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); naviguerVers(item.dataset.page); fermerMenuMobile(); });
  });
  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
  });
  document.getElementById('menuMobile').addEventListener('click', ouvrirMenuMobile);
  document.addEventListener('click', e => {
    if (!e.target.closest('#topbar-user-menu')) fermerMenuAdmin();
  });
  afficherBadgeAlertes();
  initTheme();
  initScrollTop();
  chargerNomEntreprise();
  appliquerBranding();
  appliquerLibellesAnalyseHT();
  initSwipeSidebar();
  initPullToRefresh();
  initDensiteTableau();
  verifierMessagesAutomatiques();
  if (window.__delivproMessagesInterval) clearInterval(window.__delivproMessagesInterval);
  window.__delivproMessagesInterval = setInterval(verifierMessagesAutomatiques, 5 * 60 * 1000);
  mettreAJourBadgesNav();
  verifierTriggersPlanningAuto(); // VÃ©rifier au dÃ©marrage
  naviguerVers('dashboard');
  requestAnimationFrame(() => {
    document.body.classList.remove('app-booting');
  });
  setTimeout(() => {
    lancerWarmupAdmin();
  }, 0);
});

function naviguerVers(page) {
  if (!page) return;
  window.__delivproCurrentPage = page;
  mettreAJourBadgesNav();
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active', 'route-enter');
    setTimeout(() => pageEl.classList.remove('route-enter'), 240);
  }
  const titres = {
    dashboard:'ðŸ“Š Dashboard', livraisons:'ðŸ“¦ Livraisons', clients:'ðŸ§‘â€ðŸ’¼ Carnet Clients',
    chauffeurs:'ðŸ‘¤ Chauffeurs', vehicules:'ðŸš VÃ©hicules', carburant:'â›½ Carburant',
    rentabilite:'ðŸ’° RentabilitÃ©', statistiques:'ðŸ“ˆ Statistiques', previsions:'ðŸ”® PrÃ©visions',
    salaries:'ðŸ‘¥ Gestion SalariÃ©s', planning:'ðŸ“… Planning hebdomadaire',
    alertes:'ðŸ”” Alertes', inspections:'ðŸš— Inspections vÃ©hicules',
    messagerie:'ðŸ’¬ Messagerie interne', parametres:'âš™ï¸ ParamÃ¨tres',
    charges:'ðŸ’¸ Charges', incidents:'ðŸš¨ Incidents / RÃ©clamations', relances:'â° Relances paiement', entretiens:'ðŸ”§ Carnet d\'entretien',
    heures:'â±ï¸ Heures & Km'
  };
  document.getElementById('pageTitle').textContent = titres[page] || page;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      switch (page) {
        case 'dashboard':    rafraichirDashboard(); break;
        case 'livraisons':   navLivPeriode('reset',0); afficherLivraisons(); break;
        case 'chauffeurs':   afficherChauffeurs(); break;
        case 'vehicules':    afficherVehicules(); break;
        case 'carburant':    navCarbMois(0); break;
        case 'rentabilite':  afficherRentabilite(); break;
        case 'statistiques': afficherStatistiques(); break;
        case 'previsions':   calculerPrevision(); break;
        case 'tva':          navTvaMois(0); break;
        case 'salaries':
          afficherSalaries();
          importerSalariesDepuisSupabase().then(function(resultat) {
            if (!resultat?.ok) return;
            afficherSalaries();
            rafraichirDependancesSalaries();
          });
          break;
        case 'heures':       navHeuresSemaine(0); break;
        case 'planning':     afficherPlanning(); afficherPlanningSemaine(); peuplerAbsenceSal(); afficherAbsencesPeriodes(); initFormulairePlanningRapide(); break;
        case 'alertes':      verifierDocumentsSalaries(); afficherAlertes(); break;
        case 'inspections':  navInspSemaine(0); break;
        case 'messagerie':   afficherMessagerie(); break;
        case 'clients':      afficherClientsDashboard(); break;
        case 'charges':      navChargesMois(0); break;
        case 'incidents':    afficherIncidents(); break;
        case 'relances':     afficherRelances(); break;
        case 'entretiens':   navEntrMois(0); break;
        case 'parametres':   chargerParametres(); break;
      }
    });
  });
}

function appliquerLibellesAnalyseHT() {
  const rent = {
    'rent-ca': "Chiffre d'affaires HT",
    'rent-carb': 'DÃ©penses carburant HT',
    'rent-entretien': 'DÃ©penses entretien HT',
    'rent-cout-km': 'CoÃ»t HT par kilomÃ¨tre',
    'rent-profit': 'Profit net estimÃ© HT'
  };
  Object.entries(rent).forEach(([id, label]) => {
    const card = document.getElementById(id)?.closest('.kpi-card');
    const target = card?.querySelector('.kpi-label');
    if (target) target.textContent = label;
  });
  const stats = {
    'stats-ca-periode': 'CA pÃ©riode HT',
    'stats-panier-moyen': 'Panier moyen HT'
  };
  Object.entries(stats).forEach(([id, label]) => {
    const card = document.getElementById(id)?.closest('.kpi-card');
    const target = card?.querySelector('.kpi-label');
    if (target) target.textContent = label;
  });
  const rentTitle = document.getElementById('chartRentabilite')?.closest('.card')?.querySelector('.card-header h2');
  if (rentTitle) rentTitle.textContent = 'RÃ©partition des dÃ©penses HT';
  const statsTitle = document.getElementById('chartCA')?.closest('.card')?.querySelector('.card-header h2');
  if (statsTitle) statsTitle.textContent = 'Ã‰volution du CA HT';
  const statsDriverTitle = document.getElementById('chartCAParChauffeur')?.closest('.card')?.querySelector('.card-header h2');
  if (statsDriverTitle) statsDriverTitle.textContent = 'CA HT par chauffeur (dÃ©tail)';
}

function toggleAbsenceTypeFields() {
  const type = document.getElementById('absence-type')?.value || 'conge';
  const debutWrap = document.getElementById('absence-heure-debut-wrap');
  const finWrap = document.getElementById('absence-heure-fin-wrap');
  if (debutWrap) debutWrap.style.display = type === 'travail' ? '' : 'none';
  if (finWrap) finWrap.style.display = type === 'travail' ? '' : 'none';
}

function initFormulairePlanningRapide() {
  appliquerLibellesAnalyseHT();
  const panelTitle = document.querySelector('#page-planning .planning-panel-title');
  if (panelTitle) panelTitle.textContent = 'Ajouter une pÃ©riode planning';
  const btn = document.querySelector('#page-planning .planning-absence-form .btn-primary');
  if (btn) btn.textContent = '+ Enregistrer la pÃ©riode';

  const typeSelect = document.getElementById('absence-type');
  if (typeSelect && !typeSelect.querySelector('option[value="travail"]')) {
    typeSelect.insertAdjacentHTML('afterbegin', '<option value="travail">Travail</option>');
    typeSelect.onchange = toggleAbsenceTypeFields;
  }

  const finField = document.getElementById('absence-fin')?.closest('.planning-field');
  if (finField && !document.getElementById('absence-heure-debut')) {
    finField.insertAdjacentHTML('afterend', `
      <div class="planning-field" id="absence-heure-debut-wrap">
        <label>Heure dÃ©but</label>
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

function ouvrirMenuMobile()  { document.getElementById('sidebar').classList.add('mobile-open');    document.getElementById('sidebarOverlay').classList.add('active'); }
function fermerMenuMobile()  { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

/* ===== MODALS ===== */
function openModal(id)  { mettreAJourSelects(); document.getElementById(id).classList.add('open'); }
function closeModal(id) {
  const editLockContext = getEditLockContextForModal(id);
  if (editLockContext) libererVerrouEdition(editLockContext.type, editLockContext.id);
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-edit-salarie') { editSalarieId = null; window._editSalarieId = null; }
  if (id === 'modal-edit-livraison') { window._editLivId = null; }
  if (id === 'modal-edit-client') { _editClientId = null; }
  if (id === 'modal-vehicule') { window._editVehId = null; }
  ['alerte-rent','profit-recap'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display='none'; });
}
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id); });

function mettreAJourSelects() {
  const chauffeurs = charger('chauffeurs');
  const vehicules  = charger('vehicules');
  const salaries   = charger('salaries');

  // VÃ©hicule dans charges et entretiens
  ['charge-veh','entr-veh'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const v = sel.value;
    sel.innerHTML = id==='charge-veh' ? '<option value="">â€” GÃ©nÃ©ral â€”</option>' : '<option value="">â€” Choisir â€”</option>';
    vehicules.forEach(vh => sel.innerHTML += `<option value="${vh.id}">${vh.immat}${vh.modele?' â€” '+vh.modele:''}</option>`);
    sel.value = v;
  });

  // Livraisons rÃ©centes dans incident (30 derniers jours)
  const incSel = document.getElementById('inc-livraison');
  if (incSel) {
    const v = incSel.value;
    const dateMin = new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0];
    incSel.innerHTML = '<option value="">â€” Aucune livraison spÃ©cifique â€”</option>';
    charger('livraisons').filter(l=>l.date>=dateMin).sort((a,b)=>new Date(b.date)-new Date(a.date))
      .forEach(l => incSel.innerHTML += `<option value="${l.id}">${l.numLiv||''} â€” ${l.client} (${l.date})</option>`);
    incSel.value = v;
  }

  // SÃ©lect salariÃ© dans modal incident
  peupleIncSalarie();

  // SÃ©lect salariÃ© dans modal planning
  const sp = document.getElementById('plan-salarie');
  if (sp) {
    const v = sp.value;
    sp.innerHTML = '<option value="">-- Choisir un salariÃ© --</option>';
    salaries.forEach(s => { sp.innerHTML += `<option value="${s.id}">${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    sp.value = v;
  }

  const sc = document.getElementById('liv-chauffeur');
  if (sc) {
    const v = sc.value; sc.innerHTML = '<option value="">-- Choisir un salariÃ© / chauffeur --</option>';
    // SalariÃ©s d'abord (avec badge), puis chauffeurs non-salariÃ©s
    salaries.forEach(s => { sc.innerHTML += `<option value="${s.id}">ðŸ‘¤ ${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    chauffeurs.filter(c => !salaries.find(s => s.id === c.id))
      .forEach(c => { sc.innerHTML += `<option value="${c.id}">${c.nom}</option>`; });
    sc.value = v;
  }

  const sec = document.getElementById('edit-liv-chauffeur');
  if (sec) {
    const v = sec.value; sec.innerHTML = '<option value="">-- Choisir un salariÃ© / chauffeur --</option>';
    salaries.forEach(s => { sec.innerHTML += `<option value="${s.id}">ðŸ‘¤ ${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    chauffeurs.filter(c => !salaries.find(s => s.id === c.id))
      .forEach(c => { sec.innerHTML += `<option value="${c.id}">${c.nom}</option>`; });
    sec.value = v;
  }

  ['liv-vehicule','edit-liv-vehicule','carb-vehicule','entr-vehicule'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const v = sel.value; sel.innerHTML = '<option value="">-- Choisir un vÃ©hicule --</option>';
    vehicules.forEach(veh => { sel.innerHTML += `<option value="${veh.id}">${veh.immat} â€” ${veh.modele}${veh.salNom ? ' ('+veh.salNom+')' : ''}</option>`; });
    sel.value = v;
  });

  // SÃ©lect vÃ©hicule dans crÃ©ation salariÃ©
  const sv = document.getElementById('nsal-vehicule');
  if (sv) {
    const v = sv.value; sv.innerHTML = '<option value="">-- Aucun pour l\'instant --</option>';
    vehicules.filter(veh => !veh.salId).forEach(veh => { sv.innerHTML += `<option value="${veh.id}">${veh.immat} â€” ${veh.modele}</option>`; });
    sv.value = v;
  }

  // SÃ©lect vÃ©hicule dans modal edit salariÃ©
  const sve = document.getElementById('edit-sal-vehicule');
  if (sve) {
    const v = sve.value; sve.innerHTML = '<option value="">-- Retirer l\'affectation --</option>';
    vehicules.forEach(veh => {
      const dejaPris = veh.salId && veh.salId !== (window._editSalarieId || '');
      if (!dejaPris) sve.innerHTML += `<option value="${veh.id}">${veh.immat} â€” ${veh.modele}</option>`;
    });
    sve.value = v;
  }
}

/* ===== LIVRAISONS ===== */
function ajouterLivraison() {
  const client   = document.getElementById('liv-client').value.trim();
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

  if (!client) { afficherToast('âš ï¸ Le nom du client est obligatoire', 'error'); return; }

  // Si prix manquant â†’ crÃ©er une alerte et continuer quand mÃªme
  if (!prix || isNaN(prix)) {
    ajouterAlerte('prix_manquant', `Livraison sans prix saisie â€” Client : ${client} (${date})`, { client, date });
    afficherBadgeAlertes();
  }

  const profit = prix - distance * config.coutKmEstime;
  const affectation = synchroniserAffectationLivraison(chaufId, vehId);

  const livraison = {
    id: genId(),
    numLiv: genNumLivraison(),
    client, depart, arrivee, distance, prix, prixHT, tauxTVA, profit,
    chaufId: affectation.chaufId || null, chaufNom: affectation.chaufNom,
    vehId: affectation.vehId || null, vehNom: affectation.vehNom,
    statut, date, notes,
    statutPaiement: 'en-attente',
    modePaiement:   document.getElementById('liv-mode-paiement')?.value || '',
    heureDebut:     document.getElementById('liv-heure-debut')?.value || '',
    creeLe: new Date().toISOString()
  };

  const livraisons = charger('livraisons');
  livraisons.push(livraison);
  sauvegarder('livraisons', livraisons);
  enregistrerConduite(livraison);

  closeModal('modal-livraison');
  viderFormulaireLivraison();
  afficherLivraisons();
  afficherToast('âœ… Livraison enregistrÃ©e !');
}

function viderFormulaireLivraison() {
  ['liv-client','liv-zone','liv-depart','liv-arrivee','liv-distance','liv-prix','liv-prix-ht','liv-notes','liv-heure-debut'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['liv-chauffeur','liv-vehicule','liv-mode-paiement'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const tvaSel = document.getElementById('liv-taux-tva'); if (tvaSel) tvaSel.value = '20';
  document.getElementById('liv-statut').value = 'en-attente';
  document.getElementById('liv-date').value   = aujourdhui();
  const sug = document.getElementById('client-suggestions');
  if (sug) sug.innerHTML = '';
}

const STORAGE_REFRESH_QUEUE = new Map();

function planifierRafraichissementStorage(cle, callback) {
  if (typeof callback !== 'function') return;
  if (STORAGE_REFRESH_QUEUE.has(cle)) return;
  const timer = setTimeout(function() {
    STORAGE_REFRESH_QUEUE.delete(cle);
    callback();
  }, 10);
  STORAGE_REFRESH_QUEUE.set(cle, timer);
}

/* Auto-remplir le vÃ©hicule quand on choisit un salariÃ© dans le modal livraison */
document.addEventListener('DOMContentLoaded', () => {
  const selChauf = document.getElementById('liv-chauffeur');
  if (selChauf) selChauf.addEventListener('change', () => {
    const chaufId = selChauf.value;
    const vehAff  = getVehiculeParSalId(chaufId);
    const selVeh  = document.getElementById('liv-vehicule');
    if (vehAff && selVeh && !selVeh.value) selVeh.value = vehAff.id;
  });
});

/* ===== SYNCHRO STORAGE (salariÃ© â†’ admin en temps rÃ©el) ===== */
window.addEventListener('storage', function(e) {
  if (e.key) STORAGE_CACHE.delete(e.key);
  else STORAGE_CACHE.clear();
  // Statut livraison mis Ã  jour par un salariÃ©
  if (e.key === 'livraisons') {
    const pageActive = document.querySelector('.page.active');
    if (pageActive?.id === 'page-livraisons')  {
      planifierRafraichissementStorage('page-livraisons', function() {
        if (_vueLivraisons === 'kanban') afficherKanban();
        else if (_vueLivraisons === 'calendrier') afficherCalendrier();
        else afficherLivraisons();
      });
    }
    if (pageActive?.id === 'page-dashboard')   planifierRafraichissementStorage('dashboard-livraisons', rafraichirDashboard);
    planifierRafraichissementStorage('badge-alertes', afficherBadgeAlertes);
  }
  // Km saisi par un salariÃ©
  if (e.key && e.key.startsWith('km_sal_')) {
    const pageActive = document.querySelector('.page.active');
    if (pageActive?.id === 'page-salaries') planifierRafraichissementStorage('page-salaries', afficherSalaries);
    if (pageActive?.id === 'page-vehicules') planifierRafraichissementStorage('page-vehicules', afficherVehicules);
    if (pageActive?.id === 'page-alertes') planifierRafraichissementStorage('page-alertes-km', afficherAlertes);
  }
  // Carburant saisi/modifiÃ© par un salariÃ©
  if (e.key === 'carburant') {
    const pageActive = document.querySelector('.page.active');
    if (pageActive?.id === 'page-carburant') planifierRafraichissementStorage('page-carburant', afficherCarburant);
  }
  // Nouvelles alertes (modif plein, km, inspection)
  if (e.key === 'alertes_admin') {
    planifierRafraichissementStorage('badge-alertes', afficherBadgeAlertes);
    const pageActive = document.querySelector('.page.active');
    if (pageActive?.id === 'page-alertes') planifierRafraichissementStorage('page-alertes', afficherAlertes);
    if (pageActive?.id === 'page-dashboard') planifierRafraichissementStorage('dashboard-alertes', rafraichirDashboard);
  }
  // Nouvelle inspection
  if (e.key === 'inspections') {
    const pageActive = document.querySelector('.page.active');
    if (pageActive?.id === 'page-inspections') planifierRafraichissementStorage('page-inspections', afficherInspections);
    if (pageActive?.id === 'page-vehicules') planifierRafraichissementStorage('page-vehicules-inspections', afficherVehicules);
  }
  // Nouveau message d'un salariÃ©
  if (e.key && e.key.startsWith('messages_')) {
    planifierRafraichissementStorage('badge-messages', mettreAJourBadgeMsgAdmin);
    const pageActive = document.querySelector('.page.active');
    if (pageActive?.id === 'page-messagerie') planifierRafraichissementStorage('page-messagerie', afficherMessagerie);
    if (pageActive?.id === 'page-dashboard')  planifierRafraichissementStorage('dashboard-messages', rafraichirDashboard);
  }
});

function afficherLivraisons() {
  let livraisons = charger('livraisons');
  const tb = document.getElementById('tb-livraisons');
  const filtreStatut    = document.getElementById('filtre-statut')?.value;
  const filtreDateDeb   = document.getElementById('filtre-date-debut')?.value;
  const filtreDateFin   = document.getElementById('filtre-date-fin')?.value;
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim();
  const filtrePaiement  = document.getElementById('filtre-paiement')?.value;
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value;

  // Mettre Ã  jour le select chauffeurs
  const selChauf = document.getElementById('filtre-chauffeur');
  if (selChauf) {
    const valeurCourante = selChauf.value;
    selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
    const salaries = charger('salaries');
    salaries.forEach(s => { selChauf.innerHTML += `<option value="${s.id}">ðŸ‘¤ ${s.nom}</option>`; });
    selChauf.value = valeurCourante;
  }

  if (filtreStatut)    livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtreDateDeb)   livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
  if (filtreDateFin)   livraisons = livraisons.filter(l => l.date <= filtreDateFin);
  if (filtrePaiement)  livraisons = livraisons.filter(l => (l.statutPaiement||'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) livraisons = livraisons.filter(l =>
    (l.client||'').toLowerCase().includes(filtreRecherche) ||
    (l.chaufNom||'').toLowerCase().includes(filtreRecherche) ||
    (l.numLiv||'').toLowerCase().includes(filtreRecherche) ||
    (l.depart||'').toLowerCase().includes(filtreRecherche) ||
    (l.arrivee||'').toLowerCase().includes(filtreRecherche)
  );
  livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
  paginer['__reload_tb-livraisons'] = afficherLivraisons;

  if (!livraisons.length) {
    tb.innerHTML = emptyState('ðŸ“¦', 'Aucune livraison trouvÃ©e', filtreRecherche||filtreStatut||filtreDate ? 'Aucun rÃ©sultat pour ces filtres â€” essayez de les rÃ©initialiser.' : 'CrÃ©ez votre premiÃ¨re livraison pour commencer.', filtreRecherche||filtreStatut||filtreDate ? 'RÃ©initialiser' : '+ Nouvelle livraison', filtreRecherche||filtreStatut||filtreDate ? 'resetFiltres()' : "openModal('modal-livraison')");
    return;
  }
  paginer['__reload_tb-livraisons'] = afficherLivraisons;
  tb.innerHTML = livraisons.map(l => {
    const bdgPay = {
      'payÃ©':       '<span style="background:rgba(46,204,113,.15);color:#2ecc71;padding:2px 8px;border-radius:12px;font-size:.75rem">ðŸ’³ PayÃ©</span>',
      'en-attente': '<span style="background:rgba(245,166,35,.15);color:var(--accent);padding:2px 8px;border-radius:12px;font-size:.75rem">â³ En attente</span>',
      'litige':     '<span style="background:rgba(231,76,60,.15);color:#e74c3c;padding:2px 8px;border-radius:12px;font-size:.75rem">âš ï¸ Litige</span>'
    }[l.statutPaiement||'en-attente'] || '';
    return `<tr>
      <td style="font-size:.78rem;color:var(--text-muted)">${l.numLiv||'â€”'}</td>
      <td><strong>${l.client}</strong></td>
      <td style="font-size:.82rem">${l.depart||'â€”'}</td>
      <td style="font-size:.82rem">${l.arrivee||'â€”'}</td>
      <td>${l.distance ? formatKm(l.distance) : 'â€”'}</td>
      <td style="font-size:.85rem">${l.prixHT ? euros(l.prixHT) : (l.prix ? euros(l.prix / (1+(l.tauxTVA||20)/100)) : 'â€”')}</td>
      <td style="font-size:.82rem;color:var(--text-muted)">${l.prix ? euros(l.prix - (l.prixHT || l.prix/(1+(l.tauxTVA||20)/100))) : 'â€”'}</td>
      <td style="font-weight:700">${l.prix ? euros(l.prix) : 'â€”'}</td>
      <td>${l.chaufNom}</td>
      <td class="${(l.profit||0)>=0?'profit-pos':'profit-neg'}">${euros(l.profit||0)}</td>
      <td>${badgeStatut(l.statut)}</td>
      <td>${bdgPay}</td>
      <td><div class="livraison-actions-panel"><div class="livraison-actions-quick">${actionStatutPropre}${actionPaiementPropre}</div><div class="livraison-actions-main">
        <select class="btn-icon" onchange="changerStatutPaiement('${l.id}',this.value)" title="Statut paiement">
          <option value="en-attente" ${(l.statutPaiement||'en-attente')==='en-attente'?'selected':''}>â³</option>
          <option value="payÃ©"       ${l.statutPaiement==='payÃ©'      ?'selected':''}>ðŸ’³</option>
          <option value="litige"     ${l.statutPaiement==='litige'    ?'selected':''}>âš ï¸</option>
        </select>
        <select class="btn-icon" onchange="changerStatutLivraison('${l.id}',this.value)">
          <option value="en-attente" ${l.statut==='en-attente'?'selected':''}>â³</option>
          <option value="en-cours"   ${l.statut==='en-cours'  ?'selected':''}>ðŸš</option>
          <option value="livre"      ${l.statut==='livre'     ?'selected':''}>âœ…</option>
        </select>
        <button class="btn-icon" onclick="dupliquerLivraison('${l.id}')" title="Dupliquer">ðŸ“‹</button>
        <button class="btn-icon" onclick="ouvrirRecurrence('${l.id}')" title="RÃ©currence">ðŸ”</button>
        <button class="btn-icon" onclick="ouvrirEditLivraison('${l.id}')">âœï¸</button>
        <button class="btn-icon danger" onclick="supprimerLivraison('${l.id}')">ðŸ—‘ï¸</button>
      </div></div></td>
    </tr>`;
  }).join('');
}

function changerStatutPaiement(id, statut) {
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(l => l.id === id);
  if (idx > -1) { livraisons[idx].statutPaiement = statut; sauvegarder('livraisons', livraisons); afficherToast('ðŸ’³ Paiement mis Ã  jour'); }
}

function changerStatutLivraison(id, statut) {
  const livraisons = charger('livraisons'), idx = livraisons.findIndex(l => l.id === id);
  if (idx > -1) { livraisons[idx].statut = statut; sauvegarder('livraisons', livraisons); afficherToast('âœ… Statut mis Ã  jour'); }
}

async function supprimerLivraison(id) {
  const _ok = await confirmDialog('Supprimer cette livraison ?', {titre:'Supprimer',icone:'ðŸ“¦',btnLabel:'Supprimer'});
  if (!_ok) return;
  sauvegarder('livraisons', charger('livraisons').filter(l => l.id !== id));
  afficherLivraisons(); afficherToast('ðŸ—‘ï¸ SupprimÃ©');
}

function resetFiltres() {
  ['filtre-statut','filtre-paiement','filtre-date-debut','filtre-date-fin','filtre-recherche-liv','filtre-chauffeur'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  afficherLivraisons();
}

function alerteRentabilite() {
  const prix = parseFloat(document.getElementById('liv-prix').value)||0;
  const dist = parseFloat(document.getElementById('liv-distance').value)||0;
  const profit = prix - dist * config.coutKmEstime;
  const ar = document.getElementById('alerte-rent'), pr = document.getElementById('profit-recap');
  if (prix > 0) {
    pr.style.display = 'block';
    document.getElementById('profit-estime').textContent = euros(profit);
    ar.style.display = (profit < prix*0.2 || profit < 0) ? 'block' : 'none';
  } else { pr.style.display = 'none'; ar.style.display = 'none'; }
}

/* ===== CHAUFFEURS ===== */
function ajouterChauffeur() {
  const nom    = document.getElementById('chauf-nom').value.trim();
  const prenom = document.getElementById('chauf-prenom')?.value.trim() || '';
  const nomComplet = prenom ? `${prenom} ${nom}` : nom;
  const tel = document.getElementById('chauf-tel').value.trim();
  const statut = document.getElementById('chauf-statut').value;
  if (!nom || !tel) { afficherToast('âš ï¸ Nom et tÃ©lÃ©phone obligatoires', 'error'); return; }
  const chauffeurs = charger('chauffeurs');
  chauffeurs.push({ id: genId(), nom: nomComplet, nomFamille: nom, prenom, tel, statut, creeLe: new Date().toISOString() });
  sauvegarder('chauffeurs', chauffeurs);
  closeModal('modal-chauffeur');
  ['chauf-nom','chauf-tel'].forEach(id => document.getElementById(id).value = '');
  afficherChauffeurs(); afficherToast('âœ… Chauffeur ajoutÃ© !');
}

function afficherChauffeurs() {
  const chauffeurs = charger('chauffeurs');
  const salaries   = charger('salaries');
  const vehicules  = charger('vehicules');
  const livraisons = charger('livraisons');
  const tb = document.getElementById('tb-chauffeurs');

  const salSansVeh = salaries.filter(s => !vehicules.find(v => v.salId === s.id));
  const sel = document.getElementById('sel-affecter-chauffeur');
  if (sel) {
    sel.innerHTML = '<option value="">-- SalariÃ©s sans vÃ©hicule --</option>';
    salSansVeh.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nom} (${s.numero})</option>`; });
  }

  if (!chauffeurs.length) { tb.innerHTML = emptyState('ðŸ‘¤','Aucun chauffeur','Les chauffeurs sont crÃ©Ã©s automatiquement depuis la page SalariÃ©s.'); return; }
  tb.innerHTML = chauffeurs.map(c => {
    const livs = livraisons.filter(l => l.chaufId === c.id);
    const ca   = livs.reduce((s, l) => s + (l.prix||0), 0);
    const veh  = vehicules.find(v => v.salId === c.id);
    return `<tr>
      <td><strong>${c.nom}</strong></td><td>${c.tel}</td><td>${badgeChauffeur(c.statut)}</td>
      <td>${veh ? `<span style="color:var(--accent-2);font-size:0.82rem">ðŸš ${veh.immat}</span>` : '<span style="color:var(--text-muted);font-size:0.82rem">â€”</span>'}</td>
      <td>${livs.length}</td><td>${euros(ca)}</td>
      <td><div class="livraison-actions-panel"><div class="livraison-actions-quick">${actionStatutPropre}${actionPaiementPropre}</div><div class="livraison-actions-main">
        <select class="btn-icon" onchange="changerStatutChauffeur('${c.id}',this.value)">
          <option value="disponible"   ${c.statut==='disponible'  ?'selected':''}>âœ…</option>
          <option value="en-livraison" ${c.statut==='en-livraison'?'selected':''}>ðŸš</option>
          <option value="inactif"      ${c.statut==='inactif'     ?'selected':''}>â¸ï¸</option>
        </select>
        <button class="btn-icon danger" onclick="supprimerChauffeur('${c.id}')">ðŸ—‘ï¸</button>
      </td></tr>`;
  }).join('');
}

function changerStatutChauffeur(id, statut) {
  const ch = charger('chauffeurs'), i = ch.findIndex(c => c.id === id);
  if (i > -1) { ch[i].statut = statut; sauvegarder('chauffeurs', ch); }
}

async function supprimerChauffeur(id) {
  const _ok4 = await confirmDialog('Supprimer ce chauffeur ?', {titre:'Supprimer',icone:'ðŸ‘¤',btnLabel:'Supprimer'});
  if (!_ok4) return;
  sauvegarder('chauffeurs', charger('chauffeurs').filter(c => c.id !== id));
  afficherChauffeurs(); afficherToast('ðŸ—‘ï¸ SupprimÃ©');
}

/* ===== VÃ‰HICULES ===== */
function ajouterVehicule() {
  const immat  = document.getElementById('veh-immat').value.trim().toUpperCase();
  const modele = document.getElementById('veh-modele').value.trim();
  const km     = parseFloat(document.getElementById('veh-km').value) || 0;
  const conso  = parseFloat(document.getElementById('veh-conso').value) || 0;
  const salId  = document.getElementById('veh-salarie')?.value || '';
  const dateCT = document.getElementById('veh-date-ct')?.value || '';
  const modeAcquisition = document.getElementById('veh-mode-acquisition')?.value || 'achat';
  const dateAcquisition = document.getElementById('veh-date-acquisition')?.value || '';
  const prixAchatHT = parseFloat(document.getElementById('veh-acq-prix-ht')?.value) || 0;
  const tauxTVAAchat = parseFloat(document.getElementById('veh-acq-taux-tva')?.value) || 20;
  const prixAchatTTC = parseFloat(document.getElementById('veh-acq-prix')?.value) || (prixAchatHT * (1 + tauxTVAAchat/100));
  const dureeAmortissement = parseFloat(document.getElementById('veh-duree-amortissement')?.value) || 0;
  const modeAmortissement = document.getElementById('veh-mode-amortissement')?.value || 'lineaire';
  const entretienIntervalKm = parseFloat(document.getElementById('veh-entretien-interval-km')?.value) || 0;
  const entretienIntervalMois = parseFloat(document.getElementById('veh-entretien-interval-mois')?.value) || 0;
  const dateMiseAuRebut = document.getElementById('veh-date-rebut')?.value || '';
  const valeurMiseAuRebut = parseFloat(document.getElementById('veh-valeur-rebut')?.value) || 0;

  if (!immat) { afficherToast('âš ï¸ Immatriculation obligatoire', 'error'); return; }
  if (salId && charger('vehicules').find(v => v.salId === salId)) {
    afficherToast('âš ï¸ Ce salariÃ© a dÃ©jÃ  un vÃ©hicule', 'error'); return;
  }

  const sal = charger('salaries').find(s => s.id === salId);
  const tvaCarbDeductible = parseFloat(document.getElementById('veh-tva-carburant')?.value) || 80;
  const vehicule = {
    id: genId(), immat, modele, km, kmInitial: km, conso, dateCT, tvaCarbDeductible,
    modeAcquisition, dateAcquisition, prixAchatHT, tauxTVAAchat, prixAchatTTC, dureeAmortissement,
    modeAmortissement, entretienIntervalKm, entretienIntervalMois, dateMiseAuRebut, valeurMiseAuRebut,
    salId: salId||null, salNom: sal ? sal.nom : null,
    creeLe: new Date().toISOString()
  };
  const vehicules = charger('vehicules');
  vehicules.push(vehicule);
  sauvegarder('vehicules', vehicules);

  closeModal('modal-vehicule');
  ['veh-immat','veh-modele','veh-km','veh-conso','veh-acq-prix-ht','veh-acq-prix','veh-duree-amortissement','veh-entretien-interval-km','veh-entretien-interval-mois','veh-date-rebut','veh-valeur-rebut'].forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  if (document.getElementById('veh-acq-taux-tva')) document.getElementById('veh-acq-taux-tva').value = '20';
  if (document.getElementById('veh-mode-acquisition')) document.getElementById('veh-mode-acquisition').value = 'achat';
  if (document.getElementById('veh-mode-amortissement')) document.getElementById('veh-mode-amortissement').value = 'lineaire';
  if (document.getElementById('veh-date-acquisition')) document.getElementById('veh-date-acquisition').value = '';
  if (document.getElementById('veh-date-ct')) document.getElementById('veh-date-ct').value = '';
  if (document.getElementById('veh-salarie')) document.getElementById('veh-salarie').value = '';
  if (document.getElementById('veh-tva-carburant')) document.getElementById('veh-tva-carburant').value = '80';
  afficherVehicules(); afficherChauffeurs(); afficherToast('âœ… VÃ©hicule ajoutÃ© !');
}

function afficherVehicules() {
  let vehicules  = charger('vehicules');
  const entretiens = charger('entretiens');
  const salaries   = charger('salaries');
  const tb = document.getElementById('tb-vehicules');

  // Filtre
  const filtreVehSal = document.getElementById('filtre-veh-salarie')?.value || '';
  const selFiltreVeh = document.getElementById('filtre-veh-salarie');
  if (selFiltreVeh) {
    const currentValue = selFiltreVeh.value;
    selFiltreVeh.innerHTML = '<option value="">Tous les vÃ©hicules</option>';
    vehicules.forEach(v => { selFiltreVeh.innerHTML += `<option value="${v.id}">${v.immat} â€” ${v.modele||''}</option>`; });
    selFiltreVeh.value = currentValue;
  }
  if (filtreVehSal) vehicules = vehicules.filter(v => v.id === filtreVehSal);

  const sv = document.getElementById('veh-salarie');
  if (sv) {
    const v = sv.value; sv.innerHTML = '<option value="">-- Aucun --</option>';
    const allVeh = charger('vehicules');
    salaries.forEach(s => { if (!allVeh.find(ve => ve.salId === s.id)) sv.innerHTML += `<option value="${s.id}">${s.nom} (${s.numero})</option>`; });
    sv.value = v;
  }

  // VÃ©rifier alertes CT (dans les 30 jours)
  const auj = new Date(); const dans30j = new Date(); dans30j.setDate(auj.getDate()+30);
  vehicules.forEach(v => {
    const pilotageEntretien = getPilotageEntretienVehicule(v);
    if (v.dateCT) {
      const dateCT = new Date(v.dateCT);
      if (dateCT < auj) ajouterAlerteSiAbsente('ct_expire', `âš ï¸ ContrÃ´le technique expirÃ© â€” ${v.immat}`, { vehId: v.id });
      else if (dateCT < dans30j) ajouterAlerteSiAbsente('ct_proche', `ðŸ”” CT Ã  renouveler dans moins de 30 jours â€” ${v.immat}`, { vehId: v.id });
    }
    if (pilotageEntretien.estEnRetard && pilotageEntretien.prochainKm) {
      ajouterAlerteSiAbsente('vidange', `ðŸ”§ Entretien Ã  effectuer â€” ${v.immat} (${formatKm(pilotageEntretien.kmActuel)} / objectif ${formatKm(pilotageEntretien.prochainKm)})`, { vehId: v.id });
    } else if (pilotageEntretien.estProche && pilotageEntretien.prochainKm) {
      ajouterAlerteSiAbsente('vidange', `ðŸ”” Entretien proche â€” ${v.immat} (${formatKm(pilotageEntretien.kmActuel)} / objectif ${formatKm(pilotageEntretien.prochainKm)})`, { vehId: v.id });
    }
  });
  afficherBadgeAlertes();

  if (!vehicules.length) { tb.innerHTML = emptyState('ðŸš','Aucun vÃ©hicule','Ajoutez votre premier vÃ©hicule pour commencer le suivi de flotte.','+ Nouveau vÃ©hicule',"openModal('modal-vehicule')"); return; }
  tb.innerHTML = vehicules.map(v => {
    const ent = entretiens.filter(e => e.vehId === v.id).sort((a,b) => new Date(b.date)-new Date(a.date))[0];
    const sal = v.salId ? salaries.find(s => s.id === v.salId) : null;
    const kmActuel = calculerKilometrageVehiculeActuel(v);
    const pilotageEntretien = getPilotageEntretienVehicule(v);

    // Conso rÃ©elle : calcul entre pleins consÃ©cutifs (mÃ©thode correcte)
    const pleinsVeh = charger('carburant').filter(p=>p.vehId===v.id && p.km)
      .sort((a,b)=>new Date(a.date)-new Date(b.date));
    let consoReelle = null;
    if (pleinsVeh.length >= 2) {
      // Calculer sur tous les intervalles entre pleins consÃ©cutifs
      let totalLitres = 0, totalKm = 0, nbIntervalles = 0;
      for (let i = 1; i < pleinsVeh.length; i++) {
        const kmInterval = (pleinsVeh[i].km||0) - (pleinsVeh[i-1].km||0);
        const litresPlein = pleinsVeh[i].litres || 0;
        if (kmInterval > 0 && litresPlein > 0) {
          totalLitres += litresPlein;
          totalKm     += kmInterval;
          nbIntervalles++;
        }
      }
      if (totalKm > 0 && nbIntervalles > 0) {
        consoReelle = (totalLitres / totalKm * 100).toFixed(1);
      }
    }

    // Alerte CT
    let ctLabel = v.dateCT ? v.dateCT : 'â€”';
    let ctStyle = '';
    if (v.dateCT) {
      const dct = new Date(v.dateCT);
      if (dct < auj) ctStyle = 'color:#e74c3c;font-weight:600';
      else if (dct < dans30j) ctStyle = 'color:var(--accent);font-weight:600';
    }
    const amort = calculerAmortissementVehicule(v);
    const acquisitionInfos = [
      v.modeAcquisition ? `<div style="font-weight:600">${(v.modeAcquisition||'').toUpperCase()}</div>` : '',
      v.dateAcquisition ? `<div style="font-size:.76rem;color:var(--text-muted)">Depuis le ${formatDateExport(v.dateAcquisition)}</div>` : '',
      v.dureeAmortissement ? `<div style="font-size:.76rem;color:var(--text-muted)">Amort. ${v.dureeAmortissement} an(s)</div>` : '',
      (v.entretienIntervalKm || v.entretienIntervalMois) ? `<div style="font-size:.76rem;color:var(--text-muted)">RÃ©vision ${v.entretienIntervalKm ? 'tous les ' + formatKm(v.entretienIntervalKm) : ''}${v.entretienIntervalKm && v.entretienIntervalMois ? ' / ' : ''}${v.entretienIntervalMois ? 'tous les ' + v.entretienIntervalMois + ' mois' : ''}</div>` : ''
    ].filter(Boolean).join('');
    const financeInfos = [
      v.prixAchatHT ? `<div><strong>${euros(v.prixAchatHT)}</strong> HT</div>` : '',
      v.prixAchatTTC ? `<div style="font-size:.76rem;color:var(--text-muted)">${euros((v.prixAchatTTC||0) - (v.prixAchatHT||0))} TVA â€¢ ${euros(v.prixAchatTTC)} TTC</div>` : '',
      v.dureeAmortissement && amort.annuel ? `<div style="font-size:.76rem;color:var(--accent)">Amort. ${euros(amort.annuel)}/an â€¢ ${amort.mode === 'degressif' ? 'dÃ©gressif' : 'linÃ©aire'}</div>` : '',
      amort.prorataPremierExercice ? `<div style="font-size:.76rem;color:var(--text-muted)">Prorata fiscal 1er exercice : ${(amort.prorataPremierExercice * 100).toFixed(1)} %</div>` : '',
      v.dateMiseAuRebut ? `<div style="font-size:.76rem;color:var(--text-muted)">Mise au rebut : ${formatDateExport(v.dateMiseAuRebut)}</div>` : '',
      `<div style="font-size:.76rem;color:var(--text-muted)">TVA carburant ${formaterTaux(v.tvaCarbDeductible || 0)}</div>`
    ].filter(Boolean).join('');
    const entretienInfos = [
      ent ? formatDateExport(ent.date) : 'â€”',
      pilotageEntretien.prochainKm ? `<div style="font-size:.75rem;color:${pilotageEntretien.estEnRetard ? 'var(--red)' : pilotageEntretien.estProche ? 'var(--accent)' : 'var(--text-muted)'}">Prochain km : ${formatKm(pilotageEntretien.prochainKm)}</div>` : '',
      pilotageEntretien.dateEcheance ? `<div style="font-size:.75rem;color:var(--text-muted)">Ã‰chÃ©ance : ${formatDateExport(pilotageEntretien.dateEcheance)}</div>` : ''
    ].filter(Boolean).join('');

    return `<tr>
      <td>${v.photo ? `<img src="${v.photo}" class="veh-photo-thumb" onclick="voirPhotoVehicule('${v.id}')" />` : `<label class="veh-photo-placeholder" title="Ajouter photo"><input type="file" accept="image/*" style="display:none" onchange="uploaderPhotoVehicule('${v.id}',this)" />ðŸ“·</label>`}</td>
      <td><strong>${v.immat}</strong></td>
      <td>${v.modele||'â€”'}</td>
      <td>${kmActuel ? formatKm(kmActuel) : 'â€”'}</td>
      <td>${acquisitionInfos || '<span style="color:var(--text-muted)">â€”</span>'}</td>
      <td>${v.conso ? v.conso+' L/100km' : 'â€”'}${consoReelle
        ? ` <span style="color:var(--green);font-size:.75rem" title="CalculÃ© entre ${pleinsVeh.length} pleins">(rÃ©el: ${consoReelle} L/100km)</span>`
        : pleinsVeh.length === 1
          ? ` <span style="color:var(--text-muted);font-size:.72rem">(1 plein â€” besoin de 2+)</span>`
          : ''
      }</td>
      <td style="${ctStyle}">${v.dateCT ? formatDateExport(ctLabel) : 'â€”'}${v.dateCT && new Date(v.dateCT)<auj?' âš ï¸':''}</td>
      <td>${sal ? `<span style="color:var(--accent-2)">ðŸ‘¤ ${getSalarieNomComplet(sal)}</span>` : '<span style="color:var(--text-muted)">â€”</span>'}</td>
      <td>${financeInfos || '<span style="color:var(--text-muted)">â€”</span>'}</td>
      <td>${entretienInfos || 'â€”'}</td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditVehicule('${v.id}')" title="Modifier">âœï¸</button>
        <button class="btn-icon" onclick="ouvrirAffectationVehicule('${v.id}')" title="Affecter">ðŸ‘¤</button>
        <button class="btn-icon" onclick="ouvrirTCO('${v.id}')" title="CoÃ»t total TCO">ðŸ’°</button>
        <button class="btn-icon" onclick="ouvrirHistoriqueConducteurs('${v.id}')" title="Historique conducteurs">ðŸš</button>
        <button class="btn-icon danger" onclick="supprimerVehicule('${v.id}')">ðŸ—‘ï¸</button>
      </div></div></td>
    </tr>`;
  }).join('');
}

/* Ajoute une alerte seulement si elle n'existe pas dÃ©jÃ  (Ã©vite les doublons) */
function ajouterAlerteSiAbsente(type, message, meta) {
  const alertes = charger('alertes_admin');
  const existe  = alertes.find(a => a.type === type && a.meta?.vehId === meta?.vehId && !a.traitee);
  if (!existe) ajouterAlerte(type, message, meta);
}

let affectVehId = null;
function ouvrirAffectationVehicule(vehId) {
  affectVehId = vehId;
  const vehicules = charger('vehicules'), salaries = charger('salaries');
  const veh = vehicules.find(v => v.id === vehId);
  document.getElementById('affect-veh-label').textContent = veh ? `${veh.immat} â€” ${veh.modele}` : '';
  const sel = document.getElementById('affect-salarie-sel');
  sel.innerHTML = '<option value="">-- Retirer l\'affectation --</option>';
  salaries.forEach(s => {
    const pris = vehicules.find(v => v.salId === s.id && v.id !== vehId);
    if (!pris) sel.innerHTML += `<option value="${s.id}" ${veh?.salId===s.id?'selected':''}>${getSalarieNomComplet(s, { includeNumero: true })}</option>`;
  });
  document.getElementById('modal-affecter-vehicule').classList.add('open');
}

function confirmerAffectationVehicule() {
  const salId = document.getElementById('affect-salarie-sel').value;
  const vehicules = charger('vehicules');
  const idx = vehicules.findIndex(v => v.id === affectVehId);
  if (idx > -1) {
    // Retirer l'ancienne affectation
    vehicules[idx].salId = salId || null;
    vehicules[idx].salNom = null;
    if (salId) {
      const sal = charger('salaries').find(s => s.id === salId);
      if (sal) vehicules[idx].salNom = sal.nom;
    }
    sauvegarder('vehicules', vehicules);
  }
  closeModal('modal-affecter-vehicule');
  affectVehId = null;
  afficherVehicules(); afficherChauffeurs();
  afficherToast(salId ? 'âœ… VÃ©hicule affectÃ© !' : 'âœ… Affectation retirÃ©e');
}

async function supprimerVehicule(id) {
  const veh = charger('vehicules').find(v => v.id === id);
  const _ok2 = await confirmDialog(`Supprimer ${veh?.immat || 'ce vÃ©hicule'} ?`, {titre:'Supprimer le vÃ©hicule',icone:'ðŸš',btnLabel:'Supprimer'});
  if (!_ok2) return;
  // Supprimer le vÃ©hicule
  sauvegarder('vehicules', charger('vehicules').filter(v => v.id !== id));
  // Anonymiser les livraisons liÃ©es (garder l'historique)
  const livraisons = charger('livraisons');
  livraisons.forEach(l => { if (l.vehId === id) { l.vehId = null; l.vehNom = (veh?.immat||'VÃ©hicule supprimÃ©') + ' (archivÃ©)'; } });
  sauvegarder('livraisons', livraisons);
  afficherVehicules(); afficherChauffeurs();
  afficherToast('ðŸ—‘ï¸ VÃ©hicule supprimÃ©');
}

/* ===== ENTRETIENS (dans page VÃ©hicules â€” historique simplifiÃ©) ===== */
function afficherEntretiensVehicules() {
  const vehicules  = charger('vehicules');
  const entretiens = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const tb = document.getElementById('tb-entretiens-vehicules');
  if (!tb) return;
  if (!entretiens.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun entretien</td></tr>'; return; }
  tb.innerHTML = entretiens.slice(0,20).map(e => {
    const veh = vehicules.find(v=>v.id===e.vehId);
    return `<tr>
      <td><strong>${veh?.immat||'â€”'}</strong></td>
      <td>${getTypeEntretienLabel(e.type)}</td>
      <td><strong>${e.cout ? euros(e.cout) : 'â€”'}</strong></td>
      <td>${formatDateExport(e.date)}</td>
      <td style="font-size:.82rem">${e.description||'â€”'}</td>
      <td><button class="btn-icon" onclick="ouvrirEditEntretien('${e.id}')" title="Modifier">âœï¸</button><button class="btn-icon danger" onclick="supprimerEntretien('${e.id}');afficherEntretiensVehicules()">ðŸ—‘ï¸</button></td>
    </tr>`;
  }).join('');
}

/* ===== CARBURANT ===== */
function ajouterCarburant() {
  const vehId     = document.getElementById('carb-vehicule').value;
  const litres    = parseFloat(document.getElementById('carb-litres').value);
  const prixLitre = parseFloat(document.getElementById('carb-prix-litre').value);
  const date      = document.getElementById('carb-date').value || aujourdhui();
  const typeCarb  = document.getElementById('carb-type')?.value || 'gasoil';
  if (!vehId || isNaN(litres) || isNaN(prixLitre)) { afficherToast('âš ï¸ Tous les champs sont obligatoires', 'error'); return; }
  const veh   = charger('vehicules').find(v => v.id === vehId);
  const total = litres * prixLitre;
  let libelle = veh ? veh.immat : 'Inconnu';
  if (veh?.salNom) libelle = `${veh.immat} â€” ${veh.salNom}`;
  const pleins = charger('carburant');
  pleins.push({ id: genId(), vehId, vehNom: libelle, litres, prixLitre, total, date, typeCarburant: typeCarb, source: 'admin', modifie: false, creeLe: new Date().toISOString() });
  sauvegarder('carburant', pleins);
  closeModal('modal-carburant');
  ['carb-litres','carb-prix-litre'].forEach(id => document.getElementById(id).value = '');
  afficherCarburant(); afficherToast('âœ… Plein enregistrÃ© !');
}

function afficherCarburant() {
  let pleins = charger('carburant');
  const tb = document.getElementById('tb-carburant');

  // Filtres
  const filtreType = document.getElementById('filtre-carb-type')?.value || '';
  const filtreVeh  = document.getElementById('filtre-carb-vehicule')?.value || '';
  const filtreMois = document.getElementById('filtre-carb-mois')?.value || '';

  // Remplir le select vÃ©hicules du filtre
  const selVeh = document.getElementById('filtre-carb-vehicule');
  if (selVeh) {
    const currentValue = selVeh.value;
    selVeh.innerHTML = '<option value="">Tous les vÃ©hicules</option>';
    charger('vehicules').forEach(v => { selVeh.innerHTML += `<option value="${v.id}">${v.immat}</option>`; });
    selVeh.value = currentValue;
  }

  // Appliquer les filtres
  if (filtreType) pleins = pleins.filter(p => (p.typeCarburant||'gasoil') === filtreType);
  if (filtreVeh)  pleins = pleins.filter(p => p.vehId === filtreVeh);
  if (filtreMois) pleins = pleins.filter(p => (p.date||'').startsWith(filtreMois));

  // KPIs (basÃ©s sur le mois filtrÃ© ou le mois courant)
  const moisRef = filtreMois || new Date().toISOString().slice(0,7);
  const pleinsMois = charger('carburant').filter(p => p.date.startsWith(moisRef));
  const tot = pleinsMois.reduce((s,p) => s+p.total,0), lts = pleinsMois.reduce((s,p) => s+p.litres,0);
  const totalHT = pleinsMois.reduce((s,p) => s + ((p.total||0) / 1.2), 0);
  const totalTVA = tot - totalHT;
  const prixMoyenHT = lts > 0 ? totalHT / lts : 0;
  const prixMoyenTTC = lts > 0 ? tot / lts : 0;
  document.getElementById('kpi-carb-mois').textContent   = euros(tot);
  const elCarbDetail = document.getElementById('kpi-carb-mois-detail');
  if (elCarbDetail) elCarbDetail.textContent = `HT ${euros(totalHT)} â€¢ TVA ${euros(totalTVA)}`;
  document.getElementById('kpi-litres-mois').textContent = lts.toFixed(1)+' L';
  document.getElementById('kpi-prix-litre').textContent  = euros(prixMoyenTTC);
  const elPrixLitreDetail = document.getElementById('kpi-prix-litre-detail');
  if (elPrixLitreDetail) elPrixLitreDetail.textContent = `HT ${euros(prixMoyenHT)} â€¢ TTC ${euros(prixMoyenTTC)}`;

  if (!pleins.length) { tb.innerHTML = emptyState('â›½','Aucun plein enregistrÃ©','Les pleins saisis par vos salariÃ©s ou vous-mÃªme apparaÃ®tront ici.'); return; }
  tb.innerHTML = [...pleins].sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe)).map(p => {
    const src = p.source==='salarie'
      ? '<span style="background:rgba(79,142,247,0.15);color:#4f8ef7;padding:2px 7px;border-radius:12px;font-size:0.75rem;">ðŸ‘¤ SalariÃ©</span>'
      : '<span style="background:rgba(245,166,35,0.12);color:var(--accent);padding:2px 7px;border-radius:12px;font-size:0.75rem;">âš™ï¸ Admin</span>';
    const mod = p.modifie ? '<span style="background:rgba(231,76,60,0.15);color:#e74c3c;padding:2px 7px;border-radius:12px;font-size:0.75rem;margin-left:4px;">âœï¸ ModifiÃ©</span>' : '';
    const typeLabel = (p.typeCarburant||'gasoil')==='essence' ? 'ðŸŸ¢ Essence' : 'â›½ Gasoil';
    return `<tr${p.modifie?' style="background:rgba(231,76,60,0.04)"':''}>
      <td>${p.vehNom}${mod}</td><td>${typeLabel}</td><td>${p.litres}L</td><td>${euros(p.prixLitre)}</td>
      <td><strong>${euros(p.total)}</strong></td><td>${formatDateExport(p.date)}</td><td>${src}</td>
      <td><button class="btn-icon" onclick="ouvrirEditCarburantAdmin('${p.id}')">âœï¸</button> <button class="btn-icon danger" onclick="supprimerCarburant('${p.id}')">ðŸ—‘ï¸</button></td></tr>`;
  }).join('');
}

function resetFiltresCarburant() {
  ['filtre-carb-type','filtre-carb-vehicule','filtre-carb-mois'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  afficherCarburant();
}

async function supprimerCarburant(id) {
  const _ok = await confirmDialog('Supprimer ce plein ?', {titre:'Supprimer',icone:'â›½',btnLabel:'Supprimer'});
  if (!_ok) return;
  sauvegarder('carburant', charger('carburant').filter(p => p.id !== id));
  afficherCarburant(); afficherToast('ðŸ—‘ï¸ SupprimÃ©');
}

/* ===== RELEVÃ‰S KM â€” ADMIN ===== */
function afficherReleveKm() {
  const salaries = charger('salaries');
  const tb = document.getElementById('tb-releve-km');
  const range = getHeuresPeriodeRange();
  const tous = [];
  salaries.forEach(s => {
    charger('km_sal_'+s.id)
      .filter(e => (e.date || '') >= range.debut && (e.date || '') <= range.fin)
      .forEach(e => tous.push({ ...e, salNom: s.nom, salNumero: s.numero }));
  });
  tous.sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe));
  if (!tous.length) {
    tb.innerHTML = emptyState('ðŸ›£ï¸','Aucun relevÃ© km',`Aucun relevÃ© kilomÃ©trique sur ${range.label.toLowerCase()} (${range.datesLabel}).`);
    return;
  }
  tb.innerHTML = tous.map(e => {
    const modTag = e.modifie
      ? '<span style="font-size:.72rem;background:rgba(231,76,60,.12);color:#e74c3c;padding:1px 6px;border-radius:12px;margin-left:4px">âœï¸ ModifiÃ©</span>'
      : '';
    const kmDepart = e.kmDepart != null ? e.kmDepart.toLocaleString('fr-FR')+' km' : 'â€”';
    const kmArrivee = e.kmArrivee != null ? e.kmArrivee.toLocaleString('fr-FR')+' km' : 'â€”';
    const distance = e.kmArrivee != null
      ? ((e.distance || (e.kmArrivee - e.kmDepart)) || 0).toFixed(0)+' km'
      : 'En attente';
    return `<tr>
      <td><strong>${e.salNom}</strong> <span style="color:var(--text-muted);font-size:0.8rem">${e.salNumero||''}</span></td>
      <td>${e.date}</td>
      <td>${kmDepart}</td>
      <td>${kmArrivee}</td>
      <td><strong style="color:var(--accent)">${distance}</strong>${modTag}</td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditKmAdmin('${e.salId}','${e.id}')">âœï¸</button>
        <button class="btn-icon danger" onclick="supprimerKmAdmin('${e.salId}','${e.id}')">ðŸ—‘ï¸</button>
      </td>
    </tr>`;
  }).join('');
}

let _editKmSalId = null, _editKmId = null;
function ouvrirEditKmAdmin(salId, kmId) {
  _editKmSalId = salId; _editKmId = kmId;
  const entrees = charger('km_sal_'+salId);
  const e = entrees.find(x => x.id === kmId); if (!e) return;
  document.getElementById('admin-km-dep').value  = e.kmDepart;
  document.getElementById('admin-km-arr').value  = e.kmArrivee || '';
  document.getElementById('admin-km-date').value = e.date;
  document.getElementById('modal-edit-km').classList.add('open');
}

function confirmerEditKmAdmin() {
  const dep  = parseFloat(document.getElementById('admin-km-dep').value);
  const arrRaw = document.getElementById('admin-km-arr').value;
  const arr  = arrRaw === '' ? null : parseFloat(arrRaw);
  const date = document.getElementById('admin-km-date').value;
  if (!dep) { afficherToast('âš ï¸ Km dÃ©part obligatoire', 'error'); return; }
  if (arr !== null && arr <= dep) { afficherToast('âš ï¸ Km arrivÃ©e doit Ãªtre supÃ©rieur au km dÃ©part', 'error'); return; }

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
    // Km de report automatique supprimÃ© en v12fix3
  }
  closeModal('modal-edit-km');
  _editKmSalId = null; _editKmId = null;
  afficherReleveKm(); afficherToast('âœ… RelevÃ© mis Ã  jour');
}

async function supprimerKmAdmin(salId, kmId) {
  const _ok = await confirmDialog('Supprimer ce relevÃ© ?', {titre:'Supprimer',icone:'ðŸ›£ï¸',btnLabel:'Supprimer'});
  if (!_ok) return;
  const cle = 'km_sal_'+salId;
  const entrees = charger(cle).filter(e => e.id !== kmId);
  sauvegarder(cle, entrees);
  afficherReleveKm(); afficherToast('ðŸ—‘ï¸ RelevÃ© supprimÃ©');
}

/* Met Ã  jour le km de dÃ©part mÃ©morisÃ© pour la prochaine saisie */
/* mettreAJourKmReport supprimÃ© â€” v12fix3 */

/* ===== VOIR PHOTO VÃ‰HICULE EN PLEIN Ã‰CRAN ===== */
function voirPhotoVehicule(vehId) {
  const veh = charger('vehicules').find(v => v.id === vehId);
  if (!veh || !veh.photo) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;flex-direction:column;gap:12px';
  overlay.innerHTML = `
    <img src="${veh.photo}" style="max-width:90%;max-height:80vh;border-radius:8px;object-fit:contain" />
    <div style="color:#fff;font-size:.9rem;font-weight:600">${veh.immat} â€” ${veh.modele||''}</div>
    <button onclick="this.closest('div[style]').remove()" style="background:rgba(255,255,255,.1);border:none;color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.9rem">âœ• Fermer</button>`;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

/* ===== ALERTES ADMIN ===== */
function afficherAlertes() {
  const toutes  = charger('alertes_admin').sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe));

  // Filtres
  const filtreType   = document.getElementById('filtre-alerte-type')?.value || '';
  const filtreSal    = document.getElementById('filtre-alerte-salarie')?.value || '';
  const filtreStatut = document.getElementById('filtre-alerte-statut')?.value || 'actives';
  const filtreDate   = document.getElementById('filtre-alerte-date')?.value || '';

  // Remplir select salariÃ© si vide
  const selSal = document.getElementById('filtre-alerte-salarie');
  if (selSal) {
    const valeurCourante = selSal.value;
    selSal.innerHTML = '<option value="">Tous les salariÃ©s</option>';
    charger('salaries').forEach(s => { selSal.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
    selSal.value = valeurCourante;
  }

  let filtered = toutes;
  if (filtreStatut === 'actives')  filtered = filtered.filter(a => !a.traitee);
  if (filtreStatut === 'traitees') filtered = filtered.filter(a => a.traitee);
  if (filtreType)   filtered = filtered.filter(a => a.type === filtreType);
  if (filtreSal)    filtered = filtered.filter(a => a.meta?.salId === filtreSal);
  if (filtreDate)   filtered = filtered.filter(a => (a.creeLe||'').startsWith(filtreDate));

  const actives = filtered.filter(a => !a.traitee);
  const traitees = filtered.filter(a => a.traitee);

  // Marquer toutes comme lues
  sauvegarder('alertes_admin', toutes.map(a => ({ ...a, lu: true })));
  afficherBadgeAlertes();

  // Afficher/masquer la section historique selon le filtre
  const cardTraitees = document.getElementById('card-alertes-traitees');
  if (cardTraitees) cardTraitees.style.display = (filtreStatut === 'actives') ? 'none' : 'block';

  // â”€â”€ CatÃ©gories d'alertes actives â”€â”€
  const categories = [
    { type: 'prix_manquant',   label: 'ðŸ’¶ Prix de livraison manquant',  color: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.3)'  },
    { type: 'livraison_modif', label: 'âœï¸ Livraisons modifiÃ©es',         color: 'rgba(155,89,182,0.06)',  border: 'rgba(155,89,182,0.25)' },
    { type: 'carburant_modif', label: 'âœï¸ Modifications carburant',      color: 'rgba(231,76,60,0.06)',   border: 'rgba(231,76,60,0.25)'  },
    { type: 'km_modif',        label: 'âœï¸ Modifications relevÃ©s km',     color: 'rgba(79,142,247,0.06)',  border: 'rgba(79,142,247,0.25)' },
    { type: 'inspection',      label: 'ðŸš— Inspections vÃ©hicules reÃ§ues', color: 'rgba(46,204,113,0.06)',  border: 'rgba(46,204,113,0.25)' },
    { type: 'ct_expire',       label: 'âš ï¸ ContrÃ´les techniques expirÃ©s', color: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.3)'   },
    { type: 'ct_proche',       label: 'ðŸ”” CT Ã  renouveler (< 30 jours)', color: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.2)'  },
    { type: 'vidange',            label: 'ðŸ”§ Vidanges Ã  effectuer',           color: 'rgba(52,152,219,0.06)',  border: 'rgba(52,152,219,0.2)'  },
    { type: 'permis_expire',    label: 'âš ï¸ Permis de conduire expirÃ©s',     color: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.3)'   },
    { type: 'permis_proche',    label: 'ðŸªª Permis expirent bientÃ´t',        color: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.2)'  },
    { type: 'assurance_expire', label: 'âš ï¸ Assurances expirÃ©es',            color: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.3)'   },
    { type: 'assurance_proche', label: 'ðŸ›¡ï¸ Assurances expirent bientÃ´t',   color: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.2)'  },
  ];
  // Types Ã  ne jamais afficher dans les alertes (gÃ©rÃ©s ailleurs)
  const typesExclus = ['message'];

  const container = document.getElementById('alertes-categories');
  if (!container) return;
  container.innerHTML = '';

  let totalActives = 0;

  categories.forEach(cat => {
    const items = actives.filter(a => a.type === cat.type);
    if (!items.length) return;
    totalActives += items.length;

    const section = document.createElement('div');
    section.style.cssText = `background:${cat.color};border:1px solid ${cat.border};border-radius:10px;margin-bottom:16px;overflow:hidden`;
    section.innerHTML = `
      <div style="padding:12px 16px;font-weight:600;font-size:0.9rem;border-bottom:1px solid ${cat.border};display:flex;justify-content:space-between;align-items:center">
        <span>${cat.label}</span>
        <span style="background:rgba(255,255,255,0.1);padding:2px 10px;border-radius:20px;font-size:0.78rem">${items.length}</span>
      </div>
      <table class="data-table" style="background:transparent">
        <thead><tr><th>Message</th><th>SalariÃ©</th><th>Date/Heure</th><th>Action</th></tr></thead>
        <tbody>${items.map(a => {
          const dateFmt = new Date(a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
          // Types critiques = pas d'ignorer (CT expirÃ© uniquement)
          const estCritique = ['ct_expire'].includes(cat.type);
          // Types avec saisie rapide
          const estPrixManquant = cat.type === 'prix_manquant';

          let btnActions = '';
          // Raccourci contextuel selon le type
          let btnRaccourci = '';
          if (['permis_expire','permis_proche'].includes(cat.type) && a.meta?.salId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="ouvrirEditSalarie('${a.meta.salId}')" title="Modifier la fiche salariÃ©">ðŸªª Modifier permis</button>`;
          } else if (['assurance_expire','assurance_proche'].includes(cat.type) && a.meta?.salId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="ouvrirEditSalarie('${a.meta.salId}')" title="Modifier la fiche salariÃ©">ðŸ›¡ï¸ Modifier assurance</button>`;
          } else if (['ct_expire','ct_proche'].includes(cat.type) && a.meta?.vehId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('vehicules');setTimeout(()=>ouvrirEditVehicule('${a.meta.vehId}'),200)" title="Modifier le vÃ©hicule">ðŸš Modifier vÃ©hicule</button>`;
          } else if (cat.type === 'vidange' && a.meta?.vehId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('entretiens')" title="Ajouter entretien">ðŸ”§ Entretien</button>`;
          }

          if (estPrixManquant) {
            btnActions = `<button class="btn-icon" style="background:rgba(245,166,35,0.12);color:var(--accent);border:1px solid rgba(245,166,35,0.3)" onclick="ouvrirLivraisonPourPrix('${a.meta?.client||''}')">ðŸ“ Saisir</button>
              <button class="btn-icon danger" onclick="ignorerAlerte('${a.id}')" style="margin-left:4px" title="Ignorer dÃ©finitivement">âœ• Ignorer</button>`;
          } else if (estCritique) {
            btnActions = `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">âœ… TraitÃ©</button>`;
          } else {
            btnActions = `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">âœ… Valider</button>
              <button class="btn-icon danger" onclick="ignorerAlerte('${a.id}')" style="margin-left:4px" title="Ignorer dÃ©finitivement">âœ• Ignorer</button>`;
          }
          return `<tr>
            <td style="font-size:0.85rem">${a.message}</td>
            <td>${a.meta?.salNom||a.meta?.client||'â€”'}</td>
            <td style="color:var(--text-muted);font-size:0.82rem">${dateFmt}</td>
            <td style="white-space:nowrap">${btnRaccourci} ${btnActions}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    container.appendChild(section);
  });

  // Alertes d'autres types non catÃ©gorisÃ©s
  const autres = actives.filter(a => !categories.find(c => c.type === a.type) && !typesExclus.includes(a.type));
  if (autres.length) {
    totalActives += autres.length;
    const section = document.createElement('div');
    section.style.cssText = 'background:rgba(108,117,125,0.06);border:1px solid rgba(108,117,125,0.2);border-radius:10px;margin-bottom:16px;overflow:hidden';
    section.innerHTML = `
      <div style="padding:12px 16px;font-weight:600;font-size:0.9rem;border-bottom:1px solid rgba(108,117,125,0.2)">ðŸ”” Autres alertes</div>
      <table class="data-table" style="background:transparent"><thead><tr><th>Message</th><th>SalariÃ©</th><th>Date/Heure</th><th>Action</th></tr></thead>
      <tbody>${autres.map(a => {
        const dateFmt = new Date(a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        return `<tr><td style="font-size:0.85rem">${a.message}</td><td>${a.meta?.salNom||'â€”'}</td>
          <td style="color:var(--text-muted);font-size:0.82rem">${dateFmt}</td>
          <td><button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">âœ… Valider</button></td></tr>`;
      }).join('')}</tbody></table>`;
    container.appendChild(section);
  }

  if (!totalActives) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:32px;font-size:0.9rem">âœ… Aucune alerte en attente</div>';
  }

  // â”€â”€ Historique traitÃ© â”€â”€
  const tbT = document.getElementById('tb-alertes-traitees');
  if (tbT) {
    if (!traitees.length) {
      tbT.innerHTML = '<tr><td colspan="4" class="empty-row">Aucune alerte traitÃ©e</td></tr>';
    } else {
      tbT.innerHTML = traitees.slice(0, 30).map(a => {
        const dateFmt = new Date(a.traiteLe||a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        const icon = a.type==='carburant_modif' ? 'âœï¸â›½' : a.type==='km_modif' ? 'âœï¸ðŸ›£ï¸' : a.type==='prix_manquant' ? 'ðŸ’¶' : 'âœ…';
        return `<tr style="opacity:0.6">
          <td>${icon}</td><td style="font-size:0.85rem">${a.message}</td>
          <td>${a.meta?.salNom||a.meta?.client||'â€”'}</td>
          <td style="color:var(--text-muted);font-size:0.82rem">TraitÃ© le ${dateFmt}</td>
        </tr>`;
      }).join('');
    }
  }
}

function ouvrirLivraisonPourPrix(client) {
  // Ouvre le modal livraison prÃ©-rempli avec le client
  openModal('modal-livraison');
  if (client) {
    const el = document.getElementById('liv-client');
    if (el) el.value = client;
  }
}

function validerAlerte(id) {
  const alertes = charger('alertes_admin');
  const idx = alertes.findIndex(a => a.id === id);
  if (idx > -1) {
    alertes[idx].traitee  = true;
    alertes[idx].traiteLe = new Date().toISOString();
    // Notifier le salariÃ© que sa modification a Ã©tÃ© validÃ©e
    const salId = alertes[idx].meta?.salId;
    const type  = alertes[idx].type;
    if (salId) {
      const notifs = charger('notifs_sal_'+salId);
      notifs.push({
        id: genId(), type: type+'_valide',
        message: type==='carburant_modif'
          ? 'âœ… Votre modification de plein a Ã©tÃ© validÃ©e par l\'administrateur.'
          : 'âœ… Votre modification de relevÃ© km a Ã©tÃ© validÃ©e par l\'administrateur.',
        lu: false,
        creeLe: new Date().toISOString()
      });
      sauvegarder('notifs_sal_'+salId, notifs);
    }
    sauvegarder('alertes_admin', alertes);
    afficherAlertes();
    afficherBadgeAlertes();
    afficherToast('âœ… Alerte traitÃ©e â€” salariÃ© notifiÃ©');
  }
}

function ignorerAlerte(id) {
  // Supprime dÃ©finitivement l'alerte â€” pas dans l'historique traitÃ©
  sauvegarder('alertes_admin', charger('alertes_admin').filter(a => a.id !== id));
  afficherAlertes();
  afficherBadgeAlertes();
  afficherToast('ðŸ—‘ï¸ Alerte ignorÃ©e');
}

async function viderAlertes() {
  const _ok7 = await confirmDialog('Effacer toutes les alertes traitÃ©es ?', {titre:'Vider l\'historique',icone:'ðŸ—‘ï¸',btnLabel:'Effacer',danger:false});
  if (!_ok7) return;
  sauvegarder('alertes_admin', charger('alertes_admin').filter(a => !a.traitee));
  afficherAlertes(); afficherToast('ðŸ—‘ï¸ Historique effacÃ©');
}

/* ===== DASHBOARD ===== */
let chartActivite = null;
function rafraichirDashboard() {
  const setText = function(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    return el;
  };
  const livraisons = charger('livraisons'), chauffeurs = charger('chauffeurs');
  const vehicules  = charger('vehicules'),  pleins     = charger('carburant');
  const charges    = charger('charges');
  const salaries   = charger('salaries');
  const auj = aujourdhui(), mois = auj.slice(0,7), sem = getSemaineDebut();
  const livsAuj = livraisons.filter(l => l.date===auj);
  const caJour   = livsAuj.reduce((s,l)=>s+(l.prix||0),0);
  const caSem    = livraisons.filter(l=>l.date>=sem).reduce((s,l)=>s+(l.prix||0),0);
  const caMois   = livraisons.filter(l=>l.date.startsWith(mois)).reduce((s,l)=>s+(l.prix||0),0);
  const carbMois = pleins.filter(p=>p.date.startsWith(mois)).reduce((s,p)=>s+p.total,0);
  const entretienChargesMois = charges.filter(c => (c.date||'').startsWith(mois) && c.categorie === 'entretien').reduce((s,c)=>s+(c.montant||0),0);
  const autresChargesMois = charges.filter(c => (c.date||'').startsWith(mois) && c.categorie !== 'entretien').reduce((s,c)=>s+(c.montant||0),0);
  const chargesMois = charges.filter(c => (c.date||'').startsWith(mois)).reduce((s,c)=>s+(c.montant||0),0);
  const depensesMois = carbMois + chargesMois;
  const alertes  = compterAlertesNonLues();
  const livraisonsMois = livraisons.filter(l => (l.date||'').startsWith(mois) && (l.prix||0) > 0);
  const totalTvaCollectee = livraisonsMois.reduce((s, l) => {
    const ht = getMontantHTLivraison(l);
    return s + ((parseFloat(l.prix) || 0) - ht);
  }, 0);
  const totalTvaCharges = charges.filter(c => (c.date||'').startsWith(mois)).reduce((s, c) => {
    const ht = parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 20) / 100));
    return s + ((parseFloat(c.montant) || 0) - ht);
  }, 0);
  const totalTvaCarburant = pleins.filter(p => (p.date||'').startsWith(mois)).reduce((s, p) => {
    const ht = getMontantHTCarburant(p);
    const tva = (parseFloat(p.total) || 0) - ht;
    return s + (tva * getTauxDeductibiliteCarburant(p) / 100);
  }, 0);
  const entretiensMois = charger('entretiens').filter(e => (e.date||'').startsWith(mois));
  const totalTvaEntretiens = entretiensMois.reduce((s, e) => {
    const ht = getMontantHTEntretien(e);
    const tva = (parseFloat(e.cout) || 0) - ht;
    return s + (tva * getTauxDeductibiliteEntretien(e) / 100);
  }, 0);
  const totalTvaDeductible = totalTvaCharges + totalTvaCarburant + totalTvaEntretiens;
  const soldeTva = totalTvaCollectee - totalTvaDeductible;

  setText('kpi-livraisons-jour', livsAuj.length);
  const livsM = livraisons.filter(l=>l.date.startsWith(mois));
  setText('kpi-livraisons-mois', livsM.length);
  setText('kpi-ca-jour', euros(caJour));
  setText('kpi-ca-semaine', euros(caSem));
  setText('kpi-ca-mois', euros(caMois));
  setText('kpi-carburant', euros(depensesMois));
  setText('kpi-benefice', euros(caMois-depensesMois));
  setText('kpi-tva-solde', soldeTva >= 0 ? euros(soldeTva) : euros(Math.abs(soldeTva)));
  const depDetailEl = document.getElementById('kpi-depenses-detail');
  if (depDetailEl) depDetailEl.innerHTML = `
    <div class="kpi-depenses-line"><span>â›½</span><span>Carburant</span><strong>${euros(carbMois)}</strong></div>
    <div class="kpi-depenses-line"><span>ðŸ”§</span><span>Entretien</span><strong>${euros(entretienChargesMois)}</strong></div>
    <div class="kpi-depenses-line"><span>ðŸ’¸</span><span>Charges</span><strong>${euros(autresChargesMois)}</strong></div>
  `;
  const tvaDetailEl = document.getElementById('kpi-tva-detail');
  if (tvaDetailEl) {
    tvaDetailEl.textContent = soldeTva >= 0
      ? `CollectÃ©e ${euros(totalTvaCollectee)} Â· DÃ©ductible ${euros(totalTvaDeductible)}`
      : `CrÃ©dit TVA ${euros(Math.abs(soldeTva))}`;
  }
  setText('kpi-chauffeurs', chauffeurs.filter(c=>c.statut!=='inactif').length);
  setText('kpi-vehicules', vehicules.length);
  setText('kpi-alertes', alertes);

  // KPI nouveaux messages
  let totalMsgsNonLus = 0;
  salaries.forEach(s => {
    const msgs = JSON.parse(localStorage.getItem('messages_' + s.id) || '[]');
    totalMsgsNonLus += msgs.filter(m => m.auteur === 'salarie' && !m.lu).length;
  });
  setText('kpi-messages', totalMsgsNonLus);

  // Objectif CA mensuel
  const objectif = parseFloat(localStorage.getItem('objectif_ca_mensuel') || '0');
  const objEl = document.getElementById('kpi-objectif-pct');
  if (objEl && objectif > 0) {
    const pct = Math.min(Math.round(caMois / objectif * 100), 100);
    objEl.innerHTML = `<div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px">Objectif ${euros(objectif)}</div>
      <div style="background:rgba(255,255,255,.08);border-radius:20px;height:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--green)':'var(--accent)'};border-radius:20px;transition:width .4s"></div>
      </div>
      <div style="font-size:.82rem;margin-top:4px;color:${pct>=100?'var(--green)':'var(--text)'}">${pct}%</div>`;
  }

  // Qui travaille aujourd'hui
  const jourSemaine = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][new Date().getDay()];
  const plannings   = JSON.parse(localStorage.getItem('plannings')||'[]');
  const travaillent = salaries.filter(s => {
    const plan = plannings.find(p => p.salId === s.id);
    const jour = plan?.semaine?.find(j => j.jour === jourSemaine);
    return jour?.travaille;
  });
  const travailleEl = document.getElementById('kpi-travaillent');
  if (travailleEl) {
    travailleEl.textContent = travaillent.length;
    const listEl = document.getElementById('liste-travaillent');
    if (listEl) listEl.innerHTML = travaillent.length
      ? travaillent.map(s => `<span style="font-size:.8rem;background:rgba(46,204,113,.1);color:var(--green);padding:3px 8px;border-radius:20px;margin:2px">${s.nom}</span>`).join('')
      : '<span style="font-size:.82rem;color:var(--text-muted)">Aucun planning dÃ©fini pour aujourd\'hui</span>';
  }

  // Solde trÃ©sorerie
  const solde = calculerSoldeTresorerie();
  const soldeEl = document.getElementById('kpi-solde');
  if (soldeEl) {
    soldeEl.textContent = euros(solde.solde);
    soldeEl.className   = 'kpi-value ' + (solde.solde >= 0 ? 'solde-positif' : 'solde-negatif');
  }
  const encaisseEl = document.getElementById('kpi-encaisse-sub');
  if (encaisseEl) encaisseEl.textContent = `ðŸ’¶ EncaissÃ© : ${euros(solde.encaisse)} Â· DÃ©pensÃ© : ${euros(solde.depenses)}`;

  // Comparatif mensuel
  const comp = calculerComparatif();
  const compEl = document.getElementById('kpi-comp-ca');
  if (compEl) compEl.innerHTML = `vs mois prÃ©c. ${euros(comp.caPrec)} ${badgeEvol(comp.caActuel, comp.caPrec)}`;
  const compLivEl = document.getElementById('kpi-comp-liv');
  if (compLivEl) compLivEl.innerHTML = `vs mois prÃ©c. ${comp.livPrec} ${badgeEvol(comp.livActuel, comp.livPrec)}`;

  // Objectif livraisons
  const objLiv = parseInt(localStorage.getItem('objectif_livraisons_mensuel')||'0');
  const objLivEl = document.getElementById('kpi-objectif-liv-pct');
  if (objLivEl && objLiv > 0) {
    const pct = Math.min(Math.round(comp.livActuel / objLiv * 100), 100);
    objLivEl.innerHTML = `<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:3px">${comp.livActuel} / ${objLiv} livraisons</div>
      <div style="background:rgba(255,255,255,.08);border-radius:20px;height:5px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--green)':'var(--blue)'};border-radius:20px;transition:width .4s"></div>
      </div>
      <div style="font-size:.78rem;margin-top:3px;color:${pct>=100?'var(--green)':'var(--text)'}">${pct}%</div>`;
  }

  // Taux ponctualitÃ©
  afficherPonctualite();

  // Incidents ouverts
  const incOpen = charger('incidents').filter(i=>i.statut==='ouvert').length;
  const incEl   = document.getElementById('kpi-incidents');
  if (incEl) incEl.textContent = incOpen;

  // Taux de ponctualitÃ©
  const ponct = calculerTauxPonctualite();
  const ponctEl = document.getElementById('kpi-ponctualite');
  if (ponctEl) {
    ponctEl.innerHTML = `<div style="font-size:1.5rem;font-weight:800;color:${ponct.taux>=90?'var(--green)':ponct.taux>=70?'var(--accent)':'var(--red)'}">${ponct.taux}%</div>
      <div class="ponctualite-bar"><div class="ponctualite-fill" style="width:${ponct.taux}%;background:${ponct.taux>=90?'var(--green)':ponct.taux>=70?'var(--accent)':'var(--red)'}"></div></div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">${ponct.livres}/${ponct.total} livrÃ©es</div>`;
  }

  // Top clients
  afficherTopClients();

  const recentes = [...livraisons].sort((a,b)=>new Date(b.creeLe)-new Date(a.creeLe)).slice(0,5);
  document.getElementById('tb-livraisons-recentes').innerHTML = recentes.length===0
    ? '<tr><td colspan="5" class="empty-row">Aucune livraison</td></tr>'
    : recentes.map(l=>`<tr><td>${l.numLiv||'â€”'}</td><td><strong>${l.client}</strong></td><td>${euros(l.prix)}</td><td>${badgeStatut(l.statut)}</td><td>${l.date}</td></tr>`).join('');

  const labels=[], donnees=[];
  for (let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}));
    donnees.push(livraisons.filter(l=>l.date===ds).reduce((s,l)=>s+(l.prix||0),0));
  }
  if (chartActivite) chartActivite.destroy();
  chartActivite = new Chart(document.getElementById('chartActivite'), {
    type:'bar', data:{ labels, datasets:[{ label:'CA (â‚¬)', data:donnees,
      backgroundColor:'rgba(245,166,35,0.3)', borderColor:'rgba(245,166,35,0.9)', borderWidth:2, borderRadius:6 }] },
    options:{ responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}},
      scales:{ x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#7c8299'}}, y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#7c8299'}} } }
  });
}
function getSemaineDebut() {
  const d=new Date(), j=d.getDay(), diff=d.getDate()-j+(j===0?-6:1);
  return new Date(new Date().setDate(diff)).toISOString().split('T')[0];
}

/* ===== RENTABILITÃ‰ ===== */
let chartRentab = null;
var _rentMoisOffset = 0;
function getRentMoisRange() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + _rentMoisOffset);
  var debut = d.toISOString().slice(0,10);
  var finDate = new Date(d.getFullYear(), d.getMonth()+1, 0);
  var fin = finDate.toISOString().slice(0,10);
  return { debut, fin, label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}), dates: formatDateExport(debut) + ' au ' + formatDateExport(fin) };
}
function navRentMois(delta) {
  _rentMoisOffset = delta === 0 ? 0 : _rentMoisOffset + delta;
  afficherRentabilite();
}
function afficherRentabilite() {
  let livraisons=charger('livraisons'), pleins=charger('carburant'), entretiens=charger('entretiens'), charges=charger('charges');
  const range = getRentMoisRange();
  livraisons = livraisons.filter(l=>l.date>=range.debut&&l.date<=range.fin);
  pleins = pleins.filter(p=>p.date>=range.debut&&p.date<=range.fin);
  entretiens = entretiens.filter(e=>e.date>=range.debut&&e.date<=range.fin);
  charges = charges.filter(c=>c.date>=range.debut&&c.date<=range.fin && c.categorie !== 'entretien');
  const lbl = document.getElementById('rent-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('rent-mois-dates'); if (dates) dates.textContent = range.dates;

  const ca=livraisons.reduce((s,l)=>s+(l.prix||0),0);
  const carb=pleins.reduce((s,p)=>s+p.total,0);
  const entr=entretiens.reduce((s,e)=>s+(e.cout||0),0);
  const autresCharges = charges.reduce((s,c)=>s+(c.montant||0),0);
  const dep=carb+entr+autresCharges, profit=ca-dep, marge=ca>0?(profit/ca*100):0;
  const km=livraisons.reduce((s,l)=>s+(l.distance||0),0);
  document.getElementById('rent-ca').textContent        = euros(ca);
  document.getElementById('rent-carb').textContent      = euros(carb);
  document.getElementById('rent-entretien').textContent = euros(entr);
  document.getElementById('rent-charges').textContent   = euros(autresCharges);
  document.getElementById('rent-cout-km').textContent   = euros(km>0?dep/km:0);
  document.getElementById('rent-profit').textContent    = euros(profit);
  document.getElementById('rent-marge').textContent     = marge.toFixed(1)+' %';
  if (chartRentab) chartRentab.destroy();
  const isLight = document.body.classList.contains('light-mode');
  chartRentab = new Chart(document.getElementById('chartRentabilite'), {
    type:'doughnut', data:{ labels:['Carburant','Entretien','Autres charges','Profit net'],
      datasets:[{ data:[carb,entr,autresCharges,Math.max(profit,0)],
        backgroundColor:['rgba(230,126,34,0.8)','rgba(52,152,219,0.8)','rgba(155,89,182,0.8)','rgba(46,204,113,0.8)'],
        borderColor: isLight ? '#ffffff' : '#1a1d27', borderWidth:3 }] },
    options:{ responsive:true, maintainAspectRatio:true, plugins:{legend:{labels:{color: isLight ? '#1a1d27' : '#e8eaf0'}},
      tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${euros(ctx.parsed||0)}`}}} }
  });
}

/* ===== RENTABILITÃ‰ â€” Export PDF ===== */
function genererRentabilitePDF() {
  const params = getEntrepriseExportParams();
  const nom    = params.nom;
  const ca     = document.getElementById('rent-ca')?.textContent || '0 â‚¬';
  const carb   = document.getElementById('rent-carb')?.textContent || '0 â‚¬';
  const entr   = document.getElementById('rent-entretien')?.textContent || '0 â‚¬';
  const autres = document.getElementById('rent-charges')?.textContent || '0 â‚¬';
  const coutKm = document.getElementById('rent-cout-km')?.textContent || '0 â‚¬';
  const profit = document.getElementById('rent-profit')?.textContent || '0 â‚¬';
  const marge  = document.getElementById('rent-marge')?.textContent || '0 %';
  const dateExp = formatDateHeureExport();

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1d27">
    ${construireEnteteExport(params, 'Rapport de rentabilitÃ©', '', dateExp)}
    ${renderBlocInfosEntreprise(params)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">
      ${[['ðŸ’¶ CA',ca,'#f5a623'],['â›½ Carburant',carb,'#e74c3c'],['ðŸ”§ Entretien',entr,'#3498db'],['ðŸ“ Autres charges',autres,'#9b59b6'],['ðŸ“ CoÃ»t/km',coutKm,'#6b7280'],['ðŸ’° Profit',profit,'#2ecc71'],['ðŸ“Š Marge',marge,'#9b59b6']].map(([l,v,c])=>`<div style="background:#f8f9fc;border-radius:10px;padding:14px;text-align:center;border-top:3px solid ${c}"><div style="font-size:.72rem;color:#9ca3af;margin-bottom:6px">${l}</div><div style="font-size:1.1rem;font-weight:800;color:${c}">${v}</div></div>`).join('')}
    </div>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  ouvrirFenetreImpression('RentabilitÃ© â€” ' + nom, html, 'width=800,height=600');
  afficherToast('ðŸ“„ Rapport rentabilitÃ© gÃ©nÃ©rÃ©');
}

/* ===== STATISTIQUES ===== */
let chartCA=null,chartChauff=null,chartVeh=null,chartCAParChauff=null;
var _statsMoisOffset = 0;
function getStatsMoisRange() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + _statsMoisOffset);
  var debut = d.toISOString().slice(0,10);
  var finDate = new Date(d.getFullYear(), d.getMonth()+1, 0);
  var fin = finDate.toISOString().slice(0,10);
  return { debut, fin, label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}), dates: formatDateExport(debut) + ' au ' + formatDateExport(fin) };
}
function navStatsMois(delta) {
  _statsMoisOffset = delta === 0 ? 0 : _statsMoisOffset + delta;
  afficherStatistiques();
}
function afficherStatistiques() {
  const isLight = document.body.classList.contains('light-mode');
  const tickColor = isLight ? '#555' : '#7c8299';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const legendColor = isLight ? '#1a1d27' : '#e8eaf0';
  const range = getStatsMoisRange();
  const dateMinStr = range.debut;
  const dateMaxStr = range.fin;
  const livraisons = charger('livraisons');
  const lbl = document.getElementById('stats-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('stats-mois-dates'); if (dates) dates.textContent = range.dates;
  const livsFiltrees = livraisons.filter(l => l.date >= dateMinStr && l.date <= dateMaxStr);

  // KPIs pÃ©riode
  const caPeriode = livsFiltrees.reduce((s,l)=>s+(l.prix||0),0);
  const nbLivs    = livsFiltrees.length;
  const panierMoy = nbLivs > 0 ? caPeriode / nbLivs : 0;
  const kmTotal   = livsFiltrees.reduce((s,l)=>s+(l.distance||0),0);
  const el1=document.getElementById('stats-ca-periode'); if(el1) el1.textContent=euros(caPeriode);
  const el2=document.getElementById('stats-livraisons-periode'); if(el2) el2.textContent=nbLivs;
  const el3=document.getElementById('stats-panier-moyen'); if(el3) el3.textContent=euros(panierMoy);
  const el4=document.getElementById('stats-km-total'); if(el4) el4.textContent=Math.round(kmTotal)+' km';

  // Graphique CA â€” adaptatif
  const labels=[],donnees=[];
  const nbJours = Math.max(1, Math.round((new Date(dateMaxStr) - new Date(dateMinStr)) / (1000*60*60*24)));
  if (nbJours <= 31) {
    for(let i=nbJours-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];labels.push(d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));donnees.push(livraisons.filter(l=>l.date===ds).reduce((s,l)=>s+(l.prix||0),0));}
  } else {
    // Par semaine
    for(let i=Math.floor(nbJours/7)-1;i>=0;i--){
      const fin=new Date(); fin.setDate(fin.getDate()-i*7);
      const debut=new Date(fin); debut.setDate(debut.getDate()-6);
      const dStr=debut.toISOString().split('T')[0], fStr=fin.toISOString().split('T')[0];
      labels.push(debut.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));
      donnees.push(livraisons.filter(l=>l.date>=dStr&&l.date<=fStr).reduce((s,l)=>s+(l.prix||0),0));
    }
  }
  if(chartCA)chartCA.destroy();
  chartCA=new Chart(document.getElementById('chartCA'),{
    type:'line',
    data:{labels,datasets:[
      {label:'CA (â‚¬)',data:donnees,borderColor:'#4f8ef7',backgroundColor:'rgba(79,142,247,0.08)',fill:true,tension:0.3,pointRadius:3,pointBackgroundColor:'#4f8ef7',borderWidth:2.5}
    ]},
    options:{responsive:true,plugins:{legend:{labels:{color:legendColor}}},
      scales:{x:{grid:{color:gridColor},ticks:{color:tickColor,maxTicksLimit:12}},y:{grid:{color:gridColor},ticks:{color:tickColor,callback:v=>euros(v)}}}}
  });

  // Chauffeurs â€” horizontal bar
  const ch=charger('chauffeurs');
  if(chartChauff)chartChauff.destroy();
  const chData = ch.length ? ch.map(c=>({nom:c.nom, nb:livsFiltrees.filter(l=>l.chaufId===c.id).length})).sort((a,b)=>b.nb-a.nb) : [{nom:'Aucun',nb:0}];
  chartChauff=new Chart(document.getElementById('chartChauffeurs'),{
    type:'bar',
    data:{labels:chData.map(c=>c.nom),datasets:[{label:'Livraisons',data:chData.map(c=>c.nb),backgroundColor:'rgba(155,89,182,0.65)',borderColor:'rgba(155,89,182,1)',borderWidth:1.5,borderRadius:8}]},
    options:{indexAxis:'horizontal',responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gridColor},ticks:{color:tickColor}},y:{grid:{color:gridColor},ticks:{color:tickColor}}}}
  });

  // VÃ©hicules
  const veh=charger('vehicules');
  if(chartVeh)chartVeh.destroy();
  const vehData = veh.length ? veh.map(v=>({nom:v.immat,nb:livsFiltrees.filter(l=>l.vehId===v.id).length})).sort((a,b)=>b.nb-a.nb) : [{nom:'Aucun',nb:0}];
  chartVeh=new Chart(document.getElementById('chartVehicules'),{
    type:'bar',
    data:{labels:vehData.map(v=>v.nom),datasets:[{label:'Livraisons',data:vehData.map(v=>v.nb),backgroundColor:'rgba(230,126,34,0.65)',borderColor:'rgba(230,126,34,1)',borderWidth:1.5,borderRadius:8}]},
    options:{indexAxis:'horizontal',responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gridColor},ticks:{color:tickColor}},y:{grid:{color:gridColor},ticks:{color:tickColor}}}}
  });

  // CA par chauffeur (nouveau graphique)
  if(chartCAParChauff)chartCAParChauff.destroy();
  const caChData = ch.length ? ch.map(c=>({nom:c.nom, ca:livsFiltrees.filter(l=>l.chaufId===c.id).reduce((s,l)=>s+(l.prix||0),0)})).sort((a,b)=>b.ca-a.ca) : [{nom:'Aucun',ca:0}];
  const ctxCA = document.getElementById('chartCAParChauffeur');
  if (ctxCA) {
    chartCAParChauff=new Chart(ctxCA,{
      type:'doughnut',
      data:{labels:caChData.map(c=>c.nom),datasets:[{data:caChData.map(c=>c.ca),backgroundColor:['rgba(79,142,247,0.7)','rgba(245,166,35,0.7)','rgba(46,204,113,0.7)','rgba(155,89,182,0.7)','rgba(231,76,60,0.7)','rgba(52,152,219,0.7)','rgba(230,126,34,0.7)'],borderColor:isLight?'#fff':'#1a1d27',borderWidth:3}]},
      options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{labels:{color:legendColor}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${euros(ctx.parsed||0)}`}}}}
    });
  }
}

/* ===== PRÃ‰VISIONS ===== */
let chartPrev=null;
function calculerPrevision() {
  const livraisons = charger('livraisons');
  const carburant  = charger('carburant');
  const charges    = charger('charges');

  // â”€â”€ Calcul basÃ© sur les 3 derniers mois rÃ©els â”€â”€
  const moisReels = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toISOString().slice(0,7);
    const livsM   = livraisons.filter(l=>(l.date||'').startsWith(moisStr));
    const caM     = livsM.reduce((s,l)=>s+(l.prix||0),0);
    const carbM   = carburant.filter(p=>(p.date||'').startsWith(moisStr)).reduce((s,p)=>s+(p.total||0),0);
    const chargM  = charges.filter(c=>(c.date||'').startsWith(moisStr)).reduce((s,c)=>s+(c.montant||0),0);
    moisReels.push({ mois:moisStr, ca:caM, depenses:carbM+chargM, livraisons:livsM.length });
  }

  const nbMoisDonnees = moisReels.filter(m=>m.ca>0||m.livraisons>0).length;
  const avertissement = nbMoisDonnees < 3
    ? `âš ï¸ PrÃ©vision basÃ©e sur ${nbMoisDonnees} mois de donnÃ©es â€” rÃ©sultats peu fiables en dessous de 3 mois.`
    : `âœ… PrÃ©vision basÃ©e sur ${nbMoisDonnees} mois de donnÃ©es rÃ©elles.`;

  // Moyennes rÃ©elles
  const moyCA    = nbMoisDonnees > 0 ? moisReels.slice(0,nbMoisDonnees).reduce((s,m)=>s+m.ca,0) / nbMoisDonnees : 0;
  const moyDep   = nbMoisDonnees > 0 ? moisReels.slice(0,nbMoisDonnees).reduce((s,m)=>s+m.depenses,0) / nbMoisDonnees : 0;
  const moyLivs  = nbMoisDonnees > 0 ? moisReels.slice(0,nbMoisDonnees).reduce((s,m)=>s+m.livraisons,0) / nbMoisDonnees : 0;

  // Tendance (mois 1 vs mois 3)
  const tendanceCA  = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA      = moyCA * (1 + tendanceCA/100 * 0.5); // Lissage tendance Ã  50%
  const prevDep     = moyDep;
  const prevBen     = prevCA - prevDep;
  const prevMarge   = prevCA > 0 ? (prevBen/prevCA*100) : 0;

  // Afficher les prÃ©visions
  const elCA  = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elAvt = document.getElementById('prev-avertissement');
  const elTend= document.getElementById('prev-tendance');

  if (elCA)   elCA.textContent   = euros(prevCA);
  if (elDep)  elDep.textContent  = euros(prevDep);
  if (elBen)  elBen.textContent  = euros(prevBen);
  if (elMrg)  elMrg.textContent  = prevMarge.toFixed(1)+' %';
  if (elLiv)  elLiv.textContent  = Math.round(moyLivs)+' liv.';
  if (elAvt)  { elAvt.textContent = avertissement; elAvt.style.color = nbMoisDonnees<3?'var(--accent)':'var(--green)'; }
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = `Tendance : ${signe}${tendanceCA.toFixed(1)}% vs mois prÃ©cÃ©dent`;
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // Historique 6 derniers mois pour le graphique
  const labels = [], dataCA = [], dataBen = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const mStr = d.toISOString().slice(0,7);
    const caM  = livraisons.filter(l=>(l.date||'').startsWith(mStr)).reduce((s,l)=>s+(l.prix||0),0);
    const depM = carburant.filter(p=>(p.date||'').startsWith(mStr)).reduce((s,p)=>s+(p.total||0),0)
               + charges.filter(c=>(c.date||'').startsWith(mStr)).reduce((s,c)=>s+(c.montant||0),0);
    labels.push(d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}));
    dataCA.push(caM);
    dataBen.push(caM - depM);
  }
  // Ajouter prÃ©vision mois prochain
  const dNext = new Date(); dNext.setMonth(dNext.getMonth()+1);
  labels.push(dNext.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})+' *');
  dataCA.push(Math.round(prevCA));
  dataBen.push(Math.round(prevBen));

  if (chartPrev) chartPrev.destroy();
  const ctx = document.getElementById('chartPrevision');
  if (!ctx) return;
  chartPrev = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'CA rÃ©el (â‚¬)', data:dataCA.slice(0,-1).concat([null]),
          backgroundColor:'rgba(79,142,247,0.4)', borderColor:'rgba(79,142,247,0.9)', borderWidth:2, borderRadius:6 },
        { label:'CA prÃ©vu (â‚¬)', data:Array(6).fill(null).concat([dataCA[6]]),
          backgroundColor:'rgba(245,166,35,0.3)', borderColor:'rgba(245,166,35,0.9)', borderWidth:2, borderRadius:6, borderDash:[5,5] },
        { label:'BÃ©nÃ©fice net (â‚¬)', data:dataBen.slice(0,-1).concat([null]),
          type:'line', borderColor:'#2ecc71', backgroundColor:'rgba(46,204,113,0.1)', fill:true, tension:0.4, pointRadius:4 },
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#e8eaf0' } },
        tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${euros(ctx.parsed.y||0)}` } } },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299'} },
        y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299', callback:v=>euros(v)} }
      }
    }
  });
}

/* ===== GESTION SALARIÃ‰S ===== */
let resetMdpTargetId=null, provisionAccessTargetId=null, editSalarieId=null;

function toggleFormulaireNewSalarie() {
  const el=document.getElementById('form-nouveau-salarie');
  if (el.style.display==='none') {
    el.style.display='block';
    mettreAJourEmailTechniqueSalarie('new');
    // Mettre Ã  jour le select vÃ©hicule dans le formulaire
    const sv=document.getElementById('nsal-vehicule');
    if (sv) {
      const vehicules=charger('vehicules');
      sv.innerHTML='<option value="">-- Aucun pour l\'instant --</option>';
      vehicules.filter(v=>!v.salId).forEach(v=>{ sv.innerHTML+=`<option value="${v.id}">${v.immat} â€” ${v.modele}</option>`; });
    }
  } else { el.style.display='none'; }
}

function genererEmailTechniqueSalarie(numero) {
  const base = (numero || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
  return base ? `${base}@mca-logistics.fr` : '';
}

function mettreAJourEmailTechniqueSalarie(mode) {
  const isEdit = mode === 'edit';
  const numeroEl = document.getElementById(isEdit ? 'edit-sal-numero' : 'nsal-numero');
  const labelEl = document.getElementById(isEdit ? 'edit-sal-email-technique' : 'nsal-email-technique');
  if (!numeroEl || !labelEl) return;
  const email = genererEmailTechniqueSalarie(numeroEl.value);
  labelEl.textContent = email || 'â€”';
}

function getSupabaseClientSafe() {
  return window.DelivProSupabase && window.DelivProSupabase.getClient
    ? window.DelivProSupabase.getClient()
    : null;
}

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
    email: salarie.email || null,
    actif: salarie.actif !== false,
    updated_at: new Date().toISOString()
  };
  if (salarie.supabaseId) payload.id = salarie.supabaseId;
  return payload;
}

async function synchroniserSalarieVersSupabase(salarie) {
  const client = getSupabaseClientSafe();
  if (!client || !salarie || !salarie.numero) return { ok: false, skipped: true };

  const payload = construirePayloadSupabaseSalarie(salarie);
  const previousNumero = salarie.previousNumero || salarie._previousNumero || null;
  let query = null;

  if (salarie.supabaseId) {
    query = client
      .from('salaries')
      .update(payload)
      .eq('id', salarie.supabaseId);
  } else if (previousNumero && previousNumero !== salarie.numero) {
    query = client
      .from('salaries')
      .update(payload)
      .eq('numero', previousNumero);
  } else {
    query = client
      .from('salaries')
      .upsert(payload, { onConflict: 'numero' });
  }

  const { data, error } = await query
    .select('id, profile_id, numero, email, actif, nom, prenom, poste, permis, assurance, telephone')
    .single();

  if (error) return { ok: false, error: error };

  return {
    ok: true,
    record: data
  };
}

async function supprimerSalarieDansSupabase(salarie) {
  const client = getSupabaseClientSafe();
  if (!client || !salarie) return { ok: false, skipped: true };

  let query = client.from('salaries').delete();
  if (salarie.supabaseId) query = query.eq('id', salarie.supabaseId);
  else if (salarie.numero) query = query.eq('numero', salarie.numero);
  else return { ok: false, skipped: true };

  const { error } = await query;
  if (error) return { ok: false, error: error };
  return { ok: true };
}

function hydraterSalarieLocalDepuisSupabase(salarie, record) {
  if (!salarie || !record) return salarie;
  salarie.supabaseId = record.id || salarie.supabaseId || '';
  salarie.profileId = record.profile_id || salarie.profileId || '';
  salarie.email = record.email || salarie.email || '';
  salarie.actif = record.actif !== false;
  return salarie;
}

function convertirSalarieSupabaseVersLocal(record, existant) {
  if (!record) return existant || null;
  const nomFamille = record.nom || existant?.nomFamille || '';
  const prenom = record.prenom || existant?.prenom || '';
  const nomComplet = [prenom, nomFamille].filter(Boolean).join(' ').trim() || existant?.nom || nomFamille || '';
  return {
    ...(existant || {}),
    id: existant?.id || record.id,
    supabaseId: record.id || existant?.supabaseId || '',
    profileId: record.profile_id || existant?.profileId || '',
    nom: nomComplet,
    nomFamille: nomFamille,
    prenom: prenom,
    numero: record.numero || existant?.numero || '',
    email: record.email || existant?.email || '',
    tel: record.telephone || existant?.tel || '',
    poste: record.poste || existant?.poste || '',
    datePermis: record.permis || existant?.datePermis || '',
    dateAssurance: record.assurance || existant?.dateAssurance || '',
    actif: record.actif !== false,
    creeLe: existant?.creeLe || new Date().toISOString()
  };
}

async function importerSalariesDepuisSupabase() {
  const client = getSupabaseClientSafe();
  if (!client) return { ok: false, skipped: true };

  const { data, error } = await client
    .from('salaries')
    .select('id, profile_id, numero, email, actif, nom, prenom, poste, permis, assurance, telephone')
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error };
  if (!Array.isArray(data)) return { ok: true, updated: 0 };

  const salaries = charger('salaries');
  const indexParSupabaseId = new Map();
  const indexParNumero = new Map();

  salaries.forEach(function(item, index) {
    if (item?.supabaseId) indexParSupabaseId.set(item.supabaseId, index);
    if (item?.numero) indexParNumero.set(String(item.numero).toUpperCase(), index);
  });

  data.forEach(function(record) {
    const numeroKey = record?.numero ? String(record.numero).toUpperCase() : '';
    const index = indexParSupabaseId.has(record.id)
      ? indexParSupabaseId.get(record.id)
      : (numeroKey && indexParNumero.has(numeroKey) ? indexParNumero.get(numeroKey) : -1);

    if (index > -1) {
      salaries[index] = convertirSalarieSupabaseVersLocal(record, salaries[index]);
      indexParSupabaseId.set(record.id, index);
      if (numeroKey) indexParNumero.set(numeroKey, index);
      return;
    }

    const nouveau = convertirSalarieSupabaseVersLocal(record, null);
    salaries.push(nouveau);
    const nouvelIndex = salaries.length - 1;
    indexParSupabaseId.set(record.id, nouvelIndex);
    if (numeroKey) indexParNumero.set(numeroKey, nouvelIndex);
  });

  sauvegarder('salaries', salaries);
  return { ok: true, updated: data.length };
}

function notifierSynchroSalarie(resultat, actionLabel) {
  if (!resultat || resultat.skipped) return;
  if (resultat.ok) {
    afficherToast(`â˜ï¸ ${actionLabel} synchronisÃ© avec Supabase`, 'success');
    return;
  }
  const message = resultat.error?.message || 'Synchronisation Supabase indisponible';
  afficherToast(`âš ï¸ ${actionLabel} enregistrÃ© localement uniquement (${message})`, 'error');
}

function ouvrirProvisionAccesSalarie(id, nom) {
  provisionAccessTargetId = id;
  const salarie = charger('salaries').find(function(item) { return item.id === id; });
  document.getElementById('provision-access-nom').textContent = nom || salarie?.nom || 'SalariÃ©';
  document.getElementById('provision-access-email').textContent = salarie?.email || 'â€”';
  document.getElementById('provision-access-password').value = '';
  document.getElementById('modal-provision-access').classList.add('open');
}

async function confirmerProvisionAccesSalarie() {
  const salarie = charger('salaries').find(function(item) { return item.id === provisionAccessTargetId; });
  const password = (document.getElementById('provision-access-password')?.value || '').trim();
  if (!salarie) { afficherToast('âš ï¸ SalariÃ© introuvable', 'error'); return; }
  if (!password) { afficherToast('âš ï¸ Mot de passe initial obligatoire', 'error'); return; }
  if (!window.DelivProAdminSupabase || !window.DelivProAdminSupabase.provisionSalarieAccess) {
    afficherToast('âš ï¸ Fonction admin Supabase indisponible', 'error');
    return;
  }

  const result = await window.DelivProAdminSupabase.provisionSalarieAccess({
    salarieId: salarie.supabaseId || null,
    numero: salarie.numero,
    password: password
  });

  if (!result.ok) {
    const message = result.error?.message || result.reason || 'Provisionnement impossible';
    afficherToast(`âš ï¸ ${message}`, 'error');
    return;
  }

  if (result.data?.profileId) {
    const salaries = charger('salaries');
    const idx = salaries.findIndex(function(item) { return item.id === salarie.id; });
    if (idx > -1) {
      salaries[idx].profileId = result.data.profileId;
      salaries[idx].email = result.data.email || salaries[idx].email;
      sauvegarder('salaries', salaries);
    }
  }

  closeModal('modal-provision-access');
  provisionAccessTargetId = null;
  afficherSalaries();
  afficherToast('âœ… AccÃ¨s Supabase salariÃ© crÃ©Ã© / mis Ã  jour');
}

async function creerSalarie() {
  const nom    = document.getElementById('nsal-nom').value.trim();
  const prenom = document.getElementById('nsal-prenom')?.value.trim() || '';
  const nomComplet = prenom ? `${prenom} ${nom}` : nom;
  const numero = document.getElementById('nsal-numero').value.trim().toUpperCase();
  const mdp    = document.getElementById('nsal-mdp').value;
  const tel    = document.getElementById('nsal-tel').value.trim();
  const poste  = document.getElementById('nsal-poste')?.value.trim() || '';
  const datePermis    = document.getElementById('nsal-date-permis')?.value || '';
  const dateAssurance = document.getElementById('nsal-date-assurance')?.value || '';
  const vehId  = document.getElementById('nsal-vehicule')?.value || '';
  const emailTechnique = genererEmailTechniqueSalarie(numero);

  if (!nom||!numero||!mdp) { afficherToast('âš ï¸ Nom, numÃ©ro et mot de passe obligatoires', 'error'); return; }
  const salaries=charger('salaries');
  if (salaries.find(s=>s.numero===numero)) { afficherToast('âš ï¸ Ce numÃ©ro existe dÃ©jÃ ', 'error'); return; }

  const salarie={ id:genId(), nom:nomComplet, nomFamille:nom, prenom, numero, email:emailTechnique, tel, poste, datePermis, dateAssurance, mdpHash:btoa(mdp), actif:true, creeLe:new Date().toISOString() };
  salaries.push(salarie);
  sauvegarder('salaries', salaries);

  // Ajouter comme chauffeur
  const chauffeurs=charger('chauffeurs');
  if (!chauffeurs.find(c=>c.id===salarie.id)) {
    chauffeurs.push({ id:salarie.id, nom:nomComplet, tel, statut:'disponible', creeLe:salarie.creeLe });
    sauvegarder('chauffeurs', chauffeurs);
  }

  // Affecter le vÃ©hicule si sÃ©lectionnÃ©
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
  let provisionResult = null;
  if (window.DelivProAdminSupabase && window.DelivProAdminSupabase.provisionSalarieAccess) {
    provisionResult = await window.DelivProAdminSupabase.provisionSalarieAccess({
      salarieId: salarie.supabaseId || null,
      numero: salarie.numero,
      password: mdp
    });
    if (provisionResult?.ok && provisionResult.data) {
      salarie.profileId = provisionResult.data.profileId || salarie.profileId || '';
      salarie.email = provisionResult.data.email || salarie.email || '';
      sauvegarder('salaries', salaries);
    }
  }

  ['nsal-nom','nsal-prenom','nsal-numero','nsal-mdp','nsal-tel'].forEach(id=>document.getElementById(id).value='');
  if (document.getElementById('nsal-poste')) document.getElementById('nsal-poste').value='';
  if (document.getElementById('nsal-vehicule')) document.getElementById('nsal-vehicule').value='';
  mettreAJourEmailTechniqueSalarie('new');
  document.getElementById('form-nouveau-salarie').style.display='none';
  afficherSalaries();
  rafraichirDependancesSalaries();
  if (provisionResult?.ok) afficherToast(`âœ… Compte crÃ©Ã© pour ${nomComplet} et accÃ¨s Supabase activÃ©`);
  else if (provisionResult && !provisionResult.ok) afficherToast(`âš ï¸ Compte crÃ©Ã© pour ${nomComplet}, mais l'accÃ¨s Supabase n'a pas pu Ãªtre activÃ© (${provisionResult.error?.message || provisionResult.reason || 'erreur inconnue'})`, 'error');
  else afficherToast(`âœ… Compte crÃ©Ã© pour ${nomComplet}`);
  notifierSynchroSalarie(syncResult, 'SalariÃ©');
}

function afficherSalaries() {
  const salaries=charger('salaries'), vehicules=charger('vehicules');
  const tb=document.getElementById('tb-salaries');
  if (!salaries.length) { tb.innerHTML=emptyState('ðŸ‘¥','Aucun salariÃ©','CrÃ©ez votre premier compte salariÃ© pour commencer.','+ Nouveau salariÃ©',"toggleFormulaireNewSalarie()"); return; }
  // Mettre Ã  jour le select poste
  majSelectsPostes();
  tb.innerHTML=salaries.map(s=>{
    const veh=vehicules.find(v=>v.salId===s.id);
    const vehLabel=veh
      ? `<span style="color:var(--accent-2);font-size:0.82rem">ðŸš ${veh.immat}</span>`
      : `<span style="color:var(--text-muted);font-size:0.82rem">Non affectÃ©</span>`;
    const badge=s.actif
      ? '<span class="badge badge-dispo">âœ… Actif</span>'
      : '<span class="badge badge-inactif">â¸ï¸ Inactif</span>';
    const noteInterne = charger_note_interne(s.id);
    return `<tr>
      <td><strong>${s.nom}</strong>${noteInterne?'<span class="note-dot" title="Note interne"></span>':''}${s.poste?`<br><span style="color:var(--text-muted);font-size:0.78rem">${s.poste}</span>`:''}</td>
      <td><code style="background:var(--bg-dark);padding:2px 8px;border-radius:4px;font-size:0.85rem">${s.numero}</code></td>
      <td>${s.tel||'â€”'}</td><td>${vehLabel}</td><td>${badge}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-icon" onclick="ouvrirEditSalarie('${s.id}')" title="Modifier">âœï¸</button>
        <button class="btn-icon" onclick="ouvrirProvisionAccesSalarie('${s.id}','${s.nom}')" title="CrÃ©er accÃ¨s Supabase">â˜ï¸</button>
        <button class="btn-icon" onclick="ouvrirResetMdp('${s.id}','${s.nom}')" title="MDP">ðŸ”‘</button>
        <button class="btn-icon" onclick="genererFicheTournee('${s.id}')" title="Fiche tournÃ©e">ðŸ“‹</button>
        <button class="btn-icon" onclick="ouvrirNoteInterne('${s.id}','${s.nom}')" title="Note interne" style="${chargerNoteInterne(s.id)?'border-color:var(--accent);color:var(--accent)':''}">ðŸ“${chargerNoteInterne(s.id)?'<span style="width:6px;height:6px;background:var(--accent);border-radius:50%;display:inline-block;margin-left:2px;vertical-align:middle"></span>':''}</button>
        <button class="btn-icon" onclick="toggleActifSalarie('${s.id}')">${s.actif?'â¸ï¸':'â–¶ï¸'}</button>
        <button class="btn-icon danger" onclick="supprimerSalarie('${s.id}')">ðŸ—‘ï¸</button>
      </td></tr>`;
  }).join('');
}

async function ouvrirEditSalarie(id) {
  window._editSalarieId = id;
  editSalarieId = id;
  const sal=charger('salaries').find(s=>s.id===id); if(!sal) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('salarie', id, sal.nom || 'SalariÃ©');
  if (!lockResult.ok) {
    afficherToast(`âš ï¸ Fiche salariÃ© en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    editSalarieId = null;
    window._editSalarieId = null;
    return;
  }
  document.getElementById('edit-sal-nom').value    = sal.nomFamille || sal.nom;
  if (document.getElementById('edit-sal-prenom')) document.getElementById('edit-sal-prenom').value = sal.prenom || '';
  document.getElementById('edit-sal-numero').value = sal.numero;
  mettreAJourEmailTechniqueSalarie('edit');
  document.getElementById('edit-sal-tel').value    = sal.tel||'';
  if (document.getElementById('edit-sal-poste')) document.getElementById('edit-sal-poste').value = sal.poste||'';
  if (document.getElementById('edit-sal-date-permis')) document.getElementById('edit-sal-date-permis').value = sal.datePermis||'';
  if (document.getElementById('edit-sal-date-assurance')) document.getElementById('edit-sal-date-assurance').value = sal.dateAssurance||'';

  // Charger select vÃ©hicule
  const vehicules=charger('vehicules');
  const sve=document.getElementById('edit-sal-vehicule');
  if (sve) {
    const vehAct=vehicules.find(v=>v.salId===id);
    sve.innerHTML='<option value="">-- Retirer l\'affectation --</option>';
    vehicules.forEach(v=>{
      const pris = v.salId && v.salId !== id;
      if (!pris) sve.innerHTML+=`<option value="${v.id}" ${v.salId===id?'selected':''}>${v.immat} â€” ${v.modele}</option>`;
    });
  }
  document.getElementById('modal-edit-salarie').classList.add('open');
  afficherAlerteVerrouModal('modal-edit-salarie', '');
}

async function confirmerEditSalarie() {
  surveillerConflitsEditionActifs();
  const lockState = verifierVerrouEdition('salarie', editSalarieId || window._editSalarieId);
  if (!lockState.ok) {
    afficherToast(`âš ï¸ Cette fiche salariÃ© est verrouillÃ©e par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
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
  const emailTechnique = genererEmailTechniqueSalarie(numero);

  if (!nomFamille||!numero) { afficherToast('âš ï¸ Nom et numÃ©ro obligatoires', 'error'); return; }
  const salaries=charger('salaries');
  if (salaries.find(s=>s.numero===numero&&s.id!==editSalarieId)) { afficherToast('âš ï¸ NumÃ©ro dÃ©jÃ  utilisÃ©', 'error'); return; }
  const idx=salaries.findIndex(s=>s.id===editSalarieId);
  if (idx>-1) {
    const ancienNumero = salaries[idx].numero || null;
    salaries[idx].nom=nomComplet; salaries[idx].nomFamille=nomFamille; salaries[idx].prenom=prenom;
    salaries[idx].numero=numero; salaries[idx].email=emailTechnique; salaries[idx].tel=tel; salaries[idx].poste=poste;
    salaries[idx].datePermis=datePermis; salaries[idx].dateAssurance=dateAssurance;
    salaries[idx].previousNumero = ancienNumero;
    sauvegarder('salaries', salaries);
    // Propager dans chauffeurs
    const ch=charger('chauffeurs'), ci=ch.findIndex(c=>c.id===editSalarieId);
    if(ci>-1){ch[ci].nom=nomComplet;ch[ci].tel=tel;sauvegarder('chauffeurs',ch);}
    // Mettre Ã  jour affectation vÃ©hicule
    const vehicules=charger('vehicules');
    // Retirer l'ancienne affectation de ce salariÃ©
    vehicules.forEach(v=>{ if(v.salId===editSalarieId){v.salId=null;v.salNom=null;} });
    // Attribuer le nouveau vÃ©hicule si sÃ©lectionnÃ©
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
    notifierSynchroSalarie(syncResult, 'Modification salariÃ©');
  }
  closeModal('modal-edit-salarie');
  editSalarieId=null; window._editSalarieId=null;
  afficherSalaries();
  rafraichirDependancesSalaries();
  afficherToast('âœ… Fiche mise Ã  jour');
}

function ouvrirResetMdp(id, nom) {
  resetMdpTargetId=id;
  document.getElementById('reset-mdp-nom').textContent=nom;
  document.getElementById('reset-mdp-val').value='';
  document.getElementById('modal-reset-mdp').classList.add('open');
}

async function confirmerResetMdp() {
  const nouveau=document.getElementById('reset-mdp-val').value;
  if(!nouveau){afficherToast('âš ï¸ Mot de passe vide','error');return;}
  const salaries=charger('salaries'),idx=salaries.findIndex(s=>s.id===resetMdpTargetId);
  let syncResult = null;
  if(idx>-1){
    salaries[idx].mdpHash=btoa(nouveau);
    sauvegarder('salaries',salaries);
    if (window.DelivProAdminSupabase && window.DelivProAdminSupabase.provisionSalarieAccess) {
      syncResult = await window.DelivProAdminSupabase.provisionSalarieAccess({
        salarieId: salaries[idx].supabaseId || null,
        numero: salaries[idx].numero || '',
        password: nouveau
      });
      if (syncResult?.ok && syncResult.data) {
        salaries[idx].profileId = syncResult.data.profileId || salaries[idx].profileId || '';
        salaries[idx].email = syncResult.data.email || salaries[idx].email || '';
        sauvegarder('salaries', salaries);
      }
    }
    if (syncResult?.ok) afficherToast('âœ… Mot de passe salariÃ© mis Ã  jour et synchronisÃ© avec Supabase');
    else if (syncResult && !syncResult.ok) afficherToast(`âš ï¸ Mot de passe local mis Ã  jour, mais pas Supabase (${syncResult.error?.message || syncResult.reason || 'erreur inconnue'})`, 'error');
    else afficherToast('âœ… Mot de passe mis Ã  jour');
  }
  closeModal('modal-reset-mdp'); resetMdpTargetId=null;
}

function toggleActifSalarie(id) {
  const salaries=charger('salaries'),idx=salaries.findIndex(s=>s.id===id);
  if(idx>-1){
    salaries[idx].actif=!salaries[idx].actif;
    sauvegarder('salaries',salaries);
    afficherSalaries();
    rafraichirDependancesSalaries();
    afficherToast(salaries[idx].actif?'âœ… ActivÃ©':'â¸ï¸ DÃ©sactivÃ©');
    synchroniserSalarieVersSupabase(salaries[idx]).then(function(resultat){
      if (resultat.ok && resultat.record) {
        hydraterSalarieLocalDepuisSupabase(salaries[idx], resultat.record);
        sauvegarder('salaries', salaries);
      }
      notifierSynchroSalarie(resultat, 'Statut salariÃ©');
    });
  }
}

async function supprimerSalarie(id) {
  const sal = charger('salaries').find(s => s.id === id);
  const _ok1 = await confirmDialog(`Supprimer ${sal?.nom || 'ce salariÃ©'} ? Toutes ses donnÃ©es seront effacÃ©es.`, {titre:'Supprimer le salariÃ©',icone:'ðŸ—‘ï¸',btnLabel:'Supprimer'});
  if (!_ok1) return;

  const syncResult = await supprimerSalarieDansSupabase(sal);

  // 1. Supprimer de la liste salariÃ©s
  sauvegarder('salaries', charger('salaries').filter(s => s.id !== id));

  // 2. Supprimer de la liste chauffeurs
  sauvegarder('chauffeurs', charger('chauffeurs').filter(c => c.id !== id));

  // 3. Retirer l'affectation vÃ©hicule
  const vehicules = charger('vehicules');
  vehicules.forEach(v => { if (v.salId === id) { v.salId = null; v.salNom = null; } });
  sauvegarder('vehicules', vehicules);

  // 4. Supprimer ses donnÃ©es personnelles (km, carburant perso, inspections, messages, checklist, planning, notifs)
  const keysToRemove = [
    `km_sal_${id}`, `carb_sal_${id}`, `km_report_${id}`,
    `messages_${id}`, `notifs_sal_${id}`
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // 5. Supprimer ses checklists (toutes les dates)
  Object.keys(localStorage).filter(k => k.startsWith(`checklist_${id}_`)).forEach(k => localStorage.removeItem(k));

  // 6. Supprimer ses inspections du global
  const inspections = JSON.parse(localStorage.getItem('inspections') || '[]').filter(i => i.salId !== id);
  localStorage.setItem('inspections', JSON.stringify(inspections));

  // 7. Supprimer son planning
  const plannings = JSON.parse(localStorage.getItem('plannings') || '[]').filter(p => p.salId !== id);
  localStorage.setItem('plannings', JSON.stringify(plannings));

  // 8. Supprimer ses pleins du global carburant (garder les pleins admin)
  const carburant = charger('carburant').filter(p => !(p.salId === id && p.source === 'salarie'));
  sauvegarder('carburant', carburant);

  // 9. Anonymiser ses livraisons (garder l'historique mais retirer le lien)
  const livraisons = charger('livraisons');
  livraisons.forEach(l => { if (l.chaufId === id) { l.chaufId = null; l.chaufNom = (sal?.nom||'SalariÃ© supprimÃ©') + ' (archivÃ©)'; } });
  sauvegarder('livraisons', livraisons);

  afficherSalaries();
  rafraichirDependancesSalaries();
  afficherToast(`ðŸ—‘ï¸ ${sal?.nom || 'SalariÃ©'} et toutes ses donnÃ©es supprimÃ©s`);
  notifierSynchroSalarie(syncResult, 'Suppression salariÃ©');
}

/* ===== UTILITAIRES AFFICHAGE ===== */
function badgeStatut(s) {
  return {
    'en-attente': '<span class="badge badge-attente">â³ En attente</span>',
    'en-cours':   '<span class="badge badge-cours">ðŸš En cours</span>',
    'livre':      '<span class="badge badge-livre">âœ… LivrÃ©</span>'
  }[s] || s;
}
function badgeChauffeur(s) {
  return { 'disponible':'<span class="badge badge-dispo">âœ… Disponible</span>', 'en-livraison':'<span class="badge badge-actif">ðŸš En livraison</span>', 'inactif':'<span class="badge badge-inactif">â¸ï¸ Inactif</span>' }[s] || s;
}
function afficherToast(message, type='success') {
  const t=document.getElementById('toast');
  t.textContent=message; t.className='toast show'+(type==='error'?' error':'');
  setTimeout(()=>{t.className='toast';},3000);
}

/* ===== INSPECTIONS ===== */
function afficherInspections() {
  let inspections = JSON.parse(localStorage.getItem('inspections') || '[]');
  const salaries  = charger('salaries');
  const container = document.getElementById('inspections-container');
  const filtreSal = document.getElementById('filtre-insp-sal')?.value || '';
  const filtreDate= document.getElementById('filtre-insp-date')?.value || '';

  // Remplir le datalist pour la recherche
  const datalist = document.getElementById('datalist-insp-sal');
  if (datalist && datalist.options.length === 0) {
    salaries.forEach(s => { const opt = document.createElement('option'); opt.value = s.nom; opt.dataset.id = s.id; datalist.appendChild(opt); });
  }

  if (filtreSal)  inspections = inspections.filter(i => i.salId === filtreSal);
  if (filtreDate) inspections = inspections.filter(i => i.date === filtreDate);
  inspections.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  if (!inspections.length) {
    container.innerHTML = '<div class="card"><div class="modal-body" style="text-align:center;color:var(--text-muted);padding:32px">Aucune inspection trouvÃ©e</div></div>';
    return;
  }

  container.innerHTML = inspections.map(insp => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span>ðŸ‘¤ <strong>${insp.salNom}</strong> â€” ${insp.vehImmat}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:.82rem;color:var(--text-muted)">ðŸ—“ï¸ ${insp.date}${insp.km ? ' Â· ' + parseInt(insp.km).toLocaleString('fr-FR') + ' km' : ''}</span>
          <button class="btn-icon danger" onclick="supprimerInspectionAdmin('${insp.id}')" title="Supprimer">ðŸ—‘ï¸</button>
        </div>
      </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
          ${insp.photos.map((p, i) => `
            <div style="border-radius:8px;overflow:hidden;aspect-ratio:4/3;cursor:pointer" onclick="voirPhotoAdmin('${insp.id}',${i})">
              <img src="${p}" style="width:100%;height:100%;object-fit:cover" />
            </div>`).join('')}
        </div>
      </div>
    </div>`).join('');
}

let _adminPhotos = [];

function filtrerInspParSalarieInput() {
  const input = document.getElementById('filtre-insp-sal-input')?.value.trim() || '';
  const hidden = document.getElementById('filtre-insp-sal');
  if (!input) { if (hidden) hidden.value = ''; afficherInspections(); return; }
  const sal = charger('salaries').find(s => s.nom.toLowerCase() === input.toLowerCase());
  if (hidden) hidden.value = sal ? sal.id : '';
  afficherInspections();
}
async function supprimerInspectionAdmin(id) {
  const _ok8 = await confirmDialog('Supprimer cette inspection ?', {titre:'Supprimer',icone:'ðŸš—',btnLabel:'Supprimer'});
  if (!_ok8) return;
  const toutes = JSON.parse(localStorage.getItem('inspections') || '[]').filter(i => i.id !== id);
  localStorage.setItem('inspections', JSON.stringify(toutes));
  afficherInspections();
  afficherToast('ðŸ—‘ï¸ Inspection supprimÃ©e');
}

/* ===== Ã‰DITION LIVRAISON ADMIN ===== */
let _editLivId = null;
function confirmerEditLivraison() {
  surveillerConflitsEditionActifs();
  const id     = document.getElementById('edit-liv-id').value;
  const lockState = verifierVerrouEdition('livraison', id);
  if (!lockState.ok) {
    afficherToast(`âš ï¸ Cette livraison est verrouillÃ©e par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const client = document.getElementById('edit-liv-client').value.trim();
  if (!client) { afficherToast('âš ï¸ Client obligatoire', 'error'); return; }
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
  const affectation = synchroniserAffectationLivraison(
    document.getElementById('edit-liv-chauffeur')?.value || '',
    document.getElementById('edit-liv-vehicule')?.value || ''
  );
  livraisons[idx].chaufId = affectation.chaufId || null;
  livraisons[idx].chaufNom = affectation.chaufNom;
  livraisons[idx].vehId = affectation.vehId || null;
  livraisons[idx].vehNom = affectation.vehNom;
  livraisons[idx].date     = document.getElementById('edit-liv-date').value;
  livraisons[idx].statut   = document.getElementById('edit-liv-statut').value;
  livraisons[idx].notes    = document.getElementById('edit-liv-notes').value.trim();
  livraisons[idx].profit   = livraisons[idx].prix - livraisons[idx].distance * config.coutKmEstime;

  // Logger les modifications
  const champs = { client:'Client', prix:'Prix', statut:'Statut', distance:'Distance', depart:'Zone gÃ©ographique' };
  Object.entries(champs).forEach(([k,label]) => {
    if (String(ancien[k]||'') !== String(livraisons[idx][k]||'')) {
      logModifLivraison(id, label, ancien[k], livraisons[idx][k]);
    }
  });

  sauvegarder('livraisons', livraisons);
  if (ancien.prix !== livraisons[idx].prix) {
    ajouterAlerte('livraison_modif',
      `Livraison modifiÃ©e â€” ${client} : ${ancien.prix ? euros(ancien.prix) : 'â€”'} â†’ ${euros(livraisons[idx].prix)}`,
      { client });
    afficherBadgeAlertes();
  }
  closeModal('modal-edit-livraison');
  afficherLivraisons();
  afficherToast('âœ… Livraison mise Ã  jour');
}

/* ===== Ã‰DITION CARBURANT ADMIN ===== */
let _editCarbId = null;
function ouvrirEditCarburantAdmin(id) {
  const p = charger('carburant').find(x => x.id === id);
  if (!p) return;
  _editCarbId = id;
  document.getElementById('edit-carb-id').value     = id;
  document.getElementById('edit-carb-litres').value = p.litres;
  document.getElementById('edit-carb-prix').value   = p.prixLitre;
  document.getElementById('edit-carb-date').value   = p.date;
  document.getElementById('modal-edit-carburant').classList.add('open');
}

function confirmerEditCarburantAdmin() {
  const id        = document.getElementById('edit-carb-id').value;
  const litres    = parseFloat(document.getElementById('edit-carb-litres').value);
  const prixLitre = parseFloat(document.getElementById('edit-carb-prix').value);
  const date      = document.getElementById('edit-carb-date').value;
  if (!litres || !prixLitre) { afficherToast('âš ï¸ Litres et prix obligatoires', 'error'); return; }
  const total  = litres * prixLitre;
  const pleins = charger('carburant');
  const idx    = pleins.findIndex(p => p.id === id);
  if (idx === -1) return;
  const salId = pleins[idx].salId;
  pleins[idx].litres = litres; pleins[idx].prixLitre = prixLitre;
  pleins[idx].total  = total;  pleins[idx].date = date;
  pleins[idx].modifie = true;  pleins[idx].modifieLe = new Date().toISOString();
  sauvegarder('carburant', pleins);
  if (salId) {
    const cle  = 'carb_sal_' + salId;
    const perso = JSON.parse(localStorage.getItem(cle) || '[]');
    const pi    = perso.findIndex(p => p.id === id);
    if (pi > -1) {
      perso[pi].litres = litres; perso[pi].prixLitre = prixLitre;
      perso[pi].total  = total;  perso[pi].date = date;
      perso[pi].modifie = true;
      localStorage.setItem(cle, JSON.stringify(perso));
    }
  }
  closeModal('modal-edit-carburant');
  afficherCarburant();
  afficherToast('âœ… Plein mis Ã  jour');
}

function voirPhotoAdmin(inspId, idx) {
  const inspections = JSON.parse(localStorage.getItem('inspections') || '[]');
  const insp = inspections.find(i => i.id === inspId);
  if (!insp) return;
  _adminPhotos = insp.photos;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;flex-direction:column;gap:12px';
  overlay.innerHTML = `
    <img src="${_adminPhotos[idx]}" id="photo-plein-ecran" style="max-width:100%;max-height:80vh;border-radius:8px;object-fit:contain" />
    <div style="display:flex;gap:10px">
      ${_adminPhotos.map((_, i) => `<div onclick="changerPhotoAdmin(${i})" style="width:48px;height:48px;border-radius:6px;overflow:hidden;cursor:pointer;border:2px solid ${i===idx?'var(--accent)':'transparent'}"><img src="${_adminPhotos[i]}" style="width:100%;height:100%;object-fit:cover"/></div>`).join('')}
    </div>
    <button onclick="this.closest('div[style]').remove()" style="background:rgba(255,255,255,.1);border:none;color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.9rem">âœ• Fermer</button>`;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
function changerPhotoAdmin(idx) {
  const img = document.getElementById('photo-plein-ecran');
  if (img && _adminPhotos[idx]) img.src = _adminPhotos[idx];
}

/* ===== MESSAGERIE ADMIN ===== */
let _msgSalarieActif = null;

function afficherMessagerie() {
  const salaries = charger('salaries');
  const liste    = document.getElementById('msg-liste-salaries');
  if (!liste) return;

  // Initialiser le select poste du broadcast
  const selPoste = document.getElementById('broadcast-poste');
  if (selPoste) {
    const valeurCourante = selPoste.value;
    selPoste.innerHTML = '<option value="">Tous les postes</option>';
    const postes = getPostes();
    postes.forEach(p => { selPoste.innerHTML += `<option value="${p}">${p}</option>`; });
    selPoste.value = valeurCourante;
  }

  if (!salaries.length) {
    liste.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:.85rem">Aucun salariÃ©</div>';
    return;
  }

  liste.innerHTML = salaries.filter(s=>s.actif).map(s => {
    const messages = JSON.parse(localStorage.getItem('messages_' + s.id) || '[]');
    const nonLus   = messages.filter(m => m.auteur === 'salarie' && !m.lu).length;
    const dernier  = messages.length ? messages[messages.length - 1] : null;
    const actif    = _msgSalarieActif === s.id;
    return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
      <div onclick="ouvrirConversation('${s.id}')" style="flex:1;padding:10px 12px;border-radius:8px;cursor:pointer;background:${actif ? 'rgba(245,166,35,.12)' : 'transparent'};border:1px solid ${actif ? 'rgba(245,166,35,.3)' : 'transparent'};transition:all .2s" onmouseover="if(!${actif})this.style.background='rgba(255,255,255,.04)'" onmouseout="if(!${actif})this.style.background='transparent'">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:.88rem">${s.nom}</strong>
            ${s.poste ? `<span style="font-size:.68rem;color:var(--text-muted);margin-left:4px">${s.poste}</span>` : ''}
          </div>
          ${nonLus > 0 ? `<span style="background:var(--red);color:#fff;border-radius:20px;font-size:.7rem;padding:1px 7px;font-weight:700">${nonLus}</span>` : ''}
        </div>
        ${dernier ? `<div style="font-size:.76rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${dernier.auteur==='admin'?'Vous : ':''}${dernier.texte.substring(0,40)}${dernier.texte.length>40?'â€¦':''}</div>` : '<div style="font-size:.76rem;color:var(--text-muted)">Aucun message</div>'}
      </div>
      <button onclick="event.stopPropagation();supprimerConversation('${s.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.85rem;padding:4px;opacity:.4;transition:opacity .2s" onmouseover="this.style.opacity='1';this.style.color='var(--red)'" onmouseout="this.style.opacity='.4';this.style.color='var(--text-muted)'" title="Supprimer la conversation">ðŸ—‘ï¸</button>
    </div>`;
  }).join('');

  mettreAJourBadgeMsgAdmin();
}

async function supprimerConversation(salId) {
  const sal = charger('salaries').find(s=>s.id===salId);
  const ok = await confirmDialog(`Supprimer la conversation avec ${sal?.nom||'ce salariÃ©'} ?`, {titre:'Supprimer conversation',icone:'ðŸ’¬',btnLabel:'Supprimer'});
  if (!ok) return;
  localStorage.removeItem('messages_'+salId);
  if (_msgSalarieActif === salId) {
    _msgSalarieActif = null;
    document.getElementById('msg-admin-nom').textContent = 'SÃ©lectionnez un salariÃ©';
    document.getElementById('msg-admin-nom').style.color = 'var(--text-muted)';
    document.getElementById('msg-admin-fil').innerHTML = '<div style="text-align:center;color:var(--text-muted);margin:auto;font-size:.88rem">â† Choisissez une conversation</div>';
    document.getElementById('msg-admin-input').disabled = true;
    document.getElementById('btn-envoyer-admin').disabled = true;
  }
  afficherMessagerie();
  afficherToast('ðŸ—‘ï¸ Conversation supprimÃ©e');
}

/* Broadcast â€” gestion cible par poste / sÃ©lection */
function majBroadcastSelection() {
  const cible = document.getElementById('broadcast-cible')?.value || 'tous';
  const selPoste = document.getElementById('broadcast-poste');
  const selWrap  = document.getElementById('broadcast-selection-wrap');
  const countEl  = document.getElementById('broadcast-count');

  if (selPoste) selPoste.style.display = cible === 'poste' ? 'inline-block' : 'none';
  if (selWrap)  selWrap.style.display  = cible === 'selection' ? 'block' : 'none';

  if (cible === 'selection') {
    const salaries = charger('salaries').filter(s=>s.actif);
    const cont = document.getElementById('broadcast-checkboxes');
    if (cont) {
      cont.innerHTML = `
        <input type="text" id="broadcast-search-sal" placeholder="ðŸ” Rechercher un salariÃ©..." oninput="filtrerBroadcastSalaries()" style="width:100%;background:var(--bg-dark);border:1px solid var(--border);color:var(--text-primary);padding:7px 12px;border-radius:8px;font-size:.85rem;margin-bottom:8px" />
        <div id="broadcast-sal-list" style="display:flex;flex-wrap:wrap;gap:6px;max-height:120px;overflow-y:auto">
          ${salaries.map(s =>
            `<label class="broadcast-sal-label" data-nom="${s.nom.toLowerCase()}" style="display:flex;align-items:center;gap:4px;font-size:.82rem;cursor:pointer;background:rgba(255,255,255,.04);padding:4px 10px;border-radius:6px;border:1px solid var(--border)">
              <input type="checkbox" class="broadcast-cb" value="${s.id}" style="accent-color:var(--accent)" onchange="majBroadcastCount()" /> ${s.nom}${s.poste?` <span style="font-size:.7rem;color:var(--text-muted)">(${s.poste})</span>`:''}
            </label>`
          ).join('')}
        </div>`;
    }
  }

  majBroadcastCount();
}

function filtrerBroadcastSalaries() {
  const q = document.getElementById('broadcast-search-sal')?.value.toLowerCase() || '';
  document.querySelectorAll('.broadcast-sal-label').forEach(el => {
    el.style.display = el.dataset.nom.includes(q) ? 'flex' : 'none';
  });
}

function majBroadcastCount() {
  const countEl = document.getElementById('broadcast-count');
  const nb = getBroadcastDestinataires().length;
  if (countEl) countEl.textContent = nb > 0 ? `${nb} destinataire${nb>1?'s':''}` : '';
}

function getBroadcastDestinataires() {
  const cible = document.getElementById('broadcast-cible')?.value || 'tous';
  const salaries = charger('salaries').filter(s=>s.actif);
  if (cible === 'tous') return salaries;
  if (cible === 'poste') {
    const poste = document.getElementById('broadcast-poste')?.value;
    return poste ? salaries.filter(s=>s.poste===poste) : [];
  }
  if (cible === 'selection') {
    const checked = Array.from(document.querySelectorAll('.broadcast-cb:checked')).map(cb=>cb.value);
    return salaries.filter(s=>checked.includes(s.id));
  }
  return salaries;
}

function ouvrirConversation(salId) {
  // Marquer tous les messages salarieâ†’admin comme lus
  const msgs = JSON.parse(localStorage.getItem('messages_'+salId)||'[]');
  let changed = false;
  msgs.forEach(m => { if (m.auteur==='salarie' && !m.lu) { m.lu=true; m.luLe=new Date().toISOString(); changed=true; } });
  if (changed) localStorage.setItem('messages_'+salId, JSON.stringify(msgs));
  _msgSalarieActif = salId;
  const salaries = charger('salaries');
  const sal = salaries.find(s => s.id === salId);
  const messages = JSON.parse(localStorage.getItem('messages_' + salId) || '[]');

  // Marquer les messages salariÃ© comme lus
  let modifie = false;
  messages.forEach(m => { if (m.auteur === 'salarie' && !m.lu) { m.lu = true; modifie = true; } });
  if (modifie) localStorage.setItem('messages_' + salId, JSON.stringify(messages));

  // Header
  document.getElementById('msg-admin-nom').textContent = sal ? `ðŸ‘¤ ${sal.nom} â€” ${sal.numero}` : 'SalariÃ©';
  document.getElementById('msg-admin-nom').style.color = 'var(--text)';
  // Afficher les templates de messages
  afficherTemplatesMsg(sal?.nom || '');

  // Activer la zone de saisie
  const input = document.getElementById('msg-admin-input');
  const btn   = document.getElementById('btn-envoyer-admin');
  input.disabled = false; input.style.opacity = '1';
  btn.disabled   = false;
  input.focus();

  // Afficher les messages
  const fil = document.getElementById('msg-admin-fil');
  if (!messages.length) {
    fil.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin:auto;font-size:.85rem">DÃ©marrez la conversation</div>';
  } else {
    fil.innerHTML = '';
    messages.forEach((m, i) => {
      const estAdmin = m.auteur === 'admin';
      const div = document.createElement('div');
      div.style.cssText = `display:flex;flex-direction:column;align-items:${estAdmin ? 'flex-end' : 'flex-start'}`;
      const heure = new Date(m.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      // AccusÃ© de lecture : dernier message admin + lu par salariÃ©
      const estDernierAdmin = estAdmin && messages.slice(i+1).every(mm => mm.auteur !== 'admin');
      const accuse = estAdmin && estDernierAdmin && m.lu
        ? `<span class="msg-double-check" title="Lu le ${m.luLe ? new Date(m.luLe).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ''}">âœ“âœ“</span>`
        : estAdmin ? '<span style="font-size:.68rem;color:var(--text-muted);opacity:.5">âœ“</span>' : '';
      div.innerHTML = `
        <div style="max-width:75%;background:${estAdmin ? 'var(--accent)' : 'var(--bg-dark)'};color:${estAdmin ? '#000' : 'var(--text-primary)'};padding:9px 13px;border-radius:${estAdmin ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};font-size:.88rem;word-break:break-word">
          ${m.photo ? `<img src="${m.photo}" style="max-width:200px;border-radius:8px;display:block;cursor:pointer" onclick="window.open('${m.photo}','_blank')" />` : m.texte}
        </div>
        <span style="font-size:.72rem;color:var(--text-muted);margin-top:3px;display:flex;align-items:center;gap:4px">${estAdmin ? 'Vous' : sal?.nom || 'SalariÃ©'} Â· ${heure} ${accuse}</span>`;
      fil.appendChild(div);
    });
    fil.scrollTop = fil.scrollHeight;
  }

  afficherMessagerie();
}

function envoyerMessageAdmin() {
  if (!_msgSalarieActif) return;
  const input = document.getElementById('msg-admin-input');
  const texte = input.value.trim();
  if (!texte) return;
  // Son d'envoi discret
  try { const ctx=new(window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value=1200; g.gain.setValueAtTime(0.15,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.12); } catch(e) {}

  const messages = JSON.parse(localStorage.getItem('messages_' + _msgSalarieActif) || '[]');
  messages.push({
    id: genId(), auteur: 'admin',
    texte, lu: false, creeLe: new Date().toISOString()
  });
  localStorage.setItem('messages_' + _msgSalarieActif, JSON.stringify(messages));

  input.value = '';
  ouvrirConversation(_msgSalarieActif);
}

function mettreAJourBadgeMsgAdmin() {
  const salaries = charger('salaries');
  let total = 0;
  salaries.forEach(s => {
    const msgs = JSON.parse(localStorage.getItem('messages_' + s.id) || '[]');
    total += msgs.filter(m => m.auteur === 'salarie' && !m.lu).length;
  });
  const badge = document.getElementById('badge-msg-admin');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
  // Badge favicon
  const alertes = compterAlertesNonLues();
  majBadgeFavicon(total + alertes);
  mettreAJourBadgesNav();
}

/* ===== PLANNING HEBDOMADAIRE ===== */
const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function afficherPlanning() {
  const salaries  = charger('salaries');
  const plannings = JSON.parse(localStorage.getItem('plannings') || '[]');
  const tb = document.getElementById('tb-planning');

  // Mettre Ã  jour le select du modal
  const sel = document.getElementById('plan-salarie');
  if (sel) {
    const valeur = sel.value;
    sel.innerHTML = '<option value="">-- Choisir un salariÃ© --</option>';
    salaries.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nom} (${s.numero})</option>`; });
    sel.value = valeur;
  }

  if (!salaries.length) { tb.innerHTML = '<tr><td colspan="9" class="empty-row">Aucun salariÃ©</td></tr>'; return; }

  tb.innerHTML = salaries.map(s => {
    const plan = plannings.find(p => p.salId === s.id);
    const cellules = JOURS.map(j => {
      if (!plan) return '<td style="color:var(--text-muted);font-size:.75rem">â€”</td>';
      const jour = plan.semaine?.find(d => d.jour === j);
      if (!jour || !jour.travaille) return '<td style="color:var(--text-muted);font-size:.8rem;text-align:center">ðŸ”´</td>';
      return `<td style="text-align:center;font-size:.78rem"><span style="color:var(--green)">ðŸŸ¢</span>${jour.heureDebut ? '<br><span style="color:var(--muted)">'+jour.heureDebut+'</span>' : ''}</td>`;
    }).join('');
    return `<tr>
      <td><strong>${s.nom}</strong></td>
      ${cellules}
      <td>
        <button class="btn-icon" onclick="ouvrirEditPlanning('${s.id}')" title="Modifier">âœï¸</button>
        ${plan ? `<button class="btn-icon danger" onclick="supprimerPlanning('${s.id}')" title="Supprimer">ðŸ—‘ï¸</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function genererGrilleJours() {
  const salId = document.getElementById('plan-salarie').value;
  const grid  = document.getElementById('plan-jours-grid');
  if (!grid) return;

  const plannings = JSON.parse(localStorage.getItem('plannings') || '[]');
  const plan = plannings.find(p => p.salId === salId);

  grid.innerHTML = JOURS.map((jour, i) => {
    const existing = plan?.semaine?.find(j => j.jour === jour) || {};
    const typeJour = existing.typeJour || (existing.travaille ? 'travail' : 'repos');
    const classeRow = typeJour==='conge'?'jour-conge':typeJour==='absence'?'jour-absence':typeJour==='maladie'?'jour-maladie':'';
    return `
      <div id="plan-row-${jour}" style="background:var(--bg-dark,#0f1117);border:1px solid var(--border);border-radius:8px;padding:10px 12px" class="${classeRow}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
            <input type="checkbox" id="plan-travaille-${jour}" ${existing.travaille ? 'checked' : ''}
              onchange="toggleJourPlanning('${jour}')"
              style="width:16px;height:16px;accent-color:var(--accent)" />
            <strong style="font-size:.9rem">${JOURS_COURTS[i]} â€” ${jour.charAt(0).toUpperCase()+jour.slice(1)}</strong>
          </label>
          <select class="planning-type-select" id="plan-type-${jour}" onchange="toggleTypeJour('${jour}')" style="width:110px">
            <option value="travail" ${typeJour==='travail'?'selected':''}>ðŸŸ¢ Travail</option>
            <option value="repos"   ${typeJour==='repos'  ?'selected':''}>âšª Repos</option>
            <option value="conge"   ${typeJour==='conge'  ?'selected':''}>ðŸ”µ CongÃ©</option>
            <option value="absence" ${typeJour==='absence'?'selected':''}>ðŸ”´ Absence</option>
            <option value="maladie" ${typeJour==='maladie'?'selected':''}>ðŸŸ£ Maladie</option>
          </select>
        </div>
        <div id="plan-horaires-${jour}" style="display:${existing.travaille&&typeJour==='travail' ? 'grid' : 'none'};grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">DÃ©but</label>
            <input type="time" id="plan-debut-${jour}" value="${existing.heureDebut||''}"
              onchange="mettreAJourTotalHeuresPlanning()"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Fin</label>
            <input type="time" id="plan-fin-${jour}" value="${existing.heureFin||''}"
              onchange="mettreAJourTotalHeuresPlanning()"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Zone</label>
            <input type="text" id="plan-zone-${jour}" value="${existing.zone||''}" placeholder="Ex: Nord"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Note</label>
            <input type="text" id="plan-note-${jour}" value="${existing.note||''}" placeholder="Informations..."
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
        </div>
      </div>`;
  }).join('');
  mettreAJourTotalHeuresPlanning();
}

function toggleJourPlanning(jour) {
  const cb  = document.getElementById('plan-travaille-'+jour);
  const det = document.getElementById('plan-horaires-'+jour);
  if (det) det.style.display = cb.checked ? 'grid' : 'none';
  mettreAJourTotalHeuresPlanning();
}

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

function sauvegarderPlanning() {
  const salId = document.getElementById('plan-salarie').value;
  if (!salId) { afficherToast('âš ï¸ Choisissez un salariÃ©', 'error'); return; }

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

  const plannings = JSON.parse(localStorage.getItem('plannings') || '[]');
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
  afficherToast(`âœ… Planning de ${sal?.nom || 'salariÃ©'} enregistrÃ©`);
}

async function supprimerPlanning(salId) {
  const _ok9 = await confirmDialog('Supprimer le planning de ce salariÃ© ?', {titre:'Supprimer le planning',icone:'ðŸ“…',btnLabel:'Supprimer'});
  if (!_ok9) return;
  const plannings = JSON.parse(localStorage.getItem('plannings') || '[]').filter(p => p.salId !== salId);
  localStorage.setItem('plannings', JSON.stringify(plannings));
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('ðŸ—‘ï¸ Planning supprimÃ©');
}

/* ===== VUE KANBAN LIVRAISONS ===== */
let _vueLivraisons = 'tableau'; // 'tableau' | 'kanban' | 'calendrier'

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

function afficherKanban() {
  let livraisons = charger('livraisons');
  const filtreDeb = document.getElementById('filtre-date-debut')?.value;
  const filtreFin = document.getElementById('filtre-date-fin')?.value;
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';
  if (filtreDeb) livraisons = livraisons.filter(l => l.date >= filtreDeb);
  if (filtreFin) livraisons = livraisons.filter(l => l.date <= filtreFin);
  if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) {
    livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee, l.vehNom].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
  }
  livraisons.sort((a,b) => new Date(b.creeLe) - new Date(a.creeLe));

  const cols = { 'en-attente': [], 'en-cours': [], 'livre': [] };
  livraisons.forEach(l => {
    if (cols[l.statut]) cols[l.statut].push(l);
    else cols['en-attente'].push(l);
  });

  const labels = { 'en-attente': 'â³ En attente', 'en-cours': 'ðŸš En cours', 'livre': 'âœ… LivrÃ©' };
  const classes= { 'en-attente': 'attente', 'en-cours': 'cours', 'livre': 'livre' };

  const board = document.getElementById('kanban-board');
  if (!board) return;
  board.innerHTML = Object.entries(cols).map(([statut, items]) => `
    <div class="kanban-col">
      <div class="kanban-col-header ${classes[statut]}">
        <span>${labels[statut]}</span>
        <span class="kanban-count">${items.length}</span>
      </div>
      <div class="kanban-col-body" id="kanban-col-${statut}"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="dropKanban(event,'${statut}')">
        ${items.length === 0
          ? `<div style="text-align:center;padding:24px 8px;color:var(--text-muted);font-size:.8rem;opacity:.5">Aucune livraison</div>`
          : items.map(l => `
            <div class="kanban-card" draggable="true"
              ondragstart="dragKanban(event,'${l.id}')"
              ondragend="document.querySelectorAll('.kanban-col-body').forEach(c=>c.classList.remove('drag-over'))"
              onclick="ouvrirEditLivraison('${l.id}')">
              <div class="kanban-card-client">ðŸ“¦ ${l.client}</div>
              <div class="kanban-card-sub">${l.numLiv||'â€”'} Â· ${l.date}</div>
              ${l.chaufNom ? `<div class="kanban-card-sub">ðŸ‘¤ ${l.chaufNom}</div>` : ''}
              ${l.arrivee  ? `<div class="kanban-card-sub">ðŸ“ ${l.arrivee}</div>` : ''}
              <div class="kanban-card-prix">${l.prix ? euros(l.prix) : 'Prix manquant'}</div>
              <div style="display:flex;gap:4px;margin-top:6px">
                <button class="btn-icon" onclick="event.stopPropagation();dupliquerLivraison('${l.id}')" title="Dupliquer" style="font-size:.75rem;padding:2px 6px">ðŸ“‹</button>
              </div>
            </div>`).join('')}
      </div>
    </div>`).join('');
}

let _dragLivId = null;
function dragKanban(event, livId) {
  _dragLivId = livId;
  event.dataTransfer.effectAllowed = 'move';
}
function dropKanban(event, nouveauStatut) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if (!_dragLivId) return;
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(l => l.id === _dragLivId);
  if (idx > -1) {
    livraisons[idx].statut = nouveauStatut;
    sauvegarder('livraisons', livraisons);
    afficherKanban();
    afficherToast(`âœ… Livraison dÃ©placÃ©e â†’ ${nouveauStatut === 'livre' ? 'LivrÃ©' : nouveauStatut === 'en-cours' ? 'En cours' : 'En attente'}`);
  }
  _dragLivId = null;
}

/* ===== VUE CALENDRIER LIVRAISONS ===== */
let _calMois = new Date();

function afficherCalendrier() {
  const livraisons = charger('livraisons');
  const annee = _calMois.getFullYear();
  const mois  = _calMois.getMonth();
  const label = _calMois.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  const el = document.getElementById('cal-mois-label');
  if (el) el.textContent = label;

  const cal = document.getElementById('calendrier-grid');
  if (!cal) return;

  // Premier jour du mois et nombre de jours
  const premier = new Date(annee, mois, 1).getDay(); // 0=dim
  const offset  = (premier + 6) % 7; // lundi=0
  const nbJours = new Date(annee, mois+1, 0).getDate();
  const auj     = aujourdhui();

  // Grouper livraisons par date
  const parDate = {};
  livraisons.forEach(l => {
    if (!parDate[l.date]) parDate[l.date] = [];
    parDate[l.date].push(l);
  });

  const joursEnTete = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let html = joursEnTete.map(j => `<div class="cal-header-day">${j}</div>`).join('');

  // Cases vides avant le 1er
  for (let i = 0; i < offset; i++) {
    const d = new Date(annee, mois, -offset+i+1);
    const ds = d.toISOString().split('T')[0];
    const livs = parDate[ds]||[];
    html += `<div class="cal-day autre-mois" onclick="filtrerCalJour('${ds}')">
      <div class="cal-day-num">${d.getDate()}</div>
      <div class="cal-liv-dot">${livs.slice(0,2).map(l=>`<div class="cal-liv-item ${l.statut}">${l.client.substring(0,10)}</div>`).join('')}</div>
    </div>`;
  }

  // Jours du mois
  for (let d = 1; d <= nbJours; d++) {
    const ds   = `${annee}-${String(mois+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const livs = parDate[ds] || [];
    const isAuj = ds === auj;
    html += `<div class="cal-day${isAuj?' today':''}${livs.length?' has-livraisons':''}" onclick="filtrerCalJour('${ds}')">
      <div class="cal-day-num">${d}</div>
      <div class="cal-liv-dot">
        ${livs.slice(0,3).map(l=>`<div class="cal-liv-item ${l.statut==='livre'?'livre':l.statut==='en-cours'?'cours':''}">${l.client.substring(0,10)}</div>`).join('')}
        ${livs.length>3?`<div class="cal-liv-item">+${livs.length-3}</div>`:''}
      </div>
    </div>`;
  }

  // Cases vides aprÃ¨s le dernier
  const total = offset + nbJours;
  const reste = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= reste; i++) {
    const d = new Date(annee, mois+1, i);
    html += `<div class="cal-day autre-mois" onclick="filtrerCalJour('${d.toISOString().split('T')[0]}')">
      <div class="cal-day-num">${i}</div>
    </div>`;
  }

  cal.innerHTML = html;
}

function calNaviguer(delta) {
  _calMois = new Date(_calMois.getFullYear(), _calMois.getMonth() + delta, 1);
  afficherCalendrier();
}

function filtrerCalJour(date) {
  changerVueLivraisons('tableau');
  const deb = document.getElementById('filtre-date-debut');
  const fin = document.getElementById('filtre-date-fin');
  if (deb) deb.value = date;
  if (fin) fin.value = date;
  afficherLivraisons();
  document.getElementById('barre-recherche-univ')?.blur();
  afficherToast(`ðŸ“… Livraisons du ${new Date(date).toLocaleDateString('fr-FR', {day:'numeric',month:'long'})}`);
}

/* ===== DUPLICATION LIVRAISON ===== */
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
  afficherToast(`ðŸ“‹ Livraison dupliquÃ©e â†’ ${copie.numLiv}`);
}

/* ===== RÃ‰CURRENCE LIVRAISON ===== */
function ouvrirRecurrence(id) {
  const liv = charger('livraisons').find(l => l.id === id);
  if (!liv) return;
  document.getElementById('rec-liv-id').value  = id;
  document.getElementById('rec-liv-info').textContent = `${liv.client} â€” ${liv.numLiv||''}`;
  document.getElementById('rec-semaines').value = '4';
  openModal('modal-recurrence');
}

function confirmerRecurrence() {
  const id      = document.getElementById('rec-liv-id').value;
  const nb      = parseInt(document.getElementById('rec-semaines').value) || 1;
  const source  = charger('livraisons').find(l => l.id === id);
  if (!source || nb < 1 || nb > 52) { afficherToast('âš ï¸ Nombre de semaines invalide (1-52)', 'error'); return; }

  const livraisons = charger('livraisons');
  const baseDate   = new Date(source.date);
  const creees     = [];

  for (let i = 1; i <= nb; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 7);
    const copie = {
      ...source,
      id: genId(),
      numLiv: genNumLivraison(),
      date: d.toISOString().split('T')[0],
      statut: 'en-attente',
      statutPaiement: 'en-attente',
      creeLe: new Date().toISOString()
    };
    livraisons.push(copie);
    creees.push(copie.numLiv);
  }
  sauvegarder('livraisons', livraisons);
  closeModal('modal-recurrence');
  afficherLivraisons();
  afficherToast(`âœ… ${nb} livraison(s) rÃ©currente(s) crÃ©Ã©e(s)`);
}

/* ===== TRI COLONNES GÃ‰NÃ‰RIQUE ===== */
const _sortState = {};
function trierTableau(tbodyId, colIndex, type='string') {
  const key = tbodyId + colIndex;
  _sortState[key] = _sortState[key] === 'asc' ? 'desc' : 'asc';
  const asc = _sortState[key] === 'asc';

  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort((a, b) => {
    const av = a.cells[colIndex]?.textContent.trim() || '';
    const bv = b.cells[colIndex]?.textContent.trim() || '';
    if (type === 'number') {
      return asc ? parseFloat(av)||0 - (parseFloat(bv)||0) : (parseFloat(bv)||0) - (parseFloat(av)||0);
    }
    if (type === 'date') {
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return asc ? av.localeCompare(bv,'fr') : bv.localeCompare(av,'fr');
  });
  rows.forEach(r => tbody.appendChild(r));

  // Mettre Ã  jour les indicateurs visuels
  const table = tbody.closest('table');
  if (table) {
    table.querySelectorAll('.th-sortable').forEach(th => th.classList.remove('asc','desc'));
    const ths = table.querySelectorAll('.th-sortable');
    if (ths[colIndex]) ths[colIndex].classList.add(asc ? 'asc' : 'desc');
  }
}

/* ===== PAGINATION GÃ‰NÃ‰RIQUE ===== */
const _pageState = {};
function paginer(items, containerId, renderFn, pageSize=20) {
  const state = _pageState[containerId] || { page: 1 };
  _pageState[containerId] = state;
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  state.page = Math.min(state.page, pages);
  const slice = items.slice((state.page-1)*pageSize, state.page*pageSize);

  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = renderFn(slice);

  // Pagination bar
  const wrap = cont.closest('.card') || cont.parentElement;
  let pag = wrap.querySelector('.pagination');
  if (total <= pageSize) { if (pag) pag.remove(); return; }
  if (!pag) { pag = document.createElement('div'); pag.className='pagination'; wrap.appendChild(pag); }

  const btns = [];
  for (let p=1; p<=pages; p++) {
    if (p===1||p===pages||Math.abs(p-state.page)<=1) {
      btns.push(`<button class="btn-page${p===state.page?' active':''}" onclick="_pageState['${containerId}'].page=${p};paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">${p}</button>`);
    } else if (Math.abs(p-state.page)===2) {
      btns.push(`<span style="padding:0 4px;color:var(--text-muted)">â€¦</span>`);
    }
  }
  pag.innerHTML = `
    <span>${(state.page-1)*pageSize+1}â€“${Math.min(state.page*pageSize,total)} sur ${total}</span>
    <div class="pagination-btns">
      <button class="btn-page" ${state.page<=1?'disabled':''} onclick="_pageState['${containerId}'].page--;paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">â€¹</button>
      ${btns.join('')}
      <button class="btn-page" ${state.page>=pages?'disabled':''} onclick="_pageState['${containerId}'].page++;paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">â€º</button>
    </div>`;
}

/* ===== Ã‰TATS VIDES ILLUSTRÃ‰S ===== */
function emptyState(icon, title, sub, btnLabel='', btnAction='') {
  return `<tr><td colspan="99">
    <div class="empty-illustrated">
      <div class="ei-icon">${icon}</div>
      <div class="ei-title">${title}</div>
      <div class="ei-sub">${sub}</div>
      ${btnLabel ? `<button class="ei-btn" onclick="${btnAction}">${btnLabel}</button>` : ''}
    </div>
  </td></tr>`;
}

/* ===== BADGE FAVICON ===== */
let _faviconCanvas = null;
function majBadgeFavicon(count) {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.rel = 'icon';
  const logo = getLogoEntreprise();
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const dessinerBadge = function() {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(25, 7, 8, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(count > 9 ? '9+' : String(count), 25, 11);
    link.href = canvas.toDataURL();
    document.head.appendChild(link);
  };
  if (count <= 0) {
    link.href = logo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>ðŸš</text></svg>";
    document.head.appendChild(link);
    return;
  }
  if (logo) {
    const img = new Image();
    img.onload = function() {
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      dessinerBadge();
    };
    img.onerror = function() {
      ctx.font = '24px serif';
      ctx.fillText('ðŸš', 0, 24);
      dessinerBadge();
    };
    img.src = logo;
    return;
  }
  ctx.font = '24px serif';
  ctx.fillText('ðŸš', 0, 24);
  dessinerBadge();
}

/* ===== EXPORT CSV ===== */
function exporterCSV(data, colonnes, nomFichier) {
  const sep = ';';
  const header = colonnes.map(c => c.label).join(sep);
  const rows = data.map(row =>
    colonnes.map(c => {
      const val = c.get(row) ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(sep) || str.includes('\n') ? `"${str}"` : str;
    }).join(sep)
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM pour Excel franÃ§ais
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  a.click();
}

function exporterLivraisons() {
  const livraisons = charger('livraisons').sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe));
  exporterCSV(livraisons, [
    { label: 'NÂ° LIV',      get: l => l.numLiv||'' },
    { label: 'Date',         get: l => l.date||'' },
    { label: 'Client',       get: l => l.client||'' },
    { label: 'DÃ©part',       get: l => l.depart||'' },
    { label: 'ArrivÃ©e',      get: l => l.arrivee||'' },
    { label: 'Distance km',  get: l => l.distance||'' },
    { label: 'Prix â‚¬',       get: l => l.prix||'' },
    { label: 'Chauffeur',    get: l => l.chaufNom||'' },
    { label: 'VÃ©hicule',     get: l => l.vehNom||'' },
    { label: 'Statut',       get: l => l.statut||'' },
    { label: 'Paiement',     get: l => l.statutPaiement||'' },
    { label: 'Mode paiement',get: l => l.modePaiement||'' },
    { label: 'Profit â‚¬',     get: l => l.profit ? parseFloat(l.profit).toFixed(2) : '' },
  ], `livraisons_${aujourdhui()}.csv`);
  afficherToast('âœ… Export CSV tÃ©lÃ©chargÃ©');
}

function exporterCharges() {
  const charges = charger('charges').sort((a,b)=>new Date(b.date)-new Date(a.date));
  exporterCSV(charges, [
    { label:'Date',        get:c=>c.date||'' },
    { label:'CatÃ©gorie',   get:c=>c.categorie||'' },
    { label:'Description', get:c=>c.description||'' },
    { label:'VÃ©hicule',    get:c=>c.vehNom||'' },
    { label:'Montant â‚¬',   get:c=>c.montant?parseFloat(c.montant).toFixed(2):'' },
  ], `charges_${aujourdhui()}.csv`);
  afficherToast('âœ… Export charges CSV tÃ©lÃ©chargÃ©');
}

function exporterEntretiens() {
  const tous = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const vehs = charger('vehicules');
  exporterCSV(tous, [
    { label:'Date',           get:e=>e.date||'' },
    { label:'VÃ©hicule',       get:e=>vehs.find(v=>v.id===e.vehId)?.immat||'' },
    { label:'Type',           get:e=>e.type||'' },
    { label:'Description',    get:e=>e.description||'' },
    { label:'Km',             get:e=>e.km||'' },
    { label:'Prochain km',    get:e=>e.prochainKm||'' },
    { label:'CoÃ»t â‚¬',         get:e=>e.cout?parseFloat(e.cout).toFixed(2):'' },
  ], `entretiens_${aujourdhui()}.csv`);
  afficherToast('âœ… Export entretiens CSV tÃ©lÃ©chargÃ©');
}

/* ===== RAPPORT MENSUEL PDF ===== */
function genererRapportMensuel() {
  const auj    = new Date();
  const mois   = auj.toISOString().slice(0,7);
  const moisLabel = auj.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
  const params = getEntrepriseExportParams();
  const nom    = params.nom;

  const livraisons = charger('livraisons').filter(l => (l.date||'').startsWith(mois));
  const carburant  = charger('carburant').filter(p => (p.date||'').startsWith(mois));
  const salaries   = charger('salaries');

  const caTotal    = livraisons.reduce((s,l)=>s+(l.prix||0), 0);
  const carbTotal  = carburant.reduce((s,p)=>s+(p.total||0), 0);
  const kmTotal    = salaries.reduce((s,sal)=>{
    const entrees = charger('km_sal_'+sal.id).filter(e=>(e.date||'').startsWith(mois));
    return s + entrees.reduce((ss,e)=>ss+(e.distance||0),0);
  }, 0);
  const benefice   = caTotal - carbTotal;
  const livrees    = livraisons.filter(l=>l.statut==='livre').length;
  const enAttente  = livraisons.filter(l=>l.statut==='en-attente').length;
  const dateExp    = formatDateHeureExport(auj);

  // Stats par chauffeur
  const statsChauff = {};
  livraisons.forEach(l => {
    if (!l.chaufNom) return;
    if (!statsChauff[l.chaufNom]) statsChauff[l.chaufNom] = { livs:0, ca:0 };
    statsChauff[l.chaufNom].livs++;
    statsChauff[l.chaufNom].ca += l.prix||0;
  });

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">

    <!-- EN-TÃŠTE -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:3px solid #f5a623;margin-bottom:28px">
      <div>
        <div style="font-size:1.5rem;font-weight:800;color:#f5a623">${nom}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Rapport d'activitÃ©</div>
        <div style="font-size:1.2rem;font-weight:800;text-transform:capitalize">${moisLabel}</div>
        <div style="font-size:.78rem;color:#9ca3af">GÃ©nÃ©rÃ© le ${dateExp}</div>
      </div>
    </div>
    ${renderBlocInfosEntreprise(params)}

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
      ${[
        ['ðŸ’¶ CA du mois', new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(caTotal), '#f5a623'],
        ['ðŸ“¦ Livraisons', livraisons.length + ' total', '#4f8ef7'],
        ['â›½ Carburant',  new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(carbTotal), '#e74c3c'],
        ['ðŸ’° BÃ©nÃ©fice',  new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(benefice), benefice>=0?'#2ecc71':'#e74c3c'],
      ].map(([label, value, color]) => `
        <div style="background:#f8f9fc;border-radius:10px;padding:14px;text-align:center;border-top:3px solid ${color}">
          <div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${label}</div>
          <div style="font-size:1.15rem;font-weight:800;color:${color}">${value}</div>
        </div>`).join('')}
    </div>

    <!-- STATUTS LIVRAISONS -->
    <div style="background:#f8f9fc;border-radius:10px;padding:16px;margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:12px">Statuts des livraisons</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><span style="background:rgba(46,204,113,.15);color:#2ecc71;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:600">âœ… LivrÃ© : ${livrees}</span></div>
        <div><span style="background:rgba(245,166,35,.15);color:#f5a623;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:600">â³ En attente : ${enAttente}</span></div>
        <div><span style="background:rgba(52,152,219,.15);color:#4f8ef7;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:600">ðŸš En cours : ${livraisons.filter(l=>l.statut==='en-cours').length}</span></div>
      </div>
    </div>

    <!-- KM + CARBURANT -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:#f8f9fc;border-radius:10px;padding:16px">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">KilomÃ©trage total</div>
        <div style="font-size:1.4rem;font-weight:800">${new Intl.NumberFormat('fr-FR').format(Math.round(kmTotal))} km</div>
        <div style="font-size:.78rem;color:#9ca3af;margin-top:4px">Tous chauffeurs confondus</div>
      </div>
      <div style="background:#f8f9fc;border-radius:10px;padding:16px">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">CoÃ»t carburant</div>
        <div style="font-size:1.4rem;font-weight:800">${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(carbTotal)}</div>
        <div style="font-size:.78rem;color:#9ca3af;margin-top:4px">${carburant.length} plein(s) ce mois</div>
      </div>
    </div>

    <!-- STATS PAR CHAUFFEUR -->
    ${Object.keys(statsChauff).length ? `
    <div style="margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:12px">Performance par chauffeur</div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:9px 12px;text-align:left;font-weight:600;color:#6b7280">Chauffeur</th>
          <th style="padding:9px 12px;text-align:right;font-weight:600;color:#6b7280">Livraisons</th>
          <th style="padding:9px 12px;text-align:right;font-weight:600;color:#6b7280">CA gÃ©nÃ©rÃ©</th>
        </tr></thead>
        <tbody>${Object.entries(statsChauff).sort((a,b)=>b[1].ca-a[1].ca).map(([nom,s],i) => `
          <tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}">
            <td style="padding:9px 12px;font-weight:500">${nom}</td>
            <td style="padding:9px 12px;text-align:right">${s.livs}</td>
            <td style="padding:9px 12px;text-align:right;font-weight:700;color:#f5a623">${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(s.ca)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- PIED DE PAGE -->
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
      <span>${nom} â€” Page 1/1</span>
      <span>${dateExp}</span>
      <span>${params.tel || params.email || params.siret || ''}</span>
    </div>
  </div>`;

  const win = window.open('', '_blank', 'width=850,height:950');
  win.document.write(`<!DOCTYPE html><html><head><title>Rapport ${moisLabel} â€” ${nom}</title>
    <style>body{margin:0;padding:20px;background:#fff} @page{margin:12mm} @media print{body{padding:0}}</style>
    </head><body>${html}
    <script>setTimeout(()=>{window.print();},400)<\/script>
    </body></html>`);
  win.document.close();
  afficherToast('ðŸ“„ Rapport mensuel gÃ©nÃ©rÃ©');
}

/* ===== ACCUSÃ‰ DE LECTURE MESSAGERIE ===== */
/* ===== GOOGLE MAPS â€” CALCUL DISTANCE AUTO ===== */
async function calculerDistanceMaps(depart, arrivee, inputId) {
  if (!depart || !arrivee) { afficherToast('âš ï¸ Saisissez dÃ©part et arrivÃ©e d\'abord', 'error'); return; }
  const btn = document.getElementById('maps-calc-btn');
  if (btn) { btn.classList.add('maps-loading'); btn.textContent = 'â³ Calcul...'; }

  try {
    // Utiliser l'API Nominatim (OSM) pour gÃ©ocoder + calcul Ã  vol d'oiseau
    const encD = encodeURIComponent(depart);
    const encA = encodeURIComponent(arrivee);
    const [resD, resA] = await Promise.all([
      fetch(`https://nominatim.openstreetmap.org/search?q=${encD}&format=json&limit=1`).then(r=>r.json()),
      fetch(`https://nominatim.openstreetmap.org/search?q=${encA}&format=json&limit=1`).then(r=>r.json())
    ]);
    if (!resD.length || !resA.length) { afficherToast('âš ï¸ Adresse introuvable â€” saisissez manuellement', 'error'); return; }

    const lat1 = parseFloat(resD[0].lat), lon1 = parseFloat(resD[0].lon);
    const lat2 = parseFloat(resA[0].lat), lon2 = parseFloat(resA[0].lon);

    // Formule Haversine (distance Ã  vol d'oiseau)
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    const distVol = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    // Facteur routier ~1.3
    const distRoute = Math.round(distVol * 1.3);

    const input = document.getElementById(inputId);
    if (input) { input.value = distRoute; input.dispatchEvent(new Event('input')); }
    afficherToast(`ðŸ“ Distance estimÃ©e : ${distRoute} km (via OSM)`);
  } catch(e) {
    afficherToast('âš ï¸ Erreur de calcul â€” vÃ©rifiez votre connexion', 'error');
  } finally {
    if (btn) { btn.classList.remove('maps-loading'); btn.textContent = 'ðŸ“ Calculer distance'; }
  }
}

/* ===== HT/TVA DANS LE TABLEAU LIVRAISONS ===== */
function formatPrixAvecHT(prix) {
  if (!prix) return 'â€”';
  const taux = getTauxTVA();
  const ht   = prixHT(prix, taux);
  return `<div><strong>${euros(prix)}</strong></div><div style="font-size:.72rem;color:var(--text-muted)">${euros(ht)} HT</div>`;
}

/* ===== BADGES NAV â€” INCIDENTS + RELANCES ===== */
function mettreAJourBadgesNav() {
  // Badge incidents ouverts
  const incOpen = charger('incidents').filter(i=>i.statut==='ouvert').length;
  const badgeInc = document.getElementById('badge-incidents-nav');
  if (badgeInc) { badgeInc.textContent=incOpen; badgeInc.style.display=incOpen>0?'inline-flex':'none'; }

  // Badge relances
  const delai   = parseInt(localStorage.getItem('relance_delai')||'7');
  const limite  = new Date(); limite.setDate(limite.getDate()-delai);
  const limStr  = limite.toISOString().split('T')[0];
  const relOpen = charger('livraisons').filter(l=>
    l.statut==='livre' && (l.statutPaiement==='en-attente'||!l.statutPaiement) && l.prix>0 && l.date<=limStr
  ).length;
  const badgeRel = document.getElementById('badge-relances');
  if (badgeRel) { badgeRel.textContent=relOpen; badgeRel.style.display=relOpen>0?'inline-flex':'none'; }
}

/* ===== TAUX DE PONCTUALITÃ‰ ===== */
function calculerPonctualite() {
  const livraisons = charger('livraisons').filter(l=>l.statut==='livre'||l.statut==='en-attente');
  if (!livraisons.length) return { taux:0, livrees:0, total:0 };
  const livrees = livraisons.filter(l=>l.statut==='livre').length;
  return { taux: Math.round(livrees/livraisons.length*100), livrees, total: livraisons.length };
}

function afficherPonctualite() {
  const cont = document.getElementById('ponctualite-container');
  if (!cont) return;
  const { taux, livrees, total } = calculerPonctualite();
  const color = taux>=90?'var(--green)':taux>=70?'var(--accent)':'var(--red)';
  cont.innerHTML = `
    <div class="card mt-20">
      <div class="card-header"><h2>ðŸŽ¯ Taux de ponctualitÃ©</h2><span style="font-size:1.3rem;font-weight:800;color:${color}">${taux}%</span></div>
      <div style="padding:16px">
        <div class="ponctualite-bar"><div class="ponctualite-fill" style="width:${taux}%;background:${color}"></div></div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:6px">${livrees} livrÃ©es sur ${total} assignÃ©es</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px">
          ${[
            ['âœ… LivrÃ©es', livrees, 'var(--green)'],
            ['â³ En attente', total-livrees, 'var(--accent)'],
            ['ðŸ“Š Taux', taux+'%', color]
          ].map(([l,v,c])=>`<div style="background:rgba(255,255,255,.03);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:${c}">${v}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${l}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ===== TABLEAU DE BORD CLIENT ENRICHI ===== */
function afficherClientsDashboard() {
  const clients    = JSON.parse(localStorage.getItem('clients')||'[]');
  const tb = document.getElementById('tb-clients');
  if (!tb) return;
  if (!clients.length) { tb.innerHTML = emptyState('ðŸ§‘â€ðŸ’¼','Aucun client','Enregistrez vos clients pour activer l\'auto-complÃ©tion.','+ Nouveau client',"openModal('modal-client')"); return; }

  tb.innerHTML = clients.sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr')).map(c => {
    return `<tr>
      <td><strong>${c.nom}</strong></td>
      <td>${c.prenom||'â€”'}</td>
      <td>${c.tel||'â€”'}</td>
      <td style="font-size:.82rem">${c.adresse||'â€”'}</td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditClient('${c.id}')" title="Modifier">âœï¸</button>
        <button class="btn-icon" onclick="preFillLivraisonClient('${c.id}')" title="Nouvelle livraison">ðŸ“¦</button>
        <button class="btn-icon danger" onclick="supprimerClient('${c.id}')">ðŸ—‘ï¸</button>
      </td>
    </tr>`;
  }).join('');
}

/* ===== CONGÃ‰S / ABSENCES DANS LE PLANNING ===== */
function toggleTypeJour(jour) {
  const sel = document.getElementById('plan-type-'+jour);
  const row = document.getElementById('plan-row-'+jour);
  if (!sel || !row) return;
  const type = sel.value;
  row.className = type === 'travail' ? '' : type === 'conge' ? 'jour-conge' : type === 'absence' ? 'jour-absence' : 'jour-maladie';
  // Afficher/masquer les champs horaires selon le type
  const horaires = document.getElementById('plan-horaires-'+jour);
  if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
  const cb = document.getElementById('plan-travaille-'+jour);
  if (cb) cb.checked = type === 'travail';
  mettreAJourTotalHeuresPlanning();
}

/* ===== CONNEXION TCO DANS LA PAGE VÃ‰HICULES ===== */
function ouvrirTCO(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId);
  if (!veh) return;
  document.getElementById('tco-veh-nom').textContent = `${veh.immat} â€” ${veh.modele||''}`;
  afficherTCO(vehId);
  openModal('modal-tco');
}

/* ===== CONNEXION HISTOR. MODIFS DANS MODAL EDIT LIVRAISON ===== */
async function ouvrirEditLivraison(id) {
  window._editLivId = id;
  const livraisons = charger('livraisons');
  const l = livraisons.find(x => x.id === id);
  if (!l) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('livraison', id, l.numLiv || 'Livraison');
  if (!lockResult.ok) {
    afficherToast(`âš ï¸ Livraison en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    window._editLivId = null;
    return;
  }
  document.getElementById('edit-liv-id').value      = id;
  document.getElementById('edit-liv-client').value  = l.client||'';
  const zoneGeo = l.depart && l.arrivee && l.depart !== l.arrivee
    ? (l.depart + ' â†’ ' + l.arrivee)
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
  document.getElementById('edit-liv-statut').value  = l.statut||'en-attente';
  document.getElementById('edit-liv-notes').value   = l.notes||'';
  // Charger histor. modifs et commentaires
  afficherHistoriqueModifs(id);
  afficherCommentairesLiv(id);
  document.getElementById('modal-edit-livraison').classList.add('open');
  afficherAlerteVerrouModal('modal-edit-livraison', '');
}

/* ===== VUE COMPACTE TABLEAUX ===== */
let _vueCompacte = false;
function toggleVueCompacte() {
  _vueCompacte = !_vueCompacte;
  document.querySelectorAll('.data-table').forEach(t => t.classList.toggle('compact', _vueCompacte));
  const btn = document.getElementById('btn-density-compact');
  const btn2= document.getElementById('btn-density-normal');
  if (btn)  btn.classList.toggle('active',  _vueCompacte);
  if (btn2) btn2.classList.toggle('active', !_vueCompacte);
  afficherToast(_vueCompacte ? 'ðŸ—œï¸ Vue compacte' : 'ðŸ“‹ Vue normale');
}

/* ===== MODÃˆLES DE MESSAGES PRÃ‰DÃ‰FINIS ===== */
const MODELES_MESSAGES = [
  { id:1, titre:'TournÃ©e prÃªte',      texte:'Bonjour {prenom} ðŸ‘‹ Votre tournÃ©e du jour est prÃªte. VÃ©rifiez vos livraisons assignÃ©es dans l\'onglet Livraisons.' },
  { id:2, titre:'Rappel km retour',   texte:'Bonsoir {prenom}, n\'oubliez pas d\'enregistrer votre km de retour et votre plein si vous en avez fait un. Merci ðŸ™' },
  { id:3, titre:'Rappel inspection',  texte:'Rappel : pensez Ã  faire l\'inspection de votre vÃ©hicule avant le dÃ©part. Photos obligatoires ðŸ“·' },
  { id:4, titre:'Livraison urgente',  texte:'ðŸ“¦ Livraison urgente ajoutÃ©e Ã  votre tournÃ©e. Consultez l\'onglet Livraisons pour les dÃ©tails.' },
  { id:5, titre:'Bonne journÃ©e',      texte:'Bonjour {prenom} â˜€ï¸ Bonne journÃ©e de livraisons ! N\'hÃ©sitez pas Ã  me contacter en cas de problÃ¨me.' },
];

function afficherModelesMessages() {
  const cont = document.getElementById('modeles-msg-list');
  if (!cont) return;
  cont.innerHTML = MODELES_MESSAGES.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:600">${m.titre}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${m.texte.substring(0,55)}...</div>
      </div>
      <button class="btn-icon" onclick="utiliserModele(${m.id})" title="Utiliser">â†’</button>
    </div>`).join('');
}

function utiliserModele(id) {
  const modele = MODELES_MESSAGES.find(m=>m.id===id);
  if (!modele || !_msgSalarieActif) { afficherToast('âš ï¸ SÃ©lectionnez d\'abord un salariÃ©','error'); return; }
  const sal = charger('salaries').find(s=>s.id===_msgSalarieActif);
  const texte = modele.texte.replace('{prenom}', sal?.nom.split(' ')[0]||'');
  const input = document.getElementById('msg-admin-input');
  if (input) { input.value = texte; input.focus(); }
  document.getElementById('panel-modeles')?.classList.remove('open');
}

function togglePanelModeles() {
  const panel = document.getElementById('panel-modeles');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (isOpen) afficherModelesMessages();
}

/* ===== RH â€” COMPTEUR HEURES ===== */
function calculerHeuresSalarie(salId) {
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
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

function getHeuresSemaineRange() {
  const lundi = getLundiDeSemaine(_heuresSemaineOffset || 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return {
    lundi,
    dimanche,
    debut: lundi.toISOString().slice(0, 10),
    fin: dimanche.toISOString().slice(0, 10),
    label: `Semaine ${getNumSemaine(lundi)}`,
    datesLabel: `${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  };
}

var _heuresVue = 'semaine';
var _heuresMoisOffset = 0;

function getHeuresPeriodeRange() {
  if ((_heuresVue || 'semaine') === 'mois') {
    const d = new Date();
    d.setMonth(d.getMonth() + (_heuresMoisOffset || 0));
    const premierJour = new Date(d.getFullYear(), d.getMonth(), 1);
    const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      mode: 'mois',
      debut: premierJour.toISOString().slice(0, 10),
      fin: dernierJour.toISOString().slice(0, 10),
      label: premierJour.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      datesLabel: `${premierJour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${dernierJour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    };
  }
  return { mode: 'semaine', ...getHeuresSemaineRange() };
}

function getPlanningPeriodForDate(salId, dateStr, periodes) {
  return (periodes || charger('absences_periodes')).find(function(item) {
    return item.salId === salId && dateStr >= item.debut && dateStr <= item.fin;
  }) || null;
}

function getPlanningPeriodLabel(type) {
  return type === 'travail' ? 'Travail'
    : type === 'repos' ? 'Repos'
    : type === 'conge' ? 'CongÃ©'
    : type === 'maladie' ? 'Maladie'
    : 'Absence';
}

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
  if (prevBtn) prevBtn.textContent = range.mode === 'mois' ? 'â—€ Mois prÃ©c.' : 'â—€ Semaine prÃ©c.';
  if (nextBtn) nextBtn.textContent = range.mode === 'mois' ? 'Mois suiv. â–¶' : 'Semaine suiv. â–¶';
  if (resetBtn) resetBtn.textContent = range.mode === 'mois' ? 'Mois actuel' : 'Aujourd\'hui';
  if (totalCol) totalCol.textContent = range.mode === 'mois' ? 'H/mois' : 'H/semaine';
  if (detailCol) detailCol.textContent = range.mode === 'mois' ? 'DÃ©tail pÃ©riode' : 'DÃ©tail par jour';
}

function changerVueHeures(vue) {
  _heuresVue = vue === 'mois' ? 'mois' : 'semaine';
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

function naviguerHeuresPeriode(delta) {
  if ((_heuresVue || 'semaine') === 'mois') _heuresMoisOffset += delta;
  else _heuresSemaineOffset += delta;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

function reinitialiserHeuresPeriode() {
  if ((_heuresVue || 'semaine') === 'mois') _heuresMoisOffset = 0;
  else _heuresSemaineOffset = 0;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

function calculerHeuresSalarieSemaine(salId) {
  const range = getHeuresPeriodeRange();
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  const plan = plannings.find(p => p.salId === salId);
  const periodes = charger('absences_periodes').filter(a =>
    a.salId === salId &&
    a.fin >= range.debut &&
    a.debut <= range.fin
  );
  const details = [];
  let total = 0;

  getDateRangeInclusive(range.debut, range.fin).forEach(dateObj => {
    const dateStr = dateObj.toISOString().slice(0, 10);
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

function afficherCompteurHeures() {
  const salaries = charger('salaries');
  const cont = document.getElementById('tb-heures');
  if (!cont) return;
  const range = getHeuresPeriodeRange();
  const periode = document.getElementById('heures-periode-label');
  if (periode) periode.textContent = `${range.label} Â· ${range.datesLabel}`;

  // Filtre par salariÃ©
  const filtreSal = document.getElementById('filtre-heures-salarie')?.value || '';
  const selSal = document.getElementById('filtre-heures-salarie');
  if (selSal) {
    const currentValue = selSal.value;
    selSal.innerHTML = '<option value="">Tous les salariÃ©s</option>';
    salaries.forEach(s => { selSal.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
    selSal.value = currentValue;
  }

  // Afficher/masquer dates personnalisÃ©es
  const vue = document.getElementById('filtre-heures-vue')?.value || _heuresVue || 'semaine';
  const deb = document.getElementById('filtre-heures-debut');
  const fin = document.getElementById('filtre-heures-fin');
  if (deb) deb.style.display = vue === 'custom' ? 'inline-block' : 'none';
  if (fin) fin.style.display = vue === 'custom' ? 'inline-block' : 'none';

  const salFiltrees = filtreSal ? salaries.filter(s=>s.id===filtreSal) : salaries;
  if (!salFiltrees.length) { cont.innerHTML = emptyState('â±ï¸','Aucun salariÃ©','CrÃ©ez des salariÃ©s et dÃ©finissez leur planning pour voir les heures.'); return; }

  cont.innerHTML = salFiltrees.map(s => {
    const { planifiees, details } = calculerHeuresSalarieSemaine(s.id);
    const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
    const plan = plannings.find(p=>p.salId===s.id);
    const absencesPeriodes = JSON.parse(localStorage.getItem('absences_periodes')||'[]');

    const detailStr = details.length
      ? `${details.length} jour(s) travaillÃ©(s) Â· ${planifiees.toFixed(1)} h`
      : 'â€”';
    const absences = plan?.semaine?.filter(j=>['conge','absence','maladie'].includes(j.typeJour)) || [];
    const absencesPeriodeSemaine = absencesPeriodes.filter(a => a.salId===s.id && a.type !== 'travail' && a.fin >= range.debut && a.debut <= range.fin);
    const typeColors = { conge:'#3498db', absence:'#e74c3c', maladie:'#9b59b6' };
    const typeLabels = { conge:'ðŸ”µ CongÃ©', absence:'ðŸ”´ Absence', maladie:'ðŸŸ£ Maladie' };
    const absStr = absences.length
      ? absences.map(j=>`<span style="display:inline-block;background:${typeColors[j.typeJour]||'var(--muted)'}20;color:${typeColors[j.typeJour]||'var(--muted)'};padding:2px 8px;border-radius:12px;font-size:.72rem;margin:1px">${typeLabels[j.typeJour]||j.typeJour} ${j.jour.substring(0,3)}</span>`).join(' ')
      : '<span style="color:var(--text-muted);font-size:.78rem">â€”</span>';
    const absPeriodeStr = absencesPeriodeSemaine.map(a => `<span style="display:inline-block;background:${typeColors[a.type]||'var(--muted)'}20;color:${typeColors[a.type]||'var(--muted)'};padding:2px 8px;border-radius:12px;font-size:.72rem;margin:1px">${typeLabels[a.type]||a.type} ${formatDateExport(a.debut)} â†’ ${formatDateExport(a.fin)}</span>`).join(' ');

    return `<tr>
      <td><strong>${s.nom}</strong></td>
      <td style="font-size:.78rem;color:var(--text-muted)">${s.poste||'â€”'}</td>
      <td><strong>${planifiees.toFixed(1)} h</strong></td>
      <td style="font-size:.78rem;color:var(--text-muted)">${detailStr||'â€”'}</td>
      <td>${absPeriodeStr || absStr}</td>
      <td><button class="btn-icon" onclick="ouvrirEditPlanning('${s.id}')" title="Modifier le planning">âœï¸</button></td>
    </tr>`;
  }).join('');
}

function resetFiltresHeures() {
  ['filtre-heures-salarie'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  _heuresVue = 'semaine';
  _heuresSemaineOffset = 0;
  _heuresMoisOffset = 0;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}

function exporterRecapHeures() {
  const range = getHeuresPeriodeRange();
  const salaries = charger('salaries');
  const data = salaries.map(s => {
    const { planifiees, details } = calculerHeuresSalarieSemaine(s.id);
    return { nom: s.nom, poste: s.poste||'', numero: s.numero, planifiees, details };
  });
  exporterCSV(data, [
    { label:'Nom', get:d=>d.nom },
    { label:'Poste', get:d=>d.poste },
    { label:'NÂ° SalariÃ©', get:d=>d.numero },
    { label: range.mode === 'mois' ? 'H/mois' : 'H/semaine', get:d=>d.planifiees.toFixed(1) },
    { label:'DÃ©tail', get:d=>d.details.map(j=>`${j.jour.substring(0,3)} ${j.date}:${j.duree.toFixed(1)}h`).join(' ') },
  ], `recap_heures_${range.debut}_${range.fin}.csv`);
  afficherToast('âœ… Export heures tÃ©lÃ©chargÃ©');
}

/* ===== RH â€” NOTE INTERNE SALARIÃ‰ ===== */
function charger_note_interne(salId) {
  const notes = JSON.parse(localStorage.getItem('notes_internes')||'{}');
  return notes[salId]?.texte || '';
}

function chargerNoteInterne(salId) {
  const notes = JSON.parse(localStorage.getItem('notes_internes')||'{}');
  return notes[salId]?.texte || '';
}

function ouvrirNoteInterne(salId, salNom) {
  document.getElementById('note-interne-sal-id').value  = salId;
  document.getElementById('note-interne-sal-nom').textContent = salNom;
  document.getElementById('note-interne-texte').value   = chargerNoteInterne(salId);
  openModal('modal-note-interne');
}

function confirmerNoteInterne() {
  const salId = document.getElementById('note-interne-sal-id').value;
  const texte = document.getElementById('note-interne-texte').value;
  const notes = JSON.parse(localStorage.getItem('notes_internes')||'{}');
  notes[salId] = { texte, date: new Date().toISOString() };
  localStorage.setItem('notes_internes', JSON.stringify(notes));
  closeModal('modal-note-interne');
  afficherToast('ðŸ“ Note enregistrÃ©e');
}

/* ===== FLOTTE â€” PHOTO VÃ‰HICULE ===== */
function uploaderPhotoVehicule(vehId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    compresserImage(e.target.result, compressed => {
      const vehicules = charger('vehicules');
      const idx = vehicules.findIndex(v => v.id === vehId);
      if (idx > -1) {
        vehicules[idx].photo = compressed;
        sauvegarder('vehicules', vehicules);
        afficherVehicules();
        afficherToast('âœ… Photo enregistrÃ©e');
      }
    });
  };
  reader.readAsDataURL(file);
}

/* ===== FLOTTE â€” HISTORIQUE CONDUCTEURS ===== */
function ouvrirHistoriqueConducteurs(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId);
  if (!veh) return;
  document.getElementById('hist-cond-titre').textContent = `${veh.immat} â€” ${veh.modele||''}`;
  afficherHistoriqueConducteurs(vehId);
  openModal('modal-hist-conducteurs');
}
function enregistrerConduite(livraison) {
  if (!livraison.vehId || !livraison.chaufId) return;
  const cle  = 'conducteurs_veh_' + livraison.vehId;
  const hist = JSON.parse(localStorage.getItem(cle)||'[]');
  hist.push({
    salId:    livraison.chaufId,
    salNom:   livraison.chaufNom,
    date:     livraison.date,
    livNom:   livraison.client,
    numLiv:   livraison.numLiv||'',
    distance: livraison.distance||0
  });
  if (hist.length > 100) hist.shift();
  localStorage.setItem(cle, JSON.stringify(hist));
}

function afficherHistoriqueConducteurs(vehId) {
  const cle  = 'conducteurs_veh_' + vehId;
  const hist = JSON.parse(localStorage.getItem(cle)||'[]').reverse().slice(0, 50);
  // Afficher dans la modal ou dans un container inline
  const cont = document.getElementById('hist-conducteurs-modal') ||
               document.getElementById('hist-conducteurs-' + vehId);
  if (!cont) return;
  if (!hist.length) {
    cont.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:.85rem">Aucune conduite enregistrÃ©e pour ce vÃ©hicule.</div>';
    return;
  }
  cont.innerHTML = hist.map(h => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:.85rem">
      <div>
        <strong>${h.salNom}</strong>
        ${h.livNom ? `<span style="font-size:.78rem;color:var(--text-muted)"> Â· ${h.livNom}</span>` : ''}
        ${h.numLiv ? `<span style="font-size:.72rem;color:var(--text-muted)"> (${h.numLiv})</span>` : ''}
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        ${h.distance ? `<span style="font-size:.78rem;color:var(--accent)">${h.distance} km</span>` : ''}
        <span style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${h.date}</span>
      </div>
    </div>`).join('');
}

/* ===== MESSAGES AUTOMATIQUES BEST EFFORT ===== */
function verifierMessagesAuto() {
  if (!salarieCourant) return; // CÃ´tÃ© admin uniquement
  return; // Cette fonction est cÃ´tÃ© admin, pas salariÃ©
}

/* CÃ´tÃ© admin : vÃ©rifier si un salariÃ© commence bientÃ´t (H-15min) ou vient de finir (H+30min) */
function verifierTriggersPlanningAuto() {
  const salaries  = charger('salaries').filter(s=>s.actif);
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  const maintenant= new Date();
  const auj       = maintenant.toISOString().split('T')[0];
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

    // H-15min avant dÃ©part â†’ message de rappel tournÃ©e
    if (hMin >= debutMin-15 && hMin < debutMin && !localStorage.getItem(cleDep)) {
      const msgs = JSON.parse(localStorage.getItem('messages_'+s.id)||'[]');
      const prenom = s.nom.split(' ')[0];
      msgs.push({ id:genId(), auteur:'admin',
        texte:`Bonjour ${prenom} ðŸ‘‹ Votre tournÃ©e dÃ©marre Ã  ${jour.heureDebut}. Pensez Ã  faire votre inspection vÃ©hicule et votre relevÃ© km de dÃ©part. Bonne journÃ©e !`,
        lu:false, auto:true, creeLe:new Date().toISOString() });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      localStorage.setItem(cleDep, '1');
      mettreAJourBadgeMsgAdmin();
    }

    // H+30min aprÃ¨s fin â†’ rappel km retour
    if (hMin >= finMin+30 && hMin < finMin+60 && !localStorage.getItem(cleFin)) {
      const msgs = JSON.parse(localStorage.getItem('messages_'+s.id)||'[]');
      const prenom = s.nom.split(' ')[0];
      msgs.push({ id:genId(), auteur:'admin',
        texte:`Bonsoir ${prenom}, n'oubliez pas d'enregistrer votre km de retour et votre plein si vous en avez fait un. Merci ðŸ™`,
        lu:false, auto:true, creeLe:new Date().toISOString() });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      localStorage.setItem(cleFin, '1');
      mettreAJourBadgeMsgAdmin();
    }
  });
}

// VÃ©rifier toutes les minutes
setInterval(verifierTriggersPlanningAuto, 60000);

/* ===== MOBILE â€” SWIPE SIDEBAR ===== */
function initSwipeSidebar() {
  let startX = 0, isDragging = false;
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.changedTouches[0].clientX - startX;
    if (diff > 60 && startX < 40) ouvrirMenuMobile();
    if (diff < -60) fermerMenuMobile();
  }, { passive: true });
}

/* ===== MOBILE â€” PULL TO REFRESH ===== */
function initPullToRefresh() {
  // Uniquement sur mobile/tactile
  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) return;
  const main = document.getElementById('mainContent');
  if (!main) return;
  let startY = 0, pulling = false;
  const ind = document.getElementById('ptr-indicator');

  main.addEventListener('touchstart', e => {
    if (main.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 40 && ind) ind.classList.add('visible');
  }, { passive: true });

  main.addEventListener('touchend', e => {
    if (!pulling) return;
    pulling = false;
    const diff = e.changedTouches[0].clientY - startY;
    if (ind) ind.classList.remove('visible');
    if (diff > 80) {
      const page = document.querySelector('.page.active')?.id?.replace('page-','');
      if (page) naviguerVers(page);
      afficherToast('ðŸ”„ ActualisÃ©');
    }
  }, { passive: true });
}

/* ===== PIÃˆCES JOINTES MESSAGERIE ===== */
function envoyerMessageAvecPhoto(salId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    compresserImage(e.target.result, compressed => {
      const messages = JSON.parse(localStorage.getItem('messages_'+salId)||'[]');
      messages.push({
        id: genId(), auteur: 'admin',
        texte: 'ðŸ“· Photo partagÃ©e',
        photo: compressed,
        lu: false, creeLe: new Date().toISOString()
      });
      localStorage.setItem('messages_'+salId, JSON.stringify(messages));
      ouvrirConversation(salId);
      afficherToast('âœ… Photo envoyÃ©e');
    });
  };
  reader.readAsDataURL(file);
}

/* ===== SON / VIBRATION MESSAGES ===== */
/* ===== FICHE TOURNÃ‰E JOURNALIÃˆRE PDF ===== */
function genererFicheTournee(salId, date) {
  date = date || aujourdhui();
  const salaries   = charger('salaries');
  const sal        = salaries.find(s => s.id === salId);
  if (!sal) return;
  const livraisons = charger('livraisons').filter(l => l.chaufId === salId && l.date === date);
  const params     = getEntrepriseExportParams();
  const nom        = params.nom;
  const dateLabel  = formatDateExport(date);
  const veh        = charger('vehicules').find(v => v.salId === salId);
  const dateExp    = formatDateHeureExport();
  const totalKm    = livraisons.reduce((s,l)=>s+(l.distance||0),0);

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div>
        <div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Fiche de tournÃ©e</div>
        <div style="font-size:1rem;font-weight:700">${dateLabel}</div>
      </div>
    </div>
    ${renderBlocInfosEntreprise(params)}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:#f8f9fc;border-radius:10px;padding:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Chauffeur</div>
        <div style="font-size:1rem;font-weight:700">${sal.nom}</div>
        ${sal.tel?`<div style="font-size:.82rem;color:#6b7280">ðŸ“ž ${sal.tel}</div>`:''}
      </div>
      <div style="background:#f8f9fc;border-radius:10px;padding:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">VÃ©hicule</div>
        <div style="font-size:1rem;font-weight:700">${veh?.immat||'Non affectÃ©'}</div>
        <div style="font-size:.82rem;color:#6b7280">${veh?.modele||''}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px">
      ${[
        ['ðŸ“¦ Livraisons', livraisons.length],
        ['ðŸ›£ï¸ Km estimÃ©s', totalKm+' km'],
      ].map(([l,v])=>`<div style="background:#f8f9fc;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:.72rem;color:#9ca3af;margin-bottom:4px">${l}</div>
        <div style="font-size:1.2rem;font-weight:800">${v}</div>
      </div>`).join('')}
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:10px">DÃ©tail des livraisons</div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">#</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Client</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Adresse</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600;color:#6b7280">Km</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#6b7280">Statut</th>
        </tr></thead>
        <tbody>${livraisons.length === 0
          ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af">Aucune livraison assignÃ©e</td></tr>`
          : livraisons.map((l,i)=>`
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:8px 12px;color:#9ca3af">${i+1}</td>
            <td style="padding:8px 12px;font-weight:600">${l.client}</td>
            <td style="padding:8px 12px;color:#6b7280;font-size:.82rem">${l.arrivee||l.depart||'â€”'}</td>
            <td style="padding:8px 12px;text-align:right">${l.distance?l.distance+' km':'â€”'}</td>
            <td style="padding:8px 12px;text-align:center">${l.statut==='livre'?'âœ…':l.statut==='en-cours'?'ðŸš':'â³'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:20px;min-height:60px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Observations / Signature chauffeur</div>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
      <span>${nom} â€” Page 1/1</span><span>${dateExp}</span><span>${params.tel || params.email || ''}</span>
    </div>
  </div>`;

  const win = window.open('', '_blank', 'width=850,height:950');
  win.document.write(`<!DOCTYPE html><html><head><title>TournÃ©e ${sal.nom} â€” ${date}</title>
    <style>body{margin:0;padding:20px;background:#fff} @page{margin:12mm}</style>
    </head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('ðŸ“„ Fiche de tournÃ©e gÃ©nÃ©rÃ©e');
}

/* ===== GOOGLE MAPS â€” DISTANCE AUTO ===== */
/* ===== VUE COMPACTE / Ã‰TENDUE ===== */
let _tableauCompact = false;
function initDensiteTableau() {
  _tableauCompact = localStorage.getItem('tableau_compact') === '1';
  if (_tableauCompact) document.querySelectorAll('.data-table').forEach(t => t.classList.add('compact'));
  const btn = document.getElementById('btn-densite');
  if (btn) { btn.textContent = _tableauCompact ? 'âŠž Ã‰tendu' : 'âŠŸ Compact'; btn.classList.toggle('active', _tableauCompact); }
}

/* ===== MODÃˆLES DE MESSAGES ===== */
const MSG_TEMPLATES = [
  { label: 'ðŸš€ TournÃ©e prÃªte',   texte: 'Bonjour [prÃ©nom] ðŸ‘‹ Votre tournÃ©e du jour est prÃªte. VÃ©rifiez vos livraisons dans l\'onglet Livraisons. Bonne journÃ©e !' },
  { label: 'ðŸ›£ï¸ RelevÃ© km',       texte: 'Rappel : pensez Ã  enregistrer votre relevÃ© kilomÃ©trique de retour dans l\'onglet Inspection & Km. Merci !' },
  { label: 'ðŸš— Inspection',      texte: 'Rappel : inspection vÃ©hicule obligatoire avant le dÃ©part. Prenez les 4 photos demandÃ©es. Merci !' },
  { label: 'â›½ Plein',           texte: 'Si vous avez fait le plein aujourd\'hui, n\'oubliez pas de le saisir dans l\'onglet Carburant. Merci !' },
  { label: 'âœ… Bonne journÃ©e',   texte: 'Bonjour Ã  tous ! Bonne journÃ©e de livraisons. Restez prudents sur la route ðŸš' },
];

function insererTemplate(texte, salNom) {
  const input = document.getElementById('msg-admin-input');
  if (!input) return;
  input.value = texte.replace('[prÃ©nom]', salNom || '');
  input.focus();
  input.dispatchEvent(new Event('input'));
}

function afficherTemplatesMsg(salNom) {
  const bar = document.getElementById('msg-templates-bar');
  if (!bar) return;
  bar.innerHTML = MSG_TEMPLATES.map(t =>
    `<button class="msg-template-btn" onclick="insererTemplate('${t.texte.replace(/'/g,"\\'")}','${salNom||''}')">${t.label}</button>`
  ).join('');
}

/* ===== MESSAGES AUTOMATIQUES "BEST EFFORT" ===== */
function verifierMessagesAutomatiques() {
  if (!document || document.hidden) return; // Ne pas jouer si l'onglet est en arriÃ¨re-plan
  const salaries  = charger('salaries').filter(s => s.actif);
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  const auj       = aujourdhui();
  const heure     = new Date().getHours();
  const minute    = new Date().getMinutes();
  const cle       = 'msg_auto_' + auj;
  const deja      = JSON.parse(localStorage.getItem(cle)||'{}');

  salaries.forEach(s => {
    const plan = plannings.find(p => p.salId === s.id);
    const jourNom = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][new Date().getDay()];
    const jour = plan?.semaine?.find(j => j.jour === jourNom);
    if (!jour?.travaille || !jour.heureDebut || !jour.heureFin) return;

    const [hDeb, mDeb] = jour.heureDebut.split(':').map(Number);
    const [hFin, mFin] = jour.heureFin.split(':').map(Number);
    const minutesDep = hDeb * 60 + mDeb;
    const minutesFin = hFin * 60 + mFin;
    const maintenant = heure * 60 + minute;

    // Rappel dÃ©part : fenÃªtre H-20min Ã  H-10min
    if (maintenant >= minutesDep - 20 && maintenant <= minutesDep - 10 && !deja[s.id + '_depart']) {
      const msgs = JSON.parse(localStorage.getItem('messages_'+s.id)||'[]');
      msgs.push({ id:genId(), auteur:'admin', texte:`ðŸš€ Rappel automatique â€” Votre tournÃ©e commence Ã  ${jour.heureDebut}. Pensez Ã  faire votre inspection et votre relevÃ© km de dÃ©part. Bonne journÃ©e ${s.nom} !`, lu:false, creeLe:new Date().toISOString(), auto:true });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      deja[s.id + '_depart'] = true;
    }

    // Rappel retour : fenÃªtre H+25min Ã  H+35min
    if (maintenant >= minutesFin + 25 && maintenant <= minutesFin + 35 && !deja[s.id + '_retour']) {
      const msgs = JSON.parse(localStorage.getItem('messages_'+s.id)||'[]');
      msgs.push({ id:genId(), auteur:'admin', texte:`ðŸŒ™ Fin de journÃ©e ${s.nom} â€” N'oubliez pas d'enregistrer votre km de retour et votre plein si effectuÃ©. Bonne soirÃ©e ! ðŸ™`, lu:false, creeLe:new Date().toISOString(), auto:true });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      deja[s.id + '_retour'] = true;
    }
  });

  localStorage.setItem(cle, JSON.stringify(deja));
}

/* ===== TAUX DE PONCTUALITÃ‰ ===== */
function calculerTauxPonctualite() {
  const livraisons = charger('livraisons');
  const total  = livraisons.filter(l => l.statut !== 'en-attente').length;
  const livres = livraisons.filter(l => l.statut === 'livre').length;
  if (!total) return { taux: 0, livres, total };
  return { taux: Math.round(livres / total * 100), livres, total };
}

/* ===== TABLEAU DE BORD CLIENTS ===== */
function afficherTopClients() {
  const livraisons = charger('livraisons');
  const clients    = JSON.parse(localStorage.getItem('clients')||'[]');
  const cont       = document.getElementById('top-clients-list');
  if (!cont) return;

  // AgrÃ©ger par client
  const stats = {};
  livraisons.forEach(l => {
    const nom = l.client;
    if (!stats[nom]) stats[nom] = { nom, ca:0, nb:0, impaye:0, derniere:'' };
    stats[nom].ca += l.prix || 0;
    stats[nom].nb++;
    if ((l.statutPaiement === 'en-attente' || !l.statutPaiement) && l.statut === 'livre') stats[nom].impaye += l.prix||0;
    if (!stats[nom].derniere || l.date > stats[nom].derniere) stats[nom].derniere = l.date;
  });

  const sorted = Object.values(stats).sort((a,b) => b.ca - a.ca).slice(0, 8);
  if (!sorted.length) { cont.innerHTML = '<div class="empty-illustrated"><div class="ei-icon">ðŸ§‘â€ðŸ’¼</div><div class="ei-title">Aucun client</div></div>'; return; }

  const medals = ['ðŸ¥‡','ðŸ¥ˆ','ðŸ¥‰'];
  cont.innerHTML = sorted.map((c, i) => `
    <div class="client-score">
      <span class="client-score-rank">${medals[i] || (i+1)}</span>
      <div class="client-score-info">
        <div style="font-weight:600">${c.nom}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${c.nb} livraison(s) Â· DerniÃ¨re : ${c.derniere||'â€”'}</div>
        ${c.impaye > 0 ? `<div style="font-size:.72rem;color:var(--red)">âš ï¸ ${euros(c.impaye)} impayÃ©</div>` : ''}
      </div>
      <span class="client-score-ca">${euros(c.ca)}</span>
    </div>`).join('');
}

/* ===== SUIVI CONGÃ‰S / ABSENCES ===== */
/* ===== BROADCAST MESSAGE ===== */
function envoyerBroadcast() {
  const texte = document.getElementById('broadcast-texte')?.value.trim();
  if (!texte) { afficherToast('âš ï¸ Saisissez un message', 'error'); return; }
  const destinataires = getBroadcastDestinataires();
  if (!destinataires.length) { afficherToast('âš ï¸ Aucun destinataire sÃ©lectionnÃ©', 'error'); return; }
  destinataires.forEach(s => {
    const msgs = JSON.parse(localStorage.getItem('messages_'+s.id)||'[]');
    msgs.push({ id: genId(), auteur:'admin', texte, lu:false, creeLe: new Date().toISOString() });
    localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
  });
  const el = document.getElementById('broadcast-texte');
  if (el) el.value = '';
  mettreAJourBadgeMsgAdmin();
  afficherMessagerie();
  afficherToast(`âœ… Message envoyÃ© Ã  ${destinataires.length} salariÃ©(s)`);
}

/* ===== ALERTES PERMIS / ASSURANCE ===== */
function verifierDocumentsSalaries() {
  const salaries = charger('salaries');
  const auj   = new Date();
  const dans30 = new Date(); dans30.setDate(auj.getDate()+30);
  const dans60 = new Date(); dans60.setDate(auj.getDate()+60);

  salaries.forEach(s => {
    if (s.datePermis) {
      const d = new Date(s.datePermis);
      if (d < auj) ajouterAlerteSiAbsente('permis_expire', `âš ï¸ Permis expirÃ© â€” ${s.nom}`, { salId:s.id, salNom:s.nom });
      else if (d < dans60) ajouterAlerteSiAbsente('permis_proche', `ðŸªª Permis expire bientÃ´t â€” ${s.nom} (${s.datePermis})`, { salId:s.id, salNom:s.nom });
    }
    if (s.dateAssurance) {
      const d = new Date(s.dateAssurance);
      if (d < auj) ajouterAlerteSiAbsente('assurance_expire', `âš ï¸ Assurance expirÃ©e â€” ${s.nom}`, { salId:s.id, salNom:s.nom });
      else if (d < dans30) ajouterAlerteSiAbsente('assurance_proche', `ðŸ›¡ï¸ Assurance expire bientÃ´t â€” ${s.nom} (${s.dateAssurance})`, { salId:s.id, salNom:s.nom });
    }
  });
  afficherBadgeAlertes();
}

/* ===== TEMPLATES SMS ===== */
const TEMPLATES_SMS = [
  { id:1, titre:'Avis de passage',    texte:"Bonjour, votre livreur [NOM] sera chez vous prochainement. MCA Logistics." },
  { id:2, titre:'Livraison effectuÃ©e',texte:"Votre commande a Ã©tÃ© livrÃ©e par [NOM]. Merci de votre confiance. MCA Logistics." },
  { id:3, titre:'Retard',             texte:"Nous vous informons d\u2019un lÃ©ger retard sur votre livraison. Merci de votre comprÃ©hension. MCA Logistics." },
  { id:4, titre:'Tentative Ã©chouÃ©e',  texte:"Nous avons tentÃ© de vous livrer sans succÃ¨s. Merci de nous recontacter. MCA Logistics." },
];

function afficherTemplatesSMS() {
  const cont = document.getElementById('templates-sms-list');
  if (!cont) return;
  cont.innerHTML = TEMPLATES_SMS.map(t => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">${t.titre}</div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;font-style:italic">${t.texte}</div>
      <button class="btn-secondary" style="font-size:.75rem;padding:4px 10px"
        onclick="copierTemplateSMS('${t.id}')">ðŸ“‹ Copier</button>
    </div>`).join('');
}

function copierTemplateSMS(id) {
  const t = TEMPLATES_SMS.find(x=>x.id===parseInt(id));
  if (!t) return;
  navigator.clipboard?.writeText(t.texte).then(()=>{
    afficherToast('ðŸ“‹ Template SMS copiÃ© dans le presse-papier');
  }).catch(()=>{
    // Fallback si clipboard non disponible
    const ta = document.createElement('textarea');
    ta.value = t.texte; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    afficherToast('ðŸ“‹ Template SMS copiÃ©');
  });
}

/* ===== RACCOURCIS CLAVIER ===== */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey || e.metaKey) {
    switch(e.key) {
      case 'n': e.preventDefault(); openModal('modal-livraison'); break;
    }
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ===== RECHERCHE UNIVERSELLE ===== */
function rechercheUniverselle(q) {
  const cont = document.getElementById('recherche-resultats');
  if (!cont) return;
  if (!q || q.length < 2) { cont.style.display='none'; return; }
  q = q.toLowerCase();
  const livraisons = charger('livraisons');
  const salaries   = charger('salaries');
  const vehicules  = charger('vehicules');
  const clients    = JSON.parse(localStorage.getItem('clients')||'[]');
  const res = [];

  livraisons.filter(l => (l.client||'').toLowerCase().includes(q)||(l.numLiv||'').toLowerCase().includes(q)||(l.chaufNom||'').toLowerCase().includes(q))
    .slice(0,4).forEach(l => res.push({ label:`ðŸ“¦ ${l.numLiv||''} â€” ${l.client}`, sub:`${l.date} Â· ${euros(l.prix||0)}`, action:`naviguerVers('livraisons')` }));
  salaries.filter(s => s.nom.toLowerCase().includes(q)||s.numero.toLowerCase().includes(q))
    .slice(0,3).forEach(s => res.push({ label:`ðŸ‘¤ ${s.nom}`, sub:`NÂ° ${s.numero}`, action:`naviguerVers('salaries')` }));
  vehicules.filter(v => v.immat.toLowerCase().includes(q)||(v.modele||'').toLowerCase().includes(q))
    .slice(0,3).forEach(v => res.push({ label:`ðŸš ${v.immat}`, sub:v.modele||'', action:`naviguerVers('vehicules')` }));
  clients.filter(c => c.nom.toLowerCase().includes(q))
    .slice(0,3).forEach(c => res.push({ label:`ðŸ§‘â€ðŸ’¼ ${c.nom}`, sub:c.adresse||c.tel||'', action:`naviguerVers('livraisons')` }));

  if (!res.length) { cont.innerHTML='<div style="padding:10px 14px;color:var(--text-muted);font-size:.85rem">Aucun rÃ©sultat</div>'; cont.style.display='block'; return; }
  cont.innerHTML = res.map(r => `
    <div onclick="${r.action};fermerRecherche()" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">
      <div style="font-size:.88rem;font-weight:500">${r.label}</div>
      ${r.sub?`<div style="font-size:.76rem;color:var(--text-muted)">${r.sub}</div>`:''}
    </div>`).join('');
  cont.style.display = 'block';
}
function fermerRecherche() {
  const el = document.getElementById('recherche-resultats');
  if (el) el.style.display='none';
  const input = document.getElementById('barre-recherche-univ');
  if (input) input.value = '';
}

/* ===== CARNET CLIENTS ===== */
function afficherClients() {
  const clients = JSON.parse(localStorage.getItem('clients')||'[]');
  const tb = document.getElementById('tb-clients');
  if (!tb) return;
  if (!clients.length) { tb.innerHTML=emptyState('ðŸ§‘â€ðŸ’¼','Aucun client enregistrÃ©','Enregistrez vos clients pour activer l\'auto-complÃ©tion lors de la crÃ©ation des livraisons.','+ Nouveau client',"openModal('modal-client')"); return; }
  const livraisons = charger('livraisons');
  tb.innerHTML = clients.map(c => {
    const livsC = livraisons.filter(l => l.client === c.nom || l.clientId === c.id);
    const caC   = livsC.reduce((s,l)=>s+(l.prix||0),0);
    return `<tr>
      <td><strong>${c.nom}</strong></td>
      <td>${c.tel||'â€”'}</td>
      <td style="font-size:.82rem">${c.adresse||'â€”'}</td>
      <td>${livsC.length} Â· ${euros(caC)}</td>
      <td>
        <button class="btn-icon" onclick="preFillLivraisonClient('${c.id}')">ðŸ“¦</button>
        <button class="btn-icon danger" onclick="supprimerClient('${c.id}')">ðŸ—‘ï¸</button>
      </td>
    </tr>`;
  }).join('');
}

function ajouterClient() {
  const nom     = document.getElementById('cl-nom')?.value.trim();
  const prenom  = document.getElementById('cl-prenom')?.value.trim() || '';
  const tel     = document.getElementById('cl-tel')?.value.trim();
  const adresse = document.getElementById('cl-adresse')?.value.trim();
  if (!nom) { afficherToast('âš ï¸ Nom obligatoire','error'); return; }
  const clients = JSON.parse(localStorage.getItem('clients')||'[]');
  if (clients.find(c=>c.nom.toLowerCase()===nom.toLowerCase())) { afficherToast('âš ï¸ Client dÃ©jÃ  existant','error'); return; }
  clients.push({ id:genId(), nom, prenom, tel, adresse, creeLe:new Date().toISOString() });
  localStorage.setItem('clients', JSON.stringify(clients));
  ['cl-nom','cl-prenom','cl-tel','cl-adresse'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  closeModal('modal-client');
  afficherClients();
  afficherToast('âœ… Client ajoutÃ©');
}

async function supprimerClient(id) {
  const _ok6 = await confirmDialog('Supprimer ce client ?', {titre:'Supprimer le client',icone:'ðŸ§‘â€ðŸ’¼',btnLabel:'Supprimer'});
  if (!_ok6) return;
  const clients = JSON.parse(localStorage.getItem('clients')||'[]').filter(c=>c.id!==id);
  localStorage.setItem('clients', JSON.stringify(clients));
  afficherClients();
  afficherToast('ðŸ—‘ï¸ Client supprimÃ©');
}

function preFillLivraisonClient(id) {
  const c = JSON.parse(localStorage.getItem('clients')||'[]').find(x=>x.id===id);
  if (!c) return;
  naviguerVers('livraisons');
  setTimeout(()=>{
    openModal('modal-livraison');
    setTimeout(()=>{
      const el = document.getElementById('liv-client'); if(el) el.value = c.prenom ? `${c.nom} ${c.prenom}` : c.nom;
      const zone = document.getElementById('liv-zone'); if(zone&&c.adresse) zone.value=c.adresse;
      const dep = document.getElementById('liv-depart'); if(dep&&c.adresse) dep.value=c.adresse;
      const arr = document.getElementById('liv-arrivee'); if(arr) arr.value='';
    },100);
  },100);
}

/* Auto-complÃ©tion client dans modal livraison */
function autoCompleteClient(val) {
  const clients = JSON.parse(localStorage.getItem('clients')||'[]');
  const sug = document.getElementById('client-suggestions');
  if (!sug || !val || val.length < 2) { if(sug) sug.innerHTML=''; return; }
  const matches = clients.filter(c=>c.nom.toLowerCase().includes(val.toLowerCase())).slice(0,5);
  sug.innerHTML = matches.map(c=>`<div onclick="document.getElementById('liv-client').value='${c.nom}';if(document.getElementById('liv-zone')&&'${c.adresse}')document.getElementById('liv-zone').value='${c.adresse}';if(document.getElementById('liv-depart')&&'${c.adresse}')document.getElementById('liv-depart').value='${c.adresse}';if(document.getElementById('liv-arrivee'))document.getElementById('liv-arrivee').value='';this.parentElement.innerHTML=''" style="padding:7px 12px;cursor:pointer;font-size:.88rem;border-bottom:1px solid var(--border)" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">${c.nom}${c.adresse?`<span style='color:var(--text-muted);font-size:.78rem;margin-left:6px'>${c.adresse}</span>`:''}</div>`).join('');
}

/* ===== COPIER PLANNING SEMAINE PRÃ‰CÃ‰DENTE ===== */
function copierSemainePrecedente() {
  const salId = document.getElementById('plan-salarie').value;
  if (!salId) { afficherToast('âš ï¸ Choisissez un salariÃ©','error'); return; }
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  const plan = plannings.find(p=>p.salId===salId);
  if (!plan?.semaine?.length) { afficherToast('âš ï¸ Aucun planning prÃ©cÃ©dent Ã  copier','error'); return; }
  // PrÃ©-remplir la grille avec les donnÃ©es existantes
  JOURS.forEach(jour => {
    const j = plan.semaine.find(s=>s.jour===jour);
    const cb = document.getElementById('plan-travaille-'+jour);
    if (cb && j) {
      cb.checked = j.travaille;
      toggleJourPlanning(jour);
      if (j.travaille) {
        const d=document.getElementById('plan-debut-'+jour); if(d) d.value=j.heureDebut||'';
        const f=document.getElementById('plan-fin-'+jour);   if(f) f.value=j.heureFin||'';
        const z=document.getElementById('plan-zone-'+jour);  if(z) z.value=j.zone||'';
        const n=document.getElementById('plan-note-'+jour);  if(n) n.value=j.note||'';
      }
    }
  });
  afficherToast('âœ… Semaine prÃ©cÃ©dente copiÃ©e â€” modifiez si nÃ©cessaire');
}

/* ===== DÃ‰CONNEXION AUTO ADMIN (30 min inactivitÃ©) ===== */
let _timerInactivite = null;
function resetTimerInactivite() {
  clearTimeout(_timerInactivite);
  _timerInactivite = setTimeout(() => {
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('auth_mode');
    sessionStorage.removeItem('admin_login');
    sessionStorage.removeItem('admin_email');
    sessionStorage.removeItem('admin_nom');
    alert('â±ï¸ Session expirÃ©e aprÃ¨s 30 min d\'inactivitÃ©. Reconnectez-vous.');
    window.location.href = 'login.html';
  }, 30 * 60 * 1000);
}
['click','keydown','mousemove','scroll'].forEach(ev => document.addEventListener(ev, resetTimerInactivite, { passive:true }));

/* ===== PARAMÃˆTRES ADMIN ===== */
function toggleParamMdp(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function changerMdpAdmin() {
  const actuel    = document.getElementById('param-mdp-actuel').value;
  const nouveau   = document.getElementById('param-mdp-nouveau').value;
  const confirmer = document.getElementById('param-mdp-confirmer').value;
  if (!actuel || !nouveau || !confirmer) { afficherToast('âš ï¸ Remplissez tous les champs', 'error'); return; }
  const sessionAdmin = getAdminSession();
  const comptes = getAdminAccounts();
  const idx = comptes.findIndex(c => c.identifiant === sessionAdmin.identifiant);
  if (idx === -1) { afficherToast('âš ï¸ Session administrateur introuvable', 'error'); return; }
  if (actuel !== comptes[idx].motDePasse) { afficherToast('âš ï¸ Mot de passe actuel incorrect', 'error'); return; }
  if (nouveau.length < 4) { afficherToast('âš ï¸ Nouveau mot de passe trop court (4 min)', 'error'); return; }
  if (nouveau !== confirmer) { afficherToast('âš ï¸ Les mots de passe ne correspondent pas', 'error'); return; }
  const client = getSupabaseClientSafe();
  const supabaseReady = !!(window.DelivProSupabase && window.DelivProSupabase.isReady && window.DelivProSupabase.isReady());
  if (supabaseReady) {
    if (sessionAdmin.authMode !== 'supabase' || !client) {
      afficherToast('âš ï¸ Connectez-vous via Supabase pour changer un mot de passe admin synchronisÃ©.', 'error');
      return;
    }
  }
  if (supabaseReady) {
    const sessionResult = await client.auth.getSession();
    if (!sessionResult?.data?.session) {
      afficherToast('âš ï¸ Session Supabase administrateur introuvable. Reconnectez-vous.', 'error');
      return;
    }
    const updateResult = await client.auth.updateUser({ password: nouveau });
    if (updateResult.error) {
      afficherToast(`âš ï¸ Mot de passe Supabase non mis Ã  jour (${updateResult.error.message})`, 'error');
      return;
    }
  }
  comptes[idx].motDePasse = nouveau;
  saveAdminAccounts(comptes);
  ['param-mdp-actuel','param-mdp-nouveau','param-mdp-confirmer'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  afficherToast(supabaseReady ? 'âœ… Mot de passe administrateur mis Ã  jour et synchronisÃ© avec Supabase' : 'âœ… Mot de passe administrateur mis Ã  jour pour votre compte');
}

function sauvegarderObjectifCA() {
  const val = parseFloat(document.getElementById('param-objectif-ca')?.value) || 0;
  localStorage.setItem('objectif_ca_mensuel', val);
  afficherToast('âœ… Objectif CA enregistrÃ© : ' + euros(val));
}

function chargerParametres() {
  const params = chargerObj('params_entreprise', {});
  const sessionAdmin = getAdminSession();
  const map = {
    'param-nom-entreprise':  params.nom      || '',
    'param-nom-admin':       sessionAdmin.nom || '',
    'param-siret':           params.siret    || '',
    'param-adresse':         params.adresse  || '',
    'param-tel-entreprise':  params.tel      || '',
    'param-email':           params.email    || ''
  };
  Object.entries(map).forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.value=val; });
  const colorEl = document.getElementById('param-accent-color');
  if (colorEl) colorEl.value = localStorage.getItem('accent_color') || '#f5a623';
  const maxTentEl = document.getElementById('param-max-tentatives');
  if (maxTentEl) maxTentEl.value = localStorage.getItem('max_tentatives') || '5';
  const compteEl = document.getElementById('param-admin-compte');
  if (compteEl) compteEl.textContent = 'Compte connectÃ© : ' + (sessionAdmin.identifiant || 'â€”');
  appliquerBranding();
  afficherPostes();
  majResumeSauvegardeAdmin();
}

/* ===== GESTION DES POSTES ===== */
function getPostes() { return JSON.parse(localStorage.getItem('postes')||'["Livreur","Dispatcher"]'); }
function sauvegarderPostes(postes) { localStorage.setItem('postes', JSON.stringify(postes)); }

function afficherPostes() {
  const postes = getPostes();
  const cont = document.getElementById('liste-postes');
  if (!cont) return;
  cont.innerHTML = postes.map((p,i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.25);color:var(--accent);padding:5px 12px;border-radius:20px;font-size:.82rem;font-weight:600">
      ${p}
      <button onclick="supprimerPoste(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:.9rem;padding:0;line-height:1" title="Supprimer">âœ•</button>
    </span>`).join('');
  // Mettre Ã  jour les selects de poste partout
  majSelectsPostes();
}

function ajouterPoste() {
  const input = document.getElementById('nouveau-poste');
  const nom = input?.value.trim();
  if (!nom) { afficherToast('âš ï¸ Nom du poste vide','error'); return; }
  const postes = getPostes();
  if (postes.find(p=>p.toLowerCase()===nom.toLowerCase())) { afficherToast('âš ï¸ Ce poste existe dÃ©jÃ ','error'); return; }
  postes.push(nom);
  sauvegarderPostes(postes);
  input.value = '';
  afficherPostes();
  afficherToast('âœ… Poste ajoutÃ© : ' + nom);
}

function supprimerPoste(idx) {
  const postes = getPostes();
  postes.splice(idx, 1);
  sauvegarderPostes(postes);
  afficherPostes();
  afficherToast('ðŸ—‘ï¸ Poste supprimÃ©');
}

function majSelectsPostes() {
  const postes = getPostes();
  ['nsal-poste','edit-sal-poste'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const v = sel.value;
    // Si c'est un select (pas un input text)
    if (sel.tagName === 'SELECT') {
      sel.innerHTML = '<option value="">-- Choisir un poste --</option>';
      postes.forEach(p => { sel.innerHTML += `<option value="${p}">${p}</option>`; });
      sel.value = v;
    }
  });
}

function sauvegarderParametres() {
  const sessionAdmin = getAdminSession();
  const adminNomSaisi = document.getElementById('param-nom-admin')?.value.trim() || 'Admin';
  const adminNom = window.DelivProAuth && typeof window.DelivProAuth.normalizeAdminDisplayName === 'function'
    ? window.DelivProAuth.normalizeAdminDisplayName(adminNomSaisi, sessionAdmin.identifiant, sessionAdmin.email)
    : adminNomSaisi;
  const params = {
    nom:      document.getElementById('param-nom-entreprise')?.value.trim() || 'MCA Logistics',
    nomAdmin: chargerObj('params_entreprise', {}).nomAdmin || '',
    siret:    document.getElementById('param-siret')?.value.trim()           || '',
    adresse:  document.getElementById('param-adresse')?.value.trim()         || '',
    tel:      document.getElementById('param-tel-entreprise')?.value.trim()  || '',
    email:    document.getElementById('param-email')?.value.trim()           || ''
  };
  sauvegarder('params_entreprise', params);
  const comptes = getAdminAccounts();
  const idx = comptes.findIndex(c => c.identifiant === sessionAdmin.identifiant);
  if (idx > -1) {
    comptes[idx].nom = adminNom;
    saveAdminAccounts(comptes);
  }
  sessionStorage.setItem('admin_nom', adminNom);
  chargerNomEntreprise();
  appliquerBranding();
  afficherToast('âœ… ParamÃ¨tres enregistrÃ©s');
}

function changerLogoEntreprise(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    localStorage.setItem('logo_entreprise', reader.result);
    appliquerBranding();
    afficherToast('âœ… Logo mis Ã  jour');
    if (input) input.value = '';
  };
  reader.readAsDataURL(file);
}

function supprimerLogoEntreprise() {
  localStorage.removeItem('logo_entreprise');
  const input = document.getElementById('param-logo-file');
  if (input) input.value = '';
  appliquerBranding();
  afficherToast('ðŸ—‘ï¸ Logo supprimÃ©');
}

function sauvegarderTVA() {
  const taux = parseFloat(document.getElementById('param-taux-tva')?.value) || 20;
  localStorage.setItem('taux_tva', taux);
  afficherToast('âœ… Taux TVA enregistrÃ© : ' + taux + '%');
}

function sauvegarderObjectifLivraisons() {
  const val = parseInt(document.getElementById('param-objectif-livraisons')?.value) || 0;
  localStorage.setItem('objectif_livraisons_mensuel', val);
  afficherToast('âœ… Objectif ' + val + ' livraisons/mois enregistrÃ©');
}

function sauvegarderMaxTentatives() {
  const val = parseInt(document.getElementById('param-max-tentatives')?.value) || 5;
  localStorage.setItem('max_tentatives', val);
  afficherToast('âœ… Blocage aprÃ¨s ' + val + ' tentatives');
}

function sauvegarderRelanceDelai() {
  const val = parseInt(document.getElementById('relance-delai-input')?.value || document.getElementById('param-relance-delai')?.value) || 7;
  localStorage.setItem('relance_delai', val);
  // Synchroniser les deux inputs
  const p = document.getElementById('param-relance-delai'); if (p) p.value = val;
  const r = document.getElementById('relance-delai-input'); if (r) r.value = val;
  afficherToast('âœ… DÃ©lai relance : ' + val + ' jours');
}

function appliquerAccentColor() {
  const color = document.getElementById('param-accent-color')?.value || '#f5a623';
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('accent_color', color);
  afficherToast('ðŸŽ¨ Couleur appliquÃ©e');
}

function majResumeSauvegardeAdmin() {
  const cleEl = document.getElementById('backup-stat-cles');
  const dateEl = document.getElementById('backup-stat-date');
  if (cleEl) cleEl.textContent = String(localStorage.length);
  const last = localStorage.getItem('backup_admin_last_export');
  if (dateEl) dateEl.textContent = last ? formatDateHeureExport(last) : 'Jamais';
}

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

function exporterSauvegardeAdmin() {
  const payload = construireSauvegardeAdmin();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date();
  const stamp = date.getFullYear() + String(date.getMonth()+1).padStart(2,'0') + String(date.getDate()).padStart(2,'0') + '-' + String(date.getHours()).padStart(2,'0') + String(date.getMinutes()).padStart(2,'0');
  link.href = url;
  link.download = 'mca-logistics-backup-' + stamp + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem('backup_admin_last_export', payload.exportedAt);
  majResumeSauvegardeAdmin();
  afficherToast('Sauvegarde tÃ©lÃ©chargÃ©e');
}

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
    const ok = await confirmDialog('Restaurer cette sauvegarde va remplacer les donnÃ©es actuelles de lâ€™application sur ce navigateur. Continuer ?', { titre:'Restaurer une sauvegarde', icone:'ðŸ’¾', btnLabel:'Restaurer' });
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
    afficherToast('Sauvegarde restaurÃ©e');
    setTimeout(() => window.location.reload(), 300);
  } catch (err) {
    console.error(err);
    afficherToast('Impossible de restaurer ce fichier', 'error');
    if (input) input.value = '';
  }
}

/* ===== HT / TVA ===== */
function prixHT(prixTTC, tauxTVA) {
  return prixTTC / (1 + tauxTVA / 100);
}
function getTauxTVA() {
  return parseFloat(localStorage.getItem('taux_tva') || '20');
}
/* ===== SOLDE TRÃ‰SORERIE ===== */
function calculerSoldeTresorerie() {
  const mois      = aujourdhui().slice(0,7);
  const livraisons= charger('livraisons').filter(l => (l.date||'').startsWith(mois));
  const carburant = charger('carburant').filter(p => (p.date||'').startsWith(mois));
  const charges   = charger('charges').filter(c => (c.date||'').startsWith(mois));

  const encaisse  = livraisons.filter(l => l.statutPaiement==='payÃ©').reduce((s,l)=>s+(l.prix||0), 0);
  const depenses  = carburant.reduce((s,p)=>s+(p.total||0), 0)
                  + charges.reduce((s,c)=>s+(c.montant||0), 0);
  return { encaisse, depenses, solde: encaisse - depenses };
}

/* ===== CATÃ‰GORIES DE CHARGES ===== */
function afficherCharges() {
  var moisStr = getChargesMoisStr();
  var charges = charger('charges').filter(function(c){return (c.date||'').startsWith(moisStr);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  const tb = document.getElementById('tb-charges');
  if (!tb) return;

  if (!charges.length) { tb.innerHTML = emptyState('ðŸ’¸','Aucune charge ce mois','Changez de mois ou ajoutez une charge.'); return; }

  const total = charges.reduce((s,c)=>s+(c.montant||0),0);
  const totalEl = document.getElementById('charges-total-mois');
  if (totalEl) totalEl.textContent = euros(total);

  const catIcons = { carburant:'â›½', peage:'ðŸ›£ï¸', entretien:'ðŸ”§', assurance:'ðŸ›¡ï¸', autre:'ðŸ“' };
  tb.innerHTML = charges.map(c => {
    const ht = c.montantHT || (c.montant||0) / (1 + (c.tauxTVA||20)/100);
    const tvaM = (c.montant||0) - ht;
    return `<tr>
    <td>${c.date}</td>
    <td><span class="charge-cat-badge charge-cat-${c.categorie||'autre'}">${catIcons[c.categorie]||'ðŸ“'} ${c.categorie||'autre'}</span></td>
    <td>${c.description||'â€”'}</td>
    <td>${c.vehNom||'â€”'}</td>
    <td style="font-size:.85rem">${euros(ht)}</td>
    <td style="font-size:.82rem;color:var(--text-muted)">${euros(tvaM)}</td>
    <td><strong>${euros(c.montant||0)}</strong></td>
    <td>
      <button class="btn-icon danger" onclick="supprimerCharge('${c.id}')">ðŸ—‘ï¸</button>
    </td>
  </tr>`;
  }).join('');
}

function ajouterCharge() {
  const date      = document.getElementById('charge-date')?.value || aujourdhui();
  const categorie = document.getElementById('charge-cat')?.value || 'autre';
  const desc      = document.getElementById('charge-desc')?.value.trim() || '';
  const montantHT = parseFloat(document.getElementById('charge-montant-ht')?.value) || 0;
  const tauxTVA   = parseFloat(document.getElementById('charge-taux-tva')?.value) || 20;
  const montant   = parseFloat(document.getElementById('charge-montant')?.value) || (montantHT * (1 + tauxTVA/100));
  const vehId     = document.getElementById('charge-veh')?.value || '';

  if (!montant && !montantHT) { afficherToast('âš ï¸ Montant obligatoire','error'); return; }

  const vehicule = vehId ? charger('vehicules').find(v=>v.id===vehId) : null;
  const charges  = charger('charges');
  const charge = { id:genId(), date, categorie, description:desc, montant, montantHT: montantHT || montant/(1+tauxTVA/100), tauxTVA, vehId, vehNom:vehicule?.immat||'', creeLe:new Date().toISOString() };
  charges.push(charge);
  sauvegarder('charges', charges);
  synchroChargeVersEntretien(charge);
  closeModal('modal-charge');
  afficherCharges();
  rafraichirDashboard();
  afficherRentabilite();
  afficherToast('âœ… Charge enregistrÃ©e');
}

async function supprimerCharge(id) {
  const ok = await confirmDialog('Supprimer cette charge ?',{titre:'Supprimer',icone:'ðŸ’¸',btnLabel:'Supprimer'});
  if (!ok) return;
  sauvegarder('charges', charger('charges').filter(c=>c.id!==id));
  afficherCharges();
  rafraichirDashboard();
  afficherRentabilite();
  afficherToast('ðŸ—‘ï¸ Charge supprimÃ©e');
}

function exporterChargesPDF() {
  const charges = charger('charges').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const params = chargerObj('params_entreprise', {});
  const nom = params.nom || 'MCA Logistics';
  const dateExp = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const total = charges.reduce((s,c)=>s+(c.montant||0),0);
  const catIcons = {carburant:'â›½',peage:'ðŸ›£ï¸',entretien:'ðŸ”§',assurance:'ðŸ›¡ï¸',autre:'ðŸ“'};

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">RÃ©capitulatif des charges</div><div style="font-size:1rem;font-weight:700">Total : ${euros(total)}</div><div style="font-size:.78rem;color:#9ca3af">${dateExp}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left">Date</th><th style="padding:8px 12px;text-align:left">CatÃ©gorie</th><th style="padding:8px 12px;text-align:left">Description</th><th style="padding:8px 12px;text-align:left">VÃ©hicule</th><th style="padding:8px 12px;text-align:right">Montant</th></tr></thead>
      <tbody>${charges.map((c,i)=>`<tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}">
        <td style="padding:8px 12px">${c.date||'â€”'}</td>
        <td style="padding:8px 12px">${catIcons[c.categorie]||'ðŸ“'} ${c.categorie||'autre'}</td>
        <td style="padding:8px 12px">${c.description||'â€”'}</td>
        <td style="padding:8px 12px">${c.vehNom||'â€”'}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700">${euros(c.montant||0)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div style="border-top:2px solid #1a1d27;margin-top:12px;padding-top:8px;display:flex;justify-content:flex-end"><strong style="font-size:1rem">Total : ${euros(total)}</strong></div>
    <div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>GÃ©nÃ©rÃ© par MCA Logistics â€” ${nom}</span><span>${dateExp}</span></div>
  </div>`;
  const win = window.open('','_blank','width=800,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Charges â€” ${nom}</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('ðŸ“„ PDF charges gÃ©nÃ©rÃ©');
}

/* ===== RELANCE PAIEMENT ===== */
function afficherRelances() {
  const tb = document.getElementById('tb-relances');
  if (!tb) return;
  const delai = parseInt(localStorage.getItem('relance_delai')||'7');

  // Synchroniser l'input dÃ©lai dans la page relances
  const inputDelai = document.getElementById('relance-delai-input');
  if (inputDelai && !inputDelai.matches(':focus')) inputDelai.value = delai;

  const limite = new Date(); limite.setDate(limite.getDate() - delai);
  const limiteStr = limite.toISOString().split('T')[0];

  const livraisons = charger('livraisons').filter(l =>
    l.statut === 'livre' &&
    (l.statutPaiement === 'en-attente' || !l.statutPaiement) &&
    l.prix > 0 &&
    l.date <= limiteStr
  ).sort((a,b) => new Date(a.date)-new Date(b.date));

  const totalEl = document.getElementById('relances-total');
  if (totalEl) totalEl.textContent = euros(livraisons.reduce((s,l)=>s+(l.prix||0),0));

  if (!livraisons.length) { tb.innerHTML = emptyState('âœ…','Aucune relance nÃ©cessaire','Toutes les livraisons livrÃ©es sont payÃ©es ou rÃ©centes.'); return; }

  tb.innerHTML = livraisons.map(l => {
    const joursRetard = Math.floor((new Date()-new Date(l.date))/(1000*60*60*24));
    const niveau = joursRetard > 30 ? 3 : joursRetard > 15 ? 2 : 1;
    const niveauLabel = niveau===3 ? 'ðŸ”´ Dernier avis' : niveau===2 ? 'ðŸŸ¡ Mise en demeure' : 'ðŸŸ¢ Amiable';
    return `<tr class="relance-row">
      <td><span style="font-size:.78rem;color:var(--text-muted)">${l.numLiv||'â€”'}</span></td>
      <td><strong>${l.client}</strong></td>
      <td>${l.date}</td>
      <td><strong>${euros(l.prix)}</strong></td>
      <td><span class="relance-badge">â° ${joursRetard}j</span><br><span style="font-size:.7rem">${niveauLabel}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-icon" onclick="marquerPaye('${l.id}')" title="Marquer payÃ©">ðŸ’³</button>
        <button class="btn-rapport" onclick="genererLettreRelance('${l.id}',${niveau})" title="Lettre de relance" style="padding:4px 10px;font-size:.75rem">ðŸ“„ Lettre</button>
      </td>
    </tr>`;
  }).join('');
}

function marquerPaye(id) {
  const livs = charger('livraisons');
  const idx  = livs.findIndex(l=>l.id===id);
  if (idx>-1) { livs[idx].statutPaiement='payÃ©'; sauvegarder('livraisons',livs); afficherRelances(); afficherToast('ðŸ’³ MarquÃ© comme payÃ©'); }
}
function marquerRelance(id) {
  const livs = charger('livraisons');
  const idx  = livs.findIndex(l=>l.id===id);
  if (idx>-1) { livs[idx].derniereRelance=new Date().toISOString(); sauvegarder('livraisons',livs); afficherRelances(); afficherToast('ðŸ“§ Relance notÃ©e'); }
}

/* ===== TCO VÃ‰HICULE ===== */
function calculerTCO(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId) || {};
  const carburant  = charger('carburant').filter(p=>p.vehId===vehId);
  const charges    = charger('charges').filter(c=>c.vehId===vehId);
  const entretiens = charger('entretiens').filter(e=>e.vehId===vehId);

  const totalCarb  = carburant.reduce((s,p)=>s+(p.total||0),0);
  const totalCharg = charges.reduce((s,c)=>s+(c.montant||0),0);
  const totalEntr  = entretiens.reduce((s,e)=>s+(e.cout||0),0);
  const achatHT    = parseFloat(veh.prixAchatHT) || 0;
  const total      = achatHT + totalCarb + totalCharg + totalEntr;
  const amort      = calculerAmortissementVehicule(veh);

  return { totalCarb, totalCharg, totalEntr, total, achatHT, amort };
}

function afficherTCO(vehId) {
  const veh  = charger('vehicules').find(v=>v.id===vehId);
  const tco  = calculerTCO(vehId);
  const cont = document.getElementById('tco-detail');
  if (!cont || !veh) return;

  cont.innerHTML = `
    <div style="font-size:.9rem;font-weight:600;margin-bottom:12px">ðŸš TCO â€” ${veh.immat} ${veh.modele||''}</div>
    <div class="tco-grid">
      <div class="tco-item"><div class="tco-label">ðŸ·ï¸ Acquisition HT</div><div class="tco-value" style="color:#4f8ef7">${euros(tco.achatHT)}</div></div>
      <div class="tco-item"><div class="tco-label">â›½ Carburant</div><div class="tco-value" style="color:#e74c3c">${euros(tco.totalCarb)}</div></div>
      <div class="tco-item"><div class="tco-label">ðŸ”§ Entretiens</div><div class="tco-value" style="color:var(--accent)">${euros(tco.totalEntr)}</div></div>
      <div class="tco-item"><div class="tco-label">ðŸ’¸ Autres charges</div><div class="tco-value" style="color:#9b59b6">${euros(tco.totalCharg)}</div></div>
      <div class="tco-item"><div class="tco-label">ðŸ“‰ Amorti cumulÃ©</div><div class="tco-value" style="color:#16a34a">${euros(tco.amort.cumule)}</div></div>
      <div class="tco-item" style="border:1px solid var(--border)"><div class="tco-label">ðŸ’° Total TCO</div><div class="tco-value" style="color:var(--text-primary)">${euros(tco.total)}</div></div>
    </div>`;
}

/* ===== CARNET ENTRETIEN DÃ‰TAILLÃ‰ ===== */
function afficherEntretiens() {
  const vehicules  = charger('vehicules');
  let entretiens = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const tb = document.getElementById('tb-entretiens');
  if (!tb) return;

  // Filtres
  const filtreVeh  = document.getElementById('filtre-entr-vehicule')?.value || '';
  var moisEntr = getEntrMoisStr();
  const selVeh = document.getElementById('filtre-entr-vehicule');
  if (selVeh) {
    const valeurCourante = selVeh.value;
    selVeh.innerHTML = '<option value="">Tous les vÃ©hicules</option>';
    vehicules.forEach(v => { selVeh.innerHTML += `<option value="${v.id}">${v.immat}</option>`; });
    selVeh.value = valeurCourante;
  }
  if (filtreVeh)  entretiens = entretiens.filter(e => e.vehId === filtreVeh);
  entretiens = entretiens.filter(e => (e.date||'').startsWith(moisEntr));

  if (!entretiens.length) { tb.innerHTML = emptyState('ðŸ”§','Aucun entretien ce mois','Changez de mois ou ajoutez un entretien.'); return; }

  const typeClass = { revision:'type-revision', pneus:'type-pneus', vidange:'type-vidange', plaquettes:'type-plaquettes', courroie:'type-courroie', freins:'type-plaquettes', carrosserie:'type-autre', autre:'type-autre' };
  const typeIcons = { revision:'ðŸ”©', pneus:'ðŸ”˜', vidange:'ðŸ›¢ï¸', plaquettes:'âš™ï¸', courroie:'â›“ï¸', freins:'ðŸ›‘', carrosserie:'ðŸš˜', autre:'ðŸ”§' };

  tb.innerHTML = entretiens.map(e => {
    const veh = vehicules.find(v=>v.id===e.vehId);
    const ht = e.coutHT || (e.cout||0) / (1 + (e.tauxTVA||20)/100);
    const tvaM = (e.cout||0) - ht;
    return `<tr>
      <td>${formatDateExport(e.date)}</td>
      <td><strong>${veh?.immat||'â€”'}</strong> <span style="font-size:.78rem;color:var(--text-muted)">${veh?.modele||''}</span></td>
      <td><span class="entretien-type-badge ${typeClass[e.type]||'type-autre'}">${typeIcons[e.type]||'ðŸ”§'} ${getTypeEntretienLabel(e.type)}</span></td>
      <td>${e.description||'â€”'}</td>
      <td>${e.km ? formatKm(e.km) : 'â€”'}</td>
      <td>${e.prochainKm ? formatKm(e.prochainKm) : 'â€”'}</td>
      <td style="font-size:.85rem">${e.cout ? euros(ht) : 'â€”'}</td>
      <td style="font-size:.82rem;color:var(--text-muted)">${e.cout ? euros(tvaM) : 'â€”'}</td>
      <td><strong>${e.cout ? euros(e.cout) : 'â€”'}</strong></td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditEntretien('${e.id}')" title="Modifier">âœï¸</button>
        <button class="btn-icon danger" onclick="supprimerEntretien('${e.id}')">ðŸ—‘ï¸</button>
      </td>
    </tr>`;
  }).join('');
}

function ouvrirModalEntretien() {
  window._editEntretienId = null;
  ['entr-date','entr-desc','entr-km','entr-prochain-km','entr-cout-ht','entr-cout'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = id === 'entr-date' ? aujourdhui() : '';
  });
  const veh = document.getElementById('entr-veh'); if (veh) veh.value = '';
  const type = document.getElementById('entr-type'); if (type) type.value = 'revision';
  const tva = document.getElementById('entr-taux-tva'); if (tva) tva.value = '20';
  const modal = document.getElementById('modal-entretien');
  modal.querySelector('h3').textContent = 'ðŸ”§ Ajouter un entretien';
  modal.querySelector('.modal-footer .btn-primary').textContent = 'âœ… Enregistrer';
  openModal('modal-entretien');
}

function ajouterEntretien() {
  if (window._editEntretienId) return confirmerEditEntretien();
  const vehId      = document.getElementById('entr-veh')?.value || '';
  const date       = document.getElementById('entr-date')?.value || aujourdhui();
  const type       = document.getElementById('entr-type')?.value || 'autre';
  const desc       = document.getElementById('entr-desc')?.value.trim() || '';
  const km         = parseFloat(document.getElementById('entr-km')?.value) || 0;
  const prochainKm = parseFloat(document.getElementById('entr-prochain-km')?.value) || 0;
  const coutHT     = parseFloat(document.getElementById('entr-cout-ht')?.value) || 0;
  const tauxTVA    = parseFloat(document.getElementById('entr-taux-tva')?.value) || 20;
  const cout       = parseFloat(document.getElementById('entr-cout')?.value) || (coutHT * (1 + tauxTVA/100));

  if (!vehId) { afficherToast('âš ï¸ VÃ©hicule obligatoire','error'); return; }

  const entretiens = charger('entretiens');
  const veh = getVehiculeById(vehId);
  const tauxDeductible = getTauxDeductibiliteVehicule(vehId, 100);
  const entretienId = genId();
  let chargeId = '';
  if (cout > 0) {
    chargeId = genId();
    const charges = charger('charges');
    charges.push({ id:chargeId, entretienId, date, categorie:'entretien', description:`${getTypeEntretienLabel(type)} â€” ${desc||veh?.immat||''}`, montant:cout, montantHT: coutHT || cout/(1+tauxTVA/100), tauxTVA, vehId, vehNom:veh?.immat||'', creeLe:new Date().toISOString() });
    sauvegarder('charges', charges);
  }
  entretiens.push({ id:entretienId, chargeId, vehId, date, type, description:desc, km, prochainKm, cout, coutHT: coutHT || cout/(1+tauxTVA/100), tauxTVA, tauxDeductible, creeLe:new Date().toISOString() });
  sauvegarder('entretiens', entretiens);
  if (veh && km > (parseFloat(veh.km) || 0)) {
    const vehicules = charger('vehicules');
    const idxVeh = vehicules.findIndex(function(item) { return item.id === vehId; });
    if (idxVeh > -1) {
      const kmAvant = parseFloat(vehicules[idxVeh].km) || 0;
      vehicules[idxVeh].km = Math.max(parseFloat(vehicules[idxVeh].km) || 0, km);
      if (!Number.isFinite(parseFloat(vehicules[idxVeh].kmInitial))) vehicules[idxVeh].kmInitial = kmAvant || km;
      sauvegarder('vehicules', vehicules);
    }
  }

  closeModal('modal-entretien');
  afficherEntretiens();
  afficherVehicules();
  afficherTva();
  afficherToast('âœ… Entretien enregistrÃ©');
}

function ouvrirEditEntretien(id) {
  const e = charger('entretiens').find(x => x.id === id);
  if (!e) return;
  window._editEntretienId = id;
  document.getElementById('entr-veh').value = e.vehId || '';
  document.getElementById('entr-date').value = e.date || '';
  document.getElementById('entr-type').value = e.type || 'autre';
  document.getElementById('entr-desc').value = e.description || '';
  document.getElementById('entr-km').value = e.km || '';
  document.getElementById('entr-prochain-km').value = e.prochainKm || '';
  document.getElementById('entr-cout-ht').value = e.coutHT || '';
  document.getElementById('entr-taux-tva').value = e.tauxTVA || 20;
  document.getElementById('entr-cout').value = e.cout || '';
  calculerTTCDepuisHT('entr');
  const modal = document.getElementById('modal-entretien');
  modal.querySelector('h3').textContent = 'âœï¸ Modifier un entretien';
  modal.querySelector('.modal-footer .btn-primary').textContent = 'âœ… Enregistrer';
  modal.classList.add('open');
}

function confirmerEditEntretien() {
  const id = window._editEntretienId;
  if (!id) return;
  const entretiens = charger('entretiens');
  const idx = entretiens.findIndex(e => e.id === id);
  if (idx === -1) return;
  const vehId = document.getElementById('entr-veh')?.value || '';
  const date = document.getElementById('entr-date')?.value || aujourdhui();
  const type = document.getElementById('entr-type')?.value || 'autre';
  const description = document.getElementById('entr-desc')?.value.trim() || '';
  const km = parseFloat(document.getElementById('entr-km')?.value) || 0;
  const prochainKm = parseFloat(document.getElementById('entr-prochain-km')?.value) || 0;
  const coutHT = parseFloat(document.getElementById('entr-cout-ht')?.value) || 0;
  const tauxTVA = parseFloat(document.getElementById('entr-taux-tva')?.value) || 20;
  const cout = parseFloat(document.getElementById('entr-cout')?.value) || (coutHT * (1 + tauxTVA/100));
  const veh = getVehiculeById(vehId);
  entretiens[idx] = {
    ...entretiens[idx],
    vehId, date, type, description, km, prochainKm,
    cout, coutHT: coutHT || cout/(1+tauxTVA/100), tauxTVA,
    tauxDeductible: getTauxDeductibiliteVehicule(vehId, 100),
    modifieLe: new Date().toISOString()
  };
  sauvegarder('entretiens', entretiens);
  if (veh && km > (parseFloat(veh.km) || 0)) {
    const vehicules = charger('vehicules');
    const idxVeh = vehicules.findIndex(function(item) { return item.id === vehId; });
    if (idxVeh > -1) {
      const kmAvant = parseFloat(vehicules[idxVeh].km) || 0;
      vehicules[idxVeh].km = Math.max(parseFloat(vehicules[idxVeh].km) || 0, km);
      if (!Number.isFinite(parseFloat(vehicules[idxVeh].kmInitial))) vehicules[idxVeh].kmInitial = kmAvant || km;
      sauvegarder('vehicules', vehicules);
    }
  }
  const charges = charger('charges');
  const chargeIdx = charges.findIndex(c => c.id === entretiens[idx].chargeId || c.entretienId === id);
  if (chargeIdx > -1) {
    charges[chargeIdx] = {
      ...charges[chargeIdx],
      date,
      categorie:'entretien',
      description:`${getTypeEntretienLabel(type)} â€” ${description||veh?.immat||''}`,
      montant: cout,
      montantHT: coutHT || cout/(1+tauxTVA/100),
      tauxTVA,
      vehId,
      vehNom: veh?.immat || ''
    };
    sauvegarder('charges', charges);
  }
  closeModal('modal-entretien');
  const modal = document.getElementById('modal-entretien');
  modal.querySelector('h3').textContent = 'ðŸ”§ Ajouter un entretien';
  modal.querySelector('.modal-footer .btn-primary').textContent = 'âœ… Enregistrer';
  window._editEntretienId = null;
  afficherEntretiens();
  afficherVehicules();
  afficherTva();
  afficherToast('âœ… Entretien modifiÃ©');
}

async function supprimerEntretien(id) {
  const ok = await confirmDialog('Supprimer cet entretien ?',{titre:'Supprimer',icone:'ðŸ”§',btnLabel:'Supprimer'});
  if (!ok) return;
  // Trouver l'entretien pour supprimer la charge liÃ©e
  const entretien = charger('entretiens').find(e=>e.id===id);
  sauvegarder('entretiens', charger('entretiens').filter(e=>e.id!==id));
  // Supprimer la charge correspondante si elle existe
  if (entretien && entretien.cout > 0) {
    const charges = charger('charges');
    const idxCharge = charges.findIndex(c => c.id === entretien.chargeId || c.entretienId === entretien.id || (c.categorie==='entretien' && c.vehId===entretien.vehId && c.date===entretien.date && Math.abs((c.montant||0)-entretien.cout) < 0.01));
    if (idxCharge > -1) { charges.splice(idxCharge, 1); sauvegarder('charges', charges); }
  }
  afficherEntretiens();
  afficherTva();
  afficherToast('ðŸ—‘ï¸ Entretien supprimÃ©');
}

/* ===== BLOCAGE COMPTE aprÃ¨s X tentatives ===== */
/* ===== INCIDENTS / RÃ‰CLAMATIONS ===== */
function afficherIncidents() {
  const incidents = charger('incidents').sort((a,b)=>new Date(b.creeLe)-new Date(a.creeLe));
  const tb = document.getElementById('tb-incidents');
  if (!tb) return;

  if (!incidents.length) { tb.innerHTML = emptyState('ðŸš¨','Aucun incident','Les rÃ©clamations clients et incidents de livraison apparaÃ®tront ici.'); return; }

  const statBadge = { ouvert:'<span class="incident-badge incident-ouvert">ðŸ”´ Ouvert</span>', encours:'<span class="incident-badge incident-encours">ðŸŸ¡ En cours</span>', traite:'<span class="incident-badge incident-traite">âœ… TraitÃ©</span>' };

  tb.innerHTML = incidents.map(i => `<tr>
    <td>${i.date}</td>
    <td><strong>${i.client||'â€”'}</strong></td>
    <td>${i.chaufNom||'â€”'}</td>
    <td style="font-size:.83rem">${i.description||'â€”'}</td>
    <td>${statBadge[i.statut||'ouvert']||''}</td>
    <td>
      <select class="btn-icon" onchange="changerStatutIncident('${i.id}',this.value)">
        <option value="ouvert"  ${(i.statut||'ouvert')==='ouvert' ?'selected':''}>ðŸ”´ Ouvert</option>
        <option value="encours" ${i.statut==='encours'?'selected':''}>ðŸŸ¡ En cours</option>
        <option value="traite"  ${i.statut==='traite' ?'selected':''}>âœ… TraitÃ©</option>
      </select>
      <button class="btn-icon danger" onclick="supprimerIncident('${i.id}')">ðŸ—‘ï¸</button>
    </td>
  </tr>`).join('');
}

function ajouterIncident() {
  const date     = document.getElementById('inc-date')?.value || aujourdhui();
  const livId    = document.getElementById('inc-livraison')?.value || '';
  const salId    = document.getElementById('inc-salarie')?.value || '';
  const desc     = document.getElementById('inc-description')?.value.trim() || '';
  const gravite  = document.getElementById('inc-gravite')?.value || 'moyen';

  if (!desc) { afficherToast('âš ï¸ Description obligatoire','error'); return; }

  const livraisons = charger('livraisons');
  const liv = livId ? livraisons.find(l=>l.id===livId) : null;
  const sal = salId ? charger('salaries').find(s=>s.id===salId) : null;
  const finalSalId  = salId || liv?.chaufId || '';
  const finalSalNom = sal?.nom || liv?.chaufNom || '';

  const incidents = charger('incidents');
  const incident  = { id:genId(), date, livId, salId:finalSalId, salNom:finalSalNom, client:liv?.client||'', chaufId:finalSalId, chaufNom:finalSalNom, description:desc, gravite, statut:'ouvert', creeLe:new Date().toISOString() };
  incidents.push(incident);
  sauvegarder('incidents', incidents);

  if (finalSalId) {
    const msgs = JSON.parse(localStorage.getItem('messages_'+finalSalId)||'[]');
    msgs.push({ id:genId(), auteur:'admin', texte:`âš ï¸ Un incident a Ã©tÃ© signalÃ©${liv?' sur votre livraison du '+date+' ('+liv.client+')':' vous concernant le '+date}. Motif : ${desc}`, lu:false, creeLe:new Date().toISOString() });
    localStorage.setItem('messages_'+finalSalId, JSON.stringify(msgs));
  }

  closeModal('modal-incident');
  afficherIncidents();
  afficherToast('âœ… Incident enregistrÃ©');
}

function changerStatutIncident(id, statut) {
  const incidents = charger('incidents');
  const idx = incidents.findIndex(i=>i.id===id);
  if (idx>-1) { incidents[idx].statut=statut; sauvegarder('incidents',incidents); afficherIncidents(); afficherToast('âœ… Statut mis Ã  jour'); }
}

async function supprimerIncident(id) {
  const ok = await confirmDialog('Supprimer cet incident ?',{titre:'Supprimer',icone:'ðŸš¨',btnLabel:'Supprimer'});
  if (!ok) return;
  sauvegarder('incidents', charger('incidents').filter(i=>i.id!==id));
  afficherIncidents();
  afficherToast('ðŸ—‘ï¸ Incident supprimÃ©');
}

/* ===== HISTORIQUE MODIFICATIONS LIVRAISON ===== */
function logModifLivraison(livId, champ, ancienne, nouvelle) {
  const cle  = 'modifs_liv_' + livId;
  const logs = JSON.parse(localStorage.getItem(cle)||'[]');
  logs.push({ date:new Date().toISOString(), champ, ancienne: String(ancienne), nouvelle: String(nouvelle), par:'Admin' });
  if (logs.length > 20) logs.shift();
  localStorage.setItem(cle, JSON.stringify(logs));
}

function afficherHistoriqueModifs(livId) {
  const cle  = 'modifs_liv_' + livId;
  const logs = JSON.parse(localStorage.getItem(cle)||'[]').reverse();
  const cont = document.getElementById('historique-modifs-liv');
  if (!cont) return;
  if (!logs.length) { cont.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">Aucune modification enregistrÃ©e</div>'; return; }
  cont.innerHTML = logs.map(l => `
    <div class="modif-log">
      <span class="modif-log-date">${new Date(l.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
      <span class="modif-log-qui">${l.par}</span>
      <span><strong>${l.champ}</strong> : <span style="color:var(--red)">${l.ancienne||'â€”'}</span> â†’ <span style="color:var(--green)">${l.nouvelle||'â€”'}</span></span>
    </div>`).join('');
}

/* ===== COMMENTAIRES INTERNES LIVRAISON ===== */
function ajouterCommentaireLiv(livId) {
  const input = document.getElementById('commentaire-liv-input');
  const texte = input?.value.trim();
  if (!texte) return;
  const cle  = 'commentaires_liv_' + livId;
  const list = JSON.parse(localStorage.getItem(cle)||'[]');
  list.push({ id:genId(), texte, date:new Date().toISOString(), par:'Admin' });
  localStorage.setItem(cle, JSON.stringify(list));
  if (input) input.value = '';
  afficherCommentairesLiv(livId);
  afficherToast('ðŸ’¬ Commentaire ajoutÃ©');
}

function afficherCommentairesLiv(livId) {
  const cle  = 'commentaires_liv_' + livId;
  const list = JSON.parse(localStorage.getItem(cle)||'[]').reverse();
  const cont = document.getElementById('commentaires-liv-list');
  if (!cont) return;
  if (!list.length) { cont.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted)">Aucun commentaire</div>'; return; }
  cont.innerHTML = list.map(c => `
    <div style="background:rgba(255,255,255,.03);border-radius:7px;padding:8px 12px;margin-bottom:6px;font-size:.85rem">
      <div style="color:var(--text-muted);font-size:.72rem;margin-bottom:3px">${c.par} Â· ${new Date(c.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
      ${c.texte}
    </div>`).join('');
}

/* ===== COMPARATIF MENSUEL ===== */
function calculerComparatif() {
  const livraisons = charger('livraisons');
  const carburant  = charger('carburant');
  const auj        = new Date();
  const moisActuel = auj.toISOString().slice(0,7);
  const moisPrec   = new Date(auj.getFullYear(), auj.getMonth()-1, 1).toISOString().slice(0,7);

  const caActuel = livraisons.filter(l=>(l.date||'').startsWith(moisActuel)).reduce((s,l)=>s+(l.prix||0),0);
  const caPrec   = livraisons.filter(l=>(l.date||'').startsWith(moisPrec)).reduce((s,l)=>s+(l.prix||0),0);
  const livActuel= livraisons.filter(l=>(l.date||'').startsWith(moisActuel)).length;
  const livPrec  = livraisons.filter(l=>(l.date||'').startsWith(moisPrec)).length;
  const carbActuel= carburant.filter(p=>(p.date||'').startsWith(moisActuel)).reduce((s,p)=>s+(p.total||0),0);
  const carbPrec  = carburant.filter(p=>(p.date||'').startsWith(moisPrec)).reduce((s,p)=>s+(p.total||0),0);

  return { caActuel, caPrec, livActuel, livPrec, carbActuel, carbPrec };
}

function badgeEvol(actuel, precedent) {
  if (!precedent) return '';
  const pct = Math.round((actuel - precedent) / precedent * 100);
  if (pct > 0)  return `<span class="evol-badge up">â†‘ +${pct}%</span>`;
  if (pct < 0)  return `<span class="evol-badge down">â†“ ${pct}%</span>`;
  return `<span class="evol-badge flat">= 0%</span>`;
}

/* ===== BON DE LIVRAISON PDF ===== */
function genererBonLivraison(livId) {
  const livraisons = charger('livraisons');
  const l = livraisons.find(x => x.id === livId);
  if (!l) return;
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const siret = params.siret || 'â€”';
  const adresse = params.adresse || '';
  const tel = params.tel || '';
  const dateExp = formatDateHeureExport();
  const logo = renderLogoEntrepriseExport();

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1d27">
      <!-- EN-TÃŠTE -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #f5a623">
        <div>
          <div style="font-size:1.6rem;font-weight:800;color:#f5a623;letter-spacing:1px">${nom}</div>
          ${adresse ? `<div style="font-size:.85rem;color:#6b7280;margin-top:4px">${adresse}</div>` : ''}
          ${tel     ? `<div style="font-size:.85rem;color:#6b7280">ðŸ“ž ${tel}</div>` : ''}
          ${siret !== 'â€”' ? `<div style="font-size:.78rem;color:#9ca3af;margin-top:2px">SIRET : ${siret}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;text-align:right">
          ${logo || ''}
          <div>
          <div style="font-size:1.1rem;font-weight:700;color:#1a1d27">BON DE LIVRAISON</div>
          <div style="font-size:1.3rem;font-weight:800;color:#f5a623">${l.numLiv || 'â€”'}</div>
          <div style="font-size:.82rem;color:#6b7280;margin-top:4px">Date : ${formatDateExport(l.date) || 'â€”'}</div>
          ${l.heureDebut ? `<div style="font-size:.82rem;color:#6b7280">Heure : ${l.heureDebut}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- INFOS LIVRAISON -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div style="background:#f8f9fc;border-radius:10px;padding:16px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Client</div>
          <div style="font-size:1rem;font-weight:700">${l.client || 'â€”'}</div>
          ${l.arrivee ? `<div style="font-size:.85rem;color:#6b7280;margin-top:4px">ðŸ“ ${l.arrivee}</div>` : ''}
        </div>
        <div style="background:#f8f9fc;border-radius:10px;padding:16px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">ExÃ©cution</div>
          <div style="font-size:.88rem"><strong>Chauffeur :</strong> ${l.chaufNom || 'â€”'}</div>
          <div style="font-size:.88rem;margin-top:4px"><strong>VÃ©hicule :</strong> ${l.vehNom || 'â€”'}</div>
          ${l.distance ? `<div style="font-size:.88rem;margin-top:4px"><strong>Distance :</strong> ${l.distance} km</div>` : ''}
        </div>
      </div>

      <!-- DÃ‰PART / ARRIVÃ‰E -->
      ${(l.depart || l.arrivee) ? `
      <div style="background:#fff8ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin-bottom:24px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:10px">ItinÃ©raire</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${l.depart  ? `<div style="flex:1;min-width:180px"><div style="font-size:.72rem;color:#9ca3af">DÃ‰PART</div><div style="font-weight:600">ðŸ“ ${l.depart}</div></div>` : ''}
          ${l.depart && l.arrivee ? `<div style="font-size:1.2rem;color:#f5a623">â†’</div>` : ''}
          ${l.arrivee ? `<div style="flex:1;min-width:180px"><div style="font-size:.72rem;color:#9ca3af">ARRIVÃ‰E</div><div style="font-weight:600">ðŸ ${l.arrivee}</div></div>` : ''}
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
          <div style="margin-top:8px;font-size:.8rem;color:#9ca3af">Lu et approuvÃ©</div>
        </div>
      </div>

      ${l.notes ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:.85rem;color:#166534"><strong>Notes :</strong> ${l.notes}</div>` : ''}

      <!-- PIED DE PAGE -->
      <div style="border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
        <span>GÃ©nÃ©rÃ© par ${nom}</span>
        <span>ExportÃ© le ${dateExp}</span>
        <span>Page 1/1</span>
      </div>
    </div>`;

  const zone = document.getElementById('print-bon');
  zone.innerHTML = html;

  // Ouvrir dans une nouvelle fenÃªtre pour impression/sauvegarde PDF
  ouvrirFenetreImpression(`Bon de livraison ${l.numLiv||''}`, html, 'width=800,height=900');
}

/* Auto-remplir le vÃ©hicule quand on choisit un salariÃ© dans le modal livraison */
function autoRemplirVehicule() {
  const chaufId = document.getElementById('liv-chauffeur').value;
  const selVeh  = document.getElementById('liv-vehicule');
  if (!chaufId || !selVeh) return;
  const veh = getVehiculeParSalId(chaufId);
  if (veh) {
    // S'assurer que l'option existe dans le select
    let found = false;
    for (let opt of selVeh.options) { if (opt.value === veh.id) { found = true; break; } }
    if (!found) {
      const opt = document.createElement('option');
      opt.value = veh.id;
      opt.textContent = `${veh.immat} â€” ${veh.modele}`;
      selVeh.appendChild(opt);
    }
    selVeh.value = veh.id;
  }
}

function autoRemplirChauffeurDepuisVehicule() {
  const selChauf = document.getElementById('liv-chauffeur');
  const vehId = document.getElementById('liv-vehicule')?.value || '';
  if (!selChauf || !vehId) return;
  const affectation = synchroniserAffectationLivraison(selChauf.value || '', vehId);
  if (affectation.chaufId) selChauf.value = affectation.chaufId;
}

function autoRemplirVehiculeEdit() {
  const selVeh = document.getElementById('edit-liv-vehicule');
  if (!selVeh) return;
  const affectation = synchroniserAffectationLivraison(
    document.getElementById('edit-liv-chauffeur')?.value || '',
    selVeh.value || ''
  );
  if (affectation.vehId) selVeh.value = affectation.vehId;
}

function autoRemplirChauffeurDepuisVehiculeEdit() {
  const selChauf = document.getElementById('edit-liv-chauffeur');
  if (!selChauf) return;
  const affectation = synchroniserAffectationLivraison(
    selChauf.value || '',
    document.getElementById('edit-liv-vehicule')?.value || ''
  );
  if (affectation.chaufId) selChauf.value = affectation.chaufId;
}

/* ===== MODIFIER CLIENT ===== */
let _editClientId = null;
async function ouvrirEditClient(id) {
  const c = charger('clients').find(x=>x.id===id);
  if (!c) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('client', id, c.nom || 'Client');
  if (!lockResult.ok) {
    afficherToast(`âš ï¸ Client en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  _editClientId = id;
  document.getElementById('edit-cl-id').value      = id;
  document.getElementById('edit-cl-nom').value     = c.nom||'';
  document.getElementById('edit-cl-prenom').value  = c.prenom||'';
  document.getElementById('edit-cl-tel').value     = c.tel||'';
  document.getElementById('edit-cl-email').value   = c.email||'';
  document.getElementById('edit-cl-adresse').value = c.adresse||'';
  document.getElementById('modal-edit-client').classList.add('open');
  afficherAlerteVerrouModal('modal-edit-client', '');
}

function confirmerEditClient() {
  surveillerConflitsEditionActifs();
  const id      = document.getElementById('edit-cl-id').value;
  const lockState = verifierVerrouEdition('client', id);
  if (!lockState.ok) {
    afficherToast(`âš ï¸ Ce client est verrouillÃ© par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const nom     = document.getElementById('edit-cl-nom').value.trim();
  const prenom  = document.getElementById('edit-cl-prenom').value.trim();
  const tel     = document.getElementById('edit-cl-tel').value.trim();
  const email   = document.getElementById('edit-cl-email').value.trim();
  const adresse = document.getElementById('edit-cl-adresse').value.trim();
  if (!nom) { afficherToast('âš ï¸ Nom obligatoire','error'); return; }
  const clients = charger('clients');
  const idx = clients.findIndex(c=>c.id===id);
  if (idx>-1) {
    clients[idx].nom=nom; clients[idx].prenom=prenom; clients[idx].tel=tel;
    clients[idx].email=email; clients[idx].adresse=adresse;
    sauvegarder('clients', clients);
  }
  closeModal('modal-edit-client');
  _editClientId = null;
  afficherClientsDashboard();
  afficherToast('âœ… Client mis Ã  jour');
}

/* ===== EXPORT STATS PDF ===== */
function exporterStatsPDF() {
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const ca = document.getElementById('stats-ca-periode')?.textContent||'0 â‚¬';
  const livs = document.getElementById('stats-livraisons-periode')?.textContent||'0';
  const panier = document.getElementById('stats-panier-moyen')?.textContent||'0 â‚¬';
  const km = document.getElementById('stats-km-total')?.textContent||'0 km';
  const dateExp = formatDateHeureExport();
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Rapport statistiques</div><div style="font-size:.78rem;color:#9ca3af">${dateExp}</div></div>
    </div>
    ${renderBlocInfosEntreprise(params)}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:24px">
      ${[['CA pÃ©riode',ca,'#2ecc71'],['Livraisons',livs,'#4f8ef7'],['Panier moyen',panier,'#f5a623'],['Km total',km,'#9b59b6']].map(([l,v,c])=>`<div style="background:#f8f9fc;border-radius:10px;padding:16px;text-align:center;border-top:3px solid ${c}"><div style="font-size:.72rem;color:#9ca3af;margin-bottom:6px">${l}</div><div style="font-size:1.2rem;font-weight:800;color:${c}">${v}</div></div>`).join('')}
    </div>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  const win = window.open('','_blank','width=800,height=600');
  win.document.write(`<!DOCTYPE html><html><head><title>Statistiques â€” ${nom}</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('ðŸ“„ Rapport statistiques gÃ©nÃ©rÃ©');
}

/* ===== EXPORT HEURES PDF ===== */
function exporterHeuresPDF() {
  const salaries = charger('salaries');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const dateExp = formatDateHeureExport();
  const range = getHeuresPeriodeRange();
  const rows = salaries.map(s => {
    const { planifiees, details } = calculerHeuresSalarieSemaine(s.id);
    const detailStr = details.map(d=>`${d.jour.substring(0,3)}: ${d.duree.toFixed(1)}h`).join(' Â· ');
    return `<tr><td style="padding:8px 12px;font-weight:600">${s.nom}</td><td style="padding:8px 12px">${s.poste||'â€”'}</td><td style="padding:8px 12px;text-align:center;font-weight:700">${planifiees.toFixed(1)}h</td><td style="padding:8px 12px;font-size:.82rem;color:#6b7280">${detailStr||'â€”'}</td></tr>`;
  }).join('');
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    ${construireEnteteExport(params, 'Rapport heures', `${range.label} Â· ${range.datesLabel}`, dateExp)}
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">SalariÃ©</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th><th style="padding:8px 12px;text-align:center;color:#6b7280">H/semaine</th><th style="padding:8px 12px;text-align:left;color:#6b7280">DÃ©tail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  ouvrirFenetreImpression(`Heures - ${nom}`, html, 'width=800,height=700');
  afficherToast('ðŸ“„ Rapport heures gÃ©nÃ©rÃ©');
}

/* ===== MODIFIER VÃ‰HICULE ===== */
async function ouvrirEditVehicule(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId);
  if (!veh) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('vehicule', vehId, veh.immat || 'VÃ©hicule');
  if (!lockResult.ok) {
    afficherToast(`âš ï¸ VÃ©hicule en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  window._editVehId = vehId;
  document.getElementById('veh-immat').value    = veh.immat||'';
  document.getElementById('veh-modele').value   = veh.modele||'';
  document.getElementById('veh-km').value       = calculerKilometrageVehiculeActuel(veh)||'';
  document.getElementById('veh-conso').value    = veh.conso||'';
  document.getElementById('veh-mode-acquisition').value = veh.modeAcquisition || 'achat';
  document.getElementById('veh-date-acquisition').value = veh.dateAcquisition || '';
  document.getElementById('veh-acq-prix-ht').value = veh.prixAchatHT || '';
  document.getElementById('veh-acq-taux-tva').value = veh.tauxTVAAchat ?? 20;
  document.getElementById('veh-acq-prix').value = veh.prixAchatTTC || '';
  document.getElementById('veh-duree-amortissement').value = veh.dureeAmortissement || '';
  document.getElementById('veh-mode-amortissement').value = veh.modeAmortissement || 'lineaire';
  document.getElementById('veh-date-ct').value  = veh.dateCT||'';
  document.getElementById('veh-entretien-interval-km').value = veh.entretienIntervalKm || '';
  document.getElementById('veh-entretien-interval-mois').value = veh.entretienIntervalMois || '';
  document.getElementById('veh-date-rebut').value = veh.dateMiseAuRebut || '';
  document.getElementById('veh-valeur-rebut').value = veh.valeurMiseAuRebut || '';
  var selTvaCarb = document.getElementById('veh-tva-carburant');
  if (selTvaCarb) selTvaCarb.value = veh.tvaCarbDeductible !== undefined ? veh.tvaCarbDeductible : 80;
  const sv = document.getElementById('veh-salarie');
  if (sv) sv.value = veh.salId||'';
  const modal = document.getElementById('modal-vehicule');
  modal.querySelector('h3').textContent = 'âœï¸ Modifier le vÃ©hicule';
  modal.querySelector('.modal-footer .btn-primary').textContent = 'âœ… Enregistrer';
  modal.querySelector('.modal-footer .btn-primary').setAttribute('onclick', 'confirmerEditVehicule()');
  modal.classList.add('open');
  afficherAlerteVerrouModal('modal-vehicule', '');
}

function confirmerEditVehicule() {
  surveillerConflitsEditionActifs();
  const id = window._editVehId;
  if (!id) return;
  const lockState = verifierVerrouEdition('vehicule', id);
  if (!lockState.ok) {
    afficherToast(`âš ï¸ Ce vÃ©hicule est verrouillÃ© par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const vehicules = charger('vehicules');
  const idx = vehicules.findIndex(v=>v.id===id);
  if (idx === -1) return;
  vehicules[idx].immat    = document.getElementById('veh-immat').value.trim().toUpperCase();
  vehicules[idx].modele   = document.getElementById('veh-modele').value.trim();
  vehicules[idx].km       = parseFloat(document.getElementById('veh-km').value)||0;
  if (!Number.isFinite(parseFloat(vehicules[idx].kmInitial))) vehicules[idx].kmInitial = vehicules[idx].km;
  vehicules[idx].conso    = parseFloat(document.getElementById('veh-conso').value)||0;
  vehicules[idx].modeAcquisition = document.getElementById('veh-mode-acquisition')?.value || 'achat';
  vehicules[idx].dateAcquisition = document.getElementById('veh-date-acquisition')?.value || '';
  vehicules[idx].prixAchatHT = parseFloat(document.getElementById('veh-acq-prix-ht')?.value)||0;
  vehicules[idx].tauxTVAAchat = parseFloat(document.getElementById('veh-acq-taux-tva')?.value) || 20;
  vehicules[idx].prixAchatTTC = parseFloat(document.getElementById('veh-acq-prix')?.value) || (vehicules[idx].prixAchatHT * (1 + vehicules[idx].tauxTVAAchat/100));
  vehicules[idx].dureeAmortissement = parseFloat(document.getElementById('veh-duree-amortissement')?.value)||0;
  vehicules[idx].modeAmortissement = document.getElementById('veh-mode-amortissement')?.value || 'lineaire';
  vehicules[idx].dateCT   = document.getElementById('veh-date-ct').value||'';
  vehicules[idx].entretienIntervalKm = parseFloat(document.getElementById('veh-entretien-interval-km')?.value)||0;
  vehicules[idx].entretienIntervalMois = parseFloat(document.getElementById('veh-entretien-interval-mois')?.value)||0;
  vehicules[idx].dateMiseAuRebut = document.getElementById('veh-date-rebut')?.value || '';
  vehicules[idx].valeurMiseAuRebut = parseFloat(document.getElementById('veh-valeur-rebut')?.value)||0;
  vehicules[idx].tvaCarbDeductible = parseFloat(document.getElementById('veh-tva-carburant')?.value) || 80;
  const salId = document.getElementById('veh-salarie')?.value||'';
  vehicules[idx].salId = salId||null;
  vehicules[idx].salNom = salId ? (charger('salaries').find(s=>s.id===salId)?.nom||null) : null;
  sauvegarder('vehicules', vehicules);
  closeModal('modal-vehicule');
  const modal = document.getElementById('modal-vehicule');
  modal.querySelector('h3').textContent = 'ðŸš Nouveau VÃ©hicule';
  modal.querySelector('.modal-footer .btn-primary').textContent = 'Enregistrer';
  modal.querySelector('.modal-footer .btn-primary').setAttribute('onclick', 'ajouterVehicule()');
  ['veh-entretien-interval-km','veh-entretien-interval-mois','veh-date-rebut','veh-valeur-rebut'].forEach(function(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.value = '';
  });
  if (document.getElementById('veh-mode-amortissement')) document.getElementById('veh-mode-amortissement').value = 'lineaire';
  window._editVehId = null;
  afficherVehicules();
  afficherTva();
  afficherEntretiens();
  afficherToast('âœ… VÃ©hicule mis Ã  jour');
}

/* ===== ALIAS EXPORTS ===== */
function exporterRecapHeuresPDF() { exporterHeuresPDF(); }

/* ===== EXPORT PLANNING PDF ===== */
function exporterPlanningPDF() {
  const salaries = charger('salaries');
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const dateExp = formatDateHeureExport();
  const JOURS_LABELS = {lundi:'Lun',mardi:'Mar',mercredi:'Mer',jeudi:'Jeu',vendredi:'Ven',samedi:'Sam',dimanche:'Dim'};
  const typeColors = {travail:'#2ecc71',repos:'#6b7280',conge:'#3498db',absence:'#e74c3c',maladie:'#9b59b6'};

  const rows = salaries.map(s => {
    const plan = plannings.find(p=>p.salId===s.id);
    const jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'].map(j => {
      const jour = plan?.semaine?.find(d=>d.jour===j);
      if (!jour || !jour.travaille) return `<td style="padding:6px 8px;text-align:center;color:${typeColors[jour?.typeJour||'repos']||'#6b7280'};font-size:.78rem">${jour?.typeJour==='conge'?'CongÃ©':jour?.typeJour==='maladie'?'Maladie':jour?.typeJour==='absence'?'Absent':'â€”'}</td>`;
      return `<td style="padding:6px 8px;text-align:center;font-size:.78rem;color:#2ecc71">${jour.heureDebut||'â€”'}${jour.heureFin?' â€“ '+jour.heureFin:''}</td>`;
    }).join('');
    return `<tr><td style="padding:8px 12px;font-weight:600">${s.nom}</td><td style="padding:8px 12px;font-size:.82rem;color:#6b7280">${s.poste||'â€”'}</td>${jours}</tr>`;
  }).join('');

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#1a1d27">
    ${construireEnteteExport(params, 'Planning hebdomadaire', '', dateExp)}
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">SalariÃ©</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th>${Object.values(JOURS_LABELS).map(j=>`<th style="padding:6px 8px;text-align:center;color:#6b7280">${j}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  ouvrirFenetreImpression(`Planning - ${nom}`, html, 'width=950,height=700');
  afficherToast('ðŸ“„ Rapport planning gÃ©nÃ©rÃ©');
}

/* ===== EXPORT ENTRETIENS PDF ===== */
function exporterEntretiensPDF() {
  const entretiens = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const vehicules = charger('vehicules');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const total = entretiens.reduce((s,e)=>s+(e.cout||0),0);
  const dateExp = formatDateHeureExport();
  const typeIcons = {revision:'ðŸ”©',vidange:'ðŸ›¢ï¸',pneus:'ðŸ”˜',plaquettes:'âš™ï¸',courroie:'â›“ï¸',autre:'ðŸ”§'};

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Carnet d'entretien</div><div style="font-size:1rem;font-weight:700">Total : ${euros(total)}</div><div style="font-size:.78rem;color:#9ca3af">${dateExp}</div></div>
    </div>
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Date</th><th style="padding:8px 12px;text-align:left;color:#6b7280">VÃ©hicule</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Type</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Description</th><th style="padding:8px 12px;text-align:right;color:#6b7280">CoÃ»t</th></tr></thead>
      <tbody>${entretiens.map((e,i)=>{const veh=vehicules.find(v=>v.id===e.vehId);return `<tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}"><td style="padding:8px 12px">${formatDateExport(e.date)}</td><td style="padding:8px 12px;font-weight:600">${veh?.immat||'â€”'}</td><td style="padding:8px 12px">${typeIcons[e.type]||'ðŸ”§'} ${e.type||'autre'}</td><td style="padding:8px 12px">${e.description||'â€”'}</td><td style="padding:8px 12px;text-align:right;font-weight:700">${e.cout?euros(e.cout):'â€”'}</td></tr>`;}).join('')}</tbody>
    </table>
    <div style="border-top:2px solid #1a1d27;margin-top:12px;padding-top:8px;display:flex;justify-content:flex-end"><strong>Total : ${euros(total)}</strong></div>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  const win = window.open('','_blank','width=800,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Entretiens â€” ${nom}</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('ðŸ“„ Rapport entretiens gÃ©nÃ©rÃ©');
}

/* ===== EXPORT VÃ‰HICULES PDF ===== */
function exporterVehiculesPDF() {
  const vehicules = charger('vehicules');
  const entretiens = charger('entretiens');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const dateExp = formatDateHeureExport();

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Rapport flotte vÃ©hicules</div><div style="font-size:.78rem;color:#9ca3af">${dateExp}</div></div>
    </div>
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.82rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Immatriculation</th><th style="padding:8px 12px;text-align:left;color:#6b7280">ModÃ¨le</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Acquisition</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Finances</th><th style="padding:8px 12px;text-align:left;color:#6b7280">CT</th><th style="padding:8px 12px;text-align:left;color:#6b7280">SalariÃ©</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Dernier entretien</th></tr></thead>
      <tbody>${vehicules.map((v,i)=>{
        const ent = entretiens.filter(e=>e.vehId===v.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
        const amort = calculerAmortissementVehicule(v);
        return `<tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}">
          <td style="padding:8px 12px;font-weight:700">${v.immat}</td>
          <td style="padding:8px 12px">${v.modele||'â€”'}</td>
          <td style="padding:8px 12px;text-align:right">${v.km?v.km.toLocaleString('fr-FR')+' km':'â€”'}</td>
          <td style="padding:8px 12px">${(v.modeAcquisition||'â€”').toUpperCase()}${v.dateAcquisition?'<br><span style="font-size:.76rem;color:#6b7280">'+formatDateExport(v.dateAcquisition)+'</span>':''}${v.dureeAmortissement?'<br><span style="font-size:.76rem;color:#6b7280">'+v.dureeAmortissement+' an(s)</span>':''}</td>
          <td style="padding:8px 12px">${v.prixAchatHT?euros(v.prixAchatHT)+' HT':'â€”'}${v.prixAchatTTC?'<br><span style="font-size:.76rem;color:#6b7280">'+euros(v.prixAchatTTC)+' TTC</span>':''}${amort.annuel?'<br><span style="font-size:.76rem;color:#6b7280">Amort. '+euros(amort.annuel)+'/an</span>':''}</td>
          <td style="padding:8px 12px">${formatDateExport(v.dateCT)}</td>
          <td style="padding:8px 12px">${v.salNom||'â€”'}</td>
          <td style="padding:8px 12px">${ent?formatDateExport(ent.date):'â€”'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  const win = window.open('','_blank','width=850,height=700');
  win.document.write('<!DOCTYPE html><html><head><title>VÃ©hicules â€” '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(()=>{window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport vÃ©hicules gÃ©nÃ©rÃ©');
}

/* ===============================================
   AJOUTS v22+ â€” FonctionnalitÃ©s supplÃ©mentaires
   =============================================== */

/* ===== FORMAT PRIX COMPLET HT/TVAâ‚¬/TTC ===== */
function formatPrixComplet(l) {
  if (!l.prix) return 'â€”';
  const taux = l.tauxTVA || parseFloat(localStorage.getItem('taux_tva')||'20');
  const ht   = l.prixHT || (l.prix / (1 + taux/100));
  const tvaM = l.prix - ht;
  return `<div><strong>${euros(l.prix)} TTC</strong></div><div style="font-size:.72rem;color:var(--text-muted)">${euros(ht)} HT Â· TVA ${euros(tvaM)}</div>`;
}

/* ===== RELANCES â€” LETTRES PDF 3 NIVEAUX ===== */
function genererLettreRelance(livId, niveau) {
  const liv = charger('livraisons').find(l=>l.id===livId);
  if (!liv) return;
  const params  = getEntrepriseExportParams();
  const nom     = params.nom;
  const dateExp = formatDateExport(new Date());
  const joursRetard = Math.floor((new Date()-new Date(liv.date))/(1000*60*60*24));
  const montant = euros(liv.prix||0);
  const logo = renderLogoEntrepriseExport();

  const niveaux = {
    1: {
      titre: 'RELANCE AMIABLE',
      couleur: '#2ecc71',
      objet: 'Relance amiable â€” Facture ' + (liv.numLiv||''),
      corps: 'Nous nous permettons de vous rappeler que la livraison <strong>' + (liv.numLiv||'') + '</strong> du <strong>' + formatDateExport(liv.date) + '</strong> d\'un montant de <strong>' + montant + '</strong> reste, Ã  ce jour, impayÃ©e (' + joursRetard + ' jours de retard).<br><br>Il est possible que ce rÃ¨glement ait Ã©tÃ© effectuÃ© entre-temps. Dans ce cas, nous vous prions de ne pas tenir compte de ce courrier.<br><br>Dans le cas contraire, nous vous serions reconnaissants de bien vouloir procÃ©der au rÃ¨glement dans les meilleurs dÃ©lais.'
    },
    2: {
      titre: 'MISE EN DEMEURE',
      couleur: '#f39c12',
      objet: 'Mise en demeure â€” Facture ' + (liv.numLiv||''),
      corps: 'MalgrÃ© notre relance prÃ©cÃ©dente, nous constatons que la livraison <strong>' + (liv.numLiv||'') + '</strong> du <strong>' + formatDateExport(liv.date) + '</strong> d\'un montant de <strong>' + montant + '</strong> demeure impayÃ©e (' + joursRetard + ' jours de retard).<br><br>Par la prÃ©sente, nous vous mettons en demeure de rÃ©gler cette somme sous <strong>8 jours</strong> Ã  compter de la rÃ©ception de ce courrier.<br><br>Ã€ dÃ©faut de paiement dans ce dÃ©lai, nous nous rÃ©servons le droit d\'appliquer des pÃ©nalitÃ©s de retard et d\'engager toute procÃ©dure de recouvrement nÃ©cessaire.'
    },
    3: {
      titre: 'DERNIER AVIS AVANT CONTENTIEUX',
      couleur: '#e74c3c',
      objet: 'Dernier avis avant procÃ©dure â€” Facture ' + (liv.numLiv||''),
      corps: 'Nos prÃ©cÃ©dentes relances Ã©tant restÃ©es sans effet, nous vous informons que la livraison <strong>' + (liv.numLiv||'') + '</strong> du <strong>' + formatDateExport(liv.date) + '</strong> d\'un montant de <strong>' + montant + '</strong> n\'a toujours pas Ã©tÃ© rÃ©glÃ©e (' + joursRetard + ' jours de retard).<br><br>Le prÃ©sent courrier constitue un <strong>dernier avis avant engagement d\'une procÃ©dure contentieuse</strong>.<br><br>Sans rÃ©ception de votre rÃ¨glement sous <strong>48 heures</strong>, nous transmettrons ce dossier Ã  notre service juridique pour engagement des poursuites appropriÃ©es. Les frais de recouvrement seront intÃ©gralement Ã  votre charge.'
    }
  };
  var n = niveaux[niveau] || niveaux[1];

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;color:#1a1d27">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">' +
      '<div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">' + nom + '</div>' +
      (params.adresse ? '<div style="font-size:.82rem;color:#6b7280;margin-top:2px">' + params.adresse + '</div>' : '') +
      (params.tel ? '<div style="font-size:.82rem;color:#6b7280">ðŸ“ž ' + params.tel + '</div>' : '') +
      (params.email ? '<div style="font-size:.82rem;color:#6b7280">âœ‰ï¸ ' + params.email + '</div>' : '') +
      (params.siret ? '<div style="font-size:.78rem;color:#9ca3af;margin-top:4px">SIRET : ' + params.siret + '</div>' : '') +
      (params.nomAdmin ? '<div style="font-size:.78rem;color:#9ca3af">Contact : ' + params.nomAdmin + '</div>' : '') +
      '</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;text-align:right">' + (logo || '') + '<div style="font-size:.82rem;color:#9ca3af">' + dateExp + '</div></div></div>' +
    '<div style="text-align:center;margin:24px 0;padding:12px;background:' + n.couleur + '15;border:2px solid ' + n.couleur + ';border-radius:10px">' +
      '<div style="font-size:1.1rem;font-weight:800;color:' + n.couleur + ';letter-spacing:2px">' + n.titre + '</div></div>' +
    '<div style="margin-bottom:20px"><div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">Destinataire :</div><div style="font-size:1rem;font-weight:700">' + liv.client + '</div></div>' +
    '<div style="font-size:.88rem;margin-bottom:24px;padding:16px;background:#f8f9fc;border-radius:8px;border-left:4px solid ' + n.couleur + '"><strong>Objet :</strong> ' + n.objet + '</div>' +
    '<div style="font-size:.9rem;line-height:1.7;margin-bottom:24px"><p>Madame, Monsieur,</p><p>' + n.corps + '</p><p>Nous restons Ã  votre disposition pour tout renseignement complÃ©mentaire.</p><p>Veuillez agrÃ©er, Madame, Monsieur, l\'expression de nos salutations distinguÃ©es.</p></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0;padding:14px;background:#f8f9fc;border-radius:8px">' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">RÃ©fÃ©rence</div><div style="font-weight:700">' + (liv.numLiv||'â€”') + '</div></div>' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Date livraison</div><div style="font-weight:700">' + formatDateExport(liv.date) + '</div></div>' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Montant dÃ»</div><div style="font-weight:700;color:' + n.couleur + ';font-size:1.1rem">' + montant + '</div></div>' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Retard</div><div style="font-weight:700">' + joursRetard + ' jours</div></div></div>' +
    '<div style="margin-top:32px;text-align:right"><div style="font-size:.9rem;font-weight:600">' + (params.nomAdmin||'La Direction') + '</div><div style="font-size:.82rem;color:#6b7280">' + nom + '</div></div>' +
    '<div style="border-top:1px solid #e5e7eb;margin-top:40px;padding-top:10px;font-size:.7rem;color:#9ca3af;text-align:center">Document gÃ©nÃ©rÃ© le ' + dateExp + ' â€” ' + nom + '</div></div>';

  ouvrirFenetreImpression(n.titre + ' - ' + liv.client, html, 'width=800,height=900');

  var livs = charger('livraisons');
  var idx = livs.findIndex(function(l){return l.id===livId;});
  if (idx>-1) { livs[idx].derniereRelance=new Date().toISOString(); livs[idx].niveauRelance=niveau; sauvegarder('livraisons',livs); }
  afficherRelances();
  afficherToast('ðŸ“„ Lettre de relance niveau ' + niveau + ' gÃ©nÃ©rÃ©e');
}

/* ===== PLANNING â€” PÃ‰RIODE ABSENCE ===== */
function ajouterPeriodeAbsence() {
  var salId = document.getElementById('absence-sal') ? document.getElementById('absence-sal').value : '';
  var type  = document.getElementById('absence-type') ? document.getElementById('absence-type').value : 'conge';
  var debut = document.getElementById('absence-debut') ? document.getElementById('absence-debut').value : '';
  var fin   = document.getElementById('absence-fin') ? document.getElementById('absence-fin').value : '';
  if (!salId || !debut || !fin) { afficherToast('âš ï¸ SalariÃ©, date dÃ©but et date fin obligatoires','error'); return; }
  if (fin < debut) { afficherToast('âš ï¸ La date de fin doit Ãªtre aprÃ¨s la date de dÃ©but','error'); return; }
  var absences = JSON.parse(localStorage.getItem('absences_periodes')||'[]');
  absences.push({ id:genId(), salId:salId, type:type, debut:debut, fin:fin, creeLe:new Date().toISOString() });
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  if (document.getElementById('absence-debut')) document.getElementById('absence-debut').value = '';
  if (document.getElementById('absence-fin')) document.getElementById('absence-fin').value = '';
  if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  var typeLabel = type==='conge'?'CongÃ©':type==='maladie'?'Maladie':'Absence';
  afficherToast('âœ… ' + typeLabel + ' du ' + debut + ' au ' + fin);
}

function afficherAbsencesPeriodes() {
  var cont = document.getElementById('liste-absences-periodes');
  if (!cont) return;
  var absences = JSON.parse(localStorage.getItem('absences_periodes')||'[]');
  var salaries = charger('salaries');
  var typeColors = { conge:'#3498db', absence:'#e74c3c', maladie:'#9b59b6' };
  var typeLabels = { conge:'CongÃ©', absence:'Absence', maladie:'Maladie' };
  if (!absences.length) { cont.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);padding:8px 0">Aucune pÃ©riode enregistrÃ©e</div>'; return; }
  cont.innerHTML = absences.sort(function(a,b){return new Date(b.debut)-new Date(a.debut);}).map(function(a) {
    var sal = salaries.find(function(s){return s.id===a.salId;});
    var nbJours = Math.max(1, Math.round((new Date(a.fin)-new Date(a.debut))/(1000*60*60*24))+1);
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:4px;background:' + (typeColors[a.type]||'#6b7280') + '10;border:1px solid ' + (typeColors[a.type]||'#6b7280') + '30;border-radius:8px;font-size:.82rem">' +
      '<span style="color:' + (typeColors[a.type]||'#6b7280') + ';font-weight:600">' + (typeLabels[a.type]||a.type) + '</span>' +
      '<strong>' + (sal?sal.nom:'?') + '</strong>' +
      '<span style="color:var(--text-muted)">' + a.debut + ' â†’ ' + a.fin + ' (' + nbJours + 'j)</span>' +
      '<button onclick="supprimerAbsencePeriode(\'' + a.id + '\')" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--red);font-size:.85rem" title="Supprimer">âœ•</button></div>';
  }).join('');
}

function supprimerAbsencePeriode(id) {
  var absences = JSON.parse(localStorage.getItem('absences_periodes')||'[]').filter(function(a){return a.id!==id;});
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('ðŸ—‘ï¸ PÃ©riode supprimÃ©e');
}

/* ===== CHARGES â†’ SYNCHRO ENTRETIEN ===== */
function synchroChargeVersEntretien(charge) {
  if (charge.categorie !== 'entretien') return;
  var entretiens = charger('entretiens');
  var existe = entretiens.find(function(e){return e.chargeId===charge.id;});
  if (existe) return;
  entretiens.push({
    id: genId(), chargeId: charge.id, vehId: charge.vehId || '',
    date: charge.date, type: 'autre', description: charge.description || 'Depuis charges',
    km: 0, prochainKm: 0, cout: charge.montant || 0, coutHT: charge.montantHT || 0, tauxTVA: charge.tauxTVA || 20,
    tauxDeductible: getTauxDeductibiliteVehicule(charge.vehId, 100), creeLe: new Date().toISOString()
  });
  sauvegarder('entretiens', entretiens);
}

/* ===== INCIDENTS â€” PEUPLER SELECT SALARIÃ‰ ===== */
function peupleIncSalarie() {
  var sel = document.getElementById('inc-salarie');
  if (!sel) return;
  var salaries = charger('salaries');
  var v = sel.value;
  sel.innerHTML = '<option value="">â€” Aucun salariÃ© spÃ©cifique â€”</option>';
  salaries.forEach(function(s) { sel.innerHTML += '<option value="' + s.id + '">' + s.nom + (s.poste?' ('+s.poste+')':'') + '</option>'; });
  sel.value = v;
}

/* ===== PEUPLER SELECT ABSENCE SAL ===== */
function peuplerAbsenceSal() {
  var sel = document.getElementById('absence-sal');
  if (!sel) return;
  var salaries = charger('salaries');
  var v = sel.value;
  sel.innerHTML = '<option value="">-- Choisir --</option>';
  salaries.forEach(function(s) { sel.innerHTML += '<option value="' + s.id + '">' + s.nom + (s.poste ? ' â€” ' + s.poste : '') + (s.numero ? ' (' + s.numero + ')' : '') + '</option>'; });
  sel.value = v;
}

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

function peuplerSelectPlanningModal() {
  const sel = document.getElementById('plan-salarie');
  if (!sel) return;
  const salaries = charger('salaries');
  const currentValue = sel.value;
  sel.innerHTML = '<option value="">-- Choisir un salariÃ© --</option>';
  salaries.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.nom}${s.numero ? ' ('+s.numero+')' : ''}</option>`; });
  sel.value = currentValue;
}

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

function filtrerPlanningSemaine() {
  afficherPlanningSemaine();
}

/* ===============================================
   PLANNING SEMAINE â€” Navigation + Absences + PDF
   =============================================== */

var _planningSemaineOffset = 0; // 0 = semaine courante

function getLundiDeSemaine(offset) {
  var d = new Date();
  var day = d.getDay(); // 0=dim
  var diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  d.setDate(diff + (offset||0) * 7);
  d.setHours(0,0,0,0);
  return d;
}

function naviguerSemaine(delta) {
  if (delta === 0) _planningSemaineOffset = 0;
  else _planningSemaineOffset += delta;
  afficherPlanningSemaine();
}

function afficherPlanningSemaine() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var salaries  = charger('salaries');
  var plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  var absences  = JSON.parse(localStorage.getItem('absences_periodes')||'[]');

  var JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // Calculer les 7 dates de la semaine
  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var labelSemaine = 'Semaine ' + getNumSemaine(lundi) + ' â€” ' + lundi.getFullYear();
  var labelDates = lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' au ' + dimanche.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});

  var elLabel = document.getElementById('planning-semaine-label');
  var elDates = document.getElementById('planning-semaine-dates');
  if (elLabel) elLabel.textContent = labelSemaine;
  if (elDates) elDates.textContent = labelDates;

  // Thead avec dates
  var thead = document.getElementById('thead-planning-semaine');
  if (thead) {
    thead.innerHTML = '<tr><th>SalariÃ©</th>' + datesSemaine.map(function(d,i) {
      var isAuj = d.toISOString().split('T')[0] === aujourdhui();
      return '<th style="text-align:center;' + (isAuj?'color:var(--accent);font-weight:800':'') + '">' + JOURS_COURTS[i] + ' ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '</th>';
    }).join('') + '</tr>';
  }

  // Corps
  var tb = document.getElementById('tb-planning-semaine');
  if (!tb) return;

  if (!salaries.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salariÃ©</td></tr>'; return; }

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
      var dateStr = d.toISOString().split('T')[0];
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
  if (!salariesFiltres.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salariÃ© ne correspond Ã  la recherche</td></tr>'; return; }

  var typeColors = { travail:'var(--green)', repos:'var(--text-muted)', conge:'#3498db', absence:'#e74c3c', maladie:'#9b59b6' };
  var typeIcons  = { travail:'ðŸŸ¢', repos:'âšª', conge:'ðŸ”µ', absence:'ðŸŸ¡', maladie:'ðŸŸ£' };

  tb.innerHTML = salariesFiltres.map(function(s) {
    var plan = plannings.find(function(p){return p.salId===s.id;});

    var cellules = datesSemaine.map(function(d, i) {
      var dateStr = d.toISOString().split('T')[0];

      // VÃ©rifier si une pÃ©riode d'absence couvre ce jour
      var absJour = absences.find(function(a) {
        return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin;
      });

      if (absJour) {
        var label = absJour.type === 'conge' ? 'CongÃ©' : absJour.type === 'maladie' ? 'Maladie' : 'Absent';
        return '<td style="text-align:center;background:' + (typeColors[absJour.type]||'#e74c3c') + '10;color:' + (typeColors[absJour.type]||'#e74c3c') + ';font-size:.78rem;font-weight:600">' + (typeIcons[absJour.type]||'ðŸŸ¡') + ' ' + label + '</td>';
      }

      // Sinon, planning type de la semaine
      var jourNom = JOURS[i];
      var jour = plan ? (plan.semaine||[]).find(function(j){return j.jour===jourNom;}) : null;

      if (!jour || !jour.travaille) {
        if (jour && ['conge','absence','maladie'].includes(jour.typeJour)) {
          var lb = jour.typeJour === 'conge' ? 'CongÃ©' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absent';
          return '<td style="text-align:center;color:' + (typeColors[jour.typeJour]||'#6b7280') + ';font-size:.78rem">' + (typeIcons[jour.typeJour]||'âšª') + ' ' + lb + '</td>';
        }
        return '<td style="text-align:center;color:var(--text-muted);font-size:.78rem">âšª Repos</td>';
      }

      return '<td style="text-align:center;color:var(--green);font-size:.78rem">ðŸŸ¢ ' + (jour.heureDebut||'') + (jour.heureFin ? ' â€“ ' + jour.heureFin : '') + '</td>';
    }).join('');

    return '<tr><td><strong>' + s.nom + '</strong>' + (s.poste ? '<br><span style="font-size:.72rem;color:var(--text-muted)">' + s.poste + '</span>' : '') + (s.numero ? '<br><span style="font-size:.72rem;color:var(--text-muted)">#' + s.numero + '</span>' : '') + '</td>' + cellules + '</tr>';
  }).join('');
}

function getNumSemaine(d) {
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

/* ===== EXPORT PDF SEMAINE ===== */
function exporterPlanningSemainePDF() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var salaries  = charger('salaries');
  var plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  var absences  = JSON.parse(localStorage.getItem('absences_periodes')||'[]');
  var params    = getEntrepriseExportParams();
  var nom       = params.nom;
  var dateExp   = formatDateHeureExport();

  var JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi); d.setDate(lundi.getDate() + i); datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var titreSemaine = 'Semaine ' + getNumSemaine(lundi) + ' â€” ' + lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' au ' + dimanche.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});

  var thCols = datesSemaine.map(function(d,i) {
    return '<th style="padding:8px 6px;text-align:center;color:#6b7280;font-size:.82rem">' + JOURS_COURTS[i] + ' ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '</th>';
  }).join('');

  var rows = salaries.map(function(s) {
    var plan = plannings.find(function(p){return p.salId===s.id;});
    var cells = datesSemaine.map(function(d, i) {
      var dateStr = d.toISOString().split('T')[0];
      var absJour = absences.find(function(a){ return a.salId===s.id && dateStr>=a.debut && dateStr<=a.fin; });
      if (absJour) {
        var colors = { conge:'#3498db', maladie:'#9b59b6', absence:'#e74c3c' };
        var labels = { conge:'CongÃ©', maladie:'Maladie', absence:'Absent' };
        return '<td style="padding:6px;text-align:center;background:' + (colors[absJour.type]||'#e74c3c') + '15;color:' + (colors[absJour.type]||'#e74c3c') + ';font-size:.78rem;font-weight:600">' + (labels[absJour.type]||'Absent') + '</td>';
      }
      var jourNom = JOURS[i];
      var jour = plan ? (plan.semaine||[]).find(function(j){return j.jour===jourNom;}) : null;
      if (!jour || !jour.travaille) {
        if (jour && ['conge','absence','maladie'].includes(jour.typeJour)) {
          var lb2 = {conge:'CongÃ©',maladie:'Maladie',absence:'Absent'}; 
          return '<td style="padding:6px;text-align:center;color:#9ca3af;font-size:.78rem">' + (lb2[jour.typeJour]||'â€”') + '</td>';
        }
        return '<td style="padding:6px;text-align:center;color:#d1d5db;font-size:.78rem">â€”</td>';
      }
      return '<td style="padding:6px;text-align:center;color:#2ecc71;font-size:.78rem">' + (jour.heureDebut||'') + (jour.heureFin?' â€“ '+jour.heureFin:'') + '</td>';
    }).join('');
    return '<tr><td style="padding:8px 12px;font-weight:600">' + s.nom + '</td><td style="padding:8px 12px;font-size:.82rem;color:#6b7280">' + (s.poste||'â€”') + '</td>' + cells + '</tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#1a1d27">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">' +
      '<div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">' + nom + '</div></div>' +
      '<div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">' + titreSemaine + '</div><div style="font-size:.78rem;color:#9ca3af">' + dateExp + '</div></div></div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
      '<thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">SalariÃ©</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th>' + thCols + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
    '<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>' + nom + '</span><span>' + dateExp + '</span></div></div>';

  var win = window.open('','_blank','width=950,height=700');
  win.document.write('<!DOCTYPE html><html><head><title>Planning ' + titreSemaine + '</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:10mm;size:landscape}</style></head><body>' + html + '<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport planning semaine gÃ©nÃ©rÃ©');
}

/* ===============================================
   NAVIGATION PÃ‰RIODE â€” Toutes les pages
   =============================================== */

/* --- LIVRAISONS : mois + semaine --- */
var _livPeriodeOffset = 0;
var _livPeriodeMode = 'mois';

function navLivPeriode(mode, delta) {
  if (mode === 'reset') { _livPeriodeOffset = 0; _livPeriodeMode = 'mois'; }
  else { _livPeriodeMode = mode; _livPeriodeOffset += delta; }
  var range = getPeriodeRange(_livPeriodeMode, _livPeriodeOffset);
  var deb = document.getElementById('filtre-date-debut');
  var fin = document.getElementById('filtre-date-fin');
  if (deb) deb.value = range.debut;
  if (fin) fin.value = range.fin;
  var lbl = document.getElementById('liv-periode-label');
  if (lbl) lbl.textContent = range.label;
  if (_vueLivraisons === 'kanban') afficherKanban();
  else if (_vueLivraisons === 'calendrier') afficherCalendrier();
  else afficherLivraisons();
}

/* --- HEURES & KM : semaine --- */
var _heuresSemaineOffset = 0;
function navHeuresSemaine(delta) {
  _heuresVue = 'semaine';
  if (delta === 0) _heuresSemaineOffset = 0;
  else _heuresSemaineOffset += delta;
  majHeuresPeriodeLabel();
  afficherCompteurHeures();
  afficherReleveKm();
}
function majHeuresSemaineLabel() {
  majHeuresPeriodeLabel();
}

/* --- INSPECTIONS : semaine --- */
var _inspSemaineOffset = 0;
function navInspSemaine(delta) {
  if (delta === 0) _inspSemaineOffset = 0;
  else _inspSemaineOffset += delta;
  var lundi = getLundiDeSemaine(_inspSemaineOffset);
  var dim = new Date(lundi); dim.setDate(lundi.getDate()+6);
  var elL = document.getElementById('insp-semaine-label');
  var elD = document.getElementById('insp-semaine-dates');
  if (elL) elL.textContent = 'Semaine ' + getNumSemaine(lundi);
  if (elD) elD.textContent = lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' au ' + dim.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  afficherInspections();
}

/* --- CHARGES : mois --- */
var _chargesMoisOffset = 0;
function navChargesMois(delta) {
  if (delta === 0) _chargesMoisOffset = 0;
  else _chargesMoisOffset += delta;
  var d = new Date(); d.setMonth(d.getMonth() + _chargesMoisOffset);
  var lbl = document.getElementById('charges-mois-label');
  if (lbl) lbl.textContent = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  afficherCharges();
}
function getChargesMoisStr() {
  var d = new Date(); d.setMonth(d.getMonth() + _chargesMoisOffset);
  return d.toISOString().slice(0,7);
}

/* --- CARBURANT : mois --- */
var _carbMoisOffset = 0;
function navCarbMois(delta) {
  if (delta === 0) _carbMoisOffset = 0;
  else _carbMoisOffset += delta;
  var d = new Date(); d.setMonth(d.getMonth() + _carbMoisOffset);
  var lbl = document.getElementById('carb-mois-label');
  if (lbl) lbl.textContent = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  afficherCarburant();
}
function getCarbMoisStr() {
  var d = new Date(); d.setMonth(d.getMonth() + _carbMoisOffset);
  return d.toISOString().slice(0,7);
}

/* --- ENTRETIENS : mois --- */
var _entrMoisOffset = 0;
function navEntrMois(delta) {
  if (delta === 0) _entrMoisOffset = 0;
  else _entrMoisOffset += delta;
  var d = new Date(); d.setMonth(d.getMonth() + _entrMoisOffset);
  var lbl = document.getElementById('entr-mois-label');
  if (lbl) lbl.textContent = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  afficherEntretiens();
}
function getEntrMoisStr() {
  var d = new Date(); d.setMonth(d.getMonth() + _entrMoisOffset);
  return d.toISOString().slice(0,7);
}

/* --- Utilitaire getPeriodeRange --- */
function getPeriodeRange(mode, offset) {
  if (mode === 'semaine') {
    var lundi = getLundiDeSemaine(offset);
    var dim = new Date(lundi); dim.setDate(lundi.getDate()+6);
    return {
      debut: lundi.toISOString().split('T')[0],
      fin: dim.toISOString().split('T')[0],
      label: 'Semaine ' + getNumSemaine(lundi) + ' â€” ' + lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' au ' + dim.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
    };
  }
  // mois
  var d = new Date();
  d.setMonth(d.getMonth() + offset);
  var debut = d.toISOString().slice(0,7) + '-01';
  var finD = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return {
    debut: debut,
    fin: finD.toISOString().split('T')[0],
    label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})
  };
}

/* --- EXPORT RELEVÃ‰ KM PDF --- */
function exporterReleveKmPDF() {
  var salaries = charger('salaries');
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var range = getHeuresPeriodeRange();
  var allKm = [];
  salaries.forEach(function(s) {
    var entrees = JSON.parse(localStorage.getItem('km_sal_'+s.id)||'[]');
    entrees.forEach(function(e) {
      if ((e.date || '') < range.debut || (e.date || '') > range.fin) return;
      var distance = e.kmArrivee != null ? (e.distance || (e.kmArrivee - e.kmDepart)) : 0;
      allKm.push({salNom:s.nom, date:e.date, kmDepart:e.kmDepart, kmArrivee:e.kmArrivee, distance:distance});
    });
  });
  allKm.sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var totalKm = allKm.reduce(function(s,e){return s+(e.distance||0);},0);
  var rows = allKm.slice(0,100).map(function(e,i) {
    var kmDep = e.kmDepart != null ? Math.round(e.kmDepart) : 'â€”';
    var kmArr = e.kmArrivee != null ? Math.round(e.kmArrivee) : 'â€”';
    var dist = e.kmArrivee != null ? Math.round(e.distance||0)+' km' : 'En attente';
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:8px 12px;font-weight:600">'+e.salNom+'</td><td style="padding:8px 12px">'+formatDateExport(e.date)+'</td><td style="padding:8px 12px;text-align:right">'+kmDep+'</td><td style="padding:8px 12px;text-align:right">'+kmArr+'</td><td style="padding:8px 12px;text-align:right;font-weight:700">'+dist+'</td></tr>';
  }).join('');
  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">'+
      '<div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">'+nom+'</div></div>'+
      '<div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">RelevÃ©s kilomÃ©triques</div><div style="font-size:1rem;font-weight:700">Total : '+Math.round(totalKm)+' km</div><div style="font-size:.78rem;color:#9ca3af">'+range.label+' Â· '+range.datesLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'+
      '<thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">SalariÃ©</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Date</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km dÃ©part</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km arrivÃ©e</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Distance</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';
  var win = window.open('','_blank','width=800,height=700');
  win.document.write('<!DOCTYPE html><html><head><title>RelevÃ©s km â€” '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport relevÃ©s km gÃ©nÃ©rÃ©');
}

/* ===============================================
   ONGLET TVA â€” RÃ©capitulatif mensuel
   =============================================== */

var _tvaMoisOffset = 0;
function navTvaMois(delta) {
  if (delta === 0) _tvaMoisOffset = 0;
  else _tvaMoisOffset += delta;
  var d = new Date(); d.setMonth(d.getMonth() + _tvaMoisOffset);
  var lbl = document.getElementById('tva-mois-label');
  if (lbl) lbl.textContent = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).toUpperCase();
  afficherTva();
}

function getTvaMoisStr() {
  var d = new Date(); d.setMonth(d.getMonth() + _tvaMoisOffset);
  return d.toISOString().slice(0,7);
}

function afficherTva() {
  var mois = getTvaMoisStr();

  // === TVA COLLECTÃ‰E (livraisons du mois) ===
  var livraisons = charger('livraisons').filter(function(l){return (l.date||'').startsWith(mois) && l.prix > 0;});

  var totalCollectee = 0;
  var tbColl = document.getElementById('tb-tva-collectee');
  if (tbColl) {
    var rows = '';
    livraisons.sort(function(a,b){return new Date(b.date)-new Date(a.date);}).forEach(function(l) {
      var taux = l.tauxTVA || 20;
      var ht = l.prixHT || l.prix / (1 + taux/100);
      var tvaM = l.prix - ht;
      totalCollectee += tvaM;
      var libelle = (l.numLiv ? l.numLiv + ' â€” ' : '') + (l.client || 'Livraison');
      rows += '<tr><td style="font-weight:700">' + taux + ' %</td><td>' + libelle + '</td><td>' + euros(ht) + '</td><td style="font-weight:700;color:var(--green)">' + euros(tvaM) + '</td><td>' + euros(l.prix||0) + '</td></tr>';
    });
    if (!rows) rows = '<tr><td colspan="5" class="empty-row">Aucune TVA collectÃ©e ce mois</td></tr>';
    else rows += '<tr style="background:rgba(46,204,113,.08);font-weight:700"><td>TOTAL</td><td></td><td></td><td style="color:var(--green)">' + euros(totalCollectee) + '</td><td>' + euros(livraisons.reduce(function(s,l){return s+(l.prix||0);},0)) + '</td></tr>';
    tbColl.innerHTML = rows;
  }

  // === TVA DÃ‰DUCTIBLE (charges + carburant + entretiens) ===
  var charges    = charger('charges').filter(function(c){return (c.date||'').startsWith(mois);});
  var carburant  = charger('carburant').filter(function(p){return (p.date||'').startsWith(mois);});
  var entretiens = charger('entretiens').filter(function(e){return (e.date||'').startsWith(mois);});

  var totalDeductible = 0;
  var tbDed = document.getElementById('tb-tva-deductible');
  if (tbDed) {
    var rows2 = '';
    charges.sort(function(a,b){return new Date(b.date)-new Date(a.date);}).forEach(function(c) {
      var taux = c.tauxTVA || 20;
      var ht = c.montantHT || (c.montant||0) / (1 + taux/100);
      var tvaM = (c.montant||0) - ht;
      totalDeductible += tvaM;
      rows2 += '<tr><td style="font-weight:700">' + taux + ' %</td><td>' + (c.description||'Charge') + '</td><td>' + euros(ht) + '</td><td style="font-weight:700;color:var(--accent)">' + euros(tvaM) + '</td><td>' + euros(c.montant||0) + '</td></tr>';
    });
    carburant.sort(function(a,b){return new Date(b.date)-new Date(a.date);}).forEach(function(p) {
      var tauxTVA = 20;
      var ht = (p.total||0) / (1 + tauxTVA/100);
      var tvaM = (p.total||0) - ht;
      var tauxRecup = getTauxDeductibiliteCarburant(p);
      var tvaDeduct = tvaM * tauxRecup / 100;
      totalDeductible += tvaDeduct;
      var libelle = (p.vehNom || 'Carburant') + ' â€” ' + ((p.typeCarburant||p.type||'gasoil') === 'essence' ? 'Essence' : 'Gasoil') + ' (' + formaterTaux(tauxRecup) + ')';
      rows2 += '<tr><td style="font-weight:700">' + tauxTVA + ' %</td><td>' + libelle + '</td><td>' + euros(ht) + '</td><td style="font-weight:700;color:var(--accent)">' + euros(tvaDeduct) + '</td><td>' + euros(p.total||0) + '</td></tr>';
    });
    entretiens.sort(function(a,b){return new Date(b.date)-new Date(a.date);}).forEach(function(e) {
      var taux = e.tauxTVA || 20;
      var ht = e.coutHT || (e.cout||0) / (1 + taux/100);
      var tvaM = (e.cout||0) - ht;
      var tauxRecup = getTauxDeductibiliteEntretien(e);
      var tvaDeduct = tvaM * tauxRecup / 100;
      totalDeductible += tvaDeduct;
      rows2 += '<tr><td style="font-weight:700">' + taux + ' %</td><td>' + getTypeEntretienLabel(e.type) + ' â€” ' + (e.description||'Entretien') + ' (' + formaterTaux(tauxRecup) + ')</td><td>' + euros(ht) + '</td><td style="font-weight:700;color:var(--accent)">' + euros(tvaDeduct) + '</td><td>' + euros(e.cout||0) + '</td></tr>';
    });
    if (!rows2) rows2 = '<tr><td colspan="5" class="empty-row">Aucune TVA dÃ©ductible ce mois</td></tr>';
    else rows2 += '<tr style="background:rgba(245,166,35,.08);font-weight:700"><td>TOTAL</td><td></td><td></td><td style="color:var(--accent)">' + euros(totalDeductible) + '</td><td></td></tr>';
    tbDed.innerHTML = rows2;
  }

  // === KPIs ===
  var setT = function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
  setT('tva-collectee', euros(totalCollectee));
  setT('tva-deductible', euros(totalDeductible));

  var solde = totalCollectee - totalDeductible;
  if (solde >= 0) {
    setT('tva-a-reverser', euros(solde));
    setT('tva-credit', 'â€”');
    var elRev = document.getElementById('tva-a-reverser'); if(elRev) elRev.style.color = 'var(--red)';
    var elCred = document.getElementById('tva-credit'); if(elCred) elCred.style.color = 'var(--text-muted)';
  } else {
    setT('tva-a-reverser', 'â€”');
    setT('tva-credit', euros(Math.abs(solde)));
    var elRev2 = document.getElementById('tva-a-reverser'); if(elRev2) elRev2.style.color = 'var(--text-muted)';
    var elCred2 = document.getElementById('tva-credit'); if(elCred2) elCred2.style.color = 'var(--green)';
  }

  // === Solde dÃ©tail ===
  var soldeEl = document.getElementById('tva-solde-detail');
  if (soldeEl) {
    soldeEl.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center">' +
      '<div style="padding:16px;background:rgba(46,204,113,.06);border-radius:10px;border:1px solid rgba(46,204,113,.2)"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">TVA CollectÃ©e</div><div style="font-size:1.3rem;font-weight:800;color:var(--green)">' + euros(totalCollectee) + '</div></div>' +
      '<div style="padding:16px;background:rgba(245,166,35,.06);border-radius:10px;border:1px solid rgba(245,166,35,.2)"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">TVA DÃ©ductible</div><div style="font-size:1.3rem;font-weight:800;color:var(--accent)">' + euros(totalDeductible) + '</div></div>' +
      '<div style="padding:16px;background:' + (solde>=0?'rgba(231,76,60,.06)':'rgba(52,152,219,.06)') + ';border-radius:10px;border:1px solid ' + (solde>=0?'rgba(231,76,60,.2)':'rgba(52,152,219,.2)') + '"><div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">' + (solde>=0?'TVA Ã  reverser':'CrÃ©dit de TVA') + '</div><div style="font-size:1.3rem;font-weight:800;color:' + (solde>=0?'var(--red)':'var(--green)') + '">' + euros(Math.abs(solde)) + '</div></div>' +
    '</div>' +
    '<div style="margin-top:16px;font-size:.82rem;color:var(--text-muted);text-align:center">' +
      (solde >= 0 ? 'âš ï¸ Vous devez reverser ' + euros(solde) + ' au TrÃ©sor Public pour ce mois.' : 'âœ… Vous disposez d\'un crÃ©dit de TVA de ' + euros(Math.abs(solde)) + ' reportable.') +
    '</div>';
  }
}

/* === EXPORT TVA PDF === */
function exporterTvaPDF() {
  var mois = getTvaMoisStr();
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var d = new Date(); d.setMonth(d.getMonth() + _tvaMoisOffset);
  var moisLabel = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  // Recalculer
  var livraisons = charger('livraisons').filter(function(l){return (l.date||'').startsWith(mois) && l.prix > 0;});
  var totalCollectee = 0;
  var collRows = '';
  var collParTaux = {};
  livraisons.forEach(function(l) {
    var taux = l.tauxTVA || 20;
    var ht = l.prixHT || l.prix / (1 + taux/100);
    var tvaM = l.prix - ht;
    if (!collParTaux[taux]) collParTaux[taux] = {ht:0,tva:0,nb:0};
    collParTaux[taux].ht += ht; collParTaux[taux].tva += tvaM; collParTaux[taux].nb++;
  });
  Object.keys(collParTaux).forEach(function(t) {
    var d2 = collParTaux[t]; totalCollectee += d2.tva;
    collRows += '<tr><td style="padding:6px 12px">'+t+' %</td><td style="padding:6px 12px;text-align:right">'+euros(d2.ht)+'</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:#2ecc71">'+euros(d2.tva)+'</td><td style="padding:6px 12px;text-align:center">'+d2.nb+'</td></tr>';
  });

  var charges = charger('charges').filter(function(c){return (c.date||'').startsWith(mois);});
  var carburant = charger('carburant').filter(function(p){return (p.date||'').startsWith(mois);});
  var entretiens = charger('entretiens').filter(function(e){return (e.date||'').startsWith(mois);});
  var totalDeductible = 0;
  var dedRows = '';
  var sources = [];
  function addDed(items, src, getTaux, getHT, getMontant) {
    var parTaux = {};
    items.forEach(function(item) {
      var taux = getTaux(item);
      var ht = getHT(item);
      var montant = getMontant(item);
      var tvaM = montant - ht;
      if (!parTaux[taux]) parTaux[taux] = {ht:0,tva:0,nb:0};
      parTaux[taux].ht += ht; parTaux[taux].tva += tvaM; parTaux[taux].nb++;
    });
    Object.keys(parTaux).forEach(function(t) {
      var d3 = parTaux[t]; totalDeductible += d3.tva;
      dedRows += '<tr><td style="padding:6px 12px">'+t+' %</td><td style="padding:6px 12px">'+src+'</td><td style="padding:6px 12px;text-align:right">'+euros(d3.ht)+'</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:#e67e22">'+euros(d3.tva)+'</td><td style="padding:6px 12px;text-align:center">'+d3.nb+'</td></tr>';
    });
  }
  addDed(charges, 'Charges', function(c){return c.tauxTVA||20;}, function(c){return c.montantHT||(c.montant||0)/(1+(c.tauxTVA||20)/100);}, function(c){return c.montant||0;});
  addDed(carburant, 'Carburant', function(){return 20;}, function(p){return (p.total||0)/1.2;}, function(p){return p.total||0;});
  addDed(entretiens, 'Entretiens', function(e){return e.tauxTVA||20;}, function(e){return e.coutHT||(e.cout||0)/(1+(e.tauxTVA||20)/100);}, function(e){return e.cout||0;});

  var solde = totalCollectee - totalDeductible;

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px"><div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">'+nom+'</div>'+(params.siret?'<div style="font-size:.78rem;color:#9ca3af">SIRET : '+params.siret+'</div>':'')+'</div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">RÃ©capitulatif TVA</div><div style="font-size:1rem;font-weight:700;text-transform:capitalize">'+moisLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>' +
    '<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#2ecc71">ðŸ“¤ TVA CollectÃ©e</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:20px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 12px;text-align:left">Taux</th><th style="padding:6px 12px;text-align:right">Base HT</th><th style="padding:6px 12px;text-align:right">TVA</th><th style="padding:6px 12px;text-align:center">Nb</th></tr></thead><tbody>'+collRows+'<tr style="background:#e8f5e9;font-weight:700"><td style="padding:6px 12px">TOTAL</td><td></td><td style="padding:6px 12px;text-align:right;color:#2ecc71">'+euros(totalCollectee)+'</td><td></td></tr></tbody></table>' +
    '<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e67e22">ðŸ“¥ TVA DÃ©ductible</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:20px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 12px;text-align:left">Taux</th><th style="padding:6px 12px;text-align:left">Source</th><th style="padding:6px 12px;text-align:right">Base HT</th><th style="padding:6px 12px;text-align:right">TVA</th><th style="padding:6px 12px;text-align:center">Nb</th></tr></thead><tbody>'+dedRows+'<tr style="background:#fff3e0;font-weight:700"><td style="padding:6px 12px">TOTAL</td><td></td><td></td><td style="padding:6px 12px;text-align:right;color:#e67e22">'+euros(totalDeductible)+'</td><td></td></tr></tbody></table>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0"><div style="padding:14px;background:#e8f5e9;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">CollectÃ©e</div><div style="font-size:1.2rem;font-weight:800;color:#2ecc71">'+euros(totalCollectee)+'</div></div><div style="padding:14px;background:#fff3e0;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">DÃ©ductible</div><div style="font-size:1.2rem;font-weight:800;color:#e67e22">'+euros(totalDeductible)+'</div></div><div style="padding:14px;background:'+(solde>=0?'#ffebee':'#e3f2fd')+';border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">'+(solde>=0?'Ã€ reverser':'CrÃ©dit TVA')+'</div><div style="font-size:1.2rem;font-weight:800;color:'+(solde>=0?'#e74c3c':'#2196F3')+'">'+euros(Math.abs(solde))+'</div></div></div>' +
    '<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';

  var win = window.open('','_blank','width=800,height=800');
  win.document.write('<!DOCTYPE html><html><head><title>TVA '+moisLabel+' â€” '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport TVA gÃ©nÃ©rÃ©');
}

/* ===============================================
   CORRECTIONS & AJOUTS â€” Exports + Planning + Carburant
   =============================================== */

/* --- Livraisons export suit la pÃ©riode --- */
var _origGenererRapportMensuel = typeof genererRapportMensuel === 'function' ? genererRapportMensuel : null;
function genererRapportMensuelPeriode() {
  var deb = document.getElementById('filtre-date-debut')?.value || '';
  var fin = document.getElementById('filtre-date-fin')?.value || '';
  var livraisons = charger('livraisons');
  if (deb) livraisons = livraisons.filter(function(l){return l.date >= deb;});
  if (fin) livraisons = livraisons.filter(function(l){return l.date <= fin;});
  livraisons.sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var totalHT = livraisons.reduce(function(s,l){return s + (l.prixHT || (l.prix||0)/(1+(l.tauxTVA||20)/100));},0);
  var totalTVA = livraisons.reduce(function(s,l){var ht=l.prixHT||(l.prix||0)/(1+(l.tauxTVA||20)/100); return s+((l.prix||0)-ht);},0);
  var totalTTC = livraisons.reduce(function(s,l){return s+(l.prix||0);},0);
  var periode = (deb && fin) ? deb + ' au ' + fin : 'Toutes les livraisons';

  var rows = livraisons.map(function(l,i) {
    var ht = l.prixHT || (l.prix||0)/(1+(l.tauxTVA||20)/100);
    var tvaM = (l.prix||0) - ht;
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:6px 10px;font-size:.82rem">'+l.date+'</td><td style="padding:6px 10px">'+l.client+'</td><td style="padding:6px 10px">'+(l.chaufNom||'â€”')+'</td><td style="padding:6px 10px;text-align:right">'+euros(ht)+'</td><td style="padding:6px 10px;text-align:right;color:#6b7280">'+euros(tvaM)+'</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(l.prix||0)+'</td><td style="padding:6px 10px;text-align:center">'+(l.statut==='livre'?'âœ…':l.statut==='en-cours'?'ðŸš':'â³')+'</td></tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:800px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px"><div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">'+nom+'</div></div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af">Rapport livraisons</div><div style="font-size:.88rem;font-weight:600">'+periode+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'+
      '<div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total HT</div><div style="font-size:1.1rem;font-weight:800;color:#2ecc71">'+euros(totalHT)+'</div></div>'+
      '<div style="background:#fff3e0;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total TVA</div><div style="font-size:1.1rem;font-weight:800;color:#e67e22">'+euros(totalTVA)+'</div></div>'+
      '<div style="background:#e3f2fd;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total TTC</div><div style="font-size:1.1rem;font-weight:800;color:#2196F3">'+euros(totalTTC)+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Date</th><th style="padding:6px 10px;text-align:left">Client</th><th style="padding:6px 10px;text-align:left">Chauffeur</th><th style="padding:6px 10px;text-align:right">HT</th><th style="padding:6px 10px;text-align:right">TVA</th><th style="padding:6px 10px;text-align:right">TTC</th><th style="padding:6px 10px;text-align:center">Statut</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:8px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+' â€” '+livraisons.length+' livraison(s)</span><span>'+dateExp+'</span></div></div>';

  var scriptAttenteExport = "(function(){function lancer(){setTimeout(function(){window.print();},250);}function attendre(){var images=Array.prototype.slice.call(document.images||[]);if(!images.length){lancer();return;}var restantes=images.length;function fini(){restantes-=1;if(restantes<=0) lancer();}images.forEach(function(img){if(img.complete){fini();return;}img.addEventListener('load',fini,{once:true});img.addEventListener('error',fini,{once:true});});}window.addEventListener('load',attendre);})();";
  var win = window.open('','_blank','width=850,height=700');
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Livraisons â€” '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>'+scriptAttenteExport+'<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport livraisons gÃ©nÃ©rÃ©');
}

/* --- Charges export suit le mois naviguÃ© + HT/TVA/TTC --- */
var _origExporterChargesPDF = typeof exporterChargesPDF === 'function' ? exporterChargesPDF : null;
function exporterChargesPDFMois() {
  var moisStr = getChargesMoisStr();
  var charges = charger('charges').filter(function(c){return (c.date||'').startsWith(moisStr);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var d = new Date(); d.setMonth(d.getMonth() + _chargesMoisOffset);
  var moisLabel = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  var totalHT=0, totalTVA=0, totalTTC=0;
  var catIcons = {carburant:'â›½',peage:'ðŸ›£ï¸',entretien:'ðŸ”§',assurance:'ðŸ›¡ï¸',autre:'ðŸ“'};
  var rows = charges.map(function(c,i) {
    var ht = c.montantHT || (c.montant||0)/(1+(c.tauxTVA||20)/100);
    var tvaM = (c.montant||0) - ht;
    totalHT += ht; totalTVA += tvaM; totalTTC += (c.montant||0);
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:6px 10px">'+c.date+'</td><td style="padding:6px 10px">'+(catIcons[c.categorie]||'ðŸ“')+' '+(c.categorie||'autre')+'</td><td style="padding:6px 10px">'+(c.description||'â€”')+'</td><td style="padding:6px 10px;text-align:right">'+euros(ht)+'</td><td style="padding:6px 10px;text-align:right;color:#6b7280">'+euros(tvaM)+'</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(c.montant||0)+'</td></tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px"><div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">'+nom+'</div></div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af">Charges â€” '+moisLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px"><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total HT</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalHT)+'</div></div><div style="background:#fff3e0;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">TVA</div><div style="font-size:1.1rem;font-weight:800;color:#e67e22">'+euros(totalTVA)+'</div></div><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total TTC</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalTTC)+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Date</th><th style="padding:6px 10px;text-align:left">CatÃ©gorie</th><th style="padding:6px 10px;text-align:left">Description</th><th style="padding:6px 10px;text-align:right">HT</th><th style="padding:6px 10px;text-align:right">TVA</th><th style="padding:6px 10px;text-align:right">TTC</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:8px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';

  var win = window.open('','_blank','width=800,height=700');
  win.document.write('<!DOCTYPE html><html><head><title>Charges '+moisLabel+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport charges gÃ©nÃ©rÃ©');
}

/* --- Carburant export PDF avec HT/TVA/TTC --- */
function exporterCarburantPDF() {
  var moisStr = getCarbMoisStr();
  var pleins = charger('carburant').filter(function(p){return (p.date||'').startsWith(moisStr);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var vehicules = charger('vehicules');
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var d = new Date(); d.setMonth(d.getMonth() + _carbMoisOffset);
  var moisLabel = d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  var totalHT=0, totalTVA=0, totalTTC=0;

  var rows = pleins.map(function(p,i) {
    var veh = vehicules.find(function(v){return v.id===p.vehId;});
    var tauxRecup = veh && veh.tvaCarbDeductible !== undefined ? veh.tvaCarbDeductible : (p.type==='essence'?100:80);
    var ht = (p.total||0) / 1.2;
    var tvaFull = (p.total||0) - ht;
    var tvaDeduct = tvaFull * tauxRecup / 100;
    totalHT += ht; totalTVA += tvaDeduct; totalTTC += (p.total||0);
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:6px 10px">'+p.date+'</td><td style="padding:6px 10px">'+(veh?veh.immat:'â€”')+'</td><td style="padding:6px 10px">'+(p.type||'gasoil')+'</td><td style="padding:6px 10px;text-align:right">'+(p.litres||0)+' L</td><td style="padding:6px 10px;text-align:right">'+euros(ht)+'</td><td style="padding:6px 10px;text-align:right;color:#6b7280">'+euros(tvaDeduct)+' ('+tauxRecup+'%)</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(p.total||0)+'</td></tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:800px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px"><div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">'+nom+'</div></div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af">Carburant â€” '+moisLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px"><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total HT</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalHT)+'</div></div><div style="background:#fff3e0;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">TVA dÃ©ductible</div><div style="font-size:1.1rem;font-weight:800;color:#e67e22">'+euros(totalTVA)+'</div></div><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total TTC</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalTTC)+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Date</th><th style="padding:6px 10px;text-align:left">VÃ©hicule</th><th style="padding:6px 10px">Type</th><th style="padding:6px 10px;text-align:right">Litres</th><th style="padding:6px 10px;text-align:right">HT</th><th style="padding:6px 10px;text-align:right">TVA dÃ©d.</th><th style="padding:6px 10px;text-align:right">TTC</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:8px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';

  var win = window.open('','_blank','width=850,height:700');
  win.document.write('<!DOCTYPE html><html><head><title>Carburant '+moisLabel+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('ðŸ“„ Rapport carburant gÃ©nÃ©rÃ©');
}
afficherRentabilite = function() {
  let livraisons = charger('livraisons'), pleins = charger('carburant'), entretiens = charger('entretiens'), charges = charger('charges');
  const range = getRentMoisRange();
  livraisons = livraisons.filter(l => l.date >= range.debut && l.date <= range.fin);
  pleins = pleins.filter(p => p.date >= range.debut && p.date <= range.fin);
  entretiens = entretiens.filter(e => e.date >= range.debut && e.date <= range.fin);
  charges = charges.filter(c => c.date >= range.debut && c.date <= range.fin && c.categorie !== 'entretien');
  const lbl = document.getElementById('rent-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('rent-mois-dates'); if (dates) dates.textContent = range.dates;
  const ca = livraisons.reduce((s, l) => s + getMontantHTLivraison(l), 0);
  const carb = pleins.reduce((s, p) => s + getMontantHTCarburant(p), 0);
  const entr = entretiens.reduce((s, e) => s + getMontantHTEntretien(e), 0);
  const autresCharges = charges.reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
  const dep = carb + entr + autresCharges;
  const profit = ca - dep;
  const marge = ca > 0 ? (profit / ca * 100) : 0;
  const kmLivraisons = livraisons.reduce((s, l) => s + (parseFloat(l.distance) || 0), 0);
  const kmReleves = charger('salaries').reduce((sum, sal) => {
    const entrees = charger('km_sal_' + sal.id).filter(e => (e.date || '') >= range.debut && (e.date || '') <= range.fin && e.kmArrivee != null);
    return sum + entrees.reduce((ss, e) => ss + (parseFloat(e.distance) || Math.max(0, (parseFloat(e.kmArrivee) || 0) - (parseFloat(e.kmDepart) || 0))), 0);
  }, 0);
  const km = kmLivraisons > 0 ? kmLivraisons : kmReleves;
  document.getElementById('rent-ca').textContent = euros(ca);
  document.getElementById('rent-carb').textContent = euros(carb);
  document.getElementById('rent-entretien').textContent = euros(entr);
  document.getElementById('rent-charges').textContent = euros(autresCharges);
  document.getElementById('rent-cout-km').textContent = euros(km > 0 ? dep / km : 0);
  document.getElementById('rent-profit').textContent = euros(profit);
  document.getElementById('rent-marge').textContent = marge.toFixed(1) + ' %';
  appliquerLibellesAnalyseHT();
  if (chartRentab) chartRentab.destroy();
  const isLight = document.body.classList.contains('light-mode');
  chartRentab = new Chart(document.getElementById('chartRentabilite'), {
    type: 'doughnut',
    data: { labels: ['Carburant HT', 'Entretien HT', 'Autres charges HT', 'Profit net HT'], datasets: [{ data: [carb, entr, autresCharges, Math.max(profit, 0)], backgroundColor: ['rgba(230,126,34,0.8)', 'rgba(52,152,219,0.8)', 'rgba(155,89,182,0.8)', 'rgba(46,204,113,0.8)'], borderColor: isLight ? '#ffffff' : '#1a1d27', borderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: isLight ? '#1a1d27' : '#e8eaf0' } }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${euros(ctx.parsed || 0)}` } } } }
  });
};

afficherStatistiques = function() {
  const isLight = document.body.classList.contains('light-mode');
  const tickColor = isLight ? '#555' : '#7c8299';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const legendColor = isLight ? '#1a1d27' : '#e8eaf0';
  const range = getStatsMoisRange();
  const dateMinStr = range.debut;
  const dateMaxStr = range.fin;
  const livraisons = charger('livraisons');
  const livsFiltrees = livraisons.filter(l => l.date >= dateMinStr && l.date <= dateMaxStr);
  const lbl = document.getElementById('stats-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('stats-mois-dates'); if (dates) dates.textContent = range.dates;
  const caPeriode = livsFiltrees.reduce((s, l) => s + getMontantHTLivraison(l), 0);
  const nbLivs = livsFiltrees.length;
  const panierMoy = nbLivs > 0 ? caPeriode / nbLivs : 0;
  const kmTotal = livsFiltrees.reduce((s, l) => s + (parseFloat(l.distance) || 0), 0);
  const el1 = document.getElementById('stats-ca-periode'); if (el1) el1.textContent = euros(caPeriode);
  const el2 = document.getElementById('stats-livraisons-periode'); if (el2) el2.textContent = nbLivs;
  const el3 = document.getElementById('stats-panier-moyen'); if (el3) el3.textContent = euros(panierMoy);
  const el4 = document.getElementById('stats-km-total'); if (el4) el4.textContent = Math.round(kmTotal) + ' km';
  appliquerLibellesAnalyseHT();
  const labels = [];
  const donnees = [];
  getDateRangeInclusive(dateMinStr, dateMaxStr).forEach(function(dateObj) {
    const ds = dateObj.toISOString().split('T')[0];
    labels.push(dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    donnees.push(livsFiltrees.filter(l => l.date === ds).reduce((s, l) => s + getMontantHTLivraison(l), 0));
  });
  if (chartCA) chartCA.destroy();
  chartCA = new Chart(document.getElementById('chartCA'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'CA HT (â‚¬)', data: donnees, borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#4f8ef7', borderWidth: 2.5 }] },
    options: { responsive: true, plugins: { legend: { labels: { color: legendColor } } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 12 } }, y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => euros(v) } } } }
  });
  const ch = charger('chauffeurs');
  if (chartChauff) chartChauff.destroy();
  const chData = ch.length ? ch.map(c => ({ nom: c.nom, nb: livsFiltrees.filter(l => l.chaufId === c.id).length })).sort((a, b) => b.nb - a.nb) : [{ nom: 'Aucun', nb: 0 }];
  chartChauff = new Chart(document.getElementById('chartChauffeurs'), {
    type: 'bar',
    data: { labels: chData.map(c => c.nom), datasets: [{ label: 'Livraisons', data: chData.map(c => c.nb), backgroundColor: 'rgba(155,89,182,0.65)', borderColor: 'rgba(155,89,182,1)', borderWidth: 1.5, borderRadius: 8 }] },
    options: { indexAxis: 'horizontal', responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor } }, y: { grid: { color: gridColor }, ticks: { color: tickColor } } } }
  });
  const veh = charger('vehicules');
  if (chartVeh) chartVeh.destroy();
  const vehData = veh.length ? veh.map(v => ({ nom: v.immat, nb: livsFiltrees.filter(l => l.vehId === v.id).length })).sort((a, b) => b.nb - a.nb) : [{ nom: 'Aucun', nb: 0 }];
  chartVeh = new Chart(document.getElementById('chartVehicules'), {
    type: 'bar',
    data: { labels: vehData.map(v => v.nom), datasets: [{ label: 'Livraisons', data: vehData.map(v => v.nb), backgroundColor: 'rgba(230,126,34,0.65)', borderColor: 'rgba(230,126,34,1)', borderWidth: 1.5, borderRadius: 8 }] },
    options: { indexAxis: 'horizontal', responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor } }, y: { grid: { color: gridColor }, ticks: { color: tickColor } } } }
  });
  if (chartCAParChauff) chartCAParChauff.destroy();
  const caChData = ch.length ? ch.map(c => ({ nom: c.nom, ca: livsFiltrees.filter(l => l.chaufId === c.id).reduce((s, l) => s + getMontantHTLivraison(l), 0) })).sort((a, b) => b.ca - a.ca) : [{ nom: 'Aucun', ca: 0 }];
  const ctxCA = document.getElementById('chartCAParChauffeur');
  if (ctxCA) {
    chartCAParChauff = new Chart(ctxCA, {
      type: 'doughnut',
      data: { labels: caChData.map(c => c.nom), datasets: [{ data: caChData.map(c => c.ca), backgroundColor: ['rgba(79,142,247,0.7)', 'rgba(245,166,35,0.7)', 'rgba(46,204,113,0.7)', 'rgba(155,89,182,0.7)', 'rgba(231,76,60,0.7)', 'rgba(52,152,219,0.7)', 'rgba(230,126,34,0.7)'], borderColor: isLight ? '#fff' : '#1a1d27', borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: legendColor } }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${euros(ctx.parsed || 0)}` } } } }
    });
  }
};

window.__adminFinalLock = function() {
  ouvrirFenetreImpression = function(titre, html, options) {
    const win = window.open('', '_blank', options || 'width=900,height=700');
    if (!win) return;
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>body{margin:0;padding:20px;background:#fff;font-family:Segoe UI,Arial,sans-serif}.export-logo{width:58px;height:58px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:6px}@page{margin:12mm}</style></head><body>' + html + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});<\/script></body></html>');
    win.document.close();
  };

  construireEnteteExport = function(params, titre, sousTitre, dateExp) {
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px">'
      + '<div><div style="font-size:1.35rem;font-weight:800;color:#f5a623">' + params.nom + '</div><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;margin-top:4px">' + titre + '</div>' + (sousTitre ? '<div style="font-size:.84rem;color:#4b5563;margin-top:6px">' + sousTitre + '</div>' : '') + '</div>'
      + '<div style="text-align:right;font-size:.78rem;color:#9ca3af">GÃ©nÃ©rÃ© le ' + dateExp + '</div>'
      + '</div>';
  };

  peuplerAbsenceSal = function() { planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist'); };
  filtrerRechercheAbsence = function() {
    var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
    if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
  };
  peuplerSelectPlanningModal = function() { planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist'); };
  filtrerRecherchePlanningModal = function() {
    var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
    if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
  };

  badgePaiementLivraisonHtml = function(statut) {
    return {
      'payÃ©': '<span class="badge badge-dispo">PayÃ©</span>',
      'en-attente': '<span class="badge badge-attente">En attente</span>',
      'litige': '<span class="badge badge-inactif">Litige</span>'
    }[statut || 'en-attente'] || '<span class="badge badge-attente">En attente</span>';
  };

  afficherLivraisons = function() {
    let livraisons = charger('livraisons');
    const tb = document.getElementById('tb-livraisons');
    const filtreStatut = document.getElementById('filtre-statut')?.value || '';
    const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
    const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
    const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
    const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
    const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';
    const selChauf = document.getElementById('filtre-chauffeur');
    if (selChauf) {
      const currentValue = selChauf.value;
      selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
      charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
      selChauf.value = currentValue;
    }
    if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
    if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
    if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
    if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
    if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
    if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
    livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
    if (!tb) return;
    if (!livraisons.length) return tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
    tb.innerHTML = livraisons.map(l => {
      const ht = getMontantHTLivraison(l);
      const tva = (parseFloat(l.prix) || 0) - ht;
      return `<tr>
        <td style="font-size:.78rem;color:var(--text-muted)">${l.numLiv || 'â€”'}</td>
        <td><strong>${l.client || 'â€”'}</strong></td>
        <td style="font-size:.82rem">${l.depart || 'â€”'}</td>
        <td style="font-size:.82rem">${l.arrivee || 'â€”'}</td>
        <td>${l.distance ? formatKm(l.distance) : 'â€”'}</td>
        <td style="font-size:.85rem">${euros(ht)}</td>
        <td style="font-size:.82rem;color:var(--text-muted)">${euros(tva)}</td>
        <td style="font-weight:700">${euros(l.prix || 0)}</td>
        <td>${l.chaufNom || 'â€”'}</td>
        <td class="${(l.profit||0)>=0?'profit-pos':'profit-neg'}">${euros(l.profit||0)}</td>
        <td><div class="livraison-status-cell"><label>Statut</label>${badgeStatut(l.statut)}<select onchange="changerStatutLivraison('${l.id}',this.value)"><option value="en-attente" ${l.statut==='en-attente'?'selected':''}>En attente</option><option value="en-cours" ${l.statut==='en-cours'?'selected':''}>En cours</option><option value="livre" ${l.statut==='livre'?'selected':''}>LivrÃ©</option></select></div></td>
        <td><div class="livraison-status-cell"><label>Paiement</label>${badgePaiementLivraisonHtml(l.statutPaiement)}<select onchange="changerStatutPaiement('${l.id}',this.value)"><option value="en-attente" ${(l.statutPaiement||'en-attente')==='en-attente'?'selected':''}>En attente</option><option value="payÃ©" ${l.statutPaiement==='payÃ©'?'selected':''}>PayÃ©</option><option value="litige" ${l.statutPaiement==='litige'?'selected':''}>Litige</option></select></div></td>
        <td><div class="livraison-actions-panel"><button class="btn-icon" onclick="dupliquerLivraison('${l.id}')" title="Dupliquer">ðŸ“‹</button><button class="btn-icon" onclick="ouvrirRecurrence('${l.id}')" title="RÃ©currence">ðŸ”</button><button class="btn-icon" onclick="ouvrirEditLivraison('${l.id}')" title="Modifier">âœï¸</button><button class="btn-icon danger" onclick="supprimerLivraison('${l.id}')" title="Supprimer">ðŸ—‘ï¸</button></div></td>
      </tr>`;
    }).join('');
  };
};
/* ===== FINAL ADMIN LOCK ===== */
ouvrirFenetreImpression = function(titre, html, options) {
  const win = window.open('', '_blank', options || 'width=900,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>html,body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}body{padding:20px}.export-logo{width:58px;height:58px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:6px}table,thead,tbody,tr,th,td,div,span{print-color-adjust:exact !important;-webkit-print-color-adjust:exact !important}@page{margin:12mm}</style></head><body>' + html + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});<\/script></body></html>');
  win.document.close();
};

construireEnteteExport = function(params, titre, sousTitre, dateExp) {
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px">'
    + '<div><div style="font-size:1.35rem;font-weight:800;color:#f5a623">' + params.nom + '</div><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;margin-top:4px">' + titre + '</div>' + (sousTitre ? '<div style="font-size:.84rem;color:#4b5563;margin-top:6px">' + sousTitre + '</div>' : '') + '</div>'
    + '<div style="text-align:right;font-size:.78rem;color:#9ca3af">GÃ©nÃ©rÃ© le ' + dateExp + '</div>'
    + '</div>';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRechercheAbsence = function() {
  var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
};

filtrerRecherchePlanningModal = function() {
  var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
  if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
};

badgePaiementLivraisonHtml = function(statut) {
  return {
    'payÃ©': '<span class="badge badge-dispo">PayÃ©</span>',
    'en-attente': '<span class="badge badge-attente">En attente</span>',
    'litige': '<span class="badge badge-inactif">Litige</span>'
  }[statut || 'en-attente'] || '<span class="badge badge-attente">En attente</span>';
};

const __finalLabelStatutLivraison = function(statut) {
  return statut === 'livre' ? 'LivrÃ©' : statut === 'en-cours' ? 'En cours' : 'En attente';
};

labelStatutLivraison = function(statut) {
  return __finalLabelStatutLivraison(statut);
};

calculerPrevision = function() {
  const livraisons = charger('livraisons');
  const carburant = charger('carburant');
  const charges = charger('charges');
  const moisReels = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toISOString().slice(0, 7);
    const livsM = livraisons.filter(l => (l.date || '').startsWith(moisStr));
    const caM = livsM.reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const carbM = carburant.filter(p => (p.date || '').startsWith(moisStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0);
    const chargM = charges.filter(c => (c.date || '').startsWith(moisStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    moisReels.push({ mois: moisStr, ca: caM, depenses: carbM + chargM, livraisons: livsM.length });
  }
  const nbMoisDonnees = moisReels.filter(m => m.ca > 0 || m.livraisons > 0).length;
  const moyCA = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.ca, 0) / nbMoisDonnees : 0;
  const moyDep = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.depenses, 0) / nbMoisDonnees : 0;
  const moyLivs = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.livraisons, 0) / nbMoisDonnees : 0;
  const tendanceCA = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA = moyCA * (1 + tendanceCA / 100 * 0.5);
  const prevDep = moyDep;
  const prevBen = prevCA - prevDep;
  const prevMarge = prevCA > 0 ? (prevBen / prevCA * 100) : 0;
  const elCA = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elTend = document.getElementById('prev-tendance');
  if (elCA) elCA.textContent = euros(prevCA);
  if (elDep) elDep.textContent = euros(prevDep);
  if (elBen) elBen.textContent = euros(prevBen);
  if (elMrg) elMrg.textContent = prevMarge.toFixed(1) + ' %';
  if (elLiv) elLiv.textContent = Math.round(moyLivs) + ' liv. estimÃ©es';
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = 'Tendance HT : ' + signe + tendanceCA.toFixed(1) + '%';
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }
};

afficherLivraisons = function() {
  let livraisons = charger('livraisons');
  const tb = document.getElementById('tb-livraisons');
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
  const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';
  const selChauf = document.getElementById('filtre-chauffeur');
  if (selChauf) {
    const currentValue = selChauf.value;
    selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
    charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
    selChauf.value = currentValue;
  }
  if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
  if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
  livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
  if (!tb) return;
  if (!livraisons.length) {
    tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
    return;
  }
  tb.innerHTML = livraisons.map(l => {
    const ht = getMontantHTLivraison(l);
    const tva = (parseFloat(l.prix) || 0) - ht;
    const statutPaiement = l.statutPaiement || 'en-attente';
    const selectStatutPropre = '<select onchange="changerStatutLivraison(\'' + l.id + '\',this.value)"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>LivrÃ©</option></select>';
    const selectPaiementPropre = '<select onchange="changerStatutPaiement(\'' + l.id + '\',this.value)"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="payÃ©" ' + (statutPaiement === 'payÃ©' ? 'selected' : '') + '>PayÃ©</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
    const actionStatutPropre = l.statut === 'livre'
      ? '<button class="btn-icon" onclick="changerStatutLivraison(\'' + l.id + '\',\'en-cours\')" title="Repasser en cours">â†©</button>'
      : '<button class="btn-icon" onclick="validerLivraisonLivree(\'' + l.id + '\')" title="Valider livrÃ©e">âœ“</button>';
    const actionPaiementPropre = statutPaiement === 'payÃ©'
      ? '<button class="btn-icon" onclick="changerStatutPaiement(\'' + l.id + '\',\'en-attente\')" title="Remettre en attente">â†©</button>'
      : '<button class="btn-icon" onclick="validerLivraisonPayee(\'' + l.id + '\')" title="Valider payÃ©e">â‚¬</button>';
    return `<tr>
      <td style="font-size:.78rem;color:var(--text-muted)">${l.numLiv || 'â€”'}</td>
      <td><strong>${l.client || 'â€”'}</strong></td>
      <td style="font-size:.82rem">${l.depart || 'â€”'}</td>
      <td style="font-size:.82rem">${l.arrivee || 'â€”'}</td>
      <td>${l.distance ? formatKm(l.distance) : 'â€”'}</td>
      <td style="font-size:.85rem">${euros(ht)}</td>
      <td style="font-size:.82rem;color:var(--text-muted)">${euros(tva)}</td>
      <td style="font-weight:700">${euros(l.prix || 0)}</td>
      <td>${l.chaufNom || 'â€”'}</td>
      <td class="${(l.profit||0)>=0?'profit-pos':'profit-neg'}">${euros(l.profit||0)}</td>
      <td>
        <div class="livraison-status-cell">
          <label>Statut</label>
          ${badgeStatut(l.statut)}
          <select onchange="changerStatutLivraison('${l.id}',this.value)">
            <option value="en-attente" ${l.statut==='en-attente'?'selected':''}>En attente</option>
            <option value="en-cours" ${l.statut==='en-cours'?'selected':''}>En cours</option>
            <option value="livre" ${l.statut==='livre'?'selected':''}>LivrÃ©</option>
          </select>
        </div>
      </td>
      <td>
        <div class="livraison-status-cell">
          <label>Paiement</label>
          ${badgePaiementLivraisonHtml(l.statutPaiement)}
          <select onchange="changerStatutPaiement('${l.id}',this.value)">
            <option value="en-attente" ${(l.statutPaiement||'en-attente')==='en-attente'?'selected':''}>En attente</option>
            <option value="payÃ©" ${l.statutPaiement==='payÃ©'?'selected':''}>PayÃ©</option>
            <option value="litige" ${l.statutPaiement==='litige'?'selected':''}>Litige</option>
          </select>
        </div>
      </td>
      <td>
        <div class="livraison-actions-panel">
          <button class="btn-icon" onclick="dupliquerLivraison('${l.id}')" title="Dupliquer">ðŸ“‹</button>
          <button class="btn-icon" onclick="ouvrirRecurrence('${l.id}')" title="RÃ©currence">ðŸ”</button>
          <button class="btn-icon" onclick="ouvrirEditLivraison('${l.id}')" title="Modifier">âœï¸</button>
          <button class="btn-icon danger" onclick="supprimerLivraison('${l.id}')" title="Supprimer">ðŸ—‘ï¸</button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

/* ===== ADMIN FINAL UX / EXPORTS ===== */
const labelPaiementLivraison = function(statut) {
  return statut === 'payÃ©' ? 'PayÃ©' : statut === 'litige' ? 'Litige' : 'En attente';
};

const labelStatutLivraisonLisible = function(statut) {
  return statut === 'livre' ? 'LivrÃ©' : statut === 'en-cours' ? 'En cours' : 'En attente';
};

planningSyncSearchWithSelect = function(searchId, selectId, datalistId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  var datalist = document.getElementById(datalistId);
  var salaries = charger('salaries');
  var query = (search?.value || '').trim().toLowerCase();
  var currentValue = select?.value || '';
  var filtered = salaries.filter(function(s) {
    if (!query) return true;
    return [planningBuildEmployeeLabel(s), s.nom, s.prenom, s.nomFamille, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(query);
  });
  if (select) {
    select.innerHTML = '<option value="">-- Choisir un salariÃ© --</option>';
    filtered.forEach(function(s) {
      select.innerHTML += '<option value="' + s.id + '">' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '</option>';
    });
    if (filtered.some(function(s) { return s.id === currentValue; })) select.value = currentValue;
  }
  if (datalist) {
    datalist.innerHTML = salaries.map(function(s) {
      return '<option value="' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '"></option>';
    }).join('');
  }
};

filtrerRechercheAbsence = function() {
  var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRecherchePlanningModal = function() {
  var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
  if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
};

construireEnteteExport = function(params, titre, sousTitre, dateExp) {
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px">'
    + '<div><div style="font-size:1.35rem;font-weight:800;color:#f5a623">' + params.nom + '</div><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;margin-top:4px">' + titre + '</div>' + (sousTitre ? '<div style="font-size:.84rem;color:#4b5563;margin-top:6px">' + sousTitre + '</div>' : '') + '</div>'
    + '<div style="text-align:right;font-size:.78rem;color:#9ca3af">GÃ©nÃ©rÃ© le ' + dateExp + '</div>'
    + '</div>';
};

badgePaiementLivraisonHtml = function(statut) {
  return {
    'payÃ©': '<span class="badge badge-dispo">PayÃ©</span>',
    'en-attente': '<span class="badge badge-attente">En attente</span>',
    'litige': '<span class="badge badge-inactif">Litige</span>'
  }[statut || 'en-attente'] || '<span class="badge badge-attente">En attente</span>';
};

labelStatutLivraison = function(statut) {
  return labelStatutLivraisonLisible(statut);
};

calculerPrevision = function() {
  const livraisons = charger('livraisons');
  const carburant = charger('carburant');
  const charges = charger('charges');
  const moisReels = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toISOString().slice(0,7);
    const livsM = livraisons.filter(l => (l.date || '').startsWith(moisStr));
    const caM = livsM.reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const carbM = carburant.filter(p => (p.date || '').startsWith(moisStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0);
    const chargM = charges.filter(c => (c.date || '').startsWith(moisStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    moisReels.push({ mois: moisStr, ca: caM, depenses: carbM + chargM, livraisons: livsM.length });
  }
  const nbMoisDonnees = moisReels.filter(m => m.ca > 0 || m.livraisons > 0).length;
  const moyCA = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.ca, 0) / nbMoisDonnees : 0;
  const moyDep = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.depenses, 0) / nbMoisDonnees : 0;
  const moyLivs = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.livraisons, 0) / nbMoisDonnees : 0;
  const tendanceCA = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA = moyCA * (1 + tendanceCA / 100 * 0.5);
  const prevDep = moyDep;
  const prevBen = prevCA - prevDep;
  const prevMarge = prevCA > 0 ? (prevBen / prevCA * 100) : 0;
  const elCA = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elTend = document.getElementById('prev-tendance');
  if (elCA) elCA.textContent = euros(prevCA);
  if (elDep) elDep.textContent = euros(prevDep);
  if (elBen) elBen.textContent = euros(prevBen);
  if (elMrg) elMrg.textContent = prevMarge.toFixed(1) + ' %';
  if (elLiv) elLiv.textContent = Math.round(moyLivs) + ' liv. estimÃ©es';
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = 'Tendance HT : ' + signe + tendanceCA.toFixed(1) + '%';
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }
  const labels = [], dataCA = [], dataBen = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mStr = d.toISOString().slice(0,7);
    const caM = livraisons.filter(l => (l.date || '').startsWith(mStr)).reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const depM = carburant.filter(p => (p.date || '').startsWith(mStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0)
      + charges.filter(c => (c.date || '').startsWith(mStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    labels.push(d.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }));
    dataCA.push(caM);
    dataBen.push(caM - depM);
  }
  const dNext = new Date(); dNext.setMonth(dNext.getMonth() + 1);
  labels.push(dNext.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }) + ' *');
  dataCA.push(Math.round(prevCA));
  dataBen.push(Math.round(prevBen));
  if (chartPrev) chartPrev.destroy();
  const ctx = document.getElementById('chartPrevision');
  if (!ctx) return;
  chartPrev = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'CA rÃ©el HT (â‚¬)', data:dataCA.slice(0,-1).concat([null]), backgroundColor:'rgba(79,142,247,0.4)', borderColor:'rgba(79,142,247,0.9)', borderWidth:2, borderRadius:6 },
        { label:'CA prÃ©vu HT (â‚¬)', data:Array(6).fill(null).concat([dataCA[6]]), backgroundColor:'rgba(245,166,35,0.3)', borderColor:'rgba(245,166,35,0.9)', borderWidth:2, borderRadius:6, borderDash:[5,5] },
        { label:'BÃ©nÃ©fice net HT (â‚¬)', data:dataBen.slice(0,-1).concat([null]), type:'line', borderColor:'#2ecc71', backgroundColor:'rgba(46,204,113,0.1)', fill:true, tension:0.4, pointRadius:4 }
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#e8eaf0' } }, tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${euros(ctx.parsed.y||0)}` } } },
      scales:{ x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299'} }, y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299', callback:v=>euros(v)} } }
    }
  });
};

afficherLivraisons = function() {
  let livraisons = charger('livraisons');
  const tb = document.getElementById('tb-livraisons');
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
  const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';
  const selChauf = document.getElementById('filtre-chauffeur');
  if (selChauf) {
    const currentValue = selChauf.value;
    selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
    charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
    selChauf.value = currentValue;
  }
  if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
  if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
  livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));
  if (!tb) return;
  if (!livraisons.length) {
    tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
    return;
  }
  tb.innerHTML = livraisons.map(l => {
    const ht = getMontantHTLivraison(l);
    const tva = (parseFloat(l.prix) || 0) - ht;
    return `<tr>
      <td style="font-size:.78rem;color:var(--text-muted)">${l.numLiv || 'â€”'}</td>
      <td><strong>${l.client || 'â€”'}</strong></td>
      <td style="font-size:.82rem">${l.depart || 'â€”'}</td>
      <td style="font-size:.82rem">${l.arrivee || 'â€”'}</td>
      <td>${l.distance ? formatKm(l.distance) : 'â€”'}</td>
      <td style="font-size:.85rem">${euros(ht)}</td>
      <td style="font-size:.82rem;color:var(--text-muted)">${euros(tva)}</td>
      <td style="font-weight:700">${euros(l.prix || 0)}</td>
      <td>${l.chaufNom || 'â€”'}</td>
      <td class="${(l.profit||0)>=0?'profit-pos':'profit-neg'}">${euros(l.profit||0)}</td>
      <td>
        <div class="livraison-status-cell">
          <label>Statut</label>
          ${badgeStatut(l.statut)}
          <select onchange="changerStatutLivraison('${l.id}',this.value)">
            <option value="en-attente" ${l.statut==='en-attente'?'selected':''}>En attente</option>
            <option value="en-cours" ${l.statut==='en-cours'?'selected':''}>En cours</option>
            <option value="livre" ${l.statut==='livre'?'selected':''}>LivrÃ©</option>
          </select>
        </div>
      </td>
      <td>
        <div class="livraison-status-cell">
          <label>Paiement</label>
          ${badgePaiementLivraisonHtml(l.statutPaiement)}
          <select onchange="changerStatutPaiement('${l.id}',this.value)">
            <option value="en-attente" ${(l.statutPaiement||'en-attente')==='en-attente'?'selected':''}>En attente</option>
            <option value="payÃ©" ${l.statutPaiement==='payÃ©'?'selected':''}>PayÃ©</option>
            <option value="litige" ${l.statutPaiement==='litige'?'selected':''}>Litige</option>
          </select>
        </div>
      </td>
      <td>
        <button class="btn-icon" onclick="dupliquerLivraison('${l.id}')" title="Dupliquer">ðŸ“‹</button>
        <button class="btn-icon" onclick="ouvrirRecurrence('${l.id}')" title="RÃ©currence">ðŸ”</button>
        <button class="btn-icon" onclick="ouvrirEditLivraison('${l.id}')" title="Modifier">âœï¸</button>
        <button class="btn-icon danger" onclick="supprimerLivraison('${l.id}')" title="Supprimer">ðŸ—‘ï¸</button>
      </td>
    </tr>`;
  }).join('');
};

window.__planningRewriteFinal = function() {
  toggleAbsenceTypeFields = function() {
    var type = document.getElementById('absence-type')?.value || 'travail';
    var startWrap = document.getElementById('absence-heure-debut-wrap');
    var endWrap = document.getElementById('absence-heure-fin-wrap');
    if (startWrap) startWrap.style.display = type === 'travail' ? '' : 'none';
    if (endWrap) endWrap.style.display = type === 'travail' ? '' : 'none';
  };

  peuplerAbsenceSal = function() { planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist'); };
  filtrerRechercheAbsence = function() { planningResolveSelectedEmployee('absence-sal-search', 'absence-sal'); };
  peuplerSelectPlanningModal = function() { planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist'); };
  filtrerRecherchePlanningModal = function() {
    var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (salarie) genererGrilleJours();
  };

  mettreAJourTotalHeuresPlanning = function() {
    var total = 0;
    JOURS.forEach(function(jour) {
      if ((document.getElementById('plan-type-' + jour)?.value || 'repos') !== 'travail') return;
      total += calculerDureeJour(document.getElementById('plan-debut-' + jour)?.value || '', document.getElementById('plan-fin-' + jour)?.value || '');
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
      grid.innerHTML = '<div class="planning-empty-note">SÃ©lectionne un salariÃ© pour saisir ses horaires.</div>';
      mettreAJourTotalHeuresPlanning();
      return;
    }
    var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; }) || { semaine: [] };
    grid.innerHTML = JOURS.map(function(jour, index) {
      var data = (planning.semaine || []).find(function(item) { return item.jour === jour; }) || {};
      var typeJour = data.typeJour || (data.travaille ? 'travail' : 'repos');
      return '<div class="planning-day-editor"><div class="planning-day-top"><div class="planning-day-title">' + JOURS_COURTS[index] + ' - ' + jour.charAt(0).toUpperCase() + jour.slice(1) + '</div><select id="plan-type-' + jour + '" onchange="toggleTypeJour(\'' + jour + '\')"><option value="travail"' + (typeJour === 'travail' ? ' selected' : '') + '>Travail</option><option value="repos"' + (typeJour === 'repos' ? ' selected' : '') + '>Repos</option><option value="conge"' + (typeJour === 'conge' ? ' selected' : '') + '>CongÃ©</option><option value="absence"' + (typeJour === 'absence' ? ' selected' : '') + '>Absence</option><option value="maladie"' + (typeJour === 'maladie' ? ' selected' : '') + '>Maladie</option></select></div><div class="planning-day-grid" id="plan-horaires-' + jour + '" style="display:' + (typeJour === 'travail' ? 'grid' : 'none') + '"><div><label>DÃ©but</label><input type="time" id="plan-debut-' + jour + '" value="' + (data.heureDebut || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div><div><label>Fin</label><input type="time" id="plan-fin-' + jour + '" value="' + (data.heureFin || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div><div><label>Zone</label><input type="text" id="plan-zone-' + jour + '" value="' + ((data.zone || '').replace(/"/g, '&quot;')) + '" placeholder="TournÃ©e, secteur..." /></div><div class="wide"><label>Note</label><input type="text" id="plan-note-' + jour + '" value="' + ((data.note || '').replace(/"/g, '&quot;')) + '" placeholder="Information utile..." /></div></div></div>';
    }).join('');
    mettreAJourTotalHeuresPlanning();
  };

  ouvrirModalPlanning = function() {
    peuplerSelectPlanningModal();
    var search = document.getElementById('plan-salarie-search');
    var select = document.getElementById('plan-salarie');
    var grid = document.getElementById('plan-jours-grid');
    if (search) search.value = '';
    if (select) select.value = '';
    if (grid) grid.innerHTML = '<div class="planning-empty-note">SÃ©lectionne un salariÃ© pour saisir ses horaires.</div>';
    mettreAJourTotalHeuresPlanning();
    openModal('modal-planning');
  };

  ouvrirEditPlanning = function(salId) {
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
    if (!salarie) return afficherToast('Choisis un salariÃ©', 'error');
    var planning = { salId: salarie.id, salNom: salarie.nom || '', semaine: JOURS.map(function(jour) {
      var typeJour = document.getElementById('plan-type-' + jour)?.value || 'repos';
      return { jour: jour, travaille: typeJour === 'travail', typeJour: typeJour, heureDebut: typeJour === 'travail' ? (document.getElementById('plan-debut-' + jour)?.value || '') : '', heureFin: typeJour === 'travail' ? (document.getElementById('plan-fin-' + jour)?.value || '') : '', zone: typeJour === 'travail' ? (document.getElementById('plan-zone-' + jour)?.value || '') : '', note: typeJour === 'travail' ? (document.getElementById('plan-note-' + jour)?.value || '') : '' };
    }), mis_a_jour: new Date().toISOString() };
    if (planning.semaine.some(function(j) { return j.typeJour === 'travail' && j.heureDebut && j.heureFin && calculerDureeJour(j.heureDebut, j.heureFin) <= 0; })) return afficherToast('Certaines heures sont invalides', 'error');
    var plannings = charger('plannings');
    var index = plannings.findIndex(function(p) { return p.salId === salarie.id; });
    if (index > -1) plannings[index] = planning; else plannings.push(planning);
    sauvegarder('plannings', plannings);
    closeModal('modal-planning');
    afficherPlanning();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Planning enregistrÃ©');
  };

  supprimerPlanning = async function(salId) {
    var ok = await confirmDialog('Supprimer le planning hebdomadaire de ce salariÃ© ?', { titre:'Supprimer le planning', icone:'ðŸ“…', btnLabel:'Supprimer' });
    if (!ok) return;
    sauvegarder('plannings', charger('plannings').filter(function(p) { return p.salId !== salId; }));
    afficherPlanning();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Planning supprimÃ©');
  };

  copierSemainePrecedente = function() {
    var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (!salarie) return afficherToast('Choisis un salariÃ©', 'error');
    var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; });
    if (!planning || !planning.semaine || !planning.semaine.length) return afficherToast('Aucun planning existant Ã  copier', 'error');
    genererGrilleJours();
  };

  afficherPlanning = function() { peuplerSelectPlanningModal(); };

  reinitialiserFormulairePlanningRapide = function() {
    ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    if (document.getElementById('absence-type')) document.getElementById('absence-type').value = 'travail';
    if (document.getElementById('planning-submit-btn')) document.getElementById('planning-submit-btn').textContent = '+ Enregistrer';
    toggleAbsenceTypeFields();
  };

  initFormulairePlanningRapide = function() { peuplerAbsenceSal(); toggleAbsenceTypeFields(); };

  afficherAbsencesPeriodes = function() {
    var container = document.getElementById('liste-absences-periodes');
    if (!container) return;
    var salaries = charger('salaries');
    var colors = { conge:'#3498db', maladie:'#9b59b6', absence:'#f39c12' };
    var labels = { conge:'CongÃ©', maladie:'Maladie', absence:'Absence' };
    var absences = charger('absences_periodes').sort(function(a, b) { return new Date(b.debut) - new Date(a.debut); });
    if (!absences.length) return container.innerHTML = '<div class="planning-empty-note">Aucune pÃ©riode enregistrÃ©e.</div>';
    container.innerHTML = absences.map(function(absence) {
      var salarie = salaries.find(function(s) { return s.id === absence.salId; });
      var labelSal = planningBuildEmployeeLabel(salarie || { nom: absence.salNom || 'SalariÃ© supprimÃ©' });
      return '<div class="planning-period-item"><span class="planning-period-dot" style="background:' + (colors[absence.type] || '#f39c12') + '"></span><div class="planning-period-content"><div class="planning-period-title">' + (labels[absence.type] || 'PÃ©riode') + ' - ' + labelSal + '</div><div class="planning-period-meta">Du ' + formatDateExport(absence.debut) + ' au ' + formatDateExport(absence.fin) + '</div></div><div class="planning-period-actions"><button type="button" onclick="editerPeriodeAbsence(\'' + absence.id + '\')">Modifier</button><button type="button" class="danger" onclick="supprimerAbsencePeriode(\'' + absence.id + '\')">Supprimer</button></div></div>';
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
    if (document.getElementById('planning-submit-btn')) document.getElementById('planning-submit-btn').textContent = 'Mettre Ã  jour';
    toggleAbsenceTypeFields();
  };

  supprimerAbsencePeriode = async function(id) {
    var ok = await confirmDialog('Supprimer cette pÃ©riode ?', { titre:'Supprimer la pÃ©riode', icone:'ðŸ“…', btnLabel:'Supprimer' });
    if (!ok) return;
    sauvegarder('absences_periodes', charger('absences_periodes').filter(function(a) { return a.id !== id; }));
    if (document.getElementById('absence-edit-id')?.value === id) reinitialiserFormulairePlanningRapide();
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('PÃ©riode supprimÃ©e');
  };

  afficherPlanningSemaine = function() {
    initFormulairePlanningRapide();
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var absences = charger('absences_periodes');
    var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
    if (document.getElementById('planning-semaine-label')) document.getElementById('planning-semaine-label').textContent = 'Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear();
    if (document.getElementById('planning-semaine-dates')) document.getElementById('planning-semaine-dates').textContent = formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
    var thead = document.getElementById('thead-planning-semaine');
    var tbody = document.getElementById('tb-planning-semaine');
    if (thead) thead.innerHTML = '<tr><th>SalariÃ©</th>' + week.dates.map(function(dateObj, index) { var isToday = dateObj.toISOString().slice(0, 10) === aujourdhui(); return '<th style="text-align:center;' + (isToday ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[index].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>'; }).join('') + '</tr>';
    if (!tbody) return;
    if (!salaries.length) return tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salariÃ©</td></tr>';
    var filtered = salaries.filter(function(salarie) { return !filtre || [planningBuildEmployeeLabel(salarie), salarie.nom, salarie.prenom, salarie.numero, salarie.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre); });
    var totalPlanifies = 0;
    var totalAbsences = 0;
    tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var hasWork = false;
      var cells = week.dates.map(function(dateObj, index) {
        var dateStr = dateObj.toISOString().slice(0, 10);
        var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
        if (absence) { totalAbsences += 1; return planningRenderWeekState('is-' + absence.type, absence.type === 'conge' ? 'CongÃ©' : absence.type === 'maladie' ? 'Maladie' : 'Absence', '', ''); }
        var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[index]; }) || null;
        if (!jour) return planningRenderWeekState('is-rest', 'Repos', '', '');
        if (jour.typeJour === 'travail' && jour.travaille) { hasWork = true; return planningRenderWeekState('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || jour.note || ''); }
        if (jour.typeJour === 'conge' || jour.typeJour === 'absence' || jour.typeJour === 'maladie') return planningRenderWeekState('is-' + jour.typeJour, jour.typeJour === 'conge' ? 'CongÃ©' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence', '', '');
        return planningRenderWeekState('is-rest', 'Repos', '', '');
      }).join('');
      if (hasWork) totalPlanifies += 1;
      return '<tr><td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>' + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '') + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '') + '</div></td>' + cells + '</tr>';
    }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salariÃ© ne correspond Ã  la recherche</td></tr>';
    if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
    if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
    if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
    afficherAbsencesPeriodes();
  };

  filtrerPlanningSemaine = function() { afficherPlanningSemaine(); };

  exporterPlanningSemainePDF = function() {
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var absences = charger('absences_periodes');
    var params = getEntrepriseExportParams();
    var dateExp = formatDateHeureExport();
    var cols = week.dates.map(function(dateObj, index) { return '<th style="padding:8px 10px;text-align:center;color:#6b7280">' + JOURS_COURTS[index] + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>'; }).join('');
    var rows = salaries.map(function(salarie, index) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var cells = week.dates.map(function(dateObj, dayIndex) {
        var dateStr = dateObj.toISOString().slice(0, 10);
        var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
        if (absence) return '<td style="padding:8px 10px;text-align:center">' + (absence.type === 'conge' ? 'CongÃ©' : absence.type === 'maladie' ? 'Maladie' : 'Absence') + '</td>';
        var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[dayIndex]; });
        if (!jour) return '<td style="padding:8px 10px;text-align:center">Repos</td>';
        if (jour.typeJour === 'travail' && jour.travaille) return '<td style="padding:8px 10px;text-align:center">' + (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : '') + '</td>';
        return '<td style="padding:8px 10px;text-align:center">' + (jour.typeJour === 'conge' ? 'CongÃ©' : jour.typeJour === 'maladie' ? 'Maladie' : jour.typeJour === 'absence' ? 'Absence' : 'Repos') + '</td>';
      }).join('');
      return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + ';border-bottom:1px solid #e5e7eb"><td style="padding:8px 10px;font-weight:600">' + (salarie.nom || '') + (salarie.numero ? '<br><span style="font-size:.75rem;color:#6b7280">#' + salarie.numero + '</span>' : '') + '</td>' + cells + '</tr>';
    }).join('');
    var html = '<html><head><meta charset="utf-8"><title>Planning hebdomadaire</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111827"><h1 style="margin:0 0 6px;font-size:22px">' + params.nom + '</h1><div style="color:#6b7280;margin-bottom:16px">Planning hebdomadaire - Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear() + '</div>' + renderBlocInfosEntreprise(params) + '<div style="margin-bottom:16px;font-size:14px;color:#374151">PÃ©riode : ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche) + '</div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left">SalariÃ©</th>' + cols + '</tr></thead><tbody>' + rows + '</tbody></table>' + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire') + '</body></html>';
    var popup = window.open('', '_blank');
    if (!popup) return afficherToast('Autorise les popups pour gÃ©nÃ©rer le PDF', 'error');
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(function() { popup.print(); }, 250);
    afficherToast('Rapport planning gÃ©nÃ©rÃ©');
  };
};

/* ===== PLANNING REWRITE ===== */
function planningBuildEmployeeLabel(salarie) {
  return getSalarieNomComplet(salarie, { includePoste: true });
}

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

function planningEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function planningDateToLocalISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function planningSyncSearchWithSelect(searchId, selectId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  var salaries = charger('salaries');
  if (select) {
    var currentValue = select.value;
    select.innerHTML = '<option value="">-- Choisir --</option>';
    salaries.forEach(function(s) {
      select.innerHTML += '<option value="' + s.id + '">' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '</option>';
    });
    if (salaries.some(function(s) { return s.id === currentValue; })) {
      select.value = currentValue;
    }
  }
  if (search && select && select.value) {
    var salarie = salaries.find(function(s) { return s.id === select.value; });
    if (salarie) search.value = planningBuildEmployeeLabel(salarie);
  }
}

function planningResolveSelectedEmployee(searchId, selectId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  if (!search || !select) return null;
  var exact = (search.value || '').trim().toLowerCase();
  var found = exact ? charger('salaries').find(function(s) {
    return planningBuildEmployeeLabel(s).toLowerCase() === exact;
  }) || null : null;
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
      + '<span style="display:block;font-weight:600">' + planningEscapeHtml((s.nom || '') + (s.prenom ? ' ' + s.prenom : '')) + '</span>'
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

function planningRenderWeekState(className, title, detail, note) {
  return '<td><div class="planning-week-state ' + className + '"><span>' + title + '</span>' + (detail ? '<span class="planning-week-time">' + detail + '</span>' : '') + (note ? '<span class="planning-week-note">' + note + '</span>' : '') + '</div></td>';
}

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

toggleAbsenceTypeFields = function() {
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debutWrap = document.getElementById('absence-heure-debut-wrap');
  var finWrap = document.getElementById('absence-heure-fin-wrap');
  if (debutWrap) debutWrap.style.display = type === 'travail' ? '' : 'none';
  if (finWrap) finWrap.style.display = type === 'travail' ? '' : 'none';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  planningRenderEmployeeSuggestions('absence-sal-search', 'absence-sal', 'absence-sal-suggestions');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  planningRenderEmployeeSuggestions('plan-salarie-search', 'plan-salarie', 'plan-salarie-suggestions', function() {
    genererGrilleJours();
  });
  if (salarie) genererGrilleJours();
};

mettreAJourTotalHeuresPlanning = function() {
  var total = 0;
  var out = document.getElementById('plan-total-heures');
  JOURS.forEach(function(jour) {
    var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
    if (type !== 'travail') return;
    total += calculerDureeJour(
      document.getElementById('plan-debut-' + jour)?.value || '',
      document.getElementById('plan-fin-' + jour)?.value || ''
    );
  });
  if (out) out.textContent = total.toFixed(1) + ' h';
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
    grid.innerHTML = '<div class="planning-empty-note">SÃ©lectionne un salariÃ© pour saisir ses horaires.</div>';
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
      + '<option value="conge"' + (typeJour === 'conge' ? ' selected' : '') + '>CongÃ©</option>'
      + '<option value="absence"' + (typeJour === 'absence' ? ' selected' : '') + '>Absence</option>'
      + '<option value="maladie"' + (typeJour === 'maladie' ? ' selected' : '') + '>Maladie</option>'
      + '</select></div>'
      + '<div class="planning-day-grid" id="plan-horaires-' + jour + '" style="display:' + (typeJour === 'travail' ? 'grid' : 'none') + '">'
      + '<div><label>DÃ©but</label><input type="time" id="plan-debut-' + jour + '" value="' + (data.heureDebut || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Fin</label><input type="time" id="plan-fin-' + jour + '" value="' + (data.heureFin || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Zone</label><input type="text" id="plan-zone-' + jour + '" value="' + ((data.zone || '').replace(/"/g, '&quot;')) + '" placeholder="TournÃ©e, secteur..." /></div>'
      + '<div class="wide"><label>Note</label><input type="text" id="plan-note-' + jour + '" value="' + ((data.note || '').replace(/"/g, '&quot;')) + '" placeholder="Information utile..." /></div>'
      + '</div></div>';
  }).join('');
  mettreAJourTotalHeuresPlanning();
};

window.__planningRewriteFinal && window.__planningRewriteFinal();

window.__planningPeriodOnlyFinal = function() {
  function planningEmployeeUsesPeriods(salId, periodes) {
    return (periodes || charger('absences_periodes')).some(function(item) { return item.salId === salId; });
  }

  function getPlanningDeleteButton(salId, dateStr, enabled) {
    if (!enabled) return '';
    return '<button type="button" class="planning-week-delete" title="Supprimer" onclick="event.stopPropagation();supprimerPlanningJour(\'' + salId + '\',\'' + dateStr + '\')">Ã—</button>';
  }

  function planningGetEntryForDate(salId, dateStr, periodes, planning) {
    var periodEntry = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periodEntry) return { source: 'period', entry: periodEntry };
    if (planningEmployeeUsesPeriods(salId, periodes)) return { source: 'period', entry: null };
    var dateObj = new Date(dateStr + 'T00:00:00');
    var jourNom = JOURS[(dateObj.getDay() + 6) % 7];
    var recurring = (planning?.semaine || []).find(function(item) { return item.jour === jourNom; }) || null;
    return { source: 'recurring', entry: recurring };
  }

  supprimerPlanningJour = async function(salId, dateStr) {
    var ok = await confirmDialog('Supprimer ce crÃ©neau de cette journÃ©e ?', { titre:'Supprimer le crÃ©neau', icone:'âŒ', btnLabel:'Supprimer' });
    if (!ok) return;

    var periodes = charger('absences_periodes');
    var periode = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periode && periode.type === 'travail') {
      var updated = periodes.filter(function(item) { return item.id !== periode.id; });
      if (periode.debut < dateStr) {
        updated.push({
          ...periode,
          id: genId(),
          fin: planningDateToLocalISO(new Date(new Date(dateStr + 'T00:00:00').getTime() - 86400000)),
          modifieLe: new Date().toISOString()
        });
      }
      if (periode.fin > dateStr) {
        updated.push({
          ...periode,
          id: genId(),
          debut: planningDateToLocalISO(new Date(new Date(dateStr + 'T00:00:00').getTime() + 86400000)),
          modifieLe: new Date().toISOString()
        });
      }
      sauvegarder('absences_periodes', updated.sort(function(a, b) { return new Date(a.debut) - new Date(b.debut); }));
      afficherPlanningSemaine();
      afficherCompteurHeures();
      return afficherToast('CrÃ©neau supprimÃ© pour cette journÃ©e');
    }

    var plannings = charger('plannings');
    var planningIndex = plannings.findIndex(function(item) { return item.salId === salId; });
    if (planningIndex === -1) return;
    var jourNom = JOURS[(new Date(dateStr + 'T00:00:00').getDay() + 6) % 7];
    var semaine = Array.isArray(plannings[planningIndex].semaine) ? plannings[planningIndex].semaine : [];
    var jourIndex = semaine.findIndex(function(item) { return item.jour === jourNom; });
    if (jourIndex === -1) return;
    semaine[jourIndex] = {
      ...semaine[jourIndex],
      travaille: false,
      typeJour: 'repos',
      heureDebut: '',
      heureFin: '',
      zone: '',
      note: ''
    };
    plannings[planningIndex].semaine = semaine;
    plannings[planningIndex].mis_a_jour = new Date().toISOString();
    sauvegarder('plannings', plannings);
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('CrÃ©neau hebdomadaire retirÃ©');
  };

  initFormulairePlanningRapide = function() {
    peuplerAbsenceSal();
    toggleAbsenceTypeFields();
    var title = document.querySelector('#page-planning .planning-absence-form .planning-panel-title');
    var sub = document.querySelector('#page-planning .planning-absence-form .planning-toolbar-sub');
    var layout = document.querySelector('#page-planning .planning-absence-layout');
    var list = document.querySelector('#page-planning .planning-absence-list');
    var editBtn = document.getElementById('planning-edit-work-btn');
    var btn = document.getElementById('planning-submit-btn');
    if (title) title.textContent = 'Ajouter une pÃ©riode';
    if (sub) sub.textContent = 'Saisis uniquement des pÃ©riodes datÃ©es. Rien ne se rÃ©pÃ¨te automatiquement hors des dates choisies.';
    if (layout) layout.style.gridTemplateColumns = 'minmax(0, 1fr)';
    if (list) list.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    var typeSelect = document.getElementById('absence-type');
    if (typeSelect) {
      var currentType = typeSelect.value;
      typeSelect.innerHTML = ''
        + '<option value="travail">Travail</option>'
        + '<option value="conge">CongÃ©</option>'
        + '<option value="maladie">Maladie</option>'
        + '<option value="absence">Absence</option>';
      typeSelect.value = ['travail', 'conge', 'maladie', 'absence'].includes(currentType) ? currentType : 'travail';
    }
    if (btn && !document.getElementById('absence-edit-id')?.value) btn.textContent = '+ Enregistrer la pÃ©riode';
  };

  afficherAbsencesPeriodes = function() {
    var list = document.querySelector('#page-planning .planning-absence-list');
    if (list) list.style.display = 'none';
  };

  ouvrirEditionTravailRapide = function() {
    afficherToast('Les pÃ©riodes de planning se gÃ¨rent directement dans le formulaire.', 'info');
  };

  reinitialiserFormulairePlanningRapide = function() {
    ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    if (document.getElementById('absence-type')) document.getElementById('absence-type').value = 'travail';
    var btn = document.getElementById('planning-submit-btn');
    if (btn) btn.textContent = '+ Enregistrer la pÃ©riode';
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
    if (!salarie || !debut || !fin) return afficherToast('SalariÃ©, date de dÃ©but et date de fin obligatoires', 'error');
    if (fin < debut) return afficherToast('La date de fin doit Ãªtre postÃ©rieure Ã  la date de dÃ©but', 'error');
    if (type === 'travail' && (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0)) return afficherToast('Renseigne des horaires de travail valides', 'error');

    var periodes = charger('absences_periodes');
    var payload = {
      id: editId || genId(),
      salId: salarie.id,
      salNom: salarie.nom || '',
      type: type,
      debut: debut,
      fin: fin,
      heureDebut: type === 'travail' ? heureDebut : '',
      heureFin: type === 'travail' ? heureFin : '',
      creeLe: editId ? (periodes.find(function(item) { return item.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };
    var index = periodes.findIndex(function(item) { return item.id === payload.id; });
    if (index > -1) periodes[index] = payload; else periodes.push(payload);
    sauvegarder('absences_periodes', periodes);
    reinitialiserFormulairePlanningRapide();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast(editId ? 'PÃ©riode mise Ã  jour' : 'PÃ©riode enregistrÃ©e');
  };

  calculerHeuresSalarieSemaine = function(salId) {
    var range = getHeuresPeriodeRange();
    var periodes = charger('absences_periodes').filter(function(item) {
      return item.salId === salId && item.fin >= range.debut && item.debut <= range.fin;
    });
    var planning = (charger('plannings') || []).find(function(item) { return item.salId === salId; }) || { semaine: [] };
    var details = [];
    var total = 0;
    getDateRangeInclusive(range.debut, range.fin).forEach(function(dateObj) {
      var dateStr = dateObj.toISOString().slice(0, 10);
      var resolved = planningGetEntryForDate(salId, dateStr, periodes, planning);
        var entry = resolved.entry;
        if (!entry) return;
        if (resolved.source === 'period') {
        if (entry.type !== 'travail') return;
        var dureePeriode = calculerDureeJour(entry.heureDebut || '', entry.heureFin || '');
        if (dureePeriode <= 0) return;
        total += dureePeriode;
        details.push({ date: dateStr, jour: JOURS[(dateObj.getDay() + 6) % 7], duree: dureePeriode });
        return;
      }
      if (!entry.travaille || !entry.heureDebut || !entry.heureFin) return;
      var duree = calculerDureeJour(entry.heureDebut, entry.heureFin);
      if (duree <= 0) return;
      total += duree;
      details.push({ date: dateStr, jour: entry.jour, duree: duree });
    });
    return { planifiees: total, details };
  };

  afficherPlanningSemaine = function() {
    initFormulairePlanningRapide();
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var periodes = charger('absences_periodes');
    var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
    var label = document.getElementById('planning-semaine-label');
    var datesLabel = document.getElementById('planning-semaine-dates');
    var thead = document.getElementById('thead-planning-semaine');
    var tbody = document.getElementById('tb-planning-semaine');
    if (label) label.textContent = 'Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear();
    if (datesLabel) datesLabel.textContent = formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
    if (thead) {
      thead.innerHTML = '<tr><th>SalariÃ©</th>' + week.dates.map(function(dateObj, index) {
        return '<th style="text-align:center">' + JOURS_COURTS[index].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>';
      }).join('') + '</tr>';
    }
    if (!tbody) return;
    if (!salaries.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salariÃ©</td></tr>';
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
      var cells = week.dates.map(function(dateObj) {
        var dateStr = planningDateToLocalISO(dateObj);
        var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
        var entry = resolved.entry;
        if (!entry) return planningRenderWeekState('is-rest', 'Repos', '', '');
        if (resolved.source === 'period') {
          if (entry.type === 'travail') {
            hasWork = true;
            return '<td><div class="planning-week-state is-work">' + getPlanningDeleteButton(salarie.id, dateStr, true) + '<span>Travail</span><span class="planning-week-time">' + (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '') + '</span></div></td>';
          }
          if (entry.type === 'repos') return planningRenderWeekState('is-rest', 'Repos', '', '');
          if (entry.type !== 'repos') totalAbsences += 1;
          return planningRenderWeekState('is-' + entry.type, getPlanningPeriodLabel(entry.type), '', '');
        }
        if (entry.typeJour === 'travail' && entry.travaille) {
          hasWork = true;
          return '<td><div class="planning-week-state is-work">' + getPlanningDeleteButton(salarie.id, dateStr, true) + '<span>Travail</span><span class="planning-week-time">' + (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '') + '</span>' + ((entry.zone || entry.note) ? '<span class="planning-week-note">' + (entry.zone || entry.note) + '</span>' : '') + '</div></td>';
        }
        if (['repos', 'conge', 'absence', 'maladie'].includes(entry.typeJour)) {
          if (entry.typeJour !== 'repos') totalAbsences += 1;
          return planningRenderWeekState('is-' + entry.typeJour, getPlanningPeriodLabel(entry.typeJour), '', '');
        }
        return planningRenderWeekState('is-rest', 'Repos', '', '');
      }).join('');
      if (hasWork) totalPlanifies += 1;
      return '<tr><td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>'
        + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '')
        + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '')
        + '</div></td>' + cells + '</tr>';
    }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salariÃ© ne correspond Ã  la recherche</td></tr>';
    var kpiSal = document.getElementById('planning-kpi-salaries');
    var kpiPlan = document.getElementById('planning-kpi-planifies');
    var kpiAbs = document.getElementById('planning-kpi-absences');
    if (kpiSal) kpiSal.textContent = salaries.length;
    if (kpiPlan) kpiPlan.textContent = totalPlanifies;
    if (kpiAbs) kpiAbs.textContent = totalAbsences;
  };

  exporterPlanningSemainePDF = function() {
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var periodes = charger('absences_periodes');
    var params = getEntrepriseExportParams();
    var dateExp = formatDateHeureExport();
    var titreSemaine = 'Semaine ' + getNumSemaine(week.lundi) + ' â€” ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
    var stateStyles = {
      travail: { bg:'#e9f8ef', border:'#b7e7c8', color:'#177245', label:'Travail' },
      repos: { bg:'#f4f5f7', border:'#d7dbe2', color:'#6b7280', label:'Repos' },
      conge: { bg:'#eaf3ff', border:'#c7defd', color:'#3498db', label:'CongÃ©' },
      maladie: { bg:'#f4edff', border:'#dcc8fa', color:'#9b59b6', label:'Maladie' },
      absence: { bg:'#fdeeee', border:'#f7c7c7', color:'#e74c3c', label:'Absence' }
    };
    function getStateBlockStyle(style, extra) {
      return 'min-height:56px;display:flex;align-items:center;justify-content:center;padding:8px 6px;border-radius:12px;background:' + style.bg + ';border:1px solid ' + style.border + ';color:' + style.color + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;' + (extra || '');
    }
    function formatCellulePlanning(salarie, dateObj, planning) {
      var dateStr = planningDateToLocalISO(dateObj);
      var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
      var entry = resolved.entry;
      if (!entry) {
        var restStyle = stateStyles.repos;
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(restStyle, 'font-size:.78rem') + '">Repos</div></td>';
      }
      if (resolved.source === 'period') {
        if (entry.type === 'travail') {
          var workStyle = stateStyles.travail;
          var horaire = (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '');
          return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(workStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">Travail</span><span style="font-size:.76rem;font-weight:600">' + horaire + '</span></div></td>';
        }
        if (entry.type === 'repos') {
          var periodRestStyle = stateStyles.repos;
          return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodRestStyle, 'font-size:.78rem') + '">Repos</div></td>';
        }
        var periodStyle = stateStyles[entry.type] || stateStyles.absence;
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodStyle, 'font-size:.78rem;font-weight:700') + '">' + getPlanningPeriodLabel(entry.type) + '</div></td>';
      }
      if (entry.typeJour === 'travail' && entry.travaille) {
        var recurringWorkStyle = stateStyles.travail;
        var recurringHoraire = (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '');
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(recurringWorkStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">Travail</span><span style="font-size:.76rem;font-weight:600">' + recurringHoraire + '</span></div></td>';
      }
      var recurringStyle = stateStyles[entry.typeJour] || stateStyles.repos;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(recurringStyle, 'font-size:.78rem;font-weight:700') + '">' + getPlanningPeriodLabel(entry.typeJour || 'repos') + '</div></td>';
    }
    var rows = salaries.map(function(salarie, index) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var cells = week.dates.map(function(dateObj) {
        return formatCellulePlanning(salarie, dateObj, planning);
      }).join('');
      return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + '"><td style="padding:10px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;min-width:170px">' + (salarie.nom || '') + (salarie.poste ? '<br><span style="font-size:.74rem;color:#9ca3af">' + salarie.poste + '</span>' : '') + '</td>' + cells + '</tr>';
    }).join('');
    var thead = week.dates.map(function(dateObj, dayIndex) {
      return '<th style="padding:10px 8px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #dfe3ea;min-width:92px">' + JOURS_COURTS[dayIndex] + '<div style="font-size:.76rem;color:#9ca3af;margin-top:2px">' + formatDateExport(dateObj).slice(0, 5) + '</div></th>';
    }).join('');
    var html = '<style>@page{size:landscape;margin:10mm}body,table,thead,tbody,tr,th,td,div,span{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}</style><div style="font-family:Segoe UI,Arial,sans-serif;width:100%;padding:22px 24px;color:#1a1d27;box-sizing:border-box">'
      + construireEnteteExport(params, 'Planning hebdomadaire', titreSemaine, dateExp)
      + '<div style="margin:0 0 16px;font-size:.88rem;color:#4b5563">PÃ©riode : <strong>' + formatDateExport(week.lundi) + '</strong> au <strong>' + formatDateExport(week.dimanche) + '</strong></div>'
      + '<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;table-layout:fixed"><thead><tr style="background:#f3f4f6"><th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;border-bottom:1px solid #dfe3ea;min-width:170px">SalariÃ©</th>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
      + '</div>';
    ouvrirFenetreImpression('Planning ' + titreSemaine, html, 'width=1200,height=780');
    afficherToast('Rapport planning gÃ©nÃ©rÃ©');
  };
};

window.__planningPeriodOnlyFinal();

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

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal');
  planningPrepareEmployeeInput('absence-sal-search', 'absence-sal-suggestions');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  planningRenderEmployeeSuggestions('absence-sal-search', 'absence-sal', 'absence-sal-suggestions');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie');
  planningPrepareEmployeeInput('plan-salarie-search', 'plan-salarie-suggestions');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  planningRenderEmployeeSuggestions('plan-salarie-search', 'plan-salarie', 'plan-salarie-suggestions', function() {
    genererGrilleJours();
  });
  if (salarie) genererGrilleJours();
};

document.addEventListener('click', function(event) {
  [
    { input: 'absence-sal-search', box: 'absence-sal-suggestions' },
    { input: 'plan-salarie-search', box: 'plan-salarie-suggestions' }
  ].forEach(function(entry) {
    var input = document.getElementById(entry.input);
    var box = document.getElementById(entry.box);
    if (!input || !box) return;
    if (input.contains(event.target) || box.contains(event.target)) return;
    box.innerHTML = '';
    box.style.display = 'none';
  });
});

/* ===== RENTABILITE â€” Calculateur avancÃ© ===== */
var RENTABILITE_STORAGE_KEY = 'rentabilite_calculateur_v2';

function getRentabiliteDefaults() {
  return {
    modeCalcul: 'manuel',
    livraisonId: '',
    repartitionCharges: 'mensuel',
    kmJour: 0,
    prixKm: 0,
    joursTravailles: 0,
    conso: 0,
    prixCarburant: 0,
    lldCredit: 0,
    assurance: 0,
    salaireCharge: 0,
    tva: 20,
    autresCharges: []
  };
}

function chargerRentabiliteConfig() {
  var config = chargerObj(RENTABILITE_STORAGE_KEY, null);
  var defaults = getRentabiliteDefaults();
  if (!config || typeof config !== 'object') return defaults;
  if (!Object.prototype.hasOwnProperty.call(config, 'modeCalcul')) return defaults;
  return {
    modeCalcul: config.modeCalcul === 'livraison' ? 'livraison' : 'manuel',
    livraisonId: config.livraisonId || '',
    repartitionCharges: config.repartitionCharges === 'prorata' ? 'prorata' : 'mensuel',
    kmJour: parseFloat(config.kmJour) || 0,
    prixKm: parseFloat(config.prixKm) || 0,
    joursTravailles: parseFloat(config.joursTravailles) || 0,
    conso: parseFloat(config.conso) || 0,
    prixCarburant: parseFloat(config.prixCarburant) || 0,
    lldCredit: parseFloat(config.lldCredit) || 0,
    assurance: parseFloat(config.assurance) || 0,
    salaireCharge: parseFloat(config.salaireCharge) || 0,
    tva: parseFloat(config.tva) || 0,
    autresCharges: Array.isArray(config.autresCharges) ? config.autresCharges.map(function(item) {
      return {
        id: item.id || genId(),
        label: item.label || '',
        montant: parseFloat(item.montant) || 0
      };
    }) : defaults.autresCharges
  };
}

function sauvegarderRentabiliteConfig(config) {
  sauvegarder(RENTABILITE_STORAGE_KEY, config);
}

function rentabiliteGetContainer() {
  return document.getElementById('page-rentabilite');
}

function rentabiliteWireEvents() {
  var container = rentabiliteGetContainer();
  if (!container || container.dataset.rentabiliteBound === '1') return;
  container.dataset.rentabiliteBound = '1';
  container.addEventListener('input', function(event) {
    if (!event.target.matches('input[data-rent-field], input[data-rent-charge], select[data-rent-field]')) return;
    rentabiliteSyncFromDom();
  });
  container.addEventListener('change', function(event) {
    if (!event.target.matches('input[data-rent-field], input[data-rent-charge], select[data-rent-field]')) return;
    rentabiliteSyncFromDom();
  });
}

function getRentabiliteLivraisonLabel(livraison) {
  if (!livraison) return '';
  return [
    livraison.numLiv || 'Livraison',
    livraison.client || '',
    livraison.date ? formatDateExport(livraison.date) : ''
  ].filter(Boolean).join(' - ');
}

function rentabiliteGetSelectedLivraison(config) {
  if (!config.livraisonId) return null;
  return charger('livraisons').find(function(item) { return item.id === config.livraisonId; }) || null;
}

function rentabiliteRenderLivraisonsSelect(config) {
  var select = document.getElementById('rent-livraison-select');
  if (!select) return;
  var livraisons = charger('livraisons').slice().sort(function(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });
  select.innerHTML = '<option value="">-- Choisir une livraison --</option>' + livraisons.map(function(livraison) {
    return '<option value="' + livraison.id + '">' + planningEscapeHtml(getRentabiliteLivraisonLabel(livraison)) + '</option>';
  }).join('');
  select.value = livraisons.some(function(item) { return item.id === config.livraisonId; }) ? config.livraisonId : '';
  select.setAttribute('data-rent-field', 'rent-livraison-select');
}

function rentabiliteToggleMode(config) {
  var wrap = document.getElementById('rent-livraison-wrap');
  if (wrap) wrap.style.display = config.modeCalcul === 'livraison' ? '' : 'none';
  ['rent-km-jour', 'rent-prix-km'].forEach(function(id) {
    var input = document.getElementById(id);
    var group = input?.closest('.form-group');
    if (!input) return;
    input.readOnly = config.modeCalcul === 'livraison';
    if (group) group.classList.toggle('is-disabled', config.modeCalcul === 'livraison');
  });
  var joursInput = document.getElementById('rent-jours-travailles');
  var joursGroup = joursInput?.closest('.form-group');
  if (joursInput) joursInput.readOnly = false;
  if (joursGroup) joursGroup.classList.remove('is-disabled');
}

function rentabiliteRenderCharges(config) {
  var host = document.getElementById('rent-autres-charges');
  if (!host) return;
  if (!config.autresCharges.length) {
    host.innerHTML = '<div class="rentabilite-alert-item">Aucune autre charge ajoutÃ©e pour le moment.</div>';
    return;
  }
  host.innerHTML = config.autresCharges.map(function(item) {
    return '<div class="rentabilite-charge-row">'
      + '<input type="text" data-rent-charge="label" data-charge-id="' + item.id + '" value="' + planningEscapeHtml(item.label || '') + '" placeholder="LibellÃ© de la charge" />'
      + '<input type="number" data-rent-charge="montant" data-charge-id="' + item.id + '" value="' + (parseFloat(item.montant) || 0) + '" min="0" step="0.01" placeholder="Montant HT" />'
      + '<button type="button" class="btn-secondary" onclick="supprimerChargeRentabilite(\'' + item.id + '\')">Supprimer</button>'
      + '</div>';
  }).join('');
}

function rentabiliteFillInputs(config) {
  var fieldMap = {
    'rent-mode-calcul': config.modeCalcul,
    'rent-repartition-charges': config.repartitionCharges,
    'rent-km-jour': config.kmJour,
    'rent-prix-km': config.prixKm,
    'rent-jours-travailles': config.joursTravailles,
    'rent-conso': config.conso,
    'rent-prix-carburant': config.prixCarburant,
    'rent-lld-credit': config.lldCredit,
    'rent-assurance': config.assurance,
    'rent-salaire-charge': config.salaireCharge,
    'rent-taux-tva': config.tva
  };
  Object.keys(fieldMap).forEach(function(id) {
    var input = document.getElementById(id);
    if (input) {
      input.value = fieldMap[id];
      input.setAttribute('data-rent-field', id);
    }
  });
  rentabiliteRenderLivraisonsSelect(config);
  rentabiliteToggleMode(config);
  rentabiliteRenderCharges(config);
}

function rentabiliteReadFromDom(config) {
  var next = {
    modeCalcul: document.getElementById('rent-mode-calcul')?.value === 'livraison' ? 'livraison' : 'manuel',
    livraisonId: document.getElementById('rent-livraison-select')?.value || '',
    repartitionCharges: document.getElementById('rent-repartition-charges')?.value === 'prorata' ? 'prorata' : 'mensuel',
    kmJour: parseFloat(document.getElementById('rent-km-jour')?.value) || 0,
    prixKm: parseFloat(document.getElementById('rent-prix-km')?.value) || 0,
    joursTravailles: parseFloat(document.getElementById('rent-jours-travailles')?.value) || 0,
    conso: parseFloat(document.getElementById('rent-conso')?.value) || 0,
    prixCarburant: parseFloat(document.getElementById('rent-prix-carburant')?.value) || 0,
    lldCredit: parseFloat(document.getElementById('rent-lld-credit')?.value) || 0,
    assurance: parseFloat(document.getElementById('rent-assurance')?.value) || 0,
    salaireCharge: parseFloat(document.getElementById('rent-salaire-charge')?.value) || 0,
    tva: parseFloat(document.getElementById('rent-taux-tva')?.value) || 0,
    autresCharges: (config.autresCharges || []).map(function(item) {
      var labelInput = document.querySelector('[data-rent-charge="label"][data-charge-id="' + item.id + '"]');
      var montantInput = document.querySelector('[data-rent-charge="montant"][data-charge-id="' + item.id + '"]');
      return {
        id: item.id,
        label: labelInput ? labelInput.value.trim() : (item.label || ''),
        montant: montantInput ? (parseFloat(montantInput.value) || 0) : (parseFloat(item.montant) || 0)
      };
    })
  };
  return next;
}

function calculerRentabiliteAvancee(config) {
  var livraison = rentabiliteGetSelectedLivraison(config);
  var isLivraisonMode = config.modeCalcul === 'livraison';
  var kmJour = isLivraisonMode ? (parseFloat(livraison?.distance) || 0) : config.kmJour;
  var joursTravailles = Math.max(0, config.joursTravailles || 0);
  if (isLivraisonMode && !livraison) joursTravailles = 0;
  var kmTotal = kmJour * joursTravailles;
  var caJournalierHT = isLivraisonMode ? (livraison ? getMontantHTLivraison(livraison) : 0) : (kmJour * config.prixKm);
  var caHT = caJournalierHT * joursTravailles;
  var prixKm = kmJour > 0 ? (caJournalierHT / kmJour) : 0;
  var caTTC = caHT * (1 + config.tva / 100);
  var litresMois = kmTotal * config.conso / 100;
  var coutCarburant = litresMois * config.prixCarburant;
  var autresCharges = (config.autresCharges || []).reduce(function(sum, item) { return sum + (parseFloat(item.montant) || 0); }, 0);
  var chargesFixesMensuelles = config.lldCredit + config.assurance + config.salaireCharge + autresCharges;
  var chargesFixes = config.repartitionCharges === 'prorata'
    ? (chargesFixesMensuelles / 30) * config.joursTravailles
    : chargesFixesMensuelles;
  var coutTotal = chargesFixes + coutCarburant;
  var beneficeNet = caHT - coutTotal;
  var coutParKm = kmTotal > 0 ? coutTotal / kmTotal : 0;
  var margeParKm = kmTotal > 0 ? beneficeNet / kmTotal : 0;
  var revenuJournalier = caJournalierHT;
  var coutVariableJournalier = (kmJour * config.conso / 100) * config.prixCarburant;
  var margeJournaliere = revenuJournalier - coutVariableJournalier;
  var seuilJours = margeJournaliere > 0 ? chargesFixes / margeJournaliere : null;
  var pointMortCA = seuilJours != null ? seuilJours * revenuJournalier : null;
  return {
    modeCalcul: config.modeCalcul,
    livraison: livraison,
    kmJour: kmJour,
    prixKm: prixKm,
    joursTravailles: joursTravailles,
    kmTotal: kmTotal,
    caHT: caHT,
    caTTC: caTTC,
    litresMois: litresMois,
    coutCarburant: coutCarburant,
    autresCharges: autresCharges,
    chargesFixesMensuelles: chargesFixesMensuelles,
    chargesFixes: chargesFixes,
    coutTotal: coutTotal,
    beneficeNet: beneficeNet,
    coutParKm: coutParKm,
    margeParKm: margeParKm,
    revenuJournalier: revenuJournalier,
    coutVariableJournalier: coutVariableJournalier,
    margeJournaliere: margeJournaliere,
    seuilJours: seuilJours,
    pointMortCA: pointMortCA
  };
}

function rentabiliteFormatJours(value) {
  if (value == null || !isFinite(value)) return 'Non atteignable';
  return value.toFixed(1).replace('.', ',') + ' j';
}

function rentabiliteRenderAlerts(results, config) {
  var host = document.getElementById('rent-alertes');
  if (!host) return;
  var alerts = [];
  if (results.beneficeNet < 0) {
    alerts.push({ type: 'danger', text: 'BÃ©nÃ©fice nÃ©gatif : vos coÃ»ts dÃ©passent actuellement votre chiffre dâ€™affaires HT.' });
  }
  if (results.seuilJours != null && results.seuilJours > config.joursTravailles) {
    alerts.push({ type: 'warning', text: 'Seuil de rentabilitÃ© supÃ©rieur aux jours travaillÃ©s : lâ€™activitÃ© ne couvre pas encore ses charges fixes sur le mois.' });
  }
  if (results.seuilJours == null) {
    alerts.push({ type: 'danger', text: 'Avec les paramÃ¨tres actuels, la marge journaliÃ¨re ne permet pas dâ€™atteindre la rentabilitÃ©.' });
  }
  if (!alerts.length) {
    alerts.push({ type: 'success', text: 'Structure saine : votre activitÃ© couvre ses coÃ»ts avec les paramÃ¨tres actuels.' });
  }
  if (config.repartitionCharges === 'prorata') {
    alerts.push({ type: 'warning', text: 'Charges fixes proratisÃ©es : le calcul impute uniquement une quote-part selon les jours travaillÃ©s saisis.' });
  }
  host.innerHTML = alerts.map(function(alert) {
    return '<div class="rentabilite-alert-item is-' + alert.type + '">' + alert.text + '</div>';
  }).join('');
}

function rentabiliteRenderResults(results, config) {
  var setText = function(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('rent-ca-ht', euros(results.caHT));
  setText('rent-ca-ttc', euros(results.caTTC));
  setText('rent-cout-carburant', euros(results.coutCarburant));
  setText('rent-volume-carburant', results.litresMois.toFixed(1).replace('.', ',') + ' L / mois');
  setText('rent-charges-fixes', euros(results.chargesFixes));
  setText('rent-cout-total', euros(results.coutTotal));
  setText('rent-benefice-net', euros(results.beneficeNet));
  setText('rent-benefice-net-highlight', euros(results.beneficeNet));
  setText('rent-seuil-jours', rentabiliteFormatJours(results.seuilJours));
  setText('rent-point-mort-ca', results.pointMortCA != null ? euros(results.pointMortCA) : 'Non atteignable');
  setText('rent-point-mort-jours', results.seuilJours != null ? rentabiliteFormatJours(results.seuilJours) : 'Non atteignable');
  setText('rent-cout-km', euros(results.coutParKm) + '/km');
  setText('rent-marge-km', 'Marge : ' + euros(results.margeParKm) + '/km');
  setText('rent-revenu-journalier', euros(results.revenuJournalier));
  setText('rent-cout-variable-journalier', euros(results.coutVariableJournalier));
  setText('rent-marge-journaliere', euros(results.margeJournaliere));
  setText('rent-marge-totale', euros(results.beneficeNet));
  setText('rent-resume-activite', results.modeCalcul === 'livraison'
    ? (results.livraison ? getRentabiliteLivraisonLabel(results.livraison) : 'Aucune livraison sÃ©lectionnÃ©e')
    : (Math.round(results.kmTotal) + ' km / mois'));

  var benefitCard = document.getElementById('rent-highlight-benefice');
  var benefitSummary = document.getElementById('rent-benefice-synthese');
  if (benefitCard) {
    benefitCard.classList.remove('is-positive', 'is-negative');
    benefitCard.classList.add(results.beneficeNet >= 0 ? 'is-positive' : 'is-negative');
  }
  if (benefitSummary) {
    benefitSummary.textContent = results.beneficeNet >= 0
      ? 'Votre activitÃ© dÃ©gage une marge positive avec ces paramÃ¨tres.'
      : 'Votre activitÃ© est dÃ©ficitaire avec ces paramÃ¨tres.';
  }

  var chargesCardSub = document.getElementById('rent-charges-fixes')?.closest('.kpi-card')?.querySelector('.kpi-sub');
  if (chargesCardSub) {
    chargesCardSub.textContent = config.repartitionCharges === 'prorata'
      ? 'Charges fixes proratisÃ©es'
      : 'Mensuelles HT';
  }

  var seuilSummary = document.getElementById('rent-resume-seuil');
  if (seuilSummary) {
    seuilSummary.textContent = results.seuilJours != null
      ? (results.modeCalcul === 'livraison'
        ? 'Avec ce type de livraison, il faut environ ' + rentabiliteFormatJours(results.seuilJours) + ' pour couvrir les charges fixes'
        : 'Votre activitÃ© devient rentable Ã  partir de ' + rentabiliteFormatJours(results.seuilJours) + ' par mois')
      : 'Votre activitÃ© nâ€™atteint pas le seuil de rentabilitÃ© avec ces paramÃ¨tres';
  }
  rentabiliteRenderAlerts(results, config);
}

function rentabiliteSyncFromDom() {
  var current = chargerRentabiliteConfig();
  var next = rentabiliteReadFromDom(current);
  if (next.modeCalcul === 'livraison') {
    var livraison = rentabiliteGetSelectedLivraison(next);
    next.kmJour = parseFloat(livraison?.distance) || 0;
    next.prixKm = next.kmJour > 0 ? (getMontantHTLivraison(livraison) / next.kmJour) : 0;
  }
  sauvegarderRentabiliteConfig(next);
  rentabiliteToggleMode(next);
  rentabiliteRenderResults(calculerRentabiliteAvancee(next), next);
}

function ajouterChargeRentabilite() {
  var config = chargerRentabiliteConfig();
  config.autresCharges.push({ id: genId(), label: 'Nouvelle charge', montant: 0 });
  sauvegarderRentabiliteConfig(config);
  rentabiliteRenderCharges(config);
  rentabiliteSyncFromDom();
}

supprimerChargeRentabilite = async function(id) {
  var ok = await confirmDialog('Supprimer cette charge ?', { titre: 'Supprimer la charge', icone: 'ðŸ’¸', btnLabel: 'Supprimer' });
  if (!ok) return;
  var config = chargerRentabiliteConfig();
  config.autresCharges = (config.autresCharges || []).filter(function(item) { return item.id !== id; });
  sauvegarderRentabiliteConfig(config);
  rentabiliteRenderCharges(config);
  rentabiliteSyncFromDom();
};

afficherRentabilite = function() {
  rentabiliteWireEvents();
  var config = chargerRentabiliteConfig();
  rentabiliteFillInputs(config);
  rentabiliteRenderResults(calculerRentabiliteAvancee(config), config);
};

genererRentabilitePDF = function() {
  var config = chargerRentabiliteConfig();
  var results = calculerRentabiliteAvancee(config);
  var params = getEntrepriseExportParams();
  var dateExp = formatDateHeureExport();
  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:28px;color:#1a1d27">'
    + construireEnteteExport(params, 'Rapport de rentabilitÃ©', 'Calculateur financier', dateExp)
    + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:18px 0">'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:.75rem;text-transform:uppercase;color:#6b7280;margin-bottom:10px">ActivitÃ©</div><div style="display:grid;gap:8px;font-size:.92rem"><div>Mode : <strong>' + (config.modeCalcul === 'livraison' ? 'Livraison ciblÃ©e' : 'Simulation manuelle') + '</strong></div><div>Km / jour : <strong>' + results.kmJour + '</strong></div><div>Prix / km HT : <strong>' + euros(results.prixKm) + '</strong></div><div>Jours travaillÃ©s : <strong>' + results.joursTravailles + '</strong></div>' + (results.livraison ? '<div>Livraison : <strong>' + planningEscapeHtml(getRentabiliteLivraisonLabel(results.livraison)) + '</strong></div>' : '') + '</div></div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:.75rem;text-transform:uppercase;color:#6b7280;margin-bottom:10px">CoÃ»ts mensuels</div><div style="display:grid;gap:8px;font-size:.92rem"><div>RÃ©partition charges fixes : <strong>' + (config.repartitionCharges === 'prorata' ? 'ProratisÃ©e' : 'Mois complet') + '</strong></div><div>Carburant HT : <strong>' + euros(results.coutCarburant) + '</strong></div><div>Charges fixes imputÃ©es HT : <strong>' + euros(results.chargesFixes) + '</strong></div><div>Charges fixes mensuelles HT : <strong>' + euros(results.chargesFixesMensuelles) + '</strong></div><div>CoÃ»t total HT : <strong>' + euros(results.coutTotal) + '</strong></div></div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px">'
    + [
      ['CA HT', euros(results.caHT), '#177245'],
      ['CA TTC', euros(results.caTTC), '#2563eb'],
      ['BÃ©nÃ©fice net', euros(results.beneficeNet), results.beneficeNet >= 0 ? '#177245' : '#e74c3c'],
      ['Seuil de rentabilitÃ©', rentabiliteFormatJours(results.seuilJours), '#f5a623'],
      ['Point mort', results.pointMortCA != null ? euros(results.pointMortCA) : 'Non atteignable', '#7c3aed'],
      ['CoÃ»t / km', euros(results.coutParKm) + '/km', '#4b5563'],
      ['Marge / km', euros(results.margeParKm) + '/km', results.margeParKm >= 0 ? '#177245' : '#e74c3c'],
      ['Revenu journalier', euros(results.revenuJournalier), '#111827'],
      ['CoÃ»t variable / jour', euros(results.coutVariableJournalier), '#f97316']
    ].map(function(item) {
      return '<div style="background:#f8fafc;border-radius:14px;padding:14px;border-top:3px solid ' + item[2] + '"><div style="font-size:.75rem;color:#6b7280;margin-bottom:6px">' + item[0] + '</div><div style="font-size:1.05rem;font-weight:800;color:' + item[2] + '">' + item[1] + '</div></div>';
    }).join('')
    + '</div>'
    + '<div style="padding:14px 16px;border-radius:14px;background:' + (results.beneficeNet >= 0 ? '#ecfdf5' : '#fef2f2') + ';border:1px solid ' + (results.beneficeNet >= 0 ? '#bbf7d0' : '#fecaca') + ';font-size:.92rem">'
    + (results.seuilJours != null ? 'Votre activitÃ© devient rentable Ã  partir de <strong>' + rentabiliteFormatJours(results.seuilJours) + '</strong> par mois.' : 'Votre activitÃ© nâ€™atteint pas le seuil de rentabilitÃ© avec les paramÃ¨tres actuels.')
    + '</div>'
    + renderFooterEntreprise(params, dateExp, 'Rapport de rentabilitÃ©')
    + '</div>';
  ouvrirFenetreImpression('RentabilitÃ© - ' + (params.nom || 'Entreprise'), html, 'width=1024,height=760');
  afficherToast('Rapport rentabilitÃ© gÃ©nÃ©rÃ©');
};

