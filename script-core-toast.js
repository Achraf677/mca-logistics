/**
 * MCA Logistics — Toast notification system (canonical, fan-out listeners + dedup) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1471-1526 (2026-05-16).
 */

const __toastRecents = new Map();
/* CANONIQUE — `afficherToast` (toast simple, élément #toast).
   H2.1 : registre de listeners fan-out. Au lieu de wrapper window.afficherToast
   (chaîne fragile dépendant de l'ordre de chargement), les modules qui veulent
   réagir aux toasts appellent `addToastListener(cb)`. Chaque appel à
   afficherToast notifie tous les listeners enregistrés ; si un listener
   throw, on log et continue. Si un listener retourne `true`, il "consomme"
   l'événement et le toast simple #toast n'est PAS affiché en plus.
   Voir Sprint 10 (toasts stackés) qui s'enregistre via ce registre au lieu
   d'écraser window.afficherToast. */
const __toastListeners = [];
window.addToastListener = function(cb) {
  if (typeof cb !== 'function') return function() {};
  __toastListeners.push(cb);
  return function() {
    const idx = __toastListeners.indexOf(cb);
    if (idx > -1) __toastListeners.splice(idx, 1);
  };
};
window.removeToastListener = function(cb) {
  const idx = __toastListeners.indexOf(cb);
  if (idx > -1) __toastListeners.splice(idx, 1);
};
function afficherToast(message, type='success', options) {
  // Notifier les listeners (Sprint 10 = toasts stackés, etc.). Si un listener
  // retourne `true`, il consomme l'événement — on n'affiche pas le toast simple.
  let consumed = false;
  for (const cb of __toastListeners) {
    try {
      if (cb(message, type, options) === true) consumed = true;
    } catch (e) {
      console.error('[afficherToast] listener error', e);
    }
  }
  if (consumed) return;
  const t=document.getElementById('toast');
  if (!t) return;
  // Dédup : même message émis dans les 2s = ignoré (anti-spam)
  const now = Date.now();
  const cle = type + '|' + message;
  const dernier = __toastRecents.get(cle);
  if (dernier && (now - dernier) < 2000) return;
  __toastRecents.set(cle, now);
  if (__toastRecents.size > 40) {
    for (const [k, v] of __toastRecents) {
      if (now - v > 10000) __toastRecents.delete(k);
    }
  }
  // BUG-006 a11y : erreurs en assertive pour lecture immédiate par screen reader
  t.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent=message; t.className='toast show'+(type==='error'?' error':'');
  setTimeout(()=>{t.className='toast';},3000);
}
// Exposer aussi sur window pour cohérence avec les call-sites window.afficherToast(...)
window.afficherToast = afficherToast;

if (typeof window !== 'undefined') {
  window.afficherToast = afficherToast;
}
