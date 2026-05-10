# MCA Logistics — Design System

> **Source de vérité visuelle** pour MCA Logistics, entreprise française de
> transport routier de fret de proximité (PGI interne pour la flotte, les
> chauffeurs et l'admin).

---

## Sommaire — Index du dossier

| Fichier / dossier | Rôle |
|---|---|
| `README.md` | Ce fichier — fondamentaux marque, contenu, visuel, iconographie |
| `colors_and_type.css` | Tokens CSS (couleurs, type, espacement, ombres, motion) |
| `SKILL.md` | Front-matter pour Agent Skills (Claude Code) |
| `assets/` | Logos, wordmark |
| `preview/` | Cards du Design System (typographie, palette, composants) |
| `ui_kits/admin/` | Recréation pixel-perfect de l'admin desktop (`admin.html`) |
| `infra/design/` | Source — 3 options de design originales du repo + design-options.md |

## Sources

- **Code base GitHub** : `Achraf677/mca-logistics` (privé, branche `main`)
- **Fichiers principaux étudiés** :
  - `README.md`, `CLAUDE.md`, `docs/01-overview.md`
  - `login.html` (palette v3.64 "Asphalt & Speed Red" en prod)
  - `manifest.json` (PWA branding)
  - `infra/design/option-{1,2,3}-*.html` + `2026-05-03-design-options.md`
- **Périmètre produit** : 3 surfaces — `admin.html` (PC), `m.html` (mobile admin), `salarie.html` / `m.html` (chauffeur)

---

## Le produit

MCA Logistics est un **PGI (progiciel de gestion intégré) interne** pour
l'entreprise MCA Logistics — transport routier de fret de proximité (région
Hauts-de-France : Lille, Roubaix, Tourcoing, Lens, Arras…). PWA vanilla JS,
hébergée Cloudflare Pages, backend Supabase.

Couvre la **couche opérationnelle transport** que la compta (Pennylane) et
la banque (Qonto) ne savent pas faire : rattacher un coût à une tournée, à
un chauffeur, à un véhicule ; planifier ; tracer la conformité ADR / CE 561 ;
calculer la rentabilité fine.

### Utilisateurs

- **Admins** (Achraf, Mohammed) — tout voir, tout modifier, sync Realtime entre eux.
- **Salariés** (chauffeurs) — leur planning, leurs livraisons, leurs heures, leur véhicule. Saisie de pleins, photos de tickets, chat admin.

---

## CONTENT FUNDAMENTALS

### Langue & ton
- **Français exclusivement.** Pas de mix EN/FR. Vocabulaire métier transport :
  *livraison, tournée, chauffeur, salarié, véhicule, planning, carburant,
  carte grise, lettre de voiture (LDV), inspection, charge, fournisseur*.
