// @ts-check
/**
 * Smoke E2E — bloquant pour la CI (workflow .github/workflows/e2e-smoke.yml).
 *
 * Couvre 3 verifications critiques en ~2 min :
 *   1. Login admin OK (URL post-login admin.html ou m.html selon UA).
 *   2. Selectors critiques presents : #m-chatbot-btn, #m-agent-ia-btn,
 *      [data-page="brouillons-ia"].
 *   3. Aucun chevauchement entre elements position:fixed visibles en
 *      viewport mobile 375x812 (FAB chat / FAB IA / nav bottom...).
 *
 * Les secrets PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD sont
 * lus via process.env.ADMIN_EMAIL / ADMIN_PASSWORD (pour rester compatible
 * avec helpers/auth.js et le reste de la suite e2e). Si absents : test.skip
 * propre (warning dans le workflow YAML, pas de fail).
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminCreds } from './helpers/auth.js';

const SELECTORS_CRITIQUES = [
  '#m-chatbot-btn',
  '#m-agent-ia-btn',
  '[data-page="brouillons-ia"]',
];

test.describe('Smoke E2E (bloquant CI)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.setTimeout(90_000);
  });

  test('1) Login admin reussi', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'ADMIN_EMAIL / ADMIN_PASSWORD non configures (warning workflow YAML)');
    await loginAsAdmin(page, { timeout: 20_000 });
    expect(page.url()).toMatch(/(admin|m)\.html/);
  });

  test('2) Selectors critiques presents en mobile', async ({ browser }) => {
    test.skip(!hasAdminCreds(), 'ADMIN_EMAIL / ADMIN_PASSWORD non configures');

    // Force viewport mobile pour exposer m.html
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    const page = await ctx.newPage();

    try {
      await loginAsAdmin(page, { timeout: 20_000 });

      // Si on est tombe sur admin.html (UA detection pas decisive),
      // on goto m.html explicitement.
      if (!page.url().includes('m.html')) {
        await page.goto('/m.html');
        await page.waitForFunction(
          () => typeof window.M === 'object' && typeof window.M.go === 'function',
          null,
          { timeout: 15_000 }
        );
      }

      // Les selectors peuvent etre presents mais hidden selon la page
      // courante — on verifie l'EXISTENCE dans le DOM, pas la visibilite.
      // En revanche, #m-chatbot-btn doit etre VISIBLE car c'est le FAB persistent.
      for (const sel of SELECTORS_CRITIQUES) {
        const count = await page.locator(sel).count();
        expect(count, `Selector ${sel} doit exister dans le DOM`).toBeGreaterThan(0);
      }

      // Verifie que le FAB chatbot est visible (persistent au-dessus du nav)
      await expect(page.locator('#m-chatbot-btn').first()).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test('3) Aucun chevauchement entre FAB position:fixed (375x812)', async ({ browser }) => {
    test.skip(!hasAdminCreds(), 'ADMIN_EMAIL / ADMIN_PASSWORD non configures');

    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    const page = await ctx.newPage();

    try {
      await loginAsAdmin(page, { timeout: 20_000 });

      if (!page.url().includes('m.html')) {
        await page.goto('/m.html');
        await page.waitForFunction(
          () => typeof window.M === 'object' && typeof window.M.go === 'function',
          null,
          { timeout: 15_000 }
        );
      }

      // Recupere toutes les bbox des elements position:fixed visibles
      // qui ont une taille non nulle. On exclut les overlays/modals
      // (pleine page, pas des FAB) via heuristique : aire > 60% du viewport.
      const overlaps = await page.evaluate(() => {
        const VIEWPORT_AREA = window.innerWidth * window.innerHeight;
        const els = Array.from(document.querySelectorAll('*'));
        const fixed = [];
        for (const el of els) {
          const cs = window.getComputedStyle(el);
          if (cs.position !== 'fixed') continue;
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (parseFloat(cs.opacity) === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const area = r.width * r.height;
          // Skip les overlays plein ecran (modals, backdrop)
          if (area > VIEWPORT_AREA * 0.6) continue;
          // Skip les nav-bars (largeur ~ 100% viewport)
          if (r.width > window.innerWidth * 0.85 && r.height < 100) continue;
          fixed.push({
            id: el.id || '',
            cls: el.className && el.className.toString ? el.className.toString().slice(0, 80) : '',
            tag: el.tagName,
            x: Math.round(r.x), y: Math.round(r.y),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        }

        // Detecte les overlaps 2 a 2 (paire ordonnee)
        const overlaps = [];
        for (let i = 0; i < fixed.length; i++) {
          for (let j = i + 1; j < fixed.length; j++) {
            const a = fixed[i], b = fixed[j];
            const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
            const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
            if (overlapX > 4 && overlapY > 4) {
              // Tolerance 4px (border, ombre, etc.)
              overlaps.push({ a, b, overlapX, overlapY });
            }
          }
        }
        return overlaps;
      });

      if (overlaps.length > 0) {
        const pretty = overlaps.map(o =>
          `  - ${o.a.tag}#${o.a.id || '(no-id)'}.${o.a.cls.split(' ')[0]} ` +
          `chevauche ${o.b.tag}#${o.b.id || '(no-id)'}.${o.b.cls.split(' ')[0]} ` +
          `(${o.overlapX}x${o.overlapY}px)`
        ).join('\n');
        console.error('Chevauchements detectes :\n' + pretty);
      }

      expect(overlaps, `Chevauchement(s) FAB detectes en mobile 375x812`).toHaveLength(0);
    } finally {
      await ctx.close();
    }
  });
});
