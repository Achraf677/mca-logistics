// @ts-check
// Visual audit spec — capture des screenshots de toutes les pages MCA puis
// envoi par batch a l'edge function `ai-visual-audit` (Gemini 2.5 Flash).
//
// Lancement local :
//   PLAYWRIGHT_ADMIN_EMAIL=... PLAYWRIGHT_ADMIN_PASSWORD=... \
//   SUPABASE_URL=https://lkbfvgnhwgbapdtitglu.supabase.co \
//   SUPABASE_ANON_KEY=eyJ... \
//   BASE_URL=https://mca-logistics.pages.dev \
//   npx playwright test tests/visual-audit.spec.js
//
// CI : voir .github/workflows/visual-audit-daily.yml.
//
// Sortie :
//   tests/visual-audit-output/screenshots/<viewport>-<id>.png
//   tests/visual-audit-output/issues.json   (input du tool aggregator)
//
// Le batching est de 5 screenshots / appel Gemini -> 25 routes x 2 viewports
// = 50 screenshots = 10 appels = ~4 % du quota free 250 RPD.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lkbfvgnhwgbapdtitglu.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BATCH_SIZE = 5;
const PROMPT_CONTEXT = process.env.AUDIT_CONTEXT || `audit quotidien ${new Date().toISOString().slice(0, 10)}`;
const TRIGGERED_BY = process.env.AUDIT_TRIGGERED_BY === 'cron' ? 'cron' :
  process.env.AUDIT_TRIGGERED_BY === 'pr' ? 'pr' : 'manual';
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'visual-audit-output');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');

// 25 routes ciblees. Chaque entry :
//   id        : identifiant interne pour naviguerVers(id) cote PC.
//   label     : nom humain pour le rapport.
//   action    : optionnel, callback(page) pour ouvrir une modale apres nav.
//   skipMobile: certains onglets PC-only (audit, brouillons-ia chauffeur).
const ROUTES = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'livraisons',    label: 'Livraisons (liste)' },
  {
    id: 'livraisons',
    label: 'Livraisons (modale creation)',
    suffix: 'create-modal',
    action: async (page) => {
      // Tente de cliquer sur "Nouvelle livraison" si bouton present.
      const btn = page.locator('button:has-text("Nouvelle"), button:has-text("Ajouter")').first();
      if (await btn.count()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(800);
      }
    },
  },
  { id: 'charges',       label: 'Charges (liste)' },
  {
    id: 'charges',
    label: 'Charges (modale creation)',
    suffix: 'create',
    action: async (page) => {
      const btn = page.locator('button:has-text("Nouvelle charge"), button:has-text("Ajouter")').first();
      if (await btn.count()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(800);
      }
    },
  },
  { id: 'carburant',     label: 'Carburant' },
  { id: 'vehicules',     label: 'Vehicules (liste)' },
  {
    id: 'vehicules',
    label: 'Vehicule detail (1er de la liste)',
    suffix: 'detail',
    action: async (page) => {
      const row = page.locator('table tbody tr, .vehicule-card').first();
      if (await row.count()) {
        await row.click().catch(() => {});
        await page.waitForTimeout(800);
      }
    },
  },
  { id: 'salaries',      label: 'Salaries (liste)' },
  {
    id: 'salaries',
    label: 'Salarie detail (1er de la liste)',
    suffix: 'detail',
    action: async (page) => {
      const row = page.locator('table tbody tr, .salarie-card').first();
      if (await row.count()) {
        await row.click().catch(() => {});
        await page.waitForTimeout(800);
      }
    },
  },
  { id: 'planning',      label: 'Planning jour', suffix: 'jour' },
  {
    id: 'planning',
    label: 'Planning semaine',
    suffix: 'semaine',
    action: async (page) => {
      const tab = page.locator('button:has-text("Semaine"), [data-vue="semaine"]').first();
      if (await tab.count()) {
        await tab.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    },
  },
  { id: 'clients',       label: 'Clients' },
  { id: 'fournisseurs',  label: 'Fournisseurs' },
  { id: 'tva',           label: 'TVA' },
  { id: 'rentabilite',   label: 'Rentabilite' },
  { id: 'statistiques',  label: 'Statistiques' },
  { id: 'encaissement',  label: 'Encaissement' },
  { id: 'alertes',       label: 'Alertes' },
  { id: 'calendrier',    label: 'Calendrier' },
  { id: 'recherche',     label: 'Recherche', skipMobile: true },
  { id: 'parametres',    label: 'Parametres' },
  { id: 'brouillons-ia', label: 'Brouillons IA', skipMobile: true },
  { id: 'audit',         label: 'Panneau audit', skipMobile: true },
  {
    id: 'dashboard',
    label: 'Chat panel ouvert',
    suffix: 'chat-panel',
    action: async (page) => {
      const btn = page.locator('#chat-toggle, button[aria-label*="chat" i], button:has-text("✨")').first();
      if (await btn.count()) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(600);
      }
    },
  },
];

