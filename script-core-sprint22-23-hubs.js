/**
 * MCA Logistics — Sprint 22+23 — Fusion hubs Équipe/Parc auto/Comptabilité (sidebar consolidée) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4922-5533 (2026-05-16).
 */

/* ==========================================================================
   Sprint 22+23 — Fusion Équipe (+Planning) + Parc auto + Comptabilité
   - Masque 16 anciens liens sidebar (5 Équipe + 4 Parc + 7 Finances)
   - Injecte 3 nouveaux liens (rh / parc / compta) — Calendrier reste standalone
   - Affiche un bandeau de sous-onglets quand on est dans une page du hub
   - Config data-driven (HUBS) — aucune manipulation destructive du DOM, réversible
   ========================================================================== */
(function installS22Fusion(){
  if (window.__s22Installed) return;
  window.__s22Installed = true;

  /* Config data-driven : 3 hubs (Équipe, Parc auto, Comptabilité) — Calendrier reste standalone */
  const HUBS = {
    rh: {
      alias: 'rh',
      title: 'Équipe',
      icon: '👥',
      label: 'Équipe',
      section: 'equipe',
      // Note : 'messagerie' retirée temporairement (page HTML supprimée par
      // commit 09dc43e). À ré-ajouter quand l'onglet Messagerie sera retravaillé.
      pages: ['salaries', 'heures', 'planning', 'incidents'],
      labels: { salaries: 'Salariés', heures: '⏱️ Heures & Km', planning: 'Planning', incidents: 'Incidents' },
      defaultPage: 'salaries',
      storageKey: 's22_last_rh',
    },
    parc: {
      alias: 'parc',
      title: 'Parc auto',
      icon: '🚐',
      label: 'Parc auto',
      section: 'flotte',
      pages: ['vehicules', 'carburant', 'entretiens', 'inspections'],
      labels: { vehicules: 'Véhicules', carburant: '⛽ Carburant', entretiens: 'Entretiens', inspections: 'Inspections' },
      defaultPage: 'vehicules',
      storageKey: 's22_last_parc',
    },
    compta: {
      alias: 'compta',
      title: 'Comptabilité',
      icon: '💼',
      label: 'Finances',
      section: 'finances',
      pages: ['charges', 'encaissement', 'tva', 'rentabilite', 'statistiques'],
      labels: {
        charges: 'Charges',
        encaissement: 'Encaissement',
        tva: 'TVA',
        rentabilite: 'Rentabilité',
        statistiques: 'Statistiques',
      },
      defaultPage: 'charges',
      storageKey: 's22_last_compta',
    },
  };
  const HUB_ALIASES = Object.keys(HUBS);
  const ALL_SUB_PAGES = HUB_ALIASES.flatMap(a => HUBS[a].pages);

  function hubFromPage(page) {
    if (!page) return null;
    for (const a of HUB_ALIASES) if (HUBS[a].pages.includes(page)) return a;
    return null;
  }

  /* Validation au boot : signale les incohérences de config (page absente du DOM,
     label manquant). Évite les "disparitions silencieuses" lorsqu'on ajoute une
     entrée à HUBS.<alias>.pages mais qu'on oublie la <section id="page-X"> ou
     le label associé. */
  function validateHubsConfig() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', validateHubsConfig);
      return;
    }
    HUB_ALIASES.forEach(function(alias) {
      var hub = HUBS[alias];
      hub.pages.forEach(function(page) {
        if (!document.getElementById('page-' + page)) {
          console.warn('[S22] Section DOM manquante : #page-' + page + ' (déclarée dans HUBS.' + alias + '.pages)');
        }
        if (!hub.labels[page]) {
          console.warn('[S22] Label manquant pour "' + page + '" dans HUBS.' + alias + '.labels');
        }
      });
    });
  }
  validateHubsConfig();

  /* Expose la config + helpers pour debug rapide en console DevTools.
     Usage : window.__s22Debug.HUBS.compta.pages, window.__s22Debug.hubFromPage('tva') */
  if (typeof window !== 'undefined') {
    window.__s22Debug = {
      HUBS: HUBS,
      HUB_ALIASES: HUB_ALIASES,
      ALL_SUB_PAGES: ALL_SUB_PAGES,
      hubFromPage: hubFromPage
    };
  }

  /* 1. Masquer tous les anciens liens sidebar (display:none — réversible) */
  function masquerAnciensLiens() {
    ALL_SUB_PAGES.forEach(p => {
      document.querySelectorAll('.nav-item[data-page="' + p + '"]').forEach(el => {
        el.style.display = 'none';
        el.dataset.s22Hidden = '1';
      });
    });
  }

  /* 2. Injecter les nouveaux liens sidebar (1 par hub) */
  function injecterNouveauxLiens() {
    HUB_ALIASES.forEach(alias => {
      const hub = HUBS[alias];
      const container = document.querySelector('[data-section="' + hub.section + '"] .nav-section-content');
      if (!container || container.querySelector('[data-page="' + alias + '"]')) return;
      const a = document.createElement('a');
      a.href = '#'; a.className = 'nav-item'; a.dataset.page = alias;
      a.innerHTML = '<span class="nav-icon">' + hub.icon + '</span><span class="nav-label">' + hub.label + '</span>';
      a.addEventListener('click', (e) => { e.preventDefault(); window.naviguerVers(alias); });
      container.insertBefore(a, container.firstChild);
    });
  }

  /* 3. Bandeau de sous-onglets */
  function ensureBandeau() {
    if (document.getElementById('s22-bandeau')) return;
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    if (!main) return;
    const bandeau = document.createElement('div');
    bandeau.id = 's22-bandeau';
    bandeau.className = 's22-bandeau';
    bandeau.style.display = 'none';
    const topbar = main.querySelector('.topbar');
    if (topbar && topbar.parentNode === main) {
      topbar.insertAdjacentElement('afterend', bandeau);
    } else {
      main.insertBefore(bandeau, main.firstChild);
    }
  }

  function renderBandeau(hubAlias, currentPage) {
    const bandeau = document.getElementById('s22-bandeau');
    if (!bandeau) return;
    if (!hubAlias) { bandeau.style.display = 'none'; bandeau.innerHTML = ''; return; }
    const hub = HUBS[hubAlias];
    if (!hub) return;
    bandeau.innerHTML = `
      <div class="s22-bandeau-title">${hub.title}</div>
      <div class="s22-bandeau-tabs">
        ${hub.pages.map(p => `<button type="button" class="s22-bandeau-tab ${p === currentPage ? 'active' : ''}" data-page="${p}">${hub.labels[p]}</button>`).join('')}
      </div>`;
    bandeau.querySelectorAll('.s22-bandeau-tab').forEach(b => {
      b.onclick = () => window.naviguerVers(b.dataset.page);
    });
    bandeau.style.display = '';
  }

  /* 4. Mise à jour du lien actif sidebar (hub surligné au lieu de l'ancien) */
  function majLiensActifs(hubAlias) {
    document.querySelectorAll('.nav-item').forEach(el => {
      const p = el.dataset.page;
      if (HUB_ALIASES.includes(p)) el.classList.toggle('active', p === hubAlias);
    });
  }

  /* WRAPPER S22 — Hook naviguerVers : gérer alias hub (Finance/Parc/RH/etc.)
     et bandeau de navigation contextuel. Chain pattern : __s22Hooked
     idempotent, capture orig avant override. H2.1. */
  function hookNav() {
    const orig = window.naviguerVers;
    if (!orig || orig.__s22Hooked) return;
    const wrapped = function(page) {
      // Alias hub → ouvre TOUJOURS la page par défaut (reset au clic sur le hub)
      if (HUB_ALIASES.includes(page)) {
        const hub = HUBS[page];
        const defaultPage = hub.defaultPage;
        localStorage.removeItem(hub.storageKey);
        const ret = orig.call(this, defaultPage);
        setTimeout(() => { renderBandeau(page, defaultPage); majLiensActifs(page); }, 50);
        return ret;
      }
      // Navigation vers une page hors hub → reset storage des hubs précédents
      const hubAliasDest = hubFromPage(page);
      if (!hubAliasDest) {
        HUB_ALIASES.forEach(a => localStorage.removeItem(HUBS[a].storageKey));
      } else {
        // Changement de hub : clear les autres hubs (reset)
        HUB_ALIASES.forEach(a => { if (a !== hubAliasDest) localStorage.removeItem(HUBS[a].storageKey); });
      }
      const ret = orig.apply(this, arguments);
      const hubAlias = hubAliasDest;
      setTimeout(() => {
        if (hubAlias) {
          localStorage.setItem(HUBS[hubAlias].storageKey, page);
          renderBandeau(hubAlias, page);
          majLiensActifs(hubAlias);
        } else {
          renderBandeau(null);
          majLiensActifs(null);
        }
      }, 50);
      return ret;
    };
    wrapped.__s22Hooked = true;
    window.naviguerVers = wrapped;
  }

  /* Expose helper pour désactiver S22 en cas de souci */
  window.s22Desactiver = function() {
    document.querySelectorAll('.nav-item[data-s22-hidden="1"]').forEach(el => { el.style.display = ''; delete el.dataset.s22Hidden; });
    HUB_ALIASES.forEach(a => {
      const el = document.querySelector('.nav-item[data-page="' + a + '"]');
      if (el) el.remove();
    });
    const b = document.getElementById('s22-bandeau'); if (b) b.remove();
    if (typeof afficherToast === 'function') afficherToast('S22 désactivée — rechargez la page', 'success');
  };

  function init() {
    masquerAnciensLiens();
    injecterNouveauxLiens();
    ensureBandeau();
    hookNav();
    // Si déjà sur une sous-page au load → afficher bandeau
    const pageActiveEl = document.querySelector('.page.active') || document.querySelector('.page[style*="display: block"]');
    if (pageActiveEl) {
      const id = (pageActiveEl.id || '').replace('page-', '');
      const hubAlias = hubFromPage(id);
      if (hubAlias) { renderBandeau(hubAlias, id); majLiensActifs(hubAlias); }
    }
    // PERF: ancien setInterval 5s remplacé par MutationObserver sur la sidebar
    const sidebarEl = document.querySelector('.sidebar-nav') || document.querySelector('.sidebar');
    if (sidebarEl) {
      const sidebarObs = new MutationObserver(() => { masquerAnciensLiens(); injecterNouveauxLiens(); });
      sidebarObs.observe(sidebarEl, { childList: true, subtree: true });
    }
  }
  // PERF: exposé pour appel synchrone depuis le bootstrap principal (anti-FOUC sidebar)
  window.__s22InitSidebar = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else Promise.resolve().then(init);
})();

