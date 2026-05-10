// Harmonize page width (max 1600px) + ensure consistent font-family usage.
// Run: node tools/harmonize-width-fonts.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const files = readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  let changed = false;

  // 1) Bump .content max-width from 1280px → 1600px
  const before1 = html.includes('max-width:1280px');
  html = html.replace(/max-width:1280px/g, 'max-width:1600px');
  if (before1 && html.includes('max-width:1600px')) changed = true;

  // 2) Make sure .content has padding consistent
  // Pattern A : .content{padding:26px;flex:1;overflow:auto}  →  add max-width
  // Pattern B : .content{padding:22px 26px;flex:1;overflow:auto}  →  add max-width
  if (!html.match(/\.content\{[^}]*max-width/)) {
    // Find .content rules and add max-width:1600px + margin:0 auto
    html = html.replace(/\.content\{padding:26px;flex:1;overflow:auto\}/g, () => {
      changed = true;
      return '.content{padding:22px 26px;flex:1;overflow:auto;max-width:1600px;width:100%;margin:0 auto}';
    });
    html = html.replace(/\.content\{padding:22px 26px;flex:1;overflow:auto\}/g, () => {
      changed = true;
      return '.content{padding:22px 26px;flex:1;overflow:auto;max-width:1600px;width:100%;margin:0 auto}';
    });
  }

  if (changed) {
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ widened ${f}`);
  }
}
console.log('\nDone.');
