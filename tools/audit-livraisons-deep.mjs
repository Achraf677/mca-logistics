/**
 * Deep audit Livraisons — hunt bugs systématique
 * Date: 2026-05-12
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-12/hunt';
mkdirSync(OUT, { recursive: true });

const bugs = [];
const ok = [];
function logBug(id, desc, severity = 'MEDIUM') {
  bugs.push({ id, desc, severity });
  console.log(`  🔴 BUG-${id} [${severity}]: ${desc}`);
}
function logOk(what) { ok.push(what); console.log(`  ✓ ${what}`); }
function logWarn(what) { console.log(`  ⚠️ ${what}`); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error' && !msg.text().includes('ERR_CERT') && !msg.text().includes('favicon') && !msg.text().includes('supabase')) {
    consoleErrors.push(msg.text().substring(0, 200));
  }
});

// Setup session
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
});

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// Dismiss setup wizard
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.waitForTimeout(500);

// Navigate to Livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);

await page.evaluate(() => {
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Screenshot 00 — état initial
await page.screenshot({ path: `${OUT}/00-livraisons-initial.png` });
console.log('\n=== Screenshot 00 : état initial ===');

// === SECTION HEAD ===
console.log('\n=== AUDIT 1 : Section Head Buttons ===');
const sectionHead = await page.evaluate(() => {
  const section = document.getElementById('page-livraisons');
  if (!section) return { found: false };
  const btns = Array.from(section.querySelectorAll('button, .liv-dropdown-toggle')).slice(0, 20);
  return {
    found: true,
    btns: btns.map(b => ({
      text: b.textContent.trim().substring(0, 30),
      id: b.id,
      onclick: (b.getAttribute('onclick') || '').substring(0, 50),
      visible: b.offsetParent !== null,
      classes: b.className.substring(0, 50)
    }))
  };
});
if (!sectionHead.found) {
  logBug('SH1', 'page-livraisons introuvable');
} else {
  console.log('Section buttons:', sectionHead.btns.filter(b => b.visible).map(b => b.text).join(' | '));
  const hasNouvBtn = sectionHead.btns.some(b => b.text.includes('Nouvelle') && b.visible);
  const hasGenBtn = sectionHead.btns.some(b => b.text.includes('nér') && b.visible);
  const hasExpBtn = sectionHead.btns.some(b => (b.text.includes('xport') || b.text.includes('Expo')) && b.visible);
  if (!hasNouvBtn) logBug('SH2', 'Bouton "+ Nouvelle livraison" manquant ou caché');
  else logOk('Bouton + Nouvelle livraison visible');
  if (!hasGenBtn) logBug('SH3', 'Bouton Générer manquant ou caché');
  else logOk('Bouton Générer visible');
  if (!hasExpBtn) logBug('SH4', 'Bouton Exporter manquant ou caché');
  else logOk('Bouton Exporter visible');
}

// === MODAL NOUVELLE LIVRAISON ===
console.log('\n=== AUDIT 2 : Modal Nouvelle livraison (saisie réelle) ===');
// Click the actual button
const nouvBtn = page.locator('#page-livraisons button:has-text("Nouvelle livraison"), #page-livraisons button:has-text("+ Nouvelle")').first();
await nouvBtn.click({ timeout: 5000 }).catch(async () => {
  // fallback: evaluate
  await page.evaluate(() => { if (typeof openModal === 'function') openModal('modal-livraison'); });
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/01-modal-nouvelle-open.png` });

const modalNouv = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return { found: false };
  const style = window.getComputedStyle(m);
  const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  const fields = ['liv-client', 'liv-date', 'liv-heure-debut', 'liv-statut', 'liv-depart', 'liv-arrivee',
    'liv-prix-ht', 'liv-taux-tva', 'liv-chauffeur', 'liv-vehicule', 'liv-notes', 'liv-distance'];
  const fieldInfo = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) { fieldInfo[id] = 'MISSING'; return; }
    const cs = window.getComputedStyle(el);
    fieldInfo[id] = {
      type: el.type || el.tagName.toLowerCase(),
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null,
      value: el.value
    };
  });
  // Titles
  const titles = Array.from(m.querySelectorAll('.fp-section-title')).map(el => ({
    text: el.textContent.trim(),
    width: Math.round(el.getBoundingClientRect().width),
    clipX: Math.round(el.getBoundingClientRect().left)
  }));
  // Errors at open
  const errors = Array.from(m.querySelectorAll('.field-error-slot, .fp-hint-err, .field-invalid, .error-msg'))
    .filter(el => {
      const t = el.textContent.trim();
      const r = el.getBoundingClientRect();
      return t && r.width > 0 && r.height > 0;
    })
    .map(el => el.textContent.trim().substring(0, 80));
  return { found: true, visible, fields: fieldInfo, titles, errorsOnOpen: errors };
});

if (!modalNouv.found) {
  logBug('M1', 'modal-livraison absent du DOM');
} else if (!modalNouv.visible) {
  logBug('M2', 'modal-livraison dans DOM mais invisible');
} else {
  logOk('Modal Nouvelle livraison visible');
  if (modalNouv.errorsOnOpen.length) logBug('M3', 'Erreurs visible avant saisie: ' + modalNouv.errorsOnOpen.join(' | '));
  else logOk('Aucune erreur prématurée');
  
  const missingFields = Object.entries(modalNouv.fields).filter(([k,v]) => v === 'MISSING');
  const hiddenFields = Object.entries(modalNouv.fields).filter(([k,v]) => v !== 'MISSING' && v !== 'MISSING' && !v.visible);
  if (missingFields.length) logBug('M4', 'Champs absents: ' + missingFields.map(f => f[0]).join(', '));
  else logOk('Tous les champs présents dans DOM');
  if (hiddenFields.length) logBug('M5', 'Champs masqués: ' + hiddenFields.map(f => f[0]).join(', '));
  else logOk('Tous les champs visibles');
  
  const badTitles = modalNouv.titles.filter(t => !t.text || t.width < 60);
  if (badTitles.length) logBug('M6', 'Titres tronqués: ' + JSON.stringify(badTitles));
  else logOk(`${modalNouv.titles.length} titres sections OK: ` + modalNouv.titles.map(t => `"${t.text.substring(0, 20)}"`).join(', '));
  
  console.log('  Champ focus initial (BUG-018):', modalNouv.fields['liv-client']?.value || '(vide OK)');
}

// Fill form
console.log('\n  → Remplissage modal...');
const fillResult = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return 'modal not found';
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set('liv-client', 'Amazon France');
  set('liv-date', '2026-05-12');
  set('liv-heure-debut', '08:00');
  set('liv-statut', 'en-cours');
  set('liv-depart', 'Paris, Ile-de-France');
  set('liv-arrivee', 'Lyon, Auvergne-Rhône-Alpes');
  set('liv-prix-ht', '850');
  set('liv-taux-tva', '20');
  set('liv-notes', 'Test livraison audit');
  return 'filled';
}).catch(e => 'error: ' + e.message);
console.log('  Fill result:', fillResult);
await page.screenshot({ path: `${OUT}/02-modal-filled.png` });

// Submit
const submitBtn = page.locator('#modal-livraison .modal-footer button').last();
await submitBtn.click({ timeout: 3000 }).catch(() => {
  return page.evaluate(() => {
    const btn = document.querySelector('#modal-livraison .modal-footer button:last-child, #modal-livraison [onclick*="ajouterLivraison"]');
    if (btn) btn.click();
  });
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/03-post-submit.png` });

const postSubmit = await page.evaluate(() => {
  const modal = document.getElementById('modal-livraison');
  const modalVisible = modal && window.getComputedStyle(modal).display !== 'none';
  const toasts = Array.from(document.querySelectorAll('.toast')).filter(t => t.offsetParent !== null).map(t => t.textContent.trim().substring(0, 80));
  return { modalVisible, toasts };
});
if (postSubmit.modalVisible) logBug('M7', 'Modal toujours visible après submit (possiblement erreur)');
else logOk('Modal fermée après submit');
if (postSubmit.toasts.length) console.log('  Toasts:', postSubmit.toasts);

// === MODAL MODIFIER ===
console.log('\n=== AUDIT 3 : Modal Modifier livraison ===');
// Click first row
await page.evaluate(() => {
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Try to open edit modal via row
const firstRow = page.locator('#tb-livraisons tr:not(.empty-row)').first();
await firstRow.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1000);

// Click "Modifier" button in drawer if exists
const modifierBtn = page.locator('#dr-liv-panel button:has-text("Modifier"), #dr-liv-panel [onclick*="ouvrirEditLivraison"]').first();
await modifierBtn.click({ timeout: 3000 }).catch(async () => {
  // Fallback: double-click or direct call
  await page.evaluate(() => {
    const rows = document.querySelectorAll('#tb-livraisons tr:not(.empty-row)');
    if (rows[0]) {
      const modBtn = rows[0].querySelector('button[onclick*="ouvrirEditLivraison"], button[onclick*="editLiv"]');
      if (modBtn) modBtn.click();
    }
  });
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/04-modal-edit-open.png` });

const modalEdit = await page.evaluate(() => {
  const m = document.getElementById('modal-edit-livraison');
  if (!m) return { found: false };
  const style = window.getComputedStyle(m);
  const visible = style.display !== 'none' && style.visibility !== 'hidden';
  const fields = ['edit-liv-client', 'edit-liv-date', 'edit-liv-heure-debut', 'edit-liv-statut',
    'edit-liv-depart', 'edit-liv-arrivee', 'edit-liv-prix-ht', 'edit-liv-chauffeur',
    'edit-liv-vehicule', 'edit-liv-notes'];
  const fieldInfo = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) { fieldInfo[id] = 'MISSING'; return; }
    const cs = window.getComputedStyle(el);
    fieldInfo[id] = {
      type: el.type || el.tagName.toLowerCase(),
      visible: cs.display !== 'none' && el.offsetParent !== null,
      prefilled: !!el.value
    };
  });
  return { found: true, visible, fields: fieldInfo };
});

if (!modalEdit.found) logBug('E1', 'modal-edit-livraison absent du DOM');
else if (!modalEdit.visible) logBug('E2', 'modal-edit-livraison invisible après click Modifier');
else {
  logOk('Modal Modifier visible');
  const missing = Object.entries(modalEdit.fields).filter(([k,v]) => v === 'MISSING');
  const hidden = Object.entries(modalEdit.fields).filter(([k,v]) => v !== 'MISSING' && !v.visible);
  const notPrefilled = Object.entries(modalEdit.fields).filter(([k,v]) => v !== 'MISSING' && v.visible && !v.prefilled);
  if (missing.length) logBug('E3', 'Champs absents dans Modifier: ' + missing.map(f => f[0]).join(', '));
  else logOk('Tous les champs présents dans Modifier');
  if (hidden.length) logBug('E4', 'Champs cachés dans Modifier: ' + hidden.map(f => f[0]).join(', '));
  else logOk('Tous les champs visibles dans Modifier');
  if (notPrefilled.length > 2) logWarn('Champs non préremplis: ' + notPrefilled.map(f => f[0]).join(', '));
  else logOk('Champs correctement préremplis');
}

await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-edit-livraison'); });
await page.waitForTimeout(500);

// === DROPDOWNS ===
console.log('\n=== AUDIT 4 : Dropdowns ===');
await page.evaluate(() => {
  // Close drawer first
  const x = document.querySelector('#dr-liv-panel .dr-close, #dr-liv-panel [onclick*="fermer"]');
  if (x) x.click();
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.waitForTimeout(500);

// Générer dropdown
const genBtn = page.locator('#page-livraisons .liv-dropdown-toggle:has-text("nér"), #page-livraisons button:has-text("Générer")').first();
await genBtn.click({ timeout: 3000 }).catch(async () => {
  await page.evaluate(() => {
    const b = document.querySelector('#page-livraisons [onclick*="toggleDropdown"][onclick*="gen"], #page-livraisons .liv-dropdown-toggle');
    if (b) b.click();
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05-dropdown-gen.png` });

const genItems = await page.evaluate(() => {
  const openMenus = document.querySelectorAll('.liv-dropdown-menu[style*="visible"], .liv-dropdown-menu.visible, .liv-dropdown-wrap.open .liv-dropdown-menu');
  if (openMenus.length === 0) {
    // Try all menus
    const allMenus = document.querySelectorAll('.liv-dropdown-menu');
    return { count: allMenus.length, items: Array.from(allMenus[0]?.querySelectorAll('.liv-dropdown-item') || []).map(i => i.textContent.trim().substring(0, 30)) };
  }
  const items = Array.from(openMenus[0].querySelectorAll('.liv-dropdown-item')).map(i => i.textContent.trim().substring(0, 30));
  return { count: items.length, items };
});
console.log('Gen dropdown items:', genItems);

// Check all dropdowns
const allDropdowns = await page.evaluate(() => {
  const wraps = document.querySelectorAll('#page-livraisons .liv-dropdown-wrap');
  return Array.from(wraps).map((w, i) => {
    const toggle = w.querySelector('.liv-dropdown-toggle');
    const items = w.querySelectorAll('.liv-dropdown-item');
    return {
      index: i,
      toggle: toggle?.textContent.trim().substring(0, 20),
      itemCount: items.length,
      items: Array.from(items).map(it => it.textContent.trim().substring(0, 25))
    };
  });
});
console.log('All dropdowns:', JSON.stringify(allDropdowns));

const genDropdown = allDropdowns.find(d => d.toggle?.includes('nér') || d.toggle?.includes('Gén'));
const expDropdown = allDropdowns.find(d => d.toggle?.includes('xport') || d.toggle?.includes('Expo'));

if (!genDropdown || genDropdown.itemCount !== 4) logBug('DD1', `Dropdown Générer: ${genDropdown?.itemCount || 0} items (attendu 4)`);
else logOk('Dropdown Générer: 4 items: ' + genDropdown.items.join(', '));
if (!expDropdown || expDropdown.itemCount !== 4) logBug('DD2', `Dropdown Exporter: ${expDropdown?.itemCount || 0} items (attendu 4)`);
else logOk('Dropdown Exporter: 4 items: ' + expDropdown.items.join(', '));

// Close dropdown
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// === FILTER BAR ===
console.log('\n=== AUDIT 5 : Barre de filtres ===');
const filterToggle = page.locator('#page-livraisons button:has-text("Filtres"), #page-livraisons [onclick*="toggleLivraisonsFilters"]').first();
await filterToggle.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(500);
const filtersExpanded = await page.evaluate(() => {
  const bar = document.querySelector('#page-livraisons .filters-bar, #page-livraisons [id*="filtre"][id*="bar"]');
  if (!bar) {
    // Look for filter elements
    const filtre = document.querySelector('#filtre-statut, #filtre-chauffeur, #filtre-vehicule');
    const visible = filtre && window.getComputedStyle(filtre).display !== 'none';
    return { barFound: false, filtersVisible: visible };
  }
  return { barFound: true, visible: window.getComputedStyle(bar).display !== 'none' };
});
console.log('Filter bar state:', filtersExpanded);
if (!filtersExpanded.filtersVisible && !filtersExpanded.barFound) logWarn('Filtres: barre pas visible après toggle');
else logOk('Filtres accessibles');

// === CHIPS ===
console.log('\n=== AUDIT 6 : Chips filtres ===');
const chips = await page.evaluate(() => {
  const chips = document.querySelectorAll('#page-livraisons .status-chip, #page-livraisons [data-livraisons-statut]');
  return Array.from(chips).map(c => ({
    text: c.textContent.trim().substring(0, 30),
    statut: c.getAttribute('data-livraisons-statut'),
    active: c.classList.contains('active'),
    visible: c.offsetParent !== null
  })).filter(c => c.visible);
});
console.log('Chips:', JSON.stringify(chips));
if (chips.length < 4) logBug('CH1', `Seulement ${chips.length} chips visibles (attendu 5+)`);
else logOk(`${chips.length} chips présents: ` + chips.map(c => c.text.substring(0, 15)).join(', '));

// Click chip "Livré" 
const livreChip = chips.find(c => c.statut === 'livre' || c.text.toLowerCase().includes('livr'));
if (livreChip) {
  const chipEl = page.locator(`[data-livraisons-statut="livre"]`).first();
  await chipEl.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const filteredRows = await page.evaluate(() => document.querySelectorAll('#tb-livraisons tr:not(.empty-row)').length);
  console.log('  Rows after "Livré" chip:', filteredRows);
  if (filteredRows === 0) logWarn('Chip Livré: 0 rows (seed insuffisant?)');
  else logOk(`Chip Livré filtre: ${filteredRows} rows`);
  // Reset
  await chipEl.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// === BULK SELECT ===
console.log('\n=== AUDIT 7 : Bulk select ===');
const checkbox = page.locator('#page-livraisons thead input[type="checkbox"], #page-livraisons .select-all-checkbox').first();
await checkbox.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(500);
const checked = await page.evaluate(() => {
  return document.querySelectorAll('#tb-livraisons input[type="checkbox"]:checked, #tb-livraisons tr.selected').length;
});
console.log('Checked rows:', checked);
if (checked === 0) logBug('BS1', 'Checkbox select-all: 0 rows sélectionnés après clic', 'MEDIUM');
else logOk(`Select-all: ${checked} rows sélectionnés`);

// Uncheck all
await checkbox.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(300);

// === KANBAN ===
console.log('\n=== AUDIT 8 : Vue Kanban ===');
const kanbanBtn = page.locator('#page-livraisons #btn-vue-kanban, #page-livraisons button:has-text("Kanban")').first();
await kanbanBtn.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/06-kanban.png` });
const kanbanCards = await page.evaluate(() => {
  const cards = document.querySelectorAll('#page-livraisons .kanban-card, #page-livraisons [class*="kanban"] .card');
  const cols = document.querySelectorAll('#page-livraisons .kanban-col, #page-livraisons [class*="kanban-col"]');
  return { cards: cards.length, cols: cols.length };
});
console.log('Kanban:', kanbanCards);
if (kanbanCards.cards === 0) logBug('KAN1', 'Kanban: 0 cartes affichées', 'MEDIUM');
else logOk(`Kanban: ${kanbanCards.cards} cartes, ${kanbanCards.cols} colonnes`);

// === CALENDRIER ===
console.log('\n=== AUDIT 9 : Vue Calendrier ===');
const calBtn = page.locator('#page-livraisons #btn-vue-calendrier, #page-livraisons button:has-text("Calendrier")').first();
await calBtn.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/07-calendrier.png` });

// Back to tableau
const tableauBtn = page.locator('#page-livraisons #btn-vue-tableau, #page-livraisons button:has-text("Tableau")').first();
await tableauBtn.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1000);

// === DRAWER 360 DETAIL ===
console.log('\n=== AUDIT 10 : Drawer 360 contenu ===');
const firstRowLiv = page.locator('#tb-livraisons tr:not(.empty-row)').first();
await firstRowLiv.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/08-drawer-360.png` });

const drawerContent = await page.evaluate(() => {
  const panel = document.getElementById('dr-liv-panel');
  if (!panel) return { found: false };
  const visible = panel.classList.contains('open') || window.getComputedStyle(panel).transform !== 'matrix(1, 0, 0, 1, 0, 0)';
  const tabs = Array.from(panel.querySelectorAll('.dr-tab')).map(t => ({
    text: t.textContent.trim(), 
    active: t.classList.contains('active')
  }));
  const clientEl = panel.querySelector('[class*="client"], .dr-client, [id*="dr-liv-client"]');
  const montantEl = panel.querySelector('[class*="montant"], .dr-montant, [id*="dr-liv-montant"]');
  const footerBtns = Array.from(panel.querySelectorAll('.dr-footer button, .dr-actions button')).map(b => b.textContent.trim().substring(0, 25));
  return { 
    found: true, 
    visible, 
    tabs,
    hasClient: !!clientEl,
    hasMontant: !!montantEl,
    footerBtns
  };
});
console.log('Drawer 360:', JSON.stringify(drawerContent));
if (!drawerContent.found) logBug('DR1', 'drawer-360 absent du DOM', 'HIGH');
else if (!drawerContent.visible) logBug('DR2', 'Drawer 360 non ouvert après click row', 'HIGH');
else {
  logOk('Drawer 360 ouvert');
  logOk('Tabs: ' + drawerContent.tabs.map(t => t.text).join(', '));
  if (drawerContent.footerBtns.length) logOk('Footer buttons: ' + drawerContent.footerBtns.join(', '));
  else logWarn('Drawer footer: aucun bouton visible');
}

// === TABLE COLUMNS ===
console.log('\n=== AUDIT 11 : Colonnes table ===');
await page.evaluate(() => {
  const panel = document.getElementById('dr-liv-panel');
  if (panel) panel.classList.remove('open');
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.waitForTimeout(300);

const tableInfo = await page.evaluate(() => {
  const tb = document.getElementById('tb-livraisons');
  if (!tb) return { found: false };
  const thead = tb.closest('table')?.querySelector('thead');
  const headers = thead ? Array.from(thead.querySelectorAll('th')).map(th => ({
    text: th.textContent.trim(),
    width: Math.round(th.getBoundingClientRect().width)
  })) : [];
  const firstRow = tb.querySelector('tr:not(.empty-row)');
  const rowCells = firstRow ? Array.from(firstRow.querySelectorAll('td')).map(td => ({
    text: td.textContent.trim().substring(0, 30),
    type: td.querySelector('select') ? 'select' : td.querySelector('input') ? 'input' : 'text'
  })) : [];
  return { found: true, headers, rows: tb.querySelectorAll('tr:not(.empty-row)').length, rowCells };
});

if (!tableInfo.found) {
  logBug('TBL1', 'tbody#tb-livraisons introuvable', 'HIGH');
} else {
  logOk(`Table: ${tableInfo.headers.length} colonnes, ${tableInfo.rows} rows`);
  console.log('Headers:', tableInfo.headers.map(h => `"${h.text}"(${h.width}px)`).join(', '));
  if (tableInfo.headers.length < 7) logBug('TBL2', `Seulement ${tableInfo.headers.length} colonnes (attendu 9+)`);
  // Check mockup columns: N° LIV | Date | Trajet | Client | Statut | Véhicule | Montant HT | TVA | Chauffeur
  const expectedCols = ['N°', 'Date', 'Trajet', 'Client', 'Statut', 'Véhicule', 'Montant', 'TVA', 'Chauffeur'];
  const missing = expectedCols.filter(e => !tableInfo.headers.some(h => h.text.includes(e)));
  if (missing.length) logBug('TBL3', 'Colonnes manquantes vs mockup: ' + missing.join(', '));
  else logOk('Toutes les colonnes mockup présentes');
}

// === FINAL SCREENSHOT ===
await page.screenshot({ path: `${OUT}/99-final.png` });

// === CONSOLE ERRORS ===
console.log('\n=== Console Errors (hors SSL/cert) ===');
if (consoleErrors.length) {
  consoleErrors.forEach(e => logBug('CE', e.substring(0, 120), 'LOW'));
} else {
  logOk('0 erreur console JS');
}

await browser.close();

// Summary
console.log('\n\n=== BUG SUMMARY ===');
console.log(`Total bugs: ${bugs.length} | OK: ${ok.length}`);
bugs.forEach(b => console.log(`  [${b.severity}] BUG-${b.id}: ${b.desc.substring(0, 80)}`));
writeFileSync(`${OUT}/report.json`, JSON.stringify({ timestamp: new Date().toISOString(), bugs, ok }, null, 2));
console.log(`Report: ${OUT}/report.json`);
