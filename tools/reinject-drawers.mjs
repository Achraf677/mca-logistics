// Re-injects ALL drawers (Salarié + Fournisseur added) into all pages.
// Replaces existing drawers block.
// Run: node tools/reinject-drawers.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const drawersHTML = readFileSync(join(dir, 'drawers-content.html'), 'utf8');

const files = readdirSync(dir).filter(f => f.endsWith('.html') && !['index.html','modals-content.html','drawers-content.html'].includes(f));

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');

  // Remove existing drawers block (between <!-- Drawers --> and <!-- Modals -->)
  html = html.replace(/<!-- Drawers -->[\s\S]*?<!-- Modals -->/, `<!-- Drawers -->\n${drawersHTML}\n\n<!-- Modals -->`);

  writeFileSync(fp, html, 'utf8');
  console.log(`  ✓ ${f}`);
}
console.log('\nDone.');