/* ==========================================================================
   Sprint 24 — Automatisations 16.1 + raccourcis clavier
   1. Rappel J-5 automatique sur échéances (crée alertes admin)
   2. Escalade relances niv 0→1→2→3 selon délai écoulé
   3. Clôture auto facture quand solde = 0 (100% payé)
   4. Décalage férié/weekend : fonction ajusterEcheance exposée
   5. Auto-facture à clôture livraison (si option activée dans Paramètres)
   6. Raccourcis clavier : Enter, Esc, N, E, Ctrl+S
   ========================================================================== */
(function installS24(){
  if (window.__s24Installed) return;
  window.__s24Installed = true;

  const LS = {
    factures: 'factures_emises',
    livraisons: 'livraisons',
    paiements: 'paiements',
    avoirs: 'avoirs_emis',
    clients: 'clients',
    relances: 'relances_log',
    alertes: 'alertes_admin',
    params: 'params_entreprise',
  };
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const loadObj = (k) => { try { return loadSafe(k, {}); } catch(e){ return {}; } };
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };
  const audit = (a, d) => { if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit(a, d); };
  const todayISO = () => new Date().toLocalISODate();
  const parseD = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
  const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
  const genId = () => 's24_' + (typeof window.genId === 'function' ? window.genId() : Date.now()+'_'+Math.random().toString(36).slice(2,8));

  /* ----- Jours fériés FR (Meeus/Pâques) ----- */
  function paques(y) {
    const a = y%19, b = Math.floor(y/100), c = y%100, d = Math.floor(b/4), e = b%4;
    const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3);
    const h = (19*a+b-d-g+15)%30, i = Math.floor(c/4), k = c%4;
    const L = (32+2*e+2*i-h-k)%7, m = Math.floor((a+11*h+22*L)/451);
    return new Date(y, Math.floor((h+L-7*m+114)/31)-1, ((h+L-7*m+114)%31)+1);
  }
  const _fcache = {};
  function feriesY(y) {
    if (_fcache[y]) return _fcache[y];
    const p = paques(y);
    const add = (d, n) => ({ d: new Date(d).toLocalISODate(), n });
    const lundiPq = new Date(p); lundiPq.setDate(p.getDate()+1);
    const ascension = new Date(p); ascension.setDate(p.getDate()+39);
    const lundiPent = new Date(p); lundiPent.setDate(p.getDate()+50);
    const list = [
      add(new Date(y,0,1), "Jour de l'An"),
      add(lundiPq, 'Lundi de Pâques'),
      add(new Date(y,4,1), 'Fête du Travail'),
      add(new Date(y,4,8), 'Victoire 1945'),
      add(ascension, 'Ascension'),
      add(lundiPent, 'Lundi de Pentecôte'),
      add(new Date(y,6,14), 'Fête nationale'),
      add(new Date(y,7,15), 'Assomption'),
      add(new Date(y,10,1), 'Toussaint'),
      add(new Date(y,10,11), 'Armistice 1918'),
      add(new Date(y,11,25), 'Noël'),
    ];
    _fcache[y] = list;
    return list;
  }
  function estFerie(isoDate) {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    return feriesY(d.getFullYear()).find(f => f.d === isoDate.slice(0,10)) || null;
  }
  function estWeekend(isoDate) {
    const d = new Date(isoDate);
    const j = d.getDay();
    return j === 0 || j === 6;
  }

  /* ----- API exposée : ajuster une échéance (reporte au prochain jour ouvré) ----- */
  window.ajusterEcheance = function(isoDate) {
    if (!isoDate) return isoDate;
    let d = new Date(isoDate + 'T00:00:00');
    let safety = 0;
    while (safety < 10) {
      const iso = d.toLocalISODate();
      if (!estFerie(iso) && !estWeekend(iso)) return iso;
      d.setDate(d.getDate() + 1);
      safety++;
    }
    return isoDate;
  };

  /* ----- Helpers factures ----- */
  function soldeFacture(f) {
    if (!f || f.statut === 'annulée') return 0;
    const pays = load(LS.paiements).filter(p => p.factureId === f.id && (p.sens==='in'||!p.sens)).reduce((s,p)=>s+(parseFloat(p.montant)||0),0);
    const avs = load(LS.avoirs).filter(a => a.factureId === f.id).reduce((s,a)=>s+(parseFloat(a.montantTTC)||0),0);
    return Math.max(0, (parseFloat(f.montantTTC||f.totalTTC||0)||0) - pays - avs);
  }
  function delaiPaiement(f) {
    const livs = load(LS.livraisons);
    const liv = livs.find(l => l.id === f.livId);
    const clients = load(LS.clients);
    let c = null;
    if (liv?.clientId) c = clients.find(x => x.id === liv.clientId);
    if (!c) c = clients.find(x => (x.nom||'').trim().toLowerCase() === (liv?.client||f.client||'').trim().toLowerCase());
    if (c && parseInt(c.delaiPaiementJours, 10) > 0) return parseInt(c.delaiPaiementJours, 10);
    return parseInt(localStorage.getItem('relance_delai'), 10) || 30;
  }
  function echeanceOf(f) {
    const base = f.dateEcheance || f.dateLivraison || f.dateFacture;
    if (!base) return null;
    const d = new Date(base + 'T00:00:00');
    if (!f.dateEcheance) d.setDate(d.getDate() + delaiPaiement(f));
    return d;
  }

  /* ----- 1. Rappels J-5 auto → alertes admin ----- */
  function autoRappelsJ5() {
    if (!getOption('auto_rappel_j5', true)) return;
    const auj = new Date();
    const factures = load(LS.factures).filter(f => f.statut !== 'annulée');
    const alertes = load(LS.alertes);
    let modif = false;
    factures.forEach(f => {
      const solde = soldeFacture(f);
      if (solde <= 0.01) return;
      const ech = echeanceOf(f); if (!ech) return;
      const jours = daysBetween(auj, ech);
      if (jours > 5 || jours < 0) return;
      const existing = alertes.find(a => a.type === 'fact_echeance_j5' && a.refId === f.id && !a.traitee);
      if (existing) return;
      alertes.push({
        id: genId(), type: 'fact_echeance_j5', refId: f.id,
        titre: '⏰ Facture ' + (f.numero||'—') + ' à échéance J-' + jours,
        message: 'Client ' + (f.client||'—') + ' · Solde dû : ' + (solde.toFixed(2)) + ' € · Échéance ' + ech.toLocalISODate(),
        gravite: jours <= 1 ? 'high' : (jours <= 3 ? 'medium' : 'low'),
        traitee: false, dateCreation: new Date().toISOString(), auto: true
      });
      modif = true;
    });
    if (modif) save(LS.alertes, alertes);
  }

  /* ----- 2. Escalade relances niv 0→1→2→3 ----- */
  function autoEscaladeRelances() {
    if (!getOption('auto_escalade_relances', true)) return;
    const delais = {
      0: parseInt(localStorage.getItem('escalade_j0_niv1'), 10) || 7,   // J+7 après échéance → niv 1
      1: parseInt(localStorage.getItem('escalade_niv1_niv2'), 10) || 7,  // +7j → niv 2
      2: parseInt(localStorage.getItem('escalade_niv2_niv3'), 10) || 10, // +10j → niv 3
      3: parseInt(localStorage.getItem('escalade_niv3_conten'), 10) || 15, // +15j → contentieux
    };
    const auj = new Date();
    const factures = load(LS.factures).filter(f => f.statut !== 'annulée');
    const relances = load(LS.relances);
    const alertes = load(LS.alertes);
    let modif = false;
    factures.forEach(f => {
      const solde = soldeFacture(f);
      if (solde <= 0.01) return;
      const ech = echeanceOf(f); if (!ech || ech > auj) return;
      const rf = relances.filter(r => r.factureId === f.id).sort((a,b) => new Date(b.date) - new Date(a.date));
      const niveauActuel = rf.length ? Math.max(...rf.map(r => parseInt(r.niveau, 10)||0)) : -1;
      const prochain = niveauActuel + 1;
      if (prochain > 4) return;
      const dateReference = niveauActuel < 0 ? ech : new Date(rf[0].date);
      const seuil = delais[Math.max(0, niveauActuel)] || 7;
      const joursDepuis = daysBetween(dateReference, auj);
      if (joursDepuis < seuil) return;
      // Crée alerte "escalade à lancer"
      const alertExist = alertes.find(a => a.type === 'relance_escalade' && a.refId === f.id && a.niveauCible === prochain && !a.traitee);
      if (!alertExist) {
        alertes.push({
          id: genId(), type: 'relance_escalade', refId: f.id, niveauCible: prochain,
          titre: 'Relance niv. ' + prochain + ' à lancer — ' + (f.numero||'—'),
          message: 'Client ' + (f.client||'—') + ' · Solde ' + solde.toFixed(2) + ' € · ' + joursDepuis + 'j depuis ' + (niveauActuel<0?'échéance':'niv. '+niveauActuel),
          gravite: prochain >= 3 ? 'high' : 'medium',
          traitee: false, dateCreation: new Date().toISOString(), auto: true
        });
        modif = true;
      }
    });
    if (modif) save(LS.alertes, alertes);
  }

  /* ----- 3. Clôture auto facture si solde 0 ----- */
  function autoClotureFactures() {
    if (!getOption('auto_cloture_factures', true)) return;
    const factures = load(LS.factures);
    let modif = false;
    factures.forEach(f => {
      if (f.statut === 'annulée' || f.statut === 'payée' || f.statut === 'payee') return;
      const solde = soldeFacture(f);
      if (solde <= 0.01) {
        f.statut = 'payée';
        f.datePaiementComplet = f.datePaiementComplet || todayISO();
        modif = true;
        audit('Clôture auto facture', (f.numero||'—') + ' — solde atteint 0');
      }
    });
    if (modif) save(LS.factures, factures);
  }

  /* ----- 4. Auto-facture à clôture livraison ----- */
  function hookLivraisonStatut() {
    if (typeof window.genererFactureLivraison !== 'function') return;
    if (window.__s24HookedLiv) return;
    window.__s24HookedLiv = true;
    // Observer les changements de livraison statut='livre'
    setInterval(() => {
      if (!getOption('auto_facture_livraison', false)) return;
      const livs = load(LS.livraisons);
      const factures = load(LS.factures);
      let succes = 0;
      let dirty = false;
      livs.forEach(l => {
        if (l.statut !== 'livre' && l.statut !== 'livrée' && l.statut !== 'termine') return;
        if (l.factureId || factures.find(f => f.livId === l.id && f.statut !== 'annulée')) return;
        if (l.__s24AutoFactAttempted) return;
        try {
          window.genererFactureLivraison(l.id);
          l.__s24AutoFactAttempted = true;
          dirty = true;
          succes++;
        } catch(e) {
          // Marquer "tenté" même en cas d'échec pour stopper le retry loop infini (sinon spam egress 60s).
          console.warn('[auto-fact] genererFactureLivraison id=' + l.id, e);
          l.__s24AutoFactAttempted = true;
          dirty = true;
        }
      });
      if (dirty) save(LS.livraisons, livs);
      if (succes) toast('📄 ' + succes + ' facture(s) auto-générée(s) depuis livraisons clôturées', 'success');
    }, 60000);
  }

  /* ----- Options Paramètres (lecture) ----- */
  function getOption(key, def) {
    const params = loadObj(LS.params);
    const optsS24 = params.s24 || {};
    return (optsS24[key] !== undefined) ? !!optsS24[key] : def;
  }
  window.s24GetOption = getOption;
  window.s24SetOption = function(key, val) {
    const params = loadObj(LS.params);
    params.s24 = params.s24 || {};
    params.s24[key] = val;
    localStorage.setItem(LS.params, JSON.stringify(params));
  };

  /* ----- 6. Raccourcis clavier globaux ----- */
  function setupKeyboardShortcuts() {
    if (window.__s24KeysBound) return;
    window.__s24KeysBound = true;

    document.addEventListener('keydown', function(e) {
      const tgt = e.target;
      const tag = (tgt.tagName||'').toUpperCase();
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tgt.isContentEditable;
      const openModal = findOpenModal();

      // Esc : ferme modal visible (ou drawer)
      if (e.key === 'Escape') {
        if (openModal) { e.preventDefault(); closeModal(openModal); return; }
        const drawer = document.querySelector('.s20-drawer.open, .s21-drawer.open, .s25-drawer.open');
        if (drawer) { e.preventDefault(); drawer.classList.remove('open'); return; }
      }

      // Enter dans input (hors textarea) d'un modal → submit
      if (e.key === 'Enter' && tag === 'INPUT' && tgt.type !== 'button' && tgt.type !== 'submit' && openModal && !e.shiftKey) {
        // Si le modal contient un bouton primary visible → clic
        const btnPrim = openModal.querySelector('.btn-primary:not([disabled])');
        if (btnPrim) { e.preventDefault(); btnPrim.click(); }
      }

      // Ignorer raccourcis globaux si focus input
      if (isInput) return;
      // Ctrl+S : sauvegarder export (déclenche bouton Export CSV de la page si présent)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const exportBtn = document.querySelector('.page.active .btn-secondary[onclick*="export"], .page[style*="block"] .btn-secondary[onclick*="export"]');
        if (exportBtn) { e.preventDefault(); exportBtn.click(); toast('Export lancé (Ctrl+S)'); }
        return;
      }
      // N : Nouveau (contextuel — cherche bouton + sur la page active)
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pageActive = document.querySelector('.page.active, .page[style*="block"]');
        if (!pageActive) return;
        const btnNouv = pageActive.querySelector('.btn-primary[onclick*="ouvrir"], .btn-primary[onclick*="nouveau"], .btn-primary[onclick*="Nouveau"]');
        if (btnNouv) { e.preventDefault(); btnNouv.click(); }
      }
      // E : Éditer sélection (focus sur première ligne table, ouvre édition si bouton)
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pageActive = document.querySelector('.page.active, .page[style*="block"]');
        if (!pageActive) return;
        const rowSel = pageActive.querySelector('tr.selected, tr:focus');
        const btnEdit = rowSel?.querySelector('.btn-edit, button[onclick*="modifier"], button[onclick*="editer"]');
        if (btnEdit) { e.preventDefault(); btnEdit.click(); }
      }
    });
  }
  function findOpenModal() {
    return document.querySelector('.modal[style*="block"], .modal.open, #s15-modal-info.open');
  }
  function closeModal(m) {
    if (m.id === 's15-modal-info') { m.classList.remove('open'); return; }
    if (typeof window.closeModal === 'function') window.closeModal(m.id);
    else { m.style.display = 'none'; m.classList.remove('open'); }
  }

  /* ----- Cron tick ----- */
  function cronTick() {
    try { autoRappelsJ5(); } catch(e){ console.warn('S24 rappelsJ5', e); }
    try { autoEscaladeRelances(); } catch(e){ console.warn('S24 escalade', e); }
    try { autoClotureFactures(); } catch(e){ console.warn('S24 cloture', e); }
  }
  window.s24CronTick = cronTick;

  /* ----- UI Paramètres : injecter section Automatisations ----- */
  function injectParamsUI() {
    const pageParams = document.getElementById('page-parametres');
    if (!pageParams) return;
    if (pageParams.querySelector('#s24-params-section')) return;
    const container = pageParams.querySelector('.settings-content') || pageParams;
    const section = document.createElement('div');
    section.id = 's24-params-section';
    section.className = 'settings-section';
    section.innerHTML = `
      <h2 style="margin-top:32px">⚙️ Automatisations</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">Règles qui tournent en arrière-plan côté MCA. Les automatisations de facturation / relance / clôture sont gérées par Pennylane.</p>
      <h3 style="margin-top:24px">Décalage férié / weekend</h3>
      <p style="color:var(--text-muted);font-size:.88rem">Les nouvelles échéances créées sont automatiquement repoussées au prochain jour ouvré (hors weekends et jours fériés FR).</p>
      <h3 style="margin-top:24px">⌨️ Raccourcis clavier</h3>
      <div class="s24-keyboard-help">
        <div><kbd>Enter</kbd> dans un champ → valider le modal</div>
        <div><kbd>Esc</kbd> → fermer modal / drawer</div>
        <div><kbd>N</kbd> → Nouveau (contextuel)</div>
        <div><kbd>E</kbd> → Éditer ligne sélectionnée</div>
        <div><kbd>Ctrl</kbd>+<kbd>S</kbd> → Exporter page active</div>
        <div><kbd>Ctrl</kbd>+<kbd>K</kbd> → Palette de recherche</div>
      </div>
    `;
    container.appendChild(section);
    section.querySelectorAll('input[type=checkbox][data-s24-key]').forEach(cb => {
      cb.addEventListener('change', () => {
        window.s24SetOption(cb.dataset.s24Key, cb.checked);
        toast(cb.checked ? '✅ Activé : '+cb.dataset.s24Label : '⏸️ Désactivé : '+cb.dataset.s24Label, 'success');
        if (cb.dataset.s24Key === 'auto_facture_livraison' && cb.checked) hookLivraisonStatut();
      });
    });
  }
  function renderToggle(key, label, desc, def) {
    const val = getOption(key, def);
    return `<label class="s24-toggle">
      <input type="checkbox" data-s24-key="${key}" data-s24-label="${label}" ${val?'checked':''} />
      <span class="s24-toggle-switch"></span>
      <span class="s24-toggle-body"><strong>${label}</strong><br><small>${desc}</small></span>
    </label>`;
  }

  function init() {
    setupKeyboardShortcuts();
    hookLivraisonStatut();
    setTimeout(cronTick, 3500);
    setInterval(cronTick, 5 * 60 * 1000);
    setTimeout(injectParamsUI, 800);
    setInterval(injectParamsUI, 4000); // re-injecte si params re-rendus
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1300);
})();
