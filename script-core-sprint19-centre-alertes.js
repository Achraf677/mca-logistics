/**
 * MCA Logistics — Sprint 19 — Centre d'alertes unifié (alertes ⊕ incidents, timeline, auto-clôture) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4916-5379 (2026-05-16).
 */

/* ============================================================
   SPRINT 19 — Centre d'alertes unifié (Alertes ⊕ Incidents)
   - Agrège : alertes_admin (système), incidents, dérivées calculées
   - Timeline chronologique unique avec filtres source/gravité/statut
   - Auto-clôture quand la cause disparaît
   - Refresh auto toutes les 60s
   ============================================================ */
(function installS19Centre(){
  if (window.__s19Installed) return;
  window.__s19Installed = true;

  const loadJSON = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const saveJSON = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) { /* fail-silent: localStorage quota / mode privé */ } };
  const fmtEuro = (n) => (typeof window.euros === 'function') ? window.euros(n) : ((parseFloat(n)||0).toFixed(2) + ' €');
  const esc = window.escapeHtml;
  const daysBetween = (d1, d2) => Math.floor((d2 - d1) / 86400000);

  /* ---------- Collectors : retourne un tableau unifié d'alertes ---------- */
  function collectSysteme() {
    const arr = loadJSON('alertes_admin');
    return arr.map(a => ({
      id: 'sys_' + a.id,
      rawId: a.id,
      source: 'systeme',
      sourceLabel: 'Système',
      sourceIcon: '🤖',
      type: a.type || 'autre',
      title: a.message || a.type || 'Alerte',
      sub: a.salNom || a.client || '',
      gravite: graviteFromType(a.type),
      statut: a.traitee ? 'traite' : 'ouvert',
      creeLe: a.creeLe || new Date().toISOString(),
      meta: a.meta || {},
      actions: [
        ...(a.traitee ? [] : [{ icon:'✅', label:'Marquer traité', handler:"window.s19MarquerTraitee('" + a.id + "')" }]),
        ...(a.traitee ? [{ icon:'↺', label:'Rouvrir', handler:"window.s19Rouvrir('" + a.id + "')" }] : []),
        { icon:'🗑️', label:'Supprimer', handler:"window.s19Supprimer('" + a.id + "')", danger:true }
      ]
    }));
  }

  function graviteFromType(type) {
    if (!type) return 'moyen';
    if (/_expire$|expire$/.test(type)) return 'critique';
    if (/_proche$|proche$/.test(type)) return 'haute';
    if (/prix_manquant/.test(type)) return 'haute';
    return 'moyen';
  }

  function collectIncidents() {
    const arr = loadJSON('incidents');
    return arr.map(i => ({
      id: 'inc_' + i.id,
      rawId: i.id,
      source: 'incident',
      sourceLabel: 'Incident',
      sourceIcon: '🚨',
      type: 'incident_' + (i.gravite || 'moyen'),
      title: 'Incident' + (i.client ? ' · ' + i.client : ''),
      sub: (i.description || '').slice(0, 140) + ((i.description||'').length > 140 ? '…' : ''),
      gravite: i.gravite === 'grave' ? 'critique' : (i.gravite === 'faible' ? 'basse' : 'moyen'),
      statut: i.statut === 'traite' ? 'traite' : (i.statut === 'encours' ? 'encours' : 'ouvert'),
      creeLe: i.creeLe || i.date || new Date().toISOString(),
      meta: { incidentId: i.id, salNom: i.salNom, chaufNom: i.chaufNom, client: i.client },
      actions: [
        { icon:'🟡', label:'En cours', handler:"window.s19IncidentStatut('" + i.id + "','encours')" },
        { icon:'✅', label:'Traité', handler:"window.s19IncidentStatut('" + i.id + "','traite')" },
        { icon:'🗑️', label:'Supprimer', handler:"window.s19IncidentSupprimer('" + i.id + "')", danger:true }
      ]
    }));
  }

  function collectFacturesRetard() {
    const factures = loadJSON('factures').filter(f => f.statut !== 'annulée');
    const paiements = loadJSON('paiements').filter(p => p.sens === 'in');
    const clients = loadJSON('clients');
    const today = new Date();
    const out = [];
    factures.forEach(f => {
      if (!f.dateLivraison && !f.dateEmission) return;
      const client = clients.find(c => c.id === f.clientId) || null;
      const delai = (client && client.delaiPaiementJours != null) ? parseInt(client.delaiPaiementJours, 10) : 30;
      const dBase = new Date(f.dateLivraison || f.dateEmission);
      const dEch = new Date(dBase); dEch.setDate(dEch.getDate() + delai);
      const payeSum = paiements.filter(p => p.factureId === f.id).reduce((s,p) => s + (parseFloat(p.montant)||0), 0);
      const restant = (parseFloat(f.montantTTC)||0) - payeSum;
      if (restant <= 0.01) return;
      const jRetard = daysBetween(dEch, today);
      if (jRetard <= 0) return;
      let grav = 'moyen';
      if (jRetard > 60) grav = 'critique';
      else if (jRetard > 30) grav = 'haute';
      out.push({
        id: 'fac_' + f.id,
        rawId: f.id,
        source: 'facture',
        sourceLabel: 'Facture impayée',
        sourceIcon: '💶',
        type: 'facture_retard',
        title: 'Facture ' + (f.numero || f.id.slice(0,6)) + ' en retard de ' + jRetard + ' j',
        sub: (client ? client.nom : (f.client || 'Client inconnu')) + ' · reste ' + fmtEuro(restant),
        gravite: grav,
        statut: 'ouvert',
        creeLe: dEch.toISOString(),
        meta: { factureId: f.id, clientId: f.clientId, restant: restant, jRetard: jRetard },
        actions: [
          { icon:'🔗', label:'Voir facture', handler:"window.s19GoFacture('" + f.id + "')" },
          { icon:'💳', label:'Encaisser', handler:"window.s19EncaisserFacture('" + f.id + "')" }
        ]
      });
    });
    return out;
  }

  function collectFournisseursDu() {
    const fourns = loadJSON('fournisseurs');
    const charges = loadJSON('charges');
    const carburants = loadJSON('carburant');
    const entretiens = loadJSON('entretiens');
    const paiements = loadJSON('paiements').filter(p => p.sens === 'out');
    const today = new Date();
    const out = [];
    fourns.forEach(f => {
      const ch = charges.filter(x => x.fournisseurId === f.id);
      const ca = carburants.filter(x => x.fournisseurId === f.id);
      const en = entretiens.filter(x => x.fournisseurId === f.id);
      const pa = paiements.filter(p => p.fournisseurId === f.id);
      const depense = ch.reduce((s,x)=>s+(parseFloat(x.montant)||0),0)
                    + ca.reduce((s,x)=>s+(parseFloat(x.montant)||0),0)
                    + en.reduce((s,x)=>s+(parseFloat(x.cout)||0),0);
      const paye = pa.reduce((s,x)=>s+(parseFloat(x.montant)||0),0);
      const solde = depense - paye;
      if (solde <= 0.01) return;
      const delai = (f.delaiPaiementJours != null) ? parseInt(f.delaiPaiementJours, 10) : 30;
      const items = [...ch, ...ca, ...en].sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
      const oldest = items[0];
      if (!oldest || !oldest.date) return;
      const dEch = new Date(oldest.date); dEch.setDate(dEch.getDate() + delai);
      const jRetard = daysBetween(dEch, today);
      if (jRetard <= 0) return;
      let grav = 'moyen';
      if (jRetard > 60) grav = 'critique';
      else if (jRetard > 15) grav = 'haute';
      out.push({
        id: 'frs_' + f.id,
        rawId: f.id,
        source: 'fournisseur',
        sourceLabel: 'Fournisseur à payer',
        sourceIcon: '🏭',
        type: 'fournisseur_du',
        title: f.nom + ' · dû depuis ' + jRetard + ' j',
        sub: 'Solde à payer ' + fmtEuro(solde),
        gravite: grav,
        statut: 'ouvert',
        creeLe: dEch.toISOString(),
        meta: { fournisseurId: f.id, solde: solde },
        actions: [
          { icon:'🔗', label:'Voir fournisseur', handler:"window.s19GoFournisseur('" + f.id + "')" }
        ]
      });
    });
    return out;
  }

  function collectLivraisonsSansPrix() {
    const livs = loadJSON('livraisons');
    const today = new Date();
    return livs.filter(l => {
      const prix = parseFloat(l.prix) || 0;
      const prixHT = parseFloat(l.prixHT) || 0;
      return prix === 0 && prixHT === 0;
    }).map(l => ({
      id: 'liv_' + l.id,
      rawId: l.id,
      source: 'livraison',
      sourceLabel: 'Livraison sans prix',
      sourceIcon: '📦',
      type: 'livraison_sans_prix',
      title: 'Livraison sans prix · ' + (l.client || 'Client inconnu'),
      sub: (l.date || '') + (l.chaufNom ? ' · ' + l.chaufNom : ''),
      gravite: 'haute',
      statut: 'ouvert',
      creeLe: l.creeLe || l.date || today.toISOString(),
      meta: { livId: l.id },
      actions: [
        { icon:'🔗', label:'Ouvrir livraison', handler:"window.s19GoLivraison('" + l.id + "')" }
      ]
    }));
  }

  /* ---------- Agrégation + filtres ---------- */
  function collectAll() {
    let list = [];
    try { list = list.concat(collectSysteme()); } catch(e){ console.warn('[S19] systeme', e); }
    try { list = list.concat(collectIncidents()); } catch(e){ console.warn('[S19] incidents', e); }
    try { list = list.concat(collectFacturesRetard()); } catch(e){ console.warn('[S19] factures', e); }
    try { list = list.concat(collectFournisseursDu()); } catch(e){ console.warn('[S19] fournisseurs', e); }
    try { list = list.concat(collectLivraisonsSansPrix()); } catch(e){ console.warn('[S19] livraisons', e); }
    list.sort((a,b) => new Date(b.creeLe) - new Date(a.creeLe));
    return list;
  }

  const GRAV_ORDER = { critique: 4, haute: 3, moyen: 2, basse: 1 };
  const GRAV_LABEL = { critique: 'Critique', haute: 'Haute', moyen: 'Moyenne', basse: 'Basse' };
  const SOURCE_LABELS = {
    systeme: 'Système auto',
    incident: 'Incidents',
    facture: 'Factures clients',
    fournisseur: 'Fournisseurs',
    livraison: 'Livraisons'
  };

  function applyFilters(list) {
    const q = (document.getElementById('s19-search')?.value || '').trim().toLowerCase();
    const fSrc = document.getElementById('s19-filter-source')?.value || '';
    const fGrav = document.getElementById('s19-filter-gravite')?.value || '';
    const fStat = document.getElementById('s19-filter-statut')?.value || 'ouvert';
    return list.filter(a => {
      if (fStat === 'ouvert' && a.statut === 'traite') return false;
      if (fStat === 'traite' && a.statut !== 'traite') return false;
      if (fSrc && a.source !== fSrc) return false;
      if (fGrav && a.gravite !== fGrav) return false;
      if (q) {
        const hay = (a.title + ' ' + a.sub + ' ' + a.sourceLabel).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ---------- Render ---------- */
  function renderCentre() {
    const host = document.getElementById('s19-centre-body');
    if (!host) return;
    const all = collectAll();
    const filtered = applyFilters(all);

    // KPIs (basés sur TOUT, pas filtré)
    const actifs = all.filter(a => a.statut !== 'traite');
    const kCrit = actifs.filter(a => a.gravite === 'critique').length;
    const kHaute = actifs.filter(a => a.gravite === 'haute').length;
    const kMoyen = actifs.filter(a => a.gravite === 'moyen').length;
    const kTr = all.filter(a => a.statut === 'traite').length;
    const kpi = document.getElementById('s19-kpis');
    if (kpi) {
      kpi.innerHTML =
        '<div class="s19-kpi s19-kpi-critique"><div class="s19-kpi-val">' + kCrit + '</div><div class="s19-kpi-lbl">Critiques</div></div>' +
        '<div class="s19-kpi s19-kpi-haute"><div class="s19-kpi-val">' + kHaute + '</div><div class="s19-kpi-lbl">Hautes</div></div>' +
        '<div class="s19-kpi s19-kpi-moyen"><div class="s19-kpi-val">' + kMoyen + '</div><div class="s19-kpi-lbl">Moyennes</div></div>' +
        '<div class="s19-kpi s19-kpi-traitee"><div class="s19-kpi-val">' + kTr + '</div><div class="s19-kpi-lbl">✅ Traitées</div></div>';
    }

    // Badge nav
    const badgeNav = document.getElementById('badge-alertes');
    if (badgeNav) {
      const n = actifs.length;
      badgeNav.textContent = n > 0 ? n : '';
      badgeNav.style.display = n > 0 ? '' : 'none';
    }
    const badgeIncNav = document.getElementById('badge-incidents-nav');
    if (badgeIncNav) { badgeIncNav.style.display = 'none'; }

    if (!filtered.length) {
      host.innerHTML = '<div class="s19-empty">' +
        (all.length ? '<div class="s19-empty-ic"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:.6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div><strong>Aucune alerte ne correspond</strong></div><div style="color:var(--text-muted);font-size:.86rem">Modifiez vos filtres pour voir d\'autres résultats.</div>'
                    : '<div class="s19-empty-ic"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#06d6a0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><strong>Tout est nickel</strong></div><div style="color:var(--text-muted);font-size:.86rem">Aucune alerte active — le système surveille en continu.</div>') +
        '</div>';
      return;
    }

    host.innerHTML = filtered.map(a => {
      const rel = relTime(a.creeLe);
      const gravClass = 's19-card-' + a.gravite;
      const statutBadge = a.statut === 'traite' ? '<span class="s19-badge s19-badge-traite">✅ Traité</span>'
                        : a.statut === 'encours' ? '<span class="s19-badge s19-badge-encours">En cours</span>'
                        : '';
      const actions = (a.actions || []).map(act => {
        const cls = act.danger ? 's19-act s19-act-danger' : 's19-act';
        return '<button class="' + cls + '" onclick="' + act.handler + '" title="' + esc(act.label) + '">' + act.icon + ' ' + esc(act.label) + '</button>';
      }).join('');
      return '<div class="s19-card ' + gravClass + (a.statut === 'traite' ? ' s19-card-traite' : '') + '">' +
        '<div class="s19-card-icn">' + a.sourceIcon + '</div>' +
        '<div class="s19-card-body">' +
          '<div class="s19-card-head">' +
            '<strong>' + esc(a.title) + '</strong>' +
            '<span class="s19-card-src">' + esc(a.sourceLabel) + '</span>' +
            '<span class="s19-card-grav s19-grav-' + a.gravite + '">' + (GRAV_LABEL[a.gravite] || a.gravite) + '</span>' +
            statutBadge +
          '</div>' +
          (a.sub ? '<div class="s19-card-sub">' + esc(a.sub) + '</div>' : '') +
          '<div class="s19-card-foot">' +
            '<span class="s19-card-time">' + rel + '</span>' +
            '<div class="s19-card-acts">' + actions + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function relTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return 'il y a ' + Math.floor(diff/60) + ' min';
    if (diff < 86400) return 'il y a ' + Math.floor(diff/3600) + ' h';
    if (diff < 2592000) return 'il y a ' + Math.floor(diff/86400) + ' j';
    return d.toLocaleDateString('fr-FR');
  }

  /* ---------- Auto-clôture ---------- */
  function autoCloture() {
    let changed = false;
    const alertes = loadJSON('alertes_admin');
    const paiements = loadJSON('paiements').filter(p => p.sens === 'in');
    const livs = loadJSON('livraisons');
    alertes.forEach(a => {
      if (a.traitee) return;
      if (a.type === 'prix_manquant' && a.meta?.livId) {
        const l = livs.find(x => x.id === a.meta.livId);
        if (l && ((parseFloat(l.prix)||0) > 0 || (parseFloat(l.prixHT)||0) > 0)) {
          a.traitee = true; a.traiteLe = new Date().toISOString(); a.autoCloture = true;
          changed = true;
        }
      }
    });
    if (changed) saveJSON('alertes_admin', alertes);
    return changed;
  }

  /* ---------- Actions ---------- */
  window.s19MarquerTraitee = function(rawId) {
    const arr = loadJSON('alertes_admin');
    const a = arr.find(x => x.id === rawId);
    if (a) { a.traitee = true; a.traiteLe = new Date().toISOString(); saveJSON('alertes_admin', arr); }
    renderCentre();
    if (typeof window.afficherToast === 'function') window.afficherToast('✅ Marquée traitée','success');
  };
  window.s19Rouvrir = function(rawId) {
    const arr = loadJSON('alertes_admin');
    const a = arr.find(x => x.id === rawId);
    if (a) { a.traitee = false; delete a.traiteLe; saveJSON('alertes_admin', arr); }
    renderCentre();
  };
  window.s19Supprimer = async function(rawId) {
    const ok = await confirmDialog('Supprimer définitivement cette alerte ?', { titre:'Supprimer', icone:'🗑️', btnLabel:'Supprimer' });
    if (!ok) return;
    saveJSON('alertes_admin', loadJSON('alertes_admin').filter(x => x.id !== rawId));
    renderCentre();
  };
  window.s19IncidentStatut = function(rawId, statut) {
    const arr = loadJSON('incidents');
    const i = arr.find(x => x.id === rawId);
    if (i) { i.statut = statut; saveJSON('incidents', arr); }
    renderCentre();
    if (typeof window.afficherToast === 'function') window.afficherToast('✅ Statut incident mis à jour','success');
  };
  window.s19IncidentSupprimer = async function(rawId) {
    const ok = await confirmDialog('Supprimer cet incident ?', { titre:'Supprimer', icone:'🚨', btnLabel:'Supprimer' });
    if (!ok) return;
    saveJSON('incidents', loadJSON('incidents').filter(x => x.id !== rawId));
    renderCentre();
  };
  window.s19GoFacture = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('facturation');
    setTimeout(() => { if (typeof window.ouvrirFacture === 'function') window.ouvrirFacture(id); }, 300);
  };
  window.s19EncaisserFacture = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('encaissements');
    setTimeout(() => { if (typeof window.ouvrirModalEncaissement === 'function') window.ouvrirModalEncaissement(id); }, 300);
  };
  window.s19GoFournisseur = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('fournisseurs');
    setTimeout(() => { if (typeof window.ouvrirHistoriqueFournisseur === 'function') window.ouvrirHistoriqueFournisseur(id); }, 300);
  };
  window.s19GoLivraison = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('livraisons');
    setTimeout(() => { if (typeof window.ouvrirEditLivraison === 'function') window.ouvrirEditLivraison(id); }, 300);
  };
  window.s19RefreshNow = function() {
    autoCloture();
    renderCentre();
    if (typeof window.afficherToast === 'function') window.afficherToast('Centre d\'alertes rafraîchi','success');
  };
  window.s19RenderCentre = renderCentre;

  /* ---------- Injection UI au-dessus de page-alertes ---------- */
  function injecterUI() {
    const page = document.getElementById('page-alertes');
    if (!page || document.getElementById('s19-centre')) return;

    // Masquer l'ancienne UI
    const oldActions = page.querySelector('.page-actions');
    const oldFilters = page.querySelector('.filters');
    const oldCats = document.getElementById('alertes-categories');
    const oldTraitees = document.getElementById('card-alertes-traitees');
    [oldActions, oldFilters, oldCats, oldTraitees].forEach(el => { if (el) el.style.display = 'none'; });

    const el = document.createElement('div');
    el.id = 's19-centre';
    el.innerHTML =
      '<div class="page-actions">' +
        '<h2>Centre d\'alertes</h2>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<button class="btn-secondary" onclick="window.s19RefreshNow()">Rafraîchir</button>' +
          '<button class="btn-primary" onclick="openModal(\'modal-incident\')">+ Signaler un incident</button>' +
        '</div>' +
      '</div>' +
      '<div class="s19-kpi-grid" id="s19-kpis"></div>' +
      '<div class="filters" style="margin-bottom:16px;margin-top:14px">' +
        '<div class="searchbar"><span class="searchbar-icon">🔎</span><input type="search" id="s19-search" placeholder="Rechercher dans les alertes…" oninput="window.s19RenderCentre && window.s19RenderCentre()" /></div>' +
        '<select id="s19-filter-source" onchange="window.s19RenderCentre && window.s19RenderCentre()">' +
          '<option value="">Toutes sources</option>' +
          Object.entries(SOURCE_LABELS).map(([k,v]) => '<option value="' + k + '">' + v + '</option>').join('') +
        '</select>' +
        '<select id="s19-filter-gravite" onchange="window.s19RenderCentre && window.s19RenderCentre()">' +
          '<option value="">Toutes gravités</option>' +
          '<option value="critique">Critique</option>' +
          '<option value="haute">Haute</option>' +
          '<option value="moyen">Moyenne</option>' +
          '<option value="basse">Basse</option>' +
        '</select>' +
        '<select id="s19-filter-statut" onchange="window.s19RenderCentre && window.s19RenderCentre()">' +
          '<option value="ouvert" selected>Actives</option>' +
          '<option value="traite">✅ Traitées</option>' +
          '<option value="toutes">Toutes</option>' +
        '</select>' +
        '<button class="btn-secondary" onclick="document.getElementById(\'s19-search\').value=\'\';document.getElementById(\'s19-filter-source\').value=\'\';document.getElementById(\'s19-filter-gravite\').value=\'\';document.getElementById(\'s19-filter-statut\').value=\'ouvert\';window.s19RenderCentre && window.s19RenderCentre();">Réinitialiser</button>' +
      '</div>' +
      '<div id="s19-centre-body" class="s19-timeline"></div>';

    page.insertBefore(el, page.firstChild);
  }

  /* WRAPPER S19 — Hook naviguerVers : déclencher renderCentre() quand
     l'utilisateur ouvre 'alertes' pour rafraîchir le centre d'alertes.
     Chain pattern : __s19 idempotent, capture orig avant override. H2.1. */
  function hookNavigation() {
    if (typeof window.naviguerVers !== 'function') { setTimeout(hookNavigation, 300); return; }
    if (window.naviguerVers.__s19) return;
    const orig = window.naviguerVers;
    const wrapped = function(page) {
      // BUG-FIX : 'incidents' avait son propre onglet mais Sprint 19 redirigeait
      // vers Alertes (avec filtre source=incident). Le user veut un onglet
      // Incidents visuellement indépendant. → on laisse passer normalement.
      const ret = orig.apply(this, arguments);
      if (page === 'alertes') setTimeout(renderCentre, 100);
      return ret;
    };
    wrapped.__s19 = true;
    window.naviguerVers = wrapped;
  }

  /* ---------- Init + auto-refresh 60s ---------- */
  function init() {
    injecterUI();
    hookNavigation();
    autoCloture();
    renderCentre();
    setInterval(() => { autoCloture(); renderCentre(); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 300);
})();
