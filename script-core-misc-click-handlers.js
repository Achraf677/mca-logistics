/**
 * MCA Logistics — Click handler : close menu-actions-dropdown when click outside (Phase X — extraction script.js)
 *
 * Extracted from script.js L445-449 (2026-05-16).
 */

document.addEventListener('click', function(e) {
  if (!e.target.closest('.menu-actions-wrap')) {
    document.querySelectorAll('.menu-actions-dropdown').forEach(m => m.style.display = 'none');
  }
});
