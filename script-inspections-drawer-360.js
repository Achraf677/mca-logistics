/**
 * MCA Logistics — Drawer 360° Inspection (Onglet 11 — 2026-05-17)
 *
 * Ouvre un drawer detail pour une inspection donnee.
 * 3 onglets : Vue / Photos / Historique vehicule.
 * Liens cross-drawer : "Voir vehicule" -> ouvrirFiche360Vehicule,
 *                     "Voir chauffeur" -> ouvrirFiche360Salarie (si dispo).
 *
 * Reutilise les classes CSS .s25-* deja definies dans style.css.
 *
 * Expose : window.ouvrirFiche360Inspection(inspId)
 */
(function installInspDrawer360() {
  'use strict';
  if (window.__inspDrawer360Installed) return;
  window.__inspDrawer360Installed = true;

  var OVERLAY_ID = 'insp-drawer-overlay';
  var DRAWER_ID = 'insp-drawer';

  var _currentInspId = null;

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

  function loadJSON(k) {
    try { return JSON.parse(localStorage.getItem(k) || '[]') || []; }
    catch (_) { return []; }
  }

  function ensureDrawer() {
    if (document.getElementById(OVERLAY_ID)) return;
    var ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 's25-drawer-overlay';
    ov.innerHTML = '<aside id="' + DRAWER_ID + '" class="s25-drawer" role="dialog" aria-modal="true" aria-labelledby="insp-drawer-title"></aside>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) fermer(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('open')) fermer();
    });
  }

  function fermer() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.classList.remove('open');
    _currentInspId = null;
  }
  window.fermerFiche360Inspection = fermer;

  function statutInfo(insp) {
    var ko = Array.isArray(insp.pointsKO) ? insp.pointsKO.length : 0;
    if (insp.statut === 'conforme') return { label: 'Conforme', cls: 'ok', color: '#22c55e' };
    if (ko >= 3) return { label: 'Défaut majeur', cls: 'due', color: '#ef4444' };
    if (ko > 0) return { label: 'Défaut mineur', cls: 'due', color: '#f97316' };
    return { label: 'Avec anomalies', cls: 'due', color: '#eab308' };
  }

  function initialesVeh(immat) {
    if (!immat) return '?';
    return String(immat).replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || '?';
  }

  function getPhotos(insp) {
    if (Array.isArray(insp.photos)) return insp.photos.filter(Boolean);
    if (typeof insp.photoUrl === 'string' && insp.photoUrl) return [insp.photoUrl];
    return [];
  }

  function renderVue(insp, vehicule, salarie) {
    var st = statutInfo(insp);
    var ko = Array.isArray(insp.pointsKO) ? insp.pointsKO : [];
    var ok = Array.isArray(insp.pointsOK) ? insp.pointsOK : [];
    var commentaire = insp.commentaire || insp.commentaires || '';
    var sourceLabel = insp.source === 'admin' ? 'Saisie admin' : 'Saisie chauffeur';

    var infos = '<div class="s25-infos">'
      + '<div><span>Date</span><strong>' + esc(fmtDate(insp.date)) + '</strong></div>'
      + '<div><span>Kilométrage</span><strong>' + (insp.km ? esc(parseInt(insp.km, 10).toLocaleString('fr-FR')) + ' km' : '—') + '</strong></div>'
      + '<div><span>Véhicule</span><strong>' + esc(insp.vehImmat || (vehicule && vehicule.immat) || '—') + (vehicule && vehicule.modele ? ' · ' + esc(vehicule.modele) : '') + '</strong></div>'
      + '<div><span>Chauffeur</span><strong>' + esc(insp.salNom || (salarie && salarie.nom) || '—') + '</strong></div>'
      + '<div><span>Source</span><strong>' + esc(sourceLabel) + '</strong></div>'
      + '<div><span>Créée le</span><strong>' + esc(fmtDateTime(insp.creeLe)) + '</strong></div>'
      + '</div>';

    var koSection = '';
    if (ko.length) {
      koSection = '<div class="s25-section"><h4>Défauts signalés (' + ko.length + ')</h4>'
        + '<div class="s25-timeline">'
        + ko.map(function (p) {
          return '<div class="s25-tl-item" style="border-left-color:' + st.color + '">⚠️ ' + esc(p) + '</div>';
        }).join('')
        + '</div></div>';
    }

    var okSection = '';
    if (ok.length) {
      okSection = '<div class="s25-section"><h4>Points conformes (' + ok.length + ')</h4>'
        + '<div class="s25-timeline">'
        + ok.map(function (p) {
          return '<div class="s25-tl-item" style="border-left-color:#22c55e">✓ ' + esc(p) + '</div>';
        }).join('')
        + '</div></div>';
    }

    var commentaireSection = '';
    if (commentaire) {
      commentaireSection = '<div class="s25-section"><h4>Commentaire</h4>'
        + '<div class="s25-tl-item" style="border-left-color:var(--text-muted)">' + esc(commentaire) + '</div></div>';
    }

    var liens = '<div class="s25-section"><h4>Contexte</h4><div class="s25-head-actions" style="margin:0;flex-wrap:wrap">';
    if (vehicule && typeof window.ouvrirFiche360Vehicule === 'function') {
      liens += '<button type="button" class="btn-secondary" onclick="window.fermerFiche360Inspection&&window.fermerFiche360Inspection();window.ouvrirFiche360Vehicule(\'' + esc(vehicule.id) + '\')">🚐 Voir fiche véhicule</button>';
    }
    if (salarie && typeof window.ouvrirFiche360Salarie === 'function') {
      liens += '<button type="button" class="btn-secondary" onclick="window.fermerFiche360Inspection&&window.fermerFiche360Inspection();window.ouvrirFiche360Salarie(\'' + esc(salarie.id) + '\')">👤 Voir fiche chauffeur</button>';
    } else if (salarie && typeof window.ouvrirFiche360RH === 'function') {
      liens += '<button type="button" class="btn-secondary" onclick="window.fermerFiche360Inspection&&window.fermerFiche360Inspection();window.ouvrirFiche360RH(\'' + esc(salarie.id) + '\')">👤 Voir fiche chauffeur</button>';
    }
    liens += '</div></div>';

    return '<div class="s25-tab-panel active" data-tab="vue">'
      + '<div class="s25-section"><h4>Détails</h4>' + infos + '</div>'
      + koSection
      + okSection
      + commentaireSection
      + liens
      + '</div>';
  }

  function renderPhotos(insp) {
    var photos = getPhotos(insp);
    if (!photos.length) {
      return '<div class="s25-tab-panel" data-tab="photos"><div class="s25-empty">Aucune photo jointe à cette inspection.</div></div>';
    }
    var grid = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">'
      + photos.map(function (p, idx) {
        var src = esc(p);
        return '<button type="button" class="btn-link" style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px;cursor:pointer;overflow:hidden" onclick="voirPhotoAdmin&&voirPhotoAdmin(\'' + esc(insp.id) + '\',' + idx + ')" title="Agrandir">'
          + '<img data-storage-path="' + src + '" src="' + src + '" alt="Photo inspection ' + (idx + 1) + '" style="width:100%;height:120px;object-fit:cover;border-radius:6px;display:block" loading="lazy">'
          + '</button>';
      }).join('')
      + '</div>';
    return '<div class="s25-tab-panel" data-tab="photos"><div class="s25-section"><h4>Photos (' + photos.length + ')</h4>' + grid + '</div></div>';
  }

  function renderHistoriqueVehicule(insp, vehicule) {
    if (!vehicule) {
      return '<div class="s25-tab-panel" data-tab="histo"><div class="s25-empty">Véhicule introuvable — historique indisponible.</div></div>';
    }
    var all = loadJSON('inspections')
      .filter(function (i) {
        if (!i || i.id === insp.id) return false;
        if (i.vehId === vehicule.id) return true;
        if (i.vehImmat && vehicule.immat) {
          return String(i.vehImmat).trim().toUpperCase() === String(vehicule.immat).trim().toUpperCase();
        }
        return false;
      })
      .sort(function (a, b) { return new Date(b.creeLe || b.date) - new Date(a.creeLe || a.date); })
      .slice(0, 20);

    if (!all.length) {
      return '<div class="s25-tab-panel" data-tab="histo"><div class="s25-empty">Aucune autre inspection pour ce véhicule.</div></div>';
    }

    var rows = all.map(function (i) {
      var st = statutInfo(i);
      var ko = Array.isArray(i.pointsKO) ? i.pointsKO.length : 0;
      return '<tr style="cursor:pointer" onclick="window.ouvrirFiche360Inspection&&window.ouvrirFiche360Inspection(\'' + esc(i.id) + '\')">'
        + '<td class="mono" style="white-space:nowrap">' + esc(fmtDate(i.date)) + '</td>'
        + '<td>' + esc(i.salNom || '—') + '</td>'
        + '<td><span class="s25-pill pill-' + st.cls + '">' + esc(st.label) + '</span></td>'
        + '<td style="text-align:right">' + (ko ? ko + ' KO' : '—') + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="s25-tab-panel" data-tab="histo">'
      + '<div class="s25-section"><h4>20 dernières inspections du véhicule</h4>'
      + '<table class="s25-table"><thead><tr><th>Date</th><th>Chauffeur</th><th>Statut</th><th style="text-align:right">KO</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  }

  function ouvrir(inspId) {
    ensureDrawer();
    var inspections = loadJSON('inspections');
    var insp = inspections.find(function (i) { return i && i.id === inspId; });
    if (!insp) {
      if (window.afficherToast) window.afficherToast('Inspection introuvable', 'error');
      return;
    }
    _currentInspId = inspId;
    var vehicules = loadJSON('vehicules');
    var salaries = loadJSON('salaries');
    var vehicule = vehicules.find(function (v) { return v && (v.id === insp.vehId || (insp.vehImmat && v.immat && String(v.immat).trim().toUpperCase() === String(insp.vehImmat).trim().toUpperCase())); });
    var salarie = salaries.find(function (s) { return s && s.id === insp.salId; });

    var st = statutInfo(insp);
    var photoCount = getPhotos(insp).length;

    var head = '<button type="button" class="s25-close" onclick="window.fermerFiche360Inspection&&window.fermerFiche360Inspection()" aria-label="Fermer">✕</button>'
      + '<div class="s25-avatar" style="background:rgba(99,102,241,0.18)">' + esc(initialesVeh(insp.vehImmat || (vehicule && vehicule.immat))) + '</div>'
      + '<div class="s25-head-body">'
      + '<div id="insp-drawer-title" class="s25-head-title">Inspection · ' + esc(insp.vehImmat || (vehicule && vehicule.immat) || '—') + '</div>'
      + '<div class="s25-head-meta">'
      + '<span>📅 ' + esc(fmtDate(insp.date)) + '</span>'
      + '<span>👤 ' + esc(insp.salNom || (salarie && salarie.nom) || '—') + '</span>'
      + '<span class="s25-pill pill-' + st.cls + '" style="margin-left:auto">' + esc(st.label) + '</span>'
      + '</div></div>';

    var kpis = '<div class="s25-kpi-row">'
      + '<div class="s25-kpi"><div class="kpi-label">Statut</div><div class="kpi-val" style="color:' + st.color + '">' + esc(st.label) + '</div></div>'
      + '<div class="s25-kpi"><div class="kpi-label">Points KO</div><div class="kpi-val">' + (Array.isArray(insp.pointsKO) ? insp.pointsKO.length : 0) + '</div></div>'
      + '<div class="s25-kpi"><div class="kpi-label">Photos</div><div class="kpi-val">' + photoCount + '</div></div>'
      + '<div class="s25-kpi"><div class="kpi-label">Kilométrage</div><div class="kpi-val">' + (insp.km ? esc(parseInt(insp.km, 10).toLocaleString('fr-FR')) : '—') + '</div></div>'
      + '</div>';

    var tabs = '<div class="s25-tabs" role="tablist">'
      + '<button type="button" class="s25-tab active" data-tab="vue" role="tab">Vue</button>'
      + '<button type="button" class="s25-tab" data-tab="photos" role="tab">Photos' + (photoCount ? ' (' + photoCount + ')' : '') + '</button>'
      + '<button type="button" class="s25-tab" data-tab="histo" role="tab">Historique</button>'
      + '</div>';

    var content = '<div class="s25-tab-content">'
      + renderVue(insp, vehicule, salarie)
      + renderPhotos(insp)
      + renderHistoriqueVehicule(insp, vehicule)
      + '</div>';

    var drawer = document.getElementById(DRAWER_ID);
    drawer.innerHTML = '<div class="s25-drawer-head">' + head + '</div>' + kpis + tabs + content;

    // Wire onglets
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

    // Re-resolve storage paths pour les photos (signed URLs)
    if (window.resolveStorageImages) {
      try { window.resolveStorageImages(drawer); } catch (_) {}
    }

    document.getElementById(OVERLAY_ID).classList.add('open');
  }
  window.ouvrirFiche360Inspection = ouvrir;

  // Refresh expose pour callers externes
  window.refreshDrawerInspection = function () {
    if (_currentInspId) {
      try { ouvrir(_currentInspId); } catch (_) {}
    }
  };
})();
