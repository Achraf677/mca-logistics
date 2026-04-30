/**
 * MCA Logistics — Module Core-ui
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L97 (script.js d'origine)
function ouvrirPopupSecure(url, cible, opts) {
  var win = null;
  try {
    win = window.open(url || '', cible || '_blank', opts || '');
  } catch (e) {
    win = null;
  }
  if (!win || win.closed || typeof win.closed === 'undefined') {
    if (typeof afficherToast === 'function') {
      afficherToast('⚠️ Fenêtre bloquée par le navigateur — autorisez les popups pour ce site', 'error');
    } else {
      console.warn('[MCA] Popup bloquée par le navigateur:', url);
    }
    return null;
  }
  return win;
}

// L705 (script.js d'origine)
function fermerInlineDropdowns() {
  document.querySelectorAll('.inline-dropdown.open').forEach(function(el) {
    el.classList.remove('open');
    el.classList.remove('open-up');
    el.classList.remove('align-left');
  });
}

// L712 (script.js d'origine)
function positionnerInlineDropdown(root) {
  if (!root) return;
  var menu = root.querySelector('.inline-dropdown-menu');
  if (!menu) return;
  root.classList.remove('open-up');
  root.classList.remove('align-left');
  root.classList.add('open');
  var rect = menu.getBoundingClientRect();
  var margin = 12;
  var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  if (rect.bottom > viewportHeight - margin) root.classList.add('open-up');
  if (rect.left < margin) root.classList.add('align-left');
  rect = menu.getBoundingClientRect();
  if (rect.right > viewportWidth - margin) root.classList.remove('align-left');
}

// L728 (script.js d'origine)
function buildInlineActionsDropdown(triggerLabel, items) {
  return '<div class="inline-dropdown">'
    + '<button type="button" class="btn-secondary table-actions-dropdown" onclick="event.preventDefault();event.stopPropagation();toggleInlineDropdown(this,event)">' + triggerLabel + ' ▾</button>'
    + '<div class="inline-dropdown-menu">'
    + items.map(function(item) {
      var classes = ['inline-dropdown-item'];
      if (item.danger) classes.push('danger-text');
      if (item.disabled) classes.push('is-disabled');
      // Item désactivé : grisé, non cliquable, garde le tooltip via title
      var attrs = item.disabled ? ' disabled aria-disabled="true" title="' + (item.title || 'Indisponible') + '"' : '';
      var onclick = item.disabled
        ? ''
        : ' onclick="event.preventDefault();event.stopPropagation();fermerInlineDropdowns();' + item.action + '"';
      return '<button type="button" class="' + classes.join(' ') + '"' + attrs + onclick + '>'
        + (item.icon ? item.icon + ' ' : '')
        + item.label
        + '</button>';
    }).join('')
    + '</div></div>';
}

// L748 (script.js d'origine)
function toggleInlineDropdown(button, event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  var root = button ? button.closest('.inline-dropdown') : null;
  var willOpen = root && !root.classList.contains('open');
  fermerInlineDropdowns();
  if (root && willOpen) positionnerInlineDropdown(root);
}

// L927 (script.js d'origine)
function getModalIdForLockType(type) {
  return {
    salarie: 'modal-edit-salarie',
    livraison: 'modal-edit-livraison',
    client: 'modal-edit-client',
    vehicule: 'modal-vehicule'
  }[type] || '';
}

// L1026 (script.js d'origine)
function getEditLockContextForModal(modalId) {
  if (modalId === 'modal-edit-salarie' && (editSalarieId || window._editSalarieId)) {
    return { type: 'salarie', id: editSalarieId || window._editSalarieId };
  }
  if (modalId === 'modal-edit-livraison' && window._editLivId) {
    return { type: 'livraison', id: window._editLivId };
  }
  if (modalId === 'modal-edit-client' && _editClientId) {
    return { type: 'client', id: _editClientId };
  }
  if (modalId === 'modal-vehicule' && window._editVehId) {
    return { type: 'vehicule', id: window._editVehId };
  }
  return null;
}

// L1243 (script.js d'origine)
function confirmDialog(msg, { titre='Confirmation', icone='⚠️', btnLabel='Confirmer', danger=true } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-icon').textContent  = icone;
    document.getElementById('confirm-title').textContent = titre;
    document.getElementById('confirm-msg').textContent   = msg;
    const btn = document.getElementById('confirm-ok-btn');
    btn.textContent = btnLabel;
    btn.style.background = danger ? 'var(--red)' : 'var(--accent)';
    btn.style.color = danger ? '#fff' : '#000';
    document.getElementById('modal-confirm').classList.add('open');
  });
}

// L1256 (script.js d'origine)
function confirmResolve() { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) _confirmResolve(true); }

// L1257 (script.js d'origine)
function confirmReject()  { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) _confirmResolve(false); }

// L1260 (script.js d'origine)
function promptDialog(msg, { titre='Saisir une valeur', icone='✍️', btnLabel='Valider', defaultValue='', placeholder='', type='text', validate=null } = {}) {
  return new Promise(resolve => {
    const esc = window.escapeHtml;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.zIndex = '10000';
    overlay.innerHTML =
      '<div class="modal" style="max-width:440px">' +
        '<div class="modal-body" style="padding:28px 24px 8px;text-align:center">' +
          '<div class="confirm-icon" style="font-size:2rem">' + esc(icone) + '</div>' +
          '<div class="confirm-title" style="font-size:1.05rem;font-weight:700;margin-top:6px">' + esc(titre) + '</div>' +
          '<p style="font-size:.88rem;color:var(--text-muted);margin:10px 0 14px;line-height:1.5">' + esc(msg) + '</p>' +
          '<input class="__prompt-input" type="' + esc(type) + '" placeholder="' + esc(placeholder) + '" value="' + esc(defaultValue) + '" ' +
                 'style="width:100%;padding:10px 12px;border:1px solid var(--border,#2a3349);border-radius:8px;background:var(--bg,#0f1626);color:var(--text,#e5e7eb);font-size:.95rem" />' +
          '<p class="__prompt-err" style="color:var(--red,#ef4444);font-size:.78rem;margin-top:6px;min-height:1em" aria-live="polite"></p>' +
        '</div>' +
        '<div class="modal-footer" style="justify-content:center;gap:12px">' +
          '<button type="button" class="btn-secondary __prompt-cancel" style="min-width:100px">Annuler</button>' +
          '<button type="button" class="btn-primary __prompt-ok" style="min-width:100px">' + esc(btnLabel) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.__prompt-input');
    const err = overlay.querySelector('.__prompt-err');
    const btnOk = overlay.querySelector('.__prompt-ok');
    const btnCancel = overlay.querySelector('.__prompt-cancel');
    setTimeout(() => { input.focus(); input.select(); }, 50);
    function cleanup(result) {
      document.removeEventListener('keydown', onKey, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    }
    function submit() {
      const val = input.value;
      if (typeof validate === 'function') {
        const r = validate(val);
        if (r !== true && r !== null && r !== undefined) { err.textContent = String(r); return; }
      }
      cleanup(val);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
      else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); submit(); }
    }
    btnOk.addEventListener('click', submit);
    btnCancel.addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    document.addEventListener('keydown', onKey, true);
  });
}

// L1735 (script.js d'origine)
function __appliquerA11yModale(overlay) {
  if (!overlay) return;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const title = overlay.querySelector('.modal-header h3, .modal-header h2');
  if (title) {
    if (!title.id) title.id = 'modal-title-' + (overlay.id || Math.random().toString(36).slice(2, 8));
    overlay.setAttribute('aria-labelledby', title.id);
  }
}

// L1746 (script.js d'origine)
function __modalTrapKeydown(e) {
  if (e.key === 'Escape') {
    const top = __modalFocusStack[__modalFocusStack.length - 1];
    if (top && top.modalId) {
      e.preventDefault();
      closeModal(top.modalId);
    }
    return;
  }
  if (e.key !== 'Tab') return;
  const top = __modalFocusStack[__modalFocusStack.length - 1];
  if (!top) return;
  const overlay = document.getElementById(top.modalId);
  if (!overlay) return;
  const focusables = Array.from(overlay.querySelectorAll(MODAL_FOCUSABLES)).filter(function(el) {
    return el.offsetParent !== null || el === document.activeElement;
  });
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

// L1773 (script.js d'origine)
function openModal(id)  {
  mettreAJourSelects();
  const overlay = document.getElementById(id);
  if (!overlay) return;
  // BUG-022 fix : éviter de pousser 2× la même modale dans le focus stack.
  const existsInStack = __modalFocusStack.some(function(s){ return s.modalId === id; });
  overlay.classList.add('open');
  __appliquerA11yModale(overlay);
  if (!existsInStack) {
    __modalFocusStack.push({ modalId: id, previousFocus: document.activeElement });
  }
  if (__modalFocusStack.length === 1) {
    document.addEventListener('keydown', __modalTrapKeydown);
  }
  setTimeout(function() {
    const focusables = overlay.querySelectorAll(MODAL_FOCUSABLES);
    const btnClose = overlay.querySelector('.modal-close');
    const target = Array.from(focusables).find(function(el){ return el !== btnClose; }) || btnClose || focusables[0];
    if (target) try { target.focus(); } catch(_){}
  }, 50);

  if (id === 'modal-vehicule') {
    if (!window._editVehId) {
      resetModalVehiculeToCreateMode();
      reinitialiserFinanceVehiculeForm();
      ['veh-immat','veh-modele','veh-km','veh-conso','veh-date-acquisition','veh-date-ct','veh-entretien-interval-km','veh-entretien-interval-mois'].forEach(function(fieldId) {
        var field = document.getElementById(fieldId);
        if (field) field.value = '';
      });
      var tvaCarb = document.getElementById('veh-tva-carburant');
      if (tvaCarb) tvaCarb.value = '80';
      var salarie = document.getElementById('veh-salarie');
      if (salarie) salarie.value = '';
      var modeSel = document.getElementById('veh-mode-acquisition');
      if (modeSel) modeSel.value = 'achat';
    }
    mettreAJourFormulaireVehicule();
  }
}

// L1812 (script.js d'origine)
function closeModal(id) {
  const editLockContext = getEditLockContextForModal(id);
  if (editLockContext) libererVerrouEdition(editLockContext.type, editLockContext.id);
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
  const idx = __modalFocusStack.findIndex(function(s){ return s.modalId === id; });
  if (idx > -1) {
    const state = __modalFocusStack.splice(idx, 1)[0];
    if (state && state.previousFocus && typeof state.previousFocus.focus === 'function') {
      try { state.previousFocus.focus(); } catch(_){}
    }
  }
  if (!__modalFocusStack.length) {
    document.removeEventListener('keydown', __modalTrapKeydown);
  }
  if (id === 'modal-edit-salarie') { editSalarieId = null; window._editSalarieId = null; }
  if (id === 'modal-edit-livraison') { window._editLivId = null; }
  if (id === 'modal-edit-client') { _editClientId = null; }
  if (id === 'modal-vehicule') { window._editVehId = null; resetModalVehiculeToCreateMode(); }
  ['alerte-rent','profit-recap'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display='none'; });
  // BUG-023 fix : purge défensive des backdrops orphelins (injectés par des modales
  // externes type tippy, swal, etc.) quand le stack devient vide.
  if (!__modalFocusStack.length) {
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop:not([data-keep])').forEach(function(el){
      try { el.parentNode && el.parentNode.removeChild(el); } catch(_) {}
    });
  }
}

// L3681 (script.js d'origine)
function confirmerNoteInterne() {
  const salId = document.getElementById('note-interne-sal-id').value;
  const texte = document.getElementById('note-interne-texte').value;
  const notes = loadSafe('notes_internes', {});
  notes[salId] = { texte, date: new Date().toISOString() };
  localStorage.setItem('notes_internes', JSON.stringify(notes));
  closeModal('modal-note-interne');
  afficherToast('📝 Note enregistrée');
}

