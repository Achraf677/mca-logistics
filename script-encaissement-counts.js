/* Phase 40 refonte HTML — Encaissement KPI grid + section-head counts */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtEuros(n) {
    return Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function update() {
    var kpiEncaisse = document.getElementById('enc-kpi-encaisse');
    var kpiImpayes = document.getElementById('enc-kpi-impayes');
    var kpiDso = document.getElementById('enc-kpi-dso');
    var kpiRelances = document.getElementById('enc-kpi-relances');
    var subImpayes = document.getElementById('enc-section-sub-impayees');
    var subDso = document.getElementById('enc-section-sub-dso');

    if (!kpiEncaisse && !kpiImpayes && !subImpayes) return;

    var livraisons = lire('livraisons');
    var now = new Date();
    var moisStart = new Date(now.getFullYear(), now.getMonth(), 1);

    var impayes = livraisons.filter(function (l) {
      if (!l) return false;
      var s = l.statutPaiement || l.statut_paiement || '';
      return s !== 'payé' && s !== 'paye' && s !== 'payee' && s !== 'litige';
    });

    // Encaissé ce mois
    var encaisseMois = livraisons.filter(function (l) {
      if (!l) return false;
      var s = l.statutPaiement || l.statut_paiement || '';
      if (s !== 'payé' && s !== 'paye' && s !== 'payee') return false;
      var d = new Date(l.datePaiement || l.date_paiement || l.date || l.dateLivraison || '');
      return !isNaN(d.getTime()) && d >= moisStart;
    });
    var totalEncaisse = encaisseMois.reduce(function (s, l) { return s + parseFloat(l.prixTTC || l.prixHT || l.prix || 0); }, 0);
    if (kpiEncaisse) kpiEncaisse.textContent = fmtEuros(totalEncaisse);

    // Impayés
    var totalImpayes = impayes.reduce(function (s, l) { return s + parseFloat(l.prixTTC || l.prixHT || l.prix || 0); }, 0);
    if (kpiImpayes) kpiImpayes.textContent = totalImpayes > 0 ? fmtEuros(totalImpayes) : '—';
    if (subImpayes) subImpayes.textContent = impayes.length;

    // DSO
    var dsoData = (typeof window.calculerDSO === 'function') ? window.calculerDSO(livraisons) : null;
    var dsoVal = dsoData && dsoData.dso !== null ? dsoData.dso + ' j' : '—';
    if (kpiDso) kpiDso.textContent = dsoVal;
    if (subDso) subDso.textContent = dsoVal;

    // Relances en attente (impayées > 30 jours)
    if (kpiRelances) {
      var seuil30 = new Date();
      seuil30.setDate(seuil30.getDate() - 30);
      var relances = impayes.filter(function (l) {
        var d = new Date(l.date || l.dateLivraison || l.date_livraison || '');
        return !isNaN(d.getTime()) && d < seuil30;
      });
      kpiRelances.textContent = relances.length > 0 ? relances.length : '—';
    }
  }

  function tryAttach() {
    if (!document.getElementById('enc-kpi-encaisse') && !document.getElementById('enc-section-sub-impayees')) return false;
    update();
    if (!window.__refonteEncIv) {
      window.__refonteEncIv = setInterval(update, 5000);
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

  window.refonteEncaissementUpdateCounts = update;
})();
