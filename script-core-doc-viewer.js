/**
 * MCA Logistics — Document viewer modal (Phase X.K — extraction script.js)
 *
 * Modal plein écran pour afficher un document (PDF ou image) sans bloquer le popup-blocker.
 * - PDF normal : <iframe>
 * - PDF Safari : carte avec boutons Ouvrir / Télécharger (Safari restreint <iframe> PDF)
 * - Image : <img> centrée
 *
 * Fermeture : clic overlay, bouton ✕, ou touche Échap.
 *
 * Dependencies (globals) : escHtml.
 *
 * Extracted from script.js L2782-2823 (Phase X.K, 2026-05-16).
 */

function afficherDocumentDansFenetre(url, isPdf, titre) {
  // Modal inline plein ecran (remplace l'ancien window.open qui etait bloque par le popup-blocker).
  // PDF : on tente <iframe>, fallback carte avec boutons Ouvrir/Telecharger si Safari.
  // Image : <img> centree dans le modal.
  document.querySelector('.doc-viewer-modal')?.remove();
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const fname = String(titre || 'document').replace(/[^a-zA-Z0-9._-]/g, '_') + (isPdf ? '.pdf' : '');
  const overlay = document.createElement('div');
  overlay.className = 'doc-viewer-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10000;display:flex;flex-direction:column;font-family:"Segoe UI",Arial,sans-serif';

  let bodyHtml;
  if (!isPdf) {
    bodyHtml = '<img src="' + url + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px" />';
  } else if (isSafari) {
    bodyHtml = '<div style="background:#1a1d27;border-radius:14px;padding:32px 26px;max-width:380px;width:100%;text-align:center;color:#fff">'
      + '<div style="font-size:3.5rem;line-height:1;margin-bottom:14px">📄</div>'
      + '<div style="font-weight:600;font-size:1.05rem;margin-bottom:22px;word-break:break-word">' + escHtml(titre || 'Document PDF') + '</div>'
      + '<a href="' + url + '" target="_blank" rel="noopener" style="display:block;background:#e63946;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px;margin-bottom:10px;font-size:.95rem">Ouvrir le PDF</a>'
      + '<a href="' + url + '" download="' + escHtml(fname) + '" style="display:block;background:#374151;color:#fff;text-decoration:none;font-weight:600;padding:14px;border-radius:12px;font-size:.95rem">⬇ Télécharger</a>'
      + '</div>';
  } else {
    bodyHtml = '<iframe src="' + url + '" style="width:100%;height:100%;border:0;background:#fff"></iframe>';
  }
  const isCard = isPdf && isSafari;
  overlay.innerHTML = ''
    + '<header style="flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 16px;background:rgba(0,0,0,.4);color:#fff">'
    +   '<div style="flex:1 1 auto;font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📄 ' + escHtml(titre || 'Document') + '</div>'
    +   (!isCard ? '<a href="' + url + '" download="' + escHtml(fname) + '" title="Télécharger" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;text-decoration:none;font-size:1rem">⬇</a>' : '')
    +   '<button type="button" class="doc-viewer-close" aria-label="Fermer" style="flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;border:none;font-size:1.05rem;cursor:pointer">✕</button>'
    + '</header>'
    + '<div style="flex:1 1 auto;overflow:auto;display:flex;align-items:' + (isCard ? 'center' : (isPdf ? 'stretch' : 'center')) + ';justify-content:center;padding:' + (isPdf && !isCard ? '0' : '20px') + '">'
    +   bodyHtml
    + '</div>';
  const close = function () { overlay.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  const onKey = function (e) { if (e.key === 'Escape') close(); };
  overlay.querySelector('.doc-viewer-close').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

if (typeof window !== "undefined") {
  window.afficherDocumentDansFenetre = afficherDocumentDansFenetre;
}
