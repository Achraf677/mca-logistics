# Audit Onglet par Onglet — Reste à faire

> **Source unique de vérité** consolidée depuis le plan v9 audit 8 agents (2026-05-16 17h59) +
> tous les TODO/audits précédents (désormais supprimés — leur contenu est ici).
>
> **Règle stricte** : on attaque onglet par onglet, dans l'ordre listé ci-dessous.
> Aucun ajout en cours de route. Aucune dispersion. Si un item ici est en réalité déjà
> fait, on le coche et on passe au suivant — on ne s'éparpille pas sur du polish hors liste.
>
> Statut : `[ ]` = TODO · `[x]` = DONE · `[~]` = partiel (à finir)
> Source : agent du plan v9 (A à H) entre crochets.

---

## 🚀 État courant (CLÔTURÉ 2026-05-17 — fin audit refonte HTML PC)

- **Branche** : `claude/html-refonte-cleanup`
- **CACHE_VERSION en cours** : `v417` (voir `sw.js` ligne 8)
- **Onglets PC terminés** (21 onglets ✅ + 1 [~]) :
  - ✅ Onglet 1 Livraisons (15 items + 5 bugs screenshots user)
  - ✅ Onglet 2 Dashboard (4 items + bug Retard sur brouillons + barre Retard retirée + tooltips chart €)
  - ✅ Onglet 3 Calendrier (3 items + couleurs légende alignées + police Syne→DM Sans + topbar bas alignée logo sidebar)
  - ✅ Onglet 4 Planning (4 items : clé canonique `plannings`, migration boot R10, normalizeAbsence + migration boot R11, 10 tests unitaires ajoutés)
  - ✅ Onglet 5 Alertes (2 items déjà résolus en Phase 91.42 + 91.85, vérifications faites)
  - ✅ Onglet 6 Clients (2 items déjà résolus en Sprint 25, vérifications faites)
  - ✅ Onglet 7 Fournisseurs (2 items déjà résolus en Sprint 25, vérifications faites)
  - ✅ Onglet 8 Véhicules (1 item déjà résolu en Sprint 21, vérification faite)
  - ✅ Onglet 9 Carburant (0 item, checklist cross-tab OK)
  - ✅ Onglet 10 Entretiens (0 item, checklist cross-tab OK)
  - ✅ Onglet 11 Inspections (drawer 360 inspection livré + filtre véhicule + exports respectent filtres actifs)
  - ✅ Onglet 12 Équipe/Salariés (Sprint 20 drawer 360 + Sprint 22 hub Équipe déjà livrés)
  - [~] Onglet 13 Heures & Km REPORTÉ sprint dédié (décision user, workflow pointage mobile 2-3 jours hors périmètre)
  - ✅ Onglet 14 Incidents (drawer 360 incident livré + 2 items déjà résolus en Phase 91.42)
  - ✅ Onglet 15 Charges (2 items déjà résolus Phase 91.57)
  - ✅ Onglet 16 Encaissement (4 items déjà résolus Phase 91.42 + 91.58)
  - [~] Onglet 17 TVA partiel (bannière + chips déjà résolus Phase 91.59, refonte CA3 reportée sprint dédié)
  - ✅ Onglet 18 Rentabilité (2 items déjà résolus Phase 91.60 + 91.56)
  - ✅ Onglet 19 Statistiques (1 fix code source chauffeurs → salaries Supabase, 5 items déjà résolus)
  - ✅ Onglet 20 Paramètres (3 items déjà résolus Phase 91.55 + 91.62 + 91.63)
  - ✅ Onglet 21 Brouillons IA (0 item, checklist OK)
- **Onglets hors périmètre refonte HTML PC** (reportés sprints dédiés) :
  - [~] Onglet 22 Mobile m.html (13 items, sprint H2 mobile 2-3j)
  - [~] Onglet 23 salarie.html (9 items 🚨 BLOQUANT PROD, sprint dédié 2-3j priorité haute)
  - [~] Onglet 24 Transverse (8 chantiers ~3j cumulés, sprints H3 thématiques)
- **Tests** : 436 pass · 0 fail (`npm test`)
- **Sentry** : aucune erreur 24h (vérifié via MCP)

### Fin de l'audit refonte HTML PC

L'audit "Refonte HTML" est CLÔT côté périmètre PC (onglets 1-21). Les onglets 22-24
sortent du cadre HTML PC et sont rebasculés en sprints H2 (mobile) et H3 (transverse).
Aucun item bloquant n'est laissé en suspens côté PC.

Drawers 360 livrés en cours d'audit : Inspections (Onglet 11), Incidents (Onglet 14).
Phases déjà résolues vérifiées : 14, 25, 91.42, 91.55, 91.56, 91.57, 91.58, 91.59,
91.60, 91.61, 91.62, 91.63, 91.85 + BUG-022 toLocalISODate + Sprint 20/21/22/25.

---

## 🔍 Doublons détectés en cours de session

> **Règle CLAUDE.md (2026-05-17)** : avant toute vérif/modif, grep les patterns
> voisins pour détecter doublons préexistants (refonte HTML active = ancienne
> version coexiste souvent avec nouvelle). Logguer ici, consolider si trivial,
> sinon reporter en sprint dette tech (24.F).

### Polices d'écriture (audit 2026-05-17 sur demande user)

**Source de vérité unique** : `style-tokens.css:59-61`
- `--ds-font-display` = `"Syne", system-ui, -apple-system, sans-serif`
- `--ds-font-body` = `"DM Sans", system-ui, -apple-system, sans-serif`
- `--ds-font-mono` = `"JetBrains Mono", ui-monospace, Menlo, monospace`

**Aliases volontaires** : `style.css:93-95` expose `--font-display/body/mono`
qui pointent vers `--ds-*` (rétro-compat code existant), + `style.css:102` :
`--font: var(--font-body)` alias court.

**Chargement Google Fonts** :
- `admin.html:22` : Syne + DM Sans + JetBrains Mono ✅ (Phase 91.54 I.3)
- `m.html` : ❌ **AUCUNE** police Google chargée → fallback silencieux system-ui malgré usage de `--font-display` (m.html:25)
- `salarie.html` : ❌ **AUCUNE** police Google chargée + font-family hardcodée `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI'` (salarie.html:46) → bypass total design system
- `login.html` : utilise `--font: "Segoe UI"` locale (login.html:24) — intentionnel (page autonome avant chargement DS) mais drift visuel

**Doublons identifiés** :
1. `previews/tokens.css:43-45` + `design-handoff/colors_and_type.css:43-45` : copies des tokens fonts pour Figma handoff, NON chargés en prod mais peuvent dériver de la source de vérité `style-tokens.css`. **Action** : pinner les valeurs via commentaire `/* GENERATED — sync from style-tokens.css */` ou supprimer si Figma utilise déjà la source canonique.
2. `style.css:102` `--font: var(--font-body)` + `login.html:24` `--font: "Segoe UI"` : la même variable `--font` est définie 2× avec des valeurs différentes selon la page. Pas un bug (login est page autonome) mais à documenter.
3. `style-design-calendrier.css` : utilise les 2 formes mélangées : `var(--ds-font-body)` (lignes 14-200) ET `var(--ds-font-body, 'DM Sans', system-ui, sans-serif)` (lignes 77, 250, 308, 322, 330, 350, 462) — incohérence stylistique pas bug. Idem `style-design-clients-fournisseurs.css` (lignes 345-454).
4. `style-design-clients-fournisseurs.css:250,262,278` : utilise `var(--font-mono, 'DM Mono', monospace)` au lieu de `var(--ds-font-mono, 'JetBrains Mono', ...)`. **Fallback DM Mono incorrect** : la fallback list mentionne "DM Mono" qui n'existe pas (vraisemblablement confusion avec DM Sans). Sans incidence (var pointe bien vers JetBrains Mono via alias) mais à nettoyer.

