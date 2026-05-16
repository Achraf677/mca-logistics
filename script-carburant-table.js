/* Phase 69 — Carburant : table "Consommation par véhicule" avec fuel-bar
 * Remplace le canvas chart (chart-carb-par-vehicule) par une table mockup-aligned.
 * Colonnes : Véhicule | Conso 30j | Budget | Écart | Dernier plein | Statut
 */
(function () {
  'use strict';

  var BUDGET_DEFAULT_PAR_MOIS = 1200; // € budget mensuel par défaut par véhicule

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function euros(n) {
    if (isNaN(n) || n == null) return '—';
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function dateJour(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function render() {
    var tb = document.getElementById('tb-carb-par-vehicule');
    var badge = document.getElementById('carb-table-veh-badge');
    if (!tb) return;

    var vehicules = lire('vehicules');
    var carburant = lire('carburant');

    if (!vehicules.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun véhicule</td></tr>';
      return;
    }

    var now = new Date();
    var thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    // Index pleins par vehicule
    var pleinsParVeh = {};
    carburant.forEach(function (p) {
      if (!p) return;
      var vid = p.vehId || p.vehiculeId || p.vehicule_id;
      if (!vid) return;
      if (!pleinsParVeh[vid]) pleinsParVeh[vid] = [];
      pleinsParVeh[vid].push(p);
    });

    var rows = vehicules.map(function (v) {
      if (!v) return null;
      var vid = v.id;
      var label = v.modele || v.marque || v.immat || v.immatriculation || vid;
      var immat = v.immat || v.immatriculation || '';
      var pleins = (pleinsParVeh[vid] || []).sort(function (a, b) {
        return new Date(a.date || 0) - new Date(b.date || 0);
      });

      // Pleins des 30 derniers jours pour budget/conso
      var pleins30j = pleins.filter(function (p) {
        var d = new Date(p.date || 0);
        return d >= thirtyDaysAgo;
      });

      // Calcul conso L/100 sur les 30j
      var consoL100 = null;
      var pleinsAvecKm = pleins.filter(function (p) {
        return (parseFloat(p.km != null ? p.km : p.kmCompteur) || 0) > 0;
      }).sort(function (a, b) {
        var aKm = parseFloat(a.km != null ? a.km : a.kmCompteur) || 0;
        var bKm = parseFloat(b.km != null ? b.km : b.kmCompteur) || 0;
        return aKm - bKm;
      });
      if (pleinsAvecKm.length >= 2) {
        var totalL = 0, totalKm = 0;
        for (var i = 1; i < Math.min(pleinsAvecKm.length, 8); i++) {
          var km1 = parseFloat(pleinsAvecKm[i - 1].km != null ? pleinsAvecKm[i - 1].km : pleinsAvecKm[i - 1].kmCompteur) || 0;
          var km2 = parseFloat(pleinsAvecKm[i].km != null ? pleinsAvecKm[i].km : pleinsAvecKm[i].kmCompteur) || 0;
          var delta = km2 - km1;
          if (delta > 0 && delta < 5000) {
            totalKm += delta;
            totalL += parseFloat(pleinsAvecKm[i].litres) || 0;
          }
        }
        if (totalKm > 50) consoL100 = Math.round((totalL / totalKm) * 100 * 10) / 10;
      }

      // Coût total 30j
      var cout30j = pleins30j.reduce(function (s, p) {
        return s + (parseFloat(p.total || (p.litres * p.prixLitre)) || 0);
      }, 0);

      // Budget par défaut (ou depuis config vehicule)
      var budget = parseFloat(v.budget_mensuel_carburant || v.budgetCarburant || BUDGET_DEFAULT_PAR_MOIS) || BUDGET_DEFAULT_PAR_MOIS;
      var ecart = cout30j > 0 ? (budget - cout30j) : null;

      // Dernier plein
      var dernierPlein = pleins.length ? pleins[pleins.length - 1] : null;
      var dernierePleinDate = dernierPlein ? dernierPlein.date : null;

      // Statut basé sur conso
      var statut = 'normal'; // ok
      if (consoL100 !== null) {
        if (consoL100 > 13) statut = 'alert';
        else if (consoL100 > 10) statut = 'warn';
      }

      return {
        label: label,
        immat: immat,
        consoL100: consoL100,
        cout30j: cout30j,
        budget: budget,
        ecart: ecart,
        dernierePleinDate: dernierePleinDate,
        statut: statut
      };
    }).filter(Boolean);

    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun véhicule</td></tr>';
      return;
    }

    var alertCount = rows.filter(function (r) { return r.statut === 'alert'; }).length;
    if (badge) {
      badge.className = alertCount > 0 ? 'badge alert' : 'badge ok';
      badge.textContent = alertCount > 0 ? alertCount + ' anomalie' + (alertCount > 1 ? 's' : '') : rows.length + ' véhicule' + (rows.length > 1 ? 's' : '');
    }

    tb.innerHTML = rows.map(function (r) {
      var consoTxt = r.consoL100 !== null ? r.consoL100.toFixed(1) + ' L/100' : '—';
      var consoColor = r.statut === 'alert' ? 'style="color:var(--brand);font-weight:600"'
        : r.statut === 'warn' ? 'style="color:#d4b67a;font-weight:600"' : '';

      // Fuel bar : % relatif (10 L/100 = 100%, 12+ = rouge)
      var pct = r.consoL100 !== null ? Math.min(100, Math.round((r.consoL100 / 12) * 100)) : 0;
      var fillClass = r.statut === 'alert' ? '' : r.statut === 'warn' ? 'warn' : 'ok';
      var fuelBar = r.consoL100 !== null
        ? '<div style="height:6px;background:var(--bg-card-hover);border-radius:3px;overflow:hidden;margin-top:4px"><div style="height:100%;width:' + pct + '%;border-radius:3px;transition:width .3s;background:' + (r.statut === 'alert' ? 'linear-gradient(90deg,var(--brand),rgba(230,57,70,0.6))' : r.statut === 'warn' ? 'linear-gradient(90deg,#d4b67a,rgba(212,182,122,0.6))' : 'linear-gradient(90deg,#9bb1a4,rgba(155,177,164,0.6))') + '"></div></div>'
        : '';

      var coutTxt = r.cout30j > 0 ? euros(Math.round(r.cout30j)) : '—';
      var budgetTxt = euros(r.budget);

      var ecartTxt = '—';
      var ecartStyle = '';
      if (r.ecart !== null && r.cout30j > 0) {
        var sign = r.ecart >= 0 ? '+' : '';
        ecartTxt = sign + euros(Math.round(Math.abs(r.ecart)));
        ecartStyle = r.ecart < 0 ? 'style="color:var(--brand);font-weight:600"' : 'style="color:#9bb1a4;font-weight:600"';
        if (r.ecart >= 0) ecartTxt = '-' + euros(Math.round(r.ecart));
      }

      var badgeCls = r.statut === 'alert' ? 'alert' : r.statut === 'warn' ? 'warn' : 'ok';
      var badgeTxt = r.statut === 'alert' ? 'Anomalie' : r.statut === 'warn' ? 'Élevée' : 'Normal';

      return '<tr>' +
        '<td><strong>' + r.label + '</strong>' + (r.immat ? '<div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-top:2px">' + r.immat + '</div>' : '') + '</td>' +
        '<td><div ' + consoColor + '>' + consoTxt + '</div>' + fuelBar + '</td>' +
        '<td>' + budgetTxt + '</td>' +
        '<td ' + ecartStyle + '>' + ecartTxt + '</td>' +
        '<td style="font-size:11px;font-family:monospace">' + (r.dernierePleinDate ? dateJour(r.dernierePleinDate) : '—') + '</td>' +
        '<td><span class="badge ' + badgeCls + '">' + badgeTxt + '</span></td>' +
        '</tr>';
    }).join('');
  }

  // Lance après que script-carburant.js a peuplé localStorage
  function init() {
    if (!document.getElementById('tb-carb-par-vehicule')) return false;
    render();
    // Re-render quand carburant est rechargé (event custom)
    document.addEventListener('carburant:updated', render);
    document.addEventListener('vehicules:updated', render);
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

  // Expose pour refresh manuel
  window.refreshCarbTable = render;
})();
