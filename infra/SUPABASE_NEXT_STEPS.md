# DelivPro - Etapes suivantes Supabase

Cette etape ne remplace encore aucun stockage `localStorage`.
Elle ajoute seulement une base commune pour preparer la migration.

## Deja en place

- Front publie sur Cloudflare Pages
- Projet Supabase cree
- Schema SQL initialise
- URL de redirection Auth configurees
- Client front Supabase ajoute

## Etapes recommandees

1. Faire pointer l'entree publique du site vers `login.html`
2. Brancher l'authentification admin et salarie sur Supabase Auth
3. Migrer en premier les inspections et leurs photos
4. Ajouter le stockage image distant
5. Migrer ensuite la messagerie, le planning et les CRUD principaux

## Important

- La `publishable key` peut etre chargee cote navigateur
- La `secret key` ne doit jamais etre exposee dans le front
- Tant que la migration n'est pas faite, `localStorage` reste la source active
