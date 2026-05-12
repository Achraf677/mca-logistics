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

// Full screenshot
await page.screenshot({ path: `${OUT}/AFTER-full.png` });

// Period row zoom
await page.screenshot({ path: `${OUT}/AFTER-period-row.png`, clip: { x: 256, y: 120, width: 1184, height: 50 } });

// Chips toolbar zoom
await page.screenshot({ path: `${OUT}/AFTER-chips.png`, clip: { x: 256, y: 168, width: 1184, height: 45 } });

// Table header + first 3 rows
await page.screenshot({ path: `${OUT}/AFTER-table.png`, clip: { x: 236, y: 210, width: 1204, height: 250 } });

console.log('Done');
await browser.close();
