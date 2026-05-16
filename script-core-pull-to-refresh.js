/**
 * MCA Logistics — Pull-to-refresh mobile (Phase X.F — extraction script.js)
 *
 * Initialise le geste "tirer vers le bas" sur #mainContent pour rafraîchir la
 * page courante (>80px de drag déclenche un naviguerVers + toast). Affiche
 * #ptr-indicator pendant le drag (>40px).
 *
 * No-op sur desktop (navigator.maxTouchPoints === 0).
 *
 * Dependencies (globals) : naviguerVers, afficherToast.
 *
 * Extracted from script.js L2915-2945 (Phase X.F, 2026-05-16).
 */

function initPullToRefresh() {
  // Uniquement sur mobile/tactile
  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) return;
  const main = document.getElementById('mainContent');
  if (!main) return;
  let startY = 0, pulling = false;
  const ind = document.getElementById('ptr-indicator');

  main.addEventListener('touchstart', e => {
    if (main.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 40 && ind) ind.classList.add('visible');
  }, { passive: true });

  main.addEventListener('touchend', e => {
    if (!pulling) return;
    pulling = false;
    const diff = e.changedTouches[0].clientY - startY;
    if (ind) ind.classList.remove('visible');
    if (diff > 80) {
      const page = document.querySelector('.page.active')?.id?.replace('page-', '');
      if (page) naviguerVers(page);
      afficherToast('Actualisé');
    }
  }, { passive: true });
}

if (typeof window !== 'undefined') {
  window.initPullToRefresh = initPullToRefresh;
}
