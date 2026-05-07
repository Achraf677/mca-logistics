// script-ai-chat.js — chatbot Gemini integre dans MCA (PC + mobile)
// V1 lecture seule. Edge function : /functions/v1/ai-chat
// Historique conversation : localStorage.ai_chat_history (max 30 derniers tours)
//
// Mobile : herite du design-system m-* (style-mobile.css) — palette, radius,
// safe-area iPhone, tap-targets 48px, z-index coherent (fab=180, overlay=190,
// panel=200, en-dessous du toast m-toast a 300+).
// PC : palette dediee (orange/red gradient FAB), slide-in 440px depuis la droite.

(function () {
  'use strict';

  const HISTORY_KEY = 'ai_chat_history';
  const MAX_HISTORY = 30;
  // Nb max de tours user/model envoyes au backend par requete. Plus que ca = trop
  // de contexte, Gemini ralentit / coute cher / risque de timeout. Le local
  // garde tout (jusqu'a MAX_HISTORY) pour l'affichage.
  const MAX_HISTORY_TO_SEND = 16;
  const ENDPOINT = '/functions/v1/ai-chat';

  const state = {
    open: false,
    sending: false,
    history: loadHistory(),
    proRemaining: null,
    modelLast: null,
  };

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_HISTORY) : [];
    } catch (_) { return []; }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(-MAX_HISTORY)));
    } catch (_) {}
  }

  function clearHistory() {
    state.history = [];
    // Reset egalement les meta du dernier echange pour eviter d'afficher un
    // badge model / quota perimes.
    state.proRemaining = null;
    state.modelLast = null;
    saveHistory();
    renderMessages();
  }

  // ----- UI mount -----

  function mount() {
    if (document.getElementById('ai-chat-root')) return;
    const root = document.createElement('div');
    root.id = 'ai-chat-root';
    root.innerHTML = TEMPLATE;
    document.body.appendChild(root);
    injectStyles();
    wireEvents();
    renderMessages();
  }

  const TEMPLATE = `
    <button id="ai-chat-fab" aria-label="Ouvrir l'assistant IA" title="Assistant IA Gemini">
      <span class="ai-chat-fab-icon" aria-hidden="true">✨</span>
    </button>
    <div id="ai-chat-panel" role="dialog" aria-label="Assistant IA Gemini" aria-hidden="true">
      <header class="ai-chat-header">
        <button id="ai-chat-close" class="ai-chat-iconbtn" title="Fermer" aria-label="Fermer">‹</button>
        <div class="ai-chat-title">
          <span class="ai-chat-title-icon" aria-hidden="true">✨</span>
          <span>Assistant MCA</span>
          <small id="ai-chat-model" aria-hidden="true"></small>
        </div>
        <button id="ai-chat-clear" class="ai-chat-iconbtn" title="Effacer la conversation" aria-label="Effacer la conversation">🗑</button>
      </header>
      <div id="ai-chat-quota" class="ai-chat-quota" hidden></div>
      <div id="ai-chat-messages" class="ai-chat-messages" aria-live="polite"></div>
      <form id="ai-chat-form" class="ai-chat-form">
        <textarea id="ai-chat-input" placeholder="Demande-moi un truc sur ton activite..." rows="1" aria-label="Ton message"></textarea>
        <button id="ai-chat-send" type="submit" title="Envoyer" aria-label="Envoyer">↑</button>
      </form>
    </div>
    <div id="ai-chat-overlay" hidden></div>
  `;

  const STYLES = `
    /* ========== Tokens locaux PC (defaut) ========== */
    #ai-chat-root {
      --aic-bg: #1a1d22;
      --aic-card: #232733;
      --aic-text: #e8eaf0;
      --aic-text-muted: #7c8299;
      --aic-border: rgba(255,255,255,0.08);
      --aic-accent: #f5a623;
      --aic-accent-text: #1a1d22;
      --aic-accent-soft: rgba(245,166,35,0.16);
      --aic-blue: #4cc9f0;
      --aic-radius: 12px;
      --aic-radius-lg: 18px;
      --aic-shadow: 0 8px 28px rgba(0,0,0,0.45);
      --aic-z-fab: 180;
      --aic-z-overlay: 190;
      --aic-z-panel: 200;
    }

    /* ========== FAB ========== */
    #ai-chat-fab {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: var(--aic-z-fab);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f5a623 0%, #e63946 100%);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    #ai-chat-fab:hover { transform: scale(1.06); }
    #ai-chat-fab:active { transform: scale(0.92); }
    #ai-chat-fab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

    /* ========== Panel ========== */
    #ai-chat-panel {
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      width: 440px;
      max-width: 100vw;
      background: var(--aic-bg);
      border-left: 1px solid var(--aic-border);
      z-index: var(--aic-z-panel);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform .25s ease-out;
      box-shadow: var(--aic-shadow);
      color: var(--aic-text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }
    #ai-chat-panel.open { transform: translateX(0); }

    #ai-chat-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: var(--aic-z-overlay);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      backdrop-filter: blur(2px);
    }
    #ai-chat-overlay.open { opacity: 1; pointer-events: auto; }

    /* ========== Header ========== */
    .ai-chat-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--aic-border);
      background: var(--aic-card);
      flex-shrink: 0;
    }
    .ai-chat-title {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: .95rem;
      min-width: 0;
    }
    .ai-chat-title small {
      font-weight: 600;
      font-size: .68rem;
      padding: 2px 8px;
      background: var(--aic-accent-soft);
      color: var(--aic-accent);
      border-radius: 8px;
    }
    .ai-chat-title small:empty { display: none; }
    .ai-chat-title-icon { font-size: 1.05rem; }
    .ai-chat-iconbtn {
      background: transparent;
      border: none;
      color: var(--aic-text-muted);
      cursor: pointer;
      font-size: 1.1rem;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-iconbtn:hover { background: rgba(255,255,255,0.06); color: var(--aic-text); }
    .ai-chat-iconbtn:active { background: rgba(255,255,255,0.10); }

    /* ========== Quota banner ========== */
    .ai-chat-quota {
      padding: 8px 14px;
      font-size: .72rem;
      background: var(--aic-card);
      color: var(--aic-text-muted);
      text-align: center;
      border-bottom: 1px solid var(--aic-border);
    }
    .ai-chat-quota.warn { background: rgba(245,166,35,0.12); color: var(--aic-accent); }
    .ai-chat-quota.flash { background: rgba(76,201,240,0.12); color: var(--aic-blue); }

    /* ========== Messages ========== */
    .ai-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    .ai-chat-empty {
      text-align: center;
      color: var(--aic-text-muted);
      padding: 28px 18px;
      font-size: .85rem;
    }
    .ai-chat-empty strong { color: var(--aic-text); display: block; margin-bottom: 8px; font-size: 1rem; }
    .ai-chat-empty ul {
      list-style: none;
      text-align: left;
      margin: 14px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ai-chat-empty li {
      cursor: pointer;
      color: var(--aic-text);
      background: var(--aic-card);
      border: 1px solid var(--aic-border);
      border-radius: var(--aic-radius);
      padding: 10px 12px;
      transition: border-color .15s ease, background .15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-empty li:hover, .ai-chat-empty li:active {
      border-color: var(--aic-accent);
      background: var(--aic-accent-soft);
    }

    .ai-chat-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: var(--aic-radius-lg);
      font-size: .88rem;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .ai-chat-msg-user {
      align-self: flex-end;
      background: var(--aic-accent);
      color: var(--aic-accent-text);
      border-bottom-right-radius: 6px;
    }
    .ai-chat-msg-bot {
      align-self: flex-start;
      background: var(--aic-card);
      color: var(--aic-text);
      border-bottom-left-radius: 6px;
      border: 1px solid var(--aic-border);
    }
    .ai-chat-msg-bot pre {
      background: rgba(0,0,0,0.35);
      padding: 8px 10px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: .78rem;
      margin: 6px 0;
    }
    .ai-chat-msg-bot code {
      background: rgba(0,0,0,0.35);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: .82rem;
    }
    .ai-chat-msg-bot table {
      border-collapse: collapse;
      margin: 8px 0;
      font-size: .78rem;
      width: 100%;
    }
    .ai-chat-msg-bot th, .ai-chat-msg-bot td {
      border: 1px solid var(--aic-border);
      padding: 4px 8px;
      text-align: left;
    }
    .ai-chat-msg-bot th { background: rgba(0,0,0,0.25); }
    .ai-chat-msg-bot ul { margin: 6px 0; padding-left: 20px; }
    .ai-chat-msg-tools {
      font-size: .68rem;
      color: var(--aic-text-muted);
      margin-top: 6px;
      font-style: italic;
    }
    .ai-chat-msg-loading {
      align-self: flex-start;
      color: var(--aic-text-muted);
      font-style: italic;
      font-size: .82rem;
      padding: 4px 6px;
    }
    .ai-chat-msg-error {
      align-self: stretch;
      background: rgba(231,76,60,0.18);
      color: #ff8b80;
      padding: 10px 14px;
      border-radius: var(--aic-radius);
      font-size: .82rem;
      border: 1px solid rgba(231,76,60,0.35);
      white-space: pre-wrap;
    }

    /* ========== Form ========== */
    .ai-chat-form {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid var(--aic-border);
      background: var(--aic-card);
      align-items: flex-end;
      flex-shrink: 0;
    }
    #ai-chat-input {
      flex: 1;
      background: var(--aic-bg);
      color: var(--aic-text);
      border: 1px solid var(--aic-border);
      border-radius: var(--aic-radius);
      padding: 10px 12px;
      font-size: .9rem;
      resize: none;
      font-family: inherit;
      max-height: 140px;
      line-height: 1.4;
    }
    #ai-chat-input:focus {
      outline: none;
      border-color: var(--aic-accent);
      box-shadow: 0 0 0 2px var(--aic-accent-soft);
    }
    #ai-chat-input::placeholder { color: var(--aic-text-muted); }
    #ai-chat-send {
      background: var(--aic-accent);
      color: var(--aic-accent-text);
      border: none;
      border-radius: var(--aic-radius);
      width: 44px;
      height: 44px;
      cursor: pointer;
      font-size: 1.3rem;
      font-weight: 700;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    #ai-chat-send:hover:not(:disabled) { filter: brightness(1.08); }
    #ai-chat-send:active:not(:disabled) { transform: scale(0.96); }
    #ai-chat-send:disabled { opacity: .4; cursor: not-allowed; }

    /* ========== MOBILE — heritage du design-system m-* ========== */
    @media (max-width: 768px) {
      #ai-chat-root {
        --aic-bg: var(--m-bg, #1a1d22);
        --aic-card: var(--m-card, #2a2f37);
        --aic-text: var(--m-text, #f1f3f5);
        --aic-text-muted: var(--m-text-muted, #adb5bd);
        --aic-border: var(--m-border, rgba(255,255,255,0.08));
        --aic-accent: var(--m-accent, #e63946);
        --aic-accent-text: #fff;
        --aic-accent-soft: var(--m-accent-soft, rgba(230,57,70,0.16));
        --aic-blue: var(--m-blue, #4cc9f0);
        --aic-radius: var(--m-radius, 12px);
        --aic-radius-lg: var(--m-radius-large, 18px);
      }
      /* FAB : au-dessus de la bottom-nav, respect safe-area iPhone */
      #ai-chat-fab {
        right: calc(16px + var(--m-safe-right, 0px));
        bottom: calc(var(--m-tabbar-h, 64px) + var(--m-safe-bottom, 0px) + 16px);
        width: 52px;
        height: 52px;
        font-size: 22px;
      }
      /* Panel plein ecran */
      #ai-chat-panel {
        width: 100vw;
        max-width: 100vw;
        border-left: none;
      }
      .ai-chat-header {
        padding-top: calc(8px + var(--m-safe-top, 0px));
      }
      .ai-chat-form {
        padding-bottom: calc(10px + var(--m-safe-bottom, 0px));
      }
      .ai-chat-iconbtn {
        min-width: var(--m-tap, 48px);
        min-height: var(--m-tap, 48px);
      }
      #ai-chat-send {
        width: var(--m-tap, 48px);
        height: var(--m-tap, 48px);
      }
      .ai-chat-msg { font-size: .92rem; max-width: 88%; }
    }

    body.ai-chat-open { overflow: hidden; }
  `;

  function injectStyles() {
    if (document.getElementById('ai-chat-styles')) return;
    const s = document.createElement('style');
    s.id = 'ai-chat-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function wireEvents() {
    document.getElementById('ai-chat-fab').addEventListener('click', toggle);
    document.getElementById('ai-chat-close').addEventListener('click', toggle);
    document.getElementById('ai-chat-overlay').addEventListener('click', toggle);
    document.getElementById('ai-chat-clear').addEventListener('click', () => {
      if (confirm('Effacer la conversation en cours ?')) clearHistory();
    });
    document.getElementById('ai-chat-form').addEventListener('submit', onSubmit);
    const input = document.getElementById('ai-chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('ai-chat-form').requestSubmit();
      }
    });
    // Auto-grow textarea jusqu'a max-height
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
    // Echappement = ferme le panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.open) toggle();
    });
  }

  function toggle() {
    state.open = !state.open;
    const panel = document.getElementById('ai-chat-panel');
    const overlay = document.getElementById('ai-chat-overlay');
    panel.classList.toggle('open', state.open);
    panel.setAttribute('aria-hidden', String(!state.open));
    overlay.classList.toggle('open', state.open);
    overlay.hidden = !state.open;
    document.body.classList.toggle('ai-chat-open', state.open);
    if (state.open) {
      setTimeout(() => {
        const input = document.getElementById('ai-chat-input');
        const isTouch = matchMedia('(hover: none)').matches;
        if (!isTouch) input.focus();
        scrollToBottom();
      }, 280);
    }
  }

  // ----- Render -----

  function renderMessages() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    if (state.history.length === 0) {
      container.innerHTML = `
        <div class="ai-chat-empty">
          <strong>Salut Achraf 👋</strong>
          Je suis ton assistant business MCA. Demande-moi par exemple :
          <ul>
            <li data-q="Combien j'ai gagne ce mois-ci ?">💰 Combien j'ai gagne ce mois-ci ?</li>
            <li data-q="Quelles factures clients sont impayees ?">⚠️ Quelles factures clients sont impayees ?</li>
            <li data-q="Resume mes 5 dernieres charges">📋 Resume mes 5 dernieres charges</li>
            <li data-q="Quel vehicule consomme le plus ?">⛽ Quel vehicule consomme le plus ?</li>
          </ul>
        </div>
      `;
      container.querySelectorAll('li[data-q]').forEach((li) => {
        li.addEventListener('click', () => {
          document.getElementById('ai-chat-input').value = li.getAttribute('data-q');
          document.getElementById('ai-chat-form').requestSubmit();
        });
      });
      updateQuotaBanner();
      updateModelBadge();
      return;
    }

    container.innerHTML = '';
    state.history.forEach((m) => {
      const div = document.createElement('div');
      if (m.role === 'user') {
        div.className = 'ai-chat-msg ai-chat-msg-user';
        div.textContent = textOf(m);
      } else if (m.role === 'model') {
        div.className = 'ai-chat-msg ai-chat-msg-bot';
        div.innerHTML = renderMarkdown(textOf(m));
        if (m._tools && m._tools.length) {
          const tools = document.createElement('div');
          tools.className = 'ai-chat-msg-tools';
          tools.textContent = '🔧 ' + m._tools.join(', ');
          div.appendChild(tools);
        }
      } else {
        return;
      }
      container.appendChild(div);
    });

    if (state.sending) {
      const loading = document.createElement('div');
      loading.className = 'ai-chat-msg-loading';
      loading.textContent = '✨ Je cherche...';
      loading.id = 'ai-chat-loading';
      container.appendChild(loading);
    }
    scrollToBottom();
    updateQuotaBanner();
    updateModelBadge();
  }

  function updateQuotaBanner() {
    const banner = document.getElementById('ai-chat-quota');
    if (!banner) return;
    if (state.proRemaining === null) {
      banner.hidden = true;
      return;
    }
    if (state.modelLast === 'gemini-2.5-flash') {
      banner.hidden = false;
      banner.className = 'ai-chat-quota flash';
      banner.textContent = `Quota Pro epuise — bascule sur Flash (reset cette nuit UTC).`;
    } else if (state.proRemaining <= 5) {
      banner.hidden = false;
      banner.className = 'ai-chat-quota warn';
      banner.textContent = `⚠️ Plus que ${state.proRemaining} req${state.proRemaining > 1 ? 's' : ''} Pro avant bascule sur Flash`;
    } else {
      banner.hidden = false;
      banner.className = 'ai-chat-quota';
      banner.textContent = `${state.proRemaining}/50 reqs Pro restantes aujourd'hui`;
    }
  }

  function updateModelBadge() {
    const badge = document.getElementById('ai-chat-model');
    if (!badge) return;
    if (!state.modelLast) { badge.textContent = ''; return; }
    badge.textContent = state.modelLast === 'gemini-2.5-pro' ? 'Pro' : 'Flash';
  }

  function textOf(m) {
    if (Array.isArray(m.parts)) {
      return m.parts.map((p) => p.text || '').filter(Boolean).join(' ');
    }
    return m.text || '';
  }

  function scrollToBottom() {
    const c = document.getElementById('ai-chat-messages');
    if (c) c.scrollTop = c.scrollHeight;
  }

  function renderMarkdown(md) {
    if (!md) return '';
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.+<\/li>)(\n<li>.+<\/li>)*/g, (m) => '<ul>' + m + '</ul>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  // ----- Send -----

  async function onSubmit(e) {
    e.preventDefault();
    if (state.sending) return;
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();
    if (!text) return;

    const userMsg = { role: 'user', parts: [{ text }] };
    state.history.push(userMsg);
    saveHistory();
    input.value = '';
    input.style.height = 'auto';
    state.sending = true;
    document.getElementById('ai-chat-send').disabled = true;
    renderMessages();

    let succeeded = false;
    try {
      const reply = await callBackend(state.history);
      state.history.push({
        role: 'model',
        parts: [{ text: reply.text }],
        _tools: reply.tools_called,
      });
      state.proRemaining = reply.pro_remaining;
      state.modelLast = reply.model_used;
      saveHistory();
      succeeded = true;
    } catch (err) {
      // CRITIQUE : sans rollback, le message user reste orphelin dans l'history.
      // Au prochain envoi, on enverrait 2 messages user consecutifs a Gemini ->
      // Gemini renvoie souvent un candidate vide => UX "doit envoyer plusieurs fois".
      // On retire le message user, l'utilisateur peut retaper et reessayer proprement.
      const idx = state.history.lastIndexOf(userMsg);
      if (idx !== -1) state.history.splice(idx, 1);
      saveHistory();
      // Restaure le texte dans l'input pour que l'utilisateur puisse reessayer
      // sans tout retaper.
      if (!input.value) {
        input.value = text;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
      }
      const errMsg = String(err.message || err).slice(0, 400);
      // Affiche l'erreur — sera retiree au prochain renderMessages, donc on l'insere
      // apres avoir desactive sending.
      state.sending = false;
      document.getElementById('ai-chat-send').disabled = false;
      const loading = document.getElementById('ai-chat-loading');
      if (loading) loading.remove();
      renderMessages();
      const c = document.getElementById('ai-chat-messages');
      if (c) {
        const div = document.createElement('div');
        div.className = 'ai-chat-msg-error';
        div.textContent = 'Erreur : ' + errMsg + '\n(Le message a ete retire de l\'historique, tu peux le renvoyer.)';
        c.appendChild(div);
        scrollToBottom();
      }
      return;
    } finally {
      // Sur succes seulement (sur erreur le finally s'execute apres notre return,
      // mais on a deja remis sending=false). Idempotent.
      if (succeeded) {
        state.sending = false;
        document.getElementById('ai-chat-send').disabled = false;
        const loading = document.getElementById('ai-chat-loading');
        if (loading) loading.remove();
        renderMessages();
      }
    }
  }

  async function callBackend(history) {
    const client = window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
    if (!client) throw new Error('Supabase pas pret');
    // getSession() refresh auto en theorie, mais en pratique on a vu des cas ou
    // le token expire silencieusement (onglet en arriere-plan plusieurs heures).
    // On force un refreshSession() si le token expire dans <60s pour eviter le 401.
    let token = null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      const sess = sessionData && sessionData.session;
      const expAt = sess && sess.expires_at ? sess.expires_at * 1000 : 0;
      if (sess && expAt && expAt - Date.now() < 60000) {
        // Token expire bientot : tente un refresh (silencieux si echec).
        try {
          const { data: refreshed } = await client.auth.refreshSession();
          token = refreshed && refreshed.session ? refreshed.session.access_token : sess.access_token;
        } catch (_) { token = sess.access_token; }
      } else {
        token = sess ? sess.access_token : null;
      }
    } catch (_) { /* fallback below */ }
    if (!token) throw new Error('Session expiree, reconnecte-toi (Deconnexion puis relogin).');

    const config = window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig()
      : null;
    const baseUrl = config && config.url ? config.url : '';
    if (!baseUrl) throw new Error('Supabase URL manquante');

    // Sanitize l'historique envoye :
    // 1) ne garde que role user|model + parts texte (Gemini v1beta)
    // 2) drop les turns vides (parts sans texte)
    // 3) collapse les turns consecutifs de meme role (Gemini exige alternance user/model)
    // 4) cap a MAX_HISTORY_TO_SEND derniers tours pour limiter le contexte
    const sanitized = [];
    for (const m of history) {
      if (!m || (m.role !== 'user' && m.role !== 'model')) continue;
      const parts = Array.isArray(m.parts) ? m.parts.filter((p) => p && typeof p.text === 'string' && p.text.length) : [];
      if (parts.length === 0) continue;
      const last = sanitized[sanitized.length - 1];
      if (last && last.role === m.role) {
        // Merge texte avec le precedent meme role pour preserver l'alternance.
        const merged = last.parts.map((p) => p.text).concat(parts.map((p) => p.text)).join('\n');
        sanitized[sanitized.length - 1] = { role: m.role, parts: [{ text: merged }] };
      } else {
        sanitized.push({ role: m.role, parts: parts.map((p) => ({ text: p.text })) });
      }
    }
    // Le 1er message envoye doit etre role user (sinon Gemini renvoie 400).
    while (sanitized.length && sanitized[0].role !== 'user') sanitized.shift();
    const cleanHistory = sanitized.slice(-MAX_HISTORY_TO_SEND);
    if (cleanHistory.length === 0) throw new Error('Historique vide apres sanitize');

    // Timeout client : 90s. Le backend a un timeout interne de 45s par appel
    // Gemini + 6 iterations max donc theoriquement ca peut depasser. On garde
    // une marge confortable. Le timeout abort produit un message lisible.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90000);
    let r;
    try {
      r = await fetch(baseUrl + ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history: cleanHistory }),
        signal: ctrl.signal,
      });
    } catch (e) {
      // AbortError = timeout local, TypeError = network down (CF / Supabase).
      if (e && e.name === 'AbortError') {
        throw new Error('Delai depasse (90s). Reessaye, ou efface la conversation si l\'historique est trop long.');
      }
      throw new Error('Reseau indisponible. Verifie ta connexion.');
    } finally { clearTimeout(t); }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      // 401 specifique : token expire / invalide. L'utilisateur doit se reloger.
      if (r.status === 401) {
        throw new Error('Session expiree. Deconnecte-toi puis reconnecte-toi.');
      }
      const msg = body.message || body.error || 'HTTP ' + r.status;
      const hint = body.hint ? '\n' + body.hint : '';
      throw new Error(msg + hint);
    }
    return body;
  }

  // ----- Boot -----

  function boot() {
    const path = location.pathname;
    if (path.includes('salarie.html') || path.endsWith('/login.html')) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }

  boot();

  window.AIChat = {
    open: () => { if (!state.open) toggle(); },
    close: () => { if (state.open) toggle(); },
    toggle,
    clear: clearHistory,
    state: () => ({ ...state }),
  };
})();
