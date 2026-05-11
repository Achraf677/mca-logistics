// Audit avec saisie réelle de données via le form (Principe #10)
// Crée une livraison via modal Nouvelle, save, relit, screenshot étapes
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/audit-fill-form';
mkdirSync(OUT_DIR, { recursive: true });

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

// Note : NO reseed - on commence vide pour tester création
await page.goto(BASE + '/admin.html?reset=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
await page.evaluate(() => { if (window.MCASetup?.later) window.MCASetup.later(); });
await page.evaluate(() => { const i = document.querySelector('.nav-item[data-page="livraisons"]'); if (i) i.click(); });
await page.waitForTimeout(2000);

console.log('=== AUDIT CREATION LIVRAISON via FORM ===\n');

// 1. Screenshot empty state
await page.screenshot({ path: `${OUT_DIR}/01-empty-state.png`, fullPage: false });
console.log('✓ Empty state captured');

// 2. Open modal Nouvelle livraison
await page.evaluate(() => { if (window.openModal) window.openModal('modal-livraison'); });
await page.waitForTimeout(1000);
await page.evaluate(() => { document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'); });
await page.screenshot({ path: `${OUT_DIR}/02-modal-empty.png`, fullPage: false });
console.log('✓ Modal opened (empty)');

// 3. Check that NO validation error visible at open (BUG-002)
const errorsAtOpen = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return [];
  return Array.from(m.querySelectorAll('.field-error-slot, .fp-hint-err, .error, [role="alert"]'))
    .filter(e => window.getComputedStyle(e).display !== 'none' && e.textContent.trim())
    .map(e => e.textContent.trim());
});
console.log(errorsAtOpen.length === 0 ? '✓ BUG-002 : aucune erreur à l\'ouverture' : '✗ BUG-002 : erreurs présentes : ' + JSON.stringify(errorsAtOpen));

// 4. Check section titles content
const titles = await page.evaluate(() => {
  const m = document.getElementById('modal-livraison');
  if (!m) return [];
  return Array.from(m.querySelectorAll('.fp-section-title')).map(t => ({
    text: t.textContent.trim(),
    rectLeft: t.getBoundingClientRect().left,
    rectWidth: t.getBoundingClientRect().width,
  }));
});
console.log('Titles dans modal :');
titles.forEach(t => console.log(`  "${t.text}" (left=${t.rectLeft.toFixed(0)} width=${t.rectWidth.toFixed(0)})`));

// 5. Fill form
console.log('\nRemplissage form...');
await page.fill('#liv-client', 'Decathlon');
await page.waitForTimeout(300);
await page.fill('#liv-depart', 'Lille');
await page.fill('#liv-arrivee', 'Roubaix');
await page.fill('#liv-distance', '18');
await page.fill('#liv-prix-ht', '266.67');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/03-modal-filled.png`, fullPage: false });
console.log('✓ Form rempli');

// 6. Submit
console.log('\nSubmit...');
await page.evaluate(() => {
  if (typeof window.ajouterLivraison === 'function') {
    window.ajouterLivraison();
  }
});
await page.waitForTimeout(2000);
await page.evaluate(() => { document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'); });

// 7. Check livraison created
const created = await page.evaluate(() => {
  const livs = JSON.parse(localStorage.getItem('livraisons') || '[]');
  return livs.map(l => ({
    id: l.id, numLiv: l.numLiv, client: l.client,
    depart: l.depart, arrivee: l.arrivee,
    distance: l.distance, ht: l.prix || l.prixHT || l.ht
  }));
});
console.log('Livraisons créées : ' + created.length);
console.log(JSON.stringify(created, null, 2));

const hasArrivee = created.length > 0 && created[0].arrivee && created[0].arrivee !== '';
console.log(hasArrivee ? '✓ BUG-006 : arrivée bien sauvée' : '✗ BUG-006 : arrivée vide !');

// 8. Screenshot livraisons table
await page.screenshot({ path: `${OUT_DIR}/04-after-create.png`, fullPage: false });
console.log('✓ After create captured');

// 9. Open drawer 360
await page.evaluate(() => {
  const tr = document.querySelector('#tb-livraisons tr:not(.empty-row)');
  if (tr) {
    const cb = tr.querySelector('.bulk-liv-check');
    const livId = cb && cb.dataset.livId;
    if (livId && window.ouvrirDrawerLivraison) {
      window.ouvrirDrawerLivraison(livId);
    }
  }
});
await page.waitForTimeout(1000);
await page.evaluate(() => { document.querySelectorAll('.toast').forEach(el => el.style.display = 'none'); });
await page.screenshot({ path: `${OUT_DIR}/05-drawer-detail.png`, fullPage: false });
console.log('✓ Drawer 360 captured');

// 10. Console errors check
console.log('\n=== CONSOLE ERRORS ===');
if (consoleErrors.length === 0) console.log('✓ Aucune erreur console');
else {
  console.log(`✗ ${consoleErrors.length} erreur(s) :`);
  consoleErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i+1}] ${e.slice(0, 200)}`));
}

await browser.close();
console.log('\n=== AUDIT COMPLETE ===');
