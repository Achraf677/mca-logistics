/**
 * MCA Logistics — Sprint 10 — Toasts stackés + actions Undo (Phase X — extraction script.js)
 *
 * Extracted from script.js L4906-5196 (2026-05-16).
 */

/* =========================================================================
   SPRINT 10 — Toasts stackés + actions Undo
   ========================================================================= */
(function() {
  'use strict';

  const STACK_ID = 'toast-stack';
  const DEFAULT_DURATION = 4000;
  const UNDO_DURATION = 6000;
  let idCounter = 0;

  function ensureStack() {
    let stack = document.getElementById(STACK_ID);
    if (!stack) {
      stack = document.createElement('div');
      stack.id = STACK_ID;
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function iconForType(type) {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warning': return '⚠';
      case 'info':    return 'ℹ';
      default:        return '✓';
    }
  }

  function dismissToast(el) {
    if (!el || el.dataset.dismissing) return;
    el.dataset.dismissing = '1';
    el.classList.add('toast-out');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 250);
  }

  /**
   * Affiche un toast. Signature rétrocompatible :
   *   afficherToast(msg)
   *   afficherToast(msg, 'error')
   *   afficherToast(msg, 'success', { action: { label, onClick }, duration })
   */
  function stackedToast(message, type, options) {
    type = type || 'success';
    options = options || {};

    const stack = ensureStack();
    const id = ++idCounter;

    const duration = options.duration || (options.action ? UNDO_DURATION : DEFAULT_DURATION);
    const icon = options.icon || iconForType(type);

    const toast = document.createElement('div');
    toast.className = 'toast toast-stacked toast-' + type;
    toast.setAttribute('data-toast-id', String(id));

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icon;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';
    // message peut contenir des emojis/texte — on fait textContent pour sécurité
    bodyEl.textContent = String(message);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'toast-actions';

    if (options.action && options.action.label && typeof options.action.onClick === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action-btn';
      btn.textContent = options.action.label;
      btn.addEventListener('click', function() {
        try { options.action.onClick(); } catch (e) { console.error(e); }
        dismissToast(toast);
      });
      actionsEl.appendChild(btn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() { dismissToast(toast); });
    actionsEl.appendChild(closeBtn);

    const progress = document.createElement('div');
    progress.className = 'toast-progress';
    progress.style.animationDuration = duration + 'ms';

    toast.appendChild(iconEl);
    toast.appendChild(bodyEl);
    toast.appendChild(actionsEl);
    toast.appendChild(progress);

    stack.appendChild(toast);

    // Pause progress on hover
    let remaining = duration;
    let startedAt = Date.now();
    let timer = setTimeout(function() { dismissToast(toast); }, duration);

    toast.addEventListener('mouseenter', function() {
      remaining -= (Date.now() - startedAt);
      clearTimeout(timer);
      progress.style.animationPlayState = 'paused';
    });
    toast.addEventListener('mouseleave', function() {
      startedAt = Date.now();
      timer = setTimeout(function() { dismissToast(toast); }, Math.max(1000, remaining));
      progress.style.animationPlayState = 'running';
    });

    return id;
  }

  /* WRAPPER S10 — toasts stackés. H2.1 : on n'écrase plus window.afficherToast.
     On s'enregistre comme listener via addToastListener (registre fan-out
     défini avec la définition canonique). Le listener retourne `true` pour
     "consommer" l'événement et empêcher le toast simple #toast de s'afficher
     en plus. Si stackedToast throw, on retourne false (le toast simple prend
     la relève en fallback). */
  if (typeof window.addToastListener === 'function' && !window.__s10ToastListenerInstalled) {
    window.__s10ToastListenerInstalled = true;
    window.addToastListener(function(message, type, options) {
      try {
        stackedToast(message, type, options);
        return true; // consommé par le stack
      } catch (e) {
        console.error('[s10 stackedToast]', e);
        return false; // laisser le toast simple prendre la main
      }
    });
  } else if (typeof window.addToastListener !== 'function') {
    // Fallback : addToastListener pas dispo (ne devrait jamais arriver). Garde
    // l'ancien wrap pour compat.
    const oldAfficherToast = window.afficherToast;
    window.afficherToast = function(message, type, options) {
      try {
        return stackedToast(message, type, options);
      } catch (e) {
        if (typeof oldAfficherToast === 'function') return oldAfficherToast(message, type);
        console.error(e);
      }
    };
  }

  // Exposer dismissToast pour usage externe
  window.dismissToastById = function(id) {
    const el = document.querySelector('.toast-stacked[data-toast-id="' + id + '"]');
    dismissToast(el);
  };

  /* ---------- Undo pour supprimerLivraison ---------- */
  const origSupprimer = window.supprimerLivraison;
  if (typeof origSupprimer === 'function' && !origSupprimer.__hasUndo) {
    const wrapped = async function(id) {
      const ok = await confirmDialog('Supprimer cette livraison ?', { titre:'Supprimer', icone:'📦', btnLabel:'Supprimer' });
      if (!ok) return;

      const livraisons = charger('livraisons');
      const livraison = livraisons.find(l => l.id === id);
      if (!livraison) return;

      // Snapshot pour undo
      const snapshot = JSON.parse(JSON.stringify(livraison));

      // Suppression
      if (typeof annulerArchiveFactureLivraison === 'function') {
        try { annulerArchiveFactureLivraison(livraison); } catch (e) {
          if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
            console.warn('[script:supprimerLivraison-annulerArchive]', e);
          }
          if (window.Sentry && window.Sentry.captureException) {
            try { window.Sentry.captureException(e); } catch (_) {}
          }
        }
      }
      sauvegarder('livraisons', livraisons.filter(l => l.id !== id));
      if (typeof ajouterEntreeAudit === 'function') {
        ajouterEntreeAudit('Suppression livraison', (livraison.numLiv || 'Livraison') + ' · ' + (livraison.client || 'Client'));
      }
      if (typeof afficherLivraisons === 'function') afficherLivraisons();

      // Toast avec Undo
      window.afficherToast('Livraison ' + (livraison.numLiv || '') + ' supprimée', 'success', {
        action: {
          label: 'Annuler',
          onClick: function() {
            const current = charger('livraisons');
            current.push(snapshot);
            sauvegarder('livraisons', current);
            if (typeof ajouterEntreeAudit === 'function') {
              ajouterEntreeAudit('Restauration livraison', (snapshot.numLiv || 'Livraison') + ' · ' + (snapshot.client || 'Client'));
            }
            if (typeof afficherLivraisons === 'function') afficherLivraisons();
            window.afficherToast('↩️ Livraison restaurée', 'info');
          }
        }
      });
    };
    wrapped.__hasUndo = true;
    window.supprimerLivraison = wrapped;
  }

  /* ---------- Undo pour bulkSupprimer ---------- */
  function installBulkUndo() {
    const origBulk = window.bulkSupprimer;
    if (typeof origBulk !== 'function' || origBulk.__hasUndo) return;

    const wrapped = async function() {
      // Réutiliser getSelectedIds qui vit dans le scope Sprint 6 IIFE
      const checkedBoxes = document.querySelectorAll('.bulk-liv-check:checked');
      const ids = Array.prototype.map.call(checkedBoxes, cb => cb.getAttribute('data-liv-id')).filter(Boolean);
      if (!ids.length) return;

      const ok = await confirmDialog('Supprimer ' + ids.length + ' livraison(s) ?', {
        titre: 'Suppression en masse', icone: '🗑️', btnLabel: 'Supprimer'
      });
      if (!ok) return;

      const livraisons = charger('livraisons');
      const snapshots = livraisons.filter(l => ids.indexOf(l.id) !== -1).map(l => JSON.parse(JSON.stringify(l)));

      const restantes = livraisons.filter(function(l) {
        if (ids.indexOf(l.id) !== -1) {
          if (typeof annulerArchiveFactureLivraison === 'function') {
            try { annulerArchiveFactureLivraison(l); } catch (e) {
              if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
                console.warn('[script:bulkUndo-annulerArchive]', e);
              }
              if (window.Sentry && window.Sentry.captureException) {
                try { window.Sentry.captureException(e); } catch (_) {}
              }
            }
          }
          if (typeof ajouterEntreeAudit === 'function') {
            try { ajouterEntreeAudit('Suppression livraison (bulk)', (l.numLiv || 'Livraison') + ' · ' + (l.client || 'Client')); } catch (e) {
              if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
                console.warn('[script:bulkUndo-audit]', e);
              }
              if (window.Sentry && window.Sentry.captureException) {
                try { window.Sentry.captureException(e); } catch (_) {}
              }
            }
          }
          return false;
        }
        return true;
      });

      sauvegarder('livraisons', restantes);
      if (typeof afficherLivraisons === 'function') afficherLivraisons();
      if (typeof window.bulkClear === 'function') window.bulkClear();

      window.afficherToast('🗑️ ' + ids.length + ' livraison(s) supprimée(s)', 'success', {
        action: {
          label: 'Annuler',
          onClick: function() {
            const current = charger('livraisons');
            snapshots.forEach(s => current.push(s));
            sauvegarder('livraisons', current);
            if (typeof ajouterEntreeAudit === 'function') {
              ajouterEntreeAudit('Restauration (bulk)', snapshots.length + ' livraison(s)');
            }
            if (typeof afficherLivraisons === 'function') afficherLivraisons();
            window.afficherToast('↩️ ' + snapshots.length + ' livraison(s) restaurée(s)', 'info');
          }
        }
      });
    };
    wrapped.__hasUndo = true;
    window.bulkSupprimer = wrapped;
  }

  // bulkSupprimer est défini dans une IIFE qui tourne au load — on attend
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(installBulkUndo, 200); });
  } else {
    setTimeout(installBulkUndo, 200);
  }
})();
