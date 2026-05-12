import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/audit-deep-liv';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});

const bugs = [];
const ok = [];
const log = (type, msg, detail='') => {
  const icon = type === 'ok' ? '✓' : type === 'warn' ? '⚠' : '✗';
  console.log(`${icon} ${msg}${detail ? ': ' + detail : ''}`);
  if (type === 'bug') bugs.push({ msg, detail });
  else ok.push(msg);
};

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

const cleanUI = () => page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
}).catch(() => {});

await cleanUI();

// Navigate to livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await cleanUI();

// === FULLPAGE SCREENSHOT VS MOCKUP ===
await page.screenshot({ path: `${OUT}/00-page-full.png`, fullPage: false });

// === MODAL NOUVELLE LIVRAISON ===
console.log('\n--- Modal Nouvelle livraison ---');
const btnNouv = page.locator('button').filter({ hasText: /Nouvelle livraison/i });
if (await btnNouv.count() > 0) {
  await btnNouv.first().click();
} else {
  await page.evaluate(() => openModal('modal-livraison'));
}
await page.waitForTimeout(1500);
await cleanUI();
await page.screenshot({ path: `${OUT}/01-modal-nouvelle.png`, fullPage: false });

const modalInfo = await page.evaluate(() => {
  const overlay = document.getElementById('modal-livraison');
  if (!overlay) return { found: false };
  const cs = window.getComputedStyle(overlay);
  if (cs.display === 'none' || cs.visibility === 'hidden') return { found: true, visible: false };
  
  // Section titles
  const titles = Array.from(document.querySelectorAll('#modal-livraison .fp-section-title'))
    .map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim(), w: Math.round(r.width), visible: r.width > 30 };
    });
  
  // Required fields
  const fields = ['liv-client','liv-date','liv-heure-debut','liv-statut','liv-depart','liv-arrivee',
    'liv-prix-ht','liv-taux-tva','liv-chauffeur','liv-vehicule','liv-notes'];
  const fieldStatus = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    fieldStatus[id] = el ? (el.type || el.tagName.toLowerCase()) : 'MISSING';
  });
  
  // CLIENT field focus state (BUG-018 guard)
  const clientEl = document.getElementById('liv-client');
  const clientCs = clientEl ? window.getComputedStyle(clientEl) : null;
  
  // Premature errors
  const errors = Array.from(document.querySelectorAll('#modal-livraison [data-field-error], #modal-livraison .field-error, #modal-livraison .fp-hint-err'))
    .filter(el => {
      const r = el.getBoundingClientRect();
      return el.textContent.trim() && r.width > 0 && r.height > 0;
    })
    .map(el => el.textContent.trim().substring(0, 60));
  
  // modal-body border-radius (BUG-017)
  const body = document.querySelector('#modal-livraison .modal-body');
  const bodyBr = body ? window.getComputedStyle(body).borderRadius : 'N/A';
  
  // Check modal-just-opened
  const hasGuard = overlay.classList.contains('modal-just-opened');
  
  return { found: true, visible: true, titles, fieldStatus, errors, bodyBr, hasGuard };
});

console.log('Modal Nouvelle:', JSON.stringify(modalInfo, null, 2));

if (!modalInfo.found) log('bug', 'modal-livraison not found in DOM');
else if (!modalInfo.visible) log('bug', 'modal-livraison not visible');
else {
  // BUG-017 check
  if (modalInfo.bodyBr !== '0px') log('bug', 'BUG-017 not fixed', `border-radius: ${modalInfo.bodyBr}`);
  else log('ok', 'BUG-017 fixed — border-radius: 0px');
  
  // BUG-018 check
  if (modalInfo.hasGuard) log('ok', 'BUG-018 guard class modal-just-opened present');
  else log('warn', 'guard class modal-just-opened already removed (timing ok)');
  
  // Titles
  const badTitles = (modalInfo.titles || []).filter(t => !t.visible);
  if (badTitles.length) log('bug', 'Section titles truncated/missing', JSON.stringify(badTitles));
  else if (modalInfo.titles.length === 0) log('warn', 'No .fp-section-title found in modal');
  else log('ok', `All ${modalInfo.titles.length} section titles visible`, modalInfo.titles.map(t=>t.text).join(', '));
  
  // Errors on open
  if (modalInfo.errors.length) log('bug', 'Premature errors on modal open', modalInfo.errors.join('; '));
  else log('ok', 'No premature errors on open');
  
  // Missing fields
  const missing = Object.entries(modalInfo.fieldStatus || {}).filter(([,v]) => v === 'MISSING').map(([k]) => k);
  if (missing.length) log('bug', 'Missing form fields', missing.join(', '));
  else log('ok', 'All expected form fields present');
}

