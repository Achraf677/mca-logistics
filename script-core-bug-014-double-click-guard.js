/**
 * MCA Logistics — BUG-014 double-click guard sur boutons d'action critiques (anti-doublons) (Phase X — extraction script.js)
 *
 * Extracted from script.js L40-76 (2026-05-16).
 */

// BUG-014 fix : guard double-clic — debounce sur boutons d'action (Créer/Générer/Valider/Enregistrer/Payer/Sauvegarder).
// Détecte via label + attributs. Ignore les boutons de fermeture, navigation, tri, etc.
(function() {
  if (window.__delivproDoubleClickGuardInstalled) return;
  window.__delivproDoubleClickGuardInstalled = true;
  const GUARD_DELAY_MS = 700;
  const DECLENCHEURS = /^(cr[ée]er|g[ée]n[ée]rer|valider|enregistrer|sauvegarder|payer|confirmer|envoyer|ajouter|soumettre|transmettre)/i;
  function estBoutonAction(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.tagName !== 'BUTTON') return false;
    if (el.type === 'reset') return false;
    if (el.hasAttribute('data-no-guard')) return false;
    if (el.closest('.modal-header, .modal-close, .sidebar, .topbar-user-menu, .pagination, thead, .filters')) return false;
    const txt = (el.textContent || '').trim();
    if (!txt) return false;
    if (el.classList.contains('btn-primary') || el.classList.contains('btn-success')) return DECLENCHEURS.test(txt);
    return DECLENCHEURS.test(txt);
  }
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!estBoutonAction(btn)) return;
    if (btn.__delivproBusy) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    btn.__delivproBusy = true;
    const prevDisabled = btn.disabled;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    setTimeout(function() {
      btn.__delivproBusy = false;
      btn.disabled = prevDisabled;
      btn.removeAttribute('aria-busy');
    }, GUARD_DELAY_MS);
  }, true);
})();
