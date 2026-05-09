# Process anti-régression — MCA Logistics

> Pourquoi ce doc : Achraf en a marre de courir derrière les bugs (verbatim
> 2026-05-09 : *« ça me fait chier de courir derrière ces bugs. Faut qu'on
> trouve une solution ensemble »*). Ce doc décrit le process structurel mis
> en place pour minimiser les régressions.

Dernière mise à jour : 2026-05-09

---

## Constat

Sur les 37 PRs mergées les 8-9 mai 2026 :

- **2 régressions visuelles** ont survécu jusqu'à la prod (chevauchement chat
  FAB ↔ FAB livraison, sal-dropdown z-index 9999 trop haut), corrigées
  respectivement en hotfix R2 (PR #50) et R3 (PR #64).
- **1 régression fonctionnelle critique** : OCR PC supprimé par PR #34, restauré
  en hotfix R1 (821 lignes, PR #50).
- **3 bugs mobiles** signalés en bloc le 9 mai après la fin du sprint :
  bouton chatbot header non fonctionnel, route Brouillons IA "page inconnue",
  upload doc en double saisie.

Cause racine récurrente :

1. **Pas de validation visuelle live** — le visual-audit-daily tourne en
   lecture seule statique, ne clique pas, ne vérifie pas l'accessibilité des
   boutons après ouverture de drawer / sheet / panneau.
2. **Pas de smoke test E2E pré-merge** — les 9 specs Playwright skip
   silencieusement si secrets E2E absents (cf. CLAUDE.md sprint H2.2).
3. **Pas de canal de remontée bug structuré** — Achraf relaie tout en vocal
   ou texte libre, je perds le contexte technique (URL, version cache, console).
4. **Cache navigateur bloque la propagation des fixes** — un fix mergé peut ne
   pas atteindre Achraf si son cache n'est pas busté côté client.

---

## Solution en 4 piliers

### Pilier 1 — Bouton "📩 Signaler un bug" in-app

**Statut** : à implémenter (PR à venir, statut au 2026-05-09 : non démarrée).

**Objectif** : capturer le contexte technique automatiquement pour qu'Achraf
n'ait plus qu'à dire en 3 mots ce qu'il voit.

**Comportement** :

1. Bouton accessible depuis :
   - Header admin.html (à côté du badge agent IA)
   - Header m.html (à côté du badge agent IA)
   - Header salarie.html
2. Au clic → modal :
   - Champ libre "Décris le bug en 1 phrase" (obligatoire)
   - Capture auto : URL courante, navigateur, viewport, version cache
     (`localStorage.getItem('mca-cache-version')` ou extraction sw.js),
     dernier état console (capturé via `console.error` listener), screenshot
     DOM (via html2canvas si dispo, sinon skip)
3. Submit → ouvre une issue GitHub via edge function `bug-report-submit`
   (nouvelle), labellisée `bug-user-report` + assignée `@claude`.
4. L'issue déclenche une notification (subscribe_pr_activity côté Claude).

**Charge** : ~6 h (1 edge function + composant front + tests).

### Pilier 2 — Smoke E2E avant merge (bloquant CI)

**Statut** : à implémenter.

**Objectif** : faire échouer la CI si un bouton critique devient inaccessible
ou si un drawer/sheet ne s'ouvre pas.

**Comportement** :

- Workflow `.github/workflows/e2e-smoke.yml` déclenché sur pull_request.
- Test Playwright unique (~2 minutes) qui :
  1. Login admin → vérifie présence dashboard
  2. Clique badge agent IA → vérifie panneau ouvert
  3. Clique chat FAB / header chat → vérifie panneau chat ouvert
  4. Clique drawer "Plus" → vérifie présence Brouillons IA
  5. Clique Brouillons IA → vérifie page rendue (non "page inconnue")
  6. Test mobile viewport 375×812 → vérifie aucun élément `data-fab`
     overlap avec un autre `data-fab`
- Échec CI si l'un des steps fail.
- Secrets requis : `PLAYWRIGHT_ADMIN_EMAIL`, `PLAYWRIGHT_ADMIN_PASSWORD`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY` — déjà configurés pour visual-audit
  (cf. `docs/visual-agent.md`).
- Si secrets absents → workflow `error` (pas `skipped`), pour ne pas masquer
  l'absence de coverage.

**Charge** : ~3 h.

### Pilier 3 — Visual-audit interactif

**Statut** : v1 livré (PR #48), v2 à étendre.

**Objectif actuel v1** : screenshots statiques 25 routes × 2 viewports, audit
GPT-4 Vision, ouverture issue GitHub si critical.

**Extension v2 à livrer** :

- Ajouter un mode "interactif" : pour chaque route, le worker Playwright
  exécute une séquence (ouvrir drawer, ouvrir sheet, scroll bas, clic FAB) et
  prend un screenshot APRÈS chaque interaction.
- Détecter automatiquement les chevauchements :
  - Bounding box overlap entre deux éléments `position: fixed` ou `position: absolute`
  - Boutons clickable `display:none` ou `visibility:hidden` avec `pointer-events: auto` (faux positif z-index masqué)
- Si overlap détecté → mention `@claude` dans l'issue rolling pour
  déclenchement automatique.

**Charge** : ~4 h.

### Pilier 4 — Cache busting forcé côté client

**Statut** : à implémenter.

**Objectif** : éliminer le scénario "le fix est mergé mais Achraf ne le voit
pas car son cache n'est pas busté".

**Comportement** :

- Bouton "🔄 Vider le cache et recharger" dans Paramètres mobile + admin
- Au clic :
  ```js
  await caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  localStorage.removeItem('mca-cache-version'); // force re-init
  window.location.reload(true);
  ```
- Visible dans le drawer "Plus" mobile + dans la section Paramètres PC.
- Combiné avec le `CACHE_VERSION` bump auto dans le PR template, ça garantit
  qu'au prochain reload, l'utilisateur a la dernière version.

**Charge** : ~1 h.

---

## Workflow Achraf → Claude (cible)

1. Achraf voit un bug → clic bouton "📩 Signaler un bug" → 1 phrase + submit.
2. Issue GitHub créée auto avec contexte tech complet.
3. Webhook subscribe_pr_activity → Claude notifié.
4. Claude ouvre une PR fix dans la foulée, déclenche smoke E2E + visual-audit.
5. Si CI verte → merge auto (auto-merge).
6. Au prochain login d'Achraf, sw.js sert la nouvelle `CACHE_VERSION`,
   `monitoring.js` extrait la version, plus de stale cache.
7. Achraf clique "🔄 Vider le cache" si jamais visible-mais-pas-pris.

**Cible** : passer de "Achraf ping Claude en vocal → Claude demande
clarifications → Claude grep le code → Claude livre fix → Achraf re-test
manuellement" à "Achraf clique 📩 → Claude livre fix → Achraf re-test".

---

## Checklist PR

Inclus dans `.github/PULL_REQUEST_TEMPLATE.md` (créé en même temps que ce doc).
Garde-fou minimal :

- Cache busting fait
- Tests passants
- Validation visuelle locale (PC + mobile émulation)
- Pas de secret leak
- Plan de test pour le reviewer

---

## Pointeurs

- Visual-agent : `docs/visual-agent.md`
- Roadmap : `docs/10-roadmap-backlog.md`
- Architecture : `docs/02-architecture.md`
- Notes Claude : `CLAUDE.md`
