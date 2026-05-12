import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5500';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
});
await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
});
// Find all fixed elements in bottom-right area
const fixed = await page.evaluate(() => {
  const all = document.querySelectorAll('*');
  const results = [];
  for (const el of all) {
    const s = window.getComputedStyle(el);
    if (s.position === 'fixed') {
      const r = el.getBoundingClientRect();
      if (r.bottom > 600 && r.right > 1200) {
        results.push({
          tag: el.tagName,
          id: el.id,
          cls: el.className.substring(0, 50),
          text: el.textContent.trim().substring(0, 30),
          bottom: Math.round(r.bottom),
          right: Math.round(r.right),
          w: Math.round(r.width),
          h: Math.round(r.height),
          zIndex: s.zIndex,
          display: s.display
        });
      }
    }
  }
  return results;
});
console.log('Fixed bottom-right elements:', JSON.stringify(fixed, null, 2));
await browser.close();
