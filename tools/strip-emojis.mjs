// Strip emojis from preview pages (sauf logo/brand).
// Emojis trouvés dans cards headers (📚 📄 ⛽ 🔧 etc.) et chips de catégorie.
// Run: node tools/strip-emojis.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const files = readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

// Regex pour détecter les emojis (plage Unicode)
// On supprime juste les emojis et espaces qui les entourent
const EMOJI_RE = /(📚|📄|📊|📈|📉|📋|📦|📅|🗓️|🗒️|📝|📂|📁|📍|📞|📤|📥|⛽|🔧|🛡️|🚐|🚚|🚗|🚨|🚦|⏱️|⚙️|⚡|🔔|🔍|🔁|🔄|🪪|🛵|🛺|🛒|🛻|🚛|🚜|💸|💵|💶|💰|💼|💡|🧾|🧮|🧑‍💼|👤|👥|👨‍💼|👨‍🔧|👩‍🔧|🏭|🏢|✅|❌|☑️|☐|☎️|✏️|📎|✨|🎛️|🎯|🆕|🔥|🌡️|🏷️|🏗️|🛠️)\s?/g;

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  const before = (html.match(EMOJI_RE) || []).length;
  if (before === 0) continue;
  html = html.replace(EMOJI_RE, '');
  // Cleanup double spaces
  html = html.replace(/>\s+([^<\s])/g, (m, c) => '> ' + c);
  writeFileSync(fp, html, 'utf8');
  console.log(`  ✓ ${f} : -${before} emojis`);
}
console.log('\nDone.');
