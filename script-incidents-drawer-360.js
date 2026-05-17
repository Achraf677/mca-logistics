/**
 * MCA Logistics — Drawer 360° Incident (Onglet 14 — 2026-05-17)
 *
 * Ouvre un drawer detail pour un incident donne.
 * 3 onglets : Vue / Photos / Historique chauffeur.
 * Liens cross-drawer : Voir livraison, Voir vehicule, Voir chauffeur.
 *
 * Reutilise les classes CSS .s25-* deja definies dans style.css.
 *
 * Expose : window.ouvrirFiche360Incident(id)
 */
(function installIncDrawer360() {
  'use strict';
  if (window.__incDrawer360Installed) return;
  window.__incDrawer360Installed = true;

  var OVERLAY_ID = 'inc-drawer-overlay';
  var DRAWER_ID = 'inc-drawer';
  var _currentIncId = null;

  function esc(s) {
    if (window.escapeHtml) return window.escapeHtml(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return String(d); }
  }

  function fmtDateTime(d) {
    if (!d) return '—';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return String(d); }
  }

  function fmtEur(n) {
    var v = parseFloat(n);
    if (!v || isNaN(v)) return '—';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }

  function loadJSON(k) {
    try { return JSON.parse(localStorage.getItem(k) || '[]') || []; }
    catch (_) { return []; }
  }

  function ensureDrawer() {
    if (document.getElementById(OVERLAY_ID)) return;
    var ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 's25-drawer-overlay';
    ov.innerHTML = '<aside id="' + DRAWER_ID + '" class="s25-drawer" role="dialog" aria-modal="true" aria-labelledby="inc-drawer-title"></aside>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) fermer(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('open')) fermer();
    });
  }

  function fermer() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.classList.remove('open');
    _currentIncId = null;
  }
  window.fermerFiche360Incident = fermer;

  function typeInfo(inc) {
    var t = inc.type || '';
    if (!t) {
      var g = inc.gravite || 'moyen';
      t = g === 'grave' ? 'accident' : (g === 'faible' ? 'autre' : 'avarie');
    }
    var labels = { accident: 'Accident', avarie: 'Avarie', vol: 'Vol', retard: 'Retard', reclamation: 'Réclamation', autre: 'Autre' };
    var icons = { accident: '💥', avarie: '🛠️', vol: '🚨', retard: '⏰', reclamation: '📝', autre: 'ℹ️' };
    return { label: labels[t] || t, icon: icons[t] || 'ℹ️', key: t };
  }

  function statutInfo(inc) {
    var s = inc.statut || 'ouvert';
    if (s === 'traite') return { label: '✅ Traité', cls: 'ok', color: '#22c55e' };
    if (s === 'encours') return { label: 'En cours', cls: 'neutral', color: '#eab308' };
    return { label: 'Ouvert', cls: 'due', color: '#ef4444' };
  }

  function graviteInfo(inc) {
    var g = inc.gravite || 'moyen';
    if (g === 'grave') return { label: 'Grave', color: '#ef4444' };
    if (g === 'faible') return { label: 'Faible', color: '#22c55e' };
    return { label: 'Moyen', color: '#f97316' };
  }

  function getPhotos(inc) {
    if (Array.isArray(inc.photos)) return inc.photos.filter(Boolean);
    if (typeof inc.photoUrl === 'string' && inc.photoUrl) return [inc.photoUrl];
    return [];
  }

  function renderVue(inc, livraison, vehicule, salarie) {
    var st = statutInfo(inc);
    var gr = graviteInfo(inc);
    var tp = typeInfo(inc);
    var commentaire = inc.description || inc.commentaire || '';

    var infos = '<div class="s25-infos">'
      + '<div><span>Date</span><strong>' + esc(fmtDate(inc.date)) + '</strong></div>'
      + '<div><span>Type</span><strong>' + esc(tp.icon + ' ' + tp.label) + '</strong></div>'
      + '<div><span>Gravité</span><strong style="color:' + gr.color + '">' + esc(gr.label) + '</strong></div>'
      + '<div><span>Statut</span><strong style="color:' + st.color + '">' + esc(st.label) + '</strong></div>'
      + '<div><span>Coût estimé</span><strong>' + esc(fmtEur(inc.cout || inc.cost || inc.montant)) + '</strong></div>'
      + '<div><span>Chauffeur</span><strong>' + esc(inc.salNom || inc.chaufNom || (salarie && salarie.nom) || '—') + '</strong></div>'
      + (livraison ? '<div><span>Livraison</span><strong>' + esc((livraison.numLiv || '') + ' · ' + (livraison.client || '')) + '</strong></div>' : '')
      + (vehicule ? '<div><span>Véhicule</span><strong>' + esc(vehicule.immat || '') + (vehicule.modele ? ' · ' + esc(vehicule.modele) : '') + '</strong></div>' : '')
      + '<div><span>Créé le</span><strong>' + esc(fmtDateTime(inc.creeLe)) + '</strong></div>'
      + (inc.resoluLe ? '<div><span>Résolu le</span><strong>' + esc(fmtDateTime(inc.resoluLe)) + '</strong></div>' : '')
      + '</div>';

    var commentaireSection = '';
    if (commentaire) {
      commentaireSection = '<div class="s25-section"><h4>Description</h4>'
        + '<div class="s25-tl-item" style="border-left-color:' + gr.color + '">' + esc(commentaire) + '</div></div>';
    }

    var liens = '<div class="s25-section"><h4>Contexte</h4><div class="s25-head-actions" style="margin:0;flex-wrap:wrap">';
    if (livraison) {
      liens += '<button type="button" class="btn-secondary" onclick="window.fermerFiche360Incident&&window.fermerFiche360Incident();window.naviguerVers&&window.naviguerVers(\'livraisons\');window.ouvrirFiche360Livraison&&window.ouvrirFiche360Livraison(\'' + esc(livraison.id) + '\')">📦 Voir livraison</button>';
    }
    if (vehicule && typeof window.ouvrirFiche360Vehicule === 'function') {
      liens += '<button type="button" class="btn-secondary" onclick="window.fermerFiche360Incident&&window.fermerFiche360Incident();window.ouvrirFiche360Vehicule(\'' + esc(vehicule.id) + '\')">🚐 Voir fiche véhicule</button>';
    }
    if (salarie && typeof window.ouvrirFiche360Salarie === 'function') {
      liens += '<button type="button" class="btn-secondary" onclick="window.fermerFiche360Incident&&window.fermerFiche360Incident();window.ouvrirFiche360Salarie(\'' + esc(salarie.id) + '\')">👤 Voir fiche chauffeur</button>';
    }
    liens += '</div></div>';

    var actions = '<div class="s25-section"><h4>Actions</h4><div class="s25-head-actions" style="margin:0;flex-wrap:wrap">'
      + (inc.statut !== 'ouvert' ? '<button type="button" class="btn-secondary" onclick="window.changerStatutIncident&&window.changerStatutIncident(\'' + esc(inc.id) + '\',\'ouvert\');window.refreshDrawerIncident&&window.refreshDrawerIncident()">🔴 Marquer ouvert</button>' : '')
      + (inc.statut !== 'encours' ? '<button type="button" class="btn-secondary" onclick="window.changerStatutIncident&&window.changerStatutIncident(\'' + esc(inc.id) + '\',\'encours\');window.refreshDrawerIncident&&window.refreshDrawerIncident()">🟡 Marquer en cours</button>' : '')
      + (inc.statut !== 'traite' ? '<button type="button" class="btn-primary" onclick="window.changerStatutIncident&&window.changerStatutIncident(\'' + esc(inc.id) + '\',\'traite\');window.refreshDrawerIncident&&window.refreshDrawerIncident()">✅ Marquer traité</button>' : '')
      + '</div></div>';

    return '<div class="s25-tab-panel active" data-tab="vue">'
      + '<div class="s25-section"><h4>Détails</h4>' + infos + '</div>'
      + commentaireSection
      + actions
      + liens
      + '</div>';
  }

  function renderPhotos(inc) {
    var photos = getPhotos(inc);
    if (!photos.length) {
      return '<div class="s25-tab-panel" data-tab="photos"><div class="s25-empty">Aucune photo jointe à cet incident.</div></div>';
    }
    var grid = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">'
      + photos.map(function (p, idx) {
        var src = esc(p);
        return '<a href="' + src + '" target="_blank" rel="noopener" style="display:block;border:1px solid var(--border);border-radius:8px;padding:4px;overflow:hidden">'
          + '<img data-storage-path="' + src + '" src="' + src + '" alt="Photo incident ' + (idx + 1) + '" style="width:100%;height:120px;object-fit:cover;border-radius:6px;display:block" loading="lazy">'
          + '</a>';
      }).join('')
      + '</div>';
    return '<div class="s25-tab-panel" data-tab="photos"><div class="s25-section"><h4>Photos (' + photos.length + ')</h4>' + grid + '</div></div>';
  }

  function renderHistoriqueChauffeur(inc, salarie) {
    if (!salarie || !inc.salId) {
      return '<div class="s25-tab-panel" data-tab="histo"><div class="s25-empty">Chauffeur non identifié — historique indisponible.</div></div>';
    }
    var all = loadJSON('incidents')
      .filter(function (i) { return i && i.id !== inc.id && i.salId === inc.salId; })
      .sort(function (a, b) { return new Date(b.creeLe || b.date) - new Date(a.creeLe || a.date); })
      .slice(0, 20);

    if (!all.length) {
      return '<div class="s25-tab-panel" data-tab="histo"><div class="s25-empty">Aucun autre incident pour ce chauffeur.</div></div>';
    }

    var rows = all.map(function (i) {
      var st = statutInfo(i);
      var tp = typeInfo(i);
      return '<tr style="cursor:pointer" onclick="window.ouvrirFiche360Incident&&window.ouvrirFiche360Incident(\'' + esc(i.id) + '\')">'
        + '<td class="mono" style="white-space:nowrap">' + esc(fmtDate(i.date)) + '</td>'
        + '<td>' + esc(tp.label) + '</td>'
        + '<td><span class="s25-pill pill-' + st.cls + '">' + esc(st.label) + '</span></td>'
        + '<td style="text-align:right">' + esc(fmtEur(i.cout || i.cost || i.montant)) + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="s25-tab-panel" data-tab="histo">'
      + '<div class="s25-section"><h4>20 derniers incidents du chauffeur</h4>'
      + '<table class="s25-table"><thead><tr><th>Date</th><th>Type</th><th>Statut</th><th style="text-align:right">Coût</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  }

  function ouvrir(incId) {
    ensureDrawer();
    var incidents = loadJSON('incidents');
    var inc = incidents.find(function (i) { return i && i.id === incId; });
    if (!inc) {
      if (window.afficherToast) window.afficherToast('Incident introuvable', 'error');
      return;
    }
    _currentIncId = incId;
    var livraisons = loadJSON('livraisons');
    var vehicules = loadJSON('vehicules');
    var salaries = loadJSON('salaries');
    var livraison = inc.livId ? livraisons.find(function (l) { return l && l.id === inc.livId; }) : null;
    var vehicule = null;
    if (livraison) {
      vehicule = vehicules.find(function (v) {
        if (!v) return false;
        if (livraison.vehId && v.id === livraison.vehId) return true;
        return livraison.vehImmat && v.immat && String(v.immat).trim().toUpperCase() === String(livraison.vehImmat).trim().toUpperCase();
      });
    }
    var salarie = inc.salId ? salaries.find(function (s) { return s && s.id === inc.salId; }) : null;

    var st = statutInfo(inc);
    var gr = graviteInfo(inc);
    var tp = typeInfo(inc);
    var photoCount = getPhotos(inc).length;

    var head = '<button type="button" class="s25-close" onclick="window.fermerFiche360Incident&&window.fermerFiche360Incident()" aria-label="Fermer">✕</button>'
      + '<div class="s25-avatar" style="background:rgba(239,68,68,0.18);color:#ef4444">' + esc(tp.icon) + '</div>'
      + '<div class="s25-head-body">'
      + '<div id="inc-drawer-title" class="s25-head-title">' + esc(tp.label) + ' · ' + esc(fmtDate(inc.date)) + '</div>'
      + '<div class="s25-head-meta">'
      + '<span>👤 ' + esc(inc.salNom || inc.chaufNom || '—') + '</span>'
      + (livraison ? '<span>📦 ' + esc(livraison.client || livraison.numLiv || '—') + '</span>' : '')
      + (vehicule ? '<span>🚐 ' + esc(vehicule.immat || '—') + '</span>' : '')
      + '<span class="s25-pill pill-' + st.cls + '" style="margin-left:auto">' + esc(st.label) + '</span>'
      + '</div></div>';

    var kpis = '<div class="s25-kpi-row">'
      + '<div class="s25-kpi"><div class="kpi-label">Statut</div><div class="kpi-val" style="color:' + st.color + '">' + esc(st.label) + '</div></div>'
      + '<div class="s25-kpi"><div class="kpi-label">Gravité</div><div class="kpi-val" style="color:' + gr.color + '">' + esc(gr.label) + '</div></div>'
      + '<div class="s25-kpi"><div class="kpi-label">Coût</div><div class="kpi-val">' + esc(fmtEur(inc.cout || inc.cost || inc.montant)) + '</div></div>'
      + '<div class="s25-kpi"><div class="kpi-label">Photos</div><div class="kpi-val">' + photoCount + '</div></div>'
      + '</div>';

    var tabs = '<div class="s25-tabs" role="tablist">'
      + '<button type="button" class="s25-tab active" data-tab="vue" role="tab">Vue</button>'
      + '<button type="button" class="s25-tab" data-tab="photos" role="tab">Photos' + (photoCount ? ' (' + photoCount + ')' : '') + '</button>'
      + '<button type="button" class="s25-tab" data-tab="histo" role="tab">Historique</button>'
      + '</div>';

    var content = '<div class="s25-tab-content">'
      + renderVue(inc, livraison, vehicule, salarie)
      + renderPhotos(inc)
      + renderHistoriqueChauffeur(inc, salarie)
      + '</div>';

    var drawer = document.getElementById(DRAWER_ID);
    drawer.innerHTML = '<div class="s25-drawer-head">' + head + '</div>' + kpis + tabs + content;

    var btns = drawer.querySelectorAll('.s25-tab');
    var panels = drawer.querySelectorAll('.s25-tab-panel');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        b.classList.add('active');
        var t = b.getAttribute('data-tab');
        panels.forEach(function (p) { if (p.getAttribute('data-tab') === t) p.classList.add('active'); });
      });
    });

    if (window.resolveStorageImages) {
      try { window.resolveStorageImages(drawer); } catch (_) {}
    }

    document.getElementById(OVERLAY_ID).classList.add('open');
  }
  window.ouvrirFiche360Incident = ouvrir;

  window.refreshDrawerIncident = function () {
    if (_currentIncId) {
      try { ouvrir(_currentIncId); } catch (_) {}
    }
  };
})();
