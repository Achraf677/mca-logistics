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

  // ============ FIX bug : filtres date auto-init "aujourd'hui" cassent kanban/calendrier ============
  // script.js (boot) fait : input[type=date].value = aujourdhui() sur TOUS les inputs date.
  // Resultat : Kanban + Calendrier livraisons filtrent uniquement les livs du jour (vide).
  // On reset ces 2 filtres au boot livraisons.
  function resetLivraisonsDateFilters() {
    const dDeb = document.getElementById('filtre-date-debut');
    const dFin = document.getElementById('filtre-date-fin');
    if (dDeb && dDeb.value) dDeb.value = '';
    if (dFin && dFin.value) dFin.value = '';
  }

  // Hook sur changerVueLivraisons pour clear dates + re-afficher
  function wrapChangerVue() {
    if (window.__changerVueWrapped) return;
    const orig = window.changerVueLivraisons;
    if (typeof orig !== 'function') return;
    window.changerVueLivraisons = function (vue) {
      // Pour Kanban/Calendrier : clear date filters AVANT l'appel
      if (vue === 'kanban' || vue === 'calendrier') {
        resetLivraisonsDateFilters();
      }
      orig.apply(this, arguments);
    };
    window.__changerVueWrapped = true;
  }

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
    const escaped = text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    td.innerHTML = '<span class="driver-cell"><span class="driver-av ' + cls + '">' + initials + '</span><span class="driver-name">' + escaped + '</span></span>';
    td.dataset.driverPolished = '1';
  }

  // ============ Table restructure (Phase 25) ============
  // Le tbody est rendu par script-livraisons.js avec 13 cols dans cet ordre :
  // 1=checkbox 2=numLiv 3=client 4=zone 5=distance 6=ht 7=tva 8=ttc 9=salarie 10=statut 11=paiement 12=datePaiement 13=actions
  //
  // On post-processe pour qu'il ressemble au mockup :
  // - Mono N° (col 2) → CSS only
  // - Replace col 4 (Zone) avec "Trajet" formaté (depart → arrivee)
  // - Hide col 5 (Distance) → CSS only
  // - Hide col 6 (HT) → CSS only (on garde TTC comme Montant)
  // - Hide col 7 (TVA) → CSS only
  // - Col 8 (TTC) relabel "Montant HT" mais on le laisse comme TTC pour pas casser
  // - Col 9 (Salarié) → avatar transform
  // - Hide col 11, 12, 13 → CSS only
  //
  // Pour Trajet, on lit la livraison via son ID stocké dans tr.dataset (si script.js l'expose)
  // Sinon, on inspecte le texte de la cellule pour deviner.

  function transformTrajetCell(td, livraison) {
    if (!td || td.dataset.trajetPolished === '1') return;
    if (livraison && (livraison.depart || livraison.arrivee)) {
      const dep = String(livraison.depart || '—').slice(0, 24);
      const arr = String(livraison.arrivee || '—').slice(0, 24);
      td.innerHTML = '<span class="liv-trajet">' + dep.replace(/[<>]/g, '') + ' <span class="liv-trajet-arrow">→</span> ' + arr.replace(/[<>]/g, '') + '</span>';
      td.dataset.trajetPolished = '1';
    }
  }

  function getLivraisonForRow(tr) {
    // Try data-id then various data attrs
    if (!tr) return null;
    const id = tr.dataset.id || tr.dataset.livraisonId || tr.dataset.lid
            || tr.getAttribute('data-id') || tr.getAttribute('data-livraison-id');
    if (id && typeof window.charger === 'function') {
      const livs = window.charger('livraisons') || [];
      return livs.find(l => l.id === id);
    }
    // Fallback : match via numLiv (col 2 text)
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 2) {
      const numLiv = (tds[1].textContent || '').trim();
      if (numLiv && typeof window.charger === 'function') {
        const livs = window.charger('livraisons') || [];
        return livs.find(l => l.numLiv === numLiv);
      }
    }
    return null;
  }

  function formatDateShort(dStr) {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      return day + '/' + mon;
    } catch (_) { return ''; }
  }

  function transformClientCell(td, livraison) {
    if (!td || td.dataset.clientPolished === '1') return;
    if (!livraison) return;
    const date = formatDateShort(livraison.date || livraison.date_livraison || livraison.dateLivraison);
    const client = String(livraison.client || td.textContent.trim() || '—').replace(/[<>]/g, '');
    td.innerHTML = ''
      + '<div class="liv-client-cell">'
      +   (date ? '<span class="liv-client-date">' + date + '</span>' : '')
      +   '<span class="liv-client-name">' + client + '</span>'
      + '</div>';
    td.dataset.clientPolished = '1';
  }

  function transformDriverCellWithVehicule(td, livraison) {
    if (!td || td.dataset.driverPolished === '1') return;
    const text = td.textContent.trim();
    if (!text || text === '—' || text === '-') return;
    const initials = getInitials(text);
    const cls = avatarClassFromName(text);
    const escaped = text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    // Si on a la livraison, injecter aussi le vehicule en sub
    const vehImmat = livraison ? String(livraison.vehImmat || livraison.vehimmat || livraison.veh_immat || '').replace(/[<>]/g, '') : '';
    const vehHtml = vehImmat
      ? '<span class="driver-sub">' + vehImmat + '</span>'
      : '';
    td.innerHTML = ''
      + '<span class="driver-cell">'
      +   '<span class="driver-av ' + cls + '">' + initials + '</span>'
      +   '<span class="driver-info">'
      +     '<span class="driver-name">' + escaped + '</span>'
      +     vehHtml
      +   '</span>'
      + '</span>';
    td.dataset.driverPolished = '1';
  }

  function polishRows() {
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.classList.contains('empty-row') || tr.querySelector('td.empty-row')) return;
      const tds = tr.querySelectorAll('td');
      if (tds.length < 9) return;
      // Lookup livraison source
      const liv = getLivraisonForRow(tr);
      // Transform col 3 (Client) : prefix avec date
      if (liv) transformClientCell(tds[2], liv);
      // Transform col 4 (Zone → Trajet)
      if (liv) transformTrajetCell(tds[3], liv);
      // Transform col 9 (Salarié → avatar + vehicule sub)
      transformDriverCellWithVehicule(tds[8], liv);
    });
    renderPaginationFooter();
  }

  // ============ Pagination footer (Phase 25) ============
  function renderPaginationFooter() {
    const wrap = document.getElementById('pagination-livraisons');
    if (!wrap) return;
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    const visibleRows = tbody.querySelectorAll('tr:not([style*="display: none"])').length;
    const livraisons = (typeof window.charger === 'function' ? window.charger('livraisons') || [] : []);
    const total = livraisons.length;
    if (total === 0) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }
    // Simple footer : "X affichées sur Y" (pagination réelle est dans script.js si dispo)
    wrap.innerHTML = ''
      + '<div class="pg-count">' + visibleRows + ' affichée' + (visibleRows > 1 ? 's' : '') + ' sur ' + total + '</div>'
      + '<div class="pg-numbers" id="pagination-livraisons-numbers"></div>';
    wrap.style.display = 'flex';
  }

  // ============ Filtres toggle (Phase 25) ============
  window.toggleLivraisonsFilters = function () {
    const bar = document.querySelector('#page-livraisons > .filters.filters-livraisons');
    if (!bar) return;
    const btn = document.getElementById('liv-filters-toggle-btn');
    const isOpen = bar.classList.toggle('expanded');
    if (btn) btn.classList.toggle('active', isOpen);
  };

  function setupHook() {
    polishRows();
    wrapChangerVue();
    // Au boot des livraisons, clear filtres date pour eviter le bug "vide aujourd'hui"
    resetLivraisonsDateFilters();
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
