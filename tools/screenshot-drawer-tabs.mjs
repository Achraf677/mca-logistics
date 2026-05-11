// Open vehicle drawer and screenshot each internal tab.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const secrets = Object.fromEntries(
  readFileSync('.local-secrets', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BASE = 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = 'screenshots/admin-drawer-tabs';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
await page.fill('#login-identifiant', secrets.PLAYWRIGHT_ADMIN_EMAIL);
await page.fill('#login-password', secrets.PLAYWRIGHT_ADMIN_PASSWORD);
await page.click('#login-submit');
await page.waitForURL(/\/admin/, { timeout: 15000 });
await page.waitForTimeout(3000); // longer wait for storage hydration
try { await page.locator('text=Plus tard').first().click({ timeout: 2000 }); } catch {}
await page.waitForTimeout(800);

// Open client drawer (most reliable data)
console.log('[client drawer]');
await page.evaluate(() => window.naviguerVers('clients'));
await page.waitForTimeout(1500);
const cid = await page.evaluate(() => {
  const c = window.charger ? window.charger('clients') : [];
  return c && c[0] && c[0].id;
});
if (!cid) { console.log('  ✗ no client'); await browser.close(); process.exit(1); }
await page.evaluate(id => window.ouvrirFiche360Client && window.ouvrirFiche360Client(id), cid);
await page.waitForTimeout(1500);

// Screenshot each tab
const tabs = ['vue-d\'ensemble', 'Factures', 'Livraisons', 'Paiements', 'Communications'];
for (let i = 0; i < tabs.length; i++) {
  const tab = tabs[i];
  try {
    await page.locator(`.s25-drawer button:has-text("${tab}"), .side-drawer button:has-text("${tab}")`).first().click({ timeout: 4000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT_DIR}/client-tab-${i + 1}-${tab.replace(/[^a-z]/gi, '').toLowerCase()}.png` });
    console.log(`  ✓ ${tab}`);
  } catch (e) { console.log(`  ✗ ${tab}: ${e.message}`); }
}

await browser.close();
console.log('Done.');
