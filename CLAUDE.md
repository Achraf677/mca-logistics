# MCA Logistics — Notes pour Claude

> Source de vérité courte pour cadrer le travail au démarrage de chaque
> session. La doc complète est dans `docs/`. Si une décision contredit ce
> fichier, c'est ce fichier qui gagne — il doit refléter l'état réel.

Dernière mise à jour : 2026-05-06

---

## Contexte business

- PGI transport/logistique pour MCA Logistics (Achraf + 1 admin associé + chauffeurs).
- PWA vanilla JS, hostée Cloudflare Pages, backend Supabase (`lkbfvgnhwgbapdtitglu`).
- Branche de dev courante : `claude/bundle-split-sprint-a` (PR #22 draft).
- **Compta** tenue en parallèle sur **Pennylane** (factures, TVA, paiements, charges récurrentes).
- **Banque** sur **Qonto** (virements, soldes, transactions, rapprochement).

---

## Règles de dev imposées par Achraf

### Parité & cohérence (priorité 1)
- **Parité PC ↔ mobile systématique** : toute fonctionnalité ajoutée/modifiée côté
  mobile doit aussi être livrée côté PC, et inversement. Pas de delta sauf
  justification explicite. *Rappel utilisateur : "Systématiquement tout ce que tu
  changes sur mobile change le sur pc aussi" — répété 60+ fois sur 6 mois.*

### Architecture & code
- **Pas de migration framework JS** : vanilla JS only, zéro dépendance npm front.
- **Un fichier = un domaine métier** : chaque table métier (livraisons, charges,
  carburant, etc.) a son propre `script-<domaine>.js`. Pas de fourre-tout. Pas de
  fichier > 1500 lignes — sinon découper avant d'ajouter.
- **Toutes les fonctions au scope global** (`window.X = ...`) côté front pour que
  les `onclick="X()"` HTML continuent de fonctionner.
- **RLS Supabase obligatoire** sur toute nouvelle table — jamais d'INSERT/SELECT
  ouvert sans politique.

### Tests & qualité
- **Tests unitaires obligatoires** sur les calculs critiques : TVA, rentabilité,
  heures, km, dates timezone. Doivent passer avant merge.
- **Postmortem obligatoire** pour tout incident impactant connexion ou données
  utilisateur. Format markdown rangé dans `docs/archive/`.
- **Chaque ajout détaillé** : commit message clair + PR description complète, pas
  de "misc updates", pas de "stuff".

### Process git
- Branches toujours préfixées `claude/` (ex: `claude/bundle-split-sprint-a`).
- PR créée en **draft** tant qu'incomplète.
- Commit messages au format `type(scope) — description courte`.
- Cache busting : bumper `CACHE_VERSION` dans `sw.js` ET `?v=NN` dans
  `admin.html` / `m.html` / `salarie.html` / `login.html` à chaque release JS.

### Sécurité & secrets
- **Aucun token / clé / secret en clair dans le repo. Jamais.** Tous les tokens
  runtime vivent dans **Supabase Edge Function Secrets**. Process complet dans
  `docs/secrets-management.md`. Inventaire dans `docs/access-tokens.md`.
- **Aucun token collé dans le chat Claude.** Le coller directement dans l'UI
  Supabase Secrets.
- **Rotation immédiate** de toute clé suspectée fuite. Mettre à jour le secret
  Supabase (les edge functions relisent `Deno.env.get()` à chaque invoc, pas
  besoin de re-déployer).
- **Storage privé** pour tous les documents (cartes grises, docs salariés, photos
  inspections). Signed URLs TTL 10 min, jamais d'URL publique.

### Communication
- Réponses **synthétiques par défaut** — code > prose, droit au but, pas de
  blabla redondant.
- Quand un sujet est complexe, proposer 2-3 options + tradeoff au lieu d'imposer.

---

## Direction produit

MCA = **couche opérationnelle transport**. Pas de doublon avec :

| Outil | Périmètre exclusif | À NE PAS dupliquer dans MCA |
|---|---|---|
| **Pennylane** | TVA CA3, factures clients officielles, devis, journal comptable | Émission de facture légale, plan de comptes, écritures |
| **Qonto** | Virements sortants, réconciliation bancaire complète | Initier des virements, gestion bénéficiaires |

MCA couvre ce que Pennylane et Qonto ne font pas : rattachement coûts à
véhicule/tournée/chauffeur, planning, inspections, carburant, conformité
réglementaire (ADR / CE 561), rentabilité fine par mission/véhicule.

---

## Décisions techniques 2026-05-06

### Stack IA / maps
- **Gemini API via Google AI Studio** (`https://aistudio.google.com`) → projet GCP
  `budget-achraf` (n° `875383470177`). **Tier 1 payant activé le 2026-05-08**
  (free tier rate-limit 10 RPM/250 RPD trop restrictif pour un chatbot
  interactif). Limites Tier 1 : 1000 RPM / 4M TPM / 10 000 RPD.
  - Coût mensuel attendu : **~€0,55-€0,90/mois** pour 50 questions/jour.
  - **Cap budget Google Cloud : 5 €/mois** (alerte "MCA LOGISTICS"), email à 50 %,
    90 %, 100 %.
  - Procédure de désactivation d'urgence : voir `docs/access-tokens.md` section
    "Procédure de désactivation d'urgence".
  - Secret runtime : `GEMINI_API_KEY`.
- **OpenRouteService (HeiGIT)** remplace Google Maps → 2000 req/jour gratuit,
  sans CB, profil HGV camion natif, optimisation tournée incluse. Secret :
  `ORS_API_KEY`.
- **Google Maps API : abandonné** (CB obligatoire + Distance Matrix payant).

### Intégrations comptables (actives)
- **Pennylane** : token API actif (15 scopes lecture seule, dont **FEC**) →
  l'import FEC n'est plus bloqué. Secret : `PENNYLANE_TOKEN`. Company ID
  `23200904`.
- **Qonto** : Internal API active (lecture seule par design, pas d'écriture
  possible). Secrets : `QONTO_LOGIN`, `QONTO_SECRET_KEY`. Org slug
  `mca-logistics-3134`.

### AI Agent dans MCA (en cours)
- Cible : chatbot conversationnel avec tool use, intégré au shell `panneau-agent`
  déjà présent (UI dans `script-core-audit.js`, decisions stockées en
  `localStorage.agent_decisions`).
- **V1** (PR à venir) : tools lecture seule (`search_livraisons`, `search_charges`,
  `search_clients`, `get_stats`), bouton flottant chat, hybride Pro→Flash avec
  quota tracker (table Supabase `ai_quota_daily`), historique conversation en
  localStorage.
- **V2** (PR séparée) : tools écriture avec confirmation UI (`propose_livraison`,
  `propose_charge`), streaming, OCR multimodal Gemini sur photos
  factures/tickets.

---

## Idées en attente

### Teleroute / B2PWeb (sous-traitance fret)
- Pas d'accès API self-service côté B2PWeb (contact commercial requis).
- Teleroute : API REST documentée mais pas encore d'accès Achraf.
- À traiter "à fond" dès qu'un accès est obtenu (~1 semaine d'intégration).

### Automatisations comptables (maintenant débloquées)
- **Workflow GitHub Actions import FEC mensuel Pennylane** → `PENNYLANE_TOKEN`
  pour importer FEC → MCA charges/paiements automatique.
- **Synchro Qonto** → auto-cocher "payé" sur charges/livraisons quand le
  virement arrive sur Qonto (`QONTO_*`).
- **Rapprochement bancaire mensuel** combinant FEC Pennylane + transactions Qonto.

---

## Pointeurs

- Architecture détaillée : `docs/02-architecture.md`
- Mobile (m.html + salarie.html) : `docs/03-mobile-app.md`
- PC (admin.html) : `docs/04-pc-app.md`
- Schéma DB Supabase : `docs/05-database.md`
- Roadmap & sprints : `docs/10-roadmap-backlog.md`
- Inventaire tokens / accès tiers : `docs/access-tokens.md`
- Process secrets : `docs/secrets-management.md`
