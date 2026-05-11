// Strip emojis from JS string literals where they prefix human-readable text.
// Pass 2: include EMOJI followed by template-interpolation ${...}
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = ['script.js', 'script-mobile.js'];

const DECORATIVE = '[\\u{1F300}-\\u{1FAFF}\\u{1F900}-\\u{1F9FF}️\\u200d]+\\ufe0f?';

const PATTERNS = [
  // 'EMOJI text' / "EMOJI text" / `EMOJI text` (letter/digit follows)
  { name: 'string prefix → text', re: new RegExp(`(['"\`])\\s*${DECORATIVE}\\s+([\\p{L}\\p{N}])`, 'gu'), repl: '$1$2' },
  // 'EMOJI ${interp}' — quote then EMOJI then space then ${
  { name: 'string prefix → interp', re: new RegExp(`(['"\`])\\s*${DECORATIVE}\\s+(\\$\\{)`, 'gu'), repl: '$1$2' },
  // >EMOJI Text<  innerHTML literal
  { name: 'innerHTML → text', re: new RegExp(`(>)\\s*${DECORATIVE}\\s+([\\p{L}\\p{N}])`, 'gu'), repl: '$1$2' },
  // >EMOJI ${interp}  innerHTML with interpolation
  { name: 'innerHTML → interp', re: new RegExp(`(>)\\s*${DECORATIVE}\\s+(\\$\\{)`, 'gu'), repl: '$1$2' },
];

let totalAll = 0;
for (const f of FILES) {
  let html = readFileSync(f, 'utf8');
  let total = 0;
  const stats = {};
  for (const { name, re, repl } of PATTERNS) {
    const before = (html.match(re) || []).length;
    if (before > 0) {
      html = html.replace(re, repl);
      stats[name] = before;
      total += before;
    }
  }
  writeFileSync(f, html, 'utf8');
  totalAll += total;
  console.log(`${f}: stripped ${total}`);
  for (const [k, v] of Object.entries(stats)) console.log(`  ${v}  ${k}`);
}
console.log(`\nGRAND TOTAL pass 2: ${totalAll} JS string emojis stripped`);
