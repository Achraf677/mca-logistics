import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5500';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
});
await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.evaluate(() => { document.querySelector('.nav-item[data-page="livraisons"]')?.click(); });
await page.waitForTimeout(2000);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));

// Check period-row visibility and position
const pos = await page.evaluate(() => {
  const pr = document.querySelector('#page-livraisons .period-row');
  if (!pr) return { found: false };
  const r = pr.getBoundingClientRect();
  const cs = window.getComputedStyle(pr);
  return { 
    found: true, 
    display: cs.display, 
    visibility: cs.visibility,
    top: Math.round(r.top), 
    bottom: Math.round(r.bottom),
    height: Math.round(r.height),
    width: Math.round(r.width)
  };
});
console.log('period-row:', pos);

// Check chips toolbar
const chips = await page.evaluate(() => {
  const ct = document.querySelector('#page-livraisons .ds-chips-toolbar');
  if (!ct) return { found: false };
  const r = ct.getBoundingClientRect();
  const cs = window.getComputedStyle(ct);
  return { found: true, display: cs.display, top: Math.round(r.top), height: Math.round(r.height) };
});
console.log('chips-toolbar:', chips);

// Crop y=130 to y=270 to see period-row area
await page.screenshot({ path: 'screenshots/2026-05-12/compare/prod-between.png', clip: { x: 60, y: 120, width: 1380, height: 200 } });

await browser.close();
