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
  const OCR_ENDPOINT = '/functions/v1/ai-ocr';
  // Timeout client OCR (Gemini multimodal sur Flash : 5-15s typique, 30s pire cas).
  const OCR_TIMEOUT_MS = 60000;
  // Auto-retry si Gemini renvoie 429 avec retry_after <= ce seuil. UX : on
  // affiche un compte a rebours au lieu d'un message d'erreur.
  const MAX_AUTO_RETRY_SECONDS = 90;

  // Modes OCR supportes par l'edge fn ai-ocr. Doit rester aligne avec le backend.
  const OCR_MODES = [
    {
      key: 'facture',
      icon: '📄',
      label: 'Facture fournisseur',
      desc: 'Extrait fournisseur, montant HT/TTC, TVA, lignes',
    },
    {
      key: 'ticket_carburant',
      icon: '⛽',
      label: 'Ticket carburant',
      desc: 'Extrait station, litres, prix/L, type carburant',
    },
    {
      key: 'rib',
      icon: '🏦',
      label: 'RIB',
      desc: 'Extrait IBAN, BIC, banque, titulaire',
    },
  ];

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
        <button id="ai-chat-attach" type="button" class="ai-chat-attachbtn" title="Scanner une facture / ticket / RIB" aria-label="Scanner un document">📎</button>
        <textarea id="ai-chat-input" placeholder="Demande-moi un truc sur ton activite..." rows="1" aria-label="Ton message"></textarea>
        <button id="ai-chat-send" type="submit" title="Envoyer" aria-label="Envoyer">↑</button>
      </form>
      <!-- Sheet OCR : selection mode + upload + resultats. Vit dans le panel
           pour heriter du z-index 200 et eviter les conflits avec m-sheet (110). -->
      <div id="ai-chat-ocr-sheet" class="ai-chat-ocr-sheet" aria-hidden="true" hidden>
        <div class="ai-chat-ocr-backdrop"></div>
        <div class="ai-chat-ocr-card" role="dialog" aria-label="Scanner un document">
          <header class="ai-chat-ocr-header">
            <h3 class="ai-chat-ocr-title">📎 Scanner un document</h3>
            <button class="ai-chat-iconbtn" id="ai-chat-ocr-close" type="button" aria-label="Fermer">✕</button>
          </header>
          <div class="ai-chat-ocr-body" id="ai-chat-ocr-body"></div>
        </div>
      </div>
      <input type="file" id="ai-chat-ocr-file" accept="image/*" capture="environment" style="display:none" />
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

    /* ========== Bouton 📎 (OCR) ========== */
    .ai-chat-attachbtn {
      background: transparent;
      color: var(--aic-text-muted);
      border: 1px solid var(--aic-border);
      border-radius: var(--aic-radius);
      width: 44px;
      height: 44px;
      cursor: pointer;
      font-size: 1.15rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color .15s ease, color .15s ease, background .15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-attachbtn:hover:not(:disabled) {
      border-color: var(--aic-accent);
      color: var(--aic-text);
      background: var(--aic-accent-soft);
    }
    .ai-chat-attachbtn:active:not(:disabled) { transform: scale(0.96); }
    .ai-chat-attachbtn:disabled { opacity: .4; cursor: not-allowed; }

    /* ========== Sheet OCR (modal interne au panel) ========== */
    .ai-chat-ocr-sheet {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14px;
    }
    .ai-chat-ocr-sheet[hidden] { display: none; }
    .ai-chat-ocr-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(2px);
    }
    .ai-chat-ocr-card {
      position: relative;
      background: var(--aic-bg);
      border: 1px solid var(--aic-border);
      border-radius: var(--aic-radius-lg);
      box-shadow: var(--aic-shadow);
      width: 100%;
      max-width: 420px;
      max-height: 90%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .ai-chat-ocr-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid var(--aic-border);
      background: var(--aic-card);
    }
    .ai-chat-ocr-title {
      margin: 0;
      font-size: .95rem;
      font-weight: 700;
      color: var(--aic-text);
    }
    .ai-chat-ocr-body {
      padding: 14px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ai-chat-ocr-mode {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--aic-border);
      border-radius: var(--aic-radius);
      background: var(--aic-card);
      color: var(--aic-text);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: border-color .15s ease, background .15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-ocr-mode:hover, .ai-chat-ocr-mode:active {
      border-color: var(--aic-accent);
      background: var(--aic-accent-soft);
    }
    .ai-chat-ocr-mode-icon { font-size: 1.6rem; line-height: 1; flex-shrink: 0; }
    .ai-chat-ocr-mode-text { flex: 1; min-width: 0; }
    .ai-chat-ocr-mode-label { font-weight: 700; font-size: .92rem; margin-bottom: 2px; }
    .ai-chat-ocr-mode-desc { font-size: .76rem; color: var(--aic-text-muted); }

    .ai-chat-ocr-status {
      padding: 14px;
      text-align: center;
      color: var(--aic-text-muted);
      font-size: .88rem;
    }
    .ai-chat-ocr-status .ai-chat-ocr-spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid var(--aic-border);
      border-top-color: var(--aic-accent);
      border-radius: 50%;
      animation: aic-spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes aic-spin { to { transform: rotate(360deg); } }

    .ai-chat-ocr-error {
      padding: 12px;
      background: var(--aic-danger-soft);
      color: var(--aic-danger);
      border: 1px solid var(--aic-danger-border);
      border-radius: var(--aic-radius);
      font-size: .82rem;
      white-space: pre-wrap;
    }

    .ai-chat-ocr-result {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ai-chat-ocr-fields {
      background: var(--aic-card);
      border: 1px solid var(--aic-border);
      border-radius: var(--aic-radius);
      padding: 10px 12px;
      font-size: .82rem;
    }
    .ai-chat-ocr-field {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px solid var(--aic-border);
    }
    .ai-chat-ocr-field:last-child { border-bottom: none; }
    .ai-chat-ocr-field-key {
      color: var(--aic-text-muted);
      font-size: .76rem;
      text-transform: uppercase;
      letter-spacing: .03em;
      flex-shrink: 0;
    }
    .ai-chat-ocr-field-val {
      color: var(--aic-text);
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }
    .ai-chat-ocr-field-val.is-null { color: var(--aic-text-muted); font-weight: 400; font-style: italic; }
    .ai-chat-ocr-lines {
      margin: 6px 0 0;
      padding-left: 16px;
      font-size: .76rem;
      color: var(--aic-text-muted);
    }
    .ai-chat-ocr-lines li { margin: 2px 0; }

    .ai-chat-ocr-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ai-chat-ocr-actions button {
      flex: 1 1 auto;
      min-width: 120px;
      padding: 10px 12px;
      border-radius: var(--aic-radius);
      border: 1px solid var(--aic-border);
      cursor: pointer;
      font-family: inherit;
      font-size: .85rem;
      font-weight: 600;
      transition: filter .15s ease, background .15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ai-chat-ocr-btn-primary {
      background: var(--aic-accent);
      color: var(--aic-accent-text);
      border-color: var(--aic-accent);
    }
    .ai-chat-ocr-btn-primary:hover { filter: brightness(1.08); }
    .ai-chat-ocr-btn-secondary {
      background: transparent;
      color: var(--aic-text);
    }
    .ai-chat-ocr-btn-secondary:hover {
      background: rgba(255,255,255,0.05);
      border-color: var(--aic-text-muted);
    }
    .ai-chat-ocr-hint {
      font-size: .72rem;
      color: var(--aic-text-muted);
      text-align: center;
    }

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
      .ai-chat-attachbtn {
        width: var(--m-tap, 48px);
        height: var(--m-tap, 48px);
        font-size: 1.2rem;
      }
      .ai-chat-msg { font-size: .92rem; max-width: 88%; }
      /* OCR sheet : sur mobile, glisse depuis le bas comme une bottom-sheet */
      .ai-chat-ocr-sheet {
        align-items: flex-end;
        padding: 0;
      }
      .ai-chat-ocr-card {
        max-width: 100%;
        max-height: 92%;
        border-radius: var(--aic-radius-lg) var(--aic-radius-lg) 0 0;
        padding-bottom: var(--m-safe-bottom, 0px);
      }
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
    // 📎 OCR : ouvre la sheet de selection mode.
    document.getElementById('ai-chat-attach').addEventListener('click', openOcrSheet);
    document.getElementById('ai-chat-ocr-close').addEventListener('click', closeOcrSheet);
    document.querySelector('#ai-chat-ocr-sheet .ai-chat-ocr-backdrop').addEventListener('click', closeOcrSheet);
    document.getElementById('ai-chat-ocr-file').addEventListener('change', onOcrFileSelected);
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
          state.history.push({
            role: 'model',
            parts: [{ text: reply.text }],
            _tools: reply.tools_called,
            _memory_ops: Array.isArray(reply.memory_ops) ? reply.memory_ops : [],
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

  // ----- OCR (📎 scanner facture / ticket / RIB) -----

  // State local de la session OCR : mode courant + dernier resultat. Le state
  // n'est pas persiste : un upload OCR est ephemere et concerne un workflow court
  // (scan -> verifie -> pre-remplit form -> ferme).
  const ocrState = {
    mode: null,
    busy: false,
    lastResult: null,
  };

  function openOcrSheet() {
    if (ocrState.busy) return;
    const sheet = document.getElementById('ai-chat-ocr-sheet');
    if (!sheet) return;
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    renderOcrModeSelection();
  }

  function closeOcrSheet() {
    if (ocrState.busy) return; // ne pas fermer pendant l'analyse pour ne pas perdre le resultat
    const sheet = document.getElementById('ai-chat-ocr-sheet');
    if (!sheet) return;
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    ocrState.mode = null;
    ocrState.lastResult = null;
    // Reset l'input file (sinon re-selectionner la meme image n'emet pas l'event change)
    const fileInput = document.getElementById('ai-chat-ocr-file');
    if (fileInput) fileInput.value = '';
  }

  function renderOcrModeSelection() {
    const body = document.getElementById('ai-chat-ocr-body');
    if (!body) return;
    body.innerHTML = '';
    const intro = document.createElement('p');
    intro.style.margin = '0 0 6px';
    intro.style.fontSize = '.82rem';
    intro.style.color = 'var(--aic-text-muted)';
    intro.textContent = 'Choisis le type de document a scanner :';
    body.appendChild(intro);

    OCR_MODES.forEach((mode) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-chat-ocr-mode';
      btn.innerHTML = `
        <span class="ai-chat-ocr-mode-icon" aria-hidden="true"></span>
        <span class="ai-chat-ocr-mode-text">
          <div class="ai-chat-ocr-mode-label"></div>
          <div class="ai-chat-ocr-mode-desc"></div>
        </span>
      `;
      btn.querySelector('.ai-chat-ocr-mode-icon').textContent = mode.icon;
      btn.querySelector('.ai-chat-ocr-mode-label').textContent = mode.label;
      btn.querySelector('.ai-chat-ocr-mode-desc').textContent = mode.desc;
      btn.addEventListener('click', () => {
        ocrState.mode = mode.key;
        // Declenche le picker fichier (mobile : sortie appareil photo grace a capture=environment)
        const fileInput = document.getElementById('ai-chat-ocr-file');
        if (fileInput) fileInput.click();
      });
      body.appendChild(btn);
    });

    const hint = document.createElement('p');
    hint.className = 'ai-chat-ocr-hint';
    hint.textContent = 'Photo nette + horizontale = meilleur resultat. Compression auto avant envoi.';
    body.appendChild(hint);
  }

  function renderOcrStatus(text) {
    const body = document.getElementById('ai-chat-ocr-body');
    if (!body) return;
    body.innerHTML = `<div class="ai-chat-ocr-status"><span class="ai-chat-ocr-spinner" aria-hidden="true"></span>${escapeHtml(text)}</div>`;
  }

  function renderOcrError(msg, hint) {
    const body = document.getElementById('ai-chat-ocr-body');
    if (!body) return;
    body.innerHTML = '';
    const err = document.createElement('div');
    err.className = 'ai-chat-ocr-error';
    err.textContent = (hint ? msg + '\n\n' + hint : msg);
    body.appendChild(err);
    const actions = document.createElement('div');
    actions.className = 'ai-chat-ocr-actions';
    const retryBtn = document.createElement('button');
    retryBtn.className = 'ai-chat-ocr-btn-secondary';
    retryBtn.type = 'button';
    retryBtn.textContent = '⬅ Choisir un autre mode';
    retryBtn.addEventListener('click', renderOcrModeSelection);
    actions.appendChild(retryBtn);
    body.appendChild(actions);
  }

  // Compresse l'image via DelivProStorage si dispo, sinon la retourne brute.
  // Limite : edge fn ai-ocr cap a 10 MB. Apres compression on est largement sous.
  async function compressOcrFile(file) {
    if (!window.DelivProStorage || typeof window.DelivProStorage.compressImage !== 'function') {
      return file;
    }
    try {
      // Compression : economie de tokens Gemini multimodal. 1600px / quality 0.82
      // = aligne avec le defaut storage-uploader (cible ~300 Ko apres compression).
      return await window.DelivProStorage.compressImage(file, {
        maxDim: 1600,
        quality: 0.82,
        skipUnderBytes: 1024 * 1024, // ne compresse pas en-dessous de 1 MB
        mime: 'image/jpeg',
      });
    } catch (_) { return file; }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        // result = "data:image/jpeg;base64,..." -> on ne garde que la partie base64
        const commaIdx = result.indexOf(',');
        if (commaIdx < 0) return reject(new Error('Lecture fichier echouee'));
        resolve(result.slice(commaIdx + 1));
      };
      reader.onerror = () => reject(new Error('Lecture fichier echouee'));
      reader.readAsDataURL(file);
    });
  }

  async function onOcrFileSelected(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file || !ocrState.mode) return;
    if (!/^image\//.test(file.type || '')) {
      renderOcrError('Le fichier choisi n\'est pas une image.', 'Selectionne une photo (JPG, PNG, HEIC).');
      return;
    }

    ocrState.busy = true;
    try {
      renderOcrStatus('Compression image...');
      const compressed = await compressOcrFile(file);
      renderOcrStatus('Encodage...');
      const base64 = await fileToBase64(compressed);
      const mime = compressed.type || file.type || 'image/jpeg';
      renderOcrStatus('🔍 Analyse en cours...');
      const result = await callOcr({ image_base64: base64, mime, mode: ocrState.mode });
      ocrState.lastResult = result;
      renderOcrResult(result);
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      const hint = err && err.hint ? err.hint : '';
      renderOcrError('Echec OCR : ' + errMsg, hint);
    } finally {
      ocrState.busy = false;
      // Reset l'input pour permettre la re-selection du meme fichier
      e.target.value = '';
    }
  }

  async function callOcr(payload) {
    const client = window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
    if (!client) throw new Error('Supabase pas pret');
    let token = null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      const sess = sessionData && sessionData.session;
      const expAt = sess && sess.expires_at ? sess.expires_at * 1000 : 0;
      if (sess && expAt && expAt - Date.now() < 60000) {
        try {
          const { data: refreshed } = await client.auth.refreshSession();
          token = refreshed && refreshed.session ? refreshed.session.access_token : sess.access_token;
        } catch (_) { token = sess.access_token; }
      } else {
        token = sess ? sess.access_token : null;
      }
    } catch (_) {}
    if (!token) throw new Error('Session expiree, reconnecte-toi.');

    const config = window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig()
      : null;
    const baseUrl = config && config.url ? config.url : '';
    if (!baseUrl) throw new Error('Supabase URL manquante');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), OCR_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(baseUrl + OCR_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new Error('Delai depasse (' + Math.round(OCR_TIMEOUT_MS / 1000) + 's). Reessaye avec une image plus petite ou plus nette.');
      }
      throw new Error('Reseau indisponible. Verifie ta connexion.');
    } finally { clearTimeout(t); }

    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const friendly = body.hint || body.error || body.message || 'HTTP ' + r.status;
      const e = new Error(friendly);
      if (body.hint) e.hint = body.hint;
      throw e;
    }
    if (body && body.success === false) {
      const friendly = body.hint || body.error || 'Echec extraction';
      const e = new Error(friendly);
      if (body.hint) e.hint = body.hint;
      throw e;
    }
    return body;
  }

  // Affichage du resultat OCR : carte avec champs extraits + boutons d'action.
  // Le payload {success, data, raw_response, model_used} (cf. edge fn ai-ocr).
  function renderOcrResult(result) {
    const body = document.getElementById('ai-chat-ocr-body');
    if (!body) return;
    body.innerHTML = '';
    const data = (result && result.data) || {};
    const mode = ocrState.mode;
    const fields = ocrFieldsFor(mode, data);

    const wrap = document.createElement('div');
    wrap.className = 'ai-chat-ocr-result';

    const header = document.createElement('div');
    header.style.fontSize = '.85rem';
    header.style.color = 'var(--aic-text)';
    header.innerHTML = '✅ <strong>Donnees extraites</strong> <span style="color:var(--aic-text-muted);font-size:.75rem">— relis avant de pre-remplir</span>';
    wrap.appendChild(header);

    const fieldsBox = document.createElement('div');
    fieldsBox.className = 'ai-chat-ocr-fields';
    fields.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'ai-chat-ocr-field';
      const k = document.createElement('span');
      k.className = 'ai-chat-ocr-field-key';
      k.textContent = f.label;
      const v = document.createElement('span');
      v.className = 'ai-chat-ocr-field-val' + (f.value == null || f.value === '' ? ' is-null' : '');
      v.textContent = (f.value == null || f.value === '') ? '—' : String(f.value);
      row.appendChild(k);
      row.appendChild(v);
      fieldsBox.appendChild(row);
    });

    // Cas facture : afficher les lignes en plus
    if (mode === 'facture' && Array.isArray(data.lignes) && data.lignes.length) {
      const linesWrap = document.createElement('div');
      linesWrap.style.borderTop = '1px solid var(--aic-border)';
      linesWrap.style.marginTop = '6px';
      linesWrap.style.paddingTop = '6px';
      const ttl = document.createElement('div');
      ttl.style.fontSize = '.76rem';
      ttl.style.color = 'var(--aic-text-muted)';
      ttl.style.textTransform = 'uppercase';
      ttl.style.letterSpacing = '.03em';
      ttl.textContent = 'Lignes detectees';
      linesWrap.appendChild(ttl);
      const ul = document.createElement('ul');
      ul.className = 'ai-chat-ocr-lines';
      data.lignes.slice(0, 6).forEach((l) => {
        const li = document.createElement('li');
        const desc = l && l.description ? String(l.description) : '?';
        const qte = l && (l.quantite != null) ? String(l.quantite) : '';
        const pu = l && (l.prix_unitaire != null) ? String(l.prix_unitaire) + ' €' : '';
        const parts = [desc];
        if (qte) parts.push('x' + qte);
        if (pu) parts.push(pu);
        li.textContent = parts.join(' · ');
        ul.appendChild(li);
      });
      linesWrap.appendChild(ul);
      fieldsBox.appendChild(linesWrap);
    }

    wrap.appendChild(fieldsBox);

    const actions = document.createElement('div');
    actions.className = 'ai-chat-ocr-actions';

    const fillBtn = document.createElement('button');
    fillBtn.type = 'button';
    fillBtn.className = 'ai-chat-ocr-btn-primary';
    fillBtn.textContent = '✅ Pre-remplir le formulaire';
    fillBtn.addEventListener('click', () => prefillForm(mode, data));
    actions.appendChild(fillBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ai-chat-ocr-btn-secondary';
    cancelBtn.textContent = '❌ Annuler';
    cancelBtn.addEventListener('click', closeOcrSheet);
    actions.appendChild(cancelBtn);

    wrap.appendChild(actions);
    body.appendChild(wrap);
  }

  // Mapping mode -> liste de {label, value} pour l'affichage carte.
  function ocrFieldsFor(mode, data) {
    if (mode === 'facture') {
      return [
        { label: 'Fournisseur', value: data.fournisseur_nom },
        { label: 'Date facture', value: data.date_facture },
        { label: 'N° facture',   value: data.num_facture },
        { label: 'Montant HT',   value: data.montant_ht != null ? data.montant_ht + ' €' : null },
        { label: 'Montant TTC',  value: data.montant_ttc != null ? data.montant_ttc + ' €' : null },
        { label: 'Taux TVA',     value: data.taux_tva != null ? data.taux_tva + ' %' : null },
      ];
    }
    if (mode === 'ticket_carburant') {
      return [
        { label: 'Station',      value: data.station },
        { label: 'Date',         value: data.date },
        { label: 'Litres',       value: data.litres != null ? data.litres + ' L' : null },
        { label: 'Prix / L',     value: data.prix_litre != null ? data.prix_litre + ' €' : null },
        { label: 'Montant TTC',  value: data.montant_ttc != null ? data.montant_ttc + ' €' : null },
        { label: 'Carburant',    value: data.type_carburant },
      ];
    }
    if (mode === 'rib') {
      return [
        { label: 'Titulaire', value: data.titulaire },
        { label: 'Banque',    value: data.banque },
        { label: 'IBAN',      value: data.iban },
        { label: 'BIC',       value: data.bic },
      ];
    }
    return [];
  }

  // Pre-remplit le formulaire correspondant. Detecte la plateforme :
  //  - Mobile (m.html, MCAm.openSheet present) : appelle MCAm.formNouvelleCharge / formNouveauPlein / formNouveauFournisseur avec un objet pre-rempli.
  //  - PC (admin.html) : ouvre la modal correspondante via openModal() et set
  //    les inputs par id (#charge-*, #carb-*, #frn-*).
  // Si aucune fonction d'ouverture form n'est dispo (cas degrade), affiche les
  // donnees en clipboard avec un toast informatif.
  function prefillForm(mode, data) {
    const isMobile = !!(window.MCAm && typeof window.MCAm.openSheet === 'function');
    try {
      if (mode === 'facture') {
        const prefill = buildChargePrefill(data);
        if (isMobile && typeof window.MCAm.formNouvelleCharge === 'function') {
          closeOcrSheet();
          if (state.open) toggle(); // ferme le panel chat pour laisser place au sheet form
          window.MCAm.formNouvelleCharge(prefill);
          return;
        }
        if (typeof window.ouvrirModalCharge === 'function') {
          closeOcrSheet();
          if (state.open) toggle();
          window.ouvrirModalCharge();
          // Defer : laisse le temps a la modal de monter avant de fixer les inputs
          setTimeout(() => fillChargePCInputs(prefill), 80);
          return;
        }
        return fallbackClipboard(mode, data);
      }
      if (mode === 'ticket_carburant') {
        const prefill = buildCarburantPrefill(data);
        if (isMobile && typeof window.MCAm.formNouveauPlein === 'function') {
          closeOcrSheet();
          if (state.open) toggle();
          window.MCAm.formNouveauPlein(prefill);
          return;
        }
        // PC : on ouvre la modal carburant via openModal(id) (helper global)
        if (typeof window.openModal === 'function' && document.getElementById('modal-carburant')) {
          closeOcrSheet();
          if (state.open) toggle();
          window.openModal('modal-carburant');
          setTimeout(() => fillCarburantPCInputs(prefill), 80);
          return;
        }
        return fallbackClipboard(mode, data);
      }
      if (mode === 'rib') {
        const prefill = buildFournisseurPrefill(data);
        if (isMobile && typeof window.MCAm.formNouveauFournisseur === 'function') {
          closeOcrSheet();
          if (state.open) toggle();
          window.MCAm.formNouveauFournisseur(prefill);
          return;
        }
        if (typeof window.openModal === 'function' && document.getElementById('modal-fournisseur')) {
          closeOcrSheet();
          if (state.open) toggle();
          if (typeof window.resetFormulaireFournisseur === 'function') window.resetFormulaireFournisseur();
          window.openModal('modal-fournisseur');
          setTimeout(() => fillFournisseurPCInputs(prefill), 80);
          return;
        }
        return fallbackClipboard(mode, data);
      }
    } catch (err) {
      console.warn('[ai-chat OCR] prefillForm error', err);
      fallbackClipboard(mode, data);
    }
  }

  function buildChargePrefill(data) {
    return {
      fournisseur: data.fournisseur_nom || '',
      libelle: data.num_facture ? ('Facture ' + data.num_facture) : '',
      date: data.date_facture || '',
      // Compat double clef : mobile attend montantHT / montantTtc, l'edge fn renvoie montant_ht / montant_ttc.
      montantHT: data.montant_ht != null ? Number(data.montant_ht) : '',
      montantHt: data.montant_ht != null ? Number(data.montant_ht) : '',
      montantTtc: data.montant_ttc != null ? Number(data.montant_ttc) : '',
      tauxTva: data.taux_tva != null ? Number(data.taux_tva) : 20,
    };
  }

  function buildCarburantPrefill(data) {
    return {
      date: data.date || '',
      litres: data.litres != null ? Number(data.litres) : '',
      prixLitre: data.prix_litre != null ? Number(data.prix_litre) : '',
      total: data.montant_ttc != null ? Number(data.montant_ttc) : '',
      typeCarburant: normalizeCarburantType(data.type_carburant),
    };
  }

  function buildFournisseurPrefill(data) {
    return {
      nom: data.titulaire || data.banque || '',
      iban: data.iban || '',
      bic: data.bic || '',
      banque: data.banque || '',
      titulaire: data.titulaire || '',
    };
  }

  // Le ticket peut renvoyer "gazole", "diesel", "sp95", "sp98", etc. On normalise
  // sur les valeurs supportees par le form mobile/admin (diesel, essence, etc.).
  function normalizeCarburantType(raw) {
    if (!raw) return '';
    const s = String(raw).toLowerCase();
    if (s.includes('diesel') || s.includes('gazole') || s.includes('gnr') || s.includes('gasoil')) return 'diesel';
    if (s.includes('sp') || s.includes('essence') || s.includes('e10') || s.includes('e85')) return 'essence';
    if (s.includes('gnv') || s.includes('biognv') || s.includes('cng')) return 'gnv';
    if (s.includes('elec')) return 'electrique';
    if (s.includes('hybride')) return 'hybride';
    if (s.includes('hydrog')) return 'hydrogene';
    return '';
  }

  // ---- Helpers PC : injection valeurs dans les modales par id ----
  function setVal(id, value) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (value == null || value === '') return false;
    el.value = value;
    // Trigger input pour declencher les calculs auto (HT->TTC, etc.)
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    return true;
  }

  function fillChargePCInputs(p) {
    setVal('charge-fournisseur', p.fournisseur);
    setVal('charge-desc', p.libelle);
    setVal('charge-date', p.date);
    setVal('charge-taux-tva', p.tauxTva);
    // HT en premier : declenche calculerTTCDepuisHT (si dispo)
    setVal('charge-montant-ht', p.montantHT);
    // Si on a aussi le TTC, on l'ecrase pour securiser : Gemini renvoie souvent
    // les deux et le calcul auto peut etre imprecis (TVA mixte 5.5/10/20).
    setVal('charge-montant', p.montantTtc);
  }

  function fillCarburantPCInputs(p) {
    setVal('carb-date', p.date);
    setVal('carb-litres', p.litres);
    setVal('carb-prix-litre', p.prixLitre);
    if (p.typeCarburant) setVal('carb-type', p.typeCarburant);
  }

  function fillFournisseurPCInputs(p) {
    setVal('frn-nom', p.nom);
    setVal('frn-iban', p.iban);
  }

  // Fallback : copie un resume texte dans le presse-papier + toast informatif.
  // Utilise quand on ne trouve pas la fonction d'ouverture form (ex: page sans
  // modal-charge montee, ou cas hybride).
  function fallbackClipboard(mode, data) {
    const lines = [];
    Object.keys(data || {}).forEach((k) => {
      const v = data[k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      if (Array.isArray(v)) {
        lines.push(k + ': ' + v.length + ' lignes');
      } else if (typeof v === 'object') {
        lines.push(k + ': ' + JSON.stringify(v));
      } else {
        lines.push(k + ': ' + String(v));
      }
    });
    const txt = '[' + mode + ']\n' + lines.join('\n');
    const done = (t) => {
      try {
        if (window.MCAm && typeof window.MCAm.toast === 'function') {
          window.MCAm.toast('📋 Donnees copiees dans le presse-papier');
        } else {
          alert('Donnees copiees dans le presse-papier:\n\n' + t);
        }
      } catch (_) { alert('Donnees:\n\n' + t); }
      closeOcrSheet();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => done(txt), () => done(txt));
      } else {
        done(txt);
      }
    } catch (_) { done(txt); }
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
