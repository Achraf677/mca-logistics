/**
 * MCA Logistics — Module Salarie
 *
 * Extrait de salarie.html (decomposition modulaire phase 2).
 * Contient toutes les fonctions de l'interface salarie : accueil, planning,
 * livraisons sal, heures, carburant, messagerie, incidents, profil, etc.
 *
 * Charge depuis salarie.html via <script src="script-salarie.js">.
 */

/* ===== ÉTAT ===== */
let salarieCourant = null;

function setBoutonDeconnexionSalarieEtat(enCours) {
  const btn = document.getElementById('btn-salarie-logout');
  if (!btn) return;
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  btn.disabled = !!enCours;
  btn.textContent = enCours ? 'Déconnexion...' : btn.dataset.defaultLabel;
}

function redirigerVersLoginSalarie(raison) {
  try { sessionStorage.setItem('delivpro_debug_redirect', 'salarie: ' + (raison || 'inconnu') + ' @ ' + new Date().toLocaleTimeString()); } catch(_) {}
  document.body.classList.add('app-booting');
  if (window.top && window.top !== window) {
    window.top.location.href = 'login.html';
    return;
  }
  window.location.href = 'login.html';
}

function purgerSessionSalarieLocale() {
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('auth_mode');
  sessionStorage.removeItem('salarie_id');
  sessionStorage.removeItem('salarie_numero');
  sessionStorage.removeItem('delivpro_fast_boot_role');
}

function seDeconnecter() {
  if (window.__delivproSalarieLogoutPending) return;
  window.__delivproSalarieLogoutPending = true;
  setBoutonDeconnexionSalarieEtat(true);
  salarieCourant = null;
  if (window._msgPollInterval) clearInterval(window._msgPollInterval);
  sessionStorage.setItem('delivpro_logged_out', '1');
  sessionStorage.setItem('delivpro_pending_signout', '1');
  purgerSessionSalarieLocale();
  redirigerVersLoginSalarie('clic_deconnexion');
}

let _timerInactiviteSalarie = null;
function resetTimerInactiviteSalarie() {
  const security = window.DelivProSecurity || null;
  const timeoutMs = security && typeof security.getSessionTimeoutMs === 'function'
    ? security.getSessionTimeoutMs()
    : 30 * 60 * 1000;
  clearTimeout(_timerInactiviteSalarie);
  _timerInactiviteSalarie = setTimeout(function () {
    sessionStorage.setItem('delivpro_session_expired', '1');
    sessionStorage.setItem('delivpro_pending_signout', '1');
    purgerSessionSalarieLocale();
    redirigerVersLoginSalarie('timer_inactivite');
  }, timeoutMs);
}
['click','keydown','mousemove','scroll','touchstart'].forEach(function (eventName) {
  document.addEventListener(eventName, resetTimerInactiviteSalarie, { passive: true });
});

function appliquerBrandingSalarie() {
  const logo = localStorage.getItem('logo_entreprise_url') || localStorage.getItem('logo_entreprise') || '';
  const nom = (() => {
    try {
      const params = JSON.parse(localStorage.getItem('params_entreprise') || '{}');
      return params.nom || 'MCA Logistics';
    } catch (_) {
      return 'MCA Logistics';
    }
  })();
  const mark = document.getElementById('salarie-brand-mark');
  const name = document.getElementById('salarie-brand-name');
  if (mark) mark.innerHTML = logo ? `<img src="${logo}" alt="Logo entreprise" />` : '🚐';
  if (name) name.textContent = nom;
  const link = document.querySelector("link[rel='icon']") || document.createElement('link');
  link.rel = 'icon';
  link.href = logo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚐</text></svg>";
  document.head.appendChild(link);
}

function lancerInterface() {
  // Charger le logo depuis localStorage
  (function() {
    const logo = localStorage.getItem('logo_entreprise_url')
      || localStorage.getItem('logo_entreprise');
    const logoEl = document.getElementById('topbar-logo-img');
    const logoText = document.getElementById('topbar-logo-text');
    if (logo && logoEl) {
      logoEl.src = logo;
      logoEl.style.display = 'block';
      if (logoText) logoText.style.display = 'none';
    }
  })();
  initMobile();
  appliquerBrandingSalarie();
  document.getElementById('ecran-salarie').style.display = 'flex';
  document.getElementById('ecran-salarie').style.flexDirection = 'column';
  document.getElementById('ecran-salarie').style.height = '100vh';

  document.getElementById('sal-nom-display').textContent = salarieCourant.nom;
  const veh = getMonVehicule();
  document.getElementById('sal-veh-display').textContent = veh ? `🚐 ${veh.immat} — ${veh.modele}` : 'Aucun véhicule affecté';

  const infoTxt = veh ? `🚐 Votre véhicule : ${veh.immat} — ${veh.modele}` : '';
  ['km-veh-info','carb-veh-info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = infoTxt; el.style.display = infoTxt ? 'block' : 'none'; }
  });

  const auj = new Date().toISOString().split('T')[0];
  ['km-date','sal-carb-date'].forEach(id => { const el=document.getElementById(id); if(el) el.value=auj; });

  // Km report auto
  // Vérifier notifs
  verifierNotifs();

  changerOnglet('accueil', document.getElementById('tab-accueil'));
  chargerLivraisons();
  chargerHistoriqueKm();
  chargerHistoriqueCarburant();
  chargerHistoriqueInspections();
  chargerMessagesSal();
  mettreAJourBadgeMsgSal();
  afficherAccueil();
  rafraichirTourneesSelect(); // Pré-charger les livraisons du jour dans le select km

  // Info véhicule dans inspection + km
  const infoInsp = document.getElementById('insp-veh-info');
  if (infoInsp && veh) { infoInsp.textContent = `🚐 Véhicule : ${veh.immat} — ${veh.modele}`; infoInsp.style.display = 'block'; }

  // Date du jour dans inspection
  const inspDate = document.getElementById('insp-date');
  if (inspDate) inspDate.value = auj;
  requestAnimationFrame(function () {
    document.body.classList.remove('app-booting');
  });

  // Polling toutes les 10s pour détecter nouveaux messages admin
  if (window._msgPollInterval) clearInterval(window._msgPollInterval);
  window._msgPollInterval = setInterval(() => {
    if (!salarieCourant) { clearInterval(window._msgPollInterval); return; }
    mettreAJourBadgeMsgSal();
  }, 10000);
  initAccueilBonjour();
  initEtatBoutonsKm();
  majBadgesBottomNav();
  const selTournee = document.getElementById('km-tournee-id');
  if (selTournee) {
    selTournee.addEventListener('change', function() {
      const motifWrapper = document.getElementById('km-motif-wrapper');
      if (!motifWrapper) return;
      motifWrapper.style.display = this.value === '' ? 'block' : 'none';
    });
  }
}

function getMonVehicule() {
  return (JSON.parse(localStorage.getItem('vehicules')||'[]')).find(v => v.salId===salarieCourant.id) || null;
}

function mettreAJourKmVehiculeAffecte(km) {
  const valeur = parseFloat(km) || 0;
  const veh = getMonVehicule();
  if (!veh || !valeur) return;
  const vehicules = JSON.parse(localStorage.getItem('vehicules') || '[]');
  const idx = vehicules.findIndex(v => v.id === veh.id);
  if (idx === -1) return;
  const kmAvant = parseFloat(vehicules[idx].km) || 0;
  vehicules[idx].km = Math.max(parseFloat(vehicules[idx].km) || 0, valeur);
  if (vehicules[idx].kmInitial === undefined || vehicules[idx].kmInitial === null || vehicules[idx].kmInitial === '') {
    vehicules[idx].kmInitial = kmAvant || valeur;
  }
  localStorage.setItem('vehicules', JSON.stringify(vehicules));
}

function libelleCarburant() {
  const veh = getMonVehicule();
  return `${veh ? veh.immat : 'SANS-PLAQUE'} — ${salarieCourant.nom}`;
}

/* ===== NOTIFS ===== */
function verifierNotifs() {
  const notifs = (JSON.parse(localStorage.getItem('notifs_sal_'+salarieCourant.id)||'[]')).filter(n=>!n.lu);
  const dot = document.getElementById('notif-dot');
  if (dot) dot.classList.toggle('visible', notifs.length > 0);
}

function afficherNotifsDansOnglet(containerId) {
  const cle   = 'notifs_sal_'+salarieCourant.id;
  const notifs = JSON.parse(localStorage.getItem(cle)||'[]').filter(n=>!n.lu);
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  notifs.forEach(n => {
    const div = document.createElement('div');
    div.className = 'notif-banner';
    div.innerHTML = `<span>✅ ${n.message}</span><button class="close-notif" onclick="marquerNotifLue('${n.id}','${containerId}')">✕</button>`;
    container.appendChild(div);
  });
}

function marquerNotifLue(notifId, containerId) {
  const cle    = 'notifs_sal_'+salarieCourant.id;
  const notifs = JSON.parse(localStorage.getItem(cle)||'[]');
  const idx    = notifs.findIndex(n => n.id===notifId);
  if (idx > -1) { notifs[idx].lu = true; localStorage.setItem(cle, JSON.stringify(notifs)); }
  verifierNotifs();
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
  afficherNotifsDansOnglet(containerId);
}

/* ===== PROFIL ===== */
function afficherProfil() {
  const sal = salarieCourant;
  const veh = getMonVehicule();
  const livraisons = JSON.parse(localStorage.getItem('livraisons')||'[]');
  const mois = new Date().toISOString().slice(0,7);
  const auj  = new Date().toISOString().split('T')[0];
  const livsM = livraisons.filter(l => l.chaufId===sal.id && l.date.startsWith(mois)).length;
  const livsA = livraisons.filter(l => l.chaufId===sal.id && l.date===auj).length;

  // Km ce mois
  const entrees = JSON.parse(localStorage.getItem('km_sal_'+sal.id)||'[]');
  const kmMois  = entrees.filter(e => e.date.startsWith(mois)).reduce((s,e)=>s+(e.distance||0),0);

  document.getElementById('profil-nom-display').textContent = sal.nom;
  document.getElementById('profil-poste-display').textContent = sal.poste || 'Poste non renseigné';
  document.getElementById('profil-avatar').textContent = sal.nom.charAt(0).toUpperCase();
  document.getElementById('profil-numero').textContent  = sal.numero;
  document.getElementById('profil-tel').textContent     = sal.tel || 'Non renseigné';
  document.getElementById('profil-vehicule').textContent = veh ? `${veh.immat} — ${veh.modele}` : 'Non affecté';
  document.getElementById('profil-poste').textContent   = sal.poste || 'Non renseigné';
  document.getElementById('profil-depuis').textContent  = sal.creeLe ? new Date(sal.creeLe).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '—';
  document.getElementById('profil-livs-mois').textContent = livsM;
  document.getElementById('profil-livs-auj').textContent  = livsA;
  document.getElementById('profil-km-mois').textContent   = kmMois.toFixed(0)+' km';

  // Incidents me concernant
  const incidents = JSON.parse(localStorage.getItem('incidents')||'[]').filter(i=>i.chaufId===sal.id);
  const incCont   = document.getElementById('mes-incidents-container');
  if (incCont) {
    if (incidents.length === 0) {
      incCont.innerHTML = '';
    } else {
      const ouverts = incidents.filter(i=>i.statut==='ouvert').length;
      incCont.innerHTML = `
        <div class="card" style="border-left:3px solid ${ouverts>0?'var(--red)':'var(--green)'}">
          <div class="card-header"><h2>${ouverts>0?'🚨':'✅'} Incidents / Réclamations me concernant</h2><span style="font-size:.82rem;color:var(--text-muted)">${incidents.length} au total · ${ouverts} ouvert(s)</span></div>
          <div class="card-body" style="padding:0">
            ${incidents.slice(0,5).map(i=>`
              <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:.85rem;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:500">${i.description||'—'}</div>
                  <div style="font-size:.75rem;color:var(--muted)">${i.date} · ${i.client||'—'}</div>
                </div>
                <span class="incident-badge ${i.statut==='ouvert'?'incident-ouvert':i.statut==='traite'?'incident-traite':'incident-encours'}">${i.statut==='ouvert'?'🔴 Ouvert':i.statut==='traite'?'✅ Traité':'🟡 En cours'}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }
  }

  // Notifs dans profil
  const notifsDansOnglet = JSON.parse(localStorage.getItem('notifs_sal_'+sal.id)||'[]').filter(n=>!n.lu);
  const container = document.getElementById('notifs-profil-container');
  container.innerHTML = '';
  notifsDansOnglet.forEach(n => {
    const div = document.createElement('div');
    div.className = 'notif-banner';
    div.innerHTML = `<span>${n.message}</span><button class="close-notif" onclick="marquerNotifLue('${n.id}','notifs-profil-container')">✕</button>`;
    container.appendChild(div);
  });
}

/* ===== ONGLETS ===== */
function changerOnglet(nom, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panneau').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else { const t = document.getElementById('tab-profil'); if(t) t.classList.add('active'); }
  const p = document.getElementById('panneau-'+nom);
  if (p) p.classList.add('active');

  if (nom === 'profil') {
    afficherProfil();
    const dot = document.getElementById('notif-dot');
    if (dot) dot.classList.remove('visible');
  }
  if (nom === 'carburant')  afficherNotifsDansOnglet('notifs-carburant-container');
  if (nom === 'messages')   { chargerMessagesSal(); }
  if (nom === 'inspection') { chargerHistoriqueInspections(); rafraichirTourneesSelect(); }
  if (nom === 'accueil')    { afficherAccueil(); }
  if (nom === 'planning')   { afficherPlanningSal(); }
}

/* ===== SYNCHRO LOCALE (admin → salarié en temps réel) ===== */
function gererChangementStorageSalarie(key) {
  if (!salarieCourant) return;
  // Planning mis à jour par l'admin
  if (key === 'plannings') {
    afficherAccueil();
    const panneau = document.getElementById('panneau-planning');
    if (panneau && panneau.closest('.panneau.active')) afficherPlanningSal();
    else afficherPlanningSal(); // toujours mettre à jour en cache
    toast('📅 Planning mis à jour par l\'administrateur');
  }
  // Nouvelles livraisons assignées
  if (key === 'livraisons') {
    chargerLivraisons();
    afficherAccueil();
  }
  // Nouveau message de l'admin
  if (key && key.startsWith('messages_' + salarieCourant.id)) {
    mettreAJourBadgeMsgSal();
    const msgs = document.getElementById('msg-fil');
    if (msgs) chargerMessagesSal();
  }
  // Notifs validées par admin
  if (key && key.startsWith('notifs_sal_' + salarieCourant.id)) {
    verifierNotifs();
  }
}

