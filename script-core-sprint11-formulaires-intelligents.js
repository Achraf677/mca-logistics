/**
 * MCA Logistics — Sprint 11 — Formulaires intelligents (validation live, auto-calc, progression) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4908-5110 (2026-05-16).
 */

/* =========================================================================
   SPRINT 11 — Formulaires intelligents
   Validation live, auto-calc visible, progression, erreurs inline
   ========================================================================= */
(function() {
  'use strict';

  const FIELD_RULES = {
    'modal-livraison': {
      required: ['liv-client'],
      atLeastOne: [['liv-prix-ht', 'liv-prix']],
      numeric: { 'liv-distance': { min: 0 }, 'liv-prix-ht': { min: 0 }, 'liv-prix': { min: 0 } },
      labels: {
        'liv-client': 'Client',
        'liv-prix-ht': 'Prix HT',
        'liv-prix': 'Prix TTC',
        'liv-distance': 'Distance'
      }
    }
  };

  function getField(id) { return document.getElementById(id); }

  function ensureErrorSlot(input) {
    let slot = input.parentElement.querySelector('.field-error');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'field-error';
      slot.setAttribute('data-for', input.id);
      input.parentElement.appendChild(slot);
    }
    return slot;
  }

  function setFieldState(input, state, message) {
    input.classList.remove('field-invalid', 'field-ok');
    if (state === 'invalid') input.classList.add('field-invalid');
    else if (state === 'valid') input.classList.add('field-ok');
    const slot = ensureErrorSlot(input);
    slot.textContent = message || '';
    slot.style.display = message ? 'block' : 'none';
  }

  function validateField(modalId, fieldId, opts) {
    const rules = FIELD_RULES[modalId]; if (!rules) return true;
    const input = getField(fieldId); if (!input) return true;
    const label = (rules.labels && rules.labels[fieldId]) || fieldId;
    const val = input.value.trim();

    if (rules.required && rules.required.indexOf(fieldId) !== -1) {
      if (!val) { setFieldState(input, 'invalid', label + ' est requis'); return false; }
    }

    if (rules.numeric && rules.numeric[fieldId]) {
      const n = parseFloat(val);
      if (val !== '' && (isNaN(n) || n < (rules.numeric[fieldId].min ?? 0))) {
        setFieldState(input, 'invalid', label + ' doit être ≥ ' + (rules.numeric[fieldId].min ?? 0));
        return false;
      }
    }

    if (rules.atLeastOne) {
      for (const group of rules.atLeastOne) {
        if (group.indexOf(fieldId) !== -1) {
          const anyFilled = group.some(id => {
            const el = getField(id);
            return el && parseFloat(el.value) > 0;
          });
          if (!anyFilled && opts && opts.submitting) {
            setFieldState(input, 'invalid', 'Au moins un montant (HT ou TTC) est requis');
            return false;
          }
        }
      }
    }

    if (val) setFieldState(input, 'valid', '');
    else setFieldState(input, null, '');
    return true;
  }

  function validateAll(modalId) {
    const rules = FIELD_RULES[modalId]; if (!rules) return { ok: true };
    const toCheck = new Set([
      ...(rules.required || []),
      ...Object.keys(rules.numeric || {}),
      ...((rules.atLeastOne || []).flat())
    ]);
    let firstInvalid = null;
    toCheck.forEach(id => {
      const ok = validateField(modalId, id, { submitting: true });
      if (!ok && !firstInvalid) firstInvalid = getField(id);
    });
    return { ok: !firstInvalid, firstInvalid };
  }

  /* ---------- Auto-calc visible : HT + TVA = TTC ---------- */
  function updateCalcSummary() {
    const box = document.getElementById('liv-calc-summary'); if (!box) return;
    const ht = parseFloat(getField('liv-prix-ht')?.value) || 0;
    const taux = parseFloat(getField('liv-taux-tva')?.value) || 20;
    const ttc = parseFloat(getField('liv-prix')?.value) || 0;
    const tva = ht > 0 ? ht * (taux / 100) : Math.max(0, ttc - ttc / (1 + taux / 100));
    const ttcEff = ht > 0 ? ht * (1 + taux / 100) : ttc;
    if (ht <= 0 && ttc <= 0) { box.style.display = 'none'; return; }
    box.style.display = 'flex';
    const fmt = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €';
    box.innerHTML =
      '<span class="calc-piece">HT <strong>' + fmt(ht > 0 ? ht : (ttc - tva)) + '</strong></span>' +
      '<span class="calc-op">+</span>' +
      '<span class="calc-piece">TVA ' + taux + '% <strong>' + fmt(tva) + '</strong></span>' +
      '<span class="calc-op">=</span>' +
      '<span class="calc-piece calc-total">TTC <strong>' + fmt(ttcEff) + '</strong></span>';
  }

  /* ---------- Injection UI dans le modal ---------- */
  function installModalLivraison() {
    const modal = document.getElementById('modal-livraison'); if (!modal) return;
    if (modal.dataset.sprint11 === '1') return;
    modal.dataset.sprint11 = '1';

    const ttcField = getField('liv-prix');
    if (ttcField && !document.getElementById('liv-calc-summary')) {
      const box = document.createElement('div');
      box.id = 'liv-calc-summary';
      box.className = 'calc-summary';
      box.style.display = 'none';
      const grid = ttcField.closest('.form-grid');
      if (grid) grid.insertAdjacentElement('afterend', box);
    }

    const rules = FIELD_RULES['modal-livraison'];
    const allIds = new Set([...(rules.required || []), ...Object.keys(rules.numeric || {}), ...((rules.atLeastOne || []).flat())]);
    allIds.forEach(id => {
      const input = getField(id); if (!input) return;
      ensureErrorSlot(input);
      if ((rules.required || []).indexOf(id) !== -1) {
        const label = input.parentElement.querySelector('label');
        if (label && !label.classList.contains('field-required')) {
          label.innerHTML = label.innerHTML.replace(/\s*\*+\s*$/, '').trim();
          label.classList.add('field-required');
        }
      }
      if (input.dataset.s11Bound) return;
      input.dataset.s11Bound = '1';
      input.addEventListener('blur', () => validateField('modal-livraison', id));
      input.addEventListener('input', () => {
        if (input.classList.contains('field-invalid')) validateField('modal-livraison', id);
      });
    });

    const body = modal.querySelector('.modal-body');
    if (body && !body.dataset.s11Progress) {
      body.dataset.s11Progress = '1';
      body.addEventListener('input', updateCalcSummary);
      body.addEventListener('change', updateCalcSummary);
    }
  }

  /* HELPER S11 — `installModalLivraisonOnOpen` (anciennement wrapper de
     window.openModal). H2.1 : remplacé par un hook nommé enregistré dans le
     registre de modal-hooks (script-core-ui.js). Pas d'écrasement de la
     canonique. Si registerModalHook absent, fallback no-op (le formulaire
     restera fonctionnel sans le reset auto, l'utilisateur peut toujours saisir). */
  if (typeof window.registerModalHook === 'function' && !window.__s11ModalHookInstalled) {
    window.__s11ModalHookInstalled = true;
    window.registerModalHook('open', 'modal-livraison', function() {
      setTimeout(() => {
        installModalLivraison();
        document.querySelectorAll('#modal-livraison .field-error').forEach(e => { e.textContent = ''; e.style.display = 'none'; });
        document.querySelectorAll('#modal-livraison .field-invalid, #modal-livraison .field-ok').forEach(e => e.classList.remove('field-invalid', 'field-ok'));
        updateCalcSummary();
      }, 20);
    });
  }

  /* ---------- Wrap ajouterLivraison : validation bloquante inline ---------- */
  if (typeof window.ajouterLivraison === 'function' && !window.ajouterLivraison.__s11) {
    const orig = window.ajouterLivraison;
    const wrapped = function() {
      const res = validateAll('modal-livraison');
      if (!res.ok) {
        if (res.firstInvalid) {
          res.firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => res.firstInvalid.focus(), 300);
        }
        window.afficherToast('⚠️ Corrige les champs en rouge avant d\'enregistrer', 'warning');
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__s11 = true;
    window.ajouterLivraison = wrapped;
  }

  window.FORM11 = { validateField, validateAll, updateCalcSummary, installModalLivraison };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installModalLivraison);
  } else {
    installModalLivraison();
  }
})();
