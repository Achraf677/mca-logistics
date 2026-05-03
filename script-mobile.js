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
        ${M.formField('TVA', M.formInputWithSuffix('tva', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: v.tva || '' }), { hint: 'Calcul auto' })}
        ${M.formField('Prix TTC', M.formInputWithSuffix('prixTTC', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: v.prixTTC || '' }), { hint: 'Calcul auto' })}
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
        <button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:14px">🗑️ Supprimer cette livraison</button>
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
        let dernierEdit = 'ht';
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
        // Bouton supprimer + liens vers entites liees (mode edition)
        if (enEdition) {
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm(`Supprimer définitivement cette livraison (${v.client || ''}) ?`, { titre: 'Supprimer livraison' })) return;
            M.sauvegarder('livraisons', M.charger('livraisons').filter(x => x.id !== v.id));
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
        { value: 'essence',    label: '⛽ Essence' },
        { value: 'gnv',        label: '🌿 GNV/BioGNV' },
        { value: 'electrique', label: '⚡ Électrique' },
        { value: 'hybride',    label: '🔋 Hybride' },
        { value: 'hydrogene',  label: '💧 Hydrogène' }
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
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:14px">🗑️ Supprimer ce plein</button>` : ''}
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
        const recalc = () => {
          if (!total.value && litres.value && prixL.value) {
            total.value = (M.parseNum(litres.value) * M.parseNum(prixL.value)).toFixed(2);
          }
        };
        litres.addEventListener('input', recalc);
        prixL.addEventListener('input', recalc);
        // Auto-remplit le type carburant depuis le vehicule selectionne (si non deja choisi par user)
        if (vehSelect && carbSelect) {
          vehSelect.addEventListener('change', () => {
            if (carbSelect.value) return; // ne pas ecraser un choix manuel
            const v = vehicules.find(x => x.id === vehSelect.value);
            if (v?.typeCarburant) carbSelect.value = v.typeCarburant;
          });
        }
        if (enEdition) {
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm('Supprimer définitivement ce plein ?', { titre: 'Supprimer plein' })) return;
            M.sauvegarder('carburant', M.charger('carburant').filter(x => x.id !== p.id));
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
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === p.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('carburant', arr);
          M.toast('✅ Plein modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('carburant', arr);
          M.toast('✅ Plein enregistré');
        }
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
        ${M.formField('TVA', M.formInputWithSuffix('tva', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: c.tva || '' }), { hint: 'Calcul auto' })}
        ${M.formField('Montant TTC', M.formInputWithSuffix('montantTtc', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: c.montantTtc || c.montant || '', required: true }), { required: true, hint: 'Calcul auto' })}
      </div>
      ${M.formField('Catégorie', M.formSelect('categorie', [
        { value: 'carburant',  label: '⛽ Carburant' },
        { value: 'peage',      label: '🛣️ Péage' },
        { value: 'entretien',  label: '🔧 Entretien' },
        { value: 'assurance',  label: '🛡️ Assurance' },
        { value: 'salaires',   label: '👥 Salaires' },
        { value: 'lld_credit', label: '🚐 LLD / Crédit' },
        { value: 'tva',        label: '🧾 TVA' },
        { value: 'autre',      label: '📝 Autre' }
      ], { placeholder: 'Choisir une catégorie', value: c.categorie || '' }))}
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
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:14px">🗑️ Supprimer cette charge</button>` : ''}
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
        if (enEdition) {
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm(`Supprimer définitivement cette charge (${c.libelle || ''}) ?`, { titre: 'Supprimer charge' })) return;
            M.sauvegarder('charges', M.charger('charges').filter(x => x.id !== c.id));
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
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === c.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('charges', arr);
          M.toast('✅ Charge modifiée');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('charges', arr);
          M.toast('✅ Charge enregistrée');
        }
        M.go('charges');
        return true;
      }
    });
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
        { value: 'essence',    label: '⛽ Essence' },
        { value: 'gnv',        label: '🌿 GNV/BioGNV' },
        { value: 'electrique', label: '⚡ Électrique' },
        { value: 'hybride',    label: '🔋 Hybride' },
        { value: 'hydrogene',  label: '💧 Hydrogène' }
      ], { placeholder: 'Choisir', value: v.typeCarburant || '' }))}
      ${M.formField('Vidange tous les', M.formInputWithSuffix('entretienIntervalKm', 'km', { type: 'number', step: '500', min: '0', placeholder: '15000', value: v.entretienIntervalKm || '' }))}
      ${M.formField('Chauffeur attribué', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { placeholder: 'Aucun', value: v.salId || '' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer ce véhicule</button>` : ''}
    `;
    M.openSheet({
      title: enEdition ? '✏️ Modifier véhicule' : '➕ Nouveau véhicule',
      body,
      submitLabel: 'Enregistrer',
      afterMount(b) {
        if (!enEdition) return;
        b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
          if (!await M.confirm(`Supprimer définitivement le véhicule ${v.immat} ?`, { titre: 'Supprimer véhicule' })) return;
          M.sauvegarder('vehicules', M.charger('vehicules').filter(x => x.id !== v.id));
          M.toast('🗑️ Véhicule supprimé');
          M.state.detail.vehicules = null;
          M.closeSheet();
          M.go('vehicules');
        });
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
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === v.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('vehicules', arr);
          M.toast('✅ Véhicule modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('vehicules', arr);
          M.toast('✅ Véhicule enregistré');
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
          if (!await M.confirm(`Supprimer définitivement ${s.prenom || ''} ${s.nom || ''} ?`, { titre: 'Supprimer salarié' })) return;
          M.sauvegarder('salaries', M.charger('salaries').filter(x => x.id !== s.id));
          M.toast('🗑️ Salarié supprimé');
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
        const data = {
          prenom: f.prenom?.trim() || '',
          nom: f.nom.trim(),
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
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === s.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('salaries', arr);
          M.toast('✅ Salarié modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('salaries', arr);
          M.toast('✅ Salarié enregistré');
        }
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
      ${M.formField('Salarié (effectue par)', M.formSelect('salId', salaries.map(s => ({ value: s.id, label: ((s.prenom ? s.prenom + ' ' : '') + (s.nom || s.id)).trim() })), { placeholder: 'Aucun', value: insp.salId || '' }))}
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
          { value: 'faible', label: '🟢 Faible' },
          { value: 'moyen',  label: '🟠 Moyen' },
          { value: 'grave',  label: '🔴 Grave' }
        ], { value: inc.gravite || 'moyen' }))}
        ${M.formField('Statut', M.formSelect('statut', [
          { value: 'ouvert',   label: '🔴 Ouvert' },
          { value: 'encours',  label: '🟡 En cours' },
          { value: 'traite',   label: '✅ Traité' }
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
        ${M.formField('Coût TTC', M.formInputWithSuffix('cout', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: e.cout || e.coutTtc || '', required: true }), { required: true, hint: 'Calcul auto' })}
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
        if (enEdition) {
          b.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm('Supprimer définitivement cet entretien ?', { titre: 'Supprimer entretien' })) return;
            M.sauvegarder('entretiens', M.charger('entretiens').filter(x => x.id !== e.id));
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
        if (enEdition) {
          const idx = arr.findIndex(x => x.id === e.id);
          if (idx >= 0) arr[idx] = { ...arr[idx], ...data, modifieLe: new Date().toISOString() };
          M.sauvegarder('entretiens', arr);
          M.toast('✅ Entretien modifié');
        } else {
          arr.push({ id: M.genId(), creeLe: new Date().toISOString(), ...data });
          M.sauvegarder('entretiens', arr);
          M.toast('✅ Entretien enregistré');
        }
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
        { value: 'repos',   label: '😴 Repos' },
        { value: 'conge',   label: '🏖️ Congé' },
        { value: 'absence', label: '⚠️ Absence' },
        { value: 'maladie', label: '🤒 Maladie' }
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
    setTimeout(() => { $('#m-drawer-overlay').hidden = true; }, 220);
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
      const moisCle = now.toISOString().slice(0, 7); // YYYY-MM

      const livraisonsMois = livraisons.filter(l => (l.date || '').startsWith(moisCle));
      const caMoisHt = livraisonsMois.reduce((acc, l) => acc + (Number(l.prix) || Number(l.prixHT) || Number(l.prix_ht) || 0), 0);
      const caMoisTtc = livraisonsMois.reduce((acc, l) => acc + (Number(l.prixTTC) || Number(l.prix_ttc) || (Number(l.prix) || 0) * 1.2), 0);

      // Depenses du mois pour le benefice estime (HT, hors carburant qui est TTC)
      const carbMois = carburant.filter(p => (p.date || '').startsWith(moisCle)).reduce((s, p) => s + (Number(p.total) || 0), 0);
      const entrMois = entretiens.filter(e => (e.date || '').startsWith(moisCle)).reduce((s, e) => s + (Number(e.coutHt) || Number(e.cout) || 0), 0);
      const chargesMois = charges.filter(c => (c.date || '').startsWith(moisCle) && c.categorie !== 'entretien')
        .reduce((s, c) => s + (Number(c.montantHT) || Number(c.montant) || 0), 0);
      const depMois = carbMois + entrMois + chargesMois;
      const beneficeEstime = caMoisHt - depMois;
      const benefColor = beneficeEstime >= 0 ? 'var(--m-green)' : 'var(--m-red)';

      const chargesAPayer = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      const totalImpayes  = chargesAPayer.reduce((acc, c) => acc + (Number(c.montantTtc) || Number(c.montant) || 0), 0);

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
            <div class="m-card-title">📈 Bénéfice estimé</div>
            <div class="m-card-value" style="color:${benefColor}">${M.format$(beneficeEstime)}</div>
            <div class="m-card-sub">CA HT − dépenses</div>
          </div>
        </div>

        <div class="m-card-row">
          <div class="m-card m-card-blue m-card-pressable" onclick="MCAm.go('livraisons')">
            <div class="m-card-title">📦 Livraisons</div>
            <div class="m-card-value">${M.formatNum(livraisonsMois.length)}</div>
            <div class="m-card-sub">ce mois</div>
          </div>
          <div class="m-card m-card-purple m-card-pressable" onclick="MCAm.go('planning')">
            <div class="m-card-title">👤 Au travail</div>
            <div class="m-card-value">${auTravail.length}</div>
            <div class="m-card-sub">aujourd'hui</div>
          </div>
        </div>

        <div class="m-card-row">
          <div class="m-card m-card-red m-card-pressable" onclick="MCAm.go('alertes')">
            <div class="m-card-title">🔔 Alertes</div>
            <div class="m-card-value">${M.formatNum(alertesActives.length)}</div>
            <div class="m-card-sub">${alertesCritiques > 0 ? `🔴 ${alertesCritiques} critique${alertesCritiques>1?'s':''}` : 'à traiter'}</div>
          </div>
          <div class="m-card m-card-accent m-card-pressable" onclick="MCAm.go('charges')">
            <div class="m-card-title">💸 Impayés</div>
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
          <div class="m-card-title">👥 Équipe active</div>
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
      const moisCourant = new Date().toISOString().slice(0, 7);

      // FAB toujours present (position:fixed -> place dans le HTML peu importe)
      let html = `<button class="m-fab" onclick="MCAm.formNouvelleLivraison()" aria-label="Nouvelle livraison">+</button>`;

      const vue = M.state.livraisonsVue;
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
          const total = items.reduce((s, l) => s + (Number(l.prix) || Number(l.prixHT) || 0), 0);
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
        const totalCa = items.reduce((acc, l) => acc + (Number(l.prix) || Number(l.prixHT) || 0), 0);
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
              ${items.map(l => `
                <button type="button" class="m-card m-card-pressable m-liv-edit" data-id="${M.escHtml(l.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit">
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
                </button>
              `).join('')}
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
          }, 220);
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
      // Tap card livraison -> ouvre le form en mode edition
      container.querySelectorAll('.m-liv-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerLivraison(btn.dataset.id));
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

      // Header : selecteur jour de la semaine
      let html = `
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
          const labels = { conge: '🏖️ Congé', absence: '⚠️ Absence', maladie: '🤒 Maladie', repos: '😴 Repos' };
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
      container.querySelectorAll('.m-planning-jour').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.planningJour = parseInt(btn.dataset.jour);
          M.go('planning');
        });
      });
      // Tap salarie -> ouvre sa fiche
      // Tap card salarie -> ouvre form planning pour CE jour selectionne
      // (plus pertinent dans le contexte Planning que d'aller a la fiche salarie)
      container.querySelectorAll('.m-planning-sal').forEach(btn => {
        btn.addEventListener('click', () => M.formPlanningJour(btn.dataset.salId));
      });
    }
  });
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
  };

  // ---------- Alertes (v2.2 : port refonte PR #19 sur mobile) ----------
  // Memes categories / severites que desktop pour coherence visuelle.
  const M_ALERTES_CATEGORIES = [
    // critique = action immediate (securite, conformite, cash)
    { type: 'ct_expire',              severity: 'critique', label: 'CT expirés',                       icon: '⚠️' },
    { type: 'permis_expire',          severity: 'critique', label: 'Permis expirés',                   icon: '🪪' },
    { type: 'assurance_expire',       severity: 'critique', label: 'Assurances expirées',              icon: '🛡️' },
    { type: 'charge_retard_paiement', severity: 'critique', label: 'Charges en retard',                icon: '💸' },
    { type: 'carburant_anomalie',     severity: 'critique', label: 'Anomalies carburant',              icon: '⛽' },
    // alerte = a traiter cette semaine
    { type: 'ct_proche',              severity: 'alerte',   label: 'CT à renouveler',                  icon: '🔔' },
    { type: 'permis_proche',          severity: 'alerte',   label: 'Permis bientôt expirés',           icon: '🪪' },
    { type: 'assurance_proche',       severity: 'alerte',   label: 'Assurances bientôt expirées',      icon: '🛡️' },
    { type: 'vidange',                severity: 'alerte',   label: 'Vidanges',                         icon: '🔧' },
    { type: 'prix_manquant',          severity: 'alerte',   label: 'Prix manquants',                   icon: '💶' },
    { type: 'planning_manquant',      severity: 'alerte',   label: 'Salariés sans planning',           icon: '📅' },
    { type: 'inspection_manquante',   severity: 'alerte',   label: 'Véhicules sans inspection',        icon: '🚗' },
    // info = trace de modif
    { type: 'livraison_modif',        severity: 'info',     label: 'Livraisons modifiées',             icon: '✏️' },
    { type: 'carburant_modif',        severity: 'info',     label: 'Modifs carburant',                 icon: '✏️' },
    { type: 'km_modif',               severity: 'info',     label: 'Modifs km',                        icon: '✏️' },
    { type: 'inspection',             severity: 'info',     label: 'Inspections reçues',               icon: '🚗' },
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

      // Render group par severite -> categorie
      const enModeReportees = statut === 'reportees';
      const enModeTraitees = statut === 'traitees';
      ['critique', 'alerte', 'info'].forEach(sev => {
        const itemsSev = filtered.filter(a => {
          const cat = M_ALERTES_CATEGORIES.find(c => c.type === a.type);
          return cat?.severity === sev;
        });
        if (!itemsSev.length) return;
        const cfg = M_SEVERITES[sev];
        html += `<div style="font-size:.7rem;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:.06em;margin:18px 4px 8px;border-bottom:1px solid ${cfg.color}33;padding-bottom:6px">${cfg.label} — ${itemsSev.length}</div>`;

        // Group par categorie au sein de la severite
        const cats = M_ALERTES_CATEGORIES.filter(c => c.severity === sev);
        cats.forEach(cat => {
          const items = itemsSev.filter(a => a.type === cat.type);
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
          t = setTimeout(() => { M.state.alertesRecherche = e.target.value; M.go('alertes'); }, 220);
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
  M.register('carburant', {
    title: 'Carburant',
    render() {
      const allPleins = M.charger('carburant');
      const vehIdx = M.indexVehicules();
      const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
      const filterVeh = M.state.carburantVehFilter || '';
      const pleins = filterVeh ? allPleins.filter(p => (p.vehiculeId || p.vehId) === filterVeh) : allPleins;

      // KPI mois courant
      const moisCourant = new Date().toISOString().slice(0, 7);
      const pleinsCourants = pleins.filter(p => (p.date || '').startsWith(moisCourant));
      const totalMois = pleinsCourants.reduce((s, p) => s + (Number(p.total) || 0), 0);
      const litresMois = pleinsCourants.reduce((s, p) => s + (Number(p.litres) || 0), 0);
      const prixMoyen = litresMois > 0 ? totalMois / litresMois : 0;

      let html = `<button class="m-fab" onclick="MCAm.formNouveauPlein()" aria-label="Nouveau plein">+</button>`;
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
        const total = items.reduce((s, p) => s + (Number(p.total) || 0), 0);
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
                return `<button type="button" class="m-card m-card-pressable m-carb-edit" data-id="${M.escHtml(p.id)}" style="padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit;display:flex;justify-content:space-between;align-items:start;gap:10px">
                  <div style="flex:1 1 auto;min-width:0">
                    <div style="font-weight:600;font-size:.95rem">${M.escHtml(immat)}</div>
                    <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:3px">${M.formatDate(p.date)}${p.kmCompteur ? ' · ' + M.formatNum(p.kmCompteur) + ' km' : ''}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:700;color:var(--m-red);white-space:nowrap;font-size:.95rem">${M.format$(p.total)}</div>
                    <div style="font-size:.75rem;color:var(--m-text-muted);margin-top:2px">${(Number(p.litres) || 0).toFixed(1)} L${p.prixLitre ? ' · ' + Number(p.prixLitre).toFixed(3) + '€/L' : ''}</div>
                  </div>
                </button>`;
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

  // ---------- Charges (v3.0 : groupees par mois + filtre statut) ----------
  M.state.chargesStatut = 'tous'; // tous | a_payer | paye
  M.state.chargesCategorie = ''; // '' = toutes
  M.state.chargesFournisseur = ''; // '' = tous
  M.state.chargesMoisOuverts = {};
  M.register('charges', {
    title: 'Charges',
    render() {
      const charges = M.charger('charges');
      const moisCourant = new Date().toISOString().slice(0, 7);
      const courantes = charges.filter(c => (c.date || '').startsWith(moisCourant));
      const totalMois = courantes.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
      const aPayer = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      const totalImpayes = aPayer.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);

      const statut = M.state.chargesStatut;
      const cat = M.state.chargesCategorie;
      const fourFilter = M.state.chargesFournisseur || '';
      let filtered = charges;
      if (cat) filtered = filtered.filter(c => (c.categorie || '') === cat);
      if (fourFilter) filtered = filtered.filter(c => (c.fournisseurId === fourFilter) || ((c.fournisseur || '').toLowerCase() === fourFilter.toLowerCase()));
      if (statut === 'a_payer') filtered = filtered.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      if (statut === 'paye')    filtered = filtered.filter(c => c.statut === 'paye' || c.statut === 'payee');

      const sorted = [...filtered].sort((a,b) => (b.date||'').localeCompare(a.date||''));

      let html = `<button class="m-fab" onclick="MCAm.formNouvelleCharge()" aria-label="Nouvelle charge">+</button>`;
      html += `
        <div class="m-card-row">
          <div class="m-card m-card-red">
            <div class="m-card-title">💸 Impayés</div>
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
        const totalMonth = items.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
        const aPayerMonth = items.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
        const totalAPayerMonth = aPayerMonth.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
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
                const montant = Number(c.montantTtc) || Number(c.montant) || 0;
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
                return `<div style="position:relative;margin-bottom:10px">
                  <button type="button" class="m-card m-card-pressable m-charge-edit" data-id="${M.escHtml(c.id)}" style="padding:14px;border-left:4px solid ${borderColor};display:flex;justify-content:space-between;align-items:start;gap:10px;width:100%;text-align:left;background:var(--m-card);border-top:1px solid var(--m-border);border-right:1px solid var(--m-border);border-bottom:1px solid var(--m-border);border-radius:18px;color:inherit;font-family:inherit">
                    <div style="flex:1 1 auto;min-width:0">
                      <div style="font-weight:600;font-size:.95rem;margin-bottom:3px">${M.escHtml(c.libelle || c.fournisseur || 'Charge')}</div>
                      <div style="color:var(--m-text-muted);font-size:.8rem">${M.formatDate(c.date)}${c.fournisseur && c.libelle ? ' · ' + M.escHtml(c.fournisseur) : ''}${c.categorie ? ' · ' + M.escHtml(c.categorie) : ''}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <div style="font-weight:700;white-space:nowrap;font-size:.95rem">${M.format$(montant)}</div>
                      ${statutBadge}
                    </div>
                  </button>
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
      // Tap card charge -> ouvre le form en mode edition
      container.querySelectorAll('.m-charge-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerCharge(btn.dataset.id));
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
  M.state.rentMois = new Date().toISOString().slice(0, 7);
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

      const moisSel = M.state.rentMois;
      const tab     = M.state.rentTab;
      const inMois  = (date) => (date || '').startsWith(moisSel);

      const livMois     = livraisons.filter(l => inMois(l.date));
      const carbMois    = carburant.filter(p => inMois(p.date));
      const entrMois    = entretiens.filter(e => inMois(e.date));
      const chargesMois = charges.filter(c => inMois(c.date) && c.categorie !== 'entretien');

      // KPI globaux du mois (utilises pour le coverage et le cout/km de reference)
      const caTotal = livMois.reduce((s, l) => s + (Number(l.prix) || Number(l.prixHT) || 0), 0);
      const kmTotal = livMois.reduce((s, l) => s + (Number(l.distance) || 0), 0);
      const carbTotal    = carbMois.reduce((s, p) => s + (Number(p.total) || 0), 0);
      const entrTotal    = entrMois.reduce((s, e) => s + (Number(e.cout) || 0), 0);
      const autresTotal  = chargesMois.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
      const depTotal     = carbTotal + entrTotal + autresTotal;
      const profitTotal  = caTotal - depTotal;
      const margeTotal   = caTotal > 0 ? (profitTotal / caTotal * 100) : 0;
      const coutKmRef    = kmTotal > 0 ? depTotal / kmTotal : 0;

      // Selecteur mois
      const moisOptions = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const cle = d.toISOString().slice(0, 7);
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
          <button class="m-alertes-chip ${tab==='devis'?'active':''}" data-tab="devis">🧮 Devis</button>
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
          const ca   = livV.reduce((s, l) => s + (Number(l.prix) || Number(l.prixHT) || 0), 0);
          const carb = carbV.reduce((s, p) => s + (Number(p.total) || 0), 0);
          const entr = entrV.reduce((s, e) => s + (Number(e.cout) || 0), 0);
          const chrg = chrgV.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
          const km   = livV.reduce((s, l) => s + (Number(l.distance) || 0), 0);
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
          byClient[key].ca += Number(l.prix) || Number(l.prixHT) || 0;
          byClient[key].km += Number(l.distance) || 0;
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
          const ca = livS.reduce((sum, l) => sum + (Number(l.prix) || Number(l.prixHT) || 0), 0);
          const km = livS.reduce((sum, l) => sum + (Number(l.distance) || 0), 0);
          // Carburant rattachable si le chauffeur a un vehicule attribue (via veh.salId)
          const vehAttribues = vehicules.filter(v => v.salId === s.id).map(v => v.id);
          const carbS = carbMois.filter(p => vehAttribues.includes(p.vehiculeId)).reduce((sum, p) => sum + (Number(p.total) || 0), 0);
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

      // ---- DEVIS : calculateur de rentabilite avant proposition ----
      if (tab === 'devis') {
        // Persistance : si l'user a explicitement saisi un cout km dans le devis, on le stocke
        // dans localStorage pour le re-utiliser entre sessions et entre PC/mobile.
        const coutStocked = M.parseNum(localStorage.getItem('rent_cout_km_ref'));
        const coutKmStocke = M.state.devisCoutKm != null ? M.state.devisCoutKm
          : (coutStocked > 0 ? coutStocked
          : (kmTotal > 0 ? (carbTotal + entrTotal + autresTotal) / kmTotal : 0.50));
        const prix = M.parseNum(M.state.devisPrix) || 0;
        const km = M.parseNum(M.state.devisKm) || 0;
        const depEstim = km * coutKmStocke;
        const marge = prix - depEstim;
        const margePct = prix > 0 ? (marge / prix * 100) : 0;
        const couleur = margePct >= 25 ? 'var(--m-green)' : margePct >= 15 ? 'var(--m-accent)' : margePct >= 5 ? 'var(--m-red)' : 'var(--m-red)';
        const verdict = margePct >= 25 ? '🟢 Excellente' : margePct >= 15 ? '🟡 Acceptable' : margePct >= 5 ? '🟠 Limite' : margePct >= 0 ? '🔴 À renégocier' : '🔴 PERTE';

        html += `
          <p style="font-size:.78rem;color:var(--m-text-muted);margin:0 0 14px;line-height:1.4">💡 Estime la rentabilité d'une nouvelle livraison avant de proposer un prix au client.</p>
          <div class="m-card" style="padding:18px;margin-bottom:14px">
            <div class="m-form-row" style="margin-bottom:0">
              <div class="m-form-field" style="margin-bottom:0">
                <label class="m-form-label">Prix proposé HT</label>
                <div class="m-form-input-suffix">
                  <input type="number" id="m-devis-prix" step="0.01" min="0" placeholder="0.00" value="${prix > 0 ? prix : ''}" />
                  <span class="m-form-input-suffix-text">€</span>
                </div>
              </div>
              <div class="m-form-field" style="margin-bottom:0">
                <label class="m-form-label">Distance</label>
                <div class="m-form-input-suffix">
                  <input type="number" id="m-devis-km" step="0.1" min="0" placeholder="0" value="${km > 0 ? km : ''}" />
                  <span class="m-form-input-suffix-text">km</span>
                </div>
              </div>
            </div>
            <div class="m-form-field" style="margin-bottom:0;margin-top:14px">
              <label class="m-form-label">Coût km de référence</label>
              <div class="m-form-input-suffix">
                <input type="number" id="m-devis-coutkm" step="0.01" min="0" placeholder="0.50" value="${coutKmStocke.toFixed(2)}" />
                <span class="m-form-input-suffix-text">€/km</span>
              </div>
              <p class="m-form-hint">Calculé auto depuis tes dépenses (${M.format$((carbTotal + entrTotal + autresTotal))} / ${M.formatNum(kmTotal.toFixed(0))} km). Ajustable.</p>
            </div>
          </div>

          ${prix > 0 && km > 0 ? `
            <div class="m-card" style="border-left:4px solid ${couleur};padding:18px;margin-bottom:12px">
              <div class="m-card-title">${verdict}</div>
              <div class="m-card-value" style="color:${couleur};font-size:1.8rem">${margePct.toFixed(1)}%</div>
              <div class="m-card-sub">Marge estimée ${M.format$(marge)}</div>
            </div>

            <div class="m-card" style="padding:0">
              <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Prix HT proposé</span><span style="font-weight:600">${M.format$(prix)}</span></div>
              <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Coût estimé (${km} km × ${coutKmStocke.toFixed(2)}€)</span><span style="font-weight:600;color:var(--m-red)">−${M.format$(depEstim)}</span></div>
              <div style="padding:14px 16px;display:flex;justify-content:space-between;background:var(--m-accent-soft)"><span style="font-weight:600">Marge nette estimée</span><span style="font-weight:700;color:${couleur}">${M.format$(marge)}</span></div>
            </div>

            ${margePct < 15 ? `
              <p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin-top:12px;line-height:1.5">
                💡 Pour atteindre 20% de marge, vise un prix d'au moins <strong>${M.format$(depEstim / 0.8)}</strong>
              </p>
            ` : ''}
          ` : `
            <div class="m-empty" style="padding:32px 16px"><div class="m-empty-icon">🧮</div><p class="m-empty-text">Saisis un prix et une distance pour calculer la marge estimée.</p></div>
          `}
        `;
      }

      return html;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-rent-mois');
      if (sel) sel.addEventListener('change', e => { M.state.rentMois = e.target.value; M.go('rentabilite'); });
      container.querySelectorAll('.m-alertes-chip[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.rentTab = btn.dataset.tab; M.go('rentabilite'); });
      });
      // Calculateur devis : input listeners (debounce léger)
      const wireDevis = (id, key) => {
        const el = container.querySelector(id);
        if (!el) return;
        let t = null;
        el.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => {
            const val = M.parseNum(e.target.value) || 0;
            M.state[key] = val;
            // Persiste le cout km de reference pour re-usage entre sessions
            if (key === 'devisCoutKm' && val > 0) {
              try { localStorage.setItem('rent_cout_km_ref', String(val)); } catch (_) {}
            }
            M.go('rentabilite');
          }, 350);
        });
      };
      wireDevis('#m-devis-prix', 'devisPrix');
      wireDevis('#m-devis-km', 'devisKm');
      wireDevis('#m-devis-coutkm', 'devisCoutKm');
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
        caByClient[k] = (caByClient[k] || 0) + (Number(l.prix) || Number(l.prixHT) || 0);
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
          t = setTimeout(() => { M.state.clientsRecherche = e.target.value; M.go('clients'); }, 220);
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
    const totalCa = livClient.reduce((s, l) => s + (Number(l.prix) || 0), 0);
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
        const totalCharges = chargesF.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
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
          t = setTimeout(() => { M.state.fournisseursRecherche = e.target.value; M.go('fournisseurs'); }, 220);
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
    const totalCharges = chargesF.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
    const aPayer = chargesF.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
    const totalAPayer = aPayer.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);

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
          t = setTimeout(() => { M.state.vehiculesRecherche = e.target.value; M.go('vehicules'); }, 220);
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
    const totalCarb = pleins.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const totalLitres = pleins.reduce((s, p) => s + (Number(p.litres) || 0), 0);
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

      ${livraisons.length ? `
        <div class="m-section">
          <div class="m-section-header">
            <h3 class="m-section-title">📦 Activité</h3>
            <span style="font-size:.85rem;color:var(--m-text-muted)">${livraisons.length} livraison${livraisons.length>1?'s':''}</span>
          </div>
        </div>
      ` : ''}
    `;
  };
  // ---------- Entretiens (v2.8 : list groupee par mois + filtre vehicule) ----------
  M.state.entretiensVehFilter = '';
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
      const moisCourant = new Date().toISOString().slice(0, 7);
      const courants = filtered.filter(e => (e.date || '').startsWith(moisCourant));
      const totalMois = courants.reduce((s, e) => s + (Number(e.cout) || 0), 0);
      const totalAll = filtered.reduce((s, e) => s + (Number(e.cout) || 0), 0);

      let html = `<button class="m-fab" onclick="MCAm.formNouvelEntretien()" aria-label="Nouvel entretien">+</button>`;
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
        const total = items.reduce((s, e) => s + (Number(e.cout) || 0), 0);
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
              return `<button type="button" class="m-card m-card-pressable m-entretien-edit" data-id="${M.escHtml(e.id)}" style="padding:14px;display:flex;justify-content:space-between;align-items:start;gap:10px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit;font-family:inherit">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.92rem">${M.escHtml(typeLabel)}</div>
                  <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.escHtml(immat)} · ${M.formatDate(e.date)}${e.km ? ' · ' + M.formatNum(e.km) + ' km' : ''}</div>
                  ${e.description ? `<div style="font-size:.82rem;margin-top:6px;color:var(--m-text);line-height:1.4">${M.escHtml(e.description)}</div>` : ''}
                </div>
                <div style="font-weight:700;color:var(--m-blue);white-space:nowrap;flex-shrink:0">${M.format$(e.cout || 0)}</div>
              </button>`;
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
      });
    }
  });
  // ---------- Inspections (v2.8 : list + detail avec photos) ----------
  M.state.detail.inspections = null;
  M.state.inspectionsRecherche = '';
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

      let html = `<button class="m-fab" onclick="MCAm.formNouvelleInspection()" aria-label="Nouvelle inspection">+</button>`;
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
        html += `<button type="button" class="m-card m-card-pressable m-insp-row" data-id="${M.escHtml(i.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit">
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:600;font-size:.95rem">${M.escHtml(i.vehImmat || '—')}</div>
            <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.formatDate(i.date)}${i.salNom ? ' · 👤 ' + M.escHtml(i.salNom) : ''}${i.km ? ' · ' + M.formatNum(i.km) + ' km' : ''}</div>
            ${nbPhotos ? `<div style="margin-top:4px;font-size:.75rem;color:var(--m-blue);font-weight:600">📸 ${nbPhotos} photo${nbPhotos>1?'s':''}</div>` : ''}
          </div>
          <span style="color:var(--m-text-muted);font-size:1.2rem;flex-shrink:0">›</span>
        </button>`;
      });

      return html;
    },
    afterRender(container) {
      const searchInput = container.querySelector('#m-insp-search');
      if (searchInput) {
        let t = null;
        searchInput.addEventListener('input', e => {
          clearTimeout(t);
          t = setTimeout(() => { M.state.inspectionsRecherche = e.target.value; M.go('inspections'); }, 220);
        });
        if (M.state.inspectionsRecherche) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
      container.querySelectorAll('.m-insp-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('inspections', btn.dataset.id));
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
          t = setTimeout(() => { M.state.salariesRecherche = e.target.value; M.go('salaries'); }, 220);
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
    const totalCa = livSal.reduce((sum, l) => sum + (Number(l.prix) || 0), 0);

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

      ${livSal.length ? `
        <div class="m-section">
          <div class="m-section-header">
            <h3 class="m-section-title">📦 Livraisons effectuées</h3>
            <span style="font-size:.85rem;color:var(--m-text-muted)">${livSal.length} · ${M.format$(totalCa)}</span>
          </div>
        </div>
      ` : ''}
    `;
  };
  // ---------- Heures & Km (v2.9 : recap par salarie sur mois courant) ----------
  M.state.heuresMois = new Date().toISOString().slice(0, 7);
  M.register('heures', {
    title: 'Heures & Km',
    render() {
      const moisSel = M.state.heuresMois;
      const salaries = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
      const livraisons = M.charger('livraisons').filter(l => (l.date || '').startsWith(moisSel));
      const heuresEntries = M.charger('heures').filter(h => (h.date || '').startsWith(moisSel));

      // Selecteur 12 derniers mois
      const moisOptions = [];
      const now = new Date();
      for (let k = 0; k < 12; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const cle = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      // Aggrege par salarie
      const stats = salaries.map(s => {
        const livSal = livraisons.filter(l => l.salarieId === s.id || l.chaufId === s.id);
        const kmLiv = livSal.reduce((sum, l) => sum + (Number(l.distance) || 0), 0);
        const heuresSal = heuresEntries.filter(h => h.salId === s.id || h.salarieId === s.id);
        const totalHeures = heuresSal.reduce((sum, h) => sum + (Number(h.heures) || 0), 0);
        const kmHeures = heuresSal.reduce((sum, h) => sum + (Number(h.km) || 0), 0);
        return { sal: s, nbLiv: livSal.length, kmLiv, totalHeures, kmHeures, kmTotal: kmLiv + kmHeures };
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
      if (sel) sel.addEventListener('change', e => { M.state.heuresMois = e.target.value; M.go('heures'); });
      // Tap salarie -> ouvre sa fiche
      container.querySelectorAll('.m-heures-sal').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('salaries', btn.dataset.salId));
      });
    }
  });

  // ---------- Incidents (v2.9 : list + filtre statut + detail) ----------
  M.state.incidentsStatut = 'tous';
  M.state.detail.incidents = null;
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

      let html = `<button class="m-fab" onclick="MCAm.formNouvelIncident()" aria-label="Nouvel incident">+</button>`;
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
        html += `<button type="button" class="m-card m-card-pressable m-incident-row" data-id="${M.escHtml(i.id)}" style="display:block;width:100%;text-align:left;padding:14px;background:var(--m-card);border:1px solid var(--m-border);border-left:4px solid ${borderColor};border-radius:14px;margin-bottom:10px;color:inherit">
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
        </button>`;
      });

      return html;
    },
    afterRender(container) {
      container.querySelectorAll('.m-alertes-chip').forEach(btn => {
        btn.addEventListener('click', () => { M.state.incidentsStatut = btn.dataset.statut; M.go('incidents'); });
      });
      container.querySelectorAll('.m-incident-row').forEach(btn => {
        btn.addEventListener('click', () => M.openDetail('incidents', btn.dataset.id));
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

  // ---------- TVA (v3.9 : recap mensuel + tableaux details collectee/deductible) ----------
  M.state.tvaMois = new Date().toISOString().slice(0, 7);
  M.state.tvaTab = 'recap'; // recap | collectee | deductible
  M.register('tva', {
    title: 'TVA',
    render() {
      const moisSel = M.state.tvaMois;
      const tab = M.state.tvaTab;
      const livraisons = M.charger('livraisons').filter(l => (l.date || '').startsWith(moisSel));
      const charges = M.charger('charges').filter(c => (c.date || '').startsWith(moisSel));
      const carburant = M.charger('carburant').filter(p => (p.date || '').startsWith(moisSel));

      // TVA collectee : par livraison, base = HT, montant = TVA explicite ou (TTC - HT)
      const livAvecTva = livraisons.map(l => {
        const ht = Number(l.prix) || Number(l.prixHT) || 0;
        const ttc = Number(l.prixTTC) || ht * (1 + (Number(l.tauxTva) || 0) / 100) || ht * 1.2;
        const tva = Number(l.tva) || (ttc - ht);
        const taux = Number(l.tauxTva) || (ht > 0 ? Math.round((tva / ht) * 1000) / 10 : 0);
        return { ...l, _ht: ht, _ttc: ttc, _tva: tva, _taux: taux };
      });
      const tvaCollectee = livAvecTva.reduce((s, l) => s + l._tva, 0);
      const baseCollectee = livAvecTva.reduce((s, l) => s + l._ht, 0);

      // TVA deductible : charges + carburant (TVA carburant deductible souvent partielle, on laisse au user)
      const chargesAvecTva = charges.filter(c => (Number(c.tva) || 0) > 0).map(c => {
        const ttc = Number(c.montantTtc) || Number(c.montant) || 0;
        const tva = Number(c.tva) || 0;
        const ht = Number(c.montantHT) || (ttc - tva);
        const taux = Number(c.tauxTva) || (ht > 0 ? Math.round((tva / ht) * 1000) / 10 : 0);
        return { ...c, _ht: ht, _ttc: ttc, _tva: tva, _taux: taux };
      });
      const tvaDeductibleCharges = chargesAvecTva.reduce((s, c) => s + c._tva, 0);
      const baseDeductibleCharges = chargesAvecTva.reduce((s, c) => s + c._ht, 0);

      // Carburant : TVA souvent indiquee sur ticket, ici on n'a pas le champ mais on peut estimer 20% sur HT
      // Pour simplicite : la TVA carburant n'est PAS comptee automatiquement (a saisir comme charges).
      // On affiche juste la liste pleins.

      const tvaDeductible = tvaDeductibleCharges;
      const aReverser = tvaCollectee - tvaDeductible;
      const enCredit = aReverser < 0;

      const moisOptions = [];
      const now = new Date();
      for (let k = 0; k < 12; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const cle = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      let html = `
        <div style="margin-bottom:14px"><select id="m-tva-mois">${moisOptions.join('')}</select></div>
        <div style="display:flex;gap:6px;margin-bottom:18px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${tab==='recap'?'active':''}" data-tab="recap">📊 Récap</button>
          <button class="m-alertes-chip ${tab==='collectee'?'active':''}" data-tab="collectee">📥 Collectée (${livAvecTva.length})</button>
          <button class="m-alertes-chip ${tab==='deductible'?'active':''}" data-tab="deductible">📤 Déductible (${chargesAvecTva.length})</button>
        </div>
      `;

      if (tab === 'recap') {
        html += `
          <div class="m-card" style="border-left:4px solid ${enCredit ? 'var(--m-green)' : 'var(--m-red)'};padding:16px;margin-bottom:12px">
            <div class="m-card-title">${enCredit ? '💚 Crédit TVA' : '💸 TVA à reverser'}</div>
            <div class="m-card-value" style="color:${enCredit ? 'var(--m-green)' : 'var(--m-red)'};font-size:1.8rem">${M.format$(Math.abs(aReverser))}</div>
            <div class="m-card-sub">${enCredit ? 'Tu peux te faire rembourser' : 'À déclarer ce mois'}</div>
          </div>
          <div class="m-card-row">
            <div class="m-card m-card-green"><div class="m-card-title">Collectée</div><div class="m-card-value" style="font-size:1.1rem">${M.format$(tvaCollectee)}</div><div class="m-card-sub">${livAvecTva.length} livraison${livAvecTva.length>1?'s':''}</div></div>
            <div class="m-card m-card-blue"><div class="m-card-title">Déductible</div><div class="m-card-value" style="font-size:1.1rem">${M.format$(tvaDeductible)}</div><div class="m-card-sub">${chargesAvecTva.length} charge${chargesAvecTva.length>1?'s':''}</div></div>
          </div>
          <div class="m-card" style="padding:0">
            <div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Base collectée HT</span><span style="font-weight:600">${M.format$(baseCollectee)}</span></div>
            <div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Base déductible HT</span><span style="font-weight:600">${M.format$(baseDeductibleCharges)}</span></div>
          </div>
          <p style="font-size:.75rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
            Récap simplifié. La TVA sur carburant doit être saisie comme charge pour être prise en compte. Déclaration officielle (CA3) sur version PC.
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
        if (!chargesAvecTva.length) {
          html += `<div class="m-empty"><div class="m-empty-icon">📤</div><h3 class="m-empty-title">Aucune charge avec TVA ce mois</h3><p class="m-empty-text">Les charges sans TVA explicite ne sont pas comptees comme deductibles.</p></div>`;
        } else {
          html += `<div class="m-card" style="padding:0">
            ${chargesAvecTva.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(c => `
              <div style="padding:12px 14px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;align-items:start;gap:10px">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:500;font-size:.9rem">${M.escHtml(c.libelle || c.fournisseur || '—')}</div>
                  <div style="color:var(--m-text-muted);font-size:.76rem;margin-top:2px">${M.formatDate(c.date)} · HT ${M.format$(c._ht)} · ${c._taux.toFixed(1)}%${c.categorie ? ' · ' + M.escHtml(c.categorie) : ''}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:700;color:var(--m-blue);white-space:nowrap">${M.format$(c._tva)}</div>
                  <div style="font-size:.7rem;color:var(--m-text-muted);margin-top:2px">TTC ${M.format$(c._ttc)}</div>
                </div>
              </div>
            `).join('')}
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
      if (sel) sel.addEventListener('change', e => { M.state.tvaMois = e.target.value; M.go('tva'); });
      container.querySelectorAll('.m-alertes-chip[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { M.state.tvaTab = btn.dataset.tab; M.go('tva'); });
      });
    }
  });

  // ---------- Statistiques (v2.9 : KPI clés du mois + comparatif) ----------
  M.state.statsMois = new Date().toISOString().slice(0, 7);
  M.register('statistiques', {
    title: 'Statistiques',
    render() {
      const moisSel = M.state.statsMois;
      const [y, m] = moisSel.split('-');
      const moisPrec = new Date(parseInt(y), parseInt(m) - 2, 1).toISOString().slice(0, 7);

      const livraisons = M.charger('livraisons');
      const carburant  = M.charger('carburant');
      const charges    = M.charger('charges');
      const salaries   = M.charger('salaries').filter(s => s && !s.archive && s.statut !== 'inactif');
      const vehicules  = M.charger('vehicules').filter(v => v && !v.archive);

      const livMois = livraisons.filter(l => (l.date || '').startsWith(moisSel));
      const livPrec = livraisons.filter(l => (l.date || '').startsWith(moisPrec));
      const carbMois = carburant.filter(p => (p.date || '').startsWith(moisSel));
      const chargesMois = charges.filter(c => (c.date || '').startsWith(moisSel));

      const ca = livMois.reduce((s, l) => s + (Number(l.prix) || 0), 0);
      const caPrec = livPrec.reduce((s, l) => s + (Number(l.prix) || 0), 0);
      const evolCa = caPrec > 0 ? ((ca - caPrec) / caPrec * 100) : (ca > 0 ? 100 : 0);
      const km = livMois.reduce((s, l) => s + (Number(l.distance) || 0), 0);
      const kmPrec = livPrec.reduce((s, l) => s + (Number(l.distance) || 0), 0);
      const evolKm = kmPrec > 0 ? ((km - kmPrec) / kmPrec * 100) : (km > 0 ? 100 : 0);

      const moisOptions = [];
      const now = new Date();
      for (let k = 0; k < 12; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const cle = d.toISOString().slice(0, 7);
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
          <div class="m-card m-card-red"><div class="m-card-title">Pleins</div><div class="m-card-value">${carbMois.length}</div><div class="m-card-sub">${M.format$(carbMois.reduce((s,p)=>s+(Number(p.total)||0),0))}</div></div>
          <div class="m-card"><div class="m-card-title">€/km</div><div class="m-card-value" style="font-size:1.3rem">${M.format$(km > 0 ? ca / km : 0)}</div><div class="m-card-sub">prix moyen</div></div>
        </div>

        ${(() => {
          // Comparatif annuel : barres CA des 12 derniers mois (SVG simple, pas Chart.js)
          const now = new Date();
          const mois12 = [];
          for (let k = 11; k >= 0; k--) {
            const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
            const cle = d.toISOString().slice(0, 7);
            const caM = livraisons.filter(l => (l.date || '').startsWith(cle))
              .reduce((s, l) => s + (Number(l.prix) || Number(l.prixHT) || 0), 0);
            const labelM = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.','');
            mois12.push({ cle, label: labelM, ca: caM });
          }
          const maxCa = Math.max(...mois12.map(x => x.ca), 1);
          const totalAn = mois12.reduce((s, x) => s + x.ca, 0);
          const moyenneAn = totalAn / 12;

          return `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">📈 CA des 12 derniers mois</h3><span style="font-size:.78rem;color:var(--m-text-muted)">${M.format$(totalAn)}</span></div>
            <div class="m-card" style="padding:14px">
              <div style="display:flex;align-items:flex-end;gap:4px;height:120px;padding-bottom:4px">
                ${mois12.map(x => {
                  const h = maxCa > 0 ? (x.ca / maxCa * 100) : 0;
                  const isCurrent = x.cle === moisSel;
                  const color = isCurrent ? 'var(--m-accent)' : x.ca > 0 ? 'var(--m-green)' : 'var(--m-border)';
                  return `<div style="flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%">
                    <div style="font-size:.62rem;color:var(--m-text-muted);height:14px;line-height:14px">${x.ca > 0 ? Math.round(x.ca / 1000) + 'k' : ''}</div>
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
            const cle = d.toISOString().slice(0, 7);
            const totalCharges = charges.filter(c => (c.date || '').startsWith(cle))
              .reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
            const totalCarb = carburant.filter(p => (p.date || '').startsWith(cle))
              .reduce((s, p) => s + (Number(p.total) || 0), 0);
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
                    <div style="font-size:.62rem;color:var(--m-text-muted);height:14px;line-height:14px">${x.total > 0 ? Math.round(x.total / 1000) + 'k' : ''}</div>
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
              cur.ca += Number(l.prix) || Number(l.prixHT) || 0;
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
            <div style="padding:14px 16px;display:flex;justify-content:space-between"><span>💸 Charges du mois</span><span style="font-weight:600">${M.format$(chargesMois.reduce((s,c)=>s+(Number(c.montantTtc)||Number(c.montant)||0),0))}</span></div>
          </div>
        </div>

        <p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
          Pour les graphiques d'évolution annuelle, exports et comparatifs avancés, ouvre la version PC.
        </p>
      `;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-stats-mois');
      if (sel) sel.addEventListener('change', e => { M.state.statsMois = e.target.value; M.go('statistiques'); });
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
        const labels = { conge: '🏖️ Congé', absence: '⚠️ Absence', maladie: '🤒 Maladie' };
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

  // ---------- Parametres (v2.9 : info entreprise + actions) ----------
  M.register('parametres', {
    title: 'Paramètres',
    render() {
      const config = M.chargerObj('config') || {};
      const entreprise = config.entreprise || M.chargerObj('entreprise') || {};
      const adminNom = sessionStorage.getItem('admin_nom') || 'Admin';
      const adminLogin = sessionStorage.getItem('admin_login') || '';

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

        <div class="m-section"><div class="m-section-header"><h3 class="m-section-title">🎨 Affichage</h3></div>
          <button class="m-card m-card-pressable" id="m-param-theme" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:14px;text-align:left;color:inherit;font-family:inherit">
            <span style="font-size:.95rem;font-weight:500">🌓 Mode clair / sombre</span>
            <span style="color:var(--m-text-muted);font-size:.85rem">${M.state.theme === 'light' ? 'Clair' : 'Sombre'}</span>
          </button>
        </div>

        <div class="m-section">
          <button class="m-btn m-btn-danger" id="m-param-logout">⏏ Déconnexion</button>
        </div>

        <p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
          Modification de l'entreprise, gestion des utilisateurs, sauvegarde et options avancées sont sur la version PC.
        </p>
      `;
    },
    afterRender(container) {
      container.querySelector('#m-param-theme')?.addEventListener('click', M.toggleTheme);
      container.querySelector('#m-param-logout')?.addEventListener('click', M.logout);
    }
  });

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

    // Auto-refresh badge alertes toutes les 30s (au cas ou desktop sync nouvelles alertes)
    setInterval(M.updateAlertesBadge, 30000);

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
