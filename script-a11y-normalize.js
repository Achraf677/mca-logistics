/* Phase 91.65 — A11y normalizer boot-time
   Compense les attributs WCAG manquants côté HTML sans toucher au markup (high churn).
   Idempotent : skip si déjà appliqué. */
(function () {
  'use strict';

  function addScopeCol() {
    var ths = document.querySelectorAll('thead th:not([scope])');
    var n = 0;
    ths.forEach(function (th) {
      th.setAttribute('scope', 'col');
      n++;
    });
    return n;
  }

  function run() {
    try {
      var added = addScopeCol();
      if (added > 0) {
        // Trace pour debug, pas de toast (silencieux).
        try { console.debug('[a11y-normalize] scope="col" ajouté sur', added, '<th>'); } catch (_) {}
      }
    } catch (e) {
      try { console.warn('[a11y-normalize]', e); } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Re-run après que script.js ait pu injecter des tables dynamiquement.
  // Léger : interval 2s pendant 30s puis stop (suffit pour cover renderLivraisons,
  // afficherCharges, etc. qui rebuilent le DOM au boot).
  var ticks = 0;
  var iv = setInterval(function () {
    ticks++;
    run();
    if (ticks > 15) clearInterval(iv);
  }, 2000);
})();
