# provision-salarie-access

Fonction Edge Supabase pour creer ou mettre a jour le compte `Authentication > Users` d'un salarie depuis l'interface admin.

## Variables requises

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploiement

Depuis un environnement ou la CLI Supabase est configuree :

```bash
supabase functions deploy provision-salarie-access
```

## Ce que fait la fonction

1. verifie que l'appelant est authentifie
2. verifie que son `profile.role = 'admin'`
3. recupere le salarie dans `public.salaries`
4. cree ou met a jour le user Auth avec son email technique
5. relie `public.salaries.profile_id` au user Auth

## Appel front

Le front appelle :

```js
window.DelivProAdminSupabase.provisionSalarieAccess({
  salarieId: "...",
  numero: "EMP001",
  password: "motdepasse"
})
```
