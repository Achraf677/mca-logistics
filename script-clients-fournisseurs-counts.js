/* Phase 2 PR-F Clients/Fournisseurs section-head counts */
/* Phase 38 — KPI grids (actifs / top / encours / categorie) */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function parseDate(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function actifsRecents(entites, livraisons, charges, role) {
    if (!Array.isArray(entites) || entites.length === 0) return 0;
    var seuil = new Date();
    seuil.setDate(seuil.getDate() - 90);
    var actifsIds = new Set();
    if (role === 'client' && Array.isArray(livraisons)) {
      livraisons.forEach(function (l) {
        if (!l) return;
        var d = parseDate(l.date || l.dateLivraison || l.date_livraison);
        if (!d || d < seuil) return;
        var id = l.clientId || l.client_id || (l.client && (l.client.id || l.client.nom)) || l.client;
        if (id) actifsIds.add(String(id));
      });
    }
    if (role === 'fournisseur' && Array.isArray(charges)) {
      charges.forEach(function (c) {
        if (!c) return;
        var d = parseDate(c.date);
        if (!d || d < seuil) return;
        var id = c.fournisseurId || c.fournisseur_id || (c.fournisseur && (c.fournisseur.id || c.fournisseur.nom)) || c.fournisseur;
        if (id) actifsIds.add(String(id));
      });
    }
    return entites.filter(function (e) {
      if (!e) return false;
      return actifsIds.has(String(e.id)) || actifsIds.has(String(e.nom));
    }).length;
  }

  function fmtEuros(n) {
    return Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function update() {
    /* Phase 91.54 I.12 — skip si onglet pas visible (gain perf ~50% CPU idle) */
    if (document.hidden) return;
    var cliSubTotal = document.getElementById('clients-section-sub-total');
    var cliSubActifs = document.getElementById('clients-section-sub-actifs');
    var frnSubTotal = document.getElementById('fournisseurs-section-sub-total');
    var frnSubActifs = document.getElementById('fournisseurs-section-sub-actifs');
    if (!cliSubTotal && !frnSubTotal) return;

    var clients = lire('clients');
    var fournisseurs = lire('fournisseurs');
    var livraisons = lire('livraisons');
    var charges = lire('charges');

    if (cliSubTotal) cliSubTotal.textContent = clients.length;
    if (cliSubActifs) cliSubActifs.textContent = actifsRecents(clients, livraisons, charges, 'client');
    if (frnSubTotal) frnSubTotal.textContent = fournisseurs.length;
    if (frnSubActifs) frnSubActifs.textContent = actifsRecents(fournisseurs, livraisons, charges, 'fournisseur');

    // Phase 59 — sub-meta mockup CA cumulé clients + Dépenses cumulées fournisseurs (12 mois)
    var seuil12m = new Date(); seuil12m.setFullYear(seuil12m.getFullYear() - 1);
    // Phase 91.44 (Agent Clients H2) — utiliser getMontantHTLivraison (vs prixHT||prix qui gonfle si prixHT absent)
    var caClients12m = livraisons.reduce(function (s, l) {
      if (!l) return s;
      // Exclut brouillons/annulées
      var st = String(l.statut || '').toLowerCase();
      if (st === 'brouillon' || st === 'draft' || st === 'annule' || st === 'annulee' || st === 'annulée') return s;
      var d = parseDate(l.date || l.dateLivraison);
      if (!d || d < seuil12m) return s;
      var ht = (typeof window.getMontantHTLivraison === 'function')
        ? (window.getMontantHTLivraison(l) || 0)
        : (parseFloat(l.prixHT) || (parseFloat(l.prix || 0) / 1.2));
      return s + ht;
    }, 0);
    var cliSubCa = document.getElementById('clients-section-sub-ca');
    var cliSep = document.getElementById('clients-section-sep-ca');
    if (cliSubCa && cliSep) {
      cliSubCa.textContent = 'CA cumulé ' + fmtEuros(caClients12m);
      cliSubCa.style.display = '';
      cliSep.style.display = '';
    }
    var depFourn12m = charges.reduce(function (s, c) {
      if (!c) return s;
      var d = parseDate(c.date);
      if (!d || d < seuil12m) return s;
      return s + (parseFloat(c.montantTTC || c.montant || 0));
    }, 0);
    var frnSubDep = document.getElementById('fournisseurs-section-sub-depenses');
    var frnSep = document.getElementById('fournisseurs-section-sep-depenses');
    if (frnSubDep && frnSep) {
      frnSubDep.textContent = 'Dépenses cumulées ' + fmtEuros(depFourn12m);
      frnSubDep.style.display = '';
      frnSep.style.display = '';
    }

    // ── Clients KPIs ──
    var cliKpiActifs = document.getElementById('clients-kpi-actifs');
    var cliKpiTopNom = document.getElementById('clients-kpi-top-nom');
    var cliKpiTopCa = document.getElementById('clients-kpi-top-ca');
    var cliKpiDso = document.getElementById('clients-kpi-dso');
    var cliKpiEncours = document.getElementById('clients-kpi-encours');
    var cliKpiEncoursNb = document.getElementById('clients-kpi-encours-nb');

    if (cliKpiActifs || cliKpiTopNom || cliKpiEncours) {
      var actifsCli = actifsRecents(clients, livraisons, charges, 'client');
      if (cliKpiActifs) cliKpiActifs.textContent = actifsCli;

      // "+N nouveaux ce mois" pour clients-kpi-actifs-sub (mockup: <span class="up">+3</span> ce mois)
      var cliKpiActifsSub = document.getElementById('clients-kpi-actifs-sub');
      if (cliKpiActifsSub) {
        var moisStart = new Date(); moisStart.setDate(1); moisStart.setHours(0, 0, 0, 0);
        var newThisMois = clients.filter(function (c) {
          if (!c) return false;
          var d = parseDate(c.dateCreation || c.created_at || c.date);
          return d && d >= moisStart;
        }).length;
        if (newThisMois > 0) {
          cliKpiActifsSub.innerHTML = '<span class="up">+' + newThisMois + '</span> ce mois';
        } else {
          cliKpiActifsSub.textContent = '90 derniers jours';
        }
      }

      // CA par client (12 mois)
      var caParClient = {};
      var now12 = new Date(); now12.setFullYear(now12.getFullYear() - 1);
      livraisons.forEach(function (l) {
        if (!l) return;
        var d = parseDate(l.date || l.dateLivraison);
        if (!d || d < now12) return;
        var nom = (l.client && l.client.nom) || l.client || l.clientId || '';
        if (!nom) return;
        caParClient[nom] = (caParClient[nom] || 0) + (parseFloat(l.prixHT || l.prix || 0));
      });
      var topCli = Object.keys(caParClient).sort(function (a, b) { return caParClient[b] - caParClient[a]; })[0];
      // Phase 78 fix : mockup shows val=nom (name), sub=montant (amount)
      if (cliKpiTopNom) cliKpiTopNom.textContent = topCli || '—';
      if (cliKpiTopCa) cliKpiTopCa.textContent = topCli ? fmtEuros(caParClient[topCli]) + ' sur 12m' : '';

      // Encours impayés
      var impayees = livraisons.filter(function (l) {
        if (!l) return false;
        var s = l.statutPaiement || l.statut_paiement || '';
        return s !== 'payé' && s !== 'paye' && s !== 'payee' && s !== 'litige';
      });
      var encours = impayees.reduce(function (s, l) { return s + parseFloat(l.prixTTC || l.prixHT || l.prix || 0); }, 0);
      if (cliKpiEncours) cliKpiEncours.textContent = encours > 0 ? fmtEuros(encours) : '—';
      if (cliKpiEncoursNb) cliKpiEncoursNb.textContent = impayees.length > 0 ? impayees.length + ' facture(s) impayée(s)' : 'À jour';

      // DSO calculé si disponible
      if (cliKpiDso) {
        var dso = (typeof window.calculerDSO === 'function') ? window.calculerDSO(livraisons) : null;
        cliKpiDso.textContent = dso && dso.dso !== null ? dso.dso + ' j' : '—';
      }
    }

    // ── Fournisseurs KPIs ──
    var frnKpiActifs = document.getElementById('fournisseurs-kpi-actifs');
    var frnKpiTopNom = document.getElementById('fournisseurs-kpi-top-nom');
    var frnKpiTopCa = document.getElementById('fournisseurs-kpi-top-ca');
    var frnKpiEncours = document.getElementById('fournisseurs-kpi-encours');
    var frnKpiEncoursNb = document.getElementById('fournisseurs-kpi-encours-nb');
    var frnKpiCat = document.getElementById('fournisseurs-kpi-categorie');
    var frnKpiCatPct = document.getElementById('fournisseurs-kpi-categorie-pct');

    if (frnKpiActifs || frnKpiTopNom || frnKpiEncours) {
      var actifsFrn = actifsRecents(fournisseurs, livraisons, charges, 'fournisseur');
      if (frnKpiActifs) frnKpiActifs.textContent = actifsFrn;

      // Dépenses par fournisseur (12m)
      var depParFrn = {};
      charges.forEach(function (c) {
        if (!c) return;
        var nom = (c.fournisseur && c.fournisseur.nom) || c.fournisseur || c.fournisseurId || '';
        if (!nom) return;
        depParFrn[nom] = (depParFrn[nom] || 0) + parseFloat(c.montant || 0);
      });
      var topFrn = Object.keys(depParFrn).sort(function (a, b) { return depParFrn[b] - depParFrn[a]; })[0];
      // Phase 78 fix : mockup shows val=nom (name), sub=montant (amount)
      if (frnKpiTopNom) frnKpiTopNom.textContent = topFrn || '—';
      if (frnKpiTopCa) frnKpiTopCa.textContent = topFrn ? fmtEuros(depParFrn[topFrn]) + ' sur 12m' : '';

      // Charges à régler
      var chargesImpayees = charges.filter(function (c) {
        if (!c) return false;
        return !c.estPaye && c.estPaye !== true && c.statut !== 'payee' && c.statut !== 'payé';
      });
      var encoursC = chargesImpayees.reduce(function (s, c) { return s + parseFloat(c.montant || 0); }, 0);
      if (frnKpiEncours) frnKpiEncours.textContent = encoursC > 0 ? fmtEuros(encoursC) : '—';
      if (frnKpiEncoursNb) frnKpiEncoursNb.textContent = chargesImpayees.length > 0 ? chargesImpayees.length + ' facture(s) en attente' : 'À jour';

      // Catégorie dominante
      if (frnKpiCat) {
        var catTotaux = {};
        var totalCharges = 0;
        charges.forEach(function (c) {
          if (!c) return;
          var cat = c.categorie || c.type || '—';
          catTotaux[cat] = (catTotaux[cat] || 0) + parseFloat(c.montant || 0);
          totalCharges += parseFloat(c.montant || 0);
        });
        var topCat = Object.keys(catTotaux).sort(function (a, b) { return catTotaux[b] - catTotaux[a]; })[0];
        frnKpiCat.textContent = topCat || '—';
        if (frnKpiCatPct && topCat && totalCharges > 0) {
          frnKpiCatPct.textContent = Math.round(catTotaux[topCat] / totalCharges * 100) + '% des dépenses';
        }
      }
    }
  }

  function tryAttach() {
    if (!document.getElementById('clients-section-sub-total') && !document.getElementById('fournisseurs-section-sub-total') && !document.getElementById('clients-kpi-actifs')) return false;
    update();
    if (!window.__refonteCliFrnIv) {
      window.__refonteCliFrnIv = setInterval(update, 5000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) { var r = 0, iv = setInterval(function(){ if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
    });
  } else {
    if (!tryAttach()) { var r = 0, iv = setInterval(function(){ if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
  }

  window.refonteClientsFournisseursUpdateCounts = update;
})();
