/**
 * MCA Logistics — Click handler : close planning suggestions boxes when click outside (Phase X — extraction script.js)
 *
 * Extracted from script.js L2807-2819 (2026-05-16).
 */

document.addEventListener('click', function(event) {
  [
    { input: 'absence-sal-search', box: 'absence-sal-suggestions' },
    { input: 'plan-salarie-search', box: 'plan-salarie-suggestions' }
  ].forEach(function(entry) {
    var input = document.getElementById(entry.input);
    var box = document.getElementById(entry.box);
    if (!input || !box) return;
    if (input.contains(event.target) || box.contains(event.target)) return;
    box.innerHTML = '';
    box.style.display = 'none';
  });
});
