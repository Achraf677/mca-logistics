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
  M.formNouvelleLivraison = function() {
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const salaries = M.charger('salaries').filter(s => s && s.statut !== 'inactif' && !s.archive);
    const today = new Date().toISOString().slice(0, 10);

    const body = `
      ${M.formField('Client', M.formInput('client', { placeholder: 'Nom du client', required: true, autocomplete: 'off' }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: today, required: true }), { required: true })}
        ${M.formField('N° livraison', M.formInput('numLiv', { placeholder: 'Auto si vide' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Prix HT', M.formInputWithSuffix('prix', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', required: true }), { required: true })}
        ${M.formField('Distance', M.formInputWithSuffix('distance', 'km', { type: 'number', step: '0.1', min: '0', placeholder: '0' }))}
      </div>
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.immatriculation || v.id })), { placeholder: 'Choisir un véhicule', value: '' }))}
      ${M.formField('Chauffeur', M.formSelect('salarieId', salaries.map(s => ({ value: s.id, label: s.nom || s.id })), { placeholder: 'Choisir un chauffeur', value: '' }))}
      ${M.formField('Statut', M.formSelect('statut', [
        { value: 'planifiee', label: 'Planifiée' },
        { value: 'en_cours',  label: 'En cours' },
        { value: 'livree',    label: 'Livrée' },
        { value: 'facturee',  label: 'Facturée' }
      ], { value: 'livree' }))}
    `;

    M.openSheet({
      title: '➕ Nouvelle livraison',
      body,
      submitLabel: 'Enregistrer',
      onSubmit() {
        M.toast('💡 Visuel OK — connexion en v2.5');
        return true;
      }
    });
  };

  M.formNouveauPlein = function() {
    const vehicules = M.charger('vehicules').filter(v => v && !v.archive);
    const today = new Date().toISOString().slice(0, 10);

    const body = `
      ${M.formField('Véhicule', M.formSelect('vehiculeId', vehicules.map(v => ({ value: v.id, label: v.immat || v.immatriculation || v.id })), { placeholder: 'Choisir un véhicule', required: true }), { required: true })}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: today, required: true }), { required: true })}
        ${M.formField('Km compteur', M.formInputWithSuffix('kmCompteur', 'km', { type: 'number', step: '1', min: '0', placeholder: '0' }))}
      </div>
      <div class="m-form-row">
        ${M.formField('Litres', M.formInputWithSuffix('litres', 'L', { type: 'number', step: '0.01', min: '0', placeholder: '0', required: true }), { required: true })}
        ${M.formField('Prix au litre', M.formInputWithSuffix('prixLitre', '€/L', { type: 'number', step: '0.001', min: '0', placeholder: '0.000' }))}
      </div>
      ${M.formField('Total payé', M.formInputWithSuffix('total', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', required: true }), { hint: 'Si laissé vide, calculé automatiquement (litres × prix/L)', required: true })}
    `;

    M.openSheet({
      title: '⛽ Nouveau plein',
      body,
      submitLabel: 'Enregistrer',
      afterMount(body) {
        // Auto-calcul total si litres + prix/L sont remplis et total est vide
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
      },
      onSubmit() {
        M.toast('💡 Visuel OK — connexion en v2.5');
        return true;
      }
    });
  };

  M.formNouvelleCharge = function() {
    const today = new Date().toISOString().slice(0, 10);

    const body = `
      ${M.formField('Libellé', M.formInput('libelle', { placeholder: 'Ex: Loyer atelier, Assurance...', required: true }), { required: true })}
      ${M.formField('Fournisseur', M.formInput('fournisseur', { placeholder: 'Nom fournisseur' }))}
      <div class="m-form-row">
        ${M.formField('Date', M.formInput('date', { type: 'date', value: today, required: true }), { required: true })}
        ${M.formField('Montant TTC', M.formInputWithSuffix('montantTtc', '€', { type: 'number', step: '0.01', min: '0', placeholder: '0.00', required: true }), { required: true })}
      </div>
      ${M.formField('Catégorie', M.formSelect('categorie', [
        { value: 'loyer',     label: '🏢 Loyer' },
        { value: 'assurance', label: '🛡️ Assurance' },
        { value: 'energie',   label: '⚡ Énergie' },
        { value: 'telecom',   label: '📞 Télécom' },
        { value: 'banque',    label: '🏦 Frais bancaires' },
        { value: 'compta',    label: '📊 Comptabilité' },
        { value: 'autre',     label: '📌 Autre' }
      ], { placeholder: 'Choisir une catégorie' }))}
      ${M.formField('Statut', M.formSelect('statut', [
        { value: 'a_payer', label: '⏳ À payer' },
        { value: 'paye',    label: '✅ Payée' },
        { value: 'partiel', label: '🟡 Partielle' }
      ], { value: 'a_payer' }))}
    `;

    M.openSheet({
      title: '💸 Nouvelle charge',
      body,
      submitLabel: 'Enregistrer',
      onSubmit() {
        M.toast('💡 Visuel OK — connexion en v2.5');
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
    $('#m-title').textContent = route.title || '—';
    // Bouton menu page (kebab) ouvre un menu page-specifique si defini
    const kebabBtn = $('#m-page-menu-btn');
    kebabBtn.hidden = !route.kebab;
    if (route.kebab) kebabBtn.onclick = route.kebab;
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
                <div class="m-card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px">
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
                </div>
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
                return `<div class="m-card" style="padding:14px">
                  <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
                    <div style="flex:1 1 auto;min-width:0">
                      <div style="font-weight:600;font-size:.95rem">${M.escHtml(immat)}</div>
                      <div style="color:var(--m-text-muted);font-size:.8rem;margin-top:3px">${M.formatDate(p.date)}${p.kmCompteur ? ' · ' + M.formatNum(p.kmCompteur) + ' km' : ''}</div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <div style="font-weight:700;color:var(--m-red);white-space:nowrap;font-size:.95rem">${M.format$(p.total)}</div>
                      <div style="font-size:.75rem;color:var(--m-text-muted);margin-top:2px">${(Number(p.litres) || 0).toFixed(1)} L${p.prixLitre ? ' · ' + Number(p.prixLitre).toFixed(3) + '€/L' : ''}</div>
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

  // ---------- Charges (v2.3 : liste lecture seule + filtre statut) ----------
  M.state.chargesStatut = 'tous'; // tous | a_payer | paye
  M.register('charges', {
    title: 'Charges',
    render() {
      const charges = M.charger('charges');
      const moisCourant = new Date().toISOString().slice(0, 7);
      const courantes = charges.filter(c => (c.date || '').startsWith(moisCourant));
      const totalMois = courantes.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);
      const aPayer = charges.filter(c => c.statut !== 'paye' && c.statut !== 'payee');
      const totalImpayes = aPayer.reduce((s, c) => s + (Number(c.montantTtc) || Number(c.montant) || 0), 0);

      // Statut filter
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
        html += `<div class="m-empty"><div class="m-empty-icon">💸</div><h3 class="m-empty-title">Aucune charge</h3><p class="m-empty-text">${statut === 'a_payer' ? 'Tu es à jour, aucune charge en attente.' : 'Les charges saisies apparaitront ici.'}</p></div>`;
        return html;
      }

      sorted.forEach(c => {
        const montant = Number(c.montantTtc) || Number(c.montant) || 0;
        const estPayee = c.statut === 'paye' || c.statut === 'payee';
        const estPartielle = c.statut === 'partiel';
        // Retard : non payee + date passee de plus de 7j
        const enRetard = !estPayee && c.date && (new Date(c.date) < new Date(Date.now() - 7*86400000));
        const statutLabel = estPayee ? '✅ Payée' : estPartielle ? '🟡 Partielle' : (enRetard ? '🔴 Retard' : '⏳ À payer');
        const statutColor = estPayee ? 'var(--m-green)' : estPartielle ? 'var(--m-accent)' : (enRetard ? 'var(--m-red)' : 'var(--m-text-muted)');
        const borderColor = estPayee ? 'var(--m-green)' : (enRetard ? 'var(--m-red)' : 'var(--m-accent)');

        html += `<div class="m-card" style="padding:14px;border-left:4px solid ${borderColor}">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
            <div style="flex:1 1 auto;min-width:0">
              <div style="font-weight:600;font-size:.95rem;margin-bottom:3px">${M.escHtml(c.libelle || c.fournisseur || 'Charge')}</div>
              <div style="color:var(--m-text-muted);font-size:.8rem">${M.formatDate(c.date)}${c.fournisseur && c.libelle ? ' · ' + M.escHtml(c.fournisseur) : ''}${c.categorie ? ' · ' + M.escHtml(c.categorie) : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-weight:700;white-space:nowrap;font-size:.95rem">${M.format$(montant)}</div>
              <div style="font-size:.7rem;color:${statutColor};font-weight:600;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${statutLabel}</div>
            </div>
          </div>
        </div>`;
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
  M.register('clients',     makeStub('Clients',     '🧑‍💼', 'Fiche client, historique, relances.'));
  M.register('fournisseurs',makeStub('Fournisseurs','🏭', 'Fiches fournisseurs, charges associees.'));
  M.register('vehicules',   makeStub('Véhicules',   '🚐', 'Parc auto, CT, assurances.'));
  M.register('entretiens',  makeStub('Entretiens',  '🔧', 'Vidanges, reparations, rappels.'));
  M.register('inspections', makeStub('Inspections', '🚗', 'Etat reel des vehicules, conformite.'));
  M.register('salaries',    makeStub('Salariés',    '👥', 'Fiches, contrats, permis, assurances.'));
  M.register('heures',      makeStub('Heures & Km', '⏱️', 'Heures sup, indemnites, km parcourus.'));
  M.register('incidents',   makeStub('Incidents',   '🚨', 'Incidents de route, sinistres.'));
  M.register('tva',         makeStub('TVA',         '🧾', 'Recap TVA collectee/deductible/a reverser.'));
  M.register('statistiques',makeStub('Statistiques','📈', 'Evolutions, comparatifs, exports.'));
  M.register('calendrier',  makeStub('Calendrier',  '🗓️', 'Vue calendrier mois/semaine/jour.'));
  M.register('parametres',  makeStub('Paramètres',  '⚙️', 'Entreprise, tarifs, utilisateurs, donnees.'));

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

    // Back button (pour vues filles, pas utilise en v1)
    $('#m-back-btn')?.addEventListener('click', () => {
      if (M.state.backStack.length) {
        M.go(M.state.backStack.pop());
      }
    });

    // Initial route : dashboard ou page demandee via #
    const initialPage = (location.hash || '').replace('#', '') || 'dashboard';
    M.go(initialPage in M.routes ? initialPage : 'dashboard');

    // Auto-refresh badge alertes toutes les 30s (au cas ou desktop sync nouvelles alertes)
    setInterval(M.updateAlertesBadge, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
