/**
 * MCA Logistics — Compression images base64/file avant stockage (Phase X — extraction script.js)
 *
 * Extracted from script.js L635-681 (2026-05-16).
 */

function compresserFichierImage(file, maxW, maxH, qualite, mimeType) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        let w = img.width;
        let h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          if (!blob) {
            reject(new Error('compression_failed'));
            return;
          }
          resolve(blob);
        }, mimeType || 'image/webp', qualite || 0.82);
      };
      img.onerror = function() { reject(new Error('image_load_failed')); };
      img.src = String(event.target?.result || '');
    };
    reader.onerror = function() { reject(new Error('file_read_failed')); };
    reader.readAsDataURL(file);
  });
}

// MOVED -> script-core-branding.js : uploaderLogoEntreprise
/* Génère un numéro de livraison unique LIV-AAAA-XXXX */
// MOVED -> script-livraisons.js : genNumLivraison

/* Compression image base64 avant stockage */
function compresserImage(base64, callback) {
  const img = new Image();
  img.onload = () => {
    const max = 800;
    let w = img.width, h = img.height;
    if (w > max || h > max) { const r = Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r); }
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    callback(c.toDataURL('image/jpeg',0.72));
  };
  img.src = base64;
}

if (typeof window !== 'undefined') {
  window.compresserFichierImage = compresserFichierImage;
  window.compresserImage = compresserImage;
}
