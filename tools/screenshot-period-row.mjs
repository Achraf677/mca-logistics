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

// Full page capture (top area)
await page.screenshot({ path: 'screenshots/audit-deep-liv/page-top-full.png', clip: { x: 60, y: 55, width: 1380, height: 180 } });

// Check page structure
const structure = await page.evaluate(() => {
  const page = document.getElementById('page-livraisons');
  if (!page) return { found: false };
  
  // Find period-row
  const periodRow = page.querySelector('.period-row, [class*="period"]');
  
  // Find view toggle row
  const viewToggle = page.querySelector('.view-toggle, .btn-vue, [id*="btn-vue"]');
  
  // Check chips row
  const chipsRow = page.querySelector('.toolbar, [class*="toolbar"]');
  const chips = chipsRow ? Array.from(chipsRow.querySelectorAll('.chip, [data-livraisons-statut]')).map(c => ({
    text: c.textContent.trim().substring(0, 30),
    active: c.classList.contains('active') || c.getAttribute('data-active') === 'true'
  })) : [];
  
  // Title row
  const titleRow = page.querySelector('.title-row');
  const titleText = titleRow?.querySelector('.page-title')?.textContent?.trim();
  const subMeta = titleRow?.querySelector('.sub-meta')?.textContent?.trim().substring(0, 80);
  
  // Section head
  const sectionHead = page.querySelector('.ds-section-head, .section-head');
  const sectionSubtitle = sectionHead?.querySelector('.sub-meta, .sub')?.textContent?.trim();
  
  // Period row elements
  const periodChips = page.querySelectorAll('[data-livraisons-periode], [data-chips-period]');
  
  return {
    found: true,
    titleText, subMeta,
    sectionSubtitle,
    periodRow: periodRow?.className || 'NOT FOUND',
    periodChipsCount: periodChips.length,
    viewToggle: viewToggle ? 'found' : 'NOT FOUND',
    chipsCount: chips.length,
    chips: chips.slice(0, 6)
  };
});
console.log('Page structure:', JSON.stringify(structure, null, 2));

// Screenshot chips row
await page.screenshot({ path: 'screenshots/audit-deep-liv/chips-area.png', clip: { x: 60, y: 95, width: 1380, height: 60 } });

// Check for period row existence and content
const periodInfo = await page.evaluate(() => {
  const page = document.getElementById('page-livraisons');
  const rows = Array.from(page?.querySelectorAll('div') || []).filter(d => {
    const cls = d.className;
    return cls.includes('period') || cls.includes('toolbar');
  }).map(d => ({
    cls: d.className.substring(0,80),
    childCount: d.children.length,
    html: d.outerHTML.substring(0,300)
  }));
  return rows.slice(0, 10);
});
console.log('\nRows with period/toolbar:', JSON.stringify(periodInfo, null, 2).substring(0, 2000));

await browser.close();
