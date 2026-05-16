/* Phase 91.55 Bug D — Handler toggles Notifications (Paramètres).
   Avant : les toggles étaient purement CSS, aucun clic n'avait d'effet, aucune persistance.
   Après : chaque .toggle-row dans #ptab-notifications devient cliquable, l'état est sauvegardé
   dans localStorage sous une clé dérivée du label (slugify du .name). */
(function () {
  'use strict';

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }

  function syncToggleFromStorage(row) {
    var toggle = row.querySelector('.toggle');
    if (!toggle) return;
    var nameEl = row.querySelector('.name');
    var name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return;
    var key = 'param_notif_' + slugify(name);
    var saved = localStorage.getItem(key);
    if (saved === '1') toggle.classList.add('on');
    else if (saved === '0') toggle.classList.remove('on');
    // Sinon : on garde l'état HTML par défaut (on/off pré-renseigné)
    toggle.dataset.notifKey = key;
  }

  function onRowClick(row) {
    var toggle = row.querySelector('.toggle');
    if (!toggle) return;
    var key = toggle.dataset.notifKey;
    if (!key) return;
    toggle.classList.toggle('on');
    var enabled = toggle.classList.contains('on');
    try { localStorage.setItem(key, enabled ? '1' : '0'); } catch (_) {}
    if (typeof window.afficherToast === 'function') {
      var nameEl = row.querySelector('.name');
      var name = nameEl ? nameEl.textContent.trim() : 'Notification';
      window.afficherToast((enabled ? '✅ ' : '⏸️ ') + name + (enabled ? ' activée' : ' désactivée'));
    }
  }

  function init() {
    var panel = document.getElementById('ptab-notifications');
    if (!panel) return;
    var rows = panel.querySelectorAll('.toggle-row');
    rows.forEach(function (row) {
      syncToggleFromStorage(row);
      // Délégation click + clavier (a11y)
      row.style.cursor = 'pointer';
      row.setAttribute('role', 'switch');
      row.setAttribute('tabindex', '0');
      var toggle = row.querySelector('.toggle');
      if (toggle) row.setAttribute('aria-checked', toggle.classList.contains('on') ? 'true' : 'false');
      row.addEventListener('click', function () { onRowClick(row); row.setAttribute('aria-checked', row.querySelector('.toggle').classList.contains('on') ? 'true' : 'false'); });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick(row);
          row.setAttribute('aria-checked', row.querySelector('.toggle').classList.contains('on') ? 'true' : 'false');
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
