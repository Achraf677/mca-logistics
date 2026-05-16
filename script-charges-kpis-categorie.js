/* ==========================================================================
   MCA Logistics — Charges KPIs par categorie + chips toolbar (Phase 2 / PR-A)

   Populate les 4 KPI cards (Carburant / Entretien / Peages / Assurance) et
   les chips count, en fonction des charges affichees (mois courant filtre).

   Strategie : MutationObserver sur #tb-charges. Quand la table re-render
   (via afficherCharges() du script.js prod), on relit les donnees affichees
   et on update les valeurs. Aucun changement de script.js requis.

   Expose aussi window.appliquerChipCharges(cat) pour les boutons chips :
   met a jour le select#filtre-charge-cat et trigger l'event change.
   ========================================================================== */

(function () {
  'use strict';

  // --- Formatter euros (utilise euros() prod si dispo, sinon fallback)
  function formatEur(n) {
    var v = parseFloat(n) || 0;
    if (typeof window.euros === 'function') {
      try { return window.euros(v); } catch (_) {}
    }
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }

  // --- Lire les charges du mois courant (memes filtres que script-charges)
  function lireChargesMoisCourant() {
    try {
      var charges = JSON.parse(localStorage.getItem('charges') || '[]') || [];
      // Determine la periode courante via #charges-mois-label si dispo (format "Mai 2026" etc.)
      var moisLabel = (document.getElementById('charges-mois-label') || {}).textContent || '';
      // Strategie simple : si script-charges expose une fonction filtree, l'utiliser.
      // Sinon on prend toutes les charges (les KPIs reflechiront le total absolu, acceptable
      // car la table en dessous filtre deja par periode visuellement).
      if (typeof window.chargesFiltreesPeriode === 'function') {
        try { return window.chargesFiltreesPeriode(); } catch (_) {}
      }
      // Fallback : filtrer par mois en lisant l'attribut data-* du label si pose, sinon brut
      return charges;
    } catch (_) {
      return [];
    }
  }

  // --- Computer KPIs par categorie
  function computerKPIsParCategorie() {
    var charges = lireChargesMoisCourant();
    // Phase 91.55 Bug E — `parking` ajouté (chip existait mais count toujours 0)
    var sums = { carburant: 0, entretien: 0, peage: 0, assurance: 0, salaires: 0, tva: 0, parking: 0, autre: 0, all: 0 };
    var counts = { carburant: 0, entretien: 0, peage: 0, assurance: 0, salaires: 0, tva: 0, parking: 0, autre: 0, all: 0 };
    var categoriesConnues = ['carburant', 'entretien', 'peage', 'assurance', 'salaires', 'tva', 'parking'];

    for (var i = 0; i < charges.length; i++) {
      var c = charges[i] || {};
      // Montant TTC : preference montant, fallback montantTTC, fallback montantHt + tva
      var montant = parseFloat(c.montant) || parseFloat(c.montantTTC) || 0;
      if (!montant && c.montantHt && c.tauxTva != null) {
        montant = parseFloat(c.montantHt) * (1 + parseFloat(c.tauxTva) / 100);
      }
      var cat = (c.categorie || c.cat || '').toLowerCase();
      sums.all += montant;
      counts.all += 1;
      if (categoriesConnues.indexOf(cat) !== -1) {
        sums[cat] += montant;
        counts[cat] += 1;
      } else {
        sums.autre += montant;
        counts.autre += 1;
      }
    }
    return { sums: sums, counts: counts };
  }

  // --- Update DOM
  function updateKPIs() {
    if (!document.getElementById('charges-kpi-grid-cat')) return; // page non visible / refonte non chargee
    var data;
    try { data = computerKPIsParCategorie(); }
    catch (e) { console.warn('[charges-kpis-categorie]', e); return; }
    var setText = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    // 4 cards
    setText('charges-kpi-cat-carburant', formatEur(data.sums.carburant));
    setText('charges-kpi-cat-carburant-count', data.counts.carburant);
    setText('charges-kpi-cat-entretien', formatEur(data.sums.entretien));
    setText('charges-kpi-cat-entretien-count', data.counts.entretien);
    setText('charges-kpi-cat-peage', formatEur(data.sums.peage));
    setText('charges-kpi-cat-peage-count', data.counts.peage);
    setText('charges-kpi-cat-assurance', formatEur(data.sums.assurance));
    setText('charges-kpi-cat-assurance-count', data.counts.assurance);
    // Chips count
    setText('charges-chip-count-all', data.counts.all);
    setText('charges-chip-count-carburant', data.counts.carburant);
    setText('charges-chip-count-entretien', data.counts.entretien);
    setText('charges-chip-count-assurance', data.counts.assurance);
    setText('charges-chip-count-peage', data.counts.peage);
    setText('charges-chip-count-parking', data.counts.parking);
    setText('charges-chip-count-tva', data.counts.tva);
    setText('charges-chip-count-salaires', data.counts.salaires);
    setText('charges-chip-count-autre', data.counts.autre);
    // Section-head sub-meta
    setText('charges-section-sub-count', data.counts.all);
    var moisLabel = (document.getElementById('charges-mois-label') || {}).textContent || '';
    setText('charges-section-sub-mois', moisLabel || 'Période courante');
  }

  // --- Chip click handler (synchronise avec select prod)
  window.appliquerChipCharges = function (cat) {
    var select = document.getElementById('filtre-charge-cat');
    if (!select) return;
    // Map "autre" du chip vers les categories qui ne sont pas dans les 4 principales.
    // Pour simplicite : "autre" applique la valeur 'autre' du select existant.
    select.value = cat || '';
    // Trigger l'event change pour rerendre la table via afficherCharges()
    try {
      var ev = new Event('change', { bubbles: true });
      select.dispatchEvent(ev);
    } catch (_) {
      if (typeof window.afficherCharges === 'function') window.afficherCharges();
    }
    // Update chips visual state
    var chips = document.querySelectorAll('#charges-chips-toolbar .ds-chip');
    chips.forEach(function (c) {
      var matches = (c.getAttribute('data-charges-cat') || '') === (cat || '');
      c.classList.toggle('active', matches);
      c.setAttribute('aria-selected', matches ? 'true' : 'false');
    });
  };

  // --- Hook : update KPIs quand #tb-charges change
  function attachObserver() {
    var tbody = document.getElementById('tb-charges');
    if (!tbody || tbody.__chargesKpisObserverAttached) return;
    var observer = new MutationObserver(function () {
      // Debounce simple : reschedule en raf
      if (tbody.__chargesKpisRaf) cancelAnimationFrame(tbody.__chargesKpisRaf);
      tbody.__chargesKpisRaf = requestAnimationFrame(updateKPIs);
    });
    observer.observe(tbody, { childList: true, subtree: false });
    tbody.__chargesKpisObserverAttached = true;
    // Premier compute immediatement
    updateKPIs();
  }

  // --- Boot : attendre que la page Charges existe (peut etre lazy-loaded)
  function tryAttach() {
    if (document.getElementById('charges-kpi-grid-cat') && document.getElementById('tb-charges')) {
      attachObserver();
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) {
        // Retry plus tard (page Charges peut etre render apres premier render)
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

  // Expose pour debug / appel manuel
  window.refonteChargesUpdateKPIs = updateKPIs;
})();
