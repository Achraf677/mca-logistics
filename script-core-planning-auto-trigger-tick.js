/**
 * MCA Logistics — Planning auto trigger tick (60s, skip si onglet caché) (Phase X — extraction script.js)
 *
 * Extracted from script.js L879-882 (2026-05-16).
 */

setInterval(function() {
  if (document.hidden) return;
  try { verifierTriggersPlanningAuto(); } catch (_) {}
}, 60000);
