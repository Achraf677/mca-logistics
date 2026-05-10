// Add period selector (Jour/Semaine/Mois/Année) to pages with time-based data.
// Run: node tools/add-period-selector.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';

// Pages to update with period info
const PAGES = {
  'charges.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
  'entretiens.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
  'heures.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
  'statistiques.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
  'tva.html': { period: 'Avril 2026', range: '01/04 → 30/04', default: 'Mois' },
  'rentabilite.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
  'encaissement.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
  'alertes.html': { period: '30 derniers jours', range: '11/04 → 11/05', default: '30j' },
  'incidents.html': { period: 'Mai 2026', range: '01/05 → 31/05', default: 'Mois' },
};

function periodNav({period, range, def}) {
  const periods = def === '30j' ? ['7j','30j','90j','Année'] : ['Jour','Semaine','Mois','Année'];
  const chips = periods.map(p => `<button class="btn btn-chip${p===def?' active':''}">${p}</button>`).join('');
  return `      <!-- Navigation période (harmonisé Jour/Semaine/Mois/Année) -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-secondary" style="min-height:34px;padding:6px 10px;font-size:12px" aria-label="Précédent"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <button class="btn btn-secondary" style="min-height:34px;padding:6px 12px;font-size:12px;background:var(--brand-soft);color:var(--brand);border-color:rgba(230,57,70,0.4)">Aujourd'hui</button>
          <button class="btn btn-secondary" style="min-height:34px;padding:6px 10px;font-size:12px" aria-label="Suivant"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
          <div style="font-family:var(--font-body);font-size:14px;font-weight:800;margin-left:8px;text-transform:capitalize">${period}</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${range}</div>
        </div>
        <div style="display:flex;gap:6px">${chips}</div>
      </div>
`;
}

for (const [filename, cfg] of Object.entries(PAGES)) {
  const fp = join(dir, filename);
  let html = readFileSync(fp, 'utf8');
  if (html.includes('Navigation période (harmonisé')) {
    console.log(`  - skip ${filename} (already has)`);
    continue;
  }
  // Insert period nav right after section-head closing tag (just before kpi-grid or main content)
  // We search for the section-head closing (</div> after section-head) and insert after it
  const nav = periodNav({...cfg, def: cfg.default});
  // Pattern: insert after first occurrence of </div>\n\n      <div class="kpi-grid"> or </div>\n      <div class="kpi-grid">
  const pattern = /(<\/div>\s*\n\s*<\/div>)\s*\n\s*(\n\s*)?<div class="kpi-grid"/;
  if (pattern.test(html)) {
    html = html.replace(pattern, `$1\n\n${nav}\n      <div class="kpi-grid"`);
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ ${filename}`);
  } else {
    console.log(`  ✗ ${filename} : pattern not found, manual insert needed`);
  }
}
console.log('\nDone.');
