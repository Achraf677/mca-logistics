/* Phase 60 V7 polish — Modal Enregistrer paiement (Encaissement).
   Le bouton btn-primary "Enregistrer paiement" appelait openModal('modal-paiement')
   mais cette modal n'existait pas. Ajoutée admin.html + ce handler.

   Flow :
   1. openModal('modal-paiement') → registerModalHook 'open' peuple le select des livraisons impayées
   2. Au changement de select, pré-remplit montant TTC + date du jour
   3. Au clic Enregistrer : update livraisons[i].statutPaiement = 'paye' + datePaiement
                            + ajoute entrée dans paiements[]
                            + close modal + toast + refresh enc */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }
  function ecrire(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Peuple le select avec les livraisons non payées
  function peuplerSelectLivraisonsImpayees() {
    var sel = document.getElementById('paiement-liv-select');
    if (!sel) return;
    var livraisons = lire('livraisons');
    var impayees = livraisons.filter(function (l) {
      if (!l) return false;
      var s = (l.statutPaiement || '').toLowerCase();
      return s !== 'paye' && s !== 'payé' && s !== 'payee' && s !== 'payée';
    }).sort(function (a, b) {
      return new Date(b.date || b.dateLivraison || 0) - new Date(a.date || a.dateLivraison || 0);
    });
    var opts = '<option value="">— Choisir une livraison —</option>';
    impayees.forEach(function (l) {
      var ttc = parseFloat(l.prixTTC || l.prix || 0).toFixed(2);
      var label = (l.numLiv || ('L-' + l.id.slice(0, 6))) + ' · ' + (l.client || '—') + ' · ' + ttc + ' € TTC';
      opts += '<option value="' + escapeHtml(l.id) + '" data-ttc="' + ttc + '">' + escapeHtml(label) + '</option>';
    });
    sel.innerHTML = opts;
    // Update info count
    var info = document.getElementById('paiement-liv-info');
    if (info) info.textContent = impayees.length + ' livraison(s) impayée(s)';
  }

  // Au change : pré-remplit montant TTC
  document.addEventListener('change', function (e) {
    if (!e.target || e.target.id !== 'paiement-liv-select') return;
    var opt = e.target.selectedOptions && e.target.selectedOptions[0];
    var ttc = opt ? parseFloat(opt.getAttribute('data-ttc') || '0') : 0;
    var input = document.getElementById('paiement-montant');
    if (input) input.value = ttc > 0 ? ttc.toFixed(2) : '';
  });

  // Hook open : pré-remplit champs au load modal
  function onOpen() {
    peuplerSelectLivraisonsImpayees();
    var dateInput = document.getElementById('paiement-date');
    if (dateInput && !dateInput.value) dateInput.value = aujourdhui();
    var montant = document.getElementById('paiement-montant');
    if (montant) montant.value = '';
    var ref = document.getElementById('paiement-reference');
    if (ref) ref.value = '';
  }

  // Register modal hook si dispo
  if (typeof window.registerModalHook === 'function') {
    window.registerModalHook('open', 'modal-paiement', onOpen);
  } else {
    // Fallback : observe overlay class change
    document.addEventListener('DOMContentLoaded', function () {
      var overlay = document.getElementById('modal-paiement');
      if (!overlay) return;
      new MutationObserver(function () {
        if (overlay.classList.contains('open')) onOpen();
      }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    });
  }

  function enregistrerPaiement() {
    var livId = (document.getElementById('paiement-liv-select') || {}).value || '';
    var date = (document.getElementById('paiement-date') || {}).value || '';
    var mode = (document.getElementById('paiement-mode') || {}).value || 'virement';
    var montant = parseFloat((document.getElementById('paiement-montant') || {}).value || '0');
    var reference = (document.getElementById('paiement-reference') || {}).value || '';

    if (!livId) {
      if (window.afficherToast) window.afficherToast('Sélectionne une livraison', 'error');
      return;
    }
    if (!date) {
      if (window.afficherToast) window.afficherToast('Date de paiement requise', 'error');
      return;
    }
    if (!montant || montant <= 0) {
      if (window.afficherToast) window.afficherToast('Montant invalide', 'error');
      return;
    }

    var livraisons = lire('livraisons');
    var liv = livraisons.find(function (l) { return l && l.id === livId; });
    if (!liv) {
      if (window.afficherToast) window.afficherToast('Livraison introuvable', 'error');
      return;
    }

    // Mark livraison as paid
    liv.statutPaiement = 'paye';
    liv.datePaiement = date;
    liv.modePaiement = mode;
    if (reference) liv.referencePaiement = reference;
    ecrire('livraisons', livraisons);

    // Add to paiements log
    var paiements = lire('paiements');
    paiements.push({
      id: uid(),
      livraisonId: livId,
      clientId: liv.clientId || '',
      client: liv.client || '',
      date: date,
      montant: montant,
      moyen: mode,
      reference: reference || ''
    });
    ecrire('paiements', paiements);

    // Audit
    if (typeof window.ajouterEntreeAudit === 'function') {
      window.ajouterEntreeAudit('Paiement enregistré', (liv.numLiv || 'L-' + livId.slice(0, 6)) + ' · ' + montant.toFixed(2) + ' € · ' + mode);
    }

    if (window.afficherToast) window.afficherToast('Paiement enregistré');
    if (typeof window.closeModal === 'function') window.closeModal('modal-paiement');

    // Refresh encaissement view
    if (typeof window.refonteEncaissementRender === 'function') window.refonteEncaissementRender();
    if (typeof window.refonteEncLegacyRender === 'function') window.refonteEncLegacyRender();
    if (typeof window.refonteClientsFournisseursUpdateCounts === 'function') window.refonteClientsFournisseursUpdateCounts();
  }
  window.enregistrerPaiement = enregistrerPaiement;
})();
