# Veille outils tiers — MCA Logistics

> Date : 2026-05-05
> Auteur : agent `tools-watch-transport`
> Outils/services/APIs candidats pour enrichir MCA, **sans doublon** avec
> Pennylane (compta), Qonto (banque), Teleroute (bourse fret), Supabase (data).
>
> Stack actuel : PWA vanilla JS, Cloudflare Pages + R2, Supabase backend.
> Cible : ce que ces 4 outils ne couvrent pas (planification opérationnelle,
> télémétrie véhicule, conformité tachy, OCR factures, monitoring app, push
> notifs chauffeur, enrichissement contacts).

---

## Top-5 quick wins

| # | Outil | Pitch | Coût | Effort | Note |
|---|-------|-------|------|--------|------|
| 1 | **Sentry (Developer)** | Détection automatique des erreurs JS dans la PWA, avant que le chauffeur ne se plaigne. Gratuit jusqu'à 5k events/mois, SDK 1 ligne. | 0 € | 2 h | 5 |
| 2 | **API Sirene INSEE v3** | Auto-complétion SIRET/SIREN sur clients/fournisseurs/sous-traitants. Gratuit, 30 req/min, données officielles. | 0 € | 4 h | 5 |
| 3 | **Pappers API (palier 100 crédits)** | Complément Sirene avec dirigeants, comptes annuels, état procédure. 100 crédits/mois offerts. | 0 € puis ~19 €/mois | 3 h | 4 |
| 4 | **OneSignal (free)** | Push notifs chauffeurs (livraison assignée, message dispatch) sur PWA Android/iOS. Gratuit jusqu'à 10k abonnés mobile web. | 0 € | 4 h | 4 |
| 5 | **Better Stack uptime + status** | Surveille `mca.pages.dev` + Supabase + endpoints critiques. 10 monitors gratuits, status page publique offerte. | 0 € | 1 h | 4 |

**Coût mensuel total des 5 quick wins : 0 €** (palier gratuit suffit pour le volume MCA actuel — à réévaluer si > 5k erreurs/mois ou > 10k abonnés push).

**Recommandation #1 — Brancher Sentry en premier.**
Raison : la PWA tourne sur smartphones chauffeurs vétustes (Android variés,
caches stales, offline-queue). Sans Sentry tu apprends les bugs *via les
chauffeurs*, ce qui pourrit la confiance opérationnelle. Avec Sentry, tu vois
en 30 s qu'un script-livraisons.js plante chez tel chauffeur après tel
upload photo. Setup : 1 script tag + 1 DSN, zéro impact perf, RGPD OK avec
maskAllText. 2 h chrono, valeur immédiate.

---

## Catalogue par catégorie

### 1. Données enrichissement contacts/entreprises

| Outil | Coût | API | Pertinence MCA | Note | Notes |
|-------|------|-----|----------------|------|-------|
| **API Sirene INSEE** | Gratuit | REST, 30 req/min | Auto-complète SIRET clients/fournisseurs/transporteurs partenaires | 5 | Officiel, mises à jour quotidiennes, 25M entreprises. Token sur `portail-api.insee.fr`. |
| **Pappers API** | 100 crédits/mois gratuits, puis pack | REST | Complète Sirene avec dirigeants, comptes, BODACC (alerte procédure collective sur sous-traitant) | 4 | Idéal pour vetting sous-traitant Teleroute. |
| **API Entreprise (data.gouv)** | Gratuit | REST, accès restreint | Attestations URSSAF / vigilance / KBIS | 3 | Réservé aux usages habilités, demande d'accès longue. À VÉRIFIER éligibilité MCA. |
| **VIES (CE)** | Gratuit | SOAP/REST | Vérification TVA intracommunautaire pour clients UE | 4 | Utile si MCA fait export. Free APIs : vatcheckapi.com, viesapi.eu. |
| **Hunter.io** | 25 recherches/mois gratuites | REST | Trouver email contact prospect transporteur | 2 | Doublon partiel avec démarchage manuel, peu de gain. |

### 2. Calcul / planification routière

