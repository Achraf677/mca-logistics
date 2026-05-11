// Screenshot livraisons page locale
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/local';
mkdirSync(OUT_DIR, { recursive: true });

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
await page.waitForTimeout(4000);

await page.evaluate(() => {
  if (window.MCASetup?.later) window.MCASetup.later();
  document.querySelectorAll('.toast, [class*="toast"], .mca-toast').forEach(el => el.style.display = 'none');
});

// Navigate to livraisons
await page.evaluate(() => {
  if (typeof window.naviguerVers === 'function') window.naviguerVers('livraisons');
});
await page.waitForTimeout(2000);

// Top view 1440x900
await page.screenshot({ path: `${OUT_DIR}/02a-livraisons-top.png`, fullPage: false });
console.log('  ✓ livraisons top →', `${OUT_DIR}/02a-livraisons-top.png`);

// Full page (resize viewport to capture all)
await page.evaluate(() => {
  const mc = document.getElementById('mainContent');
  if (mc) { mc.style.overflow = 'visible'; mc.style.height = 'auto'; }
  document.body.style.overflow = 'visible';
  document.body.style.height = 'auto';
});
const livraisonsHeight = await page.evaluate(() => {
  const d = document.getElementById('page-livraisons');
  return d ? d.scrollHeight + 200 : 1800;
});
await page.setViewportSize({ width: 1440, height: livraisonsHeight });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/02-livraisons.png`, fullPage: true });
console.log('  ✓ livraisons full →', `${OUT_DIR}/02-livraisons.png`);

await browser.close();
console.log('Done.');
