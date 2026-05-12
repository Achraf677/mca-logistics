/* Phase 59 polish (BUG-026) — TVA tabs Collectée/Déductible (mockup-aligned) */
(function () {
  'use strict';

  window.switchTvaTab = function (which) {
    var collPanel = document.getElementById('tva-panel-collectee');
    var dedPanel = document.getElementById('tva-panel-deductible');
    var collBtn = document.getElementById('tva-tab-btn-collectee');
    var dedBtn = document.getElementById('tva-tab-btn-deductible');
    if (!collPanel || !dedPanel) return;
    var isColl = which === 'collectee';
    collPanel.style.display = isColl ? '' : 'none';
    dedPanel.style.display = isColl ? 'none' : '';
    if (collBtn) { collBtn.classList.toggle('active', isColl); collBtn.setAttribute('aria-selected', isColl); }
    if (dedBtn) { dedBtn.classList.toggle('active', !isColl); dedBtn.setAttribute('aria-selected', !isColl); }
  };

  // Update counts (mockup pattern : "TVA collectée [142 fact.]" / "TVA déductible [42 charges]")
  function updateCounts() {
    var collTbody = document.getElementById('tb-tva-collectee');
    var dedTbody = document.getElementById('tb-tva-deductible');
    var collCount = document.getElementById('tva-tab-count-collectee');
    var dedCount = document.getElementById('tva-tab-count-deductible');
    if (collCount && collTbody) collCount.textContent = collTbody.querySelectorAll('tr').length;
    if (dedCount && dedTbody) dedCount.textContent = dedTbody.querySelectorAll('tr').length;
  }

  function tryAttach() {
    if (!document.getElementById('tva-panel-collectee')) return false;
    updateCounts();
    if (!window.__refonteTvaTabsIv) {
      window.__refonteTvaTabsIv = setInterval(updateCounts, 3000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) { var r = 0, iv = setInterval(function(){ if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
    });
  } else {
    if (!tryAttach()) { var r = 0, iv = setInterval(function(){ if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
  }
})();
