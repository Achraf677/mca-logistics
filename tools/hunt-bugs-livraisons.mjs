/**
 * Hunt bugs — Livraisons page comprehensive audit
 * Tests : modal créa, modal édition, drawer 360, dropdowns, vues, filtres
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-11/hunt';
mkdirSync(OUT, { recursive: true });

const bugs = [];
function logBug(id, desc, severity = 'MEDIUM') {
  bugs.push({ id, desc, severity });
  console.log(`\n🔴 BUG ${id} [${severity}]: ${desc}`);
}
function logOk(what) { console.log(`  ✓ ${what}`); }
function logWarn(what) { console.log(`  ⚠️ ${what}`); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('ERR_CERT') && !msg.text().includes('favicon')) {
    consoleErrors.push(msg.text().substring(0, 200));
  }
});

await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);

// === 1. CHECK MODAL NOUVELLE LIVRAISON STRUCTURE ===
console.log('\n=== AUDIT: Modal Nouvelle livraison ===');
await page.evaluate(() => { if (typeof openModal === 'function') openModal('modal-livraison'); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/01-modal-nouvelle.png` });

const modalNouv = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return { found: false };
  const fields = ['liv-client', 'liv-date', 'liv-heure-debut', 'liv-statut', 'liv-depart', 'liv-arrivee', 
    'liv-prix-ht', 'liv-taux-tva', 'liv-chauffeur', 'liv-vehicule', 'liv-notes', 'liv-distance'];
  const result = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    result[id] = el ? el.type || el.tagName.toLowerCase() : 'MISSING';
  });
  // Check section titles
  const titles = Array.from(m.querySelectorAll('.fp-section-title')).map(el => ({
    text: el.textContent.trim(),
    w: Math.round(el.getBoundingClientRect().width)
  }));
  // Check error slots at open
  const errors = Array.from(m.querySelectorAll('.field-error-slot, .fp-hint-err, .field-invalid'))
    .filter(el => el.textContent.trim() && el.getBoundingClientRect().width > 0)
    .map(el => el.textContent.trim().substring(0, 50));
  return { found: true, fields: result, titles, errorsOnOpen: errors };
});
console.log('Modal structure:', JSON.stringify(modalNouv, null, 2));

if (!modalNouv.found) logBug('N1', 'modal-livraison introuvable dans DOM', 'HIGH');
else {
  logOk('modal-livraison found');
  if (modalNouv.errorsOnOpen.length) logBug('N2', 'Erreurs visibles à l\'ouverture: ' + modalNouv.errorsOnOpen.join(', '), 'HIGH');
  else logOk('Aucune erreur prématurée BUG-002');
  
  const missedTitles = modalNouv.titles.filter(t => !t.text || t.w < 50);
  if (missedTitles.length) logBug('N3', 'Titres de section tronqués: ' + JSON.stringify(missedTitles), 'HIGH');
  else logOk('Titres sections OK (BUG-001 fixé)');
}

await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-livraison'); });
await page.waitForTimeout(200);

// === 2. CHECK MODAL EDIT LIVRAISON STRUCTURE ===
console.log('\n=== AUDIT: Modal Modifier livraison ===');
await page.evaluate(() => { if (typeof openModal === 'function') openModal('modal-edit-livraison'); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-modal-edit.png` });

const modalEdit = await page.evaluate(() => {
  const m = document.getElementById('modal-edit-livraison');
  if (!m) return { found: false };
  const fields = ['edit-liv-client', 'edit-liv-date', 'edit-liv-heure-debut', 'edit-liv-statut', 
    'edit-liv-depart', 'edit-liv-arrivee', 'edit-liv-prix-ht', 'edit-liv-chauffeur', 
    'edit-liv-vehicule', 'edit-liv-notes', 'edit-liv-distance'];
  const result = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) { result[id] = 'MISSING'; return; }
    result[id] = { type: el.type, visible: el.type !== 'hidden' && el.offsetParent !== null };
  });
  return { found: true, fields: result };
});
console.log('Modal Edit structure:', JSON.stringify(modalEdit, null, 2));

if (!modalEdit.found) logBug('E1', 'modal-edit-livraison introuvable', 'HIGH');
else {
  const missing = Object.entries(modalEdit.fields).filter(([k,v]) => v === 'MISSING' || v.type === 'hidden');
  if (missing.length) logBug('E2', 'Champs manquants/cachés dans Modifier: ' + missing.map(m => m[0]).join(', '), 'MEDIUM');
  else logOk('Tous les champs de Modifier sont visibles (BUG-004 fixé)');
}

await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-edit-livraison'); });

// === 3. CHECK DROPDOWNS ===
console.log('\n=== AUDIT: Dropdowns Générer/Exporter ===');
const dropdowns = await page.evaluate(() => {
  const genMenu = document.querySelector('[data-dropdown-menu="gen"]');
  const expMenu = document.querySelector('[data-dropdown-menu="export"]');
  const genItems = genMenu ? Array.from(genMenu.querySelectorAll('.liv-dropdown-item')).map(b => b.querySelector('.ld-name')?.textContent.trim()) : [];
  const expItems = expMenu ? Array.from(expMenu.querySelectorAll('.liv-dropdown-item')).map(b => b.querySelector('.ld-name')?.textContent.trim()) : [];
  return { gen: genItems, exp: expItems };
});
console.log('Dropdown items:', JSON.stringify(dropdowns));
if (dropdowns.gen.length !== 4) logBug('D1', `Dropdown Générer: ${dropdowns.gen.length} items (attendu 4): ${dropdowns.gen.join(', ')}`, 'HIGH');
else logOk('Dropdown Générer: 4 items');
if (dropdowns.exp.length !== 4) logBug('D2', `Dropdown Exporter: ${dropdowns.exp.length} items (attendu 4): ${dropdowns.exp.join(', ')}`, 'HIGH');
else logOk('Dropdown Exporter: 4 items');

// === 4. CHECK VIEW TABS ===
console.log('\n=== AUDIT: Onglets vues (table/kanban/calendrier) ===');
const views = await page.evaluate(() => {
  const btns = document.querySelectorAll('[data-view], [onclick*="changerVueLivraisons"], .view-toggle button');
  return Array.from(btns).map(b => ({ text: b.textContent.trim().substring(0, 20), onclick: (b.getAttribute('onclick') || '').substring(0,50) }));
});
console.log('View buttons:', JSON.stringify(views));
if (views.length < 3) logBug('V1', `Seulement ${views.length} boutons vue (attendu 3)`, 'MEDIUM');
else logOk(`${views.length} vue boutons trouvés`);

// === 5. CHECK TABLE STRUCTURE ===
console.log('\n=== AUDIT: Structure table livraisons ===');
const tableInfo = await page.evaluate(() => {
  const tb = document.getElementById('tb-livraisons');
  if (!tb) return { found: false };
  const thead = tb.closest('table')?.querySelector('thead');
  const headers = thead ? Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim()) : [];
  const rows = tb.querySelectorAll('tr:not(.empty-row)').length;
  const emptyRow = tb.querySelector('.empty-row');
  return { found: true, headers, rows, hasEmptyState: !!emptyRow };
});
console.log('Table info:', JSON.stringify(tableInfo));
if (!tableInfo.found) logBug('T1', 'tb-livraisons introuvable', 'HIGH');
else {
  logOk(`Table: ${tableInfo.headers.length} colonnes, ${tableInfo.rows} rows`);
  if (tableInfo.headers.length < 7) logBug('T2', `Table: seulement ${tableInfo.headers.length} colonnes (attendu 9+)`, 'MEDIUM');
}

// === 6. CHECK SECTION HEAD BUTTONS ===
console.log('\n=== AUDIT: Boutons section-head ===');
const sectionHeadBtns = await page.evaluate(() => {
  const btns = document.querySelectorAll('#page-livraisons .section-head button, #page-livraisons .section-actions button');
  return Array.from(btns).map(b => ({
    text: b.textContent.trim().substring(0, 30),
    onclick: (b.getAttribute('onclick') || '').substring(0, 60),
    disabled: b.disabled
  }));
});
console.log('Section head buttons:', JSON.stringify(sectionHeadBtns));

// === 7. CHECK DRAWER 360 ===
console.log('\n=== AUDIT: Drawer 360 ===');
const drawerInfo = await page.evaluate(() => {
  const d = document.getElementById('drawer-livraison-360');
  if (!d) return { found: false };
  const tabs = Array.from(d.querySelectorAll('.dr-tab')).map(t => t.textContent.trim());
  return { found: true, tabs };
});
console.log('Drawer 360:', JSON.stringify(drawerInfo));
if (!drawerInfo.found) logBug('DR1', 'drawer-livraison-360 introuvable', 'HIGH');
else logOk('Drawer 360 présent, tabs: ' + drawerInfo.tabs.join(', '));

// === CONSOLE ERRORS ===
console.log('\n=== Console Errors ===');
const filteredErrors = consoleErrors.filter(e => !e.includes('supabase') && !e.includes('ERR_CERT'));
if (filteredErrors.length) {
  filteredErrors.forEach(e => logBug('CE', e.substring(0, 100), 'LOW'));
} else {
  logOk('Aucune erreur console JS');
}

// Final screenshot
await page.screenshot({ path: `${OUT}/99-final.png` });

await browser.close();

// Summary
console.log('\n\n=== BUG SUMMARY ===');
console.log(`Total bugs found: ${bugs.length}`);
bugs.forEach(b => console.log(`  [${b.severity}] ${b.id}: ${b.desc.substring(0, 80)}`));

// Write to file
writeFileSync(`${OUT}/bugs-found.json`, JSON.stringify({ timestamp: new Date().toISOString(), bugs }, null, 2));
console.log(`\nFull report: ${OUT}/bugs-found.json`);
