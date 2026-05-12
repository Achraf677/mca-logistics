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

// Get livId from first row
const firstLivId = await page.evaluate(() => {
  const r = document.querySelector('#tb-livraisons tr[data-liv-id]');
  return r?.dataset?.livId;
});
console.log('First livId:', firstLivId);

if (firstLivId) {
  // Call ouvrirEditLivraison directly with correct ID
  await page.evaluate((id) => {
    if (typeof window.ouvrirEditLivraison === 'function') window.ouvrirEditLivraison(id);
    else console.error('ouvrirEditLivraison not defined');
  }, firstLivId);
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));
  await page.screenshot({ path: 'screenshots/audit-deep-liv/edit-via-fn.png' });
  
  const editModal = await page.evaluate(() => {
    const m = document.getElementById('modal-edit-livraison');
    if (!m) return { found: false };
    const cs = window.getComputedStyle(m);
    const visible = cs.display !== 'none' && cs.visibility !== 'hidden';
    if (!visible) return { found: true, visible: false, display: cs.display };
    
    const fields = {};
    ['edit-liv-client','edit-liv-date','edit-liv-statut','edit-liv-depart','edit-liv-arrivee',
      'edit-liv-prix-ht','edit-liv-taux-tva','edit-liv-chauffeur','edit-liv-vehicule','edit-liv-heure-debut']
      .forEach(id => {
        const el = document.getElementById(id);
        if (!el) { fields[id] = 'MISSING'; return; }
        fields[id] = { 
          type: el.type || el.tagName.toLowerCase(),
          value: (el.value||'').substring(0,40),
          hidden: el.type === 'hidden'
        };
      });
    
    const titles = Array.from(m.querySelectorAll('.fp-section-title')).map(t => ({
      text: t.textContent.trim().substring(0, 50),
      w: Math.round(t.getBoundingClientRect().width)
    }));
    
    const body = m.querySelector('.modal-body');
    return {
      found: true, visible: true,
      fields, titles,
      bodyBr: body ? window.getComputedStyle(body).borderRadius : 'N/A',
      hasGuard: m.classList.contains('modal-just-opened')
    };
  });
  
  console.log('Edit modal state:', JSON.stringify(editModal, null, 2));
  
  if (editModal.visible) {
    const missing = Object.entries(editModal.fields).filter(([,v]) => v === 'MISSING').map(([k]) => k);
    const hidden = Object.entries(editModal.fields).filter(([,v]) => v?.hidden).map(([k]) => k);
    const empty = Object.entries(editModal.fields).filter(([,v]) => v?.value === '').map(([k]) => k);
    console.log(`\n✓ Edit modal visible`);
    console.log(`  Border-radius: ${editModal.bodyBr}`);
    console.log(`  Titles: ${editModal.titles.map(t=>t.text).join(', ')}`);
    console.log(`  Missing fields: ${missing.length ? missing.join(', ') : 'none'}`);
    console.log(`  Hidden fields: ${hidden.length ? hidden.join(', ') : 'none'}`);
    console.log(`  Empty fields: ${empty.length ? empty.join(', ') : 'none'}`);
  } else {
    console.log('✗ Edit modal NOT visible:', editModal);
  }
}

// Also test via Actions dropdown click (Playwright proper click)
console.log('\n--- Testing via Actions dropdown click ---');
// Close any open modal first
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

const actionDropdownBtn = page.locator('#tb-livraisons tr:not(.empty-row) .table-actions-dropdown').first();
if (await actionDropdownBtn.count() > 0) {
  await actionDropdownBtn.click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/audit-deep-liv/edit-dropdown-after-click.png' });
  
  // Check dropdown open state
  const dropState = await page.evaluate(() => {
    const ddMenus = document.querySelectorAll('.inline-dropdown-menu');
    const openMenus = Array.from(ddMenus).filter(m => {
      const cs = window.getComputedStyle(m);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
    });
    return { total: ddMenus.length, open: openMenus.length };
  });
  console.log('Dropdown state after click:', JSON.stringify(dropState));
} else {
  console.log('Actions dropdown button not found');
}

await browser.close();