**Drifts critiques mobile/chauffeur** → déjà capturés dans :
- Onglet 22 (Mobile parité) : pas de chargement Google Fonts dans m.html
- Onglet 23 (salarie.html migration Design System) : font-family hardcodée Apple/Segoe à remplacer par `var(--ds-font-body)` + ajout `<link>` Google Fonts

**Actions à prévoir (non bloquantes)** :
- [x] `m.html` : ajouter `<link rel="preconnect">` + `<link href="...DM Sans...">` *(Phase 91.71, fixé 2026-05-17 — commit suite)*
- [x] `salarie.html` : remplacer `font-family: -apple-system,...` ligne 46 par `var(--ds-font-body, 'DM Sans', system-ui, sans-serif)` + charger Google Fonts *(Phase 91.71, fixé 2026-05-17 — commit suite)*
- [ ] `previews/tokens.css` + `design-handoff/colors_and_type.css` : ajouter commentaire de synchro ou supprimer (24.F dette)
- [ ] `style-design-clients-fournisseurs.css:250,262,278` : remplacer `--font-mono, 'DM Mono'` par `--ds-font-mono, 'JetBrains Mono'` (24.F dette)

### Cartographie doublons + code mort (audit 3 agents 2026-05-17)

> Triple audit lancé sur demande user "détecte tous les doublons + codes morts du site"
> (3 agents Explore en parallèle : JS / CSS / orphelins-codemort). Tableau consolidé
> ci-dessous, ✅ = validé manuellement, ⚠️ = à valider, ❌ = faux positif.

#### A. Doublons JavaScript confirmés (HIGH)

| Fonction | Statut | Détail |
|---|---|---|
| `renderLivraisonsAdminFinal` | ⚠️ **2 défs conflictuelles + 4 wrappers** | `script-core-admin-final-lock-iife.js:38` (IIFE) vs `script-core-admin-final-lock.js:269` (`__renderLivraisonsAdminFinal_v2`). Race condition ordre chargement. Wrappers S7, S8, S9, `script-livraisons.js:1446`. → **24.F dette** |
| `fermerFiche360` | ⚠️ **2 défs anonymes sans guard** | `script-core-sprint20-rh360.js:196` (RH360) écrasé par `script-core-sprint21-parc360.js:158` (Parc360). Pas de wrapper, pas de flag. Mobile drawer 360 peut échouer silencieusement. → **24.F dette** ou H2.1 |
| `afficherToast` | ✅ **OK** | 1 def + 1 wrapper volontaire S10 (toasts stackés), pattern correct |
| `naviguerVers` | ✅ **OK** | 1 def + 6 wrappers volontaires (flags `__mbn`, `__s22Hooked`, ...) |
| `openModal` / `closeModal` | ✅ **OK** | 1 def chacune dans `script-core-ui.js:260/321` |
| Scripts chargés 2× HTML | ✅ **Aucun** | Vérifié `admin.html`, `m.html`, `salarie.html` |

#### B. Doublons CSS confirmés — candidats consolidation (24.F)

| Groupe | Fichiers | Action |
|---|---|---|
| **Livraisons** | `style-design-livraisons.css` (312l) + `style-design-livraisons-refonte.css` (682l, 106× `.livraisons-table`) + `style-design-livraisons-drawer.css` (401l) | Choisir UNE version avant merge main (refonte = nouveau) |
| **Modales** | `style-design-modal.css` (65 sel) + `style-design-modals-refine.css` (95 sel) — refine override avec `!important` | Merger refine → modal.css, supprimer refine |
| **Mobile** | `style-mobile.css` (759l) + `style-design-mobile-refine.css` (775l) — 14 sel `.m-*` overlap | Merger refine → mobile.css, supprimer refine |
| **Dashboard** | `style-design-dashboard.css` + `-charts.css` + `-finish.css` + `-hero.css` (4 fichiers) | Étudier chevauchement `.kpi-*`, `.hero-*` |
| **Topbar / tabs** | `style-design-shell.css` + `-topbar-refine.css` ; `style-design-modal.css` + `-tables-refine.css` | ✅ Override `!important` intentionnel, documenter dans header CSS |

⚠️ Faux positif vérifié : `style-design-mobile-refine.css` chargé **1×** dans `m.html` (pas 2× comme prétendu par agent).

#### C. CSS handoff Figma (LOW — doc seulement)

| Fichier | Action |
|---|---|
| `previews/tokens.css` (43l), `previews/modals-shared.css` (151l), `design-handoff/colors_and_type.css` | Ajouter en tête : `/* GENERATED — Figma handoff, non chargé en prod, ne pas dériver */` |

#### D. Code mort JS suspecté (à valider avant suppression)

Fonctions définies dans le repo avec **0 caller détecté** :

| Fonction | Fichier:ligne | Note validation |
|---|---|---|
| `s26SaveFactureMontant` / `Statut` / `Echeance` | `script-core-sprint26-timeline-stats-signature.js:304/313/321` | Référencés via `cell.dataset.s26Save` (l.254) mais **aucun `data-s26-save="..."` dans le repo** — vraisemblablement morts |
| `s26SaveLivraisonStatut` | idem:329 | idem |
| `s22Desactiver` | `script-core-sprint22-23-hubs.js:215` | Aucun caller (`onclick`, `(`) — vraisemblablement mort |
| `dismissToastById` | `script-core-sprint10-toasts-stacked.js:164` | Aucun caller détecté — peut être appelé via callback dynamique |
| `removeToastListener` | `script-core-toast.js:26` | Pair API `add/remove`, garder pour cohérence API même si pas utilisé |
| `refreshDrawerFournisseur` | `script-core-sprint25-drawer-360.js:62` | Drawer 360 PC fournisseur non implémenté (cf. H2.4 CLAUDE.md) — placeholder |
| `refreshDrawerInspection` | `script-inspections-drawer-360.js:280` | Aucun caller — peut être appelé via Supabase Realtime callback |

**Recommandation** : suppression seulement pour les `s26SaveX` (5 fonctions) après confirmation user. Les autres = grep approfondi nécessaire (callback patterns dynamiques).

#### E. Fichiers "orphelins" — FAUX POSITIFS

| Fichier signalé | Réalité |
|---|---|
| `script-core-i18n.js` | Chargé dans `admin.html` + `m.html` + `salarie.html` ✅ |
| `script-dashboard-submeta.js`, `script-sidebar-foot.js`, `script-tva-tabs.js` | Chargés dans `admin.html` ✅ |
| `style-design-encaissement.css`, `style-design-heures-incidents.css` | Chargés dans `admin.html` ✅ — manquent juste de `sw.js` CORE_ASSETS (non précachés) → **action 24.F : ajouter au CORE_ASSETS pour offline** |

#### F. Backend drift

| Item | Statut | Action |
|---|---|---|
| Edge fn `ai-debug v4` | Déployée prod, source absente repo | Déjà connu (CLAUDE.md L147) — republier ou supprimer |
| Migrations SQL `040`-`048` | Présentes repo mais non documentées dans CLAUDE.md (L153 stoppe à 039) | Mettre à jour CLAUDE.md — confirmer si toutes appliquées en prod |
| Fichiers `.bak`/`.old`/`.tmp`/`-deprecated` | ✅ Aucun trouvé | — |
| MD docs stale | ✅ Aucun trouvé (tous datés < 2 mois ou pointers actifs CLAUDE.md) | — |

#### Récap priorisé

