# Audit "site prêt à utiliser" — MCA Logistics

Date : 2026-05-04
Branche : `claude/add-supabase-mcp-CuBe2`
Périmètre : tout l'app (PC `admin.html` / mobile `m.html`)
Mode : LECTURE SEULE — aucune modification.
Référence design : v3.64 "Asphalt & Speed Red" (cf. `infra/design/option-2-asphalt-speedred.html`).

---

## Score global

- **Mobile** : **78 %** (orange — utilisable au quotidien, frustrations sur 3-4 pages)
- **PC** : **84 %** (orange-vert — proche du prêt-prod, manque cohérence design + 2 dettes tech)
- **Global** : **81 %**

Verdict : utilisable en prod aujourd'hui pour Achraf seul (transport routier, mode encaissements). Pour passer à un autre user/recettage commercial, il faut nettoyer ~12 bloquants (≈ 12-16 h).

---

## Tableau par page

Légende : Fonc. = fonctionnel · Lay. = layout · Écr. = écritures · Cosm. = cosmétique · Par. = parité PC↔mobile.

### Mobile (m.html + script-mobile.js, 22 routes)

| Page | Fonc. | Lay. | Écr. | Cosm. | Par. | Score | Bloquants |
|---|---|---|---|---|---|---|---|
| Dashboard | 95 | 85 | 70 | 80 | 90 | **84%** | "Bonjour Admin" (44), emojis KPI (9, 10), sous-titres redondants (28) |
| Livraisons | 90 | 85 | 75 | 80 | 90 | **84%** | accordéon mois sans nav semaine/jour, sous-titre "Tape sur le bouton +" (40) |
| Planning | 70 | 65 | 70 | 80 | 60 | **69%** | **Pas de nav semaine** (étape 5 plan périodes), chips jour seulement, voir mois passé impossible |
| Alertes | 90 | 85 | 80 | 75 | 90 | **84%** | "Tout est nickel 🎉" (30), badges colorés ronds emoji (6) |
| Encaissement | 88 | 85 | 80 | 80 | 80 | **83%** | "Aucune facture en retard 🎉" (29), pas de filtre période |
| Charges | 90 | 80 | 85 | 75 | 80 | **82%** | accordéon mois OK, **pas de nav période**, emojis catégories selects (19) |
| Carburant | 90 | 80 | 85 | 70 | 80 | **81%** | accordéon OK, pas de nav période, emojis types (22) |
| Rentabilité | 85 | 75 | 65 | 65 | 85 | **75%** | **Pas de chart doughnut** (juste barre stack), tutoiement simulateur (35, 41), emojis sous-sections (11, 12), formule visible (2, 3) |
| Clients | 90 | 85 | 90 | 80 | 90 | **87%** | emojis catégories pro (23) |
| Fournisseurs | 90 | 85 | 90 | 80 | 90 | **87%** | RAS majeur |
| Véhicules | 88 | 80 | 85 | 65 | 85 | **81%** | emojis types carbu (22), modes financement (24), placeholders "Ex :" (43) |
| Entretiens | 88 | 80 | 90 | 80 | 80 | **83%** | KPI mois courant figé (pas de nav), pas de filtre véhicule visible |
| Inspections | 85 | 80 | 85 | 80 | 75 | **81%** | "Tape sur une photo (bientôt)" — feature stub visible utilisateur |
| Salariés | 90 | 85 | 85 | 80 | 80 | **84%** | OK, drawer 360° pas mobile (parité PC manquante) |
| Heures & Km | 88 | 80 | 80 | 75 | 90 | **83%** | OK fix v3.57 reset auto, dropdown 12 mois |
| Incidents | 80 | 80 | 85 | 70 | 80 | **79%** | Sévérité/statut emojis (25, 26), 2 ✅ différents (Traité/Résolu) ambigu |
| TVA | 75 | 75 | 65 | 70 | 70 | **71%** | **Pas de saisie TVA mixte / manuelle** (taux verrouillés 0/5,5/10/20), tutoiement (37), emojis tabs (15), pas de nav future (étape 3 plan) |
| Statistiques | 88 | 85 | 90 | 80 | 70 | **83%** | Bonnes barres SVG, pas de comparatif annuel multi-année, **phrase "ouvre la version PC" assumée** |
| Calendrier | 80 | 75 | 85 | 80 | 60 | **76%** | parité PC ~partielle (jour/sem/mois/an mais moins riche) |
| Recherche globale | 95 | 90 | 90 | 90 | 95 | **92%** | RAS (point fort) |
| Audit (debug) | 90 | 80 | 80 | 80 | 70 | **80%** | dev tool, OK |
| Paramètres | 70 | 80 | 85 | 80 | 30 | **69%** | **Très limitée** : régime TVA / mdp / thème / logout uniquement. Phrase "options avancées sur PC" assumée. Manque entreprise édit, postes, salaires, alertes config. |

