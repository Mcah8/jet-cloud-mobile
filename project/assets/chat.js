(function () {
  'use strict';

  const WORKER_URL  = 'https://livechat.matthew-cahill.workers.dev';
  const ZENDESK_URL = 'https://support.jetinteractive.com.au/api/v2/requests.json';

  const history = [];
  let isOpen   = false;
  let isTyping = false;

  // ── CSS ──────────────────────────────────────────────────────────────────────
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
    }
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
      background:#86efac; flex-shrink:0;
    }
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
    .jc-msg__bubble {
      padding: 9px 13px; border-radius: 14px;
      font-size: 13.5px; line-height: 1.5; font-family: 'Barlow',sans-serif;
    }
    .jc-msg--bot  .jc-msg__bubble { background:#f1f5f9; color:#1e293b; border-bottom-left-radius:4px; }
    .jc-msg--user .jc-msg__bubble { background:#ED1C24; color:#fff; border-bottom-right-radius:4px; }

    .jc-typing .jc-msg__bubble { display:flex; align-items:center; gap:4px; padding:12px 14px; }
    .jc-typing .jc-dot { width:7px; height:7px; border-radius:50%; background:#94a3b8; animation:jcBounce 1.2s infinite; }
    .jc-typing .jc-dot:nth-child(2) { animation-delay:.2s; }
    .jc-typing .jc-dot:nth-child(3) { animation-delay:.4s; }
    @keyframes jcBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    /* Ticket form card */
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
        <button class="jc-quick-btn" data-action="ticket">Talk to a human</button>
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

  // ── Elements ─────────────────────────────────────────────────────────────────
  const btn      = document.getElementById('jc-btn');
  const panel    = document.getElementById('jc-panel');
  const closeBtn = document.getElementById('jc-close');
  const messages = document.getElementById('jc-messages');
  const quick    = document.getElementById('jc-quick');
  const input    = document.getElementById('jc-input');
  const send     = document.getElementById('jc-send');
  const errorBar = document.getElementById('jc-error-bar');

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    input.focus();
    if (messages.children.length === 0) {
      addBotMessage(
        'Hi! I\'m Jet\'s virtual support assistant. I can help with the Jet Phone app, calling features, SMS, voicemail, and more.\n\n' +
        'Prefer to talk to a person? Call us on <a href="tel:0488811729" style="color:#ED1C24;text-decoration:underline">0488 811 729</a> or click <strong>Talk to a human</strong> below to raise a support ticket.\n\n' +
        'What can I help you with today?',
        true
      );
    }
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function botAvatar() {
    return `<div class="jc-msg__avatar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>`;
  }

  function addBotMessage(text, allowHtml) {
    const el = document.createElement('div');
    el.className = 'jc-msg jc-msg--bot';
    const content = allowHtml ? text.replace(/\n/g, '<br>') : escapeHtml(text);
    el.innerHTML = `${botAvatar()}<div class="jc-msg__bubble">${content}</div>`;
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
    el.innerHTML = `${botAvatar()}<div class="jc-msg__bubble"><span class="jc-dot"></span><span class="jc-dot"></span><span class="jc-dot"></span></div>`;
    messages.appendChild(el);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('jc-typing');
    if (el) el.remove();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }

  // ── Ticket form ───────────────────────────────────────────────────────────────
  const ISSUE_MAP = {
    'App (iOS / Android)':   { cat: 'report_a_problem',    sub: 'other_jet_soft_phone_app_issue__not_listed_above_' },
    'App (Mac / Windows)':   { cat: 'report_a_problem',    sub: 'other_jet_soft_phone_app_issue__not_listed_above_' },
    'Hardware / Desk phone': { cat: 'report_a_problem',    sub: 'my_hardware_is_not_working' },
    'Call quality':          { cat: 'report_a_problem',    sub: 'poor_audio_quality' },
    'Callflows & routing':   { cat: 'report_a_problem',    sub: 'my_callflows_are_not_working' },
    'SMS':                   { cat: 'report_a_problem',    sub: 'i_m_having_issues_with_sms' },
    'Billing & account':     { cat: 'enquire_about_billing', sub: 'other_billing' },
    'Porting a number':      { cat: 'new_service',         sub: 'port_a_number_to_jet_interactive' },
    'Reporting':             { cat: 'enquire_about_reports', sub: 'i_cannot_find_the_information_i_need' },
    'Other':                 { cat: 'report_a_problem',    sub: 'other_jet_soft_phone_app_issue__not_listed_above_' },
  };

  function showTicketForm() {
    if (quick.style.display !== 'none') quick.style.display = 'none';

    const row = document.createElement('div');
    row.className = 'jc-msg jc-msg--bot jc-msg--wide';
    row.style.marginTop = '4px';
    row.innerHTML = `
      ${botAvatar()}
      <div class="jcf-card">
        <h4>Submit a support ticket</h4>
        <div class="jcf-body">
          <div class="jcf-field">
            <label>Full name <span style="color:#ED1C24">*</span></label>
            <input type="text" class="jcf-name" placeholder="Jane Smith" autocomplete="name">
          </div>
          <div class="jcf-field">
            <label>Company</label>
            <input type="text" class="jcf-company" placeholder="Acme Pty Ltd" autocomplete="organization">
          </div>
          <div class="jcf-field">
            <label>Email <span style="color:#ED1C24">*</span></label>
            <input type="email" class="jcf-email" placeholder="jane@company.com.au" autocomplete="email">
          </div>
          <div class="jcf-field">
            <label>Phone number</label>
            <input type="tel" class="jcf-phone" placeholder="0400 000 000" autocomplete="tel">
          </div>
          <div class="jcf-field">
            <label>Issue type</label>
            <select class="jcf-type">
              <option value="">Select a category…</option>
              <option>App (iOS / Android)</option>
              <option>App (Mac / Windows)</option>
              <option>Hardware / Desk phone</option>
              <option>Call quality</option>
              <option>Callflows &amp; routing</option>
              <option>SMS</option>
              <option>Billing &amp; account</option>
              <option>Porting a number</option>
              <option>Reporting</option>
              <option>Other</option>
            </select>
          </div>
          <div class="jcf-field">
            <label>Subject <span style="color:#ED1C24">*</span></label>
            <input type="text" class="jcf-subject" placeholder="Brief description of your issue">
          </div>
          <div class="jcf-field">
            <label>Message <span style="color:#ED1C24">*</span></label>
            <textarea class="jcf-message" placeholder="Please describe your issue in as much detail as possible…"></textarea>
          </div>
          <div class="jcf-error"></div>
          <button class="jcf-submit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send message
          </button>
        </div>
      </div>
    `;
    messages.appendChild(row);
    scrollBottom();

    const body      = row.querySelector('.jcf-body');
    const nameEl    = row.querySelector('.jcf-name');
    const companyEl = row.querySelector('.jcf-company');
    const emailEl   = row.querySelector('.jcf-email');
    const phoneEl   = row.querySelector('.jcf-phone');
    const typeEl    = row.querySelector('.jcf-type');
    const subjectEl = row.querySelector('.jcf-subject');
    const msgEl     = row.querySelector('.jcf-message');
    const errEl     = row.querySelector('.jcf-error');
    const submitEl  = row.querySelector('.jcf-submit');

    nameEl.focus();

    submitEl.addEventListener('click', async function () {
      errEl.style.display = 'none';

      const name    = nameEl.value.trim();
      const company = companyEl.value.trim();
      const email   = emailEl.value.trim();
      const phone   = phoneEl.value.trim();
      const type    = typeEl.value;
      const subject = subjectEl.value.trim();
      const message = msgEl.value.trim();

      if (!name || !email || !subject || !message) {
        errEl.textContent = 'Please fill in all required fields.';
        errEl.style.display = 'block';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.style.display = 'block';
        return;
      }

      submitEl.disabled = true;
      submitEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:jcSpin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Sending…';

      const zdMap = ISSUE_MAP[type] || { cat: 'report_a_problem', sub: 'other_jet_soft_phone_app_issue__not_listed_above_' };
      const bodyLines = [
        message,
        company ? '\nCompany: ' + company  : '',
        phone   ? '\nPhone: '   + phone    : '',
        type    ? '\nIssue type: ' + type  : '',
        '\nPage: ' + window.location.href,
      ].join('');

      try {
        const res = await fetch(ZENDESK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request: {
              subject: subject,
              comment: { body: bodyLines },
              requester: { name: name, email: email },
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.error('Ticket submission failed:', res.status, errBody);
          throw new Error('HTTP ' + res.status);
        }

        body.innerHTML = `
          <div class="jcf-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <strong style="font-size:14px;color:#1e293b">Ticket submitted!</strong>
            <p>Thanks ${escapeHtml(name).replace(/<br>/g,'')}. We'll be in touch shortly.</p>
          </div>
        `;
        scrollBottom();

      } catch (err) {
        console.error('Ticket submit error:', err);
        errEl.textContent = 'Something went wrong. Please try again or call 0488 811 729.';
        errEl.style.display = 'block';
        submitEl.disabled = false;
        submitEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send message';
      }
    });
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text || isTyping) return;

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

      const data  = await res.json();
      const reply = data?.content?.[0]?.text || "I'm sorry, I couldn't process that. Please call us on 0488 811 729.";

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
      if (qb.dataset.action === 'ticket') {
        if (quick.style.display !== 'none') quick.style.display = 'none';
        if (messages.children.length === 0) openPanel();
        showTicketForm();
      } else {
        sendMessage(qb.textContent);
      }
    });
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
