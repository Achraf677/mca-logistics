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
    pageSize: 50
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

    var all = getLivraisons().map(annoter);
    var moisCle = new Date().toISOString().slice(0, 7);
    var totalAEncaisser = all.filter(a => !a.paye && !a.litige).reduce((s, a) => s + a.ttc, 0);
    var totalEncaisseMois = all.filter(a => a.paye && (a.liv.datePaiement || '').startsWith(moisCle)).reduce((s, a) => s + a.ttc, 0);
    var totalRetard = all.filter(a => a.retard).reduce((s, a) => s + a.ttc, 0);
    var totalLitige = all.filter(a => a.litige).reduce((s, a) => s + a.ttc, 0);
    var nbAEncaisser = all.filter(a => !a.paye && !a.litige).length;
    var nbRetard = all.filter(a => a.retard).length;
    var nbLitige = all.filter(a => a.litige).length;

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
      html += '<table class="enc-table">'
        + '<thead><tr>'
        +   '<th>Date facture</th><th>Client</th><th>N°</th><th style="text-align:right">Montant TTC</th><th>Statut</th><th>Date paiement</th><th></th>'
        + '</tr></thead><tbody>';
      filtered.forEach(a => {
        var statutLabel = a.paye ? '<span class="enc-status-paye">✅ Encaissé</span>'
          : a.litige ? '<span class="enc-status-litige">⚠️ Litige</span>'
          : a.retard ? '<span class="enc-status-retard">🔴 En retard</span>'
          : '<span class="enc-status-att">⏳ À encaisser</span>';
        var actionCell = !a.paye
          ? '<button class="enc-mark-pay" data-id="' + escH(a.liv.id) + '">💵 Marquer encaissé</button>'
          : '';
        html += '<tr>'
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
        + '<td colspan="3">TOTAL (' + filtered.length + ')</td>'
        + '<td style="text-align:right;color:var(--accent);font-size:1rem">' + fmt$(totalFiltered) + '</td>'
        + '<td colspan="3"></td>'
        + '</tr>';
      html += '</tbody></table>';
    }

    container.innerHTML = html;
    wireEvents(container);
  }

  function wireEvents(container) {
    container.querySelectorAll('.enc-chip').forEach(b => {
      b.addEventListener('click', () => { state.statut = b.dataset.s; render(); });
    });
    var clientSel = container.querySelector('#enc-client');
    if (clientSel) clientSel.addEventListener('change', e => { state.client = e.target.value; render(); });
    var rech = container.querySelector('#enc-recherche');
    if (rech) {
      var t;
      rech.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { state.recherche = e.target.value; render(); }, 300);
      });
      // Garde focus
      if (state.recherche) {
        rech.focus();
        rech.setSelectionRange(rech.value.length, rech.value.length);
      }
    }
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
            arr[idx].datePaiement = new Date().toISOString().slice(0, 10);
            localStorage.setItem('livraisons', JSON.stringify(arr));
          } catch (_) {}
        }
        if (typeof afficherToast === 'function') afficherToast('💵 Encaissement enregistré');
        render();
      });
    });
  }

  // Hook navigation : PC utilise window.naviguerVers
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

  window.encaissement = { render: render };
})();
