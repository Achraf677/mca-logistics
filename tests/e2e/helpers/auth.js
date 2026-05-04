// @ts-check
/**
 * Helpers d'authentification reutilisables pour les tests Playwright.
 *
 * Convention : credentials d'env vars (ADMIN_EMAIL/ADMIN_PASSWORD,
 * CHAUFFEUR_EMAIL/CHAUFFEUR_PASSWORD). Si absents, le test parent doit faire
 * test.skip() — l'helper jette une erreur si appelé sans credentials.
 *
 * NOTE noms : ADMIN_EMAIL et CHAUFFEUR_EMAIL portent un nom historique trompeur.
 * Le champ login.html (#login-identifiant) accepte un IDENTIFIANT generique :
 *   - admin : peut etre un email OU un nom d'utilisateur (ex: "Mohammed.chikri")
 *   - chauffeur : un matricule (ex: "CHIKRI")
 * Les variables d'env restent ADMIN_EMAIL/CHAUFFEUR_EMAIL pour ne pas casser
 * la config GitHub Secrets existante, mais peuvent contenir n'importe quel
 * identifiant valide.
 *
 * Note securite : ne JAMAIS hardcoder de credentials ici.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHAUFFEUR_EMAIL = process.env.CHAUFFEUR_EMAIL;
const CHAUFFEUR_PASSWORD = process.env.CHAUFFEUR_PASSWORD;

export const hasAdminCreds = () => Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
export const hasChauffeurCreds = () => Boolean(CHAUFFEUR_EMAIL && CHAUFFEUR_PASSWORD);

// Selecteurs alignes avec login.html : champ identifiant unique (#login-identifiant)
// + champ password (#login-password) + submit (#login-submit "Se connecter").
const SEL_LOGIN_ID = '#login-identifiant';
const SEL_LOGIN_PWD = '#login-password';
const SEL_LOGIN_SUBMIT = '#login-submit';

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
  await page.fill(SEL_LOGIN_ID, ADMIN_EMAIL);
  await page.fill(SEL_LOGIN_PWD, ADMIN_PASSWORD);
  await page.click(SEL_LOGIN_SUBMIT);
  await page.waitForURL(/admin\.html|m\.html/, { timeout });
  if (opts.waitForReady !== false) {
    // Laisse les adapters Supabase s'initialiser (pull initial)
    await page.waitForFunction(
      () => typeof window.naviguerVers === 'function' || typeof window.MCAm?.go === 'function',
      null,
      { timeout: 10_000 }
    );
  }
}

/**
 * Login chauffeur → redirection vers /salarie.html ou /m.html selon device.
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
  await page.fill(SEL_LOGIN_ID, CHAUFFEUR_EMAIL);
  await page.fill(SEL_LOGIN_PWD, CHAUFFEUR_PASSWORD);
  await page.click(SEL_LOGIN_SUBMIT);
  // Salarie peut atterrir sur salarie.html (PC) ou m.html (mobile UA)
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
