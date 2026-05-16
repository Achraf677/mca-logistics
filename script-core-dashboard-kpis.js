/**
 * MCA Logistics — script-core-dashboard-kpis.js
 *
 * Source de verite UNIQUE pour les 4 KPIs dashboard, partagee PC + mobile.
 * Fix Bug #6 audit Chrome (KPIs divergents PC vs mobile sur meme dataset) :
 *   - PC affichait CA HT 150 €, mobile affichait 180 € (TTC dans label HT)
 *   - Charges totales : 353,30 € (Dashboard) vs 399,58 € (page Charges)
 *   - Alertes : 0 (PC) vs 3 (mobile)
 *   - Benefice : -203,30 € (PC) vs -173,30 € (mobile)
 *
 * Doit etre charge AVANT script.js (PC) et AVANT script-mobile.js (mobile).
 *
 * Convention de schema (post-PR #49 dual-read) :
 *   - liv.prix       = TTC (montant facture, source de verite)
 *   - liv.prixHT     = HT  (optionnel, override explicite)
 *   - liv.prixTTC    = TTC (alias, certains adapters legacy)
 *   - liv.tauxTVA    = taux % (defaut : recupere via getTauxTVADefaut() si dispo)
 *
 * IMPORTANT : exporte au scope global (window.MCAKpis) pour parite PC/mobile,
 * et en CommonJS pour les tests Node.
 */
