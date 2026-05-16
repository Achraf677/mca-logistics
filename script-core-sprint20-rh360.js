/**
 * MCA Logistics — Sprint 20 — RH 360° fiche unifiée salarié + 3 auto-alertes RH (Phase X — extraction script.js)
 *
 * Extracted from script.js L4918-5416 (2026-05-16).
 */

/* ==========================================================================
   Sprint 20 — RH 360° : Fiche unifiée salarié + 3 auto-alertes RH
   ========================================================================== */
(function installS20RH360(){
  if (window.__s20Installed) return;
  window.__s20Installed = true;

  const loadJSON = (k, def='[]') => { try { return JSON.parse(localStorage.getItem(k) || def); } catch(e){ return JSON.parse(def); } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) { /* fail-silent: localStorage quota / mode privé */ } };
  const esc = window.escapeHtml;
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('fr-FR'); } catch(e){ return ''; } };
  const fmtDateTime = (d) => { try { return new Date(d).toLocaleString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); } catch(e){ return ''; } };

  /* ---------- 1. Auto-alertes RH (alimentent alertes_admin → S19) ----------
     Stratégie : on ne purge PAS — on additionne, et on auto-clôt (traitee=true)
     les alertes dont la cause a disparu. Ça laisse l'admin rouvrir sans être écrasé. */
  function genererAlertesRH() {
    const salaries = loadJSON('salaries');
    const livraisons = loadJSON('livraisons');
    const alertes = loadJSON('alertes_admin');

    const nowMs = Date.now();
    const J14 = 14 * 86400000;
    const J2  = 2 * 86400000;
    const nouvelles = [];
    const causeToujoursActive = new Set(); // ids d'alertes rh_ dont la cause existe encore

    salaries.forEach(s => {
      if (s.actif === false) return;

      // 1a. Inactivité : pas de livraison et aucun message depuis 14j
      const livs = livraisons.filter(l => l.chaufId === s.id);
      const derniereLiv = livs.length ? Math.max(...livs.map(l => new Date(l.date || l.creeLe || 0).getTime())) : 0;
      const msgs = loadJSON('messages_' + s.id);
      const derniereMsg = msgs.length ? Math.max(...msgs.map(m => new Date(m.creeLe || 0).getTime())) : 0;
      const lastActiv = Math.max(derniereLiv, derniereMsg);
      const createdMs = s.creeLe ? new Date(s.creeLe).getTime() : 0;
      // on ne signale pas les salariés créés depuis moins de 14j s'ils n'ont jamais eu d'activité
      if (lastActiv > 0 && lastActiv < nowMs - J14) {
        const key = 'rh_inactivite_' + s.id;
        causeToujoursActive.add(key);
        if (!alertes.find(a => a.id === key)) {
          const jours = Math.floor((nowMs - lastActiv) / 86400000);
          nouvelles.push({
            id: key, type: 'rh_inactivite',
            message: `${s.nom} — aucune activité depuis ${jours}j`,
            salNom: s.nom, salId: s.id,
            creeLe: new Date().toISOString(), traitee: false
          });
        }
      } else if (lastActiv === 0 && createdMs && createdMs < nowMs - J14) {
        const key = 'rh_inactivite_' + s.id;
        causeToujoursActive.add(key);
        if (!alertes.find(a => a.id === key)) {
          nouvelles.push({
            id: key, type: 'rh_inactivite',
            message: `${s.nom} — aucune activité enregistrée`,
            salNom: s.nom, salId: s.id,
            creeLe: new Date().toISOString(), traitee: false
          });
        }
      }

      // 1b. Message salarié non répondu > 48h
      if (msgs.length) {
        const ordered = [...msgs].sort((a,b) => new Date(a.creeLe||0) - new Date(b.creeLe||0));
        const dernierMsgSal = [...ordered].reverse().find(m => m.auteur === 'salarie');
        if (dernierMsgSal) {
          const tSal = new Date(dernierMsgSal.creeLe || 0).getTime();
          const repApres = ordered.find(m => m.auteur === 'admin' && new Date(m.creeLe || 0).getTime() > tSal);
          if (!repApres && (nowMs - tSal) > J2) {
            const key = 'rh_msg_non_repondu_' + s.id;
            causeToujoursActive.add(key);
            if (!alertes.find(a => a.id === key)) {
              const h = Math.floor((nowMs - tSal) / 3600000);
              nouvelles.push({
                id: key, type: 'rh_msg_non_repondu',
                message: `Message de ${s.nom} non répondu depuis ${h}h`,
                salNom: s.nom, salId: s.id,
                creeLe: new Date().toISOString(), traitee: false
              });
            }
          }
        }
      }

      // 1c. Heures hebdo excessives (> 48h)
      try {
        if (typeof window.construireContexteHeures === 'function'
            && typeof window.calculerHeuresSalarieSemaine === 'function'
            && typeof window.getHeuresPeriodeRange === 'function') {
          // On force semaine courante pour cette détection
          const oldVue = window._heuresVue;
          const oldOff = window._heuresSemaineOffset;
          window._heuresVue = 'semaine'; window._heuresSemaineOffset = 0;
          try {
            const range = window.getHeuresPeriodeRange();
            const ctx = window.construireContexteHeures(range);
            const r = window.calculerHeuresSalarieSemaine(s.id, ctx);
            const h = r && typeof r.planifiees === 'number' ? r.planifiees : 0;
            if (h > 48) {
              const key = 'rh_heures_excess_' + s.id;
              causeToujoursActive.add(key);
              if (!alertes.find(a => a.id === key)) {
                nouvelles.push({
                  id: key, type: 'rh_heures_excess',
                  message: `⏱️ ${s.nom} — ${h.toFixed(1)}h planifiées cette semaine (> 48h)`,
                  salNom: s.nom, salId: s.id,
                  creeLe: new Date().toISOString(), traitee: false
                });
              }
            }
          } finally {
            window._heuresVue = oldVue; window._heuresSemaineOffset = oldOff;
          }
        }
      } catch(e) { /* silencieux */ }
    });

    // Auto-clôture : alertes rh_* existantes non-traitées dont la cause a disparu
    let modifBase = false;
    alertes.forEach(a => {
      if (a.type && typeof a.type === 'string' && a.type.startsWith('rh_') && !a.traitee) {
        if (!causeToujoursActive.has(a.id)) {
          a.traitee = true;
          a.autoCloseLe = new Date().toISOString();
          modifBase = true;
        }
      }
    });

    if (nouvelles.length || modifBase) {
      saveJSON('alertes_admin', [...alertes, ...nouvelles]);
    }
    if (typeof window.renderCentre === 'function') {
      try { window.renderCentre(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:renderCentre]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }
  }

  /* ---------- 2. Drawer 360° ---------- */
  function ensureDrawer() {
    if (document.getElementById('s20-drawer')) return;
    const overlay = document.createElement('div');
    overlay.className = 's20-drawer-overlay';
    overlay.id = 's20-drawer-overlay';
    overlay.onclick = () => window.fermerFiche360();

    const drawer = document.createElement('aside');
    drawer.className = 's20-drawer';
    drawer.id = 's20-drawer';
    drawer.innerHTML = `
      <div class="s20-drawer-header">
        <h3 id="s20-drawer-title">Fiche 360° salarié</h3>
        <button class="s20-drawer-close" onclick="window.fermerFiche360()" aria-label="Fermer">✕</button>
      </div>
      <div class="s20-drawer-content" id="s20-drawer-content"></div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    // ESC pour fermer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) window.fermerFiche360();
    });
  }

  window.ouvrirFiche360Salarie = function(salId) {
    const sal = loadJSON('salaries').find(s => s.id === salId);
    if (!sal) { if (typeof window.afficherToast === 'function') window.afficherToast('Salarié introuvable', 'error'); return; }
    ensureDrawer();
    const content = document.getElementById('s20-drawer-content');
    const title = document.getElementById('s20-drawer-title');
    if (title) title.textContent = `${sal.nom}`;
    if (content) content.innerHTML = renderFicheContent(sal);
    document.getElementById('s20-drawer').classList.add('open');
    document.getElementById('s20-drawer-overlay').classList.add('open');
    if (window.resolveStorageImages && content) window.resolveStorageImages(content);
  };

  /* CANONIQUE S20 — fermerFiche360. Seule définition forte ; le bloc S21
     plus bas n'écrit que si cette fonction n'est pas encore définie (fallback
     défensif). H2.1 : pas de collision. */
  window.fermerFiche360 = function() {
    const d = document.getElementById('s20-drawer');
    const o = document.getElementById('s20-drawer-overlay');
    if (d) d.classList.remove('open');
    if (o) o.classList.remove('open');
  };

  window.s20SwitchTab = function(tab) {
    document.querySelectorAll('.s20-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.s20-tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 's20-tab-' + tab));
  };

  function renderFicheContent(sal) {
    const livraisons = loadJSON('livraisons').filter(l => l.chaufId === sal.id);
    const vehicules = loadJSON('vehicules');
    const veh = vehicules.find(v => v.salId === sal.id);
    const messages = loadJSON('messages_' + sal.id);
    const incidents = loadJSON('incidents').filter(i => i.salId === sal.id || i.chaufId === sal.id);
    const alertes = loadJSON('alertes_admin').filter(a => a.salId === sal.id && !a.traitee);

    // KPIs
    const now = Date.now();
    const J30 = 30 * 86400000;
    const liv30 = livraisons.filter(l => now - new Date(l.date || 0).getTime() < J30);
    const ca30 = liv30.reduce((s, l) => s + (parseFloat(l.prixHT || l.prix || 0) || 0), 0);
    const msgNonLus = messages.filter(m => m.auteur === 'salarie' && !m.lu).length;

    // Heures semaine
    let heuresSem = 0;
    try {
      if (typeof window.construireContexteHeures === 'function' && typeof window.calculerHeuresSalarieSemaine === 'function' && typeof window.getHeuresPeriodeRange === 'function') {
        const range = window.getHeuresPeriodeRange();
        const ctx = window.construireContexteHeures(range);
        const r = window.calculerHeuresSalarieSemaine(sal.id, ctx);
        heuresSem = r && typeof r.planifiees === 'number' ? r.planifiees : 0;
      }
    } catch (e) {
      if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
        console.warn('[script:calculerHeuresSemaine]', e);
      }
      if (window.Sentry && window.Sentry.captureException) {
        try { window.Sentry.captureException(e); } catch (_) {}
      }
    }

    const initial = (sal.nom || '?').trim().charAt(0).toUpperCase();
    const badgeActif = sal.actif !== false
      ? '<span class="badge badge-dispo">✅ Actif</span>'
      : '<span class="badge badge-inactif">⏸️ Inactif</span>';

    return `
      <div class="s20-fiche-id">
        <div class="s20-fiche-avatar">${esc(initial)}</div>
        <div>
          <div class="s20-fiche-nom">${esc(sal.nom)}</div>
          <div class="s20-fiche-meta">${esc(sal.poste || '—')} · ${esc(sal.numero || '')}${sal.tel ? ' · ' + esc(sal.tel) : ''}</div>
          ${veh ? `<div class="s20-fiche-veh">🚐 <button type="button" class="s21-btn-360" onclick="window.ouvrirFiche360Vehicule('${esc(veh.id)}')">${esc(veh.immat)}${veh.modele ? ' — ' + esc(veh.modele) : ''}</button></div>` : '<div class="s20-fiche-veh muted">Sans véhicule affecté</div>'}
        </div>
        <div class="s20-fiche-badges">
          ${badgeActif}
          ${alertes.length ? `<span class="s20-badge-alert">⚠️ ${alertes.length} alerte${alertes.length > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>

      <div class="s20-kpi-row">
        <div class="s20-kpi"><div class="s20-kpi-val">${heuresSem.toFixed(1)} h</div><div class="s20-kpi-lbl">Semaine</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${liv30.length}</div><div class="s20-kpi-lbl">Livr. 30j</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${Math.round(ca30)} €</div><div class="s20-kpi-lbl">CA 30j</div></div>
      </div>

      <div class="s20-tabs">
        <button class="s20-tab active" data-tab="activite" onclick="window.s20SwitchTab('activite')">Activité</button>
        <button class="s20-tab" data-tab="livraisons" onclick="window.s20SwitchTab('livraisons')">Livraisons (${livraisons.length})</button>
        <button class="s20-tab" data-tab="conformite" onclick="window.s20SwitchTab('conformite')">Conformité</button>
        <button class="s20-tab" data-tab="incidents" onclick="window.s20SwitchTab('incidents')">Incidents (${incidents.length})</button>
      </div>

      <div class="s20-tab-content" id="s20-tab-activite">${renderActivite(livraisons, [], incidents, alertes)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-livraisons">${renderLivraisons(livraisons)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-conformite">${renderConformite(sal)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-incidents">${renderIncidentsList(incidents)}</div>

      <div class="s20-fiche-actions">
        <button class="btn-secondary" onclick="window.s20GoToHeures('${esc(sal.nom)}')"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Heures</button>
        <button class="btn-primary" onclick="window.s20GoToEdit('${sal.id}')"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Modifier</button>
      </div>`;
  }

  function renderActivite(livraisons, messages, incidents, alertes) {
    const items = [];
    livraisons.forEach(l => {
      const t = new Date(l.date || l.creeLe || 0).getTime();
      if (!t) return;
      items.push({ t, icon:'📦', label: `Livraison · ${esc(l.client || '—')} · ${(parseFloat(l.prixHT || l.prix) || 0).toFixed(0)} €` + (l.statut ? ' <span class="s20-timeline-date" style="margin-left:6px">['+esc(l.statut)+']</span>' : '') });
    });
    messages.slice(-15).forEach(m => {
      const t = new Date(m.creeLe || 0).getTime();
      if (!t) return;
      const ic = m.auteur === 'salarie' ? '📩' : '📤';
      const extrait = String(m.texte || (m.photo ? 'Photo' : '') || '').slice(0, 100);
      items.push({ t, icon: ic, label: (m.auteur === 'salarie' ? '<em>Salarié : </em>' : '<em>Admin : </em>') + esc(extrait) });
    });
    incidents.forEach(i => {
      const t = new Date(i.creeLe || i.date || 0).getTime();
      if (!t) return;
      items.push({ t, icon:'🚨', label: `Incident (${esc(i.gravite || 'moyen')}) · ${esc(String(i.description || '').slice(0, 80))}` });
    });
    alertes.forEach(a => {
      const t = new Date(a.creeLe || 0).getTime();
      if (!t) return;
      items.push({ t, icon:'⚠️', label: esc(a.message || a.type || '') });
    });

    items.sort((a,b) => b.t - a.t);
    const recent = items.slice(0, 30);
    if (!recent.length) return '<div class="s20-empty">Aucune activité récente</div>';

    return `<div class="s20-timeline">${recent.map(it => `
      <div class="s20-timeline-item">
        <span class="s20-timeline-ic">${it.icon}</span>
        <div class="s20-timeline-body">
          <div class="s20-timeline-label">${it.label}</div>
          <div class="s20-timeline-date">${fmtDateTime(it.t)}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  function renderLivraisons(livraisons) {
    if (!livraisons.length) return '<div class="s20-empty">Aucune livraison</div>';
    const recent = [...livraisons].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20);
    return `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Client</th><th>Statut</th><th style="text-align:right">HT</th></tr></thead>
      <tbody>${recent.map(l => `<tr>
        <td>${esc(l.date || '—')}</td>
        <td>${esc(l.client || '—')}</td>
        <td>${esc(l.statut || '—')}</td>
        <td style="text-align:right">${(parseFloat(l.prixHT || l.prix) || 0).toFixed(2)} €</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderMessages(messages) {
    if (!messages.length) return '<div class="s20-empty">Aucun message</div>';
    const recent = [...messages].slice(-30);
    return `<div class="s20-msg-list">${recent.map(m => {
      const who = m.auteur === 'salarie' ? 'in' : 'out';
      let txt;
      if (m.photoPath) {
        txt = '<img data-photo-path="' + esc(m.photoPath) + '" data-photo-bucket="' + esc(m.photoBucket || 'messages-photos') + '" alt="chargement..." style="max-width:180px;border-radius:6px;display:block;background:rgba(0,0,0,0.1);min-height:100px" />';
      } else if (m.photo) {
        txt = '<img src="' + esc(m.photo) + '" style="max-width:180px;border-radius:6px;display:block" />';
      } else {
        txt = esc(m.texte || '');
      }
      return `<div class="s20-msg s20-msg-${who}">
        <div class="s20-msg-txt">${txt}</div>
        <div class="s20-msg-date">${fmtDateTime(m.creeLe || '')}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderConformite(sal) {
    const now = Date.now();
    const row = (dateStr, label) => {
      if (!dateStr) return `<div class="s20-conf-row"><span>${label}</span><span class="muted">Non renseigné</span></div>`;
      const exp = new Date(dateStr).getTime();
      const jours = Math.floor((exp - now) / 86400000);
      let cl = 'ok', emoji = '✅';
      if (jours < 0) { cl = 'ko'; emoji = '❌'; }
      else if (jours < 30) { cl = 'warn'; emoji = '⚠️'; }
      const etat = jours >= 0 ? `J+${jours}` : `expiré depuis ${Math.abs(jours)}j`;
      return `<div class="s20-conf-row s20-conf-${cl}"><span>${label}</span><span>${emoji} ${esc(fmtDate(dateStr))} · ${etat}</span></div>`;
    };
    return `<div class="s20-conf-list">
      ${row(sal.datePermis, 'Permis de conduire')}
      ${row(sal.dateAssurance, 'Assurance')}
      ${sal.visiteMedicale ? row(sal.visiteMedicale, '⚕️ Visite médicale') : ''}
    </div>`;
  }

  function renderIncidentsList(incidents) {
    if (!incidents.length) return '<div class="s20-empty">Aucun incident</div>';
    return [...incidents].sort((a,b) => new Date(b.creeLe || b.date || 0) - new Date(a.creeLe || a.date || 0)).slice(0, 10).map(i => `
      <div class="s20-incident">
        <div class="s20-incident-head">
          <strong>${esc(i.client || 'Incident')}</strong>
          <span class="s20-incident-grav s20-grav-${esc(i.gravite || 'moyen')}">${esc(i.gravite || 'moyen')}</span>
        </div>
        <div class="s20-incident-desc">${esc(i.description || '')}</div>
        <div class="s20-incident-date">${esc(i.date || fmtDate(i.creeLe) || '')}</div>
      </div>`).join('');
  }

  /* ---------- 3. Navigation raccourcis depuis drawer ---------- */
  window.s20GoToHeures = function(nom) {
    window.fermerFiche360();
    if (typeof window.naviguerVers === 'function') window.naviguerVers('heures');
    setTimeout(() => {
      const i = document.getElementById('filtre-heures-salarie');
      if (i) {
        i.value = nom;
        if (typeof window.afficherCompteurHeures === 'function') window.afficherCompteurHeures();
      }
    }, 200);
  };

  window.s20GoToEdit = function(salId) {
    window.fermerFiche360();
    if (typeof window.ouvrirEditSalarie === 'function') window.ouvrirEditSalarie(salId);
  };

  /* ---------- 4. Injection bouton 👁️ dans tableaux RH ---------- */
  function injecterBoutons360() {
    // Table salariés — hijack du nom : clic ouvre la fiche 360° au lieu des livraisons
    const tb = document.getElementById('tb-salaries');
    if (tb) {
      tb.querySelectorAll('tr').forEach(tr => {
        if (tr.__s20Hooked) return;
        const btnLink = tr.querySelector('td:first-child button.table-link-button[onclick*="ouvrirLivraisonsSalarie"]');
        if (!btnLink) return;
        const m = btnLink.getAttribute('onclick').match(/ouvrirLivraisonsSalarie\('([^']+)'\)/);
        if (!m) return;
        const salId = m[1];
        // Redirige le clic du nom vers la fiche 360°
        btnLink.setAttribute('onclick', `window.ouvrirFiche360Salarie('${salId}')`);
        btnLink.setAttribute('title', 'Ouvrir la fiche 360°');
        // Nettoyer tout ancien bouton 360° redondant ajouté par versions précédentes
        const oldBtn = tr.querySelector('.s20-btn-360');
        if (oldBtn) oldBtn.remove();
        tr.__s20Hooked = true;
      });
    }

    // Table heures — rendre le nom cliquable
    const tbh = document.getElementById('tb-heures');
    if (tbh) {
      const salaries = loadJSON('salaries');
      tbh.querySelectorAll('tr').forEach(tr => {
        if (tr.__s20Hooked) return;
        const strong = tr.querySelector('td:first-child strong');
        if (!strong) return;
        const nom = strong.textContent.trim();
        const sal = salaries.find(s => s.nom === nom);
        if (!sal) return;
        strong.style.cursor = 'pointer';
        strong.style.color = 'var(--accent)';
        strong.style.textDecoration = 'underline';
        strong.style.textDecorationStyle = 'dotted';
        strong.title = 'Ouvrir la fiche 360°';
        strong.onclick = () => window.ouvrirFiche360Salarie(sal.id);
        tr.__s20Hooked = true;
      });
    }

    // Table chauffeurs
    const tbc = document.getElementById('tb-chauffeurs');
    if (tbc) {
      tbc.querySelectorAll('tr').forEach(tr => {
        if (tr.__s20Hooked) return;
        const firstTd = tr.querySelector('td:first-child');
        if (!firstTd) return;
        // On ne cible que les lignes qui ont un salarié lié (via data-sal-id si présent)
        const salId = tr.getAttribute('data-sal-id') || tr.dataset.salId;
        if (!salId) { tr.__s20Hooked = true; return; }
        if (firstTd.querySelector('.s20-btn-360')) { tr.__s20Hooked = true; return; }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 's20-btn-360';
        b.textContent = '👁️';
        b.title = 'Fiche 360°';
        b.onclick = (ev) => { ev.stopPropagation(); window.ouvrirFiche360Salarie(salId); };
        firstTd.appendChild(b);
        tr.__s20Hooked = true;
      });
    }
  }

  function setupObservers() {
    ['tb-salaries', 'tb-heures', 'tb-chauffeurs'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.__s20Obs) return;
      const obs = new MutationObserver(() => setTimeout(injecterBoutons360, 40));
      obs.observe(el, { childList: true, subtree: true });
      el.__s20Obs = obs;
    });
  }

  /* ---------- Init ---------- */
  function init() {
    try { genererAlertesRH(); } catch(e) { console.warn('S20 alertes RH:', e); }
    setTimeout(() => {
      injecterBoutons360();
      setupObservers();
    }, 600);
    // Re-génération périodique (5 min)
    setInterval(() => {
      try { genererAlertesRH(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:genererAlertesRH-cron]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }, 5 * 60 * 1000);
    // PERF: setInterval 3s retiré — setupObservers() via MutationObserver
    // couvre déjà l'injection des boutons sur insertions dynamiques (pagination incluse)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 900);
})();
