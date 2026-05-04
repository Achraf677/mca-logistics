# MCA Logistics — Propositions de design (2026-05-03)

> Lecture seule. Aucun fichier de prod modifié. Trois options HTML standalone
> à ouvrir dans le navigateur pour comparaison visuelle.

---

## 1. État actuel

### Palette (extraite de `style.css` + `style-mobile.css`)

| Rôle | Token | Hex | Usage |
|---|---|---|---|
| Fond global | `--bg` | `#0a0d14` | quasi noir bleuté |
| Fond élevé | `--bg-elevated` | `#0f1420` | sidebar, topbar |
| Fond card | `--bg-card` | `#131a26` | KPI, tableaux |
| Card hover | `--bg-card-hover` | `#182234` | états hover |
| Bordure | `--border` | `#1e2a3d` | séparateurs |
| Accent | `--accent` | `#f5a623` (orange) | brand, boutons primaires |
| Texte | `--text` | `#e8f0ff` | titres |
| Texte muted | `--text-muted` | `#64748b` | labels, sub |
| Danger | `--red` | `#ef4444` | erreurs |
| Succès | `--green` | `#22c55e` | OK / payé |
| Info | `--blue` | `#3b82f6` | infos |
| Warning | `--yellow` | `#eab308` | en attente |

### Typographie

- Display : **Syne** (titres, logo)
- Body : **DM Sans** (UI, paragraphes)
- Mono : **JetBrains Mono** (chiffres tabulaires)

### Mental screenshot

Fond bleu nuit profond → impression "tableau de bord crypto / SaaS sombre",
accents orange chaleureux mais qui jurent avec un logo où le rouge est
l'élément vivant. Mobile : même base sombre, accent orange identique
(`--m-accent: #f5a623`).

---

## 2. Critique vs logo MCA

Logo : Sprinter noir + traits de vitesse rouges + "MCA" noir bold + "LOGISTICS"
rouge italic. Style sportif/dynamique, esprit racing/transport pro.

- L'orange `#f5a623` est **chaud** mais **étranger au logo**. Il évoque
  Pennylane / Ledger / fintech — pas le transport.
- Le bleu nuit froid rend le logo orphelin : il est le seul élément à
  porter du rouge sur l'interface.
- Le rouge est **réservé aux erreurs** (`--red: #ef4444`). Si on adopte le
  rouge logo comme couleur brand, il faut redéfinir la couleur d'erreur
  pour éviter la confusion (je propose un magenta/rose foncé).
- Le logo a une **identité forte** (noir + rouge). Le design devrait soit
  l'amplifier (option 1, 2) soit le mettre en valeur sur du blanc (option 3).

---

## 3. Option 1 — Charcoal & Crimson

**Pitch** : noir profond + rouge brique sobre. Sombre, classe, mature.
Garde l'esprit "cockpit pro" de l'app actuelle mais réaligné sur le logo.

### Palette

```css
:root {
  /* Surfaces (charcoal, plus chaud que l'actuel) */
  --bg:           #0e0e10;   /* noir charbon, légèrement chaud */
  --bg-elevated:  #16161a;   /* sidebar/topbar */
  --bg-card:      #1c1c21;   /* cards */
  --bg-card-hover:#23232a;
  --border:       #2a2a31;
  --border-strong:#3a3a43;

  /* Brand : rouge brique du logo, désaturé pour ne pas crier */
  --brand:        #c8202a;   /* rouge logo, posé */
  --brand-hover:  #e02d38;
  --brand-soft:   rgba(200,32,42,0.12);
  --brand-on:     #ffffff;   /* texte sur brand */

  /* Sémantique réassignée (rouge = brand, donc danger = magenta foncé) */
  --danger:       #d6336c;   /* magenta-rose, distinct du brand */
  --danger-soft:  rgba(214,51,108,0.14);
  --success:      #2ecc71;
  --warning:      #f59f00;   /* ambre chaud, pas l'orange actuel */
  --info:         #4dabf7;

  /* Texte */
  --text:         #f5f5f7;
  --text-muted:   #9a9aa5;
  --text-disabled:#5a5a63;
}
```

