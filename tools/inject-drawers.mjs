// Injects drawers HTML into all preview pages.
// Run: node tools/inject-drawers.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const drawersHTML = readFileSync(join(dir, 'drawers-content.html'), 'utf8');

const files = readdirSync(dir).filter(f => f.endsWith('.html') && !['index.html','modals-content.html','drawers-content.html'].includes(f));

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  let changed = false;

  if (!html.includes('drawer-livraison')) {
    html = html.replace(/<!-- Modals -->/, `<!-- Drawers -->\n${drawersHTML}\n\n<!-- Modals -->`);
    changed = true;
  }

  // Wire row clicks to open drawer (per page context)
  if (f === 'livraisons.html') {
    html = html.replace(/<tr class="row-hover"(?!data-drawer-open)/g, '<tr class="row-hover" data-drawer-open="drawer-livraison"');
    changed = true;
  }
  if (f === 'clients.html') {
    html = html.replace(/<tr class="row-hover"(?!data-drawer-open)/g, '<tr class="row-hover" data-drawer-open="drawer-client"');
    changed = true;
  }
  if (f === 'vehicules.html') {
    // Wire "Voir le détail →" link
    html = html.replace(/<a class="link" href="#">Voir le détail →<\/a>/g, '<a class="link" href="#" data-drawer-open="drawer-vehicule">Voir le détail →</a>');
    changed = true;
  }

  if (changed) {
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ ${f}`);
  }
}
console.log('\nDone.');
