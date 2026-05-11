import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});
await page.goto('http://127.0.0.1:5500/admin.html?seed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.evaluate(() => { if (window.MCASetup?.later) window.MCASetup.later(); });
await page.waitForTimeout(800);

const containers = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('body, main, #mainContent, .main, .main-content, #page-dashboard, .content-wrap').forEach(el => {
    const cs = getComputedStyle(el);
    results.push({
      tag: el.tagName,
      id: el.id || '',
      className: (el.className || '').toString().slice(0, 50),
      overflowY: cs.overflowY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      canScroll: el.scrollHeight > el.clientHeight && ['auto','scroll'].includes(cs.overflowY),
    });
  });
  return results;
});
console.log(JSON.stringify(containers, null, 2));
await browser.close();
