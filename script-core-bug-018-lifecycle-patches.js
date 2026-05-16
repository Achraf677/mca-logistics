/**
 * MCA Logistics — BUG-018/019/031 lifecycle patches (setInterval + MutationObserver cleanup au unload) (Phase X — extraction script.js)
 *
 * Extracted from script.js L47-86 (2026-05-16).
 */

// BUG-018/019/031 fix : registre global + cleanup au unload (timers + observers orphelins).
// Monkey-patch non invasif : les 35 setInterval et les MutationObserver existants sont captés automatiquement.
if (!window.__delivproLifecyclePatched) {
  window.__delivproLifecyclePatched = true;
  window.__delivproIntervals = new Set();
  window.__delivproObservers = new Set();

  const nativeSetInterval = window.setInterval;
  const nativeClearInterval = window.clearInterval;
  window.setInterval = function() {
    const id = nativeSetInterval.apply(this, arguments);
    try { window.__delivproIntervals.add(id); } catch(_) { /* fail-silent: registre lifecycle non bloquant */ }
    return id;
  };
  window.clearInterval = function(id) {
    try { window.__delivproIntervals.delete(id); } catch(_) { /* fail-silent: registre lifecycle non bloquant */ }
    return nativeClearInterval.call(this, id);
  };

  if (typeof window.MutationObserver === 'function') {
    const NativeMO = window.MutationObserver;
    function PatchedMO(cb) {
      const inst = new NativeMO(cb);
      try { window.__delivproObservers.add(inst); } catch(_) { /* fail-silent: registre lifecycle non bloquant */ }
      const nativeDisc = inst.disconnect.bind(inst);
      inst.disconnect = function() {
        try { window.__delivproObservers.delete(inst); } catch(_) { /* fail-silent: registre lifecycle non bloquant */ }
        return nativeDisc();
      };
      return inst;
    }
    PatchedMO.prototype = NativeMO.prototype;
    window.MutationObserver = PatchedMO;
  }

  window.addEventListener('beforeunload', function() {
    try { window.__delivproIntervals.forEach(function(id){ try { nativeClearInterval(id); } catch(_) { /* fail-silent: clearInterval cleanup au unload */ } }); } catch(_) { /* fail-silent: cleanup au unload non bloquant */ }
    try { window.__delivproObservers.forEach(function(o){ try { o.disconnect(); } catch(_) { /* fail-silent: observer cleanup au unload */ } }); } catch(_) { /* fail-silent: cleanup au unload non bloquant */ }
  });
}
