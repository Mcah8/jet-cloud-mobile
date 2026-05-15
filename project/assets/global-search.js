(function () {
  'use strict';

  // Resolve the path to search-index.json relative to this script's location
  const scripts = document.querySelectorAll('script[src*="global-search.js"]');
  const scriptSrc = scripts[scripts.length - 1]?.src || '';
  const base = scriptSrc ? scriptSrc.replace('global-search.js', '') : '';
  const INDEX_URL = base + 'search-index.json';

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css = `
    #gs-trigger {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--fg-1, #0B0B0C);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      transition: background 140ms, color 140ms;
      flex-shrink: 0;
    }
    #gs-trigger:hover { background: var(--ink-100, #EEF0F3); color: var(--red, #ED1C24); }

    #gs-overlay {
      position: fixed;
      inset: 0;
      z-index: 9000;
      background: rgba(11,11,12,.55);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 80px 16px 40px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 180ms ease;
    }
    #gs-overlay.open {
      opacity: 1;
      pointer-events: all;
    }

    #gs-modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(11,11,12,.22);
      width: 100%;
      max-width: 640px;
      max-height: calc(100vh - 140px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(-8px) scale(.98);
      transition: transform 180ms ease;
    }
    #gs-overlay.open #gs-modal {
      transform: translateY(0) scale(1);
    }

    #gs-input-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--ink-200, #E1E4E8);
      flex-shrink: 0;
    }
    #gs-input-row svg { color: var(--ink-400, #9A9DA4); flex-shrink: 0; }
    #gs-input {
      flex: 1;
      border: none;
      outline: none;
      font-family: 'Barlow', sans-serif;
      font-size: 17px;
      color: var(--ink-900, #0B0B0C);
      background: none;
    }
    #gs-input::placeholder { color: var(--ink-400, #9A9DA4); }
    #gs-kbd {
      font-size: 11px;
      color: var(--ink-400, #9A9DA4);
      background: var(--ink-100, #EEF0F3);
      border: 1px solid var(--ink-200, #E1E4E8);
      border-radius: 5px;
      padding: 2px 7px;
      font-family: monospace;
      flex-shrink: 0;
    }

    #gs-body {
      overflow-y: auto;
      flex: 1;
    }
    #gs-body::-webkit-scrollbar { width: 4px; }
    #gs-body::-webkit-scrollbar-thumb { background: var(--ink-200, #E1E4E8); border-radius: 2px; }

    .gs-section-label {
      padding: 10px 20px 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .07em;
      color: var(--ink-400, #9A9DA4);
    }

    .gs-result {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 20px;
      text-decoration: none;
      color: var(--ink-900, #0B0B0C);
      border-radius: 8px;
      margin: 0 8px;
      transition: background 120ms;
      cursor: pointer;
    }
    .gs-result:hover, .gs-result.focused {
      background: var(--ink-50, #F7F8FA);
    }
    .gs-result__icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--red-50, #FEF3F4);
      color: var(--red, #ED1C24);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .gs-result__icon--page { background: #f0f4ff; color: #3b5bdb; }
    .gs-result__icon--article { background: #f0fdf4; color: #16a34a; }
    .gs-result__title {
      font-weight: 600;
      font-size: 14px;
      line-height: 1.3;
      margin-bottom: 3px;
    }
    .gs-result__title mark { background: none; color: var(--red, #ED1C24); font-weight: 700; }
    .gs-result:hover .gs-result__title, .gs-result.focused .gs-result__title { color: var(--red, #ED1C24); }
    .gs-result__meta {
      font-size: 12px;
      color: var(--ink-400, #9A9DA4);
    }
    .gs-result__excerpt {
      font-size: 13px;
      color: var(--ink-500, #6B6E76);
      line-height: 1.4;
      margin-top: 2px;
    }
    .gs-result__excerpt mark { background: none; color: var(--ink-900, #0B0B0C); font-weight: 600; }

    #gs-empty {
      text-align: center;
      padding: 48px 24px;
      color: var(--ink-400, #9A9DA4);
    }
    #gs-empty strong { display: block; font-size: 16px; color: var(--ink-600, #4A4D55); margin-bottom: 6px; }

    #gs-hint {
      padding: 16px 20px;
      border-top: 1px solid var(--ink-100, #EEF0F3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    #gs-hint span { font-size: 12px; color: var(--ink-400, #9A9DA4); display: flex; align-items: center; gap: 8px; }
    .gs-hint-key {
      background: var(--ink-100, #EEF0F3);
      border: 1px solid var(--ink-200, #E1E4E8);
      border-radius: 4px;
      padding: 1px 6px;
      font-family: monospace;
      font-size: 11px;
    }

    @media (max-width: 600px) {
      #gs-overlay { padding: 16px; align-items: flex-start; }
      #gs-modal { max-height: calc(100vh - 32px); }
      #gs-kbd { display: none; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Wire trigger buttons ───────────────────────────────────────────────────
  function injectTrigger() {
    // Desktop button is pre-rendered inside nav__links; mobile button is before burger
    document.querySelectorAll('#gs-trigger, #gs-trigger-mob').forEach(btn => {
      if (btn) btn.addEventListener('click', openSearch);
    });
  }

  // Show mobile button at ≤900px, hide at wider viewports
  const mobCss = document.createElement('style');
  mobCss.textContent = '@media(max-width:900px){#gs-trigger{display:none!important}#gs-trigger-mob{display:flex!important}}';
  document.head.appendChild(mobCss);

  // ── Build overlay HTML ─────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'gs-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Search');
  overlay.innerHTML = `
    <div id="gs-modal">
      <div id="gs-input-row">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="gs-input" type="text" placeholder="Search articles, guides, FAQs…" autocomplete="off" spellcheck="false">
        <span id="gs-kbd">ESC</span>
      </div>
      <div id="gs-body"></div>
      <div id="gs-hint">
        <span><span class="gs-hint-key">↑↓</span> navigate &nbsp; <span class="gs-hint-key">↵</span> open &nbsp; <span class="gs-hint-key">ESC</span> close</span>
        <span style="font-size:12px;color:var(--ink-400)">207 articles &amp; pages</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const gsInput = overlay.querySelector('#gs-input');
  const gsBody  = overlay.querySelector('#gs-body');

  // ── Search index ───────────────────────────────────────────────────────────
  let index = null;
  let focusIdx = -1;

  fetch(INDEX_URL).then(r => r.json()).then(d => {
    index = d;
    overlay.querySelector('#gs-hint span:last-child').textContent = d.length + ' articles & pages';
  }).catch(() => {});

  // ── Helpers ────────────────────────────────────────────────────────────────
  function hl(text, q) {
    if (!q || !text) return text || '';
    const e = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text).replace(new RegExp(`(${e})`, 'gi'), '<mark>$1</mark>');
  }

  function excerpt(text, q, len = 110) {
    if (!text) return '';
    const idx = text.toLowerCase().indexOf((q || '').toLowerCase());
    const start = idx > 40 ? idx - 40 : 0;
    const end = Math.min(text.length, start + len);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function iconFor(item) {
    if (item.cat_slug === 'page')     return { cls:'gs-result__icon--page',    svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' };
    if (item.cat_slug === 'article')  return { cls:'gs-result__icon--article', svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' };
    if (item.cat_slug === 'solution' || item.cat_slug === 'solutions') return { cls:'gs-result__icon--article', svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' };
    return { cls:'', svg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' };
  }

  function getUrl(item) {
    // Make URL relative to current page
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const prefix = depth <= 1 ? '' : '../'.repeat(depth - 1);
    return prefix + item.url;
  }

  function renderResults(q) {
    if (!index || !q || q.length < 2) {
      gsBody.innerHTML = '';
      focusIdx = -1;
      return;
    }

    const terms = q.toLowerCase().trim().split(/\s+/);

    const scored = index.map(item => {
      const tl = (item.title || '').toLowerCase();
      const tx = (item.text || '').toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (tl === t) score += 20;
        else if (tl.startsWith(t)) score += 12;
        else if (tl.includes(t)) score += 8;
        if (tx.includes(t)) score += 2;
      }
      return { ...item, score };
    }).filter(i => i.score > 0).sort((a, b) => b.score - a.score);

    focusIdx = -1;

    if (scored.length === 0) {
      gsBody.innerHTML = `<div id="gs-empty"><strong>No results for "${q}"</strong>Try a different search term.</div>`;
      return;
    }

    // Group by category
    const groups = {};
    const ORDER = ['Home','Page','FAQ','Knowledgebase','Article','Solution','Industry',
      'New Services & Setups','Phone System Management','Jet Phone (Apps & Hardware)',
      'Troubleshooting','Reporting','Billing & Account Management'];

    for (const item of scored.slice(0, 12)) {
      const g = item.cat || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }

    let html = '';
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    let globalIdx = 0;
    for (const g of sortedGroups) {
      const label = ['Home','Page','FAQ'].includes(g) ? 'Pages' :
                    g === 'Article' ? 'Blog Articles' :
                    ['Solution','solutions'].includes(g) ? 'Solutions' :
                    ['Industry','industries'].includes(g) ? 'Industries' : g;
      html += `<div class="gs-section-label">${label}</div>`;
      for (const item of groups[g]) {
        const ic = iconFor(item);
        const exc = hl(excerpt(item.text, q), q);
        html += `<a href="${getUrl(item)}" class="gs-result" data-idx="${globalIdx++}">
          <div class="gs-result__icon ${ic.cls}">${ic.svg}</div>
          <div>
            <div class="gs-result__title">${hl(item.title, q)}</div>
            <div class="gs-result__meta">${item.cat}</div>
            ${exc ? `<div class="gs-result__excerpt">${exc}</div>` : ''}
          </div>
        </a>`;
      }
    }

    gsBody.innerHTML = html;
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  function openSearch() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => gsInput.focus(), 50);
  }

  function closeSearch() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    gsInput.value = '';
    gsBody.innerHTML = '';
    focusIdx = -1;
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  let debounce;
  gsInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => renderResults(gsInput.value.trim()), 150);
  });

  gsInput.addEventListener('keydown', e => {
    const items = gsBody.querySelectorAll('.gs-result');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIdx = Math.min(focusIdx + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx = Math.max(focusIdx - 1, -1);
    } else if (e.key === 'Enter') {
      if (focusIdx >= 0 && items[focusIdx]) { items[focusIdx].click(); closeSearch(); }
      return;
    } else if (e.key === 'Escape') {
      closeSearch(); return;
    }
    items.forEach((el, i) => el.classList.toggle('focused', i === focusIdx));
    if (focusIdx >= 0) items[focusIdx]?.scrollIntoView({ block: 'nearest' });
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });

  // Keyboard shortcut: / to open (when not in an input)
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault(); openSearch();
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTrigger);
  } else {
    injectTrigger();
  }
})();
