/* ==========================================================================
   MCA Logistics — Livraisons chips toolbar handler (Phase 2 / PR-B)

   Synchronise les chips .ds-chip de #livraisons-chips-toolbar avec
   #filtre-statut (select prod). Compte les livraisons par statut via
   MutationObserver sur #tb-livraisons.

   Aucun changement script.js / script-livraisons.js requis.
   ========================================================================== */

(function () {
  'use strict';

  // --- Lire les livraisons brutes
  function lireLivraisons() {
    try {
      return JSON.parse(localStorage.getItem('livraisons') || '[]') || [];
    } catch (_) {
      return [];
    }
  }

  // --- Determine si une livraison est en retard (date livraison passee + statut != livre)
  function estEnRetard(l) {
    var statut = (l && (l.statut || l.status) || '').toLowerCase();
    if (statut === 'livre' || statut === 'livré' || statut === 'livree') return false;
    var dateLiv = l && (l.dateLivraison || l.dateLiv || l.date);
    if (!dateLiv) return false;
    try {
      var d = new Date(dateLiv);
      if (isNaN(d.getTime())) return false;
      var aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);
      return d < aujourdhui;
    } catch (_) { return false; }
  }

  // --- Compter par statut
  function computerCounts() {
    var livs = lireLivraisons();
    var counts = { all: 0, 'en-cours': 0, livre: 0, 'en-attente': 0, retard: 0 };
    for (var i = 0; i < livs.length; i++) {
      var l = livs[i] || {};
      counts.all += 1;
      var statut = (l.statut || l.status || '').toLowerCase();
      if (statut === 'en-cours' || statut === 'en cours') counts['en-cours'] += 1;
      else if (statut === 'livre' || statut === 'livré' || statut === 'livree') counts.livre += 1;
      else if (statut === 'en-attente' || statut === 'en attente' || statut === '') counts['en-attente'] += 1;
      if (estEnRetard(l)) counts.retard += 1;
    }
    return counts;
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function updateCounts() {
    if (!document.getElementById('livraisons-chips-toolbar')) return;
    var c;
    try { c = computerCounts(); }
    catch (e) { console.warn('[livraisons-chips]', e); return; }
    setText('livraisons-chip-count-all', c.all);
    setText('livraisons-chip-count-en-cours', c['en-cours']);
    setText('livraisons-chip-count-livre', c.livre);
    setText('livraisons-chip-count-en-attente', c['en-attente']);
    setText('livraisons-chip-count-retard', c.retard);
    // Section-head sub-meta
    setText('livraisons-section-sub-count', c.all);
    var periodeLabel = (document.getElementById('liv-periode-label') || {}).textContent || '';
    setText('livraisons-section-sub-mois', periodeLabel || 'Période courante');
  }

  // --- Chip click handler
  window.appliquerChipLivraisons = function (statut) {
    var select = document.getElementById('filtre-statut');
    if (!select) return;
    // Le filtre "retard" n'existe pas dans le select prod -> fallback : statut vide + appliquer la logique cote table via afficherLivraisons() qui peut detecter retards.
    // Pour les autres : on set la valeur du select et trigger change.
    var supported = ['', 'en-cours', 'livre', 'en-attente'];
    if (supported.indexOf(statut) !== -1) {
      select.value = statut || '';
      try {
        var ev = new Event('change', { bubbles: true });
        select.dispatchEvent(ev);
      } catch (_) {
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      }
    } else if (statut === 'retard') {
      // Pas de filtre retard natif : reset select + appliquer recherche visuelle (l'utilisateur verra les ratees dans la table).
      select.value = '';
      try { var ev = new Event('change', { bubbles: true }); select.dispatchEvent(ev); } catch (_) {}
    }
    // Update chips visual state
    var chips = document.querySelectorAll('#livraisons-chips-toolbar .ds-chip');
    chips.forEach(function (c) {
      var matches = (c.getAttribute('data-livraisons-statut') || '') === (statut || '');
      c.classList.toggle('active', matches);
      c.setAttribute('aria-selected', matches ? 'true' : 'false');
    });
  };

  // --- Hook : update counts quand #tb-livraisons change
  function attachObserver() {
    var tbody = document.getElementById('tb-livraisons');
    if (!tbody || tbody.__livraisonsChipsObserverAttached) return;
    var observer = new MutationObserver(function () {
      if (tbody.__livraisonsChipsRaf) cancelAnimationFrame(tbody.__livraisonsChipsRaf);
      tbody.__livraisonsChipsRaf = requestAnimationFrame(updateCounts);
    });
    observer.observe(tbody, { childList: true, subtree: false });
    tbody.__livraisonsChipsObserverAttached = true;
    updateCounts();
  }

  function tryAttach() {
    if (document.getElementById('livraisons-chips-toolbar') && document.getElementById('tb-livraisons')) {
      attachObserver();
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) {
        var retries = 0;
        var iv = setInterval(function () {
          if (tryAttach() || ++retries > 20) clearInterval(iv);
        }, 500);
      }
    });
  } else {
    if (!tryAttach()) {
      var retries = 0;
      var iv = setInterval(function () {
        if (tryAttach() || ++retries > 20) clearInterval(iv);
      }, 500);
    }
  }

  window.refonteLivraisonsUpdateCounts = updateCounts;
})();
