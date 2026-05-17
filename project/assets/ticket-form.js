(function () {
  'use strict';

  const ZENDESK = 'https://support.jetinteractive.com.au/api/v2/requests.json';

  const ISSUE_MAP = {
    'App (iOS / Android)':   { cat: 'report_a_problem',     sub: 'other_jet_soft_phone_app_issue__not_listed_above_' },
    'App (Mac / Windows)':   { cat: 'report_a_problem',     sub: 'other_jet_soft_phone_app_issue__not_listed_above_' },
    'Hardware / Desk phone': { cat: 'report_a_problem',     sub: 'my_hardware_is_not_working' },
    'Call quality':          { cat: 'report_a_problem',     sub: 'poor_audio_quality' },
    'Callflows & routing':   { cat: 'report_a_problem',     sub: 'my_callflows_are_not_working' },
    'SMS':                   { cat: 'report_a_problem',     sub: 'i_m_having_issues_with_sms' },
    'Billing & account':     { cat: 'enquire_about_billing', sub: 'other_billing' },
    'Porting a number':      { cat: 'new_service',          sub: 'port_a_number_to_jet_interactive' },
    'Reporting':             { cat: 'enquire_about_reports', sub: 'i_cannot_find_the_information_i_need' },
    'Other':                 { cat: 'report_a_problem',     sub: 'other_jet_soft_phone_app_issue__not_listed_above_' },
  };

  const CSS = `
    .kb-help {
      background: var(--ink-50, #F7F8FA);
      border: 1px solid var(--ink-300, #C9CCD1);
      border-radius: 16px;
      padding: 40px 32px;
      margin-top: 64px;
    }
    .kb-help__cta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .kb-help__cta-text h3 {
      font-family: 'Saira', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--ink-900, #0B0B0C);
      margin: 0 0 6px;
    }
    .kb-help__cta-text p {
      font-size: 16px;
      color: var(--ink-600, #4A4D55);
      margin: 0;
    }
    .kb-help__open-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--red, #ED1C24);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-family: 'Barlow', sans-serif;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: background 140ms;
    }
    .kb-help__open-btn:hover { background: var(--red-dark, #A71C20); }

    .kb-help__form-wrap { display: none; }
    .kb-help__form-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 28px;
    }
    .kb-help__form-header h3 {
      font-family: 'Saira', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--ink-900, #0B0B0C);
      margin: 0 0 4px;
    }
    .kb-help__form-header p {
      font-size: 16px;
      color: var(--ink-600, #4A4D55);
      margin: 0;
    }
    .kb-help__close-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--ink-500, #6B6E76);
      padding: 4px;
      line-height: 1;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .kb-help__close-btn:hover { color: var(--ink-900, #0B0B0C); background: var(--ink-200, #E1E4E8); }

    .tf-form { display: flex; flex-direction: column; gap: 16px; }
    .tf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .tf-field { display: flex; flex-direction: column; gap: 6px; }
    .tf-field label { font-size: 14px; font-weight: 600; color: var(--ink-900, #0B0B0C); }
    .tf-field input,
    .tf-field select,
    .tf-field textarea {
      font-family: 'Barlow', sans-serif;
      font-size: 16px;
      color: var(--ink-900, #0B0B0C);
      background: #fff;
      border: 1px solid var(--ink-300, #C9CCD1);
      border-radius: 8px;
      padding: 10px 14px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 140ms, box-shadow 140ms;
    }
    .tf-field input:focus,
    .tf-field select:focus,
    .tf-field textarea:focus {
      border-color: var(--red, #ED1C24);
      box-shadow: 0 0 0 3px rgba(237,28,36,.1);
    }
    .tf-field textarea { resize: vertical; min-height: 110px; line-height: 1.5; }
    .tf-field select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A4D55' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      padding-right: 36px;
    }
    .tf-error {
      display: none;
      background: #fff0f0;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      color: #b91c1c;
    }
    .tf-submit {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--red, #ED1C24);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 12px 28px;
      font-family: 'Barlow', sans-serif;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 140ms, box-shadow 140ms;
    }
    .tf-submit:hover { background: var(--red-dark, #A71C20); box-shadow: 0 8px 24px rgba(237,28,36,.28); }
    .tf-submit:disabled { opacity: .6; cursor: not-allowed; box-shadow: none; }

    .tf-success {
      display: none;
      text-align: center;
      padding: 40px 0 8px;
    }
    .tf-success__icon {
      width: 56px; height: 56px;
      background: var(--red-50, #FEF3F4);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
      color: var(--red, #ED1C24);
    }
    .tf-success h4 {
      font-family: 'Saira', sans-serif;
      font-size: 22px; font-weight: 700;
      color: var(--ink-900, #0B0B0C);
      margin: 0 0 8px;
    }
    .tf-success p { font-size: 16px; color: var(--ink-600, #4A4D55); margin: 0; }

    @keyframes tfSpin { to { transform: rotate(360deg); } }

    @media (max-width: 600px) {
      .kb-help { padding: 28px 20px; }
      .kb-help__cta { flex-direction: column; align-items: flex-start; }
      .tf-row { grid-template-columns: 1fr; }
      .tf-submit { width: 100%; justify-content: center; }
    }
  `;

  const FORM_HTML = `
    <div class="kb-help__cta" id="tf-cta">
      <div class="kb-help__cta-text">
        <h3>Still need help?</h3>
        <p>Submit a ticket and our support team will get back to you.</p>
      </div>
      <button class="kb-help__open-btn" id="tf-open">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Contact Support
      </button>
    </div>

    <div class="kb-help__form-wrap" id="tf-form-wrap">
      <div class="kb-help__form-header">
        <div>
          <h3>Contact Support</h3>
          <p>We'll get back to you as soon as possible.</p>
        </div>
        <button class="kb-help__close-btn" id="tf-close" aria-label="Close form">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="tf-success" id="tf-success">
        <div class="tf-success__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h4>Ticket submitted!</h4>
        <p>Thanks for reaching out. We'll be in touch shortly.</p>
      </div>

      <form class="tf-form" id="tf-form" novalidate>
        <div class="tf-row">
          <div class="tf-field">
            <label for="tf-name">Full name <span style="color:var(--red,#ED1C24)">*</span></label>
            <input type="text" id="tf-name" name="name" required placeholder="Jane Smith" autocomplete="name">
          </div>
          <div class="tf-field">
            <label for="tf-company">Company</label>
            <input type="text" id="tf-company" name="company" placeholder="Acme Pty Ltd" autocomplete="organization">
          </div>
        </div>
        <div class="tf-row">
          <div class="tf-field">
            <label for="tf-email">Email address <span style="color:var(--red,#ED1C24)">*</span></label>
            <input type="email" id="tf-email" name="email" required placeholder="jane@company.com.au" autocomplete="email">
          </div>
          <div class="tf-field">
            <label for="tf-phone">Phone number</label>
            <input type="tel" id="tf-phone" name="phone" placeholder="0400 000 000" autocomplete="tel">
          </div>
        </div>
        <div class="tf-row">
          <div class="tf-field">
            <label for="tf-type">Issue type</label>
            <select id="tf-type" name="type">
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
          <div class="tf-field">
            <label for="tf-subject">Subject <span style="color:var(--red,#ED1C24)">*</span></label>
            <input type="text" id="tf-subject" name="subject" required placeholder="Brief description of your issue">
          </div>
        </div>
        <div class="tf-field">
          <label for="tf-message">Message <span style="color:var(--red,#ED1C24)">*</span></label>
          <textarea id="tf-message" name="message" required placeholder="Please describe your issue in as much detail as possible…"></textarea>
        </div>
        <div class="tf-error" id="tf-error"></div>
        <button type="submit" class="tf-submit" id="tf-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Send message
        </button>
      </form>
    </div>
  `;

  function init() {
    if (!document.getElementById('tf-styles')) {
      const s = document.createElement('style');
      s.id = 'tf-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    document.querySelectorAll('.kb-help').forEach(function (el) {
      el.innerHTML = FORM_HTML;
      wire(el);
    });
  }

  function wire(el) {
    const cta      = el.querySelector('#tf-cta');
    const formWrap = el.querySelector('#tf-form-wrap');
    const form     = el.querySelector('#tf-form');
    const openBtn  = el.querySelector('#tf-open');
    const closeBtn = el.querySelector('#tf-close');
    const errorEl  = el.querySelector('#tf-error');
    const submitBtn= el.querySelector('#tf-submit');
    const successEl= el.querySelector('#tf-success');

    function open() {
      cta.style.display = 'none';
      formWrap.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function close() {
      cta.style.display = '';
      formWrap.style.display = 'none';
    }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorEl.style.display = 'none';

      const name    = el.querySelector('#tf-name').value.trim();
      const company = el.querySelector('#tf-company').value.trim();
      const email   = el.querySelector('#tf-email').value.trim();
      const phone   = el.querySelector('#tf-phone').value.trim();
      const type    = el.querySelector('#tf-type').value;
      const subject = el.querySelector('#tf-subject').value.trim();
      const message = el.querySelector('#tf-message').value.trim();

      if (!name || !email || !subject || !message) {
        errorEl.textContent = 'Please fill in all required fields.';
        errorEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:tfSpin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Sending…';

      const zdMap = ISSUE_MAP[type] || { cat: 'report_a_problem', sub: 'other_jet_soft_phone_app_issue__not_listed_above_' };
      const body = [
        message,
        company ? '\nCompany: '    + company : '',
        phone   ? '\nPhone: '      + phone   : '',
        type    ? '\nIssue type: ' + type    : '',
        '\nPage: ' + window.location.href,
      ].join('');

      try {
        const res = await fetch(ZENDESK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request: {
              subject: subject,
              comment: { body: body },
              requester: { name: name, email: email },
              custom_fields: [
                { id: 900011984406, value: phone || 'Not provided' },
                { id: 900010486406, value: zdMap.cat },
                { id: 900011584086, value: zdMap.sub },
              ],
            }
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.style.display = 'none';
        successEl.style.display = 'block';
      } catch {
        errorEl.textContent = 'Something went wrong. Please try again or call us on 0488 811 729.';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send message';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
