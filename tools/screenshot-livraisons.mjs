// Screenshot livraisons page locale
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/local';
mkdirSync(OUT_DIR, { recursive: true });

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
// Wait reseed cycle complet (clear + ?seed=1 + final reload)
await page.waitForTimeout(5000);

// Helper qui ferme wizard + toasts (à appeler après chaque action qui pourrait les ramener)
const cleanUI = async () => {
  await page.evaluate(() => {
    try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
    var w = document.getElementById('mca-setup-wizard');
    if (w) { w.classList.remove('active'); w.style.display = 'none'; }
    document.querySelectorAll('.toast, [class*="toast"], .mca-toast').forEach(el => el.style.display = 'none');
  }).catch(() => {});
};
await cleanUI();
await page.waitForTimeout(500);

// Navigate to livraisons - try multiple methods
async function goLivraisons() {
  // Method 1 : click nav-item
  const clicked = await page.evaluate(() => {
    const item = document.querySelector('.nav-item[data-page="livraisons"]');
    if (item) { item.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1500);
  if (!clicked) {
    // Method 2 : naviguerVers
    await page.evaluate(() => {
      if (typeof window.naviguerVers === 'function') window.naviguerVers('livraisons');
    });
    await page.waitForTimeout(1500);
  }
  // Method 3 : manual class toggle
  await page.evaluate(() => {
    document.querySelectorAll('section.page').forEach(s => s.classList.remove('active'));
    const liv = document.getElementById('page-livraisons');
    if (liv) liv.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector('.nav-item[data-page="livraisons"]');
    if (navItem) navItem.classList.add('active');
  });
  await page.waitForTimeout(500);
}
await goLivraisons();
await cleanUI();

// Top view 1440x900 - Tableau
await page.screenshot({ path: `${OUT_DIR}/02a-livraisons-tableau.png`, fullPage: false });
console.log('  ✓ tableau top →', `${OUT_DIR}/02a-livraisons-tableau.png`);

// S'assurer qu'on est bien sur livraisons avant de switcher de vue
await goLivraisons();
await cleanUI();

// Switch to Kanban
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('kanban');
});
await page.waitForTimeout(1500);
await cleanUI();
await page.screenshot({ path: `${OUT_DIR}/02b-livraisons-kanban.png`, fullPage: false });
console.log('  ✓ kanban →', `${OUT_DIR}/02b-livraisons-kanban.png`);

// Switch to Calendrier
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('calendrier');
});
await page.waitForTimeout(1500);
await cleanUI();
await page.screenshot({ path: `${OUT_DIR}/02c-livraisons-calendrier.png`, fullPage: false });
console.log('  ✓ calendrier →', `${OUT_DIR}/02c-livraisons-calendrier.png`);

// Back to Tableau + full page
await page.evaluate(() => {
  if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons('tableau');
});
await page.waitForTimeout(1000);

// Full page
await page.evaluate(() => {
  const mc = document.getElementById('mainContent');
  if (mc) { mc.style.overflow = 'visible'; mc.style.height = 'auto'; }
  document.body.style.overflow = 'visible';
  document.body.style.height = 'auto';
});
const livraisonsHeight = await page.evaluate(() => {
  const d = document.getElementById('page-livraisons');
  return d ? d.scrollHeight + 200 : 1800;
});
await page.setViewportSize({ width: 1440, height: livraisonsHeight });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/02-livraisons.png`, fullPage: true });
console.log('  ✓ livraisons full →', `${OUT_DIR}/02-livraisons.png`);

await browser.close();
console.log('Done.');
