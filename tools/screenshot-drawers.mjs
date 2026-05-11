// Open and screenshot side drawers (vehicle/salarie/client 360° views).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const secrets = Object.fromEntries(
  readFileSync('.local-secrets', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BASE = 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = 'screenshots/admin-drawers';
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
try { await page.locator('text=Plus tard').first().click({ timeout: 2000 }); } catch {}
await page.waitForTimeout(500);

async function captureDrawer(slug, fnName, label, file) {
  console.log(`[${label}]`);
  await page.evaluate(s => window.naviguerVers(s), slug);
  await page.waitForTimeout(900);
  try {
    // Récupère le 1er id depuis le store
    const id = await page.evaluate((store) => {
      const arr = window.charger ? window.charger(store) : [];
      return arr && arr[0] && arr[0].id;
    }, slug === 'salaries' ? 'salaries' : slug === 'clients' ? 'clients' : slug === 'fournisseurs' ? 'fournisseurs' : 'vehicules');
    if (!id) { console.log('  ✗ no entity in store'); return; }
    await page.evaluate(({ fn, id }) => window[fn] && window[fn](id), { fn: fnName, id });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT_DIR}/${file}` });
    console.log(`  ✓ captured (id=${id})`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) { console.log('  ✗', e.message); }
}

await captureDrawer('vehicules',   'ouvrirFiche360Vehicule',    '1/4 Drawer véhicule',    '01-drawer-vehicule.png');
await captureDrawer('salaries',    'ouvrirFiche360Salarie',     '2/4 Drawer salarié',     '02-drawer-salarie.png');
await captureDrawer('clients',     'ouvrirFiche360Client',      '3/4 Drawer client',      '03-drawer-client.png');
await captureDrawer('fournisseurs','ouvrirFiche360Fournisseur', '4/4 Drawer fournisseur', '04-drawer-fournisseur.png');

await browser.close();
console.log('Done.');
