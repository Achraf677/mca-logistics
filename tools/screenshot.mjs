// Take screenshots of prod preview pages for visual comparison.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = process.env.OUT_DIR || 'screenshots';
const VIEWPORT = process.env.VIEWPORT || 'pc';

const VIEWPORTS = {
  pc:     { width: 1440, height: 900 },
  mobile: { width: 390,  height: 844 },
};

const PAGES = [
  { name: 'admin-dashboard', path: '/admin.html' },
  { name: 'mobile-home',     path: '/m.html' },
  { name: 'salarie',         path: '/salarie.html' },
  { name: 'login',           path: '/login.html' },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORTS[VIEWPORT] });
const page = await ctx.newPage();

for (const { name, path } of PAGES) {
  const url = BASE + path;
  console.log(`[${VIEWPORT}] ${url}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    const file = `${OUT_DIR}/${name}-${VIEWPORT}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ✓ ${file}`);
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
}

await browser.close();
