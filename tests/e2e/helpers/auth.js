// @ts-check
/**
 * Helpers d'authentification reutilisables pour les tests Playwright.
 *
 * Convention : on utilise des credentials d'env vars (ADMIN_EMAIL/ADMIN_PASSWORD,
 * CHAUFFEUR_EMAIL/CHAUFFEUR_PASSWORD). Si absents, le test parent doit faire
 * test.skip() — l'helper jette une erreur si appelé sans credentials.
 *
 * Note : ne JAMAIS hardcoder de credentials ici. Les tests qui peuvent fonctionner
 * sans Supabase doivent mocker via `mockSupabaseEmpty(page)`.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHAUFFEUR_EMAIL = process.env.CHAUFFEUR_EMAIL;
const CHAUFFEUR_PASSWORD = process.env.CHAUFFEUR_PASSWORD;

export const hasAdminCreds = () => Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
export const hasChauffeurCreds = () => Boolean(CHAUFFEUR_EMAIL && CHAUFFEUR_PASSWORD);

/**
 * Login admin → redirection vers /admin.html.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ waitForReady?: boolean, timeout?: number }} [opts]
 */
export async function loginAsAdmin(page, opts = {}) {
  if (!hasAdminCreds()) {
    throw new Error('loginAsAdmin: ADMIN_EMAIL / ADMIN_PASSWORD manquants. Skip ou set env vars.');
  }
  const timeout = opts.timeout ?? 15_000;
  await page.goto('/login.html');
  await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"], button:has-text("Connexion")');
  await page.waitForURL(/admin\.html/, { timeout });
  if (opts.waitForReady !== false) {
    // Laisse les adapters Supabase s'initialiser (pull initial)
    await page.waitForFunction(
      () => typeof window.naviguerVers === 'function',
      null,
      { timeout: 10_000 }
    );
  }
}

/**
 * Login chauffeur → redirection vers /salarie.html.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ waitForReady?: boolean, timeout?: number }} [opts]
 */
export async function loginAsChauffeur(page, opts = {}) {
  if (!hasChauffeurCreds()) {
    throw new Error('loginAsChauffeur: CHAUFFEUR_EMAIL / CHAUFFEUR_PASSWORD manquants.');
  }
  const timeout = opts.timeout ?? 15_000;
  await page.goto('/login.html');
  await page.fill('input[type="email"], input[name="email"]', CHAUFFEUR_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', CHAUFFEUR_PASSWORD);
  await page.click('button[type="submit"], button:has-text("Connexion")');
  // Salarie peut atterrir sur salarie.html ou m.html selon device
  await page.waitForURL(/(salarie|m)\.html/, { timeout });
}

/**
 * Force le device en "mobile" : ouvre directement /m.html en assumant la session
 * deja etablie par loginAsAdmin sur le meme contexte. Utile pour tester les
 * composants mobiles avec un compte admin (le mobile router est accessible aux
 * deux roles selon les pages).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function gotoMobileApp(page) {
  await page.goto('/m.html');
  // Attendre que l'app mobile soit prete (M.go expose)
  await page.waitForFunction(
    () => typeof window.M === 'object' && typeof window.M.go === 'function',
    null,
    { timeout: 15_000 }
  );
}

/**
 * Mock Supabase REST/Auth pour les tests offline (DB vide).
 * Toutes les requetes vers *.supabase.co retournent un tableau vide ou un
 * succes basique. Permet aux pages de se rendre sans dependance reseau.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockSupabaseEmpty(page) {
  await page.route('**/*.supabase.co/**', async route => {
    const url = route.request().url();
    if (url.includes('/auth/v1/')) {
      // Stub auth : refuse silencieusement (sera court-circuite par credentials inject)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      return;
    }
    if (url.includes('/rest/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (url.includes('/storage/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.continue();
  });
}
