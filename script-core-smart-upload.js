/**
 * MCA Logistics — Helpers de cablage SmartUpload mode "auto" sur les forms.
 *
 * Phase 2 (PR Smart Upload Phase 2 — câblage 4 forms d'upload) : un seul
 * upload -> Gemini detecte le type (facture / ticket_carburant / rib / permis
 * / carte_grise) puis pre-remplit les champs du form actif. routeByType
 * (smart-upload.js) fait la map type -> fields ; cette couche fait le binding
 * fields -> inputs HTML PC + un helper analogue mobile.
 *
 * Mapping HTML par section (PC) :
 *
 *   target_section: 'facture' (modal-charge)
 *     fournisseur_nom  -> #charge-fournisseur
 *     date             -> #charge-date
 *     montant_ht       -> #charge-montant-ht
 *     montant_ttc      -> #charge-montant
 *     taux_tva         -> #charge-taux-tva
 *     num_facture      -> #charge-desc (concatene au prefix "Facture ")
 *
 *   target_section: 'ticket' (modal-carburant)
 *     date             -> #carb-date
 *     litres           -> #carb-litres
 *     prix_litre       -> #carb-prix-litre
 *     type_carburant   -> #carb-type
 *
 *   target_section: 'rib' (form salarie creation, toast info)
 *     iban / bic / titulaire    -> toast (pas de champs IBAN dedies cote PC
 *                                  actuellement, doc cote drawer salarie 360)
 *
 *   target_section: 'permis' (form salarie creation)
 *     date_expiration  -> #nsal-date-permis
 *     categories[0]    -> #nsal-cat-permis (B / autre)
 *
 *   target_section: 'carte_grise' (modal-vehicule, defere a PR de suivi)
 *
 * Cote mobile, le wiring se fait directement dans script-mobile.js — ce
 * helper expose des utilitaires partageables (applyAutoResultToMobileForm)
 * que les deux cotes peuvent reutiliser.
 *
 * IMPORTANT : chargement APRES smart-upload.js, AVANT script-charges/vehicules/etc.
 */
