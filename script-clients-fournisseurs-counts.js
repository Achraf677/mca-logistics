/* Phase 2 PR-F Clients/Fournisseurs section-head counts */
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

  function update() {
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
  }

  function tryAttach() {
    if (!document.getElementById('clients-section-sub-total') && !document.getElementById('fournisseurs-section-sub-total')) return false;
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
