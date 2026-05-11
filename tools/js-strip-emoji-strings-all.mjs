// Strip emojis from JS string literals across all script-*.js + script.js files.
// Same conservative approach as js-strip-emoji-strings.mjs (pass 1 + 2 combined).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const FILES = readdirSync('.').filter(f =>
  (f === 'script.js' || f.startsWith('script-')) && f.endsWith('.js')
);

const DECORATIVE = '[\\u{1F300}-\\u{1FAFF}\\u{1F900}-\\u{1F9FF}️\\u200d]+\\ufe0f?';

const PATTERNS = [
  { name: 'string prefix → text',   re: new RegExp(`(['"\`])\\s*${DECORATIVE}\\s+([\\p{L}\\p{N}])`, 'gu'), repl: '$1$2' },
  { name: 'string prefix → interp', re: new RegExp(`(['"\`])\\s*${DECORATIVE}\\s+(\\$\\{)`, 'gu'), repl: '$1$2' },
  { name: 'innerHTML → text',       re: new RegExp(`(>)\\s*${DECORATIVE}\\s+([\\p{L}\\p{N}])`, 'gu'), repl: '$1$2' },
  { name: 'innerHTML → interp',     re: new RegExp(`(>)\\s*${DECORATIVE}\\s+(\\$\\{)`, 'gu'), repl: '$1$2' },
];

let totalAll = 0;
const perFile = {};
for (const f of FILES) {
  let html = readFileSync(f, 'utf8');
  let total = 0;
  for (const { re, repl } of PATTERNS) {
    const before = (html.match(re) || []).length;
    if (before > 0) {
      html = html.replace(re, repl);
      total += before;
    }
  }
  if (total > 0) {
    writeFileSync(f, html, 'utf8');
    perFile[f] = total;
    totalAll += total;
  }
}
console.log(`Files touched: ${Object.keys(perFile).length}/${FILES.length}`);
const sorted = Object.entries(perFile).sort((a,b)=>b[1]-a[1]);
for (const [f, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${f}`);
console.log(`\nGRAND TOTAL: ${totalAll}`);