| Outil | Coût | Truck/PL | ZFE France | Note | Notes |
|-------|------|----------|------------|------|-------|
| **GraphHopper Directions** | Free 500 req/jour, payant ~99 €/mois | Oui (truck profile + dimensions) | Partiel via OSM | 4 | Bon compromis prix/qualité. Self-host possible. |
| **OpenRouteService** | Free 2k req/jour | Oui (heavy vehicle) | Partiel | 4 | Gratuit, open-source, légère latence. Idéal POC. |
| **Mapbox Directions** | 100k req/mois gratuites | Limité (no truck routing natif) | Non | 3 | UI top mais pas de profil PL natif. |
| **HERE Routing** | Free 30k tx/mois, +6 % en 2026 | Oui (logistique pro) | Oui | 4 | Référence transport, mais tarifs opaques. À VÉRIFIER pour PME FR. |
| **Google Distance Matrix** | Pay-per-use, ~$5/1k req | Limité | Non | 2 | Coût qui dérape vite, pas de truck routing. |
| **ViaMichelin Pro** | Sur devis | Oui (coûts péages PL) | Oui | 3 | Réputé en FR mais aucune transparence prix. À VÉRIFIER. |

**Reco** : commencer OpenRouteService (gratuit, truck profile), basculer
GraphHopper si volume > 2k req/jour ou besoin matrix PL fiable.

### 3. Suivi véhicule / télémétrie

| Outil | Hardware | Coût mensuel | API | Note | Notes |
|-------|----------|--------------|-----|------|-------|
| **Geotab GO** | Boîtier OBD-II (~130 € one-shot) | 20-40 €/véhicule via revendeur | Oui (MyGeotab API) | 5 | Référence pro, tachy intégré, RDL chronotachy. |
| **Webfleet (TomTom)** | Boîtier ou plug-and-play | ~25-35 €/véhicule | Oui (Webfleet.connect) | 4 | Concurrent direct Geotab, RDL tachy, bon support FR. |
| **Mobilis Connect / autres OBD2 low-cost** | ~50-100 € one-shot | 5-10 €/véhicule | Limitée | 2 | Pas de tachy, qualité variable, OK pour démarrer 1 utilitaire. |
| **AirTag / Tile** | 30-40 € | 0 € | Pas d'API publique | 1 | Géoloc passive uniquement, pas pour PL pro. |

**Note conformité 2026** : à partir du 01/07/2026, les VUL > 2,5 t en
transport intra-UE doivent avoir un tachy intelligent. Geotab/Webfleet
gèrent le RDL conformité, ce qui justifie l'investissement quand MCA
passera ce cap.

### 4. Photos / OCR / IA documentaire

| Outil | Coût | Spécialisé FR | Pertinence MCA | Note |
|-------|------|---------------|----------------|------|
| **Mindee Invoice OCR** | 14j trial, puis 49-649 €/mois | **Oui (factures FR)** | Capter factures fournisseurs, BL signés, CMR | 4 |
| **Claude Vision (Anthropic)** | $3/M input, $15/M output (Sonnet 4.6) | Oui (multilingue) | Extraction structurée BL/CMR avec prompt sur mesure | 5 |
| **AWS Textract** | $1.50/1k pages | Bon | Tables/forms factures | 3 |
| **Microsoft Form Recognizer** | $1.50/1k pages | Bon | Idem AWS, intégration Azure | 3 |
| **Tesseract.js** | 0 € (déjà chargé via `ocr-helper.js`) | Moyen | OCR brut sans structure | 2 |

**Reco** : Claude Vision via Anthropic API pour extraction CMR/BL/facture
fournisseur — un seul prompt structuré, JSON en sortie, 0,005 €/document
typique. Mindee si volume > 500 docs/mois (forfait devient rentable).

### 5. Notifications / messaging

| Outil | Free tier | Coût après | Pertinence MCA | Note |
|-------|-----------|-----------|----------------|------|
| **OneSignal** | 10k mobile web subs | $9/mois Growth | Push livraison/message dispatch | 4 |
| **Firebase Cloud Messaging** | Illimité | 0 € | Push, mais pas de dashboard UI | 4 |
| **Brevo email transactionnel** | 300 mails/jour | 9 $/mois 5k emails | Confirmation client, BL signé envoyé | 4 |
| **Brevo SMS** | Pay-as-you-go | ~0.045 €/SMS FR (à VÉRIFIER) | SMS dispatch chauffeur, alerte client retard | 3 |
| **Twilio SMS** | $0.0083/msg base | Variable, plus cher en FR | Idem Brevo, mais setup plus lourd | 3 |

