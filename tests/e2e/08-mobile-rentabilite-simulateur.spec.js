// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminCreds, gotoMobileApp } from './helpers/auth.js';

/**
 * Test E2E : simulateur de rentabilite mobile.
 *
 * Hypotheses : km/jour=100, prix/km=1.5, jours=20 → CA HT = 100 × 1.5 × 20 = 3000 €
 *
 * Strategie :
 *   1. Charger m.html, ouvrir Rentabilite → Simulateur
 *   2. Saisir km, prix, jours dans les inputs
 *   3. Trigger blur/change pour declencher la persistance + re-render
 *   4. Verifier que la card "CA HT" affiche bien 3000 € (ou variante de format)
 *   5. Verifier qu'aucun crash n'est survenu (pageerror)
 */

test.describe('Mobile Rentabilite — Simulateur calcule correctement le CA', () => {
  test.skip(!hasAdminCreds(), 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test('Simulateur : km/jour=100, prix=1.5, jours=20 → CA HT = 3000 €', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push('pageerror: ' + err.message));

    await loginAsAdmin(page);
    await gotoMobileApp(page);

    // Reset de la persistance simulateur pour un etat propre + force mode manuel
    await page.evaluate(() => {
      try {
        localStorage.setItem('rentabilite_calculateur_v2', JSON.stringify({
          modeCalcul: 'manuel',
          repartitionCharges: 'mensuel',
          tva: 20
        }));
      } catch (e) { /* noop */ }
    });

    // Naviguer vers Rentabilite
    await page.evaluate(() => window.M.go('rentabilite'));
    await page.waitForSelector('.m-alertes-chip[data-tab="simulateur"]', { timeout: 10_000 });

    // Cliquer sur l'onglet Simulateur
    await page.click('.m-alertes-chip[data-tab="simulateur"]');
    await page.waitForSelector('#m-sim-km-jour', { timeout: 5000 });

    // Saisir les valeurs (les inputs persistent au blur + reload de la page)
    const setNumber = async (selector, value) => {
      await page.fill(selector, '');
      await page.fill(selector, String(value));
      await page.locator(selector).blur();
      // Le blur declenche M.go('rentabilite') qui re-render -> attendre que
      // les inputs soient de nouveau presents
      await page.waitForSelector('#m-sim-km-jour', { timeout: 5000 });
    };

    await setNumber('#m-sim-km-jour', 100);
    await setNumber('#m-sim-prix-km', 1.5);
    await setNumber('#m-sim-jours', 20);

    // Attendre la stabilisation finale du re-render
    await page.waitForTimeout(500);

    // Lire la card "CA HT" : c'est la card .m-card-green dont le titre est "CA HT"
    const caHT = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.m-card'));
      for (const c of cards) {
        const title = c.querySelector('.m-card-title')?.textContent || '';
        if (/^\s*CA\s*HT\s*$/i.test(title)) {
          return c.querySelector('.m-card-value')?.textContent?.trim() || null;
        }
      }
      return null;
    });

    expect(caHT, 'Card "CA HT" introuvable dans le rendu simulateur').toBeTruthy();

    // Le format attendu : "3 000 €" ou "3000 €" ou similaire (M.format$).
    // On extrait les chiffres et on compare a 3000.
    const numeric = parseFloat((caHT || '').replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.'));
    expect(numeric, `CA HT lu="${caHT}" → numerique=${numeric}, attendu=3000`).toBeCloseTo(3000, 0);

    // Aucun crash JS pendant le scenario
    expect(errors, `Erreurs JS pendant simulateur: ${errors.join(' | ')}`).toEqual([]);
  });
});
