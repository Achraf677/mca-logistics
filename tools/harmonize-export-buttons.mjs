// Harmonizes export/rapport buttons across all previews → Livraisons-style dropdown menu.
// Per page, the export menu offers PDF / CSV / Excel + page-specific extras.
// Run: node tools/harmonize-export-buttons.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PREVIEWS_DIR = 'previews';

// Shared CSS for the dropdown menu (added if not present)
const MENU_CSS = `/* Export dropdown menu (Livraisons-pattern) */
.export-wrap{position:relative}
.menu{position:absolute;top:calc(100% + 6px);right:0;min-width:260px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,0.45);padding:6px;z-index:50;opacity:0;transform:translateY(-4px);pointer-events:none;transition:opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out)}
.menu.open{opacity:1;transform:translateY(0);pointer-events:auto}
.menu-item{display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border:none;background:transparent;color:var(--text);font-family:inherit;font-size:13px;text-align:left;border-radius:7px;cursor:pointer;transition:background var(--t-fast) var(--ease-out)}
.menu-item:hover{background:var(--bg-card-hover)}
.menu-item svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;color:var(--text-muted);flex-shrink:0}
.menu-item:hover svg{color:var(--brand)}
.mi-name{font-weight:600;font-size:13px;line-height:1.2}
.mi-sub{font-size:11px;color:var(--text-muted);margin-top:2px;line-height:1.2}
.menu-sep{height:1px;background:var(--border);margin:5px 6px}`;

// Shared JS handler (added once at end of body)
const MENU_JS = `<script>
// Export menus (Livraisons-pattern) — supports multiple menus per page
document.querySelectorAll('[data-menu-trigger]').forEach(btn=>{
  const targetId=btn.getAttribute('data-menu-trigger');
  const menu=document.getElementById(targetId);
  if(!menu) return;
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach(m=>{if(m!==menu)m.classList.remove('open')});
    const open=menu.classList.toggle('open');
    btn.setAttribute('aria-expanded',open);
  });
  document.addEventListener('click',e=>{
    if(!menu.contains(e.target)&&e.target!==btn){menu.classList.remove('open');btn.setAttribute('aria-expanded','false')}
  });
  menu.querySelectorAll('.menu-item').forEach(mi=>mi.addEventListener('click',()=>menu.classList.remove('open')));
});
</script>`;

// SVG icons reused
const ICO = {
  download: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  caret: '<svg viewBox="0 0 24 24" style="width:11px;height:11px;margin-left:2px"><polyline points="6 9 12 15 18 9"/></svg>',
  pdf: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
  csv: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>',
  xlsx: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  send: '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  history: '<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
};

function exportDropdown(menuId, items) {
  const itemsHtml = items.map(it => {
    if (it === 'SEP') return '            <div class="menu-sep"></div>';
    const [icon, name, sub] = it;
    return `            <button class="menu-item">${icon}<div><div class="mi-name">${name}</div><div class="mi-sub">${sub}</div></div></button>`;
  }).join('\n');

  return `<div class="export-wrap">
          <button class="btn btn-secondary" data-menu-trigger="${menuId}" aria-haspopup="true" aria-expanded="false">
            ${ICO.download}
            Exporter
            ${ICO.caret}
          </button>
          <div class="menu" id="${menuId}" role="menu">
${itemsHtml}
          </div>
        </div>`;
}

