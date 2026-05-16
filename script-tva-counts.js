/* Phase 86 — TVA KPI counts dynamiques : échéance + couleur solde + CA HT subs */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtEur(n) {
    return (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function update() {
    var now = new Date();
    var kpiEcheance = document.getElementById('tva-kpi-echeance');
    var subEcheance = document.getElementById('tva-echeance-sub');
    var kpiSolde = document.getElementById('tva-kpi-solde');

    // Échéance TVA = le 15 du mois suivant
    if (kpiEcheance) {
      var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
      var dd = String(nextMonth.getDate()).padStart(2, '0');
      var mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
      kpiEcheance.textContent = dd + '/' + mm;
    }
    if (subEcheance) {
      var nextDeadline = new Date(now.getFullYear(), now.getMonth() + 1, 15);
      nextDeadline.setHours(23, 59, 59, 0);
      var joursRestants = Math.ceil((nextDeadline.getTime() - now.getTime()) / 86400000);
      subEcheance.textContent = joursRestants > 0 ? joursRestants + ' jour' + (joursRestants > 1 ? 's' : '') + ' restant' + (joursRestants > 1 ? 's' : '') : 'Échéance dépassée';
    }

    // Brand color on tva-kpi-solde when > 0 (mockup-aligned)
    if (kpiSolde && typeof window.__lastTvaBrutSolde !== 'undefined') {
      kpiSolde.style.color = window.__lastTvaBrutSolde > 0 ? 'var(--brand, #e63946)' : '';
    }

    // CA HT sub-meta pour TVA collectée (lit livraisons ce mois)
    var subCollectee = document.getElementById('tva-collectee-sub');
    if (subCollectee) {
      try {
        var moisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        var moisEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        var livraisons = lire('livraisons');
        var caHT = livraisons.filter(function (l) {
          if (!l) return false;
          var d = new Date(l.date || l.dateLivraison || '');
          return !isNaN(d.getTime()) && d.getTime() >= moisStart && d.getTime() <= moisEnd;
        }).reduce(function (s, l) {
          return s + (parseFloat(l.prixHT || l.prix_ht || 0) || (parseFloat(l.prix || l.prixTTC || 0) / 1.2));
        }, 0);
        subCollectee.textContent = caHT > 0 ? 'CA HT ' + fmtEur(caHT) : 'Sur ventes (CA HT)';
      } catch (_) {}
    }

    // Charges HT sub-meta pour TVA déductible (lit charges ce mois)
    var subDeductible = document.getElementById('tva-deductible-sub');
    if (subDeductible) {
      try {
        var moisStartC = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        var moisEndC = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        var charges = lire('charges');
        var chargesHT = charges.filter(function (c) {
          if (!c) return false;
          var d = new Date(c.date || c.dateCharge || c.dateEcheance || '');
          return !isNaN(d.getTime()) && d.getTime() >= moisStartC && d.getTime() <= moisEndC;
        }).reduce(function (s, c) {
          return s + (parseFloat(c.montantHT || c.montant_ht || 0) || (parseFloat(c.montant || c.montantTTC || 0) / 1.2));
        }, 0);
        subDeductible.textContent = chargesHT > 0 ? 'Charges HT ' + fmtEur(chargesHT) : 'Sur achats (charges)';
      } catch (_) {}
    }
  }

  function tryAttach() {
    if (!document.getElementById('tva-kpi-echeance') && !document.getElementById('tva-kpi-solde')) return false;
    update();
    if (!window.__refonteTvaCountsIv) {
      window.__refonteTvaCountsIv = setInterval(update, 5000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) { var r = 0, iv = setInterval(function () { if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
    });
  } else {
    if (!tryAttach()) { var r = 0, iv = setInterval(function () { if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
  }

  window.refonteTvaUpdateCounts = update;
})();
