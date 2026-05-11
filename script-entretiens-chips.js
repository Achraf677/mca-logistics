/* Phase 44 refonte HTML — Entretiens type chips toolbar wiring */
(function () {
  'use strict';

  // Maps chip data-entr-type → matches filtre-entr-type select values
  // "freins" chip also covers "pneus" and "plaquettes"
  var CHIP_MAP = {
    '': '',
    'revision': 'revision',
    'vidange': 'vidange',
    'freins': 'freins',
    'carrosserie': 'carrosserie'
  };

  function entrChipType(btn, type) {
    var sel = document.getElementById('filtre-entr-type');
    if (!sel) return;
    // "freins" chip covers freins/pneus/plaquettes — set select to freins
    sel.value = CHIP_MAP[type] !== undefined ? CHIP_MAP[type] : type;
    entrSyncChips(type);
    if (typeof afficherEntretiens === 'function') afficherEntretiens();
  }

  function entrSyncChips(activeType) {
    var chips = document.querySelectorAll('#entr-chips-type .ds-chip');
    chips.forEach(function (c) {
      var t = c.getAttribute('data-entr-type') || '';
      c.classList.toggle('active', t === activeType || (activeType === 'freins' && t === 'freins') || (activeType === 'pneus' && t === 'freins') || (activeType === 'plaquettes' && t === 'freins') || (t === '' && !activeType));
    });
  }

  window.entrChipType = entrChipType;
  window.entrSyncChips = entrSyncChips;
})();
