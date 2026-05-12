// Capture screenshots PROD pour toutes les pages (file:// admin.html avec dev seed).
// Run: node tools/prod-screenshots-all.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve('screenshots/2026-05-12/prod-all');
mkdirSync(outDir, { recursive: true });

// Pages dans la sidebar (data-page="X")
const PAGES = [
  'dashboard',
  'livraisons',
  'calendrier',
  'alertes',
  'clients',
  'fournisseurs',
  'vehicules',
  'carburant',
  'entretiens',
  'inspections',
  'equipe',
  'salaries',
  'planning',
  'heures',
  'incidents',
  'charges',
  'encaissement',
  'tva',
  'rentabilite',
  'statistiques',
  'brouillons-ia',
  'parametres',
];

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});

// Init script : dev admin login + skip setup wizard (avant goto)
await ctx.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Achraf Chikri');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('fast_boot_role', 'admin');
  // Skip setup wizard : marqueurs localStorage qui font que later() est implicite
  localStorage.setItem('mca_setup_skipped_until', String(Date.now() + 365 * 86400000));
  localStorage.setItem('mca_setup_completed', 'true');
});

const page = await ctx.newPage();
const url = BASE + '/admin.html?reseed=1';
console.log('Loading: ' + url);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
} catch (e) {
  console.log('Initial nav warning : ' + e.message);
}
// Le seed dev a besoin de temps pour peupler 500 livraisons + 25 clients + etc.
await page.waitForTimeout(8000);

// Force dismiss wizard : essai 3 manières (later() / display none / DOM removal)
async function dismissWizard() {
  return await page.evaluate(() => {
    try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
    try { if (window.MCASetup?.close) window.MCASetup.close(); } catch {}
    const w = document.getElementById('mca-setup-wizard');
    if (w) {
      w.classList.remove('active', 'open');
      w.style.display = 'none';
      w.setAttribute('hidden', '');
      // Si overlay parent
      const parent = w.closest('.modal-overlay, .overlay');
      if (parent) parent.style.display = 'none';
    }
    // Cherche tout div modal-overlay ouvert et le ferme
    document.querySelectorAll('.modal-overlay').forEach(el => {
      if (el.querySelector('#mca-setup-wizard') || el.textContent.includes('Bienvenue chez MCA')) {
        el.style.display = 'none';
        el.classList.remove('active', 'open');
      }
    });
    document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
    return !!document.querySelector('#mca-setup-wizard:not([hidden])');
  });
}
await dismissWizard();
await page.waitForTimeout(800);
await dismissWizard(); // 2e passe au cas où il revient

for (const pageName of PAGES) {
  try {
    // Méthode 1 : naviguerVers
    await page.evaluate((p) => {
      if (typeof window.naviguerVers === 'function') {
        window.naviguerVers(p);
      }
    }, pageName);
    await page.waitForTimeout(800);

    // Vérifie + force display si pas appliqué (cas où legacy le bloque)
    const actuallyOnPage = await page.evaluate((p) => {
      const target = document.getElementById('page-' + p);
      const allPages = document.querySelectorAll('section.page');
      let visibleId = '';
      allPages.forEach(el => {
        const cs = window.getComputedStyle(el);
        if (cs.display !== 'none' && el.classList.contains('active')) visibleId = el.id;
      });
      // Force si pas visible
      if (target && visibleId !== ('page-' + p)) {
        allPages.forEach(el => {
          el.classList.remove('active');
          el.style.display = 'none';
        });
        target.classList.add('active');
        target.style.display = '';
        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-page="${p}"]`);
        if (navItem) navItem.classList.add('active');
        return 'forced';
      }
      return visibleId;
    }, pageName);
    // Plus de temps pour que les KPIs/tables se peuplent depuis localStorage
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
      // Ferme dropdowns
      document.querySelectorAll('.ds-dropdown-menu.open, .liv-dropdown-wrap.open').forEach(el => el.classList.remove('open'));
      // Re-dismiss wizard si revient (changement de page peut le re-trigger)
      const w = document.getElementById('mca-setup-wizard');
      if (w) { w.classList.remove('active'); w.style.display = 'none'; }
      document.querySelectorAll('.modal-overlay').forEach(el => {
        if (el.querySelector('#mca-setup-wizard') || (el.textContent || '').includes('Bienvenue chez MCA')) {
          el.style.display = 'none';
        }
      });
    });

    const filepath = `${outDir}/${pageName}.png`;
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`  ✓ ${pageName}`);
  } catch (e) {
    console.log(`  ✗ ${pageName} : ${e.message}`);
  }
}

await browser.close();
console.log(`\n✓ ${PAGES.length} prod screenshots in ${outDir}`);
