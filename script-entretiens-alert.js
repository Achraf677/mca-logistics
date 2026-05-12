// Phase 51 refonte HTML — Entretiens alert banner post-render
// Reads localStorage.vehicules to find vehicles with CT due < 30 days and shows a banner.
(function () {
  'use strict';

  function showAlertBanner() {
    var banner = document.getElementById('entr-alert-banner');
    var text = document.getElementById('entr-alert-banner-text');
    if (!banner || !text) return;

    var vehicules = [];
    try { vehicules = JSON.parse(localStorage.getItem('vehicules') || '[]'); } catch (e) {}
    if (!vehicules.length) return;

    var now = Date.now();
    var alerts = [];

    vehicules.forEach(function (v) {
      var nom = (v.marque || '') + ' ' + (v.modele || v.immatriculation || '');
      var immat = v.immatriculation || v.immat || '';

      // CT date
      var ctDate = v.date_prochain_ct || v.prochainCT || v.prochain_ct || null;
      if (ctDate) {
        var diff = Math.round((new Date(ctDate) - now) / 86400000);
        if (diff >= 0 && diff <= 30) {
          alerts.push('<strong>' + (immat || nom).trim() + '</strong> — CT dans ' + diff + ' jour' + (diff !== 1 ? 's' : ''));
        } else if (diff < 0) {
          alerts.push('<strong>' + (immat || nom).trim() + '</strong> — CT expiré');
        }
      }

      // Révision km — if km_prochain_entretien - km_actuel < 2000
      var kmActuel = parseInt(v.kilometrage || v.km_actuel || 0, 10);
      var kmProchain = parseInt(v.km_prochain_entretien || v.prochainEntretienKm || 0, 10);
      if (kmProchain && kmActuel && (kmProchain - kmActuel) < 2000) {
        alerts.push('<strong>' + (immat || nom).trim() + '</strong> — révision &lt; 2 000 km');
      }
    });

    if (!alerts.length) return;

    var count = alerts.length;
    text.innerHTML = count + ' véhicule' + (count > 1 ? 's' : '') + ' nécessit' + (count > 1 ? 'ent' : 'e') + ' une intervention — ' + alerts.join(', ');
    banner.style.display = 'flex';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(showAlertBanner, 200); });
  } else {
    setTimeout(showAlertBanner, 200);
  }

  // Re-check when navigating to page
  document.addEventListener('click', function (e) {
    var nav = e.target.closest && e.target.closest('.nav-item[data-page="entretiens"]');
    if (nav) setTimeout(showAlertBanner, 400);
  });
})();
