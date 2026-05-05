# Roadmap & backlog

État au 5 mai 2026. Mis à jour à chaque sprint.

## Légende

- **P0** : critique, bloque l'usage quotidien
- **P1** : important, dette technique ou parité
- **P2** : nice-to-have, sera fait quand on aura le temps
- **🔒 Bloqué** : en attente d'un accès externe (abonnement, API, validation tiers)

---

## Sprint en cours (mai 2026)

| Priorité | Tâche | Statut |
|---|---|---|
| P0 | Sentry — capture erreurs JS prod | ✅ Actif (DSN configuré dans `monitoring.js`, release `v3.69-20260505`) |
| P0 | Mails admin mis à jour (`achraf-chikri@mcalogistics.fr` / `mohammed-chikri@mcalogistics.fr`) | ✅ Fait (auth + profiles + identities) |
| P0 | 2FA admin Supabase | ⏳ À activer via dashboard Supabase (cf. instructions ci-dessous) |
| P0 | Backup Supabase automatisé | ✅ `backup-simple.yml` créé (hebdo, dimanche 03h UTC, artifact GitHub 90j) — action user : ajouter secret `SUPABASE_DB_URL` |
| P1 | `CHANGELOG.md` + onglet "Historique versions" Paramètres | ✅ Fait |
| P1 | Tests unitaires calculs critiques | ✅ 26 tests dont 4 nouveaux pour bug TVA mixte v3.69 |
| P1 | Watchdog Playwright quotidien | ✅ Cron 06:00 UTC ajouté à `tests.yml` |
| P1 | Compression photos upload | ✅ Déjà implémenté dans `storage-uploader.js` (resize 1600px, JPEG q=0.82, WebP) |
| P1 | Bundle splitting `script.js` (cf. archive/2026-05-03-bundle-splitting.md) | À faire (4-6 h) |
| P2 | Logs audit : purge auto > 12 mois + archive JSON | À faire (1 h) |

### Actions manuelles côté Achraf

1. **Ajouter le secret `SUPABASE_DB_URL`** pour activer le backup hebdomadaire :
   - Dashboard Supabase → Project Settings → Database → Connection string → URI
   - GitHub → repo → Settings → Secrets and variables → Actions → New secret
   - Nom : `SUPABASE_DB_URL`, Valeur : la connection string complète
2. **Activer la 2FA** :
   - Aller sur https://supabase.com/dashboard/account/security
   - "Enable Two-Factor Authentication" → suivre l'assistant (TOTP via Google Authenticator / 1Password / etc.)
3. **(Optionnel)** Tester un backup manuel : Actions → "Weekly Supabase Backup (simple)" → Run workflow

## Prochains sprints

| Priorité | Tâche | Notes |
|---|---|---|
| P0 | Mode offline E2E (test coupure wifi → sync correcte) | 2 jours, critique pour chauffeurs |
| P1 | Parité PC ↔ mobile : taux TVA libre, nav semaine planning, params complets, rentabilité Chart.js | Cf. site-readiness audit |
| P1 | Export RGPD client one-click (JSON + PDF) | Après validation cadre légal |
| P1 | Mise à jour RGPD / CNIL / convention 3085 transport routier | Faire valider par comptable ou plateforme tierce (My Compliance, Dipeeo) |
| P2 | Vibration haptique boutons mobile critiques | Mineur, 5 min de code |

---

## 🔒 Bloqué — en attente d'accès externe

### Pennylane FEC (export comptable)
- **Bloqué par** : abonnement Pennylane Premium (export FEC grisé sans)
- **Impact attendu** : suppression double saisie facture client / paiement / charge entre Pennylane et MCA
- **Action côté Achraf** : vérifier dans Pennylane → Paramètres → Export → FEC. Si grisé, upgrade Premium.
- **Côté code** : parser FEC à coder côté MCA (~1-2 jours)

### Qonto API
- **Bloqué par** : vérifier que ton plan Qonto inclut l'accès API (Solo Smart / Business uniquement)
- **Impact attendu** : auto-cocher "payé" sur charges + livraisons quand le virement arrive sur Qonto
- **Action côté Achraf** : vérifier dans Qonto → Paramètres → Intégrations → API
- **Côté code** : webhook Qonto → endpoint Cloudflare → update Supabase (~2 jours)

### Teleroute
- **Bloqué par** : pas encore d'accès Teleroute côté Achraf
- **Impact attendu** : recherche d'offres de sous-traitance fret directement depuis MCA
- **À traiter "à fond"** dès que l'accès est obtenu (effort estimé : 1 semaine pour intégration solide)

### Sentry
- **Bloqué par** : créer un compte gratuit sur sentry.io et récupérer le DSN
- **Action côté Achraf** :
  1. Aller sur https://sentry.io/signup/ (gratuit jusqu'à 5000 erreurs/mois)
  2. Créer un projet de type "Browser JavaScript"
  3. Copier le DSN (URL longue type `https://xxx@oXXX.ingest.sentry.io/XXX`)
  4. Le coller dans `monitoring.js` à la place de `__SENTRY_DSN_PLACEHOLDER__`
- **Code** : déjà préparé, il manque juste le DSN

---

## Reporté / à étudier plus tard

### Branche staging
- **Pourquoi reporté** : Achraf est quasi seul utilisateur sérieux, on peut se permettre de "rouler en prod"
- **Quand le faire** : dès qu'il y aura 5+ chauffeurs actifs qui dépendent du site
- **Effort** : ~2 h (Cloudflare Pages preview + 2e projet Supabase staging)

### Migration vers framework JS (React / Vue / Svelte)
- **Décision** : **NON**. Garder vanilla JS.
- **Raison** : 3-6 mois de réécriture pour zéro gain utilisateur, et augmente la dépendance technique. Vanilla JS reste lisible et fonctionne bien.
- **Discipline à tenir à la place** : aucun fichier > 1500 lignes, un fichier = un domaine métier, conventions stables.

### Webhooks entrants (Pennylane / Qonto)
- **Bloqué par** : abonnements premium ci-dessus
- **À étudier ensemble** : choix infra (Cloudflare Workers vs Supabase Edge Functions)

---

## Idées en vrac (non priorisées)

- Mode "carnet de bord" chauffeur : check-in véhicule en début de journée (km, niveau carburant, état général) → alimente Inspections automatiquement
- Notifications push (PWA) pour alertes urgentes (incident chauffeur, paiement en retard critique)
- Module "tournée" : optimisation de tournée multi-livraisons (intégration Mapbox / OpenRouteService)
- Génération automatique de la lettre de voiture (CMR) à partir de la livraison