**Moyenne mobile : ≈ 78 %** (pondéré usage : Dashboard, Livraisons, Charges, Rentabilité, TVA pèsent plus).

### PC (admin.html + script.js + script-*.js, 21 pages)

| Page | Fonc. | Lay. | Écr. | Cosm. | Par. | Score | Bloquants |
|---|---|---|---|---|---|---|---|
| Dashboard | 95 | 85 | 80 | 75 | 90 | **85%** | hero santé OK, score ring OK, KPI sous-titres redondants (17), formule visible (16) |
| Livraisons | 95 | 85 | 80 | 80 | 90 | **86%** | bulk OK, kanban + calendrier OK, **reset auto mois** manquant (étape 1 plan) |
| Calendrier | 90 | 85 | 90 | 85 | 60 | **82%** | très riche (vue jour/sem/mois/an + DnD), parité mobile faible |
| Planning | 90 | 80 | 80 | 70 | 75 | **79%** | `_planningSemaineOffset` legacy doublon (étape 1), emojis types jour (21) |
| Alertes | 90 | 85 | 80 | 75 | 90 | **84%** | timeline OK, emojis filtres select (18) |
| Clients | 95 | 85 | 90 | 85 | 90 | **89%** | drawer 360° OK, fiche pro propre |
| Fournisseurs | 95 | 85 | 90 | 85 | 90 | **89%** | drawer 360° OK |
| Véhicules | 90 | 80 | 80 | 75 | 85 | **82%** | TCO OK, fiche 360°, placeholders "Ex :" (43) |
| Carburant | 92 | 85 | 85 | 80 | 80 | **84%** | bar4 OK, anomalies OK |
| Entretiens | 92 | 85 | 85 | 80 | 80 | **84%** | bar4 OK |
| Inspections | 88 | 80 | 85 | 80 | 80 | **83%** | OK |
| Salariés | 90 | 80 | 85 | 80 | 80 | **83%** | RH 360° OK, drawer riche |
| Heures & Km | 88 | 80 | 85 | 75 | 90 | **84%** | **4 offsets séparés** (étape 1 plan) au lieu d'1 |
| Incidents | 88 | 85 | 90 | 80 | 80 | **85%** | OK |
| TVA | 80 | 80 | 70 | 70 | 70 | **74%** | **Pas de TVA mixte/manuelle**, regroupement par taux côté PC mais saisie verrouillée 0/5,5/10/20, "Mode TVA" wording (37) |
| Encaissement | 88 | 85 | 85 | 80 | 80 | **84%** | onclick lourds, OK fonctionnellement |
| Charges | 92 | 85 | 85 | 80 | 80 | **84%** | bar4 OK, emojis catégories (19) |
| Rentabilité | 92 | 80 | 80 | 75 | 85 | **82%** | Chart.js doughnut OK, 7 KPI cards avec emojis (34) |
| Statistiques | 92 | 85 | 85 | 80 | 70 | **82%** | Chart.js bar/pie OK, mobile fait du SVG inline équivalent |
| Paramètres | 90 | 75 | 80 | 75 | 30 | **70%** | sidebar interne 8 sections OK (Sprint 29), **mais mobile très limité** |
| Recherche (Ctrl+K) | 95 | 90 | 90 | 90 | 95 | **92%** | command palette excellente |

**Moyenne PC : ≈ 84 %**.

---

## Top-10 bloquants (à fixer en priorité)

