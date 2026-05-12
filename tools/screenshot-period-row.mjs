import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-12/compare';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const [ctx1, ctx2] = [
  await browser.newContext({ viewport: { width: 1440, height: 900 } }),
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
];
const [page, mock] = [await ctx1.newPage(), await ctx2.newPage()];
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
});
await Promise.all([
  page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' }),
  mock.goto(BASE + '/previews/livraisons.html', { waitUntil: 'domcontentloaded' })
]);
await Promise.all([page.waitForTimeout(5000), mock.waitForTimeout(2000)]);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.evaluate(() => { document.querySelector('.nav-item[data-page="livraisons"]')?.click(); });
await page.waitForTimeout(2000);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));

// Full viewport at 1440x900
await page.screenshot({ path: `${OUT}/prod-full-900.png` });
await mock.screenshot({ path: `${OUT}/mock-full-900.png` });

// Period row area (y=150 to y=280)
await page.screenshot({ path: `${OUT}/prod-period-row.png`, clip: { x: 60, y: 150, width: 1380, height: 130 } });
await mock.screenshot({ path: `${OUT}/mock-period-row.png`, clip: { x: 60, y: 60, width: 1380, height: 130 } });

await browser.close();
