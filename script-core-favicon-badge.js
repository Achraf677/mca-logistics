/**
 * MCA Logistics — Badge count sur favicon (canvas overlay) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1822-1868 (2026-05-16).
 */


/* ===== BADGE FAVICON ===== */
let _faviconCanvas = null;
function majBadgeFavicon(count) {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.rel = 'icon';
  const logo = getLogoEntreprise();
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const dessinerBadge = function() {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(25, 7, 8, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(count > 9 ? '9+' : String(count), 25, 11);
    link.href = canvas.toDataURL();
    document.head.appendChild(link);
  };
  if (count <= 0) {
    link.href = logo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚐</text></svg>";
    document.head.appendChild(link);
    return;
  }
  if (logo) {
    const img = new Image();
    img.onload = function() {
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      dessinerBadge();
    };
    img.onerror = function() {
      ctx.font = '24px serif';
      ctx.fillText('🚐', 0, 24);
      dessinerBadge();
    };
    img.src = logo;
    return;
  }
  ctx.font = '24px serif';
  ctx.fillText('🚐', 0, 24);
  dessinerBadge();
}

if (typeof window !== 'undefined') {
  window.majBadgeFavicon = majBadgeFavicon;
}
