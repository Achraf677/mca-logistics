/**
 * MCA Logistics — Sprint 6 — Bulk actions livraisons (toggle all/marquer payées/supprimer/exporter) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4898-5238 (2026-05-16).
 */

/* ================================================================
   SPRINT 6 — BULK ACTIONS SUR LIVRAISONS
   toggleBulkSelectAll, majBulkActions, bulkMarquerPayees,
   bulkSupprimer, bulkExporter, bulkClear
   ================================================================ */
(function() {
  function getCheckboxes() {
    return document.querySelectorAll('#tb-livraisons .bulk-liv-check');
  }
  function getSelectedIds() {
    const ids = [];
    getCheckboxes().forEach(function(cb) {
      if (cb.checked) ids.push(cb.getAttribute('data-liv-id'));
    });
    return ids;
  }

  window.toggleBulkSelectAll = function(checked) {
    getCheckboxes().forEach(function(cb) {
      cb.checked = !!checked;
      const tr = cb.closest('tr');
      if (tr) tr.classList.toggle('bulk-selected', !!checked);
    });
    window.majBulkActions();
  };

  window.majBulkActions = function() {
    const bar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-count-num');
    const selectAll = document.getElementById('bulk-select-all');
    const cbs = getCheckboxes();
    const selected = [];

    cbs.forEach(function(cb) {
      const tr = cb.closest('tr');
      if (cb.checked) {
        selected.push(cb.getAttribute('data-liv-id'));
        if (tr) tr.classList.add('bulk-selected');
      } else {
        if (tr) tr.classList.remove('bulk-selected');
      }
    });

    const n = selected.length;
    if (countEl) countEl.textContent = String(n);

    if (bar) {
      if (n > 0) {
        bar.classList.add('visible');
        bar.setAttribute('aria-hidden', 'false');
      } else {
        bar.classList.remove('visible');
        bar.setAttribute('aria-hidden', 'true');
      }
    }

    // État "intermédiaire" du select-all
    if (selectAll) {
      if (n === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      } else if (n === cbs.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      }
    }
  };

  window.bulkClear = function() {
    getCheckboxes().forEach(function(cb) {
      cb.checked = false;
      const tr = cb.closest('tr');
      if (tr) tr.classList.remove('bulk-selected');
    });
    const selectAll = document.getElementById('bulk-select-all');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    window.majBulkActions();
  };

  window.bulkMarquerPayees = async function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const ok = await confirmDialog('Marquer ' + ids.length + ' livraison(s) comme payée(s) ?', { titre:'Marquer payées', icone:'💳', btnLabel:'Confirmer', danger:false });
    if (!ok) return;

    const livraisons = charger('livraisons');
    let count = 0;
    const today = new Date().toLocalISODate();

    livraisons.forEach(function(l) {
      if (ids.indexOf(l.id) !== -1) {
        l.statutPaiement = 'payé';
        if (!l.datePaiement) l.datePaiement = today;
        count++;
        if (typeof ajouterEntreeAudit === 'function') {
          try { ajouterEntreeAudit('Paiement livraison (bulk)', (l.numLiv || 'Livraison') + ' · payé'); } catch (e) {
            if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
              console.warn('[script:bulkMarquerPayees-audit]', e);
            }
            if (window.Sentry && window.Sentry.captureException) {
              try { window.Sentry.captureException(e); } catch (_) {}
            }
          }
        }
      }
    });

    sauvegarder('livraisons', livraisons);
    if (typeof afficherLivraisons === 'function') afficherLivraisons();
    if (typeof afficherToast === 'function') afficherToast('💳 ' + count + ' livraison(s) marquée(s) payée(s)');
    window.bulkClear();
  };

  window.bulkMarquerLivrees = async function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const ok = await confirmDialog('Marquer ' + ids.length + ' livraison(s) comme livrée(s) ?', { titre:'Marquer livrées', icone:'✅', btnLabel:'Confirmer', danger:false });
    if (!ok) return;

    const livraisons = charger('livraisons');
    let count = 0;
    livraisons.forEach(function(l) {
      if (ids.indexOf(l.id) !== -1) {
        l.statut = 'livre';
        count++;
        if (typeof ajouterEntreeAudit === 'function') {
          try { ajouterEntreeAudit('Statut livraison (bulk)', (l.numLiv || 'Livraison') + ' · livrée'); } catch (e) {
            if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
              console.warn('[script:bulkMarquerLivrees-audit]', e);
            }
            if (window.Sentry && window.Sentry.captureException) {
              try { window.Sentry.captureException(e); } catch (_) {}
            }
          }
        }
      }
    });

    sauvegarder('livraisons', livraisons);
    if (typeof afficherLivraisons === 'function') afficherLivraisons();
    if (typeof afficherToast === 'function') afficherToast('✅ ' + count + ' livraison(s) marquée(s) livrée(s)');
    window.bulkClear();
  };

  window.bulkSupprimer = async function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const ok = await confirmDialog('Supprimer définitivement ' + ids.length + ' livraison(s) ? Cette action est irréversible.', { titre:'Suppression en masse', icone:'🗑️', btnLabel:'Supprimer' });
    if (!ok) return;

    const livraisons = charger('livraisons');
    const restantes = livraisons.filter(function(l) {
      if (ids.indexOf(l.id) !== -1) {
        if (typeof annulerArchiveFactureLivraison === 'function') {
          try { annulerArchiveFactureLivraison(l); } catch (e) {
            if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
              console.warn('[script:bulkSupprimer-annulerArchive]', e);
            }
            if (window.Sentry && window.Sentry.captureException) {
              try { window.Sentry.captureException(e); } catch (_) {}
            }
          }
        }
        if (typeof ajouterEntreeAudit === 'function') {
          try { ajouterEntreeAudit('Suppression livraison (bulk)', (l.numLiv || 'Livraison') + ' · ' + (l.client || 'Client')); } catch (e) {
            if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
              console.warn('[script:bulkSupprimer-audit]', e);
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
    if (typeof afficherToast === 'function') afficherToast('🗑️ ' + ids.length + ' livraison(s) supprimée(s)');
    window.bulkClear();
  };

  window.bulkExporter = function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const livraisons = charger('livraisons').filter(function(l) {
      return ids.indexOf(l.id) !== -1;
    });

    if (typeof exporterCSV !== 'function') {
      if (typeof afficherToast === 'function') afficherToast('⚠️ Export indisponible', 'error');
      return;
    }

    const filename = 'livraisons_selection_' + new Date().toLocalISODate() + '.csv';
    exporterCSV(livraisons, [
      { label: 'N° LIV',       get: function(l) { return l.numLiv || ''; } },
      { label: 'Date',          get: function(l) { return l.date || ''; } },
      { label: 'Client',        get: function(l) { return l.client || ''; } },
      { label: 'Départ',        get: function(l) { return l.depart || ''; } },
      { label: 'Arrivée',       get: function(l) { return l.arrivee || ''; } },
      { label: 'Distance km',   get: function(l) { return l.distance || ''; } },
      { label: 'Prix €',        get: function(l) { return l.prix || ''; } },
      { label: 'Chauffeur',     get: function(l) { return l.chaufNom || ''; } },
      { label: 'Statut',        get: function(l) { return l.statut || ''; } },
      { label: 'Paiement',      get: function(l) { return l.statutPaiement || ''; } },
      { label: 'Date paiement', get: function(l) { return l.datePaiement || ''; } }
    ], filename);

    if (typeof afficherToast === 'function') afficherToast('Export de ' + ids.length + ' livraison(s)');
  };

  window.bulkExporterPDF = function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const livraisons = charger('livraisons').filter(function(l) {
      return ids.indexOf(l.id) !== -1;
    }).sort(function(a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

    const fmtDate = typeof formatDateExport === 'function' ? formatDateExport : function(d) { return d || ''; };
    const fmtEur  = typeof euros === 'function' ? euros : function(v) { return (v || 0) + ' €'; };
    const escape  = window.escapeHtml;

    const params = typeof getEntrepriseExportParams === 'function' ? getEntrepriseExportParams() : {};
    const nomEntr = escape(params.nom || 'MCA Logistics');

    const cellCss = 'padding:8px 10px;border-bottom:1px solid #f3f4f6';
    const badgeCss = 'padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600';

    let totalHT = 0, totalTVA = 0, totalTTC = 0;
    const rows = livraisons.map(function(l) {
      const ht = typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0);
      const ttc = parseFloat(l.prix) || 0;
      const tva = ttc - ht;
      totalHT += ht; totalTVA += tva; totalTTC += ttc;

      const badgeStatut = l.statut === 'livre' ? '<span style="' + badgeCss + ';background:#d1fae5;color:#065f46">Livrée</span>'
                      : l.statut === 'en-cours' ? '<span style="' + badgeCss + ';background:#dbeafe;color:#1e40af">En cours</span>'
                      : '<span style="' + badgeCss + ';background:#fef3c7;color:#92400e">En attente</span>';
      const badgePay = l.statutPaiement === 'payé' ? '<span style="' + badgeCss + ';background:#d1fae5;color:#065f46">Payé</span>'
                     : l.statutPaiement === 'litige' ? '<span style="' + badgeCss + ';background:#fee2e2;color:#991b1b">Litige</span>'
                     : '<span style="' + badgeCss + ';background:#fef3c7;color:#92400e">Attente</span>';

      return '<tr>' +
        '<td style="' + cellCss + '">' + escape(l.numLiv || '—') + '</td>' +
        '<td style="' + cellCss + '">' + escape(fmtDate(l.date)) + '</td>' +
        '<td style="' + cellCss + '">' + escape(l.client || '—') + '</td>' +
        '<td style="' + cellCss + '">' + escape(l.chaufNom || '—') + '</td>' +
        '<td style="' + cellCss + ';text-align:right">' + fmtEur(ht) + '</td>' +
        '<td style="' + cellCss + ';text-align:right;color:#6b7280">' + fmtEur(tva) + '</td>' +
        '<td style="' + cellCss + ';text-align:right;font-weight:700">' + fmtEur(ttc) + '</td>' +
        '<td style="' + cellCss + '">' + badgeStatut + '</td>' +
        '<td style="' + cellCss + '">' + badgePay + '</td>' +
      '</tr>';
    }).join('');

    const now = new Date();
    const dateGen = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    const html =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#111827">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #e63946">' +
          '<div>' +
            '<div style="font-size:1.4rem;font-weight:900;color:#e63946">' + nomEntr + '</div>' +
            '<div style="font-size:.82rem;color:#6b7280;margin-top:4px">Récapitulatif livraisons</div>' +
          '</div>' +
          '<div style="text-align:right;font-size:.82rem;color:#6b7280">' +
            '<div>Généré le <strong>' + escape(dateGen) + '</strong></div>' +
            '<div>' + livraisons.length + ' livraison(s)</div>' +
          '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
          '<thead>' +
            '<tr style="background:#f3f4f6;text-align:left">' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">N° LIV</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Date</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Client</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Chauffeur</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">HT</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">TVA</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">TTC</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Statut</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Paiement</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody style="background:#fff">' + rows + '</tbody>' +
          '<tfoot>' +
            '<tr style="background:#fef3c7;font-weight:700">' +
              '<td colspan="4" style="padding:10px;text-align:right">TOTAUX</td>' +
              '<td style="padding:10px;text-align:right">' + fmtEur(totalHT) + '</td>' +
              '<td style="padding:10px;text-align:right;color:#6b7280">' + fmtEur(totalTVA) + '</td>' +
              '<td style="padding:10px;text-align:right">' + fmtEur(totalTTC) + '</td>' +
              '<td colspan="2"></td>' +
            '</tr>' +
          '</tfoot>' +
        '</table>' +
        '<div style="margin-top:16px;font-size:.72rem;color:#9ca3af;text-align:center">Document généré par MCA Logistics</div>' +
      '</div>';

    const win = ouvrirPopupSecure('', '_blank');
    if (!win) {
      if (typeof afficherToast === 'function') afficherToast('⚠️ Autorise les popups pour exporter en PDF', 'error');
      return;
    }
    win.document.write(
      '<!DOCTYPE html><html><head><title>Livraisons — ' + nomEntr + '</title>' +
      '<style>body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif}@page{margin:10mm;size:landscape}@media print{.no-print{display:none}}</style>' +
      '</head><body>' + html +
      '<script>setTimeout(function(){window.print();},400);<\/script>' +
      '</body></html>'
    );
    win.document.close();

    if (typeof afficherToast === 'function') afficherToast('PDF de ' + ids.length + ' livraison(s) prêt à imprimer');
  };

  // Touche Échap pour vider la sélection
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const bar = document.getElementById('bulk-action-bar');
      if (bar && bar.classList.contains('visible')) {
        const drawer = document.getElementById('side-drawer');
        if (drawer && drawer.classList.contains('open')) return;
        window.bulkClear();
      }
    }
  });

})();
