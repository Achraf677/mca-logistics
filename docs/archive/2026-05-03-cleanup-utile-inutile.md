# Audit UX utile/inutile — MCA Logistics

Date : 2026-05-03
Périmètre : `script-mobile.js`, `script.js`, `script-tva.js`,
`script-rentabilite.js`, `script-charges.js`, `script-livraisons.js`,
`script-encaissement.js`, `script-heures.js`, `admin.html`, `m.html`,
`salarie.html`, `login.html`.

Convention :
- ✂️ ENLEVER : décoratif / infantile / redondant
- ✏️ REFORMULER : utile mais formulé bizarrement
- ✅ GARDER : info métier réellement utile

---

## ✂️ À ENLEVER (priorité haute)

### 1. Phrase "💡 Simulateur de rentabilité (parité PC)…" en bandeau
- **Fichier** : `script-mobile.js:5732`
- **Code actuel** : `<p>💡 Simulateur de rentabilité (parité PC). Configure tes hypothèses ou pars d'une livraison existante. Tout est en HT.</p>`
- **Problème** : tutoiement ("tes hypothèses"), méta-info technique ("parité PC") qui ne parle pas au user, emoji déco. Le titre de la page suffit.
- **Reco** : supprimer entièrement ce `<p>`. Le bouton "Mode de calcul" (Manuel / Depuis une livraison) suffit à comprendre.

### 2. "💡 Marge estimée = CA - (km × coût/km flotte X €/km)"
- **Fichier** : `script-mobile.js:5625`
- **Problème** : formule technique en haut de tableau, alourdit. Si l'utilisateur veut le détail il regarde le rapport.
- **Reco** : remplacer par un petit `(i)` avec tooltip ou supprimer.

### 3. "💡 Marge estimée : CA - carburant chauffeur - autres charges (au prorata des km)"
- **Fichier** : `script-mobile.js:5652`
- **Problème** : idem, formule longue et redondante avec celle ci-dessus.
- **Reco** : supprimer ou tooltip.

### 4. "💡 Glisse latéralement entre les colonnes. Tap = édition."
- **Fichier** : `script-mobile.js:3561`
- **Problème** : aide d'onboarding qui s'affiche à chaque rerender du Kanban. Une fois l'utilisateur initié c'est du bruit.
- **Reco** : supprimer (les gestes mobiles sont devinables) ou le passer à l'onboarding seulement.

### 5. "💡 Les documents (permis, CNI, RIB...) seront uploadables après la première sauvegarde."
- **Fichier** : `script-mobile.js:2381`
- **Problème** : phrase explicative qui pourrait être un texte inline naturel.
- **Reco** : remplacer par "Documents disponibles après création" ou laisser vide (le bloc "Documents" est désactivé visuellement = info claire).

### 6. Cœur emoji "🟢 Excellente santé" / "🟢 Santé correcte" / "🔴 Attention requise" / "⚪ En attente"
- **Fichier** : `script.js:1676`, `1679`, `1682`, `1685`
- **Problème** : la couleur du `etatClass` (.etat-bon / .etat-mauvais / .etat-vide) gère déjà la couleur via CSS. Le rond emoji fait doublon.
- **Reco** : retirer les puces "🟢 ", "🔴 ", "⚪ " des chaînes `etat = '...'`. Garder juste "Excellente santé" / "Santé correcte" / "Attention requise" / "En attente de données".

### 7. "Bonjour {prenom} 👋" dans templates SMS
- **Fichier** : `script.js:2443`, `2447`, `2803`, `2807`
- **Problème** : émoji main qui salue dans un message pro envoyé à un chauffeur. Style infantile.
- **Reco** : retirer le 👋 et le ☀️ ("Bonjour {prenom} ☀️"). "Bonjour {prenom}" suffit.

### 8. Templates SMS : "Merci 🙏" / "📷" / "🚐"
- **Fichier** : `script.js:2444`, `2445`, `2446`, `2807`
- **Problème** : emojis dans message client/chauffeur — ton trop décontracté pour un SMS pro.
- **Reco** : supprimer `🙏`, `📷`, `🚐` final.

