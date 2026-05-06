# Postmortem — changement des emails admin Supabase (5–6 mai 2026)

**Statut** : résolu  
**Durée d'incident** : ~3 h (login admin cassé pendant cette période)  
**Impact** : 2 comptes admin (Achraf + Mohammed) bloqués hors du site sur tous les environnements (prod + dev preview)

## Contexte

Demande utilisateur : changer les emails Supabase auth des 2 admins  
- `admin.achraf@mca-logistics.fr` → `achraf-chikri@mcalogistics.fr`  
- `admin.mohammed@mca-logistics.fr` → `mohammed-chikri@mcalogistics.fr`

Approche prise : `UPDATE` SQL direct sur `auth.users`, `auth.identities` et `public.profiles`.

## Ce qui a foiré (par ordre de découverte)

### 1. Cache login client 24 h
**Symptôme** : login retourne "identifiants non reconnus".  
**Cause** : `localStorage.delivpro_login_target_cache_v1` mémorise pendant 24 h le mapping `identifiant → email`. Après changement d'email, le cache pointait vers l'ancien email inexistant.  
**Fix** : bump de la clé `_v1` → `_v2` (commit `e97e3ed`). Invalide tous les caches existants.

### 2. Table `public.admin_identities` non mise à jour
**Symptôme** : login échoue même en navigation privée.  
**Cause** : la RPC `find_login_email` mappe l'identifiant à l'email via `public.admin_identities`. Cette table n'a pas été mise à jour en même temps que `auth.users`.  
**Fix** : `UPDATE public.admin_identities SET email = ...` pour les 2 admins.

### 3. Colonnes texte à NULL (cause racine du blocage)
**Symptôme** : login retourne `500: Database error querying schema` côté GoTrue avec `code = unexpected_failure`. Visible uniquement dans les logs auth Supabase.  
**Cause** : le UPDATE initial mettait `email_change = NULL`. GoTrue (Go) attend une `string` non-nullable et crash sur le scan : `Scan error on column index 8, name "email_change": converting NULL to string is unsupported`.  
**Fix** : forcer toutes les colonnes texte à `''` au lieu de NULL :
```sql
UPDATE auth.users SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE email LIKE '%mcalogistics.fr';
```

### 4. Hash localStorage désynchronisé bloque le changement de mdp PC
**Symptôme** : après reset du password admin via SQL bcrypt, l'utilisateur ne peut pas changer son mot de passe depuis Paramètres PC ("mot de passe actuel incorrect").  
**Cause** : `script-core-auth.js:changerMdpAdmin` vérifiait l'ancien mdp contre le hash PBKDF2 stocké en localStorage `admin_accounts`. Ce hash n'avait jamais été recalculé après le reset Supabase.  
**Fix** : en mode Supabase, vérifier le mdp actuel via `signInWithPassword` (source de vérité), au lieu du hash local (commit `bdc5438`). Le hash local reste fallback pour le mode offline / local-only.  
**Note** : le mobile (`script-mobile.js:formChangerMdpAdmin`) faisait déjà ça correctement.

## Démarche propre pour la prochaine fois

### Pour changer un email Supabase auth admin

**Méthode recommandée** : utiliser l'API admin Supabase plutôt que SQL direct. Avec service_role key :
```js
await supabase.auth.admin.updateUserById(userId, { email: 'nouveau@email.fr' })
```
Cette API gère proprement toutes les colonnes side-effect. Elle peut déclencher un mail de confirmation au nouvel email — désactivable via `email_confirm: true`.

**Si SQL direct nécessaire** (ex : pas d'accès API, ou domaine inexistant) :
1. Update `auth.users` : `email`, `email_confirmed_at = now()` si reset, et **JAMAIS de NULL** sur les colonnes texte. Utiliser `''` à la place.
2. Update `auth.identities` : `identity_data` (JSONB, champ `email`).
3. Update `public.profiles` (table métier).
4. Update `public.admin_identities` (table de mapping login → email pour les admins).
5. Update les éventuelles tables tierces référençant l'email (à auditer).
6. Bump `LOGIN_TARGET_CACHE_KEY` dans `supabase-auth.js` pour invalider les caches client.
7. Push + redéploiement Cloudflare avant de communiquer aux utilisateurs.

### Checklist pré-changement

- [ ] Vérifier que le nouveau domaine email existe et reçoit du courrier (sinon flow confirmation cassé).
- [ ] Avoir un compte admin de secours non touché par le changement (au cas où).
- [ ] Tester le login depuis une session privée (pas de cache localStorage).
- [ ] Lire les logs auth Supabase si erreur générique côté client (`mcp__supabase__get_logs service=auth`).

## Ce qui m'a pris du temps à diagnostiquer

- Le message côté client était volontairement générique ("identifiants non reconnus") pour ne pas leaker. La vraie erreur (`Database error querying schema`) n'apparaissait que dans :
  - Network tab DevTools → Response du `/token?grant_type=password`
  - Logs Supabase → service auth
- Sans accès aux logs auth, on tournait en rond sur des hypothèses (mauvais mdp, cache navigateur, hash incompatible).

**Leçon** : pour tout bug auth opaque, vérifier les **logs Supabase auth en premier**, pas en dernier.

## Outils utilisés pendant la résolution

- `mcp__supabase__execute_sql` : update tables auth + diagnostic
- `mcp__supabase__get_logs service=auth` : trouvé l'erreur racine
- F12 DevTools (côté Achraf) : confirmation du code d'erreur HTTP

## Commits liés

- `e97e3ed` : bump LOGIN_TARGET_CACHE_KEY v1 → v2
- `bdc5438` : verif mdp actuel via Supabase au lieu du hash localStorage
