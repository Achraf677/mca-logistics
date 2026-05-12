// Sidebar footer — admin identity (avatar + nom + role) + dropdown menu.
// Mockup-aligned avec previews/livraisons.html .sidebar-foot pattern.
(function () {
  function getInitials(name) {
    if (!name || typeof name !== 'string') return 'A';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'A';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function readSession() {
    try {
      if (typeof window.getAdminSession === 'function') return window.getAdminSession();
    } catch (_e) {}
    return {
      identifiant: sessionStorage.getItem('admin_login') || '',
      email: sessionStorage.getItem('admin_email') || '',
      nom: sessionStorage.getItem('admin_nom') || ''
    };
  }

  function populate() {
    const av = document.getElementById('sf-avatar');
    const who = document.getElementById('sf-who');
    if (!av || !who) return;
    const session = readSession();
    const displayName = session.nom || session.identifiant || session.email || 'Admin';
    who.textContent = displayName;
    av.textContent = getInitials(displayName);
  }

  function bindDropdown() {
    const trig = document.getElementById('sidebar-foot-trigger');
    const menu = document.getElementById('sf-user-menu');
    if (!trig || !menu || trig.dataset.bound === '1') return;
    trig.dataset.bound = '1';

    trig.addEventListener('click', (e) => {
      if (e.target.closest('#toggleSidebar')) return;
      if (e.target.closest('.sf-user-item')) return;
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      trig.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !trig.contains(e.target)) {
        menu.classList.remove('open');
        trig.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        trig.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function init() {
    populate();
    bindDropdown();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('storage', (e) => {
    if (e && e.key && /^admin_/.test(e.key)) populate();
  });

  window.refreshSidebarFoot = populate;
})();
