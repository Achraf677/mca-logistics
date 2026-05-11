// Inspect-modal : ouvre une modale + screenshot son contenu rendu
// Usage : node tools/inspect-modal.mjs <modal-id>
// Ex : node tools/inspect-modal.mjs modal-livraison
//
// Pour vérifier les bugs visuels DANS une modale (titres tronqués,
// validation prématurée, layout cassé) qui sont invisibles depuis
// la table principale.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/inspect-modal';
mkdirSync(OUT_DIR, { recursive: true });

const modalId = process.argv[2];
if (!modalId) {
  console.error('Usage: node tools/inspect-modal.mjs <modal-id>');
  console.error('Ex: node tools/inspect-modal.mjs modal-livraison');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});

await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);

await page.evaluate(() => {
  if (window.MCASetup?.later) window.MCASetup.later();
});
await page.waitForTimeout(500);

// Navigate to livraisons
await page.evaluate(() => {
  const item = document.querySelector('.nav-item[data-page="livraisons"]');
  if (item) item.click();
});
await page.waitForTimeout(2000);

// Open the modal
const opened = await page.evaluate((mid) => {
  if (typeof window.openModal === 'function') {
    window.openModal(mid);
    return true;
  }
  const m = document.getElementById(mid);
  if (m) {
    m.style.display = 'flex';
    m.classList.add('show', 'active');
    return true;
  }
  return false;
}, modalId);

await page.waitForTimeout(800);
await page.evaluate(() => {
  document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
});

if (!opened) {
  console.error('Modal not found: ' + modalId);
  await browser.close();
  process.exit(1);
}

console.log('Modal opened: ' + modalId);

// Screenshot full + zoom titles
await page.screenshot({ path: `${OUT_DIR}/${modalId}-full.png`, fullPage: false });
console.log('  ✓ Full screenshot → ' + OUT_DIR + '/' + modalId + '-full.png');

// Detect rendered titles + validation msgs
const inspection = await page.evaluate((mid) => {
  const m = document.getElementById(mid);
  if (!m) return null;
  const titles = Array.from(m.querySelectorAll('h2, h3, h4, .fp-section-title, .field-section, .modal-header h3')).map(h => ({
    tag: h.tagName,
    classes: (h.className || '').toString().slice(0, 60),
    text: h.textContent.trim(),
    rect: h.getBoundingClientRect()
  }));
  const errors = Array.from(m.querySelectorAll('.error, .fp-error, [role="alert"], .field-error, .alert-danger')).map(e => ({
    text: e.textContent.trim(),
    visible: window.getComputedStyle(e).display !== 'none'
  }));
  const inputs = Array.from(m.querySelectorAll('input[type="text"], input[type="number"], input[type="date"], input[type="time"], select, textarea')).map(i => ({
    id: i.id,
    type: i.type || i.tagName.toLowerCase(),
    placeholder: i.placeholder,
    required: i.required || i.hasAttribute('required'),
    value: i.value
  }));
  return { titles, errors, inputs };
}, modalId);

console.log('\n=== INSPECTION ===');
console.log('TITLES:');
inspection.titles.forEach(t => {
  const truncated = t.rect.x < 0 || t.rect.right > 1440 ? ' ⚠️ TRUNCATED' : '';
  console.log(`  [${t.tag}.${t.classes}] "${t.text}"${truncated}`);
});

console.log('\nERRORS (msg visible avant interaction):');
if (inspection.errors.length === 0) console.log('  (none — good)');
else inspection.errors.forEach(e => {
  console.log(`  ${e.visible ? '⚠️ VISIBLE' : '(hidden)'} "${e.text}"`);
});

console.log('\nINPUTS:');
inspection.inputs.forEach(i => {
  console.log(`  #${i.id} (${i.type}) required=${i.required} placeholder="${i.placeholder}" value="${i.value}"`);
});

console.log('\nCONSOLE ERRORS:');
if (consoleErrors.length === 0) console.log('  (none)');
else consoleErrors.slice(0, 5).forEach(e => console.log('  ' + e.slice(0, 200)));

await browser.close();
