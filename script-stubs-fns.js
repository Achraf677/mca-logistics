/* Phase 60 V7 polish — Stubs pour 4 fonctions onclick référencées mais non implémentées.
   Au lieu d'un silent-fail (typeof X === 'function' qui retourne false),
   on définit les fns avec un comportement utile minimal + toast informatif. */
(function () {
  'use strict';

  function toast(msg, type) {
    if (window.afficherToast) window.afficherToast(msg, type || 'info');
    else if (window.alert) window.alert(msg);
  }

  // 1. reinitialiserParametres : recharge le formulaire depuis localStorage (discard unsaved changes)
  function reinitialiserParametres() {
    if (typeof window.chargerParametres === 'function') {
      try {
        window.chargerParametres();
        toast('Paramètres rechargés depuis le stockage');
      } catch (e) {
        console.warn('[reinitialiserParametres]', e);
        toast('Erreur lors du rechargement', 'error');
      }
    } else {
      toast('Fonction chargerParametres indisponible', 'error');
    }
  }
  window.reinitialiserParametres = reinitialiserParametres;

  // 2. testerConnexionPennylane : test API (backend Edge fn). Stub : info user.
  function testerConnexionPennylane() {
    toast('Test connexion Pennylane : backend requis (PENNYLANE_TOKEN dans secrets Supabase). Vérifie docs/access-tokens.md', 'warning');
  }
  window.testerConnexionPennylane = testerConnexionPennylane;

  // 3. envoyerChargesPennylane : email charges au cabinet compta via Pennylane. Stub : ouvre mailto.
  function envoyerChargesPennylane() {
    var params = {};
    try { params = JSON.parse(localStorage.getItem('params_entreprise') || '{}'); } catch (_) {}
    var emailCabinet = params.emailCabinetCompta || params.emailCompta || params.email || '';
    var charges = [];
    try { charges = JSON.parse(localStorage.getItem('charges') || '[]'); } catch (_) {}
    var moisCourant = new Date().toISOString().slice(0, 7);
    var chargesMois = charges.filter(function (c) { return c && (c.date || '').startsWith(moisCourant); });
    var subject = 'Charges ' + moisCourant + ' - ' + (params.nom || 'MCA Logistics');
    var body = chargesMois.length + ' charge(s) du mois ' + moisCourant + '.\n\nMerci de me confirmer la bonne réception.\n\nCordialement,\n' + (params.nom || 'MCA Logistics');
    var href = 'mailto:' + encodeURIComponent(emailCabinet) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    if (!emailCabinet) {
      toast('Renseigne d\'abord l\'email du cabinet compta dans Paramètres', 'warning');
      return;
    }
    window.location.href = href;
    toast('Email cabinet compta ouvert (' + chargesMois.length + ' charge(s))');
  }
  window.envoyerChargesPennylane = envoyerChargesPennylane;

  // 4. envoyerRelancesEmail : ouvre client email avec liste des impayés
  function envoyerRelancesEmail() {
    var livraisons = [];
    try { livraisons = JSON.parse(localStorage.getItem('livraisons') || '[]'); } catch (_) {}
    var seuilJ = 30;
    var seuil = Date.now() - seuilJ * 86400000;
    var impayes = livraisons.filter(function (l) {
      if (!l) return false;
      var s = (l.statutPaiement || '').toLowerCase();
      if (s === 'paye' || s === 'payé' || s === 'payee' || s === 'payée') return false;
      var d = new Date(l.dateFacture || l.date || 0).getTime();
      return d && d < seuil;
    });
    if (!impayes.length) {
      toast('Aucun impayé > ' + seuilJ + 'j à relancer', 'info');
      return;
    }
    // Group par client (1 email par client)
    var byClient = {};
    impayes.forEach(function (l) {
      var c = l.client || 'Inconnu';
      if (!byClient[c]) byClient[c] = [];
      byClient[c].push(l);
    });
    var nbClients = Object.keys(byClient).length;
    var params = {};
    try { params = JSON.parse(localStorage.getItem('params_entreprise') || '{}'); } catch (_) {}
    // Build aggregate mailto (subject + body, no recipient — user copy-paste par client)
    var msg = 'Bonjour,\n\nNous constatons un retard de paiement sur les factures suivantes :\n\n';
    Object.keys(byClient).forEach(function (c) {
      msg += '— ' + c + ' :\n';
      byClient[c].forEach(function (l) {
        var ttc = parseFloat(l.prixTTC || l.prix || 0).toFixed(2);
        msg += '  · ' + (l.numLiv || 'L-' + l.id.slice(0, 6)) + ' (' + (l.date || '?') + ') · ' + ttc + ' € TTC\n';
      });
      msg += '\n';
    });
    msg += 'Merci de régulariser dans les meilleurs délais.\n\nCordialement,\n' + (params.nom || 'MCA Logistics');
    var subject = 'Relance impayés - ' + new Date().toLocaleDateString('fr-FR');
    var href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg);
    window.location.href = href;
    toast(impayes.length + ' impayé(s) sur ' + nbClients + ' client(s) — email préparé');
  }
  window.envoyerRelancesEmail = envoyerRelancesEmail;
})();
