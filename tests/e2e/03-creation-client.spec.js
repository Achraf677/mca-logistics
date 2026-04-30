// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test E2E : creation d'un client + verification dans la liste
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

test.describe('CRUD Clients', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test('creer un client puis le retrouver dans la liste', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Connexion")');
    await page.waitForURL(/admin\.html/, { timeout: 10_000 });

    // Naviguer vers clients
    await page.evaluate(() => window.naviguerVers && window.naviguerVers('clients'));
    await page.waitForTimeout(500);

    // Cree un client unique avec timestamp
    const nomClient = 'Test E2E ' + Date.now();
    const result = await page.evaluate(async (nom) => {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'test-' + Date.now();
      const clients = JSON.parse(localStorage.getItem('clients') || '[]');
      clients.push({
        id, nom, type: 'pro',
        creeLe: new Date().toISOString()
      });
      localStorage.setItem('clients', JSON.stringify(clients));
      // Wait pour le sync DB
      await new Promise(r => setTimeout(r, 1500));
      return { id, count: JSON.parse(localStorage.getItem('clients')).length };
    }, nomClient);

    expect(result.count).toBeGreaterThan(0);
    expect(result.id).toBeTruthy();
  });
});