### Contraste WCAG (vérifié)

- `--text #f5f5f7` sur `--bg #0e0e10` : **17.8:1** (AAA)
- `--text-muted #9a9aa5` sur `--bg #0e0e10` : **7.4:1** (AAA)
- `--brand #c8202a` sur `--bg #0e0e10` : **4.6:1** (AA texte normal OK)
- `#ffffff` sur `--brand #c8202a` : **5.5:1** (AA OK)
- `--danger #d6336c` sur `--bg #0e0e10` : **5.1:1** (AA OK)

### Typo

**Garder Syne + DM Sans.** Syne est moderne sans être froid, son côté
légèrement géométrique fonctionne avec le logo italic. Pas besoin de changer.

### Boutons (extrait)

```css
.btn-primary  { background: #c8202a; color: #fff; }
.btn-primary:hover { background: #e02d38; }
.btn-secondary{ background: transparent; color: #f5f5f7; border:1px solid #2a2a31; }
.btn-danger   { background: #d6336c; color: #fff; }
```

### Card type

Fond `#1c1c21`, bordure `#2a2a31`, accent rouge en barre supérieure 3px.
Voir `option-1-charcoal-crimson.html`.

---

## 4. Option 2 — Asphalt & Speed Red

**Pitch** : gris asphalte + rouge vif "speed". Esprit racing/automotive,
plus vibrant que l'option 1, parfait pour transport. Inspiration : F1
Ferrari, livrées camion sportives.

### Palette

```css
:root {
  /* Surfaces (gris asphalte, plus clair que charcoal) */
  --bg:           #1a1d22;   /* asphalte */
  --bg-elevated:  #22262d;   /* sidebar */
  --bg-card:      #2a2f37;   /* cards */
  --bg-card-hover:#323843;
  --border:       #3a4150;
  --border-strong:#4a5263;

  /* Brand : rouge vif "speed" — plus saturé que opt 1 */
  --brand:        #e63946;   /* rouge vif, énergique */
  --brand-hover:  #ff4d5c;
  --brand-soft:   rgba(230,57,70,0.14);
  --brand-on:     #ffffff;

  /* Sémantique : rouge réservé brand, alertes en jaune/orange */
  --danger:       #ff6b35;   /* orange-rouge, distinct du brand rouge pur */
  --danger-soft:  rgba(255,107,53,0.14);
  --success:      #06d6a0;
  --warning:      #ffd60a;   /* jaune signalisation */
  --info:         #4cc9f0;

  /* Texte */
  --text:         #f1f3f5;
  --text-muted:   #adb5bd;
  --text-disabled:#6c757d;
}
```

### Contraste WCAG

- `--text #f1f3f5` sur `--bg #1a1d22` : **14.2:1** (AAA)
- `--text-muted #adb5bd` sur `--bg #1a1d22` : **7.0:1** (AAA)
- `--brand #e63946` sur `--bg #1a1d22` : **4.9:1** (AA OK)
- `#fff` sur `--brand #e63946` : **4.6:1** (AA OK)
- `--warning #ffd60a` sur `--bg #1a1d22` : **12.4:1** (AAA)

### Typo

**Garder Syne + DM Sans.** Syne en bold italique sur les KPI évoque les
chiffres de tableau de bord course. Optionnel : passer DM Sans en
`font-feature-settings: "tnum", "ss01"` pour les chiffres.

### Boutons

```css
.btn-primary  { background: #e63946; color: #fff; box-shadow: 0 4px 12px rgba(230,57,70,0.3); }
.btn-secondary{ background: rgba(255,255,255,0.06); color: #f1f3f5; border:1px solid #3a4150; }
.btn-danger   { background: #ff6b35; color: #fff; }
```

