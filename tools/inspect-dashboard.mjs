// Inspect dashboard layout to find what's below the fold
import { chromium } from '@playwright/test';

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

await page.goto('http://127.0.0.1:5500/admin.html?seed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  if (window.MCASetup?.later) window.MCASetup.later();
  if (typeof window.naviguerVers === 'function') window.naviguerVers('dashboard');
});
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const dashboard = document.getElementById('page-dashboard');
  if (!dashboard) return { error: 'no #page-dashboard' };
  const children = Array.from(dashboard.children).map(c => ({
    tag: c.tagName,
    id: c.id || '',
    className: (c.className || '').toString().slice(0, 80),
    display: getComputedStyle(c).display,
    visible: c.offsetHeight > 0 && getComputedStyle(c).visibility !== 'hidden',
    height: c.offsetHeight,
    y: c.getBoundingClientRect().top + window.scrollY,
  }));
  return {
    dashboardActive: dashboard.classList.contains('active'),
    dashboardHeight: dashboard.offsetHeight,
    bodyHeight: document.body.offsetHeight,
    children,
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
