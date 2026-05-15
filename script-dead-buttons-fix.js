/* Phase 60 V7 polish — Fix des boutons morts détectés par audit onclick.
   5 fonctions étaient référencées dans admin.html mais non définies en JS :
   - setEncVue(mode) : chips période Jour/Semaine/Mois/Année sur Encaissement
   - navEncPeriode(delta) : flèches navigation période Encaissement
   - reinitialiserEncPeriode() : bouton "Aujourd'hui" Encaissement
   - majBoutonResetCompteur() : enable/disable bouton dans modal-reset-compteur
   - executerResetCompteur() : exécution effective du reset (modal "Réinitialiser livraisons")
*/
(function () {
  'use strict';

  // ============ ENCAISSEMENT — Période nav ============

  function getEncPeriodeState() {
    if (!window._encPeriode) window._encPeriode = { mode: 'mois', offset: 0 };
    return window._encPeriode;
  }

  function refreshEncaissement() {
    // Re-render via script-encaissement.js si présent
    if (typeof window.refonteEncaissementRender === 'function') {
      try { window.refonteEncaissementRender(); } catch (e) { console.warn('[refreshEnc]', e); }
    }
    // Re-render aussi les sections legacy (factures/avoirs/acomptes/relances)
    if (typeof window.refonteEncLegacyRender === 'function') {
      try { window.refonteEncLegacyRender(); } catch (e) { console.warn('[refreshEncLegacy]', e); }
    }
    // Update label période visible
    var state = getEncPeriodeState();
    var label = document.getElementById('enc-mois-label');
    var dates = document.getElementById('enc-mois-dates');
    if (label || dates) {
      var d = new Date();
      var mois = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
      var libelle = '';
      if (state.mode === 'jour') {
        d.setDate(d.getDate() + state.offset);
        libelle = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      } else if (state.mode === 'semaine') {
        d.setDate(d.getDate() + state.offset * 7);
        libelle = 'Semaine du ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      } else if (state.mode === 'annee') {
        var year = d.getFullYear() + state.offset;
        libelle = 'Année ' + year;
      } else {
        d.setMonth(d.getMonth() + state.offset);
        libelle = mois[d.getMonth()] + ' ' + d.getFullYear();
      }
      if (label) label.textContent = libelle;
      if (dates) dates.textContent = '';
    }
  }

  function setEncVue(mode) {
    var state = getEncPeriodeState();
    state.mode = mode;
    state.offset = 0;
    // Active chip visuel
    document.querySelectorAll('.enc-period-chips .btn-chip').forEach(function (b) { b.classList.remove('active'); });
    var clicked = document.querySelector('.enc-period-chips .btn-chip[onclick*="setEncVue(\'' + mode + '\')"]');
    if (clicked) clicked.classList.add('active');
    refreshEncaissement();
  }
  window.setEncVue = setEncVue;

  function navEncPeriode(delta) {
    var state = getEncPeriodeState();
    state.offset += delta;
    refreshEncaissement();
  }
  window.navEncPeriode = navEncPeriode;

  function reinitialiserEncPeriode() {
    var state = getEncPeriodeState();
    state.offset = 0;
    refreshEncaissement();
  }
  window.reinitialiserEncPeriode = reinitialiserEncPeriode;

  // ============ MODAL RESET COMPTEUR LIVRAISONS ============

  function majBoutonResetCompteur() {
    var input = document.getElementById('reset-compteur-input');
    var btn = document.getElementById('btn-reset-compteur-confirm');
    var code = document.getElementById('reset-compteur-code');
    if (!input || !btn || !code) return;
    var expected = (code.textContent || '').trim();
    btn.disabled = ((input.value || '').trim() !== expected);
  }
  window.majBoutonResetCompteur = majBoutonResetCompteur;

  function executerResetCompteur() {
    var input = document.getElementById('reset-compteur-input');
    if (!input || (input.value || '').trim() !== 'RESET LIVRAISONS') {
      if (window.afficherToast) window.afficherToast('Phrase de confirmation incorrecte', 'error');
      return;
    }
    try {
      // Reset le compteur livraisons (la séquence numLiv). Conserve les livraisons existantes.
      // Si tu veux supprimer toutes les livraisons, c'est un autre flow.
      localStorage.removeItem('compteur_livraisons');
      localStorage.removeItem('numLiv_seq');
      localStorage.removeItem('livraisons_counter');
      // Reset audit entrée
      if (typeof window.ajouterEntreeAudit === 'function') {
        window.ajouterEntreeAudit('Compteur livraisons', 'Réinitialisé');
      }
      if (window.afficherToast) window.afficherToast('Compteur de livraisons réinitialisé');
      // Close + reset input
      if (typeof window.closeModal === 'function') window.closeModal('modal-reset-compteur');
      input.value = '';
      majBoutonResetCompteur();
    } catch (e) {
      console.warn('[executerResetCompteur]', e);
      if (window.afficherToast) window.afficherToast('Erreur lors du reset', 'error');
    }
  }
  window.executerResetCompteur = executerResetCompteur;

  // Init : update label encaissement au load + après navigation
  function initEnc() {
    refreshEncaissement();
    var page = document.getElementById('page-encaissement');
    if (page && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () {
        if (page.classList.contains('active')) refreshEncaissement();
      }).observe(page, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnc);
  } else {
    initEnc();
  }
})();
