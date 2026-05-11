/**
 * MCA Logistics — UI charges recurrence (PC + mobile, parallel-safe)
 * --------------------------------------------------------------------
 * Ajoute le bouton 🔁 sur chaque ligne de charge existante (table PC + cards
 * mobile) sans toucher au modal "Nouvelle charge" (reserve a l'agent A).
 *
 * Strategie : MutationObserver ecoute les renders de la table charges
 * (`#tb-charges`) et de la liste mobile (`.m-charge-edit`), puis injecte
 * un bouton 🔁 a la fin de la cellule actions / card.
 *
 * Cycle :
 *   - Clic 🔁 -> ouvre `#modal-charge-recurrence` (HTML inline ci-dessous,
 *     injecte au boot dans <body>)
 *   - Submit -> update charge via repo + persist colonnes recurrence
 *   - Affichage : 🔁 gris si pas de recurrence, vert si recurrence_actif
 *
 * Toutes les fonctions au scope global (window.*) cf. CLAUDE.md.
 */
(function() {
  'use strict';

  // ============================================================
  // Helpers
  // ============================================================

  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function chargeById(id) {
    if (typeof window.charger !== 'function') return null;
    var arr = window.charger('charges') || [];
    return arr.find(function(c) { return c && c.id === id; }) || null;
  }

  function isInstance(c) { return !!(c && c.recurrenceTemplateId); }
  function isActiveTemplate(c) {
    return !!(c && c.recurrenceActif === true && c.recurrencePattern);
  }

  function recurrenceLabel(pattern) {
    if (pattern === 'mensuelle') return 'Mensuelle';
    if (pattern === 'trimestrielle') return 'Trimestrielle';
    if (pattern === 'annuelle') return 'Annuelle';
    return '';
  }

  // ============================================================
  // Injection du bouton 🔁 (PC : <td> actions, Mobile : sous la card)
  // ============================================================

  function ensurePcButtons() {
    var tb = document.getElementById('tb-charges');
    if (!tb) return;
    var rows = tb.querySelectorAll('tr');
    rows.forEach(function(tr) {
      // Repere la cellule actions : derniere td qui contient un bouton edit
      var tds = tr.querySelectorAll('td');
      if (!tds.length) return;
      var actionsCell = tds[tds.length - 1];
      if (!actionsCell || actionsCell.querySelector('button[data-recurrence-btn]')) return;

      var editBtn = actionsCell.querySelector('button[onclick^="ouvrirEditCharge"]');
      if (!editBtn) return;
      // Extrait l'id depuis l'onclick (pattern : ouvrirEditCharge('uuid'))
      var match = /ouvrirEditCharge\('([^']+)'\)/.exec(editBtn.getAttribute('onclick') || '');
      if (!match) return;
      var id = match[1];
      var c = chargeById(id);
      if (!c) return;

      var actif = isActiveTemplate(c);
      var instance = isInstance(c);
      var icon = actif ? '🔁' : (instance ? '↩' : '🔁');
      var color = actif ? '#28a745' : (instance ? '#17a2b8' : '#adb5bd');
      var title = actif
        ? 'Récurrence active : ' + recurrenceLabel(c.recurrencePattern)
        : (instance ? 'Instance générée depuis un template récurrent' : 'Configurer la récurrence');
      var btn = document.createElement('button');
      btn.className = 'btn-icon';
      btn.setAttribute('data-recurrence-btn', '1');
      btn.setAttribute('data-charge-id', id);
      btn.title = title;
      btn.style.color = color;
      btn.style.fontSize = '.95rem';
      btn.innerHTML = icon;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (instance && !actif) {
          // Sur une instance generee : on ouvre quand meme mais sur le template parent
          window.ouvrirChargeRecurrenceModal(c.recurrenceTemplateId);
        } else {
          window.ouvrirChargeRecurrenceModal(id);
        }
      });
      actionsCell.appendChild(btn);
    });
  }

  function ensureMobileButtons() {
    // Mobile : on attend que les cards .m-charge-edit existent. On rend
    // discret : un petit chip 🔁 dans le coin sup. droit de la card.
    var cards = document.querySelectorAll('.m-charge-edit[data-id]');
    cards.forEach(function(card) {
      if (card.querySelector('[data-recurrence-chip]')) return;
      var id = card.getAttribute('data-id');
      var c = chargeById(id);
      if (!c) return;
      var actif = isActiveTemplate(c);
      var instance = isInstance(c);
      // On affiche le chip uniquement si actif (template recurrent) ou instance
      // pour ne pas alourdir les cards "normales". Pour le configurer, l'utilisateur
      // passe par le bouton du detail (ouvert via long-press ou via la fiche).
      // Ici on injecte aussi un chip toujours present mais discret pour permettre
      // l'acces -> patron : icone faible opacite si pas configure.
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.setAttribute('data-recurrence-chip', '1');
      chip.setAttribute('data-charge-id', id);
      chip.style.cssText = 'position:absolute;top:6px;right:6px;background:transparent;border:none;color:'
        + (actif ? 'var(--m-green,#28a745)' : (instance ? 'var(--m-blue,#17a2b8)' : 'var(--m-text-muted,#6c757d)'))
        + ';font-size:.95rem;cursor:pointer;padding:4px;opacity:'
        + (actif || instance ? '1' : '.55') + ';z-index:2';
      chip.title = actif
        ? 'Récurrence ' + recurrenceLabel(c.recurrencePattern).toLowerCase() + ' active'
        : (instance ? 'Charge auto-générée' : 'Configurer la récurrence');
      chip.innerHTML = instance ? '↩' : '🔁';
      chip.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var target = (instance && !actif) ? c.recurrenceTemplateId : id;
        window.ouvrirChargeRecurrenceModal(target);
      });
      // La card a position:relative implicite sur son wrapper externe ; on
      // s'assure que le parent direct .m-card est positionne.
      if (getComputedStyle(card).position === 'static') {
        card.style.position = 'relative';
      }
      card.appendChild(chip);
    });
  }

  // ============================================================
  // Modal (PC) + bottom-sheet (mobile, meme template HTML)
  // ============================================================

  function ensureModalDom() {
    if (document.getElementById('modal-charge-recurrence')) return;
    var div = document.createElement('div');
    div.id = 'modal-charge-recurrence';
    div.className = 'modal';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-labelledby', 'modal-charge-recurrence-title');
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:10000;'
      + 'background:rgba(0,0,0,0.5);align-items:center;justify-content:center;padding:16px';
    div.innerHTML = ''
      + '<div class="modal-content" style="background:var(--card-bg,#fff);border-radius:14px;'
      +   'max-width:480px;width:100%;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.2);max-height:90vh;overflow:auto">'
      + '<h3 id="modal-charge-recurrence-title" style="margin:0 0 14px;font-size:1.15rem">Récurrence de la charge</h3>'
      + '<div id="charge-recurrence-context" style="font-size:.85rem;color:var(--text-muted);margin-bottom:14px;padding:10px;background:var(--bg-soft,#f8f9fa);border-radius:8px"></div>'
      + '<div id="charge-recurrence-instances-info" style="display:none;font-size:.78rem;color:var(--text-muted);margin-bottom:12px"></div>'
      + '<div style="display:flex;flex-direction:column;gap:12px">'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:.85rem">'
      +   '<span>Fréquence</span>'
      +   '<select id="charge-recurrence-pattern" aria-label="frequence recurrence">'
      +     '<option value="">Aucune (charge ponctuelle)</option>'
      +     '<option value="mensuelle">Mensuelle</option>'
      +     '<option value="trimestrielle">Trimestrielle</option>'
      +     '<option value="annuelle">Annuelle</option>'
      +   '</select>'
      + '</label>'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:.85rem">'
      +   '<span>Jour du mois (1-31)</span>'
      +   '<input type="number" id="charge-recurrence-jour" min="1" max="31" placeholder="Ex : 5" aria-label="jour du mois recurrence" />'
      +   '<span style="font-size:.74rem;color:var(--text-muted)">Si supérieur au nombre de jours du mois cible (ex : 31 en février), cale au dernier jour.</span>'
      + '</label>'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:.85rem">'
      +   '<span>Date de fin (optionnelle)</span>'
      +   '<input type="date" id="charge-recurrence-date-fin" aria-label="date fin recurrence" />'
      + '</label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:.9rem;cursor:pointer">'
      +   '<input type="checkbox" id="charge-recurrence-actif" aria-label="activer recurrence" />'
      +   '<span>Activer la génération automatique</span>'
      + '</label>'
      + '</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap">'
      + '<button class="btn-secondary" type="button" onclick="fermerChargeRecurrenceModal()">Annuler</button>'
      + '<button class="btn-primary" type="button" onclick="enregistrerChargeRecurrence()">Enregistrer</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(div);
  }

  function ouvrirChargeRecurrenceModal(chargeId) {
    ensureModalDom();
    var c = chargeById(chargeId);
    if (!c) {
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('⚠️ Charge introuvable', 'error');
      }
      return;
    }
    if (c.recurrenceTemplateId) {
      // C'est une instance generee : on edite le template parent.
      var parent = chargeById(c.recurrenceTemplateId);
      if (parent) c = parent;
    }
    var modal = document.getElementById('modal-charge-recurrence');
    var ctx = document.getElementById('charge-recurrence-context');
    var libelle = (c.description || c.categorie || 'Charge') + ' — ' + (c.fournisseur || '');
    var montant = (typeof window.euros === 'function')
      ? window.euros(c.montant || 0)
      : ((c.montant || 0) + ' €');
    if (ctx) {
      ctx.innerHTML = '<strong>' + escHtml(libelle.trim()) + '</strong><br>'
        + 'Montant : ' + escHtml(montant)
        + ' · Date de référence : ' + escHtml(c.date || '');
    }
    // Compte les instances deja generees
    var instances = (window.charger ? (window.charger('charges') || []) : [])
      .filter(function(x) { return x && x.recurrenceTemplateId === c.id; });
    var info = document.getElementById('charge-recurrence-instances-info');
    if (info) {
      if (instances.length > 0) {
        info.style.display = 'block';
        info.innerHTML = '🌀 ' + instances.length + ' occurrence(s) déjà générée(s) depuis ce template.';
      } else {
        info.style.display = 'none';
      }
    }

    document.getElementById('charge-recurrence-pattern').value = c.recurrencePattern || '';
    var defaultJour = c.recurrenceJourDuMois;
    if (!defaultJour && c.date) {
      defaultJour = parseInt(String(c.date).split('-')[2], 10) || 1;
    }
    document.getElementById('charge-recurrence-jour').value = defaultJour || '';
    document.getElementById('charge-recurrence-date-fin').value = c.recurrenceDateFin || '';
    document.getElementById('charge-recurrence-actif').checked = c.recurrenceActif === true;

    modal.dataset.chargeId = c.id;
    modal.style.display = 'flex';
    setTimeout(function() {
      var sel = document.getElementById('charge-recurrence-pattern');
      if (sel) sel.focus();
    }, 50);
  }

  function fermerChargeRecurrenceModal() {
    var m = document.getElementById('modal-charge-recurrence');
    if (m) m.style.display = 'none';
  }

  async function enregistrerChargeRecurrence() {
    var modal = document.getElementById('modal-charge-recurrence');
    if (!modal) return;
    var id = modal.dataset.chargeId;
    if (!id) return;
    var c = chargeById(id);
    if (!c) return;

    var pattern = (document.getElementById('charge-recurrence-pattern').value || '').trim();
    var jourRaw = parseInt(document.getElementById('charge-recurrence-jour').value, 10);
    var dateFin = (document.getElementById('charge-recurrence-date-fin').value || '').trim();
    var actif = !!document.getElementById('charge-recurrence-actif').checked;

    // Validation
    if (pattern && (!jourRaw || jourRaw < 1 || jourRaw > 31)) {
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('⚠️ Jour du mois requis (1-31)', 'error');
      }
      return;
    }
    if (!pattern) {
      // Desactive : on nettoie tout
      actif = false;
    }

    c.recurrencePattern = pattern || '';
    c.recurrenceJourDuMois = pattern ? jourRaw : null;
    c.recurrenceDateFin = dateFin || '';
    c.recurrenceActif = actif;

    // Persist : reuse helper sauvegarder + adapter (jsToDb maps les colonnes)
    try {
      if (typeof window.sauvegarder === 'function') {
        var arr = (window.charger('charges') || []).map(function(x) {
          return x && x.id === c.id ? Object.assign({}, x, {
            recurrencePattern: c.recurrencePattern,
            recurrenceJourDuMois: c.recurrenceJourDuMois,
            recurrenceDateFin: c.recurrenceDateFin,
            recurrenceActif: c.recurrenceActif,
          }) : x;
        });
        window.sauvegarder('charges', arr);
      }
      // Push direct adapter Supabase si dispo
      if (window.DelivProEntityAdapters && window.DelivProEntityAdapters.charges
          && typeof window.DelivProEntityAdapters.charges.push === 'function') {
        await window.DelivProEntityAdapters.charges.push(c);
      }
      if (typeof window.afficherToast === 'function') {
        window.afficherToast(actif ? '✅ Récurrence activée' : '✅ Récurrence enregistrée');
      }
      fermerChargeRecurrenceModal();
      // Re-render pour mettre a jour les chips
      if (typeof window.afficherCharges === 'function') window.afficherCharges();
      if (window.M && typeof window.M.go === 'function' && window.M.state && window.M.state.route === 'charges') {
        window.M.go('charges');
      }
    } catch (e) {
      console.warn('[charges-recurrence] save failed', e);
      if (typeof window.afficherToast === 'function') {
        window.afficherToast('❌ Erreur lors de l\'enregistrement', 'error');
      }
    }
  }

  // ============================================================
  // Boot : MutationObserver pour injection automatique sur chaque render
  // ============================================================

  function refreshAll() {
    try { ensurePcButtons(); } catch (_) {}
    try { ensureMobileButtons(); } catch (_) {}
  }

  function boot() {
    ensureModalDom();
    refreshAll();

    // Observer global : a chaque mutation dans tb-charges OU dans .m-app
    // (mobile root), on relance le scan. Throttle simple via requestAnimationFrame.
    var pending = false;
    function scheduled() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function() {
        pending = false;
        refreshAll();
      });
    }

    var obs = new MutationObserver(scheduled);
    obs.observe(document.body, { childList: true, subtree: true });

    // Listener fermeture par clic backdrop
    var modal = document.getElementById('modal-charge-recurrence');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) fermerChargeRecurrenceModal();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('modal-charge-recurrence');
        if (m && m.style.display !== 'none') fermerChargeRecurrenceModal();
      }
    });
  }

  // Expose au scope global (cf. CLAUDE.md : onclick="X()" requis)
  window.ouvrirChargeRecurrenceModal = ouvrirChargeRecurrenceModal;
  window.fermerChargeRecurrenceModal = fermerChargeRecurrenceModal;
  window.enregistrerChargeRecurrence = enregistrerChargeRecurrence;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
