import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-12';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/previews/livraisons.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/mockup-livraisons-full.png`, fullPage: false });
console.log('✓ mockup-livraisons-full.png');

// Modal if exists
const modal = await page.evaluate(() => {
  const modals = document.querySelectorAll('[class*="modal"], .modal');
  return modals.length;
});
console.log('Modals in mockup:', modal);

// Table
await page.screenshot({ path: `${OUT}/mockup-livraisons-table.png`, fullPage: false });

await browser.close();
