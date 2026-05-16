/**
 * MCA Logistics — resetTimerInactivite — déconnexion auto admin par inactivité (Phase X — extraction script.js)
 *
 * Extracted from script.js L1951-1963 (2026-05-16).
 */

/* ===== DÉCONNEXION AUTO ADMIN (inactivité configurable) ===== */
let _timerInactivite = null;
function resetTimerInactivite() {
  if (getRoleSessionCourant() !== 'admin') return;
  clearTimeout(_timerInactivite);
  _timerInactivite = setTimeout(() => {
    sessionStorage.setItem('delivpro_session_expired', '1');
    sessionStorage.setItem('delivpro_pending_signout', '1');
    purgerSessionAdminLocale();
    redirigerVersLoginAdmin();
  }, getSessionTimeoutMinutesAdmin() * 60 * 1000);
}
['click','keydown','mousemove','scroll'].forEach(ev => document.addEventListener(ev, resetTimerInactivite, { passive:true }));

if (typeof window !== 'undefined') {
  window.resetTimerInactivite = resetTimerInactivite;
}
