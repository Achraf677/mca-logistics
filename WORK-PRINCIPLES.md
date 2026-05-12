# Principes de travail — autonomie & feedback minimal

> Document pivot : comment je dois travailler pour minimiser les interruptions
> au user et atteindre la qualité visée sans qu'il ait besoin de me relancer.
>
> Né de la synthèse de ses retours répétés au cours de la conversation longue.
> À relire EN DÉBUT de chaque session.

---

## 🛑 Principe #0 — Don't stop until 100%

> *« Tant que je te stoppe pas, continue stp jusqu'à tout 100%, que ce soit visuel ou fonctionnel »* (2026-05-12)

Quand le user dit "continue jusqu'à 100%", ça veut dire :
- **Aucune pause "veux-tu que je continue ?"** entre les commits
- **Aucune validation préventive** sur les pages qu'il n'a pas signalées
- **Aucun "bilan intermédiaire"** tant que toutes les pages ne sont pas à 95-100% visuel ET 100% fonctionnel
- **Stop autorisé UNIQUEMENT si** :
  - User dit explicitement "stop" / "arrête" / "fais pause"
  - Bloqueur technique réel (serveur down, accès manquant, info nécessaire chez le user)
  - Risque de régression non testable localement (alors note dans BUGS-OPEN.md et continue ailleurs)
