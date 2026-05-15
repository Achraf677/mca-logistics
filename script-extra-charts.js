/* Phase 60 V7 H5+H6+H7+H8 — Charts manquants Carburant + Encaissement + TVA + Rentabilité.
   7 charts Chart.js qui complètent les charts existants (Charges, Stats).

   Charts couverts :
   - chart-carb-evol-6m            : Évolution conso flotte L/100km 6 mois
   - chart-carb-par-vehicule       : Conso par véhicule (barres horizontales)
   - chart-enc-vs-impayes-6m       : Encaissements vs Impayés 6 mois (double courbe)
   - chart-enc-vieillissement      : Vieillissement créances (0-30/31-60/61-90/+90j)
   - chart-tva-coll-vs-ded         : TVA collectée vs déductible 6 mois (bar group)
   - chart-rent-evol-6m            : Évolution CA vs charges 6 mois (double courbe)
   - chart-rent-charges-donut      : Répartition charges par catégorie (donut)
*/
(function () {
  'use strict';

  if (typeof Chart === 'undefined') {
    console.warn('[extra-charts] Chart.js non chargé, charts skip');
    return;
  }

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtEur(n) {
    return Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function moisLabel(d) {
    var m = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
    return m[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
  }

  function last6Months() {
    var months = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: moisLabel(d), year: d.getFullYear(), month: d.getMonth() });
    }
    return months;
  }

  // Détruire si déjà existant (re-render)
  function destroyIfExists(id) {
    var c = window[id];
    if (c && typeof c.destroy === 'function') {
      try { c.destroy(); } catch (_) {}
    }
    window[id] = null;
  }

  // Colors brand-aligned
  var COLORS = {
    brand: '#e63946',
    success: '#06d6a0',
    warning: '#f5a623',
    info: '#3498db',
    purple: '#9b59b6',
    muted: '#7c8299',
    bg: 'rgba(230, 57, 70, 0.12)',
    successBg: 'rgba(6, 214, 160, 0.12)',
  };

  // ============ CARBURANT : Évolution conso 6m ============
  function renderCarbEvol6m() {
    var canvas = document.getElementById('chart-carb-evol-6m');
    if (!canvas) return;
    destroyIfExists('_chartCarbEvol');
    var carburant = lire('carburant');
    var months = last6Months();
    var data = months.map(function (m) {
      var pleins = carburant.filter(function (p) {
        if (!p || !p.date) return false;
        var d = new Date(p.date);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      if (!pleins.length) return null;
      var totalL = pleins.reduce(function (s, p) { return s + (parseFloat(p.litres) || 0); }, 0);
      var totalKm = pleins.reduce(function (s, p) { return s + (parseFloat(p.km) || 0); }, 0);
      if (totalKm === 0) return null;
      return Math.round((totalL / totalKm) * 100 * 10) / 10;  // L/100km
    });
    window._chartCarbEvol = new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map(function (m) { return m.label; }),
        datasets: [{
          label: 'Conso L/100km',
          data: data,
          borderColor: COLORS.brand,
          backgroundColor: COLORS.bg,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: COLORS.brand
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: COLORS.muted }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { ticks: { color: COLORS.muted }, grid: { display: false } }
        }
      }
    });
  }

  // ============ CARBURANT : Conso par véhicule ============
  function renderCarbParVehicule() {
    var canvas = document.getElementById('chart-carb-par-vehicule');
    if (!canvas) return;
    destroyIfExists('_chartCarbVeh');
    var carburant = lire('carburant');
    var vehicules = lire('vehicules');
    var consoParVeh = {};
    carburant.forEach(function (p) {
      var v = vehicules.find(function (x) { return x && x.id === p.vehId; });
      if (!v) return;
      var key = v.modele || v.immat || v.id;
      if (!consoParVeh[key]) consoParVeh[key] = { totalL: 0, totalKm: 0 };
      consoParVeh[key].totalL += parseFloat(p.litres) || 0;
      consoParVeh[key].totalKm += parseFloat(p.km) || 0;
    });
    var entries = Object.keys(consoParVeh).map(function (k) {
      var c = consoParVeh[k];
      var conso = c.totalKm > 0 ? Math.round((c.totalL / c.totalKm) * 100 * 10) / 10 : 0;
      return { label: k, conso: conso };
    }).sort(function (a, b) { return b.conso - a.conso; }).slice(0, 6);
    window._chartCarbVeh = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: entries.map(function (e) { return e.label; }),
        datasets: [{
          label: 'L/100km',
          data: entries.map(function (e) { return e.conso; }),
          backgroundColor: entries.map(function (e) {
            return e.conso > 12 ? COLORS.brand : e.conso > 9 ? COLORS.warning : COLORS.success;
          }),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: COLORS.muted }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: COLORS.muted }, grid: { display: false } }
        }
      }
    });
  }

  // ============ ENCAISSEMENT : Encaissements vs Impayés 6m ============
  function renderEncVsImpayes6m() {
    var canvas = document.getElementById('chart-enc-vs-impayes-6m');
    if (!canvas) return;
    destroyIfExists('_chartEncVsImp');
    var livraisons = lire('livraisons');
    var months = last6Months();
    var encaisses = months.map(function (m) {
      return livraisons.filter(function (l) {
        if (!l) return false;
        var s = (l.statutPaiement || l.statut_paiement || '').toLowerCase();
        if (s !== 'payé' && s !== 'paye' && s !== 'payee') return false;
        var d = new Date(l.datePaiement || l.date_paiement || l.date || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, l) { return s + (parseFloat(l.prixTTC || l.prixHT || l.prix || 0)); }, 0);
    });
    var impayes = months.map(function (m) {
      return livraisons.filter(function (l) {
        if (!l) return false;
        var s = (l.statutPaiement || l.statut_paiement || '').toLowerCase();
        if (s === 'payé' || s === 'paye' || s === 'payee') return false;
        var d = new Date(l.date || l.dateLivraison || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, l) { return s + (parseFloat(l.prixTTC || l.prixHT || l.prix || 0)); }, 0);
    });
    window._chartEncVsImp = new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map(function (m) { return m.label; }),
        datasets: [
          { label: 'Encaissés', data: encaisses, borderColor: COLORS.success, backgroundColor: COLORS.successBg, tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'Impayés', data: impayes, borderColor: COLORS.brand, backgroundColor: COLORS.bg, tension: 0.3, fill: false, pointRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', labels: { color: COLORS.muted } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: COLORS.muted, callback: function (v) { return v.toLocaleString('fr-FR') + ' €'; } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { ticks: { color: COLORS.muted }, grid: { display: false } }
        }
      }
    });
  }

  // ============ ENCAISSEMENT : Vieillissement créances ============
  function renderEncVieillissement() {
    var canvas = document.getElementById('chart-enc-vieillissement');
    if (!canvas) return;
    destroyIfExists('_chartEncVieil');
    var livraisons = lire('livraisons');
    var buckets = { '0-30j': 0, '31-60j': 0, '61-90j': 0, '+90j': 0 };
    var now = Date.now();
    livraisons.forEach(function (l) {
      if (!l) return;
      var s = (l.statutPaiement || l.statut_paiement || '').toLowerCase();
      if (s === 'payé' || s === 'paye' || s === 'payee') return;
      var d = new Date(l.date || l.dateLivraison || '');
      if (isNaN(d.getTime())) return;
      var ageJ = Math.floor((now - d.getTime()) / 86400000);
      var montant = parseFloat(l.prixTTC || l.prixHT || l.prix || 0);
      if (ageJ <= 30) buckets['0-30j'] += montant;
      else if (ageJ <= 60) buckets['31-60j'] += montant;
      else if (ageJ <= 90) buckets['61-90j'] += montant;
      else buckets['+90j'] += montant;
    });
    window._chartEncVieil = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{
          label: 'Encours €',
          data: Object.values(buckets),
          backgroundColor: [COLORS.success, COLORS.warning, '#ff6b35', COLORS.brand],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: COLORS.muted, callback: function (v) { return v.toLocaleString('fr-FR') + ' €'; } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { ticks: { color: COLORS.muted }, grid: { display: false } }
        }
      }
    });
  }

  // ============ TVA : Collectée vs Déductible 6m ============
  function renderTvaCollVsDed() {
    var canvas = document.getElementById('chart-tva-coll-vs-ded');
    if (!canvas) return;
    destroyIfExists('_chartTva');
    var livraisons = lire('livraisons');
    var charges = lire('charges');
    var months = last6Months();
    var collectee = months.map(function (m) {
      return livraisons.filter(function (l) {
        if (!l) return false;
        var d = new Date(l.date || l.dateLivraison || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, l) {
        var ht = parseFloat(l.prixHT || l.prix || 0);
        var taux = parseFloat(l.tauxTva || 20);
        return s + (ht * taux / 100);
      }, 0);
    });
    var deductible = months.map(function (m) {
      return charges.filter(function (c) {
        if (!c) return false;
        var d = new Date(c.date || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, c) { return s + (parseFloat(c.tva) || 0); }, 0);
    });
    window._chartTva = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(function (m) { return m.label; }),
        datasets: [
          { label: 'Collectée', data: collectee, backgroundColor: COLORS.brand, borderRadius: 4 },
          { label: 'Déductible', data: deductible, backgroundColor: COLORS.info, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', labels: { color: COLORS.muted } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: COLORS.muted, callback: function (v) { return v.toLocaleString('fr-FR') + ' €'; } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { ticks: { color: COLORS.muted }, grid: { display: false } }
        }
      }
    });
  }

  // ============ RENTABILITÉ : Évolution CA vs charges 6m ============
  function renderRentEvol6m() {
    var canvas = document.getElementById('chart-rent-evol-6m');
    if (!canvas) return;
    destroyIfExists('_chartRentEvol');
    var livraisons = lire('livraisons');
    var charges = lire('charges');
    var carburant = lire('carburant');
    var months = last6Months();
    var caData = months.map(function (m) {
      return livraisons.filter(function (l) {
        if (!l) return false;
        var d = new Date(l.date || l.dateLivraison || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, l) {
        var prix = parseFloat(l.prixHT || l.prix || l.montant || 0);
        return s + (isNaN(prix) ? 0 : prix);
      }, 0);
    });
    var chargesData = months.map(function (m) {
      var chCh = charges.filter(function (c) {
        if (!c) return false;
        var d = new Date(c.date || c.dateCharge || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, c) {
        return s + (parseFloat(c.montantHT || c.montant || 0) || 0);
      }, 0);
      var chCarb = carburant.filter(function (p) {
        if (!p) return false;
        var d = new Date(p.date || '');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).reduce(function (s, p) {
        return s + (parseFloat(p.montantHT || p.montant || 0) || 0);
      }, 0);
      return chCh + chCarb;
    });
    window._chartRentEvol = new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map(function (m) { return m.label; }),
        datasets: [
          {
            label: 'CA HT',
            data: caData,
            borderColor: COLORS.success,
            backgroundColor: COLORS.successBg,
            tension: 0.3, fill: true, pointRadius: 4, pointBackgroundColor: COLORS.success
          },
          {
            label: 'Charges',
            data: chargesData,
            borderColor: COLORS.brand,
            backgroundColor: COLORS.bg,
            tension: 0.3, fill: true, pointRadius: 4, pointBackgroundColor: COLORS.brand
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', labels: { color: COLORS.muted } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: COLORS.muted, callback: function (v) { return v.toLocaleString('fr-FR') + ' €'; } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { ticks: { color: COLORS.muted }, grid: { display: false } }
        }
      }
    });
  }

  // ============ RENTABILITÉ : Donut répartition charges ============
  function renderRentChargesDonut() {
    var canvas = document.getElementById('chart-rent-charges-donut');
    if (!canvas) return;
    destroyIfExists('_chartRentDonut');
    var charges = lire('charges');
    var carburant = lire('carburant');
    var seuil = Date.now() - 180 * 86400000;  // 6 derniers mois
    var groupes = {};
    charges.forEach(function (c) {
      if (!c) return;
      var d = new Date(c.date || c.dateCharge || '');
      if (isNaN(d.getTime()) || d.getTime() < seuil) return;
      var cat = (c.categorie || c.type || 'Autres').toString();
      groupes[cat] = (groupes[cat] || 0) + (parseFloat(c.montantHT || c.montant || 0) || 0);
    });
    var totalCarb = carburant.filter(function (p) {
      if (!p) return false;
      var d = new Date(p.date || '');
      return !isNaN(d.getTime()) && d.getTime() >= seuil;
    }).reduce(function (s, p) {
      return s + (parseFloat(p.montantHT || p.montant || 0) || 0);
    }, 0);
    if (totalCarb > 0) groupes['Carburant'] = (groupes['Carburant'] || 0) + totalCarb;
    var labels = Object.keys(groupes).sort(function (a, b) { return groupes[b] - groupes[a]; });
    var data = labels.map(function (l) { return Math.round(groupes[l]); });
    var palette = [COLORS.brand, COLORS.success, COLORS.warning, COLORS.info, COLORS.purple, COLORS.muted, '#e67e22', '#1abc9c'];
    var colors = labels.map(function (_, i) { return palette[i % palette.length]; });
    window._chartRentDonut = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { display: true, position: 'right', labels: { color: COLORS.muted, font: { size: 11 } } },
          tooltip: { callbacks: { label: function (ctx) { return ctx.label + ' : ' + fmtEur(ctx.parsed); } } }
        }
      }
    });
  }

  // ============ Trigger render quand la page devient active ============
  function renderAll() {
    try { renderCarbEvol6m(); } catch (e) { console.warn('[chart-carb-evol]', e); }
    try { renderCarbParVehicule(); } catch (e) { console.warn('[chart-carb-veh]', e); }
    try { renderEncVsImpayes6m(); } catch (e) { console.warn('[chart-enc-vs-imp]', e); }
    try { renderEncVieillissement(); } catch (e) { console.warn('[chart-enc-vieil]', e); }
    try { renderTvaCollVsDed(); } catch (e) { console.warn('[chart-tva]', e); }
    try { renderRentEvol6m(); } catch (e) { console.warn('[chart-rent-evol]', e); }
    try { renderRentChargesDonut(); } catch (e) { console.warn('[chart-rent-donut]', e); }
  }

  // Re-render quand on switch de page (MutationObserver sur .page.active)
  function observePages() {
    var debounceTimer = null;
    var observer = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderAll, 400);
    });
    document.querySelectorAll('section.page').forEach(function (p) {
      observer.observe(p, { attributes: true, attributeFilter: ['class'] });
    });
  }

  function init() {
    renderAll();
    observePages();
    // Re-render périodique pour data fresh
    setInterval(renderAll, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refonteExtraCharts = renderAll;
})();