// ---------- Helpers ----------

function ensureOutputDirs() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function routeKey(r) {
  return r.suffix ? `${r.id}-${r.suffix}` : r.id;
}

async function loginAdmin(page) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD requis pour visual-audit');
  }
  await page.goto('/login.html');
  await page.fill('#login-identifiant', ADMIN_EMAIL);
  await page.fill('#login-password', ADMIN_PASSWORD);
  await page.click('#login-submit');
  await page.waitForURL(/admin\.html|m\.html/, { timeout: 20_000 });
  await page.waitForFunction(
    () => typeof window.naviguerVers === 'function' || typeof window.MCAm?.go === 'function' || typeof window.M?.go === 'function',
    null,
    { timeout: 15_000 }
  );
  // Petite pause pour laisser les adapters Supabase faire le pull initial
  await page.waitForTimeout(1500);
}

async function navigatePc(page, route) {
  await page.evaluate((id) => {
    if (typeof window.naviguerVers === 'function') window.naviguerVers(id);
  }, route.id);
  await page.waitForTimeout(800);
  if (route.action) await route.action(page);
  // Wait network idle (ou timeout court)
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

async function navigateMobile(page, route) {
  await page.evaluate((id) => {
    const fn = window.M?.go || window.MCAm?.go || window.naviguerVers;
    if (typeof fn === 'function') fn(id);
  }, route.id);
  await page.waitForTimeout(800);
  if (route.action) await route.action(page);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

async function captureBuffer(page) {
  // fullPage true peut donner des images >8 MB sur de longues pages — on
  // limite a 4096px de hauteur via clip si necessaire.
  return await page.screenshot({ fullPage: true, type: 'png' });
}

// Appelle l'edge function par batch de BATCH_SIZE et aggrege le resultat.
async function callVisualAudit(authToken, batch) {
  const url = `${SUPABASE_URL}/functions/v1/ai-visual-audit`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      screenshots: batch.map((b) => ({
        url: b.url,
        viewport: b.viewport,
        base64: b.base64,
        mime: 'image/png',
      })),
      prompt_context: PROMPT_CONTEXT,
      triggered_by: TRIGGERED_BY,
    }),
  });
  const json = await r.json().catch(() => ({}));
  return { httpStatus: r.status, json };
}

