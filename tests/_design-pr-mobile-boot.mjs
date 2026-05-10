// Diag re-utilisable pour chaque PR design : verifie que m.html boot toujours
// correctement (24 routes, dashboard render, 0 page error). Lance avant chaque
// commit. Supprime apres usage si pas integrable au CI.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 8765;
const MIME = { '.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.statusCode = 403; res.end(); return; }
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(fp).pipe(res);
  });
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  sessionStorage.setItem('admin_login', 'achraf.chikri');
  sessionStorage.setItem('admin_email', 'admin.achraf@mca-logistics.fr');
  sessionStorage.setItem('admin_nom', 'Achraf Chikri');
  sessionStorage.setItem('role', 'admin');
  sessionStorage.setItem('auth_mode', 'local');
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('[console.error] ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/m.html`, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const snap = await page.evaluate(() => ({
  text: (document.getElementById('m-content')?.textContent || '').trim().slice(0, 80),
  routes: Object.keys(window.MCAm?.routes || {}).length,
  currentPage: window.MCAm?.state?.currentPage ?? null,
  todayLocalISO: typeof window.todayLocalISO === 'function' ? window.todayLocalISO() : 'UNDEFINED',
}));
await browser.close();
server.close();

const ok = snap.routes === 24 && snap.currentPage === 'dashboard' && errs.length === 0;
console.log(JSON.stringify(snap, null, 2));
console.log('errors=' + errs.length);
errs.forEach(e => console.log('  - ' + e));
console.log(ok ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
