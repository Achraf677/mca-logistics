// script-ai-chat.js — chatbot Gemini integre dans MCA (PC + mobile)
// V1 lecture seule. Edge function : /functions/v1/ai-chat
// Historique conversation : localStorage.ai_chat_history (max 30 derniers tours)

(function () {
  'use strict';

  const HISTORY_KEY = 'ai_chat_history';
  const MAX_HISTORY = 30;
  const ENDPOINT = '/functions/v1/ai-chat';

  // ----- Etat -----

  let state = {
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
    } catch (_) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(-MAX_HISTORY)));
    } catch (_) {}
  }

  function clearHistory() {
    state.history = [];
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
      <span class="ai-chat-fab-icon">✨</span>
    </button>
    <div id="ai-chat-panel" role="dialog" aria-label="Assistant IA Gemini">
      <header class="ai-chat-header">
        <div class="ai-chat-title">
          <span class="ai-chat-title-icon">✨</span>
          <span>Assistant MCA <small id="ai-chat-model"></small></span>
        </div>
        <div class="ai-chat-actions">
          <button id="ai-chat-clear" title="Effacer la conversation" aria-label="Effacer">🗑</button>
          <button id="ai-chat-close" title="Fermer" aria-label="Fermer">✕</button>
        </div>
      </header>
      <div id="ai-chat-quota" class="ai-chat-quota" hidden></div>
      <div id="ai-chat-messages" class="ai-chat-messages" aria-live="polite"></div>
      <form id="ai-chat-form" class="ai-chat-form">
        <textarea id="ai-chat-input" placeholder="Demande-moi un truc sur ton activite..." rows="2" aria-label="Ton message"></textarea>
        <button id="ai-chat-send" type="submit" title="Envoyer" aria-label="Envoyer">↑</button>
      </form>
    </div>
    <div id="ai-chat-overlay" hidden></div>
  `;

  const STYLES = `
    #ai-chat-fab {
      position: fixed; right: 18px; bottom: 18px; z-index: 9998;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #f5a623 0%, #e63946 100%);
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      font-size: 24px; display: flex; align-items: center; justify-content: center;
      transition: transform .15s ease;
    }
    #ai-chat-fab:hover { transform: scale(1.06); }
    #ai-chat-fab:active { transform: scale(0.96); }

    #ai-chat-panel {
      position: fixed; right: -460px; top: 0; width: 440px; max-width: 100vw; height: 100vh;
      background: #1a1d27; border-left: 1px solid #2a2d3d; z-index: 9999;
      display: flex; flex-direction: column; transition: right .3s ease;
      box-shadow: -8px 0 32px rgba(0,0,0,0.5); color: #e8eaf0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }
    #ai-chat-panel.open { right: 0; }
    #ai-chat-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9997;
      backdrop-filter: blur(2px);
    }

    .ai-chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid #2a2d3d; background: #15171f;
    }
    .ai-chat-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: .95rem; }
    .ai-chat-title small { color: #7c8299; font-weight: 500; font-size: .72rem; margin-left: 6px; }
    .ai-chat-title-icon { font-size: 1.1rem; }
    .ai-chat-actions { display: flex; gap: 6px; }
    .ai-chat-actions button {
      background: transparent; border: none; color: #7c8299; cursor: pointer;
      font-size: 1rem; padding: 4px 8px; border-radius: 6px;
    }
    .ai-chat-actions button:hover { background: rgba(255,255,255,0.06); color: #e8eaf0; }

    .ai-chat-quota {
      padding: 8px 14px; font-size: .72rem; background: #232733; color: #aab; text-align: center;
      border-bottom: 1px solid #2a2d3d;
    }
    .ai-chat-quota.warn { background: #4a2a14; color: #f5a623; }
    .ai-chat-quota.flash { background: #2a3340; color: #6cb6ff; }

    .ai-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    }
    .ai-chat-empty { text-align: center; color: #7c8299; padding: 40px 20px; font-size: .85rem; }
    .ai-chat-empty strong { color: #e8eaf0; display: block; margin-bottom: 8px; }
    .ai-chat-empty ul { text-align: left; margin: 12px 0 0; padding-left: 20px; line-height: 1.7; }
    .ai-chat-empty li { cursor: pointer; color: #6cb6ff; }
    .ai-chat-empty li:hover { color: #99cfff; text-decoration: underline; }

    .ai-chat-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: .85rem; line-height: 1.5; word-wrap: break-word; }
    .ai-chat-msg-user { align-self: flex-end; background: #f5a623; color: #1a1d27; border-bottom-right-radius: 4px; }
    .ai-chat-msg-bot { align-self: flex-start; background: #2a2d3d; color: #e8eaf0; border-bottom-left-radius: 4px; }
    .ai-chat-msg-bot pre { background: #15171f; padding: 8px; border-radius: 6px; overflow-x: auto; font-size: .78rem; }
    .ai-chat-msg-bot code { background: #15171f; padding: 1px 5px; border-radius: 3px; font-size: .8rem; }
    .ai-chat-msg-bot table { border-collapse: collapse; margin: 8px 0; font-size: .78rem; }
    .ai-chat-msg-bot th, .ai-chat-msg-bot td { border: 1px solid #3a3d4d; padding: 4px 8px; }
    .ai-chat-msg-bot th { background: #15171f; }
    .ai-chat-msg-tools { font-size: .68rem; color: #7c8299; margin-top: 4px; font-style: italic; }
    .ai-chat-msg-loading { align-self: flex-start; color: #7c8299; font-style: italic; font-size: .82rem; }
    .ai-chat-msg-error { align-self: stretch; background: rgba(231,76,60,0.18); color: #ff8b80; padding: 10px 14px; border-radius: 8px; font-size: .82rem; }

    .ai-chat-form {
      display: flex; gap: 8px; padding: 12px; border-top: 1px solid #2a2d3d; background: #15171f;
      align-items: flex-end;
    }
    #ai-chat-input {
      flex: 1; background: #2a2d3d; color: #e8eaf0; border: 1px solid #3a3d4d;
      border-radius: 10px; padding: 10px 12px; font-size: .85rem; resize: none;
      font-family: inherit; max-height: 140px;
    }
    #ai-chat-input:focus { outline: none; border-color: #f5a623; }
    #ai-chat-send {
      background: #f5a623; color: #1a1d27; border: none; border-radius: 10px;
      width: 40px; height: 40px; cursor: pointer; font-size: 1.2rem; font-weight: 700;
      flex-shrink: 0;
    }
    #ai-chat-send:hover { background: #ffb735; }
    #ai-chat-send:disabled { opacity: .5; cursor: not-allowed; }

    /* Mobile : panneau plein ecran */
    @media (max-width: 768px) {
      #ai-chat-panel { width: 100vw; right: -100vw; }
      #ai-chat-fab { right: 14px; bottom: 78px; width: 52px; height: 52px; font-size: 22px; }
    }
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
    document.getElementById('ai-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('ai-chat-form').requestSubmit();
      }
    });
  }

  function toggle() {
    state.open = !state.open;
    document.getElementById('ai-chat-panel').classList.toggle('open', state.open);
    document.getElementById('ai-chat-overlay').hidden = !state.open;
    if (state.open) {
      setTimeout(() => document.getElementById('ai-chat-input').focus(), 350);
      scrollToBottom();
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
            <li data-q="Combien j'ai gagne ce mois-ci ?">Combien j'ai gagne ce mois-ci ?</li>
            <li data-q="Quelles factures clients sont impayees ?">Quelles factures clients sont impayees ?</li>
            <li data-q="Resume mes 5 dernieres charges">Resume mes 5 dernieres charges</li>
            <li data-q="Quel vehicule a la plus grosse conso carburant ?">Quel vehicule a la plus grosse conso carburant ?</li>
          </ul>
        </div>
      `;
      container.querySelectorAll('li[data-q]').forEach((li) => {
        li.addEventListener('click', () => {
          document.getElementById('ai-chat-input').value = li.getAttribute('data-q');
          document.getElementById('ai-chat-form').requestSubmit();
        });
      });
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
        // function role : on n'affiche pas les resultats bruts a l'utilisateur
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

    // Quota banner
    const banner = document.getElementById('ai-chat-quota');
    if (state.proRemaining !== null) {
      if (state.modelLast === 'gemini-2.5-flash') {
        banner.hidden = false;
        banner.className = 'ai-chat-quota flash';
        banner.textContent = `Quota Pro epuise pour aujourd'hui — bascule sur Flash. Reset cette nuit (UTC).`;
      } else if (state.proRemaining <= 5) {
        banner.hidden = false;
        banner.className = 'ai-chat-quota warn';
        banner.textContent = `⚠️ Plus que ${state.proRemaining} requete${state.proRemaining > 1 ? 's' : ''} Pro avant bascule sur Flash`;
      } else {
        banner.hidden = false;
        banner.className = 'ai-chat-quota';
        banner.textContent = `${state.proRemaining}/${50} requetes Pro restantes aujourd'hui`;
      }
    }

    // Modele dans le header
    const modelLabel = document.getElementById('ai-chat-model');
    if (modelLabel && state.modelLast) {
      modelLabel.textContent = state.modelLast === 'gemini-2.5-pro' ? 'Pro' : 'Flash';
    }
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

  // Markdown léger : gras, italique, code inline, listes, sauts de ligne, tableaux simples.
  function renderMarkdown(md) {
    if (!md) return '';
    let html = escapeHtml(md);
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    // Bullets
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.+<\/li>)(\n<li>.+<\/li>)*/g, (m) => '<ul>' + m + '</ul>');
    // Newlines -> <br>
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

    state.history.push({ role: 'user', parts: [{ text }] });
    saveHistory();
    input.value = '';
    state.sending = true;
    renderMessages();

    try {
      const reply = await callBackend(state.history);
      state.history.push({ role: 'model', parts: [{ text: reply.text }], _tools: reply.tools_called });
      state.proRemaining = reply.pro_remaining;
      state.modelLast = reply.model_used;
      saveHistory();
    } catch (err) {
      const errMsg = String(err.message || err).slice(0, 300);
      const c = document.getElementById('ai-chat-messages');
      const div = document.createElement('div');
      div.className = 'ai-chat-msg-error';
      div.textContent = '❌ ' + errMsg;
      c.appendChild(div);
    } finally {
      state.sending = false;
      const loading = document.getElementById('ai-chat-loading');
      if (loading) loading.remove();
      renderMessages();
    }
  }

  async function callBackend(history) {
    const client = window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
    if (!client) throw new Error('Supabase pas pret');
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if (!token) throw new Error('Pas de session admin');

    const config = window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig()
      : null;
    const baseUrl = config && config.url ? config.url : '';
    if (!baseUrl) throw new Error('Supabase URL manquante');

    // Filtre : on n'envoie que les role 'user', 'model', 'function' (pas les meta _tools)
    const cleanHistory = history.map((m) => ({ role: m.role, parts: m.parts }));

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    const r = await fetch(baseUrl + ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ history: cleanHistory }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || 'HTTP ' + r.status);
    return body;
  }

  // ----- Boot -----

  function boot() {
    // V1 admin only : on n'affiche le bouton que si on est sur admin.html ou m.html.
    const path = location.pathname;
    if (path.includes('salarie.html') || path.endsWith('/login.html')) return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }

  boot();

  // Expose pour debug / ouverture programmable
  window.AIChat = {
    open: () => { if (!state.open) toggle(); },
    close: () => { if (state.open) toggle(); },
    clear: clearHistory,
    state: () => ({ ...state }),
  };
})();
