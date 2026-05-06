# Tests MCA Logistics

Deux familles de tests :

- **`business-rules.test.js`** + **`financial-regressions.test.js`** : tests
  unitaires Node natif (`node --test`). Couvrent les regles metier pures (TVA,
  rentabilite, calculs financiers). Lances dans la CI a chaque push.

- **`e2e/*.spec.js`** : tests end-to-end Playwright. Couvrent les parcours
  utilisateurs critiques (login, navigation admin, simulateur, saisies
  chauffeur). Lances en PR et au merge sur `main`.

## Lancer en local

### Tests unitaires (rapides, pas de browser)

```bash
npm test
```

### Tests E2E (Playwright)

Premiere fois : installer les browsers (Chromium + WebKit pour le mobile).

```bash
npm run test:e2e:install
```

Lancer toute la suite :

```bash
npm run test:e2e
```

Lancer un fichier specifique :

```bash
npx playwright test tests/e2e/06-admin-onglets-smoke.spec.js
```

### Mode UI (debug visuel)

Pour debugger interactivement (timeline, screenshots, replay) :

```bash
npm run test:e2e:ui
```

Pour voir les browsers s'animer pendant l'execution (sans le mode UI) :

```bash
npx playwright test --headed
```

### Avec credentials (tests authentifies)

Les tests qui necessitent un login utilisent des env vars. Sans ces vars, ils
sont automatiquement `skip` (pas d'erreur).

```bash
ADMIN_EMAIL=admin.achraf@mca-logistics.fr \
ADMIN_PASSWORD='...' \
CHAUFFEUR_EMAIL='...' \
CHAUFFEUR_PASSWORD='...' \
npx playwright test
```

### Tester contre une autre URL

Par defaut les tests pointent sur la branche preview Cloudflare Pages
(`https://claude-add-supabase-mcp-cube.mca-logistics.pages.dev`). Pour tester
en local ou sur prod :

```bash
BASE_URL=http://localhost:8080 npx playwright test
BASE_URL=https://app.mca-logistics.fr npx playwright test
```

## Inventaire des tests E2E

| Fichier | Couvre |
|---|---|
| `01-login.spec.js` | Flux login admin (succes + echec) |
| `02-admin-pages.spec.js` | Navigation admin sur 8 pages cles + watchdog |
| `03-creation-client.spec.js` | CRUD client (creation + persistance) |
| `04-multi-device-sync.spec.js` | Sync realtime entre 2 sessions admin |
| `05-storage-upload.spec.js` | Upload Supabase Storage + signed URL |
| `06-admin-onglets-smoke.spec.js` | Smoke test sur **les 20 onglets admin** (aurait detecte le bug TVA) |
| `07-mobile-tva-stable.spec.js` | TVA mobile : valeur stable apres aller-retour de mois |
| `08-mobile-rentabilite-simulateur.spec.js` | Simulateur mobile : km/jour=100, prix=1.5, jours=20 → CA HT = 3000 € |
| `09-chauffeur-saisies-base.spec.js` | Chauffeur : saisie km debut + km fin → releve persiste |

## Helpers reutilisables

`tests/e2e/helpers/auth.js` :

- `loginAsAdmin(page, opts?)` — login admin → admin.html
- `loginAsChauffeur(page, opts?)` — login chauffeur → salarie.html ou m.html
- `gotoMobileApp(page)` — navigue sur /m.html en assumant la session active
- `mockSupabaseEmpty(page)` — intercepte les calls Supabase et renvoie des
  tableaux vides (pour les tests qui n'ont pas besoin de DB reelle)
- `hasAdminCreds()` / `hasChauffeurCreds()` — booleens pour `test.skip()`

Exemple d'utilisation :

```javascript
import { test } from '@playwright/test';
import { loginAsAdmin, hasAdminCreds } from './helpers/auth.js';

test.skip(!hasAdminCreds(), 'ADMIN_EMAIL/PASSWORD requis');

test('mon scenario', async ({ page }) => {
  await loginAsAdmin(page);
  // ...
});
```

## Conventions

- **Selecteurs** : prefere `#id` ou `data-page="..."` plutot que classes CSS
  fragiles. Le code metier expose deja `window.naviguerVers(id)` sur admin et
  `window.M.go(page)` sur mobile — utilise-les.
- **Pas de `setTimeout` en attente** : utilise `page.waitForSelector`,
  `page.waitForFunction` ou `page.waitForURL`. Les `waitForTimeout` ne sont
  toleres qu'apres une action async non observable (ex : pull Supabase).
- **Pas de credentials en dur** : tout passe par env vars + `test.skip()` si
  manquant. Les CI secrets sont `PLAYWRIGHT_ADMIN_EMAIL`,
  `PLAYWRIGHT_ADMIN_PASSWORD`, `PLAYWRIGHT_CHAUFFEUR_EMAIL`,
  `PLAYWRIGHT_CHAUFFEUR_PASSWORD`.
- **Pas de dependance a la DB de prod** : les tests qui ecrivent doivent
  utiliser des donnees uniques (timestamp dans le nom) et idealement nettoyer
  apres eux. Pour les tests deterministes, mocker via `mockSupabaseEmpty`.
- **`test.fail()` pour les bugs connus non resolus** : si on ecrit un test
  pour un bug qui n'est pas encore fixe, marquer `test.fail()` (le test passe
  vert tant que le bug existe ; quand il est fixe, le retirer pour basculer
  en `test()`).
- **Erreurs console** : on whiteliste seulement CSP / 404 reseau / hot-reload.
  Toute autre `console.error` ou `pageerror` fait echouer le test.

## Ajouter un test

1. Cree `tests/e2e/NN-mon-scenario.spec.js` (NN = numero suivant).
2. Importe les helpers : `import { loginAsAdmin } from './helpers/auth.js';`
3. Skip explicitement si les conditions ne sont pas remplies
   (`test.skip(!hasAdminCreds(), ...)`).
4. Lance en local : `npx playwright test tests/e2e/NN-mon-scenario.spec.js`.
5. Mets a jour le tableau "Inventaire" ci-dessus.

## CI

Le workflow `.github/workflows/tests.yml` execute les tests E2E sur :

- chaque PR vers `main`
- declenchement manuel via "Run workflow" (UI GitHub Actions)

Les rapports Playwright (HTML + traces + videos d'echec) sont uploades en
artifact `playwright-report` (retention 14 jours).
