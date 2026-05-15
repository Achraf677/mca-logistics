// Diagnostic storage MCA Logistics
// À coller dans la console F12 sur admin.html pour comprendre d'où vient la data.
//
// Affiche : origin, keys localStorage, sessionStorage, IndexedDB, cookies,
//           Supabase auth status, adapter mode (local-only ou pas).
(async () => {
  console.group('🔍 DIAG STORAGE MCA LOGISTICS');

  console.log('Origin:', window.location.origin);
  console.log('Protocol:', window.location.protocol);
  console.log('Hostname:', window.location.hostname);

  // localStorage
  console.group('📦 localStorage (' + Object.keys(localStorage).length + ' keys)');
  Object.keys(localStorage).forEach(k => {
    const v = localStorage.getItem(k);
    const size = v ? v.length : 0;
    const preview = v && v.length > 80 ? v.slice(0, 80) + '...' : v;
    console.log(k, '·', size + 'b', '·', preview);
  });
  console.groupEnd();

  // sessionStorage
  console.group('💾 sessionStorage (' + Object.keys(sessionStorage).length + ' keys)');
  Object.keys(sessionStorage).forEach(k => console.log(k, '=', sessionStorage.getItem(k)));
  console.groupEnd();

  // IndexedDB
  try {
    const dbs = await indexedDB.databases();
    console.group('🗄️ IndexedDB (' + dbs.length + ' bases)');
    dbs.forEach(db => console.log(db.name, 'v' + db.version));
    console.groupEnd();
  } catch (e) { console.warn('IndexedDB list error:', e); }

  // Service Worker caches
  try {
    const cacheKeys = await caches.keys();
    console.group('⚡ SW caches (' + cacheKeys.length + ')');
    for (const k of cacheKeys) {
      const c = await caches.open(k);
      const reqs = await c.keys();
      console.log(k, '·', reqs.length, 'requests');
    }
    console.groupEnd();
  } catch (e) { console.warn('SW caches error:', e); }

  // Service Workers registered
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    console.group('🔧 SW registrations (' + regs.length + ')');
    regs.forEach(r => console.log('scope:', r.scope, '· active:', !!r.active));
    console.groupEnd();
  } catch (e) { console.warn('SW reg error:', e); }

  // Cookies
  console.group('🍪 Cookies');
  if (document.cookie) {
    document.cookie.split(';').forEach(c => console.log(c.trim()));
  } else {
    console.log('(aucun)');
  }
  console.groupEnd();

  // Supabase auth status
  console.group('🔐 Supabase auth');
  const client = window.DelivProSupabase?.getClient?.();
  if (client) {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) console.warn('error:', error);
      else if (data?.session) {
        console.log('✓ Session ACTIVE');
        console.log('  user:', data.session.user?.email);
        console.log('  expires:', new Date(data.session.expires_at * 1000).toISOString());
      } else {
        console.log('✗ Pas de session');
      }
    } catch (e) { console.warn(e); }
  } else {
    console.log('Client Supabase non initialisé');
  }
  console.groupEnd();

  // Mode local-only ?
  console.group('⚙️ Adapter mode');
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const login = sessionStorage.getItem('admin_login') || '';
  const mode = sessionStorage.getItem('auth_mode') || '';
  console.log('isLocalhost:', isLocalhost);
  console.log('admin_login:', login);
  console.log('auth_mode:', mode);
  console.log('MCA_DISABLE_SUPABASE_SYNC:', window.MCA_DISABLE_SUPABASE_SYNC);
  console.log('disable_supabase_sync (sessionStorage):', sessionStorage.getItem('disable_supabase_sync'));
  const localOnly = isLocalhost || mode === 'local' || mode === 'dev' ||
                    login === 'dev-admin' || login.startsWith('dev-') ||
                    window.MCA_DISABLE_SUPABASE_SYNC === true;
  console.log('▶️ isLocalOnlyMode (computed):', localOnly);
  console.log('  → Adapters Supabase sont', localOnly ? 'DÉSACTIVÉS' : 'ACTIFS');
  console.groupEnd();

  console.groupEnd();
  console.log('\n💡 Pour clear total :');
  console.log('  await window.MCA_NUKE_STORAGE?.()');
})();

// Helper nuke
window.MCA_NUKE_STORAGE = async () => {
  localStorage.clear();
  sessionStorage.clear();
  const dbs = await indexedDB.databases();
  for (const db of dbs) indexedDB.deleteDatabase(db.name);
  const keys = await caches.keys();
  for (const k of keys) await caches.delete(k);
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  document.cookie.split(';').forEach(c => {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
  });
  // Sign out Supabase
  try { await window.DelivProSupabase?.getClient?.()?.auth?.signOut(); } catch {}
  console.log('☢️ NUKE COMPLETE. Reload...');
  setTimeout(() => location.replace(location.pathname), 1500);
};
