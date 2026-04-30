// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test E2E : sync realtime entre 2 sessions admin (multi-device)
 *
 * Ouvre 2 contextes navigateur distincts, login admin sur chacun, modifie
 * un client sur l'un, verifie qu'il apparait sur l'autre via realtime.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

test.describe('Realtime sync multi-device', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test('creation client sur session A → visible sur session B', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // Login sur A et B
    for (const p of [pageA, pageB]) {
      await p.goto('/login.html');
      await p.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
      await p.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
      await p.click('button[type="submit"], button:has-text("Connexion")');
      await p.waitForURL(/admin\.html/, { timeout: 10_000 });
      await p.waitForTimeout(2000); // laisser les adapters s'initialiser
    }

    // Compter clients sur B avant
    const countBefore = await pageB.evaluate(() => {
      return JSON.parse(localStorage.getItem('clients') || '[]').length;
    });

    // Creer un client sur A
    const nomUnique = 'SyncTest ' + Date.now();
    await pageA.evaluate(async (nom) => {
      const id = crypto.randomUUID();
      const clients = JSON.parse(localStorage.getItem('clients') || '[]');
      clients.push({ id, nom, type: 'pro', creeLe: new Date().toISOString() });
      localStorage.setItem('clients', JSON.stringify(clients));
    }, nomUnique);

    // Attendre la propagation realtime (max 5s)
    await pageB.waitForTimeout(5000);

    const foundOnB = await pageB.evaluate((nom) => {
      const clients = JSON.parse(localStorage.getItem('clients') || '[]');
      return clients.some(c => c.nom === nom);
    }, nomUnique);

    expect(foundOnB).toBe(true);

    await ctxA.close();
    await ctxB.close();
  });
});
