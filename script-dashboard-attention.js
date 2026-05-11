// MCA LOGISTICS — Dashboard "Points d'attention" preview
//
// Remplit la carte #dashboard-points-attention avec les 3 alertes les plus
// urgentes (non lues, non traitées, non ignorées, non reportées).
// Hook léger : se rafraîchit à l'ouverture du dashboard via MutationObserver
// sur #page-dashboard.active, et au refresh des alertes via event custom.

(function () {
  'use strict';

  const SVG_DOT = (color) =>
    `<span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>`;

  const NIVEAU_COLOR = {
    critical: '#ef4444',
    haute:    '#ef4444',
    warn:     '#e67e22',
    moyenne:  '#e67e22',
    info:     '#3498db',
    basse:    '#06d6a0',
  };

  const niveauOrder = (n) =>
    n === 'critical' || n === 'haute' ? 0 : n === 'warn' || n === 'moyenne' ? 1 : 2;

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function getAlertesActives() {
    if (typeof window.charger !== 'function') return [];
    const all = window.charger('alertes_admin') || [];
    return all.filter(a => !a.lu && !a.traitee && !a.ignoree);
  }

  function renderPreview() {
    const card = document.getElementById('dashboard-points-attention');
    if (!card) return;
    const list = document.getElementById('dashboard-attention-list');
    const counter = document.getElementById('dashboard-attention-count');
    if (!list || !counter) return;

    const actives = getAlertesActives();
    if (!actives.length) {
      card.style.display = 'none';
      return;
    }

    // Sort by niveau : critical → warn → info
    actives.sort((a, b) => niveauOrder(a.niveau) - niveauOrder(b.niveau));

    counter.textContent = `${actives.length} alerte${actives.length > 1 ? 's' : ''} à traiter`;
    list.innerHTML = actives.slice(0, 3).map(a => {
      const color = NIVEAU_COLOR[a.niveau] || NIVEAU_COLOR.info;
      const msg = escHtml(a.message || a.titre || 'Alerte');
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--border)">
          ${SVG_DOT(color)}
          <div style="flex:1;font-size:.88rem;line-height:1.3">${msg}</div>
        </div>`;
    }).join('');
    // Last item: drop the border-bottom
    const lastItem = list.lastElementChild;
    if (lastItem) lastItem.style.borderBottom = 'none';
    card.style.display = '';
  }

  // Trigger on dashboard navigation + every alertes change
  function setupHook() {
    // Initial render once DOM ready
    renderPreview();
    // Re-render when alertes count changes (via existing global event if any, fallback polling)
    document.addEventListener('alertes:updated', renderPreview);
    // Fallback : observer page-dashboard becoming active
    const page = document.getElementById('page-dashboard');
    if (page && typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => {
        if (page.classList.contains('active')) renderPreview();
      });
      obs.observe(page, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHook);
  } else {
    setupHook();
  }

  window.renderDashboardPointsAttention = renderPreview;
})();
