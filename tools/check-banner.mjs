import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_nom', 'Achraf Chikri');
  sessionStorage.setItem('role', 'admin');
});

await page.goto('http://127.0.0.1:5500/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
});
await page.waitForTimeout(500);

await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(3000);

const banner = await page.evaluate(() => {
  const titleRow = document.querySelector('#page-livraisons .title-row');
  if (!titleRow) return { found: false };
  const rect = titleRow.getBoundingClientRect();
  return {
    found: true,
    visible: rect.height > 0,
    rect: { top: rect.top, height: rect.height, width: rect.width },
    text: titleRow.textContent.replace(/\s+/g, ' ').trim(),
    html: titleRow.outerHTML.slice(0, 500),
  };
});

const sfWho = await page.evaluate(() => {
  const w = document.getElementById('sf-who');
  const av = document.getElementById('sf-avatar');
  return {
    sf_who_text: w?.textContent,
    sf_av_text: av?.textContent,
  };
});

console.log(JSON.stringify({ banner, sfWho }, null, 2));

await browser.close();
