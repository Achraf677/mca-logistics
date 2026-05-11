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
await page.goto('http://127.0.0.1:5500/admin.html?reseed=1');
await page.waitForTimeout(5000);
await page.evaluate(() => { if (window.MCASetup?.later) window.MCASetup.later(); });
await page.evaluate(() => { const i = document.querySelector('.nav-item[data-page="livraisons"]'); if (i) i.click(); });
await page.waitForTimeout(2000);
const firstRowHTML = await page.evaluate(() => {
  const tr = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  if (!tr) return 'NO ROW';
  return Array.from(tr.querySelectorAll('td')).map((td, i) => `[${i}] ${td.outerHTML.slice(0, 300)}`).join('\n---\n');
});
console.log(firstRowHTML);
await browser.close();
