// Strip emojis from section titles (form-section-title, fp-section-title),
// KPI labels, client type labels, file-upload labels, and search placeholders.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

const EMOJI_CLASS = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}️‍\\u200d\\ufe0f]+';

const patterns = [
  // .form-section-title : <div class="form-section-title" ...>EMOJI Text
  { name: 'form-section-title', re: new RegExp(`(<div[^>]*class="[^"]*form-section-title[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // .fp-section-title : <h4 class="fp-section-title">EMOJI Text
  { name: 'fp-section-title', re: new RegExp(`(<h4[^>]*class="[^"]*fp-section-title[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // .kpi-label : <div class="kpi-label">EMOJI Text
  { name: 'kpi-label', re: new RegExp(`(<div[^>]*class="[^"]*kpi-label[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // .cal16-kpi-lbl : <div class="cal16-kpi-lbl">EMOJI Text
  { name: 'cal16-kpi-lbl', re: new RegExp(`(<div[^>]*class="[^"]*cal16-kpi-lbl[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // .client-type-label : <span class="client-type-label">EMOJI Text
  { name: 'client-type-label', re: new RegExp(`(<span[^>]*class="[^"]*client-type-label[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // file-upload-button : <span id="..." ...>EMOJI Text (inside <label class="file-upload-button">)
  { name: 'file-upload spans', re: new RegExp(`(<span[^>]*id="[^"]*(?:smart-upload|doc-permis|doc-cni|doc-iban|doc-vitale|doc-medecine)-label[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // placeholder="🔍 ..." / placeholder="🔎 ..." → placeholder="..."
  { name: 'placeholders search', re: new RegExp(`(placeholder=")${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // aria-label="🔍 ..." → aria-label="..." (same content as placeholder)
  { name: 'aria-label search', re: new RegExp(`(aria-label=")${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // profit-recap : <div class="profit-recap" ...>EMOJI Text
  { name: 'profit-recap', re: new RegExp(`(<div[^>]*class="[^"]*profit-recap[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
];

const stats = {};
for (const { name, re, repl } of patterns) {
  const before = (html.match(re) || []).length;
  html = html.replace(re, repl);
  if (before > 0) stats[name] = before;
}

writeFileSync('admin.html', html, 'utf8');
const total = Object.values(stats).reduce((a, b) => a + b, 0);
console.log(`Stripped ${total} section/label emojis`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${v}  ${k}`);
