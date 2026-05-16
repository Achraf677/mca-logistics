/**
 * MCA Logistics — Sprint 7 — Pagination livraisons + recherche instantanée debounced (Phase X — extraction script.js)
 *
 * Extracted from script.js L4900-5171 (2026-05-16).
 */

/* =========================================================================
   SPRINT 7 — Pagination + recherche instantanée
   ========================================================================= */
(function() {
  'use strict';

  const LS_KEY = 'pagination_state';
  const DEFAULT_PER_PAGE = 25;
  const PER_PAGE_OPTIONS = [25, 50, 100];

  function loadState() {
    try { return loadSafe(LS_KEY, {}); } catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  }

  function getPageState(key) {
    const all = loadState();
    const st = all[key] || {};
    return {
      page: typeof st.page === 'number' ? st.page : 1,
      perPage: typeof st.perPage === 'number' ? st.perPage : DEFAULT_PER_PAGE
    };
  }
  function setPageState(key, patch) {
    const all = loadState();
    all[key] = Object.assign({}, all[key] || {}, patch);
    saveState(all);
  }

  /**
   * Découpe un tableau selon l'état de pagination.
   * Retourne { slice, total, page, perPage, totalPages }.
   */
  function paginerListe(arr, key) {
    const total = arr.length;
    const st = getPageState(key);
    const perPage = st.perPage;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    let page = Math.min(Math.max(1, st.page), totalPages);
    if (page !== st.page) setPageState(key, { page });
    const start = (page - 1) * perPage;
    const slice = arr.slice(start, start + perPage);
    return { slice, total, page, perPage, totalPages, start };
  }

  /**
   * Construit la barre de pagination dans le conteneur.
   */
  function rendrerPagination(key, total, page, perPage, totalPages, start) {
    const container = document.querySelector('[data-pagination-key="' + key + '"]');
    if (!container) return;
    // #20 audit Chrome : masquer la pagination si tout tient sur une page
    // (avant le fix : "Affichage 1-1 sur 1" + selecteur 25/page sur 1 ligne).
    if (total === 0 || total <= perPage) { container.style.display = 'none'; container.innerHTML = ''; return; }
    container.style.display = '';

    const end = Math.min(start + perPage, total);
    const info = 'Affichage <strong>' + (start + 1) + '–' + end + '</strong> sur <strong>' + total + '</strong>';

    const pagesToShow = [];
    const push = (n) => { if (!pagesToShow.includes(n) && n >= 1 && n <= totalPages) pagesToShow.push(n); };
    push(1); push(totalPages);
    for (let i = page - 1; i <= page + 1; i++) push(i);
    pagesToShow.sort((a, b) => a - b);

    let pagesHtml = '';
    let prev = 0;
    pagesToShow.forEach(n => {
      if (n - prev > 1) pagesHtml += '<span class="pagination-ellipsis">…</span>';
      pagesHtml += '<button type="button" class="pagination-btn pagination-num' + (n === page ? ' is-active' : '') +
        '" data-pagination-go="' + n + '">' + n + '</button>';
      prev = n;
    });

    const perPageOptions = PER_PAGE_OPTIONS.map(n =>
      '<option value="' + n + '"' + (n === perPage ? ' selected' : '') + '>' + n + ' / page</option>'
    ).join('');

    container.innerHTML =
      '<div class="pagination-info">' + info + '</div>' +
      '<div class="pagination-controls">' +
        '<button type="button" class="pagination-btn" data-pagination-go="first" ' + (page === 1 ? 'disabled' : '') + ' aria-label="Première page">«</button>' +
        '<button type="button" class="pagination-btn" data-pagination-go="prev" ' + (page === 1 ? 'disabled' : '') + ' aria-label="Précédente">‹</button>' +
        pagesHtml +
        '<button type="button" class="pagination-btn" data-pagination-go="next" ' + (page === totalPages ? 'disabled' : '') + ' aria-label="Suivante">›</button>' +
        '<button type="button" class="pagination-btn" data-pagination-go="last" ' + (page === totalPages ? 'disabled' : '') + ' aria-label="Dernière page">»</button>' +
      '</div>' +
      '<div class="pagination-per-page">' +
        '<select class="pagination-select" data-pagination-perpage>' + perPageOptions + '</select>' +
      '</div>';

    // Bind events (une seule fois, via délégation)
    if (!container.dataset.bound) {
      container.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-pagination-go]');
        if (!btn || btn.disabled) return;
        const st = getPageState(key);
        const action = btn.getAttribute('data-pagination-go');
        let newPage = st.page;
        if (action === 'first') newPage = 1;
        else if (action === 'prev') newPage = Math.max(1, st.page - 1);
        else if (action === 'next') newPage = st.page + 1;
        else if (action === 'last') newPage = totalPages;
        else newPage = parseInt(action, 10) || 1;
        setPageState(key, { page: newPage });
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      });
      container.addEventListener('change', function(e) {
        const sel = e.target.closest('[data-pagination-perpage]');
        if (!sel) return;
        setPageState(key, { perPage: parseInt(sel.value, 10) || DEFAULT_PER_PAGE, page: 1 });
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      });
      container.dataset.bound = '1';
    }
  }

  // Exposer
  window.PAGINATION = {
    getPageState: getPageState,
    setPageState: setPageState,
    paginerListe: paginerListe,
    rendrerPagination: rendrerPagination
  };

  /* ---------- Patch renderLivraisonsAdminFinal pour paginer ---------- */
  function patchRender() {
    const orig = window.renderLivraisonsAdminFinal;
    if (typeof orig !== 'function' || orig.__paginated) return;

    const patched = function() {
      let livraisons = charger('livraisons');
      const tb = document.getElementById('tb-livraisons');
      if (!tb) return;

      const filtreStatut = document.getElementById('filtre-statut')?.value || '';
      const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
      const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
      const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
      const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
      const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';

      const selChauf = document.getElementById('filtre-chauffeur');
      if (selChauf) {
        const currentValue = selChauf.value;
        selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
        charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
        selChauf.value = currentValue;
      }

      // Phase 91.55 Bug B — chip "Brouillons" doit aussi matcher les livraisons legacy `statut === 'en-attente'`
  if (filtreStatut) livraisons = livraisons.filter(l => filtreStatut === 'brouillon'
    ? (l.statut === 'brouillon' || l.statut === 'en-attente' || l.brouillon === true)
    : l.statut === filtreStatut);
      if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
      if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
      if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
      if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
      if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
      livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

      if (!livraisons.length) {
        tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
        rendrerPagination('livraisons', 0, 1, DEFAULT_PER_PAGE, 1, 0);
        if (typeof majBulkActions === 'function') majBulkActions();
        return;
      }

      // Pagination
      const paged = paginerListe(livraisons, 'livraisons');

      // Rendu du slice via fonction orig (en remplaçant charger temporairement)
      // Approche plus simple : on rend directement avec la même logique que orig
      const escapeAttr = window.escapeAttr;
      const escapeHtml = window.escapeHtml;
      const formatClientLabel = v => {
        var raw = String(v || '').trim();
        if (!raw) return '—';
        return /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
      };
      const formatArchivedDriverHtml = v => {
        var raw = String(v || '').trim();
        if (!raw) return '<span class="livraison-cell-text livraison-driver-text">Non assigné</span>';
        var archived = /\s*\(archivé\)\s*$/i.test(raw);
        var clean = raw.replace(/\s*\(archivé\)\s*$/i, '').trim();
        var safeClean = escapeHtml(clean || raw);
        if (!archived) return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '</span>';
        return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '<span class="livraison-archived-badge">archivé</span></span>';
      };

      tb.innerHTML = paged.slice.map(l => {
        const ht = getMontantHTLivraison(l);
        const tva = (parseFloat(l.prix) || 0) - ht;
        const ttc = parseFloat(l.prix) || 0;
        const statutPaiement = l.statutPaiement || 'en-attente';
        const selectStatutPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('statut', l.statut) + '" onchange="changerStatutLivraison(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'statut\')"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>Livré</option></select>';
        const selectPaiementPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('paiement', statutPaiement) + '" onchange="changerStatutPaiement(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'paiement\')"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>À payer</option><option value="payé" ' + (statutPaiement === 'payé' ? 'selected' : '') + '>Payé</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
        const client = formatClientLabel(l.client || '—');
        const clientText = escapeHtml(client);
        const depart = l.depart || '';
        const arrivee = l.arrivee || '';
        const zoneGeo = depart && arrivee && depart !== arrivee ? depart + ' → ' + arrivee : (arrivee || depart || '—');
        const zoneGeoText = escapeHtml(zoneGeo || '—');
        const chauffeur = l.chaufNom || 'Non assigné';
        const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
        return `<tr data-liv-id="${escapeAttr(l.id)}">
          <td class="bulk-col"><input type="checkbox" class="bulk-liv-check" data-liv-id="${escapeAttr(l.id)}" onchange="majBulkActions()" aria-label="Sélectionner" /></td>
          <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
          <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(client)}">${clientText}</strong></td>
          <td><span class="livraison-cell-text livraison-zone-text" title="${escapeAttr(zoneGeo || '—')}">${zoneGeoText}</span></td>
          <td class="livraison-number-cell">${l.distance ? formatKm(l.distance) : '—'}</td>
          <td class="livraison-number-cell">${euros(ht)}</td>
          <td class="livraison-number-cell livraison-muted-cell">${euros(tva)}</td>
          <td class="livraison-number-cell livraison-total-cell">${euros(ttc)}</td>
          <td>${formatArchivedDriverHtml(chauffeur)}</td>
          <td><div class="livraison-select-cell">${selectStatutPropre}</div></td>
          <td><div class="livraison-select-cell">${selectPaiementPropre}</div></td>
          <td class="livraison-number-cell">${datePaiement}</td>
          <td class="actions-cell">${buildInlineActionsDropdown('Actions', [
            { icon:'✏️', label:'Modifier', action:"ouvrirEditLivraison('" + l.id + "')" },
              { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
            { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
            { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
            { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
          ])}</td>
        </tr>`;
      }).join('');

      rendrerPagination('livraisons', paged.total, paged.page, paged.perPage, paged.totalPages, paged.start);
      if (typeof majBulkActions === 'function') majBulkActions();
    };

    patched.__paginated = true;
    window.renderLivraisonsAdminFinal = patched;
    /* WRAPPER S7 — pagination livraisons. H2.1 : on ne réassigne plus
       window.afficherLivraisons ici. `afficherLivraisons` (script-livraisons.js)
       lit `window.renderLivraisonsAdminFinal` au moment de l'appel, donc elle
       pointe automatiquement sur le wrapper courant — plus besoin de chaîner
       les écritures (qui causaient des collisions selon l'ordre de chargement). */
  }

  /* ---------- Recherche instantanée (debounce 200ms) ---------- */
  function installSearchDebounce() {
    const input = document.getElementById('filtre-recherche-liv');
    if (!input || input.dataset.instantBound) return;
    let t;
    input.addEventListener('input', function() {
      clearTimeout(t);
      t = setTimeout(function() {
        // Reset page 1 quand on tape
        setPageState('livraisons', { page: 1 });
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      }, 200);
    });
    input.dataset.instantBound = '1';
  }

  function init() {
    patchRender();
    installSearchDebounce();
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM déjà prêt — patch après micro-délai pour laisser les autres IIFE finir
    setTimeout(init, 0);
  }
})();
