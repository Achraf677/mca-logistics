import { chromium } from '@playwright/test';
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
});

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

// Dismiss setup wizard
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});
await page.waitForTimeout(500);

// Navigate to livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);

// Check livraisons count
const livCount = await page.evaluate(() => {
  const livs = typeof charger === 'function' ? charger('livraisons') : [];
  return Array.isArray(livs) ? livs.length : 0;
});
console.log('Livraisons in storage:', livCount);

// Check vue-kanban
const kanbanState = await page.evaluate(() => {
  const kanbanDiv = document.getElementById('vue-kanban');
  const board = document.getElementById('kanban-board');
  return {
    kanbanDivExists: !!kanbanDiv,
    kanbanDivDisplay: kanbanDiv ? window.getComputedStyle(kanbanDiv).display : 'N/A',
    boardExists: !!board,
    boardHTML: board ? board.innerHTML.substring(0, 100) : 'N/A'
  };
});
console.log('Before click:', kanbanState);

// Click kanban button
await page.evaluate(() => {
  if (typeof changerVueLivraisons === 'function') changerVueLivraisons('kanban');
});
await page.waitForTimeout(2000);

// Check after
const kanbanAfter = await page.evaluate(() => {
  const kanbanDiv = document.getElementById('vue-kanban');
  const board = document.getElementById('kanban-board');
  const cards = document.querySelectorAll('.kanban-card');
  const cols = document.querySelectorAll('.kanban-col');
  return {
    kanbanDivDisplay: kanbanDiv ? window.getComputedStyle(kanbanDiv).display : 'N/A',
    boardHTML: board ? board.innerHTML.substring(0, 500) : 'N/A',
    cards: cards.length,
    cols: cols.length
  };
});
console.log('After changerVueLivraisons("kanban"):', JSON.stringify(kanbanAfter, null, 2));

await page.screenshot({ path: 'screenshots/2026-05-12/hunt/kanban-test.png' });
await browser.close();
