// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminCreds, gotoMobileApp } from './helpers/auth.js';

/**
 * Test E2E : la valeur TVA mobile reste stable apres aller-retour de mois.
 *
 * Bug signale : sur m.html → TVA, changer de mois puis revenir au mois initial
 * fait apparaitre une valeur DIFFERENTE de l'initiale (recalcul / cache pourri).
 *
 * Strategie :
 *   1. Charger /m.html, naviguer sur TVA
 *   2. Lire le mois courant + montant "TVA a reverser" (ou "Credit TVA")
 *   3. Changer de mois (mois precedent), attendre re-render
 *   4. Revenir au mois initial, attendre re-render
 *   5. Verifier que le montant affiche est IDENTIQUE
 *
 * NOTE : si le bug n'est pas encore resolu en prod, marquer en `test.fail()`
 * pour que le test devienne vert (= echec attendu) jusqu'au fix. Quand le fix
 * sera deploye, retirer le `.fail` et le test passera naturellement au vert.
 */

// Force le projet "mobile-safari" uniquement (m.html est le mobile router)
test.describe('Mobile TVA — stabilite mois aller-retour', () => {
  test.skip(!hasAdminCreds(), 'ADMIN_EMAIL et ADMIN_PASSWORD requis (login admin pour acceder a m.html)');
  test.skip(({ browserName }) => browserName !== 'webkit' && browserName !== 'chromium',
    'Test cible mobile-safari/chromium');

  test('TVA mobile : valeur identique apres changement de mois aller-retour', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoMobileApp(page);

    // Naviguer sur TVA via M.go
    await page.evaluate(() => window.M.go('tva'));
    // Attendre le rendu initial (selecteur de mois present)
    await page.waitForSelector('#m-tva-mois', { timeout: 10_000 });
    // Laisse le pull async des charges/livraisons s'executer (cf. v3.63 bugfix)
    await page.waitForTimeout(2500);

    // Lit le mois initial et la valeur affichee dans la card "TVA a reverser"/"Credit TVA"
    const lireEtat = async () => {
      return page.evaluate(() => {
        const select = document.getElementById('m-tva-mois');
        const moisVal = select ? select.value : null;
        // La premiere card .m-card-value sous une card avec titre commencant par
        // "Credit TVA" ou "TVA a reverser" est la valeur principale
        const cards = Array.from(document.querySelectorAll('.m-card'));
        let mainAmount = null;
        for (const c of cards) {
          const title = c.querySelector('.m-card-title')?.textContent || '';
          if (/cr[ée]dit\s*tva|tva\s*[àa]\s*reverser/i.test(title)) {
            mainAmount = c.querySelector('.m-card-value')?.textContent?.trim() || null;
            break;
          }
        }
        return { moisVal, mainAmount };
      });
    };

    const initial = await lireEtat();
    expect(initial.moisVal, 'Selecteur mois TVA absent').toBeTruthy();
    // mainAmount peut etre null si franchise en base (test indeterminable)
    test.skip(initial.mainAmount === null, 'Mode franchise en base : pas de valeur TVA a comparer');

    // Choisir un mois different : mois precedent (toujours dispo dans les 12 mois)
    const autreMois = await page.evaluate((current) => {
      const select = document.getElementById('m-tva-mois');
      if (!select) return null;
      const opts = Array.from(select.options).map(o => o.value);
      const cible = opts.find(v => v !== current);
      return cible || null;
    }, initial.moisVal);
    expect(autreMois, '2eme mois introuvable dans le selecteur').toBeTruthy();

    // Switch vers autreMois
    await page.selectOption('#m-tva-mois', autreMois);
    // Re-render async (M.go dans setTimeout 16ms + pull async)
    await page.waitForFunction(
      (m) => document.getElementById('m-tva-mois')?.value === m,
      autreMois,
      { timeout: 5000 }
    );
    await page.waitForTimeout(1500);

    // Retour au mois initial
    await page.selectOption('#m-tva-mois', initial.moisVal);
    await page.waitForFunction(
      (m) => document.getElementById('m-tva-mois')?.value === m,
      initial.moisVal,
      { timeout: 5000 }
    );
    await page.waitForTimeout(1500);

    const apres = await lireEtat();
    expect(apres.moisVal).toBe(initial.moisVal);
    // Le coeur du test : la valeur affichee doit etre la MEME
    expect(apres.mainAmount,
      `Bug TVA mobile : valeur instable. Initial="${initial.mainAmount}" / Apres aller-retour="${apres.mainAmount}"`
    ).toBe(initial.mainAmount);
  });
});
