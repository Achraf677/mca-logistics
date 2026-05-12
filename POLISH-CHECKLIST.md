# Polish checklist — toutes pages

> Aucune page n'est 100% finie, **même Dashboard et Livraisons** marqués DONE.
> "DONE" dans `PLAN-REFONTE.md` veut dire "ok pour démo", pas "intouchable".
>
> Quand `BUGS-OPEN.md` NEW est vide → repasser sur les pages DONE en mode polish
> avec cette checklist.

---

## 🎨 Couleurs (pixel-par-pixel vs mockup)

Pour chaque page, comparer ces zones :

- [ ] **Chips de filtres** : couleur fond + count badge (Toutes / Livrées / En cours / Retard / Brouillons / etc.)
- [ ] **Statut pills dans tableau** : chaque statut (Brouillon gris / En cours bleu / Livré vert / Retard rouge clair / Annulé...)
- [ ] **Kanban** :
  - couleur fond des cartes
  - header de chaque colonne (En attente / En cours / Livré / Retard)
  - chip count en haut de colonne
  - border-left coloré par statut ?
- [ ] **Avatars chauffeur** : gris uniforme (24px) ou rouge brand selon mockup
- [ ] **Badges/pills KPI** : "Critique", "Warn", "Info", "Success"
- [ ] **Boutons primary/secondary/danger** : brand red / transparent / etc.
- [ ] **Hover states** : background-hover et color-hover
- [ ] **Focus visible** : outline ring 3px brand-soft
- [ ] **Sidebar nav-item active** : background + left border + text color
- [ ] **Toast success/error/info/warning** : 4 couleurs distinctes
- [ ] **Empty states** : icon + texte muted

## 🛠️ Fonctionnalités à tester de bout en bout

Pour chaque page avec des exports/générations :

- [ ] **Générer Facture PDF** : sélectionner livraison(s) → clic → PDF téléchargé avec données réelles
- [ ] **Générer Bon de livraison** : idem
- [ ] **Générer Lettre de voiture** : idem
- [ ] **Générer Facture groupée** : multi-sélection → PDF unique
- [ ] **Exporter CSV** : header correct + lignes data + virgule séparateur + encodage UTF-8
- [ ] **Exporter XLSX** : tabs nommés + colonnes typées + filename horodaté
- [ ] **Exporter PDF rapport** : page A4 portrait + KPIs + tableau + footer
- [ ] **Import CSV** (si feature) : preview + validation + commit

Si une de ces actions est cassée (toast erreur, rien ne se passe, console error) → bug **BUG-XXX** prio HAUTE.

## 🗑️ Boutons morts / redondants

Pour chaque page :

- [ ] Lister tous les boutons visibles (header, toolbar, table-actions, drawer, modal)
- [ ] Pour chaque bouton : tester son `onclick` → doit déclencher une action visible
- [ ] Identifier les doublons (même action en 2 endroits → garder le plus naturel, supprimer l'autre)
- [ ] Identifier les boutons "fantômes" : déclenchent rien, alert("TODO"), ou page navigation cassée
- [ ] **Action** : supprimer ou déplacer où ils seront utiles (jamais "garder par sécurité")

Exemples connus :
- ~~bouton Modifier en bulk-action-bar floating ET en section-head~~ (fix Phase 33 BUG-009)
- ~~bouton "Mo..." tronqué drawer footer~~ (fix Phase 33 BUG-011)
- Toujours surveiller : drawer footer vs modal footer, top-right vs section-head, contextuel vs global

## ♿ Accessibilité (a11y)

- [ ] Boutons icon-only ont un `aria-label`
- [ ] Inputs ont un `<label for="">` ou `aria-labelledby` (pas juste placeholder)
- [ ] Focus visible sur tab (outline ou ring)
- [ ] ESC ferme modal/drawer
- [ ] Contraste texte muted vs fond ≥ 4.5:1
- [ ] `prefers-reduced-motion` respecté (animations désactivables)
- [ ] Pas de `maximum-scale=1.0, user-scalable=no` (zoom natif bloqué)

## 🎯 Tooltips & micro-UX

- [ ] Tooltip natif (`title=""`) sur tous les boutons icon-only
- [ ] Badges count > 99 affichent "99+"
- [ ] Tableaux : row hover background subtil
- [ ] Tri colonne : indicateur visuel (caret up/down)
- [ ] Pagination : page courante highlightée
- [ ] Toast : auto-dismiss après 4s ou clic croix
- [ ] Loading states : skeleton ou spinner pendant fetch
- [ ] Confirm dialog avant action destructive (supprimer)

## 📐 Layouts responsive

- [ ] 1920x1080 : layout aéré, pas de wrap inutile
- [ ] 1440x900 : layout standard
- [ ] 1280x800 : layout compact, pas de scroll horizontal
- [ ] 1024px : sidebar collapsible OU layout mobile
- [ ] Print CSS : éliminer sidebar+topbar, garder tableau

## 🧪 Console (zero tolerance)

- [ ] 0 error au chargement
- [ ] 0 warning au chargement
- [ ] 0 404 sur assets
- [ ] 0 erreur pendant interaction (click, scroll, fill, submit)
- [ ] Pas de log debug oublié (`console.log` partout)

---

## 🔄 Workflow polish-pass

Pour chaque page à polisher :

1. **Screenshot état actuel** vs mockup (1440x900 puis zooms section)
2. **Diff couleurs** : noter chaque delta ≥10% RGB
3. **Inventaire boutons** : liste exhaustive + état (live/mort/doublon)
4. **Test exports** : exécuter chaque CSV/XLSX/PDF → ouvrir le fichier généré
5. **Test fonctionnalités** : remplir form → save → relire → modifier → relire → supprimer
6. **Audit console** : `F12` → 0 error 0 warning
7. **Note dans BUGS-OPEN.md** chaque delta comme BUG-XXX prio MEDIUM (sauf si cassé fonctionnel → HIGH)
8. **Fix les BUG-XXX** un par un, commit individuel
9. **Update PLAN-REFONTE.md** % visuel/fonctionnel

---

## 📊 Ordre suggéré des polish-passes

Une fois `BUGS-OPEN.md` NEW vide :

1. **Livraisons** (page la plus complexe, la plus utilisée — passer en premier)
2. **Dashboard** (page d'accueil, première impression)
3. **Pages métier** dans l'ordre sidebar
4. **Mobile m.html + salarie.html** (parité totale avec PC)

---

**Note importante** : ce document est lu par les routines cloud autonomes.
Si tu veux ajouter une exigence polish, ajoute-la ici, pas dans les prompts des routines.