(function () {
  'use strict';

  if (window.MCASmartUploadHelpers) return;

  // Toast best-effort via window.afficherToast (PC) ou MCAm.toast (mobile)
  function toastSafe(msg, level) {
    try {
      if (typeof window.afficherToast === 'function') {
        window.afficherToast(msg, level || 'info');
        return;
      }
      if (window.MCAm && typeof window.MCAm.toast === 'function') {
        window.MCAm.toast(msg);
        return;
      }
      console.log('[smart-upload-helpers]', msg);
    } catch (_) { /* noop */ }
  }

  // Set un input HTML par id si la valeur est non vide ET le champ est vide
  // (n'ecrase jamais une saisie utilisateur). Retourne 1 si applique, 0 sinon.
  function setIfEmpty(elemId, value) {
    if (value == null || value === '' || (typeof value === 'number' && !isFinite(value))) return 0;
    var el = document.getElementById(elemId);
    if (!el) return 0;
    if (el.value && String(el.value).trim() !== '') return 0;
    el.value = value;
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) { /* noop */ }
    return 1;
  }

  // Mapping souple type_carburant string -> code MCA (diesel/essence/gnv/electrique/hybride/hydrogene)
  function mapTypeCarburant(raw) {
    if (!raw) return '';
    var v = String(raw).toLowerCase();
    if (v.indexOf('gazole') >= 0 || v.indexOf('gasoil') >= 0 || v.indexOf('diesel') >= 0) return 'diesel';
    if (v.indexOf('sp9') >= 0 || v.indexOf('sp ') >= 0 || v === 'sp' || v.indexOf('essence') >= 0 || v.indexOf('e10') >= 0 || v.indexOf('e85') >= 0) return 'essence';
    if (v.indexOf('gnv') >= 0 || v.indexOf('biogn') >= 0) return 'gnv';
    if (v.indexOf('elec') >= 0) return 'electrique';
    if (v.indexOf('hybride') >= 0) return 'hybride';
    if (v.indexOf('hydro') >= 0 || v === 'h2') return 'hydrogene';
    return '';
  }

  // Handler haut-niveau cote PC : recoit le payload mode "auto" du callback
  // onOcrResult de SmartUpload, dispatch via routeByType, puis applique les
  // valeurs aux inputs PC selon section. Retourne le nombre de champs remplis.
  function applyAutoResultToPCForm(autoResult, options) {
    options = options || {};
    var section = options.expectedSection || null;
    if (!window.SmartUpload || typeof window.SmartUpload.routeByType !== 'function') {
      console.warn('[smart-upload-helpers] SmartUpload.routeByType absent');
      return 0;
    }
    var route = window.SmartUpload.routeByType(autoResult, { section: section });
    if (!route.handled) {
      toastSafe('⚠️ Document non reconnu — aucun champ pré-rempli (' + (autoResult && autoResult.type_detecte ? autoResult.type_detecte : 'inconnu') + ')', 'warn');
      return 0;
    }

    if (section && route.target_section !== section) {
      toastSafe('⚠️ Doc détecté : ' + route.target_section + ' (form attendu : ' + section + ') — vérifiez', 'warn');
    }

    var f = route.fields_to_prefill || {};
    var n = 0;
    if (route.target_section === 'facture') {
      n += setIfEmpty('charge-fournisseur', f.fournisseur_nom);
      n += setIfEmpty('charge-date', f.date);
      n += setIfEmpty('charge-montant-ht', f.montant_ht);
      n += setIfEmpty('charge-montant', f.montant_ttc);
      n += setIfEmpty('charge-taux-tva', f.taux_tva);
      if (f.num_facture) {
        var elDesc = document.getElementById('charge-desc');
        if (elDesc && !elDesc.value) {
          elDesc.value = 'Facture ' + f.num_facture;
          n++;
        }
      }
    } else if (route.target_section === 'ticket') {
      n += setIfEmpty('carb-date', f.date);
      n += setIfEmpty('carb-litres', f.litres);
      n += setIfEmpty('carb-prix-litre', f.prix_litre);
      var mappedCarb = mapTypeCarburant(f.type_carburant);
      if (mappedCarb) {
        var sel = document.getElementById('carb-type');
        if (sel && !sel.value) {
          sel.value = mappedCarb;
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
          n++;
        }
      }
    } else if (route.target_section === 'rib') {
      // Salaries PC : pas de champs IBAN/BIC dedies dans le form de creation
      // actuel. On affiche en toast pour copie manuelle (sera remplace par des
      // inputs dedies dans le drawer 360 PC, sprint H2.4 - voir CLAUDE.md).
      var msg = '🏦 RIB lu : ' + (f.titulaire || 'titulaire ?') +
        ' / IBAN ' + (f.iban || '?') + ' / BIC ' + (f.bic || '?');
      toastSafe(msg, 'info');
      n = (f.titulaire ? 1 : 0) + (f.iban ? 1 : 0) + (f.bic ? 1 : 0);
    } else if (route.target_section === 'permis') {
      n += setIfEmpty('nsal-date-permis', f.date_expiration);
      if (Array.isArray(f.categories) && f.categories.length) {
        var sel2 = document.getElementById('nsal-cat-permis');
        if (sel2 && !sel2.value) {
          var first = String(f.categories[0]).toUpperCase();
          sel2.value = (first === 'B') ? 'B' : 'autre';
          try { sel2.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
          n++;
        }
      }
    } else if (route.target_section === 'carte_grise') {
      // Defere a la PR de suivi (cablage modal-vehicule). On toast pour signaler.
      toastSafe('🪪 Carte grise lue (câblage Véhicule en PR de suivi)', 'info');
      n = 1;
    }

    if (n > 0) {
      toastSafe('✅ ' + n + ' champ' + (n > 1 ? 's' : '') + ' pré-rempli' + (n > 1 ? 's' : '') + ' (vérifiez)', 'success');
    } else {
      toastSafe('⚠️ Aucun champ pré-rempli (donnée vide)', 'warn');
    }
    return n;
  }

  // Helper mobile : applique le payload "auto" a un form-body mobile (recoit
  // l'element body de la sheet). Utilise les conventions mobile (input[name=xxx]).
  function applyAutoResultToMobileForm(autoResult, formBody, options) {
    options = options || {};
    if (!window.SmartUpload || typeof window.SmartUpload.routeByType !== 'function') return 0;
    var route = window.SmartUpload.routeByType(autoResult);
    if (!route.handled) return 0;
    var f = route.fields_to_prefill || {};
    var n = 0;

    function setMobile(name, val) {
      if (val == null || val === '') return;
      var el = formBody.querySelector('[name="' + name + '"]');
      if (el && !el.value) {
        el.value = val;
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
        n++;
      }
    }

    if (route.target_section === 'facture') {
      setMobile('fournisseur', f.fournisseur_nom);
      setMobile('date', f.date);
      setMobile('montantHt', f.montant_ht);
      setMobile('montantTtc', f.montant_ttc);
      setMobile('tauxTva', f.taux_tva);
      if (f.num_facture) setMobile('libelle', 'Facture ' + f.num_facture);
    } else if (route.target_section === 'ticket') {
      setMobile('date', f.date);
      setMobile('litres', f.litres);
      setMobile('prixLitre', f.prix_litre);
      if (f.montant_ttc) setMobile('total', f.montant_ttc);
      var mapped = mapTypeCarburant(f.type_carburant);
      if (mapped) setMobile('typeCarburant', mapped);
    } else if (route.target_section === 'rib') {
      try {
        if (window.MCAm && typeof window.MCAm.toast === 'function') {
          window.MCAm.toast('🏦 RIB lu : ' + (f.iban || '?') + ' / ' + (f.bic || '?'));
        }
      } catch (_) {}
      n = (f.iban ? 1 : 0) + (f.bic ? 1 : 0) + (f.titulaire ? 1 : 0);
    } else if (route.target_section === 'permis') {
      setMobile('datePermisExpiration', f.date_expiration);
    }
    return { count: n, route: route };
  }

  // Boot hook PC : attache SmartUpload mode auto sur les inputs presents dans
  // admin.html (carburant, salaries). Idempotent (flag _smartUploadAttached
  // de SmartUpload.attachToInput). Charges est cable separement dans
  // script-charges.js (modal reset a chaque ouverture). Vehicules carte_grise
  // reste sur l'ancien helper uploaderCarteGriseFromForm pour cette PR.
  function bootPCWiring() {
    if (!window.SmartUpload || typeof window.SmartUpload.attachToInput !== 'function') return;

    // Carburant : modal-carburant. Bucket = carburant-recus (deja cree
    // migration 009_phase0_storage_buckets). Path : <vehId>/<timestamp>_<filename>.
    var carbInput = document.getElementById('carb-smart-upload-input');
    if (carbInput && !carbInput._smartUploadAttached) {
      var carbLabel = document.getElementById('carb-smart-upload-label');
      window.SmartUpload.attachToInput(carbInput, {
        mode: 'auto',
        storageBucket: 'carburant-recus',
        storagePath: function (file) {
          var name = (window.DelivProStorage && window.DelivProStorage.sanitizeFilename)
            ? window.DelivProStorage.sanitizeFilename(file.name) : file.name;
          var vehId = (document.getElementById('carb-vehicule') || {}).value || 'inconnu';
          return vehId + '/' + Date.now() + '_' + name;
        },
        feedbackEl: document.getElementById('carb-smart-upload-feedback'),
        onOcrResult: function (payload) {
          if (carbLabel) carbLabel.textContent = '📤 Uploader (auto) — ticket carburant';
          applyAutoResultToPCForm(payload, { expectedSection: 'ticket' });
        },
        onError: function (err) { console.warn('[carb smart-upload]', err); },
      });
    }

    // Salaries : form creation salarie. Pas de bucket dedie ici (les docs
    // typed sont uploades via les inputs nsal-doc-*). On fait OCR-only :
    // detecte permis / RIB / autre puis pre-remplit ce qu'on peut.
    var salInput = document.getElementById('nsal-smart-upload-input');
    if (salInput && !salInput._smartUploadAttached) {
      var salLabel = document.getElementById('nsal-smart-upload-label');
      window.SmartUpload.attachToInput(salInput, {
        mode: 'auto',
        skipStorage: true,
        feedbackEl: document.getElementById('nsal-smart-upload-feedback'),
        onOcrResult: function (payload) {
          if (salLabel) salLabel.textContent = '📤 Uploader (auto) — RIB / permis (auto-détection)';
          applyAutoResultToPCForm(payload);
        },
        onError: function (err) { console.warn('[nsal smart-upload]', err); },
      });
    }
  }

  function tryBoot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootPCWiring, { once: true });
    } else {
      bootPCWiring();
    }
    // Re-tente apres un delai pour les modals qui sont injectes plus tard
    // (defensif : SmartUpload est idempotent).
    setTimeout(bootPCWiring, 800);
    setTimeout(bootPCWiring, 2500);
  }

  window.MCASmartUploadHelpers = {
    applyAutoResultToPCForm: applyAutoResultToPCForm,
    applyAutoResultToMobileForm: applyAutoResultToMobileForm,
    setIfEmpty: setIfEmpty,
    mapTypeCarburant: mapTypeCarburant,
    toastSafe: toastSafe,
    bootPCWiring: bootPCWiring,
  };

  tryBoot();
})();
