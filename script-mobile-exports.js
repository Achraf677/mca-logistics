/**
 * MCA Logistics — Exports PDF mobile (parite PC partielle).
 *
 * Pourquoi pas jsPDF ?
 *   - Le PC utilise deja `window.print()` sur une fenetre HTML stylisee
 *     (cf. `ouvrirFenetreImpression` dans script.js, et tout script-exports.js).
 *   - jsPDF + autotable ~150 KB minifie : trop lourd pour le mobile vs ~5 KB ici.
 *   - Sur Android Chrome / iOS Safari, le menu impression propose
 *     "Enregistrer en PDF" -> meme experience utilisateur, zero dependance.
 *
 * API publique :
 *   M.exportPDF(title, columns, rows, opts?)
 *     - title    string  : titre du document (ex: "Livraisons — mai 2026")
 *     - columns  string[] : libelles de colonnes (ex: ["Date","Client","Montant"])
 *     - rows     (string|number)[][] : matrice de cellules (ligne x colonne)
 *     - opts.summary? string : ligne de meta (ex: "12 lignes · 4 320,00 €")
 *     - opts.subtitle? string : sous-titre (ex: "Filtre : Ce mois")
 *
 * Couverture initiale (PR « Stats Chart.js + Export PDF ») :
 *   - Livraisons (liste filtree courante)
 *   - Charges (liste filtree courante)
 *   - Encaissement (liste filtree courante)
 *
 * Le reste sera couvert dans une PR de suivi (parite PC complete).
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return; // mode Node : ne rien faire (cf. CommonJS export en bas)
  if (!window.MCAm) { window.MCAm = {}; }
  var M = window.MCAm;
  if (M.exportPDF && M.exportPDF.__mca_v1) return;

  // Strip emojis / symboles non-imprimables : meme via window.print les emojis
  // se rendent mal en PDF mobile sur certains devices (boites vides), et le CSV
  // text-only est plus propre.
  function stripEmojis(s) {
    if (s == null) return '';
    return String(s)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2900}-\u{297F}]/gu, '')
      .replace(/[︀-️‍]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDateNow() {
    return new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * Ouvre une fenetre / popup d'impression. Sur mobile, la plupart des
   * navigateurs (Chrome Android, Safari iOS) ouvrent un nouvel onglet et
   * declenchent automatiquement la boite d'impression (-> Enregistrer en PDF).
   */
  function openPrintWindow(documentTitle, html) {
    var w;
    try {
      w = window.open('', '_blank');
    } catch (_) { w = null; }
    if (!w) {
      // Popup bloquee : fallback in-place via iframe hors-DOM.
      var ifr = document.createElement('iframe');
      ifr.setAttribute('aria-hidden', 'true');
      ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(ifr);
      var idoc = ifr.contentDocument || ifr.contentWindow.document;
      idoc.open();
      idoc.write('<!doctype html><html><head><meta charset="utf-8"><title>' +
        escHtml(documentTitle) + '</title></head><body>' + html + '</body></html>');
      idoc.close();
      try {
        ifr.contentWindow.focus();
        setTimeout(function() {
          try { ifr.contentWindow.print(); } catch (_) {}
          setTimeout(function() {
            try { document.body.removeChild(ifr); } catch (_) {}
          }, 60000);
        }, 300);
      } catch (_) {}
      return;
    }
    var fullHtml = '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escHtml(documentTitle) + '</title>' +
      '<style>' +
        'html,body{margin:0;padding:0;background:#fff;color:#111827;' +
          'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;' +
          '-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}' +
        'body{padding:18px}' +
        '@page{margin:10mm}' +
        '.mca-pdf-h{display:flex;justify-content:space-between;align-items:flex-start;' +
          'gap:14px;padding-bottom:10px;border-bottom:2px solid #f5a623;margin-bottom:14px}' +
        '.mca-pdf-h .brand{font-size:1.25rem;font-weight:900;color:#f5a623}' +
        '.mca-pdf-h .meta{font-size:.78rem;color:#6b7280;text-align:right}' +
        '.mca-pdf-title{font-size:.95rem;font-weight:700;margin:6px 0 2px;color:#111827}' +
        '.mca-pdf-sub{font-size:.78rem;color:#6b7280}' +
        'table{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:10px}' +
        'thead tr{background:#f3f4f6}' +
        'th{padding:8px 10px;text-align:left;font-weight:700;color:#111827;border-bottom:1px solid #e5e7eb}' +
        'td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}' +
        'tbody tr:nth-child(odd){background:#fafafa}' +
        '.num{text-align:right;font-variant-numeric:tabular-nums}' +
        '.foot{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;' +
          'text-align:center;font-size:.7rem;color:#9ca3af}' +
      '</style>' +
      '</head><body>' + html +
      '<script>window.addEventListener("load",function(){setTimeout(function(){' +
        'try{window.print();}catch(_){}' +
      '},300);});</' + 'script>' +
      '</body></html>';
    w.document.open();
    w.document.write(fullHtml);
    w.document.close();
  }

  M.exportPDF = function(title, columns, rows, opts) {
    opts = opts || {};
    columns = columns || [];
    rows = rows || [];
    var safeTitle = stripEmojis(title || 'Export');
    var dateExp = formatDateNow();

    // Detect colonnes numeriques (toutes valeurs numeriques ou vides) -> right-align.
    var nbCols = columns.length;
    var isNumCol = new Array(nbCols).fill(true);
    rows.forEach(function(r) {
      for (var i = 0; i < nbCols; i++) {
        var v = r[i];
        if (v == null || v === '') continue;
        if (typeof v === 'number') continue;
        if (/^[-+]?[\d\s ]+([.,]\d+)?\s?(€|km|kg|h|%)?$/.test(String(v).trim())) continue;
        isNumCol[i] = false;
      }
    });

    var thead = '<thead><tr>' + columns.map(function(c, i) {
      return '<th class="' + (isNumCol[i] ? 'num' : '') + '">' + escHtml(stripEmojis(c)) + '</th>';
    }).join('') + '</tr></thead>';

    var tbody = '<tbody>' + (rows.length === 0
      ? '<tr><td colspan="' + nbCols + '" style="text-align:center;color:#9ca3af;padding:18px">Aucune donnee</td></tr>'
      : rows.map(function(r) {
          return '<tr>' + r.map(function(v, i) {
            return '<td class="' + (isNumCol[i] ? 'num' : '') + '">' +
              escHtml(stripEmojis(v == null ? '' : v)) + '</td>';
          }).join('') + '</tr>';
        }).join('')
    ) + '</tbody>';

    var subtitle = opts.subtitle ? '<div class="mca-pdf-sub">' + escHtml(stripEmojis(opts.subtitle)) + '</div>' : '';
    var summary  = opts.summary  ? '<div style="margin-top:8px;font-size:.82rem;color:#374151"><strong>' + escHtml(stripEmojis(opts.summary)) + '</strong></div>' : '';

    var html = '' +
      '<div class="mca-pdf-h">' +
        '<div>' +
          '<div class="brand">MCA LOGISTICS</div>' +
          '<div class="mca-pdf-title">' + escHtml(safeTitle) + '</div>' +
          subtitle +
        '</div>' +
        '<div class="meta">Genere le <strong>' + escHtml(dateExp) + '</strong>' +
          '<div style="margin-top:2px">' + rows.length + ' ligne' + (rows.length > 1 ? 's' : '') + '</div>' +
        '</div>' +
      '</div>' +
      summary +
      '<table>' + thead + tbody + '</table>' +
      '<div class="foot">Document genere par MCA LOGISTICS le ' + escHtml(dateExp) + '</div>';

    openPrintWindow(safeTitle + ' — MCA LOGISTICS', html);

    if (M.toast) M.toast('PDF prêt — choisis « Enregistrer en PDF » dans l\'aperçu');
    return true;
  };
  M.exportPDF.__mca_v1 = true;

  // Bouton standard reutilisable dans les en-tetes de pages.
  M.exportPDFButton = function(id) {
    return '<button type="button" id="' + escHtml(id) + '" class="m-alertes-chip" ' +
      'style="flex:0 0 auto;padding:6px 10px;font-size:.78rem;font-weight:600" ' +
      'aria-label="Exporter en PDF">📄 PDF</button>';
  };

  // Helpers internes exposes pour tests Node.
  M._exportPDFHelpers = { stripEmojis: stripEmojis, escHtml: escHtml };
})();

// Exports CommonJS pour tests Node (require('./script-mobile-exports.js')).
// En navigateur, l'IIFE ci-dessus s'execute et `module` n'existe pas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (function() {
    function stripEmojis(s) {
      if (s == null) return '';
      return String(s)
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2900}-\u{297F}]/gu, '')
        .replace(/[︀-️‍]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    function detectNumericColumns(columns, rows) {
      var n = (columns || []).length;
      var num = new Array(n).fill(true);
      (rows || []).forEach(function(r) {
        for (var i = 0; i < n; i++) {
          var v = r[i];
          if (v == null || v === '') continue;
          if (typeof v === 'number') continue;
          if (/^[-+]?[\d\s ]+([.,]\d+)?\s?(€|km|kg|h|%)?$/.test(String(v).trim())) continue;
          num[i] = false;
        }
      });
      return num;
    }
    return { stripEmojis: stripEmojis, detectNumericColumns: detectNumericColumns };
  })();
}
