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
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  var w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  var w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

// Get element positions
const rects = await page.evaluate(() => {
  const el = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height), display: window.getComputedStyle(e).display };
  };
  return {
    titleRow: el('#page-livraisons .title-row'),
    sectionHead: el('#page-livraisons .ds-section-head'),
    periodRow: el('#page-livraisons .period-row'),
    chipsToolbar: el('#page-livraisons .ds-chips-toolbar'),
    tableHeader: el('#page-livraisons table thead'),
  };
});
console.log('Positions:', JSON.stringify(rects, null, 2));

// Zoom: top 280px of content area
await page.screenshot({ path: `${OUT}/AFTER2-top280.png`, clip: { x: 236, y: 55, width: 1204, height: 280 } });
await page.screenshot({ path: `${OUT}/AFTER2-full.png` });

await browser.close();
console.log('Done');
