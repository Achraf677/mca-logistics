/**
 * MCA Logistics — Helper DSO (Days Sales Outstanding)
 *
 * Calcule le delai moyen reel de paiement client = AVG(date_paiement - date_livraison)
 * sur les livraisons payees des N derniers jours, par client.
 *
 * Utilise dans :
 *   - script-encaissement.js (KPI page Encaissement PC)
 *   - script-mobile.js route 'encaissement' (KPI mobile)
 *   - infra/supabase/functions/ai-brief (source dso_clients du brief IA)
 *
 * Calcul a la volee, pas de modification de la table livraisons.
 *
 * Sprint H3.4 — exposed at window.calculerDSO + module.exports pour tests Node.
 */
(function () {
  'use strict';

  /**
   * Calcule le DSO sur une liste de livraisons.
   *
   * @param {Array} livraisons - Array de livraisons (objet avec statutPaiement,
   *   dateLivraison, datePaiement, client).
   * @param {Object} [opts]
   * @param {number} [opts.periodeJours=90] - Fenetre de calcul (jours).
   * @returns {{ dso: number|null, count: number, byClient: Object<string, number> }}
   *   - dso : delai moyen en jours arrondi (null si aucune livraison eligible)
   *   - count : nombre de livraisons dans le calcul
   *   - byClient : delai moyen par client (clients absents si pas de paiement)
   */
  function calculerDSO(livraisons, opts) {
    opts = opts || {};
    var periodeJours = opts.periodeJours || 90;
    var today = new Date();
    var dateMin = new Date(today.getTime() - periodeJours * 86400000);

    // Phase 91.42 — Support des deux schémas : `date` (court, default UI) et `dateLivraison` (long, legacy)
    function livDateOf(l) { return l.date || l.dateLivraison || l.date_livraison || ''; }
    function livDatePaiementOf(l) { return l.datePaiement || l.date_paiement || ''; }
    function livStatutPaiementOf(l) { return l.statutPaiement || l.statut_paiement || ''; }

    var livPayees = (livraisons || []).filter(function (l) {
      if (!l) return false;
      var statut = livStatutPaiementOf(l);
      if (statut !== 'paye' && statut !== 'payé' && statut !== 'payee' && statut !== 'payée') return false;
      var dStrL = livDateOf(l);
      var dStrP = livDatePaiementOf(l);
      if (!dStrL || !dStrP) return false;
      var dl = new Date(dStrL);
      if (isNaN(dl.getTime())) return false;
      if (dl < dateMin) return false;
      return true;
    });

    if (!livPayees.length) return { dso: null, count: 0, byClient: {} };

    var totalDelai = 0;
    var nbValides = 0;
    var byClient = {};
    for (var i = 0; i < livPayees.length; i++) {
      var l = livPayees[i];
      var dlMs = new Date(livDateOf(l)).getTime();
      var dpMs = new Date(livDatePaiementOf(l)).getTime();
      if (isNaN(dlMs) || isNaN(dpMs)) continue;
      var delai = (dpMs - dlMs) / 86400000;
      // Defense : exclure les delais aberrants (negatifs ou > 365j)
      if (delai < 0 || delai > 365) continue;
      totalDelai += delai;
      nbValides += 1;
      var c = l.client || 'Client inconnu';
      if (!byClient[c]) byClient[c] = { sum: 0, count: 0 };
      byClient[c].sum += delai;
      byClient[c].count += 1;
    }

    if (!nbValides) return { dso: null, count: 0, byClient: {} };

    var result = {
      dso: Math.round(totalDelai / nbValides),
      count: nbValides,
      byClient: {}
    };
    for (var k in byClient) {
      if (Object.prototype.hasOwnProperty.call(byClient, k)) {
        result.byClient[k] = Math.round(byClient[k].sum / byClient[k].count);
      }
    }
    return result;
  }

  // Scope global front-end (pattern CLAUDE.md)
  if (typeof window !== 'undefined') {
    window.calculerDSO = calculerDSO;
  }
  // Export Node pour tests unitaires
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculerDSO: calculerDSO };
  }
})();
