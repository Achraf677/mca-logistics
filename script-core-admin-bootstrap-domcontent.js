/**
 * MCA Logistics — Admin bootstrap DOMContentLoaded (consommer ticket + restoration session + listeners online/offline) (Phase X — extraction script.js)
 *
 * Extracted from script.js L539-755 (2026-05-16).
 */

/* ===== NAVIGATION ===== */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.__delivproAdminBootstrapped) return;
  window.__delivproAdminBootstrapped = true;
  if (!consommerTicketAccesOnglet()) {
    // Tenter restauration session Supabase avant de rediriger
    // (utile pour les nouveaux appareils avec session admin valide)
    let supabaseSessionValide = false;
    if (window.DelivProAuth) {
      try {
        const restored = window.DelivProAuth.restoreLegacySessionFromSupabase
          ? await window.DelivProAuth.restoreLegacySessionFromSupabase('admin')
          : await window.DelivProAuth.ensureAdminLegacySessionFromSupabase();
        if (restored === 'admin' || restored === true) {
          supabaseSessionValide = true;
          window.__delivproTabUnlocked = true;
          sessionStorage.setItem('auth_mode', 'supabase');
        }
      } catch(_) { /* fail-silent: refreshSession optionnel — fallback redirection login si non récupérée */ }
    }
    if (!supabaseSessionValide) {
      nettoyerSessionAppCourante();
      redirigerVersLoginAdmin();
      return;
    }
  }
  window.addEventListener('delivpro:remote-update', function(event) {
    notifierMajAutreAdmin(event.detail || {});
  });
  // Migration silencieuse au boot : unifie schemas LDV / assurance vehicule
  // / charges-FK pour rendre la donnee mobile visible cote PC (R3 / R4 / R7).
  // Idempotent (flags _ldv_migrated_v1, _assurance_migrated_v1, _fk_migrated_v1).
  try {
    if (typeof migrerSchemasDataPC === 'function') migrerSchemasDataPC();
  } catch (e) { console.warn('[boot] migrerSchemasDataPC', e); }
  window.addEventListener('offline', function() {
    afficherToast('⚠️ Connexion perdue — les données sont sauvegardées localement et seront synchronisées dès le retour réseau.', 'error');
  });
  window.addEventListener('online', function() {
    afficherToast('✅ Connexion rétablie — synchronisation en cours…', 'success');
    if (window.DelivProRemoteStorage && window.DelivProRemoteStorage.flush) {
      window.DelivProRemoteStorage.flush().catch(function(e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:online-flush]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      });
    }
  });
  // BUG-005 PWA : prompt d'installation via beforeinstallprompt
  if (!window.__delivproPwaInstallSetup) {
    window.__delivproPwaInstallSetup = true;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      window.__delivproDeferredPrompt = e;
      try {
        const btn = document.getElementById('btn-install-pwa');
        if (btn) btn.style.display = 'inline-flex';
      } catch(_) { /* fail-silent: bouton install absent (DOM partiel) */ }
    });
    window.addEventListener('appinstalled', function() {
      window.__delivproDeferredPrompt = null;
      try {
        const btn = document.getElementById('btn-install-pwa');
        if (btn) btn.style.display = 'none';
      } catch(_) { /* fail-silent: bouton install déjà retiré */ }
      if (typeof afficherToast === 'function') afficherToast('MCA Logistics installé sur votre appareil', 'success');
      if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('PWA', 'Application installée en mode standalone');
    });
    window.declencherInstallPWA = function() {
      const prompt = window.__delivproDeferredPrompt;
      if (!prompt) {
        if (typeof afficherToast === 'function') afficherToast('Installation déjà effectuée ou non disponible sur ce navigateur.', 'info');
        return;
      }
      prompt.prompt();
      prompt.userChoice.then(function(choice) {
        window.__delivproDeferredPrompt = null;
        if (choice && choice.outcome === 'accepted' && typeof afficherToast === 'function') {
          afficherToast('Installation en cours…', 'success');
        }
      });
    };
  }
  const fastBootRole = sessionStorage.getItem(FAST_BOOT_ROLE_KEY);
  if (fastBootRole === 'admin' || fastBootRole === 'salarie') {
    sessionStorage.removeItem(FAST_BOOT_ROLE_KEY);
  } else if (window.DelivProAuth) {
    await (window.DelivProAuth.restoreLegacySessionFromSupabase
      ? window.DelivProAuth.restoreLegacySessionFromSupabase()
      : window.DelivProAuth.ensureAdminLegacySessionFromSupabase());
  }
  const roleCourant = getRoleSessionCourant();
  if (roleCourant !== 'admin' && roleCourant !== 'salarie') {
    redirigerVersLoginAdmin();
    return;
  }
  if (roleCourant === 'salarie') {
    activerModeSalarieUnifie();
    return;
  }
  getAdminAccounts();
  nettoyerHistoriqueModifsLivraisons();
  // Phase 91.81 : currentDate refresh à minuit (sinon date stale si user laisse l'app ouverte > 24h)
  function _majCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  _majCurrentDate();
  (function _scheduleMidnightTick() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5, 0); // +5s buffer
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    setTimeout(function () {
      _majCurrentDate();
      // Re-arme pour le minuit suivant (récursif via setTimeout évite drift cumulatif setInterval)
      _scheduleMidnightTick();
    }, msUntilMidnight);
  })();
  document.querySelectorAll('input[type="date"]').forEach(el => { el.value = aujourdhui(); });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); naviguerVers(item.dataset.page); fermerMenuMobile(); });
    item.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); naviguerVers(item.dataset.page); fermerMenuMobile(); } });
  });
  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
  });
  document.getElementById('menuMobile')?.addEventListener('click', function() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('mobile-open');
    // Overlay pour fermer en cliquant dehors
    let overlay = document.getElementById('sidebar-mobile-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-mobile-overlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;';
      overlay.onclick = function() {
        sidebar.classList.remove('mobile-open');
        overlay.style.display = 'none';
      };
      document.body.appendChild(overlay);
    }
    overlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#topbar-user-menu')) fermerMenuAdmin();
    if (!e.target.closest('#heures-rapports-menu')) fermerHeuresRapportsMenu();
    if (!e.target.closest('.inline-dropdown')) fermerInlineDropdowns();
  });
  afficherBadgeAlertes();
  initTheme();
  initScrollTop();
  chargerNomEntreprise();
  appliquerBranding();
  appliquerLibellesAnalyseHT();
  initSwipeSidebar();
  initPullToRefresh();
  initDensiteTableau();
  verifierNotificationsAutomatiquesMois2();
  mettreAJourBadgesNav();
  verifierTriggersPlanningAuto(); // Vérifier au démarrage
  // Bug #5 audit Chrome : honorer les deeplinks ?page=X et #X au boot.
  // Permet d'ouvrir directement une page via URL (lien partage, bookmark, IA).
  var deeplinkPage = (function () {
    try {
      var qs = new URLSearchParams(window.location.search).get('page');
      if (qs) return String(qs).toLowerCase();
      var hash = (window.location.hash || '').replace(/^#/, '').trim();
      if (hash) return String(hash).toLowerCase();
    } catch (_) {}
    return '';
  })();
  // Liste blanche des routes valides (cf. titres dans script-core-navigation.js).
  var DEEPLINK_ROUTES = [
    'dashboard','livraisons','calendrier','planning','alertes',
    'clients','fournisseurs','vehicules','carburant','entretiens','inspections',
    'charges','encaissement','tva','rentabilite','statistiques',
    'salaries','heures','equipe','incidents',
    'parametres','espace-salarie'
  ];
  if (deeplinkPage && DEEPLINK_ROUTES.indexOf(deeplinkPage) >= 0) {
    naviguerVers(deeplinkPage);
  } else {
    naviguerVers('dashboard');
  }
  majBadgeAgent();
  afficherDecisionsAgent();
  // PERF anti-FOUC : exécute S22 (hubs sidebar) et S26 (timeline dashboard)
  // synchrone avant de révéler le body, pour éviter le flash
  // "anciens onglets → nouveaux onglets" et l'apparition retardée de la timeline.
  try { if (typeof window.__s22InitSidebar === 'function') window.__s22InitSidebar(); } catch (e) {
    if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
      console.warn('[script:s22InitSidebar]', e);
    }
    if (window.Sentry && window.Sentry.captureException) {
      try { window.Sentry.captureException(e); } catch (_) {}
    }
  }
  try { if (typeof window.__s26InitDashboard === 'function') window.__s26InitDashboard(); } catch (e) {
    if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
      console.warn('[script:s26InitDashboard]', e);
    }
    if (window.Sentry && window.Sentry.captureException) {
      try { window.Sentry.captureException(e); } catch (_) {}
    }
  }
  requestAnimationFrame(() => {
    document.body.classList.remove('app-booting');
  });
  setTimeout(() => {
    lancerWarmupAdmin();
  }, 0);
});
