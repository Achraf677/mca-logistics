/* ==========================================================================
   MCA Logistics — Livraisons table polish (Phase 23)

   Hook post-render qui :
   1. Observe #tb-livraisons via MutationObserver
   2. Pour chaque <tr>, transforme la cellule chauffeur (col 9) :
      - Extrait le nom (e.g. "Karim Benali")
      - Génère les initiales (KB)
      - Injecte un wrapper .driver-cell avec span .driver-av + nom

   3. Assigne une couleur d'avatar stable basée sur un hash du nom.

   Aucun changement script-livraisons.js requis.
   ========================================================================== */

(function () {
  'use strict';

  function getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatarClassFromName(name) {
    if (!name) return 'av-1';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    const idx = (Math.abs(hash) % 6) + 1;
    return 'av-' + idx;
  }

  function transformDriverCell(td) {
    if (!td || td.dataset.driverPolished === '1') return;
    const text = td.textContent.trim();
    if (!text || text === '—' || text === '-') return;
    const initials = getInitials(text);
    const cls = avatarClassFromName(text);
    // Préserver le texte existant + ajouter avatar avant
    const escaped = text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    td.innerHTML = '<span class="driver-cell"><span class="driver-av ' + cls + '">' + initials + '</span><span class="driver-name">' + escaped + '</span></span>';
    td.dataset.driverPolished = '1';
  }

  function polishRows() {
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      // Skip empty-row
      if (tr.classList.contains('empty-row') || tr.querySelector('td.empty-row')) return;
      // Col 9 = Salarié (index 8 si checkbox + 12 autres avant)
      const tds = tr.querySelectorAll('td');
      if (tds.length < 9) return;
      transformDriverCell(tds[8]);
    });
  }

  function setupHook() {
    polishRows();
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    const obs = new MutationObserver((muts) => {
      // Quand tbody change (re-render), re-polish
      polishRows();
    });
    obs.observe(tbody, { childList: true, subtree: false });
  }

  function tryAttach() {
    if (document.getElementById('tb-livraisons')) {
      setupHook();
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!tryAttach()) {
        let retries = 0;
        const iv = setInterval(() => { if (tryAttach() || ++retries > 20) clearInterval(iv); }, 500);
      }
    });
  } else {
    if (!tryAttach()) {
      let retries = 0;
      const iv = setInterval(() => { if (tryAttach() || ++retries > 20) clearInterval(iv); }, 500);
    }
  }

  window.refonteLivraisonsPolish = polishRows;
})();
