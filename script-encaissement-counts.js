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
    var paiementsAll = lire('paiements');
    var now = new Date();
    var moisStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Phase 91.42 — exclut brouillon/annulee de la dette : pas livré = pas dû.
    function statutOperationnelValide(l) {
      var st = (l.statut || '').toLowerCase();
      return st !== 'brouillon' && st !== 'draft' && st !== 'annule' && st !== 'annulee' && st !== 'annulée';
    }

    var impayes = livraisons.filter(function (l) {
      if (!l) return false;
      if (!statutOperationnelValide(l)) return false;
      var s = l.statutPaiement || l.statut_paiement || '';
      return s !== 'payé' && s !== 'paye' && s !== 'payee' && s !== 'litige';
    });

    // Encaissé ce mois — strict : date paiement uniquement (pas de fallback livraison date)
    // Source A : table paiements (timeline réelle)
    var encaissePaiements = paiementsAll.filter(function(p) {
      if (!p || !p.date) return false;
      var d = new Date(p.date);
      return !isNaN(d.getTime()) && d >= moisStart;
    }).reduce(function(s, p) { return s + (parseFloat(p.montant) || 0); }, 0);

    // Source B : livraisons marquées paye sans entry dans paiements (legacy)
    var paidLivIds = new Set();
    paiementsAll.forEach(function(p){ if (p && p.livraisonId) paidLivIds.add(p.livraisonId); });
    var encaisseLivLegacy = livraisons.filter(function (l) {
      if (!l) return false;
      if (paidLivIds.has(l.id)) return false;
      var s = l.statutPaiement || l.statut_paiement || '';
      if (s !== 'payé' && s !== 'paye' && s !== 'payee') return false;
      var dStr = l.datePaiement || l.date_paiement;
      if (!dStr) return false;
      var d = new Date(dStr);
      return !isNaN(d.getTime()) && d >= moisStart;
    }).reduce(function(s, l) { return s + parseFloat(l.prixTTC || l.prixHT || l.prix || 0); }, 0);

    var totalEncaisse = encaissePaiements + encaisseLivLegacy;
    if (kpiEncaisse) kpiEncaisse.textContent = fmtEuros(totalEncaisse);

    // Phase 87 : encaisse sub "+X% vs [mois préc]" (mockup-aligned)
    var kpiEncaisseSub = document.getElementById('enc-kpi-encaisse-sub');
    if (kpiEncaisseSub) {
      var MOIS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
      var prevMoisStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var prevMoisEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      var prevMoisNom = MOIS_FR[prevMoisStart.getMonth()];
      // Phase 91.42 — Strict : date paiement uniquement
      var encaissePaiementsPrev = paiementsAll.filter(function(p) {
        if (!p || !p.date) return false;
        var d = new Date(p.date);
        return !isNaN(d.getTime()) && d >= prevMoisStart && d <= prevMoisEnd;
      }).reduce(function(s, p) { return s + (parseFloat(p.montant) || 0); }, 0);
      var encaisseLivLegacyPrev = livraisons.filter(function (l) {
        if (!l) return false;
        if (paidLivIds.has(l.id)) return false;
        var s = l.statutPaiement || l.statut_paiement || '';
        if (s !== 'payé' && s !== 'paye' && s !== 'payee') return false;
        var dStr = l.datePaiement || l.date_paiement;
        if (!dStr) return false;
        var d = new Date(dStr);
        return !isNaN(d.getTime()) && d >= prevMoisStart && d <= prevMoisEnd;
      }).reduce(function(s, l) { return s + parseFloat(l.prixTTC || l.prixHT || l.prix || 0); }, 0);
      var totalEncaissePrev = encaissePaiementsPrev + encaisseLivLegacyPrev;
      if (totalEncaissePrev > 0 && totalEncaisse > 0) {
        var pctDelta = Math.round((totalEncaisse - totalEncaissePrev) / totalEncaissePrev * 100);
        if (pctDelta > 0) {
          kpiEncaisseSub.innerHTML = '<span class="up">+' + pctDelta + '%</span> vs ' + prevMoisNom;
        } else if (pctDelta < 0) {
          kpiEncaisseSub.innerHTML = '<span class="down">' + pctDelta + '%</span> vs ' + prevMoisNom;
        } else {
          kpiEncaisseSub.textContent = '= vs ' + prevMoisNom;
        }
      } else {
        kpiEncaisseSub.textContent = 'Règlements reçus';
      }
    }

    // Impayés
    var totalImpayes = impayes.reduce(function (s, l) { return s + parseFloat(l.prixTTC || l.prixHT || l.prix || 0); }, 0);
    if (kpiImpayes) kpiImpayes.textContent = totalImpayes > 0 ? fmtEuros(totalImpayes) : '—';
    if (subImpayes) subImpayes.textContent = impayes.length;

    // Phase 87 : impayes sub "+N facture" delta vs last week (mockup-aligned)
    var kpiImpayesSub = document.getElementById('enc-kpi-impayes-sub');
    if (kpiImpayesSub) {
      var semAgo = new Date(); semAgo.setDate(semAgo.getDate() - 7);
      var impayesSemAgo = livraisons.filter(function (l) {
        if (!l) return false;
        var s = l.statutPaiement || l.statut_paiement || '';
        if (s === 'payé' || s === 'paye' || s === 'payee' || s === 'litige') return false;
        var d = new Date(l.date || l.dateLivraison || l.date_livraison || '');
        return !isNaN(d.getTime()) && d <= semAgo;
      }).length;
      var deltaFact = impayes.length - impayesSemAgo;
      if (deltaFact > 0) {
        kpiImpayesSub.innerHTML = '<span class="down">+' + deltaFact + ' facture' + (deltaFact > 1 ? 's' : '') + '</span>';
      } else if (deltaFact < 0) {
        kpiImpayesSub.innerHTML = '<span class="up">' + deltaFact + ' facture' + (Math.abs(deltaFact) > 1 ? 's' : '') + '</span>';
      } else {
        kpiImpayesSub.textContent = impayes.length + ' facture' + (impayes.length !== 1 ? 's' : '');
      }
    }

    // DSO
    var dsoData = (typeof window.calculerDSO === 'function') ? window.calculerDSO(livraisons) : null;
    var dsoVal = dsoData && dsoData.dso !== null ? dsoData.dso + ' j' : '—';
    if (kpiDso) kpiDso.textContent = dsoVal;
    if (subDso) subDso.textContent = dsoVal;

    // Relances en attente (impayées > 30 jours)
    var seuil30 = new Date();
    seuil30.setDate(seuil30.getDate() - 30);
    var relances = impayes.filter(function (l) {
      var d = new Date(l.date || l.dateLivraison || l.date_livraison || '');
      return !isNaN(d.getTime()) && d < seuil30;
    });
    if (kpiRelances) kpiRelances.textContent = relances.length > 0 ? relances.length : '—';

    // Phase 59 — section-head sub-meta "X relances à envoyer" (mockup-aligned)
    var subRelances = document.getElementById('enc-section-sub-relances');
    if (subRelances) subRelances.textContent = relances.length;
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
