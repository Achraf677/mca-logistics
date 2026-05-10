/**
 * MCA Logistics — Boot scripts (extraits inline admin.html pour CSP #74)
 *
 * 3 fonctions critiques au boot :
 *   1. Redirection mobile stricte (UA + viewport)
 *   2. Mobile bottom nav wiring (clicks + sync active)
 *   3. Service Worker register + bouton bug report
 */
(function () {
  'use strict';

  // ============================================================
  // 1. Redirection mobile stricte (chargee tres tot dans <head>)
  // ============================================================
  function redirigerSiMobile() {
    try {
      var uaMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent || '');
      var ecranEtroit = (window.innerWidth || document.documentElement.clientWidth || 0) <= 760;
      if (uaMobile && ecranEtroit) {
        window.location.replace('m.html' + window.location.search + window.location.hash);
      }
    } catch (_) {}
  }
  // Note : declenche immediatement au chargement de ce script (avant DOMContentLoaded)
  redirigerSiMobile();

  // ============================================================
  // 2. Mobile bottom nav wiring
  // ============================================================
  function syncMbnActive(page) {
    document.querySelectorAll('.mbn-item[data-page]').forEach(function (item) {
      item.classList.toggle('active', item.dataset.page === page);
    });
  }
  function wireMbn() {
    document.querySelectorAll('.mbn-item[data-page]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.naviguerVers === 'function') window.naviguerVers(item.dataset.page);
        if (typeof window.fermerMenuMobile === 'function') window.fermerMenuMobile();
        syncMbnActive(item.dataset.page);
      });
    });
    var moreBtn = document.getElementById('mbnMoreBtn');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        if (typeof window.ouvrirMenuMobile === 'function') window.ouvrirMenuMobile();
      });
    }
    var activeNav = document.querySelector('.nav-item.active[data-page]');
    if (activeNav) syncMbnActive(activeNav.dataset.page);
    var tryHook = function () {
      if (typeof window.naviguerVers !== 'function' || window.naviguerVers.__mbn) {
        if (typeof window.naviguerVers !== 'function') return setTimeout(tryHook, 200);
        return;
      }
      var orig = window.naviguerVers;
      var wrapped = function (page) {
        var r = orig.apply(this, arguments);
        syncMbnActive(page);
        return r;
      };
      wrapped.__mbn = true;
      Object.keys(orig).forEach(function (k) { if (k.indexOf('__') === 0) wrapped[k] = orig[k]; });
      window.naviguerVers = wrapped;
    };
    tryHook();
  }

  // ============================================================
  // 3. Service Worker + bouton bug report
  // ============================================================
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  }
  function wireBugReportBtn() {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('#admin-bug-report-btn');
      if (!btn) return;
      e.preventDefault();
      var dropdown = document.getElementById('topbar-admin-dropdown');
      if (dropdown) dropdown.classList.remove('open');
      if (window.BugReport && typeof window.BugReport.open === 'function') {
        window.BugReport.open();
      }
    });
  }

  // ============================================================
  // Bootstrap au DOMContentLoaded
  // ============================================================
  function boot() {
    wireMbn();
    registerSW();
    wireBugReportBtn();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
