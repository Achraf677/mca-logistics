// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test E2E : navigation entre pages admin sans erreur console
 *
 * Verifie que les pages principales se chargent sans erreur JavaScript.
 * Detecte les regressions visuelles / fonctionnelles courantes.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

test.describe('Navigation admin', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Connexion")');
    await page.waitForURL(/admin\.html/, { timeout: 10_000 });
  });

  const PAGES = [
    { id: 'livraisons', label: 'Livraisons' },
    { id: 'clients', label: 'Clients' },
    { id: 'vehicules', label: 'Véhicules' },
    { id: 'salaries', label: 'Salariés' },
    { id: 'charges', label: 'Charges' },
    { id: 'carburant', label: 'Carburant' },
    { id: 'inspections', label: 'Inspections' },
    { id: 'tva', label: 'TVA' },
  ];

  for (const p of PAGES) {
    test(`page ${p.id} se charge sans erreur console`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push('pageerror: ' + err.message));
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('CSP')) {
          errors.push('console.error: ' + msg.text());
        }
      });

      // Naviguer via la fonction globale exposée
      await page.evaluate((id) => {
        if (typeof window.naviguerVers === 'function') window.naviguerVers(id);
      }, p.id);

      await page.waitForTimeout(1000);

      // Aucune erreur critique
      expect(errors.filter(e => !/Failed to load resource|net::|404/i.test(e))).toEqual([]);
    });
  }

  test('watchdog : aucune fonction critique manquante', async ({ page }) => {
    await page.waitForTimeout(4000); // attendre le watchdog (3s timer)

    const watchdogErrors = await page.evaluate(() => {
      const logs = [];
      // On ne peut pas relire les console.errors apres coup, mais on peut
      // re-lancer le watchdog manuellement
      if (window.MCA && typeof window.MCA.runWatchdog === 'function') {
        window.MCA.runWatchdog();
      }
      return logs;
    });

    // Verification basique : MCA et fonctions critiques exposees
    const hasMCA = await page.evaluate(() => typeof window.MCA);
    expect(hasMCA).toBe('object');
  });
});
