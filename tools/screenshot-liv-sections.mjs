import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots/audit-livraisons-full';
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

await page.goto('http://127.0.0.1:5500/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// Dismiss wizard
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  var w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Navigate to livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);

// Dismiss again
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  var w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Get bounding boxes for key elements
const rects = await page.evaluate(() => {
  const elements = {
    sectionHead: document.querySelector('#page-livraisons .ds-section-head'),
    periodRow: document.querySelector('#page-livraisons .period-row'),
    chipsToolbar: document.querySelector('#page-livraisons .ds-chips-toolbar'),
    tableHeader: document.querySelector('#page-livraisons table thead'),
    titleRow: document.querySelector('#page-livraisons .title-row'),
    firstTr: document.querySelector('#tb-livraisons tr:not(.empty-row)'),
  };
  const result = {};
  for (const [k, el] of Object.entries(elements)) {
    if (el) {
      const r = el.getBoundingClientRect();
      result[k] = { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), display: window.getComputedStyle(el).display };
    } else {
      result[k] = null;
    }
  }
  return result;
});
console.log('Element positions:', JSON.stringify(rects, null, 2));

// Full page screenshot  
await page.screenshot({ path: `${OUT}/LIVE-full.png` });

// Section zones
await page.screenshot({ path: `${OUT}/LIVE-y0-200.png`, clip: { x: 60, y: 0, width: 1380, height: 200 } });
await page.screenshot({ path: `${OUT}/LIVE-y60-450.png`, clip: { x: 60, y: 60, width: 1380, height: 390 } });

await browser.close();
console.log('Done');
