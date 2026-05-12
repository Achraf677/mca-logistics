/* Phase 44 refonte HTML — Entretiens type chips toolbar wiring
   M9 update: aligned with mockup 4-tab layout (Tous / CT en cours / Révisions / Réparations)
   Uses window._entrChipActive for multi-type filters that can't be mapped to a single select value. */
(function () {
  'use strict';

  // Types grouped under "Réparations"
  var REPARATION_TYPES = ['vidange', 'pneus', 'plaquettes', 'courroie', 'freins', 'carrosserie', 'autre'];

  // Maps chip data-entr-type → filtre-entr-type select value ('' = no-op, keep select clear)
  var CHIP_MAP = {
    '': '',
    'ct_en_cours': '',      // handled via window._entrChipActive (CT from vehicules, not entretiens)
    'revision': 'revision',
    'reparation': ''        // multi-type, handled via window._entrChipActive
  };

  function entrChipType(btn, type) {
    window._entrChipActive = type;
    var sel = document.getElementById('filtre-entr-type');
    if (sel) sel.value = CHIP_MAP[type] !== undefined ? CHIP_MAP[type] : type;
    entrSyncChips(type);
    if (typeof afficherEntretiens === 'function') afficherEntretiens();
  }

  function entrSyncChips(activeType) {
    document.querySelectorAll('#entr-chips-type .ds-chip').forEach(function (c) {
      var t = c.getAttribute('data-entr-type') || '';
      c.classList.toggle('active', t === (activeType || ''));
    });
  }

  window.entrChipType = entrChipType;
  window.entrSyncChips = entrSyncChips;
  window._ENTR_REPARATION_TYPES = REPARATION_TYPES;
})();
