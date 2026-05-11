// Authenticated screenshot tool — login admin then snap each page.
// Reads credentials from .local-secrets (gitignored).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

// Parse .local-secrets
const secrets = Object.fromEntries(
  readFileSync('.local-secrets', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const BASE = process.env.BASE_URL || 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = process.env.OUT_DIR || 'screenshots/admin-auth';
const VIEWPORT = process.env.VIEWPORT || 'pc';
const VIEWPORTS = {
  pc:     { width: 1440, height: 900 },
  mobile: { width: 390,  height: 844 },
};

const PAGES = [
  'dashboard', 'livraisons', 'planning', 'alertes',
  'clients', 'fournisseurs', 'vehicules', 'carburant',
  'entretiens', 'inspections', 'salaries', 'heures',
  'incidents', 'charges', 'rentabilite', 'encaissement',
  'tva', 'stats', 'calendrier', 'parametres',
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORTS[VIEWPORT] });
const page = await ctx.newPage();

// Step 1 — Login
console.log('[auth] navigating to login...');
await page.goto(BASE + '/login.html', { waitUntil: 'networkidle', timeout: 20000 });
await page.fill('#login-identifiant', secrets.PLAYWRIGHT_ADMIN_EMAIL);
await page.fill('#login-password', secrets.PLAYWRIGHT_ADMIN_PASSWORD);
await page.click('#login-submit');

// Wait for redirect to admin
try {
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  console.log('[auth] ✓ redirected to ' + page.url());
} catch (e) {
  console.log('[auth] ✗ no redirect after 15s. Current URL: ' + page.url());
  const err = await page.locator('.error, .auth-error, [role="alert"]').first().textContent().catch(() => '');
  if (err) console.log('[auth] error visible: ' + err);
  await page.screenshot({ path: `${OUT_DIR}/_login-fail.png` });
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1500); // let app boot

// Step 1.5 — Dismiss setup wizard if present (first-login modal)
const wizardClose = page.locator('#setup-wizard-modal .modal-close, [aria-label="Fermer"]').first();
try {
  if (await wizardClose.isVisible({ timeout: 2000 })) {
    await wizardClose.click();
    console.log('[setup] wizard dismissed');
    await page.waitForTimeout(500);
  }
} catch {}
// Also try "Tout configurer après" link if present
try {
  const skip = page.locator('text=/Tout configurer après|Plus tard/').first();
  if (await skip.isVisible({ timeout: 1000 })) {
    await skip.click();
    console.log('[setup] wizard skipped via "Plus tard"');
    await page.waitForTimeout(500);
  }
} catch {}
// Force close any open modal via ESC as fallback
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Step 2 — Snapshot each section
let ok = 0;
for (const slug of PAGES) {
  try {
    await page.evaluate(s => window.naviguerVers && window.naviguerVers(s), slug);
    await page.waitForTimeout(900);
    const file = `${OUT_DIR}/${String(ok + 1).padStart(2, '0')}-${slug}-${VIEWPORT}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ✓ ${slug.padEnd(15)} → ${file}`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${slug}: ${e.message}`);
  }
}

console.log(`\n${ok}/${PAGES.length} pages captured.`);
await browser.close();