| # | Sujet | Mobile | PC | Fichier / ligne | Effort |
|---|---|---|---|---|---|
| 1 | **TVA mixte / saisie manuelle impossible** : taux verrouillé en `<select>` 0/5,5/10/20. Une livraison à 2 taux ou un taux non-standard (Outre-mer 8,5%, intra-UE 0%, taux marge) casse la saisie. | oui | oui | `script-mobile.js:580-585`, `admin.html:1884-1890`, `script-mobile.js:1285-1290` (charges) | **3-4h** : ajouter option "Personnalisé" + champ libre `tauxTva`, gérer la validation + recalc TTC |
| 2 | **Pas de nav semaine sur Planning mobile** : seuls les chips jour s'affichent, impossible de voir une semaine passée/future. | oui | non | `script-mobile.js:3769-3990` | **1h** (étape 5 plan périodes-harmonisation) |
| 3 | **PC : reset auto mois courant manquant** : 6 écrans figés sur ancien mois après 24h ouverte. | non | oui | `script-charges.js:680`, `script-tva.js:488`, etc. | **30min** (étape 1 plan périodes) |
| 4 | **Mobile rentabilité : pas de chart doughnut** ; PC en a 1 (Chart.js). Barre stackée OK mais faible visualisation. | oui | non | `script-mobile.js:5471-5921` | **2h** : Chart.js lazy load + render canvas |
| 5 | **Mobile paramètres très pauvre** (régime TVA / mdp / thème / logout) ; phrase "options avancées sur PC" exposée. | oui | non | `script-mobile.js:8350-8488` | **3h** : ajouter sections Entreprise (édit), Postes, Sauvegarde JSON, Délai paiement défaut, Alertes config (au moins 5 toggles) |
| 6 | **PC Heures & Km : 4 offsets séparés** au lieu d'un seul (incohérent vs reste PC). | non | oui | `script-heures.js:97-124` | **1h** (étape 1 plan périodes) |
| 7 | **PC Planning : `_planningSemaineOffset` legacy doublon** (var inutilisée mais maintenue). | non | oui | `script-planning.js:594-617` | **15min** (étape 1 plan périodes) |
| 8 | **TVA bandeau "récap simplifié"** : phrase défensive longue qui parle de ce que l'app *ne fait pas* (CA3 sur impots.gouv.fr). | oui | oui | `script-mobile.js:7607` | **5min** texte |
| 9 | **Tutoiement infantile + emojis dans templates SMS** ("Bonjour {prenom} ☀️ 🚐 Merci 🙏") — message envoyé en réel à clients/chauffeurs. | non | oui | `script.js:2443-2447, 2803-2807` | **15min** texte |
| 10 | **Mobile inspections : "Tape sur une photo (bientôt)"** — stub feature visible utilisateur. | oui | non | `script-mobile.js:6869` | **1h** : ajouter lightbox simple OU retirer le hint |

**Effort total Top-10 : ≈ 12h**.

---

## Améliorations recommandées (Top-20)

