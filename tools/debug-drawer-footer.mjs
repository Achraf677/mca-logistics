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
  sessionStorage.setItem('fast_boot_role', 'admin');
});
await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.evaluate(() => {
  try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
}).catch(()=>{});
await page.evaluate(() => document.querySelector('.nav-item[data-page="livraisons"]')?.click());
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const r = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  r?.querySelector('td:nth-child(3)')?.click();
});
await page.waitForTimeout(1200);

const info = await page.evaluate(() => {
  // Drawer footer buttons
  const foot = document.querySelector('#dr-liv-panel .dr-foot');
  const btns = foot ? Array.from(foot.querySelectorAll('button')).map(b => {
    const r = b.getBoundingClientRect();
    return { text: b.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), right: Math.round(r.right) };
  }) : [];
  
  // FAB button
  const fab = document.querySelector('.ai-fab, .chat-fab, [class*="fab"], .mca-fab, .ai-chat-fab');
  const fabRect = fab ? fab.getBoundingClientRect() : null;
  const fabInfo = fabRect ? {
    cls: fab.className.substring(0,60), x: Math.round(fabRect.left), y: Math.round(fabRect.top), w: Math.round(fabRect.width), h: Math.round(fabRect.height)
  } : null;
  
  // Viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  return { btns, fab: fabInfo, vw, vh };
});
console.log('Drawer buttons:', JSON.stringify(info.btns, null, 2));
console.log('FAB:', JSON.stringify(info.fab));
console.log('Viewport:', info.vw, 'x', info.vh);

// Check overlap
if (info.fab && info.btns.length) {
  const fab = info.fab;
  info.btns.forEach(btn => {
    const overlap = btn.right > fab.x && btn.x < fab.x + fab.w;
    if (overlap) console.log(`⚠️ FAB overlaps "${btn.text}" button! btn.right=${btn.right} fab.x=${fab.x}`);
    else console.log(`✓ "${btn.text}" btn.right=${btn.right} vs fab.x=${fab.x} — OK`);
  });
}

await browser.close();
