/* ==========================================================================
   MCA Logistics — Mobile App (m.html) bootstrap + router
   v1 : shell + Dashboard pilote. Les autres onglets sont des stubs avec
   bouton "Voir version PC" pour acceder a la fonctionnalite complete.
   ========================================================================== */

(function () {
  'use strict';

  // ============================================================
  // Namespace + helpers
  // ============================================================
  const M = window.MCAm = {};
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  M.state = {
    currentPage: null,
    theme: localStorage.getItem('mca_mobile_theme') || 'dark',
    backStack: [],
    // Detail navigation : pour les onglets read+detail (clients, vehicules, salaries)
    // M.state.detail.clients = id du client en cours de visualisation, null si liste
    detail: { clients: null, vehicules: null, salaries: null },
  };

  // localStorage helpers (memes cles que desktop : on partage les donnees)
  M.charger = function(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (_) { return []; }
  };
  M.chargerObj = function(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  };
  M.sauvegarder = function(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Force flush Supabase immediat (au lieu d'attendre les 500ms du debounce)
      // -> rend la sync mobile->PC quasi instantanee.
      if (window.DelivProRemoteStorage?.flush) {
        window.DelivProRemoteStorage.flush().catch(() => {});
      }
      return true;
    } catch (_) { return false; }
  };

  // BUGFIX v3.64 : YYYY-MM en heure LOCALE.
  // toISOString() convertit en UTC -> new Date(2026,4,1) (= 1 mai local) devient
  // "2026-04-30T22:00:00Z" en France (UTC+2 ete) -> slice(0,7) = "2026-04".
  // Resultat : dropdowns mois affichaient "Mai 2026" avec value="2026-04",
  // donc selectionner "Mai" filtrait sur avril. Bug TVA reproductible :
  // mai charges (GOOGLE+PENNYLANE = 19,85 EUR) disparaissaient au profit de
  // la charge HOSTINGER d'avril (4,40 EUR) apres un changement de mois.
  // moisKey() sur les Date "midnight local" et sur new Date() courant donne
  // toujours le bon mois local, independamment du fuseau.
  M.moisKey = function(d) {
    var dt = (d instanceof Date) ? d : new Date();
    var y = dt.getFullYear();
    var m = dt.getMonth() + 1;
    return y + '-' + (m < 10 ? '0' + m : '' + m);
  };

  // ============================================================
  // Migration silencieuse au boot : harmonise les schemas mobile <-> PC
  // PC utilise vehId/chaufId, mobile a historiquement utilise vehiculeId/salarieId.
  // On copie les valeurs dans les deux sens pour que les anciennes saisies mobile
  // remontent cote PC (et inverse). Idempotente, pas de risque a re-executer.
  // ============================================================
  M.migrerSchemas = function() {
    const migrer = (key, mappings) => {
      const arr = M.charger(key);
      let changed = false;
      arr.forEach(item => {
        mappings.forEach(([a, b]) => {
          if (item[a] && !item[b]) { item[b] = item[a]; changed = true; }
          else if (item[b] && !item[a]) { item[a] = item[b]; changed = true; }
        });
      });
      if (changed) M.sauvegarder(key, arr);
    };
    // livraisons : vehiculeId<->vehId, salarieId<->chaufId
    migrer('livraisons', [['vehiculeId', 'vehId'], ['salarieId', 'chaufId']]);
    // carburant + entretiens + inspections : vehiculeId<->vehId
    migrer('carburant',   [['vehiculeId', 'vehId']]);
    migrer('entretiens',  [['vehiculeId', 'vehId']]);
    migrer('inspections', [['vehiculeId', 'vehId']]);
    // incidents : salId<->chaufId
    migrer('incidents',   [['salId', 'chaufId']]);
    // heures : salarieId<->salId (already dual mais on garantit)
    migrer('heures',      [['salarieId', 'salId'], ['vehiculeId', 'vehId']]);
    // charges : montantHt<->montantHT (casse), tauxTva<->tauxTVA (casse)
    const fixCasseCharges = M.charger('charges');
    let chCh = false;
    fixCasseCharges.forEach(c => {
      if (c.montantHt && !c.montantHT) { c.montantHT = c.montantHt; chCh = true; }
      else if (c.montantHT && !c.montantHt) { c.montantHt = c.montantHT; chCh = true; }
      if (c.tauxTva != null && c.tauxTVA == null) { c.tauxTVA = c.tauxTva; chCh = true; }
      else if (c.tauxTVA != null && c.tauxTva == null) { c.tauxTva = c.tauxTVA; chCh = true; }
    });
    if (chCh) M.sauvegarder('charges', fixCasseCharges);
    // livraisons : tauxTva<->tauxTVA, prix<->prixHT
    const fixCasseLiv = M.charger('livraisons');
    let chLv = false;
    fixCasseLiv.forEach(l => {
      if (l.tauxTva != null && l.tauxTVA == null) { l.tauxTVA = l.tauxTva; chLv = true; }
      else if (l.tauxTVA != null && l.tauxTva == null) { l.tauxTva = l.tauxTVA; chLv = true; }
      if (l.prixHT && !l.prix) { l.prix = l.prixHT; chLv = true; }
      else if (l.prix && !l.prixHT) { l.prixHT = l.prix; chLv = true; }
    });
    if (chLv) M.sauvegarder('livraisons', fixCasseLiv);
    // entretiens : cout<->coutHt
    const fixEnt = M.charger('entretiens');
    let chEn = false;
    fixEnt.forEach(e => {
      if (e.coutHt != null && e.cout == null) { e.cout = e.coutHt; chEn = true; }
      else if (e.cout != null && e.coutHt == null) { e.coutHt = e.cout; chEn = true; }
      if (e.tauxTva != null && e.tauxTVA == null) { e.tauxTVA = e.tauxTva; chEn = true; }
      else if (e.tauxTVA != null && e.tauxTva == null) { e.tauxTva = e.tauxTVA; chEn = true; }
    });
    if (chEn) M.sauvegarder('entretiens', fixEnt);
  };

  // Generation d'ID stable (UUID si dispo, fallback timestamp+random).
  // Le prefixe 'm-' permet de tracer les entrees creees depuis mobile (debug).
  M.genId = function() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  };

  // Native confirm wrapper (pour parite UX avec confirmDialog desktop, sans ses styles)
  M.confirm = function(message, opts = {}) {
    const titre = opts.titre ? opts.titre + '\n\n' : '';
    return Promise.resolve(window.confirm(titre + message));
  };

  // Dialog recurrence : ouvre un overlay au-dessus de la sheet courante.
  // Demande "Tous les X jours, pendant Y occurrences". Resoud { interval, count }
  // ou null si annule.
  M.dialogRecurrence = function(opts = {}) {
    return new Promise(resolve => {
      document.querySelector('.m-rec-dialog')?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'm-rec-dialog';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div style="background:var(--m-card);border-radius:18px;padding:22px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)">
          <div style="font-weight:700;font-size:1.05rem;margin-bottom:6px">🔁 Créer une récurrence</div>
          <div style="font-size:.84rem;color:var(--m-text-muted);margin-bottom:18px">${M.escHtml(opts.sousTitre || 'Duplique cet élément à intervalle régulier.')}</div>
          <div class="m-form-row" style="margin-bottom:14px">
            <div class="m-form-field" style="margin-bottom:0">
              <label class="m-form-label">Tous les</label>
              <select id="m-rec-interval">
                <option value="1">1 jour (quotidien)</option>
                <option value="7" selected>7 jours (hebdo)</option>
                <option value="14">14 jours (quinzaine)</option>
                <option value="30">30 jours (mensuel)</option>
                <option value="90">90 jours (trimestre)</option>
              </select>
            </div>
            <div class="m-form-field" style="margin-bottom:0">
              <label class="m-form-label">Pendant</label>
              <select id="m-rec-count">
                <option value="2">2 occurrences</option>
                <option value="4" selected>4 occurrences</option>
                <option value="6">6 occurrences</option>
                <option value="8">8 occurrences</option>
                <option value="12">12 occurrences</option>
                <option value="24">24 occurrences</option>
                <option value="52">52 occurrences</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="m-btn" id="m-rec-cancel" style="flex:1">Annuler</button>
            <button type="button" class="m-btn m-btn-primary" id="m-rec-ok" style="flex:1">Créer</button>
          </div>
        </div>
      `;
      const close = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('#m-rec-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('#m-rec-ok').addEventListener('click', () => {
        const interval = parseInt(overlay.querySelector('#m-rec-interval').value, 10) || 7;
        const count = parseInt(overlay.querySelector('#m-rec-count').value, 10) || 4;
        close({ interval, count });
      });
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      document.body.appendChild(overlay);
    });
  };

  // Dialog liste de choix (radio) : ouvre overlay avec liste d'options.
  // Resoud la valeur sélectionnée ou null si annulé.
  // ============================================================
  // FACTORY PÉRIODES (jour / semaine / mois / année + nav)
  // M.state.periodes[scope] = { mode: 'mois', offset: 0 }
  // ============================================================
  M.state.periodes = M.state.periodes || {};

  // Calcule { debut, fin, label, datesLabel } pour un (mode, offset).
  // mode='jour'|'semaine'|'mois'|'annee', offset=0 (courant), -1, +1, etc.
  M.computePeriodeRange = function(mode, offset) {
    const now = new Date();
    const off = offset || 0;
    const fmtDate = d => d.toISOString().slice(0, 10);
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    if (mode === 'jour') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      const iso = fmtDate(d);
      const lbl = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      return { mode, debut: iso, fin: iso, label: cap(lbl), datesLabel: '' };
    }
    if (mode === 'semaine') {
      // Lundi = jour 1 (FR ISO). Date.getDay() : 0=dim, 1=lun, ..., 6=sam.
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off * 7);
      const dayOfWeek = (today.getDay() + 6) % 7; // 0=lun, 6=dim
      const debut = new Date(today); debut.setDate(today.getDate() - dayOfWeek);
      const fin = new Date(debut); fin.setDate(debut.getDate() + 6);
      const debutISO = fmtDate(debut), finISO = fmtDate(fin);
      // ISO 8601 : numéro de semaine (jeudi de la semaine courante)
      const jeudi = new Date(debut); jeudi.setDate(debut.getDate() + 3);
      const an1Janvier = new Date(jeudi.getFullYear(), 0, 1);
      const numSem = Math.ceil((((jeudi - an1Janvier) / 86400000) + 1) / 7);
      return { mode, debut: debutISO, fin: finISO,
        label: 'Sem. ' + numSem + ' · ' + jeudi.getFullYear(),
        datesLabel: debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' → ' + fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) };
    }
    if (mode === 'annee') {
      const an = now.getFullYear() + off;
      return { mode, debut: an + '-01-01', fin: an + '-12-31', label: String(an), datesLabel: '' };
    }
    // mois (default)
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return { mode: 'mois', debut: fmtDate(d), fin: fmtDate(fin), label: cap(lbl), datesLabel: '' };
  };

  // Resoud le range courant pour un scope. Crée le state si absent.
  M.periodeRange = function(scope, defMode) {
    const st = M.state.periodes[scope] || (M.state.periodes[scope] = { mode: defMode || 'mois', offset: 0 });
    return M.computePeriodeRange(st.mode, st.offset);
  };

  // Render barre période : chips Jour/Sem/Mois/An + nav prev/today/next + label.
  M.renderPeriodeBar = function(scope, defMode) {
    const st = M.state.periodes[scope] || (M.state.periodes[scope] = { mode: defMode || 'mois', offset: 0 });
    const r = M.computePeriodeRange(st.mode, st.offset);
    const modes = [['jour','Jour'],['semaine','Sem.'],['mois','Mois'],['annee','An']];
    return `
      <div class="m-periode-bar" style="margin-bottom:14px">
        <div style="display:flex;gap:4px;margin-bottom:8px">
          ${modes.map(([m,l]) => `<button class="m-alertes-chip ${st.mode===m?'active':''}" data-pmode="${m}" data-pscope="${scope}" style="flex:1 1 0;font-size:.75rem;padding:6px 4px;min-height:0;height:30px">${l}</button>`).join('')}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="m-btn" data-pnav="-1" data-pscope="${scope}" style="width:36px;height:34px;padding:0;font-size:.85rem">‹</button>
          <div style="flex:1 1 auto;text-align:center;line-height:1.2">
            <div style="font-weight:600;font-size:.85rem">${M.escHtml(r.label)}</div>
            ${r.datesLabel ? `<div style="font-size:.7rem;color:var(--m-text-muted)">${M.escHtml(r.datesLabel)}</div>` : ''}
          </div>
          ${st.offset !== 0 ? `<button class="m-btn" data-preset="1" data-pscope="${scope}" style="padding:0 8px;height:34px;font-size:.7rem">Auj.</button>` : ''}
          <button class="m-btn" data-pnav="1" data-pscope="${scope}" style="width:36px;height:34px;padding:0;font-size:.85rem">›</button>
        </div>
      </div>`;
  };

  // Wire les events de la barre (chips + nav). refreshFn est le callback
  // de re-render (typiquement () => M.go('page')).
  M.wirePeriodeBar = function(container, scope, refreshFn) {
    const st = M.state.periodes[scope];
    if (!st) return;
    container.querySelectorAll(`[data-pscope="${scope}"][data-pmode]`).forEach(b =>
      b.addEventListener('click', () => { st.mode = b.dataset.pmode; st.offset = 0; refreshFn(); }));
    container.querySelectorAll(`[data-pscope="${scope}"][data-pnav]`).forEach(b =>
      b.addEventListener('click', () => { st.offset += parseInt(b.dataset.pnav, 10); refreshFn(); }));
    container.querySelector(`[data-pscope="${scope}"][data-preset]`)
      ?.addEventListener('click', () => { st.offset = 0; refreshFn(); });
  };

  M.dialogChoix = function(opts = {}) {
    return new Promise(resolve => {
      document.querySelector('.m-choix-dialog')?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'm-choix-dialog';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div style="background:var(--m-card);border-radius:18px;padding:18px;max-width:380px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
          <div style="font-weight:700;font-size:1.05rem;margin-bottom:6px">${M.escHtml(opts.titre || 'Choisir')}</div>
          ${opts.sousTitre ? `<div style="font-size:.84rem;color:var(--m-text-muted);margin-bottom:14px">${M.escHtml(opts.sousTitre)}</div>` : '<div style="margin-bottom:10px"></div>'}
          <div style="display:flex;flex-direction:column;gap:6px">
            ${(opts.options || []).map(o => `
              <button type="button" class="m-choix-opt" data-val="${M.escHtml(o.value)}" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid ${o.value === opts.defaut ? 'var(--m-accent)' : 'var(--m-border)'};border-radius:10px;background:${o.value === opts.defaut ? 'var(--m-accent-soft)' : 'transparent'};color:inherit;cursor:pointer;text-align:left;font-family:inherit;font-size:.92rem">
                <span style="font-size:1.1rem">${o.value === opts.defaut ? '●' : '○'}</span>
                <span style="flex:1 1 auto">${M.escHtml(o.label)}</span>
              </button>
            `).join('')}
          </div>
          <button type="button" class="m-btn" id="m-choix-cancel" style="margin-top:14px;width:100%">Annuler</button>
        </div>
      `;
      const close = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelectorAll('.m-choix-opt').forEach(b => b.addEventListener('click', () => close(b.dataset.val)));
      overlay.querySelector('#m-choix-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      document.body.appendChild(overlay);
    });
  };

  // Dialog "Choisir une date" : ouvre un overlay avec un input date.
  // Resoud { date: 'YYYY-MM-DD' } ou null si annule.
  M.dialogChoisirDate = function(opts = {}) {
    return new Promise(resolve => {
      document.querySelector('.m-date-dialog')?.remove();
      const today = new Date().toISOString().slice(0, 10);
      const valDef = opts.defaut || today;
      const overlay = document.createElement('div');
      overlay.className = 'm-date-dialog';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `
        <div style="background:var(--m-card);border-radius:18px;padding:22px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4)">
          <div style="font-weight:700;font-size:1.05rem;margin-bottom:6px">${M.escHtml(opts.titre || '📅 Choisir une date')}</div>
          ${opts.sousTitre ? `<div style="font-size:.84rem;color:var(--m-text-muted);margin-bottom:16px">${M.escHtml(opts.sousTitre)}</div>` : '<div style="margin-bottom:14px"></div>'}
          <div class="m-form-field" style="margin-bottom:18px">
            <label class="m-form-label">${M.escHtml(opts.labelDate || 'Date')}</label>
            <input type="date" id="m-date-dialog-input" value="${valDef}" />
          </div>
          <div style="display:flex;gap:10px">
            <button type="button" class="m-btn" id="m-date-dialog-cancel" style="flex:1">Annuler</button>
            <button type="button" class="m-btn m-btn-primary" id="m-date-dialog-ok" style="flex:1">${M.escHtml(opts.btnOk || 'Valider')}</button>
          </div>
        </div>
      `;
      const close = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('#m-date-dialog-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('#m-date-dialog-ok').addEventListener('click', () => {
        const d = overlay.querySelector('#m-date-dialog-input').value || today;
        close({ date: d });
      });
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      document.body.appendChild(overlay);
      // Auto-focus le picker
      setTimeout(() => overlay.querySelector('#m-date-dialog-input')?.focus(), 50);
    });
  };

  // Cree N copies de l'item source en decalant la date de intervalDays.
  // entityKey : 'livraisons' | 'charges' | 'carburant' | etc.
  // dateField : nom du champ date (def 'date')
  // transform(copy, i) : optionnel, mutation custom de chaque copie (regen numLiv, reset statut...)
  M.creerRecurrence = async function(entityKey, sourceId, opts = {}) {
    const arr = M.charger(entityKey);
    const source = arr.find(x => x.id === sourceId);
    if (!source) { M.toast('⚠️ Élément source introuvable'); return false; }
    const params = await M.dialogRecurrence({ sousTitre: opts.sousTitre });
    if (!params) return false;
    const { interval, count } = params;
    const dateField = opts.dateField || 'date';
    const baseDateStr = source[dateField] || new Date().toISOString().slice(0, 10);
    const baseDate = new Date(baseDateStr);
    const ajoutees = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i * interval);
      const copy = {
        ...source,
        id: M.genId(),
        creeLe: new Date().toISOString(),
        modifieLe: undefined,
        [dateField]: d.toISOString().slice(0, 10),
      };
      delete copy.modifieLe;
      if (typeof opts.transform === 'function') opts.transform(copy, i);
      arr.push(copy);
      ajoutees.push(copy);
    }
    M.sauvegarder(entityKey, arr);
    M.toast(`🔁 ${count} occurrence${count>1?'s':''} créée${count>1?'s':''}`);
    return ajoutees;
  };

  // Formatters
  M.format$ = (n) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  M.formatNum = (n) => (Number(n) || 0).toLocaleString('fr-FR');
  M.formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  M.escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Toast
  let toastTimer = null;
  M.toast = function(message, opts = {}) {
    const el = $('#m-toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, opts.duration || 2500);
  };

  // ============================================================
  // Auth check
  // ============================================================
  M.verifierAuth = function() {
    // Reuse desktop's auth : sessionStorage 'admin_login' ou 'salarie_id'
    const adminLogin = sessionStorage.getItem('admin_login');
    if (!adminLogin) {
      window.location.replace('login.html');
      return false;
    }
    return true;
  };

  // ============================================================
  // Theme toggle
  // ============================================================
  M.applyTheme = function() {
    const body = document.body;
    body.classList.toggle('m-theme-light', M.state.theme === 'light');
    body.classList.toggle('m-theme-dark',  M.state.theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', M.state.theme === 'light' ? '#ffffff' : '#0d1524');
  };
  M.toggleTheme = function() {
    M.state.theme = M.state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('mca_mobile_theme', M.state.theme);
    M.applyTheme();
    M.closeDrawer();
    M.toast(`Mode ${M.state.theme === 'light' ? 'clair' : 'sombre'} activé`);
  };

  // ============================================================
  // Bottom sheet (saisie rapide)
  // opts = { title, body (HTML string), submitLabel?, onSubmit (returns true/Promise to close, false to keep open), afterMount? }
  // ============================================================
  M._sheetCtx = null;

  M.openSheet = function(opts) {
    M._sheetCtx = opts || {};
    $('#m-sheet-title').textContent = opts.title || '—';
    $('#m-sheet-body').innerHTML = opts.body || '';
    $('#m-sheet-submit').textContent = opts.submitLabel || 'Enregistrer';
    $('#m-sheet-overlay').hidden = false;
    requestAnimationFrame(() => {
      $('#m-sheet-overlay').classList.add('open');
      $('#m-sheet').classList.add('open');
      $('#m-sheet').setAttribute('aria-hidden', 'false');
    });
    if (typeof opts.afterMount === 'function') {
      try { opts.afterMount($('#m-sheet-body')); }
      catch (err) {
        console.error('[mobile] afterMount error:', err);
        M.toast('⚠️ Erreur affichage form : ' + (err?.message || 'voir console'), { duration: 5000 });
      }
    }
    // Focus sur le premier input pour saisie immediate
    setTimeout(() => {
      const firstInput = $('#m-sheet-body').querySelector('input:not([type=hidden]),select,textarea');
      // On ne focus pas auto sur mobile pour eviter le saut clavier intempestif ; le user tape sur le champ qu'il veut.
      // (laisser firstInput non utilise volontairement)
    }, 80);
  };

  M.closeSheet = function() {
    $('#m-sheet-overlay').classList.remove('open');
    $('#m-sheet').classList.remove('open');
    $('#m-sheet').setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      $('#m-sheet-overlay').hidden = true;
      $('#m-sheet-body').innerHTML = '';
    }, 320);
    M._sheetCtx = null;
  };

  M.submitSheet = async function() {
    if (!M._sheetCtx) return;
    if (typeof M._sheetCtx.onSubmit !== 'function') { M.closeSheet(); return; }
    try {
      const ok = await Promise.resolve(M._sheetCtx.onSubmit($('#m-sheet-body')));
      if (ok !== false) M.closeSheet();
    } catch (err) {
      console.error('[mobile] onSubmit error:', err);
      M.toast('⚠️ Erreur enregistrement : ' + (err?.message || 'voir console'), { duration: 5000 });
    }
  };

  // ============================================================
  // Form helpers (HTML templates partages)
  // ============================================================
  M.formField = function(label, html, opts = {}) {
    return `<div class="m-form-field">
      <label class="m-form-label${opts.required ? ' m-form-label-required' : ''}">${M.escHtml(label)}</label>
      ${html}
      ${opts.hint ? `<p class="m-form-hint">${M.escHtml(opts.hint)}</p>` : ''}
    </div>`;
  };

  M.formInput = function(name, opts = {}) {
    const type = opts.type || 'text';
    const value = opts.value != null ? String(opts.value) : '';
    const ph = opts.placeholder || '';
    const step = opts.step ? `step="${opts.step}"` : '';
    const min = opts.min != null ? `min="${opts.min}"` : '';
    // iOS clavier FR : input[type=number] n'accepte pas la virgule decimale.
    // Pour les nombres on bascule en type=text + inputmode=decimal -> clavier
    // numerique iOS qui propose ", . -" au lieu de bloquer. Le parsing M.parseNum
    // gere les deux separateurs cote save.
    const isNum = type === 'number';
    const realType = isNum ? 'text' : type;
    const inputmode = isNum ? 'inputmode="decimal" pattern="[0-9.,]*"' : '';
    return `<input type="${realType}" ${inputmode} name="${M.escHtml(name)}" placeholder="${M.escHtml(ph)}" value="${M.escHtml(value)}" ${step} ${min} ${opts.required ? 'required' : ''} ${opts.autocomplete ? `autocomplete="${opts.autocomplete}"` : ''} />`;
  };

  // Parse un nombre en acceptant virgule OU point (clavier FR / EN)
  M.parseNum = function(v) {
    if (v == null || v === '') return 0;
    const s = String(v).replace(/\s/g, '').replace(',', '.');
    const n = Number.parseFloat(s);  // Number.parseFloat (immune au sed parseFloat -> M.parseNum)
    return isNaN(n) ? 0 : n;
  };

  M.formInputWithSuffix = function(name, suffix, opts = {}) {
    return `<div class="m-form-input-suffix">${M.formInput(name, opts)}<span class="m-form-input-suffix-text">${M.escHtml(suffix)}</span></div>`;
  };

  M.formSelect = function(name, options, opts = {}) {
    const sel = opts.value || '';
    return `<select name="${M.escHtml(name)}" ${opts.required ? 'required' : ''}>
      ${opts.placeholder ? `<option value="" ${!sel ? 'selected' : ''} disabled>${M.escHtml(opts.placeholder)}</option>` : ''}
      ${options.map(o => {
        const val = typeof o === 'object' ? o.value : o;
        const lab = typeof o === 'object' ? o.label : o;
        return `<option value="${M.escHtml(val)}" ${val === sel ? 'selected' : ''}>${M.escHtml(lab)}</option>`;
      }).join('')}
    </select>`;
  };

  M.formTextarea = function(name, opts = {}) {
    const value = opts.value != null ? String(opts.value) : '';
    const rows = opts.rows || 3;
    const ph = opts.placeholder || '';
    return `<textarea name="${M.escHtml(name)}" rows="${rows}" placeholder="${M.escHtml(ph)}" style="resize:vertical;min-height:${rows * 24 + 24}px">${M.escHtml(value)}</textarea>`;
  };

  // Utilitaire : extrait les valeurs d'un formulaire dans le sheet body
  M.lireFormSheet = function() {
    const body = $('#m-sheet-body');
    if (!body) return {};
    const out = {};
    body.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.name) return;
      // Checkboxes : on lit el.checked (boolean), pas el.value (qui est "on" par defaut)
      if (el.type === 'checkbox') { out[el.name] = !!el.checked; return; }
      // Radios : on ne garde que celle qui est cochee
      if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; return; }
      out[el.name] = el.value;
    });
    return out;
  };

  // ============================================================
  // Saisies (v2.4 : visuel uniquement, submit = toast "a venir v2.5")
  // ============================================================
  M.formNouvelleLivraison = function(existing) {
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const salaries = M.charger('salaries').filter(s => s && s.statut !== 'inactif' && !s.archive);
    const today = new Date().toISOString().slice(0, 10);
    const enEdition = !!existing;
    const v = existing || {};

    const body = `
      ${M.formField('Client', M.formInput('client', { value: v.client || '', placeholder: 'Nom du client', required: true, autocomplete: 'off' }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: v.date || today, required: true }), { required: true })}
        ${M.formField('N° livraison', M.formInput('numLiv', { value: v.numLiv || '', placeholder: 'Auto si vide' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Prix HT', M.formInputWithSuffix('prixHT', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: v.prixHT || v.prix || '', required: true }), { required: true })}
        ${M.formField('Taux TVA', M.formSelect('tauxTva', [
          { value: '0',    label: '0% (exonéré)' },
          { value: '5.5',  label: '5,5%' },
          { value: '10',   label: '10%' },
          { value: '20',   label: '20%' }
        ], { value: String(v.tauxTva ?? 20) }))}
      </div>
      <div class="m-form-row">
        ${M.formField('TVA', M.formInputWithSuffix('tva', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: v.tva || '' }))}
        ${M.formField('Prix TTC', M.formInputWithSuffix('prixTTC', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: v.prixTTC || '' }))}
      </div>
      ${M.formField('Distance', M.formInputWithSuffix('distance', 'km', { type: 'number', step: '0.1', min: '0', placeholder: '0', value: v.distance || '' }))}
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(x => ({ value: x.id, label: x.immat || x.immatriculation || x.id })), { placeholder: 'Choisir un véhicule', value: v.vehiculeId || '' }))}
      ${M.formField('Chauffeur', M.formSelect('salarieId', salaries.map(s => ({ value: s.id, label: s.nom || s.id })), { placeholder: 'Choisir un chauffeur', value: v.salarieId || '' }))}
      <div class="m-form-row">
        ${M.formField('Statut', M.formSelect('statut', [
          { value: 'en-attente', label: 'En attente' },
          { value: 'en-cours',   label: 'En cours' },
          { value: 'livre',      label: 'Livré' }
        ], { value: v.statut || 'livre' }))}
        ${M.formField('Mode paiement', M.formSelect('modePaiement', [
          { value: '',         label: '—' },
          { value: 'virement', label: 'Virement' },
          { value: 'especes',  label: 'Espèces' },
          { value: 'cheque',   label: 'Chèque' },
          { value: 'cb',       label: 'Carte bancaire' }
        ], { value: v.modePaiement || v.mode_paiement || '' }))}
      </div>
      ${M.formField('Heure de début', M.formInput('heureDebut', { type: 'time', value: v.heureDebut || v.heure_debut || '' }))}
      ${M.formField('Zone / tournée', M.formInput('zone', { value: v.zone || '', placeholder: 'Ex: Île-de-France' }))}
      ${M.formField('Notes internes', M.formTextarea('notes', { value: v.notes || '', rows: 2, placeholder: 'Remarques sur la livraison' }))}

      <!-- LETTRE DE VOITURE (LDV) - section collapsible -->
      <details style="margin-top:14px;border:1px solid var(--m-border);border-radius:12px;padding:0;overflow:hidden" ${(v.expNom || v.destNom || v.marchNature) ? 'open' : ''}>
        <summary style="padding:14px;background:var(--m-bg-elevated);cursor:pointer;font-weight:600;font-size:.95rem">🧾 Lettre de voiture (LDV)</summary>
        <div style="padding:14px">
          <div style="font-size:.78rem;color:var(--m-text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Expéditeur</div>
          ${M.formField('Nom / Raison sociale', M.formInput('expNom', { value: v.expNom || '', placeholder: 'Société expéditeur' }))}
          ${M.formField('Contact', M.formInput('expContact', { value: v.expContact || '', placeholder: 'Nom + tél' }))}
          ${M.formField('Adresse', M.formInput('expAdresse', { value: v.expAdresse || '', placeholder: 'Rue + numéro' }))}
          <div class="m-form-row">
            ${M.formField('CP', M.formInput('expCp', { value: v.expCp || '', placeholder: '75001' }))}
            ${M.formField('Ville', M.formInput('expVille', { value: v.expVille || '', placeholder: 'Paris' }))}
            ${M.formField('Pays', M.formInput('expPays', { value: v.expPays || 'FR', placeholder: 'FR' }))}
          </div>

          <div style="font-size:.78rem;color:var(--m-text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">Destinataire</div>
          ${M.formField('Nom / Raison sociale', M.formInput('destNom', { value: v.destNom || '', placeholder: 'Société destinataire' }))}
          ${M.formField('Contact', M.formInput('destContact', { value: v.destContact || '', placeholder: 'Nom + tél' }))}
          ${M.formField('Adresse', M.formInput('destAdresse', { value: v.destAdresse || '', placeholder: 'Rue + numéro' }))}
          <div class="m-form-row">
            ${M.formField('CP', M.formInput('destCp', { value: v.destCp || '', placeholder: '69003' }))}
            ${M.formField('Ville', M.formInput('destVille', { value: v.destVille || '', placeholder: 'Lyon' }))}
            ${M.formField('Pays', M.formInput('destPays', { value: v.destPays || 'FR', placeholder: 'FR' }))}
          </div>

          <div style="font-size:.78rem;color:var(--m-text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">Marchandise</div>
          ${M.formField('Nature', M.formInput('marchNature', { value: v.marchNature || '', placeholder: 'Palettes alimentaires...' }))}
          <div class="m-form-row">
            ${M.formField('Poids', M.formInputWithSuffix('marchPoids', 'kg', { type: 'number', step: '0.1', min: '0', placeholder: '1500', value: v.marchPoids || '' }))}
            ${M.formField('Volume', M.formInputWithSuffix('marchVolume', 'm³', { type: 'number', step: '0.01', min: '0', placeholder: '12.5', value: v.marchVolume || '' }))}
            ${M.formField('Colis', M.formInputWithSuffix('marchColis', 'u', { type: 'number', step: '1', min: '0', placeholder: '8', value: v.marchColis || '' }))}
          </div>

          <div style="font-size:.78rem;color:var(--m-text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px">Matières dangereuses (ADR)</div>
          <label style="display:flex;align-items:center;gap:8px;padding:10px 0;cursor:pointer">
            <input type="checkbox" name="adrEst" id="m-adr-est" ${v.adrEst ? 'checked' : ''} style="width:auto;min-height:auto" />
            <span>Transport ADR (matières dangereuses)</span>
          </label>
          <div id="m-adr-details" style="display:${v.adrEst ? 'block' : 'none'}">
            <div class="m-form-row">
              ${M.formField('Code ONU', M.formInput('adrOnu', { value: v.adrOnu || '', placeholder: 'UN1202' }))}
              ${M.formField('Classe', M.formInput('adrClasse', { value: v.adrClasse || '', placeholder: '3' }))}
            </div>
            ${M.formField('Groupe emballage', M.formSelect('adrGroupe', [
              { value: '',    label: '—' },
              { value: 'I',   label: 'I' },
              { value: 'II',  label: 'II' },
              { value: 'III', label: 'III' }
            ], { value: v.adrGroupe || '' }))}
          </div>
        </div>
      </details>
      ${enEdition && (v.vehiculeId || v.salarieId) ? `
        <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">
          ${v.vehiculeId ? `<button type="button" class="m-btn" data-goto-veh="${M.escHtml(v.vehiculeId)}" style="flex:1 1 140px">🚐 Fiche véhicule</button>` : ''}
          ${v.salarieId ? `<button type="button" class="m-btn" data-goto-sal="${M.escHtml(v.salarieId)}" style="flex:1 1 140px">👤 Fiche salarié</button>` : ''}
        </div>
      ` : ''}
      ${enEdition ? `
        <div style="display:flex;gap:8px;margin-top:14px">
          <button type="button" class="m-btn" id="m-form-bon" style="flex:1">📄 Bon</button>
          <button type="button" class="m-btn" id="m-form-facture" style="flex:1">🧾 Facture</button>
          <button type="button" class="m-btn" id="m-form-ldv" style="flex:1">📋 LDV</button>
        </div>
        <button type="button" class="m-btn" id="m-form-recurrence" style="margin-top:8px">🔁 Créer une récurrence</button>
        <button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:8px">🗑️ Supprimer cette livraison</button>
      ` : ''}
    `;

    M.openSheet({
      title: enEdition ? '✏️ Modifier livraison' : '➕ Nouvelle livraison',
      body,
      submitLabel: 'Enregistrer',
      afterMount(body) {
        const ht  = body.querySelector('input[name=prixHT]');
        const sel = body.querySelector('select[name=tauxTva]');
        const tva = body.querySelector('input[name=tva]');
        const ttc = body.querySelector('input[name=prixTTC]');
        // Init : si TTC déjà saisi (mode édition), partir de TTC pour ne pas l'écraser
        let dernierEdit = enEdition && (v.prixTTC || v.prix) ? 'ttc' : 'ht';
        const recalc = () => {
          const taux = M.parseNum(sel.value) / 100 || 0;
          if (dernierEdit === 'ttc' && ttc.value) {
            const tt = M.parseNum(ttc.value);
            const hh = taux > 0 ? tt / (1 + taux) : tt;
            ht.value = hh.toFixed(2);
            tva.value = (tt - hh).toFixed(2);
          } else if (ht.value) {
            const hh = M.parseNum(ht.value);
            const tv = hh * taux;
            tva.value = tv.toFixed(2);
            ttc.value = (hh + tv).toFixed(2);
          }
        };
        ht.addEventListener('input', () => { dernierEdit = 'ht'; recalc(); });
        ttc.addEventListener('input', () => { dernierEdit = 'ttc'; recalc(); });
        sel.addEventListener('change', recalc);
        // Toggle section ADR (matieres dangereuses) selon checkbox
        const adrCheck = body.querySelector('#m-adr-est');
        const adrDetails = body.querySelector('#m-adr-details');
        if (adrCheck && adrDetails) {
          adrCheck.addEventListener('change', () => {
            adrDetails.style.display = adrCheck.checked ? 'block' : 'none';
          });
        }
        // Bouton supprimer + recurrence + liens vers entites liees (mode edition)
        if (enEdition) {
          body.querySelector('#m-form-bon')?.addEventListener('click', () => {
            M.closeSheet();
            setTimeout(() => M.genererBonLivraison(v.id), 100);
          });
          body.querySelector('#m-form-facture')?.addEventListener('click', () => {
            M.closeSheet();
            setTimeout(() => M.genererFactureLivraison(v.id), 100);
          });
          body.querySelector('#m-form-ldv')?.addEventListener('click', () => {
            M.closeSheet();
            setTimeout(() => M.genererLDV(v.id), 100);
          });
          body.querySelector('#m-form-recurrence')?.addEventListener('click', async () => {
            const ok = await M.creerRecurrence('livraisons', v.id, {
              sousTitre: `${v.client || 'Livraison'} sera dupliquée à intervalle régulier.`,
              transform: (copy) => {
                copy.numLiv = ''; // re-genere a la sauvegarde
                copy.statut = 'en-attente';
                copy.statutPaiement = 'en-attente';
                delete copy.datePaiement;
                delete copy.dateFacture;
              }
            });
            if (ok) { M.closeSheet(); M.go('livraisons'); }
          });
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            const aFacture = !!(v.factureId || v.factureNumero);
            const msg = aFacture
              ? `Supprimer cette livraison (${v.client || ''}) ?\n\nLa facture archivée ${v.factureNumero || ''} sera aussi annulée.`
              : `Supprimer définitivement cette livraison (${v.client || ''}) ?`;
            if (!await M.confirm(msg, { titre: 'Supprimer livraison' })) return;
            // Annule l'archive de facture (mirror PC annulerArchiveFactureLivraison)
            if (aFacture) {
              try {
                const factures = M.charger('factures_emises');
                const idx = factures.findIndex(f => f.livId === v.id || f.id === v.factureId);
                if (idx >= 0) {
                  factures[idx].statut = 'annulée';
                  factures[idx].annuleeLe = new Date().toISOString();
                  factures[idx].annulationMotif = 'Livraison supprimée';
                  M.sauvegarder('factures_emises', factures);
                }
              } catch (err) { console.warn('[mobile] annule facture', err); }
            }
            M.sauvegarder('livraisons', M.charger('livraisons').filter(x => x.id !== v.id));
            M.ajouterAudit?.('Suppression livraison', (v.client || '') + ' · ' + (v.numLiv || '') + (aFacture ? ' + facture annulée' : ''));
            M.toast('🗑️ Livraison supprimée');
            M.closeSheet();
            M.go('livraisons');
          });
          body.querySelector('[data-goto-veh]')?.addEventListener('click', e => {
            M.closeSheet();
            M.openDetail('vehicules', e.currentTarget.dataset.gotoVeh);
          });
          body.querySelector('[data-goto-sal]')?.addEventListener('click', e => {
            M.closeSheet();
            M.openDetail('salaries', e.currentTarget.dataset.gotoSal);
          });
        }
      },
      onSubmit() {
        const form = M.lireFormSheet();
        const prixHT = M.parseNum(form.prixHT);
        const taux = M.parseNum(form.tauxTva) || 0;
        const tvaMontant = M.parseNum(form.tva) || (prixHT * taux / 100);
        const prixTTC = M.parseNum(form.prixTTC) || (prixHT + tvaMontant);
        // Validation precise : indique exactement le champ manquant
        if (!form.client?.trim()) { M.toast('⚠️ Client requis'); return false; }
        if (!form.date) { M.toast('⚠️ Date requise'); return false; }
        if (!(prixHT > 0)) { M.toast('⚠️ Prix HT > 0 requis'); return false; }
        const arr = M.charger('livraisons');
        // Dual-write : ecrit les conventions PC ET mobile pour rendre la donnee
        // visible des 2 cotes (vehId+vehiculeId, chaufId+salarieId, casses TVA).
        const data = {
          date: form.date,
          client: form.client.trim(),
          prix: prixHT,        // PC lit prix
          prixHT,              // mobile lit prixHT
          prixTTC,
          tauxTva: taux,       // mobile
          tauxTVA: taux,       // PC (casse !)
          tva: tvaMontant,
          distance: M.parseNum(form.distance) || 0,
          vehiculeId: form.vehiculeId || null,  // mobile
          vehId: form.vehiculeId || null,        // PC
          salarieId: form.salarieId || null,    // mobile
          chaufId: form.salarieId || null,       // PC
          statut: form.statut || 'livre',
          modePaiement: form.modePaiement || '',
          mode_paiement: form.modePaiement || '',  // alias PC
          heureDebut: form.heureDebut || '',
          heure_debut: form.heureDebut || '',      // alias PC
          zone: form.zone?.trim() || '',
          notes: form.notes?.trim() || '',
          numLiv: form.numLiv?.trim() || '',
          // Lettre de voiture (LDV)
          expNom: form.expNom?.trim() || '',
          expContact: form.expContact?.trim() || '',
          expAdresse: form.expAdresse?.trim() || '',
          expCp: form.expCp?.trim() || '',
          expVille: form.expVille?.trim() || '',
          expPays: form.expPays?.trim() || 'FR',
          destNom: form.destNom?.trim() || '',
          destContact: form.destContact?.trim() || '',
          destAdresse: form.destAdresse?.trim() || '',
          destCp: form.destCp?.trim() || '',
          destVille: form.destVille?.trim() || '',
          destPays: form.destPays?.trim() || 'FR',
          marchNature: form.marchNature?.trim() || '',
          marchPoids: M.parseNum(form.marchPoids) || 0,
          marchVolume: M.parseNum(form.marchVolume) || 0,
          marchColis: M.parseNum(form.marchColis) || 0,
          adrEst: !!form.adrEst,
          adrOnu: form.adrOnu?.trim() || '',
          adrClasse: form.adrClasse?.trim() || '',
          adrGroupe: form.adrGroupe || ''
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === v.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('livraisons', arr);
          M.toast('✅ Livraison modifiée');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('livraisons', arr);
          M.toast('✅ Livraison enregistrée');
        }
        M.go('livraisons');
        return true;
      }
    });
  };

  // Wrapper : ouvre le form en mode edition pour une livraison existante
  M.editerLivraison = function(id) {
    const liv = M.charger('livraisons').find(x => x.id === id);
    if (!liv) return M.toast('Livraison introuvable');
    M.formNouvelleLivraison(liv);
  };

  // ---- BONS / FACTURES (mobile) ----
  // Affiche un HTML pleine page dans une modal viewer. Bouton "🖨 Imprimer/PDF"
  // qui call iframe.contentWindow.print() -> sheet iOS natif (Save to PDF,
  // AirDrop, Mail, WhatsApp...).
  M.afficherDocHTML = function(html, titre) {
    document.querySelector('.m-doc-html-viewer')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'm-doc-html-viewer';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column';
    overlay.innerHTML = `
      <header style="flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 14px;padding-top:max(12px,env(safe-area-inset-top));background:rgba(0,0,0,.4);color:#fff">
        <div style="flex:1 1 auto;font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(titre || 'Document')}</div>
        <button type="button" class="m-doc-html-print" aria-label="Imprimer" style="flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:0 14px;height:40px;border-radius:20px;background:var(--m-accent);color:#1a1208;border:none;font-size:.85rem;font-weight:700">🖨 Imprimer / PDF</button>
        <button type="button" class="m-doc-html-close" aria-label="Fermer" style="flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;border:none;font-size:1.1rem">✕</button>
      </header>
      <div style="flex:1 1 auto;overflow:auto;background:#fff">
        <iframe srcdoc="${M.escHtml(html)}" style="width:100%;height:100%;border:0;background:#fff" id="m-doc-html-iframe"></iframe>
      </div>
    `;
    const close = () => { overlay.remove(); document.body.style.overflow = ''; };
    overlay.querySelector('.m-doc-html-close').addEventListener('click', close);
    overlay.querySelector('.m-doc-html-print').addEventListener('click', () => {
      const iframe = overlay.querySelector('#m-doc-html-iframe');
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      catch (e) { M.toast('⚠️ Impression bloquée : ' + (e.message || 'inconnu')); }
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  };

  // Genere le HTML d'un bon de livraison ou d'une facture (template mobile-friendly).
  M.genererHtmlBonOuFacture = function(liv, options = {}) {
    const isFact = !!options.facture;
    const config = M.chargerObj('config') || {};
    const ent = config.entreprise || M.chargerObj('entreprise') || {};
    const ttc = M.parseNum(liv.prixTTC) || M.parseNum(liv.prix) || 0;
    const ht = M.parseNum(liv.prixHT) || (M.parseNum(liv.tauxTva || liv.tauxTVA) > 0 ? ttc / (1 + M.parseNum(liv.tauxTva || liv.tauxTVA)/100) : ttc);
    const tva = +(ttc - ht).toFixed(2);
    const tauxTva = M.parseNum(liv.tauxTva || liv.tauxTVA) || 20;
    const fmt$ = (n) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
    const esc = (s) => M.escHtml(s == null ? '' : s);
    const numero = isFact
      ? (liv.factureNumero || ('F-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*9000)+1000)))
      : (liv.numLiv || ('BL-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random()*9000)+1000)));
    const titre = isFact ? 'FACTURE' : 'BON DE LIVRAISON';
    const blocLignes = isFact ? `
      <table style="width:100%;border-collapse:collapse;margin:18px 0">
        <thead><tr style="background:#f8fafc"><th style="padding:10px;text-align:left;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Désignation</th><th style="padding:10px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">HT</th><th style="padding:10px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">TVA ${tauxTva}%</th><th style="padding:10px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">TTC</th></tr></thead>
        <tbody><tr>
          <td style="padding:14px 10px">Prestation transport / livraison${liv.numLiv ? ' (BL ' + esc(liv.numLiv) + ')' : ''}${liv.notes ? '<div style="font-size:.78rem;color:#6b7280;margin-top:4px">' + esc(liv.notes) + '</div>' : ''}</td>
          <td style="padding:14px 10px;text-align:right;font-weight:700">${fmt$(ht)}</td>
          <td style="padding:14px 10px;text-align:right">${fmt$(tva)}</td>
          <td style="padding:14px 10px;text-align:right;font-weight:800">${fmt$(ttc)}</td>
        </tr></tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-bottom:18px"><div style="min-width:280px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fafafa">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Total HT</span><strong>${fmt$(ht)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>TVA ${tauxTva}%</span><strong>${fmt$(tva)}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:1.05rem;border-top:1px solid #d1d5db;padding-top:8px"><span>Total TTC</span><strong style="color:#f59e0b">${fmt$(ttc)}</strong></div>
      </div></div>
    ` : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0">
        ${liv.depart ? `<div style="background:#f9fafb;padding:14px;border-radius:10px"><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Départ</div><div style="font-size:.95rem">${esc(liv.depart)}</div></div>` : ''}
        ${liv.arrivee ? `<div style="background:#f9fafb;padding:14px;border-radius:10px"><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Arrivée</div><div style="font-size:.95rem">${esc(liv.arrivee)}</div></div>` : ''}
      </div>
      ${liv.marchNature || liv.marchPoids || liv.marchVolume || liv.marchColis ? `
        <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:14px;border-radius:6px;margin:18px 0">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#92400e;margin-bottom:8px">Marchandise</div>
          ${liv.marchNature ? `<div><strong>Nature :</strong> ${esc(liv.marchNature)}</div>` : ''}
          <div style="display:flex;gap:14px;margin-top:6px;font-size:.88rem">
            ${liv.marchPoids ? `<span>📦 ${esc(liv.marchPoids)} kg</span>` : ''}
            ${liv.marchVolume ? `<span>📐 ${esc(liv.marchVolume)} m³</span>` : ''}
            ${liv.marchColis ? `<span>🔢 ${esc(liv.marchColis)} colis</span>` : ''}
          </div>
        </div>
      ` : ''}
      <div style="text-align:right;font-size:1.4rem;font-weight:800;color:#f59e0b;margin:18px 0">Total : ${fmt$(ttc)}</div>
    `;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titre} ${esc(numero)}</title>
      <style>
        body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; padding: 24px; max-width: 720px; margin: 0 auto; color: #111827; background: #fff; }
        @media print { body { padding: 12mm; } @page { margin: 12mm; } }
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #f5a623">
        <div>
          <div style="font-size:1.5rem;font-weight:900;color:#f5a623">${esc(ent.nom || 'MCA Logistics')}</div>
          ${ent.adresse ? `<div style="font-size:.82rem;color:#6b7280;margin-top:4px">${esc(ent.adresse)}</div>` : ''}
          ${ent.tel ? `<div style="font-size:.82rem;color:#6b7280">📞 ${esc(ent.tel)}</div>` : ''}
          ${ent.email ? `<div style="font-size:.82rem;color:#6b7280">✉ ${esc(ent.email)}</div>` : ''}
          ${ent.siret ? `<div style="font-size:.78rem;color:#9ca3af;margin-top:4px">SIRET ${esc(ent.siret)}</div>` : ''}
          ${ent.tva ? `<div style="font-size:.78rem;color:#9ca3af">TVA ${esc(ent.tva)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:.78rem;text-transform:uppercase;color:#6b7280;letter-spacing:.06em">${titre}</div>
          <div style="font-size:1.3rem;font-weight:800;color:#f5a623;margin-top:4px">${esc(numero)}</div>
          <div style="font-size:.82rem;color:#6b7280;margin-top:6px">Date : <strong>${fmtD(liv.date)}</strong></div>
          ${isFact && liv.datePaiement ? `<div style="font-size:.82rem;color:#6b7280">Paiement : <strong>${fmtD(liv.datePaiement)}</strong></div>` : ''}
        </div>
      </div>
      <div style="background:#f9fafb;padding:16px;border-radius:10px;margin-bottom:18px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">${isFact ? 'Facturé à' : 'Client'}</div>
        <div style="font-size:1.1rem;font-weight:700">${esc(liv.client || '—')}</div>
        ${liv.expAdresse || liv.destAdresse ? `<div style="font-size:.85rem;color:#6b7280;margin-top:4px">${esc(liv.destAdresse || liv.expAdresse || '')}${liv.destCp ? ', ' + esc(liv.destCp) : ''}${liv.destVille ? ' ' + esc(liv.destVille) : ''}</div>` : ''}
      </div>
      ${blocLignes}
      <div style="border-top:1px solid #e5e7eb;padding-top:14px;margin-top:24px;font-size:.78rem;color:#9ca3af;text-align:center">
        ${isFact ? 'Mode paiement : ' + esc(liv.modePaiement || 'À définir') + ' · Statut : ' + esc((liv.statutPaiement || 'En attente').replace('en-attente', 'En attente')) + ' · ' : ''}
        Document généré le ${new Date().toLocaleString('fr-FR')}
      </div>
      </body></html>`;
  };

  M.genererBonLivraison = function(id) {
    const liv = M.charger('livraisons').find(x => x.id === id);
    if (!liv) { M.toast('Livraison introuvable'); return; }
    const html = M.genererHtmlBonOuFacture(liv, { facture: false });
    M.afficherDocHTML(html, `Bon de livraison ${liv.numLiv || ''}`);
  };

  M.genererFactureLivraison = function(id) {
    const liv = M.charger('livraisons').find(x => x.id === id);
    if (!liv) { M.toast('Livraison introuvable'); return; }
    const html = M.genererHtmlBonOuFacture(liv, { facture: true });
    M.afficherDocHTML(html, `Facture ${liv.factureNumero || ''}`);
  };

  // Lettre de voiture (LDV) - Document légal transport (arrêté 09/11/1999).
  // Champs lus depuis liv.expNom/expAdresse/destNom/destAdresse/marchNature/etc
  // (saisis dans la section LDV repliable du form livraison).
  M.genererLDV = function(id) {
    const liv = M.charger('livraisons').find(x => x.id === id);
    if (!liv) { M.toast('Livraison introuvable'); return; }
    const config = M.chargerObj('config') || {};
    const ent = config.entreprise || M.chargerObj('entreprise') || {};
    const esc = (s) => M.escHtml(s == null ? '' : s);
    const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
    const numLDV = liv.numLiv ? 'LDV-' + String(liv.numLiv).replace(/^LIV-/, '') : 'LDV-' + (liv.id || '').slice(0, 8);

    // Détection champs manquants (alerte conformité légale)
    const manques = [];
    if (!liv.expNom) manques.push('expéditeur');
    if (!liv.expAdresse || !liv.expVille) manques.push('adresse chargement');
    if (!liv.destNom) manques.push('destinataire');
    if (!liv.destAdresse || !liv.destVille) manques.push('adresse déchargement');
    if (!liv.marchNature) manques.push('nature marchandise');
    if (!liv.marchPoids) manques.push('poids');
    if (!liv.marchColis) manques.push('nombre de colis');

    const bandeau = manques.length
      ? `<div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:.84rem"><strong>⚠️ LDV incomplète.</strong> Champs manquants : ${esc(manques.join(', '))}. Complète-les sur la fiche livraison pour un document légalement conforme.</div>`
      : '';

    const adresseBlock = (nom, adr, cp, ville, pays, contact) => `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:14px;border-radius:10px">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">${esc(nom || '—')}</div>
        ${contact ? `<div style="font-size:.82rem;color:#6b7280">${esc(contact)}</div>` : ''}
        <div style="font-size:.86rem;line-height:1.5;margin-top:6px">
          ${adr ? esc(adr) + '<br>' : ''}
          ${cp ? esc(cp) + ' ' : ''}${ville ? esc(ville) : ''}
          ${pays && pays !== 'FR' ? '<br>' + esc(pays) : ''}
        </div>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LDV ${esc(numLDV)}</title>
      <style>
        body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; padding: 24px; max-width: 720px; margin: 0 auto; color: #111827; background: #fff; }
        @media print { body { padding: 12mm } @page { margin: 12mm } }
      </style></head><body>
      ${bandeau}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #111827">
        <div>
          <div style="font-size:1.3rem;font-weight:900">LETTRE DE VOITURE</div>
          <div style="font-size:.78rem;color:#6b7280;margin-top:4px">N° ${esc(numLDV)} · ${fmtD(liv.date)}</div>
          <div style="font-size:.7rem;color:#9ca3af;margin-top:2px">Document obligatoire — arrêté 09/11/1999</div>
        </div>
        <div style="text-align:right;font-size:.82rem">
          <div style="font-weight:700">${esc(ent.nom || 'MCA Logistics')}</div>
          ${ent.siret ? `<div style="color:#6b7280;font-size:.74rem">SIRET ${esc(ent.siret)}</div>` : ''}
          ${ent.tel ? `<div style="color:#6b7280;font-size:.74rem">Tél. ${esc(ent.tel)}</div>` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.05em;margin-bottom:6px">📤 Expéditeur (chargement)</div>
          ${adresseBlock(liv.expNom, liv.expAdresse, liv.expCp, liv.expVille, liv.expPays, liv.expContact)}
        </div>
        <div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.05em;margin-bottom:6px">📥 Destinataire (déchargement)</div>
          ${adresseBlock(liv.destNom, liv.destAdresse, liv.destCp, liv.destVille, liv.destPays, liv.destContact)}
        </div>
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.05em;margin-bottom:6px">📦 Marchandise</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#f8fafc">
            <th style="padding:10px;text-align:left;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Nature</th>
            <th style="padding:10px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Poids</th>
            <th style="padding:10px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Volume</th>
            <th style="padding:10px;text-align:right;font-size:.78rem;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb">Colis</th>
          </tr></thead>
          <tbody><tr>
            <td style="padding:14px 10px">${esc(liv.marchNature || '—')}</td>
            <td style="padding:14px 10px;text-align:right">${liv.marchPoids ? esc(liv.marchPoids) + ' kg' : '—'}</td>
            <td style="padding:14px 10px;text-align:right">${liv.marchVolume ? esc(liv.marchVolume) + ' m³' : '—'}</td>
            <td style="padding:14px 10px;text-align:right">${liv.marchColis ? esc(liv.marchColis) : '—'}</td>
          </tr></tbody>
        </table>
      </div>

      ${liv.adrEstADR ? `
        <div style="margin-bottom:18px;padding:14px;border:2px solid #dc2626;background:#fef2f2;border-radius:8px">
          <div style="font-weight:800;color:#dc2626;font-size:.95rem;margin-bottom:8px">⚠️ TRANSPORT ADR — MATIÈRES DANGEREUSES</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:.85rem">
            <div><strong>Code ONU :</strong> ${esc(liv.adrCodeONU || '—')}</div>
            <div><strong>Classe :</strong> ${esc(liv.adrClasse || '—')}</div>
            <div><strong>Groupe emballage :</strong> ${esc(liv.adrGroupeEmballage || '—')}</div>
          </div>
        </div>
      ` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:36px;font-size:.78rem">
        <div>
          <div style="border-top:1px solid #6b7280;padding-top:6px">Signature expéditeur</div>
          <div style="height:60px"></div>
        </div>
        <div>
          <div style="border-top:1px solid #6b7280;padding-top:6px">Signature destinataire</div>
          <div style="height:60px"></div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:10px;margin-top:24px;font-size:.72rem;color:#9ca3af;text-align:center">
        Document généré le ${new Date().toLocaleString('fr-FR')} · ${esc(ent.nom || 'MCA Logistics')}
      </div>
      </body></html>`;
    M.afficherDocHTML(html, `LDV ${numLDV}`);
  };

  M.formNouveauPlein = function(existing) {
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const today = new Date().toISOString().slice(0, 10);
    const enEdition = !!existing;
    const p = existing || {};

    // Pre-remplit le type carburant depuis le vehicule selectionne (si dispo)
    const vehDuPlein = p.vehiculeId ? vehicules.find(v => v.id === p.vehiculeId) : null;
    const typeCarbDefaut = p.typeCarburant || vehDuPlein?.typeCarburant || '';

    const body = `
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.immatriculation || v.id })), { placeholder: 'Choisir un véhicule', value: p.vehiculeId || '', required: true }), { required: true })}
      ${M.formField('Type carburant', M.formSelect('typeCarburant', [
        { value: 'diesel',     label: '⛽ Diesel/Gazole' },
        { value: 'essence',    label: 'Essence' },
        { value: 'gnv',        label: 'GNV/BioGNV' },
        { value: 'electrique', label: 'Électrique' },
        { value: 'hybride',    label: 'Hybride' },
        { value: 'hydrogene',  label: 'Hydrogène' }
      ], { placeholder: 'Choisir', value: typeCarbDefaut }))}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: p.date || today, required: true }), { required: true })}
        ${M.formField('Km compteur', M.formInputWithSuffix('kmCompteur', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: p.kmCompteur || '' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Litres', M.formInputWithSuffix('litres', 'L', { type: 'number', step: '0.01', min: '0', placeholder: '0', value: p.litres || '', required: true }), { required: true })}
        ${M.formField('Prix au litre', M.formInputWithSuffix('prixLitre', '€/L', { type: 'number', step: '0.001', min: '0', placeholder: '0.000', value: p.prixLitre || '' }))}
      </div>
      ${M.formField('Total payé', M.formInputWithSuffix('total', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: p.total || '', required: true }), { hint: 'Si laissé vide, calculé automatiquement (litres × prix/L)', required: true })}
      ${enEdition && p.vehiculeId ? `
        <button type="button" class="m-btn" data-goto-veh="${M.escHtml(p.vehiculeId)}" style="margin-top:18px">🚐 Voir fiche véhicule</button>
      ` : ''}
      ${enEdition ? `<button type="button" class="m-btn" id="m-form-recurrence" style="margin-top:14px">🔁 Créer une récurrence</button>
        <button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:8px">🗑️ Supprimer ce plein</button>` : ''}
    `;

    M.openSheet({
      title: enEdition ? '✏️ Modifier plein' : '⛽ Nouveau plein',
      body,
      submitLabel: 'Enregistrer',
      afterMount(body) {
        const litres = body.querySelector('input[name=litres]');
        const prixL  = body.querySelector('input[name=prixLitre]');
        const total  = body.querySelector('input[name=total]');
        const vehSelect = body.querySelector('select[name=vehiculeId]');
        const carbSelect = body.querySelector('select[name=typeCarburant]');
        // Calcul tri-directionnel : 2 valeurs sur 3 → calcule la 3e.
        // dernierEdit suit le dernier champ touché par l'user pour ne pas l'écraser.
        let dernierEdit = total.value ? 'total' : (litres.value ? 'litres' : 'prixL');
        const recalc = () => {
          const L = M.parseNum(litres.value);
          const P = M.parseNum(prixL.value);
          const T = M.parseNum(total.value);
          if (dernierEdit === 'total' && L > 0 && T > 0) {
            // total + litres → prixL (sauf si user vient d'éditer prixL)
            prixL.value = (T / L).toFixed(3);
          } else if (dernierEdit === 'total' && P > 0 && T > 0) {
            // total + prixL → litres
            litres.value = (T / P).toFixed(2);
          } else if ((dernierEdit === 'litres' || dernierEdit === 'prixL') && L > 0 && P > 0) {
            // litres + prixL → total
            total.value = (L * P).toFixed(2);
          }
        };
        litres.addEventListener('input', () => { dernierEdit = 'litres'; recalc(); });
        prixL.addEventListener('input', () => { dernierEdit = 'prixL'; recalc(); });
        total.addEventListener('input', () => { dernierEdit = 'total'; recalc(); });
        // Auto-remplit le type carburant + km compteur depuis le vehicule selectionne
        const kmCompteurInput = body.querySelector('input[name=kmCompteur]');
        if (vehSelect) {
          const onVehChange = () => {
            const id = vehSelect.value;
            const v = vehicules.find(x => x.id === id);
            if (v?.typeCarburant && carbSelect && !carbSelect.value) carbSelect.value = v.typeCarburant;
            // Auto-fill km compteur si vide (logique partagée M.dernierKmConnu)
            if (kmCompteurInput && !kmCompteurInput.value && id) {
              const km = M.dernierKmConnu(id);
              if (km > 0) kmCompteurInput.value = km;
            }
          };
          vehSelect.addEventListener('change', onVehChange);
          if (!enEdition) setTimeout(onVehChange, 100);
        }
        if (enEdition) {
          body.querySelector('#m-form-recurrence')?.addEventListener('click', async () => {
            const ok = await M.creerRecurrence('carburant', p.id, {
              sousTitre: 'Ce plein sera dupliqué à intervalle régulier (montant identique).',
              transform: (copy) => { copy.kmCompteur = 0; }
            });
            if (ok) { M.closeSheet(); M.go('carburant'); }
          });
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            const aLien = !!p.chargeId;
            const msg = aLien
              ? 'Supprimer ce plein ?\n\nLa charge liée dans Charges sera aussi supprimée.'
              : 'Supprimer définitivement ce plein ?';
            if (!await M.confirm(msg, { titre: 'Supprimer plein' })) return;
            M.sauvegarder('carburant', M.charger('carburant').filter(x => x.id !== p.id));
            // Cascade charge liée (par carburantId OU chargeId)
            M.sauvegarder('charges', M.charger('charges').filter(c =>
              c.carburantId !== p.id && (!p.chargeId || c.id !== p.chargeId)
            ));
            M.ajouterAudit?.('Suppression plein', (p.litres ? p.litres + ' L' : '') + (aLien ? ' + cascade charge' : ''));
            M.toast('🗑️ Plein supprimé');
            M.closeSheet();
            M.go('carburant');
          });
          body.querySelector('[data-goto-veh]')?.addEventListener('click', e => {
            M.closeSheet();
            M.openDetail('vehicules', e.currentTarget.dataset.gotoVeh);
          });
        }
      },
      onSubmit() {
        const form = M.lireFormSheet();
        const litres = M.parseNum(form.litres) || 0;
        const prixL = M.parseNum(form.prixLitre) || 0;
        let total = M.parseNum(form.total) || 0;
        if (!total && litres && prixL) total = +(litres * prixL).toFixed(2);
        if (!form.vehiculeId) { M.toast('⚠️ Véhicule requis'); return false; }
        if (!form.date) { M.toast('⚠️ Date requise'); return false; }
        if (!(litres > 0)) { M.toast('⚠️ Litres > 0 requis'); return false; }
        if (!(total > 0)) { M.toast('⚠️ Total > 0 requis (ou laissé vide pour calcul auto)'); return false; }
        const arr = M.charger('carburant');
        // Dual-write vehiculeId/vehId pour compat PC
        const data = {
          vehiculeId: form.vehiculeId,
          vehId: form.vehiculeId,
          typeCarburant: form.typeCarburant || '',
          date: form.date,
          litres,
          prixLitre: prixL,
          total,
          kmCompteur: M.parseNum(form.kmCompteur) || 0
        };
        let pleinId;
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === p.id);
          if (idx >= 0) {
            arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
            pleinId = arr[idx].id;
          }
          M.sauvegarder('carburant', arr);
          M.toast('✅ Plein modifié');
        } else {
          pleinId = M.genId();
          arr.push({ id: pleinId, creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('carburant', arr);
          M.toast('✅ Plein enregistré');
        }
        // Sync inverse : crée/maj la charge correspondante en arrière-plan
        try {
          const plein = M.charger('carburant').find(x => x.id === pleinId);
          if (plein) M.synchroPleinVersCharge(plein);
        } catch (e) { console.warn('[mobile] sync plein->charge', e); }
        M.go('carburant');
        return true;
      }
    });
  };

  M.editerPlein = function(id) {
    const p = M.charger('carburant').find(x => x.id === id);
    if (!p) return M.toast('Plein introuvable');
    M.formNouveauPlein(p);
  };

  M.formNouvelleCharge = function(existing) {
    const today = new Date().toISOString().slice(0, 10);
    const enEdition = !!existing;
    const c = existing || {};

    const body = `
      <div class="m-form-field" style="margin-bottom:14px">
        <label for="m-charge-fac-input" class="m-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;background:var(--m-accent-soft);color:var(--m-accent);border:1px dashed var(--m-accent)">
          <span>📷</span><span>Scanner la facture (auto-remplir)</span>
        </label>
        <input type="file" id="m-charge-fac-input" accept="image/*,application/pdf" style="display:none" />
        <p class="m-form-hint" id="m-charge-fac-status" style="text-align:center"></p>
      </div>
      ${M.formField('Libellé', M.formInput('libelle', { value: c.libelle || '', placeholder: 'Ex: Loyer atelier, Assurance...', required: true }), { required: true })}
      ${M.formField('Fournisseur', M.formInput('fournisseur', { value: c.fournisseur || '', placeholder: 'Nom fournisseur' }))}
      ${M.formField('Date', M.formInput('date', { type: 'date', value: c.date || today, required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Montant HT', M.formInputWithSuffix('montantHt', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: c.montantHT || '' }))}
        ${M.formField('Taux TVA', M.formSelect('tauxTva', [
          { value: '0',    label: '0%' },
          { value: '5.5',  label: '5,5%' },
          { value: '10',   label: '10%' },
          { value: '20',   label: '20%' }
        ], { value: String(c.tauxTva ?? 20) }))}
      </div>
      <div class="m-form-row">
        ${M.formField('TVA', M.formInputWithSuffix('tva', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: c.tva || '' }), { hint: 'Auto, ou saisi manuellement (ex: facture mixte)' })}
        ${M.formField('Montant TTC', M.formInputWithSuffix('montantTtc', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: c.montantTtc || c.montant || '', required: true }), { required: true, hint: 'Calcul auto' })}
      </div>
      ${M.formField('Catégorie', M.formSelect('categorie', [
        { value: 'carburant',  label: 'Carburant' },
        { value: 'peage',      label: 'Péage' },
        { value: 'entretien',  label: 'Entretien' },
        { value: 'assurance',  label: 'Assurance' },
        { value: 'salaires',   label: 'Salaires' },
        { value: 'lld_credit', label: 'LLD / Crédit' },
        { value: 'tva',        label: 'TVA' },
        { value: 'autre',      label: 'Autre' }
      ], { placeholder: 'Choisir une catégorie', value: c.categorie || '' }))}
      ${M.formField('Véhicule (optionnel)', M.formSelect('vehiculeId', M.charger('vehicules').filter(v => v && !v.archive).map(v => ({ value: v.id, label: v.immat || v.id })), { placeholder: 'Aucun', value: c.vehiculeId || c.vehId || '' }), { hint: 'Catégorie carburant/entretien : crée auto le plein/entretien.' })}
      ${M.formField('Statut', M.formSelect('statut', [
        { value: 'a_payer', label: '⏳ À payer' },
        { value: 'paye',    label: '✅ Payée' },
        { value: 'partiel', label: '🟡 Partielle' }
      ], { value: c.statut || 'a_payer' }))}
      ${enEdition && (c.fournisseurId || c.fournisseur) ? (() => {
        const four = c.fournisseurId
          ? M.charger('fournisseurs').find(f => f.id === c.fournisseurId)
          : M.findFournisseurByName(c.fournisseur);
        return four
          ? `<button type="button" class="m-btn" data-goto-four="${M.escHtml(four.id)}" style="margin-top:18px">🏭 Voir fiche fournisseur</button>`
          : '';
      })() : ''}
      ${enEdition ? `<button type="button" class="m-btn" id="m-form-recurrence" style="margin-top:14px">🔁 Créer une récurrence</button>
        <button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:8px">🗑️ Supprimer cette charge</button>` : ''}
    `;

    M.openSheet({
      title: enEdition ? '✏️ Modifier charge' : '💸 Nouvelle charge',
      body,
      submitLabel: 'Enregistrer',
      afterMount(body) {
        const ht  = body.querySelector('input[name=montantHt]');
        const sel = body.querySelector('select[name=tauxTva]');
        const tva = body.querySelector('input[name=tva]');
        const ttc = body.querySelector('input[name=montantTtc]');
        let dernierEdit = 'ttc';
        // BUGFIX v3.68 : si l'user saisit manuellement le champ TVA (cas facture
        // mixte type 150€ TTC dont 30€ seulement soumis a TVA 20% = 6€ TVA), on
        // arrete le recalcul automatique de la TVA et on respecte sa saisie.
        // Le mode manuel reste actif jusqu'a ce que l'user change le taux TVA
        // dans le select (= signal explicite "je veux revenir en auto").
        let tvaManuelle = false;
        // Detection au boot : si la TVA saisie ne correspond pas au taux, on
        // considere qu'elle a ete saisie manuellement (ex: charge mixte deja editee).
        if (c.tva && c.montantHT && c.tauxTva) {
          const tvaAttendu = M.parseNum(c.montantHT) * M.parseNum(c.tauxTva) / 100;
          if (Math.abs(M.parseNum(c.tva) - tvaAttendu) > 0.05) tvaManuelle = true;
        }
        const recalc = () => {
          const taux = M.parseNum(sel.value) / 100 || 0;
          if (tvaManuelle) {
            // Mode TVA manuelle : on respecte le champ TVA, on deduit l'autre
            // (HT ou TTC selon le dernier edite par l'user).
            const tv = M.parseNum(tva.value) || 0;
            if (dernierEdit === 'ht' && ht.value) {
              ttc.value = (M.parseNum(ht.value) + tv).toFixed(2);
            } else if (dernierEdit === 'ttc' && ttc.value) {
              ht.value = (M.parseNum(ttc.value) - tv).toFixed(2);
            }
            return;
          }
          if (dernierEdit === 'ht' && ht.value) {
            const hh = M.parseNum(ht.value);
            const tv = hh * taux;
            tva.value = tv.toFixed(2);
            ttc.value = (hh + tv).toFixed(2);
          } else if (ttc.value) {
            const tt = M.parseNum(ttc.value);
            const hh = taux > 0 ? tt / (1 + taux) : tt;
            ht.value = hh.toFixed(2);
            tva.value = (tt - hh).toFixed(2);
          }
        };
        ht.addEventListener('input', () => { dernierEdit = 'ht'; recalc(); });
        ttc.addEventListener('input', () => { dernierEdit = 'ttc'; recalc(); });
        tva.addEventListener('input', () => { tvaManuelle = true; recalc(); });
        sel.addEventListener('change', () => { tvaManuelle = false; recalc(); });
        // OCR facture (mode nouveau et edition)
        const facInput = body.querySelector('#m-charge-fac-input');
        const facStatus = body.querySelector('#m-charge-fac-status');
        if (facInput) {
          facInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!window.MCAocr) { M.toast('⚠️ OCR indisponible'); return; }
            facStatus.style.color = 'var(--m-text-muted)';
            facStatus.textContent = '⏳ Chargement de l\'OCR (1ère fois ~5s)...';
            // Logger verbose sur le DOM pour debug en prod
            window.MCAocr._onLog = (msg) => { facStatus.textContent = '⏳ ' + msg; };
            try {
              await MCAocr.ensureLoaded();
              window.MCAocr._onLog = null;
              facStatus.textContent = '⏳ Lecture de la facture...';
              const { text } = await MCAocr.recognize(file);
              const parsed = MCAocr.parseFacture(text);
              let n = 0;
              const setVal = (name, val) => {
                if (val == null || val === '' || val === 0) return;
                const el = body.querySelector(`[name="${name}"]`);
                if (el && !el.value) { el.value = val; n++; }
              };
              setVal('fournisseur', parsed.fournisseur);
              setVal('libelle', parsed.numFacture ? `Facture ${parsed.numFacture}` : '');
              setVal('date', parsed.date);
              setVal('montantHt', parsed.ht ? parsed.ht.toFixed(2) : '');
              setVal('tva', parsed.tva ? parsed.tva.toFixed(2) : '');
              setVal('montantTtc', parsed.ttc ? parsed.ttc.toFixed(2) : '');
              if (parsed.tauxTva && sel) sel.value = String(parsed.tauxTva);
              dernierEdit = 'ttc'; recalc();
              facStatus.textContent = n > 0 ? `✅ ${n} champ${n>1?'s':''} rempli${n>1?'s':''} (vérifie + complète)` : `⚠️ Aucun champ détecté (qualité photo ?)`;
              facStatus.style.color = n > 0 ? 'var(--m-green)' : 'var(--m-red)';
            } catch (err) {
              console.error('[OCR] erreur:', err);
              facStatus.textContent = '⚠️ Erreur OCR : ' + (err.message || 'inconnue');
              facStatus.style.color = 'var(--m-red)';
            }
            e.target.value = '';
          });
        }
        if (enEdition) {
          body.querySelector('#m-form-recurrence')?.addEventListener('click', async () => {
            const ok = await M.creerRecurrence('charges', c.id, {
              sousTitre: `${c.libelle || 'Charge'} sera dupliquée à intervalle régulier.`,
              transform: (copy) => {
                copy.statut = 'a_payer';
                copy.statutPaiement = 'a_payer';
                delete copy.datePaiement;
              }
            });
            if (ok) { M.closeSheet(); M.go('charges'); }
          });
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            // Cascade : si la charge est liée à un plein/entretien, prévient avant
            const liens = [];
            if (c.carburantId) liens.push('le plein carburant lié');
            if (c.entretienId) liens.push("l'entretien lié");
            const msg = liens.length
              ? `Supprimer cette charge ?\n\nCela supprimera aussi ${liens.join(' et ')} dans l'autre onglet.`
              : `Supprimer définitivement cette charge (${c.libelle || ''}) ?`;
            if (!await M.confirm(msg, { titre: 'Supprimer charge' })) return;
            M.sauvegarder('charges', M.charger('charges').filter(x => x.id !== c.id));
            // Cascade plein lié
            if (c.carburantId) {
              M.sauvegarder('carburant', M.charger('carburant').filter(p => p.id !== c.carburantId));
            }
            // Cascade entretien lié
            if (c.entretienId) {
              M.sauvegarder('entretiens', M.charger('entretiens').filter(e => e.id !== c.entretienId));
            }
            M.ajouterAudit?.('Suppression charge', (c.libelle || '') + (liens.length ? ' + cascade : ' + liens.join(', ') : ''));
            M.toast('🗑️ Charge supprimée');
            M.closeSheet();
            M.go('charges');
          });
          body.querySelector('[data-goto-four]')?.addEventListener('click', e => {
            M.closeSheet();
            M.openDetail('fournisseurs', e.currentTarget.dataset.gotoFour);
          });
        }
      },
      onSubmit() {
        const form = M.lireFormSheet();
        const ttc = M.parseNum(form.montantTtc) || 0;
        const taux = M.parseNum(form.tauxTva) || 0;
        const ht = M.parseNum(form.montantHt) || (taux > 0 ? ttc / (1 + taux/100) : ttc);
        const tvaMontant = M.parseNum(form.tva) || (ttc - ht);
        if (!form.libelle?.trim()) { M.toast('⚠️ Libellé requis'); return false; }
        if (!form.date) { M.toast('⚠️ Date requise'); return false; }
        if (!(ttc > 0)) { M.toast('⚠️ Montant TTC > 0 requis'); return false; }
        const arr = M.charger('charges');
        const data = {
          date: form.date,
          libelle: form.libelle.trim(),
          fournisseur: form.fournisseur?.trim() || '',
          vehiculeId: form.vehiculeId || null,
          vehId: form.vehiculeId || null,  // dual-write PC
          montantHT: +ht.toFixed(2),  // PC + mobile
          montantHt: +ht.toFixed(2),  // alias mobile (compat ancien)
          montantTtc: ttc,
          montant: ttc,
          tauxTva: taux,    // mobile
          tauxTVA: taux,    // PC (casse !)
          tva: +tvaMontant.toFixed(2),
          categorie: form.categorie || '',
          statut: form.statut || 'a_payer',
          statutPaiement: form.statut || 'a_payer'  // PC utilise statutPaiement
        };
        let chargeId;
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === c.id);
          if (idx >= 0) {
            arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
            chargeId = arr[idx].id;
          }
          M.sauvegarder('charges', arr);
          M.toast('✅ Charge modifiée');
        } else {
          chargeId = M.genId();
          arr.push({ id: chargeId, creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('charges', arr);
          M.toast('✅ Charge enregistrée');
        }
        // Sync cross-entity : si catégorie carburant -> crée/maj plein.
        // Si catégorie entretien -> crée/maj entretien. Lié via chargeId
        // pour éviter doublons sur futurs updates.
        try {
          const charge = M.charger('charges').find(x => x.id === chargeId);
          if (charge) M.synchroChargeVersAutreEntite(charge);
        } catch (e) { console.warn('[mobile] sync cross-entity', e); }
        M.go('charges');
        return true;
      }
    });
  };

  // Synchronise une charge vers Carburant (si categorie=carburant) ou Entretien
  // (si categorie=entretien). Mirror des fonctions PC synchroChargeVersCarburant
  // et synchroChargeVersEntretien (script-charges.js + script-entretiens.js).
  // Crée si nouvelle, met à jour si charge.carburantId / charge.entretienId existe.
  M.synchroChargeVersAutreEntite = function(charge) {
    if (!charge) return;
    if (charge.categorie === 'carburant') M.synchroChargeVersCarburant(charge);
    if (charge.categorie === 'entretien') M.synchroChargeVersEntretien(charge);
  };

  M.synchroChargeVersCarburant = function(charge) {
    const pleins = M.charger('carburant');
    const total = M.parseNum(charge.montantTtc) || M.parseNum(charge.montant) || 0;
    const taux = M.parseNum(charge.tauxTVA) || M.parseNum(charge.tauxTva) || 20;
    const data = {
      vehiculeId: charge.vehiculeId || charge.vehId || null,
      vehId: charge.vehiculeId || charge.vehId || null,
      date: charge.date,
      total,
      tauxTVA: taux,
      tauxTva: taux,
      tva: M.parseNum(charge.tva) || +(total - total / (1 + taux/100)).toFixed(2),
      source: 'charge',
      chargeId: charge.id,
      modifieLe: new Date().toISOString()
    };
    if (charge.carburantId) {
      const idx = pleins.findIndex(p => p.id === charge.carburantId);
      if (idx >= 0) {
        pleins[idx] = { ...pleins[idx], ...data };
        M.sauvegarder('carburant', pleins);
        return;
      }
    }
    // Création
    const newId = M.genId();
    pleins.push({ id: newId, creeLe: new Date().toISOString(), ...data });
    M.sauvegarder('carburant', pleins);
    // Pose carburantId sur la charge
    const charges = M.charger('charges');
    const idxC = charges.findIndex(x => x.id === charge.id);
    if (idxC >= 0) {
      charges[idxC].carburantId = newId;
      M.sauvegarder('charges', charges);
    }
  };

  M.synchroChargeVersEntretien = function(charge) {
    const entretiens = M.charger('entretiens');
    const ttc = M.parseNum(charge.montantTtc) || M.parseNum(charge.montant) || 0;
    const ht = M.parseNum(charge.montantHT) || M.parseNum(charge.montantHt) || ttc;
    const taux = M.parseNum(charge.tauxTVA) || M.parseNum(charge.tauxTva) || 20;
    const tva = M.parseNum(charge.tva) || +(ttc - ht).toFixed(2);
    const data = {
      vehiculeId: charge.vehiculeId || charge.vehId || null,
      vehId: charge.vehiculeId || charge.vehId || null,
      date: charge.date,
      type: 'autre',
      description: charge.libelle || 'Entretien (depuis charge)',
      coutHt: ht,
      coutHT: ht,
      tauxTva: taux,
      tauxTVA: taux,
      tva,
      coutTtc: ttc,
      cout: ttc,
      source: 'charge',
      chargeId: charge.id,
      modifieLe: new Date().toISOString()
    };
    if (charge.entretienId) {
      const idx = entretiens.findIndex(e => e.id === charge.entretienId);
      if (idx >= 0) {
        entretiens[idx] = { ...entretiens[idx], ...data };
        M.sauvegarder('entretiens', entretiens);
        return;
      }
    }
    const newId = M.genId();
    entretiens.push({ id: newId, creeLe: new Date().toISOString(), ...data });
    M.sauvegarder('entretiens', entretiens);
    const charges = M.charger('charges');
    const idxC = charges.findIndex(x => x.id === charge.id);
    if (idxC >= 0) {
      charges[idxC].entretienId = newId;
      M.sauvegarder('charges', charges);
    }
  };

  // ----- Sens INVERSE : plein/entretien -> charge -----
  // Quand on saisit un plein ou un entretien direct (pas via Charge), on
  // crée/maj une charge correspondante en arrière-plan. Source 'auto' pour
  // distinguer des saisies manuelles. Lien via plein.chargeId / entretien.chargeId
  // pour update au lieu de doublon. Mêmes guards anti-boucle (skip si source='charge').
  M.synchroPleinVersCharge = function(plein) {
    if (!plein) return;
    if (plein.source === 'charge') return; // évite boucle infinie
    const charges = M.charger('charges');
    const total = M.parseNum(plein.total) || 0;
    if (total <= 0) return;
    const taux = M.parseNum(plein.tauxTVA) || M.parseNum(plein.tauxTva) || 20;
    const ht = +(total / (1 + taux/100)).toFixed(2);
    const tva = +(total - ht).toFixed(2);
    const veh = (plein.vehiculeId || plein.vehId)
      ? M.charger('vehicules').find(v => v.id === (plein.vehiculeId || plein.vehId)) : null;
    // Statut paiement : 'paye' SEULEMENT à la création (plein = payé pompe).
    // Si la charge existait déjà, on respecte le choix utilisateur (peut-être
    // marquée 'a_payer' manuellement après ajustement). Sinon on écrasait à
    // chaque resync.
    const dataBase = {
      date: plein.date,
      libelle: 'Carburant ' + (veh?.immat ? veh.immat : '') + (plein.litres ? ' (' + plein.litres + ' L)' : ''),
      categorie: 'carburant',
      vehiculeId: plein.vehiculeId || plein.vehId || null,
      vehId: plein.vehiculeId || plein.vehId || null,
      montantHT: ht, montantHt: ht,
      montantTtc: total, montant: total,
      tauxTva: taux, tauxTVA: taux,
      tva,
      source: 'plein',
      carburantId: plein.id,
      modifieLe: new Date().toISOString()
    };
    if (plein.chargeId) {
      const idx = charges.findIndex(c => c.id === plein.chargeId);
      if (idx >= 0) {
        // Update : préserve statut/datePaiement existants (sauf si vides)
        charges[idx] = { ...charges[idx], ...dataBase };
        M.sauvegarder('charges', charges);
        return;
      }
    }
    // Création : pose statut paye + datePaiement = date plein
    const data = { ...dataBase, statut: 'paye', statutPaiement: 'paye', datePaiement: plein.date };
    const newId = M.genId();
    charges.push({ id: newId, creeLe: new Date().toISOString(), ...data });
    M.sauvegarder('charges', charges);
    const pleins = M.charger('carburant');
    const idxP = pleins.findIndex(x => x.id === plein.id);
    if (idxP >= 0) {
      pleins[idxP].chargeId = newId;
      M.sauvegarder('carburant', pleins);
    }
  };

  M.synchroEntretienVersCharge = function(entretien) {
    if (!entretien) return;
    if (entretien.source === 'charge') return;
    const charges = M.charger('charges');
    const ttc = M.parseNum(entretien.coutTtc) || M.parseNum(entretien.cout) || 0;
    if (ttc <= 0) return;
    const ht = M.parseNum(entretien.coutHt) || M.parseNum(entretien.coutHT) || +(ttc / 1.2).toFixed(2);
    const taux = M.parseNum(entretien.tauxTVA) || M.parseNum(entretien.tauxTva) || 20;
    const tva = M.parseNum(entretien.tva) || +(ttc - ht).toFixed(2);
    const veh = (entretien.vehiculeId || entretien.vehId)
      ? M.charger('vehicules').find(v => v.id === (entretien.vehiculeId || entretien.vehId)) : null;
    // Statut paiement : 'a_payer' à la création seulement. Sur update, on
    // préserve le statut existant (l'utilisateur a peut-être marqué payé).
    const dataBase = {
      date: entretien.date,
      libelle: 'Entretien ' + (entretien.type || '') + ' ' + (veh?.immat || ''),
      categorie: 'entretien',
      vehiculeId: entretien.vehiculeId || entretien.vehId || null,
      vehId: entretien.vehiculeId || entretien.vehId || null,
      montantHT: ht, montantHt: ht,
      montantTtc: ttc, montant: ttc,
      tauxTva: taux, tauxTVA: taux,
      tva,
      source: 'entretien',
      entretienId: entretien.id,
      modifieLe: new Date().toISOString()
    };
    if (entretien.chargeId) {
      const idx = charges.findIndex(c => c.id === entretien.chargeId);
      if (idx >= 0) {
        charges[idx] = { ...charges[idx], ...dataBase };
        M.sauvegarder('charges', charges);
        return;
      }
    }
    const data = { ...dataBase, statut: 'a_payer', statutPaiement: 'a_payer' };
    const newId = M.genId();
    charges.push({ id: newId, creeLe: new Date().toISOString(), ...data });
    M.sauvegarder('charges', charges);
    const entrs = M.charger('entretiens');
    const idxE = entrs.findIndex(x => x.id === entretien.id);
    if (idxE >= 0) {
      entrs[idxE].chargeId = newId;
      M.sauvegarder('entretiens', entrs);
    }
  };

  M.editerCharge = function(id) {
    const c = M.charger('charges').find(x => x.id === id);
    if (!c) return M.toast('Charge introuvable');
    M.formNouvelleCharge(c);
  };

  // ============================================================
  // Forms entites tiers/equipe/flotte (creation + edition + suppression)
  // ============================================================

  // ---- CLIENT ----
  M.formNouveauClient = function(existing) {
    const enEdition = !!existing;
    const c = existing || {};
    const body = `
      ${M.formField('Nom / Raison sociale', M.formInput('nom', { value: c.nom || '', placeholder: 'Société ou particulier', required: true }), { required: true })}
      ${M.formField('Secteur d\'activité', M.formSelect('secteur', [
        { value: 'transport',  label: '🚚 Transport / logistique' },
        { value: 'industrie',  label: '🏭 Industrie / usine' },
        { value: 'btp',        label: '🏗️ BTP / chantier' },
        { value: 'commerce',   label: '🏪 Commerce / retail' },
        { value: 'ecommerce',  label: '🛒 E-commerce' },
        { value: 'agro',       label: '🌾 Agro-alimentaire' },
        { value: 'sante',      label: '⚕️ Santé / pharma' },
        { value: 'public',     label: '🏛️ Public / collectivité' },
        { value: 'evenement',  label: '🎪 Événementiel' },
        { value: 'autre',      label: '📝 Autre' }
      ], { placeholder: '— Choisir —', value: c.secteur || '' }))}
      ${M.formField('Contact (prénom)', M.formInput('prenom', { value: c.prenom || '', placeholder: 'Prénom de la personne', autocomplete: 'given-name' }))}
      <div class="m-form-row">
        ${M.formField('Téléphone', M.formInput('tel', { type: 'tel', value: c.tel || '', placeholder: '06 12 34 56 78', autocomplete: 'tel' }))}
        ${M.formField('Email', M.formInput('email', { type: 'email', value: c.email || '', placeholder: 'contact@...', autocomplete: 'email' }))}
      </div>
      ${M.formField('Email facturation', M.formInput('emailFact', { type: 'email', value: c.emailFact || '', placeholder: 'compta@...' }), { hint: 'Si différent du contact principal' })}
      ${M.formField('Adresse', M.formInput('adresse', { value: c.adresse || '', placeholder: 'Rue + numéro' }))}
      <div class="m-form-row">
        ${M.formField('Code postal', M.formInput('cp', { value: c.cp || '', placeholder: '75000', autocomplete: 'postal-code' }))}
        ${M.formField('Ville', M.formInput('ville', { value: c.ville || '', placeholder: 'Paris', autocomplete: 'address-level2' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('SIREN', M.formInput('siren', { value: c.siren || '', placeholder: '9 chiffres' }))}
        ${M.formField('N° TVA intracom.', M.formInput('tva', { value: c.tva || c.tvaIntra || '', placeholder: 'FR + 11 chiffres' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Délai paiement', M.formInputWithSuffix('delaiPaiement', 'j', { type: 'number', step: '1', min: '0', max: '180', value: c.delaiPaiement || '30', placeholder: '30' }))}
        ${M.formField('Mode paiement préféré', M.formSelect('modePaiement', [
          { value: 'virement',    label: 'Virement' },
          { value: 'prelevement', label: 'Prélèvement SEPA' },
          { value: 'cb',          label: 'Carte bancaire' },
          { value: 'cheque',      label: 'Chèque' },
          { value: 'especes',     label: 'Espèces' }
        ], { value: c.modePaiement || 'virement' }))}
      </div>
      ${M.formField('IBAN', M.formInput('iban', { value: c.iban || '', placeholder: 'FR76 …' }))}
      ${M.formField('Notes internes', M.formTextarea('notes', { value: c.notes || '', rows: 3, placeholder: 'Remarques, préférences, historique...' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer ce client</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier client' : '➕ Nouveau client',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm(`Supprimer définitivement le client ${c.nom} ?`, { titre: 'Supprimer client' })) return;
          M.sauvegarder('clients', M.charger('clients').filter(x => x.id !== c.id));
          M.toast('🗑️ Client supprimé');
          M.state.detail.clients = null;
          M.closeSheet();
          M.go('clients');
        });
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.nom?.trim()) { M.toast('⚠️ Nom obligatoire'); return false; }
        const arr = M.charger('clients');
        const data = {
          nom: f.nom.trim(),
          secteur: f.secteur || '',
          prenom: f.prenom?.trim() || '',
          tel: f.tel?.trim() || '',
          email: f.email?.trim() || '',
          emailFact: f.emailFact?.trim() || '',
          adresse: f.adresse?.trim() || '',
          cp: f.cp?.trim() || '',
          ville: f.ville?.trim() || '',
          siren: f.siren?.trim() || '',
          tva: f.tva?.trim() || '',
          tvaIntra: f.tva?.trim() || '',  // alias PC
          delaiPaiement: M.parseNum(f.delaiPaiement) || 30,
          modePaiement: f.modePaiement || 'virement',
          iban: f.iban?.trim() || '',
          notes: f.notes?.trim() || ''
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === c.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('clients', arr);
          M.toast('✅ Client modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('clients', arr);
          M.toast('✅ Client enregistré');
        }
        M.go('clients');
        return true;
      }
    });
  };
  M.editerClient = function(id) {
    const c = M.charger('clients').find(x => x.id === id);
    if (!c) return M.toast('Client introuvable');
    M.formNouveauClient(c);
  };

  // ---- VEHICULE ----
  M.formNouveauVehicule = function(existing) {
    const enEdition = !!existing;
    const v = existing || {};
    const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
    const body = `
      <div class="m-form-field" style="margin-bottom:14px">
        <label for="m-veh-cg-input" class="m-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;background:var(--m-accent-soft);color:var(--m-accent);border:1px dashed var(--m-accent)">
          <span>📷</span><span>Scanner la carte grise (auto-remplir)</span>
        </label>
        <input type="file" id="m-veh-cg-input" accept="image/*,application/pdf" style="display:none" />
        <p class="m-form-hint" id="m-veh-cg-status" style="text-align:center"></p>
      </div>
      ${M.formField('Immatriculation', M.formInput('immat', { value: v.immat || '', placeholder: 'AA-123-BB', required: true, autocomplete: 'off' }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Marque', M.formInput('marque', { value: v.marque || '', placeholder: 'Renault, Peugeot...' }))}
        ${M.formField('Modèle', M.formInput('modele', { value: v.modele || '', placeholder: 'Master, Boxer...' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Date CT', M.formInput('dateCT', { type: 'date', value: v.dateCT || '' }))}
        ${M.formField('Date assurance', M.formInput('dateAssurance', { type: 'date', value: v.dateAssurance || '' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Date acquisition', M.formInput('dateAcquisition', { type: 'date', value: v.dateAcquisition || '' }))}
        ${M.formField('Mise en circulation', M.formInput('dateMiseEnCirculation', { type: 'date', value: v.dateMiseEnCirculation || '' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Km actuel', M.formInputWithSuffix('km', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: v.km || '' }))}
        ${M.formField('Km initial', M.formInputWithSuffix('kmInitial', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: v.kmInitial || '' }))}
      </div>
      ${M.formField('Mode acquisition', M.formSelect('modeAcquisition', [
        { value: 'achat',    label: '💰 Achat neuf' },
        { value: 'occasion', label: '🚗 Occasion' },
        { value: 'lld',      label: '📋 Location longue durée (LLD)' },
        { value: 'loa',      label: "📝 Location avec option d'achat (LOA)" },
        { value: 'credit',   label: '🏦 Crédit' },
        { value: 'location', label: '📅 Location simple' }
      ], { placeholder: 'Choisir mode', value: v.modeAcquisition || '' }))}
      ${M.formField('Type carburant', M.formSelect('typeCarburant', [
        { value: 'diesel',     label: '⛽ Diesel/Gazole' },
        { value: 'essence',    label: 'Essence' },
        { value: 'gnv',        label: 'GNV/BioGNV' },
        { value: 'electrique', label: 'Électrique' },
        { value: 'hybride',    label: 'Hybride' },
        { value: 'hydrogene',  label: 'Hydrogène' }
      ], { placeholder: 'Choisir', value: v.typeCarburant || '' }))}
      ${M.formField('Vidange tous les', M.formInputWithSuffix('entretienIntervalKm', 'km', { type: 'number', step: '500', min: '0', placeholder: '15000', value: v.entretienIntervalKm || '' }))}
      ${M.formField('Chauffeur attribué', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { placeholder: 'Aucun', value: v.salId || '' }))}
      ${enEdition ? `
      <details style="margin-top:14px;border:1px solid var(--m-border);border-radius:12px;padding:0;overflow:hidden" ${v.docs && Object.keys(v.docs).length ? 'open' : ''}>
        <summary style="padding:14px;background:var(--m-bg-elevated);cursor:pointer;font-weight:600;font-size:.95rem">📎 Documents (Carte grise, Assurance, CT...)</summary>
        <div style="padding:14px" id="m-veh-docs-list" data-veh-id="${M.escHtml(v.id)}">
          ${M.DOC_TYPES_VEHICULE.map(({ type, label, icon }) => {
            const doc = v.docs?.[type];
            return `<div class="m-card" data-veh-doc-type="${type}" style="padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
              <div style="font-size:1.2rem;flex:0 0 auto">${icon}</div>
              <div style="flex:1 1 auto;min-width:0">
                <div style="font-weight:600;font-size:.88rem">${label}</div>
                <div class="m-veh-doc-status" style="font-size:.74rem;color:${doc ? 'var(--m-green)' : 'var(--m-text-muted)'};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${doc ? '✅ ' + M.escHtml(doc.nom || 'Document enregistré') : 'Aucun fichier'}
                </div>
              </div>
              <div style="display:flex;gap:6px;flex:0 0 auto">
                ${doc ? `<button type="button" class="m-btn m-veh-doc-view" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">👁</button>
                       <button type="button" class="m-btn m-btn-danger m-veh-doc-del" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">🗑</button>` : ''}
                <label class="m-btn" style="width:auto;padding:0 10px;height:38px;font-size:.78rem;display:inline-flex;align-items:center;cursor:pointer;margin:0">
                  ${doc ? '↻' : '📎'}
                  <input type="file" class="m-veh-doc-input" data-type="${type}" accept="image/*,application/pdf" style="display:none" />
                </label>
              </div>
            </div>`;
          }).join('')}
          <p class="m-form-hint" style="margin-top:6px">PDF ou image, 5 Mo max. Stocké chiffré sur Supabase Storage.</p>
        </div>
      </details>
      ` : `
      <details style="margin-top:14px;border:1px solid var(--m-border);border-radius:12px;padding:0;overflow:hidden">
        <summary style="padding:14px;background:var(--m-bg-elevated);cursor:pointer;font-weight:600;font-size:.95rem">📎 Documents (Carte grise, Assurance, CT...)</summary>
        <div style="padding:14px" id="m-veh-docs-temp-list">
          ${M.DOC_TYPES_VEHICULE.map(({ type, label, icon }) => `
            <div class="m-card" data-veh-doc-type="${type}" style="padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
              <div style="font-size:1.2rem;flex:0 0 auto">${icon}</div>
              <div style="flex:1 1 auto;min-width:0">
                <div style="font-weight:600;font-size:.88rem">${label}</div>
                <div class="m-veh-doc-status" style="font-size:.74rem;color:var(--m-text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Aucun fichier</div>
              </div>
              <label class="m-btn" style="width:auto;padding:0 10px;height:38px;font-size:.78rem;display:inline-flex;align-items:center;cursor:pointer;margin:0">📎
                <input type="file" class="m-veh-doc-temp-input" data-type="${type}" accept="image/*,application/pdf" style="display:none" />
              </label>
            </div>
          `).join('')}
          <p class="m-form-hint" style="margin-top:6px">PDF ou image, 5 Mo max. Uploadés à Supabase Storage après l'enregistrement du véhicule.</p>
        </div>
      </details>
      `}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer ce véhicule</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier véhicule' : '➕ Nouveau véhicule',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        // OCR carte grise (mode nouveau ET edition)
        const cgInput = b.querySelector('#m-veh-cg-input');
        const cgStatus = b.querySelector('#m-veh-cg-status');
        if (cgInput) {
          cgInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!window.MCAocr) { M.toast('⚠️ OCR indisponible'); return; }
            cgStatus.style.color = 'var(--m-text-muted)';
            cgStatus.textContent = '⏳ Chargement de l\'OCR (1ère fois ~5s)...';
            // Branche logger verbose sur le DOM pour debug en prod (iOS sans console)
            window.MCAocr._onLog = (msg) => { cgStatus.textContent = '⏳ ' + msg; };
            try {
              await MCAocr.ensureLoaded();
              window.MCAocr._onLog = null; // détache après load
              cgStatus.textContent = '⏳ Lecture de la carte grise...';
              const { text, confidence } = await MCAocr.recognize(file);
              const parsed = MCAocr.parseCarteGrise(text);
              let n = 0;
              const setVal = (name, val) => {
                if (!val) return;
                const el = b.querySelector(`[name="${name}"]`);
                if (el && !el.value) { el.value = val; n++; }
              };
              setVal('immat', parsed.immat);
              setVal('marque', parsed.marque);
              setVal('modele', parsed.modele);
              setVal('dateMiseEnCirculation', parsed.dateMEC);
              cgStatus.textContent = n > 0 ? `✅ ${n} champ${n>1?'s':''} rempli${n>1?'s':''} (vérifie + complète)` : `⚠️ Aucun champ détecté (qualité photo ?)`;
              cgStatus.style.color = n > 0 ? 'var(--m-green)' : 'var(--m-red)';
            } catch (err) {
              console.error('[OCR] erreur:', err);
              cgStatus.textContent = '⚠️ Erreur OCR : ' + (err.message || 'inconnue');
              cgStatus.style.color = 'var(--m-red)';
            }
            e.target.value = '';
          });
        }
        // Mode CRÉATION : capture les fichiers en mémoire (pas encore de vehId).
        // L'upload réel sera fait dans onSubmit après genId.
        b.querySelectorAll('.m-veh-doc-temp-input').forEach(inp => {
          inp.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const type = e.target.dataset.type;
            if (file.size > 5 * 1024 * 1024) { M.toast('⚠️ Fichier trop lourd (5 Mo max)'); return; }
            window.__vehDocsTempMobile = window.__vehDocsTempMobile || {};
            const reader = new FileReader();
            reader.onload = ev => {
              window.__vehDocsTempMobile[type] = { data: ev.target.result, type: file.type, nom: file.name };
              const card = b.querySelector(`.m-card[data-veh-doc-type="${type}"]`);
              const status = card?.querySelector('.m-veh-doc-status');
              if (status) { status.textContent = '✅ ' + file.name + ' (uploadé après save)'; status.style.color = 'var(--m-green)'; }
            };
            reader.readAsDataURL(file);
          });
        });
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm(`Supprimer définitivement le véhicule ${v.immat} ?`, { titre: 'Supprimer véhicule' })) return;
          M.sauvegarder('vehicules', M.charger('vehicules').filter(x => x.id !== v.id));
          M.toast('🗑️ Véhicule supprimé');
          M.state.detail.vehicules = null;
          M.closeSheet();
          M.go('vehicules');
        });
        // Docs véhicule (mode édition uniquement) : upload / view / delete
        const refreshVehDocCard = (type) => {
          const veh = M.charger('vehicules').find(x => x.id === v.id);
          const doc = veh?.docs?.[type];
          const card = b.querySelector(`.m-card[data-veh-doc-type="${type}"]`);
          if (!card) return;
          const status = card.querySelector('.m-veh-doc-status');
          if (status) {
            status.textContent = doc ? '✅ ' + (doc.nom || 'Document enregistré') : 'Aucun fichier';
            status.style.color = doc ? 'var(--m-green)' : 'var(--m-text-muted)';
          }
          const actions = card.lastElementChild;
          actions.innerHTML = `
            ${doc ? `<button type="button" class="m-btn m-veh-doc-view" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">👁</button>
                   <button type="button" class="m-btn m-btn-danger m-veh-doc-del" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">🗑</button>` : ''}
            <label class="m-btn" style="width:auto;padding:0 10px;height:38px;font-size:.78rem;display:inline-flex;align-items:center;cursor:pointer;margin:0">
              ${doc ? '↻' : '📎'}
              <input type="file" class="m-veh-doc-input" data-type="${type}" accept="image/*,application/pdf" style="display:none" />
            </label>`;
          wireVehDocActions();
        };
        const wireVehDocActions = () => {
          b.querySelectorAll('.m-veh-doc-input').forEach(inp => {
            inp.onchange = async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const type = e.target.dataset.type;
              const card = b.querySelector(`.m-card[data-veh-doc-type="${type}"]`);
              const status = card?.querySelector('.m-veh-doc-status');
              if (status) { status.textContent = '⏳ Envoi...'; status.style.color = 'var(--m-accent)'; }
              const ok = await M.uploaderDocVehicule(file, type, v.id);
              if (ok) M.toast('✅ Document enregistré');
              refreshVehDocCard(type);
              e.target.value = '';
            };
          });
          b.querySelectorAll('.m-veh-doc-view').forEach(btn => {
            btn.onclick = () => M.visualiserDocVehicule(v.id, btn.dataset.type);
          });
          b.querySelectorAll('.m-veh-doc-del').forEach(btn => {
            btn.onclick = async () => {
              const type = btn.dataset.type;
              const meta = M.DOC_TYPES_VEHICULE.find(x => x.type === type);
              if (!await M.confirm(`Supprimer le document "${meta?.label || type}" ?`, { titre: 'Supprimer document' })) return;
              const ok = await M.supprimerDocVehicule(v.id, type);
              if (ok) {
                refreshVehDocCard(type);
                M.toast('🗑️ Document supprimé');
              }
            };
          });
        };
        wireVehDocActions();
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.immat?.trim()) { M.toast('⚠️ Immatriculation obligatoire'); return false; }
        const arr = M.charger('vehicules');
        // Resolve salNom depuis salId pour coherence avec desktop (lookup vise)
        const sal = f.salId ? salaries.find(s => s.id === f.salId) : null;
        const data = {
          immat: f.immat.trim().toUpperCase(),
          marque: f.marque?.trim() || '',
          modele: f.modele?.trim() || '',
          dateCT: f.dateCT || '',
          dateAssurance: f.dateAssurance || '',
          dateAcquisition: f.dateAcquisition || '',
          dateMiseEnCirculation: f.dateMiseEnCirculation || '',
          km: M.parseNum(f.km) || 0,
          kmInitial: M.parseNum(f.kmInitial) || 0,
          modeAcquisition: f.modeAcquisition || '',
          typeCarburant: f.typeCarburant || '',
          carburant: f.typeCarburant || '',  // alias PC pour filtres
          entretienIntervalKm: M.parseNum(f.entretienIntervalKm) || 0,
          salId: f.salId || null,
          chaufId: f.salId || null,           // dual-write PC
          salNom: sal ? ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '')).trim() : ''
        };
        let vehId;
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === v.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('vehicules', arr);
          vehId = v.id;
          M.toast('✅ Véhicule modifié');
        } else {
          vehId = M.genId();
          arr.push({ id: vehId, creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('vehicules', arr);
          M.toast('✅ Véhicule enregistré');
        }
        // Upload des documents temp (mode création) après que le vehId existe
        if (!enEdition && window.__vehDocsTempMobile && Object.keys(window.__vehDocsTempMobile).length) {
          const temp = Object.assign({}, window.__vehDocsTempMobile);
          window.__vehDocsTempMobile = {};
          (async () => {
            for (const [type, d] of Object.entries(temp)) {
              if (!d?.data) continue;
              try {
                const blob = window.DelivProStorage?.dataUrlToBlob ? window.DelivProStorage.dataUrlToBlob(d.data) : null;
                const file = blob ? new File([blob], d.nom || type, { type: d.type }) : null;
                if (file) await M.uploaderDocVehicule(file, type, vehId);
              } catch (err) { console.warn('[mobile] upload veh doc temp', type, err); }
            }
            M.toast('✅ Documents véhicule uploadés');
          })();
        }
        M.go('vehicules');
        return true;
      }
    });
  };
  M.editerVehicule = function(id) {
    const v = M.charger('vehicules').find(x => x.id === id);
    if (!v) return M.toast('Véhicule introuvable');
    M.formNouveauVehicule(v);
  };

  // ---- DOCS VEHICULE (pattern miroir docs salarié, bucket vehicules-docs) ----
  // 5 types : carte_grise / assurance / ct / photos / autre.
  // Bucket Supabase 'vehicules-docs' (à créer s'il n'existe pas dans Supabase).
  M.DOC_TYPES_VEHICULE = [
    { type: 'carte_grise', label: 'Carte grise',       icon: '🪪' },
    { type: 'assurance',   label: 'Attestation assurance', icon: '🛡️' },
    { type: 'ct',          label: 'Contrôle technique', icon: '🔧' },
    { type: 'photos',      label: 'Photos véhicule',    icon: '📷' },
    { type: 'autre',       label: 'Autre document',     icon: '📎' }
  ];

  M.uploaderDocVehicule = async function(file, type, vehId) {
    if (!file) return false;
    if (!/^application\/pdf$|^image\//i.test(file.type)) {
      M.toast('⚠️ Format non supporté (PDF ou image attendu)'); return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      M.toast('⚠️ Fichier trop lourd (5 Mo max)'); return false;
    }
    if (!window.DelivProStorage) {
      M.toast('⚠️ Storage Supabase indisponible'); return false;
    }
    const cleanName = window.DelivProStorage.sanitizeFilename(file.name);
    const path = `${vehId}/${type}/${Date.now()}_${cleanName}`;
    const up = await window.DelivProStorage.uploadBlob('vehicules-docs', path, file, { contentType: file.type });
    if (!up.ok) {
      M.toast('⚠️ Upload échoué : ' + (up.error?.message || 'erreur'));
      return false;
    }
    const arr = M.charger('vehicules');
    const idx = arr.findIndex(x => x.id === vehId);
    if (idx < 0) return false;
    const previous = arr[idx].docs?.[type];
    arr[idx].docs = arr[idx].docs || {};
    arr[idx].docs[type] = {
      storage_path: path,
      bucket: 'vehicules-docs',
      type: file.type,
      nom: file.name,
      taille: file.size,
      uploaded_at: new Date().toISOString()
    };
    arr[idx].modifieLe = new Date().toISOString();
    M.sauvegarder('vehicules', arr);
    if (previous?.storage_path && previous.storage_path !== path) {
      window.DelivProStorage.remove('vehicules-docs', previous.storage_path).catch(()=>{});
    }
    return true;
  };

  M.visualiserDocVehicule = async function(vehId, type) {
    const veh = M.charger('vehicules').find(v => v.id === vehId);
    const doc = veh?.docs?.[type];
    if (!doc) { M.toast('Aucun document de ce type'); return; }
    const meta = M.DOC_TYPES_VEHICULE.find(x => x.type === type);
    const titre = (veh.immat || 'Véhicule') + ' — ' + (meta?.label || type);
    if (doc.data && String(doc.data).indexOf('data:') === 0) {
      M.afficherDocInline(doc.data, doc.type || (doc.data.includes('pdf') ? 'application/pdf' : 'image/*'), titre);
      return;
    }
    if (!doc.storage_path || !window.DelivProStorage) {
      M.toast('Document indisponible'); return;
    }
    M.toast('⏳ Chargement...');
    const dl = await window.DelivProStorage.download(doc.bucket || 'vehicules-docs', doc.storage_path);
    if (!dl.ok) { M.toast('⚠️ Lien indisponible : ' + (dl.error?.message || 'erreur')); return; }
    const objectUrl = URL.createObjectURL(dl.blob);
    M.afficherDocInline(objectUrl, doc.type || dl.blob.type, titre);
  };

  M.supprimerDocVehicule = async function(vehId, type) {
    const arr = M.charger('vehicules');
    const idx = arr.findIndex(v => v.id === vehId);
    if (idx < 0) return false;
    const doc = arr[idx].docs?.[type];
    if (!doc) return false;
    if (doc.storage_path && window.DelivProStorage) {
      await window.DelivProStorage.remove(doc.bucket || 'vehicules-docs', doc.storage_path).catch(()=>{});
    }
    delete arr[idx].docs[type];
    arr[idx].modifieLe = new Date().toISOString();
    M.sauvegarder('vehicules', arr);
    return true;
  };

  // ---- DOCS SALARIE (port PC : upload Supabase Storage bucket salaries-docs) ----
  // 5 types : permis / cni / iban / vitale / medecine
  M.DOC_TYPES_SALARIE = [
    { type: 'permis',   label: 'Permis B',           icon: '🪪' },
    { type: 'cni',      label: 'CNI / Passeport',    icon: '🪪' },
    { type: 'iban',     label: 'RIB / IBAN',         icon: '🏦' },
    { type: 'vitale',   label: 'Carte vitale',       icon: '⚕️' },
    { type: 'medecine', label: 'Médecine du travail', icon: '🏥' }
  ];

  // Upload immediat vers Supabase Storage (mode edition).
  // Stocke storage_path dans salarie.docs[type]. Trace dans salaries_documents.
  M.uploaderDocSalarie = async function(file, type, salId) {
    if (!file) return false;
    if (!/^application\/pdf$|^image\//i.test(file.type)) {
      M.toast('⚠️ Format non supporté (PDF ou image attendu)'); return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      M.toast('⚠️ Fichier trop lourd (5 Mo max)'); return false;
    }
    if (!window.DelivProStorage) {
      M.toast('⚠️ Storage Supabase indisponible'); return false;
    }
    const cleanName = window.DelivProStorage.sanitizeFilename(file.name);
    const path = `${salId}/${type}/${Date.now()}_${cleanName}`;
    const up = await window.DelivProStorage.uploadBlob('salaries-docs', path, file, { contentType: file.type });
    if (!up.ok) {
      M.toast('⚠️ Upload échoué : ' + (up.error?.message || 'erreur'));
      return false;
    }
    const arr = M.charger('salaries');
    const idx = arr.findIndex(x => x.id === salId);
    if (idx < 0) return false;
    const previous = arr[idx].docs?.[type];
    arr[idx].docs = arr[idx].docs || {};
    arr[idx].docs[type] = {
      storage_path: path,
      bucket: 'salaries-docs',
      type: file.type,
      nom: file.name,
      taille: file.size,
      uploaded_at: new Date().toISOString()
    };
    arr[idx].modifieLe = new Date().toISOString();
    M.sauvegarder('salaries', arr);
    // Trace dans salaries_documents (audit/historique, comme PC)
    try {
      const client = window.DelivProSupabase?.getClient();
      if (client) {
        await client.from('salaries_documents').insert({
          salarie_id: salId, type,
          storage_path: path, mime_type: file.type,
          taille_octets: file.size, nom_fichier: file.name
        });
      }
    } catch (_) { /* non bloquant */ }
    // Supprime ancien fichier si remplacement
    if (previous?.storage_path && previous.storage_path !== path) {
      window.DelivProStorage.remove('salaries-docs', previous.storage_path).catch(()=>{});
    }
    return true;
  };

  // Viewer media inline (modal plein ecran, pas de popup Safari).
  // Affiche image inline ; PDF -> carte avec boutons Ouvrir/Telecharger
  // (iOS Safari refuse de rendre les PDF en iframe ou embed).
  M.afficherDocInline = function(url, mime, titre) {
    document.querySelector('.m-doc-viewer')?.remove();
    const isPdf = (mime || '').includes('pdf');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const fname = (titre || 'document').replace(/[^a-zA-Z0-9._-]/g, '_') + (isPdf ? '.pdf' : '');

    const overlay = document.createElement('div');
    overlay.className = 'm-doc-viewer';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column';

    let bodyHtml = '';
    if (!isPdf) {
      bodyHtml = `<img src="${url}" alt="${M.escHtml(titre || 'doc')}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px" />`;
    } else if (isIOS) {
      // iOS : iframe PDF marche pas. Carte avec boutons d'action en lien direct
      // (les <a target=_blank> ne sont PAS bloqués par Safari, contrairement à window.open).
      bodyHtml = `
        <div style="background:#1a1a1a;border-radius:14px;padding:28px 22px;max-width:340px;width:100%;text-align:center;color:#fff">
          <div style="font-size:3.5rem;line-height:1;margin-bottom:14px">📄</div>
          <div style="font-weight:600;font-size:1.05rem;margin-bottom:22px;word-break:break-word">${M.escHtml(titre || 'Document PDF')}</div>
          <a href="${url}" target="_blank" rel="noopener" style="display:block;background:var(--m-accent);color:#1a1208;text-decoration:none;font-weight:700;padding:14px;border-radius:12px;margin-bottom:10px;font-size:.95rem">🔍 Ouvrir le PDF</a>
          <a href="${url}" download="${M.escHtml(fname)}" style="display:block;background:#374151;color:#fff;text-decoration:none;font-weight:600;padding:14px;border-radius:12px;font-size:.95rem">⬇ Télécharger</a>
        </div>
      `;
    } else {
      // Android / desktop : iframe marche
      bodyHtml = `<iframe src="${url}" style="width:100%;height:100%;border:0;background:#fff"></iframe>`;
    }

    const isCard = isPdf && isIOS;
    overlay.innerHTML = `
      <header style="flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 14px;padding-top:max(12px,env(safe-area-inset-top));background:rgba(0,0,0,.4);color:#fff">
        <div style="flex:1 1 auto;font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(titre || 'Document')}</div>
        ${!isCard ? `<a href="${url}" download="${M.escHtml(fname)}" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;text-decoration:none;font-size:1rem">⬇</a>` : ''}
        <button type="button" class="m-doc-viewer-close" aria-label="Fermer" style="flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;border:none;font-size:1.1rem">✕</button>
      </header>
      <div style="flex:1 1 auto;overflow:auto;display:flex;align-items:${isCard ? 'center' : (isPdf ? 'stretch' : 'center')};justify-content:center;padding:${isPdf && !isCard ? '0' : '14px'}">
        ${bodyHtml}
      </div>
    `;
    const close = () => { overlay.remove(); document.body.style.overflow = ''; };
    overlay.querySelector('.m-doc-viewer-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  };

  // Visualisation : download blob + objectURL affiche dans viewer inline.
  M.visualiserDocSalarie = async function(salId, type) {
    const sal = M.charger('salaries').find(s => s.id === salId);
    const doc = sal?.docs?.[type];
    if (!doc) { M.toast('Aucun document de ce type'); return; }
    const meta = M.DOC_TYPES_SALARIE.find(x => x.type === type);
    const titre = (sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '') + ' — ' + (meta?.label || type);
    // Cas legacy base64 (anciens uploads PC)
    if (doc.data && String(doc.data).indexOf('data:') === 0) {
      M.afficherDocInline(doc.data, doc.type || (doc.data.includes('pdf') ? 'application/pdf' : 'image/*'), titre);
      return;
    }
    if (!doc.storage_path || !window.DelivProStorage) {
      M.toast('Document indisponible'); return;
    }
    M.toast('⏳ Chargement...');
    const dl = await window.DelivProStorage.download(doc.bucket || 'salaries-docs', doc.storage_path);
    if (!dl.ok) { M.toast('⚠️ Lien indisponible : ' + (dl.error?.message || 'erreur')); return; }
    const objectUrl = URL.createObjectURL(dl.blob);
    M.afficherDocInline(objectUrl, doc.type || dl.blob.type, titre);
    // Le revoke se fait quand le user ferme (pas critique : navigateur libère au unload)
  };

  // Suppression : remove du bucket + clear de salarie.docs[type]
  M.supprimerDocSalarie = async function(salId, type) {
    const arr = M.charger('salaries');
    const idx = arr.findIndex(s => s.id === salId);
    if (idx < 0) return false;
    const doc = arr[idx].docs?.[type];
    if (!doc) return false;
    if (doc.storage_path && window.DelivProStorage) {
      await window.DelivProStorage.remove(doc.bucket || 'salaries-docs', doc.storage_path).catch(()=>{});
    }
    delete arr[idx].docs[type];
    arr[idx].modifieLe = new Date().toISOString();
    M.sauvegarder('salaries', arr);
    return true;
  };

  // ---- SALARIE ----
  M.formNouveauSalarie = function(existing) {
    const enEdition = !!existing;
    const s = existing || {};
    const body = `
      <div class="m-form-row">
        ${M.formField('Prénom', M.formInput('prenom', { value: s.prenom || '', placeholder: 'Jean', autocomplete: 'given-name' }))}
        ${M.formField('Nom', M.formInput('nom', { value: s.nom || '', placeholder: 'Dupont', required: true, autocomplete: 'family-name' }), { required: true })}
      </div>
      <div class="m-form-row">
        ${M.formField('Téléphone', M.formInput('tel', { type: 'tel', value: s.tel || '', placeholder: '06 12 34 56 78', autocomplete: 'tel' }))}
        ${M.formField('Email', M.formInput('email', { type: 'email', value: s.email || '', placeholder: 'jean@...', autocomplete: 'email' }))}
      </div>
      ${M.formField('Adresse', M.formInput('adresse', { value: s.adresse || '', placeholder: 'Rue, ville' }))}
      <div class="m-form-row">
        ${M.formField('N° matricule', M.formInput('numero', { value: s.numero || '', placeholder: 'Auto si vide (MCA001, MCA002...)' }))}
        ${M.formField('Poste', M.formInput('poste', { value: s.poste || '', placeholder: 'Chauffeur, manutentionnaire...' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Catégorie permis', M.formSelect('catPermis', [
          { value: '',      label: '—' },
          { value: 'B',     label: 'B (VL ≤ 3,5 t)' },
          { value: 'autre', label: 'Autre (étranger / équivalent)' }
        ], { value: s.catPermis || '' }))}
        ${M.formField('Date permis', M.formInput('datePermis', { type: 'date', value: s.datePermis || '' }))}
      </div>
      ${M.formField('Date assurance', M.formInput('dateAssurance', { type: 'date', value: s.dateAssurance || '' }))}
      <div class="m-form-row">
        ${M.formField('Date visite médicale', M.formInput('visiteMedicale', { type: 'date', value: s.visiteMedicale || '' }))}
        ${M.formField('Aptitude', M.formSelect('aptitude', [
          { value: '',                 label: '—' },
          { value: 'apte',             label: 'Apte' },
          { value: 'apte_restrictions', label: 'Apte avec restrictions' },
          { value: 'inapte',           label: 'Inapte' }
        ], { value: s.aptitude || '' }))}
      </div>
      ${M.formField('Statut', M.formSelect('statut', [
        { value: 'actif',    label: '✅ Actif' },
        { value: 'inactif',  label: '⏸️ Inactif' }
      ], { value: s.statut || (s.actif === false ? 'inactif' : 'actif') }))}

      <!-- Mot de passe (acces salarie) : option de generation, hash via security-utils PBKDF2 (compat PC) -->
      <div class="m-form-field" style="margin-top:14px">
        <label class="m-form-label">${s.mdpHash ? '🔐 Réinitialiser mot de passe' : '🔐 Mot de passe (accès salarié)'}</label>
        <div style="display:flex;gap:8px">
          <input type="text" name="mdpClair" id="m-sal-mdp" placeholder="${s.mdpHash ? 'Laisser vide = inchangé' : 'Au moins 8 caractères'}" value="" autocomplete="new-password" style="flex:1 1 auto" />
          <button type="button" id="m-sal-mdp-gen" class="m-btn" style="flex:0 0 auto;width:auto;padding:0 14px">🎲 Générer</button>
        </div>
        <p class="m-form-hint">${s.mdpHash ? 'Le mot de passe actuel est conservé si tu laisses vide.' : 'Génère ou tape un mot de passe. Hashé via PBKDF2 avant stockage.'}</p>
      </div>

      ${enEdition ? `
      <details style="margin-top:14px;border:1px solid var(--m-border);border-radius:12px;padding:0;overflow:hidden" ${s.docs && Object.keys(s.docs).length ? 'open' : ''}>
        <summary style="padding:14px;background:var(--m-bg-elevated);cursor:pointer;font-weight:600;font-size:.95rem">📎 Documents (Permis, CNI, RIB, Vitale, Médecine)</summary>
        <div style="padding:14px" id="m-sal-docs-list" data-sal-id="${M.escHtml(s.id)}">
          ${M.DOC_TYPES_SALARIE.map(({ type, label, icon }) => {
            const doc = s.docs?.[type];
            return `<div class="m-card" data-doc-type="${type}" style="padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
              <div style="font-size:1.2rem;flex:0 0 auto">${icon}</div>
              <div style="flex:1 1 auto;min-width:0">
                <div style="font-weight:600;font-size:.88rem">${label}</div>
                <div class="m-doc-status" style="font-size:.74rem;color:${doc ? 'var(--m-green)' : 'var(--m-text-muted)'};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${doc ? '✅ ' + M.escHtml(doc.nom || 'Document enregistré') : 'Aucun fichier'}
                </div>
              </div>
              <div style="display:flex;gap:6px;flex:0 0 auto">
                ${doc ? `<button type="button" class="m-btn m-doc-view" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">👁</button>
                       <button type="button" class="m-btn m-btn-danger m-doc-del" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">🗑</button>` : ''}
                <label class="m-btn m-doc-upload-label" style="width:auto;padding:0 10px;height:38px;font-size:.78rem;display:inline-flex;align-items:center;cursor:pointer;margin:0">
                  ${doc ? '↻' : '📎'}
                  <input type="file" class="m-doc-input" data-type="${type}" accept="image/*,application/pdf" style="display:none" />
                </label>
              </div>
            </div>`;
          }).join('')}
          <p class="m-form-hint" style="margin-top:6px">PDF ou image, 5 Mo max. Stocké chiffré sur Supabase Storage.</p>
        </div>
      </details>
      ` : '<p class="m-form-hint" style="margin-top:14px">💡 Les documents (permis, CNI, RIB...) seront uploadables après la première sauvegarde.</p>'}

      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer ce salarié</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier salarié' : '➕ Nouveau salarié',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        // Bouton "Générer" mot de passe (toujours dispo, edit ou nouveau)
        b.querySelector('#m-sal-mdp-gen')?.addEventListener('click', () => {
          const nomRaw = b.querySelector('input[name=nom]')?.value || s.nom || 'MCA';
          // Format : 1ere lettre maj + reste min + '!' + 4 chiffres (memes regles que PC)
          const baseRaw = String(nomRaw).replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'MCA';
          const base = baseRaw.charAt(0).toUpperCase() + baseRaw.slice(1).toLowerCase();
          const suffixe = String(Math.floor(1000 + Math.random() * 9000));
          const mdp = base + '!' + suffixe;
          const input = b.querySelector('#m-sal-mdp');
          if (input) input.value = mdp;
          M.toast(`🔐 ${mdp} (copié)`, { duration: 4500 });
          // Copie auto dans le presse-papier
          if (navigator.clipboard) navigator.clipboard.writeText(mdp).catch(()=>{});
        });
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm(`Supprimer définitivement ${s.prenom || ''} ${s.nom || ''} ?\n\nCela retirera aussi : références chauffeur dans les livraisons, dans les véhicules, plannings, heures saisies.`, { titre: 'Supprimer salarié' })) return;
          // Cascade : supprime salarié + chauffeur + références
          M.sauvegarder('salaries', M.charger('salaries').filter(x => x.id !== s.id));
          M.sauvegarder('chauffeurs', M.charger('chauffeurs').filter(c => c.id !== s.id));
          // Détache des livraisons (garde la livraison mais nettoie chaufId/salarieId)
          const livs = M.charger('livraisons').map(l => {
            if (l.chaufId === s.id || l.salarieId === s.id) {
              return { ...l, chaufId: null, salarieId: null, chaufNom: '', salNom: '' };
            }
            return l;
          });
          M.sauvegarder('livraisons', livs);
          // Détache des véhicules
          const vehs = M.charger('vehicules').map(v => {
            if (v.salId === s.id || v.chaufId === s.id) {
              return { ...v, salId: null, chaufId: null, salNom: '' };
            }
            return v;
          });
          M.sauvegarder('vehicules', vehs);
          // Supprime planning du salarié
          M.sauvegarder('plannings', M.charger('plannings').filter(p => p.salId !== s.id));
          // Supprime ses saisies heures
          M.sauvegarder('heures', M.charger('heures').filter(h => h.salId !== s.id && h.salarieId !== s.id));
          M.ajouterAudit?.('Suppression salarié', ((s.prenom || '') + ' ' + (s.nom || '')).trim());
          M.toast('🗑️ Salarié supprimé (cascade complète)');
          M.state.detail.salaries = null;
          M.closeSheet();
          M.go('salaries');
        });
        // Docs salarie : upload / view / delete (mode edition uniquement)
        const refreshDocCard = (type) => {
          const sal = M.charger('salaries').find(x => x.id === s.id);
          const doc = sal?.docs?.[type];
          const card = b.querySelector(`.m-card[data-doc-type="${type}"]`);
          if (!card) return;
          const status = card.querySelector('.m-doc-status');
          if (status) {
            status.textContent = doc ? '✅ ' + (doc.nom || 'Document enregistré') : 'Aucun fichier';
            status.style.color = doc ? 'var(--m-green)' : 'var(--m-text-muted)';
          }
          // Reconstruit la zone boutons (view/del/upload)
          const actions = card.lastElementChild;
          const meta = M.DOC_TYPES_SALARIE.find(x => x.type === type);
          actions.innerHTML = `
            ${doc ? `<button type="button" class="m-btn m-doc-view" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">👁</button>
                   <button type="button" class="m-btn m-btn-danger m-doc-del" data-type="${type}" style="width:auto;padding:0 10px;height:38px;font-size:.78rem">🗑</button>` : ''}
            <label class="m-btn m-doc-upload-label" style="width:auto;padding:0 10px;height:38px;font-size:.78rem;display:inline-flex;align-items:center;cursor:pointer;margin:0">
              ${doc ? '↻' : '📎'}
              <input type="file" class="m-doc-input" data-type="${type}" accept="image/*,application/pdf" style="display:none" />
            </label>`;
          wireDocActions();
        };
        const wireDocActions = () => {
          b.querySelectorAll('.m-doc-input').forEach(inp => {
            inp.onchange = async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const type = e.target.dataset.type;
              const card = b.querySelector(`.m-card[data-doc-type="${type}"]`);
              const status = card?.querySelector('.m-doc-status');
              if (status) { status.textContent = '⏳ Envoi...'; status.style.color = 'var(--m-accent)'; }
              const ok = await M.uploaderDocSalarie(file, type, s.id);
              if (ok) {
                refreshDocCard(type);
                M.toast('✅ Document enregistré');
              } else {
                refreshDocCard(type);
              }
              e.target.value = '';
            };
          });
          b.querySelectorAll('.m-doc-view').forEach(btn => {
            btn.onclick = () => M.visualiserDocSalarie(s.id, btn.dataset.type);
          });
          b.querySelectorAll('.m-doc-del').forEach(btn => {
            btn.onclick = async () => {
              const type = btn.dataset.type;
              const meta = M.DOC_TYPES_SALARIE.find(x => x.type === type);
              if (!await M.confirm(`Supprimer le document "${meta?.label || type}" ?`, { titre: 'Supprimer document' })) return;
              const ok = await M.supprimerDocSalarie(s.id, type);
              if (ok) {
                refreshDocCard(type);
                M.toast('🗑️ Document supprimé');
              }
            };
          });
        };
        wireDocActions();
      },
      async onSubmit() {
        const f = M.lireFormSheet();
        if (!f.nom?.trim()) { M.toast('⚠️ Nom obligatoire'); return false; }
        const arr = M.charger('salaries');
        // Auto-genere un numero si vide : sinon adapter Supabase rejette
        // (jsToDb returns null si pas de numero) -> le salarie disparait au refresh.
        let numero = f.numero?.trim().toUpperCase() || '';
        if (!numero) {
          // Cherche le prochain numero libre format MCA001
          const existants = new Set(arr.map(x => (x.numero || '').toUpperCase()));
          let n = 1;
          while (existants.has('MCA' + String(n).padStart(3, '0'))) n++;
          numero = 'MCA' + String(n).padStart(3, '0');
        } else if (!enEdition && arr.find(x => (x.numero || '').toUpperCase() === numero)) {
          M.toast('⚠️ Ce numéro existe déjà'); return false;
        }
        // Schéma aligné PC (script-salaries.js:535-538) : nom = "Prénom Nom"
        // (nomComplet), nomFamille = nom seul, prenom à part. Multi-device OK.
        const prenomT = f.prenom?.trim() || '';
        const nomFam = f.nom.trim();
        const nomComplet = (prenomT ? prenomT + ' ' : '') + nomFam;
        const data = {
          prenom: prenomT,
          nom: nomComplet,
          nomFamille: nomFam,
          tel: f.tel?.trim() || '',
          email: f.email?.trim() || '',
          adresse: f.adresse?.trim() || '',
          numero,
          poste: f.poste?.trim() || '',
          catPermis: f.catPermis || '',
          datePermis: f.datePermis || '',
          dateAssurance: f.dateAssurance || '',
          visiteMedicale: f.visiteMedicale || '',
          aptitude: f.aptitude || '',
          statut: f.statut || 'actif',
          actif: (f.statut || 'actif') === 'actif'
        };
        // Mot de passe : si saisi, hasher via security-utils.hashPassword (PBKDF2)
        // pour compat avec verification cote PC
        const mdpClair = (f.mdpClair || '').trim();
        if (mdpClair) {
          try {
            if (window.DelivProSecurity?.hashPassword) {
              data.mdpHash = await window.DelivProSecurity.hashPassword(mdpClair);
            } else {
              // fallback btoa si security-utils pas charge (ne devrait pas arriver)
              data.mdpHash = btoa(unescape(encodeURIComponent(mdpClair)));
            }
          } catch (e) {
            M.toast('⚠️ Erreur hash mot de passe');
            return false;
          }
        }
        let salId;
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === s.id);
          if (idx >= 0) {
            arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
            salId = arr[idx].id;
          }
          M.sauvegarder('salaries', arr);
          M.toast('✅ Salarié modifié');
        } else {
          salId = M.genId();
          arr.push({ id: salId, creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('salaries', arr);
          M.toast('✅ Salarié enregistré');
        }
        // Sync chauffeurs[] (mirror PC creerSalarie:590-594) : pour que le
        // salarié apparaisse dans les selects livraisons côté PC.
        try {
          const chauffeurs = M.charger('chauffeurs');
          const idxC = chauffeurs.findIndex(c => c.id === salId);
          const chData = { id: salId, nom: nomComplet, nomFamille: nomFam, prenom: prenomT, tel: data.tel };
          if (idxC >= 0) chauffeurs[idxC] = { ...chauffeurs[idxC], ...chData };
          else chauffeurs.push(chData);
          M.sauvegarder('chauffeurs', chauffeurs);
        } catch (_) { /* non bloquant */ }
        M.go('salaries');
        return true;
      }
    });
  };
  M.editerSalarie = function(id) {
    const s = M.charger('salaries').find(x => x.id === id);
    if (!s) return M.toast('Salarié introuvable');
    M.formNouveauSalarie(s);
  };

  // ---- FOURNISSEUR ----
  M.formNouveauFournisseur = function(existing) {
    const enEdition = !!existing;
    const f = existing || {};
    const body = `
      ${M.formField('Nom du fournisseur', M.formInput('nom', { value: f.nom || '', placeholder: 'Société', required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Téléphone', M.formInput('tel', { type: 'tel', value: f.tel || '', placeholder: '06 12 34 56 78', autocomplete: 'tel' }))}
        ${M.formField('Email', M.formInput('email', { type: 'email', value: f.email || '', placeholder: 'contact@...', autocomplete: 'email' }))}
      </div>
      ${M.formField('Adresse', M.formInput('adresse', { value: f.adresse || '', placeholder: 'Rue + numéro' }))}
      <div class="m-form-row">
        ${M.formField('Code postal', M.formInput('cp', { value: f.cp || '', placeholder: '75000', autocomplete: 'postal-code' }))}
        ${M.formField('Ville', M.formInput('ville', { value: f.ville || '', placeholder: 'Paris', autocomplete: 'address-level2' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('SIRET', M.formInput('siret', { value: f.siret || '', placeholder: '123 456 789 00012' }))}
        ${M.formField('N° TVA', M.formInput('tva', { value: f.tva || '', placeholder: 'FR12345678901' }))}
      </div>
      ${M.formField('IBAN', M.formInput('iban', { value: f.iban || '', placeholder: 'FR76 …' }))}
      ${M.formField('Mode paiement préféré', M.formSelect('modePaiement', [
        { value: '',            label: '—' },
        { value: 'virement',    label: 'Virement' },
        { value: 'prelevement', label: 'Prélèvement SEPA' },
        { value: 'cb',          label: 'Carte bancaire' },
        { value: 'cheque',      label: 'Chèque' },
        { value: 'especes',     label: 'Espèces' }
      ], { value: f.modePaiement || '' }))}
      ${M.formField('Notes', M.formTextarea('notes', { value: f.notes || '', rows: 2, placeholder: 'Conditions, contact, etc.' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer ce fournisseur</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier fournisseur' : '➕ Nouveau fournisseur',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm(`Supprimer définitivement le fournisseur ${f.nom} ?`, { titre: 'Supprimer fournisseur' })) return;
          M.sauvegarder('fournisseurs', M.charger('fournisseurs').filter(x => x.id !== f.id));
          M.toast('🗑️ Fournisseur supprimé');
          M.state.detail.fournisseurs = null;
          M.closeSheet();
          M.go('fournisseurs');
        });
      },
      onSubmit() {
        const v = M.lireFormSheet();
        if (!v.nom?.trim()) { M.toast('⚠️ Nom obligatoire'); return false; }
        const arr = M.charger('fournisseurs');
        const data = {
          nom: v.nom.trim(),
          tel: v.tel?.trim() || '',
          email: v.email?.trim() || '',
          adresse: v.adresse?.trim() || '',
          cp: v.cp?.trim() || '',
          ville: v.ville?.trim() || '',
          siret: v.siret?.trim() || '',
          tva: v.tva?.trim() || '',
          iban: v.iban?.trim() || '',
          modePaiement: v.modePaiement || '',
          notes: v.notes?.trim() || ''
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === f.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('fournisseurs', arr);
          M.toast('✅ Fournisseur modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('fournisseurs', arr);
          M.toast('✅ Fournisseur enregistré');
        }
        M.go('fournisseurs');
        return true;
      }
    });
  };
  M.editerFournisseur = function(id) {
    const f = M.charger('fournisseurs').find(x => x.id === id);
    if (!f) return M.toast('Fournisseur introuvable');
    M.formNouveauFournisseur(f);
  };

  // ============================================================
  // Forms Inspections / Incidents / Entretiens (v3.8)
  // ============================================================

  // Helper : redimensionne une image en base64 (max 800px) pour eviter de saturer localStorage
  M.resizeImageToBase64 = function(file, maxDim = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Image illisible'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Lecture fichier echouee'));
      reader.readAsDataURL(file);
    });
  };

  // ---- INSPECTION ----
  M.formNouvelleInspection = function(existing) {
    const enEdition = !!existing;
    const insp = existing || { photos: [] };
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
    const today = new Date().toISOString().slice(0, 10);
    const photos = Array.isArray(insp.photos) ? [...insp.photos] : [];

    const renderPhotosGrid = () => {
      if (!photos.length) return '<p class="m-form-hint">Aucune photo ajoutée</p>';
      return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
        ${photos.map((p, idx) => {
          const url = typeof p === 'string' ? p : (p.url || p.dataUrl || '');
          return `<div style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--m-bg-elevated);border:1px solid var(--m-border)">
            <img src="${M.escHtml(url)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" />
            <button type="button" class="m-photo-remove" data-idx="${idx}" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(231,76,60,0.85);color:#fff;border:none;font-size:.85rem;font-weight:700;cursor:pointer">✕</button>
          </div>`;
        }).join('')}
      </div>`;
    };

    const body = `
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.id })), { placeholder: 'Choisir véhicule', value: insp.vehiculeId || '', required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: insp.date || today, required: true }), { required: true })}
        ${M.formField('Km compteur', M.formInputWithSuffix('km', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: insp.km || '' }))}
      </div>
      ${M.formField('Effectuée par', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { placeholder: 'Choisir un salarié', value: insp.salId || '' }))}
      <div class="m-form-field">
        <label class="m-form-label">📸 Photos</label>
        <div id="m-photos-container">${renderPhotosGrid()}</div>
        <label for="m-photos-input" class="m-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;cursor:pointer">
          <span>📷</span><span>Ajouter une photo</span>
        </label>
        <input type="file" id="m-photos-input" accept="image/*" capture="environment" multiple style="display:none" />
      </div>
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cette inspection</button>` : ''}
    `;

    M.openSheet({
      title: enEdition ? '✏️ Modifier inspection' : '🚗 Nouvelle inspection',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        const input = b.querySelector('#m-photos-input');
        const container = b.querySelector('#m-photos-container');
        const refresh = () => { container.innerHTML = renderPhotosGrid(); attachRemove(); };
        const attachRemove = () => {
          container.querySelectorAll('.m-photo-remove').forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = parseInt(btn.dataset.idx);
              photos.splice(idx, 1);
              refresh();
            });
          });
        };
        attachRemove();
        input.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []);
          for (const f of files) {
            try {
              const dataUrl = await M.resizeImageToBase64(f, 800, 0.78);
              photos.push(dataUrl);
            } catch (err) {
              M.toast('⚠️ Photo non ajoutée');
            }
          }
          input.value = ''; // reset pour re-add la meme photo si besoin
          refresh();
        });
        if (enEdition) {
          b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm(`Supprimer définitivement cette inspection (${insp.vehImmat || ''}) ?`, { titre: 'Supprimer inspection' })) return;
            M.sauvegarder('inspections', M.charger('inspections').filter(x => x.id !== insp.id));
            M.toast('🗑️ Inspection supprimée');
            M.state.detail.inspections = null;
            M.closeSheet();
            M.go('inspections');
          });
        }
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.vehiculeId) { M.toast('⚠️ Véhicule obligatoire'); return false; }
        const veh = vehicules.find(v => v.id === f.vehiculeId);
        const sal = f.salId ? salaries.find(s => s.id === f.salId) : null;
        const arr = M.charger('inspections');
        const data = {
          date: f.date || today,
          vehiculeId: f.vehiculeId,
          vehId: f.vehiculeId,           // dual-write PC
          vehImmat: veh?.immat || '',
          salId: f.salId || null,
          chaufId: f.salId || null,      // dual-write PC
          salNom: sal ? ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '')).trim() : '',
          km: M.parseNum(f.km) || 0,
          photos: [...photos],
          source: 'mobile'
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === insp.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('inspections', arr);
          M.toast('✅ Inspection modifiée');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('inspections', arr);
          M.toast('✅ Inspection enregistrée');
        }
        M.go('inspections');
        return true;
      }
    });
  };
  M.editerInspection = function(id) {
    const insp = M.charger('inspections').find(x => x.id === id);
    if (!insp) return M.toast('Inspection introuvable');
    M.formNouvelleInspection(insp);
  };

  // ---- INCIDENT ----
  M.formNouvelIncident = function(existing) {
    const enEdition = !!existing;
    const inc = existing || {};
    const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
    const today = new Date().toISOString().slice(0, 10);
    const body = `
      ${M.formField('Date', M.formInput('date', { type: 'date', value: (inc.date || (inc.creeLe || '').slice(0, 10) || today), required: true }), { required: true })}
      ${M.formField('Client', M.formInput('client', { value: inc.client || '', placeholder: 'Nom du client (libre)' }))}
      ${M.formField('Salarié', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { placeholder: 'Aucun', value: inc.salId || '' }))}
      ${M.formField('N° livraison', M.formInput('numLiv', { value: inc.numLiv || '', placeholder: 'Si lié à une livraison' }))}
      <div class="m-form-row">
        ${M.formField('Gravité', M.formSelect('gravite', [
          { value: 'faible', label: 'Faible' },
          { value: 'moyen',  label: 'Moyen' },
          { value: 'grave',  label: '🔴 Grave' }
        ], { value: inc.gravite || 'moyen' }))}
        ${M.formField('Statut', M.formSelect('statut', [
          { value: 'ouvert',   label: '🔴 Ouvert' },
          { value: 'encours',  label: 'En cours' },
          { value: 'traite',   label: '✅ Traité' },
          { value: 'resolu',   label: '✅ Résolu' },
          { value: 'clos',     label: '🔒 Clos' }
        ], { value: inc.statut || 'ouvert' }))}
      </div>
      ${M.formField('Description', M.formTextarea('description', { value: inc.description || '', rows: 4, placeholder: 'Décris l\'incident en détails...' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cet incident</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier incident' : '🚨 Nouvel incident',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm('Supprimer définitivement cet incident ?', { titre: 'Supprimer incident' })) return;
          M.sauvegarder('incidents', M.charger('incidents').filter(x => x.id !== inc.id));
          M.toast('🗑️ Incident supprimé');
          M.state.detail.incidents = null;
          M.closeSheet();
          M.go('incidents');
        });
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.description?.trim()) { M.toast('⚠️ Description obligatoire'); return false; }
        if (!f.date) { M.toast('⚠️ Date requise'); return false; }
        const sal = f.salId ? salaries.find(s => s.id === f.salId) : null;
        const arr = M.charger('incidents');
        const data = {
          date: f.date || today,
          client: f.client?.trim() || '',
          salId: f.salId || null,
          chaufId: f.salId || null,    // dual-write PC
          salNom: sal ? ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '')).trim() : '',
          chaufNom: sal ? ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '')).trim() : '',
          numLiv: f.numLiv?.trim() || '',
          gravite: f.gravite || 'moyen',
          statut: f.statut || 'ouvert',
          description: f.description.trim()
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === inc.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('incidents', arr);
          M.toast('✅ Incident modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('incidents', arr);
          M.toast('✅ Incident enregistré');
        }
        M.go('incidents');
        return true;
      }
    });
  };
  M.editerIncident = function(id) {
    const inc = M.charger('incidents').find(x => x.id === id);
    if (!inc) return M.toast('Incident introuvable');
    M.formNouvelIncident(inc);
  };

  // ---- ENTRETIEN ----
  M.formNouvelEntretien = function(existing) {
    const enEdition = !!existing;
    const e = existing || {};
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const today = new Date().toISOString().slice(0, 10);
    const body = `
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.id })), { placeholder: 'Choisir véhicule', value: e.vehiculeId || '', required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: e.date || today, required: true }), { required: true })}
        ${M.formField('Type', M.formSelect('type', [
          { value: 'revision',     label: 'Révision' },
          { value: 'vidange',      label: 'Vidange' },
          { value: 'pneus',        label: 'Pneus' },
          { value: 'plaquettes',   label: 'Plaquettes' },
          { value: 'courroie',     label: 'Courroie' },
          { value: 'freins',       label: 'Freins' },
          { value: 'carrosserie',  label: 'Carrosserie' },
          { value: 'autre',        label: 'Autre' }
        ], { value: e.type || 'revision' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Km actuel', M.formInputWithSuffix('km', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: e.km || '' }))}
        ${M.formField('Prochain km', M.formInputWithSuffix('prochainKm', 'km', { type: 'number', step: '500', min: '0', placeholder: 'Rappel', value: e.prochainKm || '' }), { hint: 'Pour rappel automatique' })}
      </div>
      <div class="m-form-row">
        ${M.formField('Coût HT', M.formInputWithSuffix('coutHt', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: e.coutHt || '' }))}
        ${M.formField('Taux TVA', M.formSelect('tauxTva', [
          { value: '0',    label: '0%' },
          { value: '5.5',  label: '5,5%' },
          { value: '10',   label: '10%' },
          { value: '20',   label: '20%' }
        ], { value: String(e.tauxTva ?? 20) }))}
      </div>
      <div class="m-form-row">
        ${M.formField('TVA', M.formInputWithSuffix('tva', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: e.tva || '' }), { hint: 'Calcul auto' })}
        ${M.formField('Coût TTC', M.formInputWithSuffix('cout', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: e.cout || e.coutTtc || '', required: true }), { required: true })}
      </div>
      ${M.formField('Description', M.formTextarea('description', { value: e.description || '', rows: 2, placeholder: 'Détails (pièces, garage, observations...)' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cet entretien</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier entretien' : '🔧 Nouvel entretien',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        // Auto-calcul HT <-> TTC
        const ht  = b.querySelector('input[name=coutHt]');
        const sel = b.querySelector('select[name=tauxTva]');
        const tva = b.querySelector('input[name=tva]');
        const ttc = b.querySelector('input[name=cout]');
        let dernierEdit = 'ttc';
        const recalc = () => {
          const taux = M.parseNum(sel.value) / 100 || 0;
          if (dernierEdit === 'ht' && ht.value) {
            const hh = M.parseNum(ht.value);
            const tv = hh * taux;
            tva.value = tv.toFixed(2);
            ttc.value = (hh + tv).toFixed(2);
          } else if (ttc.value) {
            const tt = M.parseNum(ttc.value);
            const hh = taux > 0 ? tt / (1 + taux) : tt;
            ht.value = hh.toFixed(2);
            tva.value = (tt - hh).toFixed(2);
          }
        };
        ht.addEventListener('input', () => { dernierEdit = 'ht'; recalc(); });
        ttc.addEventListener('input', () => { dernierEdit = 'ttc'; recalc(); });
        sel.addEventListener('change', recalc);
        // Auto-fill km : quand un véhicule est sélectionné, propose le dernier
        // compteur connu (max entre vehicule.km, dernier plein, dernier entretien,
        // dernière saisie heures). Logique partagée pour toutes les saisies km.
        const vehSel = b.querySelector('select[name=vehiculeId]');
        const kmInput = b.querySelector('input[name=km]');
        if (vehSel && kmInput) {
          const autofillKm = () => {
            if (kmInput.value) return; // ne pas écraser une saisie manuelle
            const id = vehSel.value;
            if (!id) return;
            const kmDispo = M.dernierKmConnu(id);
            if (kmDispo > 0) kmInput.value = kmDispo;
          };
          vehSel.addEventListener('change', autofillKm);
          // Au mount : si véhicule déjà sélectionné (mode édition), pré-remplit
          if (!enEdition) setTimeout(autofillKm, 100);
        }
        if (enEdition) {
          b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            const aLien = !!e.chargeId;
            const msg = aLien
              ? 'Supprimer cet entretien ?\n\nLa charge liée dans Charges sera aussi supprimée.'
              : 'Supprimer définitivement cet entretien ?';
            if (!await M.confirm(msg, { titre: 'Supprimer entretien' })) return;
            M.sauvegarder('entretiens', M.charger('entretiens').filter(x => x.id !== e.id));
            // Cascade charge liée (par entretienId OU chargeId)
            M.sauvegarder('charges', M.charger('charges').filter(c =>
              c.entretienId !== e.id && (!e.chargeId || c.id !== e.chargeId)
            ));
            M.ajouterAudit?.('Suppression entretien', (e.type || '') + (aLien ? ' + cascade charge' : ''));
            M.toast('🗑️ Entretien supprimé');
            M.closeSheet();
            M.go('entretiens');
          });
        }
      },
      onSubmit() {
        const f = M.lireFormSheet();
        const ttc = M.parseNum(f.cout) || 0;
        const taux = M.parseNum(f.tauxTva) || 0;
        const ht = M.parseNum(f.coutHt) || (taux > 0 ? ttc / (1 + taux/100) : ttc);
        const tvaMontant = M.parseNum(f.tva) || (ttc - ht);
        if (!f.vehiculeId) { M.toast('⚠️ Véhicule requis'); return false; }
        if (!f.date) { M.toast('⚠️ Date requise'); return false; }
        if (!(ttc > 0)) { M.toast('⚠️ Coût TTC > 0 requis'); return false; }
        const arr = M.charger('entretiens');
        const data = {
          date: f.date || today,
          vehiculeId: f.vehiculeId,
          vehId: f.vehiculeId,        // dual-write PC
          type: f.type || 'autre',
          description: f.description?.trim() || '',
          km: M.parseNum(f.km) || 0,
          prochainKm: M.parseNum(f.prochainKm) || 0,
          coutHt: +ht.toFixed(2),
          coutHT: +ht.toFixed(2),     // dual casse
          tauxTva: taux,
          tauxTVA: taux,              // dual casse PC
          tva: +tvaMontant.toFixed(2),
          coutTtc: ttc,
          cout: ttc                   // compat desktop : .cout = TTC
        };
        let entId;
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === e.id);
          if (idx >= 0) {
            arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
            entId = arr[idx].id;
          }
          M.sauvegarder('entretiens', arr);
          M.toast('✅ Entretien modifié');
        } else {
          entId = M.genId();
          arr.push({ id: entId, creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('entretiens', arr);
          M.toast('✅ Entretien enregistré');
        }
        // Sync inverse : crée/maj la charge correspondante en arrière-plan
        try {
          const ent = M.charger('entretiens').find(x => x.id === entId);
          if (ent) M.synchroEntretienVersCharge(ent);
        } catch (err) { console.warn('[mobile] sync entretien->charge', err); }
        M.go('entretiens');
        return true;
      }
    });
  };
  M.editerEntretien = function(id) {
    const e = M.charger('entretiens').find(x => x.id === id);
    if (!e) return M.toast('Entretien introuvable');
    M.formNouvelEntretien(e);
  };

  // ---- HEURES + KM ----
  M.formNouveauHeures = function(existing) {
    const enEdition = !!existing;
    const h = existing || {};
    const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const today = new Date().toISOString().slice(0, 10);
    const body = `
      ${M.formField('Salarié', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { placeholder: 'Choisir', value: h.salId || h.salarieId || '', required: true }), { required: true })}
      ${M.formField('Date', M.formInput('date', { type: 'date', value: h.date || today, required: true }), { required: true })}
      ${M.formField('Véhicule (optionnel)', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.id })), { placeholder: 'Aucun', value: h.vehiculeId || '' }))}
      <div class="m-form-row">
        ${M.formField('Heures travaillées', M.formInputWithSuffix('heures', 'h', { type: 'number', step: '0.25', min: '0', placeholder: '8', value: h.heures || '' }))}
        ${M.formField('Km parcourus', M.formInputWithSuffix('km', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: h.km || '' }))}
      </div>
      ${M.formField('Notes', M.formTextarea('notes', { value: h.notes || '', rows: 2, placeholder: 'Détails (heures sup, dépassement...)' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cette saisie</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier saisie' : '⏱️ Saisie heures / km',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm('Supprimer définitivement cette saisie ?', { titre: 'Supprimer saisie' })) return;
          M.sauvegarder('heures', M.charger('heures').filter(x => x.id !== h.id));
          M.toast('🗑️ Saisie supprimée');
          M.closeSheet();
          M.go('heures');
        });
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.salId) { M.toast('⚠️ Salarié requis'); return false; }
        if (!f.date) { M.toast('⚠️ Date requise'); return false; }
        const heures = M.parseNum(f.heures) || 0;
        const km = M.parseNum(f.km) || 0;
        if (!(heures > 0) && !(km > 0)) { M.toast('⚠️ Au moins heures ou km > 0'); return false; }
        const arr = M.charger('heures');
        const data = {
          salId: f.salId,
          salarieId: f.salId,           // compat desktop
          chaufId: f.salId,             // compat PC (livraisons)
          date: f.date,
          vehiculeId: f.vehiculeId || null,
          vehId: f.vehiculeId || null,  // dual-write PC
          heures,
          km,
          notes: f.notes?.trim() || ''
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === h.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('heures', arr);
          M.toast('✅ Saisie modifiée');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('heures', arr);
          M.toast('✅ Saisie enregistrée');
        }
        M.go('heures');
        return true;
      }
    });
  };
  M.editerHeures = function(id) {
    const h = M.charger('heures').find(x => x.id === id);
    if (!h) return M.toast('Saisie introuvable');
    M.formNouveauHeures(h);
  };

  // ---- PLANNING (saisie horaires d'un salarie pour le jour selectionne) ----
  M.formPlanningJour = function(salId) {
    const salaries = M.charger('salaries');
    const sal = salaries.find(s => s.id === salId);
    if (!sal) return M.toast('Salarié introuvable');
    const plannings = M.charger('plannings');
    const planning = plannings.find(p => p.salId === salId) || { salId, semaine: [] };
    const jourIdx = M.state.planningJour;
    const jourCle = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'][jourIdx];
    const jourLabel = jourCle.charAt(0).toUpperCase() + jourCle.slice(1);
    const data = (planning.semaine || []).find(j => j.jour === jourCle) || {};
    const typeJour = data.typeJour || (data.travaille ? 'travail' : 'repos');
    const fullName = ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || sal.id)).trim();

    const body = `
      <div style="background:var(--m-accent-soft);padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:.88rem">
        <strong>${jourLabel}</strong> · ${M.escHtml(fullName)}
      </div>
      ${M.formField('Type de jour', M.formSelect('typeJour', [
        { value: 'travail', label: '✅ Travail' },
        { value: 'repos',   label: 'Repos' },
        { value: 'conge',   label: 'Congé' },
        { value: 'absence', label: '⚠️ Absence' },
        { value: 'maladie', label: 'Maladie' }
      ], { value: typeJour }))}
      <div class="m-form-row" id="m-plan-horaires" style="display:${typeJour === 'travail' ? 'grid' : 'none'}">
        ${M.formField('Début', M.formInput('heureDebut', { type: 'time', value: data.heureDebut || '08:00' }))}
        ${M.formField('Fin', M.formInput('heureFin', { type: 'time', value: data.heureFin || '18:00' }))}
      </div>
      <div id="m-plan-extras" style="display:${typeJour === 'travail' ? 'block' : 'none'}">
        ${M.formField('Zone / tournée', M.formInput('zone', { value: data.zone || '', placeholder: 'Île-de-France, Normandie...' }))}
        ${M.formField('Note', M.formInput('note', { value: data.note || '', placeholder: 'Info utile (RDV, pause...)' }))}
      </div>
    `;
    M.openSheet({
      title: '📅 Planning ' + jourLabel,
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        const select = b.querySelector('select[name=typeJour]');
        const horaires = b.querySelector('#m-plan-horaires');
        const extras = b.querySelector('#m-plan-extras');
        select.addEventListener('change', () => {
          const isTrav = select.value === 'travail';
          horaires.style.display = isTrav ? 'grid' : 'none';
          extras.style.display = isTrav ? 'block' : 'none';
        });
      },
      onSubmit() {
        const f = M.lireFormSheet();
        const arr = M.charger('plannings');
        let p = arr.find(x => x.salId === salId);
        if (!p) { p = { salId, semaine: [] }; arr.push(p); }
        p.semaine = p.semaine || [];
        let jourEntry = p.semaine.find(j => j.jour === jourCle);
        if (!jourEntry) { jourEntry = { jour: jourCle }; p.semaine.push(jourEntry); }
        jourEntry.typeJour = f.typeJour;
        jourEntry.travaille = f.typeJour === 'travail';
        jourEntry.heureDebut = f.heureDebut || '';
        jourEntry.heureFin = f.heureFin || '';
        jourEntry.zone = f.zone?.trim() || '';
        jourEntry.note = f.note?.trim() || '';
        M.sauvegarder('plannings', arr);
        M.toast('✅ Planning mis à jour');
        M.go('planning');
        return true;
      }
    });
  };

  // ============================================================
  // Drawer (Plus)
  // ============================================================
  M.openDrawer = function() {
    $('#m-drawer-overlay').hidden = false;
    requestAnimationFrame(() => {
      $('#m-drawer-overlay').classList.add('open');
      $('#m-drawer').classList.add('open');
      $('#m-drawer').setAttribute('aria-hidden', 'false');
    });
  };
  M.closeDrawer = function() {
    $('#m-drawer-overlay').classList.remove('open');
    $('#m-drawer').classList.remove('open');
    $('#m-drawer').setAttribute('aria-hidden', 'true');
    setTimeout(() => { $('#m-drawer-overlay').hidden = true; }, 350);
  };

  // ============================================================
  // Router : registre des pages + navigation
  // ============================================================
  M.routes = {};

  M.register = function(name, opts) {
    // opts = { title, render, kebab? }
    M.routes[name] = opts;
  };

  M.go = function(page, opts = {}) {
    if (page === 'more') { M.openDrawer(); return; }
    const route = M.routes[page];
    if (!route) {
      M.toast('Page inconnue : ' + page);
      return;
    }
    M.state.currentPage = page;
    // Mode detail : back btn visible uniquement quand on est dans une fiche detail.
    const inDetail = M.state.detail && M.state.detail[page];
    $('#m-title').textContent = route.title || '—';
    $('#m-back-btn').hidden = !inDetail;
    // Update bottom nav active state
    $$('.m-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.page === page));
    // Render
    const container = $('#m-content');
    container.innerHTML = '<div class="m-loading"><div class="m-spinner"></div></div>';
    // Async rendering pour fluidite (yields au browser pour painter le spinner)
    setTimeout(() => {
      try {
        const html = route.render(opts);
        container.innerHTML = html || '';
        // Scroll top a chaque navigation
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Hook post-render pour bind events sur le contenu fraichement injecte
        if (typeof route.afterRender === 'function') route.afterRender(container, opts);
      } catch (e) {
        console.error('[mobile router] render error', e);
        container.innerHTML = `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Erreur d'affichage</h3><p class="m-empty-text">${M.escHtml(e.message)}</p></div>`;
      }
    }, 16);
    // Close drawer after navigation
    M.closeDrawer();
    // Update alertes badge
    M.updateAlertesBadge();
  };

  // ============================================================
  // Badge alertes (sync avec compteur sidebar desktop)
  // ============================================================
  M.compterAlertesNonLues = function() {
    const arr = M.charger('alertes_admin');
    const now = new Date();
    return arr.filter(a => {
      if (a.lu || a.traitee || a.ignoree) return false;
      if (a.meta?.repousseJusquA && new Date(a.meta.repousseJusquA) > now) return false;
      return true;
    }).length;
  };
  M.updateAlertesBadge = function() {
    const n = M.compterAlertesNonLues();
    const badge = $('#m-tab-badge-alertes');
    if (!badge) return;
    if (n > 0) {
      badge.textContent = n;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  };

  // ============================================================
  // PAGES
  // ============================================================

  // ---------- Dashboard (pilote v1, totalement fonctionnel) ----------
  M.register('dashboard', {
    title: 'Accueil',
    render() {
      const livraisons = M.charger('livraisons');
      const charges    = M.charger('charges');
      const alertes    = M.charger('alertes_admin');
      const salaries   = M.charger('salaries');
      const carburant  = M.charger('carburant');
      const entretiens = M.charger('entretiens');
      const plannings  = M.charger('plannings');

      // Mois courant
      const now = new Date();
      const moisCle = M.moisKey(now); // YYYY-MM (local TZ)

      const livraisonsMois = livraisons.filter(l => (l.date || '').startsWith(moisCle));
      const caMoisHt = livraisonsMois.reduce((acc, l) => acc + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || M.parseNum(l.prix_ht) || 0), 0);
      const caMoisTtc = livraisonsMois.reduce((acc, l) => acc + (M.parseNum(l.prixTTC) || M.parseNum(l.prix_ttc) || (M.parseNum(l.prix) || 0) * 1.2), 0);

      // Depenses du mois pour le benefice estime (HT, hors carburant qui est TTC)
      const carbMois = carburant.filter(p => (p.date || '').startsWith(moisCle)).reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
      const entrMois = entretiens.filter(e => (e.date || '').startsWith(moisCle)).reduce((s, e) => s + (M.parseNum(e.coutHt) || M.parseNum(e.cout) || 0), 0);
      const chargesMois = charges.filter(c => (c.date || '').startsWith(moisCle) && c.categorie !== 'entretien')
        .reduce((s, c) => s + (M.parseNum(c.montantHT) || M.parseNum(c.montant) || 0), 0);
      const depMois = carbMois + entrMois + chargesMois;
      const beneficeEstime = caMoisHt - depMois;
      const benefColor = beneficeEstime >= 0 ? 'var(--m-green)' : 'var(--m-red)';

      const chargesAPayer = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      const totalImpayes  = chargesAPayer.reduce((acc, c) => acc + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);

      const alertesActives = alertes.filter(a => !a.traitee && !a.ignoree && !(a.meta?.repousseJusquA && new Date(a.meta.repousseJusquA) > now));
      const alertesCritiques = alertesActives.filter(a => ['ct_expire','permis_expire','assurance_expire','charge_retard_paiement','carburant_anomalie'].includes(a.type)).length;

      const salariesActifs = salaries.filter(s => s.actif !== false && s.statut !== 'inactif' && !s.archive).length;

      // Qui travaille aujourd'hui ?
      const jourIdx = (now.getDay() + 6) % 7; // 0 = lundi
      const jourCle = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'][jourIdx];
      const auTravail = salaries.filter(s => s && !s.archive && s.statut !== 'inactif').map(sal => {
        const planning = plannings.find(p => p.salId === sal.id);
        const jourData = planning?.semaine?.find(j => j.jour === jourCle);
        const typeJour = jourData?.typeJour || (jourData?.travaille ? 'travail' : 'repos');
        return { sal, jourData, typeJour };
      }).filter(x => x.typeJour === 'travail');

      return `
        <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em">Bonjour ${M.escHtml(sessionStorage.getItem('admin_nom') || 'Admin')}</h2>
        <p style="color:var(--m-text-muted);font-size:.88rem;margin:0 0 18px">${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

        <div class="m-card-row">
          <div class="m-card m-card-green">
            <div class="m-card-title">CA ce mois HT</div>
            <div class="m-card-value">${M.format$(caMoisHt)}</div>
            <div class="m-card-sub">TTC ${M.format$(caMoisTtc)}</div>
          </div>
          <div class="m-card m-card-pressable" style="border-left:4px solid ${benefColor}" onclick="MCAm.go('rentabilite')">
            <div class="m-card-title">Bénéfice estimé</div>
            <div class="m-card-value" style="color:${benefColor}">${M.format$(beneficeEstime)}</div>
            <div class="m-card-sub">CA HT − dépenses</div>
          </div>
        </div>

        <div class="m-card-row">
          <div class="m-card m-card-blue m-card-pressable" onclick="MCAm.go('livraisons')">
            <div class="m-card-title">Livraisons</div>
            <div class="m-card-value">${M.formatNum(livraisonsMois.length)}</div>
            <div class="m-card-sub">ce mois</div>
          </div>
          <div class="m-card m-card-purple m-card-pressable" onclick="MCAm.go('planning')">
            <div class="m-card-title">Au travail</div>
            <div class="m-card-value">${auTravail.length}</div>
            <div class="m-card-sub">aujourd'hui</div>
          </div>
        </div>

        <div class="m-card-row">
          <div class="m-card m-card-red m-card-pressable" onclick="MCAm.go('alertes')">
            <div class="m-card-title">Alertes</div>
            <div class="m-card-value">${M.formatNum(alertesActives.length)}</div>
            <div class="m-card-sub">${alertesCritiques > 0 ? `🔴 ${alertesCritiques} critique${alertesCritiques>1?'s':''}` : 'à traiter'}</div>
          </div>
          <div class="m-card m-card-accent m-card-pressable" onclick="MCAm.go('charges')">
            <div class="m-card-title">Impayés</div>
            <div class="m-card-value">${M.format$(totalImpayes)}</div>
            <div class="m-card-sub">${M.formatNum(chargesAPayer.length)} charge${chargesAPayer.length>1?'s':''}</div>
          </div>
        </div>

        ${auTravail.length ? `
          <div class="m-section">
            <div class="m-section-header">
              <h3 class="m-section-title">📅 Qui travaille aujourd'hui</h3>
              <button class="m-section-link" onclick="MCAm.go('planning')">Planning →</button>
            </div>
            ${auTravail.slice(0, 5).map(({ sal, jourData }) => {
              const initiales = ((sal.nom || '').charAt(0) + (sal.prenom || '').charAt(0)).toUpperCase() || '?';
              const horaires = jourData?.heureDebut && jourData?.heureFin ? `${jourData.heureDebut}–${jourData.heureFin}` : 'Présent';
              return `<button type="button" class="m-card m-card-pressable" onclick="MCAm.openDetail('salaries','${M.escHtml(sal.id)}')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-left:4px solid var(--m-green);border-radius:14px;margin-bottom:8px;color:inherit;font-family:inherit">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;flex-shrink:0">${M.escHtml(initiales)}</div>
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || ''))}</div>
                  <div style="color:var(--m-text-muted);font-size:.76rem;margin-top:1px">${horaires}${jourData?.zone ? ' · ' + M.escHtml(jourData.zone) : ''}</div>
                </div>
              </button>`;
            }).join('')}
            ${auTravail.length > 5 ? `<p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin:6px 0 0">… et ${auTravail.length - 5} autre${auTravail.length-5>1?'s':''}</p>` : ''}
          </div>
        ` : ''}

        <div class="m-card m-card-purple m-card-pressable" onclick="MCAm.go('salaries')">
          <div class="m-card-title">Équipe active</div>
          <div class="m-card-value">${M.formatNum(salariesActifs)}</div>
          <div class="m-card-sub">salarié${salariesActifs>1?'s':''} actif${salariesActifs>1?'s':''}</div>
        </div>

        <div class="m-section">
          <div class="m-section-header">
            <h3 class="m-section-title">Dernières livraisons</h3>
            <button class="m-section-link" onclick="MCAm.go('livraisons')">Voir tout →</button>
          </div>
          ${(() => {
            const dernieres = [...livraisons].sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0, 5);
            if (!dernieres.length) {
              return `<div class="m-empty"><div class="m-empty-icon">📦</div><h3 class="m-empty-title">Aucune livraison</h3><p class="m-empty-text">Les livraisons saisies apparaitront ici.</p></div>`;
            }
            return dernieres.map(l => `
              <button type="button" class="m-card m-card-pressable" onclick="MCAm.editerLivraison('${M.escHtml(l.id)}')" style="display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;padding:16px;margin-bottom:12px;color:inherit;font-family:inherit">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(l.client || l.client_nom || '—')}</div>
                  <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.formatDate(l.date)} · ${M.escHtml(l.numLiv || l.num_livraison || '—')}</div>
                </div>
                <div style="font-weight:700;color:var(--m-green);white-space:nowrap">${M.format$(l.prixHT || l.prix_ht || l.prix || 0)}</div>
              </button>
            `).join('');
          })()}
        </div>
      `;
    }
  });

  // ---------- Stub generique (pages pas encore developpees en mobile) ----------
  function makeStub(label, icone, descShort) {
    return {
      title: label,
      render() {
        return `
          <div class="m-stub">
            <div class="m-stub-icon">${icone}</div>
            <h2 class="m-stub-title">${M.escHtml(label)} arrive bientot</h2>
            <p class="m-stub-text">${M.escHtml(descShort)}</p>
            <p class="m-stub-text" style="margin-top:8px;font-size:.82rem;opacity:.7">En cours de developpement pour mobile. Tu seras notifie des que c'est pret.</p>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:28px;max-width:280px;margin-left:auto;margin-right:auto">
              <button class="m-btn" onclick="MCAm.go('dashboard')">← Retour Accueil</button>
            </div>
          </div>
        `;
      }
    };
  }

  // ---------- Livraisons (v2.1 : liste lecture seule, groupee par mois) ----------
  M.state.livraisonsRecherche = '';
  M.state.livraisonsMoisOuverts = {}; // mois -> bool (open/closed)
  M.state.livraisonsVue = 'liste'; // 'liste' | 'kanban'
  M.state.livBulkMode = false;
  M.state.livBulkSel = new Set(); // ids selectionnees

  M.register('livraisons', {
    title: 'Livraisons',
    render() {
      const livraisons = M.charger('livraisons');
      const recherche = (M.state.livraisonsRecherche || '').toLowerCase();
      let filtered = livraisons;
      if (recherche) {
        filtered = livraisons.filter(l => {
          const hay = `${l.client||''} ${l.numLiv||''} ${l.date||''} ${l.adresseDepart||''} ${l.adresseArrivee||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      // tri date desc
      filtered = [...filtered].sort((a,b) => (b.date||'').localeCompare(a.date||''));

      // Group par mois (YYYY-MM)
      const byMonth = {};
      filtered.forEach(l => {
        const m = (l.date || '0000-00').slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(l);
      });
      const monthsSorted = Object.keys(byMonth).sort().reverse();
      const moisCourant = M.moisKey();

      const bulkOn = M.state.livBulkMode;
      const selSet = M.state.livBulkSel;
      const selCount = filtered.filter(l => selSet.has(l.id)).length;
      const selTotal = filtered.filter(l => selSet.has(l.id)).reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);

      // FAB : sélection multiple si pas en mode bulk, sinon caché
      let html = bulkOn ? '' : `<button class="m-fab" onclick="MCAm.formNouvelleLivraison()" aria-label="Nouvelle livraison">+</button>
        <button class="m-fab m-fab-secondary" id="m-liv-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>`;

      const vue = M.state.livraisonsVue;

      // Bandeau bulk en haut si actif
      if (bulkOn) {
        html += `<div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:10px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,.15)">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:${selCount > 0 ? '10px' : '0'}">
            <div style="flex:1 1 auto;font-size:.92rem"><strong>${selCount}</strong> sélectionnée${selCount>1?'s':''}${selCount > 0 ? ` · ${M.format$(selTotal)}` : ''}</div>
            <button type="button" id="m-liv-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:36px;font-size:.78rem">✕</button>
          </div>
          ${selCount > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px">
            <button type="button" class="m-liv-bulk-action m-btn" data-action="livre" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem;background:rgba(46,204,113,0.12);color:var(--m-green);border:1px solid rgba(46,204,113,0.3)">✅ Marquer livré</button>
            <button type="button" class="m-liv-bulk-action m-btn" data-action="paye" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem;background:rgba(46,204,113,0.12);color:var(--m-green);border:1px solid rgba(46,204,113,0.3)">💵 Encaisser</button>
            <button type="button" class="m-liv-bulk-action m-btn m-btn-danger" data-action="delete" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem">🗑️ Supprimer</button>
          </div>` : ''}
        </div>`;
      }

      // Toggle vue Liste / Kanban (alignement PC)
      html += `
        <div style="display:flex;gap:6px;margin-bottom:14px">
          <button class="m-alertes-chip ${vue==='liste'?'active':''}" data-vue="liste" style="flex:1 1 0">📋 Liste</button>
          <button class="m-alertes-chip ${vue==='kanban'?'active':''}" data-vue="kanban" style="flex:1 1 0">📊 Kanban</button>
        </div>
        <div style="margin-bottom:16px">
          <input type="search" id="m-liv-search" placeholder="🔍 Rechercher (client, n°, adresse...)" value="${M.escHtml(M.state.livraisonsRecherche)}" autocomplete="off" />
        </div>
      `;

      // Vue Kanban : 3 colonnes scrollables horizontalement par statut
      if (vue === 'kanban') {
        const cols = [
          { key: 'en-attente', label: '⏳ En attente', color: 'var(--m-text-muted)' },
          { key: 'en-cours',   label: '🟡 En cours',   color: 'var(--m-accent)' },
          { key: 'livre',      label: '✅ Livré',      color: 'var(--m-green)' }
        ];
        // Limite a livraisons des 3 derniers mois pour perf (sinon Kanban infini)
        const cutoffMois = new Date(); cutoffMois.setMonth(cutoffMois.getMonth() - 3);
        const cutoffStr = cutoffMois.toISOString().slice(0, 10);
        const livKanban = filtered.filter(l => (l.date || '') >= cutoffStr);
        if (!livKanban.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">📊</div><h3 class="m-empty-title">Aucune livraison récente</h3><p class="m-empty-text">Le Kanban affiche les 3 derniers mois.</p></div>`;
          return html;
        }
        html += `<div style="display:flex;gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:14px;margin:0 -16px;padding-left:16px;padding-right:16px">`;
        cols.forEach(col => {
          const items = livKanban.filter(l => (l.statut || 'en-attente') === col.key)
            .sort((a,b) => (b.date||'').localeCompare(a.date||''));
          const total = items.reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
          html += `<div style="flex:0 0 280px;background:var(--m-bg-elevated);border:1px solid var(--m-border);border-top:3px solid ${col.color};border-radius:12px;padding:12px;max-height:600px;overflow-y:auto">
            <div style="font-weight:700;font-size:.92rem;margin-bottom:4px">${col.label} (${items.length})</div>
            <div style="font-size:.78rem;color:var(--m-text-muted);margin-bottom:10px">${M.format$(total)}</div>
            ${items.length ? items.map(l => `
              <button type="button" class="m-card m-card-pressable m-liv-edit" data-id="${M.escHtml(l.id)}" style="display:block;width:100%;text-align:left;padding:10px;background:var(--m-card);border:1px solid var(--m-border);border-radius:10px;margin-bottom:8px;color:inherit;font-family:inherit">
                <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(l.client || '—')}</div>
                <div style="color:var(--m-text-muted);font-size:.72rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.formatDate(l.date)}${l.numLiv?' · '+M.escHtml(l.numLiv):''}</div>
                <div style="margin-top:4px;font-weight:700;color:var(--m-green);font-size:.85rem">${M.format$(l.prix || l.prixHT || 0)}</div>
              </button>
            `).join('') : `<div style="color:var(--m-text-muted);font-size:.78rem;text-align:center;padding:20px 0">Aucune</div>`}
          </div>`;
        });
        html += `</div>`;
        html += `<p style="font-size:.75rem;color:var(--m-text-muted);text-align:center;margin-top:8px">💡 Glisse latéralement entre les colonnes. Tap = édition.</p>`;
        return html;
      }

      if (!livraisons.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">📦</div><h3 class="m-empty-title">Aucune livraison</h3><p class="m-empty-text">Tape sur le bouton ➕ pour ajouter ta première livraison.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun résultat</h3><p class="m-empty-text">Essaie un autre mot-clé.</p></div>`;
        return html;
      }

      monthsSorted.forEach(month => {
        const items = byMonth[month];
        const totalCa = items.reduce((acc, l) => acc + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
        const dateLabel = (() => {
          if (month === '0000-00') return 'Sans date';
          const [y, m] = month.split('-');
          const d = new Date(parseInt(y), parseInt(m) - 1, 1);
          return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        })();
        // Mois courant ouvert par defaut, autres fermes
        const isOpen = M.state.livraisonsMoisOuverts[month] !== undefined ? M.state.livraisonsMoisOuverts[month] : (month === moisCourant);

        html += `
          <div class="m-section" style="margin-top:18px">
            <button type="button" class="m-section-header" data-mois="${M.escHtml(month)}" style="width:100%;background:transparent;border:none;color:inherit;text-align:left;cursor:pointer;padding:0 4px 10px">
              <span style="display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0">
                <span style="color:var(--m-text-muted);font-size:.9rem;transition:transform 0.15s ease;display:inline-block;transform:rotate(${isOpen ? '90' : '0'}deg)">▶</span>
                <h3 class="m-section-title" style="font-size:1rem">${dateLabel}</h3>
              </span>
              <span style="text-align:right;font-size:.78rem;color:var(--m-text-muted);font-weight:500">
                <div>${items.length} liv.</div>
                <div style="color:var(--m-green);font-weight:600;margin-top:2px">${M.format$(totalCa)}</div>
              </span>
            </button>
            <div data-content="${M.escHtml(month)}" style="display:${isOpen ? 'block' : 'none'}">
              ${items.map(l => {
                const isSel = selSet.has(l.id);
                const cardClass = bulkOn ? 'm-liv-toggle' : 'm-liv-edit';
                const cardStyle = bulkOn && isSel
                  ? 'background:var(--m-accent-soft);border:1px solid var(--m-accent)'
                  : 'background:var(--m-card);border:1px solid var(--m-border)';
                const checkbox = bulkOn
                  ? `<div style="flex:0 0 28px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>`
                  : '';
                return `<div role="button" tabindex="0" class="m-card m-card-pressable ${cardClass}" data-id="${M.escHtml(l.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;width:100%;text-align:left;${cardStyle};border-radius:18px;margin-bottom:10px;color:inherit;cursor:pointer">
                  ${checkbox}
                  <div style="flex:1 1 auto;min-width:0">
                    <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(l.client || '—')}</div>
                    <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap">
                      <span>${M.formatDate(l.date)}</span>
                      ${l.numLiv ? `<span>· ${M.escHtml(l.numLiv)}</span>` : ''}
                      ${l.distance ? `<span>· ${M.formatNum(l.distance)} km</span>` : ''}
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:700;color:var(--m-green);white-space:nowrap;font-size:.95rem">${M.format$(l.prix || l.prixHT || 0)}</div>
                    ${l.statut ? `<div style="font-size:.7rem;color:var(--m-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.04em">${M.escHtml(l.statut)}</div>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
        `;
      });

      return html;
    },
    afterRender(container) {
      // Toggle vue Liste / Kanban
      container.querySelectorAll('.m-alertes-chip[data-vue]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.livraisonsVue = btn.dataset.vue; M.go('livraisons'); });
      });
      // Wire recherche (debounce 200ms pour fluidite)
      const searchInput = container.querySelector('#m-liv-search');
      if (searchInput) {
        let timer = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            M.state.livraisonsRecherche = e.target.value;
            M.go('livraisons');
          }, 350);
        });
        // Garde focus au re-render
        if (M.state.livraisonsRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      // Wire collapse/expand mois
      container.querySelectorAll('button[data-mois]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mois = btn.dataset.mois;
          const content = container.querySelector(`[data-content="${mois}"]`);
          const chevron = btn.querySelector('span > span');
          if (!content) return;
          const willOpen = content.style.display === 'none';
          M.state.livraisonsMoisOuverts[mois] = willOpen;
          content.style.display = willOpen ? 'block' : 'none';
          if (chevron) chevron.style.transform = `rotate(${willOpen ? '90' : '0'}deg)`;
        });
      });
      // Tap card livraison -> ouvre le form en mode edition (mode normal)
      container.querySelectorAll('.m-liv-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerLivraison(btn.dataset.id));
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.editerLivraison(btn.dataset.id); }
        });
      });
      // Tap card en mode bulk -> toggle selection
      container.querySelectorAll('.m-liv-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.livBulkSel.has(id)) M.state.livBulkSel.delete(id);
          else M.state.livBulkSel.add(id);
          M.go('livraisons');
        });
      });
      // Active mode bulk
      container.querySelector('#m-liv-bulk-on')?.addEventListener('click', () => {
        M.state.livBulkMode = true;
        M.state.livBulkSel.clear();
        M.go('livraisons');
      });
      // Quitte mode bulk
      container.querySelector('#m-liv-bulk-exit')?.addEventListener('click', () => {
        M.state.livBulkMode = false;
        M.state.livBulkSel.clear();
        M.go('livraisons');
      });
      // Bulk actions : marquer livré / encaisser / supprimer
      container.querySelectorAll('.m-liv-bulk-action').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const ids = [...M.state.livBulkSel];
          if (!ids.length) return;
          if (action === 'delete') {
            if (!await M.confirm(`Supprimer définitivement ${ids.length} livraison${ids.length>1?'s':''} ?`, { titre: 'Suppression en lot' })) return;
            const arr = M.charger('livraisons').filter(l => !ids.includes(l.id));
            M.sauvegarder('livraisons', arr);
            M.toast(`🗑️ ${ids.length} livraison${ids.length>1?'s':''} supprimée${ids.length>1?'s':''}`);
          } else if (action === 'livre') {
            const arr = M.charger('livraisons');
            const now = new Date().toISOString();
            let n = 0;
            ids.forEach(id => {
              const idx = arr.findIndex(x => x.id === id);
              if (idx >= 0) { arr[idx].statut = 'livre'; arr[idx].modifieLe = now; n++; }
            });
            M.sauvegarder('livraisons', arr);
            M.toast(`✅ ${n} livraison${n>1?'s':''} marquée${n>1?'s':''} livrée${n>1?'s':''}`);
          } else if (action === 'paye') {
            const res = await M.dialogChoisirDate({
              titre: `💵 Encaisser ${ids.length} livraison${ids.length>1?'s':''}`,
              labelDate: 'Date de paiement',
              btnOk: '💵 Confirmer'
            });
            if (!res) return;
            const arr = M.charger('livraisons');
            const now = new Date().toISOString();
            let n = 0;
            ids.forEach(id => {
              const idx = arr.findIndex(x => x.id === id);
              if (idx >= 0) {
                arr[idx].statutPaiement = 'payé';
                arr[idx].datePaiement = res.date;
                arr[idx].modifieLe = now;
                n++;
              }
            });
            M.sauvegarder('livraisons', arr);
            M.toast(`💵 ${n} encaissement${n>1?'s':''} au ${M.formatDate(res.date)}`);
          }
          M.state.livBulkSel.clear();
          M.state.livBulkMode = false;
          M.go('livraisons');
        });
      });
    }
  });
  // ---------- Planning (v2.3 : qui bosse aujourd'hui + selecteur jour) ----------
  const M_JOURS_FR = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const M_JOURS_COURT = ['L','M','M','J','V','S','D'];
  // Date.getDay() : 0 = dimanche, 1 = lundi, ..., 6 = samedi -> on remap vers 0-6 lundi-dimanche
  const jourIndexAuj = () => {
    const d = new Date().getDay(); return (d + 6) % 7;
  };
  M.state.planningJour = jourIndexAuj();

  M.register('planning', {
    title: 'Planning',
    render() {
      const salaries = M.charger('salaries').filter(s => s && s.statut !== 'inactif' && !s.archive);
      const plannings = M.charger('plannings');
      const vue = M.state.planningVue || 'jour';

      // Header : toggle vue + bouton periodes absences
      let html = `
        <div style="display:flex;gap:6px;margin-bottom:14px">
          <button class="m-alertes-chip ${vue==='jour'?'active':''}" data-vue="jour" style="flex:1 1 0">📅 Jour</button>
          <button class="m-alertes-chip ${vue==='semaine'?'active':''}" data-vue="semaine" style="flex:1 1 0">🗓️ Semaine</button>
          <button id="m-planning-abs-add" class="m-btn" style="flex:0 0 auto;padding:0 14px;height:40px;font-size:.78rem">🏖️ Absence longue</button>
        </div>
      `;

      if (vue === 'semaine') {
        return html + M.renderPlanningSemaine(salaries, plannings);
      }

      // Vue Jour (existante)
      const jourIdx = M.state.planningJour;
      const jourCle = M_JOURS_FR[jourIdx];
      const estAujourd = jourIdx === jourIndexAuj();

      // Pour chaque salarie : son etat du jour selectionne
      const lignes = salaries.map(sal => {
        const planning = plannings.find(p => p.salId === sal.id);
        const jourData = planning && Array.isArray(planning.semaine)
          ? planning.semaine.find(j => j.jour === jourCle) : null;
        const typeJour = jourData?.typeJour || (jourData?.travaille ? 'travail' : 'repos');
        return { sal, typeJour, jourData };
      });

      const auTravail = lignes.filter(l => l.typeJour === 'travail');
      const enConge   = lignes.filter(l => l.typeJour === 'conge');
      const enAbsence = lignes.filter(l => l.typeJour === 'absence' || l.typeJour === 'maladie');
      const enRepos   = lignes.filter(l => l.typeJour === 'repos');

      // Selecteur jour de la semaine
      html += `
        <div style="display:flex;gap:6px;margin-bottom:18px">
          ${M_JOURS_COURT.map((j, i) => `
            <button class="m-planning-jour ${i === jourIdx ? 'active' : ''}" data-jour="${i}" style="flex:1 1 0;min-height:44px;border-radius:10px;font-weight:600;font-size:.85rem;background:${i === jourIdx ? 'var(--m-accent)' : 'var(--m-bg-elevated)'};color:${i === jourIdx ? '#1a1208' : 'var(--m-text)'};border:1px solid ${i === jourIdx ? 'var(--m-accent)' : 'var(--m-border)'};padding:0;${i === jourIndexAuj() && i !== jourIdx ? 'box-shadow:inset 0 0 0 2px var(--m-accent-soft)' : ''}">${j}</button>
          `).join('')}
        </div>
        <p style="text-align:center;color:var(--m-text-muted);font-size:.82rem;margin:-8px 0 18px">${jourCle.charAt(0).toUpperCase() + jourCle.slice(1)}${estAujourd ? ' (aujourd\'hui)' : ''}</p>
      `;

      // KPI : nb au travail / total
      html += `
        <div class="m-card-row">
          <div class="m-card m-card-green">
            <div class="m-card-title">Au travail</div>
            <div class="m-card-value">${auTravail.length}</div>
            <div class="m-card-sub">/ ${salaries.length} salarié${salaries.length>1?'s':''}</div>
          </div>
          <div class="m-card m-card-purple">
            <div class="m-card-title">Hors travail</div>
            <div class="m-card-value">${salaries.length - auTravail.length}</div>
            <div class="m-card-sub">${enConge.length} congé · ${enAbsence.length} abs · ${enRepos.length} repos</div>
          </div>
        </div>
      `;

      // Section "Au travail"
      if (auTravail.length) {
        html += `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">✅ Au travail</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${auTravail.length}</span></div>`;
        auTravail.forEach(({ sal, jourData }) => {
          const horaires = jourData?.heureDebut && jourData?.heureFin
            ? `${jourData.heureDebut} – ${jourData.heureFin}` : '—';
          html += `<button type="button" class="m-card m-card-green m-card-pressable m-planning-sal" data-sal-id="${M.escHtml(sal.id)}" style="padding:12px 14px;width:100%;text-align:left;border-radius:18px;border:1px solid var(--m-border);background:var(--m-card);border-left:4px solid var(--m-green);margin-bottom:10px;color:inherit;font-family:inherit;display:block">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div style="flex:1 1 auto;min-width:0">
                <div style="font-weight:600;font-size:.95rem">${M.escHtml(sal.nom || sal.id)}</div>
                <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${horaires}${jourData?.zone ? ' · ' + M.escHtml(jourData.zone) : ''}</div>
              </div>
              <span style="color:var(--m-text-muted);font-size:1.1rem">›</span>
            </div>
            ${jourData?.note ? `<div style="font-size:.78rem;color:var(--m-text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--m-border);font-style:italic">${M.escHtml(jourData.note)}</div>` : ''}
          </button>`;
        });
        html += `</div>`;
      }

      // Section "Hors travail" (regroupe conge / absence / repos)
      const horsTravail = [...enConge, ...enAbsence, ...enRepos];
      if (horsTravail.length) {
        html += `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">⏸️ Hors travail</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${horsTravail.length}</span></div>`;
        horsTravail.forEach(({ sal, typeJour }) => {
          const labels = { conge: 'Congé', absence: 'Absence', maladie: 'Maladie', repos: 'Repos' };
          const colors = { conge: 'var(--m-blue)', absence: 'var(--m-red)', maladie: 'var(--m-red)', repos: 'var(--m-text-muted)' };
          html += `<button type="button" class="m-card m-card-pressable m-planning-sal" data-sal-id="${M.escHtml(sal.id)}" style="padding:12px 14px;border-left:3px solid ${colors[typeJour] || 'var(--m-border)'};width:100%;text-align:left;border-radius:18px;border-top:1px solid var(--m-border);border-right:1px solid var(--m-border);border-bottom:1px solid var(--m-border);background:var(--m-card);margin-bottom:10px;color:inherit;font-family:inherit;display:block">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <span style="font-weight:600;font-size:.92rem">${M.escHtml(sal.nom || sal.id)}</span>
              <span style="font-size:.78rem;color:${colors[typeJour] || 'var(--m-text-muted)'};font-weight:600">${labels[typeJour] || typeJour}</span>
            </div>
          </button>`;
        });
        html += `</div>`;
      }

      if (!salaries.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">👥</div><h3 class="m-empty-title">Aucun salarié</h3><p class="m-empty-text">Les salariés ajoutés apparaitront ici avec leur planning.</p></div>`;
      }

      return html;
    },
    afterRender(container) {
      container.querySelectorAll('button[data-vue]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.planningVue = btn.dataset.vue; M.go('planning'); });
      });
      container.querySelector('#m-planning-abs-add')?.addEventListener('click', () => M.formAbsenceLongue());
      container.querySelectorAll('.m-planning-jour').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.planningJour = parseInt(btn.dataset.jour);
          M.go('planning');
        });
      });
      // Tap salarie -> ouvre form planning pour CE jour selectionne
      container.querySelectorAll('.m-planning-sal').forEach(btn => {
        btn.addEventListener('click', () => M.formPlanningJour(btn.dataset.salId));
      });
      // Vue semaine : tap cell -> form planning pour ce salarie/jour
      container.querySelectorAll('.m-planning-cell').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.planningJour = parseInt(btn.dataset.jourIdx);
          M.formPlanningJour(btn.dataset.salId);
        });
      });
      // Vue absences : tap card -> editer / supprimer
      container.querySelectorAll('.m-abs-card').forEach(btn => {
        btn.addEventListener('click', () => M.formAbsenceLongue(btn.dataset.absId, btn.dataset.salId));
      });
    }
  });

  // Vue semaine : grille condensee 7 colonnes x N salaries
  M.renderPlanningSemaine = function(salaries, plannings) {
    if (!salaries.length) return `<div class="m-empty"><div class="m-empty-icon">👥</div><h3 class="m-empty-title">Aucun salarié</h3></div>`;
    const labels = { travail: '✅', conge: '🏖️', absence: '⚠️', maladie: '🤒', repos: '😴' };
    const colors = { travail: 'var(--m-green)', conge: 'var(--m-blue)', absence: 'var(--m-red)', maladie: 'var(--m-red)', repos: 'rgba(155,155,155,.3)' };
    const todayIdx = jourIndexAuj();

    let html = `<div class="m-card" style="padding:0;overflow:hidden">
      <div style="display:grid;grid-template-columns:90px repeat(7, 1fr);gap:0;font-size:.7rem">
        <div style="padding:8px 6px;background:var(--m-bg-elevated);font-weight:700;border-bottom:1px solid var(--m-border)"></div>
        ${M_JOURS_COURT.map((j, i) => `<div style="padding:8px 4px;background:var(--m-bg-elevated);font-weight:700;text-align:center;border-bottom:1px solid var(--m-border);${i === todayIdx ? 'color:var(--m-accent)' : ''}">${j}</div>`).join('')}
      </div>`;

    salaries.forEach((sal, sIdx) => {
      const planning = plannings.find(p => p.salId === sal.id);
      const semaine = planning && Array.isArray(planning.semaine) ? planning.semaine : [];
      const isLast = sIdx === salaries.length - 1;
      html += `<div style="display:grid;grid-template-columns:90px repeat(7, 1fr);gap:0;font-size:.72rem">
        <div style="padding:10px 6px;font-weight:600;${!isLast ? 'border-bottom:1px solid var(--m-border);' : ''}white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml((sal.prenom ? sal.prenom.charAt(0) + '. ' : '') + (sal.nom || sal.id).slice(0, 8))}</div>`;
      M_JOURS_FR.forEach((jourCle, jIdx) => {
        const jourData = semaine.find(j => j.jour === jourCle);
        const typeJour = jourData?.typeJour || (jourData?.travaille ? 'travail' : 'repos');
        const lbl = labels[typeJour] || '·';
        const bg = colors[typeJour] || 'transparent';
        const isToday = jIdx === todayIdx;
        const horaireShort = jourData?.heureDebut && jourData?.heureFin ? jourData.heureDebut.slice(0, 5) : '';
        html += `<button type="button" class="m-planning-cell" data-sal-id="${M.escHtml(sal.id)}" data-jour-idx="${jIdx}" style="padding:8px 2px;text-align:center;background:${bg};color:${typeJour === 'travail' || typeJour === 'conge' || typeJour === 'absence' || typeJour === 'maladie' ? '#fff' : 'var(--m-text)'};border:0;${!isLast ? 'border-bottom:1px solid var(--m-border);' : ''}${isToday ? 'box-shadow:inset 0 0 0 2px var(--m-accent)' : ''};font-family:inherit;cursor:pointer;font-size:.78rem;font-weight:600;line-height:1.1">
          <div>${lbl}</div>
          ${horaireShort ? `<div style="font-size:.62rem;opacity:.85;margin-top:1px">${horaireShort}</div>` : ''}
        </button>`;
      });
      html += `</div>`;
    });

    html += `</div>`;

    // Section "Périodes d'absence" (longues durées)
    const absences = [];
    plannings.forEach(p => {
      if (Array.isArray(p.absences)) {
        p.absences.forEach(a => absences.push({ ...a, salId: p.salId }));
      }
    });
    if (absences.length) {
      const today = new Date().toISOString().slice(0, 10);
      const enCours = absences.filter(a => a.dateDebut <= today && (!a.dateFin || a.dateFin >= today));
      const aVenir = absences.filter(a => a.dateDebut > today);
      const passees = absences.filter(a => a.dateFin && a.dateFin < today);

      const renderAbs = (list, titre, icon) => {
        if (!list.length) return '';
        const lblType = { conge: 'Congé', absence: 'Absence', maladie: 'Maladie' };
        return `<div class="m-section" style="margin-top:18px"><div class="m-section-header"><h3 class="m-section-title">${icon} ${titre}</h3><span style="font-size:.82rem;color:var(--m-text-muted)">${list.length}</span></div>
          ${list.map(a => {
            const sal = salaries.find(s => s.id === a.salId);
            const nom = sal ? ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '')).trim() : (a.salId || '?');
            return `<div role="button" tabindex="0" class="m-card m-card-pressable m-abs-card" data-abs-id="${M.escHtml(a.id)}" data-sal-id="${M.escHtml(a.salId)}" style="padding:12px 14px;margin-bottom:8px;border-left:4px solid var(--m-blue);cursor:pointer">
              <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.92rem">${M.escHtml(nom)}</div>
                  <div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${lblType[a.type] || a.type} · ${M.formatDate(a.dateDebut)}${a.dateFin ? ' → ' + M.formatDate(a.dateFin) : ' (sans fin)'}</div>
                  ${a.motif ? `<div style="font-size:.74rem;color:var(--m-text-muted);margin-top:4px;font-style:italic">${M.escHtml(a.motif)}</div>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      };
      html += renderAbs(enCours, 'En cours', '🟢') + renderAbs(aVenir, 'À venir', '⏰') + renderAbs(passees.slice(0, 5), 'Passées (5 dernières)', '📋');
    } else {
      html += `<p style="text-align:center;color:var(--m-text-muted);font-size:.78rem;margin-top:18px">Aucune période d'absence longue. Tape sur "🏖️ Absence longue" en haut pour en créer.</p>`;
    }
    return html;
  };

  // Form période d'absence longue : du DATE au DATE, type, motif. Stockée
  // dans planning.absences[]. Le rendu vue jour/semaine n'écrase PAS les
  // entrées planning.semaine[] mais override l'affichage si la date tombe
  // dans une période active (l'utilisateur peut continuer à éditer le
  // planning hebdo en parallèle).
  M.formAbsenceLongue = function(absId, salIdInit) {
    const salaries = M.charger('salaries').filter(s => s && s.statut !== 'inactif' && !s.archive);
    const plannings = M.charger('plannings');
    const today = new Date().toISOString().slice(0, 10);
    let abs = null, salPlanning = null;
    if (absId) {
      for (const p of plannings) {
        if (Array.isArray(p.absences)) {
          const found = p.absences.find(a => a.id === absId);
          if (found) { abs = found; salPlanning = p; break; }
        }
      }
    }
    const enEdition = !!abs;
    const a = abs || {};
    const salIdDef = a.salId || salIdInit || (salaries[0]?.id || '');

    const body = `
      ${M.formField('Salarié', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { value: salIdDef, required: true }), { required: true })}
      ${M.formField('Type', M.formSelect('type', [
        { value: 'conge',    label: 'Congé' },
        { value: 'absence',  label: '⚠️ Absence' },
        { value: 'maladie',  label: 'Maladie / arrêt' }
      ], { value: a.type || 'conge' }))}
      <div class="m-form-row">
        ${M.formField('Date début', M.formInput('dateDebut', { type: 'date', value: a.dateDebut || today, required: true }), { required: true })}
        ${M.formField('Date fin', M.formInput('dateFin', { type: 'date', value: a.dateFin || '' }), { hint: 'Vide = sans fin' })}
      </div>
      ${M.formField('Motif (optionnel)', M.formTextarea('motif', { value: a.motif || '', rows: 2, placeholder: 'Raison interne...' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-abs-delete" style="margin-top:14px">🗑️ Supprimer cette période</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier période d\'absence' : '🏖️ Nouvelle absence longue',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-abs-delete')?.addEventListener('click', async () => {
          if (!await M.confirm('Supprimer cette période d\'absence ?', { titre: 'Supprimer absence' })) return;
          if (salPlanning) {
            salPlanning.absences = salPlanning.absences.filter(x => x.id !== abs.id);
            const allP = M.charger('plannings');
            const idx = allP.findIndex(p => p.salId === salPlanning.salId);
            if (idx >= 0) allP[idx] = salPlanning;
            M.sauvegarder('plannings', allP);
          }
          M.toast('🗑️ Période supprimée');
          M.closeSheet();
          M.go('planning');
        });
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.salId) { M.toast('⚠️ Salarié requis'); return false; }
        if (!f.dateDebut) { M.toast('⚠️ Date début requise'); return false; }
        if (f.dateFin && f.dateFin < f.dateDebut) { M.toast('⚠️ Date fin avant date début'); return false; }
        const allP = M.charger('plannings');
        let p = allP.find(x => x.salId === f.salId);
        if (!p) { p = { salId: f.salId, semaine: [], absences: [] }; allP.push(p); }
        p.absences = p.absences || [];
        if (enEdition) {
          const idx = p.absences.findIndex(x => x.id === abs.id);
          if (idx >= 0) p.absences[idx] = { ...abs, ...f, modifieLe: new Date().toISOString() };
        } else {
          p.absences.push({
            id: M.genId(),
            type: f.type || 'conge',
            dateDebut: f.dateDebut,
            dateFin: f.dateFin || '',
            motif: f.motif?.trim() || '',
            creeLe: new Date().toISOString()
          });
        }
        M.sauvegarder('plannings', allP);
        M.toast(enEdition ? '✅ Période modifiée' : '✅ Période enregistrée');
        M.go('planning');
        return true;
      }
    });
  };
  // ============================================================
  // ALERTES — namespace data (mirror script-alertes.js cote desktop)
  // ============================================================
  // Doit rester aligne avec ALERTE_COOLDOWN_JOURS / bloqueRegen / purgerAlertesAnciennes
  // de script-alertes.js. Si tu changes la logique cote desktop, repercute ici.
  M.alertes = {
    COOLDOWN_JOURS: 30,
    estReportee(a) {
      return a?.meta?.repousseJusquA && new Date(a.meta.repousseJusquA) > new Date();
    },
    bloqueRegen(a) {
      if (!a.traitee && !a.ignoree) return true;
      if (a.cooldownJusquA && new Date(a.cooldownJusquA) > new Date()) return true;
      return false;
    },
    dateCooldownIso(jours) {
      const d = new Date();
      d.setDate(d.getDate() + (Number(jours) || M.alertes.COOLDOWN_JOURS));
      return d.toISOString();
    },
    purger() {
      const now = new Date();
      const arr = M.charger('alertes_admin');
      const out = arr.filter(a => {
        if (!a.traitee && !a.ignoree) return true;
        if (a.cooldownJusquA && new Date(a.cooldownJusquA) > now) return true;
        return false;
      });
      if (out.length !== arr.length) M.sauvegarder('alertes_admin', out);
    },
    valider(id) {
      const arr = M.charger('alertes_admin');
      const idx = arr.findIndex(a => a.id === id);
      if (idx < 0) return false;
      const now = new Date().toISOString();
      arr[idx].traitee = true;
      arr[idx].traiteLe = now;
      arr[idx].cooldownJusquA = M.alertes.dateCooldownIso();
      M.sauvegarder('alertes_admin', arr);
      M.toast('✅ Alerte traitée');
      return true;
    },
    ignorer(id) {
      const arr = M.charger('alertes_admin');
      const idx = arr.findIndex(a => a.id === id);
      if (idx < 0) return false;
      arr[idx].ignoree = true;
      arr[idx].ignoreeLe = new Date().toISOString();
      arr[idx].cooldownJusquA = M.alertes.dateCooldownIso();
      M.sauvegarder('alertes_admin', arr);
      M.toast('🗑️ Alerte ignorée (silencieuse 30j)');
      return true;
    },
    reporter(id, jours) {
      const n = Number(jours) || 7;
      const arr = M.charger('alertes_admin');
      const a = arr.find(x => x.id === id);
      if (!a) return false;
      const d = new Date(); d.setDate(d.getDate() + n);
      a.meta = { ...(a.meta || {}), repousseJusquA: d.toISOString() };
      M.sauvegarder('alertes_admin', arr);
      M.toast(`⏰ Reportée de ${n} jour${n > 1 ? 's' : ''}`);
      return true;
    },
    reprendre(id) {
      const arr = M.charger('alertes_admin');
      const a = arr.find(x => x.id === id);
      if (!a || !a.meta?.repousseJusquA) return false;
      delete a.meta.repousseJusquA;
      M.sauvegarder('alertes_admin', arr);
      M.toast('▶️ Alerte reprise');
      return true;
    },
    async validerParType(type) {
      const arr = M.charger('alertes_admin');
      const cibles = arr.filter(a => a.type === type && !a.traitee && !a.ignoree && !M.alertes.estReportee(a));
      if (!cibles.length) return false;
      const ok = await M.confirm(`Marquer ${cibles.length} alerte${cibles.length>1?'s':''} comme traitée${cibles.length>1?'s':''} ?`, { titre: 'Tout valider' });
      if (!ok) return false;
      const now = new Date().toISOString();
      const cd = M.alertes.dateCooldownIso();
      const ids = new Set(cibles.map(a => a.id));
      const out = arr.map(a => ids.has(a.id) ? { ...a, traitee: true, traiteLe: now, cooldownJusquA: cd } : a);
      M.sauvegarder('alertes_admin', out);
      M.toast(`✅ ${cibles.length} alerte${cibles.length>1?'s':''} traitée${cibles.length>1?'s':''}`);
      return true;
    },
    async ignorerParType(type) {
      const arr = M.charger('alertes_admin');
      const cibles = arr.filter(a => a.type === type && !a.traitee && !a.ignoree && !M.alertes.estReportee(a));
      if (!cibles.length) return false;
      const ok = await M.confirm(`Ignorer ${cibles.length} alerte${cibles.length>1?'s':''} (silencieuses 30 jours) ?`, { titre: 'Tout ignorer' });
      if (!ok) return false;
      const now = new Date().toISOString();
      const cd = M.alertes.dateCooldownIso();
      const ids = new Set(cibles.map(a => a.id));
      const out = arr.map(a => ids.has(a.id) ? { ...a, ignoree: true, ignoreeLe: now, cooldownJusquA: cd } : a);
      M.sauvegarder('alertes_admin', out);
      M.toast(`🗑️ ${cibles.length} alerte${cibles.length>1?'s':''} ignorée${cibles.length>1?'s':''}`);
      return true;
    },
    // Crée une alerte si aucune active du même (type, scope) n'existe + pas en cooldown.
    // Mirror de ajouterAlerteSiAbsente côté PC (script-alertes.js).
    ajouterSiAbsente(type, message, meta) {
      const arr = M.charger('alertes_admin');
      const scopeMatch = (a) => {
        if (!meta) return true;
        if (meta.salId) return a.meta?.salId === meta.salId;
        if (meta.vehId) return a.meta?.vehId === meta.vehId;
        if (meta.livId) return a.meta?.livId === meta.livId;
        return true;
      };
      const existe = arr.find(a => a.type === type && scopeMatch(a) && M.alertes.bloqueRegen(a));
      if (existe) return false;
      arr.push({
        id: M.genId(),
        type, message,
        meta: meta || {},
        lu: false, traitee: false,
        creeLe: new Date().toISOString()
      });
      M.sauvegarder('alertes_admin', arr);
      return true;
    },
  };

  // Vérifie permis + assurance + visite médicale de chaque salarié.
  // Mirror de verifierDocumentsSalaries (script-salaries.js).
  // Génère alertes permis_expire / permis_proche / assurance_expire / etc.
  // Auto-purge anciennes alertes traitées via M.alertes.purger en amont.
  M.verifierDocumentsSalaries = function() {
    const salaries = M.charger('salaries');
    const auj = new Date(); auj.setHours(0,0,0,0);
    const checkDate = (s, dateStr, prefix, lblExp, lblProche, seuilJours) => {
      if (!dateStr) return;
      const d = new Date(dateStr); d.setHours(0,0,0,0);
      if (isNaN(d)) return;
      const diff = Math.ceil((d - auj) / (1000*60*60*24));
      const nom = ((s.prenom ? s.prenom + ' ' : '') + (s.nom || '')).trim();
      if (diff < 0) {
        M.alertes.ajouterSiAbsente(prefix + '_expire',
          `⚠️ ${lblExp} — ${nom} (depuis ${Math.abs(diff)} j)`,
          { salId: s.id, salNom: nom });
      } else if (diff === 0) {
        M.alertes.ajouterSiAbsente(prefix + '_expire',
          `⚠️ ${lblExp} AUJOURD'HUI — ${nom}`,
          { salId: s.id, salNom: nom });
      } else if (diff <= seuilJours) {
        M.alertes.ajouterSiAbsente(prefix + '_proche',
          `🔔 ${lblProche} dans ${diff} j — ${nom}`,
          { salId: s.id, salNom: nom });
      }
    };
    salaries.forEach(s => {
      if (!s || s.archive || s.statut === 'inactif') return;
      checkDate(s, s.datePermis, 'permis', 'Permis expiré', 'Permis expire', 60);
      checkDate(s, s.dateAssurance, 'assurance', 'Assurance expirée', 'Assurance expire', 30);
      // Visite médicale (R.4624-10)
      const vm = s.visiteMedicale;
      if (vm && typeof vm === 'object' && vm.dateExpiration) {
        checkDate(s, vm.dateExpiration, 'visite', 'Visite médicale expirée', 'Visite médicale expire', 60);
      }
    });
  };

  // Vérifie CT + assurance véhicule (mirror PC).
  M.verifierDocumentsVehicules = function() {
    const vehicules = M.charger('vehicules');
    const auj = new Date(); auj.setHours(0,0,0,0);
    const checkDate = (v, dateStr, prefix, lblExp, lblProche, seuilJours) => {
      if (!dateStr) return;
      const d = new Date(dateStr); d.setHours(0,0,0,0);
      if (isNaN(d)) return;
      const diff = Math.ceil((d - auj) / (1000*60*60*24));
      const immat = v.immat || v.id;
      if (diff < 0) {
        M.alertes.ajouterSiAbsente(prefix + '_expire',
          `⚠️ ${lblExp} — ${immat} (depuis ${Math.abs(diff)} j)`,
          { vehId: v.id, immat });
      } else if (diff === 0) {
        M.alertes.ajouterSiAbsente(prefix + '_expire',
          `⚠️ ${lblExp} AUJOURD'HUI — ${immat}`,
          { vehId: v.id, immat });
      } else if (diff <= seuilJours) {
        M.alertes.ajouterSiAbsente(prefix + '_proche',
          `🔔 ${lblProche} dans ${diff} j — ${immat}`,
          { vehId: v.id, immat });
      }
    };
    vehicules.forEach(v => {
      if (!v || v.archive) return;
      checkDate(v, v.dateCT, 'ct', 'CT expiré', 'CT à renouveler', 60);
      checkDate(v, v.dateAssurance, 'assurance', 'Assurance expirée', 'Assurance expire', 30);
    });
  };

  // Lance la vérif complète (salariés + véhicules) au boot et toutes les heures.
  // Idempotent (cooldown bloqueRegen empêche la regen en boucle).
  M.lancerVerifDocs = function() {
    try { M.alertes.purger(); } catch (_) {}
    try { M.verifierDocumentsSalaries(); } catch (_) {}
    try { M.verifierDocumentsVehicules(); } catch (_) {}
  };

  // ---------- Alertes (v3.33 : groupage par module/onglet metier) ----------
  // Chaque categorie est rattachee au module concerne (vehicules, salaries, ...).
  // Affichage final : sections groupees par module, severite portee par la couleur de chaque ligne.
  const M_ALERTES_CATEGORIES = [
    // Vehicules (CT, vidange, inspection, assurance liee veh)
    { type: 'ct_expire',              severity: 'critique', module: 'vehicules', label: 'CT expirés',                  icon: '⚠️' },
    { type: 'ct_proche',              severity: 'alerte',   module: 'vehicules', label: 'CT à renouveler',             icon: '🔔' },
    { type: 'assurance_expire',       severity: 'critique', module: 'vehicules', label: 'Assurances expirées',         icon: '🛡️' },
    { type: 'assurance_proche',       severity: 'alerte',   module: 'vehicules', label: 'Assurances bientôt expirées', icon: '🛡️' },
    { type: 'vidange',                severity: 'alerte',   module: 'vehicules', label: 'Vidanges',                    icon: '🔧' },
    { type: 'inspection_manquante',   severity: 'alerte',   module: 'vehicules', label: 'Véhicules sans inspection',   icon: '🚗' },
    { type: 'inspection',             severity: 'info',     module: 'inspections', label: 'Inspections reçues',        icon: '🚗' },
    // Salaries (permis = lie au salarie)
    { type: 'permis_expire',          severity: 'critique', module: 'salaries', label: 'Permis expirés',               icon: '🪪' },
    { type: 'permis_proche',          severity: 'alerte',   module: 'salaries', label: 'Permis bientôt expirés',       icon: '🪪' },
    // Finances
    { type: 'charge_retard_paiement', severity: 'critique', module: 'charges',  label: 'Charges en retard',            icon: '💸' },
    { type: 'carburant_anomalie',     severity: 'critique', module: 'carburant', label: 'Anomalies carburant',         icon: '⛽' },
    { type: 'carburant_modif',        severity: 'info',     module: 'carburant', label: 'Modifs carburant',            icon: '✏️' },
    // Livraisons
    { type: 'prix_manquant',          severity: 'alerte',   module: 'livraisons', label: 'Prix manquants',             icon: '💶' },
    { type: 'livraison_modif',        severity: 'info',     module: 'livraisons', label: 'Livraisons modifiées',       icon: '✏️' },
    // Planning / equipe
    { type: 'planning_manquant',      severity: 'alerte',   module: 'planning', label: 'Salariés sans planning',       icon: '📅' },
    { type: 'km_modif',               severity: 'info',     module: 'heures',   label: 'Modifs km',                    icon: '✏️' },
  ];

  // Modules dans l'ordre d'affichage (avec page cible pour le bouton "Voir l'onglet")
  const M_ALERTES_MODULES = [
    { key: 'vehicules',   label: '🚐 Véhicules',   page: 'vehicules' },
    { key: 'salaries',    label: '👥 Salariés',    page: 'salaries' },
    { key: 'charges',     label: '💸 Charges',     page: 'charges' },
    { key: 'carburant',   label: '⛽ Carburant',   page: 'carburant' },
    { key: 'livraisons',  label: '📦 Livraisons',  page: 'livraisons' },
    { key: 'inspections', label: '🚗 Inspections', page: 'inspections' },
    { key: 'planning',    label: '📅 Planning',    page: 'planning' },
    { key: 'heures',      label: '⏱️ Heures & Km',  page: 'heures' },
  ];
  const M_SEVERITES = {
    critique: { label: 'Critique', color: 'var(--m-red)',    order: 1 },
    alerte:   { label: 'À traiter', color: 'var(--m-accent)', order: 2 },
    info:     { label: 'Info',      color: 'var(--m-blue)',   order: 3 },
  };

  M.state.alertesStatut = 'actives'; // actives | reportees | traitees
  M.state.alertesRecherche = '';

  M.register('alertes', {
    title: 'Alertes',
    render() {
      M.alertes.purger(); // auto-purge a chaque rendu (cf. desktop)

      const toutes = M.charger('alertes_admin').sort((a,b) => new Date(b.creeLe||0) - new Date(a.creeLe||0));
      const recherche = (M.state.alertesRecherche || '').toLowerCase();
      const statut = M.state.alertesStatut;

      // Filtre statut
      let filtered = toutes;
      if (statut === 'actives')   filtered = filtered.filter(a => !a.traitee && !a.ignoree && !M.alertes.estReportee(a));
      if (statut === 'reportees') filtered = filtered.filter(a => !a.traitee && !a.ignoree && M.alertes.estReportee(a));
      if (statut === 'traitees')  filtered = filtered.filter(a => a.traitee);

      // Filtre recherche
      if (recherche) {
        filtered = filtered.filter(a => {
          const hay = `${a.message||''} ${a.meta?.salNom||''} ${a.meta?.client||''} ${a.meta?.immat||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }

      // Stats globales (banner)
      const allActives = toutes.filter(a => !a.traitee && !a.ignoree && !M.alertes.estReportee(a));
      const countBySev = { critique: 0, alerte: 0, info: 0 };
      allActives.forEach(a => {
        const cat = M_ALERTES_CATEGORIES.find(c => c.type === a.type);
        if (cat) countBySev[cat.severity]++;
      });
      const allReportees = toutes.filter(a => !a.traitee && !a.ignoree && M.alertes.estReportee(a)).length;

      // Header : recherche + chips statut
      let html = `
        <div style="margin-bottom:14px">
          <input type="search" id="m-alertes-search" placeholder="🔍 Rechercher" value="${M.escHtml(M.state.alertesRecherche)}" autocomplete="off" />
        </div>
        <div style="display:flex;gap:6px;margin-bottom:18px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${statut==='actives'?'active':''}" data-statut="actives">🔴 Actives</button>
          <button class="m-alertes-chip ${statut==='reportees'?'active':''}" data-statut="reportees">⏰ Reportées${allReportees ? ` (${allReportees})` : ''}</button>
          <button class="m-alertes-chip ${statut==='traitees'?'active':''}" data-statut="traitees">✅ Traitées</button>
        </div>
        ${statut === 'traitees' ? `<button type="button" id="m-alertes-vider" class="m-btn m-btn-danger" style="margin-bottom:14px">🗑️ Vider l'historique traité</button>` : ''}
      `;

      // Stats banner (uniquement en vue actives)
      if (statut === 'actives' && allActives.length) {
        html += `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px">
            ${['critique','alerte','info'].map(sev => {
              const cfg = M_SEVERITES[sev];
              const n = countBySev[sev];
              return `<div style="background:linear-gradient(135deg,${cfg.color}1a,${cfg.color}0a);border:1px solid ${cfg.color}55;border-radius:12px;padding:10px 8px;text-align:center;${n===0?'opacity:0.45':''}">
                <div style="font-size:.62rem;color:${cfg.color};font-weight:700;text-transform:uppercase;letter-spacing:.04em">${cfg.label}</div>
                <div style="font-size:1.3rem;font-weight:700;color:${cfg.color};margin-top:2px">${n}</div>
              </div>`;
            }).join('')}
          </div>
        `;
      }

      // Empty states
      if (!filtered.length) {
        let icone = '✅', titre = 'Aucune alerte', sous = 'Tout est sous contrôle.';
        if (recherche) { icone = '🔍'; titre = 'Aucun résultat'; sous = 'Essaie un autre mot-clé.'; }
        else if (statut === 'reportees') { icone = '⏰'; titre = 'Aucune alerte reportée'; sous = 'Quand tu reportes une alerte, elle apparait ici jusqu\'à la date de reprise.'; }
        else if (statut === 'traitees')  { icone = '📋'; titre = 'Aucune alerte traitée'; sous = 'L\'historique apparait ici. Auto-purge après 30 jours.'; }
        html += `<div class="m-empty"><div class="m-empty-icon">${icone}</div><h3 class="m-empty-title">${titre}</h3><p class="m-empty-text">${sous}</p></div>`;
        return html;
      }

      // Render group par MODULE -> categorie (suite demande user : classer par onglet)
      const enModeReportees = statut === 'reportees';
      const enModeTraitees = statut === 'traitees';
      M_ALERTES_MODULES.forEach(mod => {
        const itemsMod = filtered.filter(a => {
          const cat = M_ALERTES_CATEGORIES.find(c => c.type === a.type);
          return cat?.module === mod.key;
        });
        if (!itemsMod.length) return;
        // Severite max dans le module (pour la couleur du header)
        const sevs = itemsMod.map(a => M_ALERTES_CATEGORIES.find(c => c.type === a.type)?.severity || 'info');
        const sevMax = sevs.includes('critique') ? 'critique' : sevs.includes('alerte') ? 'alerte' : 'info';
        const cfgSev = M_SEVERITES[sevMax];
        html += `<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 4px 8px;border-bottom:1px solid ${cfgSev.color}33;padding-bottom:6px">
          <span style="font-size:.78rem;font-weight:700;color:${cfgSev.color};text-transform:uppercase;letter-spacing:.04em">${mod.label} — ${itemsMod.length}</span>
          <button type="button" onclick="MCAm.go('${mod.page}')" style="background:transparent;border:0;color:var(--m-accent);font-size:.72rem;font-weight:600;padding:0;cursor:pointer">Ouvrir →</button>
        </div>`;

        // Group par categorie au sein du module (preserve le tri severite descendant)
        const cats = M_ALERTES_CATEGORIES.filter(c => c.module === mod.key)
          .sort((a, b) => (M_SEVERITES[a.severity].order - M_SEVERITES[b.severity].order));
        cats.forEach(cat => {
          const items = itemsMod.filter(a => a.type === cat.type);
          if (!items.length) return;

          // Card categorie
          html += `<div class="m-card" style="padding:0;margin-bottom:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--m-border)">
              <div style="font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0">
                <span>${cat.icon}</span>
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat.label}</span>
                <span style="background:var(--m-bg-elevated);padding:1px 8px;border-radius:10px;font-size:.7rem;color:var(--m-text-muted);flex-shrink:0">${items.length}</span>
              </div>
              ${!enModeReportees && !enModeTraitees && items.length > 1 ? `
                <div style="display:flex;gap:4px;flex-shrink:0">
                  <button class="m-alertes-bulk" data-action="valider" data-type="${M.escHtml(cat.type)}" title="Tout valider" style="background:rgba(46,204,113,0.15);color:var(--m-green);border:1px solid rgba(46,204,113,0.3);padding:4px 8px;border-radius:6px;font-size:.7rem;font-weight:600">✓ Tout</button>
                  <button class="m-alertes-bulk" data-action="ignorer" data-type="${M.escHtml(cat.type)}" title="Tout ignorer" style="background:rgba(231,76,60,0.12);color:var(--m-red);border:1px solid rgba(231,76,60,0.3);padding:4px 8px;border-radius:6px;font-size:.7rem;font-weight:600">✕ Tout</button>
                </div>
              ` : ''}
            </div>
            ${items.map((a, idx) => {
              const isLast = idx === items.length - 1;
              const dateLabel = enModeReportees && a.meta?.repousseJusquA
                ? `⏰ ${M.formatDate(a.meta.repousseJusquA)}`
                : M.formatDate(a.creeLe);
              const sub = a.meta?.salNom || a.meta?.client || a.meta?.immat || '';
              const estCritiqueExpire = ['ct_expire','permis_expire','assurance_expire'].includes(cat.type);

              let actions;
              if (enModeReportees) {
                actions = `<button class="m-alerte-action" data-action="reprendre" data-id="${M.escHtml(a.id)}" style="color:var(--m-purple)">▶️ Reprendre</button>`;
              } else if (enModeTraitees) {
                actions = `<span style="color:var(--m-text-muted);font-size:.78rem">Traité ${M.formatDate(a.traiteLe)}</span>`;
              } else if (estCritiqueExpire) {
                actions = `<button class="m-alerte-action" data-action="valider" data-id="${M.escHtml(a.id)}" style="color:var(--m-green)">✓ Traité</button>`;
              } else {
                actions = `
                  <button class="m-alerte-action" data-action="valider" data-id="${M.escHtml(a.id)}" style="color:var(--m-green)">✓ Valider</button>
                  <select class="m-alerte-snooze" data-id="${M.escHtml(a.id)}" style="font-size:.75rem;padding:5px 6px;background:rgba(155,89,182,0.1);color:var(--m-purple);border:1px solid rgba(155,89,182,0.3);border-radius:6px;width:auto;min-width:0">
                    <option value="">⏰</option>
                    <option value="1">+1 j</option>
                    <option value="7">+7 j</option>
                    <option value="30">+30 j</option>
                  </select>
                  <button class="m-alerte-action" data-action="ignorer" data-id="${M.escHtml(a.id)}" style="color:var(--m-red)">✕</button>
                `;
              }

              return `<div style="padding:12px 14px${isLast ? '' : ';border-bottom:1px solid var(--m-border)'}">
                <div style="font-size:.88rem;line-height:1.4;margin-bottom:6px">${M.escHtml(a.message || '')}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:.75rem;color:var(--m-text-muted)">
                  <span>${sub ? M.escHtml(sub) + ' · ' : ''}${dateLabel}</span>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">${actions}</div>
                </div>
              </div>`;
            }).join('')}
          </div>`;
        });
      });

      return html;
    },

    afterRender(container) {
      // Recherche debouncee
      const searchInput = container.querySelector('#m-alertes-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.alertesRecherche = e.target.value; M.go('alertes'); }, 350);
        });
        if (M.state.alertesRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      // Chips statut
      container.querySelectorAll('.m-alertes-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.alertesStatut = btn.dataset.statut;
          M.go('alertes');
        });
      });
      // Bouton "Vider l'historique traite" (uniquement en vue traitees)
      container.querySelector('#m-alertes-vider')?.addEventListener('click', async () => {
        const arr = M.charger('alertes_admin');
        const traitees = arr.filter(a => a.traitee);
        if (!traitees.length) return M.toast('Aucune alerte traitée à vider');
        if (!await M.confirm(`Effacer définitivement ${traitees.length} alerte${traitees.length>1?'s':''} traitée${traitees.length>1?'s':''} ?`, { titre: "Vider l'historique" })) return;
        M.sauvegarder('alertes_admin', arr.filter(a => !a.traitee));
        M.toast(`🗑️ ${traitees.length} alerte${traitees.length>1?'s':''} effacée${traitees.length>1?'s':''}`);
        M.go('alertes');
      });
      // Actions individuelles
      container.querySelectorAll('.m-alerte-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          if (action === 'valider')   M.alertes.valider(id);
          if (action === 'ignorer')   M.alertes.ignorer(id);
          if (action === 'reprendre') M.alertes.reprendre(id);
          M.updateAlertesBadge();
          M.go('alertes');
        });
      });
      // Snooze select
      container.querySelectorAll('.m-alerte-snooze').forEach(sel => {
        sel.addEventListener('change', e => {
          if (!e.target.value) return;
          M.alertes.reporter(e.target.dataset.id, e.target.value);
          M.updateAlertesBadge();
          M.go('alertes');
        });
      });
      // Bulk actions
      container.querySelectorAll('.m-alertes-bulk').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const type = btn.dataset.type;
          const fn = action === 'valider' ? M.alertes.validerParType : M.alertes.ignorerParType;
          const ok = await fn(type);
          if (ok) {
            M.updateAlertesBadge();
            M.go('alertes');
          }
        });
      });
    }
  });
  // ---------- Helper : index immat par vehiculeId (utilise sur Carburant) ----------
  M.indexVehicules = function() {
    const arr = M.charger('vehicules');
    const idx = {};
    arr.forEach(v => { if (v && v.id) idx[v.id] = v; });
    return idx;
  };

  // Dernier kilométrage connu pour un véhicule, agrégé depuis :
  // - vehicule.km (compteur affiché)
  // - dernier carburant.kmCompteur
  // - dernier entretien.km
  // - dernière saisie heures.km cumulé
  // Le max gagne. Utilisé pour auto-fill km dans les forms entretien/plein/heures.
  M.dernierKmConnu = function(vehId) {
    if (!vehId) return 0;
    const veh = M.charger('vehicules').find(v => v.id === vehId);
    let max = M.parseNum(veh?.km) || 0;
    const matchVeh = (x) => x && (x.vehiculeId === vehId || x.vehId === vehId);
    M.charger('carburant').filter(matchVeh).forEach(p => {
      const k = M.parseNum(p.kmCompteur) || M.parseNum(p.km) || 0;
      if (k > max) max = k;
    });
    M.charger('entretiens').filter(matchVeh).forEach(e => {
      const k = M.parseNum(e.km) || 0;
      if (k > max) max = k;
    });
    // Heures : somme cumulative des km par véhicule
    let cumKmHeures = 0;
    M.charger('heures').filter(matchVeh).forEach(h => {
      cumKmHeures += M.parseNum(h.km) || 0;
    });
    if (cumKmHeures > max) max = cumKmHeures;
    return max;
  };

  // ---------- Helper : index nom par salId (utilise sur Planning) ----------
  M.indexSalaries = function() {
    const arr = M.charger('salaries');
    const idx = {};
    arr.forEach(s => { if (s && s.id) idx[s.id] = s; });
    return idx;
  };

  // ---------- Helpers : lookup entites par nom (utilises pour liaisons inter-onglets) ----------
  // Le desktop stocke parfois juste le nom (sans id) -> on cherche fuzzy par lowercase.
  M.findSalarieByName = function(nom) {
    if (!nom) return null;
    const target = String(nom).trim().toLowerCase();
    return M.charger('salaries').find(s => {
      const full = `${s.prenom || ''} ${s.nom || ''}`.trim().toLowerCase();
      return full === target || (s.nom || '').toLowerCase() === target;
    }) || null;
  };
  M.findClientByName = function(nom) {
    if (!nom) return null;
    const target = String(nom).trim().toLowerCase();
    return M.charger('clients').find(c => (c.nom || '').toLowerCase() === target) || null;
  };
  M.findVehiculeByImmat = function(immat) {
    if (!immat) return null;
    const target = String(immat).trim().toUpperCase();
    return M.charger('vehicules').find(v => (v.immat || v.immatriculation || '').toUpperCase() === target) || null;
  };
  M.findFournisseurByName = function(nom) {
    if (!nom) return null;
    const target = String(nom).trim().toLowerCase();
    return M.charger('fournisseurs').find(f => (f.nom || '').toLowerCase() === target) || null;
  };

  // ---------- Carburant (v2.3 : liste lecture seule, grouped par mois) ----------
  M.state.carbMoisOuverts = {};
  M.state.carbBulkMode = false;
  M.state.carbBulkSel = new Set();
  M.register('carburant', {
    title: 'Carburant',
    render() {
      const allPleins = M.charger('carburant');
      const vehIdx = M.indexVehicules();
      const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
      const filterVeh = M.state.carburantVehFilter || '';
      const pleins = filterVeh ? allPleins.filter(p => (p.vehiculeId || p.vehId) === filterVeh) : allPleins;

      // KPI mois courant
      const moisCourant = M.moisKey();
      const pleinsCourants = pleins.filter(p => (p.date || '').startsWith(moisCourant));
      const totalMois = pleinsCourants.reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
      const litresMois = pleinsCourants.reduce((s, p) => s + (M.parseNum(p.litres) || 0), 0);
      const prixMoyen = litresMois > 0 ? totalMois / litresMois : 0;

      const bulkOn = M.state.carbBulkMode;
      const selSet = M.state.carbBulkSel;
      const selCount = selSet.size;

      let html = bulkOn ? '' : `<button class="m-fab" onclick="MCAm.formNouveauPlein()" aria-label="Nouveau plein">+</button>
        <button class="m-fab m-fab-secondary" id="m-carb-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>`;
      if (bulkOn) {
        html += `<div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:10px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,.15)">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:${selCount>0?'10px':'0'}">
            <div style="flex:1 1 auto;font-size:.92rem"><strong>${selCount}</strong> sélectionné${selCount>1?'s':''}</div>
            <button type="button" id="m-carb-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:36px;font-size:.78rem">✕</button>
          </div>
          ${selCount > 0 ? `<button type="button" id="m-carb-bulk-delete" class="m-btn m-btn-danger" style="width:100%;height:36px;font-size:.74rem">🗑️ Supprimer la sélection (cascade charge liée)</button>` : ''}
        </div>`;
      }
      html += `
        <div class="m-card-row">
          <div class="m-card m-card-red">
            <div class="m-card-title">⛽ Coût mois</div>
            <div class="m-card-value">${M.format$(totalMois)}</div>
            <div class="m-card-sub">${M.formatNum(pleinsCourants.length)} plein${pleinsCourants.length>1?'s':''}</div>
          </div>
          <div class="m-card m-card-blue">
            <div class="m-card-title">Litres mois</div>
            <div class="m-card-value">${M.formatNum(litresMois.toFixed(0))} L</div>
            <div class="m-card-sub">${prixMoyen > 0 ? M.format$(prixMoyen) + '/L' : '—'}</div>
          </div>
        </div>
        ${vehicules.length > 1 ? `
          <div style="margin:14px 0">
            <select id="m-carb-veh">
              <option value="">🚐 Tous les véhicules</option>
              ${vehicules.map(v => `<option value="${M.escHtml(v.id)}" ${v.id === filterVeh ? 'selected' : ''}>${M.escHtml(v.immat || v.id)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      `;

      if (!pleins.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">⛽</div><h3 class="m-empty-title">Aucun plein</h3><p class="m-empty-text">Tape sur ➕ pour saisir ton premier plein.</p></div>`;
        return html;
      }

      // Group by month desc
      const sorted = [...pleins].sort((a,b) => (b.date||'').localeCompare(a.date||''));
      const byMonth = {};
      sorted.forEach(p => {
        const m = (p.date || '0000-00').slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(p);
      });
      const monthsSorted = Object.keys(byMonth).sort().reverse();

      monthsSorted.forEach(month => {
        const items = byMonth[month];
        const total = items.reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
        const dateLabel = month === '0000-00' ? 'Sans date' : (() => {
          const [y, m] = month.split('-');
          return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        })();
        const isOpen = M.state.carbMoisOuverts[month] !== undefined ? M.state.carbMoisOuverts[month] : (month === moisCourant);

        html += `
          <div class="m-section" style="margin-top:18px">
            <button type="button" class="m-section-header m-carb-mois" data-mois="${M.escHtml(month)}" style="width:100%;background:transparent;border:none;color:inherit;text-align:left;cursor:pointer;padding:0 4px 10px">
              <span style="display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0">
                <span style="color:var(--m-text-muted);font-size:.9rem;display:inline-block;transform:rotate(${isOpen ? '90' : '0'}deg);transition:transform 0.15s ease">▶</span>
                <h3 class="m-section-title" style="font-size:1rem">${dateLabel}</h3>
              </span>
              <span style="text-align:right;font-size:.78rem;color:var(--m-text-muted);font-weight:500">
                <div>${items.length} plein${items.length>1?'s':''}</div>
                <div style="color:var(--m-red);font-weight:600;margin-top:2px">${M.format$(total)}</div>
              </span>
            </button>
            <div data-content="${M.escHtml(month)}" style="display:${isOpen ? 'block' : 'none'}">
              ${items.map(p => {
                const veh = p.vehiculeId ? vehIdx[p.vehiculeId] : null;
                const immat = veh?.immat || veh?.immatriculation || (p.immat || '—');
                const isSel = selSet.has(p.id);
                const cls = bulkOn ? 'm-carb-toggle' : 'm-carb-edit';
                const bg = bulkOn && isSel ? 'background:var(--m-accent-soft);border-color:var(--m-accent)' : 'background:var(--m-card);border:1px solid var(--m-border)';
                const cb = bulkOn ? `<div style="flex:0 0 28px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>` : '';
                return `<div role="button" tabindex="0" class="m-card m-card-pressable ${cls}" data-id="${M.escHtml(p.id)}" style="padding:14px;width:100%;text-align:left;${bg};border-radius:18px;margin-bottom:10px;color:inherit;display:flex;align-items:start;gap:10px;cursor:pointer">
                  ${cb}
                  <div style="flex:1 1 auto;min-width:0">
                    <div style="font-weight:600;font-size:.95rem">${M.escHtml(immat)}</div>
                    <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:3px">${M.formatDate(p.date)}${p.kmCompteur ? ' · ' + M.formatNum(p.kmCompteur) + ' km' : ''}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:700;color:var(--m-red);white-space:nowrap;font-size:.95rem">${M.format$(p.total)}</div>
                    <div style="font-size:.75rem;color:var(--m-text-muted);margin-top:2px">${(M.parseNum(p.litres) || 0).toFixed(1)} L${p.prixLitre ? ' · ' + M.parseNum(p.prixLitre).toFixed(3) + '€/L' : ''}</div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
        `;
      });

      return html;
    },
    afterRender(container) {
      container.querySelector('#m-carb-veh')?.addEventListener('change', e => { M.state.carburantVehFilter = e.target.value; M.go('carburant'); });
      container.querySelectorAll('.m-carb-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerPlein(btn.dataset.id));
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.editerPlein(btn.dataset.id); } });
      });
      container.querySelectorAll('.m-carb-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.carbBulkSel.has(id)) M.state.carbBulkSel.delete(id);
          else M.state.carbBulkSel.add(id);
          M.go('carburant');
        });
      });
      container.querySelector('#m-carb-bulk-on')?.addEventListener('click', () => { M.state.carbBulkMode = true; M.state.carbBulkSel.clear(); M.go('carburant'); });
      container.querySelector('#m-carb-bulk-exit')?.addEventListener('click', () => { M.state.carbBulkMode = false; M.state.carbBulkSel.clear(); M.go('carburant'); });
      container.querySelector('#m-carb-bulk-delete')?.addEventListener('click', async () => {
        const ids = [...M.state.carbBulkSel];
        if (!ids.length) return;
        if (!await M.confirm(`Supprimer ${ids.length} plein${ids.length>1?'s':''} ? Les charges liées seront aussi supprimées.`, { titre: 'Suppression en lot' })) return;
        const pleins = M.charger('carburant');
        const aSuppr = pleins.filter(p => ids.includes(p.id));
        const chargeIds = aSuppr.map(p => p.chargeId).filter(Boolean);
        M.sauvegarder('carburant', pleins.filter(p => !ids.includes(p.id)));
        if (chargeIds.length) M.sauvegarder('charges', M.charger('charges').filter(c => !chargeIds.includes(c.id) && !ids.includes(c.carburantId)));
        else M.sauvegarder('charges', M.charger('charges').filter(c => !ids.includes(c.carburantId)));
        M.toast(`🗑️ ${ids.length} plein${ids.length>1?'s':''} supprimé${ids.length>1?'s':''}`);
        M.state.carbBulkSel.clear(); M.state.carbBulkMode = false;
        M.go('carburant');
      });
      container.querySelectorAll('button.m-carb-mois').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = btn.dataset.mois;
          const c = container.querySelector(`[data-content="${m}"]`);
          const ch = btn.querySelector('span > span');
          if (!c) return;
          const willOpen = c.style.display === 'none';
          M.state.carbMoisOuverts[m] = willOpen;
          c.style.display = willOpen ? 'block' : 'none';
          if (ch) ch.style.transform = `rotate(${willOpen ? '90' : '0'}deg)`;
        });
      });
    }
  });

  // ---------- Encaissement (v3.35 : miroir Charges cote revenus) ----------
  // Source : livraisons + leur statutPaiement. Marque les revenus a encaisser.
  // + entité 'encaissements_manuels' pour les revenus non liés à une livraison
  // (acompte, virement libre, indemnité, etc.).
  M.state.encStatut = 'a_encaisser'; // a_encaisser | encaisse | retard | tous
  M.state.encClient = ''; // filtre client
  M.state.encMoisOuverts = {};
  M.state.encBulkMode = false;
  M.state.encBulkSel = new Set(); // ids de livraisons selectionnees

  // Form encaissement manuel : crée une entrée 'encaissements_manuels'.
  // Champs : date, montant TTC, source/libellé, client (optionnel), notes.
  // Affichée dans la liste à côté des livraisons facturées (mêmes filtres).
  M.formNouvelEncaissement = function(existing) {
    const enEdition = !!existing;
    const e = existing || {};
    const today = new Date().toISOString().slice(0, 10);
    const clients = M.charger('clients').sort((a,b) => (a.nom || '').localeCompare(b.nom || ''));
    const body = `
      ${M.formField('Libellé / Source', M.formInput('libelle', { value: e.libelle || '', placeholder: 'Ex: Acompte client X, virement libre...', required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: e.date || today, required: true }), { required: true })}
        ${M.formField('Montant TTC', M.formInputWithSuffix('montantTtc', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: e.montantTtc || '', required: true }), { required: true })}
      </div>
      ${M.formField('Client (optionnel)', M.formSelect('clientId', clients.map(c => ({ value: c.id, label: ((c.prenom ? c.prenom + ' ' : '') + (c.nom || '')).trim() })), { placeholder: 'Aucun', value: e.clientId || '' }))}
      ${M.formField('Mode de paiement', M.formSelect('modePaiement', [
        { value: '',         label: '—' },
        { value: 'virement', label: 'Virement' },
        { value: 'cb',       label: 'Carte bancaire' },
        { value: 'cheque',   label: 'Chèque' },
        { value: 'especes',  label: 'Espèces' },
        { value: 'autre',    label: 'Autre' }
      ], { value: e.modePaiement || 'virement' }))}
      ${M.formField('Notes', M.formTextarea('notes', { value: e.notes || '', rows: 2, placeholder: 'Remarques (référence, motif...)' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cet encaissement</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier encaissement' : '💵 Nouvel encaissement',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm('Supprimer définitivement cet encaissement ?', { titre: 'Supprimer encaissement' })) return;
          M.sauvegarder('encaissements_manuels', M.charger('encaissements_manuels').filter(x => x.id !== e.id));
          M.ajouterAudit?.('Suppression encaissement manuel', e.libelle || '');
          M.toast('🗑️ Encaissement supprimé');
          M.closeSheet();
          M.go('encaissement');
        });
      },
      onSubmit() {
        const f = M.lireFormSheet();
        if (!f.libelle?.trim()) { M.toast('⚠️ Libellé requis'); return false; }
        if (!f.date) { M.toast('⚠️ Date requise'); return false; }
        const montant = M.parseNum(f.montantTtc) || 0;
        if (montant <= 0) { M.toast('⚠️ Montant > 0 requis'); return false; }
        const cli = f.clientId ? clients.find(c => c.id === f.clientId) : null;
        const arr = M.charger('encaissements_manuels');
        const data = {
          libelle: f.libelle.trim(),
          date: f.date,
          montantTtc: montant,
          clientId: f.clientId || '',
          clientNom: cli ? ((cli.prenom ? cli.prenom + ' ' : '') + (cli.nom || '')).trim() : '',
          modePaiement: f.modePaiement || 'virement',
          notes: f.notes?.trim() || '',
          // statut systématiquement encaissé (raison d'être de cette entité)
          statutPaiement: 'payé',
          datePaiement: f.date
        };
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === e.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('encaissements_manuels', arr);
          M.toast('✅ Encaissement modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('encaissements_manuels', arr);
          M.ajouterAudit?.('Nouvel encaissement manuel', data.libelle + ' · ' + M.format$(montant));
          M.toast('✅ Encaissement enregistré');
        }
        M.go('encaissement');
        return true;
      }
    });
  };
  M.editerEncaissement = function(id) {
    const e = M.charger('encaissements_manuels').find(x => x.id === id);
    if (!e) return M.toast('Encaissement introuvable');
    M.formNouvelEncaissement(e);
  };

  M.register('encaissement', {
    title: 'Encaissement',
    render() {
      const livraisons = M.charger('livraisons');
      const encaissementsManuels = M.charger('encaissements_manuels');
      const filtreStatut = M.state.encStatut;
      const filtreClient = M.state.encClient;

      // Annote chaque livraison avec son statut effectif
      const livAnnotees = livraisons.map(l => {
        const ttc = M.parseNum(l.prixTTC) || M.parseNum(l.prix) || 0;
        const ht = M.parseNum(l.prixHT) || M.parseNum(l.prix) || 0;
        const statut = l.statutPaiement || 'en-attente';
        const estPaye = statut === 'payé' || statut === 'paye' || statut === 'payee';
        const estLitige = statut === 'litige';
        // Retard : facturee depuis > 30j et non payee
        const refDate = l.dateFacture || l.date;
        const enRetard = !estPaye && !estLitige && refDate &&
          (new Date(refDate) < new Date(Date.now() - 30*86400000));
        return { ...l, _ttc: ttc, _ht: ht, _statut: statut, _paye: estPaye, _litige: estLitige, _retard: enRetard, _isManual: false };
      });

      // Annote les encaissements manuels (toujours payés, jamais en retard ni litige)
      const encManAnnotes = encaissementsManuels.map(e => ({
        ...e,
        client: e.clientNom || e.libelle,
        _ttc: M.parseNum(e.montantTtc) || 0,
        _ht: M.parseNum(e.montantTtc) || 0,
        _statut: 'payé',
        _paye: true,
        _litige: false,
        _retard: false,
        _isManual: true
      }));

      // Combine : pour le filtre, les encaissements manuels apparaissent
      // SEULEMENT dans 'encaisse' et 'tous'. Pas dans 'a_encaisser'/'retard'/'litige'.
      const livAnnoteesAll = livAnnotees.concat(encManAnnotes);

      // KPI globaux (mois en cours pour "encaisse")
      const moisCle = M.moisKey();
      const totalAEncaisser = livAnnotees.filter(l => !l._paye && !l._litige).reduce((s, l) => s + l._ttc, 0);
      const totalEncaisseMois = livAnnoteesAll.filter(l => l._paye && (l.datePaiement || '').startsWith(moisCle)).reduce((s, l) => s + l._ttc, 0);
      const totalRetard = livAnnotees.filter(l => l._retard).reduce((s, l) => s + l._ttc, 0);
      const totalLitige = livAnnotees.filter(l => l._litige).reduce((s, l) => s + l._ttc, 0);
      const nbAEncaisser = livAnnotees.filter(l => !l._paye && !l._litige).length;
      const nbRetard = livAnnotees.filter(l => l._retard).length;

      // Liste filtree : encaissements manuels apparaissent uniquement dans
      // 'encaisse' et 'tous' (jamais dans à encaisser/retard/litige).
      let filtered;
      if (filtreStatut === 'encaisse') filtered = livAnnoteesAll.filter(l => l._paye);
      else if (filtreStatut === 'tous') filtered = livAnnoteesAll;
      else if (filtreStatut === 'a_encaisser') filtered = livAnnotees.filter(l => !l._paye && !l._litige);
      else if (filtreStatut === 'retard') filtered = livAnnotees.filter(l => l._retard);
      else if (filtreStatut === 'litige') filtered = livAnnotees.filter(l => l._litige);
      else filtered = livAnnotees;
      if (filtreClient) filtered = filtered.filter(l => (l.client || '') === filtreClient);

      // Group par mois (date facturation, ou date paiement si paye)
      const groupes = {};
      filtered.sort((a, b) => (b.dateFacture || b.date || '').localeCompare(a.dateFacture || a.date || ''))
        .forEach(l => {
          const refDate = l.dateFacture || l.date || l.datePaiement || '';
          const mois = (refDate || '').slice(0, 7);
          if (!groupes[mois]) groupes[mois] = [];
          groupes[mois].push(l);
        });

      // Liste clients pour filtre
      const clients = [...new Set(livAnnotees.map(l => l.client).filter(Boolean))].sort();

      const bulkOn = M.state.encBulkMode;
      const selSet = M.state.encBulkSel;
      const selTotal = filtered.filter(l => selSet.has(l.id)).reduce((s, l) => s + l._ttc, 0);
      const selCount = filtered.filter(l => selSet.has(l.id)).length;

      let html = `
        ${!bulkOn ? `<button class="m-fab" onclick="MCAm.formNouvelEncaissement()" aria-label="Nouvel encaissement">+</button>
          <button class="m-fab m-fab-secondary" id="m-enc-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>` : `
          <div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:12px 14px;margin-bottom:14px;display:flex;gap:8px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.15)">
            <div style="flex:1 1 auto;font-size:.92rem">
              <strong>${selCount}</strong> sélectionnée${selCount>1?'s':''}
              ${selCount > 0 ? `<span style="color:var(--m-text-muted);font-size:.78rem;margin-left:6px">${M.format$(selTotal)}</span>` : ''}
            </div>
            ${selCount > 0 ? `<button type="button" id="m-enc-bulk-pay" class="m-btn m-btn-primary" style="width:auto;padding:0 12px;height:38px;font-size:.78rem">💵 Tout encaisser</button>` : ''}
            <button type="button" id="m-enc-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:38px;font-size:.78rem">✕</button>
          </div>
        `}

        <div class="m-card-row">
          <div class="m-card m-card-accent">
            <div class="m-card-title">À encaisser</div>
            <div class="m-card-value">${M.format$(totalAEncaisser)}</div>
            <div class="m-card-sub">${nbAEncaisser} livraison${nbAEncaisser>1?'s':''}</div>
          </div>
          <div class="m-card m-card-green">
            <div class="m-card-title">Encaissé ce mois</div>
            <div class="m-card-value">${M.format$(totalEncaisseMois)}</div>
            <div class="m-card-sub">paiements reçus</div>
          </div>
        </div>

        ${totalRetard > 0 ? `<div class="m-card m-card-red m-card-pressable" onclick="MCAm.setEncStatut('retard')" style="margin-bottom:14px;border-left:4px solid var(--m-red)">
          <div class="m-card-title">🔴 En retard (>30j)</div>
          <div class="m-card-value" style="color:var(--m-red)">${M.format$(totalRetard)}</div>
          <div class="m-card-sub">${nbRetard} facture${nbRetard>1?'s':''} — Tap pour voir</div>
        </div>` : ''}

        <div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${filtreStatut==='a_encaisser'?'active':''}" data-statut="a_encaisser">⏳ À encaisser (${nbAEncaisser})</button>
          <button class="m-alertes-chip ${filtreStatut==='retard'?'active':''}" data-statut="retard">🔴 Retard (${nbRetard})</button>
          <button class="m-alertes-chip ${filtreStatut==='encaisse'?'active':''}" data-statut="encaisse">✅ Encaissé</button>
          <button class="m-alertes-chip ${filtreStatut==='litige'?'active':''}" data-statut="litige">⚠️ Litige${totalLitige > 0 ? ` (${M.format$(totalLitige)})` : ''}</button>
          <button class="m-alertes-chip ${filtreStatut==='tous'?'active':''}" data-statut="tous">Tous</button>
        </div>

        ${clients.length > 1 ? `
          <div style="margin-bottom:14px">
            <select id="m-enc-client" style="width:100%">
              <option value="">— Tous les clients —</option>
              ${clients.map(c => `<option value="${M.escHtml(c)}" ${c === filtreClient ? 'selected' : ''}>${M.escHtml(c)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      `;

      const moisCles = Object.keys(groupes).sort().reverse();
      if (!moisCles.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">💵</div><h3 class="m-empty-title">Aucune facture</h3><p class="m-empty-text">${filtreStatut === 'encaisse' ? 'Aucun encaissement enregistré.' : filtreStatut === 'retard' ? 'Aucune facture en retard 🎉' : 'Aucune livraison à encaisser.'}</p></div>`;
        return html;
      }

      moisCles.forEach(month => {
        const items = groupes[month];
        const totalMois = items.reduce((s, l) => s + l._ttc, 0);
        const isOpen = M.state.encMoisOuverts[month] !== false; // ouvert par defaut
        const dateAffichee = month
          ? new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())
          : 'Sans date';

        html += `
          <div class="m-section" style="margin-top:14px">
            <button type="button" class="m-card m-card-pressable" data-mois="${M.escHtml(month)}" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px 16px;text-align:left;color:inherit;font-family:inherit">
              <span style="font-weight:600">${dateAffichee} <span style="color:var(--m-text-muted);font-weight:400;font-size:.78rem">(${items.length})</span></span>
              <span style="display:flex;gap:10px;align-items:center">
                <span style="font-weight:700;color:var(--m-green)">${M.format$(totalMois)}</span>
                <span style="color:var(--m-text-muted);font-size:1.1rem">${isOpen ? '▾' : '▸'}</span>
              </span>
            </button>
            <div data-content="${M.escHtml(month)}" style="display:${isOpen ? 'block' : 'none'}">
              ${items.map(l => {
                const couleur = l._paye ? 'var(--m-green)' : l._litige ? 'var(--m-red)' : l._retard ? 'var(--m-red)' : 'var(--m-accent)';
                const statutLabel = l._isManual ? '💵 Manuel' : l._paye ? '✅ Payé' : l._litige ? '⚠️ Litige' : l._retard ? '🔴 Retard' : '⏳ À encaisser';
                const datePaiementAff = l.datePaiement ? M.formatDate(l.datePaiement) : '';
                // Encaissement manuel : pas de bouton annuler (toujours payé), pas de bouton marquer
                let actionBtn;
                if (l._isManual) {
                  actionBtn = `<div style="font-size:.7rem;color:var(--m-green);font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:.04em">${statutLabel}${datePaiementAff ? ' · ' + datePaiementAff : ''}</div>`;
                } else if (!l._paye) {
                  actionBtn = `<button type="button" class="m-enc-pay" data-id="${M.escHtml(l.id)}" style="margin-top:6px;background:rgba(46,204,113,0.12);color:var(--m-green);border:1px solid rgba(46,204,113,0.3);border-radius:6px;padding:4px 10px;font-size:.72rem;font-weight:700;font-family:inherit;cursor:pointer">💵 Marquer encaissé</button>`;
                } else {
                  actionBtn = `<div style="font-size:.7rem;color:${couleur};font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:.04em">${statutLabel}${datePaiementAff ? ' · ' + datePaiementAff : ''}</div>
                     <button type="button" class="m-enc-revert" data-id="${M.escHtml(l.id)}" style="margin-top:6px;background:rgba(231,76,60,0.10);color:var(--m-red);border:1px solid rgba(231,76,60,0.3);border-radius:6px;padding:4px 10px;font-size:.7rem;font-weight:600;font-family:inherit;cursor:pointer">↶ Annuler</button>`;
                }
                const isSel = selSet.has(l.id);
                // Encaissement manuel : pas de checkbox bulk (toujours payé) + classe spécifique
                const checkbox = bulkOn && !l._paye && !l._isManual
                  ? `<div style="flex:0 0 28px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>`
                  : '';
                const cardClass = l._isManual
                  ? 'm-enc-edit-manual'
                  : (bulkOn && !l._paye ? 'm-enc-toggle' : 'm-enc-edit');
                const cardStyle = bulkOn && !l._paye && isSel && !l._isManual
                  ? `background:var(--m-accent-soft);border-color:var(--m-accent)`
                  : `background:var(--m-card);border-top:1px solid var(--m-border);border-right:1px solid var(--m-border);border-bottom:1px solid var(--m-border)`;
                return `<div style="position:relative;margin-bottom:10px">
                  <div role="button" tabindex="0" class="m-card m-card-pressable ${cardClass}" data-id="${M.escHtml(l.id)}" style="padding:14px;border-left:4px solid ${couleur};display:flex;align-items:start;gap:10px;width:100%;${cardStyle};border-radius:18px;cursor:pointer">
                    ${checkbox}
                    <div style="flex:1 1 auto;min-width:0">
                      <div style="font-weight:600;font-size:.95rem;margin-bottom:3px">${M.escHtml(l.client || '—')}${l.numLiv ? ' · ' + M.escHtml(l.numLiv) : ''}</div>
                      <div style="color:var(--m-text-muted);font-size:.8rem">${M.formatDate(l.dateFacture || l.date)}${l.distance ? ' · ' + M.formatNum(l.distance) + ' km' : ''}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <div style="font-weight:700;white-space:nowrap;font-size:.95rem">${M.format$(l._ttc)}</div>
                      ${bulkOn ? '' : actionBtn}
                    </div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
        `;
      });

      return html;
    },
    afterRender(container) {
      // Filtres statut
      container.querySelectorAll('button[data-statut]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.encStatut = btn.dataset.statut; M.go('encaissement'); });
      });
      // Filtre client
      container.querySelector('#m-enc-client')?.addEventListener('change', e => {
        M.state.encClient = e.target.value;
        M.go('encaissement');
      });
      // Toggle mois
      container.querySelectorAll('button[data-mois]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mois = btn.dataset.mois;
          M.state.encMoisOuverts[mois] = !(M.state.encMoisOuverts[mois] !== false);
          M.go('encaissement');
        });
      });
      // Tap card livraison -> ouvre form edition livraison (mode normal)
      container.querySelectorAll('.m-enc-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerLivraison(btn.dataset.id));
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.editerLivraison(btn.dataset.id); }
        });
      });
      // Tap card encaissement manuel -> ouvre form encaissement
      container.querySelectorAll('.m-enc-edit-manual').forEach(btn => {
        btn.addEventListener('click', () => M.editerEncaissement(btn.dataset.id));
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.editerEncaissement(btn.dataset.id); }
        });
      });
      // Tap card en mode bulk -> toggle selection
      container.querySelectorAll('.m-enc-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.encBulkSel.has(id)) M.state.encBulkSel.delete(id);
          else M.state.encBulkSel.add(id);
          M.go('encaissement');
        });
      });
      // Activer mode bulk
      container.querySelector('#m-enc-bulk-on')?.addEventListener('click', () => {
        M.state.encBulkMode = true;
        M.state.encBulkSel.clear();
        M.go('encaissement');
      });
      // Quitter mode bulk
      container.querySelector('#m-enc-bulk-exit')?.addEventListener('click', () => {
        M.state.encBulkMode = false;
        M.state.encBulkSel.clear();
        M.go('encaissement');
      });
      // Bulk action : tout encaisser (avec date picker)
      container.querySelector('#m-enc-bulk-pay')?.addEventListener('click', async () => {
        const ids = [...M.state.encBulkSel];
        if (!ids.length) return;
        const res = await M.dialogChoisirDate({
          titre: `💵 Encaisser ${ids.length} facture${ids.length>1?'s':''}`,
          sousTitre: `Total ${M.format$(filtered.filter(l => M.state.encBulkSel.has(l.id)).reduce((s, l) => s + l._ttc, 0))}. Choisis la date de paiement réelle.`,
          labelDate: 'Date de paiement',
          btnOk: '💵 Confirmer encaissement'
        });
        if (!res) return;
        const arr = M.charger('livraisons');
        const now = new Date().toISOString();
        let n = 0;
        ids.forEach(id => {
          const idx = arr.findIndex(x => x.id === id);
          if (idx < 0) return;
          arr[idx].statutPaiement = 'payé';
          arr[idx].datePaiement = res.date;
          arr[idx].modifieLe = now;
          n++;
        });
        M.sauvegarder('livraisons', arr);
        M.state.encBulkSel.clear();
        M.state.encBulkMode = false;
        M.toast(`💵 ${n} encaissement${n>1?'s':''} au ${M.formatDate(res.date)}`);
        M.go('encaissement');
      });
      // Bouton "Marquer encaissé" rapide (mode normal) -> ouvre date picker
      container.querySelectorAll('.m-enc-pay').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const id = btn.dataset.id;
          const arr = M.charger('livraisons');
          const idx = arr.findIndex(x => x.id === id);
          if (idx < 0) return;
          const liv = arr[idx];
          const res = await M.dialogChoisirDate({
            titre: '💵 Marquer encaissée',
            sousTitre: `${liv.client || 'Livraison'} · ${M.format$(M.parseNum(liv.prixTTC) || M.parseNum(liv.prix) || 0)}`,
            labelDate: 'Date de paiement',
            btnOk: '💵 Confirmer'
          });
          if (!res) return;
          arr[idx].statutPaiement = 'payé';
          arr[idx].datePaiement = res.date;
          arr[idx].modifieLe = new Date().toISOString();
          M.sauvegarder('livraisons', arr);
          M.toast(`💵 Encaissement au ${M.formatDate(res.date)}`);
          M.go('encaissement');
        });
      });
      // Bouton "Annuler encaissement" (sur livraison déjà payée)
      container.querySelectorAll('.m-enc-revert').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const id = btn.dataset.id;
          const arr = M.charger('livraisons');
          const idx = arr.findIndex(x => x.id === id);
          if (idx < 0) return;
          const liv = arr[idx];
          if (!await M.confirm(`Annuler l'encaissement de ${liv.client || 'cette facture'} ? Elle repassera en "À encaisser".`, { titre: 'Annuler encaissement' })) return;
          arr[idx].statutPaiement = 'en-attente';
          delete arr[idx].datePaiement;
          arr[idx].modifieLe = new Date().toISOString();
          M.sauvegarder('livraisons', arr);
          M.toast('↶ Encaissement annulé');
          M.go('encaissement');
        });
      });
    }
  });
  // Helper exposé pour le tap sur la card "En retard"
  M.setEncStatut = function(s) { M.state.encStatut = s; M.go('encaissement'); };

  // ---------- Charges (v3.0 : groupees par mois + filtre statut) ----------
  M.state.chargesStatut = 'tous'; // tous | a_payer | paye
  M.state.chargesBulkMode = false;
  M.state.chargesBulkSel = new Set();
  M.state.chargesCategorie = ''; // '' = toutes
  M.state.chargesFournisseur = ''; // '' = tous
  M.state.chargesMoisOuverts = {};
  M.register('charges', {
    title: 'Charges',
    render() {
      const charges = M.charger('charges');
      const moisCourant = M.moisKey();
      const courantes = charges.filter(c => (c.date || '').startsWith(moisCourant));
      const totalMois = courantes.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
      const aPayer = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      const totalImpayes = aPayer.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);

      const statut = M.state.chargesStatut;
      const cat = M.state.chargesCategorie;
      const fourFilter = M.state.chargesFournisseur || '';
      let filtered = charges;
      if (cat) filtered = filtered.filter(c => (c.categorie || '') === cat);
      if (fourFilter) filtered = filtered.filter(c => (c.fournisseurId === fourFilter) || ((c.fournisseur || '').toLowerCase() === fourFilter.toLowerCase()));
      if (statut === 'a_payer') filtered = filtered.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      if (statut === 'paye')    filtered = filtered.filter(c => c.statut === 'paye' || c.statut === 'payee');

      const sorted = [...filtered].sort((a,b) => (b.date||'').localeCompare(a.date||''));

      const bulkOn = M.state.chargesBulkMode;
      const selSet = M.state.chargesBulkSel;
      const selItems = sorted.filter(c => selSet.has(c.id));
      const selCount = selItems.length;
      const selTotal = selItems.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);

      let html = bulkOn ? '' : `<button class="m-fab" onclick="MCAm.formNouvelleCharge()" aria-label="Nouvelle charge">+</button>
        <button class="m-fab m-fab-secondary" id="m-charges-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>`;

      if (bulkOn) {
        html += `<div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:10px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,.15)">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:${selCount>0?'10px':'0'}">
            <div style="flex:1 1 auto;font-size:.92rem"><strong>${selCount}</strong> sélectionnée${selCount>1?'s':''}${selCount > 0 ? ` · ${M.format$(selTotal)}` : ''}</div>
            <button type="button" id="m-charges-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:36px;font-size:.78rem">✕</button>
          </div>
          ${selCount > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="m-charges-bulk-action m-btn" data-action="paye" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem;background:rgba(46,204,113,0.12);color:var(--m-green);border:1px solid rgba(46,204,113,0.3)">✅ Marquer payée</button>
            <button type="button" class="m-charges-bulk-action m-btn m-btn-danger" data-action="delete" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem">🗑️ Supprimer</button>
          </div>` : ''}
        </div>`;
      }
      html += `
        <div class="m-card-row">
          <div class="m-card m-card-red">
            <div class="m-card-title">Impayés</div>
            <div class="m-card-value">${M.format$(totalImpayes)}</div>
            <div class="m-card-sub">${M.formatNum(aPayer.length)} charge${aPayer.length>1?'s':''}</div>
          </div>
          <div class="m-card m-card-accent">
            <div class="m-card-title">Total mois</div>
            <div class="m-card-value">${M.format$(totalMois)}</div>
            <div class="m-card-sub">${M.formatNum(courantes.length)} entrée${courantes.length>1?'s':''}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin:16px 0 8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${statut==='tous'?'active':''}" data-statut="tous">📋 Toutes</button>
          <button class="m-alertes-chip ${statut==='a_payer'?'active':''}" data-statut="a_payer">⚠️ À payer${aPayer.length?` (${aPayer.length})`:''}</button>
          <button class="m-alertes-chip ${statut==='paye'?'active':''}" data-statut="paye">✅ Payées</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip m-charges-cat ${cat===''?'active':''}" data-cat="">Toutes catégories</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='carburant'?'active':''}" data-cat="carburant">⛽ Carburant</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='peage'?'active':''}" data-cat="peage">🛣️ Péage</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='entretien'?'active':''}" data-cat="entretien">🔧 Entretien</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='assurance'?'active':''}" data-cat="assurance">🛡️ Assurance</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='salaires'?'active':''}" data-cat="salaires">👥 Salaires</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='lld_credit'?'active':''}" data-cat="lld_credit">🚐 LLD/Crédit</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='tva'?'active':''}" data-cat="tva">🧾 TVA</button>
          <button class="m-alertes-chip m-charges-cat ${cat==='autre'?'active':''}" data-cat="autre">📝 Autre</button>
        </div>
      `;
      // Filtre fournisseur (alignement PC)
      const fournisseurs = M.charger('fournisseurs');
      if (fournisseurs.length) {
        html += `<div style="margin-bottom:14px"><select id="m-charges-four">
          <option value="">🏭 Tous fournisseurs</option>
          ${fournisseurs.sort((a,b)=>(a.nom||'').localeCompare(b.nom||'')).map(f => `<option value="${M.escHtml(f.id)}" ${fourFilter===f.id?'selected':''}>${M.escHtml(f.nom||f.id)}</option>`).join('')}
        </select></div>`;
      }

      if (!sorted.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">💸</div><h3 class="m-empty-title">Aucune charge</h3><p class="m-empty-text">${statut === 'a_payer' ? 'Tu es à jour, aucune charge en attente.' : 'Tape sur ➕ pour saisir ta première charge.'}</p></div>`;
        return html;
      }

      // Group par mois (mois courant ouvert par defaut, autres collapses)
      const byMonth = {};
      sorted.forEach(c => {
        const m = (c.date || '0000-00').slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(c);
      });
      const monthsSorted = Object.keys(byMonth).sort().reverse();

      monthsSorted.forEach(month => {
        const items = byMonth[month];
        const totalMonth = items.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
        const aPayerMonth = items.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
        const totalAPayerMonth = aPayerMonth.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
        const dateLabel = month === '0000-00' ? 'Sans date' : (() => {
          const [y, m] = month.split('-');
          return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        })();
        const isOpen = M.state.chargesMoisOuverts[month] !== undefined ? M.state.chargesMoisOuverts[month] : (month === moisCourant);

        html += `
          <div class="m-section" style="margin-top:18px">
            <button type="button" class="m-charges-mois" data-mois="${M.escHtml(month)}" style="width:100%;background:transparent;border:none;color:inherit;text-align:left;cursor:pointer;padding:0 4px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
              <span style="display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0">
                <span style="color:var(--m-text-muted);font-size:.9rem;display:inline-block;transform:rotate(${isOpen ? '90' : '0'}deg);transition:transform 0.15s ease">▶</span>
                <h3 class="m-section-title" style="font-size:1rem">${dateLabel}</h3>
              </span>
              <span style="text-align:right;font-size:.78rem;color:var(--m-text-muted);font-weight:500">
                <div>${items.length} charge${items.length>1?'s':''}</div>
                <div style="color:${aPayerMonth.length ? 'var(--m-red)' : 'var(--m-green)'};font-weight:600;margin-top:2px">${aPayerMonth.length ? `${M.format$(totalAPayerMonth)} dû` : M.format$(totalMonth)}</div>
              </span>
            </button>
            <div data-content="${M.escHtml(month)}" style="display:${isOpen ? 'block' : 'none'}">
              ${items.map(c => {
                const montant = M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0;
                const estPayee = c.statut === 'paye' || c.statut === 'payee';
                const estPartielle = c.statut === 'partiel';
                const enRetard = !estPayee && c.date && (new Date(c.date) < new Date(Date.now() - 7*86400000));
                const statutLabel = estPayee ? '✅ Payée' : estPartielle ? '🟡 Partielle' : (enRetard ? '🔴 Retard' : '⏳ À payer');
                const statutColor = estPayee ? 'var(--m-green)' : estPartielle ? 'var(--m-accent)' : (enRetard ? 'var(--m-red)' : 'var(--m-text-muted)');
                const borderColor = estPayee ? 'var(--m-green)' : (enRetard ? 'var(--m-red)' : 'var(--m-accent)');
                // Si pas payee, le badge statut devient un bouton "Marquer payee" (stopPropagation pour ne pas declencher l'edit)
                const statutBadge = estPayee
                  ? `<div style="font-size:.7rem;color:${statutColor};font-weight:600;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${statutLabel}</div>`
                  : `<button type="button" class="m-charge-pay" data-id="${M.escHtml(c.id)}" style="margin-top:4px;background:rgba(46,204,113,0.12);color:var(--m-green);border:1px solid rgba(46,204,113,0.3);border-radius:6px;padding:3px 8px;font-size:.7rem;font-weight:700;font-family:inherit;cursor:pointer">✅ Marquer payée</button>`;
                const isSel = selSet.has(c.id);
                const cardClass = bulkOn ? 'm-charges-toggle' : 'm-charge-edit';
                const cardBg = bulkOn && isSel ? 'background:var(--m-accent-soft);border-color:var(--m-accent)'
                  : 'background:var(--m-card);border-top:1px solid var(--m-border);border-right:1px solid var(--m-border);border-bottom:1px solid var(--m-border)';
                const checkbox = bulkOn ? `<div style="flex:0 0 28px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>` : '';
                return `<div style="position:relative;margin-bottom:10px">
                  <div role="button" tabindex="0" class="m-card m-card-pressable ${cardClass}" data-id="${M.escHtml(c.id)}" style="padding:14px;border-left:4px solid ${borderColor};display:flex;align-items:start;gap:10px;width:100%;text-align:left;${cardBg};border-radius:18px;color:inherit;font-family:inherit;cursor:pointer">
                    ${checkbox}
                    <div style="flex:1 1 auto;min-width:0">
                      <div style="font-weight:600;font-size:.95rem;margin-bottom:3px">${M.escHtml(c.libelle || c.fournisseur || 'Charge')}</div>
                      <div style="color:var(--m-text-muted);font-size:.8rem">${M.formatDate(c.date)}${c.fournisseur && c.libelle ? ' · ' + M.escHtml(c.fournisseur) : ''}${c.categorie ? ' · ' + M.escHtml(c.categorie) : ''}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <div style="font-weight:700;white-space:nowrap;font-size:.95rem">${M.format$(montant)}</div>
                      ${bulkOn ? '' : statutBadge}
                    </div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
        `;
      });

      return html;
    },
    afterRender(container) {
      // Chips statut (data-statut)
      container.querySelectorAll('.m-alertes-chip[data-statut]').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.chargesStatut = btn.dataset.statut;
          M.go('charges');
        });
      });
      // Chips categorie (data-cat)
      container.querySelectorAll('.m-charges-cat').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.chargesCategorie = btn.dataset.cat;
          M.go('charges');
        });
      });
      // Select fournisseur
      container.querySelector('#m-charges-four')?.addEventListener('change', e => {
        M.state.chargesFournisseur = e.target.value;
        M.go('charges');
      });
      // Tap card charge -> ouvre le form en mode edition. Card est <div role=button>
      // (pas <button>) pour permettre le bouton "Marquer payee" imbrique.
      container.querySelectorAll('.m-charge-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerCharge(btn.dataset.id));
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.editerCharge(btn.dataset.id); }
        });
      });
      // Bulk mode : toggle / enter / exit / actions
      container.querySelectorAll('.m-charges-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.chargesBulkSel.has(id)) M.state.chargesBulkSel.delete(id);
          else M.state.chargesBulkSel.add(id);
          M.go('charges');
        });
      });
      container.querySelector('#m-charges-bulk-on')?.addEventListener('click', () => {
        M.state.chargesBulkMode = true; M.state.chargesBulkSel.clear(); M.go('charges');
      });
      container.querySelector('#m-charges-bulk-exit')?.addEventListener('click', () => {
        M.state.chargesBulkMode = false; M.state.chargesBulkSel.clear(); M.go('charges');
      });
      container.querySelectorAll('.m-charges-bulk-action').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const ids = [...M.state.chargesBulkSel];
          if (!ids.length) return;
          if (action === 'delete') {
            if (!await M.confirm(`Supprimer ${ids.length} charge${ids.length>1?'s':''} ? (cascade plein/entretien lié si applicable)`, { titre: 'Suppression en lot' })) return;
            const arr = M.charger('charges');
            const aSuppr = arr.filter(c => ids.includes(c.id));
            // Cascade : supprime aussi les pleins/entretiens liés
            const pleinIds = aSuppr.map(c => c.carburantId).filter(Boolean);
            const entIds = aSuppr.map(c => c.entretienId).filter(Boolean);
            M.sauvegarder('charges', arr.filter(c => !ids.includes(c.id)));
            if (pleinIds.length) M.sauvegarder('carburant', M.charger('carburant').filter(p => !pleinIds.includes(p.id)));
            if (entIds.length) M.sauvegarder('entretiens', M.charger('entretiens').filter(e => !entIds.includes(e.id)));
            M.toast(`🗑️ ${ids.length} charge${ids.length>1?'s':''} supprimée${ids.length>1?'s':''}`);
          } else if (action === 'paye') {
            const res = await M.dialogChoisirDate({ titre: `✅ Marquer ${ids.length} charge${ids.length>1?'s':''} payée${ids.length>1?'s':''}`, labelDate: 'Date de paiement', btnOk: '✅ Confirmer' });
            if (!res) return;
            const arr = M.charger('charges');
            ids.forEach(id => {
              const idx = arr.findIndex(x => x.id === id);
              if (idx >= 0) { arr[idx].statut = 'paye'; arr[idx].statutPaiement = 'paye'; arr[idx].datePaiement = res.date; arr[idx].modifieLe = new Date().toISOString(); }
            });
            M.sauvegarder('charges', arr);
            M.toast(`✅ ${ids.length} charge${ids.length>1?'s':''} marquée${ids.length>1?'s':''} payée${ids.length>1?'s':''}`);
          }
          M.state.chargesBulkSel.clear();
          M.state.chargesBulkMode = false;
          M.go('charges');
        });
      });
      // Bouton "Marquer payée" rapide (stopPropagation pour ne pas declencher l'edit)
      container.querySelectorAll('.m-charge-pay').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const id = btn.dataset.id;
          const arr = M.charger('charges');
          const idx = arr.findIndex(x => x.id === id);
          if (idx < 0) return;
          arr[idx].statut = 'paye';
          arr[idx].statutPaiement = 'paye';
          arr[idx].datePaiement = new Date().toISOString().slice(0, 10);
          arr[idx].modifieLe = new Date().toISOString();
          M.sauvegarder('charges', arr);
          M.toast('✅ Charge marquée payée');
          M.go('charges');
        });
      });
      // Toggle collapse/expand par mois
      container.querySelectorAll('button.m-charges-mois').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = btn.dataset.mois;
          const c = container.querySelector(`[data-content="${m}"]`);
          const ch = btn.querySelector('span > span');
          if (!c) return;
          const willOpen = c.style.display === 'none';
          M.state.chargesMoisOuverts[m] = willOpen;
          c.style.display = willOpen ? 'block' : 'none';
          if (ch) ch.style.transform = `rotate(${willOpen ? '90' : '0'}deg)`;
        });
      });
    }
  });
  // ---------- Rentabilite v3.7 : 4 sous-onglets (Global / Vehicule / Client / Chauffeur) ----------
  M.state.rentMois = M.moisKey();
  M.state.rentMoisManuel = false;
  M.state.rentTab = 'global';

  M.register('rentabilite', {
    title: 'Rentabilité',
    render() {
      const livraisons = M.charger('livraisons');
      const carburant  = M.charger('carburant');
      const entretiens = M.charger('entretiens');
      const charges    = M.charger('charges');
      const vehicules  = M.charger('vehicules').filter(v => v && !v.archive);
      const salaries   = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');

      // Auto-refresh mois courant (cf. fix v3.57 sur Heures)
      if (!M.state.rentMoisManuel) M.state.rentMois = M.moisKey();
      const moisSel = M.state.rentMois;
      const tab     = M.state.rentTab;
      const inMois  = (date) => (date || '').startsWith(moisSel);

      const livMois     = livraisons.filter(l => inMois(l.date));
      const carbMois    = carburant.filter(p => inMois(p.date));
      const entrMois    = entretiens.filter(e => inMois(e.date));
      const chargesMois = charges.filter(c => inMois(c.date) && c.categorie !== 'entretien');

      // KPI globaux du mois (utilises pour le coverage et le cout/km de reference)
      const caTotal = livMois.reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
      const kmTotal = livMois.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
      const carbTotal    = carbMois.reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
      const entrTotal    = entrMois.reduce((s, e) => s + (M.parseNum(e.cout) || 0), 0);
      const autresTotal  = chargesMois.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
      const depTotal     = carbTotal + entrTotal + autresTotal;
      const profitTotal  = caTotal - depTotal;
      const margeTotal   = caTotal > 0 ? (profitTotal / caTotal * 100) : 0;
      const coutKmRef    = kmTotal > 0 ? depTotal / kmTotal : 0;

      // Selecteur mois
      const moisOptions = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const cle = M.moisKey(d);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      let html = `
        <div style="margin-bottom:14px">
          <select id="m-rent-mois">${moisOptions.join('')}</select>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:18px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${tab==='global'?'active':''}" data-tab="global">📊 Global</button>
          <button class="m-alertes-chip ${tab==='vehicule'?'active':''}" data-tab="vehicule">🚐 Véhicule</button>
          <button class="m-alertes-chip ${tab==='client'?'active':''}" data-tab="client">🧑‍💼 Client</button>
          <button class="m-alertes-chip ${tab==='chauffeur'?'active':''}" data-tab="chauffeur">👤 Chauffeur</button>
          <button class="m-alertes-chip ${tab==='simulateur'?'active':''}" data-tab="simulateur">🧮 Simulateur</button>
        </div>
      `;

      const margeColor = (m) => m >= 20 ? 'var(--m-green)' : m >= 10 ? 'var(--m-accent)' : 'var(--m-red)';

      // ---------- Tab GLOBAL ----------
      if (tab === 'global') {
        const pct = (v) => depTotal > 0 ? Math.round(v / depTotal * 100) : 0;
        const pctCarb = pct(carbTotal), pctEntr = pct(entrTotal), pctAutres = pct(autresTotal);
        html += `
          <div class="m-card-row">
            <div class="m-card m-card-green">
              <div class="m-card-title">Chiffre d'affaires</div>
              <div class="m-card-value">${M.format$(caTotal)}</div>
              <div class="m-card-sub">${livMois.length} liv. · ${M.formatNum(kmTotal)} km</div>
            </div>
            <div class="m-card" style="border-left:4px solid ${margeColor(margeTotal)}">
              <div class="m-card-title">Marge nette</div>
              <div class="m-card-value" style="color:${margeColor(margeTotal)}">${margeTotal.toFixed(1)}%</div>
              <div class="m-card-sub">Profit ${M.format$(profitTotal)}</div>
            </div>
          </div>
          <div class="m-card">
            <div class="m-card-title">Dépenses du mois</div>
            <div class="m-card-value" style="color:var(--m-red)">${M.format$(depTotal)}</div>
            <div class="m-card-sub">${M.format$(coutKmRef)} / km</div>
            ${depTotal > 0 ? `
              <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:14px;background:var(--m-border)">
                <div style="background:rgba(230,126,34,0.85);width:${pctCarb}%"></div>
                <div style="background:rgba(52,152,219,0.85);width:${pctEntr}%"></div>
                <div style="background:rgba(155,89,182,0.85);width:${pctAutres}%"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:10px;gap:8px;flex-wrap:wrap;font-size:.78rem">
                <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:rgba(230,126,34,0.85);border-radius:2px"></span>Carburant ${pctCarb}%</span>
                <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:rgba(52,152,219,0.85);border-radius:2px"></span>Entretien ${pctEntr}%</span>
                <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:rgba(155,89,182,0.85);border-radius:2px"></span>Autres ${pctAutres}%</span>
              </div>
            ` : ''}
          </div>
          <div class="m-card" style="padding:0">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--m-border)"><span style="display:flex;align-items:center;gap:10px"><span>⛽</span><span>Carburant</span></span><span style="font-weight:600">${M.format$(carbTotal)}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--m-border)"><span style="display:flex;align-items:center;gap:10px"><span>🔧</span><span>Entretien</span></span><span style="font-weight:600">${M.format$(entrTotal)}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px"><span style="display:flex;align-items:center;gap:10px"><span>💸</span><span>Autres charges</span></span><span style="font-weight:600">${M.format$(autresTotal)}</span></div>
          </div>
        `;
        return html;
      }

      // ---------- Helper card ligne (pour les 3 sous-onglets analytiques) ----------
      const renderLigne = (titre, sub, ca, dep, marge, km, onClick, icone) => {
        const profit = ca - dep;
        const margePct = ca > 0 ? (profit / ca * 100) : 0;
        const color = margeColor(margePct);
        const action = onClick ? `data-action="${onClick}"` : '';
        const tag = onClick ? 'button' : 'div';
        return `<${tag} type="button" class="m-card m-card-pressable m-rent-row" ${action} style="padding:14px;border-left:4px solid ${color};margin-bottom:10px;display:block;width:100%;text-align:left;background:var(--m-card);border-top:1px solid var(--m-border);border-right:1px solid var(--m-border);border-bottom:1px solid var(--m-border);border-radius:18px;color:inherit;font-family:inherit">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:8px">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:600;font-size:.95rem;display:flex;align-items:center;gap:6px">${icone ? `<span>${icone}</span>` : ''}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(titre)}</span></div>
              ${sub ? `<div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${M.escHtml(sub)}</div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-weight:700;color:${color};font-size:1.1rem">${margePct.toFixed(0)}%</div>
              <div style="font-size:.72rem;color:var(--m-text-muted);text-transform:uppercase;letter-spacing:.04em">marge</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:.78rem;color:var(--m-text-muted);padding-top:8px;border-top:1px solid var(--m-border)">
            <div><span style="color:var(--m-green);font-weight:600">${M.format$(ca)}</span> CA</div>
            <div><span style="color:var(--m-red);font-weight:600">${M.format$(dep)}</span> dép.</div>
            ${km > 0 ? `<div><span style="color:var(--m-text);font-weight:600">${M.formatNum(km)}</span> km</div>` : ''}
          </div>
        </${tag}>`;
      };

      // ---------- Tab PAR VEHICULE ----------
      if (tab === 'vehicule') {
        const stats = vehicules.map(v => {
          // dual-read vehiculeId/vehId (livraisons PC peuvent n'avoir que vehId)
          const matchVeh = (x) => (x.vehiculeId === v.id) || (x.vehId === v.id);
          const livV   = livMois.filter(matchVeh);
          const carbV  = carbMois.filter(matchVeh);
          const entrV  = entrMois.filter(matchVeh);
          const chrgV  = chargesMois.filter(matchVeh);
          const ca   = livV.reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
          const carb = carbV.reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
          const entr = entrV.reduce((s, e) => s + (M.parseNum(e.cout) || 0), 0);
          const chrg = chrgV.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
          const km   = livV.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
          return { v, ca, dep: carb + entr + chrg, km, nbLiv: livV.length };
        }).filter(x => x.ca > 0 || x.dep > 0)
          .sort((a, b) => b.ca - a.ca);

        if (!stats.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">🚐</div><h3 class="m-empty-title">Aucune donnée</h3><p class="m-empty-text">Pas d'activité véhicule pour ce mois. Saisis des livraisons rattachées à un véhicule.</p></div>`;
          return html;
        }
        stats.forEach(({ v, ca, dep, km, nbLiv }) => {
          html += renderLigne(v.immat || v.id, `${v.modele || ''}${v.salNom ? ' · ' + v.salNom : ''} · ${nbLiv} liv.`, ca, dep, 0, km, `veh:${v.id}`, '🚐');
        });
      }

      // ---------- Tab PAR CLIENT ----------
      // Pas de coûts directs rattachés -> marge estimée = CA - (km × coût/km flotte)
      if (tab === 'client') {
        const byClient = {};
        livMois.forEach(l => {
          const key = (l.client || '—').trim();
          if (!byClient[key]) byClient[key] = { nom: key, ca: 0, km: 0, nbLiv: 0 };
          byClient[key].ca += M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0;
          byClient[key].km += M.parseNum(l.distance) || 0;
          byClient[key].nbLiv++;
        });
        const stats = Object.values(byClient).sort((a, b) => b.ca - a.ca);

        if (!stats.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">🧑‍💼</div><h3 class="m-empty-title">Aucune donnée</h3><p class="m-empty-text">Pas de livraisons ce mois.</p></div>`;
          return html;
        }
        html += `<p style="font-size:.78rem;color:var(--m-text-muted);margin:0 0 12px;line-height:1.4">💡 Marge estimée = CA - (km × coût/km flotte ${M.format$(coutKmRef)}/km)</p>`;
        stats.forEach(({ nom, ca, km, nbLiv }) => {
          const depEstim = km * coutKmRef;
          const cli = M.findClientByName(nom);
          html += renderLigne(nom, `${nbLiv} livraison${nbLiv > 1 ? 's' : ''}`, ca, depEstim, 0, km, cli ? `cli:${cli.id}` : '', '🧑‍💼');
        });
      }

      // ---------- Tab PAR CHAUFFEUR ----------
      if (tab === 'chauffeur') {
        const stats = salaries.map(s => {
          const livS = livMois.filter(l => l.salarieId === s.id || l.chaufId === s.id);
          const ca = livS.reduce((sum, l) => sum + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
          const km = livS.reduce((sum, l) => sum + (M.parseNum(l.distance) || 0), 0);
          // Carburant rattachable si le chauffeur a un vehicule attribue (via veh.salId)
          const vehAttribues = vehicules.filter(v => v.salId === s.id).map(v => v.id);
          const carbS = carbMois.filter(p => vehAttribues.includes(p.vehiculeId)).reduce((sum, p) => sum + (M.parseNum(p.total) || 0), 0);
          // Estimation : marge = CA - carburant chauffeur - (km × cout autres flotte)
          const depEstim = carbS + (km * (coutKmRef - (kmTotal > 0 ? carbTotal / kmTotal : 0)));
          return { s, ca, dep: depEstim, km, nbLiv: livS.length };
        }).filter(x => x.ca > 0)
          .sort((a, b) => b.ca - a.ca);

        if (!stats.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">👤</div><h3 class="m-empty-title">Aucune donnée</h3><p class="m-empty-text">Pas de livraisons rattachées à un chauffeur ce mois.</p></div>`;
          return html;
        }
        html += `<p style="font-size:.78rem;color:var(--m-text-muted);margin:0 0 12px;line-height:1.4">💡 Marge estimée : CA - carburant chauffeur - autres charges (au prorata des km)</p>`;
        stats.forEach(({ s, ca, dep, km, nbLiv }) => {
          const fullName = `${s.prenom ? s.prenom + ' ' : ''}${s.nom || s.id}`;
          html += renderLigne(fullName, `${s.poste || 'Chauffeur'} · ${nbLiv} livraison${nbLiv > 1 ? 's' : ''}`, ca, dep, 0, km, `sal:${s.id}`, '👤');
        });
      }

      // ---- SIMULATEUR : parite complete avec PC (script-rentabilite.js).
      // Persistance partagee avec PC sur la cle 'rentabilite_calculateur_v2'
      // -> meme config sur les deux plateformes.
      if (tab === 'simulateur') {
        const SIM_KEY = 'rentabilite_calculateur_v2';
        const raw = M.chargerObj(SIM_KEY) || {};
        const cfg = {
          modeCalcul: raw.modeCalcul === 'livraison' ? 'livraison' : 'manuel',
          livraisonId: raw.livraisonId || '',
          repartitionCharges: raw.repartitionCharges === 'prorata' ? 'prorata' : 'mensuel',
          kmJour: M.parseNum(raw.kmJour) || 0,
          prixKm: M.parseNum(raw.prixKm) || 0,
          joursTravailles: M.parseNum(raw.joursTravailles) || 0,
          conso: M.parseNum(raw.conso) || 0,
          prixCarburant: M.parseNum(raw.prixCarburant) || 0,
          lldCredit: M.parseNum(raw.lldCredit) || 0,
          assurance: M.parseNum(raw.assurance) || 0,
          salaireCharge: M.parseNum(raw.salaireCharge) || 0,
          tva: M.parseNum(raw.tva) || 20,
          autresCharges: Array.isArray(raw.autresCharges) ? raw.autresCharges.map(i => ({
            id: i.id || M.genId(),
            label: i.label || '',
            montant: M.parseNum(i.montant) || 0
          })) : []
        };

        // Calcul HT systematique (cf. PC) — pas de melange HT/TTC
        const livAll = M.charger('livraisons');
        const livSel = (cfg.modeCalcul === 'livraison' && cfg.livraisonId)
          ? livAll.find(l => l.id === cfg.livraisonId) : null;
        const isLivMode = cfg.modeCalcul === 'livraison';
        const getMontantHT = (l) => {
          if (!l) return 0;
          if (l.prixHT != null && l.prixHT !== '') return M.parseNum(l.prixHT) || 0;
          const t = M.parseNum(l.tauxTVA) || 20;
          return (M.parseNum(l.prix) || 0) / (1 + t / 100);
        };
        const kmJour = isLivMode ? (M.parseNum(livSel?.distance) || 0) : cfg.kmJour;
        let joursTravailles = Math.max(0, cfg.joursTravailles || 0);
        if (isLivMode && !livSel) joursTravailles = 0;
        const kmTotalSim = kmJour * joursTravailles;
        const caJournalierHT = isLivMode ? (livSel ? getMontantHT(livSel) : 0) : (kmJour * cfg.prixKm);
        const prixKmEff = kmJour > 0 ? caJournalierHT / kmJour : 0;
        const caHT = caJournalierHT * joursTravailles;
        const caTTC = caHT * (1 + cfg.tva / 100);
        const litresMois = kmTotalSim * cfg.conso / 100;
        const coutCarburant = litresMois * cfg.prixCarburant;
        const autresT = cfg.autresCharges.reduce((s, i) => s + (M.parseNum(i.montant) || 0), 0);
        const chargesFixesMensuelles = cfg.lldCredit + cfg.assurance + cfg.salaireCharge + autresT;
        const prorataBlocked = cfg.repartitionCharges === 'prorata' && joursTravailles <= 0;
        const chargesFixes = (cfg.repartitionCharges === 'prorata' && !prorataBlocked)
          ? (chargesFixesMensuelles / 30) * cfg.joursTravailles
          : chargesFixesMensuelles;
        const coutTotalSim = chargesFixes + coutCarburant;
        const beneficeNet = caHT - coutTotalSim;
        const coutParKm = kmTotalSim > 0 ? coutTotalSim / kmTotalSim : 0;
        const margeParKm = kmTotalSim > 0 ? beneficeNet / kmTotalSim : 0;
        const revenuJ = caJournalierHT;
        const coutVarJ = (kmJour * cfg.conso / 100) * cfg.prixCarburant;
        const margeJ = revenuJ - coutVarJ;
        const seuilJours = margeJ > 0 ? chargesFixes / margeJ : null;
        const pointMortCA = seuilJours != null ? seuilJours * revenuJ : null;
        const lldDoublon = cfg.autresCharges.some(i =>
          /(lld|leasing|credit|crédit)/i.test(i.label || '') && (M.parseNum(i.montant) || 0) > 0
        );
        const pristine = !isLivMode && kmJour <= 0 && cfg.prixKm <= 0 && joursTravailles <= 0
          && cfg.conso <= 0 && cfg.prixCarburant <= 0;
        const margeC = beneficeNet >= 0 ? 'var(--m-green)' : 'var(--m-red)';
        const fmtJ = v => (v == null || !isFinite(v)) ? 'Non atteignable' : v.toFixed(2).replace('.', ',') + ' j';

        const livSorted = livAll.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        html += `
          <p style="font-size:.78rem;color:var(--m-text-muted);margin:0 0 14px;line-height:1.4">💡 Simulateur de rentabilité (parité PC). Configure tes hypothèses ou pars d'une livraison existante. Tout est en HT.</p>

          <div class="m-card" style="padding:14px;margin-bottom:12px">
            <div class="m-form-field" style="margin-bottom:10px">
              <label class="m-form-label">Mode de calcul</label>
              <select id="m-sim-mode">
                <option value="manuel" ${cfg.modeCalcul === 'manuel' ? 'selected' : ''}>Manuel (hypothèses)</option>
                <option value="livraison" ${cfg.modeCalcul === 'livraison' ? 'selected' : ''}>Depuis une livraison</option>
              </select>
              <p class="m-form-hint">${isLivMode ? 'Projection mensuelle si tu répètes ce type de livraison.' : 'Simule l\'activité à partir de tes hypothèses.'}</p>
            </div>
            ${isLivMode ? `
              <div class="m-form-field" style="margin-bottom:0">
                <label class="m-form-label">Livraison de référence</label>
                <select id="m-sim-livraison">
                  <option value="">${livSorted.length ? '— Choisir —' : 'Aucune livraison disponible'}</option>
                  ${livSorted.map(l => `<option value="${l.id}" ${l.id === cfg.livraisonId ? 'selected' : ''}>${M.escHtml((l.numLiv || 'Liv') + ' · ' + (l.client || '—') + ' · ' + (l.date || ''))}</option>`).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          <div class="m-card" style="padding:14px;margin-bottom:12px">
            <div style="font-weight:600;margin-bottom:10px">📈 Activité</div>
            <div class="m-form-row">
              <div class="m-form-field">
                <label class="m-form-label">${isLivMode ? 'Distance livraison' : 'Km / jour'}</label>
                <div class="m-form-input-suffix"><input type="number" id="m-sim-km-jour" step="0.1" min="0" value="${kmJour > 0 ? kmJour : ''}" ${isLivMode ? 'readonly' : ''} placeholder="0" /><span class="m-form-input-suffix-text">km</span></div>
              </div>
              <div class="m-form-field">
                <label class="m-form-label">Prix au km HT</label>
                <div class="m-form-input-suffix"><input type="number" id="m-sim-prix-km" step="0.01" min="0" value="${prixKmEff > 0 ? prixKmEff.toFixed(2) : ''}" ${isLivMode ? 'readonly' : ''} placeholder="0.00" /><span class="m-form-input-suffix-text">€/km</span></div>
              </div>
            </div>
            <div class="m-form-field" style="margin-top:8px;margin-bottom:0">
              <label class="m-form-label">${isLivMode ? 'Fréquence mensuelle' : 'Jours travaillés / mois'}</label>
              <input type="number" id="m-sim-jours" step="1" min="0" value="${cfg.joursTravailles > 0 ? cfg.joursTravailles : ''}" placeholder="0" />
              <p class="m-form-hint">${isLivMode ? 'Combien de fois ce type de livraison par mois ?' : 'Nombre de jours réellement travaillés sur la période.'}</p>
            </div>
          </div>

          <div class="m-card" style="padding:14px;margin-bottom:12px">
            <div style="font-weight:600;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
              <span>⛽ Carburant</span>
              <button type="button" id="m-sim-fuel-real" class="m-btn" style="font-size:.72rem;padding:6px 10px">Prix moyen réel</button>
            </div>
            <div class="m-form-row">
              <div class="m-form-field">
                <label class="m-form-label">Consommation</label>
                <div class="m-form-input-suffix"><input type="number" id="m-sim-conso" step="0.1" min="0" value="${cfg.conso > 0 ? cfg.conso : ''}" placeholder="0" /><span class="m-form-input-suffix-text">L/100</span></div>
              </div>
              <div class="m-form-field">
                <label class="m-form-label">Prix carburant</label>
                <div class="m-form-input-suffix"><input type="number" id="m-sim-prix-carb" step="0.01" min="0" value="${cfg.prixCarburant > 0 ? cfg.prixCarburant : ''}" placeholder="0.00" /><span class="m-form-input-suffix-text">€/L</span></div>
              </div>
            </div>
          </div>

          <div class="m-card" style="padding:14px;margin-bottom:12px">
            <div style="font-weight:600;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <span>💸 Charges fixes mensuelles HT</span>
              <div style="display:flex;gap:6px">
                <button type="button" id="m-sim-charges-real" class="m-btn" style="font-size:.7rem;padding:6px 8px">Charges réelles</button>
                <button type="button" id="m-sim-load-veh" class="m-btn" style="font-size:.7rem;padding:6px 8px">Depuis véhicule</button>
              </div>
            </div>
            <div class="m-form-field">
              <label class="m-form-label">LLD / Crédit / Amortissement</label>
              <div class="m-form-input-suffix"><input type="number" id="m-sim-lld" step="0.01" min="0" value="${cfg.lldCredit > 0 ? cfg.lldCredit.toFixed(2) : ''}" placeholder="0.00" /><span class="m-form-input-suffix-text">€/mois</span></div>
            </div>
            <div class="m-form-field">
              <label class="m-form-label">Assurance</label>
              <div class="m-form-input-suffix"><input type="number" id="m-sim-assurance" step="0.01" min="0" value="${cfg.assurance > 0 ? cfg.assurance.toFixed(2) : ''}" placeholder="0.00" /><span class="m-form-input-suffix-text">€/mois</span></div>
            </div>
            <div class="m-form-field">
              <label class="m-form-label">Salaire chargé</label>
              <div class="m-form-input-suffix"><input type="number" id="m-sim-salaire" step="0.01" min="0" value="${cfg.salaireCharge > 0 ? cfg.salaireCharge.toFixed(2) : ''}" placeholder="0.00" /><span class="m-form-input-suffix-text">€/mois</span></div>
            </div>
            <div class="m-form-field">
              <label class="m-form-label">Répartition</label>
              <select id="m-sim-repartition">
                <option value="mensuel" ${cfg.repartitionCharges === 'mensuel' ? 'selected' : ''}>Mensuel (charges pleines)</option>
                <option value="prorata" ${cfg.repartitionCharges === 'prorata' ? 'selected' : ''}>Prorata jours travaillés</option>
              </select>
            </div>
            <div class="m-form-field" style="margin-bottom:0">
              <label class="m-form-label">TVA appliquée</label>
              <div class="m-form-input-suffix"><input type="number" id="m-sim-tva" step="0.5" min="0" value="${cfg.tva}" /><span class="m-form-input-suffix-text">%</span></div>
            </div>
          </div>

          <div class="m-card" style="padding:14px;margin-bottom:12px">
            <div style="font-weight:600;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
              <span>📝 Autres charges mensuelles</span>
              <button type="button" id="m-sim-add-charge" class="m-btn m-btn-primary" style="font-size:.72rem;padding:6px 10px">+ Ajouter</button>
            </div>
            <div id="m-sim-autres-list">
              ${cfg.autresCharges.length === 0
                ? '<p style="font-size:.8rem;color:var(--m-text-muted);margin:0">Aucune charge supplémentaire.</p>'
                : cfg.autresCharges.map(i => `
                  <div class="m-sim-autre-row" data-id="${i.id}" style="display:flex;gap:6px;margin-bottom:8px;align-items:center">
                    <input type="text" class="m-sim-autre-label" data-id="${i.id}" placeholder="Libellé" value="${M.escHtml(i.label || '')}" style="flex:1;min-width:0" />
                    <input type="number" class="m-sim-autre-montant" data-id="${i.id}" step="0.01" min="0" value="${i.montant > 0 ? i.montant : ''}" placeholder="€" style="width:90px" />
                    <button type="button" class="m-btn m-sim-autre-del" data-id="${i.id}" style="padding:6px 10px;font-size:.85rem;color:var(--m-red)">×</button>
                  </div>
                `).join('')}
            </div>
          </div>

          <div id="m-sim-results">
            ${pristine ? `
              <div class="m-empty" style="padding:24px"><div class="m-empty-icon">🧮</div><p class="m-empty-text">Renseigne tes hypothèses ou charge une livraison pour lancer l'analyse.</p></div>
            ` : `
              <div class="m-card" style="border-left:4px solid ${margeC};padding:18px;margin-bottom:12px">
                <div class="m-card-title">Bénéfice net mensuel</div>
                <div class="m-card-value" style="color:${margeC};font-size:1.7rem">${M.format$(beneficeNet)}</div>
                <div class="m-card-sub">${beneficeNet >= 0 ? 'Activité rentable avec ces paramètres' : 'Activité déficitaire'}</div>
              </div>
              <div class="m-card-row">
                <div class="m-card m-card-green"><div class="m-card-title">CA HT</div><div class="m-card-value">${M.format$(caHT)}</div><div class="m-card-sub">${M.format$(caTTC)} TTC</div></div>
                <div class="m-card"><div class="m-card-title">Coût total</div><div class="m-card-value" style="color:var(--m-red)">${M.format$(coutTotalSim)}</div><div class="m-card-sub">${M.format$(coutParKm)}/km</div></div>
              </div>
              <div class="m-card" style="padding:0;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--m-border)"><span>⛽ Carburant</span><span style="font-weight:600">${M.format$(coutCarburant)} <span style="color:var(--m-text-muted);font-weight:400;font-size:.78rem">(${litresMois.toFixed(1).replace('.', ',')} L)</span></span></div>
                <div style="display:flex;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--m-border)"><span>📦 Charges fixes</span><span style="font-weight:600">${M.format$(chargesFixes)}${cfg.repartitionCharges === 'prorata' && !prorataBlocked ? ' <span style="color:var(--m-text-muted);font-weight:400;font-size:.72rem">prorata</span>' : ''}</span></div>
                <div style="display:flex;justify-content:space-between;padding:14px 16px"><span>📏 Marge / km</span><span style="font-weight:600;color:${margeParKm >= 0 ? 'var(--m-green)' : 'var(--m-red)'}">${M.format$(margeParKm)}</span></div>
              </div>
              <div class="m-card" style="padding:14px;margin-bottom:12px">
                <div style="font-weight:600;margin-bottom:10px">📊 Analyse journalière</div>
                <div style="display:flex;justify-content:space-between;font-size:.88rem;margin-bottom:6px"><span style="color:var(--m-text-muted)">Revenu / jour</span><span>${M.format$(revenuJ)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:.88rem;margin-bottom:6px"><span style="color:var(--m-text-muted)">Coût variable / jour</span><span style="color:var(--m-red)">−${M.format$(coutVarJ)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:.88rem"><span style="color:var(--m-text-muted)">Marge / jour</span><span style="color:${margeJ >= 0 ? 'var(--m-green)' : 'var(--m-red)'};font-weight:600">${M.format$(margeJ)}</span></div>
              </div>
              <div class="m-card" style="padding:14px;margin-bottom:12px">
                <div style="font-weight:600;margin-bottom:10px">🎯 Seuil de rentabilité</div>
                <div style="display:flex;justify-content:space-between;font-size:.88rem;margin-bottom:6px"><span style="color:var(--m-text-muted)">Jours nécessaires</span><span style="font-weight:600">${fmtJ(seuilJours)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:.88rem"><span style="color:var(--m-text-muted)">Point mort CA</span><span style="font-weight:600">${pointMortCA != null ? M.format$(pointMortCA) : 'Non atteignable'}</span></div>
              </div>
            `}
          </div>

          <div id="m-sim-alerts" style="margin-bottom:18px">
            ${(() => {
              const alerts = [];
              if (pristine) alerts.push({ t: 'info', m: 'Renseigne tes hypothèses pour lancer l\'analyse.' });
              else {
                if (joursTravailles <= 0) alerts.push({ t: 'warn', m: isLivMode ? 'Fréquence à 0 : la projection mensuelle reste nulle.' : 'Renseigne au moins 1 jour travaillé.' });
                if (beneficeNet < 0) alerts.push({ t: 'danger', m: 'Bénéfice négatif : tes coûts dépassent ton CA HT.' });
                if (seuilJours != null && seuilJours > cfg.joursTravailles) alerts.push({ t: 'warn', m: 'Seuil de rentabilité supérieur aux jours travaillés.' });
                if (seuilJours == null) alerts.push({ t: 'danger', m: 'Marge journalière insuffisante pour atteindre la rentabilité.' });
                if (prorataBlocked) alerts.push({ t: 'danger', m: 'Prorata bloqué : renseigne des jours travaillés d\'abord.' });
                else if (cfg.repartitionCharges === 'prorata') alerts.push({ t: 'warn', m: 'Charges fixes proratisées selon les jours travaillés.' });
                if (lldDoublon && cfg.lldCredit > 0) alerts.push({ t: 'warn', m: 'Doublon possible : une autre charge ressemble à LLD/leasing/crédit.' });
                if (!alerts.length) alerts.push({ t: 'success', m: '✅ Structure saine : ton activité couvre ses coûts.' });
              }
              const colors = { info: 'var(--m-text-muted)', warn: 'var(--m-accent)', danger: 'var(--m-red)', success: 'var(--m-green)' };
              return alerts.map(a => `<div class="m-card" style="border-left:4px solid ${colors[a.t]};padding:12px 14px;margin-bottom:8px;font-size:.85rem">${a.m}</div>`).join('');
            })()}
          </div>
        `;
      }

      return html;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-rent-mois');
      if (sel) sel.addEventListener('change', e => {
        M.state.rentMois = e.target.value;
        M.state.rentMoisManuel = true;
        M.go('rentabilite');
      });
      container.querySelectorAll('.m-alertes-chip[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.rentTab = btn.dataset.tab; M.go('rentabilite'); });
      });
      // ---- Simulateur : binding inputs (persist au blur + reload).
      // Re-render apres chaque modif (les blocs Resultats/Alertes dependent de
      // tous les inputs). Persistance partagee avec PC (cle 'rentabilite_calculateur_v2').
      const SIM_KEY = 'rentabilite_calculateur_v2';
      const simLoad = () => M.chargerObj(SIM_KEY) || {};
      const simSave = (patch) => M.sauvegarder(SIM_KEY, Object.assign({}, simLoad(), patch));
      const simReload = () => M.go('rentabilite');

      const modeSel = container.querySelector('#m-sim-mode');
      if (modeSel) modeSel.addEventListener('change', e => { simSave({ modeCalcul: e.target.value }); simReload(); });

      const livSel = container.querySelector('#m-sim-livraison');
      if (livSel) livSel.addEventListener('change', e => { simSave({ livraisonId: e.target.value }); simReload(); });

      const repSel = container.querySelector('#m-sim-repartition');
      if (repSel) repSel.addEventListener('change', e => { simSave({ repartitionCharges: e.target.value }); simReload(); });

      // Inputs numeriques : persist + reload sur blur (preserve focus iOS pendant la saisie)
      const numFields = [
        ['m-sim-km-jour', 'kmJour'], ['m-sim-prix-km', 'prixKm'], ['m-sim-jours', 'joursTravailles'],
        ['m-sim-conso', 'conso'], ['m-sim-prix-carb', 'prixCarburant'],
        ['m-sim-lld', 'lldCredit'], ['m-sim-assurance', 'assurance'], ['m-sim-salaire', 'salaireCharge'],
        ['m-sim-tva', 'tva']
      ];
      numFields.forEach(([id, key]) => {
        const el = container.querySelector('#' + id);
        if (!el) return;
        el.addEventListener('blur', () => { simSave({ [key]: M.parseNum(el.value) || 0 }); simReload(); });
      });

      // Autres charges : edit inline + delete + add
      container.querySelectorAll('.m-sim-autre-label').forEach(el => {
        el.addEventListener('blur', () => {
          const id = el.dataset.id;
          const cur = simLoad();
          const arr = (cur.autresCharges || []).map(i => i.id === id ? Object.assign({}, i, { label: el.value }) : i);
          simSave({ autresCharges: arr });
        });
      });
      container.querySelectorAll('.m-sim-autre-montant').forEach(el => {
        el.addEventListener('blur', () => {
          const id = el.dataset.id;
          const cur = simLoad();
          const arr = (cur.autresCharges || []).map(i => i.id === id ? Object.assign({}, i, { montant: M.parseNum(el.value) || 0 }) : i);
          simSave({ autresCharges: arr });
          simReload();
        });
      });
      container.querySelectorAll('.m-sim-autre-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const cur = simLoad();
          simSave({ autresCharges: (cur.autresCharges || []).filter(i => i.id !== id) });
          simReload();
        });
      });
      const addBtn = container.querySelector('#m-sim-add-charge');
      if (addBtn) addBtn.addEventListener('click', () => {
        const cur = simLoad();
        const arr = [...(cur.autresCharges || []), { id: M.genId(), label: 'Nouvelle charge', montant: 0 }];
        simSave({ autresCharges: arr });
        simReload();
      });

      // Helpers : prix carburant moyen reel
      const fuelBtn = container.querySelector('#m-sim-fuel-real');
      if (fuelBtn) fuelBtn.addEventListener('click', () => {
        const cur = simLoad();
        const liv = cur.livraisonId ? M.charger('livraisons').find(l => l.id === cur.livraisonId) : null;
        const pleins = M.charger('carburant');
        let arr = pleins.filter(p => M.parseNum(p.prixLitre) > 0);
        if (liv?.vehId) {
          const sub = pleins.filter(p => (p.vehId === liv.vehId || p.vehiculeId === liv.vehId) && M.parseNum(p.prixLitre) > 0);
          if (sub.length) arr = sub;
        }
        if (!arr.length) { M.toast('Aucune donnée carburant exploitable'); return; }
        const moy = arr.reduce((s, p) => s + (M.parseNum(p.prixLitre) || 0), 0) / arr.length;
        simSave({ prixCarburant: parseFloat(moy.toFixed(2)) });
        M.toast('Prix carburant moyen appliqué');
        simReload();
      });

      // Helpers : import charges reelles du mois
      const chargesBtn = container.querySelector('#m-sim-charges-real');
      if (chargesBtn) chargesBtn.addEventListener('click', () => {
        const cur = simLoad();
        const liv = cur.livraisonId ? M.charger('livraisons').find(l => l.id === cur.livraisonId) : null;
        const mois = (liv?.date && /^\d{4}-\d{2}/.test(liv.date)) ? liv.date.slice(0, 7) : M.moisKey();
        const charges = M.charger('charges').filter(c => (c.date || '').slice(0, 7) === mois);
        let lld = 0, ass = 0, sal = 0;
        const autres = {};
        charges.forEach(c => {
          const cat = c.categorie || 'autre';
          if (cat === 'tva') return;
          const m = M.parseNum(c.montantHT || c.montant) || 0;
          if (cat === 'lld_credit' || cat === 'lld-credit') lld += m;
          else if (cat === 'assurance') ass += m;
          else if (cat === 'salaires') sal += m;
          else autres[cat] = (autres[cat] || 0) + m;
        });
        const labelMap = { carburant: 'Carburant réel', peage: 'Péages', entretien: 'Entretiens', autre: 'Autres charges' };
        const autresArr = Object.entries(autres).filter(([_, v]) => v > 0).map(([k, v]) => ({
          id: M.genId(), label: labelMap[k] || k, montant: v
        }));
        simSave({ lldCredit: lld, assurance: ass, salaireCharge: sal, autresCharges: autresArr });
        M.toast(`Charges ${mois.split('-').reverse().join('/')} chargées`);
        simReload();
      });

      // Helpers : preremplir depuis le vehicule de la livraison (ou unique)
      const vehBtn = container.querySelector('#m-sim-load-veh');
      if (vehBtn) vehBtn.addEventListener('click', () => {
        const cur = simLoad();
        const liv = cur.livraisonId ? M.charger('livraisons').find(l => l.id === cur.livraisonId) : null;
        const vehs = M.charger('vehicules');
        let veh = liv?.vehId ? vehs.find(v => v.id === liv.vehId) : null;
        if (!veh && vehs.length === 1) veh = vehs[0];
        if (!veh) { M.toast('Aucun véhicule exploitable'); return; }
        let mens = 0;
        switch (veh.modeAcquisition) {
          case 'lld': case 'location': case 'loa':
            mens = M.parseNum(veh.loyerMensuelHT) || 0; break;
          case 'credit':
            mens = M.parseNum(veh.creditMensualiteHT) || 0; break;
          case 'achat': case 'occasion': {
            const px = M.parseNum(veh.prixAchatHT) || 0;
            const dur = M.parseNum(veh.dureeAmortissement) || 0;
            mens = (px > 0 && dur > 0) ? px / (dur * 12) : 0;
            break;
          }
        }
        const patch = {};
        if (mens > 0) patch.lldCredit = mens;
        if ((!cur.conso || cur.conso <= 0) && M.parseNum(veh.conso) > 0) patch.conso = M.parseNum(veh.conso);
        simSave(patch);
        M.toast('Coûts du véhicule chargés');
        simReload();
      });
      // Tap sur une ligne -> navigue vers la fiche detail correspondante
      container.querySelectorAll('.m-rent-row[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (!action) return;
          const [type, id] = action.split(':');
          if (type === 'veh') M.openDetail('vehicules', id);
          else if (type === 'cli') M.openDetail('clients', id);
          else if (type === 'sal') M.openDetail('salaries', id);
        });
      });
    }
  });
  // ---------- Clients (v2.7 : list + recherche + detail tap-to-call) ----------
  M.state.clientsRecherche = '';
  M.register('clients', {
    title: 'Clients',
    render() {
      const detailId = M.state.detail.clients;
      if (detailId) return M.renderClientDetail(detailId);

      const clients = M.charger('clients');
      const recherche = (M.state.clientsRecherche || '').toLowerCase();
      let filtered = clients;
      if (recherche) {
        filtered = clients.filter(c => {
          const hay = `${c.nom||''} ${c.tel||''} ${c.email||''} ${c.ville||''} ${c.adresse||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      filtered = [...filtered].sort((a,b) => (a.nom||'').localeCompare(b.nom||''));

      // Pre-calcule le CA total par client (sur tous les mois) pour affichage en liste
      const livrAll = M.charger('livraisons');
      const caByClient = {};
      livrAll.forEach(l => {
        const k = (l.client || '').toLowerCase();
        if (!k) return;
        caByClient[k] = (caByClient[k] || 0) + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0);
      });

      let html = `<button class="m-fab" onclick="MCAm.formNouveauClient()" aria-label="Nouveau client">+</button>`;
      html += `
        <div style="margin-bottom:14px">
          <input type="search" id="m-clients-search" placeholder="🔍 Rechercher (nom, tel, ville)" value="${M.escHtml(M.state.clientsRecherche)}" autocomplete="off" />
        </div>
      `;

      if (!clients.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🧑‍💼</div><h3 class="m-empty-title">Aucun client</h3><p class="m-empty-text">Ajoute tes premiers clients depuis la version PC.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun résultat</h3><p class="m-empty-text">Essaie un autre mot-clé.</p></div>`;
        return html;
      }

      // Group alphabetique
      const byLetter = {};
      filtered.forEach(c => {
        const letter = ((c.nom||'').charAt(0).toUpperCase() || '#').replace(/[^A-Z]/, '#');
        if (!byLetter[letter]) byLetter[letter] = [];
        byLetter[letter].push(c);
      });
      const letters = Object.keys(byLetter).sort();

      letters.forEach(letter => {
        html += `<div style="font-size:.78rem;font-weight:700;color:var(--m-text-muted);text-transform:uppercase;letter-spacing:.06em;margin:18px 4px 8px">${letter}</div>`;
        byLetter[letter].forEach(c => {
          const caClient = caByClient[(c.nom || '').toLowerCase()] || 0;
          html += `<button type="button" class="m-card m-card-pressable m-client-row" data-id="${M.escHtml(c.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(c.nom || '—')}</div>
              <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(c.tel || c.email || c.ville || '—')}</div>
              ${caClient > 0 ? `<div style="color:var(--m-green);font-size:.78rem;margin-top:3px;font-weight:600">${M.format$(caClient)} HT total</div>` : ''}
            </div>
            <span style="color:var(--m-text-muted);font-size:1.2rem;flex-shrink:0">›</span>
          </button>`;
        });
      });

      return html;
    },
    afterRender(container) {
      const searchInput = container.querySelector('#m-clients-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.clientsRecherche = e.target.value; M.go('clients'); }, 350);
        });
        if (M.state.clientsRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      container.querySelectorAll('.m-client-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('clients', btn.dataset.id));
      });
    }
  });

  M.renderClientDetail = function(id) {
    const c = M.charger('clients').find(x => x.id === id);
    if (!c) return `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Client introuvable</h3></div>`;

    // Telephone : nettoie pour href:tel + format affichage
    const telClean = (c.tel || '').replace(/[^\d+]/g, '');
    const livClient = M.charger('livraisons').filter(l => (l.client || '').toLowerCase() === (c.nom || '').toLowerCase());
    const totalCa = livClient.reduce((s, l) => s + (M.parseNum(l.prix) || 0), 0);
    const adresseFull = [c.adresse, c.cp, c.ville].filter(Boolean).join(' ');
    const adresseEnc = encodeURIComponent(adresseFull);

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;margin:0 auto 10px">${M.escHtml((c.nom || '?').charAt(0).toUpperCase())}</div>
        <h2 style="margin:0;font-size:1.3rem;font-weight:700;letter-spacing:-0.02em">${M.escHtml(c.nom || '—')}</h2>
        ${c.ville ? `<p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">${M.escHtml(c.ville)}</p>` : ''}
        <button type="button" onclick="MCAm.editerClient('${M.escHtml(c.id)}')" style="margin-top:12px;background:var(--m-accent-soft);color:var(--m-accent);border:1px solid ${'rgba(245,166,35,0.3)'};border-radius:10px;padding:8px 16px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✏️ Modifier</button>
      </div>

      ${c.tel || c.email || adresseFull ? `
        <div class="m-card-row" style="grid-template-columns:repeat(${(c.tel?1:0)+(c.email?1:0)+(adresseFull?1:0)},1fr);gap:8px;margin-bottom:12px">
          ${c.tel ? `<a href="tel:${M.escHtml(telClean)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-green);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">📞</span><span>Appeler</span></a>` : ''}
          ${c.email ? `<a href="mailto:${M.escHtml(c.email)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-blue);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">✉️</span><span>Email</span></a>` : ''}
          ${adresseFull ? `<a href="https://maps.apple.com/?q=${adresseEnc}" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-purple);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">🗺️</span><span>Itinéraire</span></a>` : ''}
        </div>
      ` : ''}

      <div class="m-card" style="padding:0">
        ${c.tel ?       `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Téléphone</span><span style="font-weight:500">${M.escHtml(c.tel)}</span></div>` : ''}
        ${c.email ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Email</span><span style="font-weight:500;font-size:.85rem;text-align:right;word-break:break-all">${M.escHtml(c.email)}</span></div>` : ''}
        ${adresseFull ? `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Adresse</span><span style="font-weight:500;font-size:.85rem;text-align:right">${M.escHtml(adresseFull)}</span></div>` : ''}
        ${c.siren ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">SIREN</span><span style="font-weight:500">${M.escHtml(c.siren)}</span></div>` : ''}
        ${c.tva ?       `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° TVA</span><span style="font-weight:500">${M.escHtml(c.tva)}</span></div>` : ''}
        ${c.notes ?     `<div style="padding:14px 16px;display:flex;flex-direction:column;gap:6px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Notes</span><span style="font-size:.88rem;line-height:1.45">${M.escHtml(c.notes)}</span></div>` : ''}
      </div>

      <div class="m-section">
        <div class="m-section-header">
          <h3 class="m-section-title">📦 Livraisons</h3>
          <span style="font-size:.85rem;color:var(--m-text-muted)">${livClient.length} · ${M.format$(totalCa)}</span>
        </div>
        ${livClient.length ? livClient.slice(0, 10).sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(l => `
          <button type="button" onclick="MCAm.editerLivraison('${M.escHtml(l.id)}')" class="m-card m-card-pressable" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit;font-family:inherit">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:500;font-size:.88rem">${M.formatDate(l.date)}${l.numLiv ? ' · ' + M.escHtml(l.numLiv) : ''}</div>
              <div style="color:var(--m-text-muted);font-size:.78rem">${l.distance ? M.formatNum(l.distance) + ' km' : '—'}</div>
            </div>
            <div style="font-weight:700;color:var(--m-green);white-space:nowrap">${M.format$(l.prix || 0)}</div>
          </button>
        `).join('') : `<p class="m-empty-text" style="text-align:center;padding:20px">Aucune livraison pour ce client.</p>`}
      </div>
    `;
  };
  // ---------- Fournisseurs (v2.8 : list + detail) ----------
  M.state.fournisseursRecherche = '';
  M.state.detail.fournisseurs = null;
  M.register('fournisseurs', {
    title: 'Fournisseurs',
    render() {
      const detailId = M.state.detail.fournisseurs;
      if (detailId) return M.renderFournisseurDetail(detailId);

      const fournisseurs = M.charger('fournisseurs');
      const recherche = (M.state.fournisseursRecherche || '').toLowerCase();
      let filtered = fournisseurs;
      if (recherche) {
        filtered = fournisseurs.filter(f => {
          const hay = `${f.nom||''} ${f.tel||''} ${f.email||''} ${f.ville||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      filtered = [...filtered].sort((a,b) => (a.nom||'').localeCompare(b.nom||''));

      let html = `<button class="m-fab" onclick="MCAm.formNouveauFournisseur()" aria-label="Nouveau fournisseur">+</button>`;
      html += `
        <div style="margin-bottom:14px">
          <input type="search" id="m-four-search" placeholder="🔍 Rechercher" value="${M.escHtml(M.state.fournisseursRecherche)}" autocomplete="off" />
        </div>
      `;

      if (!fournisseurs.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🏭</div><h3 class="m-empty-title">Aucun fournisseur</h3><p class="m-empty-text">Ajoute tes fournisseurs depuis la version PC.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun résultat</h3></div>`;
        return html;
      }

      filtered.forEach(f => {
        // Compteur charges associees pour mini-stat
        const chargesF = M.charger('charges').filter(c => c.fournisseurId === f.id || c.fournisseur === f.nom);
        const totalCharges = chargesF.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
        html += `<button type="button" class="m-card m-card-pressable m-four-row" data-id="${M.escHtml(f.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit">
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(f.nom || '—')}</div>
            <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.escHtml(f.tel || f.email || f.ville || '—')}</div>
            ${chargesF.length ? `<div style="margin-top:4px;font-size:.74rem;color:var(--m-accent);font-weight:600">${chargesF.length} charge${chargesF.length>1?'s':''} · ${M.format$(totalCharges)}</div>` : ''}
          </div>
          <span style="color:var(--m-text-muted);font-size:1.2rem;flex-shrink:0">›</span>
        </button>`;
      });

      return html;
    },
    afterRender(container) {
      const searchInput = container.querySelector('#m-four-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.fournisseursRecherche = e.target.value; M.go('fournisseurs'); }, 350);
        });
        if (M.state.fournisseursRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      container.querySelectorAll('.m-four-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('fournisseurs', btn.dataset.id));
      });
    }
  });

  M.renderFournisseurDetail = function(id) {
    const f = M.charger('fournisseurs').find(x => x.id === id);
    if (!f) return `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Fournisseur introuvable</h3></div>`;

    const telClean = (f.tel || '').replace(/[^\d+]/g, '');
    const chargesF = M.charger('charges').filter(c => c.fournisseurId === id || c.fournisseur === f.nom);
    const totalCharges = chargesF.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
    const aPayer = chargesF.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
    const totalAPayer = aPayer.reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="width:64px;height:64px;border-radius:14px;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 10px">🏭</div>
        <h2 style="margin:0;font-size:1.3rem;font-weight:700;letter-spacing:-0.02em">${M.escHtml(f.nom || '—')}</h2>
        ${f.ville ? `<p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">${M.escHtml(f.ville)}</p>` : ''}
        <button type="button" onclick="MCAm.editerFournisseur('${M.escHtml(f.id)}')" style="margin-top:12px;background:var(--m-accent-soft);color:var(--m-accent);border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:8px 16px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✏️ Modifier</button>
      </div>

      ${f.tel || f.email ? `
        <div class="m-card-row" style="grid-template-columns:repeat(${(f.tel?1:0)+(f.email?1:0)},1fr);gap:8px;margin-bottom:12px">
          ${f.tel ?   `<a href="tel:${M.escHtml(telClean)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-green);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">📞</span><span>Appeler</span></a>` : ''}
          ${f.email ? `<a href="mailto:${M.escHtml(f.email)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-blue);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">✉️</span><span>Email</span></a>` : ''}
        </div>
      ` : ''}

      ${chargesF.length ? `
        <div class="m-card-row">
          <div class="m-card m-card-red"><div class="m-card-title">À payer</div><div class="m-card-value" style="font-size:1.2rem">${M.format$(totalAPayer)}</div><div class="m-card-sub">${aPayer.length} charge${aPayer.length>1?'s':''}</div></div>
          <div class="m-card m-card-accent"><div class="m-card-title">Total</div><div class="m-card-value" style="font-size:1.2rem">${M.format$(totalCharges)}</div><div class="m-card-sub">${chargesF.length} charge${chargesF.length>1?'s':''}</div></div>
        </div>
      ` : ''}

      <div class="m-card" style="padding:0">
        ${f.tel ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Téléphone</span><span style="font-weight:500">${M.escHtml(f.tel)}</span></div>` : ''}
        ${f.email ?   `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Email</span><span style="font-weight:500;font-size:.85rem;text-align:right;word-break:break-all">${M.escHtml(f.email)}</span></div>` : ''}
        ${f.adresse ? `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Adresse</span><span style="font-weight:500;font-size:.85rem;text-align:right">${M.escHtml(f.adresse)}</span></div>` : ''}
        ${f.siret ?   `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">SIRET</span><span style="font-weight:500">${M.escHtml(f.siret)}</span></div>` : ''}
        ${f.tva ?     `<div style="padding:14px 16px;display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° TVA</span><span style="font-weight:500">${M.escHtml(f.tva)}</span></div>` : ''}
      </div>
    `;
  };
  // ---------- Vehicules (v2.7 : list + detail avec CT/assurance dates colorees) ----------
  M.state.vehiculesRecherche = '';

  // Helper : couleur + label selon proximite d'expiration d'une date
  M.statutDate = function(dateIso, opts = {}) {
    if (!dateIso) return { color: 'var(--m-text-muted)', label: '—', icon: '' };
    const d = new Date(dateIso);
    if (isNaN(d)) return { color: 'var(--m-text-muted)', label: '—', icon: '' };
    const now = new Date();
    const diffJours = Math.floor((d - now) / 86400000);
    if (diffJours < 0)        return { color: 'var(--m-red)',    label: `Expiré (${-diffJours}j)`, icon: '⚠️' };
    if (diffJours < 30)       return { color: 'var(--m-red)',    label: `Dans ${diffJours}j`,      icon: '🔴' };
    if (diffJours < 60)       return { color: 'var(--m-accent)', label: `Dans ${diffJours}j`,      icon: '🟠' };
    return { color: 'var(--m-green)', label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }), icon: '✅' };
  };

  M.register('vehicules', {
    title: 'Véhicules',
    render() {
      const detailId = M.state.detail.vehicules;
      if (detailId) return M.renderVehiculeDetail(detailId);

      const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
      const recherche = (M.state.vehiculesRecherche || '').toLowerCase();
      const filtreCarb = M.state.vehiculesCarburant || '';
      const filtreSal  = M.state.vehiculesSalarie || '';
      let filtered = vehicules;
      if (recherche) {
        filtered = filtered.filter(v => {
          const hay = `${v.immat||''} ${v.modele||''} ${v.marque||''} ${v.salNom||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      if (filtreCarb) filtered = filtered.filter(v => (v.typeCarburant || v.carburant || '') === filtreCarb);
      if (filtreSal)  filtered = filtered.filter(v => (v.salId || v.chaufId) === filtreSal);
      filtered = [...filtered].sort((a,b) => (a.immat||'').localeCompare(b.immat||''));

      const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');

      let html = `<button class="m-fab" onclick="MCAm.formNouveauVehicule()" aria-label="Nouveau véhicule">+</button>`;
      html += `
        <div style="margin-bottom:10px">
          <input type="search" id="m-veh-search" placeholder="🔍 Rechercher (immat, modèle)" value="${M.escHtml(M.state.vehiculesRecherche)}" autocomplete="off" />
        </div>
        <div style="display:flex;gap:6px;margin-bottom:14px">
          <select id="m-veh-carb" style="flex:1 1 auto">
            <option value="">⛽ Tous carburants</option>
            <option value="diesel"     ${filtreCarb==='diesel'?'selected':''}>⛽ Diesel/Gazole</option>
            <option value="essence"    ${filtreCarb==='essence'?'selected':''}>⛽ Essence</option>
            <option value="gnv"        ${filtreCarb==='gnv'?'selected':''}>🌿 GNV/BioGNV</option>
            <option value="electrique" ${filtreCarb==='electrique'?'selected':''}>⚡ Électrique</option>
            <option value="hybride"    ${filtreCarb==='hybride'?'selected':''}>🔋 Hybride</option>
            <option value="hydrogene"  ${filtreCarb==='hydrogene'?'selected':''}>💧 Hydrogène</option>
          </select>
          <select id="m-veh-sal" style="flex:1 1 auto">
            <option value="">👤 Tous chauffeurs</option>
            ${salaries.map(s => `<option value="${M.escHtml(s.id)}" ${filtreSal===s.id?'selected':''}>${M.escHtml(((s.prenom?s.prenom+' ':'') + (s.nom||s.id)).trim())}</option>`).join('')}
          </select>
        </div>
      `;

      if (!vehicules.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🚐</div><h3 class="m-empty-title">Aucun véhicule</h3><p class="m-empty-text">Ajoute ton parc depuis la version PC.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun résultat</h3></div>`;
        return html;
      }

      filtered.forEach(v => {
        const ct = M.statutDate(v.dateCT);
        html += `<button type="button" class="m-card m-card-pressable m-veh-row" data-id="${M.escHtml(v.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit">
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:700;font-size:1rem;letter-spacing:.02em">${M.escHtml(v.immat || '—')}</div>
            <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(v.modele || '')}${v.salNom ? ' · ' + M.escHtml(v.salNom) : ''}</div>
            <div style="margin-top:6px;font-size:.75rem"><span style="color:${ct.color};font-weight:600">${ct.icon} CT ${ct.label}</span></div>
          </div>
          <span style="color:var(--m-text-muted);font-size:1.2rem;flex-shrink:0">›</span>
        </button>`;
      });

      return html;
    },
    afterRender(container) {
      const searchInput = container.querySelector('#m-veh-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.vehiculesRecherche = e.target.value; M.go('vehicules'); }, 350);
        });
        if (M.state.vehiculesRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      // Filtres carburant + chauffeur
      container.querySelector('#m-veh-carb')?.addEventListener('change', e => { M.state.vehiculesCarburant = e.target.value; M.go('vehicules'); });
      container.querySelector('#m-veh-sal')?.addEventListener('change',  e => { M.state.vehiculesSalarie   = e.target.value; M.go('vehicules'); });
      container.querySelectorAll('.m-veh-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('vehicules', btn.dataset.id));
      });
    }
  });

  M.renderVehiculeDetail = function(id) {
    const v = M.charger('vehicules').find(x => x.id === id);
    if (!v) return `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Véhicule introuvable</h3></div>`;

    const ct = M.statutDate(v.dateCT);
    // Pleins du vehicule pour mini KPI
    const pleins = M.charger('carburant').filter(p => p.vehiculeId === v.id || p.vehId === v.id);
    const totalCarb = pleins.reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
    const totalLitres = pleins.reduce((s, p) => s + (M.parseNum(p.litres) || 0), 0);
    const dernierPlein = pleins.sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
    const livraisons = M.charger('livraisons').filter(l => l.vehiculeId === v.id || l.vehId === v.id);

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="display:inline-block;padding:8px 18px;background:var(--m-accent-soft);color:var(--m-accent);border-radius:14px;font-size:1.4rem;font-weight:800;letter-spacing:.05em">${M.escHtml(v.immat || '—')}</div>
        ${v.modele ? `<p style="font-size:.95rem;margin:8px 0 0;font-weight:500">${M.escHtml(v.modele)}</p>` : ''}
        ${v.salNom ? (() => {
          const sal = v.salId ? M.charger('salaries').find(s => s.id === v.salId) : M.findSalarieByName(v.salNom);
          return sal
            ? `<button type="button" onclick="MCAm.openDetail('salaries','${M.escHtml(sal.id)}')" style="background:none;border:none;color:var(--m-blue);font-size:.85rem;margin-top:4px;font-weight:600;cursor:pointer;font-family:inherit">👤 ${M.escHtml(v.salNom)} ›</button>`
            : `<p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">👤 ${M.escHtml(v.salNom)}</p>`;
        })() : ''}
        <div style="margin-top:12px"><button type="button" onclick="MCAm.editerVehicule('${M.escHtml(v.id)}')" style="background:var(--m-accent-soft);color:var(--m-accent);border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:8px 16px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✏️ Modifier</button></div>
      </div>

      <!-- CT highlight (le plus important) -->
      <div class="m-card" style="border-left:4px solid ${ct.color};padding:14px 16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div>
            <div style="font-size:.72rem;color:var(--m-text-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700">Contrôle technique</div>
            <div style="font-size:1.05rem;font-weight:700;color:${ct.color};margin-top:4px">${ct.icon} ${ct.label}</div>
          </div>
          ${v.dateCT ? `<div style="text-align:right;font-size:.78rem;color:var(--m-text-muted)">${new Date(v.dateCT).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' })}</div>` : ''}
        </div>
      </div>

      <!-- Detail technique -->
      <div class="m-card" style="padding:0">
        ${v.typeCarburant ?         `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Carburant</span><span style="font-weight:500;text-transform:capitalize">${M.escHtml(v.typeCarburant)}</span></div>` : ''}
        ${v.km != null ?            `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Kilométrage</span><span style="font-weight:600">${M.formatNum(v.km)} km</span></div>` : ''}
        ${(() => {
          // Conso L/100km = totalLitres / (km - kmInitial) * 100
          const kmParcourus = (Number(v.km) || 0) - (Number(v.kmInitial) || 0);
          if (kmParcourus > 0 && totalLitres > 0) {
            const conso = totalLitres / kmParcourus * 100;
            const consoColor = conso > 12 ? 'var(--m-red)' : conso > 8 ? 'var(--m-accent)' : 'var(--m-green)';
            return `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Conso moyenne</span><span style="font-weight:600;color:${consoColor}">${conso.toFixed(1)} L/100km</span></div>`;
          }
          return '';
        })()}
        ${v.kmInitial != null ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Km initial</span><span style="font-weight:500">${M.formatNum(v.kmInitial)} km</span></div>` : ''}
        ${v.modeAcquisition ?       `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Acquisition</span><span style="font-weight:500;text-transform:capitalize">${M.escHtml(v.modeAcquisition)}</span></div>` : ''}
        ${v.dateAcquisition ?       `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Date acquisition</span><span style="font-weight:500">${M.formatDate(v.dateAcquisition)}</span></div>` : ''}
        ${v.entretienIntervalKm ?   `<div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Vidange tous les</span><span style="font-weight:500">${M.formatNum(v.entretienIntervalKm)} km</span></div>` : ''}
      </div>

      <!-- Carburant resume -->
      ${pleins.length ? `
        <div class="m-section">
          <div class="m-section-header">
            <h3 class="m-section-title">⛽ Carburant</h3>
            <span style="font-size:.85rem;color:var(--m-text-muted)">${pleins.length} plein${pleins.length>1?'s':''}</span>
          </div>
          <div class="m-card-row">
            <div class="m-card m-card-red" style="padding:14px"><div class="m-card-title">Total</div><div class="m-card-value" style="font-size:1.2rem">${M.format$(totalCarb)}</div><div class="m-card-sub">${M.formatNum(totalLitres.toFixed(0))} L</div></div>
            <div class="m-card m-card-blue" style="padding:14px"><div class="m-card-title">Dernier</div><div class="m-card-value" style="font-size:1.2rem">${dernierPlein ? M.format$(dernierPlein.total) : '—'}</div><div class="m-card-sub">${dernierPlein ? M.formatDate(dernierPlein.date) : ''}</div></div>
          </div>
        </div>
      ` : ''}

      ${(() => {
        if (!livraisons.length) return '';
        const totalCa = livraisons.reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
        const totalKm = livraisons.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
        // Historique conducteurs : agrège par chauffeur (salarieId / chaufId)
        const salaries = M.charger('salaries');
        const byChauf = {};
        livraisons.forEach(l => {
          const sid = l.salarieId || l.chaufId;
          if (!sid) return;
          if (!byChauf[sid]) byChauf[sid] = { id: sid, nb: 0, ca: 0, km: 0, derniere: '' };
          byChauf[sid].nb++;
          byChauf[sid].ca += M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0;
          byChauf[sid].km += M.parseNum(l.distance) || 0;
          if ((l.date || '') > byChauf[sid].derniere) byChauf[sid].derniere = l.date || '';
        });
        const topChauf = Object.values(byChauf).sort((a, b) => b.nb - a.nb).slice(0, 5);
        const dernieres = [...livraisons].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
        const docsPresents = M.DOC_TYPES_VEHICULE.filter(t => v.docs?.[t.type]);

        return `
          ${docsPresents.length ? `
            <div class="m-section">
              <div class="m-section-header"><h3 class="m-section-title">📎 Documents</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${docsPresents.length}</span></div>
              <div class="m-card" style="padding:0">
                ${docsPresents.map((t, i) => `<button type="button" onclick="MCAm.visualiserDocVehicule('${M.escHtml(v.id)}','${t.type}')" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;${i < docsPresents.length - 1 ? 'border-bottom:1px solid var(--m-border);' : ''}background:transparent;border:0;color:inherit;text-align:left;cursor:pointer;font-family:inherit"><span style="font-size:1.2rem">${t.icon}</span><span style="flex:1 1 auto;font-weight:500;font-size:.88rem">${t.label}</span><span style="color:var(--m-text-muted)">›</span></button>`).join('')}
              </div>
            </div>
          ` : ''}

          <div class="m-section">
            <div class="m-section-header">
              <h3 class="m-section-title">📦 Activité totale</h3>
              <span style="font-size:.85rem;color:var(--m-text-muted)">${livraisons.length} liv · ${M.format$(totalCa)} · ${M.formatNum(totalKm.toFixed(0))} km</span>
            </div>
          </div>

          ${topChauf.length ? `
            <div class="m-section">
              <div class="m-section-header"><h3 class="m-section-title">👤 Historique conducteurs</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${topChauf.length}</span></div>
              <div class="m-card" style="padding:0">
                ${topChauf.map((c, i) => {
                  const sal = salaries.find(s => s.id === c.id);
                  const nom = sal ? ((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || '')).trim() : 'Inconnu';
                  const isLast = i === topChauf.length - 1;
                  return `<button type="button" onclick="MCAm.openDetail('salaries','${M.escHtml(c.id)}')" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:12px 14px;${isLast ? '' : 'border-bottom:1px solid var(--m-border);'}background:transparent;border:0;color:inherit;font-family:inherit;text-align:left;cursor:pointer">
                    <div style="flex:1 1 auto;min-width:0">
                      <div style="font-weight:600;font-size:.9rem">${i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}${M.escHtml(nom)}</div>
                      <div style="color:var(--m-text-muted);font-size:.74rem;margin-top:2px">${c.nb} liv · ${M.formatNum(c.km.toFixed(0))} km · dernière ${M.formatDate(c.derniere)}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <div style="font-weight:700;color:var(--m-green);font-size:.85rem">${M.format$(c.ca)}</div>
                    </div>
                  </button>`;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div class="m-section">
            <div class="m-section-header"><h3 class="m-section-title">📋 Dernières livraisons</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${dernieres.length} affichées</span></div>
            ${dernieres.map(l => `
              <button type="button" class="m-card m-card-pressable" onclick="MCAm.editerLivraison('${M.escHtml(l.id)}')" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;margin-bottom:8px;color:inherit;font-family:inherit">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(l.client || '—')}</div>
                  <div style="color:var(--m-text-muted);font-size:.76rem;margin-top:2px">${M.formatDate(l.date)}${l.distance ? ' · ' + M.formatNum(l.distance) + ' km' : ''}</div>
                </div>
                <div style="font-weight:700;color:var(--m-green);font-size:.88rem">${M.format$(l.prix || l.prixHT || 0)}</div>
              </button>
            `).join('')}
          </div>
        `;
      })()}
    `;
  };
  // ---------- Entretiens (v2.8 : list groupee par mois + filtre vehicule) ----------
  M.state.entretiensVehFilter = '';
  M.state.entrBulkMode = false;
  M.state.entrBulkSel = new Set();
  M.register('entretiens', {
    title: 'Entretiens',
    render() {
      const entretiens = M.charger('entretiens');
      const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
      const vehIdx = M.indexVehicules();
      const filterId = M.state.entretiensVehFilter;

      const sorted = [...entretiens].sort((a,b) => (b.date||'').localeCompare(a.date||''));
      const filtered = filterId ? sorted.filter(e => e.vehiculeId === filterId) : sorted;

      // KPI mois courant
      const moisCourant = M.moisKey();
      const courants = filtered.filter(e => (e.date || '').startsWith(moisCourant));
      const totalMois = courants.reduce((s, e) => s + (M.parseNum(e.cout) || 0), 0);
      const totalAll = filtered.reduce((s, e) => s + (M.parseNum(e.cout) || 0), 0);

      const bulkOn = M.state.entrBulkMode;
      const selSet = M.state.entrBulkSel;
      const selCount = selSet.size;
      let html = bulkOn ? '' : `<button class="m-fab" onclick="MCAm.formNouvelEntretien()" aria-label="Nouvel entretien">+</button>
        <button class="m-fab m-fab-secondary" id="m-entr-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>`;
      if (bulkOn) {
        html += `<div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:10px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,.15)">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:${selCount>0?'10px':'0'}">
            <div style="flex:1 1 auto;font-size:.92rem"><strong>${selCount}</strong> sélectionné${selCount>1?'s':''}</div>
            <button type="button" id="m-entr-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:36px;font-size:.78rem">✕</button>
          </div>
          ${selCount > 0 ? `<button type="button" id="m-entr-bulk-delete" class="m-btn m-btn-danger" style="width:100%;height:36px;font-size:.74rem">🗑️ Supprimer la sélection (cascade charge liée)</button>` : ''}
        </div>`;
      }
      html += `
        <div class="m-card-row">
          <div class="m-card m-card-blue"><div class="m-card-title">Mois en cours</div><div class="m-card-value">${M.format$(totalMois)}</div><div class="m-card-sub">${courants.length} entretien${courants.length>1?'s':''}</div></div>
          <div class="m-card m-card-accent"><div class="m-card-title">Total</div><div class="m-card-value">${M.format$(totalAll)}</div><div class="m-card-sub">${filtered.length} entretien${filtered.length>1?'s':''}</div></div>
        </div>
      `;

      // Filtre vehicule (si plusieurs)
      if (vehicules.length > 1) {
        html += `
          <div style="margin:14px 0">
            <select id="m-ent-vehfilter">
              <option value="">🚐 Tous les véhicules</option>
              ${vehicules.map(v => `<option value="${M.escHtml(v.id)}" ${v.id === filterId ? 'selected' : ''}>${M.escHtml(v.immat || v.id)}</option>`).join('')}
            </select>
          </div>
        `;
      }

      if (!entretiens.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔧</div><h3 class="m-empty-title">Aucun entretien</h3><p class="m-empty-text">L'historique des vidanges et reparations apparaitra ici.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun entretien pour ce véhicule</h3></div>`;
        return html;
      }

      // Group par mois
      const byMonth = {};
      filtered.forEach(e => {
        const m = (e.date || '0000-00').slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(e);
      });
      const monthsSorted = Object.keys(byMonth).sort().reverse();

      monthsSorted.forEach(month => {
        const items = byMonth[month];
        const total = items.reduce((s, e) => s + (M.parseNum(e.cout) || 0), 0);
        const dateLabel = month === '0000-00' ? 'Sans date' : (() => {
          const [y, m] = month.split('-');
          return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        })();

        html += `
          <div class="m-section" style="margin-top:16px">
            <div class="m-section-header"><h3 class="m-section-title" style="font-size:.95rem">${dateLabel}</h3><span style="font-size:.78rem;color:var(--m-text-muted)">${items.length} · ${M.format$(total)}</span></div>
            ${items.map(e => {
              const veh = e.vehiculeId ? vehIdx[e.vehiculeId] : null;
              const immat = veh?.immat || (e.immat || '—');
              const typeLabel = (e.type || 'autre').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
              const isSel = selSet.has(e.id);
              const cls = bulkOn ? 'm-entr-toggle' : 'm-entretien-edit';
              const bg = bulkOn && isSel ? 'background:var(--m-accent-soft);border-color:var(--m-accent)' : 'background:var(--m-card);border:1px solid var(--m-border)';
              const cb = bulkOn ? `<div style="flex:0 0 28px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>` : '';
              return `<div role="button" tabindex="0" class="m-card m-card-pressable ${cls}" data-id="${M.escHtml(e.id)}" style="padding:14px;display:flex;align-items:start;gap:10px;width:100%;text-align:left;${bg};border-radius:18px;margin-bottom:10px;color:inherit;font-family:inherit;cursor:pointer">
                ${cb}
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.92rem">${M.escHtml(typeLabel)}</div>
                  <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.escHtml(immat)} · ${M.formatDate(e.date)}${e.km ? ' · ' + M.formatNum(e.km) + ' km' : ''}</div>
                  ${e.description ? `<div style="font-size:.82rem;margin-top:6px;color:var(--m-text);line-height:1.4">${M.escHtml(e.description)}</div>` : ''}
                </div>
                <div style="font-weight:700;color:var(--m-blue);white-space:nowrap;flex-shrink:0">${M.format$(e.cout || 0)}</div>
              </div>`;
            }).join('')}
          </div>
        `;
      });

      return html;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-ent-vehfilter');
      if (sel) {
        sel.addEventListener('change', e => {
          M.state.entretiensVehFilter = e.target.value;
          M.go('entretiens');
        });
      }
      container.querySelectorAll('.m-entretien-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerEntretien(btn.dataset.id));
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.editerEntretien(btn.dataset.id); } });
      });
      container.querySelectorAll('.m-entr-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.entrBulkSel.has(id)) M.state.entrBulkSel.delete(id);
          else M.state.entrBulkSel.add(id);
          M.go('entretiens');
        });
      });
      container.querySelector('#m-entr-bulk-on')?.addEventListener('click', () => { M.state.entrBulkMode = true; M.state.entrBulkSel.clear(); M.go('entretiens'); });
      container.querySelector('#m-entr-bulk-exit')?.addEventListener('click', () => { M.state.entrBulkMode = false; M.state.entrBulkSel.clear(); M.go('entretiens'); });
      container.querySelector('#m-entr-bulk-delete')?.addEventListener('click', async () => {
        const ids = [...M.state.entrBulkSel];
        if (!ids.length) return;
        if (!await M.confirm(`Supprimer ${ids.length} entretien${ids.length>1?'s':''} ? Les charges liées seront aussi supprimées.`, { titre: 'Suppression en lot' })) return;
        const entrs = M.charger('entretiens');
        const aSuppr = entrs.filter(e => ids.includes(e.id));
        const chargeIds = aSuppr.map(e => e.chargeId).filter(Boolean);
        M.sauvegarder('entretiens', entrs.filter(e => !ids.includes(e.id)));
        M.sauvegarder('charges', M.charger('charges').filter(c => !chargeIds.includes(c.id) && !ids.includes(c.entretienId)));
        M.toast(`🗑️ ${ids.length} entretien${ids.length>1?'s':''} supprimé${ids.length>1?'s':''}`);
        M.state.entrBulkSel.clear(); M.state.entrBulkMode = false;
        M.go('entretiens');
      });
    }
  });
  // ---------- Inspections (v2.8 : list + detail avec photos) ----------
  M.state.detail.inspections = null;
  M.state.inspectionsRecherche = '';
  M.state.inspBulkMode = false;
  M.state.inspBulkSel = new Set();
  M.register('inspections', {
    title: 'Inspections',
    render() {
      const detailId = M.state.detail.inspections;
      if (detailId) return M.renderInspectionDetail(detailId);

      const inspections = M.charger('inspections');
      const recherche = (M.state.inspectionsRecherche || '').toLowerCase();
      let filtered = inspections;
      if (recherche) {
        filtered = inspections.filter(i => {
          const hay = `${i.vehImmat||''} ${i.salNom||''} ${i.date||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      filtered = [...filtered].sort((a,b) => (b.date||b.creeLe||'').localeCompare(a.date||a.creeLe||''));

      const bulkOn = M.state.inspBulkMode;
      const selSet = M.state.inspBulkSel;
      const selCount = selSet.size;
      let html = bulkOn ? '' : `<button class="m-fab" onclick="MCAm.formNouvelleInspection()" aria-label="Nouvelle inspection">+</button>
        <button class="m-fab m-fab-secondary" id="m-insp-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>`;
      if (bulkOn) {
        html += `<div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:10px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,.15)">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:${selCount>0?'10px':'0'}">
            <div style="flex:1 1 auto;font-size:.92rem"><strong>${selCount}</strong> sélectionnée${selCount>1?'s':''}</div>
            <button type="button" id="m-insp-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:36px;font-size:.78rem">✕</button>
          </div>
          ${selCount > 0 ? `<button type="button" id="m-insp-bulk-delete" class="m-btn m-btn-danger" style="width:100%;height:36px;font-size:.74rem">🗑️ Supprimer la sélection</button>` : ''}
        </div>`;
      }
      html += `
        <div style="margin-bottom:14px">
          <input type="search" id="m-insp-search" placeholder="🔍 Rechercher (immat, salarié)" value="${M.escHtml(M.state.inspectionsRecherche)}" autocomplete="off" />
        </div>
      `;

      if (!inspections.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🚗</div><h3 class="m-empty-title">Aucune inspection</h3><p class="m-empty-text">Les inspections recues des salaries apparaitront ici.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun résultat</h3></div>`;
        return html;
      }

      filtered.forEach(i => {
        const nbPhotos = Array.isArray(i.photos) ? i.photos.length : 0;
        const isSel = selSet.has(i.id);
        const cls = bulkOn ? 'm-insp-toggle' : 'm-insp-row';
        const bg = bulkOn && isSel ? 'background:var(--m-accent-soft);border-color:var(--m-accent)' : 'background:var(--m-card);border:1px solid var(--m-border)';
        const cb = bulkOn ? `<div style="flex:0 0 28px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>` : '';
        html += `<div role="button" tabindex="0" class="m-card m-card-pressable ${cls}" data-id="${M.escHtml(i.id)}" style="display:flex;align-items:center;gap:10px;padding:14px;width:100%;text-align:left;${bg};border-radius:18px;margin-bottom:10px;color:inherit;cursor:pointer">
          ${cb}
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:600;font-size:.95rem">${M.escHtml(i.vehImmat || '—')}</div>
            <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.formatDate(i.date)}${i.salNom ? ' · 👤 ' + M.escHtml(i.salNom) : ''}${i.km ? ' · ' + M.formatNum(i.km) + ' km' : ''}</div>
            ${nbPhotos ? `<div style="margin-top:4px;font-size:.75rem;color:var(--m-blue);font-weight:600">📸 ${nbPhotos} photo${nbPhotos>1?'s':''}</div>` : ''}
          </div>
          ${bulkOn ? '' : '<span style="color:var(--m-text-muted);font-size:1.2rem;flex-shrink:0">›</span>'}
        </div>`;
      });

      return html;
    },
    afterRender(container) {
      const searchInput = container.querySelector('#m-insp-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.inspectionsRecherche = e.target.value; M.go('inspections'); }, 350);
        });
        if (M.state.inspectionsRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      container.querySelectorAll('.m-insp-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('inspections', btn.dataset.id));
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.openDetail('inspections', btn.dataset.id); } });
      });
      container.querySelectorAll('.m-insp-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.inspBulkSel.has(id)) M.state.inspBulkSel.delete(id);
          else M.state.inspBulkSel.add(id);
          M.go('inspections');
        });
      });
      container.querySelector('#m-insp-bulk-on')?.addEventListener('click', () => { M.state.inspBulkMode = true; M.state.inspBulkSel.clear(); M.go('inspections'); });
      container.querySelector('#m-insp-bulk-exit')?.addEventListener('click', () => { M.state.inspBulkMode = false; M.state.inspBulkSel.clear(); M.go('inspections'); });
      container.querySelector('#m-insp-bulk-delete')?.addEventListener('click', async () => {
        const ids = [...M.state.inspBulkSel];
        if (!ids.length) return;
        if (!await M.confirm(`Supprimer définitivement ${ids.length} inspection${ids.length>1?'s':''} ?`, { titre: 'Suppression en lot' })) return;
        M.sauvegarder('inspections', M.charger('inspections').filter(x => !ids.includes(x.id)));
        M.toast(`🗑️ ${ids.length} inspection${ids.length>1?'s':''} supprimée${ids.length>1?'s':''}`);
        M.state.inspBulkSel.clear(); M.state.inspBulkMode = false; M.go('inspections');
      });
    }
  });

  M.renderInspectionDetail = function(id) {
    const i = M.charger('inspections').find(x => x.id === id);
    if (!i) return `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Inspection introuvable</h3></div>`;

    const photos = Array.isArray(i.photos) ? i.photos : [];

    const vehInsp = M.findVehiculeByImmat(i.vehImmat);
    const salInsp = i.salId
      ? M.charger('salaries').find(s => s.id === i.salId)
      : M.findSalarieByName(i.salNom);
    return `
      <div style="text-align:center;padding:8px 0 18px">
        ${vehInsp
          ? `<button type="button" onclick="MCAm.openDetail('vehicules','${M.escHtml(vehInsp.id)}')" style="display:inline-block;padding:8px 18px;background:var(--m-accent-soft);color:var(--m-accent);border-radius:14px;font-size:1.4rem;font-weight:800;letter-spacing:.05em;border:none;cursor:pointer;font-family:inherit">${M.escHtml(i.vehImmat || '—')} ›</button>`
          : `<div style="display:inline-block;padding:8px 18px;background:var(--m-accent-soft);color:var(--m-accent);border-radius:14px;font-size:1.4rem;font-weight:800;letter-spacing:.05em">${M.escHtml(i.vehImmat || '—')}</div>`}
        <p style="font-size:.95rem;margin:8px 0 0;font-weight:500">Inspection du ${M.formatDate(i.date)}</p>
        ${i.salNom ? (salInsp
          ? `<button type="button" onclick="MCAm.openDetail('salaries','${M.escHtml(salInsp.id)}')" style="background:none;border:none;color:var(--m-blue);font-size:.85rem;margin-top:4px;font-weight:600;cursor:pointer;font-family:inherit">👤 ${M.escHtml(i.salNom)} ›</button>`
          : `<p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">👤 ${M.escHtml(i.salNom)}</p>`) : ''}
        <div style="margin-top:12px"><button type="button" onclick="MCAm.editerInspection('${M.escHtml(i.id)}')" style="background:var(--m-accent-soft);color:var(--m-accent);border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:8px 16px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✏️ Modifier</button></div>
      </div>

      <div class="m-card" style="padding:0">
        <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Date</span><span style="font-weight:500">${M.formatDate(i.date)}</span></div>
        ${i.km ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Kilométrage</span><span style="font-weight:500">${M.formatNum(i.km)} km</span></div>` : ''}
        ${i.salNom ? `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Salarié</span><span style="font-weight:500">${M.escHtml(i.salNom)}</span></div>` : ''}
        ${i.source ? `<div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Source</span><span style="font-weight:500;text-transform:capitalize">${M.escHtml(i.source)}</span></div>` : ''}
      </div>

      ${photos.length ? `
        <div class="m-section">
          <div class="m-section-header"><h3 class="m-section-title">📸 Photos (${photos.length})</h3></div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
            ${photos.map((p, idx) => {
              const url = typeof p === 'string' ? p : (p.url || p.dataUrl || '');
              if (!url) return '';
              return `<div style="aspect-ratio:1;border-radius:12px;overflow:hidden;background:var(--m-bg-elevated);border:1px solid var(--m-border)"><img src="${M.escHtml(url)}" alt="Photo ${idx+1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" /></div>`;
            }).join('')}
          </div>
          <p class="m-form-hint" style="text-align:center;margin-top:10px">Tape sur une photo pour la voir en grand (bientôt)</p>
        </div>
      ` : `<div class="m-empty" style="margin-top:18px"><div class="m-empty-icon">📷</div><p class="m-empty-text">Aucune photo pour cette inspection</p></div>`}
    `;
  };
  // ---------- Salaries (v2.7 : list + detail avec contact + permis/assurance) ----------
  M.state.salariesRecherche = '';
  M.register('salaries', {
    title: 'Salariés',
    render() {
      const detailId = M.state.detail.salaries;
      if (detailId) return M.renderSalarieDetail(detailId);

      const salaries = M.charger('salaries').filter(s => s && !s.archive);
      const recherche = (M.state.salariesRecherche || '').toLowerCase();
      let filtered = salaries;
      if (recherche) {
        filtered = salaries.filter(s => {
          const hay = `${s.nom||''} ${s.prenom||''} ${s.tel||''} ${s.email||''} ${s.poste||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      // Actifs en premier, puis inactifs
      filtered = [...filtered].sort((a,b) => {
        const aActif = a.actif !== false && a.statut !== 'inactif' ? 0 : 1;
        const bActif = b.actif !== false && b.statut !== 'inactif' ? 0 : 1;
        if (aActif !== bActif) return aActif - bActif;
        return (a.nom||'').localeCompare(b.nom||'');
      });

      let html = `<button class="m-fab" onclick="MCAm.formNouveauSalarie()" aria-label="Nouveau salarié">+</button>`;
      html += `
        <div style="margin-bottom:14px">
          <input type="search" id="m-sal-search" placeholder="🔍 Rechercher (nom, tel, poste)" value="${M.escHtml(M.state.salariesRecherche)}" autocomplete="off" />
        </div>
      `;

      if (!salaries.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">👥</div><h3 class="m-empty-title">Aucun salarié</h3><p class="m-empty-text">Ajoute ton équipe depuis la version PC.</p></div>`;
        return html;
      }
      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Aucun résultat</h3></div>`;
        return html;
      }

      filtered.forEach(s => {
        const estActif = s.actif !== false && s.statut !== 'inactif';
        const permis = M.statutDate(s.datePermis);
        const initiales = ((s.nom || '').charAt(0) + (s.prenom || '').charAt(0)).toUpperCase() || '?';
        html += `<button type="button" class="m-card m-card-pressable m-sal-row" data-id="${M.escHtml(s.id)}" style="display:flex;align-items:center;gap:12px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit;${!estActif ? 'opacity:.55' : ''}">
          <div style="width:42px;height:42px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.92rem;flex-shrink:0">${M.escHtml(initiales)}</div>
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml((s.prenom ? s.prenom + ' ' : '') + (s.nom || ''))}</div>
            <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.escHtml(s.poste || s.tel || '—')}${!estActif ? ' · Inactif' : ''}</div>
            ${s.datePermis ? `<div style="margin-top:4px;font-size:.72rem"><span style="color:${permis.color};font-weight:600">${permis.icon} Permis ${permis.label}</span></div>` : ''}
          </div>
          <span style="color:var(--m-text-muted);font-size:1.2rem;flex-shrink:0">›</span>
        </button>`;
      });

      return html;
    },
    afterRender(container) {
      const searchInput = container.querySelector('#m-sal-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.salariesRecherche = e.target.value; M.go('salaries'); }, 350);
        });
        if (M.state.salariesRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      container.querySelectorAll('.m-sal-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('salaries', btn.dataset.id));
      });
    }
  });

  M.renderSalarieDetail = function(id) {
    const s = M.charger('salaries').find(x => x.id === id);
    if (!s) return `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Salarié introuvable</h3></div>`;

    const estActif = s.actif !== false && s.statut !== 'inactif';
    const initiales = ((s.nom || '').charAt(0) + (s.prenom || '').charAt(0)).toUpperCase() || '?';
    const telClean = (s.tel || '').replace(/[^\d+]/g, '');
    const permis = M.statutDate(s.datePermis);
    const assurance = M.statutDate(s.dateAssurance);
    const visite = M.statutDate(s.visiteMedicale);
    const livSal = M.charger('livraisons').filter(l => l.salarieId === s.id || l.chaufId === s.id);
    const totalCa = livSal.reduce((sum, l) => sum + (M.parseNum(l.prix) || 0), 0);

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:700;margin:0 auto 12px">${M.escHtml(initiales)}</div>
        <h2 style="margin:0;font-size:1.3rem;font-weight:700;letter-spacing:-0.02em">${M.escHtml((s.prenom ? s.prenom + ' ' : '') + (s.nom || '—'))}</h2>
        ${s.poste ? `<p style="color:var(--m-text-muted);font-size:.88rem;margin:4px 0 0">${M.escHtml(s.poste)}</p>` : ''}
        ${!estActif ? `<p style="display:inline-block;background:rgba(231,76,60,0.12);color:var(--m-red);padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;margin-top:8px">⏸️ Inactif</p>` : ''}
        <div style="margin-top:12px"><button type="button" onclick="MCAm.editerSalarie('${M.escHtml(s.id)}')" style="background:var(--m-accent-soft);color:var(--m-accent);border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:8px 16px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✏️ Modifier</button></div>
      </div>

      ${s.tel || s.email ? `
        <div class="m-card-row" style="grid-template-columns:repeat(${(s.tel?1:0)+(s.email?1:0)},1fr);gap:8px;margin-bottom:12px">
          ${s.tel ?   `<a href="tel:${M.escHtml(telClean)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-green);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">📞</span><span>Appeler</span></a>` : ''}
          ${s.email ? `<a href="mailto:${M.escHtml(s.email)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;color:var(--m-blue);text-decoration:none;font-weight:600;font-size:.85rem"><span style="font-size:1.4rem">✉️</span><span>Email</span></a>` : ''}
        </div>
      ` : ''}

      <!-- Documents -->
      ${(s.datePermis || s.dateAssurance || s.visiteMedicale) ? `
        <div class="m-section">
          <div class="m-section-header"><h3 class="m-section-title">📋 Documents</h3></div>
          <div class="m-card" style="padding:0">
            ${s.datePermis ?      `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:.85rem">🪪 Permis</span><span style="font-weight:600;color:${permis.color};font-size:.85rem">${permis.icon} ${permis.label}</span></div>` : ''}
            ${s.dateAssurance ?   `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:.85rem">🛡️ Assurance</span><span style="font-weight:600;color:${assurance.color};font-size:.85rem">${assurance.icon} ${assurance.label}</span></div>` : ''}
            ${s.visiteMedicale ?  `<div style="padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:.85rem">🩺 Visite médicale</span><span style="font-weight:600;color:${visite.color};font-size:.85rem">${visite.icon} ${visite.label}</span></div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Detail -->
      <div class="m-card" style="padding:0;margin-top:12px">
        ${s.numero ? `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° matricule</span><span style="font-weight:500">${M.escHtml(s.numero)}</span></div>` : ''}
        ${s.tel ? `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Téléphone</span><span style="font-weight:500">${M.escHtml(s.tel)}</span></div>` : ''}
        ${s.email ? `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Email</span><span style="font-weight:500;font-size:.85rem;text-align:right;word-break:break-all">${M.escHtml(s.email)}</span></div>` : ''}
        ${s.adresse ? `<div style="padding:14px 16px;display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Adresse</span><span style="font-weight:500;font-size:.85rem;text-align:right">${M.escHtml(s.adresse)}</span></div>` : ''}
      </div>

      ${(() => {
        if (!livSal.length) return '';
        // Stats du mois courant
        const moisCle = M.moisKey();
        const livMois = livSal.filter(l => (l.date || '').startsWith(moisCle));
        const caMois = livMois.reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
        const kmMois = livMois.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
        const heuresEntries = M.charger('heures').filter(h =>
          (h.salId === s.id || h.salarieId === s.id) && (h.date || '').startsWith(moisCle));
        const totalHeures = heuresEntries.reduce((sum, h) => sum + (M.parseNum(h.heures) || 0), 0);
        // Top : compare aux autres salariés actifs sur le même mois
        const allSal = M.charger('salaries').filter(x => x && !x.archive && x.statut !== 'inactif');
        const allLiv = M.charger('livraisons');
        const ranks = allSal.map(x => {
          const livX = allLiv.filter(l => (l.salarieId === x.id || l.chaufId === x.id) && (l.date || '').startsWith(moisCle));
          const ca = livX.reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
          const km = livX.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
          return { id: x.id, ca, km, nb: livX.length };
        });
        const rankCa = [...ranks].sort((a, b) => b.ca - a.ca).findIndex(r => r.id === s.id) + 1;
        const rankKm = [...ranks].sort((a, b) => b.km - a.km).findIndex(r => r.id === s.id) + 1;
        const dernieres = [...livSal].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
        const podiumIcon = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;

        return `
          <div class="m-section">
            <div class="m-section-header">
              <h3 class="m-section-title">🏆 Performances du mois</h3>
              <span style="font-size:.78rem;color:var(--m-text-muted)">${new Date().toLocaleDateString('fr-FR', { month: 'long' })}</span>
            </div>
            <div class="m-card-row">
              <div class="m-card m-card-green"><div class="m-card-title">CA généré</div><div class="m-card-value">${M.format$(caMois)}</div><div class="m-card-sub">${podiumIcon(rankCa)} sur ${ranks.length}</div></div>
              <div class="m-card m-card-blue"><div class="m-card-title">Km parcourus</div><div class="m-card-value">${M.formatNum(kmMois.toFixed(0))}</div><div class="m-card-sub">${podiumIcon(rankKm)} sur ${ranks.length}</div></div>
            </div>
            <div class="m-card-row">
              <div class="m-card m-card-accent"><div class="m-card-title">Livraisons</div><div class="m-card-value">${livMois.length}</div><div class="m-card-sub">ce mois</div></div>
              <div class="m-card m-card-purple"><div class="m-card-title">Heures</div><div class="m-card-value">${M.formatNum(totalHeures.toFixed(0))} h</div><div class="m-card-sub">saisies</div></div>
            </div>
          </div>

          <div class="m-section">
            <div class="m-section-header">
              <h3 class="m-section-title">📦 Total cumulé</h3>
              <span style="font-size:.85rem;color:var(--m-text-muted)">${livSal.length} liv · ${M.format$(totalCa)}</span>
            </div>
            ${dernieres.map(l => `
              <button type="button" class="m-card m-card-pressable" onclick="MCAm.editerLivraison('${M.escHtml(l.id)}')" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;margin-bottom:8px;color:inherit;font-family:inherit">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(l.client || '—')}</div>
                  <div style="color:var(--m-text-muted);font-size:.76rem;margin-top:2px">${M.formatDate(l.date)}${l.distance ? ' · ' + M.formatNum(l.distance) + ' km' : ''}</div>
                </div>
                <div style="font-weight:700;color:var(--m-green);font-size:.88rem">${M.format$(l.prix || l.prixHT || 0)}</div>
              </button>
            `).join('')}
          </div>
        `;
      })()}
    `;
  };
  // ---------- Heures & Km (v2.9 : recap par salarie sur mois courant) ----------
  // Bug v3.57 : avant, M.state.heuresMois était figé à la valeur de l'IIFE load.
  // Si la PWA restait ouverte plusieurs jours (frontière avril/mai), le filtre
  // restait sur avril alors que les saisies étaient datées mai. -> compteur
  // ne se mettait jamais à jour. Fix : recalcul en render() sauf si l'user
  // a explicitement choisi un mois via le dropdown.
  // Bug v3.63 : le compteur d'heures mobile ne lisait QUE les saisies manuelles
  // 'heures' et ignorait totalement les horaires définis dans l'onglet Planning
  // (plannings[].semaine[].heureDebut/heureFin). Désormais, on agrège les heures
  // planifiees (sur le mois sélectionné) en plus des heures saisies manuellement,
  // alignement avec la logique desktop (script-heures.js l.198-202) :
  //   total affiche = heuresReelles > 0 ? heuresReelles : planifiees
  // Les jours tombant dans une période d'absence longue (planning.absences[])
  // de type conge/absence/maladie sont exclus du calcul planifie.
  M.state.heuresMois = M.moisKey();
  M.state.heuresMoisManuel = false;

  // Calcule les heures planifiees pour un salarie sur un mois donne (YYYY-MM).
  // Parcourt chaque jour du mois, lit le planning hebdo puis applique les
  // overrides d'absences longues (planning.absences[] type conge/absence/maladie
  // -> 0h, type travail -> heureDebut/Fin de la periode).
  // joursExclus (optional) : Set/array de dates 'YYYY-MM-DD' deja couvertes par
  // une saisie reelle -> on ignore le planning pour ces jours, evite le double
  // comptage. Sans cet argument, comportement historique (mois entier).
  M.calculerHeuresPlanifieesMois = function(planning, moisCle, joursExclus) {
    if (!planning || !Array.isArray(planning.semaine) || !moisCle) return 0;
    const [yy, mm] = moisCle.split('-').map(Number);
    if (!yy || !mm) return 0;
    const nbJours = new Date(yy, mm, 0).getDate(); // dernier jour du mois
    const absences = Array.isArray(planning.absences) ? planning.absences : [];
    const skip = joursExclus instanceof Set ? joursExclus
      : (Array.isArray(joursExclus) ? new Set(joursExclus) : null);
    let total = 0;
    for (let day = 1; day <= nbJours; day++) {
      const dateObj = new Date(yy, mm - 1, day);
      const dateStr = `${yy}-${String(mm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      if (skip && skip.has(dateStr)) continue; // saisie reelle pour ce jour
      // Override : periode d'absence longue
      const periode = absences.find(a => a.dateDebut && a.dateDebut <= dateStr && (!a.dateFin || a.dateFin >= dateStr));
      if (periode) {
        if (periode.type === 'travail') {
          const dur = M.calculerDureeJour(periode.heureDebut || '', periode.heureFin || '');
          if (dur > 0) total += dur;
        }
        // conge/absence/maladie -> 0h pour ce jour
        continue;
      }
      // Planning hebdo recurrent
      const jourNom = M_JOURS_FR[(dateObj.getDay() + 6) % 7];
      const j = planning.semaine.find(x => x.jour === jourNom);
      if (!j) continue;
      const typeJour = j.typeJour || (j.travaille ? 'travail' : 'repos');
      if (typeJour !== 'travail') continue;
      if (!j.travaille && !j.heureDebut) continue;
      const dur = M.calculerDureeJour(j.heureDebut || '', j.heureFin || '');
      if (dur > 0) total += dur;
    }
    return total;
  };

  // Helper duree en heures decimales (HH:MM -> HH:MM)
  M.calculerDureeJour = function(hd, hf) {
    if (!hd || !hf) return 0;
    const [h1, m1] = String(hd).split(':').map(Number);
    const [h2, m2] = String(hf).split(':').map(Number);
    if ([h1, m1, h2, m2].some(x => Number.isNaN(x))) return 0;
    const min = (h2 * 60 + m2) - (h1 * 60 + m1);
    return min > 0 ? min / 60 : 0;
  };

  M.register('heures', {
    title: 'Heures & Km',
    render() {
      // Recalcul auto du mois courant au render, sauf si user a choisi
      if (!M.state.heuresMoisManuel) {
        M.state.heuresMois = M.moisKey();
      }
      const moisSel = M.state.heuresMois;

      // BUGFIX v3.63 : pull explicit plannings + livraisons + heures pour
      // s'assurer que le compteur reflete les dernieres saisies (notamment
      // celles faites depuis l'onglet Planning qui poussent dans
      // plannings_hebdo via plannings-supabase-adapter).
      if (!M.state._heuresPullDone || M.state._heuresPullMois !== moisSel) {
        M.state._heuresPullDone = true;
        M.state._heuresPullMois = moisSel;
        const adapters = window.DelivProEntityAdapters || {};
        const before = M.charger('plannings').length + M.charger('heures').length + M.charger('livraisons').length;
        Promise.allSettled([
          adapters.plannings?.pullAll?.(),
          adapters.livraisons?.pullAll?.(),
          adapters.heures?.pullAll?.()
        ]).then(() => {
          const after = M.charger('plannings').length + M.charger('heures').length + M.charger('livraisons').length;
          if (after !== before && M.state.currentPage === 'heures') M.go('heures');
        }).catch(() => {});
      }

      const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
      const livraisons = M.charger('livraisons').filter(l => (l.date || '').startsWith(moisSel));
      const heuresEntries = M.charger('heures').filter(h => (h.date || '').startsWith(moisSel));
      const plannings = M.charger('plannings');

      // Selecteur 12 derniers mois
      const moisOptions = [];
      const now = new Date();
      for (let k = 0; k < 12; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const cle = M.moisKey(d);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      // Aggrege par salarie
      const stats = salaries.map(s => {
        const livSal = livraisons.filter(l => l.salarieId === s.id || l.chaufId === s.id);
        const kmLiv = livSal.reduce((sum, l) => sum + (M.parseNum(l.distance) || 0), 0);
        const heuresSal = heuresEntries.filter(h => h.salId === s.id || h.salarieId === s.id);
        const heuresReelles = heuresSal.reduce((sum, h) => sum + (M.parseNum(h.heures) || 0), 0);
        const kmHeures = heuresSal.reduce((sum, h) => sum + (M.parseNum(h.km) || 0), 0);
        // BUGFIX v3.63 : avant, "1 saisie reelle dans le mois" eclipsait TOUT le
        // planning ("totalHeures = heuresReelles > 0 ? heuresReelles : planifiees").
        // Cas concret : 1 saisie 8h -> 8 > 0 -> ignore les 22 jours plannifies a 9h
        // (= 198h perdues a l'affichage). Maintenant on additionne par jour :
        // pour chaque jour avec saisie reelle, on prend la saisie ; pour les
        // autres jours, on prend le planning.
        const joursAvecSaisie = new Set(heuresSal.map(h => (h.date || '').slice(0, 10)).filter(Boolean));
        const planning = plannings.find(p => p.salId === s.id);
        const heuresPlanifiees = M.calculerHeuresPlanifieesMois(planning, moisSel);
        const heuresPlanifieesAjustees = M.calculerHeuresPlanifieesMois(planning, moisSel, joursAvecSaisie);
        const totalHeures = heuresReelles + heuresPlanifieesAjustees;
        return {
          sal: s, nbLiv: livSal.length, kmLiv,
          totalHeures, heuresReelles, heuresPlanifiees,
          kmHeures, kmTotal: kmLiv + kmHeures
        };
      }).sort((a, b) => b.kmTotal - a.kmTotal);

      const grandTotalKm = stats.reduce((s, x) => s + x.kmTotal, 0);
      const grandTotalH  = stats.reduce((s, x) => s + x.totalHeures, 0);
      const grandTotalLiv = stats.reduce((s, x) => s + x.nbLiv, 0);

      let html = `<button class="m-fab" onclick="MCAm.formNouveauHeures()" aria-label="Nouvelle saisie heures">+</button>`;
      html += `
        <div style="margin-bottom:14px"><select id="m-heures-mois">${moisOptions.join('')}</select></div>
        <div class="m-card-row">
          <div class="m-card m-card-blue"><div class="m-card-title">Total km</div><div class="m-card-value">${M.formatNum(grandTotalKm.toFixed(0))}</div><div class="m-card-sub">${grandTotalLiv} livraison${grandTotalLiv>1?'s':''}</div></div>
          <div class="m-card m-card-purple"><div class="m-card-title">Heures</div><div class="m-card-value">${M.formatNum(grandTotalH.toFixed(0))} h</div><div class="m-card-sub">${stats.filter(x=>x.totalHeures>0).length} salarié${stats.filter(x=>x.totalHeures>0).length>1?'s':''}</div></div>
        </div>
      `;

      if (!salaries.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">⏱️</div><h3 class="m-empty-title">Aucun salarié</h3><p class="m-empty-text">Ajoute ton équipe pour voir les heures et km par chauffeur.</p></div>`;
        return html;
      }

      html += `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">Par salarié</h3></div>`;
      stats.forEach(({ sal, nbLiv, kmTotal, totalHeures }) => {
        const initiales = ((sal.nom || '').charAt(0) + (sal.prenom || '').charAt(0)).toUpperCase() || '?';
        html += `<button type="button" class="m-card m-card-pressable m-heures-sal" data-sal-id="${M.escHtml(sal.id)}" style="padding:14px;display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit;font-family:inherit">
          <div style="width:38px;height:38px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${M.escHtml(initiales)}</div>
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || ''))}</div>
            <div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${nbLiv} liv. · ${M.formatNum(kmTotal.toFixed(0))} km · ${totalHeures.toFixed(0)} h</div>
          </div>
          <span style="color:var(--m-text-muted);font-size:1.1rem">›</span>
        </button>`;
      });
      html += `</div>`;
      return html;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-heures-mois');
      if (sel) sel.addEventListener('change', e => {
        M.state.heuresMois = e.target.value;
        M.state.heuresMoisManuel = true; // user a choisi -> on ne reset plus auto
        M.go('heures');
      });
      // Tap salarie -> ouvre sa fiche
      container.querySelectorAll('.m-heures-sal').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('salaries', btn.dataset.salId));
      });
    }
  });

  // ---------- Incidents (v2.9 : list + filtre statut + detail) ----------
  M.state.incidentsStatut = 'tous';
  M.state.detail.incidents = null;
  M.state.incBulkMode = false;
  M.state.incBulkSel = new Set();
  M.register('incidents', {
    title: 'Incidents',
    render() {
      const detailId = M.state.detail.incidents;
      if (detailId) return M.renderIncidentDetail(detailId);

      const incidents = M.charger('incidents').sort((a,b) => new Date(b.creeLe||b.date||0) - new Date(a.creeLe||a.date||0));
      const statut = M.state.incidentsStatut;
      const ouverts = incidents.filter(i => (i.statut || 'ouvert') === 'ouvert');
      const enCours = incidents.filter(i => i.statut === 'encours');
      const traites = incidents.filter(i => ['traite','resolu','clos'].includes(i.statut));

      let filtered = incidents;
      if (statut === 'ouverts') filtered = ouverts;
      if (statut === 'encours') filtered = enCours;
      if (statut === 'traites') filtered = traites;

      const bulkOn = M.state.incBulkMode;
      const selSet = M.state.incBulkSel;
      const selCount = selSet.size;
      let html = bulkOn ? '' : `<button class="m-fab" onclick="MCAm.formNouvelIncident()" aria-label="Nouvel incident">+</button>
        <button class="m-fab m-fab-secondary" id="m-inc-bulk-on" aria-label="Sélection multiple" style="background:var(--m-blue);color:#fff;font-size:1.1rem">☑</button>`;
      if (bulkOn) {
        html += `<div style="position:sticky;top:0;z-index:5;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;padding:10px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,.15)">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:${selCount>0?'10px':'0'}">
            <div style="flex:1 1 auto;font-size:.92rem"><strong>${selCount}</strong> sélectionné${selCount>1?'s':''}</div>
            <button type="button" id="m-inc-bulk-exit" class="m-btn" style="width:auto;padding:0 12px;height:36px;font-size:.78rem">✕</button>
          </div>
          ${selCount > 0 ? `<div style="display:flex;gap:6px">
            <button type="button" id="m-inc-bulk-resolu" class="m-btn" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem;background:rgba(46,204,113,0.12);color:var(--m-green);border:1px solid rgba(46,204,113,0.3)">✅ Marquer résolu</button>
            <button type="button" id="m-inc-bulk-delete" class="m-btn m-btn-danger" style="flex:1 1 auto;padding:0 8px;height:36px;font-size:.74rem">🗑️ Supprimer</button>
          </div>` : ''}
        </div>`;
      }
      html += `
        <div class="m-card-row">
          <div class="m-card m-card-red"><div class="m-card-title">Ouverts</div><div class="m-card-value">${ouverts.length}</div><div class="m-card-sub">à traiter</div></div>
          <div class="m-card m-card-accent"><div class="m-card-title">Total</div><div class="m-card-value">${incidents.length}</div><div class="m-card-sub">enregistrés</div></div>
        </div>
        <div style="display:flex;gap:6px;margin:16px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${statut==='tous'?'active':''}" data-statut="tous">📋 Tous</button>
          <button class="m-alertes-chip ${statut==='ouverts'?'active':''}" data-statut="ouverts">🔴 Ouverts${ouverts.length?` (${ouverts.length})`:''}</button>
          <button class="m-alertes-chip ${statut==='encours'?'active':''}" data-statut="encours">🟡 En cours${enCours.length?` (${enCours.length})`:''}</button>
          <button class="m-alertes-chip ${statut==='traites'?'active':''}" data-statut="traites">✅ Traités</button>
        </div>
      `;

      if (!filtered.length) {
        html += `<div class="m-empty"><div class="m-empty-icon">🚨</div><h3 class="m-empty-title">${incidents.length ? 'Aucun incident dans ce filtre' : 'Aucun incident'}</h3><p class="m-empty-text">${incidents.length ? 'Change de filtre pour voir les autres.' : 'Les réclamations clients apparaitront ici.'}</p></div>`;
        return html;
      }

      const graviteIcon = { faible: '🟢', moyen: '🟠', grave: '🔴' };
      const statutIcon = { ouvert: '🔴', encours: '🟡', traite: '✅', resolu: '✅', clos: '✅' };
      filtered.forEach(i => {
        const grav = i.gravite || 'moyen';
        const stat = i.statut || 'ouvert';
        const borderColor = grav === 'grave' ? 'var(--m-red)' : grav === 'moyen' ? 'var(--m-accent)' : 'var(--m-green)';
        const isSel = selSet.has(i.id);
        const cls = bulkOn ? 'm-inc-toggle' : 'm-incident-row';
        const bg = bulkOn && isSel ? 'background:var(--m-accent-soft);border-color:var(--m-accent)' : 'background:var(--m-card);border:1px solid var(--m-border)';
        const cb = bulkOn ? `<div style="position:absolute;top:14px;left:14px;font-size:1.3rem">${isSel ? '☑' : '☐'}</div>` : '';
        html += `<div role="button" tabindex="0" class="m-card m-card-pressable ${cls}" data-id="${M.escHtml(i.id)}" style="position:relative;display:block;width:100%;text-align:left;padding:14px${bulkOn ? ' 14px 14px 50px' : ''};${bg};border-left:4px solid ${borderColor};border-radius:14px;margin-bottom:10px;color:inherit;cursor:pointer">
          ${cb}
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:600;font-size:.92rem">${M.escHtml(i.client || i.salNom || 'Incident')}</div>
              <div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${M.formatDate(i.creeLe || i.date)}${i.numLiv ? ' · ' + M.escHtml(i.numLiv) : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;gap:3px;align-items:flex-end;font-size:.7rem;font-weight:600">
              <span>${graviteIcon[grav] || ''} ${grav}</span>
              <span style="color:var(--m-text-muted)">${statutIcon[stat] || ''} ${stat}</span>
            </div>
          </div>
          ${i.description ? `<div style="font-size:.82rem;margin-top:8px;color:var(--m-text);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${M.escHtml(i.description)}</div>` : ''}
        </div>`;
      });

      return html;
    },
    afterRender(container) {
      container.querySelectorAll('.m-alertes-chip').forEach(btn => {
        btn.addEventListener('click', () => { M.state.incidentsStatut = btn.dataset.statut; M.go('incidents'); });
      });
      container.querySelectorAll('.m-incident-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('incidents', btn.dataset.id));
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.openDetail('incidents', btn.dataset.id); } });
      });
      container.querySelectorAll('.m-inc-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (M.state.incBulkSel.has(id)) M.state.incBulkSel.delete(id);
          else M.state.incBulkSel.add(id);
          M.go('incidents');
        });
      });
      container.querySelector('#m-inc-bulk-on')?.addEventListener('click', () => { M.state.incBulkMode = true; M.state.incBulkSel.clear(); M.go('incidents'); });
      container.querySelector('#m-inc-bulk-exit')?.addEventListener('click', () => { M.state.incBulkMode = false; M.state.incBulkSel.clear(); M.go('incidents'); });
      container.querySelector('#m-inc-bulk-resolu')?.addEventListener('click', async () => {
        const ids = [...M.state.incBulkSel];
        if (!ids.length) return;
        if (!await M.confirm(`Marquer ${ids.length} incident${ids.length>1?'s':''} comme résolu ?`, { titre: 'Marquer résolu' })) return;
        const arr = M.charger('incidents');
        const now = new Date().toISOString();
        ids.forEach(id => {
          const idx = arr.findIndex(x => x.id === id);
          if (idx >= 0) { arr[idx].statut = 'resolu'; arr[idx].modifieLe = now; }
        });
        M.sauvegarder('incidents', arr);
        M.toast(`✅ ${ids.length} incident${ids.length>1?'s':''} marqué${ids.length>1?'s':''} résolu${ids.length>1?'s':''}`);
        M.state.incBulkSel.clear(); M.state.incBulkMode = false; M.go('incidents');
      });
      container.querySelector('#m-inc-bulk-delete')?.addEventListener('click', async () => {
        const ids = [...M.state.incBulkSel];
        if (!ids.length) return;
        if (!await M.confirm(`Supprimer définitivement ${ids.length} incident${ids.length>1?'s':''} ?`, { titre: 'Suppression en lot' })) return;
        M.sauvegarder('incidents', M.charger('incidents').filter(x => !ids.includes(x.id)));
        M.toast(`🗑️ ${ids.length} incident${ids.length>1?'s':''} supprimé${ids.length>1?'s':''}`);
        M.state.incBulkSel.clear(); M.state.incBulkMode = false; M.go('incidents');
      });
    }
  });

  M.renderIncidentDetail = function(id) {
    const i = M.charger('incidents').find(x => x.id === id);
    if (!i) return `<div class="m-empty"><div class="m-empty-icon">⚠️</div><h3 class="m-empty-title">Incident introuvable</h3></div>`;

    const grav = i.gravite || 'moyen';
    const stat = i.statut || 'ouvert';
    const graviteColor = grav === 'grave' ? 'var(--m-red)' : grav === 'moyen' ? 'var(--m-accent)' : 'var(--m-green)';
    const statutColor = (stat === 'ouvert') ? 'var(--m-red)' : (stat === 'encours') ? 'var(--m-accent)' : 'var(--m-green)';

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="width:64px;height:64px;border-radius:50%;background:${graviteColor}22;color:${graviteColor};display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 10px">🚨</div>
        <h2 style="margin:0;font-size:1.2rem;font-weight:700">${M.escHtml(i.client || i.salNom || 'Incident')}</h2>
        <p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">${M.formatDate(i.creeLe || i.date)}</p>
        <div style="margin-top:12px"><button type="button" onclick="MCAm.editerIncident('${M.escHtml(i.id)}')" style="background:var(--m-accent-soft);color:var(--m-accent);border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:8px 16px;font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit">✏️ Modifier</button></div>
      </div>

      <div class="m-card-row">
        <div class="m-card" style="border-left:4px solid ${graviteColor}">
          <div class="m-card-title">Gravité</div>
          <div class="m-card-value" style="font-size:1.1rem;color:${graviteColor};text-transform:capitalize">${grav}</div>
        </div>
        <div class="m-card" style="border-left:4px solid ${statutColor}">
          <div class="m-card-title">Statut</div>
          <div class="m-card-value" style="font-size:1.1rem;color:${statutColor};text-transform:capitalize">${stat}</div>
        </div>
      </div>

      <div class="m-card" style="padding:0">
        ${i.client ? (() => {
          const cli = M.findClientByName(i.client);
          return cli
            ? `<button type="button" onclick="MCAm.openDetail('clients','${M.escHtml(cli.id)}')" style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;background:none;border-top:none;border-left:none;border-right:none;color:inherit;font-family:inherit"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Client</span><span style="font-weight:600;color:var(--m-blue)">${M.escHtml(i.client)} ›</span></button>`
            : `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Client</span><span style="font-weight:500">${M.escHtml(i.client)}</span></div>`;
        })() : ''}
        ${i.salNom ? (() => {
          const sal = i.salId ? M.charger('salaries').find(s => s.id === i.salId) : M.findSalarieByName(i.salNom);
          return sal
            ? `<button type="button" onclick="MCAm.openDetail('salaries','${M.escHtml(sal.id)}')" style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;background:none;border-top:none;border-left:none;border-right:none;color:inherit;font-family:inherit"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Salarié</span><span style="font-weight:600;color:var(--m-blue)">${M.escHtml(i.salNom)} ›</span></button>`
            : `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Salarié</span><span style="font-weight:500">${M.escHtml(i.salNom)}</span></div>`;
        })() : ''}
        ${i.chaufNom ?    `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Chauffeur</span><span style="font-weight:500">${M.escHtml(i.chaufNom)}</span></div>` : ''}
        ${i.numLiv ?      `<div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° livraison</span><span style="font-weight:500">${M.escHtml(i.numLiv)}</span></div>` : ''}
      </div>

      ${i.description ? `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">📝 Description</h3></div><div class="m-card" style="padding:14px;font-size:.88rem;line-height:1.5">${M.escHtml(i.description)}</div></div>` : ''}
    `;
  };

  // ---------- TVA (v3.33 : exigibilite alignee PC, fini le decalage 1 mois) ----------
  M.state.tvaMois = M.moisKey();
  M.state.tvaMoisManuel = false;
  M.state.tvaTab = 'recap'; // recap | collectee | deductible

  // Config TVA partagee avec PC (cle localStorage 'tva_config').
  // Defaults : reel_normal, services, encaissements (defaut transport FR).
  M.getTVAConfig = function() {
    const cfg = M.chargerObj('tva_config') || {};
    const regime = cfg.regime || 'reel_normal';
    return {
      regime,
      activiteType: cfg.activiteType || 'service',
      exigibiliteServices: cfg.exigibiliteServices || 'encaissements',
      periodicite: cfg.periodicite || 'mensuelle',
      defaultRate: M.parseNum(cfg.defaultRate ?? localStorage.getItem('taux_tva')) || 20,
      isVatEnabled: regime !== 'franchise_base'
    };
  };

  // Date a laquelle la TVA d'une livraison devient exigible.
  // - Vente de biens : a la livraison.
  // - Services exigibilite "debits" : a la facturation.
  // - Services exigibilite "encaissements" (defaut transport) : au paiement.
  // Retourne '' si non encore exigible (livraison service non payee en encaissements).
  M.getLivraisonTVAExigibiliteDate = function(l, profile) {
    if (!profile?.isVatEnabled) return '';
    const referenceDate = (l.dateFacture || l.date || '').slice(0, 10);
    if (profile.activiteType === 'goods') return referenceDate;
    if (profile.exigibiliteServices === 'debits') return referenceDate;
    // encaissements : exige paiement
    if ((l.statutPaiement || '') !== 'payé' && l.statutPaiement !== 'paye' && l.statutPaiement !== 'payee') return '';
    return (l.datePaiement || '').slice(0, 10);
  };

  M.register('tva', {
    title: 'TVA',
    render() {
      // Auto-refresh mois courant (cf. fix v3.57 sur Heures)
      if (!M.state.tvaMoisManuel) M.state.tvaMois = M.moisKey();
      const moisSel = M.state.tvaMois;
      const tab = M.state.tvaTab;
      const profile = M.getTVAConfig();

      // BUGFIX v3.63 : pull explicit charges + livraisons + carburant au render.
      // Cas concret : charges de mars 2026 (INPI/QONTO/REGIE PRO) presentes en
      // table public.charges mais absentes du localStorage mobile a la 1re
      // ouverture de l'app -> TVA deductible vide. Le pull ramene les donnees
      // fraiches et re-rend si nouveau contenu detecte.
      if (!M.state._tvaPullDone || M.state._tvaPullMois !== moisSel) {
        M.state._tvaPullDone = true;
        M.state._tvaPullMois = moisSel;
        const adapters = window.DelivProEntityAdapters || {};
        const before = (M.charger('charges').length) + (M.charger('livraisons').length) + (M.charger('carburant').length);
        Promise.allSettled([
          adapters.charges?.pullAll?.(),
          adapters.livraisons?.pullAll?.(),
          adapters.carburant?.pullAll?.()
        ]).then(() => {
          const after = (M.charger('charges').length) + (M.charger('livraisons').length) + (M.charger('carburant').length);
          if (after > before && M.state.currentPage === 'tva') M.go('tva');
        }).catch(() => {});
      }

      // TVA collectee : filter par EXIGIBILITE date (pas date facturation),
      // sinon decalage de 1 mois vs PC quand exigibilite=encaissements.
      const allLivraisons = M.charger('livraisons');
      const livEligibles = [];
      const livEnAttente = [];
      allLivraisons.forEach(l => {
        const exDate = M.getLivraisonTVAExigibiliteDate(l, profile);
        if (exDate && exDate.startsWith(moisSel)) {
          livEligibles.push({ ...l, _exigibiliteDate: exDate });
        } else if (!exDate && (l.date || '').startsWith(moisSel)) {
          // Facturee ce mois mais pas encore payee -> in pending
          livEnAttente.push(l);
        }
      });
      const livraisons = livEligibles;
      const charges = M.charger('charges').filter(c => (c.date || '').startsWith(moisSel));
      const carburant = M.charger('carburant').filter(p => (p.date || '').startsWith(moisSel));

      // TVA collectee : par livraison, base = HT, montant = TVA explicite ou (TTC - HT)
      const livAvecTva = livraisons.map(l => {
        const ht = M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0;
        const ttc = M.parseNum(l.prixTTC) || ht * (1 + (M.parseNum(l.tauxTva || l.tauxTVA) || 0) / 100) || ht * 1.2;
        const tva = M.parseNum(l.tva) || (ttc - ht);
        const taux = M.parseNum(l.tauxTva || l.tauxTVA) || (ht > 0 ? Math.round((tva / ht) * 1000) / 10 : 0);
        return { ...l, _ht: ht, _ttc: ttc, _tva: tva, _taux: taux };
      });
      const tvaCollectee = livAvecTva.reduce((s, l) => s + l._tva, 0);
      const baseCollectee = livAvecTva.reduce((s, l) => s + l._ht, 0);

      // TVA deductible (BUG #1 fixé) : recalcul depuis HT × tauxTVA pour
      // capter les charges PC qui n'ont pas de champ 'tva' stocké.
      // Exclut catégorie 'tva' (= règlements TVA) et charges déjà liées à
      // un plein/entretien (évite double comptage, BUG #2).
      const chargesAvecTva = charges
        .filter(c => c.categorie !== 'tva' && !c.carburantId && !c.entretienId)
        .map(c => {
          const taux = M.parseNum(c.tauxTVA || c.tauxTva) || 0;
          const ttc = M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0;
          const ht = M.parseNum(c.montantHT || c.montantHt) || (taux > 0 ? ttc / (1 + taux/100) : ttc);
          // Priorité : montant TVA saisi manuellement (cas TVA mixte). Fallback : recalcul HT × taux.
          const tvaSaisie = M.parseNum(c.tva);
          const tva = tvaSaisie > 0 ? tvaSaisie : (taux > 0 ? +(ht * taux / 100).toFixed(2) : 0);
          return { ...c, _ht: ht, _ttc: ttc, _tva: tva, _taux: taux };
        })
        .filter(c => c._tva > 0);
      const tvaDeductibleCharges = chargesAvecTva.reduce((s, c) => s + c._tva, 0);
      const baseDeductibleCharges = chargesAvecTva.reduce((s, c) => s + c._ht, 0);

      // Carburant : TVA déductible avec taux véhicule (PC : tvaCarbDeductible
      // ou défaut 80% gasoil / 100% essence / 100% électrique).
      const vehs = M.charger('vehicules');
      const carbAvecTva = carburant.map(p => {
        const taux = M.parseNum(p.tauxTVA || p.tauxTva) || 20;
        const ttc = M.parseNum(p.total) || 0;
        if (ttc <= 0) return null;
        const ht = taux > 0 ? +(ttc / (1 + taux/100)).toFixed(2) : ttc;
        const tvaBrute = +(ttc - ht).toFixed(2);
        const veh = vehs.find(v => v.id === (p.vehiculeId || p.vehId));
        // Taux déductible : config véhicule en priorité, sinon défaut selon carburant
        const carbType = (p.typeCarburant || veh?.typeCarburant || 'gasoil').toLowerCase();
        const tauxDed = M.parseNum(veh?.tvaCarbDeductible) ||
          (carbType === 'essence' ? 100 : (carbType === 'electrique' || carbType === 'hydrogene' ? 100 : 80));
        const tva = +(tvaBrute * tauxDed / 100).toFixed(2);
        return { ...p, _ht: ht, _ttc: ttc, _tva: tva, _taux: taux, _tauxDed: tauxDed,
                 _libelle: (veh?.immat || 'Plein') + ' (' + tauxDed + '%)' };
      }).filter(p => p && p._tva > 0);
      const tvaDeductibleCarburant = carbAvecTva.reduce((s, p) => s + p._tva, 0);
      const baseDeductibleCarburant = carbAvecTva.reduce((s, p) => s + p._ht, 0);

      const tvaDeductible = tvaDeductibleCharges + tvaDeductibleCarburant;
      const aReverser = tvaCollectee - tvaDeductible;
      const enCredit = aReverser < 0;

      const moisOptions = [];
      const now = new Date();
      for (let k = 0; k < 12; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const cle = M.moisKey(d);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      let html = `
        <div style="margin-bottom:14px"><select id="m-tva-mois">${moisOptions.join('')}</select></div>
        <div style="display:flex;gap:6px;margin-bottom:18px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${tab==='recap'?'active':''}" data-tab="recap">📊 Récap</button>
          <button class="m-alertes-chip ${tab==='collectee'?'active':''}" data-tab="collectee">📥 Collectée (${livAvecTva.length})</button>
          <button class="m-alertes-chip ${tab==='deductible'?'active':''}" data-tab="deductible">📤 Déductible (${chargesAvecTva.length + carbAvecTva.length})</button>
        </div>
      `;

      // Franchise en base : pas de TVA collectée ni récupérable (CGI art. 293 B).
      // On masque l'analyse classique et affiche un état dédié.
      if (!profile.isVatEnabled) {
        return html + `<div class="m-empty" style="padding:32px 16px">
          <div class="m-empty-icon">📭</div>
          <h3 class="m-empty-title">Franchise en base</h3>
          <p class="m-empty-text">Ton entreprise n'est pas assujettie à la TVA (article 293 B du CGI).<br>Aucune TVA n'est collectée ni récupérable. Aucune déclaration CA3 à faire.</p>
          <p class="m-empty-text" style="margin-top:14px;font-size:.78rem">Pour activer la TVA, va dans Paramètres → 🧾 TVA → Régime TVA.</p>
        </div>`;
      }

      if (tab === 'recap') {
        // Mode TVA actif (encaissements vs debits) -> info pour comprendre l'exigibilite
        const modeLabel = profile.activiteType === 'goods' ? 'Biens (exigible à la livraison)'
          : profile.exigibiliteServices === 'debits' ? 'Services (exigible à la facture)'
          : 'Services (exigible à l\'encaissement)';
        // Phrase explicative pour eviter que l'utilisateur soit surpris du decalage
        // (ex : facture mars payee en avril -> apparait en avril, pas mars)
        const modeExplain = profile.activiteType !== 'goods' && profile.exigibiliteServices !== 'debits'
          ? 'Une livraison apparaît dans le mois de son <strong>paiement</strong> (pas de sa facturation). C\'est la règle officielle du transport routier.'
          : 'Une livraison apparaît dans le mois de sa facturation.';
        html += `
          <div class="m-card" style="padding:12px 14px;margin-bottom:10px;background:var(--m-accent-soft);font-size:.78rem">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span>⚙️</span>
              <strong>Mode TVA : ${M.escHtml(modeLabel)}</strong>
            </div>
            <div style="color:var(--m-text-muted);line-height:1.45">${modeExplain}</div>
          </div>
          <div class="m-card" style="border-left:4px solid ${enCredit ? 'var(--m-green)' : 'var(--m-red)'};padding:16px;margin-bottom:12px">
            <div class="m-card-title">${enCredit ? 'Crédit TVA' : 'TVA à reverser'}</div>
            <div class="m-card-value" style="color:${enCredit ? 'var(--m-green)' : 'var(--m-red)'};font-size:1.8rem">${M.format$(Math.abs(aReverser))}</div>
            <div class="m-card-sub">${enCredit ? 'Récupérable auprès du Trésor' : 'À déclarer ce mois'}</div>
          </div>
          ${livEnAttente.length ? `
            <div class="m-card" style="padding:12px 14px;margin-bottom:12px;background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.22)">
              <div style="font-size:.85rem;font-weight:700;margin-bottom:4px">📅 Facturé mais non exigible</div>
              <div style="font-size:.74rem;color:var(--m-text-muted);line-height:1.4">${livEnAttente.length} livraison${livEnAttente.length>1?'s':''} facturée${livEnAttente.length>1?'s':''} ce mois, en attente de paiement avant exigibilité TVA.</div>
            </div>
          ` : ''}
          <div class="m-card-row">
            <div class="m-card m-card-green"><div class="m-card-title">Collectée</div><div class="m-card-value" style="font-size:1.1rem">${M.format$(tvaCollectee)}</div><div class="m-card-sub">${livAvecTva.length} livraison${livAvecTva.length>1?'s':''}</div></div>
            <div class="m-card m-card-blue"><div class="m-card-title">Déductible</div><div class="m-card-value" style="font-size:1.1rem">${M.format$(tvaDeductible)}</div><div class="m-card-sub">${chargesAvecTva.length} charge${chargesAvecTva.length>1?'s':''}</div></div>
          </div>
          <div class="m-card" style="padding:0">
            <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Base collectée HT</span><span style="font-weight:600">${M.format$(baseCollectee)}</span></div>
            <div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Base déductible HT</span><span style="font-weight:600">${M.format$(baseDeductibleCharges + baseDeductibleCarburant)}</span></div>
          </div>
          <p style="font-size:.75rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
            Récap simplifié. La déclaration officielle CA3 doit être saisie sur impots.gouv.fr (pas générée par l'app).
          </p>
        `;
      }

      if (tab === 'collectee') {
        if (!livAvecTva.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">📥</div><h3 class="m-empty-title">Aucune livraison ce mois</h3></div>`;
        } else {
          html += `<div class="m-card" style="padding:0">
            ${livAvecTva.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(l => `
              <div style="padding:12px 14px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:start;gap:10px">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:500;font-size:.9rem">${M.escHtml(l.client || '—')}${l.numLiv ? ' · ' + M.escHtml(l.numLiv) : ''}</div>
                  <div style="color:var(--m-text-muted);font-size:.76rem;margin-top:2px">${M.formatDate(l.date)} · HT ${M.format$(l._ht)} · ${l._taux.toFixed(1)}%</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:700;color:var(--m-green);white-space:nowrap">${M.format$(l._tva)}</div>
                  <div style="font-size:.7rem;color:var(--m-text-muted);margin-top:2px">TTC ${M.format$(l._ttc)}</div>
                </div>
              </div>
            `).join('').replace(/border-bottom:1px solid var\(--m-border\);(?=[^;]*style[^>]*>$|[^"]*">[^<]*<\/div>\s*$)/, '')}
          </div>
          <div class="m-card" style="margin-top:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;background:var(--m-accent-soft)">
            <span style="font-weight:600">Total TVA collectée</span>
            <span style="font-weight:700;color:var(--m-green);font-size:1.1rem">${M.format$(tvaCollectee)}</span>
          </div>`;
        }
      }

      if (tab === 'deductible') {
        const allDed = [...chargesAvecTva.map(c => ({ ...c, _src: 'charge' })),
                        ...carbAvecTva.map(c => ({ ...c, _src: 'carb' }))];
        if (!allDed.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">📤</div><h3 class="m-empty-title">Aucune TVA déductible ce mois</h3><p class="m-empty-text">Charges et carburant avec TVA apparaissent ici.</p></div>`;
        } else {
          html += `<div class="m-card" style="padding:0">
            ${allDed.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(c => {
              const lbl = c._src === 'carb'
                ? '⛽ ' + M.escHtml(c._libelle || 'Carburant')
                : M.escHtml(c.libelle || c.fournisseur || '—');
              const cat = c._src === 'carb' ? 'carburant' : (c.categorie || '');
              return `<div style="padding:12px 14px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:start;gap:10px">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:500;font-size:.9rem">${lbl}</div>
                  <div style="color:var(--m-text-muted);font-size:.76rem;margin-top:2px">${M.formatDate(c.date)} · HT ${M.format$(c._ht)} · ${c._taux.toFixed(1)}%${cat ? ' · ' + M.escHtml(cat) : ''}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:700;color:var(--m-blue);white-space:nowrap">${M.format$(c._tva)}</div>
                  <div style="font-size:.7rem;color:var(--m-text-muted);margin-top:2px">TTC ${M.format$(c._ttc)}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="m-card" style="margin-top:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;background:var(--m-accent-soft)">
            <span style="font-weight:600">Total TVA déductible</span>
            <span style="font-weight:700;color:var(--m-blue);font-size:1.1rem">${M.format$(tvaDeductible)}</span>
          </div>`;
        }
      }

      return html;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-tva-mois');
      if (sel) sel.addEventListener('change', e => {
        M.state.tvaMois = e.target.value;
        M.state.tvaMoisManuel = true;
        M.go('tva');
      });
      container.querySelectorAll('.m-alertes-chip[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.tvaTab = btn.dataset.tab; M.go('tva'); });
      });
    }
  });

  // ---------- Statistiques (v2.9 : KPI clés du mois + comparatif) ----------
  M.state.statsMois = M.moisKey();
  M.state.statsMoisManuel = false;
  M.state.statsUnit = M.state.statsUnit || 'k'; // 'k' = milliers (compact) | 'eur' = précis
  // Format barre : compact (10k) ou précis (10 234€) selon toggle
  M.fmtBar = function(n) {
    const v = Number(n) || 0;
    if (v <= 0) return '';
    if (M.state.statsUnit === 'eur') return Math.round(v).toLocaleString('fr-FR') + '€';
    return Math.round(v / 1000) + 'k';
  };
  M.register('statistiques', {
    title: 'Statistiques',
    render() {
      // Auto-refresh mois courant (cf. fix v3.57)
      if (!M.state.statsMoisManuel) M.state.statsMois = M.moisKey();
      const moisSel = M.state.statsMois;
      const [y, m] = moisSel.split('-');
      const moisPrec = M.moisKey(new Date(parseInt(y), parseInt(m) - 2, 1));

      const livraisons = M.charger('livraisons');
      const carburant  = M.charger('carburant');
      const charges    = M.charger('charges');
      const salaries   = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
      const vehicules  = M.charger('vehicules').filter(v => v && !v.archive);

      const livMois = livraisons.filter(l => (l.date || '').startsWith(moisSel));
      const livPrec = livraisons.filter(l => (l.date || '').startsWith(moisPrec));
      const carbMois = carburant.filter(p => (p.date || '').startsWith(moisSel));
      const chargesMois = charges.filter(c => (c.date || '').startsWith(moisSel));

      const ca = livMois.reduce((s, l) => s + (M.parseNum(l.prix) || 0), 0);
      const caPrec = livPrec.reduce((s, l) => s + (M.parseNum(l.prix) || 0), 0);
      const evolCa = caPrec > 0 ? ((ca - caPrec) / caPrec * 100) : (ca > 0 ? 100 : 0);
      const km = livMois.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
      const kmPrec = livPrec.reduce((s, l) => s + (M.parseNum(l.distance) || 0), 0);
      const evolKm = kmPrec > 0 ? ((km - kmPrec) / kmPrec * 100) : (km > 0 ? 100 : 0);

      const moisOptions = [];
      const now = new Date();
      for (let k = 0; k < 12; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const cle = M.moisKey(d);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      const evolBadge = (val) => {
        const color = val > 0 ? 'var(--m-green)' : val < 0 ? 'var(--m-red)' : 'var(--m-text-muted)';
        const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '→';
        return `<span style="color:${color};font-weight:700;font-size:.78rem">${arrow} ${Math.abs(val).toFixed(0)}%</span>`;
      };

      return `
        <div style="margin-bottom:14px"><select id="m-stats-mois">${moisOptions.join('')}</select></div>

        <div class="m-card-row">
          <div class="m-card m-card-green"><div class="m-card-title">CA du mois HT</div><div class="m-card-value">${M.format$(ca)}</div><div class="m-card-sub">${evolBadge(evolCa)} vs précédent</div></div>
          <div class="m-card m-card-blue"><div class="m-card-title">Livraisons</div><div class="m-card-value">${livMois.length}</div><div class="m-card-sub">${evolBadge(livMois.length - livPrec.length)} vs précédent</div></div>
        </div>
        <div class="m-card-row">
          <div class="m-card m-card-accent"><div class="m-card-title">Panier moyen</div><div class="m-card-value">${M.format$(livMois.length > 0 ? ca / livMois.length : 0)}</div><div class="m-card-sub">par livraison</div></div>
          <div class="m-card m-card-purple"><div class="m-card-title">Km parcourus</div><div class="m-card-value">${M.formatNum(km.toFixed(0))}</div><div class="m-card-sub">${evolBadge(evolKm)} vs précédent</div></div>
        </div>
        <div class="m-card-row">
          <div class="m-card m-card-red"><div class="m-card-title">Pleins</div><div class="m-card-value">${carbMois.length}</div><div class="m-card-sub">${M.format$(carbMois.reduce((s,p)=>s+(M.parseNum(p.total)||0),0))}</div></div>
          <div class="m-card"><div class="m-card-title">€/km</div><div class="m-card-value" style="font-size:1.3rem">${M.format$(km > 0 ? ca / km : 0)}</div><div class="m-card-sub">prix moyen</div></div>
        </div>

        ${(() => {
          // Comparatif annuel : barres CA des 12 derniers mois (SVG simple, pas Chart.js)
          const now = new Date();
          const mois12 = [];
          for (let k = 11; k >= 0; k--) {
            const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
            const cle = M.moisKey(d);
            const caM = livraisons.filter(l => (l.date || '').startsWith(cle))
              .reduce((s, l) => s + (M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0), 0);
            const labelM = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.','');
            mois12.push({ cle, label: labelM, ca: caM });
          }
          const maxCa = Math.max(...mois12.map(x => x.ca), 1);
          const totalAn = mois12.reduce((s, x) => s + x.ca, 0);
          const moyenneAn = totalAn / 12;

          return `<div class="m-section"><div class="m-section-header" style="gap:6px;flex-wrap:wrap"><h3 class="m-section-title">📈 CA des 12 derniers mois</h3>
            <div style="display:flex;gap:4px;margin-left:auto">
              <button class="m-alertes-chip ${M.state.statsUnit==='k'?'active':''}" data-unit="k" style="font-size:.68rem;padding:2px 8px;min-height:0;height:24px">k€</button>
              <button class="m-alertes-chip ${M.state.statsUnit==='eur'?'active':''}" data-unit="eur" style="font-size:.68rem;padding:2px 8px;min-height:0;height:24px">précis</button>
            </div>
            <span style="font-size:.78rem;color:var(--m-text-muted);width:100%;text-align:right">${M.format$(totalAn)}</span></div>
            <div class="m-card" style="padding:14px">
              <div style="display:flex;align-items:flex-end;gap:4px;height:120px;padding-bottom:4px">
                ${mois12.map(x => {
                  const h = maxCa > 0 ? (x.ca / maxCa * 100) : 0;
                  const isCurrent = x.cle === moisSel;
                  const color = isCurrent ? 'var(--m-accent)' : x.ca > 0 ? 'var(--m-green)' : 'var(--m-border)';
                  return `<div style="flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%">
                    <div style="font-size:.62rem;color:var(--m-text-muted);height:14px;line-height:14px">${M.fmtBar(x.ca)}</div>
                    <div style="flex:1 1 auto;display:flex;align-items:flex-end;width:100%">
                      <div style="width:100%;height:${h}%;background:${color};border-radius:3px 3px 0 0;min-height:${x.ca > 0 ? '2px' : '0'}"></div>
                    </div>
                    <div style="font-size:.65rem;color:${isCurrent?'var(--m-accent)':'var(--m-text-muted)'};font-weight:${isCurrent?700:500}">${x.label}</div>
                  </div>`;
                }).join('')}
              </div>
              <div style="border-top:1px solid var(--m-border);padding-top:10px;margin-top:10px;display:flex;justify-content:space-between;font-size:.78rem">
                <span style="color:var(--m-text-muted)">Moyenne mensuelle</span>
                <span style="font-weight:600">${M.format$(moyenneAn)}</span>
              </div>
            </div>
          </div>`;
        })()}

        ${(() => {
          // Comparatif annuel charges + carburant : barres rouges 12 mois
          const now = new Date();
          const mois12 = [];
          for (let k = 11; k >= 0; k--) {
            const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
            const cle = M.moisKey(d);
            const totalCharges = charges.filter(c => (c.date || '').startsWith(cle))
              .reduce((s, c) => s + (M.parseNum(c.montantTtc) || M.parseNum(c.montant) || 0), 0);
            const totalCarb = carburant.filter(p => (p.date || '').startsWith(cle))
              .reduce((s, p) => s + (M.parseNum(p.total) || 0), 0);
            const labelM = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.','');
            mois12.push({ cle, label: labelM, total: totalCharges + totalCarb });
          }
          const maxDep = Math.max(...mois12.map(x => x.total), 1);
          const totalAnDep = mois12.reduce((s, x) => s + x.total, 0);
          const moyenneAnDep = totalAnDep / 12;
          if (totalAnDep === 0) return '';

          return `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">💸 Dépenses des 12 derniers mois</h3><span style="font-size:.78rem;color:var(--m-text-muted)">${M.format$(totalAnDep)}</span></div>
            <div class="m-card" style="padding:14px">
              <div style="display:flex;align-items:flex-end;gap:4px;height:120px;padding-bottom:4px">
                ${mois12.map(x => {
                  const h = maxDep > 0 ? (x.total / maxDep * 100) : 0;
                  const isCurrent = x.cle === moisSel;
                  const color = isCurrent ? 'var(--m-accent)' : x.total > 0 ? 'var(--m-red)' : 'var(--m-border)';
                  return `<div style="flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%">
                    <div style="font-size:.62rem;color:var(--m-text-muted);height:14px;line-height:14px">${M.fmtBar(x.total)}</div>
                    <div style="flex:1 1 auto;display:flex;align-items:flex-end;width:100%">
                      <div style="width:100%;height:${h}%;background:${color};border-radius:3px 3px 0 0;min-height:${x.total > 0 ? '2px' : '0'}"></div>
                    </div>
                    <div style="font-size:.65rem;color:${isCurrent?'var(--m-accent)':'var(--m-text-muted)'};font-weight:${isCurrent?700:500}">${x.label}</div>
                  </div>`;
                }).join('')}
              </div>
              <div style="border-top:1px solid var(--m-border);padding-top:10px;margin-top:10px;display:flex;justify-content:space-between;font-size:.78rem">
                <span style="color:var(--m-text-muted)">Moyenne mensuelle</span>
                <span style="font-weight:600">${M.format$(moyenneAnDep)}</span>
              </div>
            </div>
          </div>`;
        })()}

        ${(() => {
          // Top 5 du mois : clients, chauffeurs, vehicules par CA
          if (livMois.length === 0) return '';
          const aggreg = (keyFn, labelFn) => {
            const map = new Map();
            livMois.forEach(l => {
              const k = keyFn(l);
              if (!k) return;
              const cur = map.get(k) || { ca: 0, n: 0 };
              cur.ca += M.parseNum(l.prix) || M.parseNum(l.prixHT) || 0;
              cur.n += 1;
              map.set(k, cur);
            });
            return [...map.entries()]
              .map(([k, v]) => ({ label: labelFn(k), ca: v.ca, n: v.n }))
              .sort((a, b) => b.ca - a.ca)
              .slice(0, 5);
          };
          const topClients = aggreg(l => (l.client || '').trim().toLowerCase(), k => k.replace(/^./, c => c.toUpperCase()));
          const topChauf = aggreg(l => l.salarieId || l.chaufId || l.chauffeur, k => {
            const s = salaries.find(x => x.id === k);
            return s ? ((s.prenom ? s.prenom + ' ' : '') + (s.nom || '')).trim() : k;
          });
          const topVeh = aggreg(l => l.vehiculeId || l.vehId, k => {
            const v = M.charger('vehicules').find(x => x.id === k);
            return v ? (v.immat || v.modele || k) : k;
          });
          const renderTop = (titre, icon, list) => {
            if (!list.length) return '';
            const max = Math.max(...list.map(x => x.ca), 1);
            return `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">${icon} Top ${titre} du mois</h3></div>
              <div class="m-card" style="padding:0">
                ${list.map((x, i) => {
                  const pct = max > 0 ? (x.ca / max * 100) : 0;
                  return `<div style="padding:12px 14px;${i < list.length - 1 ? 'border-bottom:1px solid var(--m-border);' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                      <span style="font-weight:600;font-size:.92rem">${i + 1}. ${M.escHtml(x.label || '—')}</span>
                      <span style="font-weight:700;color:var(--m-green);font-size:.92rem">${M.format$(x.ca)}</span>
                    </div>
                    <div style="height:4px;background:var(--m-border);border-radius:2px;overflow:hidden;margin-bottom:4px">
                      <div style="height:100%;width:${pct}%;background:var(--m-accent)"></div>
                    </div>
                    <div style="font-size:.72rem;color:var(--m-text-muted)">${x.n} livraison${x.n > 1 ? 's' : ''}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          };
          return renderTop('clients', '🏆', topClients) + renderTop('chauffeurs', '🥇', topChauf) + renderTop('véhicules', '🚐', topVeh);
        })()}

        <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">📊 Vue d'ensemble</h3></div>
          <div class="m-card" style="padding:0">
            <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span>👥 Équipe active</span><span style="font-weight:600">${salaries.length}</span></div>
            <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span>🚐 Véhicules</span><span style="font-weight:600">${vehicules.length}</span></div>
            <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span>📦 Livraisons total</span><span style="font-weight:600">${livraisons.length}</span></div>
            <div style="padding:14px 16px;display:flex;justify-content:space-between"><span>💸 Charges du mois</span><span style="font-weight:600">${M.format$(chargesMois.reduce((s,c)=>s+(M.parseNum(c.montantTtc)||M.parseNum(c.montant)||0),0))}</span></div>
          </div>
        </div>

        <p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
          Pour les graphiques d'évolution annuelle, exports et comparatifs avancés, ouvre la version PC.
        </p>
      `;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-stats-mois');
      if (sel) sel.addEventListener('change', e => {
        M.state.statsMois = e.target.value;
        M.state.statsMoisManuel = true;
        M.go('statistiques');
      });
      // Toggle K€ / précis sur les graphiques
      container.querySelectorAll('button[data-unit]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.statsUnit = btn.dataset.unit; M.go('statistiques'); });
      });
    }
  });

  // ---------- Calendrier (v3.26 : vue jour + plannings + jours feries + echeances) ----------
  M.state.calendrierDate = new Date().toISOString().slice(0, 10);

  // Jours feries FR (port de script.js : feriesDeLAnnee + paquesDate)
  M._feriesCache = {};
  M.paquesDate = function(year) {
    const a = year % 19, b = Math.floor(year/100), c = year % 100;
    const d = Math.floor(b/4), e = b % 4;
    const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3);
    const h = (19*a + b - d - g + 15) % 30;
    const i = Math.floor(c/4), k = c % 4;
    const L = (32 + 2*e + 2*i - h - k) % 7;
    const m = Math.floor((a + 11*h + 22*L)/451);
    const month = Math.floor((h + L - 7*m + 114) / 31);
    const day = ((h + L - 7*m + 114) % 31) + 1;
    return new Date(year, month-1, day);
  };
  M.feriesDeLAnnee = function(year) {
    if (M._feriesCache[year]) return M._feriesCache[year];
    const paques = M.paquesDate(year);
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
    const list = [
      { date: new Date(year, 0, 1),   nom: "Jour de l'An" },
      { date: addDays(paques, 1),     nom: 'Lundi de Pâques' },
      { date: new Date(year, 4, 1),   nom: 'Fête du Travail' },
      { date: new Date(year, 4, 8),   nom: 'Victoire 1945' },
      { date: addDays(paques, 39),    nom: 'Ascension' },
      { date: addDays(paques, 50),    nom: 'Lundi de Pentecôte' },
      { date: new Date(year, 6, 14),  nom: 'Fête Nationale' },
      { date: new Date(year, 7, 15),  nom: 'Assomption' },
      { date: new Date(year, 10, 1),  nom: 'Toussaint' },
      { date: new Date(year, 10, 11), nom: 'Armistice 1918' },
      { date: new Date(year, 11, 25), nom: 'Noël' }
    ];
    M._feriesCache[year] = list;
    return list;
  };
  M.feriePourDate = function(iso) {
    const d = new Date(iso);
    return M.feriesDeLAnnee(d.getFullYear()).find(f => f.date.toISOString().slice(0,10) === iso) || null;
  };

  M.register('calendrier', {
    title: 'Calendrier',
    render() {
      const dateSel = M.state.calendrierDate;
      const livraisons = M.charger('livraisons').filter(l => l.date === dateSel);
      const carburant = M.charger('carburant').filter(p => p.date === dateSel);
      const entretiens = M.charger('entretiens').filter(e => e.date === dateSel);
      const incidents = M.charger('incidents').filter(i => (i.date || (i.creeLe||'').slice(0,10)) === dateSel);

      // Echeances charges impayees : date_echeance ou date + delaiPaiement
      const charges = M.charger('charges').filter(c => {
        if (c.statut === 'paye' || c.statut === 'payee') return false;
        const ech = c.dateEcheance || c.date_echeance;
        if (ech === dateSel) return true;
        return false;
      });

      // Plannings du jour : qui travaille / conge / repos
      const d = new Date(dateSel);
      const jourIdx = (d.getDay() + 6) % 7; // 0 = lundi
      const jourCle = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'][jourIdx];
      const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
      const plannings = M.charger('plannings');
      const auTravail = [];
      const enConge = [];
      salaries.forEach(sal => {
        const planning = plannings.find(p => p.salId === sal.id);
        const jourData = planning?.semaine?.find(j => j.jour === jourCle);
        if (!jourData) return;
        const t = jourData.typeJour || (jourData.travaille ? 'travail' : 'repos');
        if (t === 'travail') auTravail.push({ sal, jourData });
        else if (t === 'conge' || t === 'absence' || t === 'maladie') enConge.push({ sal, jourData, type: t });
      });

      const ferie = M.feriePourDate(dateSel);
      const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
      const estAujourd = dateSel === new Date().toISOString().slice(0, 10);

      // Nav prev/next
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      const next = new Date(d); next.setDate(next.getDate() + 1);

      const totalEvenements = livraisons.length + carburant.length + entretiens.length + incidents.length + charges.length + auTravail.length + enConge.length;

      let html = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <button class="m-cal-nav" data-date="${prev.toISOString().slice(0,10)}" style="flex:0 0 44px;height:44px;border-radius:50%;background:var(--m-bg-elevated);border:1px solid var(--m-border);color:var(--m-text);font-size:1.2rem">‹</button>
          <div style="flex:1 1 auto;text-align:center">
            <div style="font-weight:700;font-size:1rem">${dateLabel}</div>
            ${estAujourd ? `<div style="font-size:.72rem;color:var(--m-accent);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Aujourd'hui</div>` : ''}
          </div>
          <button class="m-cal-nav" data-date="${next.toISOString().slice(0,10)}" style="flex:0 0 44px;height:44px;border-radius:50%;background:var(--m-bg-elevated);border:1px solid var(--m-border);color:var(--m-text);font-size:1.2rem">›</button>
        </div>
        <div style="text-align:center;margin-bottom:14px">
          <input type="date" id="m-cal-picker" value="${dateSel}" style="max-width:200px;display:inline-block" />
          ${!estAujourd ? `<button class="m-cal-today" style="margin-left:8px;padding:0 14px;height:48px;border-radius:10px;background:var(--m-accent);color:#1a1208;border:none;font-weight:600">Aujourd'hui</button>` : ''}
        </div>
        ${ferie ? `<div class="m-card" style="background:#fee2e2;color:#991b1b;border-left:3px solid #dc2626;padding:12px 14px;margin-bottom:12px;font-weight:600">🎉 ${M.escHtml(ferie.nom)} (jour férié)</div>` : ''}
      `;

      if (!totalEvenements) {
        html += `<div class="m-empty"><div class="m-empty-icon">📅</div><h3 class="m-empty-title">Rien à signaler</h3><p class="m-empty-text">Aucune livraison, plein, entretien, incident ou planning pour cette journée.</p></div>`;
        return html;
      }

      const renderEvents = (title, items, color, renderItem) => {
        if (!items.length) return '';
        return `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title" style="color:${color}">${title}</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${items.length}</span></div>${items.map(renderItem).join('')}</div>`;
      };

      html += renderEvents('📦 Livraisons', livraisons, 'var(--m-blue)', l => `
        <div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-blue);display:flex;justify-content:space-between;gap:10px">
          <div style="flex:1 1 auto;min-width:0"><div style="font-weight:600;font-size:.92rem">${M.escHtml(l.client || '—')}</div><div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${l.numLiv ? M.escHtml(l.numLiv) + ' · ' : ''}${l.distance ? M.formatNum(l.distance) + ' km' : ''}</div></div>
          <div style="font-weight:700;color:var(--m-green);white-space:nowrap">${M.format$(l.prix || 0)}</div>
        </div>`);
      html += renderEvents('⛽ Pleins', carburant, 'var(--m-red)', p => `
        <div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-red);display:flex;justify-content:space-between;gap:10px">
          <div style="flex:1 1 auto;min-width:0"><div style="font-weight:500;font-size:.88rem">${M.formatNum((p.litres||0).toFixed(0))} L · ${p.kmCompteur ? M.formatNum(p.kmCompteur)+' km' : ''}</div></div>
          <div style="font-weight:700;color:var(--m-red);white-space:nowrap">${M.format$(p.total || 0)}</div>
        </div>`);
      html += renderEvents('🔧 Entretiens', entretiens, 'var(--m-blue)', e => `
        <div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-blue);display:flex;justify-content:space-between;gap:10px">
          <div style="flex:1 1 auto;min-width:0"><div style="font-weight:500;font-size:.88rem">${M.escHtml(e.type || 'Entretien')}</div>${e.description ? `<div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${M.escHtml(e.description)}</div>` : ''}</div>
          <div style="font-weight:700;color:var(--m-blue);white-space:nowrap">${M.format$(e.cout || 0)}</div>
        </div>`);
      html += renderEvents('🚨 Incidents', incidents, 'var(--m-red)', i => `
        <div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-red)">
          <div style="font-weight:500;font-size:.88rem">${M.escHtml(i.client || i.salNom || 'Incident')}</div>
          ${i.description ? `<div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px;line-height:1.4">${M.escHtml(i.description.slice(0, 120))}${i.description.length > 120 ? '…' : ''}</div>` : ''}
        </div>`);
      html += renderEvents('⏰ Échéances charges', charges, 'var(--m-accent)', c => `
        <div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-accent);display:flex;justify-content:space-between;gap:10px">
          <div style="flex:1 1 auto;min-width:0"><div style="font-weight:600;font-size:.92rem">${M.escHtml(c.libelle || c.fournisseur || '—')}</div>${c.fournisseur && c.libelle ? `<div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${M.escHtml(c.fournisseur)}</div>` : ''}</div>
          <div style="font-weight:700;color:var(--m-accent);white-space:nowrap">${M.format$(c.montantTtc || c.montant || 0)}</div>
        </div>`);
      html += renderEvents('👥 Au travail', auTravail, 'var(--m-green)', ({ sal, jourData }) => {
        const horaires = jourData?.heureDebut && jourData?.heureFin ? `${jourData.heureDebut}–${jourData.heureFin}` : 'Présent';
        return `<div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-green);display:flex;justify-content:space-between;gap:10px">
          <div style="flex:1 1 auto;min-width:0"><div style="font-weight:600;font-size:.92rem">${M.escHtml((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || ''))}</div><div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${horaires}${jourData?.zone ? ' · ' + M.escHtml(jourData.zone) : ''}</div></div>
        </div>`;
      });
      html += renderEvents('🏖️ Absences', enConge, 'var(--m-text-muted)', ({ sal, type }) => {
        const labels = { conge: 'Congé', absence: 'Absence', maladie: 'Maladie' };
        return `<div class="m-card" style="padding:12px 14px;border-left:3px solid var(--m-border);display:flex;justify-content:space-between;gap:10px;opacity:.85">
          <div style="flex:1 1 auto;min-width:0"><div style="font-weight:600;font-size:.92rem">${M.escHtml((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || ''))}</div><div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${labels[type] || type}</div></div>
        </div>`;
      });

      return html;
    },
    afterRender(container) {
      container.querySelectorAll('.m-cal-nav').forEach(btn => {
        btn.addEventListener('click', () => { M.state.calendrierDate = btn.dataset.date; M.go('calendrier'); });
      });
      const picker = container.querySelector('#m-cal-picker');
      if (picker) picker.addEventListener('change', e => { M.state.calendrierDate = e.target.value; M.go('calendrier'); });
      const today = container.querySelector('.m-cal-today');
      if (today) today.addEventListener('click', () => { M.state.calendrierDate = new Date().toISOString().slice(0, 10); M.go('calendrier'); });
    }
  });

  // ---------- Audit log (v3.49 : lecture journal mobile + écriture pour saisies mobile) ----------
  // Mirror du PC ajouterEntreeAudit (script-core-audit.js). Stockage 'audit_log',
  // partagé via Supabase storage-sync donc les actions PC remontent ici aussi.
  // Actor label = admin_nom mobile ou 'Admin (mobile)' par défaut.
  M.ajouterAudit = function(action, detail, meta) {
    try {
      const logs = M.charger('audit_log');
      logs.push({
        id: M.genId(),
        date: new Date().toISOString(),
        admin: (sessionStorage.getItem('admin_nom') || 'Admin') + ' (mobile)',
        action: action || 'Action',
        detail: detail || '—',
        meta: meta || {}
      });
      while (logs.length > 400) logs.shift();
      M.sauvegarder('audit_log', logs);
    } catch (_) { /* non bloquant */ }
  };

  M.register('audit', {
    title: 'Journal d\'audit',
    render() {
      const logs = M.charger('audit_log').slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 100);
      if (!logs.length) {
        return `<div class="m-empty"><div class="m-empty-icon">📜</div><h3 class="m-empty-title">Journal vide</h3><p class="m-empty-text">Les actions admin (création, modification, suppression) apparaitront ici. Le journal est partagé entre PC et mobile.</p></div>`;
      }
      let html = `<p style="font-size:.78rem;color:var(--m-text-muted);margin:0 0 12px">${logs.length} dernière${logs.length>1?'s':''} action${logs.length>1?'s':''} (max 400 stockées)</p>`;
      // Group par jour
      const byDay = {};
      logs.forEach(l => {
        const d = (l.date || '').slice(0, 10);
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(l);
      });
      Object.keys(byDay).forEach(jour => {
        const dateLabel = jour ? new Date(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase()) : 'Sans date';
        html += `<div class="m-section">
          <div class="m-section-header"><h3 class="m-section-title" style="font-size:.92rem">${dateLabel}</h3><span style="font-size:.78rem;color:var(--m-text-muted)">${byDay[jour].length}</span></div>
          ${byDay[jour].map(l => {
            const heure = l.date ? new Date(l.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
            return `<div class="m-card" style="padding:10px 12px;margin-bottom:6px">
              <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.86rem">${M.escHtml(l.action || 'Action')}</div>
                  <div style="color:var(--m-text-muted);font-size:.74rem;margin-top:2px;line-height:1.4">${M.escHtml(l.detail || '—').slice(0, 200)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;font-size:.7rem;color:var(--m-text-muted);white-space:nowrap">
                  <div>${heure}</div>
                  <div style="font-weight:500">${M.escHtml(l.admin || 'Admin').slice(0, 16)}</div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      });
      return html;
    }
  });

  // ---------- Recherche globale (v3.49 : toutes entités confondues) ----------
  // Recherche full-text sur livraisons + clients + fournisseurs + véhicules +
  // salariés + charges + entretiens + carburant + incidents + inspections.
  // Match sur tous les champs textuels significatifs. Tap sur un résultat
  // ouvre la fiche/édition correspondante.
  M.state.rechercheGlobaleQ = '';
  M.register('recherche', {
    title: 'Recherche',
    render() {
      const q = (M.state.rechercheGlobaleQ || '').trim().toLowerCase();
      let html = `
        <div style="margin-bottom:14px">
          <input type="search" id="m-rg-input" placeholder="🔍 Tape ce que tu cherches (client, immat, n°, montant...)" value="${M.escHtml(M.state.rechercheGlobaleQ)}" autocomplete="off" autofocus />
        </div>
      `;
      if (!q || q.length < 2) {
        html += `<div class="m-empty"><div class="m-empty-icon">🔍</div><h3 class="m-empty-title">Recherche dans tout le site</h3><p class="m-empty-text">Tape au moins 2 caractères pour chercher dans toutes les entités : livraisons, clients, fournisseurs, véhicules, salariés, charges, entretiens, carburant, incidents.</p></div>`;
        return html;
      }

      const matches = (txt) => txt && String(txt).toLowerCase().includes(q);

      const sections = [
        {
          key: 'livraisons', icon: '📦', label: 'Livraisons', open: 'editerLivraison',
          items: M.charger('livraisons').filter(l =>
            matches(l.client) || matches(l.numLiv) || matches(l.depart) || matches(l.arrivee)
            || matches(l.zone) || matches(l.notes) || matches(l.expNom) || matches(l.destNom)
            || matches((Number(l.prix) || Number(l.prixHT) || '').toString())
          ).map(l => ({
            id: l.id,
            titre: l.client || '—',
            sous: `${M.formatDate(l.date)}${l.numLiv ? ' · ' + l.numLiv : ''}${l.distance ? ' · ' + l.distance + ' km' : ''}`,
            valeur: M.format$(l.prix || l.prixHT || 0)
          }))
        },
        {
          key: 'clients', icon: '🧑‍💼', label: 'Clients', open: 'openDetail',
          openArg: 'clients',
          items: M.charger('clients').filter(c =>
            matches(c.nom) || matches(c.prenom) || matches(c.email) || matches(c.tel) || matches(c.ville) || matches(c.siren) || matches(c.tva)
          ).map(c => ({
            id: c.id,
            titre: ((c.prenom ? c.prenom + ' ' : '') + (c.nom || '')).trim() || '—',
            sous: [c.ville, c.tel].filter(Boolean).join(' · ') || '',
            valeur: ''
          }))
        },
        {
          key: 'fournisseurs', icon: '🏭', label: 'Fournisseurs', open: 'openDetail',
          openArg: 'fournisseurs',
          items: M.charger('fournisseurs').filter(f =>
            matches(f.nom) || matches(f.email) || matches(f.tel) || matches(f.ville) || matches(f.siret) || matches(f.iban)
          ).map(f => ({
            id: f.id,
            titre: f.nom || '—',
            sous: [f.ville, f.tel].filter(Boolean).join(' · ') || '',
            valeur: ''
          }))
        },
        {
          key: 'vehicules', icon: '🚐', label: 'Véhicules', open: 'openDetail',
          openArg: 'vehicules',
          items: M.charger('vehicules').filter(v =>
            matches(v.immat) || matches(v.modele) || matches(v.marque) || matches(v.salNom) || matches(v.typeCarburant)
          ).map(v => ({
            id: v.id,
            titre: v.immat || '—',
            sous: [v.marque, v.modele].filter(Boolean).join(' ') || (v.typeCarburant || ''),
            valeur: v.km ? M.formatNum(v.km) + ' km' : ''
          }))
        },
        {
          key: 'salaries', icon: '👥', label: 'Salariés', open: 'openDetail',
          openArg: 'salaries',
          items: M.charger('salaries').filter(s => !s.archive && (
            matches(s.nom) || matches(s.prenom) || matches(s.email) || matches(s.tel) || matches(s.numero) || matches(s.poste)
          )).map(s => ({
            id: s.id,
            titre: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || '')).trim() || '—',
            sous: [s.poste, s.numero].filter(Boolean).join(' · ') || '',
            valeur: ''
          }))
        },
        {
          key: 'charges', icon: '💸', label: 'Charges', open: 'editerCharge',
          items: M.charger('charges').filter(c =>
            matches(c.libelle) || matches(c.fournisseur) || matches(c.categorie)
            || matches((Number(c.montantTtc) || Number(c.montant) || '').toString())
          ).map(c => ({
            id: c.id,
            titre: c.libelle || c.fournisseur || 'Charge',
            sous: `${M.formatDate(c.date)}${c.categorie ? ' · ' + c.categorie : ''}`,
            valeur: M.format$(c.montantTtc || c.montant || 0)
          }))
        },
        {
          key: 'carburant', icon: '⛽', label: 'Carburant', open: 'editerPlein',
          items: M.charger('carburant').filter(p => {
            const veh = M.indexVehicules()[p.vehiculeId || p.vehId];
            return matches(veh?.immat) || matches((Number(p.total) || '').toString()) || matches((Number(p.litres) || '').toString());
          }).map(p => {
            const veh = M.indexVehicules()[p.vehiculeId || p.vehId];
            return {
              id: p.id,
              titre: (veh?.immat || 'Plein') + ' · ' + (p.litres ? p.litres + ' L' : ''),
              sous: M.formatDate(p.date),
              valeur: M.format$(p.total || 0)
            };
          })
        },
        {
          key: 'entretiens', icon: '🔧', label: 'Entretiens', open: 'editerEntretien',
          items: M.charger('entretiens').filter(e => {
            const veh = M.indexVehicules()[e.vehiculeId || e.vehId];
            return matches(veh?.immat) || matches(e.type) || matches(e.description);
          }).map(e => {
            const veh = M.indexVehicules()[e.vehiculeId || e.vehId];
            return {
              id: e.id,
              titre: (veh?.immat || '—') + ' · ' + (e.type || 'Entretien'),
              sous: `${M.formatDate(e.date)}${e.description ? ' · ' + e.description.slice(0, 40) : ''}`,
              valeur: M.format$(e.cout || e.coutTtc || 0)
            };
          })
        },
        {
          key: 'incidents', icon: '🚨', label: 'Incidents', open: 'editerIncident',
          items: M.charger('incidents').filter(i =>
            matches(i.description) || matches(i.client) || matches(i.salNom) || matches(i.gravite) || matches(i.statut)
          ).map(i => ({
            id: i.id,
            titre: (i.client || i.salNom || 'Incident'),
            sous: `${M.formatDate(i.date || i.creeLe)}${i.gravite ? ' · ' + i.gravite : ''}`,
            valeur: i.statut || ''
          }))
        },
      ];

      const totalCount = sections.reduce((s, sec) => s + sec.items.length, 0);
      if (totalCount === 0) {
        html += `<div class="m-empty"><div class="m-empty-icon">🤷</div><h3 class="m-empty-title">Aucun résultat pour "${M.escHtml(q)}"</h3><p class="m-empty-text">Essaie un autre mot-clé.</p></div>`;
        return html;
      }

      html += `<p style="font-size:.78rem;color:var(--m-text-muted);margin:0 0 12px">${totalCount} résultat${totalCount>1?'s':''} pour "<strong>${M.escHtml(q)}</strong>"</p>`;

      sections.forEach(sec => {
        if (!sec.items.length) return;
        html += `<div class="m-section">
          <div class="m-section-header"><h3 class="m-section-title">${sec.icon} ${sec.label}</h3><span style="font-size:.85rem;color:var(--m-text-muted)">${sec.items.length}</span></div>
          ${sec.items.slice(0, 10).map(it => {
            const onClick = sec.openArg
              ? `MCAm.${sec.open}('${sec.openArg}','${M.escHtml(it.id)}')`
              : `MCAm.${sec.open}('${M.escHtml(it.id)}')`;
            return `<button type="button" class="m-card m-card-pressable" onclick="${onClick}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:14px;margin-bottom:8px;color:inherit;font-family:inherit">
              <div style="flex:1 1 auto;min-width:0">
                <div style="font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(it.titre)}</div>
                ${it.sous ? `<div style="color:var(--m-text-muted);font-size:.76rem;margin-top:2px">${M.escHtml(it.sous)}</div>` : ''}
              </div>
              ${it.valeur ? `<div style="font-weight:700;font-size:.85rem;white-space:nowrap;flex-shrink:0">${M.escHtml(it.valeur)}</div>` : ''}
            </button>`;
          }).join('')}
          ${sec.items.length > 10 ? `<p style="font-size:.74rem;color:var(--m-text-muted);text-align:center;margin:4px 0 0">… et ${sec.items.length - 10} autre${sec.items.length-10>1?'s':''}</p>` : ''}
        </div>`;
      });

      return html;
    },
    afterRender(container) {
      const inp = container.querySelector('#m-rg-input');
      if (inp) {
        let timer;
        inp.addEventListener('input', e => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            M.state.rechercheGlobaleQ = e.target.value;
            M.go('recherche');
          }, 350);
        });
        // Préserve focus + caret
        if (M.state.rechercheGlobaleQ) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }
    }
  });

  // ---------- Parametres (v2.9 : info entreprise + actions) ----------
  M.register('parametres', {
    title: 'Paramètres',
    render() {
      const config = M.chargerObj('config') || {};
      const entreprise = config.entreprise || M.chargerObj('entreprise') || {};
      const adminNom = sessionStorage.getItem('admin_nom') || 'Admin';
      const adminLogin = sessionStorage.getItem('admin_login') || '';
      const tvaProfile = M.getTVAConfig();
      const regimeLabel = ({
        franchise_base: 'Franchise en base',
        reel_simplifie: 'Réel simplifié',
        reel_normal: 'Réel normal'
      })[tvaProfile.regime] || tvaProfile.regime;
      const periodLabel = ({
        mensuelle: 'Mensuelle',
        trimestrielle: 'Trimestrielle',
        annuelle: 'Annuelle'
      })[tvaProfile.periodicite] || tvaProfile.periodicite;
      const exigLabel = tvaProfile.activiteType === 'goods'
        ? 'Livraison (biens)'
        : (tvaProfile.exigibiliteServices === 'debits' ? 'Facturation (débits)' : 'Encaissement');

      return `
        <div style="text-align:center;padding:8px 0 18px">
          <div style="width:64px;height:64px;border-radius:14px;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 10px">⚙️</div>
          <h2 style="margin:0;font-size:1.2rem;font-weight:700">Paramètres</h2>
        </div>

        <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">👤 Compte</h3></div>
          <div class="m-card" style="padding:0">
            <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Nom</span><span style="font-weight:500">${M.escHtml(adminNom)}</span></div>
            ${adminLogin ? `<div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Identifiant</span><span style="font-weight:500">${M.escHtml(adminLogin)}</span></div>` : ''}
          </div>
        </div>

        ${entreprise.nom || entreprise.siret ? `
          <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">🏢 Entreprise</h3></div>
            <div class="m-card" style="padding:0">
              ${entreprise.nom ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Raison sociale</span><span style="font-weight:500">${M.escHtml(entreprise.nom)}</span></div>` : ''}
              ${entreprise.siret ?   `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">SIRET</span><span style="font-weight:500">${M.escHtml(entreprise.siret)}</span></div>` : ''}
              ${entreprise.tva ?     `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° TVA</span><span style="font-weight:500">${M.escHtml(entreprise.tva)}</span></div>` : ''}
              ${entreprise.adresse ? `<div style="padding:14px 16px;display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Adresse</span><span style="font-weight:500;font-size:.85rem;text-align:right">${M.escHtml(entreprise.adresse)}</span></div>` : ''}
            </div>
          </div>
        ` : ''}

        <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">🧾 TVA</h3></div>
          <div class="m-card" style="padding:0">
            <button type="button" id="m-param-tva-regime" class="m-card-pressable" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px 16px;border:none;background:transparent;border-bottom:1px solid var(--m-border);color:inherit;text-align:left;font-family:inherit;cursor:pointer">
              <span style="font-size:.85rem">Régime TVA</span>
              <span style="font-weight:600;font-size:.85rem">${M.escHtml(regimeLabel)} ›</span>
            </button>
            <button type="button" id="m-param-tva-exig" class="m-card-pressable" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px 16px;border:none;background:transparent;border-bottom:1px solid var(--m-border);color:inherit;text-align:left;font-family:inherit;cursor:pointer;${tvaProfile.regime === 'franchise_base' ? 'opacity:.4;pointer-events:none' : ''}">
              <span style="font-size:.85rem">Exigibilité</span>
              <span style="font-weight:600;font-size:.85rem">${M.escHtml(exigLabel)} ›</span>
            </button>
            <button type="button" id="m-param-tva-period" class="m-card-pressable" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px 16px;border:none;background:transparent;color:inherit;text-align:left;font-family:inherit;cursor:pointer;${tvaProfile.regime === 'franchise_base' ? 'opacity:.4;pointer-events:none' : ''}">
              <span style="font-size:.85rem">Périodicité déclaration</span>
              <span style="font-weight:600;font-size:.85rem">${M.escHtml(periodLabel)} ›</span>
            </button>
          </div>
          <p class="m-form-hint" style="margin-top:8px">Encaissement = TVA exigible au paiement (défaut transport). Débits = à la facturation.</p>
        </div>

        <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">Sécurité</h3></div>
          <button class="m-card m-card-pressable" id="m-param-mdp" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px;text-align:left;color:inherit;font-family:inherit;border:1px solid var(--m-border)">
            <span style="font-size:.95rem;font-weight:500">Modifier mon mot de passe</span>
            <span style="color:var(--m-text-muted);font-size:1rem">›</span>
          </button>
          <p class="m-form-hint" style="margin-top:8px">Synchronisé avec Supabase Auth. Utiliser un mot de passe fort (12+ caractères, mélange).</p>
        </div>

        <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">Affichage</h3></div>
          <button class="m-card m-card-pressable" id="m-param-theme" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px;text-align:left;color:inherit;font-family:inherit">
            <span style="font-size:.95rem;font-weight:500">Mode clair / sombre</span>
            <span style="color:var(--m-text-muted);font-size:.85rem">${M.state.theme === 'light' ? 'Clair' : 'Sombre'}</span>
          </button>
        </div>

        <div class="m-section">
          <button class="m-btn m-btn-danger" id="m-param-logout">Déconnexion</button>
        </div>

        <p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
          Modification de l'entreprise, gestion des utilisateurs, sauvegarde et options avancées sont sur la version PC.
        </p>
      `;
    },
    afterRender(container) {
      // Helper : sauvegarde tva_config et refresh
      const saveTvaConfig = (patch) => {
        const cur = M.chargerObj('tva_config') || {};
        const next = Object.assign({}, cur, patch);
        M.sauvegarder('tva_config', next);
        M.toast('✅ Config TVA mise à jour');
        M.go('parametres');
      };
      // Dialog choix régime
      container.querySelector('#m-param-tva-regime')?.addEventListener('click', async () => {
        const choice = await M.dialogChoix({
          titre: '🧾 Régime TVA',
          options: [
            { value: 'franchise_base', label: 'Franchise en base (pas de TVA)' },
            { value: 'reel_simplifie', label: 'Réel simplifié' },
            { value: 'reel_normal',    label: 'Réel normal' }
          ],
          defaut: M.getTVAConfig().regime
        });
        if (choice) saveTvaConfig({ regime: choice });
      });
      container.querySelector('#m-param-tva-exig')?.addEventListener('click', async () => {
        const choice = await M.dialogChoix({
          titre: 'Exigibilité services',
          sousTitre: 'Quand la TVA devient-elle exigible ?',
          options: [
            { value: 'encaissements', label: 'Encaissement (défaut transport)' },
            { value: 'debits',        label: 'Débits (à la facturation)' }
          ],
          defaut: M.getTVAConfig().exigibiliteServices
        });
        if (choice) saveTvaConfig({ exigibiliteServices: choice });
      });
      container.querySelector('#m-param-tva-period')?.addEventListener('click', async () => {
        const choice = await M.dialogChoix({
          titre: 'Périodicité déclaration',
          options: [
            { value: 'mensuelle',     label: 'Mensuelle' },
            { value: 'trimestrielle', label: 'Trimestrielle' },
            { value: 'annuelle',      label: 'Annuelle' }
          ],
          defaut: M.getTVAConfig().periodicite
        });
        if (choice) saveTvaConfig({ periodicite: choice });
      });
      container.querySelector('#m-param-mdp')?.addEventListener('click', () => M.formChangerMdpAdmin());
      container.querySelector('#m-param-theme')?.addEventListener('click', M.toggleTheme);
      container.querySelector('#m-param-logout')?.addEventListener('click', M.logout);
    }
  });

  // ============================================================
  // Modification mot de passe administrateur (mobile)
  // Pattern : sheet 3 champs (actuel / nouveau / confirmer).
  // 1) Validation locale (champs remplis, qualite, correspondance)
  // 2) Verification mdp actuel via signInWithPassword Supabase
  // 3) Update via client.auth.updateUser({password})
  // 4) Sync localStorage admin_accounts (hash bcrypt-like) pour login offline
  // ============================================================
  M.formChangerMdpAdmin = function() {
    const body = `
      ${M.formField('Mot de passe actuel',
        `<input type="password" name="actuel" autocomplete="current-password" required style="width:100%" />`,
        { required: true })}
      ${M.formField('Nouveau mot de passe',
        `<input type="password" name="nouveau" autocomplete="new-password" required minlength="8" style="width:100%" />`,
        { required: true, hint: 'Minimum 8 caractères, majuscules + chiffres + caractère spécial recommandés.' })}
      ${M.formField('Confirmer le nouveau mot de passe',
        `<input type="password" name="confirmer" autocomplete="new-password" required minlength="8" style="width:100%" />`,
        { required: true })}
    `;

    M.openSheet({
      title: 'Modifier mot de passe',
      body: body,
      submitLabel: 'Mettre à jour',
      onSubmit: async (sheetBody) => {
        const actuel    = sheetBody.querySelector('[name="actuel"]')?.value || '';
        const nouveau   = sheetBody.querySelector('[name="nouveau"]')?.value || '';
        const confirmer = sheetBody.querySelector('[name="confirmer"]')?.value || '';

        if (!actuel || !nouveau || !confirmer) {
          M.toast('Remplis tous les champs', { duration: 4000 });
          return false;
        }
        if (nouveau.length < 8) {
          M.toast('Le nouveau mot de passe doit faire au moins 8 caractères', { duration: 4000 });
          return false;
        }
        if (nouveau !== confirmer) {
          M.toast('La confirmation ne correspond pas', { duration: 4000 });
          return false;
        }
        if (nouveau === actuel) {
          M.toast('Le nouveau mot de passe est identique à l\'actuel', { duration: 4000 });
          return false;
        }

        const ds = window.DelivProSupabase;
        const client = (ds && typeof ds.getClient === 'function') ? ds.getClient() : null;
        if (!client) {
          M.toast('Supabase indisponible — réessaie plus tard', { duration: 5000 });
          return false;
        }

        // 1. Recuperer l'email de la session actuelle
        let email = '';
        try {
          const { data: { user } } = await client.auth.getUser();
          email = user?.email || '';
        } catch (_) {}
        if (!email) {
          M.toast('Session admin introuvable, reconnecte-toi', { duration: 5000 });
          return false;
        }

        // 2. Verifier le mdp actuel via signInWithPassword
        const verif = await client.auth.signInWithPassword({ email: email, password: actuel });
        if (verif.error) {
          M.toast('Mot de passe actuel incorrect', { duration: 4000 });
          return false;
        }

        // 3. Update le mdp via Supabase Auth
        const upd = await client.auth.updateUser({ password: nouveau });
        if (upd.error) {
          M.toast('Erreur Supabase : ' + upd.error.message, { duration: 6000 });
          return false;
        }

        // 4. Mettre a jour le hash local (admin_accounts) pour le login offline
        try {
          const accounts = JSON.parse(localStorage.getItem('admin_accounts') || '[]');
          const sessionLogin = sessionStorage.getItem('admin_login') || '';
          const idx = accounts.findIndex(a => a && a.identifiant === sessionLogin);
          if (idx >= 0 && window.SecurityUtils?.hashPassword) {
            accounts[idx].motDePasseHash = await window.SecurityUtils.hashPassword(nouveau);
            delete accounts[idx].motDePasse;
            localStorage.setItem('admin_accounts', JSON.stringify(accounts));
          }
        } catch (e) {
          console.warn('[mdp] hash local non mis a jour :', e?.message);
          // Pas bloquant : Supabase a deja le nouveau mdp.
        }

        M.toast('Mot de passe mis à jour', { duration: 4000 });
        return true;
      }
    });
  };

  // ============================================================
  // Logout
  // ============================================================
  M.logout = async function() {
    // M.confirm est async et marche en PWA standalone iOS (window.confirm peut etre bloque).
    if (!await M.confirm('Se déconnecter ?', { titre: 'Déconnexion' })) return;
    sessionStorage.clear();
    window.location.replace('login.html');
  };

  // ============================================================
  // Init / wiring
  // ============================================================
  // Init Supabase remote sync : pull latest data from Supabase, hooks setItem
  // pour push automatique des saisies mobile. Echoue silencieusement si pas de
  // session Supabase (dans ce cas, les saisies restent locales et seront sync
  // au prochain ouverture desktop).
  // Tente de creer une session Supabase pour permettre le sync.
  // Le login mobile (login.html connecterAdminLocal) ne cree qu'une session
  // sessionStorage locale, pas une vraie JWT Supabase. Sans JWT, le
  // storage-sync bootstrap() return tot et rien n'est pousse vers Supabase.
  // -> on tente signInAnonymously() qui cree une vraie session JWT
  // (necessite que "Anonymous Sign-Ins" soit active dans Supabase Auth settings).
  // Si ca echoue (anon desactive), on log + fallback (la sync reste cassee
  // mais l'app fonctionne en local).
  async function ensureSupabaseSession() {
    const ds = window.DelivProSupabase;
    if (!ds || typeof ds.getClient !== 'function') return false;
    const client = ds.getClient();
    if (!client?.auth) return false;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (session) return true; // deja une session, tout va bien
      // Pas de session -> tentative anonyme
      const { data, error } = await client.auth.signInAnonymously();
      if (error) {
        console.warn('[mobile] signInAnonymously failed:', error.message,
          '— Active "Anonymous Sign-Ins" dans Supabase Auth Settings pour activer la sync mobile.');
        return false;
      }
      console.log('[mobile] Session anonyme creee', data?.session?.user?.id);
      return true;
    } catch (e) {
      console.warn('[mobile] ensureSupabaseSession error', e);
      return false;
    }
  }

  async function initRemoteSync() {
    // 1. S'assurer qu'on a une session Supabase (sinon storage-sync.bootstrap return tot)
    await ensureSupabaseSession();
    // 2. Lancer le sync proprement dit
    if (!window.DelivProRemoteStorage || typeof window.DelivProRemoteStorage.init !== 'function') return;
    try {
      const result = await window.DelivProRemoteStorage.init();
      // Refresh la page courante avec les donnees fraiches Supabase
      if (M.state.currentPage) M.go(M.state.currentPage);
      M.updateAlertesBadge();
      return result;
    } catch (err) {
      console.warn('[mobile] DelivProRemoteStorage init', err);
    }
  }

  function init() {
    if (!M.verifierAuth()) return;
    M.applyTheme();
    // Migration silencieuse : harmonise les schemas mobile/PC avant le 1er render
    M.migrerSchemas();
    M.updateAlertesBadge();

    // Bottom tabs
    $$('.m-tab').forEach(tab => {
      tab.addEventListener('click', () => M.go(tab.dataset.page));
    });

    // Drawer links
    $$('.m-drawer-link[data-page]').forEach(link => {
      link.addEventListener('click', () => M.go(link.dataset.page));
    });

    // Drawer special actions
    $('#m-drawer-close')?.addEventListener('click', M.closeDrawer);
    $('#m-drawer-overlay')?.addEventListener('click', M.closeDrawer);
    $('#m-toggle-theme')?.addEventListener('click', M.toggleTheme);
    $('#m-logout')?.addEventListener('click', M.logout);

    // Sheet handlers (saisie rapide)
    $('#m-sheet-overlay')?.addEventListener('click', M.closeSheet);
    $('#m-sheet-close')?.addEventListener('click', M.closeSheet);
    $('#m-sheet-cancel')?.addEventListener('click', M.closeSheet);
    $('#m-sheet-submit')?.addEventListener('click', M.submitSheet);
    // Submit avec Enter UNIQUEMENT depuis input single-line (pas textarea/select/button).
    // Avant : Enter declenchait submit dans n'importe quel target (select, button, etc.).
    $('#m-sheet-body')?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const t = e.target;
      if (!t.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=file])')) return;
      e.preventDefault();
      M.submitSheet();
    });

    // Back button (vues detail clients/vehicules/salaries) : retour a la liste
    $('#m-back-btn')?.addEventListener('click', () => {
      // Cherche un detail actif sur la page courante et le ferme
      const page = M.state.currentPage;
      if (page && M.state.detail && M.state.detail[page]) {
        M.state.detail[page] = null;
        M.go(page);
        return;
      }
      // Fallback : back stack (pas utilise pour l'instant)
      if (M.state.backStack.length) M.go(M.state.backStack.pop());
    });

    // Helper pour ouvrir un detail
    M.openDetail = function(entity, id) {
      if (!M.state.detail) M.state.detail = {};
      M.state.detail[entity] = id;
      M.go(entity);
    };

    // Initial route : dashboard ou page demandee via #
    const initialPage = (location.hash || '').replace('#', '') || 'dashboard';
    M.go(initialPage in M.routes ? initialPage : 'dashboard');

    // Auto-refresh badge alertes toutes les 30s + vérif docs/véhicules toutes les heures.
    // Garde une référence pour éviter la duplication si init() est rappelé (HMR/reload).
    if (M._intBadge) clearInterval(M._intBadge);
    if (M._intDocs)  clearInterval(M._intDocs);
    if (M._toDocs)   clearTimeout(M._toDocs);
    M._intBadge = setInterval(M.updateAlertesBadge, 30000);
    M._toDocs   = setTimeout(() => { M.lancerVerifDocs(); M.updateAlertesBadge(); }, 1000);
    M._intDocs  = setInterval(() => { M.lancerVerifDocs(); M.updateAlertesBadge(); }, 3600000);

    // Lance le sync Supabase en arriere-plan (delay 200ms pour laisser le 1er
    // render se faire vite avec les donnees localStorage cachees, puis
    // refresh une fois la version Supabase recue).
    setTimeout(initRemoteSync, 200);

    // Realtime : ecoute les events de sync emis par supabase-storage-sync.
    // Helper : true si une bottom-sheet est ouverte (saisie en cours).
    // On ne doit PAS re-render dans ce cas, sinon innerHTML wipe -> form perdu.
    const sheetOuvert = () => {
      const sheet = document.getElementById('m-sheet');
      return sheet && !sheet.hidden && sheet.getAttribute('aria-hidden') !== 'true';
    };

    // Quand le PC modifie des donnees, l'event 'delivpro:remote-update' est
    // dispatche apres applyRemoteSnapshot -> on re-render la page courante
    // pour afficher les nouvelles donnees sans avoir besoin de tirer manuellement.
    window.addEventListener('delivpro:remote-update', () => {
      if (sheetOuvert()) { M.updateAlertesBadge(); return; } // skip re-render si saisie en cours
      if (M.state.currentPage) M.go(M.state.currentPage);
      M.updateAlertesBadge();
    });

    // Quand l'app revient au premier plan (visibility), le storage-sync fait
    // un pullLatest automatique. On force aussi un re-render pour etre sur
    // que la page affiche les dernieres donnees recues.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && M.state.currentPage) {
        setTimeout(() => {
          if (sheetOuvert()) { M.updateAlertesBadge(); return; }
          M.go(M.state.currentPage);
          M.updateAlertesBadge();
        }, 600);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
