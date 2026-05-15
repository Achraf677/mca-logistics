/* Phase 60 V7 polish — Réintégration legacy localStorage sur page Encaissement.
   Affiche 3 sections orphelines : factures_emises, avoirs_emis, acomptes.
   Lit depuis localStorage et rend les tables + KPIs sub-titre. */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtEur(n) {
    return (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) { return String(d); }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statutBadge(statut) {
    var s = (statut || '').toLowerCase();
    if (s === 'payee' || s === 'payé' || s === 'paye' || s === 'payée') return '<span class="badge ok">Payée</span>';
    if (s === 'partielle' || s === 'partiel') return '<span class="badge warn">Partielle</span>';
    if (s === 'annulee' || s === 'annulée') return '<span class="badge alert">Annulée</span>';
    return '<span class="badge warn">En attente</span>';
  }

  function renderFacturesEmises() {
    var tb = document.getElementById('tb-enc-factures');
    if (!tb) return;
    var factures = lire('factures_emises');
    var count = document.getElementById('enc-fact-count');
    var total = document.getElementById('enc-fact-total');
    if (count) count.textContent = factures.length;
    if (total) {
      var sum = factures.reduce(function (s, f) { return s + (parseFloat(f.montantTTC || f.totalTTC || f.montant) || 0); }, 0);
      total.textContent = fmtEur(sum);
    }
    if (!factures.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucune facture émise</td></tr>';
      return;
    }
    factures.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    tb.innerHTML = factures.map(function (f) {
      return '<tr>'
        + '<td class="mono">' + escapeHtml(f.numero || f.num || f.id || '—') + '</td>'
        + '<td>' + escapeHtml(f.client || f.clientNom || '—') + '</td>'
        + '<td>' + fmtDate(f.date) + '</td>'
        + '<td class="mono">' + fmtEur(f.montantHT || f.totalHT || 0) + '</td>'
        + '<td class="mono">' + fmtEur(f.montantTTC || f.totalTTC || f.montant || 0) + '</td>'
        + '<td>' + statutBadge(f.statut || f.statutPaiement) + '</td>'
        + '</tr>';
    }).join('');
  }

  function renderAvoirs() {
    var tb = document.getElementById('tb-enc-avoirs');
    if (!tb) return;
    var avoirs = lire('avoirs_emis');
    if (!avoirs.length) avoirs = lire('avoirs');  // fallback
    var count = document.getElementById('enc-avoirs-count');
    var total = document.getElementById('enc-avoirs-total');
    if (count) count.textContent = avoirs.length;
    if (total) {
      var sum = avoirs.reduce(function (s, a) { return s + (parseFloat(a.montantTTC || a.montant) || 0); }, 0);
      total.textContent = fmtEur(sum);
    }
    if (!avoirs.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun avoir émis</td></tr>';
      return;
    }
    avoirs.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    tb.innerHTML = avoirs.map(function (a) {
      return '<tr>'
        + '<td class="mono">' + escapeHtml(a.numero || a.id || '—') + '</td>'
        + '<td>' + escapeHtml(a.client || a.clientNom || '—') + '</td>'
        + '<td>' + fmtDate(a.date) + '</td>'
        + '<td>' + escapeHtml(a.motif || a.raison || '—') + '</td>'
        + '<td class="mono">' + fmtEur(a.montantHT || 0) + '</td>'
        + '<td class="mono">' + fmtEur(a.montantTTC || a.montant || 0) + '</td>'
        + '</tr>';
    }).join('');
  }

  function renderAcomptes() {
    var tb = document.getElementById('tb-enc-acomptes');
    if (!tb) return;
    var acomptes = lire('acomptes');
    var count = document.getElementById('enc-acomptes-count');
    var total = document.getElementById('enc-acomptes-total');
    if (count) count.textContent = acomptes.length;
    if (total) {
      var sum = acomptes.reduce(function (s, a) { return s + (parseFloat(a.montant) || 0); }, 0);
      total.textContent = fmtEur(sum);
    }
    if (!acomptes.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun acompte enregistré</td></tr>';
      return;
    }
    acomptes.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    tb.innerHTML = acomptes.map(function (a) {
      return '<tr>'
        + '<td>' + fmtDate(a.date) + '</td>'
        + '<td>' + escapeHtml(a.client || a.clientNom || '—') + '</td>'
        + '<td class="mono">' + escapeHtml(a.livRef || a.livId || '—') + '</td>'
        + '<td>' + escapeHtml(a.mode || a.modePaiement || '—') + '</td>'
        + '<td class="mono">' + fmtEur(a.montant || 0) + '</td>'
        + '<td>' + escapeHtml(a.note || '') + '</td>'
        + '</tr>';
    }).join('');
  }

  // Export CSV factures émises
  function exporterFacturesEmisesCSV() {
    var factures = lire('factures_emises');
    if (!factures.length) {
      if (window.afficherToast) window.afficherToast('Aucune facture à exporter', 'warning');
      return;
    }
    var esc = function (v) {
      var s = (v == null ? '' : String(v));
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    var lines = ['Numéro,Client,Date,Montant HT,Montant TTC,Statut'];
    factures.forEach(function (f) {
      lines.push([
        f.numero || f.num || f.id || '',
        f.client || f.clientNom || '',
        fmtDate(f.date),
        f.montantHT || f.totalHT || 0,
        f.montantTTC || f.totalTTC || f.montant || 0,
        f.statut || f.statutPaiement || ''
      ].map(esc).join(','));
    });
    var csv = '﻿' + lines.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    a.href = url; a.download = 'factures_emises_' + stamp + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
    if (window.afficherToast) window.afficherToast(factures.length + ' facture(s) exportée(s)');
  }
  window.exporterFacturesEmisesCSV = exporterFacturesEmisesCSV;

  function renderAll() {
    try { renderFacturesEmises(); } catch (e) { console.warn('[enc-legacy-factures]', e); }
    try { renderAvoirs(); } catch (e) { console.warn('[enc-legacy-avoirs]', e); }
    try { renderAcomptes(); } catch (e) { console.warn('[enc-legacy-acomptes]', e); }
  }

  // Re-render quand page-encaissement devient active
  function observePages() {
    var page = document.getElementById('page-encaissement');
    if (!page || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function () {
      if (page.classList.contains('active')) renderAll();
    }).observe(page, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    renderAll();
    observePages();
    setInterval(renderAll, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refonteEncLegacyRender = renderAll;
})();
