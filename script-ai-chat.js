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
  // Nb max de tours user/model envoyes au backend par requete. Reduit de 16 -> 10
  // pour limiter les input tokens free tier Gemini. Le local garde tout (jusqu'a
  // MAX_HISTORY) pour l'affichage.
  const MAX_HISTORY_TO_SEND = 10;
  const ENDPOINT = '/functions/v1/ai-chat';
  // Auto-retry si Gemini renvoie 429 avec retry_after <= ce seuil. UX : on
  // affiche un compte a rebours au lieu d'un message d'erreur.
  const MAX_AUTO_RETRY_SECONDS = 90;

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
      --aic-blue-soft: rgba(76,201,240,0.08);
      --aic-blue-border: rgba(76,201,240,0.35);
      --aic-blue-tint: rgba(76,201,240,0.12);
      --aic-danger: #ff8b80;
      --aic-danger-soft: rgba(231,76,60,0.18);
      --aic-danger-border: rgba(231,76,60,0.35);
      --aic-danger-tint: rgba(231,76,60,0.10);
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
    .ai-chat-quota.warn { background: var(--aic-accent-soft); color: var(--aic-accent); }
    .ai-chat-quota.flash { background: var(--aic-blue-tint); color: var(--aic-blue); }

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
    /* Typing indicator (3 dots pulsing) — affiche immediatement apres envoi pour
       feedback temps reel, evite le bug "je dois envoyer plusieurs fois". */
    .ai-chat-typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 10px 14px;
    }
    .ai-chat-typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--aic-text-muted);
      animation: aic-pulse 1.2s infinite ease-in-out;
    }
    .ai-chat-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .ai-chat-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aic-pulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    .ai-chat-msg-error {
      align-self: stretch;
      background: var(--aic-danger-soft);
      color: var(--aic-danger);
      padding: 10px 14px;
      border-radius: var(--aic-radius);
      font-size: .82rem;
      border: 1px solid var(--aic-danger-border);
      white-space: pre-wrap;
    }

    /* ========== Actions sur message bot (copy + regenerate) ========== */
    .ai-chat-msg-bot { position: relative; }
    .ai-chat-msg-actions {
      display: flex;
      gap: 4px;
      margin-top: 6px;
      justify-content: flex-end;
      opacity: .55;
      transition: opacity .15s ease;
    }
    .ai-chat-msg-bot:hover .ai-chat-msg-actions { opacity: 1; }
    .ai-chat-msg-actionbtn {
      background: transparent;
      border: 1px solid var(--aic-border);
      color: var(--aic-text-muted);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: .9rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: border-color .15s ease, color .15s ease, background .15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-msg-actionbtn:hover:not(:disabled) {
      border-color: var(--aic-accent);
      color: var(--aic-text);
      background: var(--aic-accent-soft);
    }
    .ai-chat-msg-actionbtn:active:not(:disabled) { transform: scale(0.94); }
    .ai-chat-msg-actionbtn:disabled { opacity: .35; cursor: not-allowed; }
    .ai-chat-msg-actionbtn.copied {
      border-color: var(--aic-blue);
      color: var(--aic-blue);
      background: var(--aic-blue-tint);
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
        --aic-blue-soft: rgba(76,201,240,0.08);
        --aic-blue-border: rgba(76,201,240,0.35);
        --aic-blue-tint: rgba(76,201,240,0.12);
        --aic-danger: var(--m-red, #ff8b80);
        --aic-danger-soft: var(--m-red-soft, rgba(231,76,60,0.18));
        --aic-danger-border: var(--m-red-border, rgba(231,76,60,0.35));
        --aic-danger-tint: rgba(231,76,60,0.10);
        --aic-radius: var(--m-radius, 12px);
        --aic-radius-lg: var(--m-radius-large, 18px);
      }
      /* Tap-target 44px sur mobile pour boutons d'action message */
      .ai-chat-msg-actionbtn {
        width: 44px;
        height: 44px;
        font-size: 1rem;
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

    /* ========== Cards memoire ========== */
    .ai-chat-mem-card {
      align-self: stretch;
      background: var(--aic-blue-soft);
      border: 1px solid var(--aic-blue-border);
      color: var(--aic-text);
      border-radius: var(--aic-radius);
      padding: 10px 12px;
      font-size: .82rem;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .ai-chat-mem-card.deleted {
      background: var(--aic-danger-tint);
      border-color: var(--aic-danger-border);
    }
    .ai-chat-mem-card .ai-chat-mem-icon { font-size: 1.05rem; flex-shrink: 0; }
    .ai-chat-mem-card .ai-chat-mem-body { flex: 1; min-width: 0; }
    .ai-chat-mem-card .ai-chat-mem-meta {
      font-size: .68rem; color: var(--aic-text-muted); margin-top: 4px;
    }
    .ai-chat-mem-card .ai-chat-mem-fact {
      font-weight: 600;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .ai-chat-mem-card button.ai-chat-mem-del {
      background: transparent; border: 1px solid var(--aic-border);
      color: var(--aic-text-muted); border-radius: 8px; cursor: pointer;
      padding: 4px 8px; font-size: .72rem; flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-mem-card button.ai-chat-mem-del:hover {
      border-color: var(--aic-danger); color: var(--aic-danger);
    }

    /* ========== Cards confirmation V2 ECRITURE (propose_*) ========== */
    .ai-chat-write-card {
      align-self: stretch;
      background: var(--aic-accent-soft);
      border: 1.5px solid var(--aic-accent);
      color: var(--aic-text);
      border-radius: var(--aic-radius);
      padding: 12px 14px;
      font-size: .85rem;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ai-chat-write-card.confirmed {
      background: var(--aic-blue-tint);
      border-color: var(--aic-blue);
      opacity: .85;
    }
    .ai-chat-write-card.cancelled {
      background: var(--aic-danger-tint);
      border-color: var(--aic-danger-border);
      opacity: .7;
    }
    .ai-chat-write-card-title {
      font-weight: 700;
      font-size: .92rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ai-chat-write-card-title .ai-chat-write-card-icon {
      font-size: 1.1rem;
    }
    .ai-chat-write-card-table {
      border-collapse: collapse;
      width: 100%;
      font-size: .82rem;
    }
    .ai-chat-write-card-table tr {
      border-bottom: 1px solid var(--aic-border);
    }
    .ai-chat-write-card-table tr:last-child { border-bottom: none; }
    .ai-chat-write-card-table th {
      text-align: left;
      padding: 6px 8px 6px 0;
      color: var(--aic-text-muted);
      font-weight: 500;
      width: 38%;
      vertical-align: top;
    }
    .ai-chat-write-card-table td {
      padding: 6px 0;
      color: var(--aic-text);
      word-break: break-word;
    }
    .ai-chat-write-card-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .ai-chat-write-card-btn {
      border: none;
      border-radius: var(--aic-radius);
      padding: 10px 16px;
      font-size: .88rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      -webkit-tap-highlight-color: transparent;
      transition: filter .15s ease, transform .15s ease;
    }
    .ai-chat-write-card-btn:active:not(:disabled) { transform: scale(0.97); }
    .ai-chat-write-card-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ai-chat-write-card-btn-primary {
      background: var(--aic-accent);
      color: var(--aic-accent-text);
    }
    .ai-chat-write-card-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
    .ai-chat-write-card-btn-secondary {
      background: transparent;
      color: var(--aic-text-muted);
      border: 1px solid var(--aic-border);
    }
    .ai-chat-write-card-btn-secondary:hover:not(:disabled) {
      border-color: var(--aic-text-muted);
      color: var(--aic-text);
    }
    .ai-chat-write-card-status {
      font-size: .78rem;
      color: var(--aic-text-muted);
      font-style: italic;
    }
    .ai-chat-write-card-status.success { color: var(--aic-blue); }
    .ai-chat-write-card-status.error { color: var(--aic-danger); }

    @media (max-width: 768px) {
      .ai-chat-write-card-btn {
        min-height: 48px;
        padding: 12px 18px;
      }
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
        // Friction UX (SF1) : on focus l'input dans tous les cas, y compris tactile,
        // pour que le clavier mobile sorte automatiquement quand le panel s'ouvre.
        input.focus();
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
    // Repere le dernier index role===model pour n'afficher le bouton regenerate
    // que sur ce message (cf. UX : on ne veut regenerer que la derniere reponse).
    let lastBotIdx = -1;
    for (let i = state.history.length - 1; i >= 0; i--) {
      if (state.history[i].role === 'model') { lastBotIdx = i; break; }
    }
    state.history.forEach((m, idx) => {
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
        // Actions : copy (toujours) + regenerate (dernier message bot uniquement,
        // et seulement si pas en cours d'envoi).
        const actions = buildBotMsgActions(m, idx === lastBotIdx);
        div.appendChild(actions);
      } else {
        return;
      }
      container.appendChild(div);

      // Cards memoire (apres le message model qui les a generes)
      if (m.role === 'model' && Array.isArray(m._memory_ops)) {
        m._memory_ops.forEach((op) => {
          const card = renderMemoryCard(op);
          if (card) container.appendChild(card);
        });
      }
      // Cards de confirmation V2 ECRITURE : un par write_action propose par l'IA.
      // Si deja confirme/annule (m._write_states[i]), affiche la carte en mode read-only.
      if (m.role === 'model' && Array.isArray(m._write_actions) && m._write_actions.length) {
        const proposals = Array.isArray(m._proposals) ? m._proposals : [];
        const states = Array.isArray(m._write_states) ? m._write_states : [];
        m._write_actions.forEach((action, i) => {
          const proposal = proposals[i] || null;
          const st = states[i] || null;
          const card = renderWriteCard(action, proposal, st, idx, i);
          if (card) container.appendChild(card);
        });
      }
    });

    // Note: l'ancien fallback "✨ Je cherche..." a ete remplace par le typing
    // indicator (3 dots pulsing) ajoute directement par onSubmit() via
    // showTypingIndicator() — feedback temps reel, pas dependant du re-render.
    if (state.sending) {
      showTypingIndicator();
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

  // ----- Actions sur message bot : copy + regenerate -----

  // Construit la barre d'actions affichee en bas du message bot.
  // Copy : toujours present. Regenerate : uniquement sur le dernier message bot.
  function buildBotMsgActions(msg, isLastBot) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-chat-msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'ai-chat-msg-actionbtn';
    copyBtn.title = 'Copier le message';
    copyBtn.setAttribute('aria-label', 'Copier le message');
    copyBtn.textContent = '📋';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyMessageText(textOf(msg), copyBtn);
    });
    wrap.appendChild(copyBtn);

    if (isLastBot) {
      const regenBtn = document.createElement('button');
      regenBtn.type = 'button';
      regenBtn.className = 'ai-chat-msg-actionbtn';
      regenBtn.title = 'Regenerer la reponse';
      regenBtn.setAttribute('aria-label', 'Regenerer la reponse');
      regenBtn.textContent = '🔄';
      // Disable pendant un envoi en cours pour eviter doubles requetes.
      if (state.sending) regenBtn.disabled = true;
      regenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        regenerateLastBot();
      });
      wrap.appendChild(regenBtn);
    }
    return wrap;
  }

  // Copie le texte brut markdown (pas le HTML rendu) dans le presse-papier.
  // Feedback : le bouton passe a ✓ pendant 1.5s puis revient a 📋.
  function copyMessageText(text, btn) {
    const restore = () => {
      btn.textContent = '📋';
      btn.classList.remove('copied');
      btn.title = 'Copier le message';
    };
    const success = () => {
      btn.textContent = '✓';
      btn.classList.add('copied');
      btn.title = 'Copie !';
      setTimeout(restore, 1500);
    };
    const fail = () => {
      btn.textContent = '✗';
      btn.title = 'Echec copie';
      setTimeout(restore, 1500);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(success, () => fallbackCopy(text, success, fail));
      } else {
        fallbackCopy(text, success, fail);
      }
    } catch (_) {
      fallbackCopy(text, success, fail);
    }
  }

  // Fallback pour navigateurs sans Clipboard API (ou contexte non sécurisé).
  function fallbackCopy(text, onOk, onErr) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? onOk() : onErr();
    } catch (_) { onErr(); }
  }

  // Regenere la derniere reponse bot : retire le dernier model de l'history,
  // retrouve le dernier user qui le precedait et re-declenche onSubmit() avec
  // ce texte. Si aucun message bot a regenerer (ou en cours d'envoi), no-op.
  async function regenerateLastBot() {
    if (state.sending) return;
    if (!state.history.length) return;
    // Verifie que le dernier message est bien un model (sinon rien a regenerer).
    const last = state.history[state.history.length - 1];
    if (!last || last.role !== 'model') return;
    // Pop le dernier model.
    state.history.pop();
    // Trouve le dernier user qui le precede (devrait etre tout en bout maintenant).
    let lastUserText = '';
    for (let i = state.history.length - 1; i >= 0; i--) {
      if (state.history[i].role === 'user') {
        lastUserText = textOf(state.history[i]);
        // On retire aussi ce message user, onSubmit() va le re-pusher.
        state.history.splice(i, 1);
        break;
      }
    }
    if (!lastUserText) {
      // Pas de user a re-utiliser : on remet le model qu'on avait pop pour
      // ne pas perdre l'affichage et on stoppe.
      state.history.push(last);
      saveHistory();
      renderMessages();
      return;
    }
    saveHistory();
    renderMessages();
    // Reinjecte le texte dans l'input puis declenche le submit (passe par toute
    // la logique : sanitize, retry, errors, etc.).
    const input = document.getElementById('ai-chat-input');
    if (input) {
      input.value = lastUserText;
      const form = document.getElementById('ai-chat-form');
      if (form) form.requestSubmit();
    }
  }

  // ----- Typing indicator (feedback temps reel pendant l'envoi) -----

  // Ajoute une bulle "3 dots pulsing" immediatement apres l'envoi pour indiquer
  // a l'utilisateur que le message est en cours de traitement. Sans ca, le delai
  // entre envoi et re-render etait suffisamment long pour faire douter et pousser
  // l'user a renvoyer la demande (cf. bug "je dois envoyer plusieurs fois").
  function showTypingIndicator() {
    const c = document.getElementById('ai-chat-messages');
    if (!c) return;
    if (document.getElementById('ai-chat-typing-indicator')) return; // pas de doublon
    const div = document.createElement('div');
    div.id = 'ai-chat-typing-indicator';
    div.className = 'ai-chat-msg ai-chat-msg-bot ai-chat-typing';
    div.innerHTML = '<span class="ai-chat-typing-dot"></span><span class="ai-chat-typing-dot"></span><span class="ai-chat-typing-dot"></span>';
    c.appendChild(div);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const el = document.getElementById('ai-chat-typing-indicator');
    if (el) el.remove();
  }

  // ----- Countdown rate limit (UX fluide vs erreur) -----

  // Affiche un compte a rebours dans le placeholder de l'input pendant que
  // l'on attend la fin du rate limit Gemini, puis resout. Si l'utilisateur
  // ferme/ouvre le panel pendant l'attente, l'attente continue (Promise vit).
  function waitWithCountdown(seconds) {
    return new Promise((resolve) => {
      // Cache le typing indicator pendant le countdown : on remplace le feedback
      // "3 dots" par le compte a rebours explicite. Re-shown apres pour le retry.
      hideTypingIndicator();
      const c = document.getElementById('ai-chat-messages');
      let bubble = null;
      if (c) {
        bubble = document.createElement('div');
        bubble.className = 'ai-chat-msg-loading';
        bubble.textContent = `⏳ Quota Gemini atteint, retry auto dans ${Math.ceil(seconds)}s…`;
        c.appendChild(bubble);
        scrollToBottom();
      }
      let remaining = Math.ceil(seconds);
      const tick = () => {
        remaining -= 1;
        if (bubble) {
          bubble.textContent = remaining > 0
            ? `⏳ Quota Gemini atteint, retry auto dans ${remaining}s…`
            : `🔄 Reprise…`;
        }
        if (remaining <= 0) {
          clearInterval(t);
          if (bubble) bubble.remove();
          // Remet le typing indicator pendant le retry pour que l'utilisateur
          // voie que ca repart bien (sinon trou visuel jusqu'a la reponse).
          if (state.sending) showTypingIndicator();
          resolve();
        }
      };
      const t = setInterval(tick, 1000);
    });
  }

  // ----- Memoire long-terme : cards inline -----

  function renderMemoryCard(op) {
    if (!op || typeof op !== 'object') return null;
    const card = document.createElement('div');
    card.className = 'ai-chat-mem-card';
    if (op.type === 'added' && op.fact) {
      card.innerHTML = `
        <span class="ai-chat-mem-icon" aria-hidden="true">💾</span>
        <div class="ai-chat-mem-body">
          <div class="ai-chat-mem-fact"></div>
          <div class="ai-chat-mem-meta">Memorise · categorie: <span class="ai-chat-mem-cat"></span> · importance: <span class="ai-chat-mem-imp"></span>/5</div>
        </div>
        <button class="ai-chat-mem-del" type="button" title="Oublier ce fait">Oublier</button>
      `;
      card.querySelector('.ai-chat-mem-fact').textContent = op.fact.fact_text || '';
      card.querySelector('.ai-chat-mem-cat').textContent = op.fact.category || 'general';
      card.querySelector('.ai-chat-mem-imp').textContent = String(op.fact.importance ?? 3);
      const factId = op.fact.id;
      const btn = card.querySelector('.ai-chat-mem-del');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '...';
        const ok = await deleteMemoryFactDirect(factId);
        if (ok) {
          card.classList.add('deleted');
          card.querySelector('.ai-chat-mem-icon').textContent = '🗑';
          card.querySelector('.ai-chat-mem-fact').style.textDecoration = 'line-through';
          card.querySelector('.ai-chat-mem-meta').textContent = 'Oublie. L\'IA n\'aura plus ce fait dans les conversations futures.';
          btn.remove();
        } else {
          btn.disabled = false;
          btn.textContent = 'Oublier';
          alert('Echec de la suppression. Reessaye dans quelques secondes.');
        }
      });
      return card;
    }
    if (op.type === 'deleted') {
      card.classList.add('deleted');
      const txt = op.deleted?.fact_text || '(fait inconnu)';
      card.innerHTML = `
        <span class="ai-chat-mem-icon" aria-hidden="true">🗑</span>
        <div class="ai-chat-mem-body">
          <div class="ai-chat-mem-fact" style="text-decoration:line-through"></div>
          <div class="ai-chat-mem-meta">Fait oublie par l'IA.</div>
        </div>
      `;
      card.querySelector('.ai-chat-mem-fact').textContent = txt;
      return card;
    }
    return null;
  }

  // Delete direct via Supabase (RLS protege deja : seul admin peut supprimer).
  async function deleteMemoryFactDirect(id) {
    try {
      const client = window.DelivProSupabase && window.DelivProSupabase.getClient
        ? window.DelivProSupabase.getClient()
        : null;
      if (!client || !id) return false;
      const { error } = await client.from('ai_memory').delete().eq('id', id);
      return !error;
    } catch (_) { return false; }
  }

  // ----- V2 ECRITURE : cards de confirmation -----

  // Mapping action -> titre + icone affiches dans la carte. Centralise pour
  // ne pas dupliquer la logique dans renderWriteCard.
  const WRITE_ACTION_META = {
    create_livraison: { icon: '🚚', title: '➕ Creer une livraison', kind: 'create' },
    create_charge: { icon: '💸', title: '➕ Creer une charge', kind: 'create' },
    create_paiement: { icon: '💰', title: '➕ Enregistrer un paiement', kind: 'create' },
    resolve_alerte: { icon: '✅', title: '✓ Marquer alerte resolue', kind: 'create' },
    create_client: { icon: '🧑‍💼', title: '➕ Creer un client', kind: 'create' },
    create_fournisseur: { icon: '🏭', title: '➕ Creer un fournisseur', kind: 'create' },
    create_vehicule: { icon: '🚐', title: '➕ Creer un vehicule', kind: 'create' },
    create_salarie: { icon: '👤', title: '➕ Creer un salarie', kind: 'create' },
    create_carburant: { icon: '⛽', title: '➕ Enregistrer un plein', kind: 'create' },
    create_entretien: { icon: '🔧', title: '➕ Creer un entretien', kind: 'create' },
    create_incident: { icon: '🚨', title: '➕ Creer un incident', kind: 'create' },
    create_planning_creneau: { icon: '📅', title: '➕ Creer un creneau planning', kind: 'create' },
    create_inspection: { icon: '🚗', title: '➕ Creer une inspection', kind: 'create' },
    // Phase 2 — UPDATE
    update_livraison: { icon: '✏️', title: '✏️ Modifier une livraison', kind: 'update' },
    update_charge: { icon: '✏️', title: '✏️ Modifier une charge', kind: 'update' },
    update_paiement: { icon: '✏️', title: '✏️ Modifier un paiement', kind: 'update' },
    update_client: { icon: '✏️', title: '✏️ Modifier un client', kind: 'update' },
    update_fournisseur: { icon: '✏️', title: '✏️ Modifier un fournisseur', kind: 'update' },
    update_vehicule: { icon: '✏️', title: '✏️ Modifier un vehicule', kind: 'update' },
    update_salarie: { icon: '✏️', title: '✏️ Modifier un salarie', kind: 'update' },
    update_carburant: { icon: '✏️', title: '✏️ Modifier un plein', kind: 'update' },
    update_entretien: { icon: '✏️', title: '✏️ Modifier un entretien', kind: 'update' },
    update_incident: { icon: '✏️', title: '✏️ Modifier un incident', kind: 'update' },
    update_planning_creneau: { icon: '✏️', title: '✏️ Modifier un creneau', kind: 'update' },
    update_inspection: { icon: '✏️', title: '✏️ Modifier une inspection', kind: 'update' },
    // Phase 3 — DELETE (rouge)
    delete_entity: { icon: '🗑️', title: '🗑️ SUPPRIMER une entite', kind: 'delete' },
    // Phase 4 — Brouillon (mode autonome)
    add_to_drafts: { icon: '📋', title: '📋 Ajouter aux brouillons IA', kind: 'draft' },
  };

  // Formatage d'une valeur pour la table de confirmation : null/undefined -> tiret,
  // numbers -> 2 decimales si non-entier, dates ISO inchangees, autres -> string.
  function formatWriteValue(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      return v.toFixed(2);
    }
    if (typeof v === 'boolean') return v ? 'oui' : 'non';
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch (_) { return String(v); }
    }
    return String(v);
  }

  // Construit la liste de paires {label, value} a afficher pour une action.
  // On prefere proposal.summary (plus humain : libelles resolus) au payload brut.
  function buildWriteCardRows(action, proposal) {
    if (proposal && proposal.summary && typeof proposal.summary === 'object') {
      return Object.entries(proposal.summary).map(([k, v]) => ({ label: k, value: formatWriteValue(v) }));
    }
    const payload = (action && action.payload) || (proposal && proposal.payload) || {};
    return Object.entries(payload).map(([k, v]) => ({ label: k, value: formatWriteValue(v) }));
  }

  // Rendu d'une carte de confirmation pour une write_action.
  // kind: 'create' (orange par defaut), 'update' (bleu), 'delete' (rouge + confirmation 2x), 'draft' (gris).
  function renderWriteCard(action, proposal, st, msgIdx, actionIdx) {
    if (!action || typeof action !== 'object' || !action.action) return null;
    let actionKey = action.action;
    if (actionKey && actionKey.startsWith('update_')) actionKey = actionKey;
    const meta = WRITE_ACTION_META[actionKey] || { icon: '🤖', title: 'Action proposee par l\'IA', kind: 'create' };
    const kind = meta.kind || 'create';
    const card = document.createElement('div');
    card.className = 'ai-chat-write-card ai-chat-write-card-' + kind;
    if (st && st.confirmed) card.classList.add('confirmed');
    if (st && st.cancelled) card.classList.add('cancelled');
    if (st && st.drafted) card.classList.add('drafted');

    const title = document.createElement('div');
    title.className = 'ai-chat-write-card-title';
    title.innerHTML = '<span class="ai-chat-write-card-icon" aria-hidden="true"></span><span class="ai-chat-write-card-titletext"></span>';
    title.querySelector('.ai-chat-write-card-icon').textContent = meta.icon;
    title.querySelector('.ai-chat-write-card-titletext').textContent = '🤖 ' + meta.title;
    card.appendChild(title);

    if (kind === 'update' && (action.target_id || (proposal && proposal.target_id))) {
      const tid = action.target_id || proposal.target_id;
      const meta2 = document.createElement('div');
      meta2.className = 'ai-chat-write-card-meta';
      meta2.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:6px;';
      meta2.textContent = 'Target ID : ' + String(tid);
      card.appendChild(meta2);
    }

    if (kind === 'delete') {
      const warn = document.createElement('div');
      warn.className = 'ai-chat-write-card-warn';
      warn.style.cssText = 'background:#fef2f2;border-left:3px solid #dc2626;color:#991b1b;padding:8px 10px;margin:6px 0;font-size:13px;font-weight:600;';
      warn.textContent = '⚠️ Suppression definitive — appuie longuement (1.5s) sur le bouton rouge pour confirmer.';
      card.appendChild(warn);
    }

    const rows = buildWriteCardRows(action, proposal);
    if (rows.length) {
      const table = document.createElement('table');
      table.className = 'ai-chat-write-card-table';
      const tbody = document.createElement('tbody');
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = r.label;
        const td = document.createElement('td');
        td.textContent = r.value;
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.appendChild(table);
    }

    if (st && (st.confirmed || st.cancelled || st.drafted)) {
      const status = document.createElement('div');
      let cls = 'ai-chat-write-card-status';
      if (st.confirmed) cls += ' success';
      else if (st.cancelled) cls += ' error';
      else if (st.drafted) cls += ' info';
      status.className = cls;
      if (st.confirmed) {
        const id = (st.result && (st.result.created_id || st.result.updated_id || st.result.deleted_id || st.result.alerte_id)) || '';
        const num = st.result && st.result.num_liv ? ' (' + st.result.num_liv + ')' : '';
        status.textContent = '✓ Confirmee et executee' + num + (id ? ' · id: ' + String(id).slice(0, 8) : '');
      } else if (st.drafted) {
        const did = st.result && st.result.draft_id ? String(st.result.draft_id).slice(0, 8) : '';
        status.textContent = '📋 Mise en brouillon IA' + (did ? ' · id: ' + did : '');
      } else {
        status.textContent = '✗ Annulee';
      }
      card.appendChild(status);
      return card;
    }

    const actions = document.createElement('div');
    actions.className = 'ai-chat-write-card-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ai-chat-write-card-btn ai-chat-write-card-btn-secondary';
    cancelBtn.textContent = '✕ Annuler';
    cancelBtn.style.minHeight = '44px';

    const draftBtn = document.createElement('button');
    draftBtn.type = 'button';
    draftBtn.className = 'ai-chat-write-card-btn ai-chat-write-card-btn-draft';
    draftBtn.textContent = '📋 Brouillon';
    draftBtn.style.cssText = 'min-height:44px;background:#e5e7eb;color:#374151;';
    draftBtn.title = 'Garder en brouillon — a revoir plus tard dans la page Brouillons IA';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'ai-chat-write-card-btn ai-chat-write-card-btn-primary';
    confirmBtn.style.minHeight = '44px';
    if (kind === 'delete') {
      confirmBtn.classList.add('ai-chat-write-card-btn-danger');
      confirmBtn.textContent = '🗑️ Supprimer (long-press)';
      confirmBtn.style.cssText += 'min-height:44px;background:#dc2626;color:white;';
    } else if (kind === 'update') {
      confirmBtn.textContent = '✓ Confirmer modification';
    } else {
      confirmBtn.textContent = '✓ Confirmer & creer';
    }

    cancelBtn.addEventListener('click', () => cancelWriteAction(msgIdx, actionIdx));
    draftBtn.addEventListener('click', () => draftWriteAction(msgIdx, actionIdx, confirmBtn, cancelBtn, draftBtn, card));

    if (kind === 'delete') {
      let pressTimer = null;
      let pressing = false;
      const startPress = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (confirmBtn.disabled) return;
        pressing = true;
        confirmBtn.textContent = '🗑️ Maintien...';
        pressTimer = setTimeout(() => {
          if (pressing) {
            confirmBtn.textContent = '⏳ Suppression...';
            confirmWriteAction(msgIdx, actionIdx, confirmBtn, cancelBtn, card);
          }
        }, 1500);
      };
      const endPress = () => {
        pressing = false;
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (!confirmBtn.disabled) confirmBtn.textContent = '🗑️ Supprimer (long-press)';
      };
      confirmBtn.addEventListener('mousedown', startPress);
      confirmBtn.addEventListener('touchstart', startPress, { passive: false });
      confirmBtn.addEventListener('mouseup', endPress);
      confirmBtn.addEventListener('mouseleave', endPress);
      confirmBtn.addEventListener('touchend', endPress);
      confirmBtn.addEventListener('touchcancel', endPress);
    } else {
      confirmBtn.addEventListener('click', () => {
        confirmWriteAction(msgIdx, actionIdx, confirmBtn, cancelBtn, card);
      });
    }

    actions.appendChild(cancelBtn);
    actions.appendChild(draftBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(actions);
    return card;
  }

  async function draftWriteAction(msgIdx, actionIdx, confirmBtn, cancelBtn, draftBtn, _card) {
    const msg = state.history[msgIdx];
    if (!msg || !Array.isArray(msg._write_actions)) return;
    const action = msg._write_actions[actionIdx];
    if (!action) return;
    confirmBtn.disabled = true; cancelBtn.disabled = true; draftBtn.disabled = true;
    draftBtn.textContent = '⏳...';
    try {
      const draftAction = {
        action: 'add_to_drafts',
        action_type: action.action,
        payload: action,
        reasoning: 'Mise en brouillon depuis le chat IA',
      };
      const result = await callWriteExecute(draftAction);
      if (!result || !result.success) {
        confirmBtn.disabled = false; cancelBtn.disabled = false; draftBtn.disabled = false;
        draftBtn.textContent = '📋 Brouillon';
        showToast('Erreur brouillon : ' + (result?.error || 'inconnu'), 'error');
        return;
      }
      if (!Array.isArray(msg._write_states)) {
        msg._write_states = msg._write_actions.map(() => null);
      }
      msg._write_states[actionIdx] = { drafted: true, result };
      saveHistory();
      showToast('📋 Action mise en brouillon', 'info');
      renderMessages();
    } catch (e) {
      confirmBtn.disabled = false; cancelBtn.disabled = false; draftBtn.disabled = false;
      draftBtn.textContent = '📋 Brouillon';
      showToast('Erreur : ' + (e.message || e), 'error');
    }
  }

  // Confirme et execute la write_action via l'edge function ai-chat-write-execute.
  // Met a jour _write_states[i] en localStorage + ajoute un message bot de feedback.
  async function confirmWriteAction(msgIdx, actionIdx, confirmBtn, cancelBtn, card) {
    const msg = state.history[msgIdx];
    if (!msg || !Array.isArray(msg._write_actions)) return;
    const action = msg._write_actions[actionIdx];
    if (!action) return;

    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = '⏳ Creation...';

    try {
      const result = await callWriteExecute(action);
      if (!result || !result.success) {
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        confirmBtn.textContent = '✅ Confirmer & creer';
        showToast('Erreur : ' + (result?.error || 'inconnu'), 'error');
        return;
      }
      // Marque comme confirmee dans le state, persiste en localStorage.
      if (!Array.isArray(msg._write_states)) {
        msg._write_states = msg._write_actions.map(() => null);
      }
      msg._write_states[actionIdx] = { confirmed: true, result };
      saveHistory();

      // Toast + message bot recap.
      const nice = niceCreatedLabel(action.action, result);
      showToast('✅ ' + nice, 'success');
      state.history.push({
        role: 'model',
        parts: [{ text: '✓ ' + nice + ' avec succes.' + (result.created_id ? ' ID: `' + result.created_id + '`' : '') }],
        _tools: [],
        _memory_ops: [],
        _write_actions: [],
        _proposals: [],
        _write_states: [],
      });
      saveHistory();
      renderMessages();
    } catch (e) {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = '✅ Confirmer & creer';
      showToast('Erreur : ' + (e.message || e), 'error');
    }
  }

  // Annule une write_action : marque cancelled dans le state, ajoute un message bot.
  function cancelWriteAction(msgIdx, actionIdx) {
    const msg = state.history[msgIdx];
    if (!msg || !Array.isArray(msg._write_actions)) return;
    if (!Array.isArray(msg._write_states)) {
      msg._write_states = msg._write_actions.map(() => null);
    }
    msg._write_states[actionIdx] = { cancelled: true };
    saveHistory();
    state.history.push({
      role: 'model',
      parts: [{ text: 'Action annulee.' }],
      _tools: [],
      _memory_ops: [],
      _write_actions: [],
      _proposals: [],
      _write_states: [],
    });
    saveHistory();
    renderMessages();
  }

  function niceCreatedLabel(action, result) {
    switch (action) {
      case 'create_livraison': return 'Livraison ' + (result.num_liv || '') + ' creee';
      case 'create_charge': return 'Charge creee';
      case 'create_paiement': return 'Paiement enregistre';
      case 'resolve_alerte': return 'Alerte marquee resolue';
      case 'create_client': return 'Client cree';
      case 'create_fournisseur': return 'Fournisseur cree';
      case 'create_vehicule': return 'Vehicule cree';
      case 'create_salarie': return 'Salarie cree';
      case 'create_carburant': return 'Plein enregistre';
      case 'create_entretien': return 'Entretien cree';
      case 'create_incident': return 'Incident cree';
      case 'create_planning_creneau': return 'Creneau planning cree';
      case 'create_inspection': return 'Inspection creee';
      case 'delete_entity': return 'Entite supprimee';
      case 'add_to_drafts': return 'Ajoutee aux brouillons';
      case 'execute_draft': return 'Brouillon execute';
      case 'reject_draft': return 'Brouillon rejete';
      default:
        if (action && action.startsWith('update_')) return 'Modification enregistree (' + action.slice(7) + ')';
        return 'Action confirmee';
    }
  }

  // Toast minimaliste (pas de dependance globale, fallback sur console).
  // Reutilise window.showToast / window.MToast si dispo (parite PC + mobile).
  function showToast(text, kind) {
    try {
      if (window.MToast && typeof window.MToast.show === 'function') {
        window.MToast.show(text, { type: kind || 'info' });
        return;
      }
      if (typeof window.showToast === 'function') {
        window.showToast(text, kind || 'info');
        return;
      }
    } catch (_) {}
    // Fallback : toast inline temporaire dans le panel chat.
    try {
      const c = document.getElementById('ai-chat-messages');
      if (!c) return;
      const div = document.createElement('div');
      div.className = 'ai-chat-msg-error';
      div.style.background = kind === 'error' ? 'var(--aic-danger-soft)' : 'var(--aic-blue-tint)';
      div.style.color = kind === 'error' ? 'var(--aic-danger)' : 'var(--aic-blue)';
      div.textContent = text;
      c.appendChild(div);
      setTimeout(() => { div.remove(); }, 4000);
      scrollToBottom();
    } catch (_) {}
  }

  // POST /functions/v1/ai-chat-write-execute avec auth admin. Retourne { success, ... }.
  async function callWriteExecute(action) {
    const client = window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
    if (!client) throw new Error('Supabase pas pret');
    const { data: sessionData } = await client.auth.getSession();
    const sess = sessionData && sessionData.session;
    const token = sess ? sess.access_token : null;
    if (!token) throw new Error('Session expiree, reconnecte-toi.');
    const config = window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig()
      : null;
    const baseUrl = config && config.url ? config.url : '';
    if (!baseUrl) throw new Error('Supabase URL manquante');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    let r;
    try {
      r = await fetch(baseUrl + '/functions/v1/ai-chat-write-execute', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(body.error || ('HTTP ' + r.status));
      throw e;
    }
    return body;
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
    // Affiche le typing indicator IMMEDIATEMENT (avant le re-render qui suit)
    // pour donner un feedback visuel instantane et eviter que l'utilisateur
    // renvoie sa demande pensant qu'elle n'a pas ete prise en compte.
    // renderMessages() le re-injecte aussi (via state.sending), mais en l'ajoutant
    // ici on garantit le feedback < 16ms meme si le render est lent.
    showTypingIndicator();
    renderMessages();

    let succeeded = false;
    try {
      // Boucle de retry transparente sur rate limit Gemini < MAX_AUTO_RETRY_SECONDS.
      // L'UX affiche un compte a rebours au lieu d'une erreur, puis renvoie
      // automatiquement quand le quota se libere (RPM/TPM se reset chaque minute).
      let attempts = 0;
      while (true) {
        try {
          const reply = await callBackend(state.history);
          const writeActions = Array.isArray(reply.write_actions) ? reply.write_actions : [];
          const proposals = Array.isArray(reply.proposals) ? reply.proposals : [];
          state.history.push({
            role: 'model',
            parts: [{ text: reply.text }],
            _tools: reply.tools_called,
            _memory_ops: Array.isArray(reply.memory_ops) ? reply.memory_ops : [],
            _write_actions: writeActions,
            _proposals: proposals,
            // _write_states[i] : null (en attente) | { confirmed:true, result } | { cancelled:true }
            _write_states: writeActions.map(() => null),
          });
          state.proRemaining = reply.pro_remaining;
          state.modelLast = reply.model_used;
          saveHistory();
          succeeded = true;
          break;
        } catch (e) {
          if (e && e.rateLimitRetry && attempts < 3) {
            attempts++;
            await waitWithCountdown(e.retryAfter);
            continue; // retry
          }
          throw e;
        }
      }
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
      hideTypingIndicator();
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
        hideTypingIndicator();
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
      // 429 / rate limit Gemini avec retry_after raisonnable -> on signale un
      // RATE_LIMIT_RETRY que onSubmit() va intercepter pour faire un countdown
      // visible et retry sans afficher d'erreur a l'user.
      const ra = Number(body.retry_after_seconds);
      if (body.code === 429 && ra > 0 && ra <= MAX_AUTO_RETRY_SECONDS) {
        const e = new Error('rate_limit_retry');
        e.rateLimitRetry = true;
        e.retryAfter = ra;
        throw e;
      }
      const friendly = body.hint
        ? body.hint
        : (body.message || body.error || 'HTTP ' + r.status);
      throw new Error(friendly);
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
