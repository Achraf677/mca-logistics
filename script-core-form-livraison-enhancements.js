/**
 * MCA Logistics — Form Nouvelle Livraison — progress bar + validation inline (Phase X — extraction script.js)
 *
 * Extracted from script.js L4932-5030 (2026-05-16).
 */

/* ============================================================
   Form Nouvelle Livraison — progress + validation inline
   ============================================================ */
(function installFormLivraisonEnhancements() {
  // 12 champs "principaux" dont on suit la complétude
  const TRACKED_FIELDS = [
    'liv-client', 'liv-client-siren', 'liv-date', 'liv-heure-debut',
    'liv-distance', 'liv-prix-ht', 'liv-chauffeur', 'liv-vehicule',
    'liv-exp-nom', 'liv-dest-nom', 'liv-dest-adresse', 'liv-marchandise-nature'
  ];

  function setFieldState(input, ok, hintMsg) {
    if (!input) return;
    input.classList.remove('fp-invalid', 'fp-valid');
    if (input.value === '') {
      // vide = neutre
    } else if (ok) {
      input.classList.add('fp-valid');
    } else {
      input.classList.add('fp-invalid');
    }
    const hint = document.getElementById(input.id + '-hint');
    if (hint) {
      hint.classList.remove('fp-hint-ok', 'fp-hint-err');
      if (input.value === '') { hint.textContent = ''; }
      else if (ok) { hint.textContent = hintMsg || '✓ Valide'; hint.classList.add('fp-hint-ok'); }
      else { hint.textContent = hintMsg || '✗ Invalide'; hint.classList.add('fp-hint-err'); }
    }
  }

  function validateSiren(input) {
    const val = String(input.value || '').replace(/\s+/g, '');
    if (val === '') { setFieldState(input, true, ''); return;}
    if (!/^\d+$/.test(val)) { setFieldState(input, false, '✗ Uniquement des chiffres'); return;}
    if (val.length < 9) { setFieldState(input, false, val.length + '/9 chiffres'); return;}
    const ok = typeof validerSIREN === 'function' ? validerSIREN(val) : /^\d{9}$/.test(val);
    setFieldState(input, ok, ok ? '✓ SIREN valide' : '✗ Clé Luhn incorrecte');
  }

  // Pays ISO 3166-1 alpha-2 — liste étendue (cf. datalist pays-iso-list dans admin.html)
  const PAYS_ISO2 = new Set(['FR','BE','LU','CH','DE','IT','ES','PT','NL','GB','IE','AT','DK','SE','FI','NO','IS','PL','CZ','SK','HU','RO','BG','GR','SI','HR','RS','BA','AL','MK','ME','EE','LV','LT','MT','CY','MC','AD','SM','VA','LI','TR','MA','DZ','TN','EG','IL','SN','CI','US','CA','MX','BR','AR','CN','JP','KR','IN','AU','NZ']);

  function validatePays(input) {
    const val = String(input.value || '').toUpperCase();
    if (val === '') { setFieldState(input, true, ''); return; }
    if (val.length < 2) { setFieldState(input, false, 'Code à 2 lettres'); return; }
    const ok = PAYS_ISO2.has(val);
    setFieldState(input, ok, ok ? '' : '✗ Code inconnu');
  }

  function reset() {
    // Reset des états visuels à l'ouverture du form ou après submit
    TRACKED_FIELDS.concat(['liv-exp-pays','liv-dest-pays']).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('fp-invalid', 'fp-valid');
      const hint = document.getElementById(id + '-hint');
      if (hint) { hint.textContent = ''; hint.classList.remove('fp-hint-ok', 'fp-hint-err'); }
    });
    // BUG-002 fix : clear aussi field-invalid + error slots (validation FIELD-RULES, parallele a fp-invalid)
    const modal = document.getElementById('modal-livraison');
    if (modal) {
      modal.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
      modal.querySelectorAll('.field-valid').forEach(el => el.classList.remove('field-valid'));
      modal.querySelectorAll('.field-error-slot').forEach(slot => {
        slot.textContent = '';
        slot.style.display = 'none';
      });
    }
  }

  // mcaLivForm : API exposée pour les oninput="..." du HTML.
  // onInput / updateProgress sont conservés en no-op : la barre de progression
  // a été supprimée mais les attributs HTML les appellent encore.
  window.mcaLivForm = {
    onInput: function() {},
    validateSiren: validateSiren,
    validatePays: validatePays,
    reset: reset
  };

  /* HELPER mcaLivForm — H2.1 : reset du form livraison à l'ouverture de la
     modale, via hook 'open' au lieu de wrapper window.openModal. */
  if (typeof window.registerModalHook === 'function' && !window.__livFormResetHookInstalled) {
    window.__livFormResetHookInstalled = true;
    window.registerModalHook('open', 'modal-livraison', function() {
      setTimeout(function(){
        try { reset(); } catch (e) {
          if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
            console.warn('[script:livForm-reset]', e);
          }
          if (window.Sentry && window.Sentry.captureException) {
            try { window.Sentry.captureException(e); } catch (_) {}
          }
        }
      }, 60);
    });
  }
})();
