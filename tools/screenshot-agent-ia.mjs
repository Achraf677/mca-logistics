// Open and screenshot the Agent IA panel.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const secrets = Object.fromEntries(
  readFileSync('.local-secrets', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BASE = 'https://claude-admin-emoji-cleanup.mca-logistics.pages.dev';
const OUT_DIR = 'screenshots/admin-agent-ia';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
await page.fill('#login-identifiant', secrets.PLAYWRIGHT_ADMIN_EMAIL);
await page.fill('#login-password', secrets.PLAYWRIGHT_ADMIN_PASSWORD);
await page.click('#login-submit');
await page.waitForURL(/\/admin/, { timeout: 15000 });
await page.waitForTimeout(2000);
try { await page.locator('text=Plus tard').first().click({ timeout: 2000 }); } catch {}
await page.waitForTimeout(800);

console.log('[1/2] Click Agent IA topbar pill');
try {
  await page.locator('#ai-status-bar').first().click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT_DIR}/01-agent-ia-panel.png` });
  console.log('  ✓');
} catch (e) { console.log('  ✗', e.message); }

console.log('[2/2] Click bottom-right FAB (sparkle orb)');
try {
  await page.keyboard.press('Escape'); // close panel
  await page.waitForTimeout(500);
  await page.locator('.fab-chatbot, #btn-chatbot-fab, button[title*="chat" i]').first().click({ timeout: 4000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT_DIR}/02-chatbot-fab.png` });
  console.log('  ✓');
} catch (e) { console.log('  ✗', e.message); }

await browser.close();
console.log('Done.');
