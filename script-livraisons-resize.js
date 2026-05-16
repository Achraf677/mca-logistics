/* Phase 91.14 — Excel-like column resize sur .livraisons-table.
   Ajoute un handle 6px sur le bord droit de chaque <th>. Drag = set width inline.
   Persistance dans localStorage (livraisons_col_widths_v1).
*/
(function () {
  'use strict';

  var STORAGE_KEY = 'livraisons_col_widths_v1';

  function loadWidths() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function saveWidths(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (_) {}
  }

  function thKey(th) {
    return th.dataset.sortKey
      || th.dataset.injected
      || (th.classList.contains('bulk-col') ? 'bulk' : null)
      || th.textContent.trim().toLowerCase();
  }

  function applyStoredWidths(table) {
    var widths = loadWidths();
    var ths = table.querySelectorAll('thead th');
    ths.forEach(function (th) {
      var key = thKey(th);
      if (key && widths[key]) th.style.width = widths[key] + 'px';
    });
  }

  function attachHandles(table) {
    var ths = table.querySelectorAll('thead th');
    ths.forEach(function (th) {
      if (th.querySelector('.col-resize-handle')) return;
      var handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.title = 'Glisser pour redimensionner la colonne';
      th.appendChild(handle);

      handle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        handle.classList.add('is-resizing');
        var startX = e.clientX;
        var startWidth = th.offsetWidth;

        function onMove(ev) {
          var dx = ev.clientX - startX;
          var newWidth = Math.max(48, startWidth + dx);
          th.style.width = newWidth + 'px';
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          handle.classList.remove('is-resizing');
          var key = thKey(th);
          if (key) {
            var widths = loadWidths();
            widths[key] = parseInt(th.style.width, 10);
            saveWidths(widths);
          }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      handle.addEventListener('click', function (e) { e.stopPropagation(); });
    });
  }

  function init() {
    var tables = document.querySelectorAll('.livraisons-table');
    tables.forEach(function (table) {
      attachHandles(table);
      applyStoredWidths(table);
    });

    if (typeof MutationObserver !== 'undefined') {
      tables.forEach(function (table) {
        var thead = table.querySelector('thead');
        if (!thead) return;
        new MutationObserver(function () {
          attachHandles(table);
          applyStoredWidths(table);
        }).observe(thead, { childList: true, subtree: true });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
