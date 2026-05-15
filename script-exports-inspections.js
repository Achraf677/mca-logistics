/* Phase 60 V7 polish — Inspections exports (PDF / CSV / Excel).
   Comble le trou des 3 boutons morts dans dropdown Exporter de page-inspections.
   Suit le pattern de script-exports.js (utilise exporterExcelXML helper si dispo). */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function fmtDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) { return d; }
  }

  function getRows() {
    var inspections = lire('inspections');
    return inspections.map(function (i) {
      var koCount = Array.isArray(i.pointsKO) ? i.pointsKO.length : 0;
      var statutLabel = i.statut === 'conforme' ? 'Conforme'
                     : koCount >= 3 ? 'Défaut majeur'
                     : koCount > 0 ? 'Défaut mineur'
                     : 'Avec anomalies';
      var defauts = Array.isArray(i.pointsKO) ? i.pointsKO.join(' / ') : '';
      var photoCount = (function () {
        if (Array.isArray(i.photos)) return i.photos.length;
        if (typeof i.photoUrl === 'string') return 1;
        return 0;
      })();
      return {
        date: fmtDate(i.date),
        km: i.km || '',
        vehicule: i.vehImmat || '',
        chauffeur: i.salNom || '',
        photos: photoCount,
        defauts: defauts,
        statut: statutLabel,
        commentaire: i.commentaire || '',
        creeLe: fmtDate(i.creeLe),
        source: i.source || 'driver'
      };
    });
  }

  function toCSV(rows) {
    var headers = ['Date', 'Km', 'Véhicule', 'Chauffeur', 'Photos', 'Défauts', 'Statut', 'Commentaire', 'Créé le', 'Source'];
    var esc = function (v) {
      var s = (v == null ? '' : String(v));
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    var lines = [headers.join(',')];
    rows.forEach(function (r) {
      lines.push([r.date, r.km, r.vehicule, r.chauffeur, r.photos, r.defauts, r.statut, r.commentaire, r.creeLe, r.source].map(esc).join(','));
    });
    return lines.join('\n');
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  function timestamp() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function exporterInspectionsCSV() {
    var rows = getRows();
    if (!rows.length) {
      if (window.afficherToast) window.afficherToast('Aucune inspection à exporter', 'warning');
      return;
    }
    var csv = '﻿' + toCSV(rows);  // BOM UTF-8 pour Excel FR
    download('inspections_' + timestamp() + '.csv', csv, 'text/csv;charset=utf-8');
    if (window.afficherToast) window.afficherToast(rows.length + ' inspection(s) exportée(s) en CSV');
  }
  window.exporterInspectionsCSV = exporterInspectionsCSV;

  function exporterInspectionsExcel() {
    var rows = getRows();
    if (!rows.length) {
      if (window.afficherToast) window.afficherToast('Aucune inspection à exporter', 'warning');
      return;
    }
    if (typeof window.exporterExcelXML === 'function') {
      window.exporterExcelXML({
        filename: 'inspections_' + timestamp() + '.xls',
        sheetName: 'Inspections',
        headers: ['Date', 'Km', 'Véhicule', 'Chauffeur', 'Photos', 'Défauts', 'Statut', 'Commentaire', 'Créé le', 'Source'],
        rows: rows.map(function (r) {
          return [r.date, r.km, r.vehicule, r.chauffeur, r.photos, r.defauts, r.statut, r.commentaire, r.creeLe, r.source];
        })
      });
      if (window.afficherToast) window.afficherToast(rows.length + ' inspection(s) exportée(s) en Excel');
    } else {
      exporterInspectionsCSV();
    }
  }
  window.exporterInspectionsExcel = exporterInspectionsExcel;

  function exporterInspectionsPDF() {
    var rows = getRows();
    if (!rows.length) {
      if (window.afficherToast) window.afficherToast('Aucune inspection à exporter', 'warning');
      return;
    }
    var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
      + '<title>Rapport inspections — ' + new Date().toLocaleDateString('fr-FR') + '</title>'
      + '<style>'
      + 'body{font-family:Arial,sans-serif;font-size:11px;color:#222;padding:24px;margin:0}'
      + 'h1{font-size:20px;margin:0 0 4px;color:#e63946}'
      + 'h2{font-size:13px;margin:18px 0 8px;color:#555;font-weight:600}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:14px}'
      + 'th,td{padding:6px 8px;border:1px solid #ddd;text-align:left;vertical-align:top}'
      + 'th{background:#f5f6f8;font-weight:600;font-size:10px;text-transform:uppercase}'
      + '.statut-ok{color:#06d6a0;font-weight:600}'
      + '.statut-warn{color:#f5a623;font-weight:600}'
      + '.statut-alert{color:#e63946;font-weight:600}'
      + '.meta{font-size:10px;color:#777;margin-bottom:18px}'
      + '@media print{body{padding:12px}}'
      + '</style></head><body>'
      + '<h1>Rapport inspections véhicules</h1>'
      + '<div class="meta">Généré le ' + new Date().toLocaleString('fr-FR') + ' — ' + rows.length + ' inspection(s)</div>'
      + '<table>'
      + '<thead><tr><th>Date</th><th>Véhicule</th><th>Chauffeur</th><th>Statut</th><th>Défauts</th><th>Photos</th></tr></thead>'
      + '<tbody>'
      + rows.map(function (r) {
          var cls = r.statut === 'Conforme' ? 'statut-ok'
                  : r.statut === 'Défaut majeur' ? 'statut-alert' : 'statut-warn';
          return '<tr>'
            + '<td>' + r.date + '</td>'
            + '<td>' + r.vehicule + '</td>'
            + '<td>' + r.chauffeur + '</td>'
            + '<td class="' + cls + '">' + r.statut + '</td>'
            + '<td>' + (r.defauts || '—') + '</td>'
            + '<td style="text-align:center">' + r.photos + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>'
      + '</body></html>';
    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      if (window.afficherToast) window.afficherToast('Bloqué par le navigateur — autorise les popups', 'error');
      return;
    }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(function () { try { w.print(); } catch (_) {} }, 400);
    if (window.afficherToast) window.afficherToast(rows.length + ' inspection(s) — fenêtre impression ouverte');
  }
  window.exporterInspectionsPDF = exporterInspectionsPDF;
})();
