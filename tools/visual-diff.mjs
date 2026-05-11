// MCA LOGISTICS — Visual diff via pixelmatch
//
// Compare 2 PNG (référence vs candidat) et génère :
//   - un 3e PNG avec les pixels différents en rouge
//   - un rapport JSON avec le % de différence
//
// Usage :
//   node tools/visual-diff.mjs <ref.png> <candidate.png> <out-diff.png>
//
// Exemple :
//   node tools/visual-diff.mjs screenshots/previews/dashboard.png \
//                              screenshots/refonte-prod/01-dashboard-pc.png \
//                              screenshots/diff/dashboard-diff.png

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const [, , refPath, candPath, outPath] = process.argv;

if (!refPath || !candPath || !outPath) {
  console.error('Usage: node tools/visual-diff.mjs <ref.png> <candidate.png> <out-diff.png>');
  process.exit(2);
}

const ref = PNG.sync.read(readFileSync(refPath));
const cand = PNG.sync.read(readFileSync(candPath));

// Resize cand to ref dimensions if needed (pixelmatch demands same size)
let candResized = cand;
if (cand.width !== ref.width || cand.height !== ref.height) {
  console.warn(`Resizing cand from ${cand.width}x${cand.height} to ${ref.width}x${ref.height} (top-left crop, transparent padding)`);
  const resized = new PNG({ width: ref.width, height: ref.height, fill: true });
  // Manual top-left blit
  for (let y = 0; y < Math.min(ref.height, cand.height); y++) {
    for (let x = 0; x < Math.min(ref.width, cand.width); x++) {
      const sIdx = (cand.width * y + x) << 2;
      const dIdx = (ref.width * y + x) << 2;
      resized.data[dIdx] = cand.data[sIdx];
      resized.data[dIdx + 1] = cand.data[sIdx + 1];
      resized.data[dIdx + 2] = cand.data[sIdx + 2];
      resized.data[dIdx + 3] = cand.data[sIdx + 3];
    }
  }
  candResized = resized;
}

const diff = new PNG({ width: ref.width, height: ref.height });

const totalPixels = ref.width * ref.height;
const diffPixels = pixelmatch(
  ref.data, candResized.data, diff.data, ref.width, ref.height,
  { threshold: 0.1, diffColor: [255, 0, 0], includeAA: false }
);

const pct = ((diffPixels / totalPixels) * 100).toFixed(2);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, PNG.sync.write(diff));

console.log(`Pixels differents: ${diffPixels.toLocaleString()} / ${totalPixels.toLocaleString()}  (${pct}%)`);
console.log(`Diff visualisation: ${outPath}`);

// JSON report
const reportPath = outPath.replace(/\.png$/i, '.json');
writeFileSync(reportPath, JSON.stringify({
  ref: refPath,
  candidate: candPath,
  outDiff: outPath,
  dimensions: { width: ref.width, height: ref.height },
  refDimensions: { width: ref.width, height: ref.height },
  candDimensions: { width: cand.width, height: cand.height },
  diffPixels,
  totalPixels,
  percentDiff: parseFloat(pct),
  threshold: 0.1,
}, null, 2));
console.log(`Report JSON: ${reportPath}`);