| # | Sujet | Effort |
|---|---|---|
| 11 | Retirer 30+ emojis décoratifs dans selects (carbu, modes financement, statuts, sévérités…) — cf. UX cleanup findings 19-27 | 1h |
| 12 | Retirer emojis devant KPI dashboard mobile (`📈 Bénéfice`, `📦 Livraisons` etc.) — couleur de carte suffit | 15min |
| 13 | Retirer 💡 + tutoiement formules rentabilité mobile (findings 2, 3) | 10min |
| 14 | Reformuler "Renseigne tes hypothèses" en vouvoiement homogène PC + tutoiement mobile cohérent (finding 35) | 20min |
| 15 | Charges : pas de nav période mobile (accordéon mois OK mais limité). Ajouter `M.renderPeriodeBar('charges')` | 30min |
| 16 | Carburant idem : ajouter `M.renderPeriodeBar('carburant')` | 30min |
| 17 | Entretiens mobile : KPI mois courant figé, ajouter sélecteur mois | 30min |
| 18 | Encaissement mobile : ajouter filtre période (actuellement liste statut uniquement) | 1h |
| 19 | Stats mobile : ajouter comparatif multi-année (PC en a, mobile coupe à 12 mois glissants) | 2h |
| 20 | Mobile : drawer 360° client/fournisseur/véhicule (PC a SPRINT 21+25, mobile a juste detail simple) | 3h |
| 21 | PC : factory `MCAPeriodes` partagée (étape 6 plan périodes) — réduire 50 % du code période | 2-3h |
| 22 | Login.html : audit de l'écran login (40Ko = potentiellement riche/lourd, à scinder) | 1h |
| 23 | Salarie.html : page séparée 50Ko, vérifier orthographe + parité avec admin.html#page-espace-salarie | 1h |
| 24 | Mobile FAB Inspections + Bulk : 2 FABs visibles simultanément (encombrement écran) | 30min |
| 25 | PC topbar : "Agent IA" badge orange visible en permanence — doublon avec ai-status-bar (à clarifier) | 30min |
| 26 | Empty states : harmoniser (certains ont 🎉 d'autres pas, certains tutoient, d'autres vouvoient) | 1h |
| 27 | Mobile : prévoir page "Audit" en debug-only (actuellement registered = visible à l'user) | 5min |
| 28 | Pré-masquage CSS sidebar admin (lignes 42-56 admin.html) : 13 sélecteurs `display:none` durs — fragile, à factoriser | 15min |
| 29 | Mobile alertes : préfixes 🔴/🟡/🟢 dans select filtre (finding 18) | 5min |
| 30 | "🗜️ Vue compacte" / "📋 Vue normale" toast — l'icône étau pour vue compacte est obscure | 5min |

**Effort total Top-20 (en plus du Top-10) : ≈ 14h**.

---

## Cosmétique / parité design v3.64

### Ce qui est OK
- Palette `--m-accent: #e63946` partout cohérente sur mobile (`style-mobile.css:8-15`)
- Palette `--accent: #e63946` sur PC (`style.css:6-17`)
- Logo MCA présent topbar PC + header mobile
- Police DM Sans + Syne PC, system-ui mobile (cohérent par plateforme)
- Hero santé + score ring PC = signature design
- Empty states avec icône centrale large (pattern cohérent)

### Ce qui n'est PAS OK
- **PC : ~30 occurrences résiduelles `#f5a623` (orange ancien palette)** dans `style.css` lignes 586, 1767, 1787, 1815, 1850, 1975, 2038, 2093, 2138, 2177, 2245, 2248, 2341… → couleur orange "warning" qui devrait passer sur `--accent-soft` ou nouveau token. Effort : 1-2h pour rebrand complet.
- **Mobile : 50+ emojis décoratifs** dans titres KPI / sous-titres / labels selects (cf. rapport UX 57 findings). Effort cumulé : 4-5h.
- **Mobile bottom nav** : émojis `📊 📦 📅 🔔 ⋯` cohérents et UTILES (cf. finding 54 — gardés volontairement).
- **Mobile drawer "Plus"** : emojis section labels + items cohérents avec sidebar PC (✅).
- **PC : sidebar avec icônes émojis** (`📊 Dashboard`, `📦 Livraisons`…) cohérent mais émojis de système (rendu varie selon OS, donc rendu inconsistant entre Windows/Mac). À long terme → SVG sprite mais pas urgent.
- **Mobile Inspection FAB double** : `+` (orange) + `☑` (bleu) côte à côte — l'utilisateur ne sait pas lequel est principal.
- **Toast notifications** : 2 styles (top-right PC, bottom mobile) — OK, attendu.
- **Cards mobile** : `m-card-green/blue/purple/red/accent` cohérent ; PC `stat-pill-orange/green/red` — vocabulaire diverge.

---

## Audit écritures (orthographe / ton)

Référence détaillée : `infra/ux/2026-05-03-cleanup-utile-inutile.md` (47 findings actionables, 4-5h d'effort).

### Top des fautes / formulations à corriger

1. **Tutoiement infantile** (au moins 8 occurrences) :
   - "Renseigne tes hypothèses" / "Configure tes hypothèses" (finding 35, 41)
   - "Tape sur le bouton ➕ pour ajouter ta première livraison" (finding 40)
   - "Tape sur '🏖️ Absence longue' en haut pour en créer." (finding 47)
   - "Vérifie + complète" status OCR (finding 46)
   - "Bonjour [Admin] 👋" (44) + "Bonjour {prenom} ☀️" SMS (7)
   - "Tu peux te faire rembourser" TVA (38)
   - "Ton entreprise n'est pas assujettie à la TVA" — OK gardé mais limite
   - "ton activité couvre ses coûts" (13)

2. **Phrases défensives / méta-info technique** :
   - "💡 Simulateur de rentabilité (parité PC). Configure tes hypothèses…" — "(parité PC)" ne parle qu'aux dev (1)
   - "Récap simplifié. La déclaration officielle CA3 doit être saisie sur impots.gouv.fr (pas générée par l'app)." — long, défensif (36)
   - "Une livraison apparaît dans le mois de son paiement (pas de sa facturation). C'est la règle officielle du transport routier." (37)
   - "Pour les graphiques d'évolution annuelle, exports et comparatifs avancés, ouvre la version PC." (stats mobile :7917)
   - "Modification de l'entreprise, gestion des utilisateurs, sauvegarde et options avancées sont sur la version PC." (parametres mobile :8434)

3. **Formules visibles utilisateur** :
   - "💡 Marge estimée = CA - (km × coût/km flotte X €/km)" (2)
   - "💡 Marge estimée : CA - carburant chauffeur - autres charges (au prorata des km)" (3)
   - "💰 CA HT − dépenses" sous-titre KPI (16)

4. **Registres oraux / startup-y déplacés** :
   - "Tout est nickel 🎉" alertes (30)
   - "Aucune facture en retard 🎉" (29)
   - "Activité rentable avec ces paramètres" — "avec ces paramètres" CYA inutile (39)

5. **Orthographe / typographie** :
   - "tournee" / "tournée" mix (search global :8194 vs labels — mais tournée correct ailleurs)
   - "necessite" (ASCII) dans commentaires sw.js → OK c'est code, pas user-visible
   - Mobile inspections : "Inspections recues" (sans accent) `:6765` — à corriger en "reçues"
   - "verrouillé" / "vérouillé" : OK pas de faute trouvée
   - Plein passage cherché ASCII-only en commentaires JS, c'est normal (anti-corruption git linux)

### Ce qui est BIEN écrit (à garder)

- TVA bandeau "Mode TVA : Services (exigible à l'encaissement)" — utile métier
- Avertissements LDV, ADR, CE 561/2006 — conformité réglementaire claire
- Empty states métier avec icône large (Recherche, Livraisons vides, etc.) — pattern propre
- Toast confirmations courtes ("Mot de passe mis à jour", "Configuration TVA enregistrée")

---

## Intégrations manquantes (pour autre agent)

À cadrer avec un agent dédié `integrations-planner` :

| Intégration | Statut | Bénéfice attendu | Effort estimé |
|---|---|---|---|
| **Pennylane** import CSV/FEC | Mis de côté (premium requis) — voir CLAUDE.md | Auto-fill charges, paiements clients/fournisseurs, rapprochement factures | 1 jour parser + 0,5j UI |
| **Qonto API** (transactions banque) | Pas vu de code | Match auto encaissement / paiements charges | 1-2 jours |
| **PappersAPI / SIRENE** (auto-fill SIRET) | Champs présents (`tva-intracom`, `siret`) mais pas d'auto-complétion | Saisie client/fournisseur 5x plus rapide | 0,5j |
| **Google Maps / OSM Routing** | `distance` saisi à la main | Auto-calcul km départ→arrivée | 0,5j |
| **DocuSign / signature électronique** | Mention "signature BL" SPRINT 26 mais cadre flou | LDV signée numériquement | 1j |
| **Tachygraphe (chronotachygraphe)** | Heures saisies main, pas d'import | Conformité CE 561/2006 auto | 2j (format K-format) |

Recommandation : Qonto + Pennylane couvrent 80 % du besoin compta. Le reste = bonus.

---

## Graphiques manquants

| Page | PC | Mobile | Manquant côté mobile |
|---|---|---|---|
| Dashboard | Chart.js bar (activité 12 mois) | KPI cards seulement | **Bar chart 12 mois** absent mobile |
| Rentabilité | Chart.js doughnut (répartition charges) + KPI | Barre stack horizontal HTML | Doughnut Chart.js (visualisation plus claire) |
| Statistiques | Chart.js bar (CA + chauffeurs + véhicules + CA/chauffeur) | SVG inline 12 barres mois (CA + dépenses) + Top 5 barres pcent | OK fonctionnellement, mais charts CA/chauffeur, CA/véhicule absents mobile |
| TVA | Récap chiffré, pas de chart | Récap chiffré, pas de chart | Pas de besoin |
| Heures & Km | Tableau, pas de chart | Tableau | OK (pas de besoin chart) |
| Carburant | Anomalies en text + ratios L/100 | Liste accordéon | Manque graphique évolution conso/véhicule |

**Investissement Chart.js mobile** : ~2h (Chart.js déjà chargé via CDN PC). Lazy load dans `script-mobile.js` quand page rentabilité/dashboard ouverte.

---

## Reco priorités prochaines sessions

### Sprint 1 — Bloquants critiques (1 jour, ~7h)
1. **TVA mixte / saisie taux libre** (3-4h) — top bloquant signalé user
2. **Reset auto mois courant PC + Heures × 4 offsets + Planning legacy** (étape 1 plan périodes, 30 + 60 + 15 = 1h45)
3. **Texte SMS templates** : retirer 👋 ☀️ 🚐 🙏 (15min)
4. **TVA bandeau "récap simplifié"** raccourcir (5min)
5. **Tutoiement findings 35, 41, 47** : reformulation neutre (30min)
6. **Inspections mobile "(bientôt)"** : retirer hint OU lightbox simple (30min-1h)

### Sprint 2 — Parité mobile + UX (1 jour, ~7h)
1. **Planning mobile : nav semaine** (étape 5 plan périodes, 1h)
2. **Charges/Carburant mobile : sélecteur période** (1h)
3. **Stats/Rentabilité mobile : Chart.js doughnut + bar** (2h)
4. **Paramètres mobile : édition entreprise + postes + alertes config** (3h)

### Sprint 3 — Cosmétique massive (1 jour, ~7h)
1. **Cleanup 50 emojis décoratifs** (selects, KPI titles, sous-titres) — 4-5h pour les findings 1-34 du rapport UX
2. **PC : remplacer #f5a623 résiduels par tokens v3.64** (1-2h)
3. **Encaissement mobile : filtre période** (1h)

**Total 3 sprints : ≈ 21h pour passer de 81 % → 95 %.**

---

## Synthèse honnête

### Ce qui est BIEN fait
- **Architecture mobile-PC séparée + sync Supabase** propre, schémas harmonisés (`migrerSchemas`)
- **Recherche globale** (mobile + Ctrl+K PC) = excellent point d'entrée
- **Drawer 360° PC** Client/Fournisseur/Véhicule/Salarié = vraie valeur métier
- **Conformité TVA encaissements** transport routier respectée (rare dans les PGI)
- **Hero santé + score ring** dashboard PC = signature visuelle
- **Service Worker + offline-queue + auto-sync** = robustesse PWA
- **Bulk actions livraisons** PC + mobile

### Ce qui est FRAGILE
- **`script.js` 13 612 lignes / 664 Ko** monolithique (plan de découpage existe mais non exécuté)
- **`script-mobile.js` 8 766 lignes / 525 Ko** pareil — plus de fichier mobile que la lib Chart.js minifiée
- **TVA verrouillée à 4 taux** (impossible mixte) = bloquant pour Outre-mer / intra-UE / taux marge
- **PC : 222 onclick=** dans HTML — refactor événements à terme nécessaire
- **Pré-masquage CSS sidebar dur** (admin.html:42-56) = patch fragile pour anti-flash sprint 22
- **Phrases "voir version PC"** mobile = aveu de parité incomplète

### Verdict
**81 % global = utilisable demain matin par Achraf.**
Pour onboarder un user externe (autre admin ou commercial / recettage) → viser 95 % via les 3 sprints décrits (≈ 21h).
Pour un déploiement multi-tenant ou commercialisation → ajout intégrations Qonto + Pennylane + refactor bundles (≈ 5-10 jours en plus).
