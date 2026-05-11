/* ==========================================================================
   MCA Logistics — Title Row mirrors (Phase 7 / Refonte HTML pixel-perfect)

   Pour chaque page, populate le bloc .title-row avec H1 + sub-meta count.
   Lit les donnees depuis localStorage (via window.charger) et expose des
   helpers globaux pour mise a jour manuelle.

   Pattern : chaque page a un <div class="title-row"> avec :
   - <h1 class="page-title">Nom de la page</h1>
   - <div class="sub-meta"> ... </div>

   Les IDs sub-meta sont prefixes par <page>-titlerow-*.
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

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val);
  }

  function show(id, vis) {
    var el = document.getElementById(id);
    if (el) el.style.display = vis ? '' : 'none';
  }

  function nowMonthLabel() {
    var d = new Date();
    var mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return mois[d.getMonth()] + ' ' + d.getFullYear();
  }

  function thisMonth(date) {
    if (!date) return false;
    try {
      var d = new Date(date);
      var now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch (_) { return false; }
  }

  // ============ CLIENTS ============
  function updateClients() {
    var clients = readArr('clients');
    var actifs = clients.filter(function (c) {
      var date = c.derniereLivraison || c.dateCreation;
      if (!date) return false;
      try {
        var d = new Date(date);
        var diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 90;
      } catch (_) { return false; }
    }).length;
    setText('clients-titlerow-total', clients.length);
    setText('clients-titlerow-actifs', actifs);
  }

  // ============ FOURNISSEURS ============
  function updateFournisseurs() {
    var frn = readArr('fournisseurs');
    var actifs = frn.filter(function (f) {
      var date = f.derniereCharge || f.dateCreation;
      if (!date) return false;
      try {
        var d = new Date(date);
        var diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 90;
      } catch (_) { return false; }
    }).length;
    setText('fournisseurs-titlerow-total', frn.length);
    setText('fournisseurs-titlerow-actifs', actifs);
  }

  // ============ VEHICULES ============
  function updateVehicules() {
    var veh = readArr('vehicules');
    var alertes = veh.filter(function (v) {
      var ct = v.dateProchainCT || v.dateCT;
      var ass = v.dateFinAssurance || v.dateAssurance;
      var soon = function (d) {
        if (!d) return false;
        try {
          var t = new Date(d).getTime();
          var diff = (t - Date.now()) / (1000 * 60 * 60 * 24);
          return diff <= 60;
        } catch (_) { return false; }
      };
      return soon(ct) || soon(ass);
    }).length;
    setText('vehicules-titlerow-total', veh.length);
    setText('vehicules-titlerow-alertes', alertes);
    show('vehicules-titlerow-alertes-wrap', alertes > 0);
  }

  // ============ CARBURANT ============
  function updateCarburant() {
    var carb = readArr('carburant');
    var ceMois = carb.filter(function (c) { return thisMonth(c.date); }).length;
    var total = carb.reduce(function (s, c) { return s + (Number(c.montant) || 0); }, 0);
    setText('carburant-titlerow-total', carb.length);
    setText('carburant-titlerow-cemois', ceMois);
    setText('carburant-titlerow-montant', (total | 0).toLocaleString('fr-FR') + ' €');
  }

  // ============ ENTRETIENS ============
  function updateEntretiens() {
    var ent = readArr('entretiens');
    var aVenir = ent.filter(function (e) {
      if (e.fait || e.statut === 'fait' || e.statut === 'effectue') return false;
      var d = e.datePrevue || e.date;
      if (!d) return false;
      try {
        var t = new Date(d).getTime();
        var diff = (t - Date.now()) / (1000 * 60 * 60 * 24);
        return diff <= 30 && diff >= -7;
      } catch (_) { return false; }
    }).length;
    setText('entretiens-titlerow-total', ent.length);
    setText('entretiens-titlerow-avenir', aVenir);
    show('entretiens-titlerow-avenir-wrap', aVenir > 0);
  }

  // ============ CHARGES ============
  function updateCharges() {
    var ch = readArr('charges');
    var ceMois = ch.filter(function (c) { return thisMonth(c.date); });
    var totalMois = ceMois.reduce(function (s, c) { return s + (Number(c.montant) || 0); }, 0);
    var aPayer = ch.filter(function (c) {
      var statut = (c.statut || '').toLowerCase();
      return statut === 'a_payer' || statut === 'à payer' || statut === '';
    }).length;
    setText('charges-titlerow-cemois', ceMois.length);
    setText('charges-titlerow-montant', (totalMois | 0).toLocaleString('fr-FR') + ' €');
    setText('charges-titlerow-apayer', aPayer);
    show('charges-titlerow-apayer-wrap', aPayer > 0);
  }

  // ============ ALERTES ============
  function updateAlertes() {
    var al = readArr('alertes_admin');
    var actives = al.filter(function (a) { return !a.lu && !a.traitee && !a.ignoree; });
    var critiques = actives.filter(function (a) { return a.niveau === 'critical' || a.niveau === 'haute'; }).length;
    setText('alertes-titlerow-actives', actives.length);
    setText('alertes-titlerow-critiques', critiques);
    show('alertes-titlerow-critiques-wrap', critiques > 0);
  }

  // ============ PLANNING ============
  function updatePlanning() {
    var pl = readArr('plannings_hebdo');
    // Compter salariés planifiés cette semaine
    var salaries = readArr('salaries');
    setText('planning-titlerow-total', pl.length);
    setText('planning-titlerow-salaries', salaries.length);
  }

  // ============ MAIN UPDATE ============
  function updateAll() {
    try { updateClients(); } catch (e) {}
    try { updateFournisseurs(); } catch (e) {}
    try { updateVehicules(); } catch (e) {}
    try { updateCarburant(); } catch (e) {}
    try { updateEntretiens(); } catch (e) {}
    try { updateCharges(); } catch (e) {}
    try { updateAlertes(); } catch (e) {}
    try { updatePlanning(); } catch (e) {}
  }

  function setupHook() {
    updateAll();
    // Re-render quand on navigue de page (les titles-row apparaissent)
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && (t.matches && t.matches('[onclick*="naviguerVers"]') || t.closest && t.closest('[onclick*="naviguerVers"]'))) {
        setTimeout(updateAll, 100);
      }
    }, true);
    // Re-render périodique (couvre les updates async Supabase)
    setInterval(updateAll, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHook);
  } else {
    setupHook();
  }

  window.refonteTitlerowUpdate = updateAll;
})();
