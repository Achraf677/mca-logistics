/* Phase 60 V7 polish — Réintégration legacy tva_declarations sur page TVA.
   Affiche l'historique des déclarations TVA mensuelles avec leur statut.
   Lit depuis localStorage clé `tva_declarations`. */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtEur(n) {
    return (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statutBadge(statut) {
    var s = (statut || '').toLowerCase();
    if (s === 'declaree' || s === 'déclarée' || s === 'paye' || s === 'payé') return '<span class="badge ok">Déclarée</span>';
    if (s === 'a_declarer' || s === 'à_declarer' || s === 'a declarer') return '<span class="badge warn">À déclarer</span>';
    if (s === 'en_cours' || s === 'en cours') return '<span class="badge warn">En cours</span>';
    return '<span class="badge warn">' + escapeHtml(statut || 'En attente') + '</span>';
  }

  function periodeLabel(d) {
    var mois = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
    if (d.periode) return d.periode;
    if (d.mois && d.annee) {
      var m = parseInt(d.mois, 10) - 1;
      return (mois[m] || ('Mois ' + d.mois)) + ' ' + d.annee;
    }
    return '—';
  }

  function render() {
    var tb = document.getElementById('tb-tva-historique');
    if (!tb) return;
    var declarations = lire('tva_declarations');
    var count = document.getElementById('tva-historique-count');
    var total = document.getElementById('tva-historique-total');
    if (count) count.textContent = declarations.length;
    if (total) {
      var sum = declarations
        .filter(function (d) {
          var s = (d.statut || '').toLowerCase();
          return s === 'declaree' || s === 'déclarée' || s === 'paye' || s === 'payé';
        })
        .reduce(function (s, d) { return s + (parseFloat(d.tvaAReverser) || 0); }, 0);
      total.textContent = fmtEur(sum);
    }
    if (!declarations.length) {
      tb.innerHTML = '<tr><td colspan="5" class="empty-row">Aucune déclaration archivée</td></tr>';
      return;
    }
    // Sort by year desc, month desc
    declarations.sort(function (a, b) {
      if (a.annee !== b.annee) return b.annee - a.annee;
      return parseInt(b.mois || 0, 10) - parseInt(a.mois || 0, 10);
    });
    tb.innerHTML = declarations.map(function (d) {
      return '<tr>'
        + '<td>' + escapeHtml(periodeLabel(d)) + '</td>'
        + '<td class="mono">' + fmtEur(d.tvaCollectee || 0) + '</td>'
        + '<td class="mono">' + fmtEur(d.tvaDeductible || 0) + '</td>'
        + '<td class="mono"><strong>' + fmtEur(d.tvaAReverser || 0) + '</strong></td>'
        + '<td>' + statutBadge(d.statut) + '</td>'
        + '</tr>';
    }).join('');
  }

  function observePage() {
    var page = document.getElementById('page-tva');
    if (!page || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function () {
      if (page.classList.contains('active')) render();
    }).observe(page, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    render();
    observePage();
    setInterval(render, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refonteTvaHistoriqueRender = render;
})();
