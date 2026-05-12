import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});
await page.goto('http://127.0.0.1:5500/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  var w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
});
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const page = document.getElementById('page-livraisons');
  const allTr = document.querySelectorAll('.title-row');
  const activePage = document.querySelector('.page.active');
  
  // Find the computed style for title-row in livraisons
  const livTitleRow = page?.querySelector('.title-row');
  
  // Find all CSS rules mentioning title-row  
  const sheets = Array.from(document.styleSheets);
  let titleRowRules = [];
  for (const sheet of sheets) {
    try {
      const rules = Array.from(sheet.cssRules || []);
      for (const rule of rules) {
        if (rule.selectorText && rule.selectorText.includes('title-row')) {
          titleRowRules.push({ sel: rule.selectorText, display: rule.style.display || '(none set)', href: sheet.href?.split('/').pop()?.split('?')[0] });
        }
      }
    } catch(e) {}
  }
  
  return {
    pageFound: !!page,
    activePage: activePage?.id,
    allTitleRows: allTr.length,
    livTitleRowFound: !!livTitleRow,
    livTitleRowDisplay: livTitleRow ? window.getComputedStyle(livTitleRow).display : null,
    titleRowRules: titleRowRules.filter(r => r.display && r.display !== '(none set)')
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
