// Screenshot local preview HTML files (mockups) for side-by-side comparison with prod.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = 'screenshots/previews';
mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  'dashboard', 'livraisons', 'planning', 'alertes',
  'clients', 'fournisseurs', 'vehicules', 'carburant',
  'entretiens', 'inspections', 'equipe', 'heures',
  'incidents', 'charges', 'rentabilite', 'encaissement',
  'tva', 'statistiques', 'calendrier', 'parametres',
  'brouillons-ia',
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

for (const slug of PAGES) {
  const file = resolve('previews', `${slug}.html`);
  const url = 'file:///' + file.replace(/\\/g, '/');
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/${slug}.png`, fullPage: false });
    console.log(`  ✓ ${slug}`);
  } catch (e) { console.log(`  ✗ ${slug}: ${e.message}`); }
}

await browser.close();
console.log('Done.');
