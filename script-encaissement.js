/**
 * MCA Logistics — Encaissement (PC)
 * Miroir cote revenus de Charges. Liste les livraisons facturees + leur
 * statutPaiement. Marquage rapide encaisse + KPI tresorerie.
 *
 * Source : public.livraisons (cle 'livraisons' localStorage).
 * Reutilise changerStatutPaiement(id, statut) deja defini dans script.js
 * pour pouvoir basculer encaisse / litige et persister.
 */
(function () {
  'use strict';

  function fmt$(n) {
    return (typeof formatEuros === 'function')
      ? formatEuros(n)
      : (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('fr-FR'); } catch (_) { return '—'; }
  }
  function escH(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

  // State filtre + pagination
  var state = {
    statut: 'a_encaisser',
    client: '',
    recherche: '',
    page: 1,
    pageSize: 50,
    selected: {} // id -> true (checkboxes pour relance batch)
  };

  function getServerMode() {
    try { return localStorage.getItem('mca_pagination_mode') === 'server'; } catch (_) { return false; }
  }

  function getLivraisons() {
    try { return JSON.parse(localStorage.getItem('livraisons') || '[]'); } catch (_) { return []; }
  }

  function annoter(l) {
    var ttc = parseFloat(l.prixTTC) || parseFloat(l.prix) || 0;
    var statut = l.statutPaiement || 'en-attente';
    var paye = statut === 'payé' || statut === 'paye' || statut === 'payee';
    var litige = statut === 'litige';
    var refDate = l.dateFacture || l.date;
    var retard = !paye && !litige && refDate &&
      (new Date(refDate) < new Date(Date.now() - 30 * 86400000));
    return { liv: l, ttc: ttc, statut: statut, paye: paye, litige: litige, retard: retard };
  }

  function render() {
    var container = document.getElementById('encaissement-content');
    if (!container) return;

    var allLivraisons = getLivraisons();
    var all = allLivraisons.map(annoter);
    var moisCle = new Date().toISOString().slice(0, 7);
    var totalAEncaisser = all.filter(a => !a.paye && !a.litige).reduce((s, a) => s + a.ttc, 0);
    var totalEncaisseMois = all.filter(a => a.paye && (a.liv.datePaiement || '').startsWith(moisCle)).reduce((s, a) => s + a.ttc, 0);
    var totalRetard = all.filter(a => a.retard).reduce((s, a) => s + a.ttc, 0);
    var totalLitige = all.filter(a => a.litige).reduce((s, a) => s + a.ttc, 0);
    var nbAEncaisser = all.filter(a => !a.paye && !a.litige).length;
    var nbRetard = all.filter(a => a.retard).length;
    var nbLitige = all.filter(a => a.litige).length;

    // DSO reel (calcul a la volee sur 90 derniers jours) — Sprint H3.4
    var dsoData = (typeof window.calculerDSO === 'function')
      ? window.calculerDSO(allLivraisons)
      : { dso: null, count: 0, byClient: {} };
    // Top 5 retard : clients dont DSO > 60j (mauvais payeurs)
    var clientsRetardCount = Object.keys(dsoData.byClient || {}).filter(function (c) {
      return dsoData.byClient[c] > 60;
    }).length;
    var clientsRetardTop = Object.keys(dsoData.byClient || {})
      .filter(function (c) { return dsoData.byClient[c] > 60; })
      .sort(function (a, b) { return dsoData.byClient[b] - dsoData.byClient[a]; })
      .slice(0, 5);

    // Filtrage
    var filtered = all;
    if (state.statut === 'a_encaisser') filtered = filtered.filter(a => !a.paye && !a.litige);
    else if (state.statut === 'encaisse') filtered = filtered.filter(a => a.paye);
    else if (state.statut === 'retard') filtered = filtered.filter(a => a.retard);
    else if (state.statut === 'litige') filtered = filtered.filter(a => a.litige);
    if (state.client) filtered = filtered.filter(a => (a.liv.client || '') === state.client);
    if (state.recherche) {
      var q = state.recherche.toLowerCase();
      filtered = filtered.filter(a => {
        var hay = ((a.liv.client || '') + ' ' + (a.liv.numLiv || '') + ' ' + (a.liv.zone || '')).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    }
    filtered.sort((a, b) => (b.liv.dateFacture || b.liv.date || '').localeCompare(a.liv.dateFacture || a.liv.date || ''));

    var clients = [...new Set(all.map(a => a.liv.client).filter(Boolean))].sort();

    var html = ''
      // KPI cards
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:24px">'
      +   '<div class="card" style="padding:18px;border-left:4px solid var(--accent)"><div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">⏳ À encaisser</div><div style="font-size:1.6rem;font-weight:700;color:var(--accent)">' + fmt$(totalAEncaisser) + '</div><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">' + nbAEncaisser + ' livraison' + (nbAEncaisser > 1 ? 's' : '') + '</div></div>'
      +   '<div class="card" style="padding:18px;border-left:4px solid var(--green)"><div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">✅ Encaissé ce mois</div><div style="font-size:1.6rem;font-weight:700;color:var(--green)">' + fmt$(totalEncaisseMois) + '</div><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">paiements reçus</div></div>'
      +   '<div class="card" style="padding:18px;border-left:4px solid var(--red);' + (totalRetard === 0 ? 'opacity:.5' : '') + '"><div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🔴 En retard (>30j)</div><div style="font-size:1.6rem;font-weight:700;color:var(--red)">' + fmt$(totalRetard) + '</div><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">' + nbRetard + ' facture' + (nbRetard > 1 ? 's' : '') + '</div></div>'
      +   '<div class="card" title="Days Sales Outstanding — délai moyen réel de paiement client sur les 90 derniers jours" style="padding:18px;border-left:4px solid var(--accent);' + (dsoData.dso === null ? 'opacity:.5' : '') + '"><div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">📊 DSO réel (90j)</div><div style="font-size:1.6rem;font-weight:700;color:var(--accent)">' + (dsoData.dso !== null ? dsoData.dso + ' j' : '—') + '</div><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">' + (dsoData.count > 0 ? dsoData.count + ' livraison' + (dsoData.count > 1 ? 's' : '') + ' payée' + (dsoData.count > 1 ? 's' : '') : 'aucune livraison payée') + '</div></div>'
      +   '<div class="card" title="' + escH(clientsRetardTop.join(', ') || 'Aucun client en retard chronique') + '" style="padding:18px;border-left:4px solid #f59e0b;' + (clientsRetardCount === 0 ? 'opacity:.5' : '') + '"><div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🐌 Top retard (DSO &gt; 60j)</div><div style="font-size:1.6rem;font-weight:700;color:#f59e0b">' + clientsRetardCount + '</div><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">' + (clientsRetardCount > 0 ? 'client' + (clientsRetardCount > 1 ? 's' : '') + ' lent' + (clientsRetardCount > 1 ? 's' : '') : 'tous à jour') + '</div></div>'
      +   (nbLitige > 0 ? '<div class="card" style="padding:18px;border-left:4px solid #f59e0b"><div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">⚠️ Litige</div><div style="font-size:1.6rem;font-weight:700;color:#f59e0b">' + fmt$(totalLitige) + '</div><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">' + nbLitige + ' facture' + (nbLitige > 1 ? 's' : '') + '</div></div>' : '')
      + '</div>'
      // Filtres
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center">'
      +   '<button class="enc-chip ' + (state.statut === 'a_encaisser' ? 'active' : '') + '" data-s="a_encaisser">⏳ À encaisser (' + nbAEncaisser + ')</button>'
      +   '<button class="enc-chip ' + (state.statut === 'retard' ? 'active' : '') + '" data-s="retard">🔴 Retard (' + nbRetard + ')</button>'
      +   '<button class="enc-chip ' + (state.statut === 'encaisse' ? 'active' : '') + '" data-s="encaisse">✅ Encaissé</button>'
      +   '<button class="enc-chip ' + (state.statut === 'litige' ? 'active' : '') + '" data-s="litige">⚠️ Litige</button>'
      +   '<button class="enc-chip ' + (state.statut === 'tous' ? 'active' : '') + '" data-s="tous">Tous</button>'
      +   '<input type="search" id="enc-recherche" placeholder="🔍 Rechercher (client, n°...)" value="' + escH(state.recherche) + '" style="margin-left:auto;min-width:240px;padding:8px 12px;background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;color:var(--text)" />'
      +   (clients.length > 1 ? '<select id="enc-client" style="padding:8px 12px;background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;color:var(--text)"><option value="">— Tous clients —</option>' + clients.map(c => '<option value="' + escH(c) + '"' + (c === state.client ? ' selected' : '') + '>' + escH(c) + '</option>').join('') + '</select>' : '')
      + '</div>'
      // Barre actions batch (relance en lot)
      + '<div id="enc-batch-bar" style="display:flex;gap:10px;align-items:center;margin-bottom:14px;padding:8px 12px;background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;flex-wrap:wrap">'
      +   '<span id="enc-batch-count" style="font-size:.85rem;color:var(--text-muted)">0 sélectionnée(s)</span>'
      +   '<button type="button" id="enc-batch-relance" class="btn-rapport" style="padding:6px 12px;font-size:.82rem" disabled>📄 Relancer en lot</button>'
      +   '<button type="button" id="enc-batch-clear" class="enc-chip" style="padding:5px 10px">Tout désélectionner</button>'
      + '</div>'
      // Table
      + '<style>'
      + '.enc-chip{padding:7px 13px;border-radius:18px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text-muted);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s}.enc-chip:hover{border-color:var(--accent);color:var(--text)}.enc-chip.active{background:var(--accent);color:#1a1208;border-color:var(--accent)}'
      + '.enc-table{width:100%;border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden}.enc-table th{background:var(--bg-dark);text-align:left;padding:12px;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border)}.enc-table td{padding:12px;border-bottom:1px solid var(--border);font-size:.88rem;vertical-align:middle}.enc-table tr:hover{background:rgba(255,255,255,.02)}.enc-table tr:last-child td{border-bottom:none}'
      + '.enc-mark-pay{background:rgba(46,204,113,.12);color:var(--green);border:1px solid rgba(46,204,113,.3);border-radius:6px;padding:5px 10px;font-size:.78rem;font-weight:700;cursor:pointer}.enc-mark-pay:hover{background:rgba(46,204,113,.22)}'
      + '.enc-status-paye{color:var(--green);font-weight:600}.enc-status-retard{color:var(--red);font-weight:600}.enc-status-litige{color:#f59e0b;font-weight:600}.enc-status-att{color:var(--text-muted)}'
      + '</style>';

    if (!filtered.length) {
      html += '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><div style="font-size:3rem;margin-bottom:10px">' + (state.statut === 'encaisse' ? '💵' : state.statut === 'retard' ? '🎉' : '📋') + '</div><div>' + (state.statut === 'retard' ? 'Aucune facture en retard' : 'Aucune facture trouvée') + '</div></div>';
    } else {
      // Pagination cote affichage : on slice apres filtre/sort.
      // Les KPI restent calcules sur 'all' (totaux globaux).
      var totalFilteredCount = filtered.length;
      var pageSize = Math.max(1, parseInt(state.pageSize, 10) || 50);
      var totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      var startIdx = (state.page - 1) * pageSize;
      var pageSlice = filtered.slice(startIdx, startIdx + pageSize);

      html += '<table class="enc-table">'
        + '<thead><tr>'
        +   '<th style="width:34px"><input type="checkbox" id="enc-check-all" title="Tout sélectionner" /></th>'
        +   '<th>Date facture</th><th>Client</th><th>N°</th><th style="text-align:right">Montant TTC</th><th>Statut</th><th>Date paiement</th><th></th>'
        + '</tr></thead><tbody>';
      pageSlice.forEach(a => {
        var statutLabel = a.paye ? '<span class="enc-status-paye">✅ Encaissé</span>'
          : a.litige ? '<span class="enc-status-litige">⚠️ Litige</span>'
          : a.retard ? '<span class="enc-status-retard">🔴 En retard</span>'
          : '<span class="enc-status-att">⏳ À encaisser</span>';
        var actionCell = !a.paye
          ? '<button class="enc-mark-pay" data-id="' + escH(a.liv.id) + '">💵 Marquer encaissé</button>'
          : '';
        // Checkbox seulement pour livraisons non payées et non en litige (relançables)
        var canRelance = !a.paye && !a.litige;
        var checked = state.selected[a.liv.id] ? ' checked' : '';
        var cbCell = canRelance
          ? '<input type="checkbox" class="enc-row-check" data-id="' + escH(a.liv.id) + '"' + checked + ' />'
          : '';
        html += '<tr>'
          + '<td>' + cbCell + '</td>'
          + '<td>' + fmtDate(a.liv.dateFacture || a.liv.date) + '</td>'
          + '<td><strong>' + escH(a.liv.client || '—') + '</strong></td>'
          + '<td>' + escH(a.liv.numLiv || '—') + '</td>'
          + '<td style="text-align:right;font-weight:700">' + fmt$(a.ttc) + '</td>'
          + '<td>' + statutLabel + '</td>'
          + '<td>' + (a.liv.datePaiement ? fmtDate(a.liv.datePaiement) : '—') + '</td>'
          + '<td>' + actionCell + '</td>'
          + '</tr>';
      });
      var totalFiltered = filtered.reduce((s, a) => s + a.ttc, 0);
      html += '<tr style="background:var(--bg-dark);font-weight:700">'
        + '<td></td><td colspan="3">TOTAL (' + filtered.length + ')</td>'
        + '<td style="text-align:right;color:var(--accent);font-size:1rem">' + fmt$(totalFiltered) + '</td>'
        + '<td colspan="3"></td>'
        + '</tr>';
      html += '</tbody></table>';

      // Barre de pagination
      var endIdx = Math.min(startIdx + pageSize, totalFilteredCount);
      var pageOpts = [25, 50, 100, 250].map(function (n) {
        return '<option value="' + n + '"' + (n === pageSize ? ' selected' : '') + '>' + n + ' / page</option>';
      }).join('');
      html += '<div class="enc-pagination" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;padding:10px 14px;background:var(--card);border-radius:10px;flex-wrap:wrap">'
        + '<div style="font-size:.84rem;color:var(--text-muted)">'
        +   'Affichage <strong>' + (startIdx + 1) + '–' + endIdx + '</strong> sur <strong>' + totalFilteredCount + '</strong>'
        +   ' · Page <strong>' + state.page + '</strong> / ' + totalPages
        + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center">'
        +   '<button type="button" class="enc-page-btn" data-go="first"' + (state.page <= 1 ? ' disabled' : '') + ' style="padding:6px 10px;border-radius:6px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text);cursor:pointer">«</button>'
        +   '<button type="button" class="enc-page-btn" data-go="prev"' + (state.page <= 1 ? ' disabled' : '') + ' style="padding:6px 10px;border-radius:6px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text);cursor:pointer">‹</button>'
        +   '<span style="font-size:.85rem;color:var(--text);padding:0 6px">' + state.page + ' / ' + totalPages + '</span>'
        +   '<button type="button" class="enc-page-btn" data-go="next"' + (state.page >= totalPages ? ' disabled' : '') + ' style="padding:6px 10px;border-radius:6px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text);cursor:pointer">›</button>'
        +   '<button type="button" class="enc-page-btn" data-go="last"' + (state.page >= totalPages ? ' disabled' : '') + ' style="padding:6px 10px;border-radius:6px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text);cursor:pointer">»</button>'
        +   '<select id="enc-page-size" style="padding:6px 8px;border-radius:6px;background:var(--bg-dark);border:1px solid var(--border);color:var(--text);margin-left:6px">' + pageOpts + '</select>'
        + '</div>'
        + '</div>';
    }

    container.innerHTML = html;
    wireEvents(container);
  }

  function wireEvents(container) {
    container.querySelectorAll('.enc-chip').forEach(b => {
      b.addEventListener('click', () => { state.statut = b.dataset.s; state.page = 1; render(); });
    });
    var clientSel = container.querySelector('#enc-client');
    if (clientSel) clientSel.addEventListener('change', e => { state.client = e.target.value; state.page = 1; render(); });
    var rech = container.querySelector('#enc-recherche');
    if (rech) {
      var t;
      rech.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { state.recherche = e.target.value; state.page = 1; render(); }, 300);
      });
      // Garde focus
      if (state.recherche) {
        rech.focus();
        rech.setSelectionRange(rech.value.length, rech.value.length);
      }
    }
    // Pagination
    container.querySelectorAll('.enc-page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var act = btn.dataset.go;
        var allCount = (function () {
          // recompute total filtered to derive last-page index
          var arr = getLivraisons().map(annoter);
          var f = arr;
          if (state.statut === 'a_encaisser') f = f.filter(a => !a.paye && !a.litige);
          else if (state.statut === 'encaisse') f = f.filter(a => a.paye);
          else if (state.statut === 'retard') f = f.filter(a => a.retard);
          else if (state.statut === 'litige') f = f.filter(a => a.litige);
          if (state.client) f = f.filter(a => (a.liv.client || '') === state.client);
          if (state.recherche) {
            var q = state.recherche.toLowerCase();
            f = f.filter(a => {
              var hay = ((a.liv.client || '') + ' ' + (a.liv.numLiv || '') + ' ' + (a.liv.zone || '')).toLowerCase();
              return hay.indexOf(q) >= 0;
            });
          }
          return f.length;
        })();
        var totalPages = Math.max(1, Math.ceil(allCount / state.pageSize));
        if (act === 'first') state.page = 1;
        else if (act === 'prev') state.page = Math.max(1, state.page - 1);
        else if (act === 'next') state.page = Math.min(totalPages, state.page + 1);
        else if (act === 'last') state.page = totalPages;
        render();
      });
    });
    var sizeSel = container.querySelector('#enc-page-size');
    if (sizeSel) sizeSel.addEventListener('change', function (e) {
      state.pageSize = parseInt(e.target.value, 10) || 50;
      state.page = 1;
      render();
    });
    // Checkboxes batch
    function refreshBatchUi() {
      var ids = Object.keys(state.selected).filter(function (k) { return state.selected[k]; });
      var c = container.querySelector('#enc-batch-count');
      var btn = container.querySelector('#enc-batch-relance');
      if (c) c.textContent = ids.length + ' sélectionnée' + (ids.length > 1 ? 's' : '');
      if (btn) btn.disabled = ids.length === 0;
    }
    var checkAll = container.querySelector('#enc-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', function (e) {
        container.querySelectorAll('.enc-row-check').forEach(function (cb) {
          cb.checked = e.target.checked;
          state.selected[cb.dataset.id] = e.target.checked;
        });
        refreshBatchUi();
      });
    }
    container.querySelectorAll('.enc-row-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.selected[cb.dataset.id] = cb.checked;
        refreshBatchUi();
      });
    });
    var batchClear = container.querySelector('#enc-batch-clear');
    if (batchClear) batchClear.addEventListener('click', function () {
      state.selected = {};
      render();
    });
    var batchRelance = container.querySelector('#enc-batch-relance');
    if (batchRelance) batchRelance.addEventListener('click', function () {
      relancerEnLot();
    });
    refreshBatchUi();

    container.querySelectorAll('.enc-mark-pay').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        var id = b.dataset.id;
        if (typeof changerStatutPaiement === 'function') {
          // Reuse PC : marque payé + persiste
          changerStatutPaiement(id, 'payé', null);
        } else {
          // Fallback inline si fonction absente
          try {
            var arr = JSON.parse(localStorage.getItem('livraisons') || '[]');
            var idx = arr.findIndex(x => x.id === id);
            if (idx < 0) return;
            arr[idx].statutPaiement = 'payé';
            arr[idx].datePaiement = window.todayLocalISO();
            localStorage.setItem('livraisons', JSON.stringify(arr));
          } catch (_) {}
        }
        if (typeof afficherToast === 'function') afficherToast('💵 Encaissement enregistré');
        render();
      });
    });
  }

  /**
   * Relance en lot : génère un PDF combiné (1 lettre par livraison sélectionnée,
   * separée par page-break), incrémente nb_relances + derniereRelance sur
   * chaque livraison. Réutilise le template de genererLettreRelance via une
   * version inline simplifiée pour pouvoir concaténer.
   */
  function relancerEnLot() {
    var ids = Object.keys(state.selected).filter(function (k) { return state.selected[k]; });
    if (!ids.length) return;
    var livs = getLivraisons();
    var params = (typeof getEntrepriseExportParams === 'function') ? getEntrepriseExportParams() : { nom: 'MCA Logistics' };
    var dateExp = (typeof formatDateExport === 'function') ? formatDateExport(new Date()) : new Date().toLocaleDateString('fr-FR');
    var templates = (typeof chargerTemplatesRelance === 'function') ? chargerTemplatesRelance() : null;
    var lettres = [];
    var idsTraites = [];

    ids.forEach(function (id) {
      var liv = livs.find(function (l) { return l.id === id; });
      if (!liv) return;
      var dateBase = liv.dateFacture || liv.date;
      var joursRetard = dateBase ? Math.max(0, Math.floor((new Date() - new Date(dateBase)) / 86400000)) : 0;
      var niveau = joursRetard > 30 ? 3 : joursRetard > 15 ? 2 : 1;
      var ttc = parseFloat(liv.prixTTC) || parseFloat(liv.prix) || 0;
      var montant = fmt$(ttc);
      var couleur = niveau === 3 ? '#e74c3c' : niveau === 2 ? '#f39c12' : '#2ecc71';
      var titre = niveau === 3 ? 'DERNIER AVIS AVANT CONTENTIEUX' : niveau === 2 ? 'MISE EN DEMEURE' : 'RELANCE AMIABLE';
      var corpsTpl = templates ? templates[niveau] : 'La livraison {numLiv} du {dateLivraison} d\'un montant de {montant} reste impayée ({joursRetard} jours).';
      var corps = (typeof construireTexteRelancePersonnalise === 'function')
        ? construireTexteRelancePersonnalise(corpsTpl, liv, params, joursRetard, montant).replace(/\n/g, '<br><br>')
        : String(corpsTpl).replace(/\{numLiv\}/g, liv.numLiv || '').replace(/\{dateLivraison\}/g, fmtDate(liv.date)).replace(/\{montant\}/g, montant).replace(/\{joursRetard\}/g, String(joursRetard));

      lettres.push(
        '<div style="page-break-after:always;font-family:Segoe UI,Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;color:#1a1d27">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:24px"><div><div style="font-size:1.2rem;font-weight:800;color:#f5a623">' + escH(params.nom || 'MCA Logistics') + '</div>' +
            (params.adresse ? '<div style="font-size:.8rem;color:#6b7280">' + escH(params.adresse) + '</div>' : '') +
            (params.siret ? '<div style="font-size:.75rem;color:#9ca3af">SIRET : ' + escH(params.siret) + '</div>' : '') +
          '</div><div style="font-size:.82rem;color:#9ca3af">' + escH(dateExp) + '</div></div>' +
          '<div style="text-align:center;margin:20px 0;padding:10px;background:' + couleur + '15;border:2px solid ' + couleur + ';border-radius:10px;font-size:1rem;font-weight:800;color:' + couleur + ';letter-spacing:2px">' + titre + '</div>' +
          '<div style="margin-bottom:16px"><div style="font-size:.82rem;color:#6b7280">Destinataire :</div><div style="font-size:1rem;font-weight:700">' + escH(liv.client || '—') + '</div></div>' +
          '<div style="font-size:.85rem;line-height:1.7;margin-bottom:20px"><p>Madame, Monsieur,</p><p>' + corps + '</p><p>Veuillez agréer nos salutations distinguées.</p></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:12px;background:#f8f9fc;border-radius:8px">' +
            '<div><div style="font-size:.7rem;color:#9ca3af;text-transform:uppercase">Référence</div><div style="font-weight:700">' + escH(liv.numLiv || '—') + '</div></div>' +
            '<div><div style="font-size:.7rem;color:#9ca3af;text-transform:uppercase">Montant dû</div><div style="font-weight:700;color:' + couleur + '">' + montant + '</div></div>' +
            '<div><div style="font-size:.7rem;color:#9ca3af;text-transform:uppercase">Date livraison</div><div style="font-weight:700">' + fmtDate(liv.date) + '</div></div>' +
            '<div><div style="font-size:.7rem;color:#9ca3af;text-transform:uppercase">Retard</div><div style="font-weight:700">' + joursRetard + ' jours</div></div>' +
          '</div></div>'
      );
      // Increment nb_relances + derniere relance
      liv.nb_relances = (parseInt(liv.nb_relances, 10) || 0) + 1;
      liv.derniereRelance = new Date().toISOString();
      liv.niveauRelance = niveau;
      idsTraites.push(id);
    });

    if (!lettres.length) {
      if (typeof afficherToast === 'function') afficherToast('⚠️ Aucune livraison relançable');
      return;
    }

    // Persist
    try { localStorage.setItem('livraisons', JSON.stringify(livs)); } catch (_) {}

    // Pousser dans relances_log si helpers Supabase / sauvegarder dispo
    if (typeof sauvegarder === 'function' && typeof charger === 'function') {
      try {
        var log = charger('relances_log') || [];
        idsTraites.forEach(function (id) {
          log.push({ id: 'rl_' + Date.now() + '_' + id.slice(-4), livraisonId: id, date: new Date().toISOString(), source: 'batch_pc' });
        });
        sauvegarder('relances_log', log);
      } catch (_) {}
    }

    // Affiche toutes les lettres dans une fenêtre d'impression
    var html = lettres.join('');
    if (typeof ouvrirFenetreImpression === 'function') {
      ouvrirFenetreImpression('Relances en lot (' + lettres.length + ')', html, 'width=800,height=900');
    } else {
      var w = window.open('', '_blank', 'width=800,height=900');
      if (w) { w.document.write('<html><head><title>Relances en lot</title></head><body>' + html + '</body></html>'); w.document.close(); }
    }
    if (typeof afficherToast === 'function') afficherToast('📄 ' + lettres.length + ' lettre(s) de relance générée(s)');
    state.selected = {};
    render();
  }

  /* WRAPPER encaissement — Hook naviguerVers : déclencher render() quand
     l'utilisateur ouvre 'encaissement'. Chain pattern : __encHook idempotent,
     capture orig avant override. H2.1. */
  function hookNav() {
    if (typeof window.naviguerVers !== 'function' || window.naviguerVers.__encHook) return;
    var orig = window.naviguerVers;
    var w = function (page) {
      var r = orig.apply(this, arguments);
      if (page === 'encaissement') setTimeout(render, 50);
      return r;
    };
    w.__encHook = true;
    window.naviguerVers = w;
  }

  function init() {
    hookNav();
    // Si on arrive sur la page directement
    setTimeout(() => {
      var page = document.getElementById('page-encaissement');
      if (page && page.classList.contains('active')) render();
    }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 100);

  window.encaissement = { render: render, relancerEnLot: relancerEnLot };

  // #94 audit Chrome : Encaissement n'avait NI bouton CSV NI Rapport. Ajoute
  // les 2 exports en reutilisant la meme construction de rows que render().
  function buildExportRows() {
    var allLivraisons = getLivraisons();
    var rows = allLivraisons.map(annoter).map(function (a) {
      var l = a.liv || {};
      return {
        date: l.date || '',
        date_facture: l.dateFacture || '',
        num_liv: l.numLiv || '',
        client: l.client || '',
        ttc: a.ttc || 0,
        statut: a.litige ? 'litige' : (a.paye ? 'encaisse' : (a.retard ? 'retard' : 'a_encaisser')),
        date_paiement: l.datePaiement || '',
        mode_paiement: l.modePaiement || '',
        notes: l.notes || ''
      };
    });
    rows.sort(function (a, b) { return (b.date_facture || b.date).localeCompare(a.date_facture || a.date); });
    return rows;
  }

  window.exporterEncaissementCSV = function () {
    var rows = buildExportRows();
    var headers = ['Date livraison', 'Date facture', 'N° livraison', 'Client', 'Montant TTC', 'Statut', 'Date paiement', 'Mode paiement', 'Notes'];
    var csv = headers.join(';') + '\n';
    rows.forEach(function (r) {
      csv += [
        r.date, r.date_facture, r.num_liv,
        '"' + String(r.client).replace(/"/g, '""') + '"',
        Number(r.ttc).toFixed(2).replace('.', ','),
        r.statut, r.date_paiement, r.mode_paiement,
        '"' + String(r.notes).replace(/"/g, '""') + '"'
      ].join(';') + '\n';
    });
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'encaissement_' + window.todayLocalISO() + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (_) {} }, 1000);
    if (typeof window.afficherToast === 'function') window.afficherToast('📥 Export CSV téléchargé');
    if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit('Export Encaissement CSV', rows.length + ' ligne(s)');
  };

  window.exporterEncaissementRapport = function () {
    var rows = buildExportRows();
    var params = (typeof window.getParametresEntreprise === 'function') ? window.getParametresEntreprise() : {};
    var dateExp = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var totalTtc = rows.reduce(function (s, r) { return s + Number(r.ttc || 0); }, 0);
    var nbA = rows.filter(function (r) { return r.statut === 'a_encaisser'; }).length;
    var nbR = rows.filter(function (r) { return r.statut === 'retard'; }).length;
    var nbE = rows.filter(function (r) { return r.statut === 'encaisse'; }).length;
    var entete = (typeof window.construireEnteteExport === 'function')
      ? window.construireEnteteExport(params, 'État des encaissements', null, dateExp, rows.length + ' livraison(s) · ' + nbA + ' à encaisser · ' + nbR + ' en retard · ' + nbE + ' encaissée(s)')
      : '<h1 style="color:#f5a623">État des encaissements — ' + dateExp + '</h1>';
    var tableRows = rows.map(function (r) {
      var color = r.statut === 'encaisse' ? '#06d6a0' : (r.statut === 'retard' ? '#e63946' : '#f5a623');
      return '<tr><td>' + r.date + '</td><td>' + r.num_liv + '</td><td>' + (r.client || '').replace(/[<>]/g, '') + '</td>'
        + '<td style="text-align:right">' + Number(r.ttc).toFixed(2).replace('.', ',') + ' €</td>'
        + '<td style="color:' + color + ';font-weight:700">' + r.statut + '</td>'
        + '<td>' + r.date_paiement + '</td><td>' + r.mode_paiement + '</td></tr>';
    }).join('');
    var html = entete
      + '<table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:.84rem"><thead><tr style="background:#f5a62333"><th style="padding:8px;text-align:left;border-bottom:2px solid #f5a623">Date</th><th style="padding:8px;text-align:left;border-bottom:2px solid #f5a623">N°</th><th style="padding:8px;text-align:left;border-bottom:2px solid #f5a623">Client</th><th style="padding:8px;text-align:right;border-bottom:2px solid #f5a623">TTC</th><th style="padding:8px;text-align:left;border-bottom:2px solid #f5a623">Statut</th><th style="padding:8px;text-align:left;border-bottom:2px solid #f5a623">Date payé</th><th style="padding:8px;text-align:left;border-bottom:2px solid #f5a623">Mode</th></tr></thead><tbody>' + tableRows + '</tbody>'
      + '<tfoot><tr style="background:#f5a62333;font-weight:700"><td colspan="3" style="padding:8px;border-top:2px solid #f5a623">TOTAL</td><td style="padding:8px;text-align:right;border-top:2px solid #f5a623">' + totalTtc.toFixed(2).replace('.', ',') + ' €</td><td colspan="3" style="border-top:2px solid #f5a623"></td></tr></tfoot></table>';
    if (typeof window.ouvrirFenetreImpression === 'function') {
      window.ouvrirFenetreImpression('Encaissement — ' + (params.nom || 'MCA Logistics'), html, 'width=1200,height=820');
      if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit('Rapport Encaissement', rows.length + ' ligne(s)');
    }
  };
})();
