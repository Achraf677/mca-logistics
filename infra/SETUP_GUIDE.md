# DelivPro - Mise en ligne fiable et gratuite

Ce guide ne modifie pas la structure actuelle du site.
Le front reste exactement en HTML/CSS/JS vanilla.

## Architecture recommandee

- Front statique: Cloudflare Pages
- Base de donnees + authentification: Supabase
- Photos d'inspection: Cloudflare R2

## Pourquoi cette architecture

- Le site actuel est simple a publier tel quel sur Cloudflare Pages.
- Supabase permet une vraie base partagee entre admin et salaries.
- R2 est mieux adapte aux photos qu'un stockage local ou du base64.

## Ce que tu dois creer

1. Un compte GitHub
2. Un compte Cloudflare
3. Un compte Supabase

## Etape 1 - Mettre le projet sur GitHub

1. Cree un nouveau repository GitHub, par exemple `delivpro`
2. Mets ce dossier dedans
3. Pousse les fichiers vers GitHub

Commandes a lancer dans le dossier du projet:

```powershell
git init
git add .
git commit -m "Initial DelivPro setup"
git branch -M main
git remote add origin https://github.com/TON-USER/delivpro.git
git push -u origin main
```

## Etape 2 - Publier le front sur Cloudflare Pages

1. Ouvre Cloudflare Dashboard
2. Va dans `Workers & Pages`
3. Clique `Create application`
4. Choisis `Pages`
5. Connecte ton repository GitHub
6. Selectionne le repo `delivpro`
7. Build command: laisse vide
8. Build output directory: `.`
9. Deploy

Resultat:

- `index.html` sera l'interface admin
- `login.html` restera accessible
- `salarie.html` restera accessible

## Etape 3 - Creer Supabase

1. Cree un nouveau projet Supabase
2. Attends la fin de l'initialisation
3. Ouvre `SQL Editor`
4. Copie le contenu du fichier `infra/supabase/001_init.sql`
5. Execute le script

## Etape 4 - Creer le bucket photo dans R2

1. Ouvre Cloudflare Dashboard
2. Va dans `R2`
3. Cree un bucket nomme `delivpro-inspections`
4. Garde la region par defaut
5. Cree une API token R2 plus tard quand on branchera l'upload

## Etape 5 - Ce que cette preparation apporte deja

- Le site est publiable sans changer sa structure
- La base cible est prete
- Le stockage photo cible est choisi
- La migration future pourra se faire proprement, module par module

## Phase suivante recommandee

Ordre de migration conseille:

1. Auth admin + salaries
2. Salaries
3. Vehicules
4. Livraisons
5. Planning / absences
6. Inspections
7. Upload photos R2
8. Messagerie

## Important

Pour l'instant, ce projet utilise encore `localStorage`.
Donc:

- le site peut etre publie tout de suite
- mais les donnees resteront locales tant qu'on n'aura pas branche Supabase

Autrement dit:

- publication = OK des maintenant
- multi-utilisateur reel = apres migration de la couche stockage

## Ce que je te conseille ensuite

La prochaine etape utile est:

1. brancher Supabase Auth
2. remplacer `charger()` / `sauvegarder()` par un adaptateur progressif
3. migrer le module `inspections` en premier pour les photos

