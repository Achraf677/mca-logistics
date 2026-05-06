// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsChauffeur, hasChauffeurCreds } from './helpers/auth.js';

/**
 * Test E2E : saisie km debut + km fin par un chauffeur.
 *
 * Cas reel : un chauffeur ouvre /salarie.html, renseigne son km de depart,
 * fait sa tournee, puis renseigne le km d'arrivee. La saisie doit etre
 * persistee localement (localStorage) avant push Supabase.
 *
 * Strategie :
 *   1. Login chauffeur (skip si credentials non fournis)
 *   2. Verifier qu'on est bien sur salarie.html (ou m.html)
 *   3. Lire le compteur de releves km AVANT
 *   4. Saisir kmDepart via les inputs UI ; cliquer "Km départ"
 *   5. Saisir kmArrivee ; cliquer "Km retour"
 *   6. Verifier qu'un nouvel enregistrement est present + distance > 0
 *
 * Si l'app charge en mode m.html (mobile router), on bascule sur la saisie
 * mobile via M.go('heures') + M.openSheet — fallback en dehors du scope ici,
 * on skip dans ce cas.
 */

test.describe('Chauffeur — saisie km debut/fin', () => {
  test.skip(!hasChauffeurCreds(),
    'CHAUFFEUR_EMAIL et CHAUFFEUR_PASSWORD requis (mocker n\'est pas suffisant : Supabase Auth requis)');

  test('saisie km debut puis km fin → releve persiste avec distance correcte', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push('pageerror: ' + err.message));

    await loginAsChauffeur(page);

    // Verifier qu'on est bien dans l'espace salarie classique (UI desktop).
    // Sur device mobile, l'app peut atterrir sur m.html — dans ce cas on skip
    // (le test mobile a son propre flow de saisie via M.openSheet).
    const url = page.url();
    test.skip(/m\.html/i.test(url),
      'Device mobile detecte : flow de saisie km mobile non couvert par ce test');

    // Attendre que la page chauffeur soit prete
    await page.waitForSelector('#km-depart, input[id*=km]', { timeout: 10_000 });

    // Compter les releves AVANT
    const before = await page.evaluate(() => {
      const sal = window.salarieCourant;
      if (!sal?.id) return null;
      const key = 'km_sal_' + sal.id;
      return JSON.parse(localStorage.getItem(key) || '[]').length;
    });
    test.skip(before === null, 'salarieCourant non expose : impossible de compter les releves');

    // Generer un km de depart unique (timestamp pour eviter collision avec un releve existant)
    const baseKm = 100000 + Math.floor(Math.random() * 1000);
    const kmDepart = baseKm;
    const kmFin = baseKm + 42; // distance attendue : 42 km

    // Saisir km depart + cliquer btn-km-depart (ou submit sans bouton specifique)
    const departInput = page.locator('#km-depart');
    if (await departInput.count() === 0) test.skip(true, 'Input #km-depart absent');

    await departInput.fill(String(kmDepart));

    // Si un bouton km-depart existe, le cliquer ; sinon on appelle la fonction directement
    const btnDepart = page.locator('#btn-km-depart');
    if (await btnDepart.count() > 0) {
      await btnDepart.click();
    } else {
      await page.evaluate(() => {
        if (typeof window.enregistrerKmDepart === 'function') window.enregistrerKmDepart();
      });
    }
    await page.waitForTimeout(500);

    // Saisir km fin + cliquer btn-km-retour
    await page.fill('#km-arrivee', String(kmFin));
    const btnRetour = page.locator('#btn-km-retour');
    if (await btnRetour.count() > 0) {
      await btnRetour.click();
    } else {
      await page.evaluate(() => {
        if (typeof window.enregistrerKmFin === 'function') window.enregistrerKmFin();
      });
    }
    await page.waitForTimeout(500);

    // Verifier qu'un nouveau releve est present avec la bonne distance
    const after = await page.evaluate(() => {
      const sal = window.salarieCourant;
      const key = 'km_sal_' + sal.id;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      // Le dernier ajout : trier par creeLe desc et prendre le 1er termine
      const termines = list.filter(e => e.kmArrivee != null);
      const last = termines[termines.length - 1] || null;
      return { count: list.length, last };
    });

    expect(after.count, 'Aucun releve n\'a ete enregistre').toBeGreaterThan(before);
    expect(after.last, 'Releve termine introuvable').toBeTruthy();
    expect(after.last.kmDepart).toBe(kmDepart);
    expect(after.last.kmArrivee).toBe(kmFin);
    expect(after.last.distance).toBe(kmFin - kmDepart);

    // Aucun crash JS pendant le scenario
    expect(errors, `Erreurs JS pendant saisie km: ${errors.join(' | ')}`).toEqual([]);
  });
});