(function () {
  'use strict';

  function num(v) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function getTauxDefaut() {
    if (typeof window !== 'undefined' && typeof window.getTauxTVADefaut === 'function') {
      return num(window.getTauxTVADefaut());
    }
    return 20;
  }

  /**
   * Montant HT d'une livraison (canonique).
   * Logique :
   *   1. Si prixHT explicitement renseigne -> utilise prixHT.
   *   2. Sinon : prix (TTC) divise par (1 + tauxTVA/100).
   *   3. Si pas de tauxTVA : utilise getTauxTVADefaut() (par defaut 20).
   */
  function getMontantHT(liv) {
    if (!liv || typeof liv !== 'object') return 0;
    if (liv.prixHT !== undefined && liv.prixHT !== null && liv.prixHT !== '') {
      return num(liv.prixHT);
    }
    var ttc = num(liv.prix) || num(liv.prixTTC);
    var taux = num(liv.tauxTVA);
    if (!taux) taux = getTauxDefaut();
    return ttc / (1 + taux / 100);
  }

  /**
   * Montant TTC d'une livraison.
   *   1. liv.prixTTC ou liv.prix (TTC source).
   *   2. Sinon : prixHT * (1 + taux/100).
   */
  function getMontantTTC(liv) {
    if (!liv || typeof liv !== 'object') return 0;
    var ttc = num(liv.prixTTC) || num(liv.prix);
    if (ttc) return ttc;
    var ht = num(liv.prixHT);
    var taux = num(liv.tauxTVA);
    if (!taux) taux = getTauxDefaut();
    return ht * (1 + taux / 100);
  }

  /**
   * CA du mois (HT + TTC) pour une liste de livraisons.
   * mois = "YYYY-MM" (ISO local).
   * Optionnel : avoirs (livraisons avec prix negatif ou type=avoir).
   */
  function calcCAMois(livraisons, mois, avoirsEmis) {
    var arr = Array.isArray(livraisons) ? livraisons : [];
    var moisCle = String(mois || '').slice(0, 7);
    // Phase 91.40 — filtre statut : exclut brouillons et annulées du CA (agent edge cases #10)
    var livMois = arr.filter(function (l) {
      if (!l || !(l.date || '').startsWith(moisCle)) return false;
      var s = String(l.statut || '').toLowerCase();
      if (s === 'brouillon' || s === 'draft' || s === 'annule' || s === 'annulee') return false;
      return true;
    });
    var caHTBrut = livMois.reduce(function (s, l) { return s + getMontantHT(l); }, 0);
    var caTTCBrut = livMois.reduce(function (s, l) { return s + getMontantTTC(l); }, 0);
    var avoirs = Array.isArray(avoirsEmis) ? avoirsEmis : [];
    var avoirsMois = avoirs.filter(function (a) { return a && (a.date || '').startsWith(moisCle); });
    var avoirsHT = avoirsMois.reduce(function (s, a) { return s + num(a.montantHT); }, 0);
    var avoirsTTC = avoirsMois.reduce(function (s, a) { return s + num(a.montantTTC); }, 0);
    return {
      caHT: Math.max(0, caHTBrut - avoirsHT),
      caTTC: Math.max(0, caTTCBrut - avoirsTTC),
      nbLivraisons: livMois.length
    };
  }

  /**
   * Charges du mois ventilees (HT). Cumule charges + carburant (lignes carburant).
   * Source unique : table charges (categorie discrimine carburant/entretien/salaires/autres)
   *               + table carburant (toujours type carburant, montant TTC).
   *
   * Pour aligner Dashboard avec page Charges :
   *   - charges.montantHT (si renseigne) sinon charges.montant / (1+tauxTVA/100)
   *   - carburant.totalHT (si renseigne) sinon carburant.total / (1+tauxTVA/100) (default 20%)
   */
  function totalHTLignes(arr) {
    return (Array.isArray(arr) ? arr : []).reduce(function (s, it) {
      if (!it) return s;
      var ht = num(it.montantHT);
      if (ht) return s + ht;
      var ttc = num(it.montant) || num(it.montantTTC) || num(it.total) || num(it.totalTTC);
      var taux = num(it.tauxTVA) || getTauxDefaut();
      return s + ttc / (1 + taux / 100);
    }, 0);
  }

  function calcChargesMois(charges, carburant, mois) {
    var moisCle = String(mois || '').slice(0, 7);
    var chArr = (Array.isArray(charges) ? charges : []).filter(function (c) {
      return c && (c.date || '').startsWith(moisCle);
    });
    var carbArr = (Array.isArray(carburant) ? carburant : []).filter(function (p) {
      return p && (p.date || '').startsWith(moisCle);
    });

    var totalCarbCharges = totalHTLignes(chArr.filter(function (c) { return c.categorie === 'carburant'; }));
    var totalCarbCarburant = totalHTLignes(carbArr); // table carburant native
    var totalEntr = totalHTLignes(chArr.filter(function (c) { return c.categorie === 'entretien'; }));
    var totalSalaires = totalHTLignes(chArr.filter(function (c) { return c.categorie === 'salaires'; }));
    var totalAutres = totalHTLignes(chArr.filter(function (c) {
      return c.categorie !== 'carburant' && c.categorie !== 'entretien' && c.categorie !== 'salaires';
    }));
    var totalCarb = totalCarbCharges + totalCarbCarburant;
    var total = totalCarb + totalEntr + totalSalaires + totalAutres;

    return {
      carburant: totalCarb,
      entretien: totalEntr,
      salaires: totalSalaires,
      autres: totalAutres,
      total: total
    };
  }

  /**
   * Benefice estime du mois = caHT - chargesTotales.
   */
  function calcBenefice(caHT, chargesTotal) {
    return num(caHT) - num(chargesTotal);
  }

  /**
   * Compte d'alertes admin actives (non lues / non traitees / non ignorees / non reportees).
   * Aligne PC (compterAlertesNonLues) et mobile (M.compterAlertesNonLues).
   */
  function calcAlertesActives(alertesAdmin) {
    var arr = Array.isArray(alertesAdmin) ? alertesAdmin : [];
    var now = new Date();
    return arr.filter(function (a) {
      if (!a) return false;
      if (a.lu || a.traitee || a.ignoree) return false;
      if (a.meta && a.meta.repousseJusquA) {
        try {
          if (new Date(a.meta.repousseJusquA) > now) return false;
        } catch (_) {}
      }
      return true;
    }).length;
  }

  /**
   * KPIs complets pour le mois courant. Convenience wrapper.
   * @param {Object} data { livraisons, charges, carburant, alertes_admin, avoirs_emis }
   * @param {string} mois optionnel, defaut = mois courant ISO local.
   */
  function calcKpisDashboard(data, mois) {
    var ds = data || {};
    var moisCle = mois || (new Date().toISOString().slice(0, 7));
    var ca = calcCAMois(ds.livraisons || [], moisCle, ds.avoirs_emis || []);
    var charges = calcChargesMois(ds.charges || [], ds.carburant || [], moisCle);
    var benefice = calcBenefice(ca.caHT, charges.total);
    var alertes = calcAlertesActives(ds.alertes_admin || []);
    return {
      mois: moisCle,
      caHT: ca.caHT,
      caTTC: ca.caTTC,
      nbLivraisons: ca.nbLivraisons,
      charges: charges,
      benefice: benefice,
      alertes: alertes
    };
  }

  var api = {
    getMontantHT: getMontantHT,
    getMontantTTC: getMontantTTC,
    calcCAMois: calcCAMois,
    calcChargesMois: calcChargesMois,
    calcBenefice: calcBenefice,
    calcAlertesActives: calcAlertesActives,
    calcKpisDashboard: calcKpisDashboard,
    totalHTLignes: totalHTLignes
  };

  if (typeof window !== 'undefined') {
    window.MCAKpis = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
