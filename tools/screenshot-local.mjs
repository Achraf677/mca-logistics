// MCA LOGISTICS — Screenshot local dashboard (sans auth Supabase)
// Cible Live Server http://127.0.0.1:5500. Pre-seed via localStorage avant nav.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5500';
const OUT_DIR = 'screenshots/local';
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

// Bypass auth : flag tab unlocked + sessionStorage (auth = sessionStorage + tab ticket)
await page.addInitScript(() => {
  // Trigger principal : unlock tab access (bypass consommerTicketAccesOnglet)
  window.__delivproTabUnlocked = true;
  // Fake admin session (lu par getAdminSession dans script-core-auth.js)
  sessionStorage.setItem('admin_login', 'dev-admin');
  sessionStorage.setItem('admin_email', 'dev@local.test');
  sessionStorage.setItem('admin_nom', 'Dev Admin');
  sessionStorage.setItem('auth_mode', 'local');
  // CRITIQUE : 'role' = 'admin' pour que getRoleSessionCourant() retourne admin
  sessionStorage.setItem('role', 'admin');
  // Fast boot role pour bypass restoreLegacySessionFromSupabase
  sessionStorage.setItem('fast_boot_role', 'admin');
});

console.log('[local] going to', BASE + '/admin.html?reseed=1');

try {
  await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'networkidle', timeout: 15000 });
} catch (e) {
  console.warn('[local] networkidle timeout, retrying domcontentloaded');
  await page.goto(BASE + '/admin.html?reseed=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
}

// Wait for reseed cycle (clearAll + reload + ?seed=1 + seed + reload)
await page.waitForTimeout(4000);

// Skip login if redirected
if (page.url().includes('login')) {
  console.log('[local] redirected to login, trying naviguerVers');
  await page.evaluate(() => {
    localStorage.setItem('mca_admin_authenticated', '1');
    window.location.href = '/admin.html';
  });
  await page.waitForTimeout(2000);
}

await page.waitForTimeout(2000);
console.log('[local] post-load URL:', page.url());

// Si on a été redirigé vers login, set le flag et naviguer encore
if (page.url().includes('login')) {
  console.log('[local] sur login, set flag + retour admin.html');
  await page.evaluate(() => {
    window.__delivproTabUnlocked = true;
    sessionStorage.setItem('admin_login', 'dev-admin');
    sessionStorage.setItem('admin_email', 'dev@local.test');
    sessionStorage.setItem('admin_nom', 'Dev Admin');
    sessionStorage.setItem('auth_mode', 'local');
  });
  await page.goto(BASE + '/admin.html?seed=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2500);
  console.log('[local] post-retry URL:', page.url());
}

// Force dashboard active si pas déjà
await page.evaluate(() => {
  if (typeof window.naviguerVers === 'function') {
    window.naviguerVers('dashboard');
  }
}).catch(() => {});

await page.waitForTimeout(2500);

// Dismiss setup wizard via API officielle
await page.evaluate(() => {
  try {
    if (window.MCASetup && typeof window.MCASetup.later === 'function') {
      window.MCASetup.later();
    }
  } catch (_) {}
  // Fallback : direct hide
  var w = document.getElementById('mca-setup-wizard');
  if (w) { w.classList.remove('active'); w.style.display = 'none'; }
  // Hide toasts and overlays
  document.querySelectorAll('.toast, [class*="toast"], .mca-toast').forEach(el => el.style.display = 'none');
}).catch(() => {});
await page.waitForTimeout(800);

// Screenshot top viewport 1440x900 (matche mockup)
const fileTop = `${OUT_DIR}/01a-dashboard-top.png`;
await page.screenshot({ path: fileTop, fullPage: false });
console.log('  ✓ dashboard top 1440x900 →', fileTop);

// Pour le fullpage, on étend la viewport ET on neutralise les overflow conteneurs
await page.evaluate(() => {
  const mc = document.getElementById('mainContent');
  if (mc) { mc.style.overflow = 'visible'; mc.style.height = 'auto'; }
  document.body.style.overflow = 'visible';
  document.body.style.height = 'auto';
});
const dashboardHeight = await page.evaluate(() => {
  const d = document.getElementById('page-dashboard');
  return d ? d.scrollHeight + 200 : 1800;
});
await page.setViewportSize({ width: 1440, height: dashboardHeight });
await page.waitForTimeout(500);

const fileFull = `${OUT_DIR}/01-dashboard.png`;
await page.screenshot({ path: fileFull, fullPage: true });
console.log('  ✓ dashboard full →', fileFull);

await browser.close();
console.log('Done.');
