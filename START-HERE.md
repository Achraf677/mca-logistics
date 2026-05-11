# START-HERE — Prompt unique pour Claude

> Copie-colle CE prompt en début de chaque session. Il déclenche le mode autonome.

---

## Prompt à coller (sélectionne tout entre les `---`)

---

Tu reprends la refonte HTML MCA Logistics en MODE AUTONOME TOTAL.

LIS DANS L'ORDRE :
1. WORK-PRINCIPLES.md (constitution — applique les 12 principes)
2. BUGS-OPEN.md (bugs à traiter en priorité)
3. PLAN-REFONTE.md (vision)
4. CLAUDE.md (rappels projet)

ENSUITE EXÉCUTE EN BOUCLE sans me poser de question :

1. Pick le bug 🔴 NEW le plus en haut de BUGS-OPEN.md (par ordre BUG-001 → BUG-005 → suivants)
2. Reproduis-le via `tools/audit-fill-form.mjs` ou `tools/inspect-modal.mjs` (saisie réelle, pas juste open)
3. Fixe-le (CSS / JS / HTML selon le cas)
4. Bump CACHE_VERSION dans sw.js
5. Re-screenshot + diff vs mockup `previews/<page>.html`
6. Update BUGS-OPEN.md : NEW → FIXED
7. Commit `fix(BUG-XXX) — description`
8. Push si demandé, sinon continue

QUAND TOUS LES BUGS NEW SONT FIXED :
- Pick la prochaine page de PLAN-REFONTE.md non-DONE
- Workflow type page (voir WORK-PRINCIPLES.md section "Workflow type")

RÈGLES ABSOLUES :
- NE ME DEMANDE JAMAIS "veux-tu que..."
- NE DÉCLARE JAMAIS "fini" — dis "voici l'état, voici ce qui reste à valider"
- DATA SEED RICHE OBLIGATOIRE avant chaque audit visuel (`?reseed=1`)
- Saisie RÉELLE Playwright, pas open/close
- Mockup = source de vérité, pas mes idées
- Bug que je signale en session = priorité 1 immédiate
- Update les MD à chaque commit significatif

Démarre maintenant par la lecture des 4 MD puis attaque BUG-001.

---

## Si je t'interromps pour signaler un bug

Note-le dans BUGS-OPEN.md immédiatement, fixe-le AVANT de reprendre où tu en étais. Pas de "à plus tard".

## Si tu veux loop autonome cloud (survit fermeture session)

Tape `/schedule chaque heure relance le prompt START-HERE` après avoir collé le prompt ci-dessus.

## Si tu veux loop local rapide (60s mais meurt à la fermeture)

Tape `/loop continuer refonte selon START-HERE.md 60s` après avoir collé le prompt.

---

## Checklist pre-session (toi à faire)

- [ ] `shift+tab` jusqu'à `auto-accept edits on` (sinon je suis bloqué)
- [ ] Vérifier que Live Server tourne sur `http://127.0.0.1:5500`
- [ ] Coller le prompt ci-dessus
- [ ] Aller boire un café, je bosse
