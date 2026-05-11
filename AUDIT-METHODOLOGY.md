# Méthodologie d'audit — MCA Logistics

> Cheatsheet à suivre AVANT de déclarer "done" sur une page.
> Méthode développée après avoir raté des bugs visibles (cf SESSION-LOG.md 2026-05-11).

---

## Pourquoi cette méthode

J'ai déclaré Livraisons "à 95%" alors que :
- Le statut col affichait "I" tronqué (pas vu)
- Le driver avatar avait des couleurs aléatoires (différent mockup)
- Les titres de section dans modal étaient tronqués (pas vu)
- La validation "Client est requis" s'affichait sans interaction (pas vu)
- Le trajet arrivée n'était pas saisissable (champ hidden, pas vu)

**Le user a trouvé ces bugs en 5 minutes d'usage réel.** Je dois changer ma méthode.

---

## Les 5 étapes obligatoires par page

### A — Audit visuel (15 min)

```bash
# 1. Screenshot full page
node tools/screenshot-<page>.mjs

# 2. Zooms par zone
node tools/audit-<page>.mjs

# 3. Pixel diff vs mockup
node tools/visual-diff.mjs screenshots/previews/<page>.png screenshots/local/<page>.png screenshots/diff/<page>.png
```

**Critère pass** : <5% pixel diff sur viewport 1440×900.

### B — Audit fonctionnel — boutons (10 min)

Pour CHAQUE bouton visible :
1. Hover → cursor pointer + hover state ?
2. Click → action déclenchée ?
3. Vérifier la console : pas d'erreur ?
4. Si modal ouverte : capture screenshot + vérifier contenu RENDU

```js
// Pattern Playwright
await page.locator('button:has-text("Générer")').click();
await expect(page.locator('.liv-dropdown-menu.open')).toBeVisible();
```

### C — Audit data flow — création (10 min)

Pour CHAQUE form de création :
1. Ouvrir la modal
2. Lister TOUS les champs visibles
3. Remplir CHAQUE champ avec une valeur de test
4. Submit
5. Re-ouvrir le détail créé
6. Vérifier que TOUS les champs sont relus correctement

**Critère pass** : 100% des champs save + relu = identique.

### D — Audit interaction modales (10 min)

Pour CHAQUE modal :
1. Ouvrir → AUCUN message d'erreur visible
2. Tab à travers les champs → focus visible partout
3. Saisir valeur invalide → message d'erreur AU BLUR (pas avant)
4. Submit vide → tous les "* requis" affichés
5. Submit valide → toast success + modal close + liste rafraîchie

### E — Audit console (5 min)

```js
// Pattern Playwright
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

// Après actions...
console.assert(consoleErrors.length === 0, 'Console errors detected: ' + consoleErrors.join('\n'));
```

**Critère pass** : 0 error 0 warning au chargement et à l'interaction.

---

## Anti-patterns à éviter

### ❌ "21/22 tests pass donc c'est bon"
**Problème** : si un test passe mais n'inspecte pas le contenu visuel, c'est un faux positif.
**Solution** : chaque test doit avoir UN screenshot ou UN assertion sur le rendu.

### ❌ `page.evaluate(() => btn.click())`
**Problème** : ne déclenche pas tous les events natifs (focus, mousedown, etc.).
**Solution** : `await page.locator('button').click()` qui mime un vrai utilisateur.

### ❌ Inventer des designs (6 couleurs avatars, action drawer custom)
**Problème** : drift par rapport au mockup.
**Solution** : si pas dans le mockup, ne pas l'ajouter. Si dans le mockup, copier strictement.

### ❌ Trust ad-hoc "je crois que c'est fixé"
**Problème** : sans re-audit, le bug persiste.
**Solution** : marquer FIXED dans BUGS-OPEN.md SEULEMENT après run de l'audit.

### ❌ Modifier 2 modals séparément (new vs edit)
**Problème** : divergence inévitable.
**Solution** : extraire les champs dans un partial réutilisable, injecté par JS.

---

## Outils à utiliser

| Outil | Usage |
|---|---|
| `tools/screenshot-<page>.mjs` | Screenshot Playwright + capture |
| `tools/audit-<page>.mjs` | Tests fonctionnels + screenshots zoomés |
| `tools/visual-diff.mjs` | Pixel diff via pixelmatch |
| `tools/compare-<page>.html` | Side-by-side iframes mockup + admin |
| `screenshots/previews/` | Mockups de référence |
| `screenshots/local/` | Renders du current state |
| `screenshots/diff/` | Outputs des diffs |
| `BUGS-OPEN.md` | Tracker bug live |
| `SESSION-LOG.md` | Log session |
| `PLAN-REFONTE.md` | Plan global |

---

## Definition of Done

Une page est OFFICIELLEMENT "FAITE" quand :

- [ ] Visuel : screenshot 1440×900 vs mockup → <5% pixel diff
- [ ] Visuel : screenshot 1920×1080 → propre
- [ ] Visuel : screenshot 1280×768 → responsive OK
- [ ] Fonctionnel : tous boutons cliquables → action réelle (pas alert TODO)
- [ ] Data : create → relire → modifier → relire → delete = OK
- [ ] Modales : champs visibles, validation au bon moment, save OK
- [ ] Console : 0 error 0 warning
- [ ] BUGS-OPEN.md : tous les bugs liés à la page en statut VERIFIED
- [ ] Commit : message clair listant ce qui a été fait
- [ ] PLAN-REFONTE.md : statut page mis à jour

Sans ces critères : la page reste en "WIP" peu importe ce que je pense.