window.addEventListener('storage', function(e) {
  gererChangementStorageSalarie(e.key);
});

window.addEventListener('delivpro:storage-sync', function(e) {
  const key = e && e.detail ? e.detail.key : '';
  gererChangementStorageSalarie(key);
});

/* ===== RÉSUMÉ FIN DE JOURNÉE ===== */
function afficherResumeJournee() {
  const auj   = new Date().toISOString().split('T')[0];
  const heure = new Date().getHours();
  const cont  = document.getElementById('resume-journee-container');
  if (!cont) return;

  // Heure de déclenchement : basée sur le planning du salarié
  const plannings  = JSON.parse(localStorage.getItem('plannings')||'[]');
  const monPlan    = plannings.find(p=>p.salId===salarieCourant.id);
  const joursSem   = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const jourNom    = joursSem[new Date().getDay()];
  const entree     = monPlan?.semaine?.find(j=>j.jour===jourNom);
  const heureFin   = entree?.heureFin ? parseInt(entree.heureFin.split(':')[0]) : 16;
  const seuilAffichage = Math.max(heureFin - 1, 14); // 1h avant la fin, min 14h

  if (heure < seuilAffichage) { cont.innerHTML = ''; return; }

  const livraisons = JSON.parse(localStorage.getItem('livraisons')||'[]')
    .filter(l => l.chaufId===salarieCourant.id && l.date===auj);
  if (!livraisons.length) { cont.innerHTML=''; return; }

  const livrees  = livraisons.filter(l=>l.statut==='livre').length;
  const kmEntrees= JSON.parse(localStorage.getItem('km_sal_'+salarieCourant.id)||'[]').filter(e=>e.date===auj);
  const kmTotal  = kmEntrees.reduce((s,e)=>s+(e.distance||0),0);
  const pleins   = JSON.parse(localStorage.getItem('carb_sal_'+salarieCourant.id)||'[]');
  const plein    = pleins.some(p=>p.date===auj);
  const caJour   = livraisons.filter(l=>l.statut==='livre').reduce((s,l)=>s+(l.prix||0),0);

  cont.innerHTML = `
    <div class="resume-journee">
      <div class="resume-journee-title">🌅 Résumé de votre journée</div>
      <div class="resume-grid">
        <div class="resume-item"><div class="resume-item-val">${livraisons.length}</div><div class="resume-item-label">Livraisons</div></div>
        <div class="resume-item"><div class="resume-item-val" style="color:var(--green)">${livrees}</div><div class="resume-item-label">Livrées ✅</div></div>
        <div class="resume-item"><div class="resume-item-val">${kmTotal>0?kmTotal.toFixed(0)+' km':'—'}</div><div class="resume-item-label">Km parcourus</div></div>
        <div class="resume-item"><div class="resume-item-val">${plein?'✅':'❌'}</div><div class="resume-item-label">Plein fait</div></div>
        ${caJour > 0 ? `<div class="resume-item" style="grid-column:1/-1"><div class="resume-item-val" style="font-size:1rem">${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(caJour)}</div><div class="resume-item-label">CA livré</div></div>` : ''}
      </div>
    </div>`;
}

/* ===== PHOTO MESSAGERIE SALARIÉ ===== */
function togglePjMenu() {
  const menu = document.getElementById('pj-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function declencherPj(type) {
  document.getElementById('pj-menu').style.display = 'none';
  const map = { 'photo': 'msg-pj-photo', 'galerie': 'msg-pj-galerie', 'fichier': 'msg-pj-fichier' };
  const input = document.getElementById(map[type]);
  if (input) input.click();
}

function envoyerFichierSal(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('⚠️ Fichier trop lourd (max 5 Mo)', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const msgs = JSON.parse(localStorage.getItem('messages_' + salarieCourant.id) || '[]');
    msgs.push({
      id: Date.now().toString(36),
      auteur: 'salarie',
      texte: '📎 Fichier : ' + file.name,
      fichier: e.target.result,
      nomFichier: file.name,
      lu: false,
      creeLe: new Date().toISOString()
    });
    localStorage.setItem('messages_' + salarieCourant.id, JSON.stringify(msgs));
    input.value = '';
    chargerMessagesSal();
    toast('✅ Fichier envoyé');
  };
  reader.readAsDataURL(file);
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.pj-menu-wrap')) {
    const menu = document.getElementById('pj-menu');
    if (menu) menu.style.display = 'none';
  }
});

function envoyerPhotoSal(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = async () => {
      const max = 800;
      let w = img.width, h = img.height;
      if (w > max || h > max) { const r=Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r); }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);

      const msgId = Date.now().toString(36);
      let photoPath = null;
      let photoBase64 = null;

      // Upload vers Supabase Storage si dispo (WebP si supporte, sinon JPEG)
      // Offline -> queue via DelivProOfflineQueue (retry au retour reseau)
      if (window.DelivProStorage) {
        const out = await window.DelivProStorage.canvasToOptimalBlob(c, 0.78);
        if (out && out.blob) {
          const path = `${msgId}/${Date.now()}_photo.${out.ext}`;
          if (window.DelivProOfflineQueue) {
            const r = await window.DelivProOfflineQueue.uploadOrEnqueue({
              bucket: 'messages-photos', path, blob: out.blob, contentType: out.mime,
              meta: { kind: 'message-photo', salId: salarieCourant.id, msgId }
            });
            if (r.ok) photoPath = path;
          } else {
            const up = await window.DelivProStorage.uploadBlob('messages-photos', path, out.blob, { contentType: out.mime });
            if (up.ok) photoPath = path;
          }
        }
      }
      if (!photoPath) {
        // Fallback : base64 local (compat offline sans queue)
        photoBase64 = c.toDataURL('image/jpeg',0.72);
      }

      const msgs = JSON.parse(localStorage.getItem('messages_'+salarieCourant.id)||'[]');
      msgs.push({
        id: msgId, auteur:'salarie', texte:'📷 Photo partagée',
        photo: photoBase64, photoPath: photoPath, photoBucket: photoPath ? 'messages-photos' : null,
        lu:false, creeLe:new Date().toISOString()
      });
      localStorage.setItem('messages_'+salarieCourant.id, JSON.stringify(msgs));
      input.value = '';
      chargerMessagesSal();
      toast('✅ Photo envoyée');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/* ===== PLANNING SALARIÉ ===== */
function afficherPlanningSal() {
  if (!salarieCourant) return;
  const cont = document.getElementById('planning-sal-content');
  if (!cont) return;

  // Récupérer toutes les sources possibles de planning
  const plannings = JSON.parse(localStorage.getItem('plannings') || '[]');
  const periodes = JSON.parse(localStorage.getItem('absences_periodes') || '[]');
  const salaries = JSON.parse(localStorage.getItem('salaries') || '[]');

  // Identifier le salarié avec tous les IDs possibles
  const monSalarieLocal = salaries.find(s =>
    s.id === salarieCourant.id ||
    s.supabaseId === salarieCourant.id ||
    s.id === salarieCourant.supabaseId ||
    s.numero === salarieCourant.numero ||
    s.nom === salarieCourant.nom
  );

  const idsPossibles = [
    salarieCourant.id,
    salarieCourant.supabaseId,
    monSalarieLocal?.id,
    monSalarieLocal?.supabaseId,
    salarieCourant.numero
  ].filter(Boolean);

  // Récupérer mon planning hebdomadaire
  const monPlan = plannings.find(p =>
    idsPossibles.includes(p.salId) || p.salNom === salarieCourant.nom
  );

  // Récupérer mes périodes de travail/absence
  const mesPeriodes = periodes.filter(p =>
    idsPossibles.includes(p.salId) || p.salNom === salarieCourant.nom
  );

  // Générer les 7 jours de la semaine actuelle
  const maintenant = new Date();
  const jourSemaine = maintenant.getDay();
  const lundi = new Date(maintenant);
  lundi.setDate(maintenant.getDate() - (jourSemaine === 0 ? 6 : jourSemaine - 1));
  lundi.setHours(0, 0, 0, 0);

  const joursLabels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const joursKeys = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const auj = localDateStr(maintenant);

  const cartes = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(lundi);
    date.setDate(lundi.getDate() + i);
    const dateStr = localDateStr(date);
    const jourKey = joursKeys[i];
    const estAuj = dateStr === auj;

    // 1. Chercher dans les périodes datées
    const periode = mesPeriodes.find(p =>
      dateStr >= p.debut && dateStr <= p.fin
    );

    let contenu = null;

    if (periode) {
      if (periode.type === 'travail') {
        contenu = {
          travail: true,
          debut: periode.heureDebut,
          fin: periode.heureFin,
          typeJour: 'travail',
          zone: periode.zone || ''
        };
      } else {
        contenu = {
          travail: false,
          typeJour: periode.type,
          label: periode.type === 'conge' ? 'Congé'
            : periode.type === 'maladie' ? 'Maladie'
            : periode.type === 'repos' ? 'Repos'
            : 'Absence'
        };
      }
    } else if (monPlan && monPlan.semaine) {
      // 2. Fallback : planning hebdomadaire récurrent
      const jour = monPlan.semaine.find(s => s.jour === jourKey);
      if (jour && jour.travaille) {
        contenu = {
          travail: true,
          debut: jour.heureDebut,
          fin: jour.heureFin,
          typeJour: 'travail',
          zone: jour.zone || ''
        };
      }
    }

    cartes.push({
      label: joursLabels[i],
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      estAuj,
      contenu
    });
  }

  // Compter les jours travaillés cette semaine
  const joursTravailles = cartes.filter(c => c.contenu?.travail).length;

  cont.innerHTML = `
    <div style="
      margin-bottom:16px;padding:14px 16px;
      background:rgba(245,166,35,0.08);
      border:1px solid rgba(245,166,35,0.2);
      border-radius:12px;
    ">
      <div style="font-size:.75rem;color:var(--muted);
        text-transform:uppercase;letter-spacing:.5px;
        margin-bottom:4px;font-weight:600;">
        Cette semaine
      </div>
      <div style="font-size:1.1rem;font-weight:800;color:var(--accent)">
        ${joursTravailles} jour${joursTravailles > 1 ? 's' : ''} travaillé${joursTravailles > 1 ? 's' : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${cartes.map(c => {
        const bgColor = c.estAuj
          ? 'rgba(245,166,35,0.08)'
          : 'var(--card2)';
        const borderColor = c.estAuj
          ? 'var(--accent)'
          : 'var(--border)';

        let contenuHtml = '';
        if (c.contenu?.travail) {
          contenuHtml = `
            <div style="display:inline-flex;align-items:center;gap:6px;color:var(--green);font-weight:700;font-size:.88rem;white-space:nowrap;">
  <span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;flex-shrink:0;"></span>
  ${c.contenu.debut} → ${c.contenu.fin}
</div>
            ${c.contenu.zone ? `
              <div style="font-size:.78rem;color:var(--muted);margin-top:4px">
                📍 ${c.contenu.zone}
              </div>` : ''}
          `;
        } else if (c.contenu?.typeJour === 'conge') {
          contenuHtml = `<div style="color:#3b82f6;font-weight:700;font-size:.88rem">🏖️ Congé</div>`;
        } else if (c.contenu?.typeJour === 'maladie') {
          contenuHtml = `<div style="color:#a855f7;font-weight:700;font-size:.88rem">🤒 Maladie</div>`;
        } else if (c.contenu?.typeJour === 'repos') {
          contenuHtml = `<div style="color:var(--muted);font-weight:600;font-size:.88rem">💤 Repos</div>`;
        } else {
          contenuHtml = `<div style="color:var(--muted);font-size:.85rem">—</div>`;
        }

        return `
          <div style="
            padding:14px 16px;
            background:${bgColor};
            border:2px solid ${borderColor};
            border-radius:12px;
            display:flex;justify-content:space-between;align-items:center;
          ">
            <div>
              <div style="
                font-size:.88rem;font-weight:800;
                color:${c.estAuj ? 'var(--accent)' : 'var(--text)'};
                margin-bottom:2px;
              ">
                ${c.label}${c.estAuj ? ' · Aujourd\'hui' : ''}
              </div>
              <div style="font-size:.72rem;color:var(--muted)">
                ${c.date}
              </div>
            </div>
            <div style="text-align:right">
              ${contenuHtml}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ===== ACCUEIL ===== */
