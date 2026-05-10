// Capture screenshots de toutes les previews pour audit visuel.
// Usage: npx playwright install chromium (une fois) puis node tools/preview-screenshots.mjs

import { chromium } from 'playwright';
import { readdirSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const previewsDir = resolve('previews');
const outDir = resolve('previews/_screenshots');
mkdirSync(outDir, { recursive: true });

const files = readdirSync(previewsDir).filter(f => f.endsWith('.html'));
console.log(`Capturing ${files.length} previews → ${outDir}\n`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

for (const f of files) {
  const page = await ctx.newPage();
  const url = 'file:///' + join(previewsDir, f).replace(/\\/g, '/');
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(800); // let Chart.js render
    const screenshotPath = join(outDir, f.replace('.html', '.png'));
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ ${f}`);
  } catch (e) {
    console.log(`  ✗ ${f} : ${e.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log('\n✓ All screenshots captured in', outDir);