// Per-page export menu configurations
const PAGE_MENUS = {
  'clients.html': [
    [ICO.pdf, 'Export PDF', 'Liste complète imprimable'],
    [ICO.csv, 'Export CSV', 'Avec SIREN, CA, encours'],
    [ICO.xlsx, 'Export Excel', 'Onglet par segment'],
    'SEP',
    [ICO.history, 'Historique clients', 'Toutes interactions 12 mois'],
  ],
  'fournisseurs.html': [
    [ICO.pdf, 'Export PDF', 'Liste fournisseurs imprimable'],
    [ICO.csv, 'Export CSV', 'Avec catégories et dépenses'],
    [ICO.xlsx, 'Export Excel', 'Onglet par catégorie'],
    'SEP',
    [ICO.history, 'Historique dépenses', '12 derniers mois par fournisseur'],
  ],
  'vehicules.html': [
    [ICO.pdf, 'Export PDF', 'État flotte + échéances'],
    [ICO.csv, 'Export CSV', 'Avec plaques et km'],
    [ICO.xlsx, 'Export Excel', 'Onglet par véhicule'],
  ],
  'entretiens.html': [
    [ICO.pdf, 'Export PDF', 'Carnet d\'entretien'],
    [ICO.csv, 'Export CSV', 'Toutes interventions'],
    [ICO.xlsx, 'Export Excel', 'Par véhicule'],
  ],
  'carburant.html': [
    [ICO.pdf, 'Export PDF', 'Rapport mensuel imprimable'],
    [ICO.csv, 'Export CSV', 'Toutes les colonnes'],
    [ICO.xlsx, 'Export Excel', 'Avec onglet anomalies'],
    'SEP',
    [ICO.send, 'Email cabinet compta', 'Pennylane via API'],
  ],
  'charges.html': [
    [ICO.pdf, 'Export PDF', 'Rapport mensuel imprimable'],
    [ICO.csv, 'Export CSV', 'Toutes les charges'],
    [ICO.xlsx, 'Export Excel', 'Onglet par catégorie'],
    'SEP',
    [ICO.send, 'Email cabinet compta', 'Pennylane via API'],
  ],
  'encaissement.html': [
    [ICO.pdf, 'Export PDF', 'Suivi impayés imprimable'],
    [ICO.csv, 'Export CSV', 'Factures + relances'],
    [ICO.xlsx, 'Export Excel', 'Onglet par statut'],
    'SEP',
    [ICO.send, 'Envoyer relances email', 'Sélection multiple'],
  ],
  'tva.html': [
    [ICO.pdf, 'Export CA3 (PDF)', 'Formulaire DGFiP rempli'],
    [ICO.csv, 'Export CSV', 'Détail TVA par taux'],
    [ICO.xlsx, 'Export Excel', 'Avec annexes'],
    'SEP',
    [ICO.send, 'Email cabinet compta', 'Pennylane via API'],
  ],
  'rentabilite.html': [
    [ICO.pdf, 'Export PDF', 'Rapport rentabilité'],
    [ICO.csv, 'Export CSV', 'Marges par mission'],
    [ICO.xlsx, 'Export Excel', 'Avec simulateur'],
  ],
  'statistiques.html': [
    [ICO.pdf, 'Export PDF', 'Rapport mensuel'],
    [ICO.csv, 'Export CSV', 'Données brutes'],
    [ICO.xlsx, 'Export Excel', 'Onglets par catégorie'],
  ],
  'incidents.html': [
    [ICO.pdf, 'Export PDF', 'Rapport sinistres assurance'],
    [ICO.csv, 'Export CSV', 'Tous incidents 12 mois'],
    [ICO.xlsx, 'Export Excel', 'Avec coûts par véhicule'],
  ],
  'inspections.html': [
    [ICO.pdf, 'Export PDF', 'Carnet inspections'],
    [ICO.csv, 'Export CSV', 'Toutes inspections'],
    [ICO.xlsx, 'Export Excel', 'Par véhicule'],
  ],
  'salaries.html': [
    [ICO.pdf, 'Export PDF', 'Liste salariés'],
    [ICO.csv, 'Export CSV', 'Avec contrats'],
    [ICO.xlsx, 'Export Excel', 'Onglet par poste'],
    'SEP',
    [ICO.history, 'Historique mouvements', 'Entrées/sorties 24 mois'],
  ],
  'heures.html': [
    [ICO.pdf, 'Export PDF', 'Fiches horaires'],
    [ICO.csv, 'Export CSV', 'Pointages détaillés'],
    [ICO.xlsx, 'Export Excel', 'Préparé pour paie'],
    'SEP',
    [ICO.send, 'Email gestionnaire paie', 'Format Silae/Sage'],
  ],
  'dashboard.html': [
    [ICO.pdf, 'Export PDF', 'Brief opérationnel du jour'],
    [ICO.xlsx, 'Export Excel', 'KPIs complets'],
  ],
  'alertes.html': [
    [ICO.pdf, 'Export PDF', 'Liste alertes actives'],
    [ICO.csv, 'Export CSV', 'Toutes alertes 30 jours'],
  ],
  'planning.html': [
    [ICO.pdf, 'Export PDF', 'Planning semaine imprimable'],
    [ICO.csv, 'Export CSV', 'Toutes affectations'],
    [ICO.xlsx, 'Export Excel', 'Par chauffeur'],
  ],
  'calendrier.html': [
    [ICO.pdf, 'Export PDF', 'Vue mensuelle imprimable'],
    [ICO.csv, 'Export CSV', 'Événements + livraisons'],
  ],
  'equipe.html': [
    [ICO.pdf, 'Export PDF', 'Snapshot équipe'],
    [ICO.csv, 'Export CSV', 'KPIs par membre'],
  ],
};

