// Capture EXHAUSTIVE — toutes pages + tabs + modals + drawers + dropdowns + filtres ouverts.
// Run: node tools/prod-screenshots-everything.mjs
// Pre-req : Live Server sur http://127.0.0.1:5500
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT = resolve('screenshots/2026-05-12/everything');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});

await ctx.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Achraf Chikri');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('fast_boot_role', 'admin');
  localStorage.setItem('mca_setup_skipped_until', String(Date.now() + 365 * 86400000));
  localStorage.setItem('mca_setup_completed', 'true');
});

const page = await ctx.newPage();
await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(8000);

async function dismissWizardAndToasts() {
  await page.evaluate(() => {
    try { if (window.MCASetup?.later) window.MCASetup.later(); } catch {}
    const w = document.getElementById('mca-setup-wizard');
    if (w) { w.classList.remove('active'); w.style.display = 'none'; }
    document.querySelectorAll('.modal-overlay').forEach(el => {
      if (el.querySelector('#mca-setup-wizard') || (el.textContent || '').includes('Bienvenue chez MCA')) el.style.display = 'none';
    });
    document.querySelectorAll('.toast').forEach(el => el.style.display = 'none');
  });
}
await dismissWizardAndToasts();
await page.waitForTimeout(500);
await dismissWizardAndToasts();

async function navTo(pageName) {
  await page.evaluate((p) => {
    if (typeof window.naviguerVers === 'function') window.naviguerVers(p);
  }, pageName);
  await page.waitForTimeout(800);
  // Force display si nav legacy bloque
  await page.evaluate((p) => {
    const target = document.getElementById('page-' + p);
    if (!target) return;
    const visible = window.getComputedStyle(target).display !== 'none' && target.classList.contains('active');
    if (!visible) {
      document.querySelectorAll('section.page').forEach(el => { el.classList.remove('active'); el.style.display = 'none'; });
      target.classList.add('active');
      target.style.display = '';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const navItem = document.querySelector(`.nav-item[data-page="${p}"]`);
      if (navItem) navItem.classList.add('active');
    }
  }, pageName);
  await page.waitForTimeout(2000);
  await dismissWizardAndToasts();
}

async function shot(filename) {
  await page.screenshot({ path: `${OUT}/${filename}.png`, fullPage: true });
  console.log(`  ✓ ${filename}`);
}

// ===== 1. TOUTES PAGES =====
console.log('\n=== PAGES PRINCIPALES ===');
const PAGES = [
  'dashboard', 'livraisons', 'calendrier', 'alertes', 'clients', 'fournisseurs',
  'vehicules', 'carburant', 'entretiens', 'inspections', 'equipe', 'salaries',
  'planning', 'heures', 'incidents', 'charges', 'encaissement', 'tva',
  'rentabilite', 'statistiques', 'brouillons-ia', 'parametres'
];
for (const p of PAGES) {
  await navTo(p);
  await shot('01-page-' + p);
}

// ===== 2. PARAMÈTRES — 7 PANELS =====
console.log('\n=== PARAMÈTRES PANELS ===');
await navTo('parametres');
const PARAM_TABS = ['entreprise', 'comptable', 'notifications', 'securite', 'integrations', 'apparence', 'sauvegarde'];
for (const tab of PARAM_TABS) {
  try {
    await page.evaluate((t) => {
      const btn = document.querySelector(`.param-tab[data-ptab="${t}"]`);
      if (btn) btn.click();
    }, tab);
    await page.waitForTimeout(800);
    await shot('02-parametres-tab-' + tab);
  } catch (e) { console.log(`  ✗ param tab ${tab}: ${e.message}`); }
}

// ===== 3. RENTABILITÉ — 5 TABS =====
console.log('\n=== RENTABILITÉ TABS ===');
await navTo('rentabilite');
const RENT_TABS = ['vehicule', 'client', 'chauffeur', 'tournee', 'simulateur'];
for (const tab of RENT_TABS) {
  try {
    await page.evaluate((t) => {
      if (typeof window.changerSousOngletRentabilite === 'function') window.changerSousOngletRentabilite(t);
    }, tab);
    await page.waitForTimeout(1500);
    await shot('03-rentabilite-tab-' + tab);
  } catch (e) { console.log(`  ✗ rent tab ${tab}: ${e.message}`); }
}

// ===== 4. TVA — 2 TABS =====
console.log('\n=== TVA TABS ===');
await navTo('tva');
for (const tab of ['collectee', 'deductible']) {
  try {
    await page.evaluate((t) => {
      if (typeof window.switchTvaTab === 'function') window.switchTvaTab(t);
    }, tab);
    await page.waitForTimeout(800);
    await shot('04-tva-tab-' + tab);
  } catch (e) { console.log(`  ✗ tva tab ${tab}: ${e.message}`); }
}

// ===== 5. LIVRAISONS — 3 VUES =====
console.log('\n=== LIVRAISONS VUES ===');
await navTo('livraisons');
for (const vue of ['tableau', 'kanban', 'calendrier']) {
  try {
    await page.evaluate((v) => {
      if (typeof window.changerVueLivraisons === 'function') window.changerVueLivraisons(v);
    }, vue);
    await page.waitForTimeout(1800);
    await dismissWizardAndToasts();
    await shot('05-livraisons-vue-' + vue);
  } catch (e) { console.log(`  ✗ liv vue ${vue}: ${e.message}`); }
}

