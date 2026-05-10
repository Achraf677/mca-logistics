/**
 * MCA Logistics — Setup wizard onboarding (PC)
 *
 * Affiche un modal 4 etapes a la 1ere connexion admin pour collecter
 * les infos minimales : branding entreprise + TVA + postes/categories
 * + recap. Persistance en localStorage (params_entreprise / postes /
 * charges_categories) + sync Supabase via les adapters existants
 * (cf. supabase-storage-sync.js qui hook setItem). Migration 040
 * prepare la table cible parametres_entreprise.
 *
 * Detection 1ere connexion :
 *   - localStorage `mca_setup_done` !== '1'
 *   - ET (params_entreprise vide OU sans nom)
 *
 * Boutons :
 *   - "Plus tard" : ferme sans flag (reapparait au prochain login)
 *   - "Tout configurer apres" : flag = '1' (skip definitif)
 *   - "Configurer mon espace" (etape 4) : sauvegarde + flag = '1'
 *
 * Toutes les fonctions au scope global (window.MCASetup.*) pour
 * compatibilite onclick.
 */
(function () {
  'use strict';
  if (window.MCASetup && window.MCASetup.__installed) return;

  // ------------------------------------------------------------
  // Constantes
  // ------------------------------------------------------------
  var FLAG_KEY = 'mca_setup_done';
  var POSTES_DEFAUT = [
    'Chauffeur PL',
    'Chauffeur SPL',
    'Logisticien',
    'Mécanicien'
  ];
  var CATEGORIES_DEFAUT = [
    'Carburant',
    'Entretien',
    'Assurance',
    'Loyer',
    'Téléphonie',
    'Péages',
    'Fournitures'
  ];
  var TAUX_TVA_OPTIONS = [
    { val: 0, label: '0 %' },
    { val: 5.5, label: '5,5 %' },
    { val: 10, label: '10 %' },
    { val: 20, label: '20 %' }
  ];
  var REGIMES_TVA = [
    { val: 'reel_normal',     label: 'Réel normal' },
    { val: 'reel_simplifie',  label: 'Réel simplifié' },
    { val: 'franchise_base',  label: 'Franchise en base' }
  ];

  // ------------------------------------------------------------
  // Etat
  // ------------------------------------------------------------
  var state = {
    step: 1,
    branding: {
      nom: '', siret: '', adresse: '', codePostal: '', ville: '',
      tel: '', email: '', logoUrl: ''
    },
    tva: {
      regime: 'reel_normal',
      periodicite: 'mensuelle',
      tauxLivraison: 20,
      tauxCharge: 20
    },
    postes: POSTES_DEFAUT.slice(),
    categories: CATEGORIES_DEFAUT.slice()
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Reutilise validerSIRET defini dans script.js (Luhn + exception La Poste)
  function isValidSiret(s) {
    if (typeof window.validerSIRET === 'function') return window.validerSIRET(s);
    var x = String(s || '').replace(/\s+/g, '');
    if (!/^\d{14}$/.test(x)) return false;
    var sum = 0;
    for (var i = 0; i < 14; i++) {
      var n = parseInt(x[13 - i], 10);
      if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  }

  function toast(msg, type) {
    if (typeof window.afficherToast === 'function') {
      window.afficherToast(msg, type || 'info');
    } else {
      // Fallback minimal si toast pas encore charge (boot precoce)
      try { console.log('[setup]', msg); } catch (_) {}
    }
  }

  // ------------------------------------------------------------
  // Detection 1ere connexion
  // ------------------------------------------------------------
  function shouldShow() {
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') return false;
      var raw = localStorage.getItem('params_entreprise');
      if (!raw) return true;
      var p = JSON.parse(raw);
      // "Vide" si pas de nom OU nom defaut "MCA LOGISTICS" ET pas de siret
      if (!p || !p.nom || (!p.siret && p.nom === 'MCA LOGISTICS')) return true;
      return false;
    } catch (_) {
      return true;
    }
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  function injectStylesOnce() {
    if (document.getElementById('mca-setup-styles')) return;
    var style = document.createElement('style');
    style.id = 'mca-setup-styles';
    style.textContent =
      '#mca-setup-wizard{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;overflow-y:auto}' +
      '#mca-setup-wizard.active{display:flex}' +
      '#mca-setup-wizard .modal{background:var(--bg-card,#fff);color:var(--text,#1a1a1a);border-radius:14px;box-shadow:0 14px 60px rgba(0,0,0,.35);display:flex;flex-direction:column}' +
      '#mca-setup-wizard .modal-header{padding:14px 18px;border-bottom:1px solid var(--border,#e5e7eb)}' +
      '#mca-setup-wizard .modal-body{padding:14px 18px}' +
      '#mca-setup-wizard input,#mca-setup-wizard select{padding:8px 10px;border:1px solid var(--border,#d1d5db);border-radius:8px;background:var(--bg-input,#fff);color:inherit;font-size:.92rem;width:100%;box-sizing:border-box}' +
      '#mca-setup-wizard .btn-primary{background:var(--accent,#f5a623);color:#fff;border:none;padding:9px 14px;border-radius:8px;cursor:pointer;font-weight:600}' +
      '#mca-setup-wizard .btn-secondary{background:transparent;border:1px solid var(--border,#d1d5db);padding:9px 14px;border-radius:8px;cursor:pointer;color:inherit}' +
      '#mca-setup-wizard .modal-close{background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted,#888)}' +
      '@media (max-width:600px){#mca-setup-wizard{padding:0}#mca-setup-wizard .modal{width:100%;max-width:100%;height:100vh;max-height:100vh;border-radius:0}}';
    document.head.appendChild(style);
  }

  function renderShell() {
    injectStylesOnce();
    var container = document.getElementById('mca-setup-wizard');
    if (!container) {
      container = document.createElement('div');
      container.id = 'mca-setup-wizard';
      container.setAttribute('role', 'dialog');
      container.setAttribute('aria-modal', 'true');
      container.setAttribute('aria-labelledby', 'mca-setup-title');
      document.body.appendChild(container);
    }
    container.innerHTML =
      '<div class="modal" style="max-width:600px;width:96%;max-height:90vh;overflow-y:auto">' +
        '<div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">' +
          '<h3 id="mca-setup-title">🚀 Bienvenue chez MCA Logistics</h3>' +
          '<button type="button" class="modal-close" aria-label="Plus tard" onclick="window.MCASetup.later()">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div id="mca-setup-progress" style="display:flex;gap:6px;margin-bottom:18px" aria-label="Progression">' +
            [1,2,3,4].map(function (i) {
              var on = i <= state.step;
              return '<div data-step-pip="' + i + '" style="flex:1;height:4px;border-radius:2px;background:' + (on ? 'var(--accent, #f5a623)' : 'var(--border, #e5e7eb)') + '"></div>';
            }).join('') +
          '</div>' +
          '<div id="mca-setup-body"></div>' +
        '</div>' +
        '<div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--border, #e5e7eb)">' +
          '<button type="button" class="btn-link" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;text-decoration:underline" onclick="window.MCASetup.skipAll()">Tout configurer après</button>' +
          '<div id="mca-setup-nav" style="display:flex;gap:8px"></div>' +
        '</div>' +
      '</div>';
    renderStep();
  }

  function renderStep() {
    var body = document.getElementById('mca-setup-body');
    var nav = document.getElementById('mca-setup-nav');
    if (!body || !nav) return;
    // Pips progression
    document.querySelectorAll('[data-step-pip]').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-step-pip'), 10);
      el.style.background = i <= state.step ? 'var(--accent, #f5a623)' : 'var(--border, #e5e7eb)';
    });

    if (state.step === 1) body.innerHTML = renderStep1();
    else if (state.step === 2) body.innerHTML = renderStep2();
    else if (state.step === 3) body.innerHTML = renderStep3();
    else if (state.step === 4) body.innerHTML = renderStep4();

    // Nav buttons
    var navHtml = '';
    if (state.step > 1) {
      navHtml += '<button type="button" class="btn-secondary" onclick="window.MCASetup.prev()">← Précédent</button>';
    }
    navHtml += '<button type="button" class="btn-secondary" onclick="window.MCASetup.later()">Plus tard</button>';
    if (state.step < 4) {
      navHtml += '<button type="button" class="btn-primary" onclick="window.MCASetup.next()">Suivant →</button>';
    } else {
      navHtml += '<button type="button" class="btn-primary" onclick="window.MCASetup.finish()">✅ Configurer mon espace</button>';
    }
    nav.innerHTML = navHtml;
  }

  // ------------------------------------------------------------
  // Step 1 — Branding
  // ------------------------------------------------------------
  function renderStep1() {
    var b = state.branding;
    return '' +
      '<h4 style="margin:0 0 10px">Étape 1/4 — Identité de l\'entreprise</h4>' +
      '<p style="color:var(--text-muted);margin:0 0 14px;font-size:.92rem">Quelques infos pour personnaliser vos exports, factures et le brief IA.</p>' +
      '<div style="display:grid;gap:10px">' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Logo (optionnel)</span>' +
          '<input type="file" id="setup-logo-file" accept="image/*" onchange="window.MCASetup.onLogoChange(this)" />' +
          '<span id="setup-logo-status" style="font-size:.8rem;color:var(--text-muted)">' + (b.logoUrl ? '✅ Logo enregistré' : '') + '</span>' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Nom de l\'entreprise *</span>' +
          '<input type="text" id="setup-nom" value="' + escHtml(b.nom) + '" placeholder="Ex : MCA LOGISTICS" />' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>SIRET (14 chiffres, optionnel)</span>' +
          '<input type="text" id="setup-siret" value="' + escHtml(b.siret) + '" placeholder="14 chiffres" inputmode="numeric" maxlength="14" />' +
          '<span id="setup-siret-hint" style="font-size:.78rem;color:var(--text-muted)">Laissez vide si en cours d\'immatriculation.</span>' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Adresse</span>' +
          '<input type="text" id="setup-adresse" value="' + escHtml(b.adresse) + '" placeholder="N°, rue" />' +
        '</label>' +
        '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
            '<span>Code postal</span>' +
            '<input type="text" id="setup-cp" value="' + escHtml(b.codePostal) + '" inputmode="numeric" maxlength="5" />' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
            '<span>Ville</span>' +
            '<input type="text" id="setup-ville" value="' + escHtml(b.ville) + '" />' +
          '</label>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
            '<span>Téléphone</span>' +
            '<input type="tel" id="setup-tel" value="' + escHtml(b.tel) + '" placeholder="01 23 45 67 89" />' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
            '<span>Email pro</span>' +
            '<input type="email" id="setup-email" value="' + escHtml(b.email) + '" placeholder="contact@..." />' +
          '</label>' +
        '</div>' +
      '</div>';
  }

  function readStep1() {
    var get = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var siret = get('setup-siret').replace(/\s+/g, '');
    if (siret && !isValidSiret(siret)) {
      toast('⚠️ SIRET invalide (Luhn ou format)', 'error');
      return false;
    }
    state.branding = {
      nom: get('setup-nom').trim(),
      siret: siret,
      adresse: get('setup-adresse').trim(),
      codePostal: get('setup-cp').trim(),
      ville: get('setup-ville').trim(),
      tel: get('setup-tel').trim(),
      email: get('setup-email').trim(),
      logoUrl: state.branding.logoUrl
    };
    if (!state.branding.nom) {
      toast('⚠️ Le nom de l\'entreprise est requis', 'error');
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------
  // Step 2 — TVA
  // ------------------------------------------------------------
  function renderStep2() {
    var t = state.tva;
    var optTaux = function (current) {
      return TAUX_TVA_OPTIONS.map(function (o) {
        return '<option value="' + o.val + '"' + (Number(current) === o.val ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
    };
    var optRegime = REGIMES_TVA.map(function (r) {
      return '<option value="' + r.val + '"' + (t.regime === r.val ? ' selected' : '') + '>' + r.label + '</option>';
    }).join('');
    return '' +
      '<h4 style="margin:0 0 10px">Étape 2/4 — Paramètres TVA</h4>' +
      '<p style="color:var(--text-muted);margin:0 0 14px;font-size:.92rem">Régime et taux par défaut. Modifiable plus tard dans Paramètres → Société.</p>' +
      '<div style="display:grid;gap:12px">' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Régime TVA</span>' +
          '<select id="setup-tva-regime">' + optRegime + '</select>' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Périodicité de déclaration</span>' +
          '<select id="setup-tva-periodicite">' +
            '<option value="mensuelle"' + (t.periodicite === 'mensuelle' ? ' selected' : '') + '>Mensuelle</option>' +
            '<option value="trimestrielle"' + (t.periodicite === 'trimestrielle' ? ' selected' : '') + '>Trimestrielle</option>' +
          '</select>' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Taux par défaut sur les livraisons</span>' +
          '<select id="setup-tva-livraison">' + optTaux(t.tauxLivraison) + '</select>' +
        '</label>' +
        '<label style="display:flex;flex-direction:column;gap:4px;font-size:.9rem">' +
          '<span>Taux par défaut sur les charges déductibles</span>' +
          '<select id="setup-tva-charge">' + optTaux(t.tauxCharge) + '</select>' +
        '</label>' +
      '</div>';
  }

  function readStep2() {
    var get = function (id) { return (document.getElementById(id) || {}).value || ''; };
    state.tva = {
      regime: get('setup-tva-regime') || 'reel_normal',
      periodicite: get('setup-tva-periodicite') || 'mensuelle',
      tauxLivraison: parseFloat(get('setup-tva-livraison')) || 20,
      tauxCharge: parseFloat(get('setup-tva-charge')) || 20
    };
    return true;
  }

  // ------------------------------------------------------------
  // Step 3 — Postes & catégories
  // ------------------------------------------------------------
  function chipsHtml(items, listKey) {
    return items.map(function (label, idx) {
      return '<span data-chip data-list="' + listKey + '" data-idx="' + idx + '" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:14px;background:var(--bg-card,#f4f4f5);border:1px solid var(--border,#e5e7eb);font-size:.86rem">' +
        escHtml(label) +
        ' <button type="button" aria-label="Retirer ' + escHtml(label) + '" onclick="window.MCASetup.removeItem(\'' + listKey + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;color:var(--text-muted)">✕</button>' +
        '</span>';
    }).join(' ');
  }

  function renderStep3() {
    return '' +
      '<h4 style="margin:0 0 10px">Étape 3/4 — Postes & catégories</h4>' +
      '<p style="color:var(--text-muted);margin:0 0 14px;font-size:.92rem">Pré-rempli avec les valeurs typiques transport. Ajoutez ou retirez selon vos besoins.</p>' +
      '<div style="display:grid;gap:14px">' +
        '<div>' +
          '<label style="display:block;margin-bottom:6px;font-weight:600">Postes</label>' +
          '<div id="setup-postes-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + chipsHtml(state.postes, 'postes') + '</div>' +
          '<div style="display:flex;gap:6px">' +
            '<input type="text" id="setup-poste-new" placeholder="Nouveau poste..." style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();window.MCASetup.addItem(\'postes\')}" />' +
            '<button type="button" class="btn-secondary" onclick="window.MCASetup.addItem(\'postes\')">+ Ajouter</button>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label style="display:block;margin-bottom:6px;font-weight:600">Catégories de charges</label>' +
          '<div id="setup-cats-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + chipsHtml(state.categories, 'categories') + '</div>' +
          '<div style="display:flex;gap:6px">' +
            '<input type="text" id="setup-cat-new" placeholder="Nouvelle catégorie..." style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();window.MCASetup.addItem(\'categories\')}" />' +
            '<button type="button" class="btn-secondary" onclick="window.MCASetup.addItem(\'categories\')">+ Ajouter</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function readStep3() { return true; /* etat deja en memoire */ }

  // ------------------------------------------------------------
  // Step 4 — Récap
  // ------------------------------------------------------------
  function renderStep4() {
    var b = state.branding, t = state.tva;
    var regimeLabel = (REGIMES_TVA.find(function (r) { return r.val === t.regime; }) || {}).label || t.regime;
    var line = function (label, value) {
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#eee)"><span style="color:var(--text-muted)">' + label + '</span><span><b>' + escHtml(value || '—') + '</b></span></div>';
    };
    return '' +
      '<h4 style="margin:0 0 10px">Étape 4/4 — Récapitulatif</h4>' +
      '<p style="color:var(--text-muted);margin:0 0 14px;font-size:.92rem">Vérifiez avant validation. Tout reste modifiable depuis Paramètres.</p>' +
      '<div style="display:grid;gap:6px;font-size:.92rem">' +
        '<div style="font-weight:600;margin-top:4px">Identité</div>' +
        line('Nom', b.nom) +
        line('SIRET', b.siret) +
        line('Adresse', [b.adresse, b.codePostal, b.ville].filter(Boolean).join(', ')) +
        line('Contact', [b.tel, b.email].filter(Boolean).join(' · ')) +
        line('Logo', b.logoUrl ? 'enregistré' : 'aucun') +
        '<div style="font-weight:600;margin-top:10px">TVA</div>' +
        line('Régime', regimeLabel) +
        line('Périodicité', t.periodicite) +
        line('Taux livraisons', t.tauxLivraison + ' %') +
        line('Taux charges', t.tauxCharge + ' %') +
        '<div style="font-weight:600;margin-top:10px">Catalogues</div>' +
        line('Postes', state.postes.join(', ')) +
        line('Catégories charges', state.categories.join(', ')) +
      '</div>';
  }

  // ------------------------------------------------------------
  // Persistance
  // ------------------------------------------------------------
  function persist() {
    var b = state.branding, t = state.tva;
    // 1) params_entreprise (cle existante consommee partout dans l'app)
    var existing = {};
    try { existing = JSON.parse(localStorage.getItem('params_entreprise') || '{}') || {}; } catch (_) {}
    var params = Object.assign({}, existing, {
      nom: b.nom || existing.nom || 'MCA LOGISTICS',
      siret: b.siret || existing.siret || '',
      adresse: b.adresse || existing.adresse || '',
      codePostal: b.codePostal || existing.codePostal || '',
      ville: b.ville || existing.ville || '',
      tel: b.tel || existing.tel || '',
      email: b.email || existing.email || '',
      // TVA — cles compatibles avec script-tva.js
      regimeTva: t.regime,
      periodiciteTva: t.periodicite,
      tauxTvaDefautLivraison: t.tauxLivraison,
      tauxTvaDefautCharge: t.tauxCharge
    });
    try {
      localStorage.setItem('params_entreprise', JSON.stringify(params));
    } catch (e) {
      toast('⚠️ Echec sauvegarde locale', 'error');
      return false;
    }
    // 2) postes / charges_categories
    try { localStorage.setItem('postes', JSON.stringify(state.postes)); } catch (_) {}
    try { localStorage.setItem('charges_categories', JSON.stringify(state.categories)); } catch (_) {}
    // 3) audit log front (helper existant) — best effort
    try {
      if (typeof window.ajouterEntreeAudit === 'function') {
        window.ajouterEntreeAudit('Setup wizard', (params.nom || 'Entreprise') + ' · TVA ' + t.regime);
      }
    } catch (_) {}
    // 4) Re-applique branding (logo + nom topbar/sidebar)
    try { if (typeof window.appliquerBranding === 'function') window.appliquerBranding(); } catch (_) {}
    try { if (typeof window.chargerNomEntreprise === 'function') window.chargerNomEntreprise(); } catch (_) {}
    return true;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  function show() {
    state.step = 1;
    // Pre-fill from existing params if reopened
    try {
      var p = JSON.parse(localStorage.getItem('params_entreprise') || '{}');
      if (p && typeof p === 'object') {
        state.branding.nom = p.nom || '';
        state.branding.siret = p.siret || '';
        state.branding.adresse = p.adresse || '';
        state.branding.codePostal = p.codePostal || '';
        state.branding.ville = p.ville || '';
        state.branding.tel = p.tel || '';
        state.branding.email = p.email || '';
      }
      state.branding.logoUrl = (typeof window.getLogoEntreprise === 'function' ? window.getLogoEntreprise() : '') || '';
      var rawPostes = localStorage.getItem('postes');
      if (rawPostes) { var arr = JSON.parse(rawPostes); if (Array.isArray(arr) && arr.length) state.postes = arr.slice(); }
      var rawCats = localStorage.getItem('charges_categories');
      if (rawCats) { var arr2 = JSON.parse(rawCats); if (Array.isArray(arr2) && arr2.length) state.categories = arr2.slice(); }
    } catch (_) {}
    renderShell();
    var c = document.getElementById('mca-setup-wizard');
    if (c) {
      c.style.display = 'flex';
      c.classList.add('active');
    }
  }

  function hide() {
    var c = document.getElementById('mca-setup-wizard');
    if (c) {
      c.style.display = 'none';
      c.classList.remove('active');
    }
  }

  function next() {
    var ok = true;
    if (state.step === 1) ok = readStep1();
    else if (state.step === 2) ok = readStep2();
    else if (state.step === 3) ok = readStep3();
    if (!ok) return;
    if (state.step < 4) state.step += 1;
    renderStep();
  }

  function prev() {
    // Sauvegarde l'etat de l'etape courante en passe-droit (sans valider)
    if (state.step === 1) { try { readStep1(); } catch (_) {} }
    else if (state.step === 2) { try { readStep2(); } catch (_) {} }
    if (state.step > 1) state.step -= 1;
    renderStep();
  }

  function later() {
    // Sauvegarde best-effort de ce qui est saisi sans flag final
    try {
      if (state.step === 1) readStep1();
      else if (state.step === 2) readStep2();
    } catch (_) {}
    hide();
    toast('💾 Vous pourrez reprendre à votre prochaine connexion');
  }

  function skipAll() {
    try { localStorage.setItem(FLAG_KEY, '1'); } catch (_) {}
    hide();
    toast('Configuration passée. Accessible via Paramètres → Société.');
    // Bascule dashboard apres skip (sinon mobile reste bloque sur "Chargement...")
    navigateToDashboard();
  }

  function finish() {
    if (!persist()) return;
    try { localStorage.setItem(FLAG_KEY, '1'); } catch (_) {}
    hide();
    toast('✅ Espace configuré', 'success');
    navigateToDashboard();
  }

  // Helper unique : navigue vers dashboard, gere PC + mobile + chauffeur.
  // BUG mobile : avant le fix, finish() appelait window.naviguerVers (PC seul)
  // -> mobile (MCAm.go) restait bloque sur le state initial "Chargement...".
  function navigateToDashboard() {
    try {
      if (typeof window.naviguerVers === 'function') {
        window.naviguerVers('dashboard');
        return;
      }
      if (window.MCAm && typeof window.MCAm.go === 'function') {
        window.MCAm.go('dashboard');
        return;
      }
      // Dernier recours : reload pour relancer le boot complet
      try { window.location.reload(); } catch (_) {}
    } catch (_) {}
  }

  function addItem(listKey) {
    var inputId = listKey === 'postes' ? 'setup-poste-new' : 'setup-cat-new';
    var input = document.getElementById(inputId);
    if (!input) return;
    var v = (input.value || '').trim();
    if (!v) return;
    var arr = (listKey === 'postes' ? state.postes : state.categories);
    if (arr.some(function (x) { return x.toLowerCase() === v.toLowerCase(); })) {
      toast('⚠️ Déjà présent', 'error'); return;
    }
    arr.push(v);
    input.value = '';
    renderStep();
  }

  function removeItem(listKey, idx) {
    var arr = (listKey === 'postes' ? state.postes : state.categories);
    if (idx >= 0 && idx < arr.length) arr.splice(idx, 1);
    renderStep();
  }

  async function onLogoChange(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    var status = document.getElementById('setup-logo-status');
    if (status) status.textContent = '⏳ Upload en cours...';
    try {
      if (typeof window.uploaderLogoEntreprise === 'function') {
        var url = await window.uploaderLogoEntreprise(file);
        state.branding.logoUrl = url || '';
        if (status) status.textContent = url ? '✅ Logo enregistré' : '';
        try { if (typeof window.appliquerBranding === 'function') window.appliquerBranding(); } catch (_) {}
      } else {
        // Fallback : data URL en localStorage (degrade, sans bucket Supabase)
        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target && e.target.result || '';
          if (dataUrl) {
            try { localStorage.setItem('logo_entreprise', dataUrl); } catch (_) {}
            state.branding.logoUrl = dataUrl;
            if (status) status.textContent = '✅ Logo enregistré (local)';
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (e) {
      if (status) status.textContent = '⚠️ Echec upload : ' + (e && e.message || 'erreur');
      toast('⚠️ Logo non envoyé', 'error');
    }
  }

  function isAdminSession() {
    try {
      var login = sessionStorage.getItem('admin_login') || '';
      var email = sessionStorage.getItem('admin_email') || '';
      return !!(login || email);
    } catch (_) { return false; }
  }

  function autoBoot() {
    if (!isAdminSession()) return;     // chauffeur (salarie) -> jamais le wizard
    if (!shouldShow()) return;
    // Attente courte que l'app soit bootee (toast / branding / session prets)
    setTimeout(function () {
      if (isAdminSession() && shouldShow()) show();
    }, 800);
  }

  // ------------------------------------------------------------
  // Expose
  // ------------------------------------------------------------
  window.MCASetup = {
    __installed: true,
    show: show,
    hide: hide,
    next: next,
    prev: prev,
    later: later,
    skipAll: skipAll,
    finish: finish,
    addItem: addItem,
    removeItem: removeItem,
    onLogoChange: onLogoChange,
    shouldShow: shouldShow,
    // #102 audit Chrome : permet de re-declencher le wizard depuis la console
    // ou une page Parametres. Reset le flag local + supprime le cache local
    // params_entreprise pour que le wizard revienne au prochain reload.
    forceReshow: function () {
      try {
        localStorage.removeItem(FLAG_KEY);
        localStorage.removeItem('params_entreprise');
      } catch (_) {}
      open();
    },
    // Exposes pour tests
    _state: state,
    _isValidSiret: isValidSiret,
    _POSTES_DEFAUT: POSTES_DEFAUT,
    _CATEGORIES_DEFAUT: CATEGORIES_DEFAUT
  };

  // Boot auto sur admin.html (PC). Sur mobile, boot via script-mobile-setup-wizard.js.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    autoBoot();
  } else {
    document.addEventListener('DOMContentLoaded', autoBoot);
  }
})();