- **Tutoiement par défaut entre admins** ("ton choix ?", "tu peux aussi me dire").
- **Vouvoiement vers le salarié / utilisateur final** ("Vérifiez votre saisie",
  "Veuillez remplir les deux champs avant de vous connecter", "Contactez votre
  administrateur").
- **Labels formels** dans les forms : "Identifiant", "Mot de passe",
  "Nouvelle livraison", "Confirmer livraison", "Reporter", "Signaler retard".

### Casing
- **Sentence case** sur les titres et boutons : "Vue d'ensemble",
  "Dernières livraisons", "+ Nouvelle livraison", "Premier démarrage".
- **UPPERCASE + tracking ample** UNIQUEMENT sur micro-labels :
  - overline tags ("LIVRAISONS", "CA HT", "MARGE NETTE")
  - badges statut ("LIVRÉE", "EN COURS", "RETARD") — seulement option 2 (Asphalt).

### Tone
- **Direct, opérationnel, concis.** Pas de marketing. Pas de "Bienvenue !".
  L'app sait que ses utilisateurs y vivent 8h par jour.
- **Messages d'erreur neutres et anti-énumération** : "Identifiants non
  reconnus. Vérifiez votre saisie." plutôt que "Cet utilisateur n'existe pas".
- **Statuts factuels** : "Livrée", "En cours", "Retard", "Payée", "Impayée"
  (jamais "Yay !" / "Oups !").
- **Speech act admin → salarié** : impératif court ("Confirmer livraison",
  "Reporter", "Signaler retard").

### Emoji
- **Pas d'emoji dans les UI de prod** des dashboards (admin, salarie).
  Les emojis vus en chat (✨, ☑) sont des décorations FAB internes au
  chatbot IA, pas la voix de la marque.
- **Emoji acceptables uniquement dans les messages de setup / alerte one-shot**
  (ex: `🔐 Premier démarrage`, `✅ Compte créé`) — clairement contextuels,
  jamais récurrents.

### Exemples
- ✅ "Performance opérationnelle du mois en cours"
- ✅ "Aucun mot de passe défini pour ce compte. Contactez votre administrateur."
- ✅ "Trop de tentatives. Réessayez dans quelques minutes."
- ❌ "Hey ! 👋 Prêt à booster ta logistique ?" (interdit)

---

## VISUAL FOUNDATIONS

### Palette directrice — Asphalt & Speed Red (en prod, v3.64)

3 palettes coexistent en repo (voir `infra/design/2026-05-03-design-options.md`).
**La palette en production sur `login.html` est l'option 2 — Asphalt & Speed Red.**
C'est elle que ce design system canonise.

- **Surfaces** : asphalte sombre `#1a1d22` → cards `#2a2f37`
- **Brand** : rouge logo MCA `#e63946` (vif, "speed red")
- **Sémantique** : success `#06d6a0` · warning `#ffd60a` · danger `#ff6b35` · info `#4cc9f0`
- **Texte** : `#f1f3f5` (haut contraste 14:1 AAA)

> Variantes dispos : Charcoal & Crimson (`#0e0e10` + `#c8202a`) plus sobre,
> Light Premium (`#fafafa` + `#d62828`) en mode jour. Voir `colors_and_type.css`.

### Typographie

- **Display** : **Syne** 600/700/800, italique fréquent sur les KPI numbers.
  Géométrique moderne, légèrement excentrique → fonctionne avec le logo italique.
- **Body** : **DM Sans** 400/500/600/700 — neutre, hyper lisible 14px.
- **Mono / chiffres tabulaires** : **JetBrains Mono** + `font-feature-settings: "tnum"`.
- **Signature** : KPI values en `Syne italic 32px` (ex: `38 420 €`), label
  overline en uppercase `0.1em letter-spacing`.

### Backgrounds

- **App (admin / mobile / salarié)** : asphalte plein `#1a1d22`,
  optionnellement texturé d'un motif diagonal très subtil
  (`repeating-linear-gradient(135deg, transparent 0 60px, rgba(255,255,255,0.012) 60px 61px)`).
- **Login / splash** : ambient layered — radial rouge top-left, radial cyan
  bottom-right, gradient diagonal `#0e0f12 → #1a1d22 → #0e0f12`. Trois
  *orbes* floutées (`filter: blur(80px)`) flottent en boucle 16s
  (transformation `translate + scale`).
- **Pas d'image full-bleed** dans l'app interne. Pas de hand-drawn ou pattern
  texturé — l'app reste un cockpit de données.

### Animation

- **Easing principal** : `cubic-bezier(0.22, 1, 0.36, 1)` (Quint out, doux et
  premium). Variable `--ease-out`.
- **Durations** : `0.15s` (hovers / states) · `0.18s` (boutons) · `0.7s`
  (transitions de page, fade-in shell).
- **Patterns** :
  - **Fade up** : `opacity 0→1, translateY 14px→0`. Cascade par child
    (`.field:nth-of-type(1) { animation-delay: 0.40s }`).
  - **Pulse glow** sur le halo derrière le logo (4s ease-in-out infinite,
    scale 1→1.10).
  - **Shake** sur erreurs : 4 oscillations 0.35s.
  - **Reflet brillant** qui traverse les boutons primaires au hover.
  - **KPI** : `transform: translateY(-2px)` au hover.
- **Pas de bounces clownesques.** Pas de spring exagéré.

### Hover states

- **Boutons primary** : background plus clair (`#ff4d5c`) + `translateY(-1px)`
  + shadow renforcée + reflet glissant gauche → droite.
- **Boutons secondary** : background `bg-card-hover` (`#323843`).
- **Nav items** : background card-hover, `color: text` (depuis muted).
- **Cards / KPI** : border `border-strong`, `translateY(-2px)`.
- **Rows tableau** : background card-hover.

### Press / active

- Boutons : `transform: translateY(0)` (annule le lift), opacité éventuelle.
- Mobile (`tap-highlight: transparent`) : `:active { opacity: 0.8 }`.

### Bordures

- 1px, couleur `--border #3a4150`. Borders soft (`rgba(173,181,189,0.16)`)
  sur les surfaces glass/login.
- Border-strong `#4a5263` au hover des cards.
- Accent supérieur 3px sur les KPI cards : gradient `--brand 0% → #ff4d5c 50% → transparent 100%`.
- Underline 2px sur la marque (sidebar bottom) : gradient `--brand → transparent`.

### Shadows / élévation

| Niveau | Token | Usage |
|---|---|---|
| sm | `0 1px 2px rgba(0,0,0,0.18)` | inputs, badges légers |
| md | `0 6px 18px rgba(0,0,0,0.32)` | cards survolées |
| lg | `0 18px 40px rgba(0,0,0,0.42)` | modals |
| xl | `0 28px 80px rgba(0,0,0,0.55)` | login shell |
| brand | `0 18px 38px rgba(230,57,70,0.32)` | bouton primaire au repos |

Pas d'inner-shadow systématique. Quelques `inset 0 1px 0 rgba(255,255,255,0.35)`
sur le bouton primaire pour le top-highlight glassy.

### Capsules vs gradients de protection

- **Badges** : capsule rounded `4px` avec border + bg coloré semi-transparent.
  Pattern : `background: rgba(R,G,B, 0.16); border: 1px solid rgba(R,G,B, 0.30); color: full opacity`.
- **Pas de gradient de protection sous texte sur image** — l'app n'utilise
  pratiquement pas d'imagerie.
- **Halo** uniquement sur le login (radial blur derrière le logo, pulse 4s).

### Layout rules

- Sidebar fixe 236px desktop. Topbar fixe 60px. Content scroll en `overflow:auto`.
- Breakpoint mobile unique : **880px** — sidebar masquée, KPI 4col → 2col,
  search rétrécie 140px.
- Bouton min-height 40px desktop / **48px mobile** (touch target).
- Container content padding : 26px desktop.
- KPI grid : `repeat(4, 1fr) gap 14px`. Mobile : `repeat(2, 1fr)`.
- Cards : `border-radius: 12px`, padding 14–20px.

### Transparence / blur

- **Backdrop-filter** uniquement sur le login shell : `blur(24px) saturate(140%)`.
- Background app : opaque, pas de glass.
- Orbes : `filter: blur(80px)` derrière le shell.
- Border colorée gradient via mask `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)` + `mask-composite: exclude` sur le login shell.

### Imagerie

- **Quasi inexistante.** L'app est un cockpit data-driven.
- Photos de tickets carburant / cartes grises uploadées par les chauffeurs :
  affichées brutes en thumb, click → modal Storage signed-URL.
- **Pas de vibe color spécifique** ; les images sont fonctionnelles.

### Corner radii — système

- `--r-sm 4px` : badges, micro-pills statut
- `--r-md 8px` : boutons, inputs, nav items
- `--r-lg 12px` : KPI cards, table card, modals
- `--r-xl 16px` : login submit, role-btn
- `--r-2xl 18px` : large cards / top-level
- `--r-3xl 32px` : login shell, splash containers
- `--r-pill 999px` : avatars

### Cards — ce que regarder

- Background plein `--bg-card`, **pas de gradient**.
- Border `1px var(--border)`.
- Radius `12px`.
- Padding 18–20px.
- Variant KPI : barre supérieure 3px en gradient brand.
- Variant table : header séparé (`padding 14px 20px, border-bottom`).
- Hover : `border-strong`, micro-translateY, shadow-md.

---

## ICONOGRAPHY

### Approche
- **Lucide Icons** — stroke 2.2px, lineCap round, lineJoin round (pattern observé inline en `data:image/svg+xml` dans `login.html` pour les icônes erreur / succès).
- Couleur stroke = couleur du contexte (text-muted en navigation, brand en actif).
- Toujours **outline**, jamais filled.
- Taille standard 18×18 (nav), 20×20 (statuts), 24×24 (CTA).

### Set
- ⚠️ Le repo n'embarque PAS de dossier `assets/` ni d'icon font local —
  les rares icônes sont inlinées en SVG (data-URL) dans `login.html`.
- **Pour les UI kits**, on utilise **Lucide via CDN** :
  `https://unpkg.com/lucide-static@latest/icons/<name>.svg`.
- Set canonique : `truck`, `package`, `route`, `users`, `wallet`, `bar-chart-3`,
  `calendar`, `clock`, `fuel`, `wrench`, `alert-triangle`, `check-circle-2`,
  `eye`, `eye-off`, `search`, `chevron-right`, `download`, `plus`.

### Emoji & unicode
- **Pas d'emoji décoratif en prod.** Quelques emoji ponctuels dans des
  setup screens (`🔐`, `✅`) — toléré one-shot, pas comme système.
- **Pas d'unicode-art** (◆ ▸ etc) en remplacement d'icônes.

### Logo

Le logo MCA est un Sprinter (camionnette) noir avec 4 traits de vitesse rouges à gauche,
fond blanc dans la version brand officielle. Versions disponibles :
- `assets/logo-mca.svg` — logo Sprinter compact (88×60 viewBox)
- `assets/wordmark-mca.svg` — wordmark "MCA / LOGISTICS" (Syne, 480×140)

> ⚠️ **Substitution flaggée** : aucun fichier de logo officiel (PNG/SVG haute
> définition, charte) n'est commité dans le repo. Les logos ci-dessus sont
> des reconstructions à partir des SVG inline trouvées dans
> `infra/design/option-2-asphalt-speedred.html` (sidebar brand). **Si tu as
> un logo source officiel, dépose-le dans `assets/` pour remplacer.**

### Fonts — substitution
- ⚠️ **Aucun fichier `.woff2` / `.ttf` n'est commité côté repo** ; les polices
  sont chargées via Google Fonts CDN. Le design system fait la même chose
  (`@import` dans `colors_and_type.css`). Pas de substitution nécessaire.
- Les UI de prod (`login.html`) utilisent en réalité `Segoe UI, system-ui`
  comme fallback en attendant Syne — incohérence interne. **Le design system
  canonise Syne + DM Sans** (la cible définie dans
  `2026-05-03-design-options.md`).

---

## CAVEATS & questions ouvertes

1. **Logo source** : reconstitué depuis les SVG du repo. Demander la version officielle.
2. **Fonts** : Syne + DM Sans définies en cible mais `login.html` utilise encore `Segoe UI`.
   À confirmer si on aligne le login (recommandé) ou si on conserve la fallback.
3. **3 palettes coexistent** : on canonise Asphalt & Speed Red (option 2 = prod).
   Les 2 autres (Charcoal, Light Premium) restent en `infra/design/` comme alts.
4. **Pas de design system formel** côté repo — ce dossier est la première
   formalisation. À étendre au fur et à mesure que de nouveaux composants
   apparaissent en prod.
