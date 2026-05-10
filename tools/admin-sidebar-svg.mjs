// Replace emoji nav-icons with SVG in admin.html sidebar.
// Preserves all data-page, data-attrs, hrefs.
// Run: node tools/admin-sidebar-svg.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const REPLACEMENTS = [
  ['<span class="nav-icon">📊</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>'],
  ['<span class="nav-icon">📦</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></span>'],
  ['<span class="nav-icon">🗓️</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg></span>'],
  ['<span class="nav-icon">📅</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg></span>'],
  ['<span class="nav-icon">🔔</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="m21.7 18-9-15.4a2 2 0 0 0-3.4 0L.3 18A2 2 0 0 0 2 21h18a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>'],
  ['<span class="nav-icon">🧑‍💼</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg></span>'],
  ['<span class="nav-icon">🏭</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M3 7v14"/><path d="M21 7v14"/><path d="M3 7l9-4 9 4"/><path d="M9 21V11"/><path d="M15 21V11"/></svg></span>'],
  ['<span class="nav-icon">🚐</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M14 16H9m10 0h2v-3.34a2 2 0 0 0-.59-1.41L17 8H3v8h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg></span>'],
  ['<span class="nav-icon">⛽</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 14h14"/><path d="M17 9l4 4v6a2 2 0 0 1-2 2"/></svg></span>'],
  ['<span class="nav-icon">🔧</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg></span>'],
  ['<span class="nav-icon">🚗</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg></span>'],
  ['<span class="nav-icon">👥</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/></svg></span>'],
  ['<span class="nav-icon">⏱️</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>'],
  ['<span class="nav-icon">🚨</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>'],
  ['<span class="nav-icon">💸</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h4"/></svg></span>'],
  ['<span class="nav-icon">💵</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>'],
  ['<span class="nav-icon">🧾</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg></span>'],
  ['<span class="nav-icon">💰</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></span>'],
  ['<span class="nav-icon">📈</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="6" width="4" height="15"/><rect x="17" y="9" width="4" height="12"/></svg></span>'],
  ['<span class="nav-icon">📋</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg></span>'],
  ['<span class="nav-icon">⚙️</span>', '<span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>'],
];

let html = readFileSync('admin.html', 'utf8');
let changes = 0;
for (const [from, to] of REPLACEMENTS) {
  if (html.includes(from)) {
    html = html.split(from).join(to);
    changes++;
  }
}

// Ensure SVG inside nav-icon has proper styling (add CSS rule once)
const navIconSvgCSS = `\n.nav-icon svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:0.85;vertical-align:-3px}\n.nav-item.active .nav-icon svg{opacity:1}`;
if (!html.includes('.nav-icon svg{')) {
  // Inject just before </head> via a <style> tag (or first style tag if exists)
  if (html.includes('<style>')) {
    html = html.replace(/(<style[^>]*>)/, `$1${navIconSvgCSS}`);
  } else {
    html = html.replace(/<\/head>/, `<style>${navIconSvgCSS}</style></head>`);
  }
}

writeFileSync('admin.html', html, 'utf8');
console.log(`✓ admin.html : ${changes}/${REPLACEMENTS.length} emojis replaced with SVG`);
