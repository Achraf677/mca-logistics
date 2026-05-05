/**
 * MCA Logistics — Module Core-navigation
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L1271 (script.js d'origine)
function naviguerVers(page) {
  if (!page) return;
  window.__delivproCurrentPage = page;
  if (getRoleSessionCourant() === 'admin') {
    mettreAJourBadgesNav();
  }
  document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) { navItem.classList.add('active'); navItem.setAttribute('aria-current', 'page'); }
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active', 'route-enter');
    setTimeout(() => pageEl.classList.remove('route-enter'), 240);
  }
  const titres = {
    dashboard:'📊 Dashboard', livraisons:'📦 Livraisons', clients:'🧑‍💼 Carnet Clients', fournisseurs:'🏭 Carnet Fournisseurs',
    vehicules:'🚐 Véhicules', carburant:'⛽ Carburant',
    rentabilite:'💰 Rentabilité', statistiques:'📈 Statistiques', tva:'🧾 TVA',
    salaries:'👥 Gestion Salariés', planning:'📅 Planning hebdomadaire',
    alertes:'🔔 Alertes', inspections:'🚗 Inspections véhicules',
    messagerie:'💬 Messagerie interne', parametres:'⚙️ Paramètres',
    charges:'💸 Charges', encaissements:'💳 Encaissements & Avoirs', incidents:'🚨 Incidents / Réclamations', relances:'⏰ Relances paiement', entretiens:'🔧 Carnet d\'entretien',
    heures:'⏱️ Heures & Km',
    'espace-salarie':'Espace salarié'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titres[page] || page;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      switch (page) {
        case 'dashboard':    rafraichirDashboard(); break;
        case 'livraisons':   navLivPeriode('reset',0); afficherLivraisons(); break;
        case 'vehicules':    afficherVehicules(); break;
        case 'carburant':    navCarbMois(0); break;
        case 'rentabilite':
          afficherRentabilite();
          if (typeof afficherRentabiliteParVehicule === 'function') afficherRentabiliteParVehicule();
          break;
        case 'statistiques': afficherStatistiques(); break;
        case 'salaries':
          afficherSalaries();
          break;
        case 'heures':       navHeuresSemaine(0); break;
        case 'planning':     afficherPlanning(); afficherPlanningSemaine(); peuplerAbsenceSal(); afficherAbsencesPeriodes(); initFormulairePlanningRapide(); break;
        case 'alertes':      verifierNotificationsAutomatiquesMois2(); verifierDocumentsSalaries(); afficherAlertes(); break;
        case 'inspections':  navInspSemaine(0); break;
        case 'clients':      afficherClientsDashboard(); break;
        case 'fournisseurs': afficherFournisseursDashboard(); break;
        case 'charges':      navChargesMois(0); break;
        case 'tva':          navTvaPeriode(0); afficherTva(); break;
        case 'incidents':    afficherIncidents(); break;
        case 'entretiens':   navEntrMois(0); break;
        case 'parametres':   chargerParametres(); break;
        case 'espace-salarie': chargerCadreSalarieUnifie(); break;
      }
    });
  });
}

// L1528 (script.js d'origine)
function planifierRafraichissementSiPageActive(pageId, cle, callback) {
  if (getPageActiveAdminId() !== pageId) return;
  planifierRafraichissementStorage(cle, callback);
}

// L2619 (script.js d'origine)
function calNaviguer(delta) {
  _calMois = new Date(_calMois.getFullYear(), _calMois.getMonth() + delta, 1);
  afficherCalendrier();
}

// L2785 (script.js d'origine)
function mettreAJourBadgesNav() {
  // Badge incidents ouverts
  const incOpen = charger('incidents').filter(i=>i.statut==='ouvert').length;
  const badgeInc = document.getElementById('badge-incidents-nav');
  if (badgeInc) { badgeInc.textContent=incOpen; badgeInc.style.display=incOpen>0?'inline-flex':'none'; }

  // Badge relances
  const delai   = parseInt(localStorage.getItem('relance_delai')||'7', 10);
  const limite  = new Date(); limite.setDate(limite.getDate()-delai);
  const limStr  = limite.toLocalISODate();
  const relOpen = charger('livraisons').filter(l=>
    l.statut==='livre' && (l.statutPaiement==='en-attente'||!l.statutPaiement) && l.prix>0 && l.date<=limStr
  ).length;
  const badgeRel = document.getElementById('badge-relances');
  if (badgeRel) { badgeRel.textContent=relOpen; badgeRel.style.display=relOpen>0?'inline-flex':'none'; }
}

// L3086 (script.js d'origine)
function initSwipeSidebar() {
  let startX = 0, isDragging = false;
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.changedTouches[0].clientX - startX;
    if (diff > 60 && startX < 40) ouvrirMenuMobile();
    if (diff < -60) fermerMenuMobile();
  }, { passive: true });
}

// BUGFIX v3.68 : auto-refresh PC quand la date change pendant que la PWA est
// restee ouverte (ex: passage avril -> mai a minuit). Sans ca, les ecrans avec
// selecteur de mois (Charges/TVA/Rentabilite/Stats/Heures) gardent les chiffres
// du mois precedent jusqu'au prochain clic.
//
// Strategie : checkDateChange() compare la date courante a celle du dernier
// render. Triggers : visibilitychange (user revient sur l'onglet),
// focus (clic sur la fenetre), setInterval 5 min (cas user continu sans
// trigger UI).
(function setupDateChangeWatcher() {
  if (typeof document === 'undefined') return;
  var lastRenderDate = new Date().toLocaleDateString('fr-FR');
  function checkDateChange() {
    try {
      var today = new Date().toLocaleDateString('fr-FR');
      if (today !== lastRenderDate) {
        lastRenderDate = today;
        var currentPage = window.__delivproCurrentPage;
        if (currentPage && typeof naviguerVers === 'function') {
          naviguerVers(currentPage);
        }
      }
    } catch (_) { /* fail silent */ }
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkDateChange();
  });
  window.addEventListener('focus', checkDateChange);
  // Fallback : check toutes les 5 min meme sans trigger UI (cas user actif sans focus/blur)
  setInterval(checkDateChange, 5 * 60 * 1000);
})();

// L4173 (script.js d'origine)
function naviguerSemaine(delta) {
  if (delta === 0) _planningSemaineOffset = 0;
  else _planningSemaineOffset += delta;
  afficherPlanningSemaine();
}

