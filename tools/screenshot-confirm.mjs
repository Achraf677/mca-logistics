// Trigger and screenshot a confirmDialog from the app.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const secrets = Object.fromEntries(
  readFileSync('.local-secrets', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BASE = 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = 'screenshots/admin-confirm';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
await page.fill('#login-identifiant', secrets.PLAYWRIGHT_ADMIN_EMAIL);
await page.fill('#login-password', secrets.PLAYWRIGHT_ADMIN_PASSWORD);
await page.click('#login-submit');
await page.waitForURL(/\/admin/, { timeout: 15000 });
await page.waitForTimeout(2500);
try { await page.locator('text=Plus tard').first().click({ timeout: 2000 }); } catch {}
await page.waitForTimeout(800);

// Déclenche un confirmDialog programmatiquement (ne valide ni n'annule)
console.log('[confirm dialog] triggering...');
await page.evaluate(() => {
  if (typeof window.confirmDialog === 'function') {
    window.confirmDialog({
      title: 'Supprimer ce client ?',
      message: 'Cette action est irréversible. Toutes les livraisons associées seront orphelines.',
      confirmLabel: 'Supprimer définitivement',
      cancelLabel: 'Annuler',
      danger: true
    });
  }
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT_DIR}/01-confirm-dialog.png` });
console.log('  ✓');

await browser.close();
console.log('Done.');
