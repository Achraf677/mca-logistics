// script-ai-brouillons.js — page admin "Brouillons IA"
// PR #34 Phase 4 follow-up : liste les actions ai_pending_actions en statut
// 'pending' et permet d'approuver (execute_draft) / rejeter (reject_draft) /
// voir le detail. Disponible sur PC (admin.html) et mobile (m.html).
//
// L'edge function ai-chat-write-execute centralise execute_draft + reject_draft.
// On passe par elle pour beneficier des controles RLS / audit_log et pour ne
// pas avoir a dupliquer la logique de dispatch cote frontend.

(function () {
  'use strict';

  const ENDPOINT = '/functions/v1/ai-chat-write-execute';
  const REFRESH_INTERVAL_MS = 30000;

  const state = {
    drafts: [],
    loading: false,
    lastError: null,
    pendingCount: 0,
    refreshTimer: null,
    container: null,
  };

  // ----- Helpers -----

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  function getConfig() {
    return window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig()
      : null;
  }

  async function getAccessToken() {
    const client = getClient();
    if (!client) return null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      const sess = sessionData && sessionData.session;
      if (!sess) return null;
      const expAt = sess.expires_at ? sess.expires_at * 1000 : 0;
      if (expAt && expAt - Date.now() < 60000) {
        try {
          const { data: refreshed } = await client.auth.refreshSession();
          return refreshed && refreshed.session ? refreshed.session.access_token : sess.access_token;
        } catch (_) { return sess.access_token; }
      }
      return sess.access_token;
    } catch (_) { return null; }
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function toast(msg) {
    if (typeof window.afficherToast === 'function') {
      window.afficherToast(msg);
    } else if (window.M && typeof window.M.toast === 'function') {
      window.M.toast(msg);
    } else {
      console.log('[brouillons-ia]', msg);
    }
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Format humain de l'action et du payload
  function humanizeAction(action) {
    if (!action) return 'Action inconnue';
    const map = {
      create_livraison: '📦 Créer livraison',
      create_charge: '💸 Créer charge',
      create_paiement: '💵 Enregistrer paiement',
      create_client: '🧑‍💼 Créer client',
      create_fournisseur: '🏭 Créer fournisseur',
      create_vehicule: '🚐 Créer véhicule',
      create_salarie: '👥 Créer salarié',
      create_carburant: '⛽ Plein carburant',
      create_entretien: '🔧 Créer entretien',
      create_incident: '🚨 Créer incident',
      create_planning_creneau: '📅 Créneau planning',
      create_inspection: '🚗 Inspection véhicule',
      resolve_alerte: '✅ Résoudre alerte',
      delete_entity: '🗑️ Supprimer entité',
    };
    if (map[action]) return map[action];
    if (action.startsWith('update_')) {
      const ent = action.slice('update_'.length);
      return `✏️ Modifier ${ent}`;
    }
    return action;
  }

  // Resume textuel court du payload (1-2 lignes)
  function summarizePayload(action, payload) {
    if (!payload || typeof payload !== 'object') return '';
    const p = payload;
    try {
      if (action === 'create_livraison') {
        const parts = [];
        if (p.client) parts.push(p.client);
        if (p.date) parts.push(p.date);
        if (p.prix != null) parts.push(p.prix + ' €');
        return parts.join(' · ');
      }
      if (action === 'create_charge') {
        const parts = [];
        if (p.libelle) parts.push(p.libelle);
        if (p.montant != null) parts.push(p.montant + ' €');
        if (p.date) parts.push(p.date);
        return parts.join(' · ');
      }
      if (action === 'create_paiement') {
        const parts = [];
        if (p.montant != null) parts.push(p.montant + ' €');
        if (p.date) parts.push(p.date);
        if (p.mode) parts.push(p.mode);
        return parts.join(' · ');
      }
      if (action === 'create_client' || action === 'create_fournisseur') {
        return p.nom || p.raison_sociale || '';
      }
      if (action === 'create_vehicule') {
        return [p.immatriculation, p.marque, p.modele].filter(Boolean).join(' · ');
      }
      if (action === 'create_salarie') {
        return [p.nom, p.prenom, p.poste].filter(Boolean).join(' · ');
      }
      if (action === 'create_carburant') {
        const parts = [];
        if (p.vehicule_id || p.immatriculation) parts.push(p.immatriculation || p.vehicule_id);
        if (p.litres != null) parts.push(p.litres + ' L');
        if (p.montant != null) parts.push(p.montant + ' €');
        return parts.join(' · ');
      }
      if (action === 'delete_entity') {
        return `${p.entity || '?'} #${p.id || '?'}${p.raison ? ' — ' + p.raison : ''}`;
      }
      if (action === 'resolve_alerte') {
        return `alerte ${p.alerte_id || '?'}${p.resolution ? ' — ' + p.resolution : ''}`;
      }
      if (action && action.startsWith('update_')) {
        const id = p.target_id || p.id || '?';
        const inner = p.payload && typeof p.payload === 'object' ? p.payload : p;
        const champs = Object.keys(inner).filter(k => k !== 'target_id' && k !== 'id' && k !== 'payload').slice(0, 4);
        return `#${id} → ${champs.join(', ') || '(aucun champ)'}`;
      }
    } catch (_) { /* fallback */ }
    return '';
  }

  // ----- Network -----

  async function fetchDrafts() {
    const client = getClient();
    if (!client) {
      state.lastError = 'Supabase non initialisé';
      return [];
    }
    const { data, error } = await client.from('ai_pending_actions')
      .select('id, action, payload, reasoning, source_message_id, created_by, created_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      state.lastError = error.message || String(error);
      return [];
    }
    state.lastError = null;
    return Array.isArray(data) ? data : [];
  }

  async function callEdge(action, payload) {
    const config = getConfig();
    const token = await getAccessToken();
    if (!config?.url || !token) {
      return { ok: false, error: 'Authentification requise' };
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch(config.url + ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
        signal: ctrl.signal,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ok: false, error: body.error || body.message || ('HTTP ' + r.status), body };
      }
      return { ok: true, body };
    } catch (e) {
      return { ok: false, error: 'Réseau indisponible' };
    } finally { clearTimeout(t); }
  }

  // ----- Public API -----

  async function loadDrafts() {
    state.loading = true;
    const list = await fetchDrafts();
    state.drafts = list;
    state.pendingCount = list.length;
    state.loading = false;
    refreshGlobalBadges();
    return list;
  }

  async function getPendingCount() {
    const client = getClient();
    if (!client) return 0;
    // Bug #2 audit Chrome : head:true peut retourner 503 selon table.
    // Switch GET limit 1 + count exact (returns Content-Range, supabase-js extrait count).
    const { count, error } = await client.from('ai_pending_actions')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')
      .limit(1);
    if (error) return 0;
    return count || 0;
  }

  async function approveDraft(id) {
    if (!id) return;
    const r = await callEdge('execute_draft', { draft_id: id });
    if (r.ok && r.body && r.body.success !== false) {
      toast('✅ Brouillon approuvé et exécuté');
    } else {
      toast('⚠️ ' + (r.error || 'Erreur'));
    }
    await loadDrafts();
    if (state.container) renderDraftsPage(state.container);
  }

  async function rejectDraft(id) {
    if (!id) return;
    const r = await callEdge('reject_draft', { draft_id: id });
    if (r.ok && r.body && r.body.success !== false) {
      toast('❌ Brouillon rejeté');
    } else {
      toast('⚠️ ' + (r.error || 'Erreur'));
    }
    await loadDrafts();
    if (state.container) renderDraftsPage(state.container);
  }

  function showDetail(id) {
    const d = state.drafts.find(x => x.id === id);
    if (!d) {
      toast('Brouillon introuvable');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'aib-modal-overlay';
    overlay.innerHTML = `
      <div class="aib-modal" role="dialog" aria-modal="true" aria-label="Détail brouillon IA">
        <header class="aib-modal-header">
          <h3>${escHtml(humanizeAction(d.action))}</h3>
          <button type="button" class="aib-modal-close" aria-label="Fermer">✕</button>
        </header>
        <div class="aib-modal-body">
          <div class="aib-modal-row"><span class="aib-modal-label">Action</span><code>${escHtml(d.action)}</code></div>
          <div class="aib-modal-row"><span class="aib-modal-label">Créé le</span><span>${escHtml(formatDateTime(d.created_at))}</span></div>
          ${d.reasoning ? `<div class="aib-modal-row aib-modal-reasoning"><span class="aib-modal-label">Raisonnement IA</span><div>${escHtml(d.reasoning)}</div></div>` : ''}
          <div class="aib-modal-row aib-modal-payload">
            <span class="aib-modal-label">Payload complet</span>
            <pre>${escHtml(JSON.stringify(d.payload, null, 2))}</pre>
          </div>
        </div>
        <footer class="aib-modal-footer">
          <button type="button" class="aib-btn aib-btn-reject" data-detail-reject="${escHtml(d.id)}">❌ Rejeter</button>
          <button type="button" class="aib-btn aib-btn-approve" data-detail-approve="${escHtml(d.id)}">✅ Approuver</button>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.aib-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-detail-approve]').addEventListener('click', () => { close(); approveDraft(d.id); });
    overlay.querySelector('[data-detail-reject]').addEventListener('click', () => { close(); rejectDraft(d.id); });
  }

  // ----- Rendering -----

  function renderEmpty() {
    return `
      <div class="aib-empty">
        <div class="aib-empty-icon" aria-hidden="true">📋</div>
        <h3>Aucun brouillon en attente</h3>
        <p>Quand l'assistant IA propose une action, le bouton « 📋 Brouillon » la dépose ici pour validation.</p>
      </div>
    `;
  }

  function renderError() {
    return `
      <div class="aib-empty aib-empty-error">
        <div class="aib-empty-icon" aria-hidden="true">⚠️</div>
        <h3>Impossible de charger les brouillons</h3>
        <p>${escHtml(state.lastError || 'Erreur inconnue')}</p>
        <button type="button" class="aib-btn aib-btn-secondary" data-aib-retry="1">🔄 Réessayer</button>
      </div>
    `;
  }

  function renderCard(d) {
    const summary = summarizePayload(d.action, d.payload);
    const reasoning = d.reasoning ? escHtml(d.reasoning) : '';
    return `
      <div class="aib-card" data-id="${escHtml(d.id)}">
        <div class="aib-card-head">
          <h4 class="aib-card-title">${escHtml(humanizeAction(d.action))}</h4>
          <span class="aib-card-date">${escHtml(formatDateTime(d.created_at))}</span>
        </div>
        ${summary ? `<div class="aib-card-summary">${escHtml(summary)}</div>` : ''}
        ${reasoning ? `<div class="aib-card-reasoning">💡 ${reasoning}</div>` : ''}
        <div class="aib-card-actions">
          <button type="button" class="aib-btn aib-btn-approve" data-aib-approve="${escHtml(d.id)}">✅ Approuver</button>
          <button type="button" class="aib-btn aib-btn-reject" data-aib-reject="${escHtml(d.id)}">❌ Rejeter</button>
          <button type="button" class="aib-btn aib-btn-detail" data-aib-detail="${escHtml(d.id)}">👁️ Détail</button>
        </div>
      </div>
    `;
  }

  function renderDraftsPage(container) {
    if (!container) return;
    state.container = container;
    injectStyles();

    if (state.loading && state.drafts.length === 0) {
      container.innerHTML = '<div class="aib-loading">Chargement…</div>';
    } else if (state.lastError) {
      container.innerHTML = renderError();
    } else if (state.drafts.length === 0) {
      container.innerHTML = renderEmpty();
    } else {
      const header = `
        <div class="aib-toolbar">
          <span class="aib-count">${state.drafts.length} brouillon${state.drafts.length > 1 ? 's' : ''} en attente</span>
          <button type="button" class="aib-btn aib-btn-secondary" data-aib-refresh="1">🔄 Rafraîchir</button>
        </div>
      `;
      container.innerHTML = header + '<div class="aib-list">' + state.drafts.map(renderCard).join('') + '</div>';
    }

    container.querySelectorAll('[data-aib-approve]').forEach(b => {
      b.addEventListener('click', () => approveDraft(b.dataset.aibApprove));
    });
    container.querySelectorAll('[data-aib-reject]').forEach(b => {
      b.addEventListener('click', () => rejectDraft(b.dataset.aibReject));
    });
    container.querySelectorAll('[data-aib-detail]').forEach(b => {
      b.addEventListener('click', () => showDetail(b.dataset.aibDetail));
    });
    const refreshBtn = container.querySelector('[data-aib-refresh]');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => { await loadDrafts(); renderDraftsPage(container); });
    const retryBtn = container.querySelector('[data-aib-retry]');
    if (retryBtn) retryBtn.addEventListener('click', async () => { await loadDrafts(); renderDraftsPage(container); });

    // Lance auto-refresh tant que le container est dans le DOM et visible
    startAutoRefresh();
  }

  // Rendu initial : charge puis affiche
  async function mountAndLoad(container) {
    state.container = container;
    container.innerHTML = '<div class="aib-loading">Chargement…</div>';
    injectStyles();
    await loadDrafts();
    renderDraftsPage(container);
  }

  // ----- Auto-refresh -----

  function startAutoRefresh() {
    if (state.refreshTimer) return;
    state.refreshTimer = setInterval(async () => {
      // Stop si container plus visible / detache
      if (!state.container || !document.body.contains(state.container)) {
        stopAutoRefresh();
        return;
      }
      const visible = state.container.offsetParent !== null;
      if (!visible) return; // tjr en arriere-plan : skip
      await loadDrafts();
      renderDraftsPage(state.container);
    }, REFRESH_INTERVAL_MS);
  }

  function stopAutoRefresh() {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
  }

  // ----- Badges globaux -----

  function refreshGlobalBadges() {
    // Badge nav PC
    const pcBadge = document.getElementById('badge-brouillons-ia');
    if (pcBadge) {
      if (state.pendingCount > 0) {
        pcBadge.textContent = state.pendingCount > 99 ? '99+' : String(state.pendingCount);
        pcBadge.style.display = 'inline-flex';
      } else {
        pcBadge.style.display = 'none';
      }
    }
    // Badge drawer mobile
    const mBadge = document.getElementById('m-drawer-badge-brouillons');
    if (mBadge) {
      if (state.pendingCount > 0) {
        mBadge.textContent = state.pendingCount > 99 ? '99+' : String(state.pendingCount);
        mBadge.hidden = false;
      } else {
        mBadge.hidden = true;
      }
    }
  }

  async function refreshBadgeOnly() {
    const n = await getPendingCount();
    state.pendingCount = n;
    refreshGlobalBadges();
    return n;
  }

  // Auto-poll badge (independent du container ouvert)
  let badgeTimer = null;
  function startBadgePolling() {
    if (badgeTimer) return;
    refreshBadgeOnly();
    badgeTimer = setInterval(refreshBadgeOnly, REFRESH_INTERVAL_MS);
  }

  // ----- Styles -----

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
      .aib-loading { padding: 24px; text-align: center; color: var(--text-muted, #7c8299); }
      .aib-empty { padding: 40px 20px; text-align: center; color: var(--text-muted, #7c8299); }
      .aib-empty-icon { font-size: 3rem; margin-bottom: 12px; }
      .aib-empty h3 { margin: 0 0 8px; font-size: 1.05rem; color: var(--text, #e8eaf0); }
      .aib-empty p { margin: 0 0 16px; font-size: .88rem; line-height: 1.4; }
      .aib-empty-error h3 { color: #e74c3c; }
      .aib-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 10px; flex-wrap: wrap; }
      .aib-count { font-size: .9rem; font-weight: 600; color: var(--text, #e8eaf0); }
      .aib-list { display: flex; flex-direction: column; gap: 12px; }
      .aib-card { background: var(--bg-card, #232733); border: 1px solid var(--border, #2a2d3d); border-radius: 12px; padding: 14px 16px; }
      .aib-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
      .aib-card-title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text, #e8eaf0); }
      .aib-card-date { font-size: .76rem; color: var(--text-muted, #7c8299); white-space: nowrap; }
      .aib-card-summary { font-size: .9rem; color: var(--text, #e8eaf0); margin-bottom: 6px; }
      .aib-card-reasoning { font-size: .82rem; color: var(--text-muted, #7c8299); font-style: italic; margin-bottom: 10px; line-height: 1.4; }
      .aib-card-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .aib-btn { min-height: 44px; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border, #2a2d3d); background: var(--bg-card, #232733); color: var(--text, #e8eaf0); font-size: .85rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: filter .15s; }
      .aib-btn:hover { filter: brightness(1.15); }
      .aib-btn:active { transform: translateY(1px); }
      .aib-btn-approve { background: rgba(46,204,113,0.18); border-color: rgba(46,204,113,0.5); color: #7ed8a3; }
      .aib-btn-reject { background: rgba(231,76,60,0.15); border-color: rgba(231,76,60,0.45); color: #ff8b80; }
      .aib-btn-detail { background: rgba(52,152,219,0.15); border-color: rgba(52,152,219,0.45); color: #7ec0ff; }
      .aib-btn-secondary { background: var(--bg-card, #232733); }
      .aib-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 16px; }
      .aib-modal { background: var(--bg-card, #232733); border: 1px solid var(--border, #2a2d3d); border-radius: 14px; max-width: 600px; width: 100%; max-height: 86vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
      .aib-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border, #2a2d3d); }
      .aib-modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text, #e8eaf0); }
      .aib-modal-close { background: transparent; border: 0; color: var(--text-muted, #7c8299); font-size: 1.2rem; cursor: pointer; min-width: 44px; min-height: 44px; }
      .aib-modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
      .aib-modal-row { margin-bottom: 14px; font-size: .88rem; color: var(--text, #e8eaf0); }
      .aib-modal-label { display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted, #7c8299); margin-bottom: 4px; font-weight: 700; }
      .aib-modal-reasoning > div { background: rgba(52,152,219,0.1); border-left: 3px solid #3498db; padding: 8px 10px; border-radius: 6px; line-height: 1.4; }
      .aib-modal-payload pre { background: #14171c; color: #e8eaf0; padding: 12px; border-radius: 8px; overflow: auto; font-size: .78rem; max-height: 320px; margin: 0; }
      .aib-modal-footer { padding: 12px 18px; border-top: 1px solid var(--border, #2a2d3d); display: flex; gap: 10px; justify-content: flex-end; }
      @media (max-width: 600px) {
        .aib-card-actions { flex-direction: column; }
        .aib-card-actions .aib-btn { width: 100%; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'aib-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ----- Expose -----

  window.AIBrouillons = {
    loadDrafts,
    renderDraftsPage: mountAndLoad,
    approveDraft,
    rejectDraft,
    showDetail,
    getPendingCount,
    refreshBadge: refreshBadgeOnly,
    startBadgePolling,
    stopAutoRefresh,
    _state: state,
  };

  // Demarre le polling badge des que possible (apres que Supabase soit pret)
  function tryStartBadgePolling() {
    const start = Date.now();
    const tick = () => {
      const client = getClient();
      const role = sessionStorage.getItem('role') || '';
      if (client && (role === 'admin' || !role)) {
        // role peut etre vide cote mobile (pas toujours pose) — on essaie quand meme
        startBadgePolling();
        return;
      }
      if (Date.now() - start > 15000) return;
      setTimeout(tick, 500);
    };
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryStartBadgePolling);
  } else {
    tryStartBadgePolling();
  }
})();
