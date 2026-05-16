/**
 * MCA Logistics — Sprint 26 — Timeline globale + Stats comparées + Double-clic inline + Signature BL (Phase X — extraction script.js)
 *
 * Extracted from script.js L4926-5534 (2026-05-16).
 */

/* ==========================================================================
   Sprint 26 — Timeline globale + Stats comparées + Double-clic inline + Signature BL
   - Timeline consolide factures, livraisons, paiements, avoirs, charges, relances
   - Stats comparées : KPI mini-delta M vs M-1 injectés sur dashboard
   - Double-clic : édition inline sur cellules marquées data-s26-edit
   - Signature BL : toggle Paramètres ; si activé → canvas capture + archivage + audit + PDF
   ========================================================================== */
(function installS26(){
  if (window.__s26Installed) return;
  window.__s26Installed = true;

  const LS = {
    factures: 'factures_emises', livraisons: 'livraisons', paiements: 'paiements',
    avoirs: 'avoirs_emis', charges: 'charges', relances: 'relances_log',
    clients: 'clients', fournisseurs: 'fournisseurs', alertes: 'alertes_admin',
    params: 'params_entreprise', signatures: 's26_signatures_bl', audit: 'audit_log',
  };
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const loadObj = (k) => { try { return loadSafe(k, {}); } catch(e){ return {}; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
  const fmtDateTime = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR')+' '+x.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); };
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };
  const audit = (a, d) => { if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit(a, d); };
  const todayISO = () => new Date().toLocalISODate();

  function getOpt(key, def) {
    const p = loadObj(LS.params); const o = p.s26 || {};
    return (o[key] !== undefined) ? !!o[key] : def;
  }
  function setOpt(key, val) {
    const p = loadObj(LS.params); p.s26 = p.s26 || {}; p.s26[key] = !!val; save(LS.params, p);
  }

  /* ================================================================
     BLOC 1 — TIMELINE GLOBALE (filtres acteur/type/date)
     ================================================================ */
  function collectTimelineEvents() {
    const evts = [];
    load(LS.factures).forEach(f => {
      evts.push({ date: f.dateFacture || f.dateCreation, type: 'facture', action: 'Facture émise',
        acteur: f.client||'—', acteurType: 'client',
        details: (f.numero||'')+' · '+fmtEur(f.montantTTC||f.totalTTC||0),
        ref: f.numero, statut: f.statut, icon: '📄', couleur: '#2563eb' });
    });
    load(LS.livraisons).forEach(l => {
      evts.push({ date: l.dateLivraison || l.dateCreation, type: 'livraison', action: 'Livraison '+(l.statut||'créée'),
        acteur: l.client||l.donneurOrdre||'—', acteurType: 'client',
        details: (l.referenceBL||l.bl||'')+' · '+(l.depart||'')+' → '+(l.arrivee||''),
        ref: l.referenceBL||l.id, statut: l.statut, icon: '🚚', couleur: '#16a34a' });
    });
    load(LS.paiements).forEach(p => {
      evts.push({ date: p.datePaiement || p.date, type: 'paiement', action: 'Encaissement',
        acteur: p.client||'—', acteurType: 'client',
        details: fmtEur(p.montant)+(p.mode?' · '+p.mode:''),
        ref: p.reference||p.id, icon: '💰', couleur: '#0891b2' });
    });
    load(LS.avoirs).forEach(a => {
      evts.push({ date: a.dateAvoir || a.dateCreation, type: 'avoir', action: 'Avoir émis',
        acteur: a.client||'—', acteurType: 'client',
        details: (a.numero||'')+' · '+fmtEur(a.montantTTC||0),
        ref: a.numero, icon: '↩️', couleur: '#f59e0b' });
    });
    load(LS.charges).forEach(c => {
      evts.push({ date: c.date || c.dateCreation, type: 'charge', action: 'Charge '+(c.categorie||''),
        acteur: c.fournisseur||'—', acteurType: 'fournisseur',
        details: (c.libelle||'')+' · '+fmtEur(c.montantTTC||c.montant||0),
        ref: c.id, icon: '💸', couleur: '#dc2626' });
    });
    load(LS.relances).forEach(r => {
      evts.push({ date: r.date, type: 'relance', action: 'Relance niv. '+(r.niveau||'1'),
        acteur: r.client||'—', acteurType: 'client',
        details: 'Facture '+(r.facture||'')+(r.canal?' ('+r.canal+')':''),
        ref: r.id, icon: '🔔', couleur: '#7c3aed' });
    });
    return evts
      .filter(e => e.date)
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  const TIMELINE_TYPES = [
    { k: 'facture', lbl: 'Factures' },
    { k: 'livraison', lbl: 'Livraisons' },
    { k: 'paiement', lbl: 'Paiements' },
    { k: 'avoir', lbl: '↩️ Avoirs' },
    { k: 'charge', lbl: 'Charges' },
    { k: 'relance', lbl: 'Relances' },
  ];

  function ouvrirTimelineGlobale() {
    const evts = collectTimelineEvents();
    const today = todayISO();
    const d30 = new Date(Date.now() - 30*86400000).toLocalISODate();
    const acteursUniques = Array.from(new Set(evts.map(e => e.acteur).filter(Boolean))).sort();
    const html = `
      <div class="s15-modal-info-box" style="max-width:1100px;width:96vw;max-height:92vh">
        <div class="s15-modal-info-header">
          <h2>Timeline globale — activité consolidée</h2>
          <button class="btn-close" onclick="document.getElementById('s15-modal-info').classList.remove('open')">✕</button>
        </div>
        <div class="s15-modal-info-body" style="overflow:auto;max-height:calc(92vh - 70px)">
          <div class="s26-timeline-filters">
            <div class="s26-tlf-row">
              <label>Du <input type="date" id="s26-tl-du" value="${d30}"></label>
              <label>Au <input type="date" id="s26-tl-au" value="${today}"></label>
              <label>Acteur
                <select id="s26-tl-acteur">
                  <option value="">Tous</option>
                  ${acteursUniques.map(a => `<option>${esc(a)}</option>`).join('')}
                </select>
              </label>
              <label>Recherche <input type="text" id="s26-tl-search" placeholder="Réf, détail…"></label>
            </div>
            <div class="s26-tlf-types">
              ${TIMELINE_TYPES.map(t => `
                <label class="s26-tl-chip">
                  <input type="checkbox" data-s26-type="${t.k}" checked>
                  <span>${t.lbl}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="s26-timeline-summary" id="s26-tl-summary"></div>
          <div class="s26-timeline-list" id="s26-tl-list"></div>
        </div>
      </div>
    `;
    ouvrirModal(html);
    const refresh = () => renderTimeline(evts);
    document.querySelectorAll('#s26-tl-du, #s26-tl-au, #s26-tl-acteur, #s26-tl-search, [data-s26-type]')
      .forEach(el => el.addEventListener('input', refresh));
    refresh();
  }

  function renderTimeline(allEvts) {
    const du = document.getElementById('s26-tl-du')?.value;
    const au = document.getElementById('s26-tl-au')?.value;
    const acteur = document.getElementById('s26-tl-acteur')?.value || '';
    const search = (document.getElementById('s26-tl-search')?.value||'').toLowerCase();
    const typesActifs = new Set(
      Array.from(document.querySelectorAll('[data-s26-type]:checked')).map(cb => cb.dataset.s26Type)
    );
    const filtered = allEvts.filter(e => {
      const d = (e.date||'').slice(0,10);
      if (du && d < du) return false;
      if (au && d > au) return false;
      if (acteur && e.acteur !== acteur) return false;
      if (!typesActifs.has(e.type)) return false;
      if (search) {
        const hay = (e.action+' '+e.acteur+' '+e.details+' '+(e.ref||'')).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    const summary = document.getElementById('s26-tl-summary');
    if (summary) {
      const parType = {};
      filtered.forEach(e => { parType[e.type] = (parType[e.type]||0)+1; });
      summary.innerHTML = `
        <strong>${filtered.length}</strong> événement${filtered.length>1?'s':''}
        ${Object.entries(parType).map(([k,v]) => {
          const t = TIMELINE_TYPES.find(x => x.k===k);
          return `<span class="s26-tl-pill">${t?t.lbl:k} : ${v}</span>`;
        }).join('')}
      `;
    }
    const list = document.getElementById('s26-tl-list');
    if (!list) return;
    if (!filtered.length) {
      list.innerHTML = '<div class="s26-tl-empty">Aucun événement sur la période / les filtres choisis.</div>';
      return;
    }
    let grp = {};
    filtered.forEach(e => {
      const d = (e.date||'').slice(0,10);
      (grp[d] = grp[d] || []).push(e);
    });
    list.innerHTML = Object.entries(grp).map(([d, items]) => `
      <div class="s26-tl-day">
        <div class="s26-tl-date">${fmtDate(d)}</div>
        <div class="s26-tl-events">
          ${items.map(e => `
            <div class="s26-tl-evt" style="border-left-color:${e.couleur}">
              <div class="s26-tl-evt-icon">${e.icon}</div>
              <div class="s26-tl-evt-body">
                <div class="s26-tl-evt-head">
                  <strong>${esc(e.action)}</strong>
                  <span class="s26-tl-evt-acteur">${esc(e.acteur)}</span>
                  ${e.statut ? `<span class="s26-tl-evt-statut">${esc(e.statut)}</span>` : ''}
                </div>
                <div class="s26-tl-evt-details">${esc(e.details)}</div>
                ${e.ref ? `<div class="s26-tl-evt-ref">Réf : ${esc(e.ref)}</div>` : ''}
              </div>
              <div class="s26-tl-evt-time">${fmtDateTime(e.date).split(' ').slice(1).join(' ')||''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function ouvrirModal(html) {
    if (typeof window.modalInfo === 'function') {
      const m = window.modalInfo(html);
      // window.modalInfo wraps html in .s15-modal-info-body ; our html already provides its own box
      // so we override the inner structure:
      m.innerHTML = html;
      // re-bind close + backdrop
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }, { once: true });
      m.querySelectorAll('.btn-close, .s15-modal-info-close').forEach(btn => {
        btn.addEventListener('click', () => m.classList.remove('open'));
      });
      return m;
    }
    let m = document.getElementById('s15-modal-info');
    if (!m) {
      m = document.createElement('div');
      m.id = 's15-modal-info';
      m.className = 's15-modal-info-overlay';
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('open')) m.classList.remove('open'); });
    } else {
      m.className = 's15-modal-info-overlay';
    }
    m.innerHTML = html;
    m.querySelectorAll('.btn-close, .s15-modal-info-close').forEach(btn => {
      btn.addEventListener('click', () => m.classList.remove('open'));
    });
    m.classList.add('open');
    return m;
  }

  window.ouvrirTimelineGlobale = ouvrirTimelineGlobale;

  /* ================================================================
     BLOC 3 — DOUBLE-CLIC INLINE EDIT
     ================================================================ */
  function onDblClickCell(e) {
    const cell = e.target.closest('[data-s26-edit]');
    if (!cell) return;
    if (cell.querySelector('input, select, textarea')) return;
    const kind = cell.dataset.s26Edit; // 'text' | 'number' | 'date' | 'select'
    const orig = cell.textContent.trim();
    const raw = cell.dataset.s26Value != null ? cell.dataset.s26Value : orig;
    const saveFn = cell.dataset.s26Save; // name of global fn (id, newVal, cell) => bool
    let input;
    if (kind === 'select') {
      input = document.createElement('select');
      const opts = (cell.dataset.s26Options||'').split('|');
      opts.forEach(o => {
        const op = document.createElement('option');
        op.value = o; op.textContent = o;
        if (o === raw) op.selected = true;
        input.appendChild(op);
      });
    } else {
      input = document.createElement('input');
      input.type = kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text';
      if (kind === 'number') input.step = '0.01';
      input.value = raw;
    }
    input.className = 's26-inline-edit';
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    if (input.select) input.select();
    const commit = () => {
      const nv = input.value.trim();
      if (nv === raw) { cell.textContent = orig; return; }
      const id = cell.dataset.s26Id;
      const fn = saveFn && window[saveFn];
      let ok = false;
      if (typeof fn === 'function') {
        try { ok = !!fn(id, nv, cell); } catch(err) { console.warn('S26 inline save', err); }
      }
      if (ok) {
        cell.dataset.s26Value = nv;
        cell.textContent = nv;
        toast('✏️ Modifié', 'success');
        audit('edit_inline', { cell: cell.dataset.s26Field||'', id, nv });
      } else {
        cell.textContent = orig;
        toast('❌ Modification refusée', 'warning');
      }
    };
    const cancel = () => { cell.textContent = orig; };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); input.removeEventListener('blur', commit); cancel(); }
    });
  }

  // Savers de base pour les entités courantes
  window.s26SaveFactureMontant = function(id, nv) {
    const arr = load(LS.factures);
    const i = arr.findIndex(f => String(f.id)===String(id) || f.numero===id);
    if (i<0) return false;
    const n = parseFloat(nv); if (isNaN(n) || n < 0) return false;
    arr[i].montantTTC = n;
    save(LS.factures, arr);
    return true;
  };
  window.s26SaveFactureStatut = function(id, nv) {
    const arr = load(LS.factures);
    const i = arr.findIndex(f => String(f.id)===String(id) || f.numero===id);
    if (i<0) return false;
    arr[i].statut = nv;
    save(LS.factures, arr);
    return true;
  };
  window.s26SaveFactureEcheance = function(id, nv) {
    const arr = load(LS.factures);
    const i = arr.findIndex(f => String(f.id)===String(id) || f.numero===id);
    if (i<0) return false;
    arr[i].dateEcheance = nv;
    save(LS.factures, arr);
    return true;
  };
  window.s26SaveLivraisonStatut = function(id, nv) {
    const arr = load(LS.livraisons);
    const i = arr.findIndex(l => String(l.id)===String(id) || l.referenceBL===id);
    if (i<0) return false;
    arr[i].statut = nv;
    save(LS.livraisons, arr);
    return true;
  };

  /* ================================================================
     BLOC 4 — SIGNATURE BL (canvas, toggle Paramètres, automatisations)
     ================================================================ */
  function signatureActive() { return getOpt('signature_bl', false); }

  function ouvrirSignatureBL(livraisonId) {
    if (!signatureActive()) { toast('Signature désactivée dans Paramètres', 'warning'); return; }
    const liv = load(LS.livraisons).find(l => String(l.id)===String(livraisonId) || l.referenceBL===livraisonId);
    if (!liv) { toast('Livraison introuvable', 'error'); return; }
    const existing = load(LS.signatures).find(s => s.livraisonId === liv.id);
    const html = `
      <div class="s15-modal-info-box narrow" style="max-width:560px">
        <div class="s15-modal-info-header">
          <h2>✍️ Signature BL ${esc(liv.numLiv||liv.referenceBL||liv.id)}</h2>
          <button class="btn-close" onclick="document.getElementById('s15-modal-info').classList.remove('open')">✕</button>
        </div>
        <div class="s15-modal-info-body">
          <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:10px">
            Destinataire : <strong>${esc(liv.client||liv.donneurOrdre||'—')}</strong><br>
            ${liv.arrivee ? 'Lieu : '+esc(liv.arrivee)+'<br>' : ''}
            Signataire requis : nom et prénom puis signature au stylet / doigt.
          </p>
          <label>Nom du signataire
            <input type="text" id="s26-sig-nom" value="${esc(existing?.signataire||'')}" placeholder="NOM Prénom">
          </label>
          <label>Qualité (optionnel)
            <input type="text" id="s26-sig-qualite" value="${esc(existing?.qualite||'')}" placeholder="Chef de dépôt, réceptionniste…">
          </label>
          <div class="s26-sig-canvas-wrap">
            <canvas id="s26-sig-canvas" width="500" height="180"></canvas>
            <div class="s26-sig-canvas-hint">Signez ci-dessus</div>
          </div>
          <div class="s26-sig-actions">
            <button class="btn btn-ghost" onclick="window.s26EffacerSig()">Effacer</button>
            <button class="btn btn-primary" onclick="window.s26EnregistrerSig('${esc(liv.id)}')">✅ Enregistrer & archiver</button>
          </div>
          ${existing ? `<div class="s26-sig-meta">Déjà signée le ${fmtDateTime(existing.date)} par ${esc(existing.signataire||'')}</div>` : ''}
        </div>
      </div>
    `;
    ouvrirModal(html);
    setTimeout(() => {
      initCanvas();
      if (existing?.dataUrl) restoreCanvas(existing.dataUrl);
    }, 50);
  }
  window.ouvrirSignatureBL = ouvrirSignatureBL;

  let sigCtx = null, sigDrawing = false, sigEmpty = true;
  function initCanvas() {
    const c = document.getElementById('s26-sig-canvas');
    if (!c) return;
    sigCtx = c.getContext('2d');
    sigCtx.lineWidth = 2.2; sigCtx.lineCap = 'round'; sigCtx.strokeStyle = '#111';
    sigEmpty = true;
    const pos = ev => {
      const r = c.getBoundingClientRect();
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      return { x: x * (c.width/r.width), y: y * (c.height/r.height) };
    };
    const start = ev => { ev.preventDefault(); sigDrawing = true; sigEmpty = false; const p = pos(ev); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
    const move = ev => { if (!sigDrawing) return; ev.preventDefault(); const p = pos(ev); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
    const end = () => { sigDrawing = false; };
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move); c.addEventListener('mouseup', end); c.addEventListener('mouseleave', end);
    c.addEventListener('touchstart', start); c.addEventListener('touchmove', move); c.addEventListener('touchend', end);
  }
  function restoreCanvas(dataUrl) {
    const c = document.getElementById('s26-sig-canvas');
    if (!c || !sigCtx) return;
    const img = new Image();
    img.onload = () => { sigCtx.drawImage(img, 0, 0, c.width, c.height); sigEmpty = false; };
    img.src = dataUrl;
  }
  window.s26EffacerSig = function() {
    const c = document.getElementById('s26-sig-canvas');
    if (!c || !sigCtx) return;
    sigCtx.clearRect(0, 0, c.width, c.height);
    sigEmpty = true;
  };
  // Hash SHA-256 hex (Web Crypto) — BUG-039
  async function sha256Hex(str) {
    try {
      const buf = new TextEncoder().encode(String(str||''));
      const dig = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch (e) { return ''; }
  }
  // Compression canvas → WebP 0.6 (BUG-042) — fallback JPEG puis PNG
  function canvasVersDataUrlCompresse(canvas) {
    return new Promise((resolve) => {
      try {
        if (canvas.toBlob) {
          canvas.toBlob((blob) => {
            if (!blob) { resolve(canvas.toDataURL('image/png')); return; }
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => resolve(canvas.toDataURL('image/png'));
            r.readAsDataURL(blob);
          }, 'image/webp', 0.6);
        } else {
          try { resolve(canvas.toDataURL('image/webp', 0.6)); }
          catch(_) { resolve(canvas.toDataURL('image/jpeg', 0.7)); }
        }
      } catch(_) { resolve(canvas.toDataURL('image/png')); }
    });
  }

  window.s26EnregistrerSig = async function(livId) {
    const nom = (document.getElementById('s26-sig-nom')?.value||'').trim();
    const qualite = (document.getElementById('s26-sig-qualite')?.value||'').trim();
    const c = document.getElementById('s26-sig-canvas');
    if (!nom) { toast('Nom du signataire requis', 'warning'); return; }
    if (sigEmpty) { toast('Signature manquante', 'warning'); return; }
    // BUG-042 : compression (WebP 0.6 → ~3-8 Ko vs 30-60 Ko PNG)
    const dataUrl = await canvasVersDataUrlCompresse(c);
    const sigs = load(LS.signatures);
    const idx = sigs.findIndex(s => s.livraisonId === livId);
    // BUG-039 : preuve infalsifiable (eIDAS + art. 1366 CC)
    // — snapshot de la livraison signée (preuve WHAT)
    // — hash SHA-256 du snapshot (preuve INTEGRITY)
    // — chaînage avec la signature précédente (preuve ORDER — horodatage immutable)
    const livs0 = load(LS.livraisons);
    const livSnap = livs0.find(l => String(l.id)===String(livId)) || { id: livId };
    const snapshotStr = JSON.stringify(livSnap);
    const documentHash = await sha256Hex(snapshotStr);
    const precedente = sigs.length ? sigs[sigs.length-1] : null;
    const previousHash = precedente ? (precedente.chainHash || '') : '';
    const date = new Date().toISOString();
    const chainPayload = [documentHash, previousHash, nom, qualite, date].join('|');
    const chainHash = await sha256Hex(chainPayload);
    const entry = {
      id: (typeof window.genId === 'function' ? window.genId() : 's26_sig_' + Date.now()),
      livraisonId: livId,
      signataire: nom, qualite, dataUrl,
      date,
      userAgent: navigator.userAgent.slice(0,80),
      documentSnapshot: snapshotStr,
      documentHash,
      previousHash,
      chainHash,
      hashAlgo: 'SHA-256',
      chainVersion: 1
    };
    if (idx >= 0) sigs[idx] = entry; else sigs.push(entry);
    save(LS.signatures, sigs);
    // Automatisations : met la livraison en livré, horodate, audit, alerte admin si config
    const livs = load(LS.livraisons);
    const li = livs.findIndex(l => String(l.id)===String(livId));
    if (li >= 0) {
      livs[li].statut = 'livré';
      livs[li].dateLivraisonEffective = new Date().toISOString();
      livs[li].signatureId = entry.id;
      livs[li].signataireNom = nom;
      livs[li].signatureDocumentHash = documentHash;
      save(LS.livraisons, livs);
    }
    audit('signature_bl', { livraisonId: livId, signataire: nom, qualite, horodatage: entry.date, documentHash, chainHash });
    toast('✅ Signature archivée & livraison clôturée', 'success');
    document.getElementById('s15-modal-info')?.classList.remove('open');
    if (typeof window.afficherLivraisons === 'function') {
      try { window.afficherLivraisons(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:postSignature-afficherLivraisons]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }
    if (typeof window.s24CronTick === 'function') {
      try { window.s24CronTick(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:postSignature-s24CronTick]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }
  };

  // Vérification d'intégrité de la chaîne (BUG-039) — utilisable pour audit / support
  window.s26VerifierChaineSignatures = async function() {
    const sigs = load(LS.signatures);
    const resultats = [];
    let prevHash = '';
    for (const s of sigs) {
      if (!s.chainHash) { resultats.push({ id:s.id, ok:false, raison:'Signature pré-BUG-039 (pas de hash)' }); prevHash = ''; continue; }
      if ((s.previousHash||'') !== prevHash) {
        resultats.push({ id:s.id, ok:false, raison:'Chaînage rompu (previousHash inattendu)' });
      } else {
        const recomputed = await sha256Hex([s.documentHash, s.previousHash, s.signataire, s.qualite, s.date].join('|'));
        resultats.push({ id:s.id, ok: recomputed === s.chainHash, raison: recomputed === s.chainHash ? 'OK' : 'chainHash ne correspond pas au contenu (falsification probable)' });
      }
      prevHash = s.chainHash;
    }
    return resultats;
  };

  // Injecte bouton Signer sur les drawers/livraisons si activé
  function injecterBoutonSignature() {
    if (!signatureActive()) return;
    document.querySelectorAll('[data-livraison-id]:not(.__s26SigBtn)').forEach(el => {
      const id = el.dataset.livraisonId;
      if (!id) return;
      el.classList.add('__s26SigBtn');
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost s26-btn-sig';
      btn.innerHTML = '✍️ Signer';
      btn.onclick = (e) => { e.stopPropagation(); ouvrirSignatureBL(id); };
      el.appendChild(btn);
    });
  }

  /* ================================================================
     BLOC 5 — PARAMÈTRES : section S26
     ================================================================ */
  function injectParamsUI() {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    if (page.querySelector('#s26-params-section')) return;
    const container = page.querySelector('.settings-content') || page;
    const section = document.createElement('div');
    section.id = 's26-params-section';
    section.className = 'settings-section';
    section.innerHTML = `
      <h2 style="margin-top:32px">Pilotage & Traçabilité</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">
        Outils de vision transverse et options de capture.
      </p>
      <div class="s26-params-actions">
        <button class="btn btn-primary" onclick="window.ouvrirTimelineGlobale()">Ouvrir la Timeline globale</button>
      </div>
      <h3 style="margin-top:24px">✍️ Signature BL sur tablette / mobile</h3>
      <p style="color:var(--text-muted);font-size:.88rem">Capture d'une signature manuscrite au moment de la livraison.</p>
      <div class="s26-toggles">
        ${renderToggle('signature_bl', '✍️ Signature BL (canvas)', 'Bouton Signer sur chaque livraison. À la validation : clôture auto + archive horodatée.', false)}
        ${renderToggle('signature_obligatoire', 'Signature obligatoire pour clôturer', 'Bloque le passage au statut livré sans signature capturée.', false)}
      </div>
    `;
    container.appendChild(section);
    section.querySelectorAll('input[type=checkbox][data-s26-key]').forEach(cb => {
      cb.addEventListener('change', () => {
        setOpt(cb.dataset.s26Key, cb.checked);
        toast(cb.checked ? '✅ Activé : '+cb.dataset.s26Label : '⏸️ Désactivé : '+cb.dataset.s26Label, 'success');
        if (cb.dataset.s26Key === 'signature_bl' && cb.checked) injecterBoutonSignature();
      });
    });
  }
  function renderToggle(key, label, desc, def) {
    const val = getOpt(key, def);
    return `<label class="s24-toggle">
      <input type="checkbox" data-s26-key="${key}" data-s26-label="${label}" ${val?'checked':''} />
      <span class="s24-toggle-switch"></span>
      <span class="s24-toggle-body"><strong>${label}</strong><br><small>${desc}</small></span>
    </label>`;
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    document.addEventListener('dblclick', onDblClickCell);
    injectParamsUI();
    injecterBoutonSignature();
    // PERF: anciens setInterval injectParamsUI 4s + injecterBoutonSignature 2.5s
    // remplacés par MutationObserver — ne re-injecte que si le DOM mute vraiment
    const reinjectObs = new MutationObserver(() => {
      if (!document.getElementById('s26-params-card')) injectParamsUI();
      injecterBoutonSignature();
    });
    reinjectObs.observe(document.body, { childList: true, subtree: true });
  }
  window.__s26InitDashboard = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else Promise.resolve().then(init);
})();
