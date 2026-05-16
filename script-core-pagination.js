/**
 * MCA Logistics — Pagination tables (nettoyer + paginer) (Phase X — extraction script.js)
 *
 * Extracted from script.js L2298-2340 (2026-05-16).
 */

// _pageState exposé window pour permettre les onclick="_pageState[...].page++" générés inline
const _pageState = (typeof window !== 'undefined' && window._pageState) || {};
if (typeof window !== 'undefined') window._pageState = _pageState;
function nettoyerPagination(containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  const wrap = cont.closest('.card') || cont.parentElement;
  const pag = wrap?.querySelector('.pagination');
  if (pag) pag.remove();
  if (_pageState[containerId]) _pageState[containerId].page = 1;
}
function paginer(items, containerId, renderFn, pageSize=20) {
  const state = _pageState[containerId] || { page: 1 };
  _pageState[containerId] = state;
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  state.page = Math.min(state.page, pages);
  const slice = items.slice((state.page-1)*pageSize, state.page*pageSize);

  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = renderFn(slice);

  // Pagination bar
  const wrap = cont.closest('.card') || cont.parentElement;
  let pag = wrap.querySelector('.pagination');
  if (total <= pageSize) { if (pag) pag.remove(); return; }
  if (!pag) { pag = document.createElement('div'); pag.className='pagination'; wrap.appendChild(pag); }

  const btns = [];
  for (let p=1; p<=pages; p++) {
    if (p===1||p===pages||Math.abs(p-state.page)<=1) {
      btns.push(`<button class="btn-page${p===state.page?' active':''}" onclick="_pageState['${containerId}'].page=${p};paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">${p}</button>`);
    } else if (Math.abs(p-state.page)===2) {
      btns.push(`<span style="padding:0 4px;color:var(--text-muted)">…</span>`);
    }
  }
  pag.innerHTML = `
    <span>${(state.page-1)*pageSize+1}–${Math.min(state.page*pageSize,total)} sur ${total}</span>
    <div class="pagination-btns">
      <button class="btn-page" ${state.page<=1?'disabled':''} onclick="_pageState['${containerId}'].page--;paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">‹</button>
      ${btns.join('')}
      <button class="btn-page" ${state.page>=pages?'disabled':''} onclick="_pageState['${containerId}'].page++;paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">›</button>
    </div>`;
}

if (typeof window !== 'undefined') {
  window.nettoyerPagination = nettoyerPagination;
  window.paginer = paginer;
}
