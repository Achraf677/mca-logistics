/**
 * MCA Logistics — Sync admin polling — détecte changements localStorage cross-tab + refresh (Phase X — extraction script.js)
 *
 * Extracted from script.js L4888-4951 (2026-05-16).
 */

/* ========== SYNCHRO ADMIN POLLING ========== */
(function() {
  let pollInterval = null;
  let lastHashes = {};

  function hashData(key) {
    const raw = localStorage.getItem(key) || '';
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  function detecterChangementsAdmin() {
    const sessionRole = sessionStorage.getItem('role');
    if (sessionRole !== 'admin') return;

    const cles = [
      'livraisons','plannings','absences_periodes',
      'inspections','carburant','salaries','vehicules',
      'incidents'
    ];

    const salaries = loadSafe('salaries', []);
    salaries.forEach(s => cles.push('messages_' + s.id));
    salaries.forEach(s => cles.push('km_sal_' + s.id));
    salaries.forEach(s => cles.push('carb_sal_' + s.id));

    let needsRefresh = false;
    cles.forEach(cle => {
      const h = hashData(cle);
      if (lastHashes[cle] !== undefined && lastHashes[cle] !== h) {
        needsRefresh = true;
      }
      lastHashes[cle] = h;
    });

    if (needsRefresh) {
      const pageActive = document.querySelector('.page.active')?.id;
      if (pageActive === 'page-dashboard' && typeof afficherDashboard === 'function') afficherDashboard();
      if (pageActive === 'page-livraisons' && typeof afficherLivraisons === 'function') afficherLivraisons();
      if (pageActive === 'page-heures' && typeof afficherCompteurHeures === 'function') afficherCompteurHeures();
      if (pageActive === 'page-planning' && typeof afficherPlanningSemaine === 'function') afficherPlanningSemaine();
      if (pageActive === 'page-inspections' && typeof afficherInspections === 'function') afficherInspections();
      if (pageActive === 'page-carburant' && typeof afficherCarburant === 'function') afficherCarburant();
      if (pageActive === 'page-salaries' && typeof afficherSalaries === 'function') afficherSalaries();
      if (typeof afficherBadgeAlertes === 'function') afficherBadgeAlertes();
    }
  }

  document.addEventListener('visibilitychange', function() {
    const delay = document.hidden ? 30000 : 5000;
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(detecterChangementsAdmin, delay);
    if (!document.hidden) detecterChangementsAdmin();
  });

  setTimeout(function() {
    detecterChangementsAdmin();
    pollInterval = setInterval(detecterChangementsAdmin, 5000);
  }, 3000);
})();
