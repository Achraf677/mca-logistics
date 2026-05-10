// Removes legacy body{overflow:hidden} and .app/.main legacy height:100vh rules
// that block sidebar scrolling. Applied to all preview pages.
// Run: node tools/fix-scroll-overflow.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const files = readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  let changed = false;

  // 1) Remove html,body{height:100%} (locks page height)
  if (html.match(/html,body\{height:100%\}/)) {
    html = html.replace(/html,body\{height:100%\}/g, '');
    changed = true;
  }

  // 2) Remove body{...overflow:hidden} — keep the rest of the rule
  html = html.replace(/(body\{[^}]*?)overflow:hidden;?/g, (m, prefix) => {
    changed = true;
    return prefix;
  });
  // Cleanup empty body{ ; } or trailing ;
  html = html.replace(/body\{([^}]*);\s*\}/g, 'body{$1}');
  html = html.replace(/body\{\s*\}/g, '');

  // 3) Remove legacy .app rule with height:100vh + overflow:hidden
  //    Pattern: .app{display:block;height:100vh;position:relative;z-index:1;overflow:hidden}
  html = html.replace(/\.app\{display:block;height:100vh;position:relative;z-index:1;overflow:hidden\}\s*\n/g, () => {
    changed = true;
    return '';
  });

  // 4) Remove legacy .main rule with height:100vh + overflow:hidden
  //    Pattern: .main{display:flex;flex-direction:column;min-width:0;height:100vh;overflow:hidden}
  html = html.replace(/\.main\{display:flex;flex-direction:column;min-width:0;height:100vh;overflow:hidden\}\s*\n/g, () => {
    changed = true;
    return '';
  });

  // 5) Remove .sidebar{...overflow-y:auto;height:100vh} legacy (sidebar should scroll naturally with nav overflow-y:auto)
  html = html.replace(/(\.sidebar\{[^}]*?)overflow-y:auto;height:100vh\}/g, (m, prefix) => {
    changed = true;
    return prefix + '}';
  });

  // 6) Ensure .sidebar has sticky/fixed positioning for scroll experience
  //    Add: position:sticky;top:0;height:100vh;overflow-y:auto for SCROLLABLE sidebar (keeps content visible while content area scrolls)
  // Actually simpler: make sidebar sticky+max-height with overflow-y inside .nav
  // We already have .nav{overflow-y:auto} from the inject-sidebar CSS, so just ensure .sidebar is height-bounded.
  // Add a rule that forces .sidebar to be position:sticky;top:0;max-height:100vh;overflow:hidden
  if (!html.includes('.sidebar{position:sticky')) {
    // Inject after the existing .sidebar rule via a clarifying override
    const sidebarOverride = `\n/* Sidebar sticky scroll fix */\n.sidebar{position:sticky;top:0;max-height:100vh;overflow:hidden}\n.nav{overflow-y:auto !important;flex:1;min-height:0}\n`;
    if (!html.includes('Sidebar sticky scroll fix')) {
      html = html.replace(/<\/style>/, `${sidebarOverride}</style>`);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ fixed ${f}`);
  } else {
    console.log(`  - no change ${f}`);
  }
}
console.log('\nDone.');
