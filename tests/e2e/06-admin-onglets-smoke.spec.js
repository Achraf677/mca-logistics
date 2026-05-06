// @ts-check
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminCreds } from './helpers/auth.js';

/**
 * Test E2E : smoke test sur TOUS les onglets admin.
 *
 * Pour chaque onglet (Dashboard, Livraisons, ..., TVA, Rentabilite, ...) :
 *  - On navigue via window.naviguerVers(id)
 *  - On verifie qu'aucune erreur console critique n'a ete remontee
 *  - On verifie qu'un texte cle de la page apparait
 *
 * AURAIT DETECTE LE BUG TVA mobile (et tout regression similaire qui ferait
 * planter le rendu d'un onglet).
 *
 * Ce test couvre la regression majeure : un onglet qui ne se rend pas
 * correctement (erreur JS, fonction absente, etc.).
 */

const PAGES = [
  { id: 'dashboard',     keyText: /Tableau de bord|Dashboard|CA|chiffre/i },
  { id: 'livraisons',    keyText: /Livraisons|livraison/i },
  { id: 'calendrier',    keyText: /Calendrier|calendrier/i },
  { id: 'planning',      keyText: /Planning|planning/i },
  { id: 'alertes',       keyText: /Alertes|alerte/i },
  { id: 'clients',       keyText: /Clients|client/i },
  { id: 'fournisseurs',  keyText: /Fournisseurs|fournisseur/i },
  { id: 'vehicules',     keyText: /V[ée]hicules|v[ée]hicule/i },
  { id: 'carburant',     keyText: /Carburant|carburant/i },
  { id: 'entretiens',    keyText: /Entretiens|entretien/i },
  { id: 'inspections',   keyText: /Inspections|inspection/i },
  { id: 'salaries',      keyText: /Salari[ée]s|salari[ée]/i },
  { id: 'heures',        keyText: /Heures|km/i },
  { id: 'incidents',     keyText: /Incidents|incident/i },
  { id: 'encaissement',  keyText: /Encaissement|encaiss/i },
  { id: 'charges',       keyText: /Charges|charge/i },
  { id: 'tva',           keyText: /TVA|d[ée]ductible|collect[ée]e/i },
  { id: 'rentabilite',   keyText: /Rentabilit[ée]|marge|b[ée]n[ée]fice/i },
  { id: 'statistiques',  keyText: /Statistiques|stats/i },
  { id: 'parametres',    keyText: /Param[èe]tres|param/i },
];

test.describe('Admin onglets — smoke test (chaque page rend sans erreur)', () => {
  test.skip(!hasAdminCreds(), 'ADMIN_EMAIL et ADMIN_PASSWORD requis');

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Laisse les adapters Supabase pull leurs donnees
    await page.waitForTimeout(2000);
  });

  for (const p of PAGES) {
    test(`onglet ${p.id} : pas d'erreur console + contenu visible`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push('pageerror: ' + err.message));
      page.on('console', msg => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // On filtre les bruits non bloquants : CSP, 404 reseau, hot-reload
        if (/CSP|Failed to load resource|net::|404|Refused to/i.test(text)) return;
        errors.push('console.error: ' + text);
      });

      const ok = await page.evaluate((id) => {
        if (typeof window.naviguerVers !== 'function') return false;
        window.naviguerVers(id);
        return true;
      }, p.id);
      expect(ok, 'window.naviguerVers manquant').toBe(true);

      // Attendre la zone visible (au moins une section .page visible)
      await page.waitForFunction(
        (id) => {
          const sec = document.getElementById('page-' + id) ||
                      document.querySelector(`section[id$='${id}']`);
          if (!sec) return true; // pages sans wrapper id (rare) -> on saute
          const style = getComputedStyle(sec);
          return style.display !== 'none' && style.visibility !== 'hidden';
        },
        p.id,
        { timeout: 5000 }
      ).catch(() => { /* tolere : certaines pages sont rendues differemment */ });

      // Attente courte pour le rendering async
      await page.waitForTimeout(800);

      // Verifie que le texte cle apparait quelque part dans le body
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText, `Texte cle introuvable pour ${p.id}`).toMatch(p.keyText);

      // Aucune erreur console critique
      expect(errors, `Erreurs console sur ${p.id}: ${errors.join(' | ')}`).toEqual([]);
    });
  }
});
