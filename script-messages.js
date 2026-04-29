/**
 * MCA Logistics — Module Messages
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L5324 (script.js d'origine)
function afficherMessagerie() {
  const salaries = charger('salaries');
  const liste    = document.getElementById('msg-liste-salaries');
  if (!liste) return;

  // Initialiser le select poste du broadcast
  const selPoste = document.getElementById('broadcast-poste');
  if (selPoste && selPoste.options.length <= 1) {
    const postes = getPostes();
    postes.forEach(p => { selPoste.innerHTML += `<option value="${p}">${p}</option>`; });
  }

  if (!salaries.length) {
    liste.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:.85rem">Aucun salarié</div>';
    return;
  }

  liste.innerHTML = salaries.filter(s=>s.actif).map(s => {
    const messages = loadSafe('messages_' + s.id, []);
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
        ${dernier ? `<div style="font-size:.76rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${dernier.auteur==='admin'?'Vous : ':''}${dernier.texte.substring(0,40)}${dernier.texte.length>40?'…':''}</div>` : '<div style="font-size:.76rem;color:var(--text-muted)">Aucun message</div>'}
      </div>
      <button onclick="event.stopPropagation();supprimerConversation('${s.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.85rem;padding:4px;opacity:.4;transition:opacity .2s" onmouseover="this.style.opacity='1';this.style.color='var(--red)'" onmouseout="this.style.opacity='.4';this.style.color='var(--text-muted)'" title="Supprimer la conversation">🗑️</button>
    </div>`;
  }).join('');

  mettreAJourBadgeMsgAdmin();
}

// L5364 (script.js d'origine)
async function supprimerConversation(salId) {
  const sal = charger('salaries').find(s=>s.id===salId);
  const ok = await confirmDialog(`Supprimer la conversation avec ${sal?.nom||'ce salarié'} ?`, {titre:'Supprimer conversation',icone:'💬',btnLabel:'Supprimer'});
  if (!ok) return;
  localStorage.removeItem('messages_'+salId);
  if (_msgSalarieActif === salId) {
    _msgSalarieActif = null;
    document.getElementById('msg-admin-nom').textContent = 'Sélectionnez un salarié';
    document.getElementById('msg-admin-nom').style.color = 'var(--text-muted)';
    document.getElementById('msg-admin-fil').innerHTML = '<div style="text-align:center;color:var(--text-muted);margin:auto;font-size:.88rem">← Choisissez une conversation</div>';
    document.getElementById('msg-admin-input').disabled = true;
    document.getElementById('btn-envoyer-admin').disabled = true;
  }
  afficherMessagerie();
  afficherToast('🗑️ Conversation supprimée');
}

// L5382 (script.js d'origine)
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
        <input type="text" id="broadcast-search-sal" placeholder="🔍 Rechercher un salarié..." oninput="filtrerBroadcastSalaries()" style="width:100%;background:var(--bg-dark);border:1px solid var(--border);color:var(--text-primary);padding:7px 12px;border-radius:8px;font-size:.85rem;margin-bottom:8px" />
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

// L5410 (script.js d'origine)
function filtrerBroadcastSalaries() {
  const q = document.getElementById('broadcast-search-sal')?.value.toLowerCase() || '';
  document.querySelectorAll('.broadcast-sal-label').forEach(el => {
    el.style.display = el.dataset.nom.includes(q) ? 'flex' : 'none';
  });
}

// L5417 (script.js d'origine)
function majBroadcastCount() {
  const countEl = document.getElementById('broadcast-count');
  const nb = getBroadcastDestinataires().length;
  if (countEl) countEl.textContent = nb > 0 ? `${nb} destinataire${nb>1?'s':''}` : '';
}

// L5423 (script.js d'origine)
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

// L5438 (script.js d'origine)
function ouvrirConversation(salId) {
  // Marquer tous les messages salarie→admin comme lus
  const msgs = loadSafe('messages_'+salId, []);
  let changed = false;
  msgs.forEach(m => { if (m.auteur==='salarie' && !m.lu) { m.lu=true; m.luLe=new Date().toISOString(); changed=true; } });
  if (changed) localStorage.setItem('messages_'+salId, JSON.stringify(msgs));
  _msgSalarieActif = salId;
  const salaries = charger('salaries');
  const sal = salaries.find(s => s.id === salId);
  const messages = loadSafe('messages_' + salId, []);

  // Marquer les messages salarié comme lus
  let modifie = false;
  messages.forEach(m => { if (m.auteur === 'salarie' && !m.lu) { m.lu = true; modifie = true; } });
  if (modifie) localStorage.setItem('messages_' + salId, JSON.stringify(messages));

  // Header
  document.getElementById('msg-admin-nom').textContent = sal ? `👤 ${sal.nom} — ${sal.numero}` : 'Salarié';
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
    fil.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin:auto;font-size:.85rem">Démarrez la conversation</div>';
  } else {
    fil.innerHTML = '';
    messages.forEach((m, i) => {
      const estAdmin = m.auteur === 'admin';
      const div = document.createElement('div');
      div.style.cssText = `display:flex;flex-direction:column;align-items:${estAdmin ? 'flex-end' : 'flex-start'}`;
      const heure = new Date(m.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      // Accusé de lecture : dernier message admin + lu par salarié
      const estDernierAdmin = estAdmin && messages.slice(i+1).every(mm => mm.auteur !== 'admin');
      const accuse = estAdmin && estDernierAdmin && m.lu
        ? `<span class="msg-double-check" title="Lu le ${m.luLe ? new Date(m.luLe).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ''}">✓✓</span>`
        : estAdmin ? '<span style="font-size:.68rem;color:var(--text-muted);opacity:.5">✓</span>' : '';
      let contenuMsgAdmin;
      if (m.photoPath) {
        contenuMsgAdmin = `<img data-photo-path="${m.photoPath}" data-photo-bucket="${m.photoBucket || 'messages-photos'}" alt="📷 chargement..." style="max-width:200px;border-radius:8px;display:block;cursor:pointer;background:rgba(0,0,0,0.1);min-height:120px" onclick="ouvrirPhotoMessageAdmin('${m.photoPath}','${m.photoBucket || 'messages-photos'}')" />`;
      } else if (m.photo) {
        contenuMsgAdmin = `<img src="${m.photo}" style="max-width:200px;border-radius:8px;display:block;cursor:pointer" onclick="ouvrirPopupSecure('${m.photo}','_blank')" />`;
      } else {
        contenuMsgAdmin = m.texte;
      }
      div.innerHTML = `
        <div style="max-width:75%;background:${estAdmin ? 'var(--accent)' : 'var(--bg-dark)'};color:${estAdmin ? '#000' : 'var(--text-primary)'};padding:9px 13px;border-radius:${estAdmin ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};font-size:.88rem;word-break:break-word">
          ${contenuMsgAdmin}
          ${m.fichier ? `<a href="${m.fichier}" download="${m.nomFichier||'fichier'}" style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(79,142,247,0.1);border:1px solid rgba(79,142,247,0.3);border-radius:10px;color:var(--blue);text-decoration:none;font-size:.85rem;margin-top:6px">📄 ${m.nomFichier || 'Télécharger le fichier'}</a>` : ''}
        </div>
        <span style="font-size:.72rem;color:var(--text-muted);margin-top:3px;display:flex;align-items:center;gap:4px">${estAdmin ? 'Vous' : sal?.nom || 'Salarié'} · ${heure} ${accuse}</span>`;
      fil.appendChild(div);
    });
    fil.scrollTop = fil.scrollHeight;
    if (window.resolveStorageImages) window.resolveStorageImages(fil);
  }

  afficherMessagerie();
}

// L5507 (script.js d'origine)
async function ouvrirPhotoMessageAdmin(path, bucket) {
  if (!window.DelivProStorage) return;
  const signed = await window.DelivProStorage.getSignedUrl(bucket || 'messages-photos', path, 600);
  if (signed.ok && signed.signedUrl) {
    if (typeof ouvrirPopupSecure === 'function') ouvrirPopupSecure(signed.signedUrl, '_blank');
    else window.open(signed.signedUrl, '_blank');
  }
}

// L5516 (script.js d'origine)
function envoyerMessageAdmin() {
  if (!_msgSalarieActif) return;
  const input = document.getElementById('msg-admin-input');
  const texte = input.value.trim();
  if (!texte) return;
  // Son d'envoi discret
  try { const ctx=new(window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value=1200; g.gain.setValueAtTime(0.15,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.12); } catch(e) {}

  const messages = loadSafe('messages_' + _msgSalarieActif, []);
  messages.push({
    id: genId(), auteur: 'admin',
    texte, lu: false, creeLe: new Date().toISOString()
  });
  localStorage.setItem('messages_' + _msgSalarieActif, JSON.stringify(messages));

  input.value = '';
  ouvrirConversation(_msgSalarieActif);
}

// L5535 (script.js d'origine)
function mettreAJourBadgeMsgAdmin() {
  const salaries = charger('salaries');
  let total = 0;
  salaries.forEach(s => {
    const msgs = loadSafe('messages_' + s.id, []);
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

// L7100 (script.js d'origine)
function verifierMessagesAuto() {
  if (!salarieCourant) return; // Côté admin uniquement
  return; // Cette fonction est côté admin, pas salarié
}

// L7210 (script.js d'origine)
function envoyerMessageAvecPhoto(salId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    compresserImage(e.target.result, async (compressed) => {
      const msgId = genId();
      let photoPath = null;
      let photoBase64 = null;

      // Upload vers Supabase Storage si dispo (compressed est un dataURL)
      if (window.DelivProStorage) {
        const path = `${msgId}/${Date.now()}_photo.jpg`;
        const up = await window.DelivProStorage.uploadDataUrl('messages-photos', path, compressed, { contentType: 'image/jpeg' });
        if (up.ok) photoPath = path;
      }
      if (!photoPath) {
        // Fallback : base64 local (compat offline)
        photoBase64 = compressed;
      }

      const messages = loadSafe('messages_'+salId, []);
      messages.push({
        id: msgId, auteur: 'admin',
        texte: '📷 Photo partagée',
        photo: photoBase64, photoPath: photoPath, photoBucket: photoPath ? 'messages-photos' : null,
        lu: false, creeLe: new Date().toISOString()
      });
      localStorage.setItem('messages_'+salId, JSON.stringify(messages));
      ouvrirConversation(salId);
      afficherToast('✅ Photo envoyée');
    });
  };
  reader.readAsDataURL(file);
}

// L7384 (script.js d'origine)
function afficherTemplatesMsg(salNom) {
  const bar = document.getElementById('msg-templates-bar');
  if (!bar) return;
  bar.innerHTML = MSG_TEMPLATES.map(t =>
    `<button class="msg-template-btn" onclick="insererTemplate('${t.texte.replace(/'/g,"\\'")}','${salNom||''}')">${t.label}</button>`
  ).join('');
}

// L7393 (script.js d'origine)
function verifierMessagesAutomatiques() {
  if (!document || document.hidden) return; // Ne pas jouer si l'onglet est en arrière-plan
  const salaries  = charger('salaries').filter(s => s.actif);
  const plannings = loadSafe('plannings', []);
  const auj       = aujourdhui();
  const heure     = new Date().getHours();
  const minute    = new Date().getMinutes();
  const cle       = 'msg_auto_' + auj;
  const deja      = loadSafe(cle, {});

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

    // Rappel départ : fenêtre H-20min à H-10min
    if (maintenant >= minutesDep - 20 && maintenant <= minutesDep - 10 && !deja[s.id + '_depart']) {
      const msgs = loadSafe('messages_'+s.id, []);
      msgs.push({ id:genId(), auteur:'admin', texte:`🚀 Rappel automatique — Votre tournée commence à ${jour.heureDebut}. Pensez à faire votre inspection et votre relevé km de départ. Bonne journée ${s.nom} !`, lu:false, creeLe:new Date().toISOString(), auto:true });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      deja[s.id + '_depart'] = true;
    }

    // Rappel retour : fenêtre H+25min à H+35min
    if (maintenant >= minutesFin + 25 && maintenant <= minutesFin + 35 && !deja[s.id + '_retour']) {
      const msgs = loadSafe('messages_'+s.id, []);
      msgs.push({ id:genId(), auteur:'admin', texte:`🌙 Fin de journée ${s.nom} — N'oubliez pas d'enregistrer votre km de retour et votre plein si effectué. Bonne soirée ! 🙏`, lu:false, creeLe:new Date().toISOString(), auto:true });
      localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
      deja[s.id + '_retour'] = true;
    }
  });

  localStorage.setItem(cle, JSON.stringify(deja));
}

// L7480 (script.js d'origine)
function envoyerBroadcast() {
  const texte = document.getElementById('broadcast-texte')?.value.trim();
  if (!texte) { afficherToast('⚠️ Saisissez un message', 'error'); return; }
  const destinataires = getBroadcastDestinataires();
  if (!destinataires.length) { afficherToast('⚠️ Aucun destinataire sélectionné', 'error'); return; }
  destinataires.forEach(s => {
    const msgs = loadSafe('messages_'+s.id, []);
    msgs.push({ id: genId(), auteur:'admin', texte, lu:false, creeLe: new Date().toISOString() });
    localStorage.setItem('messages_'+s.id, JSON.stringify(msgs));
  });
  const el = document.getElementById('broadcast-texte');
  if (el) el.value = '';
  mettreAJourBadgeMsgAdmin();
  afficherMessagerie();
  ajouterEntreeAudit('Broadcast salariés', texte.substring(0, 80) + (texte.length > 80 ? '…' : ''));
  afficherToast(`✅ Message envoyé à ${destinataires.length} salarié(s)`);
}