// Close modal
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// === SCROLL MODAL TO CHECK FULL CONTENT ===
console.log('\n--- Modal scroll test ---');
if (await btnNouv.count() > 0) await btnNouv.first().click();
else await page.evaluate(() => openModal('modal-livraison'));
await page.waitForTimeout(1200);
// Screenshot scrolled to bottom of modal
await page.evaluate(() => {
  const body = document.querySelector('#modal-livraison .modal-body');
  if (body) body.scrollTop = body.scrollHeight;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/01b-modal-scrolled.png`, fullPage: false });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// === MODAL EDIT LIVRAISON ===
console.log('\n--- Modal Edit livraison ---');
const firstRow = page.locator('#tb-livraisons tr:not(.empty-row)').first();
if (await firstRow.count() > 0) {
  // Get first row's edit button
  const editBtn = firstRow.locator('[title*="Modif"], button[onclick*="edit"], .btn-edit').first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
  } else {
    // Try right-click context or evaluate
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#tb-livraisons tr:not(.empty-row)');
      const firstId = rows[0]?.dataset?.id;
      if (firstId && window.ouvrirEditLivraison) window.ouvrirEditLivraison(firstId);
    });
  }
  await page.waitForTimeout(1500);
  await cleanUI();
  await page.screenshot({ path: `${OUT}/02-modal-edit.png`, fullPage: false });
  
  const editModal = await page.evaluate(() => {
    const overlay = document.getElementById('modal-edit-livraison');
    if (!overlay) return { found: false };
    const cs = window.getComputedStyle(overlay);
    if (cs.display === 'none') return { found: true, visible: false };
    
    const fields = ['edit-liv-client','edit-liv-date','edit-liv-statut','edit-liv-depart','edit-liv-arrivee',
      'edit-liv-prix-ht','edit-liv-chauffeur','edit-liv-vehicule'];
    const fs = {};
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) { fs[id] = 'MISSING'; return; }
      fs[id] = { type: el.type||el.tagName, value: (el.value||'').substring(0,30) };
    });
    const body = document.querySelector('#modal-edit-livraison .modal-body');
    return { found: true, visible: true, fields: fs, bodyBr: body ? window.getComputedStyle(body).borderRadius : 'N/A' };
  });
  
  console.log('Modal Edit:', JSON.stringify(editModal, null, 2));
  if (!editModal.found) log('bug', 'modal-edit-livraison not found');
  else if (!editModal.visible) log('bug', 'modal-edit-livraison not visible after click');
  else {
    if (editModal.bodyBr !== '0px') log('bug', 'Edit modal BUG-017', `border-radius: ${editModal.bodyBr}`);
    else log('ok', 'Edit modal border-radius: 0px');
    const missing = Object.entries(editModal.fields).filter(([,v]) => v === 'MISSING').map(([k]) => k);
    if (missing.length) log('bug', 'Edit modal missing fields', missing.join(', '));
    else {
      const empty = Object.entries(editModal.fields).filter(([,v]) => v?.value === '').map(([k]) => k);
      if (empty.length > 2) log('warn', 'Edit modal fields mostly empty', empty.join(', '));
      else log('ok', 'Edit modal fields populated');
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} else {
  log('warn', 'No rows in livraisons table to test edit modal');
}

// === DRAWER 360 TABS ===
console.log('\n--- Drawer 360 tabs ---');
await page.evaluate(() => {
  const firstRow = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  const clickTarget = firstRow ? firstRow.querySelector('td:nth-child(3)') : null;
  if (clickTarget) clickTarget.click();
});
await page.waitForTimeout(1200);

const drawerInfo = await page.evaluate(() => {
  const panel = document.getElementById('dr-liv-panel');
  if (!panel) return { found: false };
  const open = panel.classList.contains('open');
  if (!open) return { found: true, open: false };
  
  // Tabs
  const tabs = Array.from(panel.querySelectorAll('.dr-tab')).map(t => ({
    id: t.dataset.drTab,
    active: t.classList.contains('active'),
    text: t.textContent.trim()
  }));
  
  // Active tab content
  const activePanel = panel.querySelector('.dr-tab-panel.active');
  const panelId = activePanel?.dataset?.drPanel;
  const panelHtml = activePanel ? activePanel.innerHTML.substring(0, 200) : '';
  
  // Header content
  const headerCl = panel.querySelector('.dr-client')?.textContent?.trim();
  const headerSt = panel.querySelector('.dr-statut, [class*="statut"]')?.textContent?.trim();
  
  return { found: true, open, tabs, panelId, panelHtml, headerCl, headerSt };
});

console.log('Drawer 360:', JSON.stringify(drawerInfo, null, 2));
if (!drawerInfo.found) log('bug', 'dr-liv-panel not found');
else if (!drawerInfo.open) log('bug', 'Drawer did not open on row click');
else {
  log('ok', `Drawer open, ${drawerInfo.tabs.length} tabs`);
  if (drawerInfo.tabs.length < 4) log('warn', 'Fewer than 4 drawer tabs', JSON.stringify(drawerInfo.tabs.map(t=>t.id)));
  else log('ok', 'All 4 drawer tabs present', drawerInfo.tabs.map(t=>t.id).join(', '));
  
  await page.screenshot({ path: `${OUT}/03-drawer-detail.png`, fullPage: false });
  
  // Tab Documents
  await page.evaluate(() => {
    const tab = document.querySelector('.dr-tab[data-dr-tab="documents"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03b-drawer-documents.png`, fullPage: false });
  
  // Tab Paiement
  await page.evaluate(() => {
    const tab = document.querySelector('.dr-tab[data-dr-tab="paiement"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03c-drawer-paiement.png`, fullPage: false });
  
  // Tab Historique
  await page.evaluate(() => {
    const tab = document.querySelector('.dr-tab[data-dr-tab="historique"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03d-drawer-historique.png`, fullPage: false });

  log('ok', 'All 4 drawer tab screenshots captured');
  
  // Close drawer
  await page.evaluate(() => {
    const close = document.querySelector('#dr-liv-panel .dr-close');
    if (close) close.click();
  });
  await page.waitForTimeout(400);
}

// === VIEW KANBAN CHECK ===
console.log('\n--- Vue Kanban ---');
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('kanban');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/04-view-kanban.png`, fullPage: false });

const kanbanInfo = await page.evaluate(() => {
  const k = document.getElementById('vue-kanban');
  if (!k) return { found: false };
  const visible = window.getComputedStyle(k).display !== 'none';
  const cards = k.querySelectorAll('.kanban-card').length;
  const cols = k.querySelectorAll('.kanban-col, [class*="kanban-col"]').length;
  const activeBtn = document.querySelector('#btn-vue-kanban');
  return { found: true, visible, cards, cols, btnActive: activeBtn?.classList.contains('active') };
});
console.log('Kanban:', JSON.stringify(kanbanInfo));
if (!kanbanInfo.found || !kanbanInfo.visible) log('bug', 'Vue Kanban not visible after switch');
else {
  log('ok', `Kanban visible, ${kanbanInfo.cards} cards, ${kanbanInfo.cols} cols`);
  if (kanbanInfo.cards === 0) log('warn', 'Kanban has 0 cards');
  if (!kanbanInfo.btnActive) log('warn', 'Kanban view button not highlighted as active');
  else log('ok', 'Kanban view button active');
}

// Return to table
await page.evaluate(() => { if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('tableau'); });
await page.waitForTimeout(800);

// === SECTION HEAD COUNTS ===
console.log('\n--- Section head counts ---');
const countsInfo = await page.evaluate(() => {
  const countEl = document.querySelector('#page-livraisons .section-count, #page-livraisons .title-count, #page-livraisons [class*="count"]');
  return countEl ? countEl.textContent.trim() : 'NOT FOUND';
});
console.log('Count indicator:', countsInfo);

// === PAGE OVERLAY: check mockup vs actual ===
console.log('\n--- Page section-head layout ---');
await page.screenshot({ path: `${OUT}/05-section-head.png`, clip: { x: 60, y: 60, width: 1380, height: 100 } });

const sectionHead = await page.evaluate(() => {
  const sh = document.querySelector('#page-livraisons .section-head, #page-livraisons .title-row');
  if (!sh) return { found: false };
  const r = sh.getBoundingClientRect();
  const children = Array.from(sh.children).map(c => ({
    tag: c.tagName, cls: c.className.substring(0,60), text: c.textContent.trim().substring(0,60)
  }));
  return { found: true, h: Math.round(r.height), children };
});
console.log('Section head:', JSON.stringify(sectionHead, null, 2));

// === FINAL SCREENSHOT ===
await page.screenshot({ path: `${OUT}/06-final-state.png`, fullPage: false });

await browser.close();

// REPORT
console.log('\n=== SUMMARY ===');
console.log(`OK: ${ok.length}, BUGS: ${bugs.length}`);
bugs.forEach(b => console.log(`  BUG: ${b.msg}${b.detail ? ' — ' + b.detail : ''}`));

writeFileSync(`${OUT}/report.json`, JSON.stringify({ ok, bugs }, null, 2));
