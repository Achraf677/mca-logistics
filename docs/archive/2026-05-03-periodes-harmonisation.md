# Audit & harmonisation des périodes — MCA Logistics

Date : 2026-05-03
Périmètre : tous les écrans avec sélecteur de mois / semaine / nav période,
PC (`script.js` + modules `script-*.js`) et mobile (`script-mobile.js`).
Mode : audit lecture seule + plan de migration. Aucun pilote appliqué dans ce
jet (recommandation prioritaire = la qualité du rapport, voir §6).

---

## 1. Tableau d'inventaire

Légende cellules :
- **Type** : `bar4` = bar PC complète (select mode + Précédent + label + Aujourd'hui + Suivant), `dropdown12` = dropdown 12 derniers mois, `chips-jour` = onglets jour de la semaine, `none` = pas de sélecteur (KPI mois courant figé, accordéon par mois).
- **Projection ?** : possibilité d'aller dans le futur (mois N+1, etc.).
- **Mémorisé ?** : le choix utilisateur survit-il à un re-render / change de page ?
- **Reset auto mois courant ?** : le sélecteur revient-il automatiquement sur le mois courant à chaque render si l'user n'a pas explicitement choisi (cf. v3.57) ?
- **Cohérence inter-écrans ?** : le mois choisi sur écran A est-il propagé sur écran B ?

### 1.a Côté PC (`admin.html`)

| Écran | Type | Projection ? | Mémorisé ? | Reset auto mois courant ? | Cohérence inter-écrans ? | Fichier |
|---|---|---|---|---|---|---|
| Dashboard | `none` (KPI mois courant figé via `aujourdhui()`) | non | n/a | n/a (toujours mois courant) | n/a | `script.js:1453-1530` |
| Livraisons | `bar4` (jour/sem/mois/année) + datepickers debut/fin custom | oui (offset libre) | oui (`_livPeriodeOffset`, `_livPeriodeMode`) | non — figé jusqu'à user-action ou navigation | non — variable locale au module | `script-livraisons.js:830-870`, `admin.html:307-326` |
| Encaissement | `none` (page = liste statuts, pas de date filter) | non | n/a | n/a | n/a | `script-encaissement.js`, `admin.html:1355-1359` |
| Paiements | `none` (page = factures émises, statuts) | non | n/a | n/a | n/a | `script-paiements.js`, `admin.html` (modal templates) |
| Charges | `bar4` | oui | oui (`_chargesPeriode.offset`) | non — figé | non | `script-charges.js:680-686`, `admin.html:1373-1389` |
| Carburant | `bar4` | oui | oui (`_carbPeriode.offset`) | non | non | `script-carburant.js:426-432`, `admin.html:483-498` |
| Entretiens | `bar4` | oui | oui (`_entrPeriode.offset`) | non | non | `script-entretiens.js:447-453`, `admin.html:1481-1496` |
| Inspections | `bar4` (default `semaine`) | oui | oui (`_inspPeriode.offset`) | non | non | `script-inspections.js:368-374`, `admin.html:1811-1827` |
| Incidents | `none` (filtre statut uniquement) | non | n/a | n/a | n/a | `script-incidents.js`, `admin.html` |
| TVA | `bar4` | **oui (utile : projection prochaine déclaration)** | oui (`_tvaPeriode.offset`) | non | non | `script-tva.js:488-520`, `admin.html:1028-1043` |
| Rentabilité | bouton legacy `<<` `>` `>>` (mois only) | oui | oui (`_rentMoisOffset`) | non | non | `script-core-periodes.js:18-32`, `admin.html` |
| Statistiques | `bar4` | oui | oui (`_statsPeriode.offset`) | non | non | `script-stats.js:54-60`, `admin.html:813-831` |
| Heures & Km | `bar4` (jour/sem/mois/année) — 4 offsets séparés | oui | oui mais 4 vars distinctes (`_heuresJourOffset`, `_heuresSemaineOffset`, `_heuresMoisOffset`, `_heuresAnneeOffset`) | non | non | `script-heures.js:97-124`, `admin.html:1551-1559` |
| Planning | `bar4` (default `semaine`) | oui | oui (`_planningPeriode`) — **mais aussi `_planningSemaineOffset` en doublon** | non | non | `script-planning.js:594-617`, `admin.html:1673-1685` |
| Alertes | `none` (filtre statut/recherche) | non | n/a | n/a | n/a | `script-alertes.js` |

**Helpers PC** : `script-core-periodes.js` (factory `getPeriodeRange`, helpers `changeSimplePeriode/navSimplePeriode/resetSimplePeriode`, `majPeriodeDisplay`). C'est déjà une bonne factorisation : 90 % des `bar4` PC s'appuient dessus, sauf Rentabilité (legacy `_rentMoisOffset`) et Heures (4 offsets séparés au lieu d'un offset + mode).

### 1.b Côté mobile (`script-mobile.js`)

| Écran | Type | Projection ? | Mémorisé ? | Reset auto mois courant ? | Cohérence inter-écrans ? | Lieu |
|---|---|---|---|---|---|---|
| Dashboard | `none` (mois courant figé via `M.moisKey()`) | non | n/a | oui (toujours `now`) | n/a | `script-mobile.js:3314-3473` |
| Livraisons | `none` (accordéon par mois, mois courant ouvert par défaut, autres collapsés) | n/a | `livraisonsMoisOuverts` (état d'ouverture) | n/a | n/a | `script-mobile.js:3477-3700` |
| Encaissement | `none` (filtre statut) | non | `encMoisOuverts` (accordéon) | n/a | n/a | `script-mobile.js:4867-5190` |
| Paiements | écran absent côté mobile (page paiements = PC only) | — | — | — | — | — |
| Charges | `none` (accordéon par mois) | n/a | `chargesMoisOuverts` | n/a | n/a | `script-mobile.js:5201-5465` |
| Carburant | `none` (accordéon) | n/a | `carbMoisOuverts` | n/a | n/a | `script-mobile.js:4612-4780` |
| Entretiens | `none` (KPI mois courant + groupe par mois) | non | n/a | oui (figé) | n/a | `script-mobile.js:6582-6720` |
| Inspections | `none` (filtre vehicule + recherche, pas de date) | non | n/a | n/a | n/a | `script-mobile.js:6727-6840` |
| Incidents | `none` (filtre statut) | non | n/a | n/a | n/a | `script-mobile.js:7249-7250+` |
| TVA | `dropdown12` (12 derniers mois) | **non** (limite `now - 11`, pas de mois futur) | oui (`M.state.tvaMois` + `tvaMoisManuel`) | **oui (cf. fix v3.57)** ✅ | non — clé local | `script-mobile.js:7456-7697` |
| Rentabilité | `dropdown12` | non | oui (`M.state.rentMois` + `rentMoisManuel`) | **oui** ✅ | non | `script-mobile.js:5471-5921` |
| Statistiques | `dropdown12` | non | oui (`M.state.statsMois` + `statsMoisManuel`) | **oui** ✅ | non | `script-mobile.js:7710-7930` |
| Heures & Km | `dropdown12` | non | oui (`M.state.heuresMois` + `heuresMoisManuel`) | **oui** ✅ | non | `script-mobile.js:7129-7242` |
| Planning | `chips-jour` (onglets jour de la semaine, pas de nav semaine, mois) + vue semaine fige semaine courante | non | `M.state.planningJour` (jour 0-6) | oui — toujours semaine courante | n/a | `script-mobile.js:3769-3990+` |
| Alertes | `none` (chips statut + recherche) | non | n/a | n/a | n/a | `script-mobile.js:4317-4500` |

**Helper mobile** : `M.computePeriodeRange` + `M.renderPeriodeBar` + `M.wirePeriodeBar` (`script-mobile.js:194-277`). Factory **déjà écrite** mais **utilisée nulle part dans le code mobile en prod** (zéro call à `renderPeriodeBar` actuellement). C'est dommage : le pattern unifié existe mais a été contourné par 4 implémentations ad-hoc en `dropdown12`.

---

## 2. Pattern recommandé : composant unifié `<PeriodPicker>`

### 2.a Variantes nécessaires

Trois besoins métier distincts, un seul code partagé :

1. **Mois** (cas dominant : 9 écrans PC, 4 écrans mobile)
2. **Semaine** (Planning, Inspections, Heures vue semaine)
3. **Multi-mode** (jour/semaine/mois/année — Livraisons, Stats, Heures)

### 2.b Spec UI unifiée (PC + mobile)

```
┌──────────────────────────────────────────────────────────┐
│  [‹]  ┌─ Mai 2026 ────────┐  [Aujourd'hui]  [›]          │
│       │ 1 mai → 31 mai    │                               │
│       └──── (dropdown) ───┘                               │
└──────────────────────────────────────────────────────────┘
```

- **Flèches** `‹` / `›` : navigation -1 / +1 (mois ou semaine selon mode).
- **Centre** : label cliquable → ouvre dropdown 12 mois passés + 6 mois futurs (configurable via prop `futureMonths`).
- **Sous-label** : dates ISO formatées `1 mai → 31 mai 2026`.
- **Bouton "Aujourd'hui"** : visible uniquement quand `offset !== 0`. Reset l'offset à 0 ET désactive le flag `userPicked` (pour réactiver le reset auto).
- Pour le mode multi (Livraisons/Stats/Heures) : ajouter row au-dessus avec chips `Jour | Sem. | Mois | An`.

### 2.c Spec API (mobile, à étendre côté PC)

L'API mobile existe déjà (cf. `script-mobile.js:194-277`), il faut juste :

```js
// Étendre la factory avec :
M.state.periodes[scope] = {
  mode: 'mois',
  offset: 0,
  userPicked: false,        // <-- nouveau (cf. fix v3.57)
  futureMonths: 6           // <-- nouveau (TVA = 6, autres = 0)
};

// Reset auto au render
M.useCurrentPeriode = function(scope, defMode, opts) {
  const st = M.state.periodes[scope];
  if (st && !st.userPicked) {
    // Recalcule offset = 0 (mois courant)
    st.offset = 0;
  }
};

// Quand l'user click sur dropdown / chips / flèches → userPicked = true
// Quand l'user click sur "Aujourd'hui" → userPicked = false (reset auto reactivé)
```

Côté PC, créer un homologue `MCAPeriodes.bind(scope, opts, refreshFn)` dans
`script-core-periodes.js` qui prend en charge le même contract et émet un
`document.dispatchEvent(new CustomEvent('mca:periode-change', { detail: {scope, range} }))`.

### 2.d Mémoire courte vs partagée

**Décision** : mémoire **locale par écran** (préserver le comportement actuel —
si l'user change de mois sur Charges, il ne s'attend pas forcément à le
retrouver sur TVA).

Exception : **mois courant** doit être commun et auto-recalculé via
`M.moisKey()` à chaque render quand `userPicked === false`. C'est le bon
équilibre : utilisateur prudent (ne change rien) → toujours à jour ; utilisateur
qui creuse un mois précis → garde son contexte écran par écran.

---

## 3. Cas TVA spécifique : projection future utile

La TVA est le **seul écran** qui justifie une projection N+1 / N+2 :

- L'utilisateur prépare sa déclaration CA3 du mois M en cours, mais peut
  vouloir simuler M+1 si une grosse facture est déjà émise / encaissable.
- Régime "encaissements" (transport routier, défaut MCA) : la TVA collectée
  d'une facture émise en avril mais encaissée le 5 mai apparaît en mai. Donc
  voir "mai 2026" en avril est **utile** (planification cash).

**Reco** : `futureMonths = 6` pour TVA (mobile dropdown va de M-11 à M+6).
Pour Rentabilité : `futureMonths = 3` (utile pour projection trimestre en
cours, devis grosse mission). Pour les autres : `futureMonths = 0`.

---

## 4. Cas Planning : semaine, pas mois

Garde son sélecteur de **semaine** spécifique (côté PC : déjà via `bar4`
mode `semaine` ; côté mobile : actuellement onglets jour seulement, pas de
nav semaine — manque grave).

**Reco mobile** : ajouter `M.renderPeriodeBar('planning', 'semaine')` au-dessus
des chips jour. L'UX sera : chips jour pour pointer un jour précis dans la
semaine sélectionnée, et `‹` `›` pour changer de semaine.

**Cohérence avec Mois** : mêmes flèches, même bouton "Aujourd'hui", mêmes
classes CSS (`.m-periode-bar` / `.nav-periode-bar`). Le label affiche
`Sem. 18 · 2026 / 28 avr → 4 mai` (déjà le cas dans `M.computePeriodeRange`).

---

## 5. Plan de migration (par étape, Git-tagguées)

### Étape 1 — Corriger 3 incohérences détectées (sans factory) — **30 min**
Tag : `v3.65-periodes-fix-reset-auto`

Bugs détectés pendant l'audit, corrigeables sans refactor :

1. **PC : pas de `userPicked` flag**. Les `bar4` PC ne reset jamais auto le mois
   courant. Si la PWA reste ouverte 2 jours et qu'on bascule de M vers M+1
   pendant la nuit, les écrans Charges/TVA/Rentabilité/Stats du PC restent figés
   sur l'ancien mois. → Ajouter `_chargesPeriode.userPicked` etc. + reset
   conditionnel dans `afficherCharges/TVA/etc.`.
2. **PC Heures** : 4 offsets séparés (`_heuresJourOffset`, `_heuresSemaineOffset`,
   `_heuresMoisOffset`, `_heuresAnneeOffset`) — incohérent avec le reste du PC
   qui utilise `_xxxPeriode.offset`. Refactor : un seul `_heuresPeriode = buildSimplePeriodeState()`.
3. **PC Planning** : variable `_planningSemaineOffset` (legacy) maintenue en
   doublon de `_planningPeriode.offset` → supprimer la variable legacy.

Effort : 30 min. Risque : faible (zone bien testée).
Rollback : revert un commit unique.

### Étape 2 — Étendre `M.renderPeriodeBar` + état `userPicked` — **1h**
Tag : `v3.66-periodes-mobile-factory-v2`

- Étendre `M.computePeriodeRange` pour accepter `futureMonths` dans la
  génération du dropdown.
- Ajouter le flag `userPicked` dans `M.state.periodes[scope]`.
- Helper `M.useCurrentPeriode(scope)` à appeler en début de render des écrans
  mobiles déjà migrés (TVA, Rent, Stats, Heures) → factorise les 4 lignes
  identiques `if (!M.state.xxxMoisManuel) M.state.xxxMois = M.moisKey()`.

Effort : 1h. Risque : faible (factory déjà testable isolément).
Rollback : revert.

### Étape 3 — Pilote mobile : migrer TVA + Rentabilité — **1h30**
Tag : `v3.67-periodes-pilote-tva-rent`

Remplacer `<select id="m-tva-mois">…</select>` par un appel à
`M.renderPeriodeBar('tva', 'mois', { futureMonths: 6 })` + 2 lignes dans
`afterRender` (`M.wirePeriodeBar`).

Bénéfices visibles immédiatement :
- Boutons `‹` / `›` apparaissent côté mobile (parité PC).
- Projection M+1…M+6 disponible pour TVA (cas business).
- Code dupliqué x4 → un seul appel.

Effort : 1h30. Risque : faible (pilote sur 2 écrans, autres restent legacy).
Rollback : revert (TVA/Rent retombent sur leur dropdown actuel).

### Étape 4 — Migrer Stats + Heures mobile — **45 min**
Tag : `v3.68-periodes-stats-heures`

Idem Étape 3 sur les 2 derniers écrans mobile avec dropdown.

Effort : 45 min. Risque : faible.

### Étape 5 — Ajouter sélecteur semaine au Planning mobile — **1h**
Tag : `v3.69-periodes-planning-semaine`

- Mode `semaine` au-dessus des chips jour.
- Labels : `Sem. N · 2026` / `28 avr → 4 mai`.
- Permet enfin de naviguer dans le planning passé/futur sur mobile (gros
  manque actuel : on ne peut voir QUE la semaine en cours).

Effort : 1h. Risque : moyen (logique métier planning sensible — tester rendu
absences longues qui chevauchent plusieurs semaines).

### Étape 6 — Migration PC : factory partagée — **2h-3h**
Tag : `v3.70-periodes-pc-factory`

Créer composant `MCAPeriodes` dans `script-core-periodes.js` qui :
- Génère la barre HTML (dropdown 18 mois + flèches + Aujourd'hui).
- Wire les events au lieu d'`onclick="navXxxPeriode(±1)"` inline dans `admin.html`.
- Émet event custom `mca:periode-change`.

Migrer Charges / Carburant / Entretiens / Stats / Inspections / TVA / Rent /
Heures / Planning / Livraisons. **Garder la fonction `navXxxPeriode` exposée
en window.* pour rétrocompat** (autres modules peuvent encore l'appeler).

Effort : 2h-3h. Risque : moyen (10 écrans, beaucoup d'IDs HTML existants à
préserver pour les libellés `xxx-mois-label` / `xxx-mois-dates`). À découper
en 2 sous-PR : une factory + 1 écran (TVA), puis batch des 9 autres.

### Étape 7 — Cleanup + doc — **30 min**
Tag : `v3.71-periodes-cleanup`

- Supprimer `_xxxMoisManuel` séparés au profit d'un champ uniforme dans
  `M.state.periodes[scope].userPicked`.
- Supprimer fonctions inutilisées `_rentMoisOffset` (remplacé par
  `_rentPeriode`).
- Doc dans `script-core-periodes.js` (header de fichier).

Effort : 30 min.

---

## 6. Estimation effort total

| Étape | Effort | Risque | Bénéfice |
|---|---|---|---|
| 1. Fix reset-auto PC | 30 min | faible | corrige bug vol. mois courant après 24h |
| 2. Factory mobile v2 | 1h | faible | dette tech mobile |
| 3. Pilote TVA + Rent mobile | 1h30 | faible | parité visible |
| 4. Stats + Heures mobile | 45 min | faible | cohérence mobile |
| 5. Planning mobile semaine | 1h | moyen | feature manquante |
| 6. Migration PC factory | 2h-3h | moyen | dette tech PC + cohérence inter-écrans |
| 7. Cleanup + doc | 30 min | faible | maintenabilité |
| **TOTAL** | **7h-8h** | **faible/moyen** | gros gain UX + 50% code en moins |

**Recommandation** : étapes 1, 2, 3 en priorité immédiate (3h cumulées,
gain UX visible, risque faible). Étapes 4-7 en cycle suivant.

---

## 7. Pilote : non appliqué dans cette session

Conformément à la mission (priorité = qualité du rapport), aucun pilote n'a
été appliqué. Le pilote mobile TVA + Rent (Étape 3 ci-dessus) est prêt à
implémenter dès validation. Bumps de version requis : `v3.67`.

Si pilote validé en session suivante, modifications limitées à :
- `script-mobile.js` (zone TVA `7456-7697` + Rent `5471-5921`)
- Aucune modif PC (`script.js`, `script-tva.js`, etc. intacts).
- Aucune modif HTML.

Vérification syntaxe : `node -c script-mobile.js` après modif.

---

## 8. Synthèse takeaways

1. **PC = bien factorisé déjà** (`script-core-periodes.js`) — sauf 3 cas legacy
   (Heures × 4 offsets, Planning × 2 vars, Rent `_rentMoisOffset`). Reset auto
   mois courant **manquant partout sur PC** (cf. fix v3.57 mobile).
2. **Mobile = 4 implémentations dropdown copiées-collées** (TVA / Rent / Stats /
   Heures) alors qu'une factory `M.renderPeriodeBar` existe mais n'est jamais
   appelée. Code mort.
3. **Pas de cohérence inter-écrans** : choisir avril sur Charges PC ne se
   répercute pas sur TVA. Préférence locale = volontaire (conserver), mais à
   documenter.
4. **TVA = seul cas où la projection future est utile** business (déclaration
   CA3 anticipée, transport routier régime encaissements).
5. **Planning mobile = pas de navigation semaine** : gap fonctionnel à
   combler en Étape 5.