// ===== 6. ÉQUIPE — 4 SOUS-PAGES =====
console.log('\n=== ÉQUIPE TABS ===');
await navTo('equipe');
const EQUIPE_TABS = ['salaries', 'planning', 'heures', 'incidents'];
for (const tab of EQUIPE_TABS) {
  try {
    await page.evaluate((t) => {
      if (window.EquipeHub && typeof window.EquipeHub.ouvrirOnglet === 'function') window.EquipeHub.ouvrirOnglet(t);
    }, tab);
    await page.waitForTimeout(1500);
    await dismissWizardAndToasts();
    await shot('06-equipe-tab-' + tab);
  } catch (e) { console.log(`  ✗ equipe tab ${tab}: ${e.message}`); }
}

// ===== 7. MODALS =====
console.log('\n=== MODALS ===');
const MODALS = [
  { page: 'livraisons', open: () => window.openModal && window.openModal('modal-livraison'), name: 'nouvelle-livraison' },
  { page: 'clients', open: () => window.openModal && window.openModal('modal-client'), name: 'nouveau-client' },
  { page: 'fournisseurs', open: () => window.openModal && window.openModal('modal-fournisseur'), name: 'nouveau-fournisseur' },
  { page: 'vehicules', open: () => window.openModal && window.openModal('modal-vehicule'), name: 'nouveau-vehicule' },
  { page: 'carburant', open: () => window.openModal && window.openModal('modal-carburant'), name: 'nouveau-plein' },
  { page: 'charges', open: () => window.openModal && window.openModal('modal-charge'), name: 'nouvelle-charge' },
  { page: 'encaissement', open: () => window.openModal && window.openModal('modal-paiement'), name: 'nouveau-paiement' },
  { page: 'incidents', open: () => window.openModal && window.openModal('modal-incident'), name: 'nouvel-incident' },
];
for (const m of MODALS) {
  try {
    await navTo(m.page);
    await page.evaluate(`(${m.open.toString()})()`);
    await page.waitForTimeout(1200);
    await dismissWizardAndToasts();
    await shot('07-modal-' + m.name);
    // Fermer modal
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach(el => {
        if (el.style.display !== 'none' && !el.querySelector('#mca-setup-wizard')) el.style.display = 'none';
      });
    });
    await page.waitForTimeout(300);
  } catch (e) { console.log(`  ✗ modal ${m.name}: ${e.message}`); }
}

// ===== 8. DRAWERS 360 =====
console.log('\n=== DRAWERS 360 ===');
// Drawer Livraison : click sur 1ere row de la table
try {
  await navTo('livraisons');
  await page.evaluate(() => {
    const row = document.querySelector('#tb-livraisons tr');
    if (row) {
      const cb = row.querySelector('.bulk-liv-check');
      const livId = cb && cb.dataset.livId;
      if (livId && window.ouvrirDrawerLivraison) window.ouvrirDrawerLivraison(livId);
    }
  });
  await page.waitForTimeout(1500);
  await dismissWizardAndToasts();
  await shot('08-drawer-livraison');
  // Fermer
  await page.evaluate(() => {
    document.querySelectorAll('.drawer-overlay, .drawer').forEach(el => { el.classList.remove('active', 'open'); el.style.display = 'none'; });
  });
} catch (e) { console.log(`  ✗ drawer liv: ${e.message}`); }

// ===== 9. DROPDOWNS OUVERTS =====
console.log('\n=== DROPDOWNS ===');
const DROPDOWNS = [
  { page: 'livraisons', selector: '[data-dropdown-menu="gen"]', name: 'livraisons-generer' },
  { page: 'livraisons', selector: '[data-dropdown-menu="export"]', name: 'livraisons-exporter' },
  { page: 'carburant', selector: '#carb-export-menu', name: 'carburant-exporter' },
  { page: 'vehicules', selector: '.liv-dropdown-menu', name: 'vehicules-exporter' },
  { page: 'tva', selector: '#tva-export-menu', name: 'tva-exporter' },
  { page: 'rentabilite', selector: '#rent-export-menu', name: 'rentabilite-exporter' },
  { page: 'heures', selector: '#heures-export-menu', name: 'heures-exporter' },
  { page: 'planning', selector: '#planning-export-menu', name: 'planning-exporter' },
  { page: 'incidents', selector: '#inc-export-menu', name: 'incidents-exporter' },
  { page: 'entretiens', selector: '#entr-export-menu', name: 'entretiens-exporter' },
  { page: 'inspections', selector: '#insp-export-menu', name: 'inspections-exporter' },
  { page: 'alertes', selector: '#alertes-export-menu', name: 'alertes-exporter' },
  { page: 'equipe', selector: '#equipe-export-menu', name: 'equipe-exporter' },
];
for (const d of DROPDOWNS) {
  try {
    await navTo(d.page);
    await page.evaluate((sel) => {
      const menu = document.querySelector(sel);
      if (menu) {
        menu.classList.add('open');
        menu.style.display = 'block';
      }
      // Force scroll en haut
      window.scrollTo(0, 0);
    }, d.selector);
    await page.waitForTimeout(800);
    await shot('09-dropdown-' + d.name);
  } catch (e) { console.log(`  ✗ dropdown ${d.name}: ${e.message}`); }
}

// ===== 10. SIDEBAR FOOT DROPDOWN OUVERT =====
console.log('\n=== SIDEBAR FOOT MENU ===');
try {
  await navTo('dashboard');
  await page.evaluate(() => {
    const trig = document.getElementById('sidebar-foot-trigger');
    const menu = document.getElementById('sf-user-menu');
    if (trig && menu) {
      menu.classList.add('open');
      trig.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
    }
  });
  await page.waitForTimeout(500);
  await shot('10-sidebar-foot-menu-open');
} catch (e) { console.log(`  ✗ sidebar foot: ${e.message}`); }

await browser.close();
console.log(`\n✓ Tous les screenshots dans ${OUT}`);
