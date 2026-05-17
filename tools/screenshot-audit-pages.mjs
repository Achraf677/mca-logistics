// MCA LOGISTICS — Screenshot audit pages 5→21 (Onglet par Onglet)
// Bypass auth via initScript + sessionStorage. Cible serveur local http://127.0.0.1:5500.
// Output : screenshots/audit-onglets/<NN>-<page>.png
//
// Run: node tools/screenshot-audit-pages.mjs

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/audit-onglets';
const VIEWPORT = { width: 1440, height: 900 };

// Liste alignée sur l'ordre MD AUDIT-ONGLET-PAR-ONGLET.md (onglets 5→21)
const PAGES = [
  { num: '05', slug: 'alertes' },
  { num: '06', slug: 'clients' },
  { num: '07', slug: 'fournisseurs' },
  { num: '08', slug: 'vehicules' },
  { num: '09', slug: 'carburant' },
  { num: '10', slug: 'entretiens' },
  { num: '11', slug: 'inspections' },
  { num: '12', slug: 'salaries' },
  { num: '14', slug: 'incidents' },
  { num: '15', slug: 'charges' },
  { num: '16', slug: 'encaissement' },
  { num: '17', slug: 'tva' },
  { num: '18', slug: 'rentabilite' },
  { num: '19', slug: 'statistiques' },
  { num: '20', slug: 'parametres' },
  { num: '21', slug: 'brouillons-ia' },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

// Bypass auth via init script
await page.addInitScript(() => {
  window.__delivproTabUnlocked = true;
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('fast_boot_role', 'admin');
});

console.log('[audit] going to', BASE + '/admin.html?reseed=1');
try {
  await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
} catch (e) {
  console.warn('[audit] timeout, retrying');
  await page.goto(BASE + '/admin.html?seed=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
}
await page.waitForTimeout(4000);

// Si redirigé login, force flag + retour admin
if (page.url().includes('login')) {
  console.log('[audit] login redirect, forcing flags');
  await page.evaluate(() => {
    window.__delivproTabUnlocked = true;
    sessionStorage.setItem('admin_login', 'dev-admin');
    sessionStorage.setItem('admin_email', 'dev@local.test');
    sessionStorage.setItem('admin_nom', 'Dev Admin');
    sessionStorage.setItem('auth_mode', 'local');
    sessionStorage.setItem('role', 'admin');
    sessionStorage.setItem('fast_boot_role', 'admin');
    localStorage.setItem('mca_admin_authenticated', '1');
    window.location.href = '/admin.html';
  });
  await page.waitForTimeout(3000);
}

// Dismiss setup wizard
await page.evaluate(() => {
  try {
    if (window.MCASetup && typeof window.MCASetup.later === 'function') window.MCASetup.later();
  } catch (_) {}
  const w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  document.querySelectorAll('.toast, [class*="toast"], .mca-toast').forEach(el => el.style.display = 'none');
}).catch(() => {});
await page.waitForTimeout(800);

// Parcours des pages
for (const { num, slug } of PAGES) {
  console.log(`[audit] → page ${num} ${slug}`);
  try {
    await page.evaluate((s) => { if (typeof window.naviguerVers === 'function') window.naviguerVers(s); }, slug);
    await page.waitForTimeout(1500);

    // Top viewport (mockup)
    const fileTop = `${OUT_DIR}/${num}-${slug}-top.png`;
    await page.screenshot({ path: fileTop, fullPage: false });
    console.log(`  ✓ top → ${fileTop}`);

    // Full page (vue complète)
    const sectionId = 'page-' + slug;
    const height = await page.evaluate((id) => {
      const d = document.getElementById(id);
      return d ? Math.min(d.scrollHeight + 200, 8000) : 1800;
    }, sectionId);
    if (height > 900) {
      const mainContent = await page.$('#mainContent');
      if (mainContent) {
        await page.evaluate(() => {
          const mc = document.getElementById('mainContent');
          if (mc) { mc.style.overflow = 'visible'; mc.style.height = 'auto'; }
          document.body.style.overflow = 'visible';
          document.body.style.height = 'auto';
        });
      }
      await page.setViewportSize({ width: 1440, height });
      await page.waitForTimeout(400);
      const fileFull = `${OUT_DIR}/${num}-${slug}-full.png`;
      await page.screenshot({ path: fileFull, fullPage: true });
      console.log(`  ✓ full (${height}px) → ${fileFull}`);
      // Reset viewport for next page
      await page.setViewportSize(VIEWPORT);
      await page.waitForTimeout(200);
    }
  } catch (e) {
    console.warn(`  ✗ erreur ${slug}:`, e.message);
  }
}

await browser.close();
console.log('Done. Output dir:', OUT_DIR);
