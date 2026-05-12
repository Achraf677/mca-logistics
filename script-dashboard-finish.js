/* ==========================================================================
   MCA Logistics — Dashboard finish (Phase 17)

   Construit dynamiquement les 2 derniers blocs du mockup :
   - status-card v2 (remplace le Chart.js donut)
   - dashboard-grid-2 (Dernières livraisons + Alertes details)

   Lit les données depuis localStorage. Re-render au passage sur le dashboard
   ou quand le data change.
   ========================================================================== */

(function () {
  'use strict';

  function readArr(key) {
    if (typeof window.charger === 'function') {
      try { return window.charger(key) || []; } catch (_) {}
    }
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function getStatut(l) {
    return String(l.statut || l.status || 'en-attente').toLowerCase();
  }

  function isRetard(l) {
    var s = getStatut(l);
    if (s === 'livre' || s === 'livré' || s === 'livree') return false;
    var d = l.dateLivraison || l.dateLiv || l.date;
    if (!d) return false;
    try {
      var t = new Date(d).getTime();
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return t < today.getTime();
    } catch (_) { return false; }
  }

  function timeAgo(date) {
    if (!date) return '—';
    try {
      var diff = (Date.now() - new Date(date).getTime()) / 1000;
      if (diff < 60) return 'à l\'instant';
      if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + ' min';
      if (diff < 86400) return 'il y a ' + Math.floor(diff / 3600) + ' h';
      var d = Math.floor(diff / 86400);
      return 'il y a ' + d + ' jour' + (d > 1 ? 's' : '');
    } catch (_) { return '—'; }
  }

  // ============ STATUS CARD V2 ============
  function buildStatusCard() {
    var livs = readArr('livraisons');
    var total = livs.length;
    var counts = { livre: 0, encours: 0, attente: 0, retard: 0 };
    var lastLivre = null;

    livs.forEach(function (l) {
      if (isRetard(l)) { counts.retard += 1; return; }
      var s = getStatut(l);
      if (s === 'livre' || s === 'livré' || s === 'livree') {
        counts.livre += 1;
        if (!lastLivre || new Date(l.date) > new Date(lastLivre.date)) lastLivre = l;
      } else if (s === 'en-cours' || s === 'en cours') counts.encours += 1;
      else counts.attente += 1;
    });

    var pct = function (n) { return total > 0 ? (n / total * 100) : 0; };
    var fmt = function (v, dec) { return v.toFixed(dec || 1).replace('.', ','); };
    var pctLivre = pct(counts.livre);

    var hero = '';
    if (total > 0) {
      var numStr = fmt(pctLivre, 1);
      var parts = numStr.split(',');
      hero = ''
        + '<div class="status-hero">'
        +   '<div class="sh-eyebrow">Taux de réussite</div>'
        +   '<div class="sh-val">'
        +     '<span class="sh-num">' + parts[0] + '<span class="sh-decimal">,' + (parts[1] || '0') + '</span></span>'
        +     '<span class="sh-pct">%</span>'
        +   '</div>'
        +   '<div class="sh-meta">' + counts.livre + ' livrées sur ' + total + '</div>'
        + '</div>';
    } else {
      hero = ''
        + '<div class="status-hero">'
        +   '<div class="sh-eyebrow">Taux de réussite</div>'
        +   '<div class="sh-val"><span class="sh-num">—</span></div>'
        +   '<div class="sh-meta">Aucune livraison enregistrée</div>'
        + '</div>';
    }

    var bars = ''
      + '<div class="status-bars">'
      +   barRow('ok',      'Livrées',    counts.livre,   pct(counts.livre))
      +   barRow('warn',    'En cours',   counts.encours, pct(counts.encours))
      +   barRow('attente', 'En attente', counts.attente, pct(counts.attente))
      +   barRow('alert',   'Retard',     counts.retard,  pct(counts.retard))
      + '</div>';

    var foot = ''
      + '<div class="status-foot">'
      +   '<div class="sf-pulse"></div>'
      +   '<span>Dernière livraison <strong>' + escHtml(lastLivre ? timeAgo(lastLivre.date) : 'aucune') + '</strong></span>'
      +   '<a href="#" class="sf-link" onclick="naviguerVers(\'livraisons\');return false">Voir →</a>'
      + '</div>';

    return ''
      + '<div class="card-header">'
      +   '<h3>Statuts livraisons</h3>'
      +   '<span class="status-meta">' + total + ' livraison' + (total > 1 ? 's' : '') + '</span>'
      + '</div>'
      + '<div class="status-body">'
      +   hero
      +   bars
      +   foot
      + '</div>';
  }

  function barRow(cls, label, count, pctVal) {
    return ''
      + '<div class="sb-row sb-' + cls + '">'
      +   '<div class="sb-head">'
      +     '<div class="sb-label"><span class="sb-dot"></span><span>' + escHtml(label) + '</span></div>'
      +     '<div class="sb-val">' + count + ' <span class="sb-pct">' + pctVal.toFixed(1).replace('.', ',') + '%</span></div>'
      +   '</div>'
      +   '<div class="sb-track"><div class="sb-fill" style="--w:' + pctVal.toFixed(1) + '%"></div></div>'
      + '</div>';
  }

  // ============ DERNIÈRES LIVRAISONS ============
  function statusBadge(l) {
    if (isRetard(l)) return '<span class="badge late">Retard</span>';
    var s = getStatut(l);
    if (s === 'livre' || s === 'livré' || s === 'livree') return '<span class="badge ok">Livrée</span>';
    if (s === 'en-cours' || s === 'en cours') return '<span class="badge pending">En cours</span>';
    return '<span class="badge attente">En attente</span>';
  }

  function buildLastDeliveries() {
    var livs = readArr('livraisons')
      .slice()
      .sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); })
      .slice(0, 5);

    if (!livs.length) {
      return ''
        + '<div class="card-header">'
        +   '<h3>Dernières livraisons</h3>'
        + '</div>'
        + '<div style="padding:32px 20px;text-align:center;color:var(--ds-text-muted, var(--text-muted));font-size:13px">Aucune livraison enregistrée</div>';
    }

    var rows = livs.map(function (l) {
      var trajet = (l.depart || '—') + ' → ' + (l.arrivee || '—');
      return '<tr>'
        + '<td class="mono">' + escHtml(l.numLiv || l.numliv || '—') + '</td>'
        + '<td>' + escHtml(l.client || '—') + '</td>'
        + '<td>' + escHtml(l.vehImmat || l.vehimmat || '—') + '</td>'
        + '<td style="color:var(--ds-text-muted, var(--text-muted));font-size:12px">' + escHtml(trajet) + '</td>'
        + '<td>' + statusBadge(l) + '</td>'
        + '</tr>';
    }).join('');

    return ''
      + '<div class="card-header">'
      +   '<h3>Dernières livraisons</h3>'
      +   '<button class="btn-sm" onclick="naviguerVers(\'livraisons\');return false">Voir tout</button>'
      + '</div>'
      + '<div class="table-wrapper">'
      +   '<table>'
      +     '<thead><tr><th>N°</th><th>Client</th><th>Véhicule</th><th>Trajet</th><th>Statut</th></tr></thead>'
      +     '<tbody>' + rows + '</tbody>'
      +   '</table>'
      + '</div>';
  }

  // ============ ALERTES DETAILS ============
  function alertDotClass(a) {
    var n = (a.niveau || '').toLowerCase();
    if (n === 'critical' || n === 'haute') return 'dang';
    if (n === 'warn' || n === 'moyenne')    return 'warn';
    if (n === 'info')                       return 'info';
    return 'ok';
  }

  function buildAlertsDetails() {
    var alertes = readArr('alertes_admin')
      .filter(function (a) { return !a.lu && !a.traitee && !a.ignoree; })
      .sort(function (a, b) {
        var rank = function (n) { return n === 'critical' || n === 'haute' ? 0 : n === 'warn' || n === 'moyenne' ? 1 : 2; };
        return rank(a.niveau) - rank(b.niveau);
      });

    var count = alertes.length;
    var countBadge = count > 0
      ? '<span class="alert-count-badge">' + count + ' active' + (count > 1 ? 's' : '') + '</span>'
      : '';

    var items = '';
    if (!alertes.length) {
      items = '<div style="padding:32px 20px;text-align:center;color:var(--ds-text-muted, var(--text-muted));font-size:13px">'
        + 'Aucune alerte active'
        + '</div>';
    } else {
      items = alertes.slice(0, 5).map(function (a, i) {
        var msg = escHtml(a.message || a.titre || 'Alerte');
        return ''
          + '<details class="alert-item"' + (i === 0 ? ' open' : '') + '>'
          +   '<summary>'
          +     '<span class="alert-dot ' + alertDotClass(a) + '"></span>'
          +     '<span class="alert-text">' + msg + '</span>'
          +     '<svg class="alert-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
          +   '</summary>'
          +   '<div class="alert-body">'
          +     escHtml(a.detail || a.description || a.message || 'Aucun détail supplémentaire.')
          +     '<div class="alert-actions">'
          +       '<button class="btn-sm" onclick="naviguerVers(\'alertes\');return false">Voir dans Alertes</button>'
          +     '</div>'
          +   '</div>'
          + '</details>';
      }).join('');
    }

    return ''
      + '<div class="card-header">'
      +   '<h3>Alertes</h3>'
      +   countBadge
      + '</div>'
      + '<div class="dashboard-alerts-list">' + items + '</div>';
  }

  // ============ SUB-SCORES SANTÉ (H24) ============
  function buildSubScores() {
    var livs = readArr('livraisons');
    var vehicules = readArr('vehicules');
    var salaries = readArr('salaries');
    var alertes = readArr('alertes_admin').filter(function (a) { return !a.traitee && !a.ignoree; });
    var now = Date.now();

    var finance = '—';
    if (livs.length > 0) {
      var payees = livs.filter(function (l) {
        var s = getStatut(l);
        return s === 'livre' || s === 'livré' || s === 'livree' || s === 'payé' || s === 'paye';
      }).length;
      finance = Math.round(40 + (payees / livs.length) * 60);
    }

    var flotte = '—';
    if (vehicules.length > 0) {
      var ctOk = vehicules.filter(function (v) {
        var ctDate = v.date_prochain_ct || v.prochainCT || v.prochain_ct;
        if (!ctDate) return true;
        return (new Date(ctDate) - now) / 86400000 > 30;
      }).length;
      flotte = Math.round(20 + (ctOk / vehicules.length) * 80);
    }

    var rh = '—';
    if (salaries.length > 0) {
      var actifs = salaries.filter(function (s) {
        return !s.dateFinContrat || new Date(s.dateFinContrat) > new Date();
      }).length;
      rh = Math.round(50 + (actifs / salaries.length) * 50);
    }

    var critiques = alertes.filter(function (a) {
      var n = (a.niveau || '').toLowerCase();
      return n === 'critical' || n === 'haute';
    }).length;
    var conformite = alertes.length > 0 ? Math.round(100 - (critiques / alertes.length) * 40) : 95;

    var fill = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    fill('ss-finance', finance);
    fill('ss-flotte', flotte);
    fill('ss-rh', rh);
    fill('ss-conformite', conformite);
  }

  // ============ ORCHESTRATION ============
  function ensureStructure() {
    // Replace dash-statuts-chart container with new .status-card-v2 structure
    var dashCharts = document.querySelector('#page-dashboard .dash-charts');
    if (!dashCharts) return false;
    var statutsCard = dashCharts.querySelector('.dash-chart-statuts');
    if (statutsCard && !statutsCard.classList.contains('status-card-v2')) {
      statutsCard.classList.add('status-card-v2');
      statutsCard.classList.remove('dash-chart-card', 'dash-chart-statuts', 'card');
      statutsCard.removeAttribute('style');
      statutsCard.id = 'dashboard-statuts-card';
    }

    // Add .dashboard-grid-2 after dash-charts if not present
    var grid2 = document.getElementById('dashboard-grid-2');
    if (!grid2) {
      grid2 = document.createElement('div');
      grid2.id = 'dashboard-grid-2';
      grid2.className = 'dashboard-grid-2';
      grid2.innerHTML = ''
        + '<div class="card last-deliveries-card" id="dashboard-last-deliveries"></div>'
        + '<div class="card dashboard-alerts-card" id="dashboard-alerts-details"></div>';
      // Insert after the .dash-charts block
      if (dashCharts.nextElementSibling) {
        dashCharts.parentNode.insertBefore(grid2, dashCharts.nextElementSibling);
      } else {
        dashCharts.parentNode.appendChild(grid2);
      }
    }
    return true;
  }

  function renderAll() {
    if (!ensureStructure()) return;
    var statuts = document.getElementById('dashboard-statuts-card');
    if (statuts) statuts.innerHTML = buildStatusCard();
    var lastDel = document.getElementById('dashboard-last-deliveries');
    if (lastDel) lastDel.innerHTML = buildLastDeliveries();
    var alertsBox = document.getElementById('dashboard-alerts-details');
    if (alertsBox) alertsBox.innerHTML = buildAlertsDetails();
    // H23 — KPI "Retards" : count livraisons en retard
    var retardsEl = document.getElementById('kpi-retards-count');
    if (retardsEl) {
      var livs = readArr('livraisons');
      var nbRetards = livs.filter(function(l) { return isRetard(l); }).length;
      retardsEl.textContent = nbRetards > 0 ? nbRetards : '0';
    }
    buildSubScores();
  }

  function setupHook() {
    renderAll();
    document.addEventListener('alertes:updated', renderAll);
    var page = document.getElementById('page-dashboard');
    if (page && typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        if (page.classList.contains('active')) renderAll();
      });
      obs.observe(page, { attributes: true, attributeFilter: ['class'] });
    }
    setInterval(renderAll, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHook);
  } else {
    setupHook();
  }

  window.refonteDashboardFinish = renderAll;
})();
