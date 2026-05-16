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

  function fmtEur(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Math.round(Number(n)).toLocaleString('fr-FR') + ' €';
  }

  // ============ Injection 3 nouvelles colonnes (Phase 27) ============
  // Script.js rend 13 <td> par row. On INJECTE :
  //   - <td> Date à la position 3 (apres N°)
  //   - <td> Véhicule à la position 11 (apres Chauffeur transformed)
  //   - <td> Montant HT à la fin (lecture depuis td[8] TTC ou td[5] HT du DOM)
  function injectExtraCells(tr, livraison) {
    if (!tr || tr.dataset.colsInjected === '1') return;
    const tds = tr.querySelectorAll('td');
    if (tds.length < 13) return;

    // 1. Date <td> au index 2 (entre N° et Client)
    const dateTd = document.createElement('td');
    dateTd.className = 'liv-date-cell';
    if (livraison) {
      const d = formatDateShort(livraison.date || livraison.date_livraison || livraison.dateLivraison);
      dateTd.textContent = d || '—';
    } else {
      dateTd.textContent = '—';
    }
    tr.insertBefore(dateTd, tds[2]);

    // 2. Apres Chauffeur (initial col 9, après insertion col 10 → index 9) : insérer Véhicule
    const tdsAfter1 = tr.querySelectorAll('td'); // refresh after insertion (14 tds maintenant)
    const vehTd = document.createElement('td');
    vehTd.className = 'liv-veh-cell';
    if (livraison) {
      const veh = livraison.vehImmat || livraison.vehimmat || livraison.veh_immat
                 || livraison.vehicule || livraison.vehiculeImmat || '';
      vehTd.textContent = String(veh).replace(/[<>]/g, '') || '—';
    } else {
      vehTd.textContent = '—';
    }
    // Inserer apres Chauffeur (index 9 dans la liste à 14 tds)
    if (tdsAfter1[10]) tr.insertBefore(vehTd, tdsAfter1[10]);
    else tr.appendChild(vehTd);

    // 3. Montant HT en fin de row
    const montantTd = document.createElement('td');
    montantTd.className = 'liv-montant-cell';
    if (livraison) {
      const ht = Number(livraison.ht || livraison.prix_ht || livraison.prixHT || livraison.prix || 0);
      montantTd.textContent = fmtEur(ht);
    } else {
      // Fallback : lire depuis td legacy HT (col 6 dans le DOM original = index 5 maintenant)
      const oldHt = tds[5];
      montantTd.textContent = oldHt ? oldHt.textContent.trim() : '—';
    }
    tr.appendChild(montantTd);

    tr.dataset.colsInjected = '1';
  }

  function transformDriverCell(td) {
    // Version simple sans vehicule sub (Phase 27 — Vehicule est une col separate maintenant)
    if (!td || td.dataset.driverPolished === '1') return;
    const text = td.textContent.trim();
    if (!text || text === '—' || text === '-') return;
    const initials = getInitials(text);
    const cls = avatarClassFromName(text);
    const escaped = text.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    td.innerHTML = ''
      + '<span class="driver-cell">'
      +   '<span class="driver-av ' + cls + '">' + initials + '</span>'
      +   '<span class="driver-name">' + escaped + '</span>'
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
      const liv = getLivraisonForRow(tr);
      // ORDER MATTERS : inject extra cells AVANT les transforms car ça change les indices
      injectExtraCells(tr, liv);
      // Re-query tds après injection (maintenant 16 tds)
      const tdsAfter = tr.querySelectorAll('td');
      // Transform Trajet (col 5 maintenant)
      if (liv && tdsAfter[4]) transformTrajetCell(tdsAfter[4], liv);
      // Transform Chauffeur (col 10 maintenant = index 9)
      if (tdsAfter[9]) transformDriverCell(tdsAfter[9]);
    });
    renderPaginationFooter();
  }

  // ============ Pagination footer (Phase 25) ============
  function renderPaginationFooter() {
    const wrap = document.getElementById('pagination-livraisons');
    if (!wrap) return;
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    // Count visible rows (non-display-none)
    let visibleRows = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.classList.contains('empty-row') || tr.querySelector('td.empty-row')) return;
      const display = window.getComputedStyle(tr).display;
      if (display !== 'none') visibleRows++;
    });
    const livraisons = (typeof window.charger === 'function' ? window.charger('livraisons') || [] : []);
    const total = livraisons.length;
    if (total === 0) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }
    // Pagination simulee (par defaut on affiche tout - 1 seule page)
    // Si visible >= 20, on simule pages de 20
    const perPage = 20;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = 1;
    let pages = '';
    if (totalPages > 1) {
      const numbers = [];
      for (let i = 1; i <= Math.min(3, totalPages); i++) numbers.push(i);
      if (totalPages > 4) numbers.push('…');
      if (totalPages > 3) numbers.push(totalPages);
      pages = numbers.map(n => {
        if (n === '…') return '<span class="pg-btn" style="border:none;cursor:default">…</span>';
        return '<button class="pg-btn' + (n === currentPage ? ' active' : '') + '" type="button">' + n + '</button>';
      }).join('');
      pages = '<button class="pg-btn" type="button" aria-label="Précédent">‹</button>' + pages
            + '<button class="pg-btn" type="button" aria-label="Suivant">›</button>';
    }
    wrap.innerHTML = ''
      + '<div class="pg-count">' + visibleRows + ' affichée' + (visibleRows > 1 ? 's' : '') + ' sur ' + total + '</div>'
      + '<div class="pg-numbers">' + pages + '</div>';
    wrap.style.display = 'flex';
  }

  // ============ Date range chip (Phase 26) ============
  function updateDateRangeChip() {
    const dDeb = document.getElementById('filtre-date-debut');
    const dFin = document.getElementById('filtre-date-fin');
    const labelEl = document.getElementById('liv-periode-label');
    if (!labelEl) return;
    if ((dDeb && dDeb.value) || (dFin && dFin.value)) {
      labelEl.textContent = formatFr(dDeb && dDeb.value) + ' — ' + formatFr(dFin && dFin.value);
      return;
    }
    // Sinon, calcul auto du mois courant
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth()+1).padStart(2, '0') + '/' + d.getFullYear();
    labelEl.textContent = fmt(first) + ' — ' + fmt(last);
  }

  function formatFr(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    } catch (_) { return '—'; }
  }

  // ============ Action Générer wrapper (Phase 33) ============
  // Le dropdown Générer expose 4 types : facture / bl / cmr / facture-groupee
  // On lit les IDs des rows checkboxes ; si aucun, on prend la 1ere row visible ;
  // sinon on demande de selectionner.
  window.actionGenererLivraison = function (type) {
    const selected = Array.from(document.querySelectorAll('#tb-livraisons .bulk-liv-check:checked'))
      .map(c => c.dataset.livId).filter(Boolean);

    // Aucune selection : prendre la 1ere ligne visible (UX practical)
    let livId = null;
    if (selected.length >= 1) {
      livId = selected[0];
    } else {
      const firstRow = document.querySelector('#tb-livraisons tr:not(.empty-row)');
      if (firstRow) {
        const cb = firstRow.querySelector('.bulk-liv-check');
        if (cb) livId = cb.dataset.livId;
      }
    }

    if (!livId) {
      const toast = window.afficherToast || ((msg) => alert(msg));
      toast('Sélectionnez une livraison pour générer ce document', 'warn');
      return;
    }

    // Dispatch selon type
    const dispatch = {
      'facture': () => {
        if (typeof window.genererFactureLivraison === 'function') {
          window.genererFactureLivraison(livId);
          // Enregistrer la trace
          if (typeof window.enregistrerDocumentLivraison === 'function') {
            const livs = (window.charger ? window.charger('livraisons') : []) || [];
            const l = livs.find(x => x.id === livId);
            const numLiv = l ? (l.numLiv || l.num_liv || livId) : livId;
            window.enregistrerDocumentLivraison(livId, {
              type: 'facture',
              name: 'Facture ' + numLiv.replace(/^L-/, 'F-'),
            });
          }
        } else { alert('Fonction genererFactureLivraison absente — TODO côté backend'); }
      },
      'bl': () => {
        if (typeof window.genererBonsLivraison === 'function') window.genererBonsLivraison(livId);
        else if (typeof window.genererBonLivraison === 'function') window.genererBonLivraison(livId);
        else alert('Fonction BL absente');
        if (typeof window.enregistrerDocumentLivraison === 'function') {
          window.enregistrerDocumentLivraison(livId, { type: 'bl', name: 'Bon de livraison' });
        }
      },
      'cmr': () => {
        // Phase 91.12 — fonction exposée = genererLettreDeVoiture (cf. script.js:3706).
        if (typeof window.genererLettreDeVoiture === 'function') window.genererLettreDeVoiture(livId);
        else if (typeof window.genererLettreVoiture === 'function') window.genererLettreVoiture(livId);
        else alert('Fonction CMR absente');
        if (typeof window.enregistrerDocumentLivraison === 'function') {
          window.enregistrerDocumentLivraison(livId, { type: 'cmr', name: 'Lettre de voiture CMR' });
        }
      },
      'facture-groupee': () => {
        if (typeof window.genererFacturesPeriode === 'function') window.genererFacturesPeriode(selected.length > 0 ? selected : null);
        else if (typeof window.genererFacturesGroupees === 'function') window.genererFacturesGroupees(selected);
        else alert('Fonction Facture groupée absente');
      },
    };
    if (dispatch[type]) dispatch[type]();
  };

  // Phase 91.22 — helper drawer Documents : SAVE D'ABORD + capture le HTML après génération
   // pour que "Voir" puisse rouvrir sans re-déclencher le générateur (qui crashait au 2e clic).
  window.actionGenererLivraisonPour = function (type, livId) {
    if (!livId) return;
    const livs = (window.charger ? window.charger('livraisons') : []) || [];
    const l = livs.find(x => x && x.id === livId);
    const numLiv = l ? (l.numLiv || l.num_liv || livId) : livId;
    const baseDoc =
      type === 'facture' ? { type: 'facture', name: 'Facture ' + String(numLiv).replace(/^L-/, 'F-') }
      : type === 'bl' ? { type: 'bl', name: 'Bon de livraison ' + numLiv }
      : type === 'cmr' ? { type: 'cmr', name: 'Lettre de voiture ' + numLiv }
      : null;
    if (!baseDoc) return;
    // 1. SAVE métadonnées (toujours)
    try {
      if (typeof window.enregistrerDocumentLivraison === 'function') {
        window.enregistrerDocumentLivraison(livId, baseDoc);
      }
    } catch (e) { console.warn('[actionGenererLivraisonPour:save]', e); }
    // 2. REFRESH liste tout de suite
    try { if (typeof window.refreshDrawerDocuments === 'function') window.refreshDrawerDocuments(livId); } catch (e) {}
    // 3. GÉNÉRATEUR PDF (peut throw → noop, save reste)
    try {
      if (type === 'facture' && typeof window.genererFactureLivraison === 'function') window.genererFactureLivraison(livId);
      else if (type === 'bl' && (typeof window.genererBonsLivraison === 'function' || typeof window.genererBonLivraison === 'function')) (window.genererBonsLivraison || window.genererBonLivraison)(livId);
      else if (type === 'cmr' && (typeof window.genererLettreDeVoiture === 'function' || typeof window.genererLettreVoiture === 'function')) (window.genererLettreDeVoiture || window.genererLettreVoiture)(livId);
    } catch (e) { console.warn('[actionGenererLivraisonPour:generator]', e); }
    // 4. CAPTURE le HTML rendu dans #print-bon → save dans le doc (pour que Voir n'ait pas à régénérer).
    try {
      const zone = document.getElementById('print-bon');
      if (zone && zone.innerHTML && zone.innerHTML.trim()) {
        const htmlCapture = zone.innerHTML;
        if (typeof window.enregistrerDocumentLivraison === 'function') {
          window.enregistrerDocumentLivraison(livId, Object.assign({}, baseDoc, { html: htmlCapture }));
        }
      }
    } catch (e) { console.warn('[actionGenererLivraisonPour:capture]', e); }
  };

  // ============ Bulk Modifier button (Phase 32) + Supprimer (Phase 90) ============
  // Apparait quand >= 1 row checkbox cochee, avec compteur "(N)"
  function updateBulkModifyButton() {
    const btn = document.getElementById('liv-modify-btn');
    const countEl = document.getElementById('liv-modify-count');
    const checked = document.querySelectorAll('#tb-livraisons .bulk-liv-check:checked').length;
    if (btn && countEl) {
      if (checked > 0) { btn.style.display = ''; countEl.textContent = '(' + checked + ')'; }
      else { btn.style.display = 'none'; }
    }
    // Phase 90 — sibling trash button gauche du chip "Mai 2026"
    const delBtn = document.getElementById('liv-bulk-delete-btn');
    const delCount = document.getElementById('liv-bulk-delete-count');
    if (delBtn && delCount) {
      if (checked > 0) { delBtn.style.display = ''; delCount.textContent = '(' + checked + ')'; }
      else { delBtn.style.display = 'none'; }
    }
  }

  // Hook : listen to changes on bulk checkboxes + bulk-select-all
  function setupBulkModifyButton() {
    const tbody = document.getElementById('tb-livraisons');
    const checkAll = document.getElementById('bulk-select-all');
    if (!tbody) return;
    // Delegate change on tbody pour gerer les checkboxes ajoutees/retirees au re-render
    tbody.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('bulk-liv-check')) {
        updateBulkModifyButton();
      }
    });
    if (checkAll) checkAll.addEventListener('change', () => setTimeout(updateBulkModifyButton, 50));
    // Initial state
    updateBulkModifyButton();
  }

  // Bouton Modifier(N) :
  //  - 1 ligne selectionnee : ouvrir le modal d'edition livraison (modal-edit-livraison)
  //  - N lignes : bulk edit modal si existe, sinon info toast
  window.ouvrirBulkEditLivraisons = function () {
    const ids = Array.from(document.querySelectorAll('#tb-livraisons .bulk-liv-check:checked'))
      .map(c => c.dataset.livId)
      .filter(Boolean);
    if (!ids.length) return;
    if (ids.length === 1) {
      // Open modal d'edition direct (priorite legacy)
      if (typeof window.ouvrirEditLivraison === 'function') {
        window.ouvrirEditLivraison(ids[0]);
        return;
      }
      if (typeof window.ouvrirEditLivraisonAdmin === 'function') {
        window.ouvrirEditLivraisonAdmin(ids[0]);
        return;
      }
      // Fallback drawer
      if (typeof window.ouvrirDrawerLivraison === 'function') {
        window.ouvrirDrawerLivraison(ids[0]);
        return;
      }
    }
    // Bulk N > 1
    if (typeof window.bulkEditLivraisons === 'function') {
      window.bulkEditLivraisons(ids);
    } else if (typeof window.afficherToast === 'function') {
      window.afficherToast(ids.length + ' livraisons sélectionnées — utilisez les actions de masse', 'info');
    } else {
      alert(ids.length + ' livraisons sélectionnées.');
    }
  };

  // ============ Filtres toggle (Phase 25) ============
  window.toggleLivraisonsFilters = function () {
    const bar = document.querySelector('#page-livraisons > .filters.filters-livraisons');
    if (!bar) return;
    const btn = document.getElementById('liv-filters-toggle-btn');
    const isOpen = bar.classList.toggle('expanded');
    if (btn) btn.classList.toggle('active', isOpen);
  };

  // ============ Dropdowns Générer/Exporter (Phase 28) ============
  function setupDropdowns() {
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('.liv-dropdown-trigger');
      const inside = e.target.closest('.liv-dropdown-menu');
      // Close all open dropdowns
      const openMenus = document.querySelectorAll('.liv-dropdown-menu.open');
      if (trigger) {
        const wrap = trigger.parentElement;
        const menu = wrap && wrap.querySelector('.liv-dropdown-menu');
        if (menu) {
          const wasOpen = menu.classList.contains('open');
          // Close all
          openMenus.forEach(m => m.classList.remove('open'));
          // Toggle this one
          if (!wasOpen) menu.classList.add('open');
          e.stopPropagation();
        }
      } else if (!inside) {
        // Click outside : close all
        openMenus.forEach(m => m.classList.remove('open'));
      }
    });
  }

  function setupHook() {
    polishRows();
    wrapChangerVue();
    resetLivraisonsDateFilters();
    updateDateRangeChip();
    setupDropdowns();
    setupBulkModifyButton();
    // Update date range chip when filters change
    ['filtre-date-debut', 'filtre-date-fin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', updateDateRangeChip);
    });
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    const obs = new MutationObserver((muts) => {
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

// ============ BUG-005 fix : actionGenererLivraison silently fails ============
(function patchGenererWithErrorFeedback() {
  const _origAction = window.actionGenererLivraison;
  if (typeof _origAction !== 'function') return;
  window.actionGenererLivraison = function(type) {
    try {
      _origAction.call(window, type);
    } catch (e) {
      console.error('[BUG-005] actionGenererLivraison(' + type + ') threw:', e);
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('Erreur lors de la génération : ' + (e && e.message ? e.message : 'inconnue'), 'error');
      } else {
        alert('Erreur génération : ' + (e && e.message ? e.message : String(e)));
      }
      if (window.Sentry && window.Sentry.captureException) {
        try { window.Sentry.captureException(e); } catch (_) {}
      }
    }
  };
})();
