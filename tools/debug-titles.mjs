// Debug section titles tronqués
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
await page.waitForTimeout(4500);
await page.evaluate(() => { if (window.MCASetup?.later) window.MCASetup.later(); });
await page.evaluate(() => { const i = document.querySelector('.nav-item[data-page="livraisons"]'); if (i) i.click(); });
await page.waitForTimeout(1500);
await page.evaluate(() => { if (window.openModal) window.openModal('modal-livraison'); });
await page.waitForTimeout(800);

const debug = await page.evaluate(() => {
  const title = document.querySelector('#modal-livraison .fp-section-title');
  if (!title) return null;
  // Trace parents from h4 up to modal
  const chain = [];
  let el = title;
  while (el && el.id !== 'modal-livraison') {
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName,
      id: el.id,
      classes: (el.className || '').toString().slice(0, 80),
      width: rect.width,
      left: rect.left,
      paddingLeft: cs.paddingLeft,
      marginLeft: cs.marginLeft,
      overflow: cs.overflow,
      overflowX: cs.overflowX,
      position: cs.position,
      transform: cs.transform,
      clipPath: cs.clipPath,
      maskImage: cs.maskImage,
    });
    el = el.parentElement;
  }
  return chain;
});
console.log(JSON.stringify(debug, null, 2));
await browser.close();
