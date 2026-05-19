(function () {
  'use strict';

  // ── Stemmer (English suffix-stripping) ────────────────────────────────────
  // Strips the most common English inflectional and derivational suffixes so that
  // "calling", "calls", "called" all match a query for "call".
  function stem(w) {
    if (w.length < 4) return w;
    const orig = w;

    // -ies / -ied → -y  (carries → carry, carried → carry)
    if (w.length > 5 && w.endsWith('ies'))      { w = w.slice(0, -3) + 'y'; }
    else if (w.length > 5 && w.endsWith('ied')) { w = w.slice(0, -3) + 'y'; }
    // -sses → -ss  (addresses → address)
    else if (w.endsWith('sses'))                 { w = w.slice(0, -2); }
    // simple -s  (calls → call, accounts → account) but not -ss/-us/-is
    else if (w.length > 4 && w.endsWith('s') &&
             !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
      w = w.slice(0, -1);
    }

    if (w.length < 4) return orig;

    // -ations / -ation → -ate  (configuration → configure skipped; ation→ate)
    if      (w.endsWith('ations') && w.length > 8)  { w = w.slice(0, -6) + 'ate'; }
    else if (w.endsWith('ation')  && w.length > 7)  { w = w.slice(0, -5) + 'ate'; }
    // -izing / -ising → keep root  (organizing → organ… not ideal but ok)
    else if (w.endsWith('izing')  && w.length > 7)  { w = w.slice(0, -3); }
    else if (w.endsWith('ising')  && w.length > 7)  { w = w.slice(0, -3); }
    // -ing  (calling → call, downloading → download)
    else if (w.endsWith('ing')    && w.length > 6)  { w = w.slice(0, -3); }
    // -ed   (transferred → transfer, recorded → record)
    else if (w.endsWith('ed')     && w.length > 5)  { w = w.slice(0, -2); }

    if (w.length < 3) return orig;

    // derivational suffixes — only strip if root stays meaningful
    if      (w.endsWith('ness')   && w.length > 7)  { w = w.slice(0, -4); }
    else if (w.endsWith('ment')   && w.length > 7)  { w = w.slice(0, -4); }
    else if (w.endsWith('ful')    && w.length > 6)  { w = w.slice(0, -3); }
    else if (w.endsWith('ous')    && w.length > 6)  { w = w.slice(0, -3); }
    else if (w.endsWith('ive')    && w.length > 6)  { w = w.slice(0, -3); }
    else if (w.endsWith('ical')   && w.length > 7)  { w = w.slice(0, -4) + 'ic'; }

    // -ers / -er
    if      (w.endsWith('ers')    && w.length > 6)  { w = w.slice(0, -3); }
    else if (w.endsWith('er')     && w.length > 5)  { w = w.slice(0, -2); }

    // -ly
    if      (w.endsWith('ly')     && w.length > 5)  { w = w.slice(0, -2); }

    return w.length >= 3 ? w : orig;
  }

  // ── Synonym expansion (telecom-focused) ───────────────────────────────────
  // Groups of words treated as equivalent. A query for any member expands to
  // all members, boosting recall without hurting precision.
  const SYNONYM_GROUPS = [
    ['voicemail', 'vm', 'vmail', 'voice mail'],
    ['sms', 'text', 'message', 'txt', 'messaging'],
    ['call', 'phone', 'dial', 'ring', 'calling'],
    ['transfer', 'forward', 'redirect', 'divert'],
    ['app', 'application', 'softphone', 'client'],
    ['login', 'signin', 'log in', 'sign in', 'authenticate'],
    ['password', 'credentials', 'passcode'],
    ['cancel', 'terminate', 'disconnect', 'stop service'],
    ['hardware', 'handset', 'desk phone', 'deskphone', 'physical phone'],
    ['recording', 'record', 'recorded'],
    ['report', 'reporting', 'analytics', 'statistics', 'stats'],
    ['queue', 'hold', 'waiting', 'ring group'],
    ['conference', 'group call', 'multi-party'],
    ['billing', 'invoice', 'payment', 'bill', 'charge'],
    ['number', 'phone number', 'extension', 'did'],
    ['download', 'install', 'setup', 'set up'],
    ['account', 'portal', 'hub', 'admin', 'dashboard'],
    ['mobile', 'smartphone', 'cell', 'handset'],
    ['audio', 'sound', 'microphone', 'speaker', 'headset'],
    ['international', 'overseas', 'global', 'abroad'],
  ];

  // Build word → array-of-synonyms lookup
  const _synLookup = {};
  for (const group of SYNONYM_GROUPS) {
    const stemmed = group.map(stem);
    for (const s of stemmed) _synLookup[s] = stemmed;
  }

  function expandTerms(terms) {
    const expanded = new Set(terms);
    for (const t of terms) {
      const syn = _synLookup[t];
      if (syn) syn.forEach(s => expanded.add(s));
    }
    return [...expanded];
  }

  // ── Tokeniser ─────────────────────────────────────────────────────────────
  function tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOPWORDS.has(t))
      .map(stem);
  }

  const STOPWORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'is','it','its','this','that','was','are','be','been','by','from','has',
    'have','had','not','as','do','did','can','will','if','we','you','your',
    'how','what','when','where','my','all','also','into','any','our',
  ]);

  // ── Levenshtein fuzzy matching ────────────────────────────────────────────
  // Returns edit distance between two strings.
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 99; // fast reject
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  // Maximum edit distance allowed for a given term length
  function fuzzyThreshold(len) {
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    return 2;
  }

  // ── TF-IDF ────────────────────────────────────────────────────────────────
  let idfTable    = {};   // term → idf score
  let tokenCache  = [];   // pre-tokenized docs: [{titleToks, bodyToks}]
  let vocabulary  = [];   // all unique stemmed terms (for fuzzy vocab lookup)

  function buildSearchStructures(docs) {
    const N = docs.length;
    const df = {};   // document frequency per term

    tokenCache = docs.map(doc => {
      const titleToks = tokenize(doc.title);
      const bodyToks  = tokenize(doc.text || '');
      // count document frequency
      new Set([...titleToks, ...bodyToks]).forEach(t => {
        df[t] = (df[t] || 0) + 1;
      });
      return { titleToks, bodyToks };
    });

    // IDF with Laplace smoothing: ln((N+1)/(df+1)) + 1
    idfTable = {};
    for (const [term, freq] of Object.entries(df)) {
      idfTable[term] = Math.log((N + 1) / (freq + 1)) + 1;
    }

    vocabulary = Object.keys(idfTable);
  }

  // For a query term that had no exact match, find vocabulary terms within
  // the fuzzy threshold and return a weighted bonus score.
  function fuzzyScore(queryTerm) {
    const thresh = fuzzyThreshold(queryTerm.length);
    if (thresh === 0) return { matches: [], bonus: 0 };
    let best = thresh + 1;
    const matches = [];
    for (const vt of vocabulary) {
      const d = editDistance(queryTerm, vt);
      if (d <= thresh) {
        matches.push({ term: vt, dist: d });
        if (d < best) best = d;
      }
    }
    // Score bonus decreases with distance: dist=1 → 0.6, dist=2 → 0.3
    const bonus = best <= thresh ? (1 - best * 0.4) : 0;
    return { matches: matches.map(m => m.term), bonus };
  }

  // Score a single document against expanded query terms
  function scoreDocument(docIdx, queryTerms) {
    const { titleToks, bodyToks } = tokenCache[docIdx];
    const titleLen = Math.max(titleToks.length, 1);
    const bodyLen  = Math.max(bodyToks.length, 1);
    let score = 0;

    for (const qt of queryTerms) {
      const idf = idfTable[qt] || 1;

      // TF in title (with 6× boost) and body
      const tTF = titleToks.filter(t => t === qt).length / titleLen;
      const bTF = bodyToks.filter(t  => t === qt).length / bodyLen;
      score += tTF * idf * 6 + bTF * idf;

      // Fuzzy fallback when no exact match exists in this document at all
      if (tTF === 0 && bTF === 0) {
        const { matches, bonus } = fuzzyScore(qt);
        if (bonus > 0) {
          for (const fm of matches) {
            const fidf = idfTable[fm] || 1;
            const ftTF = titleToks.filter(t => t === fm).length / titleLen;
            const fbTF = bodyToks.filter(t  => t === fm).length / bodyLen;
            score += (ftTF * fidf * 6 + fbTF * fidf) * bonus;
          }
        }
      }
    }
    return score;
  }

  // ── Resolve index URL relative to this script ─────────────────────────────
  const scripts = document.querySelectorAll('script[src*="global-search.js"]');
  const scriptSrc = scripts[scripts.length - 1]?.src || '';
  const base = scriptSrc ? scriptSrc.replace('global-search.js', '') : '';
  const INDEX_URL = base + 'search-index.json';

  // ── CSS ───────────────────────────────────────────────────────────────────
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
    .gs-result__icon--page    { background: #f0f4ff; color: #3b5bdb; }
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

  // ── Wire trigger buttons ──────────────────────────────────────────────────
  function injectTrigger() {
    document.querySelectorAll('#gs-trigger, #gs-trigger-mob').forEach(btn => {
      if (btn) btn.addEventListener('click', openSearch);
    });
  }

  // Show mobile button at ≤900px, hide at wider viewports
  const mobCss = document.createElement('style');
  mobCss.textContent = '@media(max-width:900px){#gs-trigger{display:none!important}#gs-trigger-mob{display:flex!important}}';
  document.head.appendChild(mobCss);

  // ── Build overlay HTML ────────────────────────────────────────────────────
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

  // ── Load index and build structures ──────────────────────────────────────
  let index    = null;
  let focusIdx = -1;

  fetch(INDEX_URL).then(r => r.json()).then(d => {
    index = d;
    buildSearchStructures(d);
    overlay.querySelector('#gs-hint span:last-child').textContent = d.length + ' articles & pages';
  }).catch(() => {});

  // ── Helpers ───────────────────────────────────────────────────────────────
  function hlRaw(text, rawQuery) {
    // Highlight original query terms in display text (pre-stemming)
    if (!rawQuery || !text) return text || '';
    const e = rawQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const prefix = depth <= 1 ? '' : '../'.repeat(depth - 1);
    return prefix + item.url;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderResults(rawQuery) {
    if (!index || !rawQuery || rawQuery.length < 2) {
      gsBody.innerHTML = '';
      focusIdx = -1;
      return;
    }

    // Tokenize + stem the query, then expand with synonyms
    const queryTerms = expandTerms(tokenize(rawQuery));

    if (queryTerms.length === 0) {
      gsBody.innerHTML = '';
      return;
    }

    // Score every document
    const scored = index.map((item, i) => ({
      ...item,
      score: scoreDocument(i, queryTerms),
    })).filter(i => i.score > 0).sort((a, b) => b.score - a.score);

    focusIdx = -1;

    if (scored.length === 0) {
      gsBody.innerHTML = `<div id="gs-empty"><strong>No results for "${rawQuery}"</strong>Try a different search term.</div>`;
      return;
    }

    // Group top-12 by category
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
        const ic  = iconFor(item);
        const exc = hlRaw(excerpt(item.text, rawQuery), rawQuery);
        html += `<a href="${getUrl(item)}" class="gs-result" data-idx="${globalIdx++}">
          <div class="gs-result__icon ${ic.cls}">${ic.svg}</div>
          <div>
            <div class="gs-result__title">${hlRaw(item.title, rawQuery)}</div>
            <div class="gs-result__meta">${item.cat}</div>
            ${exc ? `<div class="gs-result__excerpt">${exc}</div>` : ''}
          </div>
        </a>`;
      }
    }

    gsBody.innerHTML = html;
  }

  // ── Open / close ──────────────────────────────────────────────────────────
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

  // ── Events ────────────────────────────────────────────────────────────────
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

  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault(); openSearch();
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTrigger);
  } else {
    injectTrigger();
  }
})();
