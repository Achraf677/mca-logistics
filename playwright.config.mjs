import { defineConfig, devices } from '@playwright/test';

/**
 * MCA Logistics — Configuration Playwright pour tests E2E
 *
 * Pour lancer les tests :
 *   npx playwright install        # installe les browsers la 1ere fois
 *   npx playwright test            # lance tous les tests
 *   npx playwright test --headed   # avec UI visible
 *   npx playwright test --ui       # mode interactif
 *
 * Tests : verifient les flux critiques de l'app (login, navigation, CRUD).
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.BASE_URL || 'https://claude-add-supabase-mcp-cube.mca-logistics.pages.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
