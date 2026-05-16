/* H12 — Rentabilité KPI grid (rent-kpi-ca / rent-kpi-charges / rent-kpi-marge / rent-kpi-cout-km)
   Calcule sur le mois courant depuis localStorage. Re-render quand page-rentabilite devient active. */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function euros(v) {
    if (v == null || isNaN(v)) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function update() {
    if (!document.getElementById('rent-kpi-ca')) return;

    var now = new Date();
    var moisDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    var moisFin   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    var livraisons = lire('livraisons');
    var charges = lire('charges');
    var carburant = lire('carburant');

    // CA HT du mois : sum livraisons dans la période
    // Phase 91.36 — utilise getMontantHTLivraison() si dispo (formule unique) au lieu du fallback `montant` TTC
    // qui drift de 20% TVA en cas d'absence de prixHT explicite.
    var caHT = 0, kmTotal = 0;
    var getHT = (typeof window.getMontantHTLivraison === 'function') ? window.getMontantHTLivraison : null;
    livraisons.forEach(function (l) {
      var d = (l.dateLivraison || l.dateLiv || l.date || '');
      if (d >= moisDebut && d <= moisFin) {
        var htVal = getHT ? getHT(l) : parseFloat(l.prixHT || l.montantHT || 0);
        if (!htVal && l.prix) {
          // Fallback : si prix TTC seul, déduire HT via taux TVA livraison
          var taux = parseFloat(l.tauxTVA || 20) / 100;
          htVal = parseFloat(l.prix) / (1 + taux);
        }
        caHT += htVal || 0;
        kmTotal += parseFloat(l.distance || l.km || l.kilometres || 0);
      }
    });

    // Charges du mois (charges fixes + carburant + entretiens)
    var totalCharges = 0;
    charges.forEach(function (c) {
      var d = (c.date || c.dateFacture || '');
      if (d >= moisDebut && d <= moisFin) {
        totalCharges += parseFloat(c.montant || c.montantHT || 0);
      }
    });
    carburant.forEach(function (c) {
      var d = (c.date || '');
      if (d >= moisDebut && d <= moisFin) {
        totalCharges += parseFloat(c.montant || c.cout || 0);
      }
    });

    var marge = caHT > 0 ? ((caHT - totalCharges) / caHT * 100) : 0;
    var coutKm = kmTotal > 0 ? totalCharges / kmTotal : 0;

    setText('rent-kpi-ca', euros(caHT));
    setText('rent-kpi-charges', euros(totalCharges));
    setText('rent-kpi-marge', caHT > 0 ? marge.toFixed(1).replace('.', ',') + ' %' : '—');
    setText('rent-kpi-cout-km', coutKm > 0 ? euros(coutKm) + '/km' : '—');

    // Phase 89 : kpi-sub dynamic values
    var livsCount = livraisons.filter(function(l) { var d = (l.dateLivraison || l.dateLiv || l.date || ""); return d >= moisDebut && d <= moisFin; }).length;
    setText("rent-kpi-ca-sub", livsCount > 0 ? livsCount + " livraison" + (livsCount > 1 ? "s" : "") : "Hors taxes");
    var margeEur = caHT - totalCharges;
    if (margeEur !== 0) {
      var margeEl = document.getElementById("rent-kpi-marge-sub");
      if (margeEl) margeEl.innerHTML = margeEur > 0 ? "<span class=\"up\">" + euros(margeEur) + "</span> de marge" : "<span class=\"down\">" + euros(margeEur) + "</span> deficit";
    }
    if (kmTotal > 0) setText("rent-kpi-cout-km-sub", Math.round(kmTotal) + " km au total");
  }

  function init() {
    update();
    var page = document.getElementById('page-rentabilite');
    if (page && typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        if (page.classList.contains('active')) update();
      });
      obs.observe(page, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refonteRentKpisUpdate = update;
})();
