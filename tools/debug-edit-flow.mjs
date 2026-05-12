import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots/audit-deep-liv', { recursive: true });

const BASE = 'http://127.0.0.1:5500';
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

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
}).catch(()=>{});
await page.evaluate(() => document.querySelector('.nav-item[data-page="livraisons"]')?.click());
await page.waitForTimeout(2000);

// Click "Actions ▾" dropdown on first row
await page.evaluate(() => {
  const actionBtn = document.querySelector('#tb-livraisons tr:not(.empty-row) .table-actions-dropdown');
  if (actionBtn) actionBtn.click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/audit-deep-liv/edit-01-dropdown-open.png' });

// Click "Modifier" in dropdown
const modifierBtn = page.locator('.inline-dropdown-item').filter({ hasText: /Modifier/ });
const modifierCount = await modifierBtn.count();
console.log('Modifier buttons found:', modifierCount);

if (modifierCount > 0) {
  await modifierBtn.first().click();
} else {
  // Try direct evaluate
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.inline-dropdown-item'));
    const modBtn = btns.find(b => b.textContent.includes('Modifier'));
    if (modBtn) modBtn.click();
  });
}
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));
await page.screenshot({ path: 'screenshots/audit-deep-liv/edit-02-after-click.png' });

const editModalState = await page.evaluate(() => {
  const m = document.getElementById('modal-edit-livraison');
  if (!m) return { found: false };
  const cs = window.getComputedStyle(m);
  
  // Get field values if visible
  let fields = {};
  if (cs.display !== 'none') {
    ['edit-liv-client','edit-liv-date','edit-liv-statut','edit-liv-depart','edit-liv-arrivee',
      'edit-liv-prix-ht','edit-liv-taux-tva','edit-liv-chauffeur','edit-liv-vehicule','edit-liv-heure-debut']
      .forEach(id => {
        const el = document.getElementById(id);
        fields[id] = el ? { type: el.type || el.tagName, value: (el.value||'').substring(0,40), hidden: el.type==='hidden' } : 'MISSING';
      });
  }
  
  // Section titles
  const titles = Array.from(m.querySelectorAll('.fp-section-title')).map(t => ({
    text: t.textContent.trim(), w: Math.round(t.getBoundingClientRect().width)
  }));
  
  const body = m.querySelector('.modal-body');
  return {
    found: true,
    display: cs.display,
    visible: cs.display !== 'none',
    fields,
    titles,
    bodyBr: body ? window.getComputedStyle(body).borderRadius : 'N/A'
  };
});

console.log('Edit modal state:', JSON.stringify(editModalState, null, 2));

if (editModalState.visible) {
  // Check title clipping (BUG-017 could affect edit modal too)
  const badTitles = editModalState.titles.filter(t => !t.text || t.w < 50);
  console.log(badTitles.length ? '✗ Titles clipped' : '✓ Titles OK');
  
  // Check for missing fields
  const missing = Object.entries(editModalState.fields).filter(([,v]) => v === 'MISSING').map(([k]) => k);
  const hiddenVisible = Object.entries(editModalState.fields).filter(([,v]) => v?.hidden).map(([k]) => k);
  console.log('Missing fields:', missing);
  console.log('Hidden (not visible) fields:', hiddenVisible);
  
  await page.screenshot({ path: 'screenshots/audit-deep-liv/edit-03-modal-visible.png' });
  
  // Scroll to bottom
  await page.evaluate(() => {
    const b = document.querySelector('#modal-edit-livraison .modal-body');
    if (b) b.scrollTop = b.scrollHeight;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/audit-deep-liv/edit-04-modal-scrolled.png' });
} else {
  console.log('✗ Edit modal NOT visible');
}

await browser.close();
