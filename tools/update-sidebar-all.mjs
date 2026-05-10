// Rebuilds the sidebar in ALL preview pages with 23 items grouped by section.
// Run: node tools/update-sidebar-all.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PREVIEWS_DIR = 'previews';

// SIDEBAR STRUCTURE — grouped by section, mirroring production admin.html
const SIDEBAR_GROUPS = [
  { label: null, items: [
    ['dashboard.html', 'Dashboard', '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'],
  ]},
  { label: 'Opérations', items: [
    ['livraisons.html', 'Livraisons', '<path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'],
    ['calendrier.html', 'Calendrier', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'],
    ['planning.html', 'Planning', '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>'],
    ['alertes.html', 'Alertes', '<path d="m21.7 18-9-15.4a2 2 0 0 0-3.4 0L.3 18A2 2 0 0 0 2 21h18a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'],
  ]},
  { label: 'Carnet', items: [
    ['clients.html', 'Clients', '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/>'],
    ['fournisseurs.html', 'Fournisseurs', '<path d="M3 21h18"/><path d="M3 7v14"/><path d="M21 7v14"/><path d="M3 7l9-4 9 4"/><path d="M9 21V11"/><path d="M15 21V11"/>'],
  ]},
  { label: 'Flotte', items: [
    ['vehicules.html', 'Véhicules', '<path d="M14 16H9m10 0h2v-3.34a2 2 0 0 0-.59-1.41L17 8H3v8h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'],
    ['carburant.html', 'Carburant', '<path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 14h14"/><path d="M17 9l4 4v6a2 2 0 0 1-2 2"/>'],
    ['entretiens.html', 'Entretiens', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>'],
    ['inspections.html', 'Inspections', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>'],
  ]},
  { label: 'Équipe', items: [
    ['equipe.html', 'Équipe', '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/>'],
    ['heures.html', 'Heures & Km', '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'],
    ['incidents.html', 'Incidents', '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'],
  ]},
  { label: 'Finances', items: [
    ['charges.html', 'Charges', '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h4"/>'],
    ['encaissement.html', 'Encaissement', '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'],
    ['tva.html', 'TVA', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'],
    ['rentabilite.html', 'Rentabilité', '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'],
    ['statistiques.html', 'Statistiques', '<rect x="3" y="12" width="4" height="9"/><rect x="10" y="6" width="4" height="15"/><rect x="17" y="9" width="4" height="12"/>'],
  ]},
  { label: 'Admin', items: [
    ['brouillons-ia.html', 'Brouillons IA', '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/>'],
    ['parametres.html', 'Paramètres', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'],
  ]},
];

const LOGO_SVG = `<svg class="brand-logo" viewBox="0 0 88 60">
        <rect x="0" y="14" width="14" height="3" fill="#e63946"/>
        <rect x="2" y="22" width="12" height="3" fill="#e63946"/>
        <rect x="4" y="30" width="10" height="3" fill="#e63946"/>
        <rect x="2" y="38" width="12" height="3" fill="#e63946"/>
        <rect x="18" y="14" width="60" height="28" rx="4" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1"/>
        <rect x="22" y="18" width="14" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>
        <rect x="38" y="18" width="36" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>
        <circle cx="30" cy="44" r="5" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>
        <circle cx="66" cy="44" r="5" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>
      </svg>`;

function buildSidebar(currentFile) {
  const groupsHtml = SIDEBAR_GROUPS.map(group => {
    const itemsHtml = group.items.map(([href, label, svg]) => {
      const active = href === currentFile ? ' active' : '';
      return `        <a class="nav-item${active}" href="${href}"><svg viewBox="0 0 24 24">${svg}</svg> ${label}</a>`;
    }).join('\n');
    if (group.label) {
      return `      <div class="nav-group-label">${group.label}</div>\n${itemsHtml}`;
    }
    return itemsHtml;
  }).join('\n');

  return `  <aside class="sidebar">
    <div class="brand">
      ${LOGO_SVG}
      <div class="brand-text">MCA<span class="red">LOGISTICS</span></div>
    </div>
    <nav class="nav">
${groupsHtml}
    </nav>
    <div class="sidebar-foot">
      <div class="av">AC</div>
      <div>
        <div class="who">Achraf Chikri</div>
        <div class="role">Admin</div>
      </div>
    </div>
  </aside>`;
}

// CSS to add for nav-group-label
const NAV_GROUP_CSS = `.nav-group-label{padding:14px 14px 6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-disabled);margin-top:4px}
.nav-group-label:first-child{margin-top:0;padding-top:6px}
.nav{flex:1;padding:8px 10px;overflow-y:auto}
.nav::-webkit-scrollbar{width:6px}
.nav::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:3px}
.nav::-webkit-scrollbar-track{background:transparent}`;

function processFile(filename) {
  if (filename === 'index.html') return; // hub, no sidebar
  const filepath = join(PREVIEWS_DIR, filename);
  let html = readFileSync(filepath, 'utf8');

  const sidebar = buildSidebar(filename);

  // Replace existing <aside class="sidebar">...</aside>
  const sidebarRegex = /<aside class="sidebar">[\s\S]*?<\/aside>/;
  if (!sidebarRegex.test(html)) {
    console.log(`  ⚠ SKIP (no existing sidebar found): ${filename}`);
    return;
  }
  html = html.replace(sidebarRegex, sidebar.trim());

  // Inject nav-group-label CSS if not already there
  if (!html.includes('.nav-group-label{')) {
    html = html.replace(/<\/style>/, `${NAV_GROUP_CSS}\n</style>`);
  }

  writeFileSync(filepath, html, 'utf8');
  console.log(`  ✓ ${filename}`);
}

const files = readdirSync(PREVIEWS_DIR).filter(f => f.endsWith('.html'));
console.log(`Updating sidebar in ${files.length - 1} preview pages (excluding index.html)...\n`);
files.forEach(processFile);
console.log(`\n✓ Sidebar harmonized on all preview pages (23 items, 6 groups)`);
