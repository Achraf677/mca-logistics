# DelivPro - Architecture cible

## Front

- `index.html`: interface admin
- `login.html`: connexion
- `salarie.html`: espace salarie
- `script.js`: logique front
- `style.css`: styles

## Backend cible

- Hebergement: Cloudflare Pages
- Auth: Supabase Auth
- Donnees: Supabase Postgres
- Photos: Cloudflare R2

## Regles de base

- Ne jamais stocker les photos en base64 dans la base
- Ne jamais garder `localStorage` comme source de verite finale
- Stocker uniquement les cles/URLs des photos en base

## Flux photo d'inspection cible

1. Le salarie prend/envoie une photo
2. Le front demande une URL signee
3. La photo est envoyee vers R2
4. La base enregistre:
   - inspection_id
   - salarie_id
   - vehicule_id
   - r2_key
   - photo_url
   - created_at

## Priorite metier

Si on veut fiabiliser rapidement:

1. Auth
2. Salaries
3. Vehicules
4. Inspections
5. Photos R2