function afficherAccueil() {
  const auj      = new Date().toISOString().split('T')[0];
  const salId    = salarieCourant.id;
  const livraisons = JSON.parse(localStorage.getItem('livraisons')||'[]');
  const livsAuj  = livraisons.filter(l => l.chaufId===salId && l.date===auj);

  // ── Planning du jour ──
  const plannings = JSON.parse(localStorage.getItem('plannings')||'[]');
  const monPlan   = plannings.find(p => p.salId===salId);
  // getDay() : 0=dim,1=lun,...,6=sam — on mappe vers notre convention (lundi=premier)
  const _joursSem = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const jourNom   = _joursSem[new Date().getDay()];
  const planCard  = document.getElementById('accueil-planning-card');
  const planCont  = document.getElementById('accueil-planning-content');
  if (planCard) planCard.style.display = 'none';
  if (planCont) {
    if (monPlan) {
      const entree = (monPlan.semaine||[]).find(j => j.jour === jourNom);
      planCard.style.display = 'block';
      if (entree && entree.travaille) {
        planCont.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
            ${entree.heureDebut ? `<div style="background:var(--card2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:.7rem;color:var(--muted);margin-bottom:3px">DÉBUT</div><strong>${entree.heureDebut}</strong></div>` : ''}
            ${entree.heureFin   ? `<div style="background:var(--card2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:.7rem;color:var(--muted);margin-bottom:3px">FIN</div><strong>${entree.heureFin}</strong></div>` : ''}
            ${entree.zone       ? `<div style="background:var(--card2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:.7rem;color:var(--muted);margin-bottom:3px">ZONE</div><strong>${entree.zone}</strong></div>` : ''}
          </div>
          ${entree.note ? `<p style="font-size:.82rem;color:var(--muted);margin-top:8px">📝 ${entree.note}</p>` : ''}
          <button onclick="changerOnglet('planning',document.getElementById('tab-planning'))" style="margin-top:10px;background:none;border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:7px;font-size:.78rem;cursor:pointer">Voir semaine complète →</button>`;
      } else if (entree && !entree.travaille) {
        planCont.innerHTML = `<p style="color:var(--green);font-size:.9rem">🏖️ Jour de repos — Bonne journée !</p>
          <button onclick="changerOnglet('planning',document.getElementById('tab-planning'))" style="margin-top:8px;background:none;border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:7px;font-size:.78rem;cursor:pointer">Voir semaine complète →</button>`;
      } else {
        planCont.innerHTML = `<p style="color:var(--muted);font-size:.85rem">Aucune entrée pour aujourd'hui.</p>
          <button onclick="changerOnglet('planning',document.getElementById('tab-planning'))" style="margin-top:8px;background:none;border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:7px;font-size:.78rem;cursor:pointer">Voir semaine complète →</button>`;
      }
    }
  }

  // ── Checklist tâches ──
  const cleCl   = 'checklist_'+salId+'_'+auj;
  let checklist = JSON.parse(localStorage.getItem(cleCl)||'null');
  if (!checklist) {
    checklist = {
      kmDepart:    false,
      inspection:  false,
      kmArrivee:   false,
      pleinFait:   null   // null = pas répondu, true/false = réponse
    };
    localStorage.setItem(cleCl, JSON.stringify(checklist));
  }

  // Vérifier auto depuis les données réelles
  const kmAuj = (JSON.parse(localStorage.getItem('km_sal_'+salId)||'[]'))
    .filter(e => e.date === new Date().toISOString().slice(0,10));
  const kmDepartFait = kmAuj.some(e => e.kmDepart != null && e.kmDepart > 0);
  const kmRetourFait = kmAuj.some(e => e.kmArrivee != null && e.kmArrivee > 0);
  if (kmDepartFait) checklist.kmDepart = true;
  if (kmRetourFait) checklist.kmArrivee = true;
  const inspAuj = JSON.parse(localStorage.getItem('inspections')||'[]').filter(i=>i.salId===salId&&i.date===auj);
  if (inspAuj.length > 0) checklist.inspection = true;
  // pleinFait auto si un plein a été enregistré aujourd'hui
  const pleinsAuj = JSON.parse(localStorage.getItem('carb_sal_'+salId)||'[]').filter(p=>p.date===auj);
  if (pleinsAuj.length > 0 && checklist.pleinFait === null) checklist.pleinFait = true;
  localStorage.setItem(cleCl, JSON.stringify(checklist));

  const taches = [
    { cle:'kmDepart',   fait: checklist.kmDepart,   label:'🛣️ Relevé kilométrique de départ',       action:`changerOnglet('inspection',document.getElementById('tab-inspection'))`, btnLabel:'Saisir' },
    { cle:'inspection', fait: checklist.inspection, label:'📷 Photos d\'inspection du véhicule',     action:`changerOnglet('inspection',document.getElementById('tab-inspection'))`, btnLabel:'Faire l\'inspection' },
    { cle:'kmArrivee',  fait: checklist.kmArrivee,  label:'🏁 Relevé kilométrique de retour', action:`changerOnglet('inspection',document.getElementById('tab-inspection'))`, btnLabel:'Saisir' },
  ];

  const done   = taches.filter(t=>t.fait).length + (checklist.pleinFait !== null ? 1 : 0);
  const total  = taches.length + 1;
  const pct    = Math.round(done/total*100);

  const cont = document.getElementById('accueil-checklist');
  const prog = document.getElementById('accueil-checklist-progress');
  if (prog) prog.textContent = `${done}/${total} complétées`;

  // Badge Accueil si tâches non faites
  const nonFaites = taches.filter(t => !t.fait).length + (checklist.pleinFait === null ? 1 : 0);
  const badgeAcc = document.getElementById('badge-accueil');
  if (badgeAcc) { badgeAcc.textContent = nonFaites; badgeAcc.style.display = nonFaites > 0 ? 'inline-block' : 'none'; }

  cont.innerHTML = `
    <div style="background:var(--card2);border-radius:8px;padding:8px 12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <div style="flex:1;background:rgba(255,255,255,.08);border-radius:20px;height:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pct===100?'var(--green)':'var(--accent)'};border-radius:20px;transition:width .4s"></div>
      </div>
      <span style="font-size:.82rem;color:${pct===100?'var(--green)':'var(--muted)'};font-weight:600">${pct}%</span>
    </div>
    ${taches.map(t => `
      <div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border)">
        <div style="width:24px;height:24px;border-radius:50%;background:${t.fait?'var(--green)':'rgba(255,255,255,.08)'};border:2px solid ${t.fait?'var(--green)':'var(--border)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.75rem">${t.fait?'✓':''}</div>
        <span style="flex:1;font-size:.88rem;color:${t.fait?'var(--muted)':'var(--text)'};${t.fait?'text-decoration:line-through':''}">${t.label}</span>
        ${!t.fait ? `<button onclick="${t.action}" style="background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.3);color:var(--accent);padding:5px 12px;border-radius:7px;font-size:.78rem;cursor:pointer;white-space:nowrap">${t.btnLabel} →</button>` : '<span style="font-size:.78rem;color:var(--green)">✅ Fait</span>'}
      </div>`).join('')}
    <div style="display:flex;align-items:center;gap:12px;padding:11px 0">
      <div style="width:24px;height:24px;border-radius:50%;background:${checklist.pleinFait===true?'var(--green)':checklist.pleinFait===false?'rgba(231,76,60,.2)':'rgba(255,255,255,.08)'};border:2px solid ${checklist.pleinFait!==null?checklist.pleinFait?'var(--green)':'var(--red)':'var(--border)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.75rem">${checklist.pleinFait===true?'✓':checklist.pleinFait===false?'✗':''}</div>
      <span style="flex:1;font-size:.88rem">⛽ Plein de carburant effectué aujourd'hui ?</span>
      ${checklist.pleinFait===null ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="repondreChecklistPleinOui()" style="background:rgba(46,204,113,.12);border:1px solid rgba(46,204,113,.3);color:var(--green);padding:5px 12px;border-radius:7px;font-size:.78rem;cursor:pointer">✅ Oui — Saisir →</button>
          <button onclick="repondreChecklist('pleinFait',false)" style="background:rgba(231,76,60,.08);border:1px solid rgba(231,76,60,.25);color:var(--red);padding:5px 12px;border-radius:7px;font-size:.78rem;cursor:pointer">Non</button>
        </div>` : `<div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:.78rem;color:${checklist.pleinFait?'var(--green)':'var(--muted)'}">${checklist.pleinFait?'✅ Oui':'❌ Non'}</span>
          ${checklist.pleinFait ? `<button onclick="changerOnglet('carburant',document.getElementById('tab-carburant'))" style="background:rgba(46,204,113,.08);border:1px solid rgba(46,204,113,.2);color:var(--green);padding:3px 9px;border-radius:6px;font-size:.72rem;cursor:pointer">⛽ Saisir →</button>` : ''}
          <button onclick="repondreChecklist('pleinFait',null)" style="background:none;border:1px solid var(--border);color:var(--muted);padding:3px 8px;border-radius:6px;font-size:.72rem;cursor:pointer">Modifier</button>
        </div>`}
    </div>`;

  // ── Résumé livraisons ──
  const resumeCont = document.getElementById('accueil-livraisons-resume');
  const nbEl = document.getElementById('accueil-nb-livs');
  if (nbEl) nbEl.textContent = `${livsAuj.length} livraison(s)`;
  if (!livsAuj.length) {
    resumeCont.innerHTML = '<div class="empty">Aucune livraison assignée pour aujourd\'hui</div>';
  } else {
    resumeCont.innerHTML = livsAuj.map(l => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:.88rem;flex:1">📦 <strong>${l.client}</strong>${l.arrivee ? ' → ' + l.arrivee : ''}</span>
        <span style="font-size:.78rem;background:${l.statut==='livre'?'rgba(46,204,113,.12)':l.statut==='en-cours'?'rgba(79,142,247,.12)':'rgba(255,255,255,.06)'};color:${l.statut==='livre'?'var(--green)':l.statut==='en-cours'?'var(--blue)':'var(--muted)'};padding:3px 9px;border-radius:20px">${l.statut==='livre'?'✅ Livré':l.statut==='en-cours'?'🚐 En cours':'⏳ En attente'}</span>
      </div>`).join('');
  }
  // Résumé fin de journée (visible à partir de 15h)
  afficherResumeJournee();
}

function repondreChecklist(cle, valeur) {
  const auj  = new Date().toISOString().split('T')[0];
  const cleCl = 'checklist_'+salarieCourant.id+'_'+auj;
  const cl   = JSON.parse(localStorage.getItem(cleCl)||'{}');
  cl[cle]    = valeur;
  localStorage.setItem(cleCl, JSON.stringify(cl));
  afficherAccueil();
}

function repondreChecklistPleinOui() {
  repondreChecklist('pleinFait', true);
  changerOnglet('carburant', document.getElementById('tab-carburant'));
}

/* ===== LIVRAISONS ===== */
function chargerLivraisons() {
  const auj        = new Date().toISOString().split('T')[0];
  const livraisons = JSON.parse(localStorage.getItem('livraisons')||'[]');
  const miennes    = livraisons.filter(l => l.chaufId===salarieCourant.id && l.date===auj);
  document.getElementById('badge-nb-livraisons').textContent = miennes.length+' livraison(s)';
  const container = document.getElementById('liste-livraisons');
  if (!miennes.length) { container.innerHTML='<div class="empty">Aucune livraison assignée pour aujourd\'hui</div>'; return; }
  container.innerHTML = miennes.map(l => `
    <div class="livraison-item">
      <div class="livraison-info">
        <div class="livraison-client">📦 ${l.client}</div>
        <div class="livraison-adresses">
          ${l.depart ? '📍 '+l.depart+'<br>' : ''}
          ${l.arrivee ? '🏁 '+l.arrivee : ''}
          ${l.distance ? ' · '+l.distance+' km' : ''}
          ${l.notes ? '<br>📝 '+l.notes : ''}
        </div>
      </div>
      <div class="livraison-statut">
        <select onchange="changerStatut('${l.id}',this.value)">
          <option value="en-attente" ${l.statut==='en-attente'?'selected':''}>⏳ En attente</option>
          <option value="en-cours"   ${l.statut==='en-cours'  ?'selected':''}>🚐 En cours</option>
          <option value="livre"      ${l.statut==='livre'     ?'selected':''}>✅ Livré</option>
        </select>
      </div>
    </div>`).join('');
}

function changerStatut(id, statut) {
  const livraisons = JSON.parse(localStorage.getItem('livraisons')||'[]');
  const idx = livraisons.findIndex(l => l.id===id);
  if (idx > -1) {
    livraisons[idx].statut = statut;
    localStorage.setItem('livraisons', JSON.stringify(livraisons));
    toast('✅ Statut mis à jour');
    chargerLivraisons();
    afficherAccueil();
  }
}


/* ===== KM ===== */
function rafraichirTourneesSelect() {
  const date = document.getElementById('km-date')?.value || new Date().toISOString().split('T')[0];
  const sel  = document.getElementById('km-tournee-id');
  if (!sel || !salarieCourant) return;

  const livraisons = JSON.parse(localStorage.getItem('livraisons') || '[]');
  const miennes    = livraisons.filter(l => l.chaufId === salarieCourant.id && l.date === date);

  sel.innerHTML = '<option value="">— Sélectionner une livraison (optionnel) —</option>';
  if (!miennes.length) {
    sel.innerHTML += '<option value="" disabled>Aucune livraison assignée ce jour</option>';
    return;
  }
  miennes.forEach(l => {
    const label = `📦 ${l.client}${l.arrivee ? ' → ' + l.arrivee : ''}${l.numLiv ? ' ('+l.numLiv+')' : ''}`;
    sel.innerHTML += `<option value="${l.id}">${label}</option>`;
  });
}

function majDistanceKm() {
  const dep = parseFloat(document.getElementById('km-depart').value)||0;
  const arr = parseFloat(document.getElementById('km-arrivee').value)||0;
  const res = document.getElementById('km-result');
  const calc = document.getElementById('km-calcule');
  if (dep > 0 && arr > dep) {
    calc.textContent = (arr - dep).toFixed(0) + ' km';
    res.style.display = 'block';
  } else {
    res.style.display = 'none';
  }
}

function getKmStorageKey() {
  return 'km_sal_' + salarieCourant.id;
}

function getKmEntries() {
  return JSON.parse(localStorage.getItem(getKmStorageKey()) || '[]');
}

function saveKmEntries(list) {
  localStorage.setItem(getKmStorageKey(), JSON.stringify(list));
}

function getKmTourneeSelection() {
  const livId = document.getElementById('km-tournee-id')?.value || '';
  const livraisons = JSON.parse(localStorage.getItem('livraisons') || '[]');
  const liv = livId ? livraisons.find(l => l.id === livId) : null;
  return { livId, liv, livraisons };
}

function trouverReleveKmEnCours(date, livId) {
  const list = getKmEntries();
  const candidats = list
    .filter(e => e.date === date && !e.kmArrivee)
    .sort((a, b) => new Date(b.creeLe || b.date) - new Date(a.creeLe || a.date));
  if (!candidats.length) return null;
  if (livId) {
    const lie = candidats.find(e => e.livId === livId);
    if (lie) return lie;
  }
  return candidats[0];
}

function majLivraisonDepuisKm(livId, distance) {
  if (!livId || !distance) return;
  const livraisons = JSON.parse(localStorage.getItem('livraisons') || '[]');
  const idx = livraisons.findIndex(l => l.id === livId);
  if (idx === -1) return;
  livraisons[idx].distance = distance;
  livraisons[idx].profit = (livraisons[idx].prix || 0) - distance * 0.20;
  localStorage.setItem('livraisons', JSON.stringify(livraisons));
}

function rechargerBlocKm() {
  chargerHistoriqueKm();
  afficherAccueil();
}

function enregistrerKmDepart() {
  const dep  = parseFloat(document.getElementById('km-depart').value);
  const date = document.getElementById('km-date').value;
  const typeActif = window._kmTypeActif || 'livraison';
  let motifTrajet = '';
  if (typeActif === 'pro') {
    motifTrajet = document.getElementById('km-motif-pro')?.value?.trim() || '';
    if (!motifTrajet) {
      toast('⚠️ Précisez le motif du déplacement pro', 'error');
      return;
    }
  } else if (typeActif === 'autre') {
    motifTrajet = document.getElementById('km-motif-autre')?.value?.trim() || '';
    if (!motifTrajet) {
      toast('⚠️ Précisez le motif', 'error');
      return;
    }
  }
  const { livId, liv } = getKmTourneeSelection();

  if (!dep || !date) {
    toast('⚠️ Saisissez au moins la date et le km de début', 'error');
    return;
  }
  if (trouverReleveKmEnCours(date, livId)) {
    toast('⚠️ Un km début est déjà en attente de km fin pour cette journée', 'error');
    return;
  }

  const list = getKmEntries();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    salId: salarieCourant.id,
    salNom: salarieCourant.nom,
    kmDepart: dep,
    kmArrivee: null,
    distance: 0,
    date,
    livId: liv?.id || null,
    livNom: liv?.client || null,
    motifType: typeActif,
    motifTexte: motifTrajet,
    creeLe: new Date().toISOString()
  });
  saveKmEntries(list);
  mettreAJourKmVehiculeAffecte(dep);

  document.getElementById('km-arrivee').value = '';
  document.getElementById('km-result').style.display = 'none';
  rechargerBlocKm();
  // Griser le bouton départ, activer le bouton retour
  const btnDep = document.getElementById('btn-km-depart');
  const btnRet = document.getElementById('btn-km-retour');
  if (btnDep) {
    btnDep.style.background = '#1a2234';
    btnDep.style.color = '#5a6a85';
    btnDep.style.border = '1px solid #1e2a3d';
    btnDep.disabled = false;
  }
  if (btnRet) {
    btnRet.style.background = 'linear-gradient(135deg,#f5a623,#ff8c00)';
    btnRet.style.color = '#000';
    btnRet.style.border = 'none';
    btnRet.style.fontWeight = '800';
  }
  toast(liv ? `✅ Km début enregistré pour ${liv.client}` : '✅ Km début enregistré');
}

function enregistrerKmFin() {
  const arr  = parseFloat(document.getElementById('km-arrivee').value);
  const date = document.getElementById('km-date').value;
  const { livId, liv } = getKmTourneeSelection();
  const releve = trouverReleveKmEnCours(date, livId);

  if (!releve) {
    toast('⚠️ Enregistrez d’abord un km début avant le km fin', 'error');
    return;
  }
  if (!arr || arr <= (releve.kmDepart || 0)) {
    toast('⚠️ Le km de fin doit être supérieur au km de début', 'error');
    return;
  }

  const list = getKmEntries();
  const idx = list.findIndex(e => e.id === releve.id);
  if (idx === -1) return;

  const distance = arr - list[idx].kmDepart;
  list[idx].kmArrivee = arr;
  list[idx].distance = distance;
  if (livId && !list[idx].livId) {
    list[idx].livId = livId;
    list[idx].livNom = liv?.client || null;
  }
  saveKmEntries(list);
  mettreAJourKmVehiculeAffecte(arr);

  majLivraisonDepuisKm(list[idx].livId, distance);

  document.getElementById('km-depart').value = arr;
  document.getElementById('km-arrivee').value = '';
  document.getElementById('km-result').style.display = 'none';
  if (document.getElementById('km-tournee-id')) document.getElementById('km-tournee-id').value = '';

  rechargerBlocKm();
  const cible = list[idx].livNom || liv?.client;
  toast(cible ? `✅ ${distance.toFixed(0)} km enregistrés et liés à ${cible}` : `✅ ${distance.toFixed(0)} km enregistrés`);
}

function chargerHistoriqueKm() {
  const list = getKmEntries()
    .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe))
    .slice(0, 20);
  const cont = document.getElementById('historique-km');
  if (!list.length) { cont.innerHTML = '<div class="empty">Aucun relevé enregistré</div>'; return; }

  cont.innerHTML = list.map(e => {
    const modTag = e.modifie
      ? '<span style="font-size:.72rem;background:rgba(231,76,60,.15);color:#e74c3c;padding:1px 6px;border-radius:8px;margin-left:4px">✏️</span>'
      : '';
    const livTag = e.livNom
      ? `<span style="font-size:.74rem;background:rgba(79,142,247,.1);color:var(--blue);padding:1px 7px;border-radius:8px;margin-left:4px">📦 ${e.livNom}</span>`
      : '';
    const ligneKm = e.kmArrivee
      ? `${(e.kmDepart||0).toLocaleString('fr-FR')} → ${(e.kmArrivee||0).toLocaleString('fr-FR')} km`
      : `${(e.kmDepart||0).toLocaleString('fr-FR')} km · En attente du km fin`;
    const distanceLib = e.kmArrivee ? `${(e.distance||0).toFixed(0)} km` : 'En cours';
    return `<div class="hist-row">
      <span style="font-size:.85rem">${e.date}${modTag}${livTag}</span>
      <span style="color:var(--muted);font-size:.82rem">${ligneKm}</span>
      <strong style="color:var(--accent)">${distanceLib}</strong>
      <div class="menu-actions-wrap">
        <button class="btn-actions-open" onclick="event.stopPropagation();toggleMenuActions('km-${e.id}')">Actions ▾</button>
        <div class="menu-actions-dropdown" id="menu-actions-km-${e.id}">
          <button onclick="ouvrirEditKmSal('${e.id}')">✏️ Modifier</button>
          <button class="danger" onclick="supprimerKmSal('${e.id}')">🗑️ Supprimer</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function ouvrirEditKmSal(id) {
  const list = getKmEntries();
  const e = list.find(x => x.id === id);
  if (!e) return;
  document.getElementById('edit-km-id').value   = id;
  document.getElementById('edit-km-dep').value  = e.kmDepart;
  document.getElementById('edit-km-arr').value  = e.kmArrivee || '';
  document.getElementById('edit-km-date').value = e.date;
  document.getElementById('modal-edit-km-sal').classList.add('open');
}

function confirmerEditKmSal() {
  const id  = document.getElementById('edit-km-id').value;
  const dep = parseFloat(document.getElementById('edit-km-dep').value);
  const arrRaw = document.getElementById('edit-km-arr').value;
  const arr = arrRaw === '' ? null : parseFloat(arrRaw);
  const date= document.getElementById('edit-km-date').value;
  if (!dep) { toast('⚠️ Km début obligatoire', 'error'); return; }
  if (arr !== null && arr <= dep) { toast('⚠️ Km fin doit être > km début', 'error'); return; }

  const list = getKmEntries();
  const idx  = list.findIndex(e => e.id === id);
  if (idx === -1) return;

  const ancien = { dep: list[idx].kmDepart, arr: list[idx].kmArrivee };
  list[idx].kmDepart  = dep;
  list[idx].kmArrivee = arr;
  list[idx].distance  = arr !== null ? arr - dep : 0;
  list[idx].date      = date;
  list[idx].modifie   = true;
  saveKmEntries(list);
  if (arr !== null) mettreAJourKmVehiculeAffecte(arr);
  else mettreAJourKmVehiculeAffecte(dep);
  majLivraisonDepuisKm(list[idx].livId, list[idx].distance);

  const ancienDep = ancien.dep != null ? ancien.dep.toLocaleString('fr-FR') : '—';
  const ancienArr = ancien.arr != null ? ancien.arr.toLocaleString('fr-FR') : '—';
  const nouveauDep = dep.toLocaleString('fr-FR');
  const nouveauArr = arr != null ? arr.toLocaleString('fr-FR') : '—';

  // Alerte admin
  const alertes = JSON.parse(localStorage.getItem('alertes_admin') || '[]');
  alertes.push({
    id: Date.now().toString(36), type: 'km_modif',
    message: `Relevé km modifié par ${salarieCourant.nom} : ${ancienDep}→${ancienArr} km ✏️ ${nouveauDep}→${nouveauArr} km`,
    meta: { salNom: salarieCourant.nom, salId: salarieCourant.id },
    lu: false, traitee: false, creeLe: new Date().toISOString()
  });
  localStorage.setItem('alertes_admin', JSON.stringify(alertes));

  ajouterAlerteAdminModif('km', `Relevé km ${ancienDep}→${ancienArr} km ✏️ ${nouveauDep}→${nouveauArr} km`);
  fermerModal('modal-edit-km-sal');
  rechargerBlocKm();
  toast('✅ Relevé mis à jour — admin notifié');
}

function supprimerKmSal(id) {
  if (!confirm('Supprimer ce relevé ?')) return;
  const list = getKmEntries().filter(e => e.id !== id);
  saveKmEntries(list);
  rechargerBlocKm();
  toast('🗑️ Relevé supprimé');
}

/* ===== CARBURANT ===== */
function calculerPlein() {
  const l=parseFloat(document.getElementById('sal-litres').value)||0;
  const p=parseFloat(document.getElementById('sal-prix-litre').value)||0;
  const res=document.getElementById('plein-result');
  if(l>0&&p>0){document.getElementById('plein-total').textContent=(l*p).toFixed(2)+' €';res.style.display='block';}
  else{res.style.display='none';}
}

async function enregistrerPlein() {
  const litres = parseFloat(document.getElementById('sal-litres').value);
  const prixL = parseFloat(document.getElementById('sal-prix-litre').value);
  const date = document.getElementById('sal-carb-date').value;

  if (!litres || !prixL || !date) {
    toast('⚠️ Litres, prix et date obligatoires', 'error');
    return;
  }

  // Compresse la photo (max 1200px, JPEG quality 0.7) pour eviter les payloads enormes
  let photoBlob = null;
  let photoMime = null;
  let photoExt = 'jpg';
  const photoInput = document.getElementById('carb-photo');
  const photoFile = photoInput?.files?.[0];
  if (photoFile) {
    const out = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const max = 1200;
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            const r = Math.min(max/w, max/h);
            w = Math.round(w*r); h = Math.round(h*r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          // WebP si supporte (~30% plus leger), JPEG sinon
          if (window.DelivProStorage && window.DelivProStorage.canvasToOptimalBlob) {
            const r = await window.DelivProStorage.canvasToOptimalBlob(canvas, 0.78);
            resolve(r);
          } else {
            canvas.toBlob(b => resolve({ blob: b, mime: 'image/jpeg', ext: 'jpg' }), 'image/jpeg', 0.7);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(photoFile);
    });
    photoBlob = out.blob;
    photoMime = out.mime;
    photoExt = out.ext;
  }

  const veh = getMonVehicule();
  const libelle = libelleCarburant();
  const pleinId = Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  // Upload photo vers Supabase Storage si dispo, sinon offline-queue, sinon base64 local
  let photoRecuPath = null;
  let photoRecu = null;
  if (photoBlob) {
    if (window.DelivProStorage) {
      const path = `${pleinId}/${Date.now()}_recu.${photoExt}`;
      if (window.DelivProOfflineQueue) {
        const r = await window.DelivProOfflineQueue.uploadOrEnqueue({
          bucket: 'carburant-recus', path, blob: photoBlob, contentType: photoMime,
          meta: { kind: 'carburant-recu', salId: salarieCourant.id, pleinId }
        });
        if (r.ok) photoRecuPath = path;
        else console.warn('[carburant] upload+queue echoue, fallback base64:', r.error?.message);
      } else {
        const up = await window.DelivProStorage.uploadBlob('carburant-recus', path, photoBlob, { contentType: photoMime });
        if (up.ok) {
          photoRecuPath = path;
        } else {
          console.warn('[carburant] upload photo Storage echoue, fallback base64:', up.error?.message);
        }
      }
    }
    if (!photoRecuPath) {
      // Fallback : base64 local (compat offline sans queue)
      photoRecu = await new Promise(res => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.readAsDataURL(photoBlob);
      });
    }
  }

  const cle = 'carb_sal_' + salarieCourant.id;
  const pleins = JSON.parse(localStorage.getItem(cle) || '[]');
  const nouveauPlein = {
    id: pleinId,
    salId: salarieCourant.id,
    salNom: salarieCourant.nom,
    vehId: veh ? veh.id : '',
    vehNom: libelle,
    litres: litres,
    prixLitre: prixL,
    total: litres * prixL,
    date: date,
    photoRecu: photoRecu,
    photoRecuPath: photoRecuPath,
    photoRecuBucket: photoRecuPath ? 'carburant-recus' : null,
    source: 'salarie',
    creeLe: new Date().toISOString()
  };
  pleins.push(nouveauPlein);
  localStorage.setItem(cle, JSON.stringify(pleins));

  const carburantGlobal = JSON.parse(localStorage.getItem('carburant') || '[]');
  carburantGlobal.push(nouveauPlein);
  localStorage.setItem('carburant', JSON.stringify(carburantGlobal));

  document.getElementById('sal-litres').value = '';
  document.getElementById('sal-prix-litre').value = '';
  document.getElementById('plein-result').style.display = 'none';
  if (photoInput) photoInput.value = '';
  const label = document.getElementById('carb-photo-label');
  if (label) label.textContent = 'Photographier le ticket';
  const labelBox = document.querySelector('label[for=carb-photo]');
  if (labelBox) labelBox.style.borderColor = 'var(--border)';

  chargerHistoriqueCarburant();
  afficherAccueil();
  if (window.__syncRefresh) window.__syncRefresh();
  let toastMsg = '✅ Plein enregistré';
  if (photoRecuPath && !navigator.onLine) toastMsg += ' (reçu envoyé au retour réseau)';
  else if (photoRecu) toastMsg += ' (reçu sauvegardé localement)';
  else if (photoRecuPath) toastMsg += ' avec reçu';
  toast(toastMsg);
}

function supprimerPleinSal(id) {
  if (!confirm('Supprimer ce plein ?')) return;
  const cle  = `carb_sal_${salarieCourant.id}`;
  const perso = JSON.parse(localStorage.getItem(cle)||'[]').filter(p => p.id !== id);
  localStorage.setItem(cle, JSON.stringify(perso));
  // Supprimer aussi du global
  const global = JSON.parse(localStorage.getItem('carburant')||'[]').filter(p => p.id !== id);
  localStorage.setItem('carburant', JSON.stringify(global));
  chargerHistoriqueCarburant();
  afficherAccueil();
  toast('🗑️ Plein supprimé');
}

function ouvrirModifPlein(id) {
  const cle   = `carb_sal_${salarieCourant.id}`;
  const perso = JSON.parse(localStorage.getItem(cle)||'[]');
  const p     = perso.find(x => x.id===id); if(!p) return;
  document.getElementById('modif-plein-id').value   = id;
  document.getElementById('modif-litres').value     = p.litres;
  document.getElementById('modif-prix-litre').value = p.prixLitre;
  document.getElementById('modif-date').value       = p.date;
  document.getElementById('modal-modif-plein').classList.add('open');
}

function confirmerModifPlein() {
  const id        = document.getElementById('modif-plein-id').value;
  const litres    = parseFloat(document.getElementById('modif-litres').value);
  const prixLitre = parseFloat(document.getElementById('modif-prix-litre').value);
  const date      = document.getElementById('modif-date').value;
  if(!litres||!prixLitre||isNaN(litres)||isNaN(prixLitre)){toast('⚠️ Champs obligatoires','error');return;}
  const total = litres*prixLitre;
  const cle   = `carb_sal_${salarieCourant.id}`;
  const perso = JSON.parse(localStorage.getItem(cle)||'[]');
  const idx   = perso.findIndex(p => p.id===id);
  if(idx===-1){toast('⚠️ Plein introuvable','error');return;}
  const ancL=perso[idx].litres, ancT=perso[idx].total;
  perso[idx].litres=litres; perso[idx].prixLitre=prixLitre; perso[idx].total=total;
  perso[idx].date=date; perso[idx].modifie=true; perso[idx].modifieLe=new Date().toISOString();
  localStorage.setItem(cle,JSON.stringify(perso));
  // Global
  const global=JSON.parse(localStorage.getItem('carburant')||'[]');
  const gi=global.findIndex(p=>p.id===id);
  if(gi>-1){global[gi].litres=litres;global[gi].prixLitre=prixLitre;global[gi].total=total;global[gi].date=date;global[gi].modifie=true;global[gi].modifieLe=new Date().toISOString();localStorage.setItem('carburant',JSON.stringify(global));}
  // Alerte admin
  const alertes=JSON.parse(localStorage.getItem('alertes_admin')||'[]');
  alertes.push({id:Date.now().toString(36),type:'carburant_modif',
    message:`Plein modifié par ${salarieCourant.nom} : ${ancL}L / ${ancT.toFixed(2)}€ → ${litres}L / ${total.toFixed(2)}€`,
    meta:{salNom:salarieCourant.nom,salId:salarieCourant.id,pleinId:id},
    lu:false,traitee:false,creeLe:new Date().toISOString()});
  localStorage.setItem('alertes_admin',JSON.stringify(alertes));
  ajouterAlerteAdminModif('plein', `Plein carburant modifié : ${ancL}L / ${ancT.toFixed(2)}€ → ${litres}L / ${total.toFixed(2)}€`);
  fermerModal('modal-modif-plein');
  chargerHistoriqueCarburant();
  toast('✅ Plein modifié — admin notifié');
}

function chargerHistoriqueCarburant() {
  const cle = 'carb_sal_' + salarieCourant.id;
  const pleins = JSON.parse(localStorage.getItem(cle) || '[]')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);
  const cont = document.getElementById('historique-carburant');
  if (!cont) return;
  if (!pleins.length) {
    cont.innerHTML = '<div class="empty">Aucun plein enregistré</div>';
    return;
  }
  cont.innerHTML = pleins.map(p => {
    const date = p.date
      ? new Date(p.date + 'T00:00:00').toLocaleDateString('fr-FR',
          { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const aRecu = !!(p.photoRecu || p.photoRecuPath);
    return `
      <div style="
        display:flex;align-items:center;gap:12px;
        padding:12px 0;border-bottom:1px solid var(--border);
      ">
        <div style="flex:1">
          <div style="font-size:.88rem;font-weight:600;margin-bottom:2px">
            ${p.litres}L · ${p.prixLitre}€/L
          </div>
          <div style="font-size:.78rem;color:var(--muted)">${date}${aRecu ? ' · 📷' : ''}</div>
        </div>
        <div style="font-size:.95rem;font-weight:800;color:var(--accent);margin-right:8px">
          ${(p.litres * p.prixLitre).toFixed(2)} €
        </div>
        <div class="menu-actions-wrap">
          <button class="btn-actions-open" onclick="event.stopPropagation();toggleMenuActions('carb-${p.id}')">Actions ▾</button>
          <div class="menu-actions-dropdown" id="menu-actions-carb-${p.id}">
            ${aRecu ? `<button onclick="voirRecuSal('${p.id}')">👁️ Voir le ticket</button>` : ''}
            <button onclick="ouvrirModifPlein('${p.id}')">✏️ Modifier</button>
            <button class="danger" onclick="supprimerPleinSal('${p.id}')">🗑️ Supprimer</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Permet au salarie de re-consulter son propre ticket recu (signed URL si Storage, fallback base64)
async function voirRecuSal(pleinId) {
  const cle = 'carb_sal_' + salarieCourant.id;
  const pleins = JSON.parse(localStorage.getItem(cle) || '[]');
  const plein = pleins.find(p => p.id === pleinId);
  if (!plein) return;
  if (!plein.photoRecu && !plein.photoRecuPath) {
    toast('Aucun ticket pour ce plein', 'info');
    return;
  }
  let url = plein.photoRecu || '';
  if (!url && plein.photoRecuPath && window.DelivProStorage) {
    const bucket = plein.photoRecuBucket || 'carburant-recus';
    const signed = await window.DelivProStorage.getSignedUrl(bucket, plein.photoRecuPath, 600);
    if (!signed.ok) { toast('⚠️ Lien indisponible', 'error'); return; }
    url = signed.signedUrl;
  }
  if (!url) { toast('Ticket indisponible', 'info'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<button style="position:absolute;top:20px;right:20px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="this.parentElement.remove()">✕</button><img src="${url}" style="max-width:100%;max-height:100%;border-radius:8px" />`;
  document.body.appendChild(overlay);
}

/* ===== CHANGER MDP ===== */
async function changerMonMdp() {
  const ancien    = document.getElementById('chg-ancien').value;
  const nouveau   = document.getElementById('chg-nouveau').value;
  const confirmer = document.getElementById('chg-confirmer').value;
  if(!ancien||!nouveau||!confirmer){toast('⚠️ Remplissez tous les champs','error');return;}
  const security = window.DelivProSecurity || null;
  const ancienOk = security && typeof security.verifyPassword === 'function'
    ? await security.verifyPassword(ancien, salarieCourant.mdpHash)
    : (btoa(ancien) === salarieCourant.mdpHash);
  if(!ancienOk){toast('⚠️ Mot de passe actuel incorrect','error');return;}
  const evaluation = security && typeof security.evaluatePassword === 'function'
    ? security.evaluatePassword(nouveau, { minLength: 8 })
    : { ok: nouveau.length >= 8, message: 'Nouveau mot de passe trop court (8 min)' };
  if(!evaluation.ok){toast('⚠️ ' + evaluation.message,'error');return;}
  if(nouveau!==confirmer){toast('⚠️ Les nouveaux mots de passe ne correspondent pas','error');return;}
  if (sessionStorage.getItem('auth_mode') === 'supabase') {
    const client = window.DelivProSupabase && window.DelivProSupabase.getClient ? window.DelivProSupabase.getClient() : null;
    if (!client) { toast('⚠️ Client Supabase indisponible','error'); return; }
    const sessionResult = await client.auth.getSession();
    if (!sessionResult?.data?.session) { toast('⚠️ Session expirée, reconnectez-vous','error'); return; }
    const updateResult = await client.auth.updateUser({ password: nouveau });
    if (updateResult.error) { toast(`⚠️ Mot de passe Supabase non mis à jour (${updateResult.error.message})`,'error'); return; }
  }
  const salaries=JSON.parse(localStorage.getItem('salaries')||'[]');
  const idx=salaries.findIndex(s=>s.id===salarieCourant.id);
  const hashedPassword = security && typeof security.hashPassword === 'function'
    ? await security.hashPassword(nouveau)
    : btoa(nouveau);
  if(idx>-1){salaries[idx].mdpHash=hashedPassword;localStorage.setItem('salaries',JSON.stringify(salaries));salarieCourant.mdpHash=hashedPassword;}
  ['chg-ancien','chg-nouveau','chg-confirmer'].forEach(id=>document.getElementById(id).value='');
  toast(sessionStorage.getItem('auth_mode') === 'supabase' ? '✅ Mot de passe modifie et synchronise !' : '✅ Mot de passe modifie !');
}

/* ===== INSPECTION VÉHICULE ===== */
let _inspPhotos = [];

function getInspectionStorageHelper() {
  return window.DelivProSupabase && window.DelivProSupabase.getInspectionStorage
    ? window.DelivProSupabase.getInspectionStorage()
    : null;
}

function libererPhotosInspectionLocales() {
  _inspPhotos.forEach(photo => {
    if (photo && photo.previewUrl && photo.previewUrl.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(photo.previewUrl); } catch (_) {}
    }
  });
}

function reinitialiserPhotosInspection() {
  libererPhotosInspectionLocales();
  _inspPhotos = [];
}

function sanitiserSegmentStorage(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'inconnu';
}

function getInspectionStorageSalarieId() {
  if (sessionStorage.getItem('auth_mode') === 'supabase') {
    return sessionStorage.getItem('salarie_id')
      || salarieCourant?.supabaseId
      || '';
  }
  return salarieCourant?.supabaseId || salarieCourant?.id || '';
}

function formaterTailleFichierKo(tailleOctets) {
  const kilo = (Number(tailleOctets) || 0) / 1024;
  return `${Math.max(kilo, 1).toFixed(kilo >= 100 ? 0 : 1)} Ko`;
}

function decrireErreurUploadInspection(error) {
  const brut = String(error?.message || error?.error_description || error?.reason || error || '').trim();
  const texte = brut.toLowerCase();
  if (!texte) return "Stockage photo indisponible pour le moment.";
  if (texte.includes('missing_remote_salarie_id')) return "Le compte salarie distant n'est pas encore completement relie.";
  if (texte.includes('bucket') && texte.includes('not found')) return "Le coffre photo Supabase n'est pas encore configure.";
  if (texte.includes('row-level security') || texte.includes('403') || texte.includes('permission')) return "Les droits Supabase Storage des photos d'inspection ne sont pas encore actifs.";
  if (texte.includes('payload too large') || texte.includes('entity too large') || texte.includes('file size')) return "Les photos sont encore trop lourdes apres compression.";
  return brut;
}

/* Compresse une image via canvas — retourne un Blob JPEG + URL de prévisualisation */
function compresserImage(file, maxW, maxH, qualite, maxBytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const tenterCompression = (quality) => {
          canvas.toBlob(blob => {
            if (!blob) {
              reject(new Error('compression_failed'));
              return;
            }
            if (blob.size > (maxBytes || 380 * 1024) && quality > 0.4) {
              tenterCompression(Math.max(0.4, quality - 0.08));
              return;
            }
            resolve({
              blob: blob,
              previewUrl: URL.createObjectURL(blob),
              taille: blob.size
            });
          }, 'image/jpeg', quality);
        };
        tenterCompression(qualite);
      };
      img.onerror = () => reject(new Error('image_load_failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

async function preparerPhotoInspection(file) {
  const full = await compresserImage(file, 1600, 1200, 0.78, 520 * 1024);
  const thumb = await compresserImage(file, 520, 390, 0.58, 120 * 1024);
  return {
    blob: full.blob,
    previewUrl: full.previewUrl,
    taille: full.taille,
    thumbBlob: thumb.blob,
    thumbPreviewUrl: thumb.previewUrl,
    thumbTaille: thumb.taille
  };
}

// Retourne { src, path } pour l'affichage d'une miniature inspection.
// - photo string base64 (legacy local) -> { src: <data:...>, path: '' }
// - photo string URL publique (legacy) -> extrait le path -> { src: '', path }
// - photo objet { path, thumbPath } (nouveau format prive) -> { src: '', path: thumbPath }
// - photo objet { url, thumbUrl } (legacy) -> extrait le path
// Quand path est non vide, l'URL signee est resolue async via resolveStorageImages.
function getInspectionPhotoThumbDescriptor(photo) {
  if (!photo) return { src: '', path: '' };
  if (typeof photo === 'string') {
    if (/^data:image\//.test(photo)) return { src: photo, path: '' };
    // URL publique legacy -> extraire le path
    const helper = getInspectionStorageHelper();
    const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(photo) : '';
    return { src: '', path: path };
  }
  if (photo.thumbPath) return { src: '', path: photo.thumbPath };
  if (photo.path) return { src: '', path: photo.path };
  // Legacy : objet avec url publique
  const helper = getInspectionStorageHelper();
  const fallback = photo.thumbUrl || photo.url || '';
  if (/^data:image\//.test(fallback)) return { src: fallback, path: '' };
  const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(fallback) : '';
  return { src: '', path: path };
}

function getInspectionPhotoFullDescriptor(photo) {
  if (!photo) return { src: '', path: '' };
  if (typeof photo === 'string') {
    if (/^data:image\//.test(photo)) return { src: photo, path: '' };
    const helper = getInspectionStorageHelper();
    const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(photo) : '';
    return { src: '', path: path };
  }
  if (photo.path) return { src: '', path: photo.path };
  if (photo.thumbPath) return { src: '', path: photo.thumbPath };
  const helper = getInspectionStorageHelper();
  const fallback = photo.url || photo.thumbUrl || '';
  if (/^data:image\//.test(fallback)) return { src: fallback, path: '' };
  const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(fallback) : '';
  return { src: '', path: path };
}

// Conserves pour compat avec les appels existants (script.js renderInspections fallback).
// Retournent une chaine vide si la photo est privee (path uniquement) -
// le caller doit utiliser data-photo-path + resolveStorageImages.
function getInspectionPhotoThumbSrc(photo) {
  return getInspectionPhotoThumbDescriptor(photo).src;
}

function getInspectionPhotoFullSrc(photo) {
  return getInspectionPhotoFullDescriptor(photo).src;
}

async function uploaderPhotosInspection(date) {
  const storageHelper = getInspectionStorageHelper();
  if (!storageHelper) throw new Error('storage_unavailable');

  const salarieStorageId = getInspectionStorageSalarieId();
  const salarieSegment = sanitiserSegmentStorage(salarieStorageId);
  const dateSegment = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : aujourdhui();
  const baseTimestamp = Date.now();
  const uploadedPaths = [];
  const uploadedPhotos = [];

  if (!salarieStorageId) throw new Error('missing_remote_salarie_id');

  // Helper : tente upload immediat, sinon enqueue (offline). En offline,
  // on retourne le path "vise" + flag queued -> la photo sera uploadee au
  // retour reseau, mais l'inspection peut deja etre creee localement.
  async function uploadOuEnqueueInspection(targetPath, blob, kind) {
    if (window.DelivProOfflineQueue && (!navigator.onLine || !storageHelper)) {
      try {
        await window.DelivProOfflineQueue.enqueueUpload({
          bucket: 'inspections-photos', path: targetPath, blob: blob,
          contentType: 'image/jpeg',
          meta: { kind: 'inspection-photo', salId: salarieCourant.id, photoKind: kind }
        });
        return { ok: true, path: targetPath, queued: true };
      } catch (qErr) {
        // Si queue impossible (fallback localStorage sans blob), on retombe sur upload direct
      }
    }
    const r = await storageHelper.uploadInspectionPhoto(targetPath, blob);
    if (r && r.ok && r.path) return { ok: true, path: r.path, queued: false };
    // Erreur reseau -> tenter queue (si dispo)
    if (window.DelivProOfflineQueue) {
      try {
        await window.DelivProOfflineQueue.enqueueUpload({
          bucket: 'inspections-photos', path: targetPath, blob: blob,
          contentType: 'image/jpeg',
          meta: { kind: 'inspection-photo', salId: salarieCourant.id, photoKind: kind }
        });
        return { ok: true, path: targetPath, queued: true };
      } catch (_) {}
    }
    throw (r && r.error) || new Error('upload_failed');
  }

  try {
    for (let i = 0; i < _inspPhotos.length; i++) {
      const photo = _inspPhotos[i];
      const basePath = salarieSegment + '/' + dateSegment + '/' + baseTimestamp + '_' + i;
      const fullPath = basePath + '_full.jpg';
      const thumbPath = basePath + '_thumb.jpg';

      const fullResult = await uploadOuEnqueueInspection(fullPath, photo.blob, 'full');
      uploadedPaths.push(fullResult.path);

      const thumbResult = await uploadOuEnqueueInspection(thumbPath, photo.thumbBlob || photo.blob, 'thumb');
      uploadedPaths.push(thumbResult.path);

      // Bucket inspections-photos prive depuis migration 027 :
      // on ne stocke QUE les paths. Les URLs signees sont generees a l'affichage.
      uploadedPhotos.push({
        path: fullResult.path,
        thumbPath: thumbResult.path,
        taille: photo.taille || 0,
        thumbTaille: photo.thumbTaille || 0,
        queued: !!(fullResult.queued || thumbResult.queued)
      });
    }
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        await storageHelper.removeInspectionPhotos(uploadedPaths);
      } catch (_) {}
    }
    throw error;
  }

  return uploadedPhotos;
}

function gererPhotosInspection(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const preview = document.getElementById('insp-photos-preview');
  if (!preview) return;

  preview.innerHTML = '';

  const limited = files.slice(0, 4);
  if (files.length > 4) {
    toast('⚠️ Maximum 4 photos — seules les 4 premières sont conservées', 'error');
  }

  limited.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.style.cssText = `
        position:relative;width:72px;height:72px;
        border-radius:10px;overflow:hidden;
        border:2px solid var(--accent);
      `;
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      const badge = document.createElement('div');
      badge.style.cssText = `
        position:absolute;top:3px;right:3px;
        background:var(--accent);color:#000;
        border-radius:50%;width:18px;height:18px;
        font-size:.6rem;font-weight:800;
        display:flex;align-items:center;justify-content:center;
      `;
      badge.textContent = idx + 1;
      div.onclick = function() { ouvrirPhotoPleinEcran(e.target.result); };
      div.style.cursor = 'pointer';
      div.appendChild(img);
      div.appendChild(badge);
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });

  toast(`✅ ${limited.length} photo(s) sélectionnée(s)`);
}

function previsualiserPhotos() {
  const files = document.getElementById('insp-photos').files;
  const container = document.getElementById('insp-previews');
  reinitialiserPhotosInspection();
  container.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px">⏳ Chargement des photos...</div>';
  if (!files.length) { container.innerHTML = ''; return; }

  const max = Math.min(files.length, 4);
  const promesses = [];
  for (let i = 0; i < max; i++) {
    promesses.push(preparerPhotoInspection(files[i]));
  }

  Promise.all(promesses).then(resultats => {
    _inspPhotos = resultats;
    container.innerHTML = '';
    const tailleTotale = resultats.reduce((total, photo) => total + (photo.taille || 0) + (photo.thumbTaille || 0), 0);
    resultats.forEach((photo, i) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;aspect-ratio:4/3';
      div.innerHTML = `<img src="${photo.thumbPreviewUrl || photo.previewUrl}" style="width:100%;height:100%;object-fit:cover" />
        <button onclick="retirerPhoto(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:.75rem">✕</button>`;
      container.appendChild(div);
    });
    const label = document.getElementById('insp-label');
    if (label) { label.style.borderColor='rgba(46,204,113,.4)'; label.style.background='rgba(46,204,113,.06)'; }
    // Mettre à jour le statut
    const statut = document.getElementById('insp-statut');
    if (statut) {
      statut.style.display='block';
      statut.style.color='var(--green)';
      statut.textContent=`✅ ${resultats.length} photo(s) prêtes (${formaterTailleFichierKo(tailleTotale)}) — envoi cloud léger`;
    }
    toast(`✅ ${resultats.length} photo(s) compressée(s)`);
  }).catch(() => {
    container.innerHTML = '';
    const statut = document.getElementById('insp-statut');
    if (statut) { statut.style.display='block'; statut.style.color='var(--red)'; statut.textContent='⚠️ Erreur de chargement — réessayez'; }
    toast('⚠️ Erreur lors du chargement des photos', 'error');
  });
}

function retirerPhoto(idx) {
  const photo = _inspPhotos[idx];
  if (photo && photo.previewUrl && photo.previewUrl.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(photo.previewUrl); } catch (_) {}
  }
  if (photo && photo.thumbPreviewUrl && photo.thumbPreviewUrl.indexOf('blob:') === 0) {
    try { URL.revokeObjectURL(photo.thumbPreviewUrl); } catch (_) {}
  }
  _inspPhotos.splice(idx, 1);
  const container = document.getElementById('insp-previews');
  container.innerHTML = '';
  if (!_inspPhotos.length) {
    document.getElementById('insp-photos').value = '';
    const label = document.getElementById('insp-label');
    if (label) { label.style.borderColor='rgba(79,142,247,.3)'; label.style.background='rgba(79,142,247,.08)'; }
    return;
  }
  _inspPhotos.forEach((photoItem, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;aspect-ratio:4/3';
    div.innerHTML = `<img src="${photoItem.thumbPreviewUrl || photoItem.previewUrl}" style="width:100%;height:100%;object-fit:cover" />
      <button onclick="retirerPhoto(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:.75rem">✕</button>`;
    container.appendChild(div);
  });
}

async function soumettreInspection() {
  const photosInput = document.getElementById('insp-photos');
  const photosFiles = photosInput ? Array.from(photosInput.files || []) : [];
  const date = document.getElementById('insp-date')?.value;
  const km = document.getElementById('insp-km')?.value || '';
  const commentaire = document.getElementById('insp-commentaire')?.value || '';

  if (!date) {
    toast('⚠️ La date est obligatoire', 'error');
    return;
  }
  if (!km) {
    toast('⚠️ Le kilométrage est obligatoire', 'error');
    return;
  }
  if (!commentaire || !commentaire.trim()) {
    toast('⚠️ Le commentaire est obligatoire (mettez "RAS" si rien à signaler)', 'error');
    return;
  }
  if (!photosFiles.length) {
    toast('⚠️ Au moins une photo est requise', 'error');
    return;
  }

  // Convertir les photos en base64 compressé
  const photosBase64 = await Promise.all(photosFiles.slice(0, 4).map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const max = 1200;
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            const r = Math.min(max/w, max/h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }));

  // Si Supabase disponible, utiliser le pipeline cloud
  if (window.DelivProSupabase && window.DelivProSupabase.getInspectionStorage) {
    // Peupler _inspPhotos depuis les files pour envoyerInspection()
    reinitialiserPhotosInspection();
    const preparationsPhotos = photosFiles.slice(0, 4).map(f => preparerPhotoInspection(f));
    _inspPhotos = await Promise.all(preparationsPhotos);
    return envoyerInspection();
  }

  // Fallback local : stocker en base64
  const veh = getMonVehicule();
  const inspId = Date.now().toString(36);
  const inspection = {
    id: inspId,
    salId: salarieCourant.id, salNom: salarieCourant.nom,
    vehId: veh ? veh.id : '', vehImmat: veh ? veh.immat : 'Non affecté',
    date, km: km || null, commentaire,
    photos: photosBase64,
    creeLe: new Date().toISOString()
  };
  if (km) mettreAJourKmVehiculeAffecte(km);
  try {
    const toutes = JSON.parse(localStorage.getItem('inspections') || '[]');
    toutes.push(inspection);
    localStorage.setItem('inspections', JSON.stringify(toutes));
  } catch(e) {
    toast('⚠️ Mémoire insuffisante — réduisez le nombre de photos', 'error');
    return;
  }
  const alertes = JSON.parse(localStorage.getItem('alertes_admin') || '[]');
  alertes.push({
    id: inspId + 'i', type: 'inspection',
    message: `Inspection soumise par ${salarieCourant.nom} — ${veh ? veh.immat : 'sans véhicule'} (${date}) — ${photosBase64.length} photo(s)`,
    meta: { salNom: salarieCourant.nom, salId: salarieCourant.id, inspId },
    lu: false, traitee: false, creeLe: new Date().toISOString()
  });
  localStorage.setItem('alertes_admin', JSON.stringify(alertes));
  if (photosInput) photosInput.value = '';
  document.getElementById('insp-photos-preview').innerHTML = '';
  document.getElementById('insp-commentaire').value = '';
  document.getElementById('insp-km').value = '';
  chargerHistoriqueInspections();
  afficherAccueil();
  toast('✅ Inspection enregistrée !');
}

async function envoyerInspection() {
  const date  = document.getElementById('insp-date').value;
  const km    = document.getElementById('insp-km').value;
  const comm  = document.getElementById('insp-commentaire').value.trim();

  if (!_inspPhotos.length) { toast('⚠️ Ajoutez au moins une photo', 'error'); return; }
  if (!date) { toast('⚠️ Sélectionnez une date', 'error'); return; }

  const veh = getMonVehicule();
  const inspId = Date.now().toString(36);
  const bouton = document.querySelector('button[onclick="envoyerInspection()"]');

  if (bouton) bouton.disabled = true;
  const statut = document.getElementById('insp-statut');
  if (statut) {
    statut.style.display = 'block';
    statut.style.color = 'var(--blue)';
    statut.textContent = '☁️ Envoi des photos vers le cloud...';
  }

  let photoAssets = [];
  try {
    photoAssets = await uploaderPhotosInspection(date);
  } catch (error) {
    if (bouton) bouton.disabled = false;
    const messageErreur = decrireErreurUploadInspection(error);
    if (statut) {
      statut.style.display = 'block';
      statut.style.color = 'var(--red)';
      statut.textContent = `⚠️ ${messageErreur}`;
    }
    toast(`⚠️ ${messageErreur}`, 'error');
    return;
  }

  const inspection = {
    id: inspId,
    salId: salarieCourant.id, salNom: salarieCourant.nom,
    vehId: veh ? veh.id : '', vehImmat: veh ? veh.immat : 'Non affecté',
    date, km: km || null, commentaire: comm,
    photos: photoAssets,
    creeLe: new Date().toISOString()
  };
  if (km) mettreAJourKmVehiculeAffecte(km);

  // Sauvegarde locale légère : seules les URLs Supabase sont conservées
  try {
    const toutes = JSON.parse(localStorage.getItem('inspections') || '[]');
    toutes.push(inspection);
    localStorage.setItem('inspections', JSON.stringify(toutes));
  } catch(e) {
    const storageHelper = getInspectionStorageHelper();
    const photoPaths = photoAssets.flatMap(function(photo) {
      if (!photo || typeof photo === 'string') return [];
      return [photo.path, photo.thumbPath].filter(Boolean);
    });
    if (photoPaths.length && storageHelper && storageHelper.removeInspectionPhotos) {
      try { await storageHelper.removeInspectionPhotos(photoPaths); } catch (_) {}
    }
    if (bouton) bouton.disabled = false;
    if (statut) {
      statut.style.display = 'block';
      statut.style.color = 'var(--red)';
      statut.textContent = '⚠️ Sauvegarde locale impossible — inspection annulée';
    }
    toast('⚠️ Impossible de sauvegarder — mémoire du navigateur pleine', 'error');
    return;
  }

  // Alerte admin
  try {
    const alertes = JSON.parse(localStorage.getItem('alertes_admin') || '[]');
    alertes.push({
      id: inspId + 'i', type: 'inspection',
      message: `Inspection soumise par ${salarieCourant.nom} — ${veh ? veh.immat : 'sans véhicule'} (${date}) — ${_inspPhotos.length} photo(s)`,
      meta: { salNom: salarieCourant.nom, salId: salarieCourant.id, inspId },
      lu: false, traitee: false, creeLe: new Date().toISOString()
    });
    localStorage.setItem('alertes_admin', JSON.stringify(alertes));
  } catch(e) { /* non bloquant */ }

  // Reset formulaire
  reinitialiserPhotosInspection();
  document.getElementById('insp-photos').value = '';
  document.getElementById('insp-previews').innerHTML = '';
  document.getElementById('insp-commentaire').value = '';
  document.getElementById('insp-km').value = '';
  const label = document.getElementById('insp-label');
  if (label) { label.style.borderColor='rgba(79,142,247,.3)'; label.style.background='rgba(79,142,247,.08)'; }
  if (statut) { statut.style.display='none'; statut.textContent=''; }
  if (bouton) bouton.disabled = false;

  chargerHistoriqueInspections();
  const aQueued = (photoAssets || []).some(p => p && p.queued);
  toast(aQueued
    ? '✅ Inspection enregistree — photos envoyees au retour reseau'
    : '✅ Inspection envoyée à l\'administrateur !');
}

function chargerHistoriqueInspections() {
  const toutes = JSON.parse(localStorage.getItem('inspections') || '[]')
    .filter(i => i.salId === salarieCourant.id)
    .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe))
    .slice(0, 10);

  const cont = document.getElementById('historique-inspections');
  if (!toutes.length) { cont.innerHTML = '<div class="empty">Aucune inspection enregistrée</div>'; return; }

  cont.innerHTML = toutes.map(insp => {
    const photos = insp.photos || [];
    return `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:.9rem">🗓️ ${insp.date}</strong>
        <span style="font-size:.78rem;color:var(--muted)">${insp.vehImmat}${insp.km ? ' · ' + parseInt(insp.km).toLocaleString('fr-FR') + ' km' : ''}</span>
      </div>
      ${insp.commentaire ? `<p style="font-size:.83rem;color:var(--muted);margin-bottom:8px">💬 ${insp.commentaire}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(${Math.max(Math.min(photos.length,4), 1)},1fr);gap:6px">
        ${photos.map(p => {
          const thumb = getInspectionPhotoThumbDescriptor(p);
          const full = getInspectionPhotoFullDescriptor(p);
          // Si on a un path -> resolveStorageImages remplira src plus tard via signed URL.
          // Sinon (legacy base64 pur) -> src direct.
          const srcAttr = thumb.src ? `src="${thumb.src}"` : 'src="" alt="📷 chargement..."';
          const dataAttrs = thumb.path ? `data-photo-path="${thumb.path}" data-photo-bucket="inspections-photos"` : '';
          const onClick = full.src
            ? `voirPhotoPleinEcran('${full.src}')`
            : `ouvrirPhotoInspectionSal('${full.path}')`;
          return `<img ${srcAttr} ${dataAttrs} style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;cursor:pointer;background:rgba(0,0,0,0.05)" onclick="${onClick}" />`;
        }).join('')}
      </div>
      ${!photos.length && (insp.note_quota || insp.note_cleanup_storage) ? `<p style="font-size:.78rem;color:var(--orange);margin-top:8px">${insp.note_quota || insp.note_cleanup_storage}</p>` : ''}
    </div>`;
  }).join('');

  // Resoudre les signed URLs pour les photos en bucket prive
  if (window.resolveStorageImages) {
    window.resolveStorageImages(cont);
  }
}

// Ouvre une photo inspection salarie en plein ecran via signed URL fraiche
async function ouvrirPhotoInspectionSal(path) {
  if (!path) return;
  if (!window.DelivProStorage) return;
  const signed = await window.DelivProStorage.getSignedUrl('inspections-photos', path, 300);
  if (signed.ok && signed.signedUrl) voirPhotoPleinEcran(signed.signedUrl);
}

function voirPhotoPleinEcran(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:500;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:16px';
  overlay.innerHTML = `<button style="position:absolute;top:max(16px,env(safe-area-inset-top));right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border:none;color:#fff;font-size:1.3rem;cursor:pointer;z-index:10001;display:flex;align-items:center;justify-content:center;" onclick="this.parentElement.remove()">✕</button><img src="${src}" style="max-width:100%;max-height:100%;border-radius:8px;object-fit:contain" />`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

/* ===== MESSAGERIE SALARIÉ ===== */
function chargerMessagesSal() {
  const messages = JSON.parse(localStorage.getItem('messages_' + salarieCourant.id) || '[]');
  const fil = document.getElementById('msg-fil');
  const vide = document.getElementById('msg-vide');

  if (!messages.length) {
    if (vide) vide.style.display = 'block';
    return;
  }
  if (vide) vide.style.display = 'none';

  // Marquer les messages admin comme lus avec horodatage
  let modifie = false;
  messages.forEach(m => {
    if (m.auteur === 'admin' && !m.lu) {
      m.lu = true;
      m.luLe = new Date().toISOString();
      modifie = true;
    }
  });
  if (modifie) localStorage.setItem('messages_' + salarieCourant.id, JSON.stringify(messages));

  // Mettre à jour le badge
  mettreAJourBadgeMsgSal();

  fil.innerHTML = '';
  messages.forEach(m => {
    const estMoi = m.auteur === 'salarie';
    const div = document.createElement('div');
    div.style.cssText = `display:flex;flex-direction:column;align-items:${estMoi ? 'flex-end' : 'flex-start'}`;
    const heure = new Date(m.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    let contenuMsg;
    if (m.photoPath) {
      // Photo en Storage : placeholder + signed URL resolu apres render
      contenuMsg = `<img data-photo-path="${m.photoPath}" data-photo-bucket="${m.photoBucket || 'messages-photos'}" alt="📷 chargement..." style="max-width:180px;border-radius:8px;display:block;cursor:pointer;background:rgba(0,0,0,0.1);min-height:100px" onclick="ouvrirPhotoMessageSal('${m.photoPath}','${m.photoBucket || 'messages-photos'}')" />`;
    } else if (m.photo) {
      contenuMsg = `<img src="${m.photo}" style="max-width:180px;border-radius:8px;display:block;cursor:pointer" onclick="window.open('${m.photo}','_blank')" />`;
    } else {
      contenuMsg = m.texte;
    }
    div.innerHTML = `
      <div style="max-width:80%;background:${estMoi ? 'var(--accent)' : 'var(--card2)'};color:${estMoi ? '#000' : 'var(--text)'};padding:9px 13px;border-radius:${estMoi ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};font-size:.88rem;word-break:break-word">
          ${contenuMsg}
        </div>
      <span style="font-size:.72rem;color:var(--muted);margin-top:3px">${estMoi ? 'Moi' : '⚙️ Admin'} · ${heure}</span>`;
    fil.appendChild(div);
  });
  fil.scrollTop = fil.scrollHeight;
  // Resoudre les signed URLs pour les images en Storage
  if (window.DelivProStorage) {
    const imgs = fil.querySelectorAll('img[data-photo-path]:not([data-resolved])');
    for (const img of imgs) {
      const path = img.dataset.photoPath;
      const bucket = img.dataset.photoBucket || 'messages-photos';
      window.DelivProStorage.getSignedUrl(bucket, path, 600).then(s => {
        if (s.ok) { img.src = s.signedUrl; img.dataset.resolved = '1'; }
      });
    }
  }
}

// Ouvre une photo message en grand (signed URL fraiche)
async function ouvrirPhotoMessageSal(path, bucket) {
  if (!window.DelivProStorage) return;
  const signed = await window.DelivProStorage.getSignedUrl(bucket || 'messages-photos', path, 600);
  if (signed.ok && signed.signedUrl) window.open(signed.signedUrl, '_blank');
}

function envoyerMessageSal() {
  const input = document.getElementById('msg-input');
  const texte = input.value.trim();
  if (!texte) return;

  const messages = JSON.parse(localStorage.getItem('messages_' + salarieCourant.id) || '[]');
  messages.push({
    id: Date.now().toString(36),
    auteur: 'salarie', salNom: salarieCourant.nom,
    texte, lu: false, creeLe: new Date().toISOString()
  });
  localStorage.setItem('messages_' + salarieCourant.id, JSON.stringify(messages));

  // Badge admin (nouveau message non lu)
  const alertes = JSON.parse(localStorage.getItem('alertes_admin') || '[]');
  // Éviter les doublons d'alertes message non traité
  const dejaAlerte = alertes.find(a => a.type === 'message' && !a.traitee && a.meta?.salId === salarieCourant.id);
  if (!dejaAlerte) {
    alertes.push({
      id: Date.now().toString(36) + 'm',
      type: 'message',
      message: `Nouveau message de ${salarieCourant.nom}`,
      meta: { salNom: salarieCourant.nom, salId: salarieCourant.id },
      lu: false, traitee: false, creeLe: new Date().toISOString()
    });
    localStorage.setItem('alertes_admin', JSON.stringify(alertes));
  }

  input.value = '';
  chargerMessagesSal();
  if (window.__syncRefresh) window.__syncRefresh();
}

function mettreAJourBadgeMsgSal() {
  if (!salarieCourant) return;
  const messages = JSON.parse(localStorage.getItem('messages_' + salarieCourant.id) || '[]');
  const nonLus = messages.filter(m => m.auteur === 'admin' && !m.lu).length;

  // Son + vibration si nouveau message non lu
  const ancienCount = parseInt(window._prevNonLusSal||0);
  if (nonLus > ancienCount) {
    // Son de notification
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.35);
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }
  window._prevNonLusSal = nonLus;

  // Badge sur l'onglet Messages
  const badgeMsg = document.getElementById('badge-msg-sal');
  if (badgeMsg) {
    badgeMsg.textContent = nonLus;
    badgeMsg.style.display = nonLus > 0 ? 'inline-flex' : 'none';
    badgeMsg.style.alignItems = 'center';
    badgeMsg.style.justifyContent = 'center';
    badgeMsg.style.minWidth = '18px';
    badgeMsg.style.height = '18px';
  }

  // Badge sur l'onglet Accueil (combiné tâches + messages)
  const tachesNonFaites = parseInt(document.getElementById('badge-accueil')?.textContent || '0');
  const badgeAcc = document.getElementById('badge-accueil');
  if (badgeAcc) {
    const total = tachesNonFaites + nonLus;
    badgeAcc.textContent = total > 0 ? total : '';
    badgeAcc.style.display = total > 0 ? 'inline-block' : 'none';
  }

  // Notif dot sur le bouton profil si messages non lus
  const dot = document.getElementById('notif-dot');
  if (dot && nonLus > 0) dot.classList.add('visible');
}

/* ===== MODALS & TOAST ===== */
function fermerModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-overlay'))fermerModal(e.target.id);});

function toast(msg, type='success') {
  const el=document.getElementById('toast-sal');
  el.textContent=msg; el.className='toast show'+(type==='error'?' error':'');
  setTimeout(()=>{el.className='toast';},3200);
}

document.addEventListener('DOMContentLoaded', async function () {
  if (window.DelivProSecurity && typeof window.DelivProSecurity.registerServiceWorker === 'function') {
    window.DelivProSecurity.registerServiceWorker().catch(function () {});
  }
  const embedAutorise = !!(window.top && window.top !== window && window.top.__delivproTabUnlocked);

  // Vérifier le ticket tab_auth dans l'URL (posé par login.html)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tabTicket = urlParams.get('tab_auth');
    const pendingTicket = sessionStorage.getItem('delivpro_tab_auth_pending');
    if (tabTicket && tabTicket === pendingTicket) {
      window.__delivproTabUnlocked = true;
      sessionStorage.removeItem('delivpro_tab_auth_pending');
      // Nettoyer l'URL pour ne pas laisser le ticket visible
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  } catch(_) {}

  // Si pas de ticket valide, tenter restauration Supabase
  // AVANT de rediriger (pour les nouveaux appareils avec session valide)
  if (!embedAutorise && !window.__delivproTabUnlocked) {
    let supabaseSessionValide = false;
    if (window.DelivProAuth) {
      try {
        const restored = window.DelivProAuth.restoreLegacySessionFromSupabase
          ? await window.DelivProAuth.restoreLegacySessionFromSupabase('salarie')
          : await window.DelivProAuth.ensureSalarieLegacySessionFromSupabase();
        if (restored === 'salarie' || restored === true) {
          supabaseSessionValide = true;
          window.__delivproTabUnlocked = true;
          sessionStorage.setItem('auth_mode', 'supabase');
        }
      } catch(_) {}
    }

    // Si aucune session Supabase valide, redirection login
    if (!supabaseSessionValide) {
      try { sessionStorage.setItem('delivpro_debug_redirect', 'guard: pas de ticket ni session Supabase @ ' + new Date().toLocaleTimeString()); } catch(_) {}
      if (window.top && window.top !== window) {
        window.top.location.href = 'login.html';
        return;
      }
      sessionStorage.removeItem('role');
      sessionStorage.removeItem('auth_mode');
      sessionStorage.removeItem('salarie_id');
      sessionStorage.removeItem('salarie_numero');
      sessionStorage.removeItem('delivpro_fast_boot_role');
      window.location.href = 'login.html';
      return;
    }
  }
  const fastBootRole = sessionStorage.getItem('delivpro_fast_boot_role');
  if (fastBootRole === 'salarie') {
    sessionStorage.removeItem('delivpro_fast_boot_role');
  } else if (embedAutorise) {
    // L'iframe embarquée vit dans un onglet déjà autorisé, pas besoin de restaurer une session séparée.
  } else if (window.DelivProAuth) {
    try {
      const restored = window.DelivProAuth.restoreLegacySessionFromSupabase
        ? await window.DelivProAuth.restoreLegacySessionFromSupabase('salarie')
        : await window.DelivProAuth.ensureSalarieLegacySessionFromSupabase();

      // Si restauration réussie, mettre à jour auth_mode
      if (restored === 'salarie' || restored === true) {
        sessionStorage.setItem('auth_mode', 'supabase');
      }
    } catch(_) {}
  }
  const role = sessionStorage.getItem('role');
  const salarieId = sessionStorage.getItem('salarie_id');
  const salarieNumero = sessionStorage.getItem('salarie_numero');
  const authMode = sessionStorage.getItem('auth_mode');

  // Fonction pour charger le salarié depuis Supabase si localStorage vide
  async function chargerSalarieDepuisSupabase() {
    if (!window.DelivProSupabase || !window.DelivProSupabase.getClient) return null;
    const client = window.DelivProSupabase.getClient();
    if (!client) return null;
    try {
      let query = client.from('salaries')
        .select('id, numero, nom, prenom, poste, email, actif, telephone, profile_id')
        .eq('actif', true)
        .limit(1);
      if (salarieId) query = query.or(`id.eq.${salarieId},profile_id.eq.${salarieId}`);
      else if (salarieNumero) query = query.eq('numero', salarieNumero.toUpperCase());
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      // Reconstruire un objet salarié compatible avec le format local
      return {
        id: data.id,
        supabaseId: data.id,
        profileId: data.profile_id,
        numero: data.numero,
        nom: [data.prenom, data.nom].filter(Boolean).join(' ') || data.numero,
        nomFamille: data.nom,
        prenom: data.prenom,
        poste: data.poste,
        email: data.email,
        tel: data.telephone,
        actif: data.actif !== false
      };
    } catch(_) { return null; }
  }

  let salaries = JSON.parse(localStorage.getItem('salaries') || '[]');

  if (role === 'salarie' && (salarieId || salarieNumero)) {
    let sal = salaries.find(function (item) {
      return item.id === salarieId || item.numero === salarieNumero;
    });

    // Si pas trouvé en local ET auth Supabase → charger depuis Supabase
    if (!sal && authMode === 'supabase') {
      sal = await chargerSalarieDepuisSupabase();
      if (sal) {
        // Sauvegarder en local pour les prochaines fois
        salaries.push(sal);
        try { localStorage.setItem('salaries', JSON.stringify(salaries)); } catch(_) {}
      }
    }

    if (sal && sal.actif) {
      if (sessionStorage.getItem('auth_mode') === 'supabase' && salarieId) {
        sal.supabaseId = salarieId;
        try {
          const idx = salaries.findIndex(function(item) { return item.id === sal.id; });
          if (idx > -1) {
            salaries[idx].supabaseId = salarieId;
            localStorage.setItem('salaries', JSON.stringify(salaries));
          }
        } catch (_) {}
      }
      salarieCourant = sal;
      lancerInterface();
      resetTimerInactiviteSalarie();
      if (window.DelivProRemoteStorage && window.DelivProRemoteStorage.init && sessionStorage.getItem('auth_mode') === 'supabase') {
        window.DelivProRemoteStorage.init().then(function(syncInitResult) {
          if (!syncInitResult?.ok) {
            toast('⚠️ Session Supabase absente: mode local, synchro inactive.', 'error');
          }
        }).catch(function() {
          toast('⚠️ Synchro distante indisponible.', 'error');
        });
      }
      return;
    }
  }

  try { sessionStorage.setItem('delivpro_debug_redirect', 'fallthrough: salarié introuvable (role=' + role + ', id=' + salarieId + ', num=' + salarieNumero + ', authMode=' + authMode + ') @ ' + new Date().toLocaleTimeString()); } catch(_) {}
  if (window.top && window.top !== window) {
    window.top.location.href = 'login.html';
    return;
  }
  window.location.href = 'login.html';
});

/* ===== BOUTONS KM ===== */
function initEtatBoutonsKm() {
  const auj = new Date().toISOString().split('T')[0];
  if (!salarieCourant) return;
  const entries = JSON.parse(
    localStorage.getItem('km_sal_'+salarieCourant.id)||'[]'
  );
  const entreeAuj = entries.find(e =>
    e.date === auj &&
    e.kmDepart != null &&
    e.kmDepart !== ''
  );
  const btnDepart = document.getElementById('btn-km-depart');
  const btnRetour = document.getElementById('btn-km-retour');
  if (!btnDepart || !btnRetour) return;

  if (entreeAuj && !entreeAuj.kmArrivee) {
    btnRetour.style.cssText = `
      flex:1;
      background:linear-gradient(135deg,#f5a623,#ff8c00);
      color:#000;border:none;border-radius:14px;
      padding:17px;font-size:1rem;font-weight:800;
      cursor:pointer;
    `;
    btnDepart.style.cssText = `
      flex:1;
      background:#1a2234;color:#e8f0ff;
      border:1px solid #1e2a3d;border-radius:14px;
      padding:17px;font-size:.95rem;font-weight:600;
      cursor:pointer;
    `;
  } else {
    btnDepart.style.cssText = `
      flex:1;
      background:linear-gradient(135deg,#f5a623,#ff8c00);
      color:#000;border:none;border-radius:14px;
      padding:17px;font-size:1rem;font-weight:800;
      cursor:pointer;
    `;
    btnRetour.style.cssText = `
      flex:1;
      background:#1a2234;color:#e8f0ff;
      border:1px solid #1e2a3d;border-radius:14px;
      padding:17px;font-size:.95rem;font-weight:600;
      cursor:pointer;
    `;
  }
}

/* ===== MOBILE ===== */
function isMobile() { return window.innerWidth <= 768; }

function initMobile() {
  const nav = document.getElementById('bottom-nav');
  const tabs = document.querySelector('.tabs-wrapper');
  if (!nav) return;
  const appActive = document.getElementById('ecran-salarie')?.classList.contains('actif');
  if (!appActive) {
    nav.style.display = 'none';
    return;
  }
  if (isMobile()) {
    nav.style.display = 'block';
    if (tabs) tabs.style.display = 'none';
  } else {
    nav.style.display = 'none';
    if (tabs) tabs.style.display = 'block';
  }
}

function changerOngletMobile(nom, btnNav) {
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  const map = {
    accueil: 'bn-accueil',
    livraisons: 'bn-livraisons',
    inspection: 'bn-inspection',
    carburant: 'bn-carburant',
    messages: 'bn-messages',
    planning: 'bn-planning',
    profil: 'bn-profil'
  };
  const actif = document.getElementById(map[nom]);
  if (actif) actif.classList.add('active');

  const ms = document.getElementById('main-scroll');
  if (ms) ms.scrollTop = 0;

  changerOnglet(nom, null);
}


function majBadgesBottomNav() {
  if (!salarieCourant) return;
  const msgs = JSON.parse(localStorage.getItem('messages_' + salarieCourant.id) || '[]');
  const nonLus = msgs.filter(m => m.auteur === 'admin' && !m.lu).length;
  const bMsg = document.getElementById('bn-badge-messages');
  const bMsgAction = document.getElementById('badge-msg-action');
  if (bMsg) { bMsg.textContent = nonLus || ''; bMsg.classList.toggle('visible', nonLus > 0); }
  if (bMsgAction) { bMsgAction.textContent = nonLus || ''; bMsgAction.style.display = nonLus > 0 ? 'inline' : 'none'; }
}

function initOfflineDetection() {
  const banner = document.getElementById('offline-banner');
  const queueBadge = document.getElementById('offline-queue-badge');
  const dot = document.getElementById('online-dot');
  let pendingCount = 0;

  const renderBanner = () => {
    if (banner) {
      const offline = !navigator.onLine;
      let msg = '';
      if (offline && pendingCount > 0) msg = `📵 Hors ligne — ${pendingCount} saisie(s) en attente de sync`;
      else if (offline) msg = '📵 Hors ligne — synchronisation au retour réseau';
      else if (pendingCount > 0) msg = `🔄 ${pendingCount} saisie(s) en cours de synchronisation...`;
      banner.textContent = msg;
      banner.classList.toggle('visible', offline || pendingCount > 0);
      document.body.classList.toggle('online-with-queue', !offline && pendingCount > 0);
    }
    if (queueBadge) {
      queueBadge.textContent = pendingCount > 0 ? String(pendingCount) : '';
      queueBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
    if (dot) {
      dot.style.background = navigator.onLine ? 'var(--green, #2ecc71)' : 'var(--red, #e74c3c)';
      dot.title = navigator.onLine
        ? (pendingCount > 0 ? `En ligne — ${pendingCount} en sync` : 'En ligne')
        : 'Hors ligne';
    }
  };

  window.addEventListener('online', renderBanner);
  window.addEventListener('offline', renderBanner);

  if (window.DelivProOfflineQueue) {
    window.DelivProOfflineQueue.onChange(function (n) {
      pendingCount = n;
      renderBanner();
    });
    window.DelivProOfflineQueue.count().then(function (n) {
      pendingCount = n;
      renderBanner();
    });
    // Toast au retour reseau si qqch en queue
    window.addEventListener('online', function () {
      if (pendingCount > 0) {
        toast(`🔄 Sync en cours (${pendingCount} saisies)...`, 'success');
      }
    });
    // Toast quand entry flushed
    window.addEventListener('delivpro:offline-queue:flushed', function () {
      window.DelivProOfflineQueue.count().then(function (n) {
        if (n === 0 && pendingCount > 0) {
          toast('✅ Synchronisation terminée');
        }
        pendingCount = n;
        renderBanner();
      });
    });
  }
  setTimeout(renderBanner, 800);
}

/* PWA */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const card = document.getElementById('pwa-install-card');
  if (card) card.style.display = 'block';
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (card) card.style.display = 'none';
  };
});

function initAccueilDate() {
  const el = document.getElementById('accueil-date');
  if (!el) return;
  const opts = { weekday:'long', day:'numeric', month:'long', year:'numeric' };
  el.textContent = new Date().toLocaleDateString('fr-FR', opts);
}

function initAccueilBonjour() {
  const el = document.getElementById('accueil-bonjour');
  if (!el || !salarieCourant) return;
  const h = new Date().getHours();
  const salut = (h >= 5 && h < 12) ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const prenom = salarieCourant.prenom || salarieCourant.nom?.split(' ')[0] || '';
  el.textContent = `${salut} ${prenom} 👋`;
}

function ajouterAlerteAdminModif(type, details) {
  const alertes = JSON.parse(localStorage.getItem('alertes_admin') || '[]');
  alertes.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    type: 'modif_salarie',
    sousType: type,
    salId: salarieCourant.id,
    salNom: salarieCourant.nom,
    message: `✏️ ${salarieCourant.nom} a modifié : ${details}`,
    details: details,
    lu: false,
    traitee: false,
    creeLe: new Date().toISOString()
  });
  localStorage.setItem('alertes_admin', JSON.stringify(alertes));
}

function ouvrirPhotoPleinEcran(src) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-fullscreen';
  overlay.onclick = function(e) {
    if (e.target === overlay) overlay.remove();
  };
  overlay.innerHTML = `
    <button class="photo-fullscreen-close" onclick="this.parentElement.remove()">✕</button>
    <img src="${src}" />
  `;
  document.body.appendChild(overlay);
}

function toggleMenuActions(id) {
  document.querySelectorAll('.menu-actions-dropdown').forEach(m => {
    if (m.id !== 'menu-actions-' + id) m.classList.remove('open');
  });
  const menu = document.getElementById('menu-actions-' + id);
  if (menu) menu.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.menu-actions-wrap')) {
    document.querySelectorAll('.menu-actions-dropdown')
      .forEach(m => m.classList.remove('open'));
  }
});

function changerTypeTrajet(type) {
  document.querySelectorAll('.pill-type').forEach(p =>
    p.classList.toggle('active', p.dataset.type === type));
  document.getElementById('km-type-livraison-block').style.display =
    type === 'livraison' ? 'block' : 'none';
  document.getElementById('km-type-pro-block').style.display =
    type === 'pro' ? 'block' : 'none';
  document.getElementById('km-type-autre-block').style.display =
    type === 'autre' ? 'block' : 'none';
  window._kmTypeActif = type;
}
window._kmTypeActif = 'livraison';

window.addEventListener('resize', initMobile);
window.addEventListener('DOMContentLoaded', () => {
  initMobile();
  initOfflineDetection();
  initAccueilDate();
});

/* ========== SYNCHRONISATION POLLING INTELLIGENT ========== */
(function() {
  let pollInterval = null;
  let pollDelay = 3000;
  let isActive = true;
  let lastHashes = {};

  function hashData(key) {
    const raw = localStorage.getItem(key) || '';
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  function detecterChangements() {
    if (!salarieCourant) return;

    const cles = [
      'livraisons',
      'plannings',
      'absences_periodes',
      'vehicules',
      'messages_' + salarieCourant.id,
      'notifs_sal_' + salarieCourant.id
    ];

    cles.forEach(cle => {
      const h = hashData(cle);
      if (lastHashes[cle] !== undefined && lastHashes[cle] !== h) {
        if (cle === 'livraisons') { chargerLivraisons(); afficherAccueil(); }
        if (cle === 'plannings' || cle === 'absences_periodes') { afficherPlanningSal(); afficherAccueil(); }
        if (cle === 'vehicules') { afficherAccueil(); }
        if (cle.startsWith('messages_')) { chargerMessagesSal(); mettreAJourBadgeMsgSal && mettreAJourBadgeMsgSal(); }
        if (cle.startsWith('notifs_sal_')) { verifierNotifs && verifierNotifs(); }
      }
      lastHashes[cle] = h;
    });
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(detecterChangements, pollDelay);
  }

  function stopPolling() {
    if (pollInterval) clearInterval(pollInterval);
  }

  document.addEventListener('visibilitychange', function() {
    isActive = !document.hidden;
    pollDelay = isActive ? 3000 : 30000;
    if (isActive) { detecterChangements(); startPolling(); }
    else { startPolling(); }
  });

  setTimeout(function() {
    if (typeof salarieCourant !== 'undefined' && salarieCourant) {
      detecterChangements();
      startPolling();
    } else {
      setTimeout(arguments.callee, 1000);
    }
  }, 2000);

  window.__syncRefresh = detecterChangements;
})();

/* Fix hauteur viewport dynamique Safari iOS */
function majHauteurViewport() {
  const vh = window.innerHeight;
  document.documentElement.style.setProperty(
    '--visual-vh', vh + 'px'
  );
}

majHauteurViewport();
window.addEventListener('resize', majHauteurViewport);
window.addEventListener('orientationchange', majHauteurViewport);

// Sur iOS, quand la barre Safari se masque/apparaît
let lastHeight = window.innerHeight;
setInterval(() => {
  if (window.innerHeight !== lastHeight) {
    lastHeight = window.innerHeight;
    majHauteurViewport();
  }
}, 500);
