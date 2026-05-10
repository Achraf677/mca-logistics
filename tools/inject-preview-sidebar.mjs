// Inject the canonical sidebar into all preview pages (except vehicules.html which already has it).
// Run once: node previews/_inject-sidebar.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('.', import.meta.url).pathname.replace(/^\//, ''); // windows path
const previewsDir = process.cwd().endsWith('previews') ? '.' : 'previews';

const PAGE_MAP = {
  'dashboard.html': 'Dashboard',
  'livraisons.html': 'Livraisons',
  'charges.html': 'Charges',
  'rentabilite.html': 'Rentabilité',
  'vehicules.html': 'Véhicules',
  'equipe.html': 'Équipe',
  'planning.html': 'Planning',
  'carburant.html': 'Carburant',
  'entretiens.html': 'Entretiens',
  'alertes.html': 'Alertes',
};

const SIDEBAR_CSS = `
.app{display:grid;grid-template-columns:236px 1fr;min-height:100vh;position:relative;z-index:1}
.sidebar{background:var(--bg-elevated);border-right:1px solid var(--border);display:flex;flex-direction:column}
.sidebar .brand{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;position:relative}
.sidebar .brand::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,var(--brand) 0%,transparent 100%)}
.sidebar .brand-logo{width:48px;height:32px;flex-shrink:0}
.sidebar .brand-text{font-family:var(--font-display);font-weight:800;font-size:17px;letter-spacing:-0.02em;line-height:1}
.sidebar .brand-text .red{color:var(--brand);font-style:italic;font-weight:700;font-size:12px;display:block;margin-top:2px;letter-spacing:0.06em}
.nav{flex:1;padding:14px 10px}
.nav-item{display:flex;align-items:center;gap:11px;padding:11px 14px;border-radius:8px;color:var(--text-muted);font-size:14px;cursor:pointer;font-weight:500;margin-bottom:2px;transition:all var(--t-fast) var(--ease-out);position:relative;text-decoration:none}
.nav-item:hover{background:var(--bg-card-hover);color:var(--text)}
.nav-item.active{background:var(--brand-soft);color:var(--brand)}
.nav-item.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:3px;background:var(--brand);border-radius:0 3px 3px 0}
.nav-item svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:0.85}
.sidebar-foot{padding:14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}
.sidebar-foot .av{width:34px;height:34px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 0 0 2px rgba(230,57,70,0.25)}
.sidebar-foot .who{font-size:13px;font-weight:600}
.sidebar-foot .role{font-size:11px;color:var(--text-muted)}
.main{display:flex;flex-direction:column;min-width:0;min-height:100vh}
@media (max-width:880px){.app{grid-template-columns:1fr}.sidebar{display:none}}
`;

function buildSidebar(currentFile) {
  const items = [
    ['dashboard.html', 'Dashboard', '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'],
    ['livraisons.html', 'Livraisons', '<path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'],
    ['charges.html', 'Charges', '<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9"/><path d="M3 10h18"/><path d="M16 19h6"/>'],
    ['rentabilite.html', 'Rentabilité', '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'],
    ['vehicules.html', 'Véhicules', '<path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>'],
    ['equipe.html', 'Équipe', '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/>'],
    ['planning.html', 'Planning', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'],
    ['carburant.html', 'Carburant', '<path d="M12 2v6"/><path d="M9 12h6"/><circle cx="12" cy="14" r="8"/>'],
    ['entretiens.html', 'Entretiens', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>'],
    ['alertes.html', 'Alertes', '<path d="m21.7 18-9-15.4a2 2 0 0 0-3.4 0L.3 18A2 2 0 0 0 2 21h18a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'],
  ];
  const navHtml = items.map(([href, label, svg]) => {
    const active = href === currentFile ? ' active' : '';
    return `      <a class="nav-item${active}" href="${href}"><svg viewBox="0 0 24 24">${svg}</svg> ${label}</a>`;
  }).join('\n');

  return `  <aside class="sidebar">
    <div class="brand">
      <svg class="brand-logo" viewBox="0 0 88 60">
        <rect x="0" y="14" width="14" height="3" fill="#e63946"/>
        <rect x="2" y="22" width="12" height="3" fill="#e63946"/>
        <rect x="4" y="30" width="10" height="3" fill="#e63946"/>
        <rect x="2" y="38" width="12" height="3" fill="#e63946"/>
        <rect x="18" y="14" width="60" height="28" rx="4" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1"/>
        <rect x="22" y="18" width="14" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>
        <rect x="38" y="18" width="36" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>
        <circle cx="30" cy="44" r="5" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>
        <circle cx="66" cy="44" r="5" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>
      </svg>
      <div class="brand-text">MCA<span class="red">LOGISTICS</span></div>
    </div>
    <nav class="nav">
${navHtml}
    </nav>
    <div class="sidebar-foot">
      <div class="av">AC</div>
      <div>
        <div class="who">Achraf Chikri</div>
        <div class="role">Admin</div>
      </div>
    </div>
  </aside>
`;
}

function processFile(filename) {
  const filepath = join(previewsDir, filename);
  let html = readFileSync(filepath, 'utf8');

  // Skip if already has sidebar
  if (html.includes('class="sidebar"')) {
    console.log(`SKIP (already has sidebar): ${filename}`);
    return;
  }

  const sidebar = buildSidebar(filename);

  // 1. Replace .app rule to be grid 236px+1fr (handle the variations)
  html = html.replace(
    /\.app\{display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1\}/,
    '.app{display:grid;grid-template-columns:236px 1fr;min-height:100vh;position:relative;z-index:1}\n.main{display:flex;flex-direction:column;min-width:0;min-height:100vh}'
  );
  html = html.replace(
    /\.app\{display:flex;flex-direction:column;min-height:100vh\}/,
    '.app{display:grid;grid-template-columns:236px 1fr;min-height:100vh;position:relative;z-index:1}\n.main{display:flex;flex-direction:column;min-width:0;min-height:100vh}'
  );

  // 2. Inject sidebar CSS just before </style>
  html = html.replace(/<\/style>/, SIDEBAR_CSS + '\n</style>');

  // 3. Inject sidebar HTML right after <div class="app"> (with optional newline)
  //    AND wrap subsequent content in <main class="main">
  html = html.replace(
    /<div class="app">\s*\n/,
    `<div class="app">\n${sidebar}\n  <main class="main">\n`
  );

  // 4. Close </main> right before the final </div></body>
  html = html.replace(
    /\n<\/div>\s*\n\s*<\/body>/,
    '\n  </main>\n</div>\n</body>'
  );

  writeFileSync(filepath, html, 'utf8');
  console.log(`DONE: ${filename}`);
}

const files = readdirSync(previewsDir).filter(f => f.endsWith('.html') && f !== 'index.html');
files.forEach(processFile);
console.log('\n✓ Sidebar injection complete on', files.length, 'files');
