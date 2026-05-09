/**
 * MCA Logistics — Edit Locks Bootstrap (PR #51)
 *
 * Wrappe les 6 entry-points d'edition (PC + mobile) avec le helper
 * EditLocksV2 (DB-backed, table edit_locks). Pattern non intrusif :
 * on intercepte la fonction globale, on tente acquireLock, et si le verrou
 * est detenu par un autre user on bloque + affiche la modale de conflit.
 *
 * Mapping table -> fonction wrappee :
 *   - livraisons   <- ouvrirEditLivraison
 *   - charges      <- ouvrirEditCharge
 *   - clients      <- ouvrirEditClient
 *   - fournisseurs <- ouvrirEditFournisseur (Phase 2)
 *   - vehicules    <- ouvrirEditVehicule    (Phase 2)
 *   - salaries     <- ouvrirEditSalarie     (Phase 2)
 *
 * Phase 1 (cette PR) : Livraisons + Charges + Clients sur PC + mobile.
 * Phase 2 (PR de suivi) : 3 entites restantes + badges visuels sur listes.
 *
 * Le wrapping se fait au DOMContentLoaded apres un setTimeout pour laisser
 * les modules metiers definir leurs fonctions globales. Si la fonction n'est
 * pas trouvee on logue un warn et on n'echoue pas (degrade gracieux).
 *
 * Cleanup : un MutationObserver surveille la classe `open` sur les modals
 * d'edition (modal-edit-livraison, modal-edit-charge, modal-edit-client) et
 * declenche releaseLock + clearInterval(refresh) a la fermeture.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // Mapping fonction -> { table, modalId, idAccessor }
  const WRAPS = [
    { fn: 'ouvrirEditLivraison',   table: 'livraisons', modalId: 'modal-edit-livraison' },
    { fn: 'ouvrirEditCharge',      table: 'charges',    modalId: 'modal-edit-charge' },
    { fn: 'ouvrirEditClient',      table: 'clients',    modalId: 'modal-edit-client' },
    // Phase 2 — non actif tant que la PR de suivi n'est pas mergee
    // { fn: 'ouvrirEditFournisseur', table: 'fournisseurs', modalId: 'modal-edit-fournisseur' },
    // { fn: 'ouvrirEditVehicule',    table: 'vehicules',    modalId: 'modal-vehicule' },
    // { fn: 'ouvrirEditSalarie',     table: 'salaries',     modalId: 'modal-edit-salarie' },
  ];

  // Tracking : table+id en cours -> { intervalId }
  const ACTIVE = Object.create(null);

  function wrapEditFunction(spec) {
    const original = window[spec.fn];
    if (typeof original !== 'function') {
      // Module pas charge (ex: PC seulement charge script-clients.js, mobile non)
      return false;
    }
    if (original.__editLockWrapped) return true;

    const wrapped = async function (id, ...rest) {
      if (!window.EditLocksV2 || !id) {
        return original.call(this, id, ...rest);
      }
      const r = await window.EditLocksV2.acquireLock(spec.table, id);
      if (!r.success) {
        // Conflit : afficher modale (gere force-unlock admin)
        const action = await _showConflictModalSafe(spec.table, id, r.owner, r.expires_in_s);
        if (action !== 'forced') return; // user a annule
        const r2 = await window.EditLocksV2.acquireLock(spec.table, id);
        if (!r2.success) {
          (window.afficherToast || window.M?.toast || alert)(
            'Impossible de prendre le verrou (réessayez)', 'error'
          );
          return;
        }
      }
      // Lock acquis : appeler la fonction d'origine
      const ret = await Promise.resolve(original.call(this, id, ...rest));
      // Configurer refresh + auto-release au close du modal
      _trackActiveLock(spec, id);
      return ret;
    };
    wrapped.__editLockWrapped = true;
    window[spec.fn] = wrapped;
    return true;
  }

  function _trackActiveLock(spec, id) {
    const key = spec.table + ':' + String(id);
    // Cleanup eventuel ancien tracker
    if (ACTIVE[key]) {
      clearInterval(ACTIVE[key].intervalId);
    }
    const intervalId = setInterval(function () {
      window.EditLocksV2 && window.EditLocksV2.refreshLock(spec.table, id).catch(function () {});
    }, (window.EditLocksV2 && window.EditLocksV2.REFRESH_INTERVAL_MS) || 60000);
    ACTIVE[key] = { intervalId: intervalId };

    // Observer le modal pour detecter la fermeture (classList.remove('open')
    // ou suppression du DOM). On utilise un MutationObserver attribut + un
    // fallback timer toutes les 2s.
    const modal = document.getElementById(spec.modalId);
    if (modal) {
      const obs = new MutationObserver(function () {
        if (!modal.classList.contains('open')) {
          _releaseAndCleanup(spec, id);
          obs.disconnect();
        }
      });
      try { obs.observe(modal, { attributes: true, attributeFilter: ['class'] }); }
      catch (_) {}
      ACTIVE[key].observer = obs;
    } else {
      // Pas de modal trouve (mobile peut utiliser une sheet) : timeout de
      // securite a LOCK_DURATION_S * 2 pour eviter de leaker des locks
      const safety = setTimeout(function () { _releaseAndCleanup(spec, id); }, 10 * 60 * 1000);
      ACTIVE[key].safety = safety;
    }
  }

  function _releaseAndCleanup(spec, id) {
    const key = spec.table + ':' + String(id);
    const entry = ACTIVE[key];
    if (!entry) return;
    clearInterval(entry.intervalId);
    if (entry.observer) try { entry.observer.disconnect(); } catch (_) {}
    if (entry.safety) clearTimeout(entry.safety);
    delete ACTIVE[key];
    if (window.EditLocksV2) {
      window.EditLocksV2.releaseLock(spec.table, id).catch(function () {});
    }
  }

  function _showConflictModalSafe(table, id, owner, expiresInS) {
    // Reutilise la modale d'EditLocksV2 (definie dans script-core-edit-locks.js)
    // via une copie locale minimaliste si la fn n'est pas exposee.
    return new Promise(function (resolve) {
      const old = document.getElementById('mca-edit-lock-conflict');
      if (old) old.remove();
      const overlay = document.createElement('div');
      overlay.id = 'mca-edit-lock-conflict';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,sans-serif';
      const minutes = Math.max(1, Math.ceil((expiresInS || 60) / 60));
      const isAdmin = sessionStorage.getItem('role') === 'admin';
      const esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
      };
      overlay.innerHTML = ''
        + '<div style="background:#fff;color:#1a1a1a;border-radius:14px;max-width:380px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
        + '  <div style="font-size:1.6rem;margin-bottom:8px">🔒</div>'
        + '  <div style="font-weight:700;font-size:1.05rem;margin-bottom:6px">Fiche verrouillée</div>'
        + '  <div style="font-size:.9rem;line-height:1.5;margin-bottom:18px"><strong>'
        + esc(owner || 'Un autre utilisateur') + '</strong> est en train de modifier cette ligne.<br>Réessayez dans ' + minutes + ' min.</div>'
        + '  <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">'
        + (isAdmin ? '    <button type="button" data-action="force" style="background:#e63946;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer">Forcer le déverrouillage</button>' : '')
        + '    <button type="button" data-action="cancel" style="background:transparent;border:1px solid #1a1a1a;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:600">Fermer</button>'
        + '  </div>'
        + '</div>';
      function close(result) {
        try { overlay.remove(); } catch (_) {}
        resolve(result);
      }
      overlay.addEventListener('click', function (e) {
        const a = e.target && e.target.getAttribute && e.target.getAttribute('data-action');
        if (a === 'force') {
          window.EditLocksV2.forceUnlock(table, id).then(function (r) {
            if (r && r.success) close('forced');
            else { alert('Impossible de forcer : ' + (r && r.error || 'erreur inconnue')); close('cancelled'); }
          });
        } else if (a === 'cancel' || e.target === overlay) {
          close('cancelled');
        }
      });
      document.body.appendChild(overlay);
    });
  }

  // Bootstrap : tente le wrapping au DOMContentLoaded + retry x3 a 500ms d'intervalle
  // (les modules metiers se chargent en defer dans des ordres variables PC/mobile).
  function bootstrap() {
    let pending = WRAPS.slice();
    function attempt() {
      const remaining = [];
      pending.forEach(function (spec) {
        if (!wrapEditFunction(spec)) remaining.push(spec);
      });
      pending = remaining;
    }
    attempt();
    if (pending.length) setTimeout(attempt, 500);
    if (pending.length) setTimeout(attempt, 1500);
    if (pending.length) setTimeout(function () {
      attempt();
      if (pending.length) {
        console.warn('[edit-locks-bootstrap] non wrapes (modules absents):',
          pending.map(function (s) { return s.fn; }));
      }
    }, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // Expose pour debug + tests
  window.EditLocksBootstrap = {
    WRAPS: WRAPS,
    ACTIVE: ACTIVE,
    wrap: wrapEditFunction,
  };
})();
