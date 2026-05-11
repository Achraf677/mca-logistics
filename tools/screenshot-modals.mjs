// Open + screenshot key admin modals/drawers for visual audit.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const secrets = Object.fromEntries(
  readFileSync('.local-secrets', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BASE = 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = 'screenshots/admin-modals';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
await page.fill('#login-identifiant', secrets.PLAYWRIGHT_ADMIN_EMAIL);
await page.fill('#login-password', secrets.PLAYWRIGHT_ADMIN_PASSWORD);
await page.click('#login-submit');
await page.waitForURL(/\/admin/, { timeout: 15000 });
await page.waitForTimeout(1500);

// Dismiss wizard
try { await page.locator('text=Plus tard').first().click({ timeout: 2000 }); } catch {}
await page.waitForTimeout(500);

// === MODAL 1 : Nouvelle livraison ===
console.log('[1/5] Nouvelle livraison...');
await page.evaluate(() => window.naviguerVers('livraisons'));
await page.waitForTimeout(700);
try {
  await page.locator('button:has-text("Nouvelle livraison")').first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/01-modal-nouvelle-livraison.png` });
  console.log('  ✓ captured');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} catch (e) { console.log('  ✗', e.message); }

// === MODAL 2 : Nouveau client ===
console.log('[2/5] Nouveau client...');
await page.evaluate(() => window.naviguerVers('clients'));
await page.waitForTimeout(700);
try {
  await page.locator('button:has-text("Nouveau client")').first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/02-modal-nouveau-client.png` });
  console.log('  ✓ captured');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} catch (e) { console.log('  ✗', e.message); }

// === MODAL 3 : Nouveau véhicule ===
console.log('[3/5] Nouveau véhicule...');
await page.evaluate(() => window.naviguerVers('vehicules'));
await page.waitForTimeout(700);
try {
  await page.locator('button:has-text("Ajouter")').first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/03-modal-nouveau-vehicule.png` });
  console.log('  ✓ captured');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} catch (e) { console.log('  ✗', e.message); }

// === MODAL 4 : Nouvelle charge ===
console.log('[4/5] Nouvelle charge...');
await page.evaluate(() => window.naviguerVers('charges'));
await page.waitForTimeout(700);
try {
  await page.locator('button:has-text("Nouvelle charge")').first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/04-modal-nouvelle-charge.png` });
  console.log('  ✓ captured');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} catch (e) { console.log('  ✗', e.message); }

// === MODAL 5 : Recherche globale (Ctrl+K) ===
console.log('[5/5] Recherche globale...');
await page.evaluate(() => window.naviguerVers('dashboard'));
await page.waitForTimeout(700);
try {
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/05-modal-recherche-globale.png` });
  console.log('  ✓ captured');
} catch (e) { console.log('  ✗', e.message); }

await browser.close();
console.log('Done.');
