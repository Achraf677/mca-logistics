// Strip emojis from inline text contexts: <summary>, <p>, <div style>, <label>,
// <span> following a <input checkbox>, MCA Agent header.
// Skip icon-only buttons (👁️ 📋 🗑️) and decorative favicon/logo (🚐) and theme toggle (🌙).
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

const EMOJI_CLASS = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}️‍\\u200d\\ufe0f]+';

const patterns = [
  // <summary ...>EMOJI Text
  { name: 'summary', re: new RegExp(`(<summary[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <p ...>EMOJI Text (only when the p has inline style, common pattern for admonitions)
  { name: 'p inline', re: new RegExp(`(<p[^>]*style="[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // </input> EMOJI Text  inside <label>: <input ... /> EMOJI Text</label>
  { name: 'checkbox label suffix', re: new RegExp(`(/>)\\s+${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1 ' },
];

const stats = {};
for (const { name, re, repl } of patterns) {
  const before = (html.match(re) || []).length;
  html = html.replace(re, repl);
  if (before > 0) stats[name] = before;
}

// Targeted: line 1122 + line 2648 + line 2696 + line 3096 + line 3101 + line 3570
// These are inline text inside divs/spans — use a generic but bounded regex:
//   - inside a <div ...>...</div> (no other tags), starts with whitespace then EMOJI
//   - and inside <span id="..."> (file-upload labels not yet handled by previous script)
const TARGETED_LINES = [
  // 🩺 Suivi médical du travail (inline div without specific class, line 1122 area)
  { from: /(\n\s+)🩺 (Suivi médical du travail)/gu, to: '$1$2' },
  // 🚚 Données flotte & conformité (line 2648 area)
  { from: /(\n\s+)🚚 (Données flotte & conformité)/gu, to: '$1$2' },
  // span id="veh-carte-grise-button-label">📎 Choisir un fichier
  { from: /(<span id="veh-carte-grise-button-label">)📎 /gu, to: '$1' },
  // <div ...style=...>📋 Historique des modifications</div>
  { from: /(>)📋 (Historique des modifications<)/gu, to: '$1$2' },
  // <div ...style=...>💬 Commentaires internes (admin uniquement)</div>
  { from: /(>)💬 (Commentaires internes \(admin uniquement\)<)/gu, to: '$1$2' },
  // <div ...>🤖 MCA Agent</div>
  { from: /(>)🤖 (MCA Agent<)/gu, to: '$1$2' },
];

let targetedCount = 0;
for (const { from, to } of TARGETED_LINES) {
  const before = (html.match(from) || []).length;
  html = html.replace(from, to);
  targetedCount += before;
}

writeFileSync('admin.html', html, 'utf8');
const total = Object.values(stats).reduce((a, b) => a + b, 0) + targetedCount;
console.log(`Stripped ${total} inline-context emojis`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${v}  ${k}`);
console.log(`  ${targetedCount}  targeted inline divs/spans`);
