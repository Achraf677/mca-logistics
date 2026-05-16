/**
 * MCA Logistics — Sprint 8 — Tri universel par colonne cliquable (Phase X — extraction script.js)
 *
 * Extracted from script.js L4902-5195 (2026-05-16).
 */

/* =========================================================================
   SPRINT 8 — Tri par colonne cliquable
   ========================================================================= */
(function() {
  'use strict';

  const LS_KEY = 'sort_state';

  function loadState() {
    try { return loadSafe(LS_KEY, {}); } catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  }
  function getSortState(key) {
    const all = loadState();
    return all[key] || { col: null, dir: null };
  }
  function setSortState(key, col, dir) {
    const all = loadState();
    if (!col || !dir) delete all[key];
    else all[key] = { col, dir };
    saveState(all);
  }

  /**
   * Config des accesseurs + types par clé de tri, pour la table livraisons.
   * type: 'string' | 'number' | 'date' | 'enum'
   */
  const LIVRAISONS_SORT_CONFIG = {
    numLiv:       { type: 'string', get: l => l.numLiv || '' },
    // Phase 91.30 — date + vehicule triables (étaient absents)
    date:         { type: 'date',   get: l => l.date || l.date_livraison || l.dateLivraison || '' },
    vehicule:     { type: 'string', get: l => l.vehImmat || l.vehicule || l.vehiculeImmat || l.vehNom || '' },
    client:       { type: 'string', get: l => l.client || '' },
    zone:         { type: 'string', get: l => ((l.depart || '') + ' ' + (l.arrivee || '')).trim() },
    distance:     { type: 'number', get: l => parseFloat(l.distance) || 0 },
    ht:           { type: 'number', get: l => (typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0)) },
    tva:          { type: 'number', get: l => {
      const ht = typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0);
      return (parseFloat(l.prix) || 0) - ht;
    }},
    ttc:          { type: 'number', get: l => parseFloat(l.prix) || 0 },
    chauffeur:    { type: 'string', get: l => l.chaufNom || '' },
    statut:       { type: 'enum',   get: l => l.statut || 'en-attente', order: ['en-attente','en-cours','livre'] },
    paiement:     { type: 'enum',   get: l => l.statutPaiement || 'en-attente', order: ['en-attente','litige','payé'] },
    datePaiement: { type: 'date',   get: l => l.datePaiement || '' }
  };

  /**
   * Trie un tableau selon la clé et direction demandées.
   * Retourne un nouveau tableau (ne modifie pas l'original).
   */
  function appliquerTri(arr, key, config, fallbackSort) {
    const st = getSortState(key);
    if (!st.col || !st.dir || !config[st.col]) {
      if (typeof fallbackSort === 'function') return arr.slice().sort(fallbackSort);
      return arr.slice();
    }
    const cfg = config[st.col];
    const dir = st.dir === 'desc' ? -1 : 1;
    const sorted = arr.slice().sort((a, b) => {
      const va = cfg.get(a);
      const vb = cfg.get(b);
      let cmp = 0;
      if (cfg.type === 'number') {
        cmp = (va || 0) - (vb || 0);
      } else if (cfg.type === 'date') {
        const da = va ? new Date(va).getTime() : 0;
        const db = vb ? new Date(vb).getTime() : 0;
        cmp = da - db;
      } else if (cfg.type === 'enum') {
        const ia = cfg.order.indexOf(va);
        const ib = cfg.order.indexOf(vb);
        cmp = (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      } else {
        cmp = String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' });
      }
      return cmp * dir;
    });
    return sorted;
  }

  /**
   * Met à jour l'indicateur visuel sur tous les th[data-sort-key] d'un table.
   */
  function majIndicateurs(tableEl, key) {
    if (!tableEl) return;
    const st = getSortState(key);
    tableEl.querySelectorAll('th[data-sort-key]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      // Phase 91.40 — a11y : aria-sort état actuel
      if (th.getAttribute('data-sort-key') === st.col && st.dir) {
        th.classList.add(st.dir === 'asc' ? 'sort-asc' : 'sort-desc');
        th.setAttribute('aria-sort', st.dir === 'asc' ? 'ascending' : 'descending');
      } else {
        th.setAttribute('aria-sort', 'none');
      }
    });
  }

  /**
   * Attache les listeners de clic sur les th triables d'une table donnée.
   * Cycle: null -> asc -> desc -> null
   */
  function bindSortableHeaders(tableSelector, key, rerender) {
    const table = document.querySelector(tableSelector);
    if (!table || table.dataset.sortBound) return;
    // Phase 91.34 — a11y : rendre les TH sortable keyboard-accessible (role=button + tabindex)
    table.querySelectorAll('th[data-sort-key]').forEach(function (th) {
      if (!th.hasAttribute('role')) th.setAttribute('role', 'button');
      if (!th.hasAttribute('tabindex')) th.setAttribute('tabindex', '0');
    });
    const handleSort = function (th) {
      const col = th.getAttribute('data-sort-key');
      const st = getSortState(key);
      let newDir;
      if (st.col !== col) newDir = 'asc';
      else if (st.dir === 'asc') newDir = 'desc';
      else newDir = null;
      setSortState(key, newDir ? col : null, newDir);
      if (window.PAGINATION && typeof window.PAGINATION.setPageState === 'function') {
        window.PAGINATION.setPageState(key, { page: 1 });
      }
      if (typeof rerender === 'function') rerender();
    };
    table.addEventListener('click', function(e) {
      const th = e.target.closest('th[data-sort-key]');
      if (!th || !table.contains(th)) return;
      handleSort(th);
    });
    // Phase 91.34 — Enter / Space déclenchent le tri (keyboard a11y)
    table.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const th = e.target.closest('th[data-sort-key]');
      if (!th || !table.contains(th)) return;
      e.preventDefault();
      handleSort(th);
    });
    table.dataset.sortBound = '1';
  }

  // Exposer API publique
  window.SORT = {
    getSortState: getSortState,
    setSortState: setSortState,
    appliquerTri: appliquerTri,
    majIndicateurs: majIndicateurs,
    bindSortableHeaders: bindSortableHeaders,
    LIVRAISONS_CONFIG: LIVRAISONS_SORT_CONFIG
  };

  /* ---------- Intégration livraisons ---------- */
  function init() {
    const rerender = function() {
      if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
    };
    bindSortableHeaders('table.livraisons-table', 'livraisons', rerender);

    // Wrap renderLivraisonsAdminFinal : appliquer tri avant pagination
    const orig = window.renderLivraisonsAdminFinal;
    if (typeof orig !== 'function' || orig.__sorted) return;

    // Hijack charger pour livraisons: appliquer le tri en amont
    // Approche propre : patch en wrappant pour post-process avant pagination
    // Plus simple: on intercepte via un patch global Array.sort ? Non.
    // Solution : surcharger Array.prototype.sort dans le contexte de orig? trop invasif.
    // Vraie solution : patch orig entièrement (déjà patché par Sprint 7). On re-patche.
    const wrapped = function() {
      // On doit appliquer le tri avant la pagination. Le render Sprint 7 fait déjà
      // filter -> sort par défaut (creeLe desc) -> paginerListe -> render.
      // On intercepte en remplaçant temporairement Array.prototype.sort ? Non.
      // → On va plutôt monkey-patcher charger('livraisons') pour ce seul call :
      // Trop compliqué. Approche pragmatique : on duplique le flux.

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

      // Tri : si utilisateur a choisi une colonne, on applique. Sinon fallback creeLe desc.
      livraisons = appliquerTri(livraisons, 'livraisons', LIVRAISONS_SORT_CONFIG,
        (a, b) => new Date(b.creeLe) - new Date(a.creeLe));

      if (!livraisons.length) {
        tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
        if (window.PAGINATION) window.PAGINATION.rendrerPagination('livraisons', 0, 1, 25, 1, 0);
        if (typeof majBulkActions === 'function') majBulkActions();
        majIndicateurs(document.querySelector('table.livraisons-table'), 'livraisons');
        return;
      }

      const paged = window.PAGINATION.paginerListe(livraisons, 'livraisons');

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

      window.PAGINATION.rendrerPagination('livraisons', paged.total, paged.page, paged.perPage, paged.totalPages, paged.start);
      if (typeof majBulkActions === 'function') majBulkActions();
      majIndicateurs(document.querySelector('table.livraisons-table'), 'livraisons');
    };

    wrapped.__paginated = true;
    wrapped.__sorted = true;
    window.renderLivraisonsAdminFinal = wrapped;
    /* WRAPPER S8 — tri colonnes livraisons. H2.1 : pas de réassignement de
       window.afficherLivraisons (cf. WRAPPER S7). */

    // Re-render initial pour afficher l'indicateur si tri déjà mémorisé
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 50); });
  } else {
    setTimeout(init, 50);
  }
})();
