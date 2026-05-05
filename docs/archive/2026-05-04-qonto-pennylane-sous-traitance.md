# Intégrations Qonto + Pennylane + Sous-traitance — Étude de faisabilité

**Date** : 2026-05-04
**Auteur** : agent `qonto-pennylane-integrations-explorer`
**Branche** : `claude/add-supabase-mcp-CuBe2`
**Contexte** : MCA Logistics (PGI transport), compta sur Pennylane, banque Qonto.
**Périmètre** : intégrations à valeur ajoutée pour le métier transport — pas
de comptabilité (déjà couverte par Pennylane).

---

## TL;DR

L'écosystème Qonto API + Pennylane API est mûr et bien adapté à un PWA
Supabase. Trois quick-wins prioritaires :

1. **Webhook Qonto "transaction received" → réconciliation auto livraison ↔ paiement client** (par référence virement / IBAN).
2. **Webhook Pennylane "customer_invoice.paid" → MAJ statut livraison MCA**.
3. **Bouton "Émettre la facture Pennylane" depuis une livraison MCA validée** (POST /customer_invoices) pour éliminer la double saisie.

Côté sous-traitance, **B2PWeb** est la cible principale (numéro 1 France,
~35 000 transporteurs, API d'intégration TMS existante mais pas publique —
contact commercial requis). En backup : **Teleroute** (API REST documentée,
api-docs.teleroute.com) et **TIMOCOM** (API SOAP/REST, developer.timocom.com).

Bloquant majeur : Pennylane FEC nécessite Premium (déjà noté). L'API
Pennylane standard reste accessible (REST + OAuth2).

---

## 🏆 Top-5 quick wins (valeur haute, effort bas)

| # | Intégration | Valeur | Effort | Coût |
|---|---|---|---|---|
| 1 | Webhook Qonto `transaction.created` → matcher virement entrant ↔ livraison MCA via référence/IBAN client | ★★★★★ | 1-2 j | Gratuit (Qonto Business inclus) |
| 2 | Webhook Pennylane `customer_invoice.paid` → set `livraison.statut_paiement = paye` | ★★★★★ | 1 j | Gratuit (API Pennylane incluse Pro) |
| 3 | Bouton "Émettre facture Pennylane" depuis fiche livraison (POST `/customer_invoices`) | ★★★★★ | 2-3 j | Gratuit |
| 4 | Widget dashboard "Solde Qonto + impayés > 30j" (read-only, GET balance + GET unpaid invoices) | ★★★★ | 1 j | Gratuit |
| 5 | Liste impayés clients dans MCA (GET Pennylane `/customer_invoices?status=unpaid&overdue=true`) avec lien "relancer" | ★★★★ | 1 j | Gratuit |

> **Total quick wins** : ~6-8 jours-homme pour une couverture qui fait passer
> la double saisie de ~30 min/jour à ~0.

---

## 🔵 Qonto — intégrations détaillées

### Pré-requis techniques

- **Auth** : API key (en-tête `Authorization: <login>:<secret>`) ou OAuth2
  (scopes : `organization.read`, `payment.write`, `attachment.write`,
  `supplier_invoice.read/write`, `webhook`).
- **Base URL** : `https://thirdparty.qonto.com/v2` (sandbox :
  `thirdparty-sandbox.staging.qonto.co/v2`).
- **Webhooks** : `POST /data_api/webhooks` avec callback_url + secret HMAC-SHA256.
  Retry exponentiel sur 2 jours puis discard.
- **Rate limits** : non documentés précisément (À VÉRIFIER, demander au
  support Qonto avant prod).

### Q1 — Réconciliation virement entrant ↔ livraison ★★★★★

**Description** : à chaque virement reçu sur Qonto, on cherche dans les
livraisons MCA non-payées une qui matche par (a) IBAN/SIRET émetteur, (b)
référence virement contenant un n° facture, ou (c) montant exact + client.

