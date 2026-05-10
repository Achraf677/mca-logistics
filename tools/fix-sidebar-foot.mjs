// Fix sidebar foot getting clipped when nav is long.
// Ensure sidebar has proper flex layout: brand (top) + nav (scroll fill) + foot (bottom).
// Run: node tools/fix-sidebar-foot.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const files = readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

const PATCH_CSS = `
/* Sidebar layout fix : brand + nav-scroll + foot-sticky */
.sidebar{position:sticky;top:0;max-height:100vh;height:100vh;overflow:hidden;display:flex;flex-direction:column}
.sidebar .brand{flex-shrink:0}
.sidebar .nav{flex:1 1 auto;min-height:0;overflow-y:auto}
.sidebar-foot{flex-shrink:0;background:var(--bg-elevated)}
`;

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  if (!html.includes('/* Sidebar layout fix')) {
    html = html.replace(/<\/style>/, PATCH_CSS + '\n</style>');
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ ${f}`);
  }
}
console.log('\nDone.');
