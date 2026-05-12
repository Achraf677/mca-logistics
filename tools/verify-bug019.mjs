import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots/audit-deep-liv', { recursive: true });

const BASE = 'http://127.0.0.1:5500';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});
await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
}).catch(()=>{});
await page.evaluate(() => document.querySelector('.nav-item[data-page="livraisons"]')?.click());
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const r = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  r?.querySelector('td:nth-child(3)')?.click();
});
await page.waitForTimeout(1200);

const check = await page.evaluate(() => {
  const foot = document.querySelector('#dr-liv-panel .dr-foot');
  const modifierBtn = foot ? Array.from(foot.querySelectorAll('button')).find(b => b.textContent.trim() === 'Modifier') : null;
  const fab = document.getElementById('ai-chat-fab');
  
  if (!modifierBtn || !fab) return { err: 'missing elements' };
  
  const mr = modifierBtn.getBoundingClientRect();
  const fr = fab.getBoundingClientRect();
  
  const overlap = mr.right > fr.left && mr.left < fr.right && mr.bottom > fr.top && mr.top < fr.bottom;
  
  return {
    modifier: { x: Math.round(mr.left), right: Math.round(mr.right), y: Math.round(mr.top), bottom: Math.round(mr.bottom) },
    fab: { x: Math.round(fr.left), right: Math.round(fr.right), y: Math.round(fr.top), bottom: Math.round(fr.bottom) },
    overlap
  };
});

console.log('Overlap check:', JSON.stringify(check, null, 2));
if (check.overlap === false) console.log('✓ BUG-019 FIXED — no overlap');
else if (check.overlap === true) console.log('✗ BUG-019 STILL BROKEN — overlap detected');
else console.log('? Error:', check.err);

// Footer screenshot
await page.screenshot({
  path: 'screenshots/audit-deep-liv/bug019-after-fix.png',
  clip: { x: 880, y: 820, width: 560, height: 80 }
});

await browser.close();