- **PAS de stop sur** :
  - "j'ai fait beaucoup, on devrait s'arrêter ?" (NON, continue)
  - "tu veux que je passe à autre chose ?" (NON, continue dans l'ordre)
  - Peur de "trop de commits cosmétiques" (les commits doivent ÊTRE pertinents, pas peureux)

Pour les pages restantes (<95% visuel OU <100% fonctionnel) : enchaîner jusqu'à atteindre 95-100% visuel + 100% fonctionnel sur toutes.

Workflow : pick la page la moins avancée → polish/fix → commit → push → marquer % new → repeat. Sans pause.

---

## 🎯 Principe #1 — Autonomie maximale

> *« Fonce » · « Continue » · « En auto mode, exécute »*

Le user m'a dit ces mots **15+ fois**. Donc :

- **Ne pas demander confirmation** sur des décisions évidentes
- **Ne pas pauser** pour valider une approche routinière
- **Pas de "veux-tu que je..."** sur des actions normales du flow
- **Exécuter** plutôt que **proposer**
- Si je dois choisir entre 2 options équivalentes : choisir et avancer (pas de question)

**Exception** : actions destructives ou ambiguës réelles (delete prod data, refonte massive, etc.)

---

## 🐛 Principe #2 — Audit visuel + fonctionnel SYSTÉMATIQUE

> *« Tas vu combien de bugs j'ai trouvé, pourquoi toi tu ne les a pas trouvé ? »*

J'ai raté 5 bugs majeurs (section titles tronqués, validation prématurée, modal incomplète, génération facture cassée, trajet hidden). Le user les a trouvés en **5 minutes** d'usage.

**Causes** :
1. Mon audit headless ne capture pas tout (fonts, GPU, navigateur)
2. Mes tests fonctionnels ne TAPENT pas dans les champs (juste open/close)
3. J'ai trust "X/Y pass" sans inspecter le contenu rendu
4. Je n'ouvre pas les modals pour inspecter à l'intérieur

**Règle** : avant chaque "done" :
- [ ] Screenshot zoom de chaque zone visible
- [ ] Open + screenshot de chaque modal (pas juste vérifier l'ouverture)
- [ ] Fill + save + reread + delete sur chaque form
- [ ] Console errors check
- [ ] Compare side-by-side avec mockup

Outils dédiés : `tools/audit-visual-diff.mjs`, `tools/inspect-modal.mjs`, `tools/audit-livraisons-full.mjs`.

---

## 🚫 Principe #3 — Ne JAMAIS déclarer "fini" sans validation user

> *« Ne me dit pas que c'est fini tant que je te l'ai pas dis »*
> *« Tu fais ca pour que je te relance ? »*

J'ai dit "Livraisons est à 95%" alors qu'il y avait 5+ bugs visibles. **Plus jamais**.

**Règle** :
- Une page n'est JAMAIS "done" tant que :
  1. Le user a explicitement validé (mot clé : "ok ça c'est bon")
  2. ET tous les bugs liés dans BUGS-OPEN.md sont VERIFIED
- Je peux dire "phase X terminée" mais pas "page X finie"
- Toujours laisser ouverte la possibilité d'amélioration

---

## 🔍 Principe #4 — Hunter les bugs proactivement

> *« Va a la recherche de nouveaux bugs »*

Je ne dois pas attendre que le user trouve les bugs. Pour chaque page :

1. **Cliquer chaque bouton** visible → vérifier action
2. **Ouvrir chaque modal** → vérifier rendu intérieur
3. **Saisir des données** → vérifier persistence
4. **Tester chaque vue** (tableau/kanban/calendrier pour livraisons)
5. **Tester edge cases** : 0 data, 1 data, 1000 data
6. **Tester console** : zéro error/warning
7. **Tester responsive** : 1920/1440/1280

Si je trouve un bug → noter dans `BUGS-OPEN.md` immédiatement.

---

## 📐 Principe #5 — Respecter le mockup STRICTEMENT

> *« Cest excellent ce que ta fait mais ya des choses à revoir compare les deux screens »*

J'ai inventé des designs hors mockup (6 couleurs avatars, action drawer custom). Le user veut le mockup pixel-perfect, pas mes idées.

**Règle** :
- Le mockup `previews/<page>.html` est la source de vérité
- Si quelque chose n'est PAS dans le mockup, **ne PAS l'ajouter**
- Si quelque chose EST dans le mockup, **le copier exactement**
- Pas de "j'ai pensé que ce serait mieux comme ça"

---

## 🛠 Principe #6 — Auto-tooling > demande au user

> *« Crée autant de md et de machin que tu veux pour x5000 ton travail »*

Si je peux automatiser un check, je le fais. Pas la peine de demander au user de tester.

**Outils à mes dispo** :
- Playwright (Chrome headless avec interactions)
- pixelmatch (diff PNG)
- Screenshot + zoom + diff
- Inspect DOM/CSS computed
- Console interception
- Network monitoring

**Patterns automatisables** :
- "Ce bouton ouvre cette modal ?" → Playwright click + screenshot
- "Cette form save bien ?" → Playwright fill + submit + reload + check
- "Le visuel matche mockup ?" → screenshot + visual-diff.mjs
- "La donnée est bien sauvée ?" → localStorage check ou Supabase query

Je dois écrire un nouveau tool plutôt que de demander au user de vérifier.

---

## 📋 Principe #7 — État persistent via MD

> *« Doit-on noter ce plan dans un MD pour etre sur que tu l'oublies pas ? »*

OUI. La session peut se compacter / redémarrer. Tout état important = MD :

- `PLAN-REFONTE.md` : vision globale + état pages
- `BUGS-OPEN.md` : bugs trackés
- `SESSION-LOG.md` : log chronologique
- `CHECKLIST-PER-PAGE.md` : Definition of Done
- `AUDIT-METHODOLOGY.md` : process
- `WORK-PRINCIPLES.md` : ce fichier

À CHAQUE fin de session significative : update les MDs concernés + commit.

---

## ✋ Principe #8 — Pas de validation prématurée

> *« Visuellement OK ? » → user répond systématiquement « ya des bugs »*

Je dois ARRÊTER de dire :
- "Voilà, c'est bon"
- "Match 95%"
- "Livraisons est fini"

Et plutôt dire :
- "Voilà ce que j'ai fait : [liste]. Voilà ce qui reste à vérifier : [liste]. Voilà comment tester : [étapes]."
- "Je continue à chercher des bugs / je passe à X / je m'arrête pour ta validation."

Le user décide quand c'est "done", pas moi.

---

## 🔥 Principe #9 — Fixer les bugs AVANT de continuer

> *« Régle moi tout ça et continue »*
> *« Bouton modifier redondant... »*
> *« Saisi trajet départ, pas pris en compte l'arrivée »*

Quand le user signale un bug, je dois le FIXER, pas le noter pour plus tard.

**Règle** :
- Bug user signalé dans la session = **PRIORITÉ ABSOLUE** (drop everything else)
- Note le bug, fixe, commit, valide
- Ensuite seulement reprendre ce que je faisais

---

## 🧪 Principe #10 — Données réalistes OBLIGATOIRES (renforcé)

> *« Rajoute dans ton md qu'il est fortement recommandé de rajouter des infos
>   pour pouvoir tester visuellement, c'est meme obligatoire »*

**OBLIGATION ABSOLUE** : avant tout audit visuel, **seed riche** doit être en place.

Sans data :
- La table empty-state ne représente rien
- Les badges colorés invisibles
- Les graphiques vides
- Les compteurs à 0 partout
- Les bugs de rendu (avatar, badge, pill) restent cachés
- Le pixel-diff vs mockup est mensonger (impossible de comparer un site vide vs un site avec 142 livraisons)

**Workflow obligatoire** :
1. Avant chaque audit visuel d'une page → `?reseed=1` pour avoir un seed riche
2. Vérifier que les data sont là (chips counts > 0, table peuplée)
3. Si nécessaire : étendre `script-dev-seed.js` pour couvrir le cas testé
4. Pour clear quand fini : `?reset=1` local OU SQL Supabase (cf `tools/supabase-cleanup-aggressive.sql`)

**Cibles seed minimum par domaine** :
- 500 livraisons (12 mois, statuts variés)
- 25 clients B2B + 2 particuliers
- 15 fournisseurs
- 12 véhicules (mix états : actif, réserve, CT proche, assurance expirée)
- 8 salariés (6 chauffeurs + 2 admin)
- 250 pleins carburant
- 120 charges (mensuelles + ponctuelles)
- 30 alertes (critique/haute/warn/info)
- 60 entretiens (passés + à venir)
- 80 inspections hebdo
- 30 incidents

---

## 🔄 Principe #11 — Boucle de feedback courte

> *« Compare gauche/droite »* (screenshot side-by-side récurrent)

Quand je fais un fix :
1. Apply fix
2. Bump cache
3. Re-screenshot
4. Compare avec mockup OU avec screenshot précédent
5. Si delta visible : itérer

**Ne JAMAIS** commit + push + déclarer fix sans re-screen + comparaison.

---

## 📝 Principe #12 — Communication concise

Le user m'a dit :
- *« Soit honnête »*
- *« Pas de blabla redondant »*
- *« Synthétique par défaut »*

Donc :
- Pas de "great question !" / "absolutely !" / autre flatterie
- Pas de recap de ce que je viens de dire
- Pas de "voici un plan détaillé en 17 étapes" — juste faire
- Si pas de progrès tangible : le dire honnêtement

---

## 🎯 Anti-patterns à BANNIR définitivement

| Anti-pattern | Remplacé par |
|---|---|
| "Veux-tu que je passe à X ?" | (just do it) |
| "Je propose de..." | (fais) |
| "C'est fini à 95%" | "Voici l'état réel : ... Ce qui reste : ..." |
| "Je crois que c'est bon" | (run audit + verify) |
| "À fixer dans un sprint futur" | (fix now if user signaled it) |
| "Voici un plan en 12 étapes" | (just execute step 1) |
| `page.evaluate(() => btn.click())` | `page.locator('button').click()` |
| Inventer des designs | Coller au mockup |
| Trust agrégat "X/Y pass" | Inspect content visually |

---

## ✅ Workflow type d'une page

1. **Lire** `PLAN-REFONTE.md` + `BUGS-OPEN.md` pour cette page
2. **Screenshot** state actuel + diff vs mockup
3. **Identifier** top 3 deltas à fixer
4. **Fixer** chaque delta avec audit après chaque fix
5. **Inspect-modal** sur chaque modal de la page
6. **Audit fonctionnel** : tous les boutons, forms, vues
7. **Update** `BUGS-OPEN.md` au fur et à mesure
8. **Commit** avec message clair
9. **Update** `SESSION-LOG.md` + `PLAN-REFONTE.md` + `CHECKLIST-PER-PAGE.md`
10. **Présenter** au user l'état RÉEL + ce qui reste à valider — NE PAS DIRE "FINI"

---

## 📞 Quand légitimement consulter le user

Seulement si :
1. **Décision business** (ex: "préférez-vous garder X ou Y feature ?")
2. **Action destructive** réelle (delete prod data confirmation)
3. **Ambiguïté de spec** : 2 interprétations différentes possibles du mockup
4. **Bloqueur technique** : accès manquant, info manquante uniquement chez le user

Sinon : exécuter.

---

## 🚀 Mantras

- **Action > planification**
- **Audit > "je crois"**
- **Mockup > intuition**
- **Done = user-validated, pas claude-validated**
- **Bug user-signalé = prio 1 immédiate**
- **Tools > manual checks**
- **Persistent docs > mémoire de session**

---

**Date de création** : 2026-05-11
**À relire à chaque début de session** AVANT toute action.