**Flux** :
```
Qonto [transaction.created webhook]
  → Supabase Edge Function /qonto-webhook
  → vérifie HMAC
  → match livraisons WHERE statut_paiement='attente' AND montant=tx.amount
  → si 1 match certain : UPDATE livraison SET paye=true, paye_le=tx.date
  → sinon : insert dans table 'paiements_a_rapprocher' (UI manuelle)
```

**Faisabilité** : Easy. Edge Function Supabase déjà ailleurs dans le projet.
**Effort** : 1-2 j (incluant UI de rapprochement manuel pour les ambigus).
**Quick win** : OUI.

### Q2 — Solde compte affiché dashboard MCA + alerte seuil ★★★★

**Description** : GET `/v2/organizations/{slug}` → `bank_accounts[].balance_cents`.
Affichage en haut du dashboard admin avec alerte rouge si < 5 000 €.

**Faisabilité** : Easy. Cron Supabase 1×/h.
**Effort** : 0.5 j. **Coût** : gratuit.

### Q3 — Détection auto frais récurrents → catégorisation charges MCA ★★★

**Description** : pull `/v2/transactions` filtré `side=debit`, fingerprint
sur `counterparty_name + amount`, propose dans MCA "Tu veux que cette
charge récurrente soit auto-catégorisée vers véhicule X / chauffeur Y ?".

**Use case typique** :
- Total Énergies / BP carburant → table `carburant`, lié au véhicule (croisé avec immatriculation sur ticket)
- AXA / Generali → table `assurances` du véhicule
- Péages (Vinci, APRR, Sanef) → table `peages` lié à la tournée
- Loyer dépôt → table `charges` récurrente

**Faisabilité** : Medium (logique fingerprint + UI de validation user).
**Effort** : 4-5 j. **Quick win** : non, mais ROI élevé sur la durée.

### Q4 — Notification Slack/SMS paiement client reçu ★★★

**Description** : trigger Q1 → si match certain, envoyer notif Slack au
patron + SMS au commercial.

**Faisabilité** : Easy (greffe sur Q1, juste un POST Slack webhook + Twilio).
**Effort** : 0.5 j (en plus de Q1).

### Q5 — Pousser virement chauffeur depuis MCA (paye salaire / acompte) ★★★

**Description** : depuis fiche salarié MCA, bouton "Verser X € à <chauffeur>".
Backend appelle `POST /v2/external_transfers` (scope `payment.write` requis).

**Attention** : OAuth2 obligatoire pour `payment.write` (pas API key).
Confirmation forte côté UI (double validation, montant max). **Risque
fraude** non négligeable → exiger 2FA admin avant déclenchement.

**Faisabilité** : Hard (OAuth dance + sécurité).
**Effort** : 5-7 j incluant audit sécu.
**Recommandation** : faire seulement si l'user le demande explicitement.

### Q6 — Upload pièces jointes Qonto depuis MCA ★★

**Description** : à l'OCR d'un ticket carburant ou facture fournisseur,
attacher automatiquement le PDF à la transaction Qonto correspondante
(POST `/v2/attachments` + `PUT /v2/transactions/{id}/attachments`).

**Faisabilité** : Medium. **Effort** : 2 j.
**Valeur** : utile pour audits comptables, mais Pennylane fait déjà ça via
sa propre intégration native Qonto → **probablement redondant**.

---

## 🟢 Pennylane — intégrations détaillées

### Pré-requis techniques

- **Auth** : OAuth2 (bearer token, scopes ex. `customer_invoices:all`,
  `customer_invoices:readonly`, `suppliers:all`). API key staff possible.
- **Base URL** : `https://app.pennylane.com/api/external/v2/`
- **Migration 2026** : breaking changes en preview depuis 14 jan 2026,
  défaut le 8 avril 2026 — utiliser le flag `use_2026_api_changes=true` dès
  maintenant pour ne pas avoir à refaire le boulot.
- **Webhooks** : disponibles (events `customer_invoice.created`,
  `customer_invoice.paid`, `quote.created`, `subscription.created` —
  liste complète À VÉRIFIER dans la doc officielle).
