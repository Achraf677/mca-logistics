// Replace emojis in .mbn-icon (admin mobile bottom nav) and .searchbar-icon with SVG.
// Uses the same Lucide-style SVG vocabulary as sidebar/topbar (PR #148).
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

const SVG = {
  dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  package:   '<svg viewBox="0 0 24 24"><path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  calendar:  '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  bell:      '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  more:      '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  search:    '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
};

const mbnRepl = [
  ['<span class="mbn-icon">📊</span>', `<span class="mbn-icon">${SVG.dashboard}</span>`],
  ['<span class="mbn-icon">📦</span>', `<span class="mbn-icon">${SVG.package}</span>`],
  ['<span class="mbn-icon">📅</span>', `<span class="mbn-icon">${SVG.calendar}</span>`],
  ['<span class="mbn-icon">🔔</span>', `<span class="mbn-icon">${SVG.bell}</span>`],
  ['<span class="mbn-icon">⋯</span>', `<span class="mbn-icon">${SVG.more}</span>`],
];

const searchRepl = [
  ['<span class="searchbar-icon">🔎</span>', `<span class="searchbar-icon">${SVG.search}</span>`],
];

let changes = 0;
for (const [from, to] of [...mbnRepl, ...searchRepl]) {
  const before = html.split(from).length - 1;
  if (before > 0) {
    html = html.split(from).join(to);
    changes += before;
  }
}

// Add minimal CSS for .mbn-icon svg and .searchbar-icon svg (only if missing)
const css = `
.mbn-icon svg{width:22px;height:22px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.mbn-item.active .mbn-icon svg{opacity:1}
.searchbar-icon svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.7;vertical-align:-3px}`;

if (!html.includes('.mbn-icon svg{') && !html.includes('.searchbar-icon svg{')) {
  // Insert after the existing .nav-icon svg{ rule (already added in sidebar PR)
  html = html.replace(/(\.nav-item\.active \.nav-icon svg\{opacity:1\})/, `$1${css}`);
}

writeFileSync('admin.html', html, 'utf8');
console.log(`✓ admin.html : ${changes} emojis (mbn + searchbar) replaced with SVG`);
