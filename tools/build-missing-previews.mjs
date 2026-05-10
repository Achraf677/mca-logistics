// Generates the 13 missing admin previews following the design-handoff pattern.
// Each page = sidebar (10 items canonical) + topbar + crumb + section-head + content card(s).
// Run: node tools/build-missing-previews.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;font-feature-settings:"tnum"}
body::before{content:'';position:fixed;inset:0;background:var(--asphalt-stripes);pointer-events:none;z-index:0}
.app{display:grid;grid-template-columns:236px 1fr;min-height:100vh;position:relative;z-index:1}

.sidebar{background:var(--bg-elevated);border-right:1px solid var(--border);display:flex;flex-direction:column}
.sidebar .brand{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;position:relative}
.sidebar .brand::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,var(--brand) 0%,transparent 100%)}
.sidebar .brand-logo{width:48px;height:32px;flex-shrink:0}
.sidebar .brand-text{font-family:var(--font-display);font-weight:800;font-size:17px;letter-spacing:-0.02em;line-height:1}
.sidebar .brand-text .red{color:var(--brand);font-style:italic;font-weight:700;font-size:12px;display:block;margin-top:2px;letter-spacing:0.06em}
.nav{flex:1;padding:14px 10px;overflow-y:auto}
.nav-item{display:flex;align-items:center;gap:11px;padding:11px 14px;border-radius:8px;color:var(--text-muted);font-size:14px;cursor:pointer;font-weight:500;margin-bottom:2px;transition:all var(--t-fast) var(--ease-out);position:relative;text-decoration:none}
.nav-item:hover{background:var(--bg-card-hover);color:var(--text)}
.nav-item.active{background:var(--brand-soft);color:var(--brand)}
.nav-item.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:3px;background:var(--brand);border-radius:0 3px 3px 0}
.nav-item svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:0.85}
.sidebar-foot{padding:14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}
.sidebar-foot .av{width:34px;height:34px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 0 0 2px rgba(230,57,70,0.25)}
.sidebar-foot .who{font-size:13px;font-weight:600}
.sidebar-foot .role{font-size:11px;color:var(--text-muted)}

.main{display:flex;flex-direction:column;min-width:0;min-height:100vh}
.topbar{height:60px;background:var(--bg-elevated);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:relative}
.topbar::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,var(--brand) 0%,transparent 30%)}
.page-title{font-family:var(--font-display);font-size:20px;font-weight:800;letter-spacing:-0.02em}
.topbar-right{display:flex;align-items:center;gap:14px}
.search{background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 14px;color:var(--text);font-size:13px;width:240px;font-family:inherit}
.search:focus{outline:none;border-color:var(--brand)}
.icon-btn{width:36px;height:36px;border-radius:8px;background:transparent;border:1px solid var(--border);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--t-fast) var(--ease-out)}
.icon-btn:hover{background:var(--bg-card-hover);color:var(--text)}
.icon-btn svg{width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}

.content{padding:22px 26px;flex:1;overflow:auto;max-width:1280px;width:100%;margin:0 auto}
.crumbs{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);margin-bottom:14px}
.crumbs a{color:var(--text-muted);text-decoration:none;transition:color var(--t-fast) var(--ease-out)}
.crumbs a:hover{color:var(--brand)}

.section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:nowrap;gap:14px}
.section-head h2{font-family:var(--font-display);font-size:20px;font-weight:800;letter-spacing:-0.01em;white-space:nowrap}
.section-head .sub{color:var(--text-muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.btn{padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:inherit;min-height:38px;letter-spacing:0.02em;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:all var(--t-fast) var(--ease-out)}
.btn svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.btn-primary{background:var(--brand);color:#fff;box-shadow:var(--shadow-brand)}
.btn-primary:hover{background:var(--brand-hover);transform:translateY(-1px)}
.btn-secondary{background:rgba(255,255,255,0.06);color:var(--text);border:1px solid var(--border-strong)}
.btn-secondary:hover{background:var(--bg-card-hover)}
.btn-chip{background:rgba(255,255,255,0.06);color:var(--text);border:1px solid var(--border-strong);padding:8px 14px;min-height:34px;font-size:12px}
.btn-chip:hover{background:var(--bg-card-hover)}
.btn-chip.active{background:var(--brand-soft);color:var(--brand);border-color:rgba(230,57,70,0.4)}

.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;position:relative;overflow:hidden;transition:border-color var(--t-fast) var(--ease-out)}
.kpi:hover{border-color:var(--border-strong)}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--brand),transparent)}
.kpi-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px}
.kpi-val{font-size:28px;font-weight:800;letter-spacing:-.03em;line-height:1}
.kpi-sub{font-size:11px;color:var(--text-muted);margin-top:6px}
.kpi-sub .up{color:#9bb1a4;font-weight:700}
.kpi-sub .down{color:var(--brand);font-weight:700}

.chips-toolbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:14px}
.card-header{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.card-header h3{font-family:var(--font-display);font-size:15px;font-weight:800;letter-spacing:-0.01em}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:11px 18px;color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.15);white-space:nowrap}
td{padding:13px 18px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle;white-space:nowrap}
tr:last-child td{border-bottom:none}
tr.row-hover:hover td{background:var(--bg-card-hover);cursor:pointer}
.mono{font-family:var(--font-mono);font-size:12px;color:var(--text-muted)}
.amount{font-weight:700;text-align:right;font-feature-settings:"tnum"}

