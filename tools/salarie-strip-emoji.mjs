// Strip emojis from salarie.html (mobile chauffeur app) — same approach as admin.
// Targets: card-header prefix, button labels, pill-type buttons, offline-banner.
// Keeps: 🚐 favicon, 👤 profile avatar fallback.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('salarie.html', 'utf8');

const EMOJI_CLASS = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}️‍\\u200d\\ufe0f]+';

const patterns = [
  // <button ...>EMOJI Text → <button ...>Text
  { name: 'button labels', re: new RegExp(`(<button[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <div class="card-header">EMOJI Text → <div class="card-header">Text
  { name: 'card-header', re: new RegExp(`(<div[^>]*class="[^"]*card-header[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <option ...>EMOJI Text
  { name: 'options', re: new RegExp(`(<option[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <label ...>EMOJI Text
  { name: 'labels', re: new RegExp(`(<label[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <th ...>EMOJI Text
  { name: 'th', re: new RegExp(`(<th[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // placeholder="EMOJI ..."
  { name: 'placeholder', re: new RegExp(`(placeholder=")${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // aria-label="EMOJI ..."
  { name: 'aria-label', re: new RegExp(`(aria-label=")${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
];

const stats = {};
for (const { name, re, repl } of patterns) {
  const before = (html.match(re) || []).length;
  html = html.replace(re, repl);
  if (before > 0) stats[name] = before;
}

// Targeted inline cases
const TARGETED = [
  // 👋 (waving hand) at the end of "Bonjour 👋" → strip
  { from: / 👋(<\/div>)/gu, to: '$1' },
  // offline-banner: <div id="offline-banner">📵 Hors ligne...</div>
  { from: /(<div id="offline-banner">)📵 /gu, to: '$1' },
  // inline emoji prefix inside button text: "          ">🚦 Km départ"  matched by button pattern; line 1035 has  ">🚦 Km départ</button>" — already handled
  // Inline text after >: "            📦 Mes livraisons du jour"
  { from: /(\n\s+)📦 (Mes livraisons du jour)/gu, to: '$1$2' },
  // "💬 Messagerie — Administration"
  { from: /(\n\s+)💬 (Messagerie — Administration)/gu, to: '$1$2' },
  // "            📦 Mes livraisons du jour" - duplicated
  // Inside pj-menu buttons: emoji + text
  { from: /(<button[^>]*onclick="declencherPj\([^)]*\)"[^>]*>)\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]+\s+/gu, to: '$1' },
];

let targetedCount = 0;
for (const { from, to } of TARGETED) {
  const before = (html.match(from) || []).length;
  html = html.replace(from, to);
  targetedCount += before;
}

writeFileSync('salarie.html', html, 'utf8');
const total = Object.values(stats).reduce((a, b) => a + b, 0) + targetedCount;
console.log(`Stripped ${total} salarie.html emojis`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${v}  ${k}`);
console.log(`  ${targetedCount}  targeted inline`);
