/* ============================================================
   Fetch diagnostic — DelivPro / MCA Logistics
   ------------------------------------------------------------
   Compte tous les fetch vers supabase.co et les classe :
   - par endpoint Supabase (ex: rest/v1/app_state, auth/v1/token)
   - par méthode HTTP
   - par "culprit" (1re ligne JS hors libs/sync dans la stack)

   Usage F12 (console) :
     1. Coller TOUT ce fichier puis Entrée
     2. Attendre 30-60 secondes (utilisation normale du site)
     3. Taper :   __diag.report()
     4. Pour réinitialiser :  __diag.reset()

   Le fichier est volontairement autonome (IIFE) pour pouvoir
   être collé tel quel dans la console sans dépendances.
   ============================================================ */
(() => {
  if (window.__diag && window.__diag.__installed) {
    console.log('🔁 Fetch diag déjà installé. Tape __diag.report() ou __diag.reset()');
    return;
  }

  const state = {
    __installed: true,
    startedAt: Date.now(),
    count: 0,
    byEndpoint: {},
    byMethod: {},
    byCulprit: {},
    samples: []
  };

  const originalFetch = window.fetch.bind(window);

  function endpointOf(url) {
    try {
      const u = new URL(url, window.location.href);
      const segs = u.pathname.split('/').filter(Boolean);
      // garde au plus 3 segments significatifs
      return u.host + '/' + segs.slice(0, 3).join('/');
    } catch (_) {
      return String(url).slice(0, 80);
    }
  }

  function findCulprit(stack) {
    if (!stack) return 'unknown';
    const lines = stack.split('\n').slice(1, 30);
    const ignore = [
      'supabase-storage-sync',
      'supabase-js',
      '@supabase',
      'gotrue',
      'realtime-js',
      'postgrest',
      'node_modules',
      'fetch-diag',
      'native code'
    ];
    const candidate = lines.find((l) => {
      const lower = l.toLowerCase();
      return !ignore.some((s) => lower.includes(s));
    });
    return (candidate || lines[0] || 'unknown').trim().slice(0, 140);
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);

    if (url && url.indexOf('supabase.co') !== -1) {
      const stack = new Error().stack || '';
      const ep = endpointOf(url);
      const method = (init && init.method) || (input && input.method) || 'GET';
      const culprit = findCulprit(stack);

      state.count += 1;
      state.byEndpoint[ep] = (state.byEndpoint[ep] || 0) + 1;
      state.byMethod[method] = (state.byMethod[method] || 0) + 1;
      state.byCulprit[culprit] = (state.byCulprit[culprit] || 0) + 1;

      if (state.samples.length < 10) {
        state.samples.push({
          ts: new Date().toISOString().slice(11, 19),
          method,
          endpoint: ep,
          urlTail: url.slice(-80),
          stack: stack.split('\n').slice(1, 6).join('\n')
        });
      }
    }

    return originalFetch(input, init);
  };

  function sortDesc(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }

  state.report = function () {
    const elapsedSec = Math.max(1, (Date.now() - state.startedAt) / 1000);
    const ratePerMin = (state.count / elapsedSec) * 60;
    console.log('======== FETCH DIAG ========');
    console.log('Durée mesure : ' + elapsedSec.toFixed(1) + ' s');
    console.log('Total fetch supabase.co : ' + state.count + '  (~' + ratePerMin.toFixed(1) + ' / min)');
    console.log('--- Par endpoint ---');
    console.table(sortDesc(state.byEndpoint).map(([k, v]) => ({ endpoint: k, count: v })));
    console.log('--- Par méthode ---');
    console.table(sortDesc(state.byMethod).map(([k, v]) => ({ method: k, count: v })));
    console.log('--- Top "culprits" (1re ligne JS hors libs) ---');
    console.table(sortDesc(state.byCulprit).slice(0, 15).map(([k, v]) => ({ count: v, culprit: k })));
    console.log('--- Samples (5 premiers) ---');
    state.samples.slice(0, 5).forEach((s, i) => {
      console.log('#' + (i + 1) + ' [' + s.ts + '] ' + s.method + ' ' + s.endpoint + ' ' + s.urlTail);
      console.log(s.stack);
    });
    return {
      elapsedSec,
      ratePerMin,
      count: state.count,
      byEndpoint: state.byEndpoint,
      byMethod: state.byMethod,
      byCulprit: state.byCulprit
    };
  };

  state.reset = function () {
    state.startedAt = Date.now();
    state.count = 0;
    state.byEndpoint = {};
    state.byMethod = {};
    state.byCulprit = {};
    state.samples = [];
    console.log('♻️ Diag réinitialisé');
  };

  window.__diag = state;
  console.log('🎯 Fetch diag installé. Attends 30-60s puis tape __diag.report()');
})();