.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:rgba(255,255,255,0.04);border:1px solid var(--border-strong);color:var(--text-muted);white-space:nowrap}
.badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.badge.ok{color:#9bb1a4}
.badge.warn{color:#d4b67a}
.badge.alert{color:var(--brand);border-color:rgba(230,57,70,0.4);background:rgba(230,57,70,0.08)}

@media (max-width:960px){.kpi-grid{grid-template-columns:repeat(2,1fr)}.search{width:160px}}
@media (max-width:880px){.app{grid-template-columns:1fr}.sidebar{display:none}}`;

const SIDEBAR_ITEMS = [
  ['dashboard.html', 'Dashboard', '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'],
  ['livraisons.html', 'Livraisons', '<path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'],
  ['charges.html', 'Charges', '<path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9"/><path d="M3 10h18"/><path d="M16 19h6"/>'],
  ['rentabilite.html', 'Rentabilité', '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'],
  ['vehicules.html', 'Véhicules', '<path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>'],
  ['equipe.html', 'Équipe', '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/>'],
  ['planning.html', 'Planning', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'],
  ['carburant.html', 'Carburant', '<path d="M12 2v6"/><path d="M9 12h6"/><circle cx="12" cy="14" r="8"/>'],
  ['entretiens.html', 'Entretiens', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>'],
  ['alertes.html', 'Alertes', '<path d="m21.7 18-9-15.4a2 2 0 0 0-3.4 0L.3 18A2 2 0 0 0 2 21h18a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'],
];

const LOGO_SVG = `<svg class="brand-logo" viewBox="0 0 88 60">
        <rect x="0" y="14" width="14" height="3" fill="#e63946"/>
        <rect x="2" y="22" width="12" height="3" fill="#e63946"/>
        <rect x="4" y="30" width="10" height="3" fill="#e63946"/>
        <rect x="2" y="38" width="12" height="3" fill="#e63946"/>
        <rect x="18" y="14" width="60" height="28" rx="4" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1"/>
        <rect x="22" y="18" width="14" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>
        <rect x="38" y="18" width="36" height="10" rx="1" fill="#2a2f37" stroke="#f1f3f5" stroke-width="0.8"/>
        <circle cx="30" cy="44" r="5" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>
        <circle cx="66" cy="44" r="5" fill="#1a1d22" stroke="#f1f3f5" stroke-width="1.2"/>
      </svg>`;

function buildSidebar(currentFile) {
  const navHtml = SIDEBAR_ITEMS.map(([href, label, svg]) => {
    const active = href === currentFile ? ' active' : '';
    return `      <a class="nav-item${active}" href="${href}"><svg viewBox="0 0 24 24">${svg}</svg> ${label}</a>`;
  }).join('\n');

  return `  <aside class="sidebar">
    <div class="brand">
      ${LOGO_SVG}
      <div class="brand-text">MCA<span class="red">LOGISTICS</span></div>
    </div>
    <nav class="nav">
${navHtml}
    </nav>
    <div class="sidebar-foot">
      <div class="av">AC</div>
      <div>
        <div class="who">Achraf Chikri</div>
        <div class="role">Admin</div>
      </div>
    </div>
  </aside>`;
}

function buildPage({ slug, title, subMeta, primaryBtn, content, extraCss = '', extraJs = '' }) {
  const sidebar = buildSidebar(''); // No active highlight (this page is not in sidebar)
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>MCA Logistics — ${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="tokens.css">
<style>
${SHARED_CSS}
${extraCss}
</style>
</head>
<body>
<div class="app">
${sidebar}

  <main class="main">
    <header class="topbar">
      <div style="display:flex;align-items:baseline;gap:14px">
        <div class="page-title">${title}</div>
        <div style="font-size:12px;color:var(--text-muted)">${subMeta}</div>
      </div>
      <div class="topbar-right">
        <input class="search" type="search" placeholder="Rechercher…">
        <button class="icon-btn" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></button>
        <div class="sidebar-foot" style="border:none;padding:0"><div class="av">AC</div></div>
      </div>
    </header>

    <section class="content">
      <nav class="crumbs">
        <a href="dashboard.html">← Retour au tableau de bord</a>
      </nav>

${content}
    </section>
  </main>
</div>
${extraJs ? `<script>\n${extraJs}\n</script>` : ''}
</body>
</html>
`;
}

// =================== PAGE CONTENTS ===================

const PAGES = {

  'clients.html': {
    title: 'Clients',
    subMeta: 'Carnet clients · 47 enregistrés',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px;min-width:0">
          <h2>Carnet clients</h2>
          <div class="sub">47 clients · 22 actifs sur 90j · CA cumulé 184 320 €</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📚 Historique</button>
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Nouveau client</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Clients actifs</div><div class="kpi-val">22</div><div class="kpi-sub"><span class="up">+3</span> ce mois</div></div>
        <div class="kpi"><div class="kpi-lbl">Top client</div><div class="kpi-val">Auchan</div><div class="kpi-sub">42 380 € sur 12m</div></div>
        <div class="kpi"><div class="kpi-lbl">Délai paiement moyen</div><div class="kpi-val">28 j</div><div class="kpi-sub">DSO global</div></div>
        <div class="kpi"><div class="kpi-lbl">Encours total</div><div class="kpi-val">12 480 €</div><div class="kpi-sub">6 factures impayées</div></div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
        <input class="search" type="search" placeholder="Rechercher nom, ville, SIREN…" style="width:340px">
        <button class="btn btn-chip active">Tous</button>
        <button class="btn btn-chip">Actifs 90j</button>
        <button class="btn btn-chip">Risque</button>
        <button class="btn btn-chip">Inactifs</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Nom</th><th>Ville</th><th>SIREN</th><th>Téléphone</th><th>CA 12m</th><th>Encours</th><th>Statut</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td>Auchan Nord</td><td>Lille</td><td class="mono">404 502 198</td><td class="mono">03 20 42 11 00</td><td class="amount">42 380 €</td><td class="amount">2 840 €</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td>Decathlon Production</td><td>Villeneuve-d'Ascq</td><td class="mono">307 444 002</td><td class="mono">03 20 16 40 00</td><td class="amount">28 920 €</td><td class="amount">1 250 €</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td>Boulanger SAS</td><td>Lesquin</td><td class="mono">429 833 175</td><td class="mono">03 20 16 34 11</td><td class="amount">18 640 €</td><td class="amount">3 120 €</td><td><span class="badge warn">À relancer</span></td></tr>
            <tr class="row-hover"><td>Carrefour HM</td><td>Roubaix</td><td class="mono">652 014 051</td><td class="mono">03 28 02 18 80</td><td class="amount">14 280 €</td><td class="amount">—</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td>Leroy Merlin</td><td>Lens</td><td class="mono">384 560 942</td><td class="mono">03 21 73 70 00</td><td class="amount">11 540 €</td><td class="amount">980 €</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td>Système U</td><td>Hénin-Beaumont</td><td class="mono">395 268 711</td><td class="mono">03 21 76 50 00</td><td class="amount">9 720 €</td><td class="amount">—</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td>Brico Dépôt</td><td>Cambrai</td><td class="mono">451 720 089</td><td class="mono">03 27 72 56 00</td><td class="amount">4 280 €</td><td class="amount">1 480 €</td><td><span class="badge alert">Retard 45j</span></td></tr>
          </tbody>
        </table>
      </div>`
  },

  'fournisseurs.html': {
    title: 'Fournisseurs',
    subMeta: 'Carnet fournisseurs · 18 enregistrés',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px;min-width:0">
          <h2>Carnet fournisseurs</h2>
          <div class="sub">18 fournisseurs · 12 actifs sur 90j · Dépenses cumulées 67 240 €</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📚 Historique</button>
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Nouveau fournisseur</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Fournisseurs actifs</div><div class="kpi-val">12</div><div class="kpi-sub">90 derniers jours</div></div>
        <div class="kpi"><div class="kpi-lbl">Top dépense</div><div class="kpi-val">Total Énergies</div><div class="kpi-sub">18 740 € sur 12m</div></div>
        <div class="kpi"><div class="kpi-lbl">Charges à régler</div><div class="kpi-val">4 280 €</div><div class="kpi-sub">8 factures en attente</div></div>
        <div class="kpi"><div class="kpi-lbl">Cat. dominante</div><div class="kpi-val">Carburant</div><div class="kpi-sub">42% des dépenses</div></div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
        <input class="search" type="search" placeholder="Rechercher fournisseur, ville…" style="width:340px">
        <button class="btn btn-chip active">Tous</button>
        <button class="btn btn-chip">Carburant</button>
        <button class="btn btn-chip">Garage</button>
        <button class="btn btn-chip">Assurance</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Nom</th><th>Catégorie</th><th>Ville</th><th>Téléphone</th><th>Dépenses 12m</th><th>À régler</th><th>Dernière facture</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td>Total Énergies</td><td><span class="badge warn">Carburant</span></td><td>Lille</td><td class="mono">09 70 80 89 65</td><td class="amount">18 740 €</td><td class="amount">—</td><td>09/05</td></tr>
            <tr class="row-hover"><td>Esso Express</td><td><span class="badge warn">Carburant</span></td><td>Lens</td><td class="mono">03 21 14 22 00</td><td class="amount">9 280 €</td><td class="amount">340 €</td><td>07/05</td></tr>
            <tr class="row-hover"><td>Garage Lefèvre</td><td><span class="badge ok">Entretien</span></td><td>Roubaix</td><td class="mono">03 20 42 15 80</td><td class="amount">6 720 €</td><td class="amount">1 240 €</td><td>11/05</td></tr>
            <tr class="row-hover"><td>AXA Pro</td><td><span class="badge">Assurance</span></td><td>Lille</td><td class="mono">03 20 14 50 50</td><td class="amount">19 200 €</td><td class="amount">1 600 €</td><td>01/05</td></tr>
            <tr class="row-hover"><td>SANEF</td><td><span class="badge">Péages</span></td><td>Senlis</td><td class="mono">03 44 09 30 00</td><td class="amount">5 480 €</td><td class="amount">—</td><td>10/05</td></tr>
            <tr class="row-hover"><td>Norauto Pneus</td><td><span class="badge ok">Entretien</span></td><td>Villeneuve</td><td class="mono">03 20 04 99 99</td><td class="amount">3 920 €</td><td class="amount">1 100 €</td><td>07/05</td></tr>
          </tbody>
        </table>
      </div>`
  },

  'calendrier.html': {
    title: 'Calendrier',
    subMeta: 'Vue opérationnelle · Mai 2026',
    extraCss: `.cal-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px}
.cal-toolbar .nav-controls{display:flex;align-items:center;gap:8px}
.cal-toolbar .month-label{font-family:var(--font-display);font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:capitalize}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.cal-day-header{background:var(--bg-elevated);padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);text-align:center}
.cal-cell{background:var(--bg-card);min-height:96px;padding:8px 10px;font-size:12px;display:flex;flex-direction:column;gap:4px;transition:background var(--t-fast) var(--ease-out)}
.cal-cell:hover{background:var(--bg-card-hover);cursor:pointer}
.cal-cell.muted{background:var(--bg-elevated);color:var(--text-disabled)}
.cal-cell.today{box-shadow:inset 0 0 0 2px var(--brand)}
.cal-date{font-weight:700;font-size:13px;color:var(--text)}
.cal-cell.muted .cal-date{color:var(--text-disabled)}
.cal-event{display:inline-flex;align-items:center;gap:5px;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;background:var(--brand-soft);color:var(--brand)}
.cal-event.green{background:rgba(6,214,160,0.16);color:var(--success)}
.cal-event.yellow{background:rgba(255,214,10,0.16);color:var(--warning)}`,
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Calendrier opérationnel</h2>
          <div class="sub">142 livraisons · 8 échéances · 3 jours fériés ce mois</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">Aujourd'hui</button>
          <button class="btn btn-secondary">📄 Imprimer</button>
        </div>
      </div>

      <div class="cal-toolbar">
        <div class="nav-controls">
          <button class="btn btn-secondary" style="min-height:34px;padding:6px 12px">←</button>
          <div class="month-label">mai 2026</div>
          <button class="btn btn-secondary" style="min-height:34px;padding:6px 12px">→</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-chip active">Mois</button>
          <button class="btn btn-chip">Semaine</button>
          <button class="btn btn-chip">Jour</button>
        </div>
      </div>

      <div class="cal-grid">
        <div class="cal-day-header">Lun</div><div class="cal-day-header">Mar</div><div class="cal-day-header">Mer</div>
        <div class="cal-day-header">Jeu</div><div class="cal-day-header">Ven</div><div class="cal-day-header">Sam</div><div class="cal-day-header">Dim</div>

        <div class="cal-cell muted"><div class="cal-date">28</div></div>
        <div class="cal-cell muted"><div class="cal-date">29</div></div>
        <div class="cal-cell muted"><div class="cal-date">30</div></div>
        <div class="cal-cell"><div class="cal-date">1</div><span class="cal-event green">Fête travail</span></div>
        <div class="cal-cell"><div class="cal-date">2</div><span class="cal-event">6 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">3</div></div>
        <div class="cal-cell"><div class="cal-date">4</div></div>

        <div class="cal-cell"><div class="cal-date">5</div><span class="cal-event">8 livr.</span><span class="cal-event yellow">CT veh.</span></div>
        <div class="cal-cell"><div class="cal-date">6</div><span class="cal-event">7 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">7</div><span class="cal-event">9 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">8</div><span class="cal-event">5 livr.</span><span class="cal-event green">Victoire</span></div>
        <div class="cal-cell"><div class="cal-date">9</div><span class="cal-event">11 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">10</div></div>
        <div class="cal-cell today"><div class="cal-date">11</div><span class="cal-event">Aujourd'hui</span></div>

        <div class="cal-cell"><div class="cal-date">12</div><span class="cal-event">8 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">13</div><span class="cal-event yellow">CT Sprinter 316</span></div>
        <div class="cal-cell"><div class="cal-date">14</div><span class="cal-event">7 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">15</div><span class="cal-event">9 livr.</span><span class="cal-event yellow">TVA déclar.</span></div>
        <div class="cal-cell"><div class="cal-date">16</div><span class="cal-event">6 livr.</span></div>
        <div class="cal-cell"><div class="cal-date">17</div></div>
        <div class="cal-cell"><div class="cal-date">18</div></div>

        <div class="cal-cell"><div class="cal-date">19</div></div>
        <div class="cal-cell"><div class="cal-date">20</div></div>
        <div class="cal-cell"><div class="cal-date">21</div></div>
        <div class="cal-cell"><div class="cal-date">22</div></div>
        <div class="cal-cell"><div class="cal-date">23</div></div>
        <div class="cal-cell"><div class="cal-date">24</div></div>
        <div class="cal-cell"><div class="cal-date">25</div></div>

        <div class="cal-cell"><div class="cal-date">26</div></div>
        <div class="cal-cell"><div class="cal-date">27</div></div>
        <div class="cal-cell"><div class="cal-date">28</div></div>
        <div class="cal-cell"><div class="cal-date">29</div><span class="cal-event green">Ascension</span></div>
        <div class="cal-cell"><div class="cal-date">30</div></div>
        <div class="cal-cell"><div class="cal-date">31</div></div>
        <div class="cal-cell muted"><div class="cal-date">1</div></div>
      </div>`
  },

  'statistiques.html': {
    title: 'Statistiques',
    subMeta: 'Performance et tendances · Mai 2026',
    extraCss: `.chart-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:14px}
.chart-card h3{font-family:var(--font-display);font-size:15px;font-weight:800;margin-bottom:14px}
.fake-bar{height:6px;background:var(--brand-soft);border-radius:3px;position:relative;overflow:hidden}
.fake-bar::after{content:'';position:absolute;inset:0;background:var(--brand);width:var(--w,50%);border-radius:3px}
.stat-row{display:grid;grid-template-columns:140px 1fr 80px;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)}
.stat-row:last-child{border:none}
.stat-row .lbl{font-size:13px;color:var(--text-muted)}
.stat-row .val{font-weight:700;text-align:right;font-feature-settings:"tnum"}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:880px){.chart-row{grid-template-columns:1fr}}`,
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Statistiques</h2>
          <div class="sub">Mai 2026 · 142 livraisons · CA 38 420 €</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-chip active">Mois</button>
          <button class="btn btn-chip">Trimestre</button>
          <button class="btn btn-chip">Année</button>
          <button class="btn btn-secondary">📄 Rapport</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">CA HT période</div><div class="kpi-val">38 420 €</div><div class="kpi-sub"><span class="up">+8%</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">Livraisons</div><div class="kpi-val">142</div><div class="kpi-sub"><span class="up">+12%</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">Panier moyen HT</div><div class="kpi-val">271 €</div><div class="kpi-sub"><span class="down">-3%</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">Km total</div><div class="kpi-val">8 640 km</div><div class="kpi-sub"><span class="up">+15%</span> vs avril</div></div>
      </div>

      <div class="chart-row">
        <div class="chart-card">
          <h3>Évolution CA — 6 derniers mois</h3>
          <div style="height:200px;background:linear-gradient(to top,var(--brand-soft) 0%,transparent 100%);border-radius:8px;display:flex;align-items:flex-end;gap:8px;padding:12px;position:relative">
            <div style="flex:1;background:var(--brand);border-radius:4px 4px 0 0;height:48%"></div>
            <div style="flex:1;background:var(--brand);border-radius:4px 4px 0 0;height:62%"></div>
            <div style="flex:1;background:var(--brand);border-radius:4px 4px 0 0;height:54%"></div>
            <div style="flex:1;background:var(--brand);border-radius:4px 4px 0 0;height:70%"></div>
            <div style="flex:1;background:var(--brand);border-radius:4px 4px 0 0;height:78%"></div>
            <div style="flex:1;background:var(--brand-hover);border-radius:4px 4px 0 0;height:88%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:11px;margin-top:8px"><span>Déc</span><span>Janv</span><span>Févr</span><span>Mars</span><span>Avril</span><span>Mai</span></div>
        </div>

        <div class="chart-card">
          <h3>Top chauffeurs (CA généré)</h3>
          <div class="stat-row"><div class="lbl">Karim B.</div><div class="fake-bar" style="--w:92%"></div><div class="val">14 280 €</div></div>
          <div class="stat-row"><div class="lbl">Youssef E.</div><div class="fake-bar" style="--w:74%"></div><div class="val">11 540 €</div></div>
          <div class="stat-row"><div class="lbl">Saïd B.</div><div class="fake-bar" style="--w:58%"></div><div class="val">9 120 €</div></div>
          <div class="stat-row"><div class="lbl">Mehdi A.</div><div class="fake-bar" style="--w:24%"></div><div class="val">3 480 €</div></div>
        </div>
      </div>

      <div class="chart-card">
        <h3>Utilisation véhicules — km parcourus</h3>
        <div class="stat-row"><div class="lbl">Sprinter 314</div><div class="fake-bar" style="--w:88%"></div><div class="val">3 280 km</div></div>
        <div class="stat-row"><div class="lbl">Sprinter 316</div><div class="fake-bar" style="--w:64%"></div><div class="val">2 410 km</div></div>
        <div class="stat-row"><div class="lbl">Master 130</div><div class="fake-bar" style="--w:80%"></div><div class="val">2 950 km</div></div>
      </div>`
  },

  'encaissement.html': {
    title: 'Encaissement',
    subMeta: 'Suivi paiements · 12 480 € impayés',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Encaissement</h2>
          <div class="sub">6 factures impayées · DSO 28j · 4 relances à envoyer</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📤 Envoyer relances</button>
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Enregistrer paiement</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Encaissé ce mois</div><div class="kpi-val">28 420 €</div><div class="kpi-sub"><span class="up">+12%</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">Impayés</div><div class="kpi-val">12 480 €</div><div class="kpi-sub"><span class="down">+1 facture</span></div></div>
        <div class="kpi"><div class="kpi-lbl">DSO</div><div class="kpi-val">28 j</div><div class="kpi-sub">Délai paiement moyen</div></div>
        <div class="kpi"><div class="kpi-lbl">Relances en attente</div><div class="kpi-val">4</div><div class="kpi-sub">À envoyer cette semaine</div></div>
      </div>

      <div class="chips-toolbar">
        <button class="btn btn-chip active">À encaisser (6)</button>
        <button class="btn btn-chip">En retard (3)</button>
        <button class="btn btn-chip">Relances (4)</button>
        <button class="btn btn-chip">Encaissés mois</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>N° facture</th><th>Client</th><th>Émission</th><th>Échéance</th><th>Statut</th><th>Relances</th><th style="text-align:right">Montant TTC</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td class="mono">F-2026-0142</td><td>Auchan Nord</td><td>09/04</td><td>09/05</td><td><span class="badge ok">À échéance</span></td><td>—</td><td class="amount">2 840 €</td></tr>
            <tr class="row-hover"><td class="mono">F-2026-0140</td><td>Boulanger SAS</td><td>27/03</td><td>26/04</td><td><span class="badge warn">Retard 15j</span></td><td>1 (5j)</td><td class="amount">3 120 €</td></tr>
            <tr class="row-hover"><td class="mono">F-2026-0138</td><td>Brico Dépôt</td><td>25/03</td><td>24/04</td><td><span class="badge alert">Retard 17j</span></td><td>2 (15j, 3j)</td><td class="amount">1 480 €</td></tr>
            <tr class="row-hover"><td class="mono">F-2026-0135</td><td>Leroy Merlin</td><td>20/04</td><td>20/05</td><td><span class="badge ok">À échéance</span></td><td>—</td><td class="amount">980 €</td></tr>
            <tr class="row-hover"><td class="mono">F-2026-0132</td><td>Decathlon</td><td>15/04</td><td>15/05</td><td><span class="badge ok">À échéance</span></td><td>—</td><td class="amount">1 250 €</td></tr>
            <tr class="row-hover"><td class="mono">F-2026-0128</td><td>Brico Dépôt</td><td>05/03</td><td>04/04</td><td><span class="badge alert">Retard 37j</span></td><td>3 (35j, 25j, 10j)</td><td class="amount">2 810 €</td></tr>
          </tbody>
        </table>
      </div>`
  },

  'tva.html': {
    title: 'TVA',
    subMeta: 'Déclaration mensuelle · Mai 2026',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Déclaration TVA</h2>
          <div class="sub">Avril 2026 · à déclarer avant le 15/05 · Pennylane sync OK</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-chip active">Mensuel</button>
          <button class="btn btn-chip">Trimestriel</button>
          <button class="btn btn-secondary">📤 Export CA3</button>
          <button class="btn btn-secondary">📄 Rapport</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">TVA collectée (sortie)</div><div class="kpi-val">7 684 €</div><div class="kpi-sub">CA HT 38 420 €</div></div>
        <div class="kpi"><div class="kpi-lbl">TVA déductible (entrée)</div><div class="kpi-val">3 248 €</div><div class="kpi-sub">Charges HT 16 240 €</div></div>
        <div class="kpi"><div class="kpi-lbl">TVA à payer</div><div class="kpi-val" style="color:var(--brand)">4 436 €</div><div class="kpi-sub">Solde net mensuel</div></div>
        <div class="kpi"><div class="kpi-lbl">Échéance</div><div class="kpi-val">15/05</div><div class="kpi-sub">4 jours restants</div></div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Détail TVA collectée — par taux</h3><span class="badge ok">Pennylane sync 11/05</span></div>
        <table>
          <thead><tr><th>Taux</th><th>Base HT</th><th>TVA</th><th>Nb factures</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td><strong>20%</strong> (transport standard)</td><td class="amount">36 840 €</td><td class="amount">7 368 €</td><td>128</td></tr>
            <tr class="row-hover"><td><strong>10%</strong> (sous-traitance)</td><td class="amount">1 580 €</td><td class="amount">158 €</td><td>9</td></tr>
            <tr class="row-hover"><td><strong>5,5%</strong> (livre/alimentaire)</td><td class="amount">2 880 €</td><td class="amount">158 €</td><td>5</td></tr>
            <tr class="row-hover"><td><strong>0%</strong> (export UE)</td><td class="amount">—</td><td class="amount">—</td><td>0</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header"><h3>Détail TVA déductible — par catégorie de charge</h3></div>
        <table>
          <thead><tr><th>Catégorie</th><th>Base HT</th><th>TVA déduc.</th><th>Nb factures</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td><span class="badge warn">Carburant</span></td><td class="amount">8 480 €</td><td class="amount">1 696 €</td><td>4</td></tr>
            <tr class="row-hover"><td><span class="badge ok">Entretien</span></td><td class="amount">4 720 €</td><td class="amount">944 €</td><td>3</td></tr>
            <tr class="row-hover"><td><span class="badge">Péages</span></td><td class="amount">3 040 €</td><td class="amount">608 €</td><td>12</td></tr>
            <tr class="row-hover"><td><span class="badge">Autres</span></td><td class="amount">—</td><td class="amount">—</td><td>0</td></tr>
          </tbody>
        </table>
      </div>`
  },

  'parametres.html': {
    title: 'Paramètres',
    subMeta: 'Configuration entreprise · 4 sections',
    extraCss: `.params-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:880px){.params-grid{grid-template-columns:1fr}}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:var(--text-muted);margin-bottom:6px}
.field input,.field select{width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;font-family:inherit}
.field input:focus,.field select:focus{outline:none;border-color:var(--brand)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)}
.toggle-row:last-child{border:none}
.toggle-row .info{flex:1}
.toggle-row .info .name{font-size:13px;font-weight:600;margin-bottom:2px}
.toggle-row .info .desc{font-size:11px;color:var(--text-muted)}
.toggle{width:36px;height:20px;background:var(--bg-card-hover);border-radius:999px;position:relative;cursor:pointer;flex-shrink:0;border:1px solid var(--border-strong);transition:all var(--t-fast) var(--ease-out)}
.toggle::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--text-muted);transition:all var(--t-fast) var(--ease-out)}
.toggle.on{background:var(--brand-soft);border-color:var(--brand)}
.toggle.on::after{left:18px;background:var(--brand)}`,
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Paramètres</h2>
          <div class="sub">Configuration entreprise &amp; préférences</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">Annuler</button>
          <button class="btn btn-primary">Enregistrer</button>
        </div>
      </div>

      <div class="params-grid">
        <div class="card" style="margin:0">
          <div class="card-header"><h3>🏢 Informations entreprise</h3></div>
          <div style="padding:18px 20px">
            <div class="field"><label>Dénomination sociale *</label><input type="text" value="MCA LOGISTICS"></div>
            <div class="field"><label>Forme juridique</label><select><option>SAS</option><option>SASU</option><option>SARL</option></select></div>
            <div class="field"><label>SIRET</label><input type="text" value="92458301700015" class="mono"></div>
            <div class="field"><label>N° TVA intracom</label><input type="text" value="FR12 924583017" class="mono"></div>
            <div class="field"><label>Code APE</label><input type="text" value="4941A"></div>
          </div>
        </div>

        <div class="card" style="margin:0">
          <div class="card-header"><h3>📍 Siège social</h3></div>
          <div style="padding:18px 20px">
            <div class="field"><label>Adresse</label><input type="text" value="17 rue de la Chapelle"></div>
            <div class="field"><label>Code postal · Ville</label><input type="text" value="67540 Ostwald"></div>
            <div class="field"><label>Téléphone</label><input type="text" value="07 88 21 30 56"></div>
            <div class="field"><label>Email</label><input type="text" value="contact@mca-logistics.fr"></div>
          </div>
        </div>

        <div class="card" style="margin:0">
          <div class="card-header"><h3>💼 Comptable</h3></div>
          <div style="padding:18px 20px">
            <div class="field"><label>Nom cabinet</label><input type="text" value="EXCO Eurasud"></div>
            <div class="field"><label>Email export</label><input type="text" value="compta@exco-eurasud.fr"></div>
            <div class="field"><label>Plateforme</label><select><option>Pennylane</option><option>Sage</option><option>Cegid</option></select></div>
            <div class="toggle-row">
              <div class="info"><div class="name">Export FEC mensuel auto</div><div class="desc">Envoie le FEC le 1er de chaque mois</div></div>
              <div class="toggle on"></div>
            </div>
          </div>
        </div>

        <div class="card" style="margin:0">
          <div class="card-header"><h3>🔔 Notifications</h3></div>
          <div style="padding:18px 20px">
            <div class="toggle-row">
              <div class="info"><div class="name">Alertes CT véhicule</div><div class="desc">À 30j et 7j avant échéance</div></div>
              <div class="toggle on"></div>
            </div>
            <div class="toggle-row">
              <div class="info"><div class="name">Alertes permis chauffeur</div><div class="desc">À 60j et 30j avant échéance</div></div>
              <div class="toggle on"></div>
            </div>
            <div class="toggle-row">
              <div class="info"><div class="name">Anomalies carburant</div><div class="desc">Conso +15% vs moyenne 30j</div></div>
              <div class="toggle on"></div>
            </div>
            <div class="toggle-row">
              <div class="info"><div class="name">Brief IA quotidien</div><div class="desc">À l'ouverture du dashboard</div></div>
              <div class="toggle"></div>
            </div>
          </div>
        </div>
      </div>`
  },

  'salaries.html': {
    title: 'Salariés',
    subMeta: 'Liste salariés · 6 actifs',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Salariés</h2>
          <div class="sub">6 actifs · 4 chauffeurs · 2 admins</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📚 Historique</button>
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Nouveau salarié</button>
        </div>
      </div>

      <div class="chips-toolbar">
        <button class="btn btn-chip active">Tous (6)</button>
        <button class="btn btn-chip">Chauffeurs (4)</button>
        <button class="btn btn-chip">Admins (2)</button>
        <button class="btn btn-chip">Anciens</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Nom</th><th>Poste</th><th>Téléphone</th><th>Permis expir.</th><th>Visite méd.</th><th>Statut</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td><strong>Karim B.</strong></td><td>Chauffeur PL</td><td class="mono">06 12 45 78 90</td><td>14/08/2027</td><td>10/03/2027</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td><strong>Youssef E.</strong></td><td>Chauffeur VL</td><td class="mono">06 34 56 12 80</td><td>22/11/2026</td><td>15/06/2026</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td><strong>Saïd B.</strong></td><td>Chauffeur PL</td><td class="mono">06 78 90 12 34</td><td><span style="color:var(--brand)">02/06/2026 (22j)</span></td><td>20/08/2026</td><td><span class="badge warn">Permis à renouveler</span></td></tr>
            <tr class="row-hover"><td><strong>Mehdi A.</strong></td><td>Chauffeur VL</td><td class="mono">06 90 12 34 56</td><td>05/04/2028</td><td>12/09/2026</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td><strong>Achraf C.</strong></td><td>Admin / Dirigeant</td><td class="mono">07 88 21 30 56</td><td>—</td><td>—</td><td><span class="badge ok">Actif</span></td></tr>
            <tr class="row-hover"><td><strong>Ali T.</strong></td><td>Admin</td><td class="mono">06 45 22 11 89</td><td>—</td><td>—</td><td><span class="badge ok">Actif</span></td></tr>
          </tbody>
        </table>
      </div>`
  },

  'heures.html': {
    title: 'Heures & Km',
    subMeta: 'Temps de travail · Mai 2026',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Heures travaillées &amp; kilométrage</h2>
          <div class="sub">Mai 2026 · 4 chauffeurs · 152 jours pointés</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📤 Export paie</button>
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Pointer</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Heures totales</div><div class="kpi-val">624 h</div><div class="kpi-sub"><span class="up">+18h</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">Heures sup.</div><div class="kpi-val">48 h</div><div class="kpi-sub">25% + 50% inclus</div></div>
        <div class="kpi"><div class="kpi-lbl">Km parcourus</div><div class="kpi-val">8 640 km</div><div class="kpi-sub">Sur 4 véhicules</div></div>
        <div class="kpi"><div class="kpi-lbl">CE 561 alertes</div><div class="kpi-val">2</div><div class="kpi-sub" style="color:var(--brand)">Saïd B. (×2)</div></div>
      </div>

      <div class="chips-toolbar">
        <button class="btn btn-chip active">Tous</button>
        <button class="btn btn-chip">Karim B.</button>
        <button class="btn btn-chip">Youssef E.</button>
        <button class="btn btn-chip">Saïd B.</button>
        <button class="btn btn-chip">Mehdi A.</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Date</th><th>Chauffeur</th><th>Début</th><th>Fin</th><th>Pause</th><th>Total</th><th>Km</th><th>Statut CE 561</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td class="mono">09/05</td><td>Karim B.</td><td class="mono">06:30</td><td class="mono">17:45</td><td class="mono">00:45</td><td class="amount">10h30</td><td class="amount">280 km</td><td><span class="badge ok">OK</span></td></tr>
            <tr class="row-hover"><td class="mono">09/05</td><td>Youssef E.</td><td class="mono">07:00</td><td class="mono">15:30</td><td class="mono">00:30</td><td class="amount">8h00</td><td class="amount">180 km</td><td><span class="badge ok">OK</span></td></tr>
            <tr class="row-hover"><td class="mono">09/05</td><td>Saïd B.</td><td class="mono">05:15</td><td class="mono">18:30</td><td class="mono">00:45</td><td class="amount">12h30</td><td class="amount">340 km</td><td><span class="badge alert">CE 561 +30min</span></td></tr>
            <tr class="row-hover"><td class="mono">08/05</td><td>Karim B.</td><td class="mono">06:45</td><td class="mono">16:15</td><td class="mono">00:30</td><td class="amount">9h00</td><td class="amount">240 km</td><td><span class="badge ok">OK</span></td></tr>
            <tr class="row-hover"><td class="mono">08/05</td><td>Mehdi A.</td><td class="mono">08:00</td><td class="mono">17:00</td><td class="mono">01:00</td><td class="amount">8h00</td><td class="amount">160 km</td><td><span class="badge ok">OK</span></td></tr>
          </tbody>
        </table>
      </div>`
  },

  'incidents.html': {
    title: 'Incidents',
    subMeta: 'Suivi accidents et avaries · 3 ouverts',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Incidents</h2>
          <div class="sub">3 ouverts · 12 résolus ce mois · 1 en attente expertise</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Déclarer incident</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Ouverts</div><div class="kpi-val" style="color:var(--brand)">3</div><div class="kpi-sub">Action requise</div></div>
        <div class="kpi"><div class="kpi-lbl">Résolus mois</div><div class="kpi-val">12</div><div class="kpi-sub"><span class="up">+3</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">Coût total</div><div class="kpi-val">2 840 €</div><div class="kpi-sub">À facturer assurance</div></div>
        <div class="kpi"><div class="kpi-lbl">Délai résolution</div><div class="kpi-val">4,2 j</div><div class="kpi-sub">Moyenne sur 30j</div></div>
      </div>

      <div class="chips-toolbar">
        <button class="btn btn-chip active">Tous</button>
        <button class="btn btn-chip">Ouverts (3)</button>
        <button class="btn btn-chip">Accidents</button>
        <button class="btn btn-chip">Avaries</button>
        <button class="btn btn-chip">Vols</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Véhicule</th><th>Chauffeur</th><th>Description</th><th>Coût</th><th>Statut</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td class="mono">08/05</td><td><span class="badge alert">Accident</span></td><td>Master 130</td><td>Saïd B.</td><td>Choc aile arrière, parking Auchan</td><td class="amount">820 €</td><td><span class="badge warn">Expertise</span></td></tr>
            <tr class="row-hover"><td class="mono">05/05</td><td><span class="badge warn">Avarie</span></td><td>Sprinter 316</td><td>Youssef E.</td><td>Pneu arrière crevé sur A1</td><td class="amount">240 €</td><td><span class="badge ok">Résolu</span></td></tr>
            <tr class="row-hover"><td class="mono">02/05</td><td><span class="badge alert">Accident</span></td><td>Sprinter 314</td><td>Karim B.</td><td>Rétroviseur, sortie quai</td><td class="amount">180 €</td><td><span class="badge alert">Action</span></td></tr>
            <tr class="row-hover"><td class="mono">28/04</td><td><span class="badge">Vol</span></td><td>—</td><td>—</td><td>GPS embarqué Master 130</td><td class="amount">320 €</td><td><span class="badge alert">Action</span></td></tr>
            <tr class="row-hover"><td class="mono">22/04</td><td><span class="badge warn">Avarie</span></td><td>Sprinter 314</td><td>Karim B.</td><td>Batterie HS au démarrage</td><td class="amount">140 €</td><td><span class="badge ok">Résolu</span></td></tr>
          </tbody>
        </table>
      </div>`
  },

  'inspections.html': {
    title: 'Inspections',
    subMeta: 'Contrôles hebdo flotte · Semaine 19',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Inspections véhicules</h2>
          <div class="sub">Semaine 19 · 4 véhicules · 5 inspections cette semaine</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">📄 Rapport</button>
          <button class="btn btn-primary"><svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Nouvelle inspection</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Cette semaine</div><div class="kpi-val">5</div><div class="kpi-sub">4 véhicules contrôlés</div></div>
        <div class="kpi"><div class="kpi-lbl">Défauts signalés</div><div class="kpi-val">3</div><div class="kpi-sub">2 mineurs · 1 majeur</div></div>
        <div class="kpi"><div class="kpi-lbl">Conformité globale</div><div class="kpi-val">92%</div><div class="kpi-sub"><span class="up">+4%</span> vs S18</div></div>
        <div class="kpi"><div class="kpi-lbl">Véhicule à risque</div><div class="kpi-val">Master 130</div><div class="kpi-sub">2 défauts ouverts</div></div>
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Date</th><th>Véhicule</th><th>Chauffeur</th><th>Photos</th><th>Défauts</th><th>Statut</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td class="mono">09/05 06:45</td><td>Sprinter 314</td><td>Karim B.</td><td>8 photos</td><td>—</td><td><span class="badge ok">Conforme</span></td></tr>
            <tr class="row-hover"><td class="mono">09/05 07:00</td><td>Sprinter 316</td><td>Youssef E.</td><td>8 photos</td><td>—</td><td><span class="badge ok">Conforme</span></td></tr>
            <tr class="row-hover"><td class="mono">09/05 05:30</td><td>Master 130</td><td>Saïd B.</td><td>10 photos</td><td>Pneu AR usé (≤2mm)</td><td><span class="badge alert">Défaut majeur</span></td></tr>
            <tr class="row-hover"><td class="mono">08/05 06:30</td><td>Sprinter 314</td><td>Karim B.</td><td>8 photos</td><td>—</td><td><span class="badge ok">Conforme</span></td></tr>
            <tr class="row-hover"><td class="mono">07/05 08:00</td><td>Master 130</td><td>Saïd B.</td><td>10 photos</td><td>Lave-glace vide</td><td><span class="badge warn">Défaut mineur</span></td></tr>
          </tbody>
        </table>
      </div>`
  },

  'brouillons-ia.html': {
    title: 'Brouillons IA',
    subMeta: 'Validation actions IA en attente · 4 actions',
    content: `      <div class="section-head">
        <div style="display:flex;align-items:baseline;gap:12px">
          <h2>Brouillons IA</h2>
          <div class="sub">4 actions en attente de validation · 12 traitées ce mois</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">Rejeter sélection</button>
          <button class="btn btn-primary">Valider sélection</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">En attente</div><div class="kpi-val">4</div><div class="kpi-sub">À traiter</div></div>
        <div class="kpi"><div class="kpi-lbl">Validées mois</div><div class="kpi-val">11</div><div class="kpi-sub">92% taux d'acceptation</div></div>
        <div class="kpi"><div class="kpi-lbl">Rejetées mois</div><div class="kpi-val">1</div><div class="kpi-sub">Mauvais montant facture</div></div>
        <div class="kpi"><div class="kpi-lbl">Économie temps</div><div class="kpi-val">~3h</div><div class="kpi-sub">Sur saisie manuelle</div></div>
      </div>

      <div class="chips-toolbar">
        <button class="btn btn-chip active">En attente (4)</button>
        <button class="btn btn-chip">Validées</button>
        <button class="btn btn-chip">Rejetées</button>
        <button class="btn btn-chip">OCR factures</button>
      </div>

      <div class="card">
        <table>
          <thead><tr><th><input type="checkbox"></th><th>Source</th><th>Type d'action</th><th>Détails</th><th>Confiance IA</th><th>Date</th></tr></thead>
          <tbody>
            <tr class="row-hover"><td><input type="checkbox"></td><td>📎 OCR ticket</td><td><span class="badge warn">Nouvelle charge</span></td><td>Total Béthune · 186,40 € · Carburant Sprinter 314</td><td><span class="badge ok">98%</span></td><td class="mono">09/05 11:42</td></tr>
            <tr class="row-hover"><td><input type="checkbox"></td><td>💬 Chat IA</td><td><span class="badge">Créer livraison</span></td><td>Auchan Nord · Lille → Wattrelos · Sprinter 314</td><td><span class="badge ok">92%</span></td><td class="mono">09/05 10:18</td></tr>
            <tr class="row-hover"><td><input type="checkbox"></td><td>📎 OCR facture</td><td><span class="badge warn">Nouvelle charge</span></td><td>Garage Lefèvre · 312,00 € · Entretien Daily 35S14</td><td><span class="badge ok">95%</span></td><td class="mono">09/05 09:55</td></tr>
            <tr class="row-hover"><td><input type="checkbox"></td><td>💬 Chat IA</td><td><span class="badge ok">Marquer payé</span></td><td>F-2026-0128 Brico Dépôt · 2 810 € · virement Qonto</td><td><span class="badge warn">78%</span></td><td class="mono">08/05 16:30</td></tr>
          </tbody>
        </table>
      </div>`
  },

  'espace-salarie.html': {
    title: 'Espace salarié',
    subMeta: 'Profil chauffeur · Karim B.',
    extraCss: `.profile-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:14px;display:flex;align-items:center;gap:18px}