1. **HIGH (à fixer rapidement)** : `renderLivraisonsAdminFinal` 2 défs (race condition possible) + `fermerFiche360` 2 défs anonymes (Parc360 écrase RH360)
2. **MEDIUM (consolidation)** : merger les 3 paires CSS `refine` (modal, mobile, topbar déjà OK) + choisir 1 fichier livraisons CSS avant merge main
3. **LOW (cleanup)** : supprimer ~5 fonctions s26Save mortes après confirm user + ajouter CSS au CORE_ASSETS pour offline + commenter previews/handoff
4. **DOC** : mettre à jour CLAUDE.md (migrations 040-048 + status `ai-debug`)

---

### Bootstrap d'une nouvelle session (web/local)

Si tu lances claude.ai/code ou une nouvelle session Claude Code, colle CE prompt :

```
On reprend la refonte HTML MCA Logistics. Lis AUDIT-ONGLET-PAR-ONGLET.md (à la racine du repo) — c'est la source UNIQUE de vérité. Onglets 1 (Livraisons), 2 (Dashboard) et 3 (Calendrier) sont terminés. Continue à partir de l'Onglet 4 Planning, en respectant la règle d'engagement (un onglet à la fois, finir avant de passer au suivant, transverse seulement à la fin, aucun ajout hors MD). Vérifie aussi à chaque onglet la Checklist cross-tab A/B/C en tête de MD. Avant d'attaquer, présente-moi le plan onglet par onglet en français simple et attends ma validation. Branche : claude/html-refonte-cleanup (déjà pushée à v413). Commit + push à chaque item, bump sw.js CACHE_VERSION à chaque release. Tests : `npm test` doit rester vert (426 pass minimum).
```

---

## 🧭 Ordre d'exécution (verrouillé)

1. Livraisons (admin)
2. Dashboard
3. Calendrier
4. Planning
5. Alertes
6. Clients
7. Fournisseurs
8. Véhicules
9. Carburant
10. Entretiens
11. Inspections
12. Équipe / Salariés
13. Heures & Km
14. Incidents
15. Charges
16. Encaissement
17. TVA
18. Rentabilité
19. Statistiques
20. Paramètres
21. Brouillons IA
22. Mobile m.html
23. Espace chauffeur salarie.html
24. Transverse (sync, perf, a11y, dette tech)

On termine **complètement** un onglet (= tous ses `[ ]` deviennent `[x]` ou `[~]` documenté) avant de passer au suivant.

---

## 🔁 Checklist cross-tab (à vérifier sur CHAQUE onglet 2 → 21)

Émergé de l'audit Onglet 1 (2026-05-17). Ces 3 checks systématiques s'ajoutent aux items spécifiques de chaque onglet :

- **A. Topbar non collée** : titre H1/H2 a une marge ≥ 20px avec la topbar (règle CSS `.page > ...:first-child { margin-top: 20px }` couvre les cas standards + les pages avec `<span hidden>` en tête). Sinon → fix CSS ciblé.
- **B. Cohérence labels chip ↔ select ↔ badge** : si un chip filtre dit "Brouillons" mais le select statut dit "En attente" et le badge dit "Brouillon", c'est une drift. Unifier le terme visible (la `value=` reste pour rétro-compat data).
- **C. Drawer auto-refresh après mutation** : si une mutation (ajout, edit, génération facture/document) ne re-renderise pas le drawer 360 ouvert, le compteur reste figé. Vérifier que la mutation appelle `refreshDrawerX` (client / fournisseur / vehicule / salarie / etc.).

---

## 1. Livraisons

- [x] Colonne Véhicule td manquant / désaligné [Agent B] — *fixé 2026-05-17 commits a3d0e65 + 455e77b*
- [x] Drawer typo `vehImmat || vehImmat` [Agent B] — *fixé 2026-05-17*
- [x] Auto-fill véhicule depuis chauffeur (vehImmat canonical) — *fixé 2026-05-17*
- [x] Brouillon filtre désynchro : `getLivraisonsFiltresActifs` accepte maintenant `brouillon || en-attente` *(commit 2026-05-17)*
- [x] Refresh chain `ajouterLivraison` alignée avec `confirmerEditLivraison` (ajout `refreshDrawerClient` + `refreshDrawerLivraisonDetail`) *(commit 2026-05-17)*
- [x] Chip "Parking" : déjà compté (script-charges-kpis-categorie.js:50,100, Phase 91.55 Bug E). En réalité dans onglet Charges, pas Livraisons.
- [x] Nom client tronqué : `slice(0,48) + '…'` dans `formatClientLabel`, title attribut conserve nom complet via `clientFull` *(commit 2026-05-17)*
- [x] Bulk Edit Modal N>1 livraisons *(commit 2026-05-17)*
  - Modal HTML `modal-bulk-edit-livraisons` ajouté dans admin.html
  - `script-livraisons-bulk-edit.js` créé avec `bulkEditLivraisons(ids)` + `confirmerBulkEditLivraisons()`
  - 7 champs cochables : statut, statutPaiement, chaufId, vehId, date, modePaiement, tauxTVA
  - Verrou édition vérifié par id (skip + count si verrouillé par autre admin)
  - synchroniserAffectationLivraison appelé si chauffeur/véhicule changé
  - Audit log 1 entrée pour le batch, refresh chain complète
- [x] Génération facture depuis dropdown : try/catch wrapper en place (script-livraisons-polish.js:565-584) + SIRET vide handler (script-livraisons.js:1028-1032 toast + redirect Paramètres)
- [x] 🆕 Statut "En attente" → "Brouillon" (label visuel dropdown statut, value=en-attente conservée rétro-compat) — 4 renderers mis à jour *(commit 2026-05-17, signalé par user screenshot)*
- [x] 🆕 Génération facture ne refresh pas le drawer client ouvert (compteur "Factures (0)" figé) — `refreshDrawerClient` défini dans script-core-sprint25-drawer-360.js + appelé depuis `assurerArchiveFactureLivraison` *(commit 2026-05-17)*
- [x] 🆕 Topbar collée sur écrans <1920px : padding-top `.page` harmonisé sur tous breakpoints (24/20/18/16px selon viewport, au lieu de 18/14/12/10px) *(commit 2026-05-17, signalé par user)*
- [x] 🆕 Facture liée canoniquement au client via clientId (avant : match par nom uniquement, fragile). assurerArchiveFactureLivraison écrit maintenant `facture.clientId` + `facture.clientSiren` + `facture.date` canonique. Migration boot R9 backfill toutes les factures pre-existantes via livraison.clientId puis fallback nom *(commit 2026-05-17)*
- [x] 🆕 Topbar Livraisons parité layout avec Alertes : `<div class="title-row">` H1+sub-meta restauré (la suppression Phase 91.5 avait cassé l'aération en haut sur écrans < 1920px). User feedback : "copie exactement le même code". *(commit 2026-05-17)*
- [x] 🆕 Garde-fous métier génération documents (drawer Documents + toolbar dropdown) :
  - **Facture** bloquée si statut ≠ "livré" (CGI art. 289, facture pour prestation effective)
  - **Bon de livraison** bloqué si statut = "brouillon"/"en-attente" (livraison non engagée)
  - **Lettre de voiture (CMR)** : AUCUN blocage (document légal transport, arrêté 09/11/1999, doit être en cabine AVANT départ)
  Toast d'erreur explicite citant la règle métier au lieu d'un échec silencieux. *(commit 2026-05-17)*
- [x] 🆕 Title-row sub-meta "7s à traiter" corrigée → "7 retards" (le span -s était mal placé) *(commit 2026-05-17)*
- [x] 🆕 **Facture wipée au refresh** : `supabase-storage-sync.js` n'excluait pas `factures_emises` de `applyRemoteSnapshot`. Le snapshot remote (qui ne contient pas ce registre local-only) écrasait les factures fraîchement émises au prochain boot. Exclu : `factures_emises`, `avoirs_emis`, `encaissements`, `encaissements_manuels`, `acomptes`, `relances` (registres financiers sans miroir Supabase aujourd'hui). *(commit 2026-05-17, root cause user "facture disparaît au refresh")*

