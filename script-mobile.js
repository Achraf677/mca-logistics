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
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
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
      opts.afterMount($('#m-sheet-body'));
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
    const ok = await Promise.resolve(M._sheetCtx.onSubmit($('#m-sheet-body')));
    if (ok !== false) M.closeSheet();
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
    return `<input type="${type}" name="${M.escHtml(name)}" placeholder="${M.escHtml(ph)}" value="${M.escHtml(value)}" ${step} ${min} ${opts.required ? 'required' : ''} ${opts.autocomplete ? `autocomplete="${opts.autocomplete}"` : ''} />`;
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

  // Utilitaire : extrait les valeurs d'un formulaire dans le sheet body
  M.lireFormSheet = function() {
    const body = $('#m-sheet-body');
    const out = {};
    body.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.name) return;
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
      ${M.formField('Statut', M.formSelect('statut', [
        { value: 'planifiee', label: 'Planifiée' },
        { value: 'en_cours',  label: 'En cours' },
        { value: 'livree',    label: 'Livrée' },
        { value: 'facturee',  label: 'Facturée' }
      ], { value: v.statut || 'livree' }))}
      ${enEdition ? `
        <button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cette livraison</button>
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
          const taux = parseFloat(sel.value) / 100 || 0;
          if (dernierEdit === 'ttc' && ttc.value) {
            const tt = parseFloat(ttc.value);
            const hh = taux > 0 ? tt / (1 + taux) : tt;
            ht.value = hh.toFixed(2);
            tva.value = (tt - hh).toFixed(2);
          } else if (ht.value) {
            const hh = parseFloat(ht.value);
            const tv = hh * taux;
            tva.value = tv.toFixed(2);
            ttc.value = (hh + tv).toFixed(2);
          }
        };
        ht.addEventListener('input', () => { dernierEdit = 'ht'; recalc(); });
        ttc.addEventListener('input', () => { dernierEdit = 'ttc'; recalc(); });
        sel.addEventListener('change', recalc);
        // Bouton supprimer (mode edition)
        if (enEdition) {
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm(`Supprimer définitivement cette livraison (${v.client || ''}) ?`, { titre: 'Supprimer livraison' })) return;
            M.sauvegarder('livraisons', M.charger('livraisons').filter(x => x.id !== v.id));
            M.toast('🗑️ Livraison supprimée');
            M.closeSheet();
            M.go('livraisons');
          });
        }
      },
      onSubmit() {
        const form = M.lireFormSheet();
        const prixHT = parseFloat(form.prixHT);
        const taux = parseFloat(form.tauxTva) || 0;
        const tvaMontant = parseFloat(form.tva) || (prixHT * taux / 100);
        const prixTTC = parseFloat(form.prixTTC) || (prixHT + tvaMontant);
        if (!form.client?.trim() || !form.date || !(prixHT > 0)) {
          M.toast('⚠️ Client, date et prix HT obligatoires');
          return false;
        }
        const arr = M.charger('livraisons');
        const data = {
          date: form.date,
          client: form.client.trim(),
          prix: prixHT,
          prixHT,
          prixTTC,
          tauxTva: taux,
          tva: tvaMontant,
          distance: parseFloat(form.distance) || 0,
          vehiculeId: form.vehiculeId || null,
          salarieId: form.salarieId || null,
          statut: form.statut || 'livree',
          numLiv: form.numLiv?.trim() || ''
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

    const body = `
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.immatriculation || v.id })), { placeholder: 'Choisir un véhicule', value: p.vehiculeId || '', required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: p.date || today, required: true }), { required: true })}
        ${M.formField('Km compteur', M.formInputWithSuffix('kmCompteur', 'km', { type: 'number', step: '1', min: '0', placeholder: '0', value: p.kmCompteur || '' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Litres', M.formInputWithSuffix('litres', 'L', { type: 'number', step: '0.01', min: '0', placeholder: '0', value: p.litres || '', required: true }), { required: true })}
        ${M.formField('Prix au litre', M.formInputWithSuffix('prixLitre', '€/L', { type: 'number', step: '0.001', min: '0', placeholder: '0.000', value: p.prixLitre || '' }))}
      </div>
      ${M.formField('Total payé', M.formInputWithSuffix('total', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: p.total || '', required: true }), { hint: 'Si laissé vide, calculé automatiquement (litres × prix/L)', required: true })}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer ce plein</button>` : ''}
    `;

    M.openSheet({
      title: enEdition ? '✏️ Modifier plein' : '⛽ Nouveau plein',
      body,
      submitLabel: 'Enregistrer',
      afterMount(body) {
        const litres = body.querySelector('input[name=litres]');
        const prixL  = body.querySelector('input[name=prixLitre]');
        const total  = body.querySelector('input[name=total]');
        const recalc = () => {
          if (!total.value && litres.value && prixL.value) {
            total.value = (parseFloat(litres.value) * parseFloat(prixL.value)).toFixed(2);
          }
        };
        litres.addEventListener('input', recalc);
        prixL.addEventListener('input', recalc);
        if (enEdition) {
          body.querySelector('#m-form-delete')?.addEventListener('click', async () => {
            if (!await M.confirm('Supprimer définitivement ce plein ?', { titre: 'Supprimer plein' })) return;
            M.sauvegarder('carburant', M.charger('carburant').filter(x => x.id !== p.id));
            M.toast('🗑️ Plein supprimé');
            M.closeSheet();
            M.go('carburant');
          });
        }
      },
      onSubmit() {
        const form = M.lireFormSheet();
        const litres = parseFloat(form.litres) || 0;
        const prixL = parseFloat(form.prixLitre) || 0;
        let total = parseFloat(form.total) || 0;
        if (!total && litres && prixL) total = +(litres * prixL).toFixed(2);
        if (!form.vehiculeId || !form.date || !(litres > 0) || !(total > 0)) {
          M.toast('⚠️ Véhicule, date, litres et total obligatoires');
          return false;
        }
        const arr = M.charger('carburant');
        const data = {
          vehiculeId: form.vehiculeId,
          date: form.date,
          litres,
          prixLitre: prixL,
          total,
          kmCompteur: parseFloat(form.kmCompteur) || 0
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
        { value: 'loyer',     label: '🏢 Loyer' },
        { value: 'assurance', label: '🛡️ Assurance' },
        { value: 'energie',   label: '⚡ Énergie' },
        { value: 'telecom',   label: '📞 Télécom' },
        { value: 'banque',    label: '🏦 Frais bancaires' },
        { value: 'compta',    label: '📊 Comptabilité' },
        { value: 'entretien', label: '🔧 Entretien' },
        { value: 'autre',     label: '📌 Autre' }
      ], { placeholder: 'Choisir une catégorie', value: c.categorie || '' }))}
      ${M.formField('Statut', M.formSelect('statut', [
        { value: 'a_payer', label: '⏳ À payer' },
        { value: 'paye',    label: '✅ Payée' },
        { value: 'partiel', label: '🟡 Partielle' }
      ], { value: c.statut || 'a_payer' }))}
      ${enEdition ? `<button type="button" class="m-btn m-btn-danger" id="m-form-delete" style="margin-top:18px">🗑️ Supprimer cette charge</button>` : ''}
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
          const taux = parseFloat(sel.value) / 100 || 0;
          if (dernierEdit === 'ht' && ht.value) {
            const hh = parseFloat(ht.value);
            const tv = hh * taux;
            tva.value = tv.toFixed(2);
            ttc.value = (hh + tv).toFixed(2);
          } else if (ttc.value) {
            const tt = parseFloat(ttc.value);
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
        }
      },
      onSubmit() {
        const form = M.lireFormSheet();
        const ttc = parseFloat(form.montantTtc) || 0;
        const taux = parseFloat(form.tauxTva) || 0;
        const ht = parseFloat(form.montantHt) || (taux > 0 ? ttc / (1 + taux/100) : ttc);
        const tvaMontant = parseFloat(form.tva) || (ttc - ht);
        if (!form.libelle?.trim() || !form.date || !(ttc > 0)) {
          M.toast('⚠️ Libellé, date et montant TTC obligatoires');
          return false;
        }
        const arr = M.charger('charges');
        const data = {
          date: form.date,
          libelle: form.libelle.trim(),
          fournisseur: form.fournisseur?.trim() || '',
          montantHT: +ht.toFixed(2),
          montantTtc: ttc,
          montant: ttc,
          tauxTva: taux,
          tva: +tvaMontant.toFixed(2),
          categorie: form.categorie || '',
          statut: form.statut || 'a_payer'
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

      // Mois courant
      const now = new Date();
      const moisCle = now.toISOString().slice(0, 7); // YYYY-MM

      const livraisonsMois = livraisons.filter(l => (l.date || '').startsWith(moisCle));
      const caMoisHt = livraisonsMois.reduce((acc, l) => acc + (Number(l.prixHT) || Number(l.prix_ht) || 0), 0);
      const caMoisTtc = livraisonsMois.reduce((acc, l) => acc + (Number(l.prixTTC) || Number(l.prix_ttc) || 0), 0);

      const chargesAPayer = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      const totalImpayes  = chargesAPayer.reduce((acc, c) => acc + (Number(c.montantTtc) || Number(c.montant) || 0), 0);

      const alertesActives = alertes.filter(a => !a.traitee && !a.ignoree && !(a.meta?.repousseJusquA && new Date(a.meta.repousseJusquA) > now));
      const alertesCritiques = alertesActives.filter(a => ['ct_expire','permis_expire','assurance_expire','charge_retard_paiement','carburant_anomalie'].includes(a.type)).length;

      const salariesActifs = salaries.filter(s => s.actif !== false).length;

      return `
        <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em">Bonjour ${M.escHtml(sessionStorage.getItem('admin_nom') || 'Admin')}</h2>
        <p style="color:var(--m-text-muted);font-size:.88rem;margin:0 0 18px">${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

        <div class="m-card-row">
          <div class="m-card m-card-green">
            <div class="m-card-title">CA ce mois</div>
            <div class="m-card-value">${M.format$(caMoisHt)}</div>
            <div class="m-card-sub">TTC ${M.format$(caMoisTtc)}</div>
          </div>
          <div class="m-card m-card-blue">
            <div class="m-card-title">Livraisons</div>
            <div class="m-card-value">${M.formatNum(livraisonsMois.length)}</div>
            <div class="m-card-sub">ce mois</div>
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

        <div class="m-card m-card-purple">
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
              <div class="m-card" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                <div style="flex:1 1 auto;min-width:0">
                  <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(l.client || l.client_nom || '—')}</div>
                  <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${M.formatDate(l.date)} · ${M.escHtml(l.numLiv || l.num_livraison || '—')}</div>
                </div>
                <div style="font-weight:700;color:var(--m-green);white-space:nowrap">${M.format$(l.prixHT || l.prix_ht || 0)}</div>
              </div>
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

      // Recherche bar
      html += `
        <div style="margin-bottom:16px">
          <input type="search" id="m-liv-search" placeholder="🔍 Rechercher (client, n°, adresse...)" value="${M.escHtml(M.state.livraisonsRecherche)}" autocomplete="off" />
        </div>
      `;

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
          html += `<div class="m-card m-card-green" style="padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div style="flex:1 1 auto;min-width:0">
                <div style="font-weight:600;font-size:.95rem">${M.escHtml(sal.nom || sal.id)}</div>
                <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px">${horaires}${jourData?.zone ? ' · ' + M.escHtml(jourData.zone) : ''}</div>
              </div>
            </div>
            ${jourData?.note ? `<div style="font-size:.78rem;color:var(--m-text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--m-border);font-style:italic">${M.escHtml(jourData.note)}</div>` : ''}
          </div>`;
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
          html += `<div class="m-card" style="padding:12px 14px;border-left:3px solid ${colors[typeJour] || 'var(--m-border)'}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <span style="font-weight:600;font-size:.92rem">${M.escHtml(sal.nom || sal.id)}</span>
              <span style="font-size:.78rem;color:${colors[typeJour] || 'var(--m-text-muted)'};font-weight:600">${labels[typeJour] || typeJour}</span>
            </div>
          </div>`;
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

  // ---------- Carburant (v2.3 : liste lecture seule, grouped par mois) ----------
  M.state.carbMoisOuverts = {};
  M.register('carburant', {
    title: 'Carburant',
    render() {
      const pleins = M.charger('carburant');
      const vehIdx = M.indexVehicules();

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
      let filtered = charges;
      if (statut === 'a_payer') filtered = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      if (statut === 'paye')    filtered = charges.filter(c => c.statut === 'paye' || c.statut === 'payee');

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
        <div style="display:flex;gap:6px;margin:16px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${statut==='tous'?'active':''}" data-statut="tous">📋 Toutes</button>
          <button class="m-alertes-chip ${statut==='a_payer'?'active':''}" data-statut="a_payer">⚠️ À payer${aPayer.length?` (${aPayer.length})`:''}</button>
          <button class="m-alertes-chip ${statut==='paye'?'active':''}" data-statut="paye">✅ Payées</button>
        </div>
      `;

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
                return `<button type="button" class="m-card m-card-pressable m-charge-edit" data-id="${M.escHtml(c.id)}" style="padding:14px;border-left:4px solid ${borderColor};display:flex;justify-content:space-between;align-items:start;gap:10px;width:100%;text-align:left;background:var(--m-card);border-top:1px solid var(--m-border);border-right:1px solid var(--m-border);border-bottom:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit;font-family:inherit">
                  <div style="flex:1 1 auto;min-width:0">
                    <div style="font-weight:600;font-size:.95rem;margin-bottom:3px">${M.escHtml(c.libelle || c.fournisseur || 'Charge')}</div>
                    <div style="color:var(--m-text-muted);font-size:.8rem">${M.formatDate(c.date)}${c.fournisseur && c.libelle ? ' · ' + M.escHtml(c.fournisseur) : ''}${c.categorie ? ' · ' + M.escHtml(c.categorie) : ''}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:700;white-space:nowrap;font-size:.95rem">${M.format$(montant)}</div>
                    <div style="font-size:.7rem;color:${statutColor};font-weight:600;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${statutLabel}</div>
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
      container.querySelectorAll('.m-alertes-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          M.state.chargesStatut = btn.dataset.statut;
          M.go('charges');
        });
      });
      // Tap card charge -> ouvre le form en mode edition
      container.querySelectorAll('.m-charge-edit').forEach(btn => {
        btn.addEventListener('click', () => M.editerCharge(btn.dataset.id));
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
  // ---------- Rentabilite (v2.1 : KPI vue d'ensemble + selecteur periode) ----------
  M.state.rentMois = new Date().toISOString().slice(0, 7); // mois selectionne YYYY-MM

  M.register('rentabilite', {
    title: 'Rentabilité',
    render() {
      const livraisons = M.charger('livraisons');
      const carburant  = M.charger('carburant');
      const entretiens = M.charger('entretiens');
      const charges    = M.charger('charges');

      const moisSel = M.state.rentMois;
      const inMois = (date) => (date || '').startsWith(moisSel);

      const livMois = livraisons.filter(l => inMois(l.date));
      const carbMois = carburant.filter(p => inMois(p.date));
      const entrMois = entretiens.filter(e => inMois(e.date));
      const chargesMois = charges.filter(c => inMois(c.date) && c.categorie !== 'entretien');

      // Memes formules que script-rentabilite.js (afficherRentabilite)
      const ca = livMois.reduce((s, l) => s + (Number(l.prix) || 0), 0);
      const carb = carbMois.reduce((s, p) => s + (Number(p.total) || 0), 0);
      const entr = entrMois.reduce((s, e) => s + (Number(e.cout) || 0), 0);
      const autresCharges = chargesMois.reduce((s, c) => s + (Number(c.montant) || 0), 0);
      const dep = carb + entr + autresCharges;
      const profit = ca - dep;
      const marge = ca > 0 ? (profit / ca * 100) : 0;
      const km = livMois.reduce((s, l) => s + (Number(l.distance) || 0), 0);
      const coutKm = km > 0 ? dep / km : 0;
      const margeColor = marge >= 20 ? 'var(--m-green)' : marge >= 10 ? 'var(--m-accent)' : 'var(--m-red)';

      // Selecteur mois : courant +/- 11 mois
      const moisOptions = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const cle = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        moisOptions.push(`<option value="${cle}" ${cle === moisSel ? 'selected' : ''}>${label}</option>`);
      }

      // Pourcentages pour la barre breakdown
      const pct = (v) => dep > 0 ? Math.round(v / dep * 100) : 0;
      const pctCarb = pct(carb), pctEntr = pct(entr), pctAutres = pct(autresCharges);

      return `
        <div style="margin-bottom:16px">
          <select id="m-rent-mois" style="font-size:16px">
            ${moisOptions.join('')}
          </select>
        </div>

        <!-- KPI principaux : 2 cards highlight -->
        <div class="m-card-row">
          <div class="m-card m-card-green">
            <div class="m-card-title">Chiffre d'affaires</div>
            <div class="m-card-value">${M.format$(ca)}</div>
            <div class="m-card-sub">${livMois.length} liv. · ${M.formatNum(km)} km</div>
          </div>
          <div class="m-card" style="border-left:4px solid ${margeColor}">
            <div class="m-card-title">Marge nette</div>
            <div class="m-card-value" style="color:${margeColor}">${marge.toFixed(1)}%</div>
            <div class="m-card-sub">Profit ${M.format$(profit)}</div>
          </div>
        </div>

        <!-- Depenses : breakdown -->
        <div class="m-card">
          <div class="m-card-title">Dépenses du mois</div>
          <div class="m-card-value" style="color:var(--m-red)">${M.format$(dep)}</div>
          <div class="m-card-sub">${M.format$(coutKm)} / km</div>

          <!-- Barre stack visuelle -->
          ${dep > 0 ? `
            <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:14px;background:var(--m-border)">
              <div style="background:rgba(230,126,34,0.85);width:${pctCarb}%" title="Carburant"></div>
              <div style="background:rgba(52,152,219,0.85);width:${pctEntr}%" title="Entretien"></div>
              <div style="background:rgba(155,89,182,0.85);width:${pctAutres}%" title="Autres charges"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:10px;gap:8px;flex-wrap:wrap;font-size:.78rem">
              <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:rgba(230,126,34,0.85);border-radius:2px"></span>Carburant ${pctCarb}%</span>
              <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:rgba(52,152,219,0.85);border-radius:2px"></span>Entretien ${pctEntr}%</span>
              <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:rgba(155,89,182,0.85);border-radius:2px"></span>Autres ${pctAutres}%</span>
            </div>
          ` : ''}
        </div>

        <!-- Detail depenses : 3 lignes -->
        <div class="m-card" style="padding:0">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--m-border)">
            <span style="display:flex;align-items:center;gap:10px"><span>⛽</span><span>Carburant</span></span>
            <span style="font-weight:600">${M.format$(carb)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--m-border)">
            <span style="display:flex;align-items:center;gap:10px"><span>🔧</span><span>Entretien</span></span>
            <span style="font-weight:600">${M.format$(entr)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px">
            <span style="display:flex;align-items:center;gap:10px"><span>💸</span><span>Autres charges</span></span>
            <span style="font-weight:600">${M.format$(autresCharges)}</span>
          </div>
        </div>

        <p style="font-size:.75rem;color:var(--m-text-muted);text-align:center;margin-top:16px;line-height:1.5">
          Vue d'ensemble du mois sélectionné. Les analyses détaillées (par véhicule, tournée, client, chauffeur) sont disponibles sur la version PC.
        </p>
      `;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-rent-mois');
      if (sel) {
        sel.addEventListener('change', e => {
          M.state.rentMois = e.target.value;
          M.go('rentabilite');
        });
      }
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

      let html = `
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
          html += `<button type="button" class="m-card m-card-pressable m-client-row" data-id="${M.escHtml(c.id)}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px;width:100%;text-align:left;background:var(--m-card);border:1px solid var(--m-border);border-radius:18px;margin-bottom:10px;color:inherit">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(c.nom || '—')}</div>
              <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml(c.tel || c.email || c.ville || '—')}</div>
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
        ${c.tva ?       `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° TVA</span><span style="font-weight:500">${M.escHtml(c.tva)}</span></div>` : ''}
        ${c.notes ?     `<div style="padding:14px 16px;display:flex;flex-direction:column;gap:6px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Notes</span><span style="font-size:.88rem;line-height:1.45">${M.escHtml(c.notes)}</span></div>` : ''}
      </div>

      <div class="m-section">
        <div class="m-section-header">
          <h3 class="m-section-title">📦 Livraisons</h3>
          <span style="font-size:.85rem;color:var(--m-text-muted)">${livClient.length} · ${M.format$(totalCa)}</span>
        </div>
        ${livClient.length ? livClient.slice(0, 10).sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(l => `
          <div class="m-card" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:500;font-size:.88rem">${M.formatDate(l.date)}${l.numLiv ? ' · ' + M.escHtml(l.numLiv) : ''}</div>
              <div style="color:var(--m-text-muted);font-size:.78rem">${l.distance ? M.formatNum(l.distance) + ' km' : '—'}</div>
            </div>
            <div style="font-weight:700;color:var(--m-green);white-space:nowrap">${M.format$(l.prix || 0)}</div>
          </div>
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

      let html = `
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
        ${f.adresse ? `<div style="padding:14px 16px;display:flex;justify-content:space-between;gap:10px"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Adresse</span><span style="font-weight:500;font-size:.85rem;text-align:right">${M.escHtml(f.adresse)}</span></div>` : ''}
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
      let filtered = vehicules;
      if (recherche) {
        filtered = vehicules.filter(v => {
          const hay = `${v.immat||''} ${v.modele||''} ${v.marque||''} ${v.salNom||''}`.toLowerCase();
          return hay.includes(recherche);
        });
      }
      filtered = [...filtered].sort((a,b) => (a.immat||'').localeCompare(b.immat||''));

      let html = `
        <div style="margin-bottom:14px">
          <input type="search" id="m-veh-search" placeholder="🔍 Rechercher (immat, modèle)" value="${M.escHtml(M.state.vehiculesRecherche)}" autocomplete="off" />
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
    const pleins = M.charger('carburant').filter(p => p.vehiculeId === v.id);
    const totalCarb = pleins.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const totalLitres = pleins.reduce((s, p) => s + (Number(p.litres) || 0), 0);
    const dernierPlein = pleins.sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
    const livraisons = M.charger('livraisons').filter(l => l.vehiculeId === v.id);

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="display:inline-block;padding:8px 18px;background:var(--m-accent-soft);color:var(--m-accent);border-radius:14px;font-size:1.4rem;font-weight:800;letter-spacing:.05em">${M.escHtml(v.immat || '—')}</div>
        ${v.modele ? `<p style="font-size:.95rem;margin:8px 0 0;font-weight:500">${M.escHtml(v.modele)}</p>` : ''}
        ${v.salNom ? `<p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">👤 ${M.escHtml(v.salNom)}</p>` : ''}
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
        ${v.km != null ?            `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Kilométrage</span><span style="font-weight:600">${M.formatNum(v.km)} km</span></div>` : ''}
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

      let html = `
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
              return `<div class="m-card" style="padding:14px;display:flex;justify-content:space-between;align-items:start;gap:10px">
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

      let html = `
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

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="display:inline-block;padding:8px 18px;background:var(--m-accent-soft);color:var(--m-accent);border-radius:14px;font-size:1.4rem;font-weight:800;letter-spacing:.05em">${M.escHtml(i.vehImmat || '—')}</div>
        <p style="font-size:.95rem;margin:8px 0 0;font-weight:500">Inspection du ${M.formatDate(i.date)}</p>
        ${i.salNom ? `<p style="color:var(--m-text-muted);font-size:.85rem;margin:4px 0 0">👤 ${M.escHtml(i.salNom)}</p>` : ''}
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

      let html = `
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
    const livSal = M.charger('livraisons').filter(l => l.salarieId === s.id);
    const totalCa = livSal.reduce((sum, l) => sum + (Number(l.prix) || 0), 0);

    return `
      <div style="text-align:center;padding:8px 0 18px">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:700;margin:0 auto 12px">${M.escHtml(initiales)}</div>
        <h2 style="margin:0;font-size:1.3rem;font-weight:700;letter-spacing:-0.02em">${M.escHtml((s.prenom ? s.prenom + ' ' : '') + (s.nom || '—'))}</h2>
        ${s.poste ? `<p style="color:var(--m-text-muted);font-size:.88rem;margin:4px 0 0">${M.escHtml(s.poste)}</p>` : ''}
        ${!estActif ? `<p style="display:inline-block;background:rgba(231,76,60,0.12);color:var(--m-red);padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;margin-top:8px">⏸️ Inactif</p>` : ''}
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
        const livSal = livraisons.filter(l => l.salarieId === s.id);
        const kmLiv = livSal.reduce((sum, l) => sum + (Number(l.distance) || 0), 0);
        const heuresSal = heuresEntries.filter(h => h.salId === s.id || h.salarieId === s.id);
        const totalHeures = heuresSal.reduce((sum, h) => sum + (Number(h.heures) || 0), 0);
        const kmHeures = heuresSal.reduce((sum, h) => sum + (Number(h.km) || 0), 0);
        return { sal: s, nbLiv: livSal.length, kmLiv, totalHeures, kmHeures, kmTotal: kmLiv + kmHeures };
      }).sort((a, b) => b.kmTotal - a.kmTotal);

      const grandTotalKm = stats.reduce((s, x) => s + x.kmTotal, 0);
      const grandTotalH  = stats.reduce((s, x) => s + x.totalHeures, 0);
      const grandTotalLiv = stats.reduce((s, x) => s + x.nbLiv, 0);

      let html = `
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
        html += `<div class="m-card" style="padding:14px;display:flex;align-items:center;gap:12px">
          <div style="width:38px;height:38px;border-radius:50%;background:var(--m-accent-soft);color:var(--m-accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${M.escHtml(initiales)}</div>
          <div style="flex:1 1 auto;min-width:0">
            <div style="font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${M.escHtml((sal.prenom ? sal.prenom + ' ' : '') + (sal.nom || ''))}</div>
            <div style="color:var(--m-text-muted);font-size:.78rem;margin-top:2px">${nbLiv} liv. · ${M.formatNum(kmTotal.toFixed(0))} km · ${totalHeures.toFixed(0)} h</div>
          </div>
        </div>`;
      });
      html += `</div>`;
      return html;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-heures-mois');
      if (sel) sel.addEventListener('change', e => { M.state.heuresMois = e.target.value; M.go('heures'); });
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
      const ouverts = incidents.filter(i => i.statut !== 'traite' && i.statut !== 'resolu' && i.statut !== 'clos');

      let filtered = incidents;
      if (statut === 'ouverts')  filtered = ouverts;
      if (statut === 'traites')  filtered = incidents.filter(i => i.statut === 'traite' || i.statut === 'resolu' || i.statut === 'clos');

      let html = `
        <div class="m-card-row">
          <div class="m-card m-card-red"><div class="m-card-title">Ouverts</div><div class="m-card-value">${ouverts.length}</div><div class="m-card-sub">à traiter</div></div>
          <div class="m-card m-card-accent"><div class="m-card-title">Total</div><div class="m-card-value">${incidents.length}</div><div class="m-card-sub">enregistrés</div></div>
        </div>
        <div style="display:flex;gap:6px;margin:16px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
          <button class="m-alertes-chip ${statut==='tous'?'active':''}" data-statut="tous">📋 Tous</button>
          <button class="m-alertes-chip ${statut==='ouverts'?'active':''}" data-statut="ouverts">🔴 Ouverts${ouverts.length?` (${ouverts.length})`:''}</button>
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
        ${i.client ?      `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Client</span><span style="font-weight:500">${M.escHtml(i.client)}</span></div>` : ''}
        ${i.salNom ?      `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Salarié</span><span style="font-weight:500">${M.escHtml(i.salNom)}</span></div>` : ''}
        ${i.chaufNom ?    `<div style="padding:14px 16px;border-bottom:1px solid var(--m-border);display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">Chauffeur</span><span style="font-weight:500">${M.escHtml(i.chaufNom)}</span></div>` : ''}
        ${i.numLiv ?      `<div style="padding:14px 16px;display:flex;justify-content:space-between"><span style="color:var(--m-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">N° livraison</span><span style="font-weight:500">${M.escHtml(i.numLiv)}</span></div>` : ''}
      </div>

      ${i.description ? `<div class="m-section"><div class="m-section-header"><h3 class="m-section-title">📝 Description</h3></div><div class="m-card" style="padding:14px;font-size:.88rem;line-height:1.5">${M.escHtml(i.description)}</div></div>` : ''}
    `;
  };

  // ---------- TVA (v2.9 : recap mensuel collectee/deductible/a reverser) ----------
  M.state.tvaMois = new Date().toISOString().slice(0, 7);
  M.register('tva', {
    title: 'TVA',
    render() {
      const moisSel = M.state.tvaMois;
      const livraisons = M.charger('livraisons').filter(l => (l.date || '').startsWith(moisSel));
      const charges = M.charger('charges').filter(c => (c.date || '').startsWith(moisSel));

      // TVA collectee = somme des (TTC - HT) des livraisons
      const caHT = livraisons.reduce((s, l) => s + (Number(l.prix) || Number(l.prixHT) || 0), 0);
      const caTTC = livraisons.reduce((s, l) => s + (Number(l.prixTTC) || (Number(l.prix) || 0) * 1.2), 0);
      const tvaCollectee = Math.max(0, caTTC - caHT);

      // TVA deductible = somme des TVA des charges
      const tvaDeductible = charges.reduce((s, c) => s + (Number(c.tva) || 0), 0);

      // A reverser = collectee - deductible
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

      return `
        <div style="margin-bottom:14px"><select id="m-tva-mois">${moisOptions.join('')}</select></div>

        <div class="m-card" style="border-left:4px solid ${enCredit ? 'var(--m-green)' : 'var(--m-red)'};padding:16px;margin-bottom:12px">
          <div class="m-card-title">${enCredit ? '💚 Crédit TVA' : '💸 TVA à reverser'}</div>
          <div class="m-card-value" style="color:${enCredit ? 'var(--m-green)' : 'var(--m-red)'};font-size:1.8rem">${M.format$(Math.abs(aReverser))}</div>
          <div class="m-card-sub">${enCredit ? 'Tu peux te faire rembourser' : 'À déclarer ce mois'}</div>
        </div>

        <div class="m-card-row">
          <div class="m-card m-card-green"><div class="m-card-title">Collectée</div><div class="m-card-value" style="font-size:1.1rem">${M.format$(tvaCollectee)}</div><div class="m-card-sub">sur livraisons</div></div>
          <div class="m-card m-card-blue"><div class="m-card-title">Déductible</div><div class="m-card-value" style="font-size:1.1rem">${M.format$(tvaDeductible)}</div><div class="m-card-sub">sur charges</div></div>
        </div>

        <p style="font-size:.78rem;color:var(--m-text-muted);text-align:center;margin-top:18px;line-height:1.5">
          Récap simplifié. La déclaration officielle (CA3, justificatifs) se fait sur la version PC.
        </p>
      `;
    },
    afterRender(container) {
      const sel = container.querySelector('#m-tva-mois');
      if (sel) sel.addEventListener('change', e => { M.state.tvaMois = e.target.value; M.go('tva'); });
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
          <div class="m-card m-card-green"><div class="m-card-title">CA du mois</div><div class="m-card-value">${M.format$(ca)}</div><div class="m-card-sub">${evolBadge(evolCa)} vs précédent</div></div>
          <div class="m-card m-card-blue"><div class="m-card-title">Livraisons</div><div class="m-card-value">${livMois.length}</div><div class="m-card-sub">${evolBadge(livMois.length - livPrec.length)} vs précédent</div></div>
        </div>
        <div class="m-card-row">
          <div class="m-card m-card-purple"><div class="m-card-title">Km parcourus</div><div class="m-card-value">${M.formatNum(km.toFixed(0))}</div><div class="m-card-sub">${evolBadge(evolKm)} vs précédent</div></div>
          <div class="m-card m-card-accent"><div class="m-card-title">Pleins</div><div class="m-card-value">${carbMois.length}</div><div class="m-card-sub">${M.format$(carbMois.reduce((s,p)=>s+(Number(p.total)||0),0))}</div></div>
        </div>

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

  // ---------- Calendrier (v2.9 : vue jour avec evenements + nav prev/next) ----------
  M.state.calendrierDate = new Date().toISOString().slice(0, 10);
  M.register('calendrier', {
    title: 'Calendrier',
    render() {
      const dateSel = M.state.calendrierDate;
      const livraisons = M.charger('livraisons').filter(l => l.date === dateSel);
      const carburant = M.charger('carburant').filter(p => p.date === dateSel);
      const entretiens = M.charger('entretiens').filter(e => e.date === dateSel);
      const incidents = M.charger('incidents').filter(i => (i.date || (i.creeLe||'').slice(0,10)) === dateSel);

      const d = new Date(dateSel);
      const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
      const estAujourd = dateSel === new Date().toISOString().slice(0, 10);

      // Nav prev/next
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      const next = new Date(d); next.setDate(next.getDate() + 1);

      const totalEvenements = livraisons.length + carburant.length + entretiens.length + incidents.length;

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
      `;

      if (!totalEvenements) {
        html += `<div class="m-empty"><div class="m-empty-icon">📅</div><h3 class="m-empty-title">Rien à signaler</h3><p class="m-empty-text">Aucune livraison, plein, entretien ou incident pour cette journée.</p></div>`;
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
  M.logout = function() {
    if (!confirm('Se déconnecter ?')) return;
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
  function initRemoteSync() {
    if (!window.DelivProRemoteStorage || typeof window.DelivProRemoteStorage.init !== 'function') return Promise.resolve();
    return window.DelivProRemoteStorage.init().then(result => {
      // Refresh la page courante avec les donnees fraiches Supabase
      if (M.state.currentPage) M.go(M.state.currentPage);
      M.updateAlertesBadge();
      return result;
    }).catch(err => {
      console.warn('[mobile] DelivProRemoteStorage init', err);
    });
  }

  function init() {
    if (!M.verifierAuth()) return;
    M.applyTheme();
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
    // Submit avec Enter dans un input (sauf textarea)
    $('#m-sheet-body')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        M.submitSheet();
      }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
