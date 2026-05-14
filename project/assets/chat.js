(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  const WORKER_URL = 'https://jet-chat.YOURSUBDOMAIN.workers.dev';

  // ── State ───────────────────────────────────────────────────────────────────
  const history = [];
  let isOpen = false;
  let isTyping = false;

  // ── CSS ─────────────────────────────────────────────────────────────────────
  const css = `
    #jc-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ED1C24;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(237,28,36,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .2s, transform .2s;
    }
    #jc-btn:hover { background: #A71C20; transform: scale(1.06); }
    #jc-btn svg { color: #fff; }
    #jc-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #22c55e;
      border: 2px solid #fff;
      display: none;
    }

    #jc-panel {
      position: fixed;
      bottom: 92px;
      right: 24px;
      z-index: 9999;
      width: 370px;
      max-width: calc(100vw - 32px);
      height: 540px;
      max-height: calc(100vh - 110px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.16);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(12px) scale(.97);
      pointer-events: none;
      transition: opacity .22s ease, transform .22s ease;
    }
    #jc-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    #jc-header {
      background: #ED1C24;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #jc-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #jc-header-info { flex: 1; min-width: 0; }
    #jc-header-name {
      font-family: 'Saira', 'Barlow', sans-serif;
      font-weight: 700;
      font-size: 14px;
      color: #fff;
      line-height: 1.2;
    }
    #jc-header-status {
      font-size: 11px;
      color: rgba(255,255,255,.8);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #jc-header-status::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #86efac;
      flex-shrink: 0;
    }
    #jc-close {
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(255,255,255,.8);
      padding: 4px;
      line-height: 1;
      display: flex;
      align-items: center;
      border-radius: 6px;
      transition: color .15s, background .15s;
    }
    #jc-close:hover { color: #fff; background: rgba(255,255,255,.15); }

    #jc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }
    #jc-messages::-webkit-scrollbar { width: 4px; }
    #jc-messages::-webkit-scrollbar-track { background: transparent; }
    #jc-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

    .jc-msg {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      max-width: 88%;
      animation: jcFadeIn .2s ease;
    }
    @keyframes jcFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    .jc-msg--bot { align-self: flex-start; }
    .jc-msg--user { align-self: flex-end; flex-direction: row-reverse; }

    .jc-msg__avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #ED1C24;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-bottom: 2px;
    }

    .jc-msg__bubble {
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.5;
      font-family: 'Barlow', sans-serif;
    }
    .jc-msg--bot .jc-msg__bubble {
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }
    .jc-msg--user .jc-msg__bubble {
      background: #ED1C24;
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .jc-typing .jc-msg__bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 14px;
    }
    .jc-typing .jc-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #94a3b8;
      animation: jcBounce 1.2s infinite;
    }
    .jc-typing .jc-dot:nth-child(2) { animation-delay: .2s; }
    .jc-typing .jc-dot:nth-child(3) { animation-delay: .4s; }
    @keyframes jcBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }

    #jc-quick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 10px;
    }
    .jc-quick-btn {
      font-size: 12px;
      font-family: 'Barlow', sans-serif;
      font-weight: 500;
      padding: 5px 11px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #fff;
      color: #475569;
      cursor: pointer;
      transition: border-color .15s, color .15s, background .15s;
      white-space: nowrap;
    }
    .jc-quick-btn:hover { border-color: #ED1C24; color: #ED1C24; background: #fff5f5; }

    #jc-input-row {
      border-top: 1px solid #f1f5f9;
      padding: 10px 12px;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }
    #jc-input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 13.5px;
      font-family: 'Barlow', sans-serif;
      color: #1e293b;
      resize: none;
      outline: none;
      max-height: 100px;
      line-height: 1.4;
      transition: border-color .15s;
    }
    #jc-input:focus { border-color: #ED1C24; }
    #jc-input::placeholder { color: #94a3b8; }
    #jc-send {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #ED1C24;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .15s;
    }
    #jc-send:hover { background: #A71C20; }
    #jc-send:disabled { background: #e2e8f0; cursor: not-allowed; }
    #jc-send svg { color: #fff; }

    #jc-error-bar {
      display: none;
      background: #fff0f0;
      border-top: 1px solid #fecaca;
      padding: 8px 14px;
      font-size: 12px;
      color: #b91c1c;
      text-align: center;
    }

    @media (max-width: 480px) {
      #jc-panel { right: 12px; left: 12px; width: auto; bottom: 80px; }
      #jc-btn { right: 16px; bottom: 16px; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button id="jc-btn" aria-label="Open support chat">
      <span id="jc-badge"></span>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>

    <div id="jc-panel" role="dialog" aria-label="Jet Support Chat">
      <div id="jc-header">
        <div id="jc-header-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div id="jc-header-info">
          <div id="jc-header-name">Jet Support</div>
          <div id="jc-header-status">Online — typically replies instantly</div>
        </div>
        <button id="jc-close" aria-label="Close chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div id="jc-messages"></div>

      <div id="jc-quick">
        <button class="jc-quick-btn">How do I download the app?</button>
        <button class="jc-quick-btn">Transfer a call</button>
        <button class="jc-quick-btn">Send an SMS</button>
        <button class="jc-quick-btn">Set up voicemail</button>
      </div>

      <div id="jc-error-bar">Something went wrong. Please try again or call us on 0488 811 729.</div>

      <div id="jc-input-row">
        <textarea id="jc-input" placeholder="Ask me anything…" rows="1"></textarea>
        <button id="jc-send" aria-label="Send message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ── Elements ────────────────────────────────────────────────────────────────
  const btn      = document.getElementById('jc-btn');
  const panel    = document.getElementById('jc-panel');
  const closeBtn = document.getElementById('jc-close');
  const messages = document.getElementById('jc-messages');
  const quick    = document.getElementById('jc-quick');
  const input    = document.getElementById('jc-input');
  const send     = document.getElementById('jc-send');
  const errorBar = document.getElementById('jc-error-bar');

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    input.focus();
    if (messages.children.length === 0) addBotMessage("Hi! I'm Jet's virtual support assistant. I can help with the Jet Phone app, calling features, SMS, voicemail, and more. What can I help you with today?");
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addBotMessage(text) {
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--bot';
    el.innerHTML = `
      <div class="jc-msg__avatar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="jc-msg__bubble">${escapeHtml(text)}</div>
    `;
    messages.appendChild(el);
    scrollBottom();
  }

  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--user';
    el.innerHTML = `<div class="jc-msg__bubble">${escapeHtml(text)}</div>`;
    messages.appendChild(el);
    scrollBottom();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--bot jc-typing';
    el.id = 'jc-typing';
    el.innerHTML = `
      <div class="jc-msg__avatar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="jc-msg__bubble">
        <span class="jc-dot"></span><span class="jc-dot"></span><span class="jc-dot"></span>
      </div>
    `;
    messages.appendChild(el);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('jc-typing');
    if (el) el.remove();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text || isTyping) return;

    // Hide quick replies after first message
    if (quick.style.display !== 'none') quick.style.display = 'none';

    errorBar.style.display = 'none';
    addUserMessage(text);
    history.push({ role: 'user', content: text });

    input.value = '';
    input.style.height = 'auto';
    send.disabled = true;
    isTyping = true;
    showTyping();

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const reply = data?.content?.[0]?.text || "I'm sorry, I couldn't process that. Please call us on 0488 811 729 or use the Contact Support button.";

      removeTyping();
      addBotMessage(reply);
      history.push({ role: 'assistant', content: reply });

    } catch (err) {
      console.error('Chat error:', err);
      removeTyping();
      errorBar.style.display = 'block';
    } finally {
      isTyping = false;
      send.disabled = false;
      input.focus();
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  send.addEventListener('click', () => sendMessage(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  input.addEventListener('input', autoResize);

  document.querySelectorAll('.jc-quick-btn').forEach((qb) => {
    qb.addEventListener('click', () => sendMessage(qb.textContent));
  });

  // Close on backdrop click
  document.addEventListener('click', (e) => {
    if (isOpen && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      closePanel();
    }
  });

  // Show badge after a short delay to draw attention on first visit
  setTimeout(() => {
    if (!isOpen) document.getElementById('jc-badge').style.display = 'block';
  }, 3000);
})();
