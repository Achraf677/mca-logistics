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

// Open drawer
await page.evaluate(() => {
  const firstRow = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  const cell = firstRow?.querySelector('td:nth-child(3)');
  if (cell) cell.click();
});
await page.waitForTimeout(1200);

// Drawer footer screenshot
const drawerRect = await page.evaluate(() => {
  const p = document.getElementById('dr-liv-panel');
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
console.log('Drawer rect:', drawerRect);

if (drawerRect) {
  // Full drawer
  await page.screenshot({ 
    path: 'screenshots/audit-deep-liv/drawer-full.png',
    clip: { x: drawerRect.x, y: drawerRect.y, width: drawerRect.w, height: drawerRect.h }
  });
  
  // Footer only (bottom 80px)
  await page.screenshot({ 
    path: 'screenshots/audit-deep-liv/drawer-footer.png',
    clip: { x: drawerRect.x, y: drawerRect.y + drawerRect.h - 80, width: drawerRect.w, height: 80 }
  });
  
  // Inspect footer buttons
  const footerInfo = await page.evaluate(() => {
    const footer = document.querySelector('#dr-liv-panel .dr-footer, #dr-liv-panel .drawer-footer, #dr-liv-panel footer');
    if (!footer) {
      // Try to find by position (last child of panel)
      const panel = document.getElementById('dr-liv-panel');
      const lastChild = panel?.lastElementChild;
      return { found: false, lastChildCls: lastChild?.className };
    }
    const btns = Array.from(footer.querySelectorAll('button, a')).map(b => {
      const r = b.getBoundingClientRect();
      return { text: b.textContent.trim(), w: Math.round(r.width), visible: r.width > 0 && r.height > 0 };
    });
    const r = footer.getBoundingClientRect();
    return { found: true, h: Math.round(r.h), btns, cls: footer.className };
  });
  console.log('Footer info:', JSON.stringify(footerInfo, null, 2));
}

// Also check chips row layout
await page.evaluate(() => {
  const panel = document.getElementById('dr-liv-panel');
  if (panel) panel.classList.remove('open');
}).catch(()=>{});
await page.waitForTimeout(400);

// Chips row screenshot
await page.screenshot({
  path: 'screenshots/audit-deep-liv/chips-row.png',
  clip: { x: 60, y: 105, width: 1380, height: 60 }
});

// Period + view toggle row
await page.screenshot({
  path: 'screenshots/audit-deep-liv/period-view-row.png', 
  clip: { x: 60, y: 60, width: 1380, height: 115 }
});

await browser.close();
