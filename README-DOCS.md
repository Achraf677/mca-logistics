# Guide rapide des docs refonte

> Cartographie de tous les docs/outils pour ne pas se perdre.

## 📋 Docs MD (lecture)

| Fichier | Rôle | Quand consulter |
|---|---|---|
| `PLAN-REFONTE.md` | Vision + état pages + sprints | Début / fin de session |
| `BUGS-OPEN.md` | Tracker live (NEW/IN_PROGRESS/FIXED/VERIFIED) | À chaque commit |
| `AUDIT-METHODOLOGY.md` | Process 5 étapes avant "done" | Avant de déclarer une page finie |
| `SESSION-LOG.md` | Log chronologique des sessions | Reprise après pause |
| `CHECKLIST-PER-PAGE.md` | Definition of Done par page | Avant de fermer une page |
| `README-DOCS.md` | Ce fichier | Si perdu |

## 🛠 Outils (exécution)

| Script | Rôle |
|---|---|
| `tools/screenshot-local.mjs` | Screenshot dashboard locale |
| `tools/screenshot-livraisons.mjs` | Screenshot livraisons 3 vues + drawer |
| `tools/audit-livraisons-full.mjs` | Audit fonctionnel 20+ tests |
| `tools/audit-visual-diff.mjs` | Auto diff vs mockup toutes pages |
| `tools/inspect-modal.mjs <id>` | Open modale + inspect rendu |
| `tools/debug-titles.mjs` | Debug spécifique titres CSS |
| `tools/visual-diff.mjs` | Diff PNG via pixelmatch |
| `tools/compare-dashboard.html` | Side-by-side iframes pour comparaison humaine |

## 📁 Screenshots

| Dossier | Contenu |
|---|---|
| `screenshots/previews/` | Mockups de référence (immuable) |
| `screenshots/local/` | Renders du current state |
| `screenshots/audit-livraisons/` | Zooms livraisons |
| `screenshots/audit-livraisons-full/` | Audit complet |
| `screenshots/inspect-modal/` | Modales ouvertes capturées |
| `screenshots/audit-visual-diff/` | Pages full vs mockup |
| `screenshots/diff/` | PNG diff output |

## 🔄 Workflow type pour une page

1. **Lire** `PLAN-REFONTE.md` → état actuel page
2. **Lire** `BUGS-OPEN.md` → bugs liés à cette page
3. **Screenshot** : `node tools/screenshot-<page>.mjs`
4. **Diff** : `node tools/audit-visual-diff.mjs <page>` → % match
5. **Fix** bugs un par un avec inspect-modal si besoin
6. **Re-audit** : refaire screenshot + diff
7. **Update** `BUGS-OPEN.md` (FIXED) et `CHECKLIST-PER-PAGE.md`
8. **Commit** avec message clair
9. **Update** `SESSION-LOG.md` + `PLAN-REFONTE.md` à la fin de session

## ⚡ Commandes utiles

```bash
# Audit complet livraisons
node tools/audit-livraisons-full.mjs

# Inspect une modale
node tools/inspect-modal.mjs modal-livraison

# Diff visuel rapide d'une page
node tools/audit-visual-diff.mjs dashboard

# Bump cache + commit
git add -A && git commit -m "fix: ..." && git push

# Voir branche actuelle + dernier commit
git log --oneline -1
```
