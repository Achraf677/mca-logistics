# Changelog MCA Logistics

Toutes les évolutions notables sont consignées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).
Versionnage : `vMAJEUR.MINEUR` — minor à chaque sprint, major à chaque refonte structurelle.

---

## [3.69] — 2026-05-05

### Corrigé
- **TVA — onglet utilise le montant TVA saisi manuellement** (mobile + PC) : pour les charges à TVA mixte (ex. 150 € TTC dont 6 € de TVA réelle), l'onglet TVA recalculait toujours `HT × taux` au lieu d'utiliser le montant TVA stocké. Les déclarations TVA sont maintenant fidèles à la saisie.

### Documentation
- Restructuration complète : nouvelle arborescence `docs/` (overview, architecture, mobile, PC, DB, roadmap).
- Anciens rapports (audits, plans, intégrations) archivés dans `docs/archive/`.

---

## [3.68] — 2026-05-03

### Ajouté
- **TVA mixte** : champ "Montant TVA" éditable dans le formulaire de charge PC + mobile (gestion des factures avec une partie seulement soumise à TVA).
- **Auto-refresh PC quand la date change** : passage minuit → ré-affiche automatiquement le mois courant sur les écrans Charges / TVA / Rentabilité / Stats / Heures.

### Corrigé
- "Mois figé" sur PC quand la PWA reste ouverte plusieurs jours (cf. ci-dessus).

---

## [3.67] — 2026-05-03

### Ajouté
- **Modification mot de passe admin sur mobile** (parité PC) : section Sécurité dans Paramètres mobile.

---

## [3.66] — 2026-05-02

### Modifié
- **Cleanup UX** : retrait des emojis superflus identifiés dans l'audit `cleanup-utile-inutile`.

---

## [3.65] — 2026-05-02

### Corrigé
- **Bug TVA timezone (root cause)** : `new Date(year, month, 1).toISOString()` retourne UTC, ce qui décalait d'un jour en France (GMT+2). Les sélecteurs de mois étaient parfois sur le mois précédent.

### Ajouté
- Tests Playwright sur les parcours critiques (login admin / chauffeur, ajout livraison, ajout charge).

---

## [3.64] — 2026-05-01

### Modifié
- **Design "Asphalt & Speed Red"** appliqué (couleurs uniquement, typo inchangée) : palette sombre + accent rouge transport, validée vs 3 options proposées.

---

## [3.63] — 2026-04-30

### Corrigé
- **TVA mobile** : mois manquant + décalage (root cause timezone, fix complet en v3.65).
- **Heures planning** : 1 saisie manuelle ne masque plus le total planifié du mois (calcul par jour au lieu d'un global).

### Ajouté
- 3 options design (Charcoal / Asphalt / Light) + page de comparaison `/design.html`.

---

## [3.62] — 2026-04-29

### Ajouté
- **Pagination serveur** sur les grosses listes (livraisons, charges, audit).
- **Compression d'images** côté upload (pré-resize Canvas).
- **Mode offline chauffeur** : queue locale → sync automatique au retour réseau.
- **Plan de bundle splitting** documenté (cf. `docs/archive/2026-05-03-bundle-splitting.md`).

---

## [3.61] — 2026-04-28

### Sécurité
- **Migration P1** : 5 entités passées sur Supabase tables natives (au lieu d'`app_state`).
- **`inspections-photos`** : bucket privé + signed URLs.
- **Backup quotidien** Supabase activé (cron).

---

## [3.60] — 2026-04-27

### Sécurité
- **Faille critique corrigée** : la table `app_state` (qui contenait avant migration les données RH/finance) était lisible par tout utilisateur authentifié. Restreinte aux admins via RLS + RPC `is_admin()`.

---

## [3.59] et antérieures

Voir l'historique git pour le détail. Faits marquants :
- v3.58 : factory périodes harmonisée + carburant tri-directionnel
- v3.57 : fix critique compteur d'heures + 3 mois figés
- v3.56 : uploads documents véhicules (5 types, bucket Supabase Storage)
- v3.54 : config TVA mobile + franchise en base + dialog choix
- v3.53 : actions bulk Carburant / Entretiens / Inspections / Incidents
- v3.52 : actions bulk Charges (avec cascade plein/entretien lié)
- v3.51 : fixes TVA critiques + heures sync mobile/PC
- v3.50 : encaissement manuel + correction bugs calculs critiques
- v3.49 : cascade suppression cross-entity + recherche globale + audit log
- v3.46 : synchros bidirectionnelles plein/entretien ↔ charge
- v3.44 : actions bulk Livraisons mobile + lettre de voiture mobile
- v3.42 : bons / factures mobile + vérification documents salariés auto
- v3.41 : planning vue semaine + périodes d'absence longues
- v3.38 : OCR auto-remplir (Tesseract.js, gratuit, offline)
