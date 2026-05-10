# 08 — Composants génériques (shells)

**Localisation :** `preview/components/_*.html`. Chaque shell est un fichier autonome ouvrable seul.

## Liste

| Shell | Pour quoi | Variantes |
|-------|-----------|-----------|
| `_kpi-card.html` | Toute KPI tile | `data-tone="neutral|green|orange|red|blue"`, `data-size="sm|md|lg"` |
| `_status-badge.html` | Statut livraison/véhicule/salarié | 5 variantes : cours / livré / attente / dispo / inactif |
| `_empty-state.html` | État vide générique | icon + title + sub + CTA optionnel ; variants : `compact`, `illustrated` |
| `_modal-shell.html` | Coque de toute modale | header (title + close) + body + footer (cancel + primary), tailles `sm/md/lg/xl/fullscreen` |
| `_drawer-shell.html` | Coque de tout drawer 360 | overlay + drawer slide-right + 4 onglets internes + close |
| `_table-responsive.html` | Tableau qui devient cards <768px | thead + tbody normal, fallback cards stackées via CSS |
| `_form-group.html` | Field form complet | label + input + helper + error (variantes input/textarea/select/checkbox/radio/toggle) |
| `_toast.html` | Notification toast | success / warning / error / info |
| `_skeleton.html` | Placeholder loading | rect / circle / text (line) / row table / kpi card |
| `_section-head.html` | Header de page (title + actions) | avec/sans breadcrumb, avec/sans description |

## Règles d'usage

1. Chaque shell est **HTML pur + CSS scoped via classe racine** — copie-collable directement dans une page sans dépendance externe (sauf `colors_and_type.css`).
2. Les **IDs sont des placeholders** (`id="ID_PRESERVE"`) — remplace par l'ID réel de `02-ids-data-attrs.md`.
3. Les **data-* sont également des placeholders** documentés en commentaire HTML.
4. **Ne pas modifier le shell directement** quand tu l'utilises dans une page — copie-le et adapte. Le shell reste la référence canonique.

## Ordre de création (pour moi)

1. `_kpi-card.html` (le plus utilisé)
2. `_status-badge.html`
3. `_empty-state.html`
4. `_modal-shell.html`
5. `_drawer-shell.html`
6. `_table-responsive.html`
7. `_form-group.html`
8. `_toast.html`
9. `_skeleton.html`
10. `_section-head.html`

→ Demande-moi de les générer un par un (ou en batch) quand tu en as besoin.