.profile-av{width:72px;height:72px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:28px;font-weight:800;box-shadow:0 0 0 3px rgba(230,57,70,0.25)}
.profile-name{font-family:var(--font-display);font-size:22px;font-weight:800;letter-spacing:-0.02em}
.profile-role{color:var(--text-muted);font-size:13px;margin-top:2px}`,
    content: `      <div class="profile-card">
        <div class="profile-av">KB</div>
        <div style="flex:1">
          <div class="profile-name">Karim Benabdallah</div>
          <div class="profile-role">Chauffeur PL · entré le 12/01/2023</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary">Modifier</button>
          <button class="btn btn-primary">Voir historique</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-lbl">Livraisons mois</div><div class="kpi-val">38</div><div class="kpi-sub"><span class="up">+5</span> vs avril</div></div>
        <div class="kpi"><div class="kpi-lbl">CA généré</div><div class="kpi-val">14 280 €</div><div class="kpi-sub">Top chauffeur</div></div>
        <div class="kpi"><div class="kpi-lbl">Km mois</div><div class="kpi-val">3 280 km</div><div class="kpi-sub">Sprinter 314</div></div>
        <div class="kpi"><div class="kpi-lbl">Score qualité</div><div class="kpi-val">98%</div><div class="kpi-sub">0 retard · 0 incident</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="margin:0">
          <div class="card-header"><h3>📋 Documents</h3></div>
          <table>
            <tbody>
              <tr class="row-hover"><td>Permis B</td><td>14/08/2027</td><td><span class="badge ok">Valide</span></td></tr>
              <tr class="row-hover"><td>Permis C (PL)</td><td>14/08/2027</td><td><span class="badge ok">Valide</span></td></tr>
              <tr class="row-hover"><td>FIMO</td><td>30/04/2028</td><td><span class="badge ok">Valide</span></td></tr>
              <tr class="row-hover"><td>Carte conducteur</td><td>10/03/2027</td><td><span class="badge ok">Valide</span></td></tr>
              <tr class="row-hover"><td>Visite médicale</td><td>10/03/2027</td><td><span class="badge ok">Valide</span></td></tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="margin:0">
          <div class="card-header"><h3>📞 Coordonnées</h3></div>
          <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px">
            <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:var(--text-muted);margin-bottom:6px">Téléphone</div><div class="mono" style="color:var(--text);font-size:14px">06 12 45 78 90</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:var(--text-muted);margin-bottom:6px">Email</div><div style="color:var(--text);font-size:14px">karim.b@mca-logistics.fr</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:var(--text-muted);margin-bottom:6px">Adresse</div><div style="font-size:14px">12 rue Pasteur, 67000 Strasbourg</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:var(--text-muted);margin-bottom:6px">Contact urgence</div><div style="font-size:14px">Aïcha B. <span class="mono" style="color:var(--text-muted)">06 98 76 54 32</span></div></div>
          </div>
        </div>
      </div>`
  },
};

// =================== GENERATE ===================

const outDir = 'previews';
let count = 0;
for (const [filename, config] of Object.entries(PAGES)) {
  const html = buildPage({ ...config, slug: filename.replace('.html','') });
  writeFileSync(join(outDir, filename), html, 'utf8');
  console.log(`  ✓ ${filename}`);
  count++;
}
console.log(`\n✓ Generated ${count} previews → previews/`);
