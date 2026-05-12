/**
 * MCA Logistics — Module Cache Clear (MOBILE UNIQUEMENT)
 *
 * Helper pour vider tous les caches de l'application :
 *   - Service Worker caches (caches.delete sur toutes les keys)
 *   - localStorage (sauf cles critiques : auth, theme, setup_done)
 *   - Service Worker registrations (unregister)
 *   - reload(true) apres 500ms
 *
 * Expose :
 *   - window.viderCacheApp(opts) — purge complete + reload
 *   - window.confirmerEtViderCacheApp() — affiche modale de confirmation puis appelle viderCacheApp
 *
 * Achraf : explicitement MOBILE UNIQUEMENT (cite plusieurs fois). Ne pas
 * cabler sur PC/admin.html. Bouton uniquement dans m.html route 'parametres'.
 */
(function () {
  'use strict';

  // Cles localStorage a preserver imperativement (sinon perte session ou flag onboarding)
  const KEYS_PRESERVED = [
    'theme',
    'mca_setup_done',
    // Supabase Auth stocke le token sous des cles dynamiques sb-<projectref>-auth-token
    // -> matching par prefixe dans la fonction de purge.
  ];

  // Prefixes de cles localStorage a preserver (Supabase auth cles dynamiques)
  const KEY_PREFIXES_PRESERVED = [
    'sb-', // sb-<projectref>-auth-token (Supabase v2 SDK)
    'supabase.auth.', // legacy v1 fallback
  ];

  function shouldPreserveKey(k) {
    if (!k) return false;
    if (KEYS_PRESERVED.indexOf(k) !== -1) return true;
    for (let i = 0; i < KEY_PREFIXES_PRESERVED.length; i++) {
      if (k.indexOf(KEY_PREFIXES_PRESERVED[i]) === 0) return true;
    }
    return false;
  }

  // UI : loader plein ecran avec message
  function showFullScreenLoader(msg) {
    let host = document.getElementById('mca-cache-clear-loader');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mca-cache-clear-loader';
      host.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99999',
        'background:rgba(0,0,0,0.85)', 'color:#fff',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'gap:16px', 'font-family:system-ui,-apple-system,sans-serif',
        'font-size:1rem', 'text-align:center', 'padding:20px'
      ].join(';');
      host.innerHTML = '' +
        '<div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);' +
        'border-top-color:#fff;border-radius:50%;' +
        'animation:mca-spin 0.8s linear infinite"></div>' +
        '<div id="mca-cache-clear-msg" style="font-weight:500"></div>' +
        '<style>@keyframes mca-spin{to{transform:rotate(360deg)}}</style>';
      document.body.appendChild(host);
    }
    const msgEl = host.querySelector('#mca-cache-clear-msg');
    if (msgEl) msgEl.textContent = msg || 'Vidage en cours…';
  }

  function hideFullScreenLoader() {
    const host = document.getElementById('mca-cache-clear-loader');
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }

  // Etape 1 : purge des caches SW
  async function purgeCaches() {
    if (!('caches' in window)) return { ok: true, count: 0 };
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => null)));
      return { ok: true, count: keys.length };
    } catch (e) {
      console.warn('[cache-clear] purgeCaches', e);
      return { ok: false, error: String(e) };
    }
  }

  // Etape 2 : purge localStorage en preservant les cles critiques
  function purgeLocalStorage() {
    try {
      const preserved = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (shouldPreserveKey(k)) preserved[k] = localStorage.getItem(k);
      }
      const totalBefore = localStorage.length;
      localStorage.clear();
      Object.keys(preserved).forEach(k => {
        try { localStorage.setItem(k, preserved[k]); } catch (_) {}
      });
      return { ok: true, removed: totalBefore - Object.keys(preserved).length, preserved: Object.keys(preserved).length };
    } catch (e) {
      console.warn('[cache-clear] purgeLocalStorage', e);
      return { ok: false, error: String(e) };
    }
  }

  // Etape 3 : unregister SW
  async function unregisterServiceWorkers() {
    if (!('serviceWorker' in navigator)) return { ok: true, count: 0 };
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => false)));
      return { ok: true, count: regs.length };
    } catch (e) {
      console.warn('[cache-clear] unregisterSW', e);
      return { ok: false, error: String(e) };
    }
  }

  // Pipeline complet
  async function viderCacheApp(opts) {
    opts = opts || {};
    const skipReload = !!opts.skipReload;
    showFullScreenLoader('Vidage en cours…');
    const r1 = await purgeCaches();
    const r2 = purgeLocalStorage();
    const r3 = await unregisterServiceWorkers();
    showFullScreenLoader('Rechargement…');
    const summary = { caches: r1, localStorage: r2, serviceWorker: r3 };
    if (skipReload) {
      hideFullScreenLoader();
      return summary;
    }
    setTimeout(() => {
      try { window.location.reload(); } catch (_) { window.location.href = window.location.href; }
    }, 500);
    return summary;
  }

  // Modale de confirmation (utilise M.confirm si dispo, sinon window.confirm fallback)
  async function confirmerEtViderCacheApp() {
    const message = "Cela va recharger l'app et perdre les données non synchronisées. Continuer ?";
    let ok = false;
    if (window.M && typeof window.M.confirm === 'function') {
      try { ok = await window.M.confirm(message, { titre: '🔄 Vider le cache' }); }
      catch (_) { ok = false; }
    } else if (typeof window.confirm === 'function') {
      ok = window.confirm(message);
    }
    if (!ok) return { cancelled: true };
    return viderCacheApp();
  }

  // Expose
  window.viderCacheApp = viderCacheApp;
  window.confirmerEtViderCacheApp = confirmerEtViderCacheApp;

  // Export Node (tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      shouldPreserveKey: shouldPreserveKey,
      KEYS_PRESERVED: KEYS_PRESERVED,
      KEY_PREFIXES_PRESERVED: KEY_PREFIXES_PRESERVED,
    };
  }
})();
