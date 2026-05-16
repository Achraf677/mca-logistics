/**
 * MCA Logistics — UI helpers (Phase X.H — extraction script.js)
 *
 * Petits helpers d'interface non spécifiques à un domaine métier :
 * - initScrollTop() : bouton flottant "remonter en haut" sur #mainContent
 * - ouvrirMenuMobile() / fermerMenuMobile() : toggle sidebar mobile
 * - toggleVueCompacte() : densité tables (compact/normal)
 *
 * Dependencies (globals) : afficherToast.
 *
 * Extracted from script.js L703-711 + L1070-1071 + L2683-2693 (Phase X.H).
 */

function initScrollTop() {
  const main = document.getElementById('mainContent');
  const btn = document.getElementById('btn-scroll-top');
  if (!main || !btn) return;
  main.addEventListener('scroll', () => {
    btn.classList.toggle('visible', main.scrollTop > 300);
  });
  btn.onclick = () => main.scrollTo({ top: 0, behavior: 'smooth' });
}

function ouvrirMenuMobile() {
  document.getElementById('sidebar')?.classList.add('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.add('active');
}

function fermerMenuMobile() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
}

/* ===== VUE COMPACTE TABLES ===== */
let _vueCompacte = false;
function toggleVueCompacte() {
  _vueCompacte = !_vueCompacte;
  document.querySelectorAll('.data-table').forEach(t => t.classList.toggle('compact', _vueCompacte));
  const btn = document.getElementById('btn-density-compact');
  const btn2 = document.getElementById('btn-density-normal');
  if (btn) btn.classList.toggle('active', _vueCompacte);
  if (btn2) btn2.classList.toggle('active', !_vueCompacte);
  if (typeof afficherToast === 'function') afficherToast(_vueCompacte ? 'Vue compacte' : 'Vue normale');
}

if (typeof window !== 'undefined') {
  window.initScrollTop = initScrollTop;
  window.ouvrirMenuMobile = ouvrirMenuMobile;
  window.fermerMenuMobile = fermerMenuMobile;
  window.toggleVueCompacte = toggleVueCompacte;
}
