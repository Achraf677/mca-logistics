// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test E2E : flux de login admin
 *
 * Necessite des credentials admin dans les env vars :
 *   ADMIN_EMAIL=admin.achraf@mca-logistics.fr
 *   ADMIN_PASSWORD=...
 *
 * Lancer : ADMIN_EMAIL=... ADMIN_PASSWORD=... npx playwright test 01-login
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

test.describe('Login admin', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test('login → admin.html accessible', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page).toHaveTitle(/MCA Logistics/i);

    // Remplir le formulaire de login (selecteurs a adapter selon le HTML reel)
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Connexion")');

    // Attendre la redirection vers admin
    await page.waitForURL(/admin\.html/, { timeout: 10_000 });
    await expect(page).toHaveURL(/admin\.html/);

    // Verifier qu'on voit la sidebar / dashboard
    await expect(page.locator('body')).toContainText(/Tableau de bord|Dashboard|Livraisons/i);
  });

  test('mauvais password → erreur affichee', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', 'WRONG_PASSWORD_xxx');
    await page.click('button[type="submit"], button:has-text("Connexion")');

    // Doit rester sur login + afficher erreur
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login\.html/);
  });
});