// REGEX patterns to find and replace export-related buttons
// Patterns we want to neutralize: any button with content "Rapport", "Exporter", "Historique" in <button> tags
// We'll replace the FIRST matching button-pair (or single button) with the dropdown

function processFile(filename) {
  if (filename === 'index.html' || !PAGE_MENUS[filename]) return;
  const filepath = join(PREVIEWS_DIR, filename);
  let html = readFileSync(filepath, 'utf8');

  const menuId = `export-menu-${filename.replace('.html','')}`;
  const dropdown = exportDropdown(menuId, PAGE_MENUS[filename]);

  // Match patterns we want to replace with the dropdown
  // Pattern A: <button class="btn btn-secondary">📚 Historique...</button><button class="btn btn-secondary">📄 Rapport</button>
  // Pattern B: <button class="btn btn-secondary">📚 Historique...</button>
  // Pattern C: <button class="btn btn-secondary">📄 Rapport</button>
  // Pattern D: <button class="btn btn-secondary">Historique</button>
  // Pattern E: <button class="btn btn-rapport"...>...Rapport</button>
  // Pattern F: <button ...>Exporter</button> (plain)
  // Pattern G: existing export-wrap dropdown — replace if present

  let replaced = false;

  // First: replace any existing export-wrap dropdown (e.g. carburant already has one)
  const existingExportWrap = /<div class="export-wrap"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;
  if (existingExportWrap.test(html)) {
    html = html.replace(existingExportWrap, dropdown);
    replaced = true;
  } else {
    // Find consecutive buttons like 📚 Historique + 📄 Rapport
    const histAndRapport = /<button[^>]*class="btn btn-secondary"[^>]*>[\s\S]*?(?:📚\s*)?Historique[\s\S]*?<\/button>\s*<button[^>]*class="btn btn-rapport"[^>]*>[\s\S]*?Rapport[\s\S]*?<\/button>/;
    const histAndRapportSecondary = /<button[^>]*class="btn btn-secondary"[^>]*>[\s\S]*?(?:📚\s*)?Historique[\s\S]*?<\/button>\s*<button[^>]*class="btn btn-secondary"[^>]*>[\s\S]*?(?:📄\s*)?Rapport[\s\S]*?<\/button>/;
    const singleRapport = /<button[^>]*class="btn (?:btn-rapport|btn-secondary)"[^>]*>\s*(?:📄\s*)?Rapport\s*<\/button>/;
    const singleHist = /<button[^>]*class="btn btn-secondary"[^>]*>\s*(?:📚\s*)?Historique[\s\S]*?<\/button>/;
    const singleExporter = /<button[^>]*class="btn btn-secondary"[^>]*>\s*Exporter\s*<\/button>/;
    const exporterBtn = /<button[^>]*>\s*(?:📤\s*)?Exporter\s*<\/button>/;

    for (const pat of [histAndRapport, histAndRapportSecondary, singleExporter, exporterBtn, singleRapport, singleHist]) {
      if (pat.test(html)) {
        html = html.replace(pat, dropdown);
        replaced = true;
        break;
      }
    }
  }

  if (!replaced) {
    console.log(`  ⚠ No export button found in ${filename} (skipped — may need manual addition)`);
    return;
  }

  // Inject menu CSS if not present
  if (!html.includes('.export-wrap{')) {
    html = html.replace(/<\/style>/, `\n${MENU_CSS}\n</style>`);
  }

  // Inject menu JS if not present
  if (!html.includes('data-menu-trigger')) {
    // Should be present now because dropdown was inserted, but JS handler must exist too
  }
  if (!html.includes('// Export menus (Livraisons-pattern)')) {
    html = html.replace(/<\/body>/, `${MENU_JS}\n</body>`);
  }

  writeFileSync(filepath, html, 'utf8');
  console.log(`  ✓ ${filename}`);
}

console.log('Harmonizing export buttons → Livraisons-pattern dropdown...\n');
Object.keys(PAGE_MENUS).forEach(processFile);
console.log('\n✓ Done.');
