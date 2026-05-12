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

await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);

// Inspect first row HTML to see what edit mechanism exists
const rowInfo = await page.evaluate(() => {
  const rows = document.querySelectorAll('#tb-livraisons tr:not(.empty-row)');
  if (!rows.length) return { found: false };
  const r = rows[0];
  const id = r.dataset.id;
  const btns = Array.from(r.querySelectorAll('button, a')).map(b => ({
    tag: b.tagName, cls: b.className.substring(0,40), title: b.title, onclick: b.getAttribute('onclick')?.substring(0,60), text: b.textContent.trim().substring(0,20)
  }));
  return { found: true, id, rowHtml: r.outerHTML.substring(0, 500), btns };
});
console.log('Row info:', JSON.stringify(rowInfo, null, 2));

// Try calling ouvrirEditLivraison directly
const callResult = await page.evaluate(() => {
  const rows = document.querySelectorAll('#tb-livraisons tr:not(.empty-row)');
  if (!rows.length) return { err: 'no rows' };
  const id = rows[0].dataset.id;
  if (!id) return { err: 'no data-id' };
  if (typeof window.ouvrirEditLivraison !== 'function') return { err: 'ouvrirEditLivraison not defined', type: typeof window.ouvrirEditLivraison };
  try {
    window.ouvrirEditLivraison(id);
    return { called: true, id };
  } catch(e) {
    return { err: e.message };
  }
});
console.log('Call result:', JSON.stringify(callResult));

await page.waitForTimeout(2000);

const modalState = await page.evaluate(() => {
  const m = document.getElementById('modal-edit-livraison');
  if (!m) return { found: false };
  const cs = window.getComputedStyle(m);
  return {
    found: true,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    zIndex: cs.zIndex,
    classList: [...m.classList],
    style: m.getAttribute('style')?.substring(0, 100)
  };
});
console.log('Modal state:', JSON.stringify(modalState));

// Check openModal
const openModalState = await page.evaluate(() => {
  return {
    openModal: typeof window.openModal,
    closeModal: typeof window.closeModal,
    ouvrirEditLivraison: typeof window.ouvrirEditLivraison
  };
});
console.log('Global functions:', JSON.stringify(openModalState));

await page.screenshot({ path: 'screenshots/audit-deep-liv/debug-edit.png', fullPage: false });

await browser.close();