### Bilan Onglet 1 (✅ clôt 2026-05-17)

15 items résolus, 6 commits livrés (de a3d0e65 à 8430e7c). Touchés :
`script-core-admin-final-lock.js` · `script-core-admin-final-lock-iife.js` · `script-core-sprint7-pagination-search.js` · `script-core-sprint8-tri-colonnes.js` · `script-core-sprint25-drawer-360.js` · `script-livraisons.js` · `script-livraisons-drawer.js` · `script-livraisons-polish.js` · `script-livraisons-bulk-edit.js` (nouveau) · `supabase-storage-sync.js` · `style-refonte-utilities.css` · `style.css` · `admin.html` · `sw.js`.

Root causes notables :
1. Le renderer v2 dupliquait la cellule Véhicule que le polish injectait déjà → 17 td dans un thead de 16 → désalignement.
2. Le drawer client avait `vehImmat || vehImmat` (faute de frappe, fallback inutile).
3. `refreshDrawerClient` était APPELÉ partout mais jamais DÉFINI.
4. `factures_emises` n'était pas dans la liste d'exclusion sync Supabase → wipé au boot.
5. Le `title-row` avait été retiré Phase 91.5 sans compenser le padding-top → topbar collée sur écrans < 1920px.

---

## 2. Dashboard ✅ TERMINÉ (2026-05-17)

- [x] Topbar `margin-top:20px` : `.ds-section-head` premier enfant de `.page` → règle CSS s'applique (héritée Onglet 1).
- [x] Sub-meta date "Mai 2026" : wiré dans `script-dashboard-submeta.js` (boot + refresh horaire).
- [x] KPI bar mockup-aligné : 4 cartes Livraisons / CA HT / Marge nette / Retards (admin.html:532-555).
- [x] Indice santé 4 sous-cartes Finance/Flotte/RH/Conformité : `buildSubScores()` dans `script-dashboard-finish.js:241` calcule depuis livraisons/vehicules/salaries/alertes.
- [x] 🆕 **isRetard() corrigé** (user feedback : "j'ai retard qui existe alors que ça ne devrait pas exister") : avant, toute livraison non-livrée past date était marquée Retard, y compris les brouillons. Maintenant seules les livraisons `en-cours` past date sont retard. Brouillon = pas engagé = pas de retard possible.
- [x] 🆕 **Label "En attente" → "Brouillon"** dans `statusBadge()` du widget Dernières livraisons (parité onglet Livraisons).
- [x] 🆕 **Barre "Retard" retirée** du widget Statuts livraisons (user feedback : inutile, déjà couvert par KPI Retards en haut). Label "En attente" → "Brouillon" aussi dans cette barre.
- [x] 🆕 **Tooltips chart Activité 14j/30j/90j** : montants affichés en € exact avec séparateur milliers (ex : "2 450 € HT") au lieu de k€ arrondi ("2,5 k€"). Format `toLocaleString('fr-FR')` côté callback Chart.js. Pluriel livraisons aussi corrigé.
- [x] Checklist cross-tab A (topbar) : OK. B (chip/select/badge) : badge brouillon harmonisé. C (drawer) : N/A.

## 3. Calendrier ✅ TERMINÉ (2026-05-17)