- **Subscription tier** : API standard accessible aux plans Pro/Premium
  (pas le plan gratuit) — l'user a Pennylane standard donc OK pour API
  REST. Seul l'**export FEC** est Premium-only (bloquant connu).

### P1 — Webhook `customer_invoice.paid` → MAJ livraison MCA ★★★★★

**Description** : Pennylane notifie quand une facture est marquée payée
(soit manuellement, soit via leur réconciliation Qonto). MCA reçoit le
webhook, extrait le `external_reference` (qu'on aura mis = livraison_id) et
update `livraisons.statut_paiement`.

**Flux** :
```
Pennylane [customer_invoice.paid]
  → Edge Function /pennylane-webhook
  → SELECT livraison WHERE id = invoice.external_reference
  → UPDATE statut_paiement='paye', paye_le=invoice.paid_at
```

**Faisabilité** : Easy si webhooks dispo en standard. **Effort** : 1 j.
**Quick win** : OUI. **Prérequis** : avoir mis `external_reference =
livraison_id` à la création (cf. P3).

### P2 — Tirer statut facture dans la fiche livraison MCA ★★★★

**Description** : sur la fiche livraison, badge "Facture Pennylane :
<draft|sent|paid|overdue>" + lien direct vers le PDF Pennylane.

**Flux** : GET `/customer_invoices/{id}` au chargement de la fiche, ou
better : copie du statut en table MCA, mis à jour via webhook P1.

**Faisabilité** : Easy. **Effort** : 1 j.

### P3 — Bouton "Émettre facture Pennylane depuis livraison MCA" ★★★★★

**Description** : à la validation d'une livraison, un bouton "Facturer"
ouvre un modal pré-rempli (client, lignes, montant HT, TVA, n° de tournée
en référence). POST vers `/customer_invoices` avec `external_reference =
livraison_id`. Le PDF revient → on stocke l'URL dans MCA.

**Faisabilité** : Medium (mapping client MCA ↔ client Pennylane à gérer).
**Effort** : 2-3 j.
**Quick win** : OUI, supprime la double saisie.

### P4 — Liste impayés > 30 j visible dans MCA ★★★★

**Description** : page "Encours clients" qui appelle GET
`/customer_invoices?filter[status]=unpaid&filter[overdue]=true`, affiche un
tableau avec bouton "Relancer" (POST `/customer_invoices/{id}/send_reminder`
si l'endpoint existe — À VÉRIFIER).

**Faisabilité** : Easy (read-only) → Medium (avec relance auto).
**Effort** : 1-2 j.

### P5 — Synchro fournisseurs Pennylane ↔ MCA ★★★

**Description** : l'user crée un fournisseur dans MCA → push vers
Pennylane (POST `/suppliers`). Eviter doublons par SIREN.

**Faisabilité** : Medium (gestion des conflits).
**Effort** : 2 j.
**Valeur** : modérée. À faire seulement si l'user crée souvent des
fournisseurs côté MCA en premier.

### P6 — Pré-remplir charge véhicule depuis OCR carte grise + lien Pennylane ★★

**Description** : ocr-helper.js déjà présent dans MCA. À l'OCR d'une carte
grise → propose immédiatement de créer une charge récurrente Pennylane
(assurance, taxe à l'essieu) avec la bonne catégorie comptable.

**Faisabilité** : Hard (mapping plan comptable). **Effort** : 3-4 j.
**Valeur** : niche, faire en V2.

### P7 — Sync devis (quote) Pennylane ↔ devis MCA ★★

**Description** : l'user fait un devis dans Pennylane → MCA le voit en
"opportunité commerciale" pour planifier. Pull GET `/quotes`.

**Faisabilité** : Easy. **Effort** : 1 j. **Valeur** : faible si l'user
fait peu de devis hors transports récurrents.

---

## 🚛 Plateformes sous-traitance transport

### Cibles principales (France)

| Plateforme | API publique ? | Pertinence MCA | Notes |
|---|---|---|---|
| **B2PWeb** | API d'intégration TMS existante mais pas auto-service public — contact commercial requis | ★★★★★ | Leader France, ~35 000 transporteurs. GedTrans (docs) + GedMouv (track) inclus. Probablement la cible n°1 pour MCA. |
| **Teleroute** | API REST publique documentée — `api-docs.teleroute.com` | ★★★★ | International (FR + Europe). Versionning par header `Accept-Version`. |
| **TIMOCOM** | 6 APIs (SOAP v2 + REST), `developer.timocom.com` | ★★★★ | Leader DACH, présence FR. Modules Offer + Search distincts. |
| **Affretium** | Pas trouvé d'API publique (À VÉRIFIER avec eux) | ★★★ | Acteur récent, possiblement plus ouvert API. |
| **Chronotruck (CEVA)** | API documentée via partenaires (Cargoson, etc.). `developers.chronotruck.com` | ★★★ | Plutôt orienté chargeurs, mais utile pour proposer du fret en marketplace. |
| **Convargo / FretLink / Everoad** | Pas d'API publique self-service trouvée | ★★ | Mise en relation directe via leur app, pas exposée. |
| **Cargoson** | Unified API qui agrège 2000+ transporteurs incl. Chronotruck | ★★★ | Un seul connecteur pour beaucoup de carriers — mais payant et orienté chargeurs. |

### Reco

1. **Phase 1 (MVP sous-traitance)** : contacter B2PWeb (`contact@b2pweb.com`)
   pour obtenir accès à leur API d'intégration TMS. Délai annoncé 48-72h
   pour création des accès.
2. **Phase 2** : ajouter Teleroute (API REST publique, plus facile à tester
   en autonomie sans commercial).
3. **Phase 3** : TIMOCOM si besoin DACH/Europe Est.

### Use cases concrets dans MCA

- **Sous-traitance sortante** : si une livraison MCA ne peut pas être
  honorée (chauffeur indispo, hors zone) → bouton "Publier sur B2PWeb"
  qui pousse l'offre avec les contraintes (poids, dimensions, prix max).
- **Recherche fret retour** : un véhicule MCA qui rentre à vide depuis
  Lyon → recherche auto sur Teleroute des frets Lyon → siège.
- **Annuaire transporteurs** : pull du carnet d'adresses B2PWeb →
  alimentation table `fournisseurs` MCA (sous-traitants).

---

## ❌ Ce qu'on NE PEUT PAS faire (bloquants)

| Bloquant | Raison | Workaround |
|---|---|---|
| Import FEC Pennylane → MCA | Premium requis (déjà noté CLAUDE.md) | Attendre upgrade Premium, ou faire CSV manuel |
| API Pennylane sans abonnement | Plan gratuit n'inclut pas l'API standard | L'user a Pro donc OK |
| Push transfert Qonto sans OAuth | Scope `payment.write` = OAuth2 obligatoire (pas API key) | Implémenter le flow OAuth complet (effort additionnel ~1 j) |
| B2PWeb API self-service | Pas de portail développeur public, contact commercial obligatoire | Email contact@b2pweb.com |
| Convargo/FretLink/Everoad API | Pas d'API publique connue | Skip, ou contact direct |
| Webhook Pennylane "invoice.overdue" | Pas confirmé dans la doc publique | Polling cron 1×/jour + diff côté MCA |
| Migration Pennylane API 2026 | Breaking changes par défaut le 2026-04-08 | DÉJÀ PASSÉ — coder direct avec `use_2026_api_changes=true` |

---

## 📋 Plan progressif (3 sprints)

### Sprint 1 — Fondations + quick wins (1 semaine)
- [ ] Setup OAuth2 Qonto + Pennylane (creds dans Supabase secrets)
- [ ] Edge Function `qonto-webhook` avec vérif HMAC
- [ ] Edge Function `pennylane-webhook` avec vérif signature
- [ ] **Q1** : Réconciliation virement ↔ livraison (auto + UI manuel)
- [ ] **P1** : Webhook `customer_invoice.paid` → MAJ livraison
- [ ] **Q2** : Widget solde Qonto sur dashboard

**Livrable** : double saisie facture/paiement éliminée à 80 %.

### Sprint 2 — Émission + visibilité (2 semaines)
- [ ] **P3** : Bouton "Émettre facture Pennylane" depuis livraison
- [ ] **P2** : Statut facture dans fiche livraison
- [ ] **P4** : Liste impayés > 30 j avec relance
- [ ] **Q4** : Notif Slack paiement reçu
- [ ] Mapping clients MCA ↔ Pennylane (table de correspondance)

**Livrable** : flow facturation 1-clic, visibilité encours.

### Sprint 3 — Sous-traitance + auto-catégorisation (1 mois)
- [ ] Contact B2PWeb commercial → accès API
- [ ] Module "Sous-traitance" : push offre B2PWeb depuis MCA
- [ ] Module "Fret retour" : pull Teleroute depuis page véhicule
- [ ] **Q3** : Détection charges récurrentes Qonto + catégorisation
- [ ] **P5** : Synchro fournisseurs (si pertinent)

**Livrable** : MCA devient hub opérationnel transport, plus juste compta.

---

## Annexes

### Architecture cible (vue haut niveau)

```
                ┌──────────┐         ┌─────────────┐
                │  Qonto   │         │  Pennylane  │
                │  (banque)│         │  (compta)   │
                └────┬─────┘         └──────┬──────┘
                     │ webhooks             │ webhooks
                     │ + REST               │ + REST OAuth2
                     ▼                      ▼
            ┌────────────────────────────────────┐
            │   Supabase Edge Functions          │
            │   /qonto-webhook /pennylane-webhook│
            │   /sync-cron (1×/h)                │
            └────────────┬───────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────┐
            │   Postgres MCA                     │
            │   livraisons, paiements, charges   │
            │   + tables miroir: pennylane_invoice│
            │     qonto_transactions             │
            └────────────┬───────────────────────┘
                         │
                         ▼
            ┌────────────────────────────────────┐
            │   PWA MCA (Cloudflare Pages)       │
            │   + B2PWeb / Teleroute calls       │
            └────────────────────────────────────┘
```

### Tables Supabase à créer

```sql
-- Réconciliation Qonto
CREATE TABLE qonto_transactions (
  id text PRIMARY KEY,                    -- Qonto tx id
  amount_cents integer,
  currency text,
  side text,                              -- 'credit' | 'debit'
  emitted_at timestamptz,
  counterparty_name text,
  counterparty_iban text,
  reference text,
  matched_livraison_id uuid REFERENCES livraisons(id),
  match_confidence text,                  -- 'auto' | 'manual' | 'none'
  raw jsonb
);

-- Miroir factures Pennylane
CREATE TABLE pennylane_invoices (
  id text PRIMARY KEY,                    -- Pennylane invoice id
  livraison_id uuid REFERENCES livraisons(id),
  invoice_number text,
  status text,                            -- draft|sent|paid|overdue
  amount_cents integer,
  due_date date,
  paid_at timestamptz,
  pdf_url text,
  raw jsonb,
  updated_at timestamptz
);

-- File de rapprochement manuel
CREATE TABLE paiements_a_rapprocher (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qonto_transaction_id text REFERENCES qonto_transactions(id),
  candidates jsonb,                       -- [{livraison_id, score, reason}]
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);
```

### Sources

- Qonto API : https://docs.qonto.com/api-reference/introduction
- Qonto OAuth scopes : https://docs.qonto.com/get-started/onboarding-api/authentication
- Qonto webhooks : https://docs.qonto.com/api-reference/business-api/webhooks/
- Pennylane API : https://pennylane.readme.io/
- Pennylane 2026 migration : https://pennylane.readme.io/docs/2026-api-changes-guide
- B2PWeb : https://www.b2pweb.com/fr/
- Teleroute API : https://api-docs.teleroute.com/
- TIMOCOM dev : https://developer.timocom.com/
- Chronotruck dev : https://developers.chronotruck.com/
