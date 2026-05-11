/* ==========================================================================
   MCA Logistics — Period chips wiring (Phase 12)

   Connecte les .period-chips (HTML mockup) aux <select> existants de chaque
   page (id="liv-periode-mode", "vue-planning-select", etc.) via l'attribut
   data-period-target sur le container .period-chips.

   HTML pattern :
     <div class="period-chips" data-period-target="liv-periode-mode">
       <button class="chip-period" data-period="jour">Jour</button>
       <button class="chip-period active" data-period="mois">Mois</button>
       ...
     </div>

   Aucun changement script.js requis : on dispatche le change event sur le
   <select> existant.
   ========================================================================== */

(function () {
  'use strict';

  function setActive(container, periode) {
    container.querySelectorAll('.chip-period').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-period') === periode);
    });
  }

  function syncFromSelect(container) {
    var targetId = container.getAttribute('data-period-target');
    if (!targetId) return;
    var sel = document.getElementById(targetId);
    if (!sel) return;
    setActive(container, sel.value || 'mois');
  }

  function handleClick(e) {
    var btn = e.target.closest && e.target.closest('.chip-period');
    if (!btn) return;
    var container = btn.parentElement;
    if (!container || !container.classList.contains('period-chips')) return;
    var periode = btn.getAttribute('data-period');
    if (!periode) return;
    e.preventDefault();
    var targetId = container.getAttribute('data-period-target');
    var sel = targetId ? document.getElementById(targetId) : null;
    if (sel) {
      sel.value = periode;
      try {
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {
        // Fallback IE-safe
        var ev = document.createEvent('HTMLEvents');
        ev.initEvent('change', true, false);
        sel.dispatchEvent(ev);
      }
    }
    setActive(container, periode);
  }

  function setupView(container) {
    // Vue toggle (Tableau/Kanban/Calendrier) — sync visual active state
    container.querySelectorAll('.btn-view').forEach(function (btn) {
      btn.addEventListener('click', function () {
        container.querySelectorAll('.btn-view').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });
  }

  function init() {
    // Bind click handler globally (event delegation)
    document.addEventListener('click', handleClick, true);

    // Sync each .period-chips to its target select on init
    document.querySelectorAll('.period-chips').forEach(syncFromSelect);

    // Sync each view-toggle in period-row
    document.querySelectorAll('.period-row .view-toggle').forEach(setupView);

    // Re-sync periodic (in case selects are modified by script.js without firing change)
    setInterval(function () {
      document.querySelectorAll('.period-chips').forEach(syncFromSelect);
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
