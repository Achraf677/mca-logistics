// Capture screenshots avec tous les sous-onglets.
// Run: node tools/preview-screenshots-all.mjs

import { chromium } from 'playwright';
import { readdirSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const previewsDir = resolve('previews');
const outDir = resolve('previews/_screenshots');
mkdirSync(outDir, { recursive: true });

// Pages avec sous-onglets et leurs sélecteurs/IDs
const SUBTABS = {
  'rentabilite.html': {
    tabSelector: '.rent-tab-btn',
    tabs: ['vehicule', 'client', 'chauffeur', 'tournee', 'simulateur'],
    attr: 'data-rent-tab',
  },
  'equipe.html': {
    tabSelector: '.tab-btn',
    tabs: ['overview', 'liste', 'espace'],
    attr: 'data-tab',
  },
  'tva.html': {
    tabSelector: '.tva-tab-btn',
    tabs: ['collectee', 'deductible'],
    attr: 'data-tva-tab',
  },
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

const files = readdirSync(previewsDir).filter(f => f.endsWith('.html'));
console.log(`Capturing ${files.length} previews + sub-tabs → ${outDir}\n`);

for (const f of files) {
  const page = await ctx.newPage();
  const url = 'file:///' + join(previewsDir, f).replace(/\\/g, '/');
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Capture default state
    const defaultPath = join(outDir, f.replace('.html', '.png'));
    await page.screenshot({ path: defaultPath, fullPage: true });
    console.log(`  ✓ ${f}`);

    // Capture sub-tabs si la page en a
    if (SUBTABS[f]) {
      const cfg = SUBTABS[f];
      for (const tabId of cfg.tabs) {
        try {
          await page.click(`${cfg.tabSelector}[${cfg.attr}="${tabId}"]`);
          await page.waitForTimeout(600);
          const tabPath = join(outDir, f.replace('.html', `__${tabId}.png`));
          await page.screenshot({ path: tabPath, fullPage: true });
          console.log(`    ↳ tab '${tabId}'`);
        } catch (e) {
          console.log(`    ✗ tab '${tabId}' : ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log(`  ✗ ${f} : ${e.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log('\n✓ All screenshots + sub-tabs captured');
