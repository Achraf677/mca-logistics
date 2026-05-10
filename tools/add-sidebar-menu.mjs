// Adds a user dropdown menu (Profile / Paramètres / Déconnexion) on sidebar-foot click.
// Run: node tools/add-sidebar-menu.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const files = readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

const MENU_CSS = `
/* Sidebar user menu (logout dropdown) */
.sidebar-foot{cursor:pointer;transition:background var(--t-fast) var(--ease-out);position:relative}
.sidebar-foot:hover{background:var(--bg-card-hover)}
.sidebar-foot::after{content:'';position:absolute;right:14px;top:50%;transform:translateY(-50%);width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:5px solid var(--text-muted);transition:transform var(--t-fast) var(--ease-out)}
.sidebar-foot.open::after{transform:translateY(-50%) rotate(180deg)}
.user-menu{position:absolute;left:8px;right:8px;bottom:calc(100% + 6px);background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:10px;box-shadow:0 -18px 40px rgba(0,0,0,0.45);padding:6px;z-index:60;opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out)}
.user-menu.open{opacity:1;transform:translateY(0);pointer-events:auto}
.user-menu-item{display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border:none;background:transparent;color:var(--text);font-family:inherit;font-size:13px;text-align:left;border-radius:7px;cursor:pointer;text-decoration:none;transition:background var(--t-fast) var(--ease-out)}
.user-menu-item:hover{background:var(--bg-card-hover)}
.user-menu-item svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;color:var(--text-muted);flex-shrink:0}
.user-menu-item:hover svg{color:var(--brand)}
.user-menu-item.danger{color:var(--brand)}
.user-menu-item.danger:hover{background:var(--brand-soft)}
.user-menu-item.danger svg{color:var(--brand)}
.user-menu-sep{height:1px;background:var(--border);margin:5px 6px}
`;

const MENU_HTML_TEMPLATE = `<div class="sidebar-foot" id="sidebar-foot-trigger">
      <div class="av">AC</div>
      <div>
        <div class="who">Achraf Chikri</div>
        <div class="role">Admin</div>
      </div>
      <div class="user-menu" id="user-menu">
        <a class="user-menu-item" href="espace-salarie-NA">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          Mon profil
        </a>
        <a class="user-menu-item" href="parametres.html">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Paramètres
        </a>
        <a class="user-menu-item" href="#" onclick="alert('🔒 Verrouillé');return false">
          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Verrouiller la session
        </a>
        <div class="user-menu-sep"></div>
        <a class="user-menu-item danger" href="#" onclick="if(confirm('Déconnexion ?')){window.location.href='dashboard.html'}return false">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Se déconnecter
        </a>
      </div>
    </div>`;

const MENU_JS = `<script>
// Sidebar user menu toggle
(function(){
  const trig=document.getElementById('sidebar-foot-trigger');
  const menu=document.getElementById('user-menu');
  if(!trig||!menu) return;
  trig.addEventListener('click',e=>{
    if(e.target.closest('.user-menu-item')) return;
    e.stopPropagation();
    const open=menu.classList.toggle('open');
    trig.classList.toggle('open',open);
  });
  document.addEventListener('click',e=>{
    if(!menu.contains(e.target)&&!trig.contains(e.target)){
      menu.classList.remove('open');trig.classList.remove('open');
    }
  });
})();
</script>`;

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  let changed = false;

  // Inject CSS
  if (!html.includes('/* Sidebar user menu')) {
    html = html.replace(/<\/style>/, MENU_CSS + '\n</style>');
    changed = true;
  }

  // Replace the simple sidebar-foot with the one that has the user-menu
  // Regex to match the existing simple sidebar-foot block
  const simpleFoot = /<div class="sidebar-foot">\s*<div class="av">AC<\/div>\s*<div>\s*<div class="who">Achraf Chikri<\/div>\s*<div class="role">Admin<\/div>\s*<\/div>\s*<\/div>/;
  if (simpleFoot.test(html) && !html.includes('id="sidebar-foot-trigger"')) {
    html = html.replace(simpleFoot, MENU_HTML_TEMPLATE);
    changed = true;
  }

  // Inject JS at end
  if (changed && !html.includes("getElementById('sidebar-foot-trigger')")) {
    html = html.replace(/<\/body>/, MENU_JS + '\n</body>');
  }

  if (changed) {
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ ${f}`);
  }
}
console.log('\nDone.');
