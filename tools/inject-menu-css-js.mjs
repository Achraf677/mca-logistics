// Injects menu CSS + JS handler into any preview file that references data-menu-trigger but lacks them.
// Run: node tools/inject-menu-css-js.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PREVIEWS_DIR = 'previews';

const MENU_CSS = `
/* Export dropdown menu (Livraisons-pattern) */
.export-wrap{position:relative}
.menu{position:absolute;top:calc(100% + 6px);right:0;min-width:260px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,0.45);padding:6px;z-index:50;opacity:0;transform:translateY(-4px);pointer-events:none;transition:opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out)}
.menu.open{opacity:1;transform:translateY(0);pointer-events:auto}
.menu-item{display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border:none;background:transparent;color:var(--text);font-family:inherit;font-size:13px;text-align:left;border-radius:7px;cursor:pointer;transition:background var(--t-fast) var(--ease-out)}
.menu-item:hover{background:var(--bg-card-hover)}
.menu-item svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;color:var(--text-muted);flex-shrink:0}
.menu-item:hover svg{color:var(--brand)}
.mi-name{font-weight:600;font-size:13px;line-height:1.2}
.mi-sub{font-size:11px;color:var(--text-muted);margin-top:2px;line-height:1.2}
.menu-sep{height:1px;background:var(--border);margin:5px 6px}`;

const MENU_JS = `<script>
// Export menus (Livraisons-pattern) — supports multiple menus per page
document.querySelectorAll('[data-menu-trigger]').forEach(btn=>{
  const targetId=btn.getAttribute('data-menu-trigger');
  const menu=document.getElementById(targetId);
  if(!menu) return;
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach(m=>{if(m!==menu)m.classList.remove('open')});
    const open=menu.classList.toggle('open');
    btn.setAttribute('aria-expanded',open);
  });
  document.addEventListener('click',e=>{
    if(!menu.contains(e.target)&&e.target!==btn){menu.classList.remove('open');btn.setAttribute('aria-expanded','false')}
  });
  menu.querySelectorAll('.menu-item').forEach(mi=>mi.addEventListener('click',()=>menu.classList.remove('open')));
});
</script>`;

const files = readdirSync(PREVIEWS_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
for (const f of files) {
  const fp = join(PREVIEWS_DIR, f);
  let html = readFileSync(fp, 'utf8');
  let changed = false;

  // Inject CSS if file uses data-menu-trigger but lacks .export-wrap CSS
  if (html.includes('data-menu-trigger') && !html.includes('.export-wrap{')) {
    html = html.replace(/<\/style>/, MENU_CSS + '\n</style>');
    changed = true;
  }
  // Inject JS handler if file uses data-menu-trigger but lacks the handler script
  if (html.includes('data-menu-trigger') && !html.includes('querySelectorAll(\'[data-menu-trigger]\')')) {
    html = html.replace(/<\/body>/, MENU_JS + '\n</body>');
    changed = true;
  }

  if (changed) {
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ patched ${f}`);
  }
}
console.log('\nDone.');
