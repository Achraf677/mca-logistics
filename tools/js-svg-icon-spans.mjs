// Replace <span>EMOJI</span> standalone icon containers with <span><svg>...</svg></span>
// across all JS files. Conservative — only specific common emojis with clear SVG.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SVG = {
  '⛽': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 14h14"/><path d="M17 9l4 4v6a2 2 0 0 1-2 2"/></svg>',
  '🔧': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg>',
  '💸': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h4"/></svg>',
  '👥': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>',
  '📤': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  '📷': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  '📞': '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  '👤': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  '📍': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  '📦': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
};

const FILES = readdirSync('.').filter(f =>
  (f === 'script.js' || f.startsWith('script-')) && f.endsWith('.js')
);

let totalAll = 0;
const perFile = {};
for (const f of FILES) {
  let html = readFileSync(f, 'utf8');
  let total = 0;
  for (const [emoji, svg] of Object.entries(SVG)) {
    // Standalone span: <span>EMOJI</span>
    const standalonePattern = new RegExp(`<span>${emoji}</span>`, 'gu');
    const standaloneBefore = (html.match(standalonePattern) || []).length;
    if (standaloneBefore > 0) {
      html = html.replace(standalonePattern, `<span class="ui-icon">${svg}</span>`);
      total += standaloneBefore;
    }
    // Inline prefix: <span>EMOJI text  (emoji followed by space + text inside same span)
    const inlinePattern = new RegExp(`<span>${emoji} `, 'gu');
    const inlineBefore = (html.match(inlinePattern) || []).length;
    if (inlineBefore > 0) {
      html = html.replace(inlinePattern, `<span>${svg} `);
      total += inlineBefore;
    }
    // ${'EMOJI '} prefix (rare, but in pure string concat templates)
    const strPrefix = new RegExp(`'${emoji} '\\s*\\+`, 'gu');
    const strBefore = (html.match(strPrefix) || []).length;
    if (strBefore > 0) {
      html = html.replace(strPrefix, `'${svg} ' +`);
      total += strBefore;
    }
  }
  if (total > 0) {
    writeFileSync(f, html, 'utf8');
    perFile[f] = total;
    totalAll += total;
  }
}
console.log(`Files touched: ${Object.keys(perFile).length}`);
const sorted = Object.entries(perFile).sort((a,b)=>b[1]-a[1]);
for (const [f, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${f}`);
console.log(`\nGRAND TOTAL: ${totalAll} icon spans converted to SVG`);
