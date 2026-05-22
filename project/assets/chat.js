(function () {
  'use strict';

  const WORKER_URL = 'https://livechat.matthew-cahill.workers.dev';

  // ── Session state ─────────────────────────────────────────────────────────────
  let sessionId      = localStorage.getItem('jc-session-id');
  let conversationId = localStorage.getItem('jc-conversation-id') || null;
  if (!sessionId) {
    sessionId = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    localStorage.setItem('jc-session-id', sessionId);
  }

  let sessionStatus = 'bot';   // 'bot' | 'agent'
  let agentName     = null;
  let lastPollTs    = 0;
  let pollTimer     = null;
  let pollAttempts  = 0;
  let isOpen        = false;
  let isTyping      = false;

  const POLL_INTERVAL    = 1200;  // ms between polls
  const POLL_MAX         = 25;    // ~30s before timeout
  const HS_PORTAL_ID     = '442264265';
  const HS_FORM_ID       = '52e36f05-0d63-4dd0-bdf2-20e2f6c00edc';
  const SUPPORT_PHONE    = '0488 811 729';
  const SUPPORT_TEL      = 'tel:0488811729';
  const SUPPORT_SMS      = 'sms:0488811729';

  // ── CSS ───────────────────────────────────────────────────────────────────────
  const css = `
    #jc-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9998;
      width: 56px; height: 56px; border-radius: 50%;
      background: #ED1C24; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(237,28,36,.35);
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, transform .2s;
    }
    #jc-btn:hover { background: #A71C20; transform: scale(1.06); }
    #jc-btn svg { color: #fff; }
    #jc-badge {
      position: absolute; top: -2px; right: -2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: #22c55e; border: 2px solid #fff; display: none;
    }

    #jc-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 9999;
      width: 370px; max-width: calc(100vw - 32px);
      height: 540px; max-height: calc(100vh - 110px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.16);
      display: flex; flex-direction: column; overflow: hidden;
      opacity: 0; transform: translateY(12px) scale(.97);
      pointer-events: none; transition: opacity .22s ease, transform .22s ease;
    }
    #jc-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }

    #jc-header {
      background: #ED1C24; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      transition: background .3s;
    }
    #jc-header.agent { background: #1e40af; }
    #jc-header-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #jc-header-info { flex: 1; min-width: 0; }
    #jc-header-name {
      font-family: 'Saira','Barlow',sans-serif; font-weight: 700;
      font-size: 14px; color: #fff; line-height: 1.2;
    }
    #jc-header-status {
      font-size: 11px; color: rgba(255,255,255,.8);
      display: flex; align-items: center; gap: 4px;
    }
    #jc-header-status::before {
      content:''; width:6px; height:6px; border-radius:50%;
      background:#86efac; flex-shrink:0; transition: background .3s;
    }
    #jc-header.agent #jc-header-status::before { background: #93c5fd; }
    #jc-close {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.8); padding: 4px; line-height: 1;
      display: flex; align-items: center; border-radius: 6px;
      transition: color .15s, background .15s;
    }
    #jc-close:hover { color: #fff; background: rgba(255,255,255,.15); }

    #jc-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth;
    }
    #jc-messages::-webkit-scrollbar { width: 4px; }
    #jc-messages::-webkit-scrollbar-track { background: transparent; }
    #jc-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

    .jc-msg {
      display: flex; align-items: flex-end; gap: 6px;
      max-width: 88%; animation: jcFadeIn .2s ease;
    }
    @keyframes jcFadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
    .jc-msg--bot  { align-self: flex-start; }
    .jc-msg--user { align-self: flex-end; flex-direction: row-reverse; }
    .jc-msg--wide { max-width: 100%; width: 100%; }

    .jc-msg__avatar {
      width: 26px; height: 26px; border-radius: 50%; background: #ED1C24;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-bottom: 2px;
    }
    .jc-msg__avatar--agent { background: #475569; }
    .jc-msg__agent-label {
      font-size: 11px; color: #64748b; font-weight: 600;
      margin-bottom: 2px; padding-left: 2px;
    }
    .jc-msg__bubble {
      padding: 9px 13px; border-radius: 14px;
      font-size: 13.5px; line-height: 1.5; font-family: 'Barlow',sans-serif;
    }
    .jc-msg--bot  .jc-msg__bubble { background:#f1f5f9; color:#1e293b; border-bottom-left-radius:4px; }
    .jc-msg--user .jc-msg__bubble { background:#ED1C24; color:#fff; border-bottom-right-radius:4px; }

    .jc-msg--system {
      align-self: center; font-size: 12px; color: #94a3b8;
      font-style: italic; text-align: center; padding: 2px 8px;
      max-width: 100%;
    }

    .jc-typing .jc-msg__bubble { display:flex; align-items:center; gap:4px; padding:12px 14px; }
    .jc-typing .jc-dot { width:7px; height:7px; border-radius:50%; background:#94a3b8; animation:jcBounce 1.2s infinite; }
    .jc-typing .jc-dot:nth-child(2) { animation-delay:.2s; }
    .jc-typing .jc-dot:nth-child(3) { animation-delay:.4s; }
    @keyframes jcBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    /* Suggestion / action cards */
    .jc-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 13px 14px 11px; width: 100%; box-sizing: border-box;
      animation: jcFadeIn .2s ease;
    }
    .jc-card p { font-size: 13px; color: #475569; margin: 0 0 10px; line-height: 1.45; }
    .jc-card__actions { display: flex; flex-direction: column; gap: 6px; }
    .jc-card__btn {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 11px; border: 1px solid #e2e8f0; border-radius: 8px;
      font-size: 13px; font-family: 'Barlow',sans-serif; color: #1e293b;
      background: #fff; cursor: pointer; text-decoration: none;
      transition: border-color .15s, background .15s, color .15s;
      text-align: left;
    }
    .jc-card__btn:hover { border-color: #ED1C24; color: #ED1C24; background: #fff5f5; }
    .jc-card__btn--primary {
      background: #ED1C24; color: #fff; border-color: #ED1C24; justify-content: center; font-weight: 600;
    }
    .jc-card__btn--primary:hover { background: #A71C20; border-color: #A71C20; color: #fff; }
    .jc-card__btn svg { flex-shrink: 0; }

    /* HubSpot form */
    .jcf-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 14px 14px 12px; width: 100%; box-sizing: border-box;
    }
    .jcf-card h4 {
      font-family: 'Saira','Barlow',sans-serif; font-size: 14px; font-weight: 700;
      color: #1e293b; margin: 0 0 10px;
    }
    .jcf-field { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
    .jcf-field label { font-size: 11.5px; font-weight: 600; color: #374151; }
    .jcf-field input, .jcf-field select, .jcf-field textarea {
      border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 6px 9px; font-size: 13px; font-family: 'Barlow',sans-serif;
      color: #1e293b; background: #fff; outline: none;
      transition: border-color .15s; width: 100%; box-sizing: border-box;
    }
    .jcf-field input:focus, .jcf-field select:focus, .jcf-field textarea:focus { border-color: #ED1C24; }
    .jcf-field select {
      cursor: pointer; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A4D55' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 9px center; padding-right: 28px;
    }
    .jcf-field textarea { resize: none; height: 64px; line-height: 1.4; }
    .jcf-error {
      display: none; font-size: 12px; color: #b91c1c;
      background: #fff0f0; border-radius: 6px; padding: 6px 9px; margin-bottom: 8px;
    }
    .jcf-submit {
      width: 100%; background: #ED1C24; color: #fff; border: none;
      border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 600;
      font-family: 'Barlow',sans-serif; cursor: pointer; transition: background .15s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .jcf-submit:hover { background: #A71C20; }
    .jcf-submit:disabled { opacity: .6; cursor: not-allowed; }
    .jcf-success { text-align: center; padding: 8px 0 4px; }
    .jcf-success svg { color: #ED1C24; margin: 0 auto 8px; display: block; }
    .jcf-success p { font-size: 13px; color: #475569; margin: 4px 0 0; }
    @keyframes jcSpin { to { transform: rotate(360deg); } }

    #jc-quick {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px;
    }
    .jc-quick-btn {
      font-size: 12px; font-family: 'Barlow',sans-serif; font-weight: 500;
      padding: 5px 11px; border: 1px solid #e2e8f0; border-radius: 20px;
      background: #fff; color: #475569; cursor: pointer;
      transition: border-color .15s, color .15s, background .15s; white-space: nowrap;
    }
    .jc-quick-btn:hover { border-color: #ED1C24; color: #ED1C24; background: #fff5f5; }

    #jc-input-row {
      border-top: 1px solid #f1f5f9; padding: 10px 12px;
      display: flex; align-items: flex-end; gap: 8px; flex-shrink: 0;
    }
    #jc-input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 8px 12px; font-size: 13.5px; font-family: 'Barlow',sans-serif;
      color: #1e293b; resize: none; outline: none;
      max-height: 100px; line-height: 1.4; transition: border-color .15s;
    }
    #jc-input:focus { border-color: #ED1C24; }
    #jc-input::placeholder { color: #94a3b8; }
    #jc-send {
      width: 36px; height: 36px; border-radius: 50%; background: #ED1C24;
      border: none; cursor: pointer; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; transition: background .15s;
    }
    #jc-send:hover { background: #A71C20; }
    #jc-send:disabled { background: #e2e8f0; cursor: not-allowed; }
    #jc-send svg { color: #fff; }

    #jc-error-bar {
      display: none; background: #fff0f0; border-top: 1px solid #fecaca;
      padding: 8px 14px; font-size: 12px; color: #b91c1c; text-align: center;
    }

    @media (max-width: 480px) {
      #jc-panel { right: 12px; left: 12px; width: auto; bottom: 80px; }
      #jc-btn   { right: 16px; bottom: 16px; }
    }

    /* Support ticket modal */
    #jsm-overlay {
      display: none; position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,.55); align-items: flex-start; justify-content: center;
      padding: 20px 16px; overflow-y: auto;
    }
    #jsm-overlay.open { display: flex; }
    #jsm-modal {
      background: #fff; border-radius: 16px; width: 100%; max-width: 520px;
      margin: auto; box-shadow: 0 20px 60px rgba(0,0,0,.25);
      animation: jcFadeIn .2s ease;
    }
    #jsm-header {
      background: #ED1C24; padding: 16px 20px; border-radius: 16px 16px 0 0;
      display: flex; align-items: center; gap: 10px;
    }
    #jsm-header-title {
      flex: 1; font-family: 'Saira','Barlow',sans-serif; font-weight: 700;
      font-size: 15px; color: #fff;
    }
    #jsm-close-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.8); padding: 4px; line-height: 1;
      display: flex; align-items: center; border-radius: 6px;
      transition: color .15s, background .15s;
    }
    #jsm-close-btn:hover { color: #fff; background: rgba(255,255,255,.15); }
    #jsm-body { padding: 20px; }
    .jsm-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .jsm-field label { font-size: 12px; font-weight: 600; color: #374151; font-family: 'Barlow',sans-serif; }
    .jsm-field input, .jsm-field select, .jsm-field textarea {
      border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 8px 12px; font-size: 13.5px; font-family: 'Barlow',sans-serif;
      color: #1e293b; background: #fff; outline: none;
      transition: border-color .15s; width: 100%; box-sizing: border-box;
    }
    .jsm-field input:focus, .jsm-field select:focus, .jsm-field textarea:focus { border-color: #ED1C24; }
    .jsm-field select {
      cursor: pointer; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A4D55' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px;
    }
    .jsm-field textarea { resize: none; height: 80px; line-height: 1.4; }
    .jsm-sub-field { display: none; }
    .jsm-sub-field.visible { display: flex; }
    .jsm-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .jsm-error {
      display: none; font-size: 13px; color: #b91c1c;
      background: #fff0f0; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;
    }
    .jsm-submit {
      width: 100%; background: #ED1C24; color: #fff; border: none;
      border-radius: 10px; padding: 11px; font-size: 14px; font-weight: 600;
      font-family: 'Barlow',sans-serif; cursor: pointer; transition: background .15s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .jsm-submit:hover { background: #A71C20; }
    .jsm-submit:disabled { opacity: .6; cursor: not-allowed; }
    .jsm-success { text-align: center; padding: 32px 20px; }
    .jsm-success svg { color: #22c55e; margin: 0 auto 12px; display: block; }
    .jsm-success h3 { font-family: 'Saira','Barlow',sans-serif; font-size: 18px; color: #1e293b; margin: 0 0 8px; }
    .jsm-success p { font-size: 14px; color: #475569; margin: 0 0 16px; }
    .jsm-success-close {
      background: none; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 8px 20px; font-size: 13px; font-family: 'Barlow',sans-serif;
      color: #475569; cursor: pointer; transition: border-color .15s, color .15s;
    }
    .jsm-success-close:hover { border-color: #ED1C24; color: #ED1C24; }
    @media (max-width: 480px) { .jsm-row-2 { grid-template-columns: 1fr; } }

    /* HubSpot sales modal */
    #jc-hs-overlay {
      display: none; position: fixed; inset: 0; z-index: 10001;
      background: rgba(0,0,0,.55); align-items: flex-start; justify-content: center;
      padding: 20px 16px; overflow-y: auto;
    }
    #jc-hs-overlay.open { display: flex; }
    #jc-hs-modal {
      background: #fff; border-radius: 16px; width: 100%; max-width: 520px;
      margin: auto; box-shadow: 0 20px 60px rgba(0,0,0,.25);
      animation: jcFadeIn .2s ease;
    }
    #jc-hs-header {
      background: #ED1C24; padding: 16px 20px; border-radius: 16px 16px 0 0;
      display: flex; align-items: center; gap: 10px;
    }
    #jc-hs-header span {
      flex: 1; font-family: 'Saira','Barlow',sans-serif; font-weight: 700;
      font-size: 15px; color: #fff;
    }
    #jc-hs-close {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.8); padding: 4px; line-height: 1;
      display: flex; align-items: center; border-radius: 6px;
      transition: color .15s, background .15s;
    }
    #jc-hs-close:hover { color: #fff; background: rgba(255,255,255,.15); }
    #jc-hs-body { padding: 20px; min-height: 120px; }
    #jc-hs-body .hs-loading {
      text-align: center; padding: 32px 0; color: #94a3b8; font-size: 13px; font-family: 'Barlow',sans-serif;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── HTML ──────────────────────────────────────────────────────────────────────
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
        <button class="jc-quick-btn" data-action="sales">Sales enquiry</button>
        <button class="jc-quick-btn" data-action="human">Talk to a human</button>
      </div>

      <div id="jc-error-bar">Something went wrong. Please try again or call us on ${SUPPORT_PHONE}.</div>

      <div id="jc-input-row">
        <textarea id="jc-input" placeholder="Ask me anything…" rows="1"></textarea>
        <button id="jc-send" aria-label="Send message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ── Support ticket modal ──────────────────────────────────────────────────────
  const modalWrapper = document.createElement('div');
  modalWrapper.innerHTML = `
    <div id="jsm-overlay" role="dialog" aria-modal="true" aria-label="Submit a support ticket">
      <div id="jsm-modal">
        <div id="jsm-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="jsm-header-title">Submit a support ticket</span>
          <button id="jsm-close-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="jsm-body">
          <div id="jsm-form">
            <div class="jsm-row-2">
              <div class="jsm-field">
                <label>Full name <span style="color:#ED1C24">*</span></label>
                <input type="text" id="jsm-name" placeholder="Jane Smith" autocomplete="name">
              </div>
              <div class="jsm-field">
                <label>Email address <span style="color:#ED1C24">*</span></label>
                <input type="email" id="jsm-email" placeholder="jane@company.com.au" autocomplete="email">
              </div>
            </div>
            <div class="jsm-row-2">
              <div class="jsm-field">
                <label>Phone number <span style="color:#ED1C24">*</span></label>
                <input type="tel" id="jsm-phone" placeholder="0400 000 000" autocomplete="tel">
              </div>
              <div class="jsm-field">
                <label>Account number</label>
                <input type="number" id="jsm-account" placeholder="Optional">
              </div>
            </div>
            <div class="jsm-field">
              <label>What is your enquiry regarding? <span style="color:#ED1C24">*</span></label>
              <select id="jsm-reason">
                <option value="">Select a category…</option>
                <option value="new_service">Order A New Service</option>
                <option value="modify_a_service">Modify A Service</option>
                <option value="report_a_problem">Report an Issue</option>
                <option value="enquire_about_reports">Enquire About Reports</option>
                <option value="enquire_about_billing">Enquire About Billing or Accounts</option>
                <option value="cancel_a_service">Cancel A Service</option>
                <option value="call_tracking___integrations">Call Tracking &amp; Integrations</option>
              </select>
            </div>
            <div class="jsm-field jsm-sub-field" id="jsm-sub-field">
              <label>What specifically can we help you with? <span style="color:#ED1C24">*</span></label>
              <select id="jsm-sub-reason">
                <option value="">Select…</option>
              </select>
            </div>
            <div class="jsm-field">
              <label>Subject <span style="color:#ED1C24">*</span></label>
              <input type="text" id="jsm-subject" placeholder="Brief summary of your request">
            </div>
            <div class="jsm-field">
              <label>Message <span style="color:#ED1C24">*</span></label>
              <textarea id="jsm-message" placeholder="Please describe your issue in as much detail as possible…"></textarea>
            </div>
            <div class="jsm-error" id="jsm-error"></div>
            <button class="jsm-submit" id="jsm-submit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send message
            </button>
          </div>
          <div class="jsm-success" id="jsm-success" style="display:none">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h3>Ticket submitted!</h3>
            <p id="jsm-success-msg">We'll be in touch shortly.</p>
            <button class="jsm-success-close" id="jsm-success-close">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalWrapper);

  // ── HubSpot sales modal ───────────────────────────────────────────────────────
  const hsWrapper = document.createElement('div');
  hsWrapper.innerHTML = `
    <div id="jc-hs-overlay" role="dialog" aria-modal="true" aria-label="Sales enquiry">
      <div id="jc-hs-modal">
        <div id="jc-hs-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.3 13.38a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.18 2.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>
          <span>Sales &amp; New Services</span>
          <button id="jc-hs-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="jc-hs-body">
          <div class="hs-loading">Loading…</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(hsWrapper);

  // ── Elements ──────────────────────────────────────────────────────────────────
  const btn      = document.getElementById('jc-btn');
  const panel    = document.getElementById('jc-panel');
  const header   = document.getElementById('jc-header');
  const closeBtn = document.getElementById('jc-close');
  const messages = document.getElementById('jc-messages');
  const quick    = document.getElementById('jc-quick');
  const input    = document.getElementById('jc-input');
  const send     = document.getElementById('jc-send');
  const errorBar = document.getElementById('jc-error-bar');

  // ── Render helpers ────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  function botAvatar() {
    return `<div class="jc-msg__avatar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>`;
  }

  function agentAvatar() {
    return `<div class="jc-msg__avatar jc-msg__avatar--agent"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
  }

  function addBotMessage(text, allowHtml) {
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--bot';
    const content = allowHtml ? text.replace(/\n/g,'<br>') : escapeHtml(text);
    el.innerHTML = `${botAvatar()}<div class="jc-msg__bubble">${content}</div>`;
    messages.appendChild(el);
    scrollBottom();
  }

  function addAgentMessage(text, name) {
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--bot';
    el.innerHTML = `
      ${agentAvatar()}
      <div>
        ${name ? `<div class="jc-msg__agent-label">${escapeHtml(name)}</div>` : ''}
        <div class="jc-msg__bubble">${escapeHtml(text)}</div>
      </div>`;
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

  function addSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'jc-msg--system';
    el.textContent = text;
    messages.appendChild(el);
    scrollBottom();
  }

  function addCard(html) {
    const wrap = document.createElement('div');
    wrap.className = 'jc-msg jc-msg--bot jc-msg--wide';
    wrap.innerHTML = `${botAvatar()}<div style="flex:1;min-width:0">${html}</div>`;
    messages.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function showTyping() {
    if (document.getElementById('jc-typing')) return;
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--bot jc-typing';
    el.id = 'jc-typing';
    el.innerHTML = `${botAvatar()}<div class="jc-msg__bubble"><span class="jc-dot"></span><span class="jc-dot"></span><span class="jc-dot"></span></div>`;
    messages.appendChild(el);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('jc-typing');
    if (el) el.remove();
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }

  // ── Header state ──────────────────────────────────────────────────────────────
  function setHeaderAgent(name) {
    header.classList.add('agent');
    document.getElementById('jc-header-name').textContent = name || 'Support Agent';
    document.getElementById('jc-header-status').textContent = 'Connected — speaking with a human agent';
  }

  function setHeaderBot() {
    header.classList.remove('agent');
    document.getElementById('jc-header-name').textContent = 'Jet Support';
    document.getElementById('jc-header-status').textContent = 'Online — typically replies instantly';
  }

  // ── Inline cards ──────────────────────────────────────────────────────────────
  function showHandoffSuggestionCard() {
    const card = addCard(`
      <div class="jc-card">
        <p>It looks like you might benefit from speaking with a member of our team. Would you like me to connect you?</p>
        <div class="jc-card__actions">
          <button class="jc-card__btn jc-card__btn--primary" id="jc-handoff-yes">Connect me to an agent</button>
          <button class="jc-card__btn" id="jc-handoff-no">No thanks, keep chatting</button>
        </div>
      </div>`);
    card.querySelector('#jc-handoff-yes').addEventListener('click', () => {
      card.remove(); requestHandoff();
    });
    card.querySelector('#jc-handoff-no').addEventListener('click', () => card.remove());
  }

  function showSalesCard() {
    const card = addCard(`
      <div class="jc-card">
        <p>For sales, pricing, and new service enquiries our team is ready to help:</p>
        <div class="jc-card__actions">
          <a class="jc-card__btn" href="${SUPPORT_TEL}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.3 13.38a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.18 2.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>
            Call us — ${SUPPORT_PHONE}
          </a>
          <a class="jc-card__btn" href="${SUPPORT_SMS}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            SMS us — ${SUPPORT_PHONE}
          </a>
          <button class="jc-card__btn jc-card__btn--primary" id="jc-sales-form-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Get a callback — fill in your details
          </button>
        </div>
      </div>`);
    card.querySelector('#jc-sales-form-btn').addEventListener('click', openSalesModal);
  }

  function showAfterHoursCard() {
    const card = addCard(`
      <div class="jc-card">
        <p>Our team is available Monday–Friday, 8:30am–5:30pm AEST. Leave us a support ticket and we'll get back to you.</p>
        <div class="jc-card__actions">
          <button class="jc-card__btn jc-card__btn--primary" id="jc-ah-ticket">Submit a support ticket</button>
        </div>
      </div>`);
    card.querySelector('#jc-ah-ticket').addEventListener('click', openSupportModal);
  }

  // ── Polling (agent mode only) ─────────────────────────────────────────────────
  function startPolling() {
    if (pollTimer) return;
    pollAttempts = 0;
    schedulePoll();
  }

  function stopPolling() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  function schedulePoll() {
    pollTimer = setTimeout(doPoll, POLL_INTERVAL);
  }

  async function doPoll() {
    pollTimer = null;
    if (pollAttempts >= POLL_MAX) {
      removeTyping();
      errorBar.style.display = 'block';
      isTyping = false; send.disabled = false;
      return;
    }

    try {
      const res  = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll', conversationId, since: lastPollTs }),
      });
      const data = await res.json();

      // Render new messages
      if (data.messages?.length) {
        removeTyping();
        isTyping = false; send.disabled = false;

        data.messages.forEach(msg => {
          lastPollTs = Math.max(lastPollTs, msg.ts || 0);
          if (msg.role === 'agent')  addAgentMessage(msg.text, msg.agentName);
          else if (msg.role === 'system') addSystemMessage(msg.text);
          else addBotMessage(msg.text);
        });
      }

      // Status transitions
      if (data.status === 'agent' && sessionStatus !== 'agent') {
        sessionStatus = 'agent';
        agentName = data.agentName;
        setHeaderAgent(agentName);
      }
      if (data.status === 'bot' && sessionStatus === 'agent') {
        sessionStatus = 'bot';
        agentName = null;
        setHeaderBot();
        stopPolling(); return;
      }

      // Keep polling in agent mode or while waiting for initial response
      if (sessionStatus === 'agent' || isTyping) {
        pollAttempts++;
        schedulePoll();
      }
    } catch (err) {
      pollAttempts++;
      schedulePoll();
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text || isTyping) return;

    if (quick.style.display !== 'none') quick.style.display = 'none';
    errorBar.style.display = 'none';

    addUserMessage(text);
    input.value = '';
    input.style.height = 'auto';
    send.disabled = true;
    isTyping = true;
    showTyping();

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          message: text,
          sessionId,
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      // Persist conversationId after first message
      if (data.conversationId && data.conversationId !== conversationId) {
        conversationId = data.conversationId;
        localStorage.setItem('jc-conversation-id', conversationId);
      }

      if (data.mode === 'bot') {
        // Synchronous reply — display immediately
        removeTyping();
        isTyping = false; send.disabled = false;

        if (data.reply) addBotMessage(data.reply);
        if (data.suggestHandoff) showHandoffSuggestionCard();
        if (data.suggestSales)   showSalesCard();

      } else {
        // Agent mode — start polling for reply
        startPolling();
      }

    } catch (err) {
      console.error('Chat error:', err);
      removeTyping();
      isTyping = false; send.disabled = false;
      errorBar.style.display = 'block';
    } finally {
      if (!isTyping) input.focus();
    }
  }

  // ── Handoff ───────────────────────────────────────────────────────────────────
  async function requestHandoff() {
    if (!conversationId) {
      // No conversation started — go straight to ticket form
      openSupportModal(); return;
    }

    if (quick.style.display !== 'none') quick.style.display = 'none';
    addBotMessage('Connecting you to the next available agent…');

    try {
      const res  = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'handoff', conversationId }),
      });
      const data = await res.json();

      if (data.available === false) {
        showAfterHoursCard();
      } else if (data.alreadyHandedOff) {
        addSystemMessage('You are already connected to an agent.');
        startPolling();
      } else {
        sessionStatus = 'agent';
        showTyping();
        startPolling();
      }
    } catch (err) {
      console.error('Handoff error:', err);
      addBotMessage("We couldn't connect you right now. Please try again or submit a support ticket.");
      showAfterHoursCard();
    }
  }

  // ── History restore ───────────────────────────────────────────────────────────
  async function restoreHistory() {
    try {
      const res  = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_history', conversationId }),
      });
      const data = await res.json();

      if (data.history?.length) {
        data.history.forEach(msg => {
          lastPollTs = Math.max(lastPollTs, msg.ts || 0);
          if (msg.role === 'user')        addUserMessage(msg.text);
          else if (msg.role === 'agent')  addAgentMessage(msg.text, msg.agentName);
          else if (msg.role === 'system') addSystemMessage(msg.text);
          else                            addBotMessage(msg.text);
        });
        if (data.status === 'agent') {
          sessionStatus = 'agent';
          agentName = data.agentName;
          setHeaderAgent(agentName);
          startPolling();
        }
        return true;
      }
    } catch (err) {
      console.error('History restore error:', err);
    }
    return false;
  }

  // ── Panel open / close ────────────────────────────────────────────────────────
  async function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    input.focus();

    if (messages.children.length > 0) return;

    if (conversationId) {
      const restored = await restoreHistory();
      if (restored) return;
    }

    // Fresh session — show greeting
    addBotMessage(
      'Hi! I\'m Jet\'s virtual support assistant. I can help with the Jet Phone app, calling features, SMS, voicemail, and more.\n\n' +
      'Prefer to talk to a person? Call us on <a href="tel:0488811729" style="color:#ED1C24;text-decoration:underline">0488 811 729</a> or click <strong>Talk to a human</strong> below.\n\n' +
      'What can I help you with today?',
      true
    );
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
  }

  // ── Support ticket modal ──────────────────────────────────────────────────────
  const SUB_FIELD_IDS = {
    'new_service':                  { id: 1900000673208, multi: true  },
    'modify_a_service':             { id: 1900000371628, multi: true  },
    'report_a_problem':             { id: 900011584086,  multi: false },
    'enquire_about_reports':        { id: 8122409755417, multi: false },
    'enquire_about_billing':        { id: 900011896466,  multi: false },
    'call_tracking___integrations': { id: 9986763840537, multi: false },
  };

  const SUB_OPTIONS = {
    'new_service': [
      ['New Jet Interactive Account',                    'new_jet_interactive_account'],
      ['New Jet Phone User (with Local number)',         'new_jet_phone_user'],
      ['New Cloud Mobile Phone User (with Mobile number)', 'new_cloud_mobile_phone_user'],
      ['New 1300/1800 Number',                          'new_1300/1800_number'],
      ['New Local/Mobile number (without Phone User)',  'new_local/mobile_number__without_phor'],
      ['IVR',                                           'ivr'],
      ['Queue Capacity',                                'queue_capacity'],
      ['Inbound Call Recording',                        'inbound_call_recording'],
      ['Outbound Recording',                            'outbound_recording'],
      ['International Calling',                         'international_calling'],
      ['Hardware',                                      'hardware'],
      ['Port a Number to Jet Interactive',              'port_a_number_to_jet_interactive'],
      ['Other feature (please specify in description)', 'other_feature__please_specify_'],
    ],
    'modify_a_service': [
      ['Change/Swap a phone number',                    'change/swap_a_phone_number'],
      ['Add/Change Phone User Details',                 'add/change_phone_user_details'],
      ['Add/Change Call Recording',                     'add/change_call_recording'],
      ['Add/Change Queue Setup',                        'add/change_queue_setup'],
      ['Add/Change An Answering Point',                 'add/change_an_answering_point'],
      ['Add/Change Voicemail',                          'add/change_voicemail'],
      ['Add/Change Time of Day Routing',                'add/change_time_of_day_routing'],
      ['Add/Change Hardware/Desk Phone',                'add/change_hardware'],
      ['Add/Change Callflow Greeting',                  'add/change_greeting'],
      ['Add/Change SMS Setup',                          'add/change_sms_setup'],
      ['Add/Change a Service Description',              'modify_service_description'],
      ['Add/Change Geographic or Postcode Routing',     'add/change_geographic_postcode_routing'],
      ['Update dynamic tracking codes',                 'update_dynamic_tracking_codes'],
      ['Other (Not listed above)',                      'other__not_listed_above_'],
    ],
    'report_a_problem': [
      ["I'm unable to make/receive calls",              'unable_to_make/receive_calls'],
      ["I'm having issues with SMS",                    'i_m_having_issues_with_sms'],
      ["I'm seeing Account Not Registered",             'account_not_registered'],
      ["I'm having poor audio quality",                 'poor_audio_quality'],
      ["I'm having one way audio",                      'one_way_audio'],
      ["I can't login to my Jet Soft Phone app",        'can_t_login_to_jetphone'],
      ['My inbound calls do not work (Jet app)',        'my_inbound_calls_do_not_work__jet_app'],
      ['My inbound calls do not work (external numbers)', 'my_inbound_numbers_are_not_connectin'],
      ["I can't login to Jet Hub",                      'can_t_login_to_jet_portal'],
      ['My hardware is not working',                    'my_hardware_is_not_working'],
      ['My callflows are not working',                  'my_callflows_are_not_working'],
      ["My tracking numbers aren't changing on my website", 'my_tracking_numbers_aren_t_changing_'],
      ['I need help with my Google Analytics integration', 'i_need_help_with_my_google_analytics_i'],
      ['Other Jet Hub issue (not listed above)',        'other_jet_hub_issue__not_listed_above_'],
      ['Other Jet Soft Phone App issue (not listed above)', 'other_jet_soft_phone_app_issue__not_li'],
    ],
    'enquire_about_reports': [
      ['My reports are not loading',                    'my_reports_are_not_loading'],
      ['My reports are incorrect',                      'my_reports_are_incorrect'],
      ['I cannot find the information I need',          'i_cannot_find_the_information_i_need'],
    ],
    'enquire_about_billing': [
      ['I have a question about my invoice',            'i_have_a_question_about_my_invoice'],
      ['I need to update my payment details',           'i_need_to_update_my_payment_details'],
      ["I need to change my account's invoicing",       'i_need_to_change_my_account_s_invoic'],
      ['I need to give someone access to my account',   'i_need_to_give_someone_access_to_my_'],
      ['Other',                                         'other_billing'],
    ],
    'call_tracking___integrations': [
      ['I need new codes for my website',               'i_need_new_codes_for_my_website'],
      ['I need to set up GA4',                          'i_need_to_set_up_ga4'],
      ["My tracking numbers aren't changing on my website", 'my_tracking_numbers_aren_t_changing_'],
      ['I need help with a Google Analytics Integration', 'i_need_help_with_a_google_analytics_int'],
      ['I need help with my call tracking reports',     'i_need_help_with_my_call_tracking_repo'],
      ['I have a question about integrations',          'i_have_a_question_about_integrations'],
      ['Other call tracking issue (not listed above)',  'other_call_tracking_issue__not_listed_ab'],
    ],
  };

  const overlay      = document.getElementById('jsm-overlay');
  const jsmReasonEl  = document.getElementById('jsm-reason');
  const jsmSubField  = document.getElementById('jsm-sub-field');
  const jsmSubReason = document.getElementById('jsm-sub-reason');
  const jsmForm      = document.getElementById('jsm-form');
  const jsmSuccess   = document.getElementById('jsm-success');
  const jsmError     = document.getElementById('jsm-error');
  const jsmSubmit    = document.getElementById('jsm-submit');

  jsmReasonEl.addEventListener('change', function () {
    const opts = SUB_OPTIONS[this.value] || [];
    jsmSubReason.innerHTML = '<option value="">Select…</option>' +
      opts.map(([label, value]) => `<option value="${value}">${label}</option>`).join('');
    jsmSubField.classList.toggle('visible', opts.length > 0);
  });

  document.getElementById('jsm-close-btn').addEventListener('click', closeSupportModal);
  document.getElementById('jsm-success-close').addEventListener('click', closeSupportModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSupportModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSupportModal(); closeSalesModal(); } });

  jsmSubmit.addEventListener('click', async function () {
    jsmError.style.display = 'none';
    const name      = document.getElementById('jsm-name').value.trim();
    const email     = document.getElementById('jsm-email').value.trim();
    const phone     = document.getElementById('jsm-phone').value.trim();
    const account   = document.getElementById('jsm-account').value.trim();
    const reason    = jsmReasonEl.value;
    const subReason = jsmSubReason.value;
    const subject   = document.getElementById('jsm-subject').value.trim();
    const message   = document.getElementById('jsm-message').value.trim();
    const subRequired = jsmSubField.classList.contains('visible');

    if (!name || !email || !phone || !reason || !subject || !message) {
      jsmError.textContent = 'Please fill in all required fields.';
      jsmError.style.display = 'block'; return;
    }
    if (subRequired && !subReason) {
      jsmError.textContent = 'Please select what specifically we can help you with.';
      jsmError.style.display = 'block'; return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      jsmError.textContent = 'Please enter a valid email address.';
      jsmError.style.display = 'block'; return;
    }

    jsmSubmit.disabled = true;
    jsmSubmit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:jcSpin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Sending…';

    const customFields = [
      { id: 900010486406, value: reason },
      { id: 900011984406, value: phone },
      { id: 900011971946, value: name },
    ];
    const subFieldCfg = SUB_FIELD_IDS[reason];
    if (subReason && subFieldCfg) {
      customFields.push({ id: subFieldCfg.id, value: subFieldCfg.multi ? [subReason] : subReason });
    }
    if (account) customFields.push({ id: 1900000673188, value: parseInt(account, 10) });

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_ticket',
          request: { requester: { name, email }, subject, comment: { body: message }, custom_fields: customFields },
        }),
      });
      if (res.ok || res.status === 201) {
        jsmForm.style.display = 'none';
        document.getElementById('jsm-success-msg').textContent = `Thanks ${name}. We'll be in touch shortly.`;
        jsmSuccess.style.display = 'block';
      } else {
        throw new Error(res.status);
      }
    } catch (err) {
      console.error('Ticket submit error:', err);
      jsmError.textContent = 'Something went wrong. Please try again or call us on ' + SUPPORT_PHONE + '.';
      jsmError.style.display = 'block';
      jsmSubmit.disabled = false;
      jsmSubmit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send message';
    }
  });

  function openSupportModal() {
    jsmForm.style.display = '';
    jsmSuccess.style.display = 'none';
    jsmError.style.display = 'none';
    ['jsm-name','jsm-email','jsm-phone','jsm-account','jsm-subject','jsm-message'].forEach(id => {
      document.getElementById(id).value = '';
    });
    jsmReasonEl.value = '';
    jsmSubReason.innerHTML = '<option value="">Select…</option>';
    jsmSubField.classList.remove('visible');
    jsmSubmit.disabled = false;
    jsmSubmit.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send message';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('jsm-name').focus(), 50);
  }

  function closeSupportModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.showTicketForm = openSupportModal;

  // ── HubSpot sales modal ───────────────────────────────────────────────────────
  let hsLoaded = false;

  function openSalesModal() {
    const hsOverlay = document.getElementById('jc-hs-overlay');
    const hsBody    = document.getElementById('jc-hs-body');
    hsOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (!hsLoaded) {
      hsLoaded = true;
      if (typeof hbspt !== 'undefined') {
        hsBody.innerHTML = '<div id="jc-hs-form-target"></div>';
        hbspt.forms.create({
          region:   'ap1',
          portalId: HS_PORTAL_ID,
          formId:   HS_FORM_ID,
          target:   '#jc-hs-form-target',
        });
      } else {
        // HubSpot script not yet loaded — load it now
        hsBody.innerHTML = '<div id="jc-hs-form-target"></div>';
        const script = document.createElement('script');
        script.src = 'https://js-ap1.hsforms.net/forms/embed/v2.js';
        script.onload = () => {
          hbspt.forms.create({
            region:   'ap1',
            portalId: HS_PORTAL_ID,
            formId:   HS_FORM_ID,
            target:   '#jc-hs-form-target',
          });
        };
        document.head.appendChild(script);
      }
    }
  }

  function closeSalesModal() {
    const hsOverlay = document.getElementById('jc-hs-overlay');
    hsOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.getElementById('jc-hs-close').addEventListener('click', closeSalesModal);
  document.getElementById('jc-hs-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('jc-hs-overlay')) closeSalesModal();
  });

  // ── Events ────────────────────────────────────────────────────────────────────
  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  send.addEventListener('click', () => sendMessage(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.value); }
  });
  input.addEventListener('input', autoResize);

  document.querySelectorAll('.jc-quick-btn').forEach((qb) => {
    qb.addEventListener('click', () => {
      const action = qb.dataset.action;
      if (action === 'human') {
        requestHandoff();
      } else if (action === 'sales') {
        if (quick.style.display !== 'none') quick.style.display = 'none';
        showSalesCard();
      } else {
        sendMessage(qb.textContent);
      }
    });
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && /contact\.html/.test(a.getAttribute('href'))) {
      e.preventDefault();
      openSupportModal();
    }
  });

  document.addEventListener('click', (e) => {
    if (isOpen && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      closePanel();
    }
  });

  setTimeout(() => {
    if (!isOpen) document.getElementById('jc-badge').style.display = 'block';
  }, 3000);
})();