**Reco** : OneSignal pour push (UI prête, segmentation par chauffeur).
FCM si tu veux 100 % gratuit et que tu codes le dashboard. Brevo pour
email transactionnel (déjà 9k mails/mois gratuits).

### 6. Conformité réglementaire transport

| Outil | Coût | Pertinence MCA | Note | Notes |
|-------|------|----------------|------|-------|
| **Registre national transporteurs (ecologie.gouv.fr)** | Gratuit | Vérifier licence sous-traitant | 4 | CSV téléchargeable, pas d'API officielle. À VÉRIFIER fréquence MAJ. |
| **API tachy (VDO Fleet, FleetGO, Geotab)** | Inclus dans télématique | RDL 28/90j obligatoire | 5 | Lié au choix télémétrie (cf §3). |
| **BAQTYS / Bilan carbone transport** | Sur devis | Reporting CO2 client gros donneur d'ordre | 2 | À VÉRIFIER si clients MCA exigent. |
| **API BOAMP** | Gratuit | Détecter marchés publics transport pertinents | 3 | data.gouv.fr, JSON. Bruyant : peu de marchés tx pur. |

### 7. CRM / commercial

| Outil | Free tier | Pertinence MCA | Note | Notes |
|-------|-----------|----------------|------|-------|
| **Brevo CRM** | Gratuit, 1 user illimité contacts | Pipeline simple clients/prospects | 4 | Couplé email transactionnel = bonus. |
| **HubSpot Free** | Gratuit, 1M contacts | Trop riche pour besoin actuel | 2 | Doublon partiel avec MCA `script-clients.js`. Ecarter. |
| **AchatPublic.com** | Abonnement | Veille marchés publics | 2 | Payant, ROI flou pour MCA. |

### 8. Monitoring / observabilité de l'app

| Outil | Free tier | Pertinence MCA | Note | Notes |
|-------|-----------|----------------|------|-------|
| **Sentry** | 5k erreurs + 10k perf events / mois | Détection bugs PWA chauffeur | 5 | Indispensable. Cf quick win #1. |
| **Better Stack** | 10 monitors + status page | Uptime mca.pages.dev + Supabase | 4 | Quick win #5. |
| **Umami (self-host Cloudflare/VPS)** | Gratuit (self-host) | Analytics RGPD-compliant | 4 | Stack Postgres, hébergeable sur même VPS. |
| **Plausible CE** | Gratuit (self-host) | Idem Umami, plus mature | 3 | ClickHouse requis = lourd. |
| **LogRocket** | 1k sessions/mois | Replay session chauffeur (debug UX) | 3 | Cher après free tier ($99+/mois). |
| **Highlight.io** | OSS, self-host | Alternative LogRocket | 3 | Effort déploiement non négligeable. |

### 9. Productivité / dev

| Outil | Free tier | Pertinence MCA | Note |
|-------|-----------|----------------|------|
| **Linear** | < 250 issues | Bug tracker MCA équipe restreinte | 3 |
| **GitHub Issues** | Gratuit | Déjà natif au repo | 4 |
| **Notion** | Perso gratuit | Notes, runbooks | 3 |

### 10. IA assistance opérationnelle

| Outil | Coût | Pertinence MCA | Note | Use case |
|-------|------|----------------|------|----------|
| **Claude API (Sonnet 4.6 / Haiku 4.5)** | $1-3 / M input | OCR CMR, résumés vocaux chauffeur, audit data | 5 | Triple usage (vision + texte + agent). |
| **OpenAI Whisper API** | $0.006/min ($0.36/h) | Transcrire messages vocaux WhatsApp chauffeur | 4 | Ex : "j'ai un retard pont à Lyon" → ticket auto. |
| **GPT-4o-mini-transcribe** | $0.003/min | Idem Whisper, moitié prix | 4 | Préférer si volume vocal > 1h/jour. |
| **DeepL API Free** | 500k caractères/mois gratuit | Traduction si client export DE/IT/ES | 2 | Faible besoin actuel. |