### 9. Header dashboard mobile : émoji devant chaque KPI
- **Fichier** : `script-mobile.js:3355` ("📈 Bénéfice estimé"), `3363` ("📦 Livraisons"), `3368` ("👤 Au travail"), `3376` ("🔔 Alertes"), `3381` ("💸 Impayés"), `3409` ("👥 Équipe active")
- **Problème** : la couleur de carte (`m-card-green`, `m-card-blue`, `m-card-purple`, `m-card-red`, `m-card-accent`) suffit à différencier visuellement.
- **Reco** : retirer ces emojis des `m-card-title`. Garder le titre court ("Bénéfice estimé", "Livraisons", etc.).

### 10. "📅 Qui travaille aujourd'hui" / "📊 Activité des 7 derniers jours" / "🕐 Livraisons récentes"
- **Fichier** : `admin.html:265`, `271`, `277`, `script-mobile.js:3390`
- **Problème** : section headers ne servent à rien d'iconisés, le titre H2/H3 est déjà mis en valeur par le typo.
- **Reco** : retirer les emojis de ces titres de cards dashboard.

### 11. "📈 Activité" / "⛽ Carburant" / "💸 Charges fixes mensuelles HT" / "📝 Autres charges mensuelles" dans simulateur
- **Fichier** : `script-mobile.js:5755`, `5775`, `5792`, `5825`
- **Problème** : 4 sous-sections du formulaire simulateur, toutes avec emoji déco. Le label suffit.
- **Reco** : retirer tous les emojis de ces sous-titres.

### 12. "📊 Analyse journalière" / "🎯 Seuil de rentabilité" / "📦 Charges fixes" / "📏 Marge / km"
- **Fichier** : `script-mobile.js:5856`, `5857`, `5860`, `5866`
- **Problème** : titres déco dans le résultat simulateur.
- **Reco** : retirer les emojis. Garder "Analyse journalière", "Seuil de rentabilité".

### 13. "✅ Structure saine : ton activité couvre ses coûts."
- **Fichier** : `script-mobile.js:5885`
- **Problème** : tutoiement infantile + emoji `✅` qui fait double emploi avec la bordure verte.
- **Reco** : "Structure saine : l'activité couvre ses coûts."

