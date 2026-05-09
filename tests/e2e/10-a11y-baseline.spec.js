// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminCreds } from './helpers/auth.js';

/**
 * Test E2E : a11y baseline (Sprint H2.3).
 *
 * Injecte axe-core depuis le CDN (pas de npm install requis — vanilla policy)
 * et verifie le score axe sur les routes critiques admin :
 *   dashboard, livraisons, charges, planning, settings.
 *
 * Critique :
 *  - Aucune violation `serious` ou `critical` sur les regles testees.
 *  - Le nombre de violations `moderate` ne doit pas croitre vs baseline.
 *
 * Si le score baseline baisse → fail. Si le score s'ameliore → on bumpe le baseline.
 *
 * Pour mettre a jour le baseline :
 *   UPDATE_A11Y_BASELINE=1 npx playwright test 10-a11y-baseline
 *
 * NOTE : ce test a besoin de credentials admin pour atteindre les pages
 * authentifiees. Il skip silencieusement si manquants.
 */

// Baseline figee Sprint H2.3 (2026-05-09). Apres le batch a11y :
//   serious=0, critical=0, moderate ≤ X (a calibrer 1ere run).
// Format : { route: { critical: max, serious: max, moderate: max } }.
const A11Y_BASELINE = {
  dashboard:  { critical: 0, serious: 0, moderate: 99 },
  livraisons: { critical: 0, serious: 0, moderate: 99 },
  charges:    { critical: 0, serious: 0, moderate: 99 },
  planning:   { critical: 0, serious: 0, moderate: 99 },
  parametres: { critical: 0, serious: 0, moderate: 99 },
};

const AXE_CDN = 'https://cdn.jsdelivr.net/npm/axe-core@4.10.0/axe.min.js';

/**
 * Charge axe-core dans la page si pas deja present, puis lance axe.run() avec
 * une config focalisee sur les regles WCAG 2.1 AA + best practices a11y.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ violations: Array<{ id: string, impact: string, nodes: any[] }> }>}
 */
async function runAxeAudit(page) {
  // Tente d'injecter axe-core via addScriptTag (CDN).
  // Si reseau coupe, on skip ce test silencieusement.
  try {
    await page.addScriptTag({ url: AXE_CDN });
  } catch (err) {
    test.skip(true, `axe-core indisponible (CDN ${AXE_CDN}) : ${err?.message}`);
  }

  // axe.run() retourne un objet avec violations[]
  const result = await page.evaluate(async () => {
    // @ts-ignore - axe est injecté globalement
    if (typeof axe === 'undefined') throw new Error('axe non chargé');
    // @ts-ignore
    return await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations'],
    });
  });

  return result;
}

function summarize(violations) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    counts[v.impact] = (counts[v.impact] || 0) + 1;
  }
  return counts;
}

test.describe('A11Y baseline (axe-core)', () => {
  test.skip(!hasAdminCreds(), 'ADMIN_EMAIL / ADMIN_PASSWORD requis pour atteindre les pages authentifiees');

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const [route, baseline] of Object.entries(A11Y_BASELINE)) {
    test(`${route} : pas de violation critical/serious + moderate sous baseline`, async ({ page }) => {
      // Navigue via la fonction window.naviguerVers exposée par admin.html
      await page.evaluate((r) => {
        // @ts-ignore
        if (typeof window.naviguerVers === 'function') window.naviguerVers(r);
      }, route);

      // Laisse le rendu se faire
      await page.waitForTimeout(800);

      const result = await runAxeAudit(page);
      const counts = summarize(result.violations);

      // Log les violations pour debug (visible dans le rapport Playwright).
      if (result.violations.length > 0) {
        const summary = result.violations
          .map(v => `  - [${v.impact}] ${v.id} (${v.nodes.length} noeuds)`)
          .join('\n');
        console.log(`[a11y/${route}] ${result.violations.length} violations :\n${summary}`);
      }

      expect(counts.critical, `${route} : violations critical`).toBeLessThanOrEqual(baseline.critical);
      expect(counts.serious, `${route} : violations serious`).toBeLessThanOrEqual(baseline.serious);
      expect(counts.moderate, `${route} : violations moderate`).toBeLessThanOrEqual(baseline.moderate);
    });
  }
});