// Recupere un access_token Supabase pour appeler l'edge function en tant
// qu'admin (verify_jwt: true). On utilise l'endpoint REST classique
// /auth/v1/token?grant_type=password.
async function getAdminAccessToken() {
  if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY manquant pour visual-audit');
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await r.json().catch(() => ({}));
  if (!json.access_token) {
    throw new Error(`Login Supabase echoue (status ${r.status}): ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json.access_token;
}

// ---------- Test ----------

test.describe.configure({ mode: 'serial' });

test('Visual audit — capture + analyse Gemini Flash', async ({ browser }) => {
  test.setTimeout(15 * 60_000); // 15 min total max

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    test.skip(true, 'PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD manquants');
  }

  ensureOutputDirs();

  // Token admin pour appels edge fn (verify_jwt: true)
  const accessToken = await getAdminAccessToken();

  // ---------- PC viewport ----------
  const ctxPc = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const pagePc = await ctxPc.newPage();
  await loginAdmin(pagePc);

  /** @type {Array<{ url: string, viewport: 'pc'|'mobile', base64: string, file: string, label: string }>} */
  const captured = [];

  for (const route of ROUTES) {
    try {
      await navigatePc(pagePc, route);
      const buf = await captureBuffer(pagePc);
      const file = path.join(SCREENSHOTS_DIR, `pc-${routeKey(route)}.png`);
      fs.writeFileSync(file, buf);
      captured.push({
        url: `/admin.html#${routeKey(route)}`,
        viewport: 'pc',
        base64: buf.toString('base64'),
        file,
        label: `[pc] ${route.label}`,
      });
    } catch (e) {
      console.warn(`[visual-audit] PC route ${route.id} (${route.suffix ?? ''}) failed: ${e.message}`);
    }
  }
  await ctxPc.close();

  // ---------- Mobile viewport ----------
  const ctxMobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageMobile = await ctxMobile.newPage();
  await loginAdmin(pageMobile);
  // Force vers /m.html (admin a acces mobile aussi)
  await pageMobile.goto('/m.html').catch(() => {});
  await pageMobile.waitForFunction(
    () => typeof window.M?.go === 'function' || typeof window.MCAm?.go === 'function' || typeof window.naviguerVers === 'function',
    null,
    { timeout: 15_000 }
  ).catch(() => {});

  for (const route of ROUTES) {
    if (route.skipMobile) continue;
    try {
      await navigateMobile(pageMobile, route);
      const buf = await captureBuffer(pageMobile);
      const file = path.join(SCREENSHOTS_DIR, `mobile-${routeKey(route)}.png`);
      fs.writeFileSync(file, buf);
      captured.push({
        url: `/m.html#${routeKey(route)}`,
        viewport: 'mobile',
        base64: buf.toString('base64'),
        file,
        label: `[mobile] ${route.label}`,
      });
    } catch (e) {
      console.warn(`[visual-audit] Mobile route ${route.id} (${route.suffix ?? ''}) failed: ${e.message}`);
    }
  }
  await ctxMobile.close();

  expect(captured.length, 'Aucun screenshot capture').toBeGreaterThan(0);

  // ---------- Batch -> Gemini ----------
  /** @type {Array<{ severity: string, location: string, description: string, fix_suggestion: string, url: string, viewport: string }>} */
  const allIssues = [];
  let runIds = [];
  for (let i = 0; i < captured.length; i += BATCH_SIZE) {
    const batch = captured.slice(i, i + BATCH_SIZE);
    const { httpStatus, json } = await callVisualAudit(accessToken, batch);
    if (json && json.success && Array.isArray(json.issues)) {
      for (const it of json.issues) allIssues.push(it);
      if (json.run_id) runIds.push(json.run_id);
    } else {
      console.warn(`[visual-audit] batch ${i}-${i + batch.length} fail (HTTP ${httpStatus}): ${JSON.stringify(json).slice(0, 200)}`);
    }
  }

  // Persist resultat pour l'aggregator
  const out = {
    triggered_by: TRIGGERED_BY,
    triggered_at: new Date().toISOString(),
    prompt_context: PROMPT_CONTEXT,
    screenshots: captured.map((c) => ({ url: c.url, viewport: c.viewport, file: path.relative(process.cwd(), c.file), label: c.label })),
    run_ids: runIds,
    issues: allIssues,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'issues.json'), JSON.stringify(out, null, 2));

  // Le test "passe" toujours (l'audit est observatoire, pas bloquant). C'est
  // l'aggregator + workflow qui escalent les criticals en issue GitHub.
  expect(out.issues, 'issues doit etre un tableau').toBeInstanceOf(Array);
});