### 14. Toast "✅ Configuration TVA enregistrée"
- **Fichier** : `script-tva.js:479`, `script-tva.js:435`
- **Problème** : pas grave, mais le toast par défaut de type 'success' a déjà un check icône.
- **Reco** : retirer le `✅` du texte (l'icône du toast suffit).

### 15. "📤 TVA Collectée" / "📥 TVA Déductible" titres en bandeau
- **Fichier** : `script-tva.js:526`, `527`, `528`, `531`, `admin.html:1058`, `1070`, `script-mobile.js:7553`, `7554`
- **Problème** : utilise emojis directionnels qui n'ajoutent rien (collecté = entrée, déductible = sortie ; ce sont des notions comptables, pas de "flèches").
- **Reco** : retirer les `📤` / `📥`.

### 16. "💰 CA HT − dépenses" sous-titre KPI Bénéfice
- **Fichier** : `admin.html:229`
- **Problème** : sous-titre = formule de calcul. Inutile sur le dashboard, info technique.
- **Reco** : remplacer par "CA HT − dépenses du mois" sans emoji, ou supprimer carrément.

### 17. KPI sous-titres redondants : "voir relances →", "à traiter", "non lus"
- **Fichier** : `admin.html:238`, `248`, `258`
- **Problème** : "voir relances →" est un CTA dans une zone qui est déjà pressable (curseur pointer + onclick). Le user comprend déjà.
- **Reco** : supprimer ces sous-titres OU garder uniquement les sous-titres qui apportent une *donnée* (ex: "12 factures").

### 18. Préfixes "🔴 ", "🟡 ", "🟢 " dans les filtres select Alertes
- **Fichier** : `admin.html:993` ("🔴 Alertes actives"), `995` ("✅ Historique traité"), `996` ("📋 Toutes")
- **Problème** : un select natif n'aligne pas bien les emojis. Le label texte suffit.
- **Reco** : "Alertes actives" / "Historique traité" / "Toutes".

### 19. Catégories charges avec emoji dans select
- **Fichier** : `admin.html:1393–1400`, `script-mobile.js:1281–1288`
- **Problème** : `<option>⛽ Carburant</option>`, `<option>🛣️ Péage</option>`, etc. Emojis dans des options select = pas alignés, pas lisibles.
- **Reco** : retirer les emojis. La cat-badge dans le tableau les ré-affiche déjà (`script-charges.js:480`).

### 20. Statut paiement dans select : "✅ Payé" / "🟡 Partiel" / "🔴 En retard"
- **Fichier** : `admin.html:1408–1410`, `script-mobile.js:1293–1294`
- **Problème** : idem, emojis dans option select.
- **Reco** : "Payé" / "Partiel" / "En retard". Le badge tabulaire les ré-applique avec couleur.

### 21. Type de jour planning : "🟢 Travail / ⚪ Repos / 🔵 Congé / 🔴 Absence / 🟣 Maladie"
- **Fichier** : `script.js:1950–1954`, `script-mobile.js:3153–3157`, `script-heures.js:218`
- **Problème** : ronds colorés dans options select. Le code couleur de la cellule est déjà appliqué après sélection.
- **Reco** : retirer les ronds. Garder "Travail", "Repos", etc.

### 22. Carburant types avec emoji dans select : "⛽ Diesel / ⛽ Essence / 🌿 GNV / ⚡ Électrique / 🔋 Hybride / 💧 Hydrogène"
- **Fichier** : `script-mobile.js:1097–1102`, `1819–1824`, `admin.html:453–458`, `511–516`
- **Problème** : 6 options × 2 endroits, juste pour décorer. Type carburant = donnée plate.
- **Reco** : retirer tous les emojis des options carburant.

### 23. Catégories clients avec emoji
- **Fichier** : `script-mobile.js:1682–1691`
- **Problème** : "🚚 Transport / 🏭 Industrie / 🏗️ BTP / 🏪 Commerce / 🛒 E-commerce / 🌾 Agro / ⚕️ Santé / 🏛️ Public / 🎪 Événementiel / 📝 Autre".
- **Reco** : retirer.

### 24. Modes financement véhicule : "💰 Achat neuf / 🚗 Occasion / 📋 LLD / 📝 LOA / 🏦 Crédit / 📅 Location simple"
- **Fichier** : `script-mobile.js:1811–1816`
- **Problème** : labels déco. Données métier strictes.
- **Reco** : retirer tous les emojis.

### 25. Sévérité incidents : "🟢 Faible / 🟠 Moyen / 🔴 Grave"
- **Fichier** : `script-mobile.js:2831–2833`, `admin.html:1448–1450`
- **Problème** : duplication couleur avec la cellule du tableau.
- **Reco** : retirer.

### 26. Statut incidents : "🔴 Ouvert / 🟡 En cours / ✅ Traité / ✅ Résolu / 🔒 Clos"
- **Fichier** : `script-mobile.js:2836–2840`, `admin.html:1454–1456`
- **Problème** : 2 emojis ✅ différents pour Traité et Résolu = ambiguïté.
- **Reco** : retirer tous les emojis.

### 27. Types absence planning : "🏖️ Congé / ⚠️ Absence / 🤒 Maladie / 😴 Repos / ✅ Travail"
- **Fichier** : `script-mobile.js:3153–3157`, `3893`, `3941`, `3990–3992`
- **Problème** : emojis répétés à 6 endroits. Le 🤒 (visage malade) est *infantile* dans un PGI pro.
- **Reco** : retirer partout, garder le label texte. La couleur de cellule dans la grille planning suffit.

### 28. KPI mobile : sous-titres "ce mois" / "aujourd'hui" / "à traiter"
- **Fichier** : `script-mobile.js:3365`, `3370`, `3378`, `3383`, `3411`
- **Problème** : redondants avec le titre, ou évidents.
  - "Livraisons : N · ce mois" → ce mois est implicite (dashboard du mois)
  - "Au travail : N · aujourd'hui" → aujourd'hui implicite
  - "Alertes : N · à traiter" → "à traiter" évident
- **Reco** : supprimer les `m-card-sub` qui n'apportent qu'un mot redondant. Garder ceux qui ajoutent une vraie info chiffrée (TTC, X charges, X critiques).

### 29. "Aucune facture en retard 🎉"
- **Fichier** : `script-mobile.js:4980`
- **Problème** : 🎉 dans un message d'état. Infantile pour un PGI.
- **Reco** : "Aucune facture en retard."

### 30. "Tout est nickel 🎉" empty-state alertes (PC)
- **Fichier** : `script.js:10139`
- **Problème** : "nickel" + 🎉 = registre trop oral.
- **Reco** : "Aucune alerte active. Le système surveille en continu."

### 31. "🚀 Tournée prête" / "✅ Bonne journée" labels SMS
- **Fichier** : `script.js:2803`, `2807`
- **Problème** : emojis dans les labels du dropdown templates SMS.
- **Reco** : "Tournée prête" / "Bonne journée".

### 32. "🗜️ Vue compacte" / "📋 Vue normale" toast
- **Fichier** : `script.js:2438`
- **Problème** : 🗜️ (étau ?) pour vue compacte. Métaphore peu lisible.
- **Reco** : "Vue compacte activée" / "Vue normale".

### 33. "Marquer livré ✅" / "Encaisser 💵" / "Supprimer 🗑️" boutons bulk
- **Fichier** : `script-mobile.js:3510`, `3511`, `3512`
- **Problème** : barre d'action bulk = espace contraint, le bouton a déjà sa couleur (vert/rouge).
- **Reco** : retirer les emojis des labels, garder couleur de bouton.

### 34. Verdict carbu/peage cards de KPI rapport rentabilité PC
- **Fichier** : `script-rentabilite.js:124`
- **Problème** : `'💶 CA','⛽ Carburant','🔧 Entretien','📝 Autres charges','📏 Coût/km','💰 Profit','📊 Marge'` — 7 cards × emoji.
- **Reco** : retirer les emojis (le rapport PDF se lira plus pro).

---

## ✏️ À REFORMULER

### 35. "Renseignez vos hypothèses…" (3 occurrences)
- **Fichier** : `script-rentabilite.js:606`, `676`, `728`, `script-mobile.js:5843`, `5876`
- **Problème** : "hypothèses" est jargon analytique. Mélange tutoiement (`Renseigne tes hypothèses`) / vouvoiement.
- **Reco** :
  - "Saisissez vos paramètres pour lancer l'analyse." (vouvoiement homogène PC)
  - "Saisis tes paramètres pour lancer l'analyse." (mobile, tutoiement homogène)
  - Ou neutre : "L'analyse démarrera dès la saisie des paramètres."

### 36. "Récap simplifié. La déclaration officielle CA3 doit être saisie sur impots.gouv.fr (pas générée par l'app)."
- **Fichier** : `script-mobile.js:7607`
- **Problème** : phrase défensive longue qui parle de ce que l'app **ne fait pas**. Décourage.
- **Reco** : déplacer dans un tooltip `(i)` à côté du titre TVA, OU raccourcir : "Récap mensuel — CA3 à saisir sur impots.gouv.fr".

### 37. "Une livraison apparaît dans le mois de son paiement (pas de sa facturation). C'est la règle officielle du transport routier."
- **Fichier** : `script-mobile.js:7577`
- **Problème** : le ton "C'est la règle officielle…" sonne comme une justification.
- **Reco** : "Mois d'**exigibilité** = mois du paiement (régime encaissements transport routier)." Plus sec, plus pro.

### 38. "Tu peux te faire rembourser" / "Récupérable auprès du Trésor"
- **Fichier** : `script-mobile.js:7590`
- **Problème** : la version actuelle ("Récupérable auprès du Trésor") va déjà bien, mais bandeau redondant si la valeur est négative (couleur verte le dit).
- **Reco** : laisser tel quel mais raccourcir si gain de place : "Crédit récupérable".

### 39. "Activité rentable avec ces paramètres" / "Activité déficitaire"
- **Fichier** : `script-mobile.js:5848`
- **Problème** : OK mais "avec ces paramètres" = défensif (CYA). On le sait, c'est un simulateur.
- **Reco** : "Activité rentable" / "Activité déficitaire".

### 40. "Aucune livraison" empty-state subtitles
- **Fichier** : `script-mobile.js:3422`, `3566`
- **Problème** : "Les livraisons saisies apparaîtront ici" / "Tape sur le bouton ➕ pour ajouter ta première livraison" — verbeux + tutoiement.
- **Reco** : "Aucune livraison enregistrée" + bouton "+ Nouvelle livraison" déjà présent (FAB). Le sous-texte est bruit.

### 41. "Renseigne tes hypothèses ou charge une livraison pour lancer l'analyse."
- **Fichier** : `script-mobile.js:5843`, `5876`
- **Problème** : doublon avec finding 35.
- **Reco** : voir 35.

### 42. "Combien de fois ce type de livraison par mois ?" / "Nombre de jours réellement travaillés sur la période."
- **Fichier** : `script-mobile.js:5769`
- **Problème** : phrases d'hint sous chaque champ — ça fonctionne mais alourdit le formulaire.
- **Reco** : raccourcir : "Fréquence mensuelle" / "Jours travaillés / mois". L'hint est inutile si le label est bon.

### 43. Placeholders "Ex : 15000" / "Ex : 12" / "Ex : 25 000" sur formulaire véhicule
- **Fichier** : `admin.html:2279–2356` (~10 occurrences)
- **Problème** : "Ex :" = orientation pédagogique excessive. Un placeholder vide ou avec juste l'unité suffit.
- **Reco** : remplacer par l'unité ("km", "mois", "€"), OU laisser vide. Garder uniquement quand l'ordre de grandeur n'est pas évident (PTAC).

### 44. "Bonjour [Admin]" + date longue dashboard mobile
- **Fichier** : `script-mobile.js:3345-3346`
- **Problème** : "Bonjour Admin" est cordial mais ne sert à rien. Date "lundi 4 mai" prend une ligne pour rien.
- **Reco** : compacter en une seule ligne : "lundi 4 mai" en haut à droite, et virer le "Bonjour".

### 45. "Voir relances →" / "Voir tout →" labels link
- **Fichier** : `admin.html:238`, `script-mobile.js:3391`, `3417`
- **Problème** : le `→` est superflu si la zone entière est cliquable.
- **Reco** : juste "Voir relances", "Voir tout" — laisser CSS gérer le chevron au hover.

### 46. "Vérifie + complète" dans status OCR
- **Fichier** : `script-mobile.js:1367`, `1910`
- **Problème** : tutoiement + verbeux.
- **Reco** : "Vérifier les champs détectés".

### 47. Hint "Tape sur '🏖️ Absence longue' en haut pour en créer."
- **Fichier** : `script-mobile.js:3960`
- **Problème** : empty-state qui décrit l'UI elle-même + tutoiement.
- **Reco** : supprimer (le bouton est juste au-dessus, visible).

---

## ✅ À GARDER

### 48. Mode TVA actif "Mode TVA : Services (exigible à l'encaissement)"
- **Fichier** : `script-mobile.js:7579-7586`
- **Justification** : règle métier non triviale (transport = encaissement par défaut, marchandises = livraison, services débits = autre). L'utilisateur peut être surpris du décalage si on ne le dit pas.
- **Reco** : garder mais supprimer l'emoji `⚙️` (le bandeau couleur accent suffit).

### 49. "Franchise en base" empty-state TVA
- **Fichier** : `script-mobile.js:7561-7567`
- **Justification** : explique pourquoi la page TVA est vide (CGI 293 B). Crucial pour les microentreprises.
- **Reco** : garder. Optionnel : retirer le `📭`, le titre "Franchise en base" suffit.

### 50. "📅 Facturé mais non exigible" bandeau orange
- **Fichier** : `script-mobile.js:7594-7596`
- **Justification** : explique pourquoi N livraisons facturées n'apparaissent pas dans le calcul TVA → évite le ticket support classique "il manque ma facture du 28 dans la TVA".
- **Reco** : garder (utile métier). Optionnel : retirer `📅`.

### 51. Avertissement LDV incomplète : "⚠️ LDV incomplète. Champs manquants : X. Complète-les sur la fiche livraison pour un document légalement conforme."
- **Fichier** : `script-mobile.js:993`, `script.js:3438`
- **Justification** : alerte légale (arrêté 09/11/1999). Le `⚠️` apporte une vraie hiérarchie de gravité.
- **Reco** : garder l'emoji + bandeau couleur.

### 52. Avertissements ADR / Heures CE 561/2006
- **Fichier** : `script-mobile.js:1057`, `script.js:2002`, `2005`, `2010`, `2013`, `2015`, `3443`
- **Justification** : conformité réglementaire (matières dangereuses, temps de conduite). Les `🛑` `⚠️` distinguent infraction vs simple alerte.
- **Reco** : garder.

### 53. Doublon LLD warning simulateur "⚠️ Possible doublon avec le champ LLD dédié"
- **Fichier** : `script-rentabilite.js:707`, `script-mobile.js:5884`
- **Justification** : aide réelle (évite double comptage). Action utile.
- **Reco** : garder.

### 54. Icônes nav sidebar admin (📊 Dashboard, 📦 Livraisons, etc.)
- **Fichier** : `admin.html:69-140`, `m.html:34-95`
- **Justification** : sidebar = lecture rapide, l'icône aide au repérage visuel. Surtout sur mobile bottom nav (5 onglets, pas de label parfois).
- **Reco** : garder (cas où l'emoji EST utile, pas déco).

### 55. Catégories alertes (icônes dans la liste résultats)
- **Fichier** : `script-mobile.js:4259-4278`
- **Justification** : permet de distinguer en un coup d'œil un permis expiré d'un CT proche dans une longue liste.
- **Reco** : garder (icônes inline justifiables car c'est *uniquement* l'icône, pas un emoji devant un texte qui se suffit à lui-même).

### 56. Carbu type icônes dans tableaux carbu
- **Fichier** : `script-charges.js:480` (`catIcons`)
- **Justification** : badges de catégorie = l'icône remplace le texte (gain de place dans tableau).
- **Reco** : garder. Cohérent avec la décision de retirer ces emojis des selects (finding 19).

### 57. Empty states avec icône centrale large (📦, 🔍, 👥)
- **Fichier** : multiples (`script-mobile.js:3422`, `3540`, `3566`, `3570`, `3856`, `3892`)
- **Justification** : pattern empty-state classique, icône grande centrale + titre + texte. Pas un emoji déco dans une phrase.
- **Reco** : garder.

---

## Synthèse priorités

| Priorité | Findings | Effort estimé |
|---|---|---|
| **TOP-5 (impact visuel max, gains immédiats)** | 6, 9, 27, 21, 17 | 30 min |
| **À ENLEVER restants (1-34)** | 29 findings | 2h-3h |
| **À REFORMULER (35-47)** | 13 findings | 1h-1h30 |
| **GARDER (48-57)** | 10 décisions | 0 (pas de modif) |

**Total effort si tout est appliqué : ~4-5h** (changements simples = remplacement de chaînes, aucune logique métier touchée).

**Régression fonctionnelle attendue : 0** (toutes les modifs sont cosmétiques, sur des labels/titres/sous-titres ; aucune classe CSS, aucun handler, aucune donnée).
