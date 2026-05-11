// Strip emojis from button labels, option labels, stat-pill labels, and KPI subs.
// Conservative: only targets patterns where an emoji DIRECTLY precedes text inside
// a known UI label container. Does NOT touch raw inline emojis that may be icons.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

// Range of "label-style" emojis to strip (skip semantic arrows ←→↑↓ U+2190-21FF, checks ✓✗ U+2713-2717)
// We catch 1F300-1FAFF (objects/symbols/transport/food) + selected 2600-26FF
const EMOJI_CLASS = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}️‍\\u200d\\ufe0f]+';

const patterns = [
  // <button ...>EMOJI Text → <button ...>Text
  { re: new RegExp(`(<button[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <option ...>EMOJI Text → <option ...>Text
  { re: new RegExp(`(<option[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <div class="stat-pill-label" ...>EMOJI Text
  { re: new RegExp(`(<div[^>]*class="[^"]*stat-pill-label[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <div class="kpi-sub">EMOJI Text
  { re: new RegExp(`(<div[^>]*class="[^"]*kpi-sub[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <div class="hero-sante-title" ...>EMOJI Text
  { re: new RegExp(`(<div[^>]*class="[^"]*hero-sante-title[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <span class="kpi-icon">EMOJI</span> → entire span removed (icon span, will be styled by parent)
  // Skip this — leave kpi-icon spans for now, may be intentional
  // <label ...>EMOJI Text
  { re: new RegExp(`(<label[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <th ...>EMOJI Text (table headers)
  { re: new RegExp(`(<th[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
  // <a ...>EMOJI Text (only when there's a class indicating it's a button-style link)
  { re: new RegExp(`(<a[^>]*class="[^"]*btn[^"]*"[^>]*>)\\s*${EMOJI_CLASS}\\s+`, 'gu'), repl: '$1' },
];

const stats = {};
for (const { re, repl } of patterns) {
  const before = (html.match(re) || []).length;
  html = html.replace(re, repl);
  if (before > 0) stats[re.source.substring(0, 60)] = before;
}

writeFileSync('admin.html', html, 'utf8');
const total = Object.values(stats).reduce((a, b) => a + b, 0);
console.log(`Stripped ${total} label-prefix emojis`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${v}  ${k}...`);
