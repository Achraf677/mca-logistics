/* ==========================================================================
   MCA Logistics — Vehicules section-head counts (Phase 2 / PR-D)

   Compte le nombre total de vehicules et les alertes CT/assurance pour
   les afficher dans le section-head. MutationObserver sur #tb-vehicules.
   ========================================================================== */

(function () {
  'use strict';

  function lireVehicules() {
    try { return JSON.parse(localStorage.getItem('vehicules') || '[]') || []; }
    catch (_) { return []; }
  }

  function estCTExpire(v) {
    if (!v || !v.ctDate) return false;
    try {
      var d = new Date(v.ctDate);
      if (isNaN(d.getTime())) return false;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      // Alerte si CT expire dans les 30 jours OU deja expire
      var dans30j = new Date(today); dans30j.setDate(today.getDate() + 30);
      return d < dans30j;
    } catch (_) { return false; }
  }

  function estAssuranceExpire(v) {
    if (!v) return false;
    var dateAssurance = v.dateAssurance || (v.assurance && v.assurance.dateExpiration);
    if (!dateAssurance) return false;
    try {
      var d = new Date(dateAssurance);
      if (isNaN(d.getTime())) return false;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var dans30j = new Date(today); dans30j.setDate(today.getDate() + 30);
      return d < dans30j;
    } catch (_) { return false; }
  }

  function computerCounts() {
    var vehs = lireVehicules();
    var nbAlertes = 0;
    vehs.forEach(function (v) {
      if (estCTExpire(v) || estAssuranceExpire(v)) nbAlertes += 1;
    });
    return { total: vehs.length, alertes: nbAlertes };
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function updateCounts() {
    if (!document.getElementById('vehicules-section-sub-count')) return;
    var c;
    try { c = computerCounts(); }
    catch (e) { console.warn('[vehicules-counts]', e); return; }
    setText('vehicules-section-sub-count', c.total);
    setText('vehicules-section-sub-alertes', c.alertes);
  }

  function tryAttach() {
    var tbody = document.querySelector('#page-vehicules table tbody, #page-vehicules .vehicule-card');
    if (!document.getElementById('vehicules-section-sub-count')) return false;
    updateCounts();
    // Observer si tbody existe
    if (tbody && !tbody.__vehiculesCountsObserverAttached) {
      var observer = new MutationObserver(function () {
        if (tbody.__vehiculesCountsRaf) cancelAnimationFrame(tbody.__vehiculesCountsRaf);
        tbody.__vehiculesCountsRaf = requestAnimationFrame(updateCounts);
      });
      observer.observe(tbody, { childList: true, subtree: false });
      tbody.__vehiculesCountsObserverAttached = true;
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) {
        var retries = 0;
        var iv = setInterval(function () {
          if (tryAttach() || ++retries > 20) clearInterval(iv);
        }, 500);
      }
    });
  } else {
    if (!tryAttach()) {
      var retries = 0;
      var iv = setInterval(function () {
        if (tryAttach() || ++retries > 20) clearInterval(iv);
      }, 500);
    }
  }

  window.refonteVehiculesUpdateCounts = updateCounts;
})();