---

## Outils écartés (et pourquoi)

- **HubSpot Free** : trop CRM-orienté marketing, ajoute du frottement au flow
  livraisons MCA. Le `script-clients.js` natif suffit pour l'instant.
- **AirTag/Tile pour véhicules** : pas d'API exploitable, pas adapté
  PL/utilitaire pro. Mauvais signal métier vis-à-vis assurances.
- **AchatPublic.com (payant)** : ROI flou. BOAMP API gratuit fait 90 % du job.
- **LogRocket payant** : sessions replay nice-to-have mais $99/mois pour 5
  utilisateurs internes — Sentry + Umami couvrent 80 % du besoin.
- **Plausible Cloud** : payant ($9/mois) alors que Umami self-host fait pareil.
- **Mapbox pour routing PL** : pas de truck profile natif, GraphHopper et
  ORS sont meilleurs choix.
- **Google Distance Matrix** : coût qui dérape, pas de truck routing.
- **HubSpot, Salesforce, Pipedrive** : doublons CRM disproportionnés.
- **Pennylane reimport via FEC** : déjà identifié dans CLAUDE.md, reporté
  jusqu'à upgrade Premium côté Achraf.

---

## Plan d'intégration progressif (3 mois)

### Mois 1 — Fondations gratuites (0 €/mois)
1. **Sentry Developer** : SDK + DSN dans `index.html`, sourcemaps via build.
2. **API Sirene INSEE** : module `enrichment-sirene.js` appelé sur création client/fournisseur.
3. **Better Stack** : 10 monitors (mca.pages.dev, supabase API, R2 endpoint).
4. **Umami self-host** : container sur VPS existant ou Cloudflare Worker + D1.

### Mois 2 — Couche communication & enrichissement (~10-30 €/mois)
5. **OneSignal** : intégration PWA, segmentation par rôle (dispatcher/chauffeur).
6. **Pappers API** : alertes BODACC sur top 50 sous-traitants Teleroute.
7. **Brevo email transactionnel** : emails livraison signée client (300/j gratuits).
8. **Claude API** : prototype OCR CMR via `ocr-helper.js` (remplace Tesseract sur cas complexes).

### Mois 3 — Stack métier transport (~50-150 €/mois selon volume)
9. **Routing PL** : OpenRouteService POC sur planning, bascule GraphHopper si OK.
10. **Whisper / GPT-4o-mini-transcribe** : voicemail chauffeur → incident auto.
11. **Évaluation télémétrie** : POC 1 véhicule Geotab ou Webfleet (anticiper obligation tachy 07/2026).
12. **Brevo CRM** : pipeline prospects, lié à enrichissement Sirene/Pappers.

---

## Sources principales

- API Sirene INSEE : https://portail-api.insee.fr
- Pappers API : https://www.pappers.fr/api
- GraphHopper : https://www.graphhopper.com
- OpenRouteService : https://openrouteservice.org
- Mindee : https://www.mindee.com/pricing
- Anthropic Claude API : https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI pricing : https://openai.com/api/pricing/
- Sentry : https://sentry.io/pricing/
- Better Stack : https://betterstack.com/status-page
- OneSignal : https://onesignal.com
- Brevo : https://www.brevo.com/pricing/
- Umami : https://umami.is/
- BOAMP API : https://api.gouv.fr/les-api/api-annonces-marches-publics-boamp
- Geotab : https://www.geotab.com
- Webfleet : https://www.webfleet.com
- VIES (CE) : https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/
- Registre transporteurs : https://www.ecologie.gouv.fr/politiques-publiques/liste-entreprises-inscrites-registre-electronique-national-entreprises

---

## Notes "À VÉRIFIER"

- API Entreprise (data.gouv) : éligibilité MCA, accès habilité.
- Brevo SMS France : tarif exact 2026 (estimation 0.045 €/SMS).
- ViaMichelin Pro : tarification non publique, demander devis.
- HERE Maps : tarif PME France après hausse +6 % avril 2026.
- BAQTYS : pertinence selon exigences clients gros donneurs d'ordre.
- Registre transporteurs : fréquence MAJ du CSV public.
