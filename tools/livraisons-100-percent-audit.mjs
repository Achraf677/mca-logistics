// Audit ciblé Livraisons 98% → 100% : identifie les derniers deltas vs mockup
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT = 'screenshots/2026-05-12/100-percent';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const mockCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const [page, mock] = await Promise.all([ctx.newPage(), mockCtx.newPage()]);

await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('role', 'admin');
});

await Promise.all([
  page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' }),
  mock.goto(BASE + '/previews/livraisons.html', { waitUntil: 'domcontentloaded' })
]);
await Promise.all([page.waitForTimeout(5000), mock.waitForTimeout(2000)]);

await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'));

// Screenshots fullPage
await page.screenshot({ path: `${OUT}/prod-full-page.png`, fullPage: true });
await mock.screenshot({ path: `${OUT}/mock-full-page.png`, fullPage: true });

// Bottom of page (pagination?)
const prodFooter = await page.evaluate(() => {
  const pag = document.querySelector('#page-livraisons .pagination, #page-livraisons .table-foot, #page-livraisons .liv-footer, #page-livraisons [class*=pagination]');
  return pag ? { found: true, html: pag.outerHTML.slice(0, 500) } : { found: false };
});
const mockFooter = await mock.evaluate(() => {
  const pag = document.querySelector('.pagination, .table-foot, .liv-footer, [class*=pagination]');
  return pag ? { found: true, html: pag.outerHTML.slice(0, 500) } : { found: false };
});

// Sidebar avatar admin
const prodSidebarBottom = await page.evaluate(() => {
  const s = document.querySelector('.sidebar');
  if (!s) return { found: false };
  const last = s.lastElementChild;
  return { found: true, lastClass: last?.className, lastHTML: last?.outerHTML.slice(0, 300) };
});
const mockSidebarBottom = await mock.evaluate(() => {
  const s = document.querySelector('.sidebar');
  if (!s) return { found: false };
  const last = s.lastElementChild;
  return { found: true, lastClass: last?.className, lastHTML: last?.outerHTML.slice(0, 300) };
});

// Section head subtitle
const prodSub = await page.evaluate(() => {
  const sh = document.querySelector('#page-livraisons .section-head .section-head-sub, #page-livraisons .section-head p, #page-livraisons .section-sub');
  return sh ? sh.textContent.trim() : null;
});
const mockSub = await mock.evaluate(() => {
  const sh = document.querySelector('.section-head .section-head-sub, .section-head p, .section-sub');
  return sh ? sh.textContent.trim() : null;
});

// Header banner ("N ce mois · N retards à traiter")
const prodBanner = await page.evaluate(() => {
  const b = document.querySelector('#page-livraisons .title-row, #page-livraisons .title-meta, #page-livraisons .page-banner, #page-livraisons .meta-banner');
  return b ? { found: true, text: b.textContent.trim().slice(0, 150) } : { found: false };
});
const mockBanner = await mock.evaluate(() => {
  const b = document.querySelector('.title-row, .title-meta, .page-banner, .meta-banner');
  return b ? { found: true, text: b.textContent.trim().slice(0, 150) } : { found: false };
});

// Hauteur du contenu pour comparaison aérée
const prodTableHeights = await page.evaluate(() => {
  const rows = document.querySelectorAll('#tb-livraisons tr');
  const heights = Array.from(rows).slice(0, 5).map(r => r.getBoundingClientRect().height);
  return { rowCount: rows.length, sample: heights };
});
const mockTableHeights = await mock.evaluate(() => {
  const rows = document.querySelectorAll('table tbody tr');
  const heights = Array.from(rows).slice(0, 5).map(r => r.getBoundingClientRect().height);
  return { rowCount: rows.length, sample: heights };
});

const report = {
  prod_footer: prodFooter,
  mock_footer: mockFooter,
  prod_sidebar_bottom: prodSidebarBottom,
  mock_sidebar_bottom: mockSidebarBottom,
  prod_section_sub: prodSub,
  mock_section_sub: mockSub,
  prod_banner: prodBanner,
  mock_banner: mockBanner,
  prod_table: prodTableHeights,
  mock_table: mockTableHeights,
};

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
