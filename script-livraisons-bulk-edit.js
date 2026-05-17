/**
 * MCA Logistics — Bulk Edit Livraisons (TODO-LIVRAISONS #4)
 *
 * Modal `modal-bulk-edit-livraisons` permet de modifier N>1 livraisons en une fois.
 * Champs candidats (sans risque d'écrasement par-livraison) :
 *   statut, statutPaiement, chaufId, vehId, date, modePaiement, tauxTVA
 *
 * Champs EXCLUS : client, depart/arrivee, prix*, marchandise, exp/dest, notes, adr
 * (spécifiques par livraison, modifier en masse créerait des doublons sémantiques).
 *
 * Workflow :
 *   1. window.bulkEditLivraisons(ids)         → ouvre modal + peuple selects chauffeur/véhicule
 *   2. user coche champs à modifier + saisit valeurs
 *   3. confirmerBulkEditLivraisons()           → vérifie verrouEdition par id, applique, refresh
 */

(function () {
  'use strict';

  let _bulkIds = [];

  /**
   * Ouvre le modal de modification multiple.
   * @param {string[]} ids IDs des livraisons sélectionnées
   */
  window.bulkEditLivraisons = function (ids) {
    if (!Array.isArray(ids) || ids.length < 2) {
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('Sélectionner au moins 2 livraisons pour la modification multiple', 'info');
      }
      return;
    }
    _bulkIds = ids.slice();

    const countEl = document.getElementById('bulk-edit-count');
    if (countEl) countEl.textContent = String(ids.length);

    // Peupler selects chauffeur / véhicule depuis localStorage
    populerSelectBulkEdit('bulk-edit-chauffeur', 'salaries', function (s) {
      const inactif = (s.actif === false) || (s.statut === 'inactif');
      if (inactif) return null;
      return {
        value: s.id,
        label: (typeof getSalarieNomComplet === 'function')
          ? getSalarieNomComplet(s, { includeNumero: true })
          : (s.nom || s.id)
      };
    });
    populerSelectBulkEdit('bulk-edit-vehicule', 'vehicules', function (v) {
      return {
        value: v.id,
        label: (v.immat || '—') + (v.modele ? ' — ' + v.modele : '')
      };
    });

    // Reset checkboxes + inputs
    [
      'bulk-edit-toggle-statut', 'bulk-edit-toggle-paiement', 'bulk-edit-toggle-chauffeur',
      'bulk-edit-toggle-vehicule', 'bulk-edit-toggle-date', 'bulk-edit-toggle-mode-paiement',
      'bulk-edit-toggle-taux-tva'
    ].forEach(function (id) {
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    });
    [
      'bulk-edit-statut', 'bulk-edit-paiement', 'bulk-edit-chauffeur', 'bulk-edit-vehicule',
      'bulk-edit-date', 'bulk-edit-mode-paiement', 'bulk-edit-taux-tva'
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });

    const warnEl = document.getElementById('bulk-edit-warnings');
    if (warnEl) { warnEl.hidden = true; warnEl.textContent = ''; }

    // Câbler toggle ↔ input enable/disable (1 fois, idempotent via data-bound)
    cablerTogglesBulkEdit();

    if (typeof window.openModal === 'function') window.openModal('modal-bulk-edit-livraisons');
  };

  function populerSelectBulkEdit(selectId, storageKey, mapper) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    // Réinitialiser : conserver la première option (— Choisir —)
    while (sel.options.length > 1) sel.remove(1);
    let items = [];
    try {
      items = JSON.parse(localStorage.getItem(storageKey) || '[]') || [];
    } catch (_) { items = []; }
    items.forEach(function (item) {
      const mapped = mapper(item);
      if (!mapped) return;
      const opt = document.createElement('option');
      opt.value = mapped.value;
      opt.textContent = mapped.label;
      sel.appendChild(opt);
    });
  }

  function cablerTogglesBulkEdit() {
    const pairs = [
      ['bulk-edit-toggle-statut', 'bulk-edit-statut'],
      ['bulk-edit-toggle-paiement', 'bulk-edit-paiement'],
      ['bulk-edit-toggle-chauffeur', 'bulk-edit-chauffeur'],
      ['bulk-edit-toggle-vehicule', 'bulk-edit-vehicule'],
      ['bulk-edit-toggle-date', 'bulk-edit-date'],
      ['bulk-edit-toggle-mode-paiement', 'bulk-edit-mode-paiement'],
      ['bulk-edit-toggle-taux-tva', 'bulk-edit-taux-tva']
    ];
    pairs.forEach(function (pair) {
      const cb = document.getElementById(pair[0]);
      const input = document.getElementById(pair[1]);
      if (!cb || !input || cb.dataset.bulkBound === '1') return;
      cb.addEventListener('change', function () {
        input.disabled = !cb.checked;
        if (cb.checked) input.focus();
      });
      cb.dataset.bulkBound = '1';
    });
  }

  /**
   * Confirme l'application des modifications batch.
   * Vérifie le verrouEdition par livraison (skip si verrouillé par un autre admin).
   */
  window.confirmerBulkEditLivraisons = function () {
    if (!_bulkIds.length) return;

    // Collecter les modifications activées
    const patches = {};
    if (document.getElementById('bulk-edit-toggle-statut')?.checked) {
      patches.statut = document.getElementById('bulk-edit-statut').value;
    }
    if (document.getElementById('bulk-edit-toggle-paiement')?.checked) {
      patches.statutPaiement = document.getElementById('bulk-edit-paiement').value;
    }
    if (document.getElementById('bulk-edit-toggle-chauffeur')?.checked) {
      patches.chaufId = document.getElementById('bulk-edit-chauffeur').value;
    }
    if (document.getElementById('bulk-edit-toggle-vehicule')?.checked) {
      patches.vehId = document.getElementById('bulk-edit-vehicule').value;
    }
    if (document.getElementById('bulk-edit-toggle-date')?.checked) {
      patches.date = document.getElementById('bulk-edit-date').value;
    }
    if (document.getElementById('bulk-edit-toggle-mode-paiement')?.checked) {
      patches.modePaiement = document.getElementById('bulk-edit-mode-paiement').value.trim();
    }
    if (document.getElementById('bulk-edit-toggle-taux-tva')?.checked) {
      patches.tauxTVA = parseFloat(document.getElementById('bulk-edit-taux-tva').value) || 0;
    }

    const champsModifies = Object.keys(patches);
    if (!champsModifies.length) {
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('Cochez au moins un champ à modifier', 'error');
      }
      return;
    }

    // Charger livraisons + clients pour relookup chauffeur/véhicule sync
    let livraisons;
    try { livraisons = JSON.parse(localStorage.getItem('livraisons') || '[]'); }
    catch (_) { livraisons = []; }

    let appliquees = 0;
    let verrouillees = 0;
    const idsVerrouillesNoms = [];

    _bulkIds.forEach(function (id) {
      const idx = livraisons.findIndex(function (l) { return l && l.id === id; });
      if (idx < 0) return;

      // Vérification verrouEdition (autre admin peut éditer la livraison)
      if (typeof window.verifierVerrouEdition === 'function') {
        const verrou = window.verifierVerrouEdition('livraison', id);
        if (!verrou.ok) {
          verrouillees++;
          idsVerrouillesNoms.push(livraisons[idx].numLiv || id);
          return;
        }
      }

      // Appliquer le patch sur la livraison
      Object.assign(livraisons[idx], patches);

      // Si chauffeur ou véhicule changé : synchroniser affectation
      if (('chaufId' in patches || 'vehId' in patches) && typeof window.synchroniserAffectationLivraison === 'function') {
        const aff = window.synchroniserAffectationLivraison(
          livraisons[idx].chaufId || '',
          livraisons[idx].vehId || ''
        );
        livraisons[idx].chaufId = aff.chaufId || null;
        livraisons[idx].chaufNom = aff.chaufNom;
        livraisons[idx].vehId = aff.vehId || null;
        livraisons[idx].vehNom = aff.vehNom;
        livraisons[idx].vehImmat = aff.vehImmat;
        livraisons[idx].vehModele = aff.vehModele;
      }

      // Marquer modifLe pour traçabilité
      livraisons[idx].modifLe = new Date().toISOString();
      appliquees++;
    });

    // Sauvegarder
    try {
      if (typeof window.sauvegarder === 'function') {
        window.sauvegarder('livraisons', livraisons);
      } else {
        localStorage.setItem('livraisons', JSON.stringify(livraisons));
      }
    } catch (e) {
      console.error('[bulk-edit] sauvegarde échouée', e);
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('Erreur sauvegarde : ' + (e.message || 'inconnue'), 'error');
      }
      return;
    }

    // Audit log (1 entrée pour tout le batch)
    if (typeof window.ajouterEntreeAudit === 'function') {
      try {
        window.ajouterEntreeAudit(
          'Modification multiple livraisons',
          appliquees + ' livraison(s) · champs : ' + champsModifies.join(', ')
        );
      } catch (_) {}
    }

    // Refresh chain (parité avec confirmerEditLivraison)
    try { if (typeof window.refreshLivraisonsChipsCounts === 'function') window.refreshLivraisonsChipsCounts(); } catch (_) {}
    try { if (typeof window.rafraichirDashboard === 'function') window.rafraichirDashboard(); } catch (_) {}
    try { if (typeof window.afficherRentabilite === 'function') window.afficherRentabilite(); } catch (_) {}
    try { if (typeof window.afficherEncaissement === 'function') window.afficherEncaissement(); } catch (_) {}
    try { if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons(); } catch (_) {}

    if (typeof window.closeModal === 'function') window.closeModal('modal-bulk-edit-livraisons');

    // Toast récapitulatif
    let msg;
    if (verrouillees > 0) {
      msg = appliquees + ' livraison(s) mises à jour, ' + verrouillees + ' ignorée(s) car verrouillée(s)';
      if (idsVerrouillesNoms.length <= 5) msg += ' (' + idsVerrouillesNoms.join(', ') + ')';
      if (typeof window.afficherToast === 'function') {
        window.afficherToast(msg, 'info');
      }
    } else {
      msg = '✅ ' + appliquees + ' livraison(s) mises à jour';
      if (typeof window.afficherToast === 'function') {
        window.afficherToast(msg, 'success');
      }
    }

    _bulkIds = [];
  };
})();
