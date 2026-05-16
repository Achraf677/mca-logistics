/**
 * MCA Logistics — Sprint 15 — Productivité PGI (auto-création client + badges + alertes échéance + rappel) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4910-5166 (2026-05-16).
 */

/* ============================================================
   SPRINT 15 — Productivité PGI
   1. Auto-création client depuis facture
   2. Badge facture orpheline (sans LIV)
   3. Alerte échéance imminente dashboard (J-5/3/1)
   4. Bouton rappel préventif (niv 0, avant échéance)
   5. Copie rapide au clic (N° facture / SIREN / IBAN)
   6. Recherche globale Ctrl+K
   7. Historique modifications (factures / livraisons / clients)
   8. Export Z quotidien
   ============================================================ */
(function(){
  if (window.__s15Installed) return;
  window.__s15Installed = true;

  const LS = {
    clients: 'clients', livraisons: 'livraisons', factures: 'factures_emises',
    avoirs: 'avoirs_emis', paiements: 'paiements', params: 'params_entreprise',
    history: 'history_log'
  };

  /* ---------- Helpers ---------- */
  const load = (k) => { try { return loadSafe(k, []); } catch(e) { return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const escHtml = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
  const isoDate = (d) => { const x = new Date(d); return isNaN(x) ? '' : x.toLocalISODate(); };
  const genId = () => (typeof window.genId === 'function' ? window.genId() : 's15_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
  const toast = (msg, type) => { if (typeof window.afficherToast === 'function') window.afficherToast(msg, type||'info'); };
  const audit = (act, det) => { if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit(act, det); };

  /* ---------- Modal générique (utilisé par echeances, historique, Export Z) ---------- */
  window.modalInfo = window.modalInfo || function(htmlContent) {
    let modal = document.getElementById('s15-modal-info');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 's15-modal-info';
      modal.className = 's15-modal-info-overlay';
      modal.innerHTML = '<div class="s15-modal-info-box"><button class="s15-modal-info-close" aria-label="Fermer">✕</button><div class="s15-modal-info-body"></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
      modal.querySelector('.s15-modal-info-close').addEventListener('click', () => modal.classList.remove('open'));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) modal.classList.remove('open'); });
    }
    modal.querySelector('.s15-modal-info-body').innerHTML = htmlContent;
    modal.classList.add('open');
    return modal;
  };
  /* HELPER S15 — `closeModalInfo`. H2.1 : remplaçait un wrapper de
     window.closeModal qui interceptait l'id virtuel 'modal-info' (en fait
     #s15-modal-info dans le DOM). On utilise désormais un hook 'close' :
     quand n'importe quelle modal se ferme avec id='modal-info', on ferme
     l'overlay s15-modal-info. Le canonique closeModal cherche son overlay
     par ID et ne trouve rien (modal-info n'existe pas dans le DOM), donc
     pas d'effet de bord ; le hook fait le travail. */
  if (typeof window.registerModalHook === 'function' && !window.__s15CloseHookInstalled) {
    window.__s15CloseHookInstalled = true;
    window.registerModalHook('close', 'modal-info', function() {
      const el = document.getElementById('s15-modal-info');
      if (el) el.classList.remove('open');
    });
  }

  /* ============================================================
     1. AUTO-CRÉATION CLIENT DEPUIS FACTURE
     Si une facture est émise et qu'aucun client DB ne correspond,
     propose de créer la fiche à la volée.
     ============================================================ */
  function findClientByName(nom) {
    if (!nom) return null;
    const k = nom.trim().toLowerCase();
    return load(LS.clients).find(c => (c.nom||'').trim().toLowerCase() === k) || null;
  }







  /* ============================================================
     5. COPIE RAPIDE AU CLIC (délégation sur [data-copy])
     ============================================================ */
  function copyToClipboard(text) {
    if (!text) return Promise.reject();
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    // Fallback textarea
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(_) { /* fail-silent: execCommand non supporté (Safari iOS strict / sandbox) */ }
    ta.remove();
    return Promise.resolve();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-copy]');
    if (!el) return;
    const text = el.getAttribute('data-copy') || el.textContent.trim();
    copyToClipboard(text).then(() => {
      toast('Copié : '+ (text.length > 40 ? text.slice(0,40)+'…' : text), 'success');
      el.classList.add('s15-copy-flash');
      setTimeout(() => el.classList.remove('s15-copy-flash'), 600);
    }).catch(() => toast('Impossible de copier', 'error'));
  });

  // Rend copiables les éléments correspondant à certains patterns

  /* ============================================================
     6. RECHERCHE GLOBALE Ctrl+K
     ============================================================ */
  function buildSearchIndex() {
    const clients = load(LS.clients).map(c => ({ type:'client', id:c.id, label:c.nom||'(sans nom)', sub: (c.siren||c.email||c.ville||''), obj:c }));
    const livs = load(LS.livraisons).map(l => ({ type:'livraison', id:l.id, label:l.num_liv||l.numLiv||l.numero||'(sans N°)', sub: (l.client||'')+' · '+fmtDate(l.date), obj:l }));
    const factures = load(LS.factures).map(f => ({ type:'facture', id:f.id, label:f.numero||'(sans N°)', sub: (f.client||'')+' · '+fmtEur(f.totalTTC||f.total||0), obj:f }));
    const paiements = load(LS.paiements).map(p => ({ type:'paiement', id:p.id, label:'Paiement '+(p.numero||p.id?.slice(-4)||''), sub: fmtEur(p.montant||0)+' · '+fmtDate(p.date), obj:p }));
    return [...clients, ...livs, ...factures, ...paiements];
  }

  function openPalette() {
    let modal = document.getElementById('s15-palette');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 's15-palette';
      modal.className = 's15-palette-overlay';
      modal.innerHTML = ''
        + '<div class="s15-palette-box" role="dialog" aria-label="Recherche globale">'
        + '  <div class="s15-palette-header">'
        + '    <span style="font-size:1.2rem">🔍</span>'
        + '    <input type="text" id="s15-palette-input" placeholder="Rechercher client, facture, livraison, paiement…" autocomplete="off" />'
        + '    <kbd class="s15-palette-kbd">Esc</kbd>'
        + '  </div>'
        + '  <div class="s15-palette-results" id="s15-palette-results"></div>'
        + '  <div class="s15-palette-footer"><kbd>↑↓</kbd> naviguer · <kbd>↵</kbd> ouvrir · <kbd>Ctrl+K</kbd> fermer</div>'
        + '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closePalette(); });
      const input = modal.querySelector('#s15-palette-input');
      input.addEventListener('input', refreshPaletteResults);
      input.addEventListener('keydown', handlePaletteKey);
    }
    modal.classList.add('open');
    const input = modal.querySelector('#s15-palette-input');
    input.value = '';
    refreshPaletteResults();
    setTimeout(()=>input.focus(), 30);
  }
  function closePalette() {
    const modal = document.getElementById('s15-palette');
    if (modal) modal.classList.remove('open');
  }
  let _paletteSel = 0;
  function refreshPaletteResults() {
    const q = (document.getElementById('s15-palette-input')?.value || '').toLowerCase().trim();
    const box = document.getElementById('s15-palette-results');
    if (!box) return;
    const idx = buildSearchIndex();
    const filt = !q ? idx.slice(0, 20) : idx.filter(r => (r.label+' '+r.sub).toLowerCase().includes(q)).slice(0, 30);
    _paletteSel = 0;
    if (!filt.length) { box.innerHTML = '<div class="s15-palette-empty">Aucun résultat pour "'+escHtml(q)+'"</div>'; return; }
    const icons = { client:'👤', livraison:'📦', facture:'📄', paiement:'💰' };
    box.innerHTML = filt.map((r,i) => '<div class="s15-palette-item'+(i===0?' selected':'')+'" data-idx="'+i+'" data-type="'+r.type+'" data-id="'+escHtml(r.id||'')+'">'
      + '<span class="s15-palette-icon">'+icons[r.type]+'</span>'
      + '<span class="s15-palette-lbl"><strong>'+escHtml(r.label)+'</strong>'
      + (r.sub ? '<span class="s15-palette-sub">'+escHtml(r.sub)+'</span>' : '')
      + '</span>'
      + '<span class="s15-palette-type">'+r.type+'</span>'
      + '</div>').join('');
    box.querySelectorAll('.s15-palette-item').forEach(it => {
      it.addEventListener('click', () => { _paletteSel = parseInt(it.dataset.idx, 10); activatePaletteItem(filt); });
      it.addEventListener('mouseenter', () => { _paletteSel = parseInt(it.dataset.idx, 10); updatePaletteSelection(); });
    });
    box.__filt = filt;
  }
  function updatePaletteSelection() {
    const box = document.getElementById('s15-palette-results');
    if (!box) return;
    box.querySelectorAll('.s15-palette-item').forEach((it,i) => it.classList.toggle('selected', i === _paletteSel));
    const sel = box.querySelector('.s15-palette-item.selected');
    sel?.scrollIntoView({ block:'nearest' });
  }
  function handlePaletteKey(e) {
    const box = document.getElementById('s15-palette-results');
    const filt = box?.__filt || [];
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); _paletteSel = Math.min(filt.length-1, _paletteSel+1); updatePaletteSelection(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _paletteSel = Math.max(0, _paletteSel-1); updatePaletteSelection(); }
    else if (e.key === 'Enter') { e.preventDefault(); activatePaletteItem(filt); }
  }
  function activatePaletteItem(filt) {
    const r = filt[_paletteSel]; if (!r) return;
    closePalette();
    const navTo = (page, cb) => { if (typeof window.naviguerVers === 'function') window.naviguerVers(page); if (cb) setTimeout(cb, 160); };
    if (r.type === 'client') navTo('clients', () => { if (typeof window.ouvrirHistoriqueClient === 'function') window.ouvrirHistoriqueClient(r.id); });
    else if (r.type === 'livraison') navTo('livraisons', () => { const row = document.querySelector('[data-livraison-id="'+r.id+'"]'); row?.scrollIntoView({behavior:'smooth',block:'center'}); row?.classList.add('s15-pulse'); setTimeout(()=>row?.classList.remove('s15-pulse'), 1500); });
    else if (r.type === 'facture') navTo('facturation', () => { toast('Facture '+r.label, 'info'); });
    else if (r.type === 'paiement') navTo('encaissements');
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const modal = document.getElementById('s15-palette');
      if (modal?.classList.contains('open')) closePalette(); else openPalette();
    }
  });

  /* ============================================================
     7. HISTORIQUE MODIFICATIONS (factures / livraisons / clients)
     ============================================================ */
  function logChange(entity, entityId, field, oldV, newV, label) {
    const log = load(LS.history);
    log.push({
      id: genId(), entity, entityId, field, oldValue: oldV, newValue: newV, label,
      date: new Date().toISOString()
    });
    // cap at 2000 entries
    if (log.length > 2000) log.splice(0, log.length - 2000);
    save(LS.history, log);
  }
  window.logChange = logChange;

  // Hook confirmerEditClient (Sprint 13)
  if (typeof window.confirmerEditClient === 'function' && !window.confirmerEditClient.__s15) {
    const orig = window.confirmerEditClient;
    const w = function() {
      // Phase 91.44 (Agent Clients H5) — fix id selector (était edit-client-id, HTML utilise edit-cl-id)
      const id = (document.getElementById('edit-cl-id')?.value) || (document.getElementById('edit-client-id')?.value) || '';
      const before = load(LS.clients).find(c => c.id === id);
      const r = orig.apply(this, arguments);
      const after = load(LS.clients).find(c => c.id === id);
      if (before && after) {
        ['nom','siren','tvaIntra','email','emailFact','telephone','adresse','delaiPaiementJours','type'].forEach(k => {
          if (String(before[k]||'') !== String(after[k]||'')) logChange('client', id, k, before[k], after[k], after.nom||'Client');
        });
      }
      return r;
    };
    w.__s15 = true;
    window.confirmerEditClient = w;
  }




  /* ============================================================
     INIT
     ============================================================ */
  // Note : hookFacturationPostProcess et hookDashboardS15 supprimés —
  // ils patchaient afficherFacturation et afficherDashboard qui n'existent
  // pas (commit 09dc43e). Le typeof check rendait les hooks toujours no-op.
  function initS15() {
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initS15);
  else setTimeout(initS15, 90);
})();
