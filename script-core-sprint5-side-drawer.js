/**
 * MCA Logistics — Sprint 5 — Side Drawer Pattern (ouvrirDrawer + fermerDrawer + API hooks) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4896-5004 (2026-05-16).
 */

/* ================================================================
   SPRINT 5 — SIDE DRAWER PATTERN
   API publique :
     ouvrirDrawer(titre, contenuHTML)
     ouvrirDrawer({ titre, contenuHTML, onClose, largeur })
     fermerDrawer()
   Exposé globalement pour réutilisation par Sprint 6 (bulk actions)
   et Sprint 8 (vue 360° salarié).
   ================================================================ */
(function() {
  let _drawerOnClose = null;
  let _drawerEscBound = false;
  let _elementFocusAvantOuverture = null;

  function getNodes() {
    return {
      overlay: document.getElementById('side-drawer-overlay'),
      drawer:  document.getElementById('side-drawer'),
      title:   document.getElementById('side-drawer-title'),
      body:    document.getElementById('side-drawer-body')
    };
  }

  function onEscape(e) {
    if (e.key === 'Escape') {
      const { drawer } = getNodes();
      if (drawer && drawer.classList.contains('open')) {
        e.preventDefault();
        window.fermerDrawer();
      }
    }
  }

  window.ouvrirDrawer = function(titreOuOpts, contenuHTML) {
    const { overlay, drawer, title, body } = getNodes();
    if (!drawer || !overlay) {
      console.warn('[ouvrirDrawer] éléments side-drawer introuvables');
      return;
    }

    let titre, contenu, onClose, largeur;
    if (typeof titreOuOpts === 'object' && titreOuOpts !== null) {
      titre     = titreOuOpts.titre     || 'Détails';
      contenu   = titreOuOpts.contenuHTML || titreOuOpts.html || '';
      onClose   = typeof titreOuOpts.onClose === 'function' ? titreOuOpts.onClose : null;
      largeur   = titreOuOpts.largeur || null;
    } else {
      titre   = titreOuOpts || 'Détails';
      contenu = contenuHTML || '';
      onClose = null;
      largeur = null;
    }

    if (title) title.textContent = titre;
    if (body) body.innerHTML = contenu;

    if (largeur) drawer.style.width = largeur;
    else drawer.style.width = '';

    _drawerOnClose = onClose;
    _elementFocusAvantOuverture = document.activeElement;

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');

    // Focus sur le bouton de fermeture après transition
    setTimeout(function() {
      const closeBtn = drawer.querySelector('.side-drawer-close');
      if (closeBtn) closeBtn.focus();
    }, 320);

    if (!_drawerEscBound) {
      document.addEventListener('keydown', onEscape);
      _drawerEscBound = true;
    }
  };

  window.fermerDrawer = function() {
    const { overlay, drawer, body } = getNodes();
    if (!drawer || !overlay) return;

    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');

    // Rend le focus à l'élément précédent
    if (_elementFocusAvantOuverture && typeof _elementFocusAvantOuverture.focus === 'function') {
      try { _elementFocusAvantOuverture.focus(); } catch (_) { /* fail-silent: élément focus original détaché du DOM (a11y best-effort) */ }
      _elementFocusAvantOuverture = null;
    }

    // Callback onClose éventuel
    if (typeof _drawerOnClose === 'function') {
      try { _drawerOnClose(); } catch (e) { console.warn('[fermerDrawer] onClose', e); }
      _drawerOnClose = null;
    }

    // Vide le body après animation pour libérer la mémoire
    setTimeout(function() {
      if (body && !drawer.classList.contains('open')) body.innerHTML = '';
    }, 350);
  };

})();
