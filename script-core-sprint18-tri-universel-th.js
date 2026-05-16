/**
 * MCA Logistics — Sprint 18 — Tri universel par clic sur <th> (auto-détection type + MutationObserver) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4914-5072 (2026-05-16).
 */

/* ============================================================
   SPRINT 18 — Tri universel par clic sur les <th>
   - Remplace tous les dropdowns "Trier par ..."
   - Détecte auto nombre/€/date/texte
   - Persiste le tri en mémoire par table
   - Re-applique le tri après chaque re-render (MutationObserver)
   ============================================================ */
(function installS18SortableHeaders(){
  if (window.__s18SortInstalled) return;
  window.__s18SortInstalled = true;

  const state = new Map();
  const EXCLUDE_LABELS = new Set(['actions','action','', 'menu', '…']);

  function cellText(tr, idx) {
    const td = tr.children[idx];
    if (!td) return '';
    return (td.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function parseDateMaybe(s) {
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    return null;
  }

  function parseNumMaybe(s) {
    if (!s) return null;
    const cleaned = s.replace(/[€$£%\s\u202f\u00a0]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return parseFloat(cleaned);
  }

  function compareValues(a, b) {
    const da = parseDateMaybe(a), db = parseDateMaybe(b);
    if (da !== null && db !== null) return da - db;
    const na = parseNumMaybe(a), nb = parseNumMaybe(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });
  }

  function sortTable(table, colIdx, dir) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const allRows = Array.from(tbody.children);
    const dataRows = allRows.filter(tr => tr.tagName === 'TR' && !tr.querySelector('.empty-row') && !tr.classList.contains('pagination-row'));
    if (dataRows.length < 2) return;
    const paginationRows = allRows.filter(tr => tr.tagName === 'TR' && tr.classList.contains('pagination-row'));
    const factor = (dir === 'desc') ? -1 : 1;
    dataRows.sort(function(a, b){
      return compareValues(cellText(a, colIdx), cellText(b, colIdx)) * factor;
    });
    tbody.__s18Sorting = true;
    dataRows.forEach(r => tbody.appendChild(r));
    paginationRows.forEach(r => tbody.appendChild(r));
    tbody.__s18Sorting = false;
  }

  function updateIndicators(table, colIdx, dir) {
    const ths = table.querySelectorAll('thead th');
    ths.forEach(t => t.classList.remove('sort-asc','sort-desc'));
    if (colIdx != null && dir) {
      const th = ths[colIdx];
      if (th) th.classList.add('sort-' + dir);
    }
  }

  function onThClick(table, ths, idx) {
    const cur = state.get(table) || {};
    let dir;
    if (cur.colIdx !== idx) dir = 'asc';
    else if (cur.dir === 'asc') dir = 'desc';
    else if (cur.dir === 'desc') dir = null;
    else dir = 'asc';

    if (dir == null) {
      state.delete(table);
      updateIndicators(table, null, null);
    } else {
      state.set(table, { colIdx: idx, dir: dir });
      updateIndicators(table, idx, dir);
      sortTable(table, idx, dir);
    }
  }

  function makeSortable(table) {
    if (table.__s18Sortable) return;
    const ths = table.querySelectorAll('thead th');
    if (!ths.length) return;
    // Skip les tables qui utilisent déjà le module SORT Sprint 8 (data-sort-key) :
    // le tri data-based + re-render se chevaucherait avec le tri DOM-based ici,
    // créant une cascade MutationObserver ↔ re-render qui freeze la page.
    if (table.querySelector('thead th[data-sort-key]')) {
      table.__s18Sortable = true;
      return;
    }
    table.__s18Sortable = true;
    ths.forEach(function(th, idx){
      const label = (th.textContent || '').trim().toLowerCase();
      if (EXCLUDE_LABELS.has(label)) return;
      th.classList.add('th-sortable');
      th.setAttribute('title', 'Trier par ' + (th.textContent || '').trim());
      th.addEventListener('click', function(){ onThClick(table, ths, idx); });
    });
  }

  const reapplyObs = new MutationObserver(function(muts){
    const touchedTables = new Set();
    muts.forEach(function(m){
      if (m.type !== 'childList') return;
      const target = m.target;
      if (!target || target.__s18Sorting) return;
      const table = (target.closest && target.closest('table.data-table')) || null;
      if (table) touchedTables.add(table);
    });
    touchedTables.forEach(function(table){
      const cur = state.get(table);
      if (cur) {
        updateIndicators(table, cur.colIdx, cur.dir);
        sortTable(table, cur.colIdx, cur.dir);
      }
    });
  });

  function scan() {
    document.querySelectorAll('table.data-table').forEach(function(table){
      makeSortable(table);
      const tbody = table.querySelector('tbody');
      if (tbody && !tbody.__s18Observed) {
        tbody.__s18Observed = true;
        reapplyObs.observe(tbody, { childList: true });
      }
    });
  }

  function init() {
    scan();
    // PERF: remplacement du setInterval(scan, 2500) par MutationObserver
    // event-driven — ne scanne que lorsqu'un node est ajouté au DOM
    const domWatcher = new MutationObserver(function(muts) {
      for (let i = 0; i < muts.length; i++) {
        const added = muts[i].addedNodes;
        if (!added || !added.length) continue;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (node && node.nodeType === 1 && (node.matches && node.matches('table.data-table') || node.querySelector && node.querySelector('table.data-table'))) {
            scan();
            return;
          }
        }
      }
    });
    domWatcher.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 250);
})();
