/**
 * MCA Logistics — Sprint 3 — Command Palette Cmd/K (actions rapides + navigation clavier) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4892-5137 (2026-05-16).
 */

/* ================================================================
   SPRINT 3 — COMMAND PALETTE (Cmd/Ctrl + K)
   Enrichit la recherche globale existante avec :
   - actions rapides (navigation, création)
   - suggestions par défaut à l'ouverture
   - navigation clavier ↑↓ Entrée
   Surcharge rechercheUniverselle() et ouvrirRechercheGlobale()
   sans casser leur API publique.
   ================================================================ */
(function() {
  const CMD_ACTIONS = [
    // Navigation
    { icon:'📊', label:'Dashboard',            cat:'Aller à', keys:['dashboard','accueil','home','pilotage'],    run:() => naviguerVers('dashboard') },
    { icon:'📦', label:'Livraisons',           cat:'Aller à', keys:['livraisons','courses','missions'],          run:() => naviguerVers('livraisons') },
    { icon:'📅', label:'Planning',             cat:'Aller à', keys:['planning','agenda','semaine'],              run:() => naviguerVers('planning') },
    { icon:'🔔', label:'Alertes',              cat:'Aller à', keys:['alertes','notifications'],                  run:() => naviguerVers('alertes') },
    { icon:'🧑‍💼', label:'Clients',            cat:'Aller à', keys:['clients','carnet'],                         run:() => naviguerVers('clients') },
    { icon:'🚐', label:'Véhicules',            cat:'Aller à', keys:['vehicules','véhicules','flotte','camions'], run:() => naviguerVers('vehicules') },
    { icon:'⛽', label:'Carburant',            cat:'Aller à', keys:['carburant','essence','fuel','pleins'],      run:() => naviguerVers('carburant') },
    { icon:'🔧', label:'Entretiens',           cat:'Aller à', keys:['entretiens','maintenance','revisions'],     run:() => naviguerVers('entretiens') },
    { icon:'🚗', label:'Inspections',          cat:'Aller à', keys:['inspections','controles','contrôles'],      run:() => naviguerVers('inspections') },
    { icon:'👥', label:'Salariés',             cat:'Aller à', keys:['salaries','salariés','équipe','equipe','staff'], run:() => naviguerVers('salaries') },
    { icon:'⏱️', label:'Heures & Km',          cat:'Aller à', keys:['heures','km','kilometres','temps'],         run:() => naviguerVers('heures') },
    { icon:'🚨', label:'Incidents',            cat:'Aller à', keys:['incidents','accidents','problemes'],        run:() => naviguerVers('incidents') },
    { icon:'💸', label:'Charges',              cat:'Aller à', keys:['charges','depenses','dépenses','couts'],    run:() => naviguerVers('charges') },
    { icon:'💰', label:'Rentabilité',          cat:'Aller à', keys:['rentabilite','rentabilité','marge','profit'], run:() => naviguerVers('rentabilite') },
    { icon:'📈', label:'Statistiques',         cat:'Aller à', keys:['statistiques','stats','analytics'],         run:() => naviguerVers('statistiques') },
    { icon:'⚙️', label:'Paramètres',           cat:'Aller à', keys:['parametres','paramètres','settings','config'], run:() => naviguerVers('parametres') },
    // Création
    { icon:'➕', label:'Nouvelle livraison',   cat:'Créer', hint:'Ctrl+N', keys:['nouvelle livraison','new livraison','ajouter livraison','creer livraison'], run:() => { if (typeof openModal === 'function') openModal('modal-livraison'); } },
    { icon:'💸', label:'Nouvelle charge',      cat:'Créer', keys:['nouvelle charge','ajouter charge'],          run:() => { if (typeof openModal === 'function') openModal('modal-charge'); } },
    { icon:'🔧', label:'Nouvel entretien',     cat:'Créer', keys:['nouvel entretien','ajouter entretien'],      run:() => { if (typeof openModal === 'function') openModal('modal-entretien'); } },
    { icon:'📅', label:'Gérer le planning',    cat:'Créer', keys:['planning','creer planning','ajouter planning'], run:() => { if (typeof openModal === 'function') openModal('modal-planning'); } },
    // Actions générales
    { icon:'🌙', label:'Basculer thème clair/sombre', cat:'Action', keys:['theme','thème','sombre','clair','dark','light','mode'], run:() => { if (typeof toggleTheme === 'function') toggleTheme(); } }
  ];

  function normalize(s) { return (s || '').toString().toLowerCase(); }

  function matcherActions(q) {
    const qn = normalize(q).trim();
    if (!qn) return CMD_ACTIONS.slice(0, 6);
    return CMD_ACTIONS.filter(function(a) {
      if (normalize(a.label).includes(qn)) return true;
      return a.keys.some(function(k) { return normalize(k).includes(qn); });
    }).slice(0, 8);
  }

  function rendrerActionRow(a, idx) {
    const hint = a.hint ? '<span class="cmd-action-hint">' + a.hint + '</span>' : '';
    const cat  = a.cat ? '<span class="cmd-action-cat">' + a.cat + '</span>' : '';
    return '<div class="cmd-action-row" data-cmd-action="' + idx + '" role="option" tabindex="-1">' +
             '<span class="cmd-action-icon">' + a.icon + '</span>' +
             '<span class="cmd-action-label">' + a.label + '</span>' +
             cat + hint +
           '</div>';
  }

  // BUG-025/026/027 fix : dispatcher whitelisté + escape HTML (plus de new Function, plus d'innerHTML brut)
  const CMD_ENTITY_HANDLERS = {
    rechercheOuvrirLivraison: function(id) { if (typeof rechercheOuvrirLivraison === 'function') rechercheOuvrirLivraison(id); },
    ouvrirEditSalarie: function(id) { if (typeof ouvrirEditSalarie === 'function') ouvrirEditSalarie(id); },
    ouvrirFicheVehiculeDepuisTableau: function(id) { if (typeof ouvrirFicheVehiculeDepuisTableau === 'function') ouvrirFicheVehiculeDepuisTableau(id); },
    rechercheOuvrirClient: function(id) { if (typeof rechercheOuvrirClient === 'function') rechercheOuvrirClient(id); }
  };
  function escCmd(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function calculerEntites(q) {
    try {
      const livraisons = typeof charger === 'function' ? (charger('livraisons') || []) : [];
      const salaries   = typeof charger === 'function' ? (charger('salaries')   || []) : [];
      const vehicules  = typeof charger === 'function' ? (charger('vehicules')  || []) : [];
      let clients = [];
      try { clients = loadSafe('clients', []); } catch (_) { clients = []; }

      const res = [];
      const qn = normalize(q);

      livraisons.filter(function(l) {
        return normalize(l.client).includes(qn) || normalize(l.numLiv).includes(qn) || normalize(l.chaufNom).includes(qn);
      }).slice(0, 4).forEach(function(l) {
        const sub = (typeof formatDateExport === 'function' ? formatDateExport(l.date) : (l.date || '')) +
                    ' · ' + (typeof euros === 'function' ? euros(l.prix || 0) : (l.prix || 0) + '€');
        res.push({
          label: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> ' + (l.numLiv || '') + ' — ' + (l.client || ''),
          sub: sub,
          handler: 'rechercheOuvrirLivraison',
          arg: l.id
        });
      });

      salaries.filter(function(s) {
        return normalize([s.nom, s.prenom, s.numero].filter(Boolean).join(' ')).includes(qn);
      }).slice(0, 3).forEach(function(s) {
        const nom = typeof getSalarieNomComplet === 'function' ? getSalarieNomComplet(s) : ((s.prenom || '') + ' ' + (s.nom || ''));
        res.push({
          label: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + nom,
          sub: 'N° ' + (s.numero || '—'),
          handler: 'ouvrirEditSalarie',
          arg: s.id
        });
      });

      vehicules.filter(function(v) {
        return normalize(v.immat).includes(qn) || normalize(v.modele).includes(qn);
      }).slice(0, 3).forEach(function(v) {
        res.push({
          label: '🚐 ' + (v.immat || ''),
          sub: v.modele || '',
          handler: 'ouvrirFicheVehiculeDepuisTableau',
          arg: v.id
        });
      });

      clients.filter(function(c) {
        return normalize([c.nom, c.prenom, c.tel].filter(Boolean).join(' ')).includes(qn);
      }).slice(0, 3).forEach(function(c) {
        res.push({
          label: '🧑‍💼 ' + (c.nom || ''),
          sub: c.adresse || c.tel || '',
          handler: 'rechercheOuvrirClient',
          arg: c.id
        });
      });

      return res;
    } catch (e) {
      console.warn('[cmd-palette] rechercherEntites', e);
      return [];
    }
  }

  function rendrerEntiteRow(r) {
    const sub = r.sub ? '<div class="cmd-entity-sub">' + escCmd(r.sub) + '</div>' : '';
    return '<div class="cmd-entity-row" data-cmd-handler="' + escCmd(r.handler) + '" data-cmd-arg="' + escCmd(r.arg) + '" role="option" tabindex="-1">' +
             '<div class="cmd-entity-main">' + escCmd(r.label) + '</div>' +
             sub +
           '</div>';
  }

  // --- Surcharge de rechercheUniverselle ---
  window.rechercheUniverselle = function(q) {
    const cont = document.getElementById('recherche-resultats');
    if (!cont) return;

    const actions = matcherActions(q);
    const entities = (q && q.length >= 2) ? calculerEntites(q) : [];

    let html = '';
    if (actions.length) {
      html += '<div class="cmd-section-label">' + (q ? 'Actions' : 'Raccourcis suggérés') + '</div>';
      html += actions.map(rendrerActionRow).join('');
    }
    if (entities.length) {
      html += '<div class="cmd-section-label">Résultats</div>';
      html += entities.map(rendrerEntiteRow).join('');
    }
    if (!html) {
      cont.innerHTML = '<div class="cmd-empty">Aucun résultat pour « ' + (q || '') + ' »</div>';
    } else {
      cont.innerHTML = html;
    }
    cont.style.display = 'block';

    // Bind actions
    cont.querySelectorAll('[data-cmd-action]').forEach(function(el) {
      const idx = parseInt(el.getAttribute('data-cmd-action'), 10);
      const act = actions[idx];
      el.onclick = function() {
        if (typeof fermerRechercheGlobale === 'function') fermerRechercheGlobale();
        if (act && typeof act.run === 'function') {
          try { act.run(); } catch (err) { console.warn('[cmd-palette]', err); }
        }
      };
    });

    // Bind entités (dispatcher whitelisté, plus de new Function)
    cont.querySelectorAll('[data-cmd-handler]').forEach(function(el) {
      const handler = el.getAttribute('data-cmd-handler') || '';
      const arg = el.getAttribute('data-cmd-arg') || '';
      el.onclick = function() {
        if (typeof fermerRechercheGlobale === 'function') fermerRechercheGlobale();
        const fn = CMD_ENTITY_HANDLERS[handler];
        if (typeof fn === 'function') {
          try { fn(arg); } catch (err) { console.warn('[cmd-palette]', err); }
        }
      };
    });
  };

  // --- Surcharge de ouvrirRechercheGlobale pour afficher suggestions par défaut ---
  const ouvrirOrig = window.ouvrirRechercheGlobale;
  window.ouvrirRechercheGlobale = function() {
    if (typeof ouvrirOrig === 'function') ouvrirOrig();
    setTimeout(function() {
      const input = document.getElementById('barre-recherche-univ');
      if (input) {
        window.rechercheUniverselle(input.value || '');
        setupCmdKeyboard(input);
      }
    }, 60);
  };

  // --- Navigation clavier ↑↓ Entrée ---
  function setupCmdKeyboard(input) {
    if (!input || input.dataset.cmdBound === '1') return;
    input.dataset.cmdBound = '1';

    input.addEventListener('keydown', function(e) {
      const cont = document.getElementById('recherche-resultats');
      if (!cont || cont.style.display === 'none') return;
      const rows = cont.querySelectorAll('[data-cmd-action],[data-cmd-entity]');
      if (!rows.length) return;

      const active = cont.querySelector('.cmd-row-active');
      let idx = active ? Array.prototype.indexOf.call(rows, active) : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = (idx + 1) % rows.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = idx <= 0 ? rows.length - 1 : idx - 1;
      } else if (e.key === 'Enter') {
        if (idx >= 0) {
          e.preventDefault();
          rows[idx].click();
        }
        return;
      } else {
        return;
      }

      rows.forEach(function(r) { r.classList.remove('cmd-row-active'); });
      if (rows[idx]) {
        rows[idx].classList.add('cmd-row-active');
        rows[idx].scrollIntoView({ block: 'nearest' });
      }
    });
  }

})();
