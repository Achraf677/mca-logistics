import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/audit-livraisons-full';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/previews/livraisons.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/MOCKUP-full.png`, fullPage: false });
await page.screenshot({ path: `${OUT}/MOCKUP-section-head.png`, clip: { x: 236, y: 60, width: 1204, height: 120 } });
await page.screenshot({ path: `${OUT}/MOCKUP-toolbar.png`, clip: { x: 236, y: 180, width: 1204, height: 100 } });
await page.screenshot({ path: `${OUT}/MOCKUP-table.png`, clip: { x: 236, y: 275, width: 1204, height: 400 } });
console.log('Mockup screenshots done');

await browser.close();
