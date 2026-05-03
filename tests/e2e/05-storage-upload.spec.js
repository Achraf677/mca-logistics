// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Test E2E : verifier qu'un fichier upload Storage est accessible apres
 * (signed URL fonctionne).
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

test.describe('Storage Supabase', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test('signed URL fonctionnelle pour bucket prive', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Connexion")');
    await page.waitForURL(/admin\.html/, { timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Test : upload un blob test puis retrouve la signed URL
    const result = await page.evaluate(async () => {
      if (!window.DelivProStorage) return { ok: false, error: 'DelivProStorage absent' };

      // Cree un blob test (1x1 pixel PNG)
      const png = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
      const arr = new Uint8Array(png.length);
      for (let i = 0; i < png.length; i++) arr[i] = png.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/png' });

      const path = 'test-e2e/' + Date.now() + '_pixel.png';
      // Upload dans inspections-photos (bucket prive depuis migration 027,
      // on lit via signed URL).
      const up = await window.DelivProStorage.uploadBlob('inspections-photos', path, blob, { contentType: 'image/png' });
      if (!up.ok) return { ok: false, step: 'upload', error: up.error?.message };

      // Recupere signed URL
      const signed = await window.DelivProStorage.getSignedUrl('inspections-photos', path, 60);
      if (!signed.ok) return { ok: false, step: 'signed', error: signed.error?.message };

      // Cleanup
      await window.DelivProStorage.remove('inspections-photos', path);

      return { ok: true, signedUrl: signed.signedUrl };
    });

    expect(result.ok).toBe(true);
    expect(result.signedUrl).toMatch(/^https:\/\/.*\.supabase\.co/);
  });
});
