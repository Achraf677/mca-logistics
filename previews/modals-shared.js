/* Modal & Drawer manager — open/close avec × et Echap.
 * Usage HTML :
 *   <button data-modal-open="modal-id">Ouvrir</button>
 *   <div class="modal-overlay" id="modal-id">...</div>
 * Le bouton ferme : tout élément avec [data-modal-close] dans le modal.
 */
(function(){
  function openModal(id){
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.add('open');
    document.body.classList.add('modal-open');
  }
  function closeAll(){
    document.querySelectorAll('.modal-overlay.open, .drawer-overlay.open, .drawer.open').forEach(el=>el.classList.remove('open'));
    document.body.classList.remove('modal-open');
  }
  function openDrawer(id){
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.add('open');
    const ov=document.getElementById(id+'-overlay');
    if(ov) ov.classList.add('open');
    document.body.classList.add('modal-open');
  }

  // Public API
  window.MCAModal={open:openModal,close:closeAll,openDrawer:openDrawer};

  document.addEventListener('click',e=>{
    // Open
    const openBtn=e.target.closest('[data-modal-open]');
    if(openBtn){
      e.preventDefault();
      openModal(openBtn.getAttribute('data-modal-open'));
      return;
    }
    const drawerBtn=e.target.closest('[data-drawer-open]');
    if(drawerBtn){
      e.preventDefault();
      openDrawer(drawerBtn.getAttribute('data-drawer-open'));
      return;
    }
    // Close × button
    if(e.target.closest('[data-modal-close]')){e.preventDefault();closeAll();return}
    // Click on overlay backdrop (not the dialog itself)
    if(e.target.classList.contains('modal-overlay')||e.target.classList.contains('drawer-overlay')){closeAll()}
  });

  // Echap to close
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') closeAll();
  });

  // Drawer tabs (internal)
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.drawer-tab[data-dr-tab]');
    if(!tab) return;
    const drawer=tab.closest('.drawer');
    if(!drawer) return;
    drawer.querySelectorAll('.drawer-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    drawer.querySelectorAll('.drawer-tab-panel').forEach(p=>p.classList.remove('active'));
    const target=tab.getAttribute('data-dr-tab');
    drawer.querySelector('#'+target)?.classList.add('active');
  });
})();
