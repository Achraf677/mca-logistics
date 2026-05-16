/**
 * MCA Logistics — toggleMenuCarbAdmin — dropdown actions carburant (Phase X — extraction script.js)
 *
 * Extracted from script.js L953-959 (2026-05-16).
 */

function toggleMenuCarbAdmin(id) {
  document.querySelectorAll('.menu-actions-dropdown').forEach(m => {
    if (m.id !== 'menu-carb-' + id) m.style.display = 'none';
  });
  const menu = document.getElementById('menu-carb-' + id);
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

if (typeof window !== 'undefined') {
  window.toggleMenuCarbAdmin = toggleMenuCarbAdmin;
}
