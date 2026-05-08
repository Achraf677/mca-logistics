# Gestion des secrets — process MCA

> Comment on stocke, on utilise et on rote les clés API / tokens dans MCA.
> **TL;DR** : tout vit dans **Supabase Edge Function Secrets**. Le frontend ne voit jamais de secret.

---

## Architecture

```
Frontend MCA (PWA, public)              Edge Functions (Deno, Supabase)
─────────────────────────              ──────────────────────────────
                                       │
fetch('/functions/v1/ai-proxy',        │  Deno.env.get('GEMINI_API_KEY')
      { headers: { Authorization:      │  Deno.env.get('ORS_API_KEY')
        'Bearer ' + userJWT } })       │  Deno.env.get('PENNYLANE_TOKEN')
        │                              │  ...
        │  HTTPS + JWT user            │
        └─────────────────────────────►│  ──► Appel API tierce
                                       │      avec le secret en header
                                       │
                                       │  ◄── Réponse
                                       │
        ◄──────────────────────────────│
            JSON (sans le secret)
```

**Règle absolue** : aucun secret ne quitte Supabase. Le frontend ne reçoit que le résultat métier.

---

## Lister / ajouter / modifier les secrets

### Via UI (recommandé)

https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/functions/secrets

- Bouton **"Add new secret"** → Name (UPPER_SNAKE_CASE) + Value
- Bulk save en bas
- ⚠️ Préfixe `SUPABASE_` réservé. Utiliser `MCA_SUPABASE_*` à la place.

### Via Supabase CLI (avancé)

```bash
supabase secrets list
supabase secrets set GEMINI_API_KEY="<value>"
supabase secrets unset OLD_SECRET
```

### Naming convention

| Format | Exemple | Cas d'usage |
|---|---|---|
| `<SERVICE>_API_KEY` | `GEMINI_API_KEY`, `ORS_API_KEY` | Clé API simple |
| `<SERVICE>_TOKEN` | `PENNYLANE_TOKEN`, `SENTRY_TOKEN` | Bearer token |
| `<SERVICE>_LOGIN` + `<SERVICE>_SECRET_KEY` | `QONTO_LOGIN`, `QONTO_SECRET_KEY` | Auth login + secret |
| `MCA_<SERVICE>_*` | `MCA_SUPABASE_PAT` | Quand `<SERVICE>_*` est réservé |

---

## Utiliser un secret depuis une Edge Function

```typescript
// supabase/functions/<nom>/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // 1. Vérifier le JWT user (sauf cas explicites comme webhooks)
  //    Supabase l'auto-vérifie si verify_jwt: true au déploiement.

  // 2. Lire le secret côté serveur
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return new Response("missing secret", { status: 500 });

  // 3. Appeler l'API tierce
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await req.text(),
    },
  );

  // 4. Renvoyer la réponse au frontend (sans la clé)
  return new Response(await r.text(), {
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## Appeler une Edge Function depuis le frontend MCA

```javascript
// vanilla JS, frontend MCA
const SUPABASE_URL = "https://lkbfvgnhwgbapdtitglu.supabase.co";

async function callAI(prompt) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  return r.json();
}
```

Le frontend ne connaît **que** :
- L'URL Supabase (publique)
- Le JWT de l'utilisateur connecté (déjà utilisé pour la DB)

Aucune clé API tierce.

---

## Que faire si un secret fuite

1. **Roter immédiatement** : suivre la procédure de révocation dans `docs/access-tokens.md`
2. **Mettre à jour le secret Supabase** avec la nouvelle valeur (UI ou CLI)
3. **Re-déployer les edge functions concernées** n'est PAS nécessaire — elles relisent `Deno.env.get()` à chaque invocation
4. **Pas besoin de réécrire l'historique git** si le secret n'a jamais été commité (vérifier avec `git log -p -S "<premiers chars>"`)
5. **Si le secret a été commité** : toujours roter en priorité (les bots scannent GitHub en quelques minutes), puis décider si réécriture historique vaut le risque (casse les PRs ouvertes, force-push)

---

## Anti-patterns à éviter

| ❌ Mauvais | ✅ Bon |
|---|---|
| Hardcoder une clé dans `script.js` | Edge Function avec `Deno.env.get()` |
| Mettre une clé dans `.env` commité | `.env` dans `.gitignore` + Supabase Secrets |
| Coller une clé dans le chat Claude | Coller directement dans l'UI Supabase Secrets |
| Documenter la valeur du token dans un MD | Documenter le **nom** du secret + le lien de révocation |
| Une clé "all-purpose" pour tous les services | Une clé par service, scopes minimum |
| Token Pennylane avec scope écriture | Token lecture seule (15 scopes lecture) |

---

## Inventaire actuel

Voir `docs/access-tokens.md` (table récapitulative + procédure révocation).

Liste des noms de secrets actuellement actifs dans Supabase :

- `GEMINI_API_KEY`
- `ORS_API_KEY`
- `PENNYLANE_TOKEN`
- `QONTO_LOGIN`
- `QONTO_SECRET_KEY`
- `SENTRY_TOKEN`
- `MCA_SUPABASE_PAT`

Variables auto-injectées par Supabase (pas à gérer) :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
