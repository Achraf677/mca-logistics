/* Phase 60 V7 H21 — Équipe Vue d'ensemble : cards chauffeurs mockup-aligned.
   Rend des .member-card dans #equipe-overview-grid à partir de salaries +
   livraisons (30j) + vehicules. Affiche véhicule affecté, livraisons 30j,
   taux de ponctualité, échéance permis. */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function initials(s) {
    if (!s || typeof s !== 'string') return '?';
    var parts = s.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatDate(s) {
    if (!s) return '—';
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) { return '—'; }
  }

  function daysUntil(dateStr) {
    if (!dateStr) return Infinity;
    try {
      var ms = new Date(dateStr).getTime() - Date.now();
      return Math.floor(ms / 86400000);
    } catch (_) { return Infinity; }
  }

  function badgeForSalarie(s) {
    if (s.actif === false) return '<span class="badge alert">Inactif</span>';
    var permisDays = daysUntil(s.datePermis || s.permisExpire);
    if (permisDays >= 0 && permisDays <= 30) {
      return '<span class="badge warn">Permis ' + permisDays + 'j</span>';
    }
    if (permisDays >= 0 && permisDays <= 60) {
      return '<span class="badge warn">Permis ' + permisDays + 'j</span>';
    }
    return '<span class="badge ok">Actif</span>';
  }

  function getVehiculePourSal(salId, vehicules) {
    var v = vehicules.find(function (x) { return x && x.salId === salId; });
    return v ? (v.modele || v.immat || v.marque || '—') : '—';
  }

  function getLivraisonsCount30j(salId, salNom, livraisons) {
    var seuil = Date.now() - 30 * 86400000;
    return livraisons.filter(function (l) {
      if (!l) return false;
      var d = new Date(l.date || l.dateLivraison || '');
      if (isNaN(d.getTime()) || d.getTime() < seuil) return false;
      return l.chaufId === salId || l.chaufNom === salNom || l.salId === salId;
    }).length;
  }

  function getPonctualite(salId, salNom, livraisons) {
    var seuil = Date.now() - 30 * 86400000;
    var livs = livraisons.filter(function (l) {
      if (!l) return false;
      var d = new Date(l.date || l.dateLivraison || '');
      if (isNaN(d.getTime()) || d.getTime() < seuil) return false;
      return l.chaufId === salId || l.chaufNom === salNom || l.salId === salId;
    });
    if (!livs.length) return '—';
    var aLheure = livs.filter(function (l) {
      var s = (l.statut || l.status || '').toLowerCase();
      return s === 'livre' || s === 'livré' || s === 'livree' || s === 'livrée';
    }).length;
    return Math.round(aLheure / livs.length * 100) + '%';
  }

  function buildCard(s, vehicules, livraisons) {
    var nomComplet = ((s.nom || '') + ' ' + (s.prenom || '')).trim() || 'Salarié';
    var role = s.role === 'admin' ? 'Admin' : ('Chauffeur' + (s.categoriesPermis ? ' · Cat. ' + s.categoriesPermis : ''));
    var veh = getVehiculePourSal(s.id, vehicules);
    var nbLivs = getLivraisonsCount30j(s.id, nomComplet, livraisons);
    var ponc = getPonctualite(s.id, nomComplet, livraisons);
    var permis = formatDate(s.datePermis || s.permisExpire);
    return (
      '<div class="member-card" data-sal-id="' + s.id + '">' +
        '<div class="member-head">' +
          '<div class="member-avatar">' + initials(nomComplet) + '</div>' +
          '<div class="member-info">' +
            '<div class="member-name">' + nomComplet + '</div>' +
            '<div class="member-role">' + role + '</div>' +
          '</div>' +
          badgeForSalarie(s) +
        '</div>' +
        '<div class="member-body">' +
          '<div class="member-stats">' +
            '<div class="stat-row"><span class="stat-label">Véhicule</span><span class="stat-value">' + veh + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Livraisons (30j)</span><span class="stat-value">' + nbLivs + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Taux de ponctualité</span><span class="stat-value">' + ponc + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Permis expire</span><span class="stat-value">' + permis + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="member-foot">' +
          '<button class="btn-secondary" style="flex:1" onclick="window.EquipeHub&&window.EquipeHub.ouvrirOnglet(\'planning\')">Planning</button>' +
          '<button class="btn-secondary" style="flex:1" onclick="window.ouvrirEditSalarie&&window.ouvrirEditSalarie(\'' + s.id + '\')">Détails</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderOverview() {
    var grid = document.getElementById('equipe-overview-grid');
    if (!grid) return;
    var salaries = lire('salaries').filter(function (s) { return s && s.actif !== false; });
    var vehicules = lire('vehicules');
    var livraisons = lire('livraisons');
    if (!salaries.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:48px;text-align:center;color:var(--text-muted)">Aucun chauffeur actif</div>';
      return;
    }
    grid.innerHTML = salaries.map(function (s) { return buildCard(s, vehicules, livraisons); }).join('');
  }

  // Expose pour Equipe tabs
  if (window.EquipeHub) {
    window.EquipeHub.ouvrirOngletOverview = function () {
      // Show overview grid, hide tab content
      document.querySelectorAll('.tabs-bar .tab-btn').forEach(function (b) { b.classList.remove('active'); });
      var btn = document.getElementById('equipe-tab-overview');
      if (btn) btn.classList.add('active');
      var grid = document.getElementById('equipe-overview-grid');
      if (grid) grid.style.display = '';
      renderOverview();
    };
  } else {
    // EquipeHub pas encore chargé : attendre via interval
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.EquipeHub) {
        window.EquipeHub.ouvrirOngletOverview = function () {
          document.querySelectorAll('.tabs-bar .tab-btn').forEach(function (b) { b.classList.remove('active'); });
          var btn = document.getElementById('equipe-tab-overview');
          if (btn) btn.classList.add('active');
          renderOverview();
        };
        clearInterval(iv);
      } else if (tries > 20) {
        clearInterval(iv);
      }
    }, 250);
  }

  // Auto-render on page show
  function tryRender() {
    if (!document.getElementById('equipe-overview-grid')) return false;
    renderOverview();
    if (!window.__refonteEquipeOverviewIv) {
      window.__refonteEquipeOverviewIv = setInterval(renderOverview, 8000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryRender()) {
        var r = 0;
        var iv2 = setInterval(function () { if (tryRender() || ++r > 20) clearInterval(iv2); }, 500);
      }
    });
  } else {
    if (!tryRender()) {
      var r = 0;
      var iv2 = setInterval(function () { if (tryRender() || ++r > 20) clearInterval(iv2); }, 500);
    }
  }

  window.refonteEquipeOverview = renderOverview;
})();