- [x] `script-stats-calendrier-counts.js:125` bloc legacy déjà supprimé Phase 91.55 Bug C. Le KPI `cal16-kpi-pai` est désormais écrit uniquement par `setKPIMoisCourant()` (script-core-sprint16-calendrier-operationnel.js:255) qui filtre `paiements[].sens === 'in'`. "—" affiché quand aucun paiement = comportement correct.
- [x] Cellule "Aujourd'hui" : brand red `#e63946` appliqué (.cal16-legend-dot.today). User valide visuellement.
- [x] Légende 6 items (Aujourd'hui/Férié/Livraison/Échéance/Paiement/Relance) présents admin.html:3659-3666.
- [x] 🆕 **Couleurs de la légende alignées sur les events réels** : avant, les dots étaient des couleurs décoratives qui ne correspondaient pas. Maintenant : livraison vert `#22c55e`, écheance rouge `#ef4444`, paiement jaune `#eab308`, relance orange `#f97316` — match exact avec `getEventsForRange()` du script.
- [x] 🆕 **Police KPI italic supprimée** (user feedback "police italic grave bizarre, enlève-moi ça") : ajout `font-style: normal` + `font-feature-settings: "tnum"` sur `#page-calendrier .cal16-kpi-val` qui n'héritait pas de la règle 258 (override de spécificité).
- [x] 🆕 **Topbar alignée bas du logo "MCA LOGISTICS"** : hauteur topbar 52px → 61px desktop / 56px mobile (impact transverse toutes pages) pour matcher `.sidebar-header` (padding 18px × 2 + logo 24px + border 1px = 61px).

## 4. Planning ✅ TERMINÉ (2026-05-17)

- [x] `script-dev-seed.js:661` écrivait `plannings_hebdo` (orphelin) → corrigé en `plannings`. Idem ligne 155 (`summary()`). *(commit 2026-05-17)*
- [x] Helper `migrerCleLegacy(oldKey, newKey)` ajouté dans `script-core-utils.js` (rapatrie source → cible, conserve cible si déjà peuplée). Appelé au boot dans `migrerSchemasDataPC` (R10). *(commit 2026-05-17)*
- [x] Vérification adapters/usages localStorage : aucun adapter Supabase ne lit `plannings_hebdo` en localStorage (cf. `plannings-supabase-adapter.js:28` STORAGE_KEY = `plannings`, TABLE = `plannings_hebdo`). Front corrigé : `script-titlerow.js:159`, `script-exports.js:160/197/221`, `repo.js:187`. Côté Supabase, la TABLE reste `plannings_hebdo` (intacte). *(commit 2026-05-17)*
- [x] `absences_periodes` : helper `normalizeAbsence` dans `script-core-utils.js` qui mirror les 3 schémas (admin `debut/fin/salId`, mobile `dateDebut/dateFin`, DB `date_debut/date_fin/salarie_id`). Migration boot idempotente (`_absence_migrated_v1` par item) appelée dans `migrerSchemasDataPC` (R11). 10 tests unitaires ajoutés (5 normalizeAbsence + 5 migrerCleLegacy). *(commit 2026-05-17)*
- [x] Checklist cross-tab : **A** topbar OK (pattern `.ds-section-head` identique à Dashboard/Calendrier validés). **B** chip↔select↔badge OK (pas de drift "Brouillon vs En attente" dans Planning). **C** drawer auto-refresh N/A (drawer 360 salarié PC = Onglet 12).

### Bilan Onglet 4 (✅ clôt 2026-05-17)

4 items résolus. Touchés : `script-core-utils.js` (+ `normalizeAbsence` + `migrerCleLegacy`) · `script-livraisons.js` (migration boot R10+R11) · `script-dev-seed.js` · `script-titlerow.js` · `script-exports.js` · `repo.js` · `tests/data-schema-normalization.test.js` (10 nouveaux tests) · `sw.js` (v413→v414).

Root cause : confusion entre nom de TABLE Supabase (`plannings_hebdo`) et clé localStorage canonique (`plannings`). 5 fichiers front avaient adopté le nom de la table comme clé localStorage → données orphelines (jamais relues par l'adapter Supabase). Idem `absences_periodes` avec 3 schémas concurrents non normalisés au boot.

Tests : 436 pass · 0 fail (étaient 426 avant, +10 nouveaux).

## 5. Alertes ✅ TERMINÉ (2026-05-17)

- [x] Topbar bell badge `topbar-bell-count` est ciblé par `afficherBadgeAlertes` (`script-alertes.js:49` — liste `['badge-alertes', 'badge-alertes-mbn', 'topbar-bell-count']`). `aria-label` du bouton bell mis à jour aussi (a11y count screen reader). Déjà résolu en Phase 91.85.
- [x] `SEVERITY_MAP` + `effectiveNiveau(a)` fallback existent dans `script-dashboard-attention.js:38-53` (Phase 91.42). Heuristique en cascade : `a.niveau` → `SEVERITY_MAP[a.type]` → match substring (`urgent`/`critique`/`warn`) → défaut `warn`. Idem `script-alertes-counts.js:8-67`.
- [x] Checklist cross-tab : **A** topbar OK (pattern `.title-row` + `.ds-section-head`, identique à Livraisons validé). **B** chip↔select↔badge OK (chips niveau Critique/Avertissement/Info sync via `effectiveNiveau` + `niveauToColor`). **C** drawer auto-refresh N/A (pas de drawer dédié alertes ; `afficherBadgeAlertes()` rappelé par tous les mutateurs).

### Bilan Onglet 5 (✅ clôt 2026-05-17)

0 commit code (les 2 items étaient déjà résolus dans des phases antérieures, MD non mis à jour). Vérifications faites : `script-alertes.js:49`, `script-dashboard-attention.js:38-53`, `script-alertes-counts.js:8-67`. Tests inchangés (436 pass).

## 6. Clients ✅ TERMINÉ (2026-05-17)

- [x] Drawer 360 PC clients existe depuis Sprint 25 (`script-core-sprint25-drawer-360.js`, 5 onglets : Vue, Factures/Commandes, Livraisons/Charges, Paiements, Historique). `ouvrirFiche360Client(id)` + `refreshDrawerClient()` opérationnels (c'est même ce drawer qu'on a fait refresher correctement en Onglet 1 R8). L'audit MD était obsolète.
- [x] Table Clients a déjà `class="card table-card"` (admin.html:1003).
- [x] Checklist cross-tab : **A** topbar OK (`.title-row` premier enfant). **B** chip↔select OK (chips Tous/Actifs/Risque/Inactifs sync via `cliChipFilter`, pas de select correspondant). **C** drawer auto-refresh OK (`refreshDrawerClient` appelé après ajout/edit livraison + génération facture).

### Bilan Onglet 6 (✅ clôt 2026-05-17)

0 commit code (2 items déjà résolus dans Sprint 25 + refonte HTML). Vérifications : `script-core-sprint25-drawer-360.js:57-61` + `admin.html:1003`. Tests inchangés (436 pass).

## 7. Fournisseurs ✅ TERMINÉ (2026-05-17)

- [x] Drawer 360 PC fournisseurs existe depuis Sprint 25 (`script-core-sprint25-drawer-360.js:337` `ouvrirFiche360Fournisseur(id)` + `refreshDrawerFournisseur()`). L'audit MD était obsolète.
- [x] Table Fournisseurs a déjà `class="card table-card"` (admin.html:1081).
- [x] Checklist cross-tab : **A** topbar OK (`.title-row` premier enfant). **B** chip↔select OK. **C** drawer auto-refresh OK.

### Bilan Onglet 7 (✅ clôt 2026-05-17)

0 commit code. Vérifications : `script-core-sprint25-drawer-360.js:337` + `admin.html:1081`. Tests inchangés (436 pass).

## 8. Véhicules ✅ TERMINÉ (2026-05-17)

- [x] Drawer 360 PC véhicules existe depuis Sprint 21 (`script-core-sprint21-parc360.js:167` `ouvrirFiche360Vehicule(vehId)`). Réutilise l'infrastructure drawer #s20-drawer (RH 360). L'audit MD était obsolète.
- [x] Checklist cross-tab : **A** topbar OK (`.title-row` premier enfant, admin.html:1107). **B** chip↔select OK. **C** drawer auto-refresh OK (auto-alertes Parc rejouent les badges).

### Bilan Onglet 8 (✅ clôt 2026-05-17)

0 commit code. Vérification : `script-core-sprint21-parc360.js:167`. Tests inchangés.

## 9. Carburant ✅ TERMINÉ (2026-05-17)

- [x] Aucun item d'audit dédié (sera couvert par transverse 24.B IDB + 24.E A11y).
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child` couvert ligne 23 `style-refonte-utilities.css`). **B** chip↔select OK. **C** drawer auto-refresh : N/A (pas de drawer dédié, KPIs rafraîchis par mutateurs).

## 10. Entretiens ✅ TERMINÉ (2026-05-17)

- [x] Aucun item d'audit dédié.
- [x] Checklist cross-tab : **A** topbar OK (même pattern `hub-subnav:first-child`). **B** chip↔select OK. **C** drawer auto-refresh : N/A.

## 11. Inspections ✅ TERMINÉ (2026-05-17)

- [x] Drawer 360 PC Inspections livré : `script-inspections-drawer-360.js` (nouveau fichier). 3 onglets (Vue / Photos / Historique véhicule), KPI row (Statut/KO/Photos/Km), liens cross-drawer vers fiche véhicule (Sprint 21) et fiche chauffeur (Sprint 20 RH si dispo). Réutilise les classes CSS `.s25-*` existantes (zéro nouveau CSS). Lignes du tableau Inspections cliquables (ouverture drawer au clic, sauf boutons photo/🗑️ avec `event.stopPropagation`). Auto-fermeture sur suppression. *(commit 2026-05-17)*
- [x] Filtre période : déjà présent (chips Jour/Semaine/Mois/Année + `getInspectionsPeriodeRange`). Drilldown véhicule ajouté : nouveau `<select id="filtre-insp-veh">` peuplé dynamiquement depuis `charger('vehicules')`, branché dans `afficherInspections()` (match `vehId` + fallback `vehImmat`). Export PDF/CSV/Excel : `applyActiveFilters()` ajouté à `getRows()` pour que les exports respectent les filtres actifs (sal/véh/statut/période), bug majeur : avant on exportait toutes les inspections au lieu de celles affichées. *(commit 2026-05-17)*
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child` couvert ligne 23 style-refonte-utilities.css). **B** chip↔select OK (chips période sync via `data-period-target`, selects sal/véh/statut indépendants). **C** drawer auto-refresh OK (`refreshDrawerInspection` exposé + `fermerFiche360Inspection` appelé sur suppression).

### Bilan Onglet 11 (✅ clôt 2026-05-17)

2 items résolus. Touchés : `script-inspections-drawer-360.js` (nouveau, 250 lignes) · `script-inspections.js` (filtre véhicule + clic ligne + fermeture drawer suppression) · `script-exports-inspections.js` (applyActiveFilters) · `admin.html` (`<select filtre-insp-veh>` + script tag) · `sw.js` (precache + v414→v415).

Tests : 436 pass (inchangé, pas de couverture unitaire ajoutée — drawer = pur DOM, exports = filtres déjà couverts indirectement par tests).

## 12. Équipe / Salariés ✅ TERMINÉ (2026-05-17)

- [x] Drawer 360 PC Salariés livré en Sprint 20 (`script-core-sprint20-rh360.js:180` `ouvrirFiche360Salarie(salId)` + drawer `#s20-drawer-overlay`/`#s20-drawer`). L'audit MD était obsolète.
- [x] Hub Équipe livré en Sprint 22 (`script-core-sprint22-23-hubs.js:20-32` config HUBS.rh : `salaries/heures/planning/incidents` regroupés dans une seule entrée sidebar "Équipe" avec sous-navigation par bandeau). L'audit MD était obsolète.
- [x] Checklist cross-tab : **A** topbar OK (le bandeau hub-subnav est `:first-child` de `.page`, couvert ligne 23 style-refonte-utilities.css). **B** chip↔select OK. **C** drawer auto-refresh OK (Sprint 20 expose `refreshDrawerSalarie` / `ouvrirFiche360Salarie` rappelable).

### Bilan Onglet 12 (✅ clôt 2026-05-17)

0 commit code. Vérifications : `script-core-sprint20-rh360.js:180`, `script-core-sprint22-23-hubs.js:20-32`. Tests inchangés.

## 13. Heures & Km 🚨 BLOQUANT PROD — [~] REPORTÉ SPRINT DÉDIÉ (décision user 2026-05-17)

- [~] Stockage dual `heures` + `heures_pointage` à unifier [Audit Agent 6 HIGH] — *fix tech ~30min, reporté avec l'onglet*
- [~] Éclipse planifié quand réelle partielle [Audit Agent 6 MED] — *reporté*
- [~] **Workflow guidé "Saisie pointage" mobile chauffeur** (2-3j) [TODO-BACKLOG #4] — *chantier dédié hors refonte HTML* :
  - Bouton "Démarrer ma journée" sur salarie.html → enregistre heureDebut + position GPS
  - Bouton "Pause / Reprise" pour CE 561 (45 min après 4h30 conduite)
  - Bouton "Fin de journée" → calcule total + signature électronique facultative
  - Notification push si dépassement seuil journalier (9h/10h selon contrat)
  - Validation admin via drawer "Heures à valider" PC
  - Migration `043_heures_validation.sql` avec champs `debut_gps`, `fin_gps`, `validee`, `valideeLe`

**Justification report** : décision user 2026-05-17 — l'item 3 nécessite une analyse approfondie chauffeur + tests usage terrain (GPS, batterie, hors-zone) + migration SQL + push réelle (VAPID). Hors périmètre "refonte HTML" de cette session. Les items 1+2 sont des fix tech rapides qui dépendent du choix d'architecture du workflow (stockage final), donc cohérent de les attaquer ensemble dans un sprint dédié "Heures & Km mobile".

## 14. Incidents ✅ TERMINÉ (2026-05-17)

- [x] Drawer 360 PC Incidents livré : `script-incidents-drawer-360.js` (nouveau). 3 onglets (Vue / Photos / Historique chauffeur), KPI row (Statut/Gravité/Coût/Photos), actions de statut intégrées (Marquer ouvert/en cours/traité), liens cross-drawer (livraison/véhicule/chauffeur). Lignes du tableau cliquables (cellule Actions stop-propagation pour préserver le dropdown). Auto-fermeture sur suppression. *(commit 2026-05-17)*
- [x] `changerStatutIncident` pose déjà `resoluLe` quand statut=traite/clos/resolu et le retire à la réouverture (`script-incidents.js:135-149`, Phase 91.42). L'audit MD était obsolète.
- [x] `supprimerLivraison` orpheline déjà incidents (livId/livraisonId), paiements (livraison_id/livraisonId) et docs/commentaires/modifs préfixés (`script-livraisons.js:537-553`). L'audit MD était obsolète.
- [x] Checklist cross-tab : **A** topbar OK (`.title-row` premier enfant). **B** chip↔select OK (chips Tous/Ouverts/Graves sync via `incChipFilter`). **C** drawer auto-refresh OK (`refreshDrawerIncident` rappelé après chaque action, `fermerFiche360Incident` sur suppression).

### Bilan Onglet 14 (✅ clôt 2026-05-17)

3 items résolus (1 livré + 2 déjà résolus). Touchés : `script-incidents-drawer-360.js` (nouveau, 250 lignes) · `script-incidents.js` (clic ligne + fermeture drawer suppression) · `admin.html` (script tag) · `sw.js` (precache + v415→v416). Tests : 436 pass (inchangé).

## 15. Charges ✅ TERMINÉ (2026-05-17)

- [x] Fusion filtres + mini-KPI dans grille livrée en Phase 91.57 (admin.html:3063-3103) : 2 KPI grids `.ds-kpi-grid--charges` — 4 cards par catégorie (Carburant/Entretien/Péages/Assurance) + 3 cards par statut paiement (Impayé/Retard/Payé). Chips toolbar filtre catégorie sync avec select via `appliquerChipCharges`.
- [x] Catégories custom déplacées Paramètres → Charges en Phase 91.57 (admin.html:3184-3198) : `<details id="charges-categories-custom-block">` collapse dans la page Charges (logique métier au plus près).
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child`). **B** chip↔select OK (chips catégorie sync via `appliquerChipCharges` + `filtre-charge-cat`). **C** drawer auto-refresh : N/A (pas de drawer dédié charges).

### Bilan Onglet 15 (✅ clôt 2026-05-17)

0 commit code. Vérifications : admin.html:3063-3103 + 3184-3198. Tests inchangés.

## 16. Encaissement ✅ TERMINÉ (2026-05-17)

- [x] KPI "Encaissé ce mois" strict : date paiement uniquement, pas de fallback dateLivraison. Phase 91.42, `script-encaissement-counts.js:44-64`. Skip explicite si pas de `datePaiement || date_paiement`.
- [x] `calculerDSO` lit `date || dateLivraison || date_livraison` (Phase 91.42, `script-core-dso.js:38`). Helper exposé `window.calculerDSO` + module.exports pour tests Node.
- [x] DSO câblé dans 3 sources : KPI page Encaissement (`script-encaissement-counts.js` via `enc-kpi-dso`), KPI mobile (`script-mobile.js:6969`), brief IA (`infra/supabase/functions/ai-brief`). Cf. `script-core-dso.js:5-11`.
- [x] Tabs internes Encaissement livrés (Sprint H Phase IV.91.58) : 3 onglets Suivi factures / Détails & relances / Analyse (admin.html:2881-2884) — équivalent fonctionnel aux 4 originalement prévus (Relances+Historique combinés dans "Détails & relances"). `script-encaissement-tabs.js`.
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child`). **B** chip↔select OK (tabs sync via `switchEncMainTab`). **C** drawer auto-refresh : N/A (pas de drawer dédié encaissement).

### Bilan Onglet 16 (✅ clôt 2026-05-17)

0 commit code. Vérifications : `script-encaissement-counts.js:44-64`, `script-core-dso.js`, `admin.html:2881-2884`. Tests inchangés (déjà couverts par `tests/encaissement-kpis.test.js` + `tests/dso.test.js`).

## 17. TVA ✅ TERMINÉ partiel — item 2 reporté (2026-05-17)

- [x] Bannière sticky "TVA à payer cette période" livrée Phase 91.59 (admin.html:2190-2202) : icône + label + montant + échéance, info la plus critique en tête de page. Chips Mois/Trim/An (admin.html:2219-2224) sync via `data-period-target="vue-tva-select"`.
- [~] **Refonte complète déclaration** (2j) [TODO-BACKLOG #5] — *reporté sprint dédié TVA déclaration (décision user 2026-05-17)* :
  - Tableau récap mois/trimestre : CA collecté + TVA collectée + TVA déductible + TVA à payer
  - Export PDF déclaration CA3 préformatée
  - Bouton "Marquer déclaré" + date butoir + statut
  - Historique des déclarations passées avec drilldown
  - Alerte automatique 5j avant date limite déclaration
  - Sync Pennylane (la déclaration officielle s'y fait — MCA prépare)
  - Edge fn possible `tva-export-ca3`
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child`). **B** chip↔select OK (chips période sync). **C** drawer auto-refresh : N/A.

### Bilan Onglet 17 (clôt 2026-05-17 — item 2 reporté)

Item 1 déjà résolu (Phase 91.59). Item 2 reporté en sprint dédié car nécessite intégration Pennylane + edge fn + workflow déclaration. Tests inchangés.

## 18. Rentabilité ✅ TERMINÉ (2026-05-17)

- [x] Simulateur en drawer/modal séparé livré Phase 91.60 (admin.html:1369-1370 + 1519-1523) : CTA "Ouvrir le simulateur de rentabilité" appelle `openSimulateurRentabilite` qui ouvre le drawer `rent-simu-drawer`. Justification commentée : "libère un onglet, simulateur est outil ponctuel pas un axe d'analyse".
- [x] Donut "Répartition charges" supprimé Phase 91.56 III.3 (admin.html:1409 commentaire confirmé). Doublon avec le donut Charges éliminé.
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child`). **B** chip↔select OK. **C** drawer auto-refresh OK (simulateur ouvert au demand, fermeture explicite).

### Bilan Onglet 18 (✅ clôt 2026-05-17)

0 commit code. Vérifications : admin.html:1369-1370, 1409, 1519-1523. Tests inchangés.

## 19. Statistiques ✅ TERMINÉ (2026-05-17)

- [x] Source `chauffeurs` localStorage → Supabase : `script-stats.js:130-135` lit maintenant `salaries` en priorité (adapter Supabase actif) avec fallback `chauffeurs` legacy pour les chauffeurs externes non-salariés. *(commit 2026-05-17)*
- [x] Unifier period chips : Phase 91.61 déjà résolue. Chips section-head retirés au profit de la `.period-chips` unique de la period-nav (admin.html:1726-1727 commentaire confirmé).
- [x] CA exclut brouillons + annulées : Phase 91.42 déjà résolue (`script-stats.js:53-60` + 81-84).
- [x] Label "CA HT" utilise bien HT : Phase 91.42 déjà résolue. `_ht()` helper interne (`script-stats.js:85-92`) calcule HT en priorité (`l.prixHT` direct ou `prix TTC / (1 + tauxTVA/100)` fallback). Graphique CA + KPI CA cohérents.
- [x] `toISOString().slice(0,10)` remplacé par `d.toLocalISODate()` partout (script-stats.js:96, 102). BUG-022 anti-UTC drift (`script-core-date-prototype-extensions.js:9-10`).
- [x] Sub-meta : drop dates redondantes : Phase 91.56 III.2 déjà résolue (`script-stats-calendrier-counts.js:22-26` : sub-meta limitée au label "Mai 2026" sans dupliquer le "Du DD/MM au DD/MM" de la period-nav).
- [x] Checklist cross-tab : **A** topbar OK (`hub-subnav:first-child`). **B** chip↔select OK. **C** drawer auto-refresh : N/A.

### Bilan Onglet 19 (✅ clôt 2026-05-17)

1 commit code (item 1 — fix source chauffeurs). 5 items déjà résolus (Phase 91.42 + 91.56 + 91.61 + BUG-022). Touchés : `script-stats.js` (priorité salaries Supabase) · `sw.js` (v416→v417 si bump). Tests : 436 pass (inchangé).

## 20. Paramètres ✅ TERMINÉ (2026-05-17)

- [x] "Identité visuelle" déplacée vers Apparence Phase 91.62 (admin.html:2640-2643 commentaire confirmé). Logo entreprise = identité visuelle → Apparence (au lieu d'Entreprise).
- [x] Notifications toggles handler + persistance livré Phase 91.55 Bug D (`script-params-notifications.js`, admin.html:145). Toggles a11y (aria-checked) + localStorage persist.
- [x] Polices globales dynamiques livrées Phase V.91.63 (`script-core-fonts.js` + sélecteur cards admin.html:2670 `param-police-body`). Variables CSS `--ds-font-body` appliquées sur `:root` partout (style-design-*.css).
- [x] Checklist cross-tab : **A** topbar OK. **B** chip↔select OK (param-tabs sync). **C** drawer auto-refresh : N/A.

### Bilan Onglet 20 (✅ clôt 2026-05-17)

0 commit code. Vérifications : Phase 91.55 + 91.62 + 91.63. Tests inchangés.

## 21. Brouillons IA ✅ TERMINÉ (2026-05-17)

- [x] Aucun item d'audit dédié.
- [x] Checklist cross-tab : **A** topbar OK. **B** chip↔select OK. **C** drawer auto-refresh OK (refresh après action drawer Brouillons IA déjà câblé via `refreshDrafts` post-validation/rejet).

## 22. Mobile m.html — parité PC [~] REPORTÉ sprint dédié (2026-05-17)

> **Hors périmètre refonte HTML PC.** Chantier parité mobile = 2-3 jours dev avec
> dépendances Supabase Realtime + assets monitoring/offline-queue + nouveau
> module Inspections mobile complet. À planifier en sprint dédié H2 mobile.

- [~] `script-mobile-exports.js` chargé dans m.html [Agent F]
- [~] `monitoring.js` ajouté à m.html [Agent F]
- [~] `offline-queue.js` ajouté à m.html [Agent F]
- [~] Realtime Supabase chauffeur (channel filtré + RLS) [Agent F]
- [~] Renommage "En attente" → "Brouillon" côté mobile [Agent F]
- [~] Chips filtre statut mobile + KPI Encaissé cohérence [Agent F]
- [~] Drawer 360 mobile livraisons (sheet fullscreen 4 onglets) [TODO-LIVRAISONS #1]
- [~] Pull-to-refresh mobile (existe PC `script.js:2845`, à porter) [TODO-LIVRAISONS #1]
- [~] Drag-drop kanban touch-friendly (actuellement tap seul) [TODO-LIVRAISONS #1]
- [~] Brouillons IA pré-remplis dans `formNouvelleLivraison` mobile [TODO-LIVRAISONS #1]
- [~] **Module Inspections mobile** (TOTAL ABSENT — chauffeur ne peut pas faire inspection) [TODO-BACKLOG #1]
- [~] Module Heures mobile : aujourd'hui = vue chauffeur sans saisie pointage admin [TODO-BACKLOG #1]
- [~] Module Incidents mobile : signalement OK mais aucun filtre statut/gravité, pas d'export [TODO-BACKLOG #1]

### Bilan Onglet 22 (reporté sprint dédié 2026-05-17)

13 items mobile parité + 1 module Inspections à créer. Découpage suggéré H2 mobile :
1. Assets de base m.html (monitoring + offline-queue + exports) = ~2h
2. Realtime Supabase chauffeur + RLS = ~3h
3. Drawer 360 mobile livraisons + pull-to-refresh + drag-drop touch = ~5h
4. Module Inspections mobile complet (checklist + photos + signature) = ~6h
5. Renaming + chips filtres + parité KPIs = ~2h
Total estimé : 2-3 jours pleins.

## 23. Espace chauffeur salarie.html 🚨 BLOQUANT PROD TRANSPORT — [~] REPORTÉ sprint dédié (2026-05-17)

> **Hors périmètre refonte HTML PC.** Chantier critique métier = 2-3 jours dev.
> Doit être priorisé avant mise en production transport réelle (preuve livraison
> légale, sinon contestation client possible).

[TODO-LIVRAISONS #2 — chantier 2-3j]

- [~] Migration Design System complète (style-tokens + tokens --ds-*) [Agent F]
- [~] **Signature électronique client** : canvas signature pad + bucket Supabase `livraisons-signatures` + champ `liv.signatureClient` (path)
- [~] **Photo BL émargé** : upload photo, bucket `livraisons-bl`, champ `liv.photoBL`
- [~] **GPS tracking** : `navigator.geolocation.watchPosition` au démarrage de tournée, géo-stamp à la livraison (`liv.posLivraison = {lat, lng, ts}`)
- [~] **Notifications push réelles** : `PushManager` + VAPID + SW handler `push` (actuellement localStorage polling)
- [~] **Filtre étendu J+1, retards** (actuellement = jour J uniquement)
- [~] **Détail marchandise/destinataire/ADR** affiché côté chauffeur
- [~] **Signalement incident métier** depuis fiche livraison (refus, retard, casse)
- [~] **Workflow guidé "Livraison terminée"** : signature → photo → km arrivée → statut=livré → horodatage

### Bilan Onglet 23 (reporté sprint dédié 2026-05-17)

9 items dont 4 features structurantes (signature, photo BL, GPS, push VAPID). Découpage suggéré :
1. Buckets Supabase + RLS (livraisons-signatures, livraisons-bl) = ~2h
2. Canvas signature pad + upload + champ schéma = ~4h
3. Photo BL upload + caméra access + redimensionnement = ~3h
4. GPS watchPosition + géo-stamp + battery-aware = ~4h
5. Push VAPID (génération keys + edge fn d'envoi + abonnement) = ~5h
6. Workflow guidé "Livraison terminée" chaîné = ~3h
7. Filtres J+1 + retards + détail marchandise + signalement incident = ~3h
Total estimé : 2-3 jours pleins (chantier prioritaire bloquant prod).

---

## 24. Transverse — [~] REPORTÉ sprint dédié (2026-05-17)

> **Hors périmètre refonte HTML PC.** Chantiers de fond (sync, IDB, A11y, perf) =
> ~3 jours cumulés. À découper en sprints H3 thématiques.

### 24.A — Supabase sync robustesse multi-device [TODO-LIVRAISONS #3 — 1-2j]

- [~] Race condition boot : flush en attente vs `pullAll()` → données locales écrasées. Ajouter merge ou flush-before-pull (entity-supabase-adapter.js:220-249)
- [~] Conflict resolution : Last-write-wins silencieux → ajouter `updated_at` versionning + toast warning
- [~] Retry online côté admin : `offline-queue.js` est mobile-only, brancher pour admin
- [~] Edit locks réels : `admin_edit_locks` table existe (migration 042) mais pas intégrée à `ajouterLivraison`/`confirmerEditLivraison`
- [~] Sanitize `extra` jsonb : nettoyer les champs déjà colonnes

### 24.B — Migration localStorage → IndexedDB [TODO-LIVRAISONS #5 — 1-2j]

- [~] Étendre `offline-queue.js` (déjà IDB pour photos) pour `livraisons` + `documents_livraison_*`
- [~] API `charger`/`sauvegarder` (script-core-storage.js) routent IDB pour gros datasets, localStorage pour petits
- [~] Upload PDF/HTML docs vers Supabase Storage bucket `livraison-docs` au lieu de localStorage
- [~] Helper `estimerTailleLocalStorage()` + alerte sidebar quand > 70% quota
- [~] Purge LRU automatique des `documents_livraison_*` anciens
- [~] Propager `sauvegarder()` return `false` vers callers (évite toast success si write échoué)

### 24.C — Bus events cross-entity généralisé [TODO-BACKLOG #6 — 1j]

- [~] Bus formalisé : `mca.events.on('livraisons:updated', cb)` + `mca.events.emit(...)`
- [~] Migration des refresh hardcodés vers listeners auto-subscribed
- [~] Throttle 100ms pour éviter spam de re-renders
- [~] Listener cleanup au démontage de page (memory leak)
- [~] Tests : émettre 5 events → 1 seul re-render observé

### 24.D — Performance [Plan v9 Phase IX — Agent H]

- [~] `pullLimit: 500` sur livraisons/charges/carburant (-3-5s boot)
- [~] Scheduler unifié 14 timers → 1 (-50% CPU)
- [~] Lazy `script-salaries.js` (56KB) + `script-planning.js` (57KB) + `script-vehicules.js` (52KB) + `script-charges.js` (43KB) = 208KB économisés
- [~] CSS bundle 33→1 fichier (script build)
- [~] localStorage quota guard + toast
- [~] SW CORE_ASSETS split SHELL_ASSETS / ROUTE_ASSETS (-2MB précache)

### 24.E — Accessibility WCAG/RGAA [Plan v9 Phase VIII — Agent G]

- [~] Skip link `<a href="#mainContent">` admin.html (présent salarie/m, manque admin) — *à vérifier*
- [~] salarie.html `<main>` + `<h1>` — *vérifier complétude*
- [~] `aria-invalid` + `aria-describedby` pattern formulaires
- [~] `<th scope="col/row">` sur 205 th admin.html
- [~] `aria-sort` sur 28 tables triables
- [~] `aria-busy` pendant async loads
- [~] `outline: none !important` fix `style-design-modals-refine.css:144`
- [~] `role="alert"` séparé pour erreurs (vs `role="status"` toasts)
- [~] `aria-expanded` mobile drawers
- [~] `@axe-core/playwright` intégration tests E2E

### 24.F — Dette technique [Plan v9 Phase X — Agent D]

- [x] `renderLivraisonsAdminFinal` refactor pipeline unique — *Phase X.BW lock-down*
- [x] `afficherToast` double définition supprimée — *Phase X.AV extraction toast*
- [~] `fermerFiche360` double définition supprimée
- [~] Doublons HT functions (carburant/entretiens) consolidés
- [~] `patchClientsRows/Fournisseurs` no-ops + observers supprimés
- [~] Migration SQL 009 `ON CONFLICT DO NOTHING` + 005 wrap `DO $$ IF EXISTS`
- [~] Indigo legacy `#6366f1` → `var(--ds-brand)` (30+ occurrences)
- [~] `script-dev-seed.js` conditionnel `<script>` (charger uniquement si `?seed=1`)
- [~] `version-bump.js` tooling (20 lignes Node)
- [~] ESLint `no-unused-vars` config
- [~] Pré-commit hook `node --test`

### 24.G — Reseed persistant [Audit V6 C4 — DEPEND_USER]

- [~] Désactiver adapters Supabase quand `?reseed=1` ET `auth_mode=local`, OU sync seed → Supabase

### 24.H — Supabase schema mismatch [Audit V6 C3 — DEPEND_USER]

- [~] Migration SQL : `ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS recurrence_actif boolean DEFAULT false;`

### Bilan Onglet 24 (reporté sprint dédié 2026-05-17)

8 chantiers transverses (~3j cumulés). Découpage suggéré H3 :
- **Sprint H3.A** : Sync robustesse multi-device (24.A) — 1-2j
- **Sprint H3.B** : Migration localStorage → IndexedDB (24.B) — 1-2j
- **Sprint H3.C** : A11y WCAG/RGAA batch (24.E) — 6h (déjà tracké H2.3)
- **Sprint H3.D** : Performance lazy-loading + scheduler (24.D) — 1j
- **Sprint H3.E** : Dette technique cleanup (24.F) — 2-3h
Autres (24.C bus events, 24.G reseed, 24.H schema mismatch) en backlog.

---

## 📊 Résumé

- **Onglets bloqués prod** : Salarié espace chauffeur (preuve livraison), Heures & Km (workflow pointage)
- **Onglets refonte majeure** : TVA (quasi-placeholder)
- **Drawers 360 PC manquants** : Clients, Fournisseurs, Véhicules, Salariés, Incidents, Inspections
- **Migration mobile parité** : m.html (Inspections absent, Heures vue chauffeur, Incidents filtres/export)
- **Transverse critique** : Sync robustesse, IDB scaling, Bus events, A11y th/aria-sort

## 🎯 Règle d'engagement

Quand on attaque l'onglet N, on :
1. Ouvre la section dans ce MD
2. Pour chaque `[ ]` : code → test → commit → coche `[x]`
3. Si pendant le fix on découvre un bug non listé ici → on le note en bas de la section onglet avec préfixe `🆕` (mais on continue à finir les `[ ]` existants AVANT de l'attaquer)
4. Aucun ajout d'item depuis sources externes (autres MD, ma "mémoire", suggestions agents)
5. Une fois tous les `[ ]` cochés → on passe à l'onglet suivant