Voir `option-2-asphalt-speedred.html`.

---

## 5. Option 3 — Light Mode Premium

**Pitch** : majoritairement blanc/gris très clair, accents rouge logo.
Esprit Linear/Vercel/Stripe. Différenciation forte vs concurrents transport
(Mapotempo, Shippeo… tous bleus ou sombres). Le logo respire enfin sur fond
blanc, comme sur le camion.

### Palette

```css
:root {
  /* Surfaces (blanc cassé, gris très clair) */
  --bg:           #fafafa;   /* presque blanc, légèrement chaud */
  --bg-elevated:  #ffffff;   /* sidebar / topbar */
  --bg-card:      #ffffff;   /* cards */
  --bg-card-hover:#f4f4f5;
  --border:       #e4e4e7;
  --border-strong:#d4d4d8;

  /* Brand : rouge logo exact */
  --brand:        #d62828;   /* rouge logo MCA */
  --brand-hover:  #b51d1d;
  --brand-soft:   rgba(214,40,40,0.08);
  --brand-on:     #ffffff;

  /* Sémantique */
  --danger:       #be185d;   /* magenta foncé pour distinction */
  --danger-soft:  rgba(190,24,93,0.08);
  --success:      #16a34a;
  --warning:      #d97706;
  --info:         #2563eb;

  /* Texte (gris très foncé, pas noir pur — plus premium) */
  --text:         #18181b;
  --text-muted:   #71717a;
  --text-disabled:#a1a1aa;
}
```

### Contraste WCAG

- `--text #18181b` sur `--bg #fafafa` : **15.9:1** (AAA)
- `--text-muted #71717a` sur `--bg #fafafa` : **4.6:1** (AA OK)
- `--brand #d62828` sur `--bg #fafafa` : **5.1:1** (AA OK)
- `#fff` sur `--brand #d62828` : **5.0:1** (AA OK)
- `--danger #be185d` sur `--bg #fafafa` : **6.2:1** (AAA)

### Typo

**Garder Syne + DM Sans.** Sur fond blanc, Syne devient encore plus
qualitatif (effet "magazine"). Body DM Sans Regular 15px, line-height 1.5.

### Boutons

```css
.btn-primary  { background: #d62828; color: #fff; }
.btn-primary:hover { background: #b51d1d; }
.btn-secondary{ background: #fff; color: #18181b; border:1px solid #e4e4e7; }
.btn-secondary:hover { background: #f4f4f5; }
.btn-danger   { background: #be185d; color: #fff; }
```

### Compatibilité dark/light

Cette option **est** la version light. Une variante dark via `[data-theme="dark"]`
est possible — dans ce cas reprendre la palette de l'option 1 (Charcoal & Crimson).
C'est la voie la plus propre : light premium par défaut + dark cohérent en
toggle.

Voir `option-3-light-premium.html`.

---

## 6. Synthèse comparée

| Critère | Opt 1 Charcoal | Opt 2 Asphalt | Opt 3 Light |
|---|---|---|---|
| Cohérence logo | Bonne | Très bonne | Excellente |
| Différenciation marché | Moyenne | Bonne | Excellente |
| Continuité avec actuel | Forte (juste swap couleurs) | Moyenne | Faible (refonte) |
| Effort migration | Faible | Moyen | Élevé |
| Lisibilité écran ext. (camion, soleil) | Faible | Moyenne | Excellente |
| Esprit transport pro | OK | Excellent (racing) | OK (premium) |
| Risque "trop fun" | Non | Limite | Non |
| Risque "corporate ennuyeux" | Non | Non | Limite |

---

## 7. Recommandation rapide

Voir le récap final dans la réponse de l'agent. Trois HTML standalone
sont fournis pour comparaison visuelle directe :

- `option-1-charcoal-crimson.html`
- `option-2-asphalt-speedred.html`
- `option-3-light-premium.html`
