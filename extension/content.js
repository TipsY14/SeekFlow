/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
/* SeekFlow: native DOM stays the source of truth. No forum write endpoints. */
(() => {
  'use strict';
  if (window.__SEEKFLOW__) { window.__SEEKFLOW__.refresh(); return; }
  const root = document.documentElement;
  const DEFAULTS = Object.freeze({ enabled: true, theme: 'system', palette: 'waterlilies', density: 'compact', fontSize: 17,
    quiet: true, signatures: true, history: true, ctrlEnterSend: true, readStyle: 'badge', continuous: true, infiniteFeed: true, userDetails: true, showCreditScore: false, showHeaderNav: true, nested: true, showLevel: true, showJoined: true, showPosts: false, showComments: false, showCoin: false, showFans: false, showStardust: false });
  const ICONS = {
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    reply: '<path d="m9 6-6 6 6 6M3 12h10c5 0 7 3 7 7"/>',
    link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  let settings = { ...DEFAULTS };
  let library = { saved: [], recent: [], progress: {} };
  let account = 'guest', libraryKey = '', enabled = false, runtime, observer, refreshTimer;
  let pageType = 'other', feedQuery = '', unreadOnly = false, authorFilter = '', focusMode = false;
  let messageObserver = null;
  let floatingEditor = null, avatarCardScroll = null;
  let dialogState = null, toastTimer, scrollFrame = 0, progressTimer, lastScroll = 0;
  let writeQueue = Promise.resolve(), dataWriteTimer, dataDirty = false;
  let stream = null, streamObserver = null;
  const MAX_STREAM_PAGES = 15;
  let publicProfiles = {}, profileObserver = null, profileQueue = [], profileActive = 0, profileRequests = 0, profileWriteTimer;
  const profilePending = new Set(), profileFailures = new Map(), profileControllers = new Set();
  let profileObserved = new WeakSet();
  const threadSlots = new Map();
  let inlineObserver = null, inlineQueue = [], inlineActive = 0, inlineRequests = 0;
  const inlinePending = new Map(), inlineControllers = new Set(), inlineFailures = new Set();
  const PROFILE_FIELDS = [['showLevel','rank','等级'],['showJoined','created','加入天数'],['showPosts','nPost','主题帖'],['showComments','nComment','评论'],['showCoin','coin','鸡腿'],['showFans','fans','粉丝'],['showStardust','stardust','星辰']];
  function profilesWanted() { return settings.showCreditScore || (settings.userDetails && PROFILE_FIELDS.some(([key]) => settings[key])); }
  const PROFILE_TTL = 6 * 60 * 60 * 1000;
  function commentURL(node) { return node.dataset.nsuSourceUrl || `${location.origin}${location.pathname}#${node.id}`; }
  const originals = new Map(), cache = new Map(), pageRequests = new Map();
  const media = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const q = (s, parent = document) => parent.querySelector(s);
  const qa = (s, parent = document) => [...parent.querySelectorAll(s)];
  const own = (node) => { node.dataset.nsuOwned = ''; return node; };
  const text = (node) => (node?.textContent || '').trim();
  function el(tag, cls = '', value = '') {
    const node = document.createElement(tag); if (cls) node.className = cls;
    if (value) node.textContent = value; return node;
  }
  function icon(name) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('aria-hidden', 'true');
    node.classList.add('nsu-icon'); node.innerHTML = ICONS[name] || ICONS.eye; return node;
  }
  function button(label, handler, cls = 'nsu-button', glyph = '') {
    const node = el('button', cls); node.type = 'button'; node.setAttribute('aria-label', label); node.title = label.replace('（本地）', '');
    if (glyph) node.append(icon(glyph)); const span = el('span', '', label); node.append(span);
    node.addEventListener('click', handler); return node;
  }
  function listen(target, type, handler, options = {}) {
    target?.addEventListener(type, handler, { ...options, signal: runtime.signal });
  }
  function changeAttr(node, name, value) {
    if (!node) return;
    if (!originals.has(node)) originals.set(node, new Map());
    const attrs = originals.get(node); if (!attrs.has(name)) attrs.set(name, node.getAttribute(name));
    if (value === null) node.removeAttribute(name); else node.setAttribute(name, value);
  }
  function safeURL(value, base = location.href) {
    try { const url = new URL(value, base); return /^(https?:)$/.test(url.protocol) ? url : null; } catch { return null; }
  }
  function postInfo(value = location.href) {
    const url = safeURL(value); const match = url?.pathname.match(/^\/post-(\d+)-(\d+)\/?$/);
    return match ? { id: match[1], page: Number(match[2]), floor: url.hash.slice(1), url } : null;
  }
  function canonical(value) { const post = postInfo(value); return post ? `${post.url.origin}/post-${post.id}-1` : null; }
  function postTitle() { return text(q('.post-title-link')) || document.title; }
  function nativeRows() { return qa('.post-list:not(.topic-carousel-panel) > .post-list-item'); }
  function comments() { return qa('.comments .content-item'); }
  function floorNode(floor) { return qa('.content-item[id]').find(node => node.id === String(floor)); }
  function authorOf(node) { return q('.author-name', node)?.getAttribute('href') || q('.info-author a', node)?.getAttribute('href') || ''; }
  function settingsClean(raw) {
    const next = { ...DEFAULTS };
    if (!raw || typeof raw !== 'object') return next;
    for (const key of ['ctrlEnterSend', 'enabled', 'quiet', 'signatures', 'history', 'continuous', 'infiniteFeed', 'userDetails', 'showCreditScore', 'showHeaderNav', 'nested', 'showLevel', 'showJoined', 'showPosts', 'showComments', 'showCoin', 'showFans', 'showStardust']) if (typeof raw[key] === 'boolean') next[key] = raw[key];
    if (['light', 'dark', 'system'].includes(raw.theme)) next.theme = raw.theme;
    if (['waterlilies', 'garden', 'mist', 'green', 'soft'].includes(raw.palette)) next.palette = raw.palette;
    if (['badge', 'title', 'none'].includes(raw.readStyle)) next.readStyle = raw.readStyle;
    if (['comfortable', 'compact'].includes(raw.density)) next.density = raw.density;
    if ([15, 16, 17, 18, 19, 20].includes(Number(raw.fontSize))) next.fontSize = Number(raw.fontSize);
    return next;
  }
  const storage = {
    async get(key) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(key); return result[key];
        }
        return JSON.parse(localStorage.getItem(key) || 'null');
      } catch { return null; }
    },
    async set(key, value) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) await chrome.storage.local.set({ [key]: value });
        else localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch { toast('本地存储不可用；这次更改可能不会保存'); return false; }
    }
  };
  function libraryClean(raw) {
    const items = values => (Array.isArray(values) ? values : []).filter(item => item && typeof item.title === 'string' && canonical(item.url) && safeURL(item.url)?.origin === location.origin).slice(0, 200).map(item => ({
      url: canonical(item.url), title: item.title.slice(0, 300), time: Number(item.time) || Date.now(), category: String(item.category || '').slice(0, 50)
    }));
    const next = { saved: items(raw?.saved), recent: items(raw?.recent), progress: {} };
    if (raw?.progress && typeof raw.progress === 'object') {
      for (const [id, entry] of Object.entries(raw.progress).slice(-200)) {
        if (/^\d+$/.test(id) && entry && Number.isFinite(entry.y)) next.progress[id] = {
          y: Math.max(0, entry.y), floor: /^\d+$/.test(entry.floor) ? entry.floor : '', page: Math.max(1, Math.min(100000, Number(entry.page) || 1)), time: Number(entry.time) || 0
        };
      }
    }
    return next;
  }
  function acceptLibrary(raw) {
    if (dataDirty) return;
    library = libraryClean(raw);
    if (enabled && pageType === 'feed') { for (const row of nativeRows()) enhanceRow(row); filterFeed(); }
  }
  async function syncLibrary() {
    await writeQueue;
    if (!dataDirty) acceptLibrary(await storage.get(libraryKey));
  }
  function saveLibrary(immediate = false) {
    dataDirty = true; clearTimeout(dataWriteTimer);
    const flush = () => {
      if (!dataDirty) return; dataDirty = false;
      const snapshot = JSON.parse(JSON.stringify(library));
      writeQueue = writeQueue.then(() => storage.set(libraryKey, snapshot));
    };
    if (immediate) flush(); else dataWriteTimer = setTimeout(flush, 350);
  }
  function setSettings(patch) {
    settings = settingsClean({ ...settings, ...patch });
    // Layout and scroll correction must stay in one task, before any paint/storage await.
    if (!settings.enabled) disable();
    else if (!enabled) enable(); else refresh();
    return storage.set('nsu.settings', settings);
  }
  function toast(message) {
    if (!enabled) return;
    let node = q('#nsu-toast'); if (!node) { node = own(el('div')); node.id = 'nsu-toast'; node.setAttribute('role', 'status'); document.body.append(node); }
    node.textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => node.remove(), 3000);
  }
  function applySettings() {
    root.dataset.nsuEnabled = 'true'; root.dataset.nsuTheme = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
    root.dataset.nsuSpace = String(/^\/space\/\d+\/?$/.test(location.pathname));
    root.dataset.nsuLucky = String(/^\/lucky\/?$/.test(location.pathname));
    root.dataset.nsuPalette = settings.palette; root.dataset.nsuDensity = settings.density; root.dataset.nsuFocus = String(focusMode);
    root.dataset.nsuContinuous = String(settings.continuous);
    root.dataset.nsuInfiniteFeed = String(settings.infiniteFeed);
    root.dataset.nsuQuiet = String(settings.quiet); root.dataset.nsuHeaderNav = String(settings.showHeaderNav);
    root.dataset.nsuNested = String(settings.nested);
    const mode = q('#nsu-discussion-mode');
    if (mode) { mode.lastChild.textContent = settings.nested ? '嵌套讨论' : '按时间浏览'; mode.setAttribute('aria-pressed', String(settings.nested)); mode.setAttribute('aria-label', settings.nested ? '切换为按时间浏览' : '切换为嵌套讨论'); mode.title = mode.getAttribute('aria-label'); }
    if (!settings.nested) stopInlineContexts();
    if (pageType === 'post') { if (settings.continuous) initStream(); else stopStream(true); }
    if (pageType === 'feed') { if (settings.infiniteFeed) initStream(); else stopStream(true); }
    root.style.setProperty('--nsu-font-size', `${settings.fontSize}px`);
    document.body.dataset.nsuPage = pageType; root.dataset.nsuPage = pageType;
    for (const node of qa('#nsk-right-panel-container > .nsk-panel:not(.quick-access)')) {
      if (settings.quiet) node.dataset.nsuNoiseHidden = ''; else delete node.dataset.nsuNoiseHidden;
    }
    for (const node of qa('#nsk-right-panel-container > *')) {
      if (pageType === 'post' && settings.quiet) node.dataset.nsuNoiseHidden = '';
      else if (!node.matches('.nsk-panel:not(.quick-access)') || !settings.quiet) delete node.dataset.nsuNoiseHidden;
    }
    qa('.signature').forEach(node => {
      const toggle = q('.nsu-signature-toggle', node.closest('.content-item') || node.parentElement);
      const actions = q('.nsu-content-actions', node.closest('.content-item') || node.parentElement);
      if (toggle && actions && toggle.parentElement !== actions) actions.append(toggle);
      if (settings.signatures) {
        if (!toggle) {
          node.classList.add('nsu-signature-collapsed');
          const control = own(button('展开签名', () => { const collapsed = node.classList.toggle('nsu-signature-collapsed'); control.textContent = collapsed ? '展开签名' : '收起签名'; control.setAttribute('aria-expanded', String(!collapsed)); }, 'nsu-signature-toggle'));
          control.setAttribute('aria-expanded', 'false');
          if (actions) actions.append(control); else node.before(control);
        }
      } else { node.classList.remove('nsu-signature-collapsed'); toggle?.remove(); }
    });
    if (!settings.showCreditScore) qa('.nsu-credit-score').forEach(node => node.remove());
    if (!settings.userDetails) qa('.nsu-user-tenure').forEach(node => node.remove());
    if (!profilesWanted()) { stopProfiles(); qa('.nsu-user-tenure,.nsu-credit-score').forEach(node => node.remove()); }
    else if (pageType === 'post') initProfileObserver();
  }
  function initHeader() {
    const head = q('#nsk-head'); if (!head) return;
    const previous = q('#nsu-header-actions');
    if (previous && q('button[aria-label="稍后读"]', previous)) previous.remove();
    else if (previous) return;
    const actions = own(el('div')); actions.id = 'nsu-header-actions';
    const mobile = button('分类导航', () => {
      const open = root.dataset.nsuMobileNav !== 'true'; root.dataset.nsuMobileNav = String(open);
      mobile.setAttribute('aria-expanded', String(open));
      if (open && innerWidth <= 800) q('.nsu-side-link')?.focus();
    }, 'nsu-header-button', 'menu');
    mobile.setAttribute('aria-expanded', 'false'); mobile.setAttribute('aria-controls', 'nsk-left-panel-container');
    const pref = button('阅读设置', showSettings, 'nsu-header-button', 'settings'); pref.lastChild.className = 'nsu-header-label';
    actions.append(mobile, pref); head.append(actions);
    const search = q('#search-site2');
    changeAttr(search, 'placeholder', '搜索论坛…'); changeAttr(search, 'aria-label', '原站论坛搜索');
    changeAttr(search, 'title', '搜索');
    for (const node of qa('.sorter a')) accessibleNative(node, text(node));
  }
  function syncMessages() {
    const actions = q('#nsu-header-actions'); if (!actions) return;
    // Only the signed-in account rail, never an author's hover card.
    const card = q('#nsk-right-panel-container .user-card:not(.hover-user-card)');
    const loggedIn = card && q('.Username[href^="/space/"]', card);
    let nav = q('#nsu-messages');
    // Avoid duplicating the account card on the home feed; keep the header entry on narrow screens.
    const homeFeed = location.pathname === '/' || /^\/page-\d+/.test(location.pathname);
    const cardVisible = card && card.getClientRects().length > 0 && getComputedStyle(card).visibility !== 'hidden';
    if (homeFeed && cardVisible) { nav?.remove(); return; }
    if (!loggedIn) { nav?.remove(); return; }
    if (!nav) {
      nav = own(el('nav', 'nsu-messages')); nav.id = 'nsu-messages'; nav.setAttribute('aria-label', '消息');
      const notifications = el('a', 'nsu-header-button'); notifications.id = 'nsu-notifications'; notifications.href = '/notification#/reply';
      notifications.append(icon('bell'), el('span', 'nsu-header-label', '消息'), el('span', 'nsu-unread'));
      nav.append(notifications); actions.insertBefore(nav, actions.lastChild);
    }
    const native = qa('a[href]', card).find(link => { const url = safeURL(link.href); return url?.origin === location.origin && url.pathname === '/notification' && !url.hash && /通知\s*\d+\s*$/.test(text(link)); });
    const match = native && text(native).match(/通知\s*(\d+)\s*$/);
    const count = match ? Number(match[1]) : null;
    const link = q('#nsu-notifications'), badge = q('.nsu-unread', link);
    badge.hidden = !Number.isSafeInteger(count) || count <= 0;
    badge.textContent = count > 99 ? '99+' : count > 0 ? String(count) : '';
    link.setAttribute('aria-label', count === null ? '消息，综合未读数量暂不可用' : count > 0 ? `消息，${count} 条综合未读` : '消息，暂无未读');
    link.title = '消息';
  }
  let currentIdentity = null;
  function closeAccountMenu() {
    const panel = q('#nsu-account-panel'); if (panel) panel.hidden = true;
    q('#nsu-account-trigger')?.setAttribute('aria-expanded', 'false');
  }
  function syncAccountMenu() {
    const actions = q('#nsu-header-actions'); if (!actions) return;
    let identity = q('.user-card:not(.hover-user-card) .Username[href^="/space/"]');
    if (!identity && currentIdentity) { identity = el('a','',currentIdentity.name); identity.href = '/space/'+currentIdentity.id; }
    const card = identity?.closest('.user-card');
    const visible = card && card.getClientRects().length && getComputedStyle(card).visibility !== 'hidden';
    const home = location.pathname === '/' || /^\/page-\d+/.test(location.pathname);
    if (!identity || (home && visible)) { q('#nsu-account')?.remove(); return; }
    if (q('#nsu-account')) return;
    const url = safeURL(identity.href); if (!url || url.origin !== location.origin) return;
    const wrapper = own(el('div')); wrapper.id = 'nsu-account';
    const trigger = button('我的账户', () => {
      panel.hidden = !panel.hidden; trigger.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) q('a', panel)?.focus();
    }, 'nsu-header-button'); trigger.id = 'nsu-account-trigger'; trigger.replaceChildren();
    const nativeImage = card && q('.user-head img', card), src = safeURL(nativeImage?.src || (currentIdentity ? `/avatar/${currentIdentity.id}.png` : ''));
    if (src?.origin === location.origin) { const image = el('img'); image.src = src.href; image.alt = ''; trigger.append(image); } else trigger.textContent = text(identity).slice(0,1);
    trigger.setAttribute('aria-expanded','false'); trigger.setAttribute('aria-controls','nsu-account-panel');
    const panel = el('nav'); panel.id = 'nsu-account-panel'; panel.hidden = true; panel.setAttribute('aria-label','我的账户');
    for (const [label,href] of [[text(identity),url.pathname],['我的主题',url.pathname+'#/discussions'],['我的回复',url.pathname+'#/comments'],['原站收藏',url.pathname+'#/collections'],['账户设置','/setting']]) {
      const link = el('a','',label); link.href = href; panel.append(link);
    }
    wrapper.append(trigger,panel); actions.append(wrapper);
    listen(document,'click',event=>{if(!wrapper.contains(event.target))closeAccountMenu();});
    listen(wrapper,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeAccountMenu();trigger.focus();}});
    listen(wrapper,'focusout',event=>{if(!wrapper.contains(event.relatedTarget))closeAccountMenu();});
  }
  let rulingObserver = null, rulingFilter = '';
  function rulingPreset() {
    try { return new URLSearchParams(location.hash.split('?')[1] || '').get('nsuUser') || ''; } catch { return ''; }
  }
  function filterRulingRows() {
    const panel = q('.ruling-log'); if (!panel) return;
    const rows = qa('table tbody tr', panel), query = rulingFilter.trim().toLocaleLowerCase();
    let visible = 0;
    for (const row of rows) {
      const matched = !query || text(row).toLocaleLowerCase().includes(query);
      row.classList.toggle('nsu-ruling-filtered', !matched); if (matched) visible++;
    }
    const status = q('#nsu-ruling-status');
    const label = query ? `本页匹配 ${visible} / ${rows.length} 条` : '';
    if (status && status.textContent !== label) status.textContent = label;
  }
  function initRulingPage() {
    if (location.pathname !== '/ruling') return;
    const panel = q('.ruling-log'); if (!panel) return;
    root.dataset.nsuRuling = 'true';
    if (!q('#nsu-ruling-tools')) {
      rulingFilter = rulingPreset().slice(0,100);
      const tools = own(el('div','nsu-ruling-tools')); tools.id = 'nsu-ruling-tools';
      const heading = el('h1','','管理记录');
      const home = el('a','nsu-button','全部讨论'); home.href = '/';
      const form = el('form','nsu-ruling-filter'); form.setAttribute('role','search'); form.setAttribute('aria-label','筛选本页管理记录');
      const input = el('input','nsu-input'); input.type='search'; input.maxLength=100; input.placeholder='用户名或记录内容（本页）'; input.setAttribute('aria-label','筛选本页记录'); input.value=rulingFilter;
      const clear = button('清除',()=>{input.value='';rulingFilter='';filterRulingRows();input.focus();});
      const status = el('span',''); status.id='nsu-ruling-status'; status.setAttribute('role','status');
      form.append(input,clear,status); tools.append(heading,form,home); panel.prepend(tools);
      listen(form,'submit',event=>{event.preventDefault();rulingFilter=input.value;filterRulingRows();});
      listen(input,'input',()=>{rulingFilter=input.value;filterRulingRows();});
      listen(window,'hashchange',()=>{const preset=rulingPreset();if(preset){rulingFilter=preset.slice(0,100);input.value=rulingFilter;}filterRulingRows();});
    }
    if (!rulingObserver) {
      rulingObserver = new MutationObserver(records=>{
        if(records.some(r=>!r.target.closest?.('[data-nsu-owned]') && (r.type==='childList'||r.type==='characterData'))) filterRulingRows();
      });
      rulingObserver.observe(panel,{childList:true,subtree:true,characterData:true});
      runtime.signal.addEventListener('abort',()=>{rulingObserver?.disconnect();rulingObserver=null;},{once:true});
    }
    filterRulingRows();
  }
  function messageOrigin() {
    try {
      const entry = JSON.parse(sessionStorage.getItem('nsu.messageOrigin') || 'null'), url = safeURL(entry?.url);
      return url?.origin === location.origin && url.pathname !== '/notification' && /^(\/post-\d+-\d+|\/categories\/|\/page-\d+|\/$)/.test(url.pathname) && Date.now() - entry.time < 86400000 ? entry : null;
    } catch { return null; }
  }
  function toggleFocus() {
    const grid = q('#nsk-body');
    if (!focusMode && grid) {
      root.style.setProperty('--nsu-focus-columns', getComputedStyle(grid).gridTemplateColumns);
      root.style.setProperty('--nsu-focus-column', getComputedStyle(q('#nsk-body-left')).gridColumn);
    }
    focusMode = !focusMode; root.dataset.nsuFocus = String(focusMode);
    let exit = q('#nsu-exit-focus');
    if (focusMode && !exit) {
      exit = own(button('退出专注', () => { toggleFocus(); const control = q('[data-nsu-focus-control]'); control?.setAttribute('aria-pressed','false'); control?.focus({preventScroll:true}); }, 'nsu-button'));
      exit.id = 'nsu-exit-focus'; document.body.append(exit);
    } else if (!focusMode) exit?.remove();
  }
  function initMessagePage() {
    if (location.pathname !== '/notification') return;
    if (!location.hash || location.hash === '#/' || location.hash === '#') location.replace(`${location.pathname}${location.search}#/reply`);
    else if (location.hash === '#/message' || location.hash === '#/message/') location.replace(`${location.pathname}${location.search}#/message?mode=list`);
    const main = q('#nsk-body-left') || q('#nsk-body') || q('#nsk-frame'); if (!main || q('#nsu-message-navigation')) return;
    const bar = own(el('nav', 'nsu-reading-actions')); bar.id = 'nsu-message-navigation'; bar.setAttribute('aria-label', '消息页面导航');
    const origin = messageOrigin();
    if (origin) {
      const back = el('a', 'nsu-button', postInfo(origin.url) ? '返回刚才的帖子' : '返回刚才的列表'); back.href = origin.url;
      back.addEventListener('click', () => { try { sessionStorage.setItem('nsu.messageReturn', JSON.stringify(origin)); } catch {} }); bar.append(back);
    }
    const home = el('a', 'nsu-button', '全部讨论'); home.href = '/'; bar.append(home);
    main.prepend(bar);
  }
  function initMessageReturn() {
    listen(document, 'click', event => {
      const link = event.target.closest?.('a[href]'), url = link && safeURL(link.href);
      if (location.pathname === '/notification' || url?.origin !== location.origin || url.pathname !== '/notification') return;
      if (!postInfo() && pageType !== 'feed') return;
      try { sessionStorage.setItem('nsu.messageOrigin', JSON.stringify({url:location.href,y:scrollY,time:Date.now()})); } catch {}
    }, { capture: true });
    if (location.pathname === '/notification') return;
    try {
      const entry = JSON.parse(sessionStorage.getItem('nsu.messageReturn') || 'null');
      if (entry?.url === location.href && Number.isFinite(entry.y) && Date.now()-entry.time < 86400000) {
        sessionStorage.removeItem('nsu.messageReturn'); requestAnimationFrame(() => requestAnimationFrame(() => scrollTo({top:Math.max(0,entry.y),behavior:'instant'})));
      }
    } catch {}
  }
  function observeMessages() {
    const rail = q('#nsk-right-panel-container'); if (!rail || messageObserver) return;
    messageObserver = new MutationObserver(syncMessages);
    messageObserver.observe(rail, { childList: true, subtree: true, characterData: true });
  }
  function initSidebar() {
    const side = q('.category-list'); if (!side || q('.nsu-side-heading', side)) return;
    const nav = own(el('nav')); nav.setAttribute('aria-label', '个人导航');
    const home = el('a', 'nsu-side-link'); home.href = '/'; home.append(icon('home'), el('span', '', '全部讨论'));
    if (location.pathname === '/' || /^\/page-/.test(location.pathname)) home.setAttribute('aria-current', 'page');
    nav.append(home, button('稍后读', () => { root.dataset.nsuMobileNav = 'false'; q('[aria-controls="nsk-left-panel-container"]')?.setAttribute('aria-expanded', 'false'); showLibrary('saved'); }, 'nsu-side-link', 'bookmark'), button('最近阅读', () => showLibrary('recent'), 'nsu-side-link', 'clock'));
    const label = own(el('div', 'nsu-side-heading', '发现社区')); side.prepend(nav, label);
    for (const link of qa('li a', side)) if (new URL(link.href).pathname === location.pathname) changeAttr(link, 'aria-current', 'page');
    listen(side, 'click', event => { if (event.target.closest('a')) root.dataset.nsuMobileNav = 'false'; });
  }
  function initFeed() {
    const main = q('#nsk-body-left'); if (!nativeRows().length || !main) return;
    if (!q('#nsu-feed-toolbar')) {
      const toolbar = own(el('section')); toolbar.id = 'nsu-feed-toolbar';
      const category = qa('.category-list li a').find(a => new URL(a.href).pathname === location.pathname);
      toolbar.setAttribute('aria-label', category ? `${text(category)}讨论筛选` : '讨论筛选');
      const controls = el('div', 'nsu-feed-controls');
      const search = el('input', 'nsu-feed-search'); search.type = 'search'; search.placeholder = '筛选当前页的标题、作者…'; search.setAttribute('aria-label', '筛选当前页帖子');
      search.addEventListener('input', () => { feedQuery = search.value.trim().toLocaleLowerCase(); filterFeed(); });
      const unread = button('只看未读', () => { unreadOnly = !unreadOnly; unread.setAttribute('aria-pressed', String(unreadOnly)); filterFeed(); }); unread.setAttribute('aria-pressed', 'false');
      controls.append(search, unread);
      const status = el('div', 'nsu-filter-status'); status.id = 'nsu-feed-status'; status.setAttribute('role', 'status');
      toolbar.append(controls, status); const controller = q('.post-list-controler', main); if (controller) controller.prepend(toolbar); else main.prepend(toolbar);
    }
    for (const row of nativeRows()) enhanceRow(row);
    filterFeed();
  }
  function enhanceRow(row) {
    const link = q('.post-title > a[href]', row); const url = canonical(link?.href); if (!url) return;
    if (!q('.nsu-save-button', row)) {
      const save = own(button('加入稍后读（本地）', () => toggleSave({ url, title: text(link), category: text(q('.post-category', row)) }), 'nsu-save-button', 'bookmark'));
      save.lastChild.remove(); save.dataset.nsuPostUrl = url; row.append(save);
    }
    const read = library.recent.some(item => item.url === url);
    let badge = q('.nsu-read-badge', row);
    if (read && settings.history && settings.readStyle === 'badge' && !badge) { badge = own(el('span', 'nsu-read-badge', '读过')); q('.post-title', row)?.append(badge); }
    if ((!read || !settings.history || settings.readStyle !== 'badge') && badge) badge.remove();
    row.dataset.nsuRead = String(read);
    if (read && settings.history && settings.readStyle === 'title') link.dataset.nsuReadTitle = '';
    else delete link.dataset.nsuReadTitle;
    const saved = library.saved.some(item => item.url === url); const control = q('.nsu-save-button', row);
    control?.setAttribute('aria-pressed', String(saved)); control?.setAttribute('aria-label', saved ? '移出稍后读（本地）' : '加入稍后读（本地）');
    if (control) control.title = saved ? '移出稍后读' : '加入稍后读';
  }
  function filterFeed() {
    const rows = nativeRows(); let visible = 0;
    rows.forEach(row => { const hide = (unreadOnly && row.dataset.nsuRead === 'true') || (feedQuery && !text(q('.post-list-content', row)).toLocaleLowerCase().includes(feedQuery)); row.classList.toggle('nsu-row-hidden', Boolean(hide)); if (!hide) visible++; });
    const status = q('#nsu-feed-status'); if (status) status.textContent = feedQuery || unreadOnly ? `已加载内容显示 ${visible} / ${rows.length} 条 · 不会搜索未加载的页面` : '';
    let empty = q('#nsu-feed-empty'); if (!visible && rows.length && !empty) { empty = own(el('div', 'nsu-empty', '当前页没有匹配内容。清空筛选，或使用顶部 Google 搜索。')); empty.id = 'nsu-feed-empty'; q('.post-list:not(.topic-carousel-panel)')?.after(empty); }
    if (visible) empty?.remove();
  }
  function toggleSave(item) {
    const index = library.saved.findIndex(entry => entry.url === item.url);
    if (index >= 0) library.saved.splice(index, 1); else library.saved.unshift({ ...item, title: item.title.slice(0, 300), time: Date.now() });
    library.saved = library.saved.slice(0, 200); saveLibrary(true); updateSaveButtons(); toast(index >= 0 ? '已移出稍后读' : '已加入本地稍后读');
  }
  function updateSaveButtons() {
    qa('[data-nsu-post-url]').forEach(node => {
      const saved = library.saved.some(item => item.url === node.dataset.nsuPostUrl); node.setAttribute('aria-pressed', String(saved));
      if (node.classList.contains('nsu-save-button')) { node.setAttribute('aria-label', saved ? '移出稍后读（本地）' : '加入稍后读（本地）'); node.title = saved ? '移出稍后读' : '加入稍后读'; }
      else node.lastChild.textContent = saved ? '已存稍后读' : '稍后读';
    });
  }
  function accessibleNative(node, label) {
    if (node.dataset.nsuAccessible !== undefined) return;
    node.dataset.nsuAccessible = '';
    if (!node.matches('button,a[href],input,select,textarea')) {
      changeAttr(node, 'tabindex', '0'); changeAttr(node, 'role', 'button'); changeAttr(node, 'aria-label', label);
      listen(node, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click(); } });
    }
  }
  function initPost() {
    const info = postInfo(); if (!q('.nsk-post-wrapper') || !info) return;
    const main = q('#nsk-body-left');
    if (!q('#nsu-reading-toolbar')) {
      const bar = own(el('div')); bar.id = 'nsu-reading-toolbar'; const actions = el('div', 'nsu-reading-actions');
      const saved = button('稍后读', () => toggleSave({ url: canonical(location.href), title: postTitle(), category: text(q('.content-category a')) }), 'nsu-button', 'bookmark'); saved.dataset.nsuPostUrl = canonical(location.href);
      const filter = button('只看楼主', () => {
        const poster = floorNode('0')?.querySelector('.author-name') || q('.content-item .is-poster')?.closest('.content-item')?.querySelector('.author-name');
        if (!poster) { toast('当前已加载内容没有楼主信息，请先回到原帖正文'); return; }
        authorFilter = authorFilter ? '' : poster.getAttribute('href'); filter.setAttribute('aria-pressed', String(Boolean(authorFilter))); applyAuthorFilter();
      }); filter.setAttribute('aria-pressed', 'false'); filter.id = 'nsu-author-filter';
      const focus = button('专注阅读', () => { toggleFocus(); focus.setAttribute('aria-pressed', String(focusMode)); }, 'nsu-button', 'eye'); focus.setAttribute('aria-pressed', 'false'); focus.dataset.nsuFocusControl = '';
      const layout = button('嵌套讨论', () => {
        const anchor = comments().map(node => ({ node, top: q(':scope > .nsk-content-meta-info', node)?.getBoundingClientRect().top }))
          .filter(item => item.top >= 135 && item.top < innerHeight).sort((a, b) => a.top - b.top)[0];
        const y = scrollY;
        root.dataset.nsuSwitching = 'true';
        setSettings({ nested: !settings.nested });
        const top = anchor && q(':scope > .nsk-content-meta-info', anchor.node)?.getBoundingClientRect().top;
        scrollTo({ top: Number.isFinite(top) ? y + top - anchor.top : y, behavior: 'instant' });
        requestAnimationFrame(() => { delete root.dataset.nsuSwitching; });
      }, 'nsu-button'); layout.id = 'nsu-discussion-mode';
      actions.append(saved, filter, layout, focus);
      bar.append(actions); main?.prepend(bar);
      const status = own(el('div', 'nsu-filter-status')); status.id = 'nsu-comment-status'; status.setAttribute('role', 'status'); bar.append(status);
      const previous = library.progress[info.id];
      if (settings.history && previous && (previous.y > 250 || previous.floor) && !location.hash) {
        const resume = own(el('div', 'nsu-resume')); resume.id = 'nsu-resume';
        resume.append(el('span', '', '上次的阅读位置已记住'), button('继续阅读', () => {
          if (previous.page !== info.page) location.assign(`/post-${info.id}-${previous.page}${previous.floor ? `#${previous.floor}` : ''}`);
          else { const target = previous.floor && floorNode(previous.floor); if (target) jumpTo(target); else scrollTo({ top: previous.y, behavior: motion() }); resume.remove(); }
        })); bar.after(resume);
      }
      if (settings.history) {
        const url = canonical(location.href); library.recent = [{ url, title: postTitle().slice(0, 300), time: Date.now(), category: '' }, ...library.recent.filter(item => item.url !== url)].slice(0, 200); saveLibrary();
      }
    }
    // Anchor inside the actual site header: no guessed viewport offset or body containing block.
    const header = q('#nsk-head')?.closest('header');
    if (header?.parentElement === document.body) {
      let progress = q('#nsu-progress');
      if (!progress) { progress = own(el('div')); progress.id = 'nsu-progress'; progress.setAttribute('aria-hidden','true'); }
      if (progress.parentElement !== header) header.append(progress);
    }
    qa('.content-item').forEach(enhanceComment);
    if (!threadSlots.size) classifyHotComments(); buildThreads(); applyAuthorFilter(); updateSaveButtons(); onScroll();
    if (location.hash && !window.__NSU_ANCHOR_ALIGNED__) {
      const target = floorNode(decodeURIComponent(location.hash.slice(1)));
      if (target) { window.__NSU_ANCHOR_ALIGNED__ = true; requestAnimationFrame(() => target.scrollIntoView({ block: 'start' })); }
    }
  }
  function classifyHotComments() {
    const list = comments(); const floors = list.map(node => Number(node.id)).filter(Number.isFinite);
    let start = 0; while (start < floors.length - 1 && floors[start] > Math.min(...floors.slice(start + 1))) { list[start]?.classList.add('nsu-hot-comment'); start++; }
  }
  function enhanceComment(node) {
    const menu = q(':scope > .comment-menu', node);
    const opening = node.id === '0' || node.hasAttribute('data-nsu-opening') || node.parentElement?.classList.contains('nsk-post');
    const actions = menu && q(':scope > .nsu-content-actions', menu);
    if (opening) {
      // The opening post is not a reply. Keep signature controls and all native actions.
      if (actions) {
        q(':scope > button[aria-label="复制这条回复的链接"]', actions)?.remove();
        if (!actions.children.length) actions.remove();
      }
    } else if (menu && !actions) {
      const controls = own(el('div', 'nsu-content-actions'));
      controls.append(button('复制这条回复的链接', () => copyText(commentURL(node)), 'nsu-copy-link', 'link')); menu.prepend(controls);
    }
    for (const action of qa('.comment-menu .menu-item', node)) accessibleNative(action, action.title || text(action));
    const article = q('.post-content', node); if (!article) return;
    for (const pre of qa('pre', article)) {
      if (q('.nsu-copy-code', pre)) continue;
      const control = own(button('复制代码', () => copyText(text(q('code', pre)) || [...pre.childNodes].filter(child => !child.hasAttribute?.('data-nsu-owned')).map(child => child.textContent).join('')), 'nsu-button nsu-copy-code'));
      pre.append(control);
    }
    for (const quote of qa('blockquote', article)) {
      if (quote.dataset.nsuQuote !== undefined || text(quote).length < 220) continue;
      quote.dataset.nsuQuote = ''; quote.classList.add('nsu-quote-collapsed');
      const control = own(button('展开长引用', () => { const collapsed = quote.classList.toggle('nsu-quote-collapsed'); control.textContent = collapsed ? '展开长引用' : '收起长引用'; control.setAttribute('aria-expanded', String(!collapsed)); }, 'nsu-quote-toggle'));
      control.setAttribute('aria-expanded', 'false'); quote.after(control);
    }
    for (const link of qa('a[href]', article)) {
      const ref = postInfo(link.href), current = postInfo();
      if (!ref || !current || ref.id !== current.id || !/^\d+$/.test(ref.floor) || link.dataset.nsuReference !== undefined) continue;
      link.dataset.nsuReference = ''; changeAttr(link, 'aria-label', '查看引用的回复');
    }
    for (const img of qa('img:not(.sticker)', article)) {
      if (img.dataset.nsuImage !== undefined || img.closest('a') || /sticker|emoji|expression/i.test(img.className)) continue;
      img.dataset.nsuImage = ''; changeAttr(img, 'tabindex', '0'); changeAttr(img, 'role', 'button'); changeAttr(img, 'aria-label', `放大图片${img.alt ? `：${img.alt}` : ''}`);
      // Native images belong exclusively to the site's viewer. Only imported content lacks those handlers.
      const imported = img.closest('.content-item')?.classList.contains('nsu-loaded-comment');
      if (imported) listen(img, 'click', event => { event.preventDefault(); event.stopImmediatePropagation(); showImage(img); }, { capture: true });
      listen(img, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); img.click(); } });
    }
    const author = q('.author-name', node);
    if (author && profilesWanted()) observeProfile(node);
  }
  function directReferences(node) {
    const article = q(':scope > .post-content', node); if (!article) return [];
    const seen = new Set();
    return qa('a[href]', article).filter(link => !link.closest('blockquote,pre,code')).map(link => postInfo(link.href)).filter(ref => {
      if (!ref || ref.id !== postInfo()?.id || ref.url.origin !== location.origin || !/^\d+$/.test(ref.floor) || ref.floor === node.id || seen.has(ref.floor)) return false;
      seen.add(ref.floor); return true;
    }).slice(0, 3);
  }
  function rememberThreadPosition(node) {
    if (!threadSlots.has(node)) { const slot = document.createComment('nsu-original-comment-position'); node.before(slot); threadSlots.set(node, slot); }
  }
  function buildChronological() {
    const list = comments(); list.forEach(rememberThreadPosition);
    const anchor = q('.comments'); if (!anchor) return;
    const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
    const current = [...anchor.children].filter(item => item.classList.contains('content-item'));
    if (current.length !== sorted.length || current.some((node, index) => node !== sorted[index])) anchor.append(...sorted);
    for (const node of sorted) {
      delete node.dataset.nsuThreadParent; delete node.dataset.nsuThreadDepth;
    }
    qa('[data-nsu-thread-container],.nsu-reply-to,.nsu-inline-reference').forEach(node => node.remove());
  }
  function referenceExcerpt(node) {
    const article = q(':scope > .post-content', node) || q('.post-content', node);
    if (!article) return '';
    return text(sanitizeArticle(article, commentURL(node))).replace(/\s+/g, ' ').slice(0, 240);
  }
  function restoreThreads() {
    // Anchors remember native placement without cloning Vue nodes/handlers.
    for (const [node, slot] of threadSlots) { if (slot.parentNode) slot.after(node); slot.remove(); }
    threadSlots.clear();
    qa('[data-nsu-thread-container]').forEach(node => node.remove());
    qa('.nsu-reply-to,.nsu-inline-reference').forEach(node => node.remove());
    qa('[data-nsu-thread-parent]').forEach(node => { delete node.dataset.nsuThreadParent; delete node.dataset.nsuThreadDepth; });
    qa('.nsu-thread-context-only').forEach(node => node.classList.remove('nsu-thread-context-only'));
  }
  function buildThreads() {
    if (pageType !== 'post') return;
    if (!settings.nested) { buildChronological(); return; }
    const list = comments(), byID = new Map(list.map(node => [node.id, node])), parents = new Map();
    for (const node of list) {
      rememberThreadPosition(node);
      const refs = directReferences(node);
      // Multiple targets and bare mentions do not imply a single parent.
      if (refs.length === 1 && refs[0].floor !== '0' && byID.has(refs[0].floor)) parents.set(node, byID.get(refs[0].floor));
    }
    const depthOf = node => {
      const seen = new Set([node]); let current = node, depth = 0;
      while (parents.has(current)) { current = parents.get(current); if (seen.has(current)) return -1; seen.add(current); depth++; if (depth > 4) return depth; }
      return depth;
    };
    for (const node of list) {
      const depth = depthOf(node); let parent = parents.get(node);
      if (depth < 0 || depth > 4) parent = null;
      if (parent) {
        let children = q(':scope > [data-nsu-thread-container]', parent);
        if (!children) { children = el('ul', 'nsu-thread-children'); children.dataset.nsuThreadContainer = ''; children.setAttribute('aria-label', `回复 ${text(q('.author-name', parent))}`); parent.append(children); }
        if (node.parentElement !== children) children.append(node);
        node.dataset.nsuThreadParent = parent.id; node.dataset.nsuThreadDepth = String(depth);
      } else {
        const slot = threadSlots.get(node); if (slot?.parentNode && node.parentNode !== slot.parentNode) slot.after(node);
        delete node.dataset.nsuThreadParent; delete node.dataset.nsuThreadDepth;
      }
      const refs = directReferences(node), authorLine = q(':scope > .nsk-content-meta-info .author-info', node) || q(':scope > .author-info', node);
      let relation = authorLine && q('.nsu-reply-to', authorLine);
      if (refs.length === 1 && authorLine) {
        if (!relation) { relation = own(el('span', 'nsu-reply-to')); authorLine.append(relation); }
        const target = floorNode(refs[0].floor), name = target ? text(q('.author-name', target)) : '';
        if (relation.dataset.nsuTarget !== refs[0].url.href || relation.dataset.nsuTargetName !== name) {
          const link = el('a', '', name ? `回复 @${name}` : '回复引用内容'); link.href = refs[0].url.href;
          link.addEventListener('click', event => { const loaded = floorNode(refs[0].floor); if (loaded && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); clearAuthorFilter(); jumpTo(loaded); } });
          relation.replaceChildren(link); relation.dataset.nsuTarget = refs[0].url.href; relation.dataset.nsuTargetName = name;
        }
      } else relation?.remove();
      for (const block of qa(':scope > .nsu-inline-reference', node)) {
        const ref = refs.find(item => item.url.href === block.dataset.nsuRef);
        if (!ref || (parent && ref.floor === parent.id)) block.remove();
      }
      for (const ref of refs) {
        if (parent && ref.floor === parent.id) continue;
        let block = qa(':scope > .nsu-inline-reference', node).find(item => item.dataset.nsuRef === ref.url.href);
        if (!block) { block = own(el('div', 'nsu-inline-reference')); block.dataset.nsuRef = ref.url.href; node.insertBefore(block, q(':scope > .post-content', node)); }
        const source = floorNode(ref.floor);
        if (source) renderInlineContext(block, source, ref);
        else if (!block.childNodes.length) {
          const link = el('a', '', '引用上下文'); link.href = ref.url.href; block.append(link, el('p', '', '上下文将在进入视野后显示'));
          observeInlineContext(block);
        }
      }
    }
    for (const container of qa('[data-nsu-thread-container]')) {
      if (!container.children.length) { container.remove(); continue; }
      const children = [...container.children], sorted = [...children].sort((a, b) => Number(a.id) - Number(b.id));
      if (children.some((node, index) => node !== sorted[index])) container.append(...sorted);
    }
  }
  function renderInlineContext(block, source, ref) {
    const name = text(q('.author-name', source)) || '引用的回复', excerpt = referenceExcerpt(source);
    const signature = name + excerpt;
    if (block.dataset.nsuRendered === signature) return;
    const link = el('a', '', `↳ ${name}`); link.href = ref.url.href;
    block.replaceChildren(link, el('p', '', excerpt || '原帖中没有可提取的正文')); block.dataset.nsuRendered = signature;
  }
  function observeInlineContext(block) {
    if (!inlineObserver) inlineObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { inlineObserver.unobserve(entry.target); const ref = postInfo(entry.target.dataset.nsuRef); if (ref) queueInlineContext(entry.target, ref); }
    }, { rootMargin: '100px' });
    inlineObserver.observe(block);
  }
  function queueInlineContext(block, ref) {
    const url = new URL(ref.url); url.hash = ''; const key = url.href;
    if (!enabled || !settings.nested || inlineFailures.has(key)) { inlineUnavailable(block, ref); return; }
    if (cache.has(key)) { fillInlineContext(block, ref, cache.get(key)); return; }
    if (inlinePending.has(key)) { inlinePending.get(key).push({ block, ref }); return; }
    if (inlineRequests + inlineQueue.length >= 8) { inlineUnavailable(block, ref); return; }
    inlinePending.set(key, [{ block, ref }]); inlineQueue.push(key); runInlineContexts();
  }
  function fillInlineContext(block, ref, html) {
    if (!block.isConnected || !enabled || !settings.nested) return;
    const doc = new DOMParser().parseFromString(html, 'text/html'); const source = qa('.content-item[id]', doc).find(node => node.id === ref.floor);
    if (source) renderInlineContext(block, source, ref); else inlineUnavailable(block, ref);
  }
  function inlineUnavailable(block, ref) {
    if (!block.isConnected) return;
    const link = el('a', '', '在原帖查看引用'); link.href = ref.url.href;
    block.replaceChildren(link, el('p', '', '上下文未加载，不影响继续阅读'));
  }
  function runInlineContexts() {
    while (inlineActive < 2 && inlineQueue.length && inlineRequests < 8 && enabled && settings.nested) {
      const key = inlineQueue.shift(); inlineActive++; inlineRequests++;
      loadInlineContext(key).finally(() => { inlineActive--; runInlineContexts(); });
    }
  }
  async function loadInlineContext(key) {
    const controller = new AbortController(); inlineControllers.add(controller); const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const html = await fetchPageHTML(key, controller.signal);
      if (!enabled || !settings.nested || controller.signal.aborted) return;
      for (const { block, ref } of inlinePending.get(key) || []) fillInlineContext(block, ref, html);
    } catch {
      if (!controller.signal.aborted) { inlineFailures.add(key); for (const { block, ref } of inlinePending.get(key) || []) inlineUnavailable(block, ref); }
    } finally { clearTimeout(timeout); inlineControllers.delete(controller); inlinePending.delete(key); }
  }
  function stopInlineContexts() {
    inlineObserver?.disconnect(); inlineObserver = null;
    for (const controller of inlineControllers) controller.abort(); inlineControllers.clear(); inlineQueue = []; inlinePending.clear();
  }
  function applyAuthorFilter() {
    let visible = 0; const list = comments();
    const matches = new Set(list.filter(node => !authorFilter || authorOf(node) === authorFilter));
    for (const node of list) {
      const context = !matches.has(node) && qa('.content-item', node).some(child => matches.has(child));
      node.classList.toggle('nsu-comment-hidden', !matches.has(node) && !context);
      node.classList.toggle('nsu-thread-context-only', context);
      if (matches.has(node)) visible++;
    }
    const status = q('#nsu-comment-status'); if (status) status.textContent = authorFilter ? `仅显示该用户的已加载回复 · ${visible} / ${list.length} 条` : '';
  }
  function clearAuthorFilter() { authorFilter = ''; q('#nsu-author-filter')?.setAttribute('aria-pressed', 'false'); applyAuthorFilter(); }
  function motion() { return reducedMotion.matches ? 'instant' : 'smooth'; }
  function jumpTo(node) {
    node.scrollIntoView({ behavior: motion(), block: 'start' }); node.classList.add('nsu-anchor-highlight');
    setTimeout(() => node.classList.remove('nsu-anchor-highlight'), 1800);
  }
  function refreshEditorLayout() {
    document.dispatchEvent(new CustomEvent('nsu:editor-layout'));
  }
  function openFloatingEditor(node, source) {
    const editor = q('#editor'), native = editor && q(':scope > .md-editor', editor);
    const input = native && q('textarea:not(:disabled):not([readonly]),[contenteditable="true"]', native);
    if (!enabled || pageType !== 'post' || !editor || !native || !input || document.fullscreenElement || q('.fullscreen-editor',native)) return false;
    if (floatingEditor?.editor !== editor) closeFloatingEditor(false);
    if (!floatingEditor) {
      const placeholder = own(el('div','nsu-editor-placeholder'));
      const css = getComputedStyle(editor); placeholder.style.height = `${editor.getBoundingClientRect().height}px`; placeholder.style.margin = css.margin;
      placeholder.setAttribute('aria-hidden','true'); editor.before(placeholder);
      const header = own(el('div','nsu-composer-header')); header.id='nsu-composer-header';
      const title = el('span','nsu-composer-title'); title.setAttribute('role','status');
      const close = button('收起编辑器',()=>closeFloatingEditor(),'nsu-button'); close.lastChild.textContent='收起';
      header.append(title,el('small','','草稿保留'),close); editor.prepend(header);
      floatingEditor={editor,placeholder,header,title,previous:source||document.activeElement,originalFlag:editor.getAttribute('data-nsu-floating'),frame:0};
      editor.dataset.nsuFloating='true';
    }
    const active=floatingEditor;
    active.previous=source||document.activeElement;
    const author=text(q(':scope > .nsk-content-meta-info .author-name',node)||q(':scope > .author-info .author-name',node));
    active.title.textContent=`${node.id==='0'?'回复主帖':/^\d+$/.test(node.id)?`回复 #${node.id}`:'回复'}${author?` · @${author}`:''}`;
    cancelAnimationFrame(active.frame);
    // Capture phase only changes presentation. The original reply handler runs unmodified first.
    active.frame=requestAnimationFrame(()=>{
      if(floatingEditor!==active)return;
      refreshEditorLayout(); observer?.takeRecords();
      const focused=document.activeElement;
      if(focused===document.body || focused===active.previous || editor.contains(focused)) input.focus({preventScroll:true});
    });
    observer?.takeRecords(); return true;
  }
  function closeFloatingEditor(restoreFocus=true) {
    const active=floatingEditor; if(!active)return; floatingEditor=null;
    cancelAnimationFrame(active.frame);
    if(active.originalFlag===null)active.editor.removeAttribute('data-nsu-floating');else active.editor.setAttribute('data-nsu-floating',active.originalFlag);
    active.header.remove();active.placeholder.remove();refreshEditorLayout();observer?.takeRecords();
    if(restoreFocus&&active.previous?.isConnected)active.previous.focus({preventScroll:true});
  }
  function initFloatingReplies() {
    listen(document,'click',event=>{
      if(pageType!=='post'||event.defaultPrevented||!(event.target instanceof Element))return;
      const editorControl=event.target.closest('#editor .editor-top-button,#editor .tab-option');
      if(floatingEditor && editorControl && (editorControl.title==='全屏'||text(editorControl)==='对照')) closeFloatingEditor(false);
      const action=event.target.closest('.comment-menu .menu-item,.comment-menu button,.comment-menu [role="button"]');
      const menu=action?.closest('.comment-menu'), node=menu?.parentElement;
      if(!node?.classList.contains('content-item')||action.disabled||action.getAttribute('aria-disabled')==='true')return;
      const label=action.getAttribute('title')||action.getAttribute('aria-label')||text(action);
      if(label.trim()==='回复')openFloatingEditor(node,action);
    },{capture:true});
    listen(window,'resize',()=>{if(floatingEditor)refreshEditorLayout();},{passive:true});
    listen(document,'keydown',event=>{
      if(event.key!=='Escape'||event.defaultPrevented||dialogState||!floatingEditor||!floatingEditor.editor.contains(event.target)||q('.CodeMirror-hints'))return;
      event.preventDefault();event.stopPropagation();closeFloatingEditor();
    });
  }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); toast('已复制'); }
    catch {
      const input = own(el('textarea')); input.value = value; input.style.cssText = 'position:fixed;left:-9999px;'; document.body.append(input); input.select();
      let copied = false; try { copied = document.execCommand('copy'); } catch { /* optional compatibility fallback */ }
      input.remove(); toast(copied ? '已复制' : '复制被浏览器阻止，请手动复制');
    }
  }
  function openDialog(title, options = {}) {
    const previous = dialogState?.previous || document.activeElement; closeDialog(false);
    const backdrop = own(el('div', 'nsu-backdrop')); backdrop.id = options.lightbox ? 'nsu-lightbox' : 'nsu-dialog-backdrop';
    const dialog = el('section', 'nsu-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('tabindex', '-1'); dialog.setAttribute('aria-labelledby', 'nsu-dialog-title');
    const header = el('div', 'nsu-dialog-header'); const heading = el('h2', '', title); heading.id = 'nsu-dialog-title';
    const close = button('关闭', () => closeDialog(), 'nsu-dialog-close'); close.textContent = '×'; header.append(heading, close);
    const body = el('div', 'nsu-dialog-body'); dialog.append(header, body); backdrop.append(dialog); document.body.append(backdrop);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const controller = new AbortController(); dialogState = { backdrop, dialog, previous, overflow, controller };
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeDialog(); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog(); }
      if (event.key !== 'Tab') return;
      const controls = qa('button:not(:disabled),a[href],input:not(:disabled),select,[tabindex="0"]', dialog).filter(node => !node.hidden && node.getClientRects().length);
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    close.focus(); return { body, dialog, signal: controller.signal };
  }
  function closeDialog(restore = true) {
    if (!dialogState) return; const state = dialogState; dialogState = null; state.controller.abort(); state.backdrop.remove();
    document.body.style.overflow = state.overflow; if (restore && state.previous?.isConnected) state.previous.focus({ preventScroll: true });
  }
  function showSettings() {
    const { body, dialog } = openDialog('阅读设置'); dialog.classList.add('nsu-settings-dialog');
    body.append(el('p', 'nsu-dialog-note', '设置即时生效，仅保存在此浏览器。'));
    const grid = el('div', 'nsu-settings-grid'); let section;
    function group(key, title, description) {
      const fieldset = el('fieldset','nsu-settings-section'); fieldset.id = `nsu-settings-${key}`;
      fieldset.append(el('legend','',title));
      if (description) fieldset.append(el('p','nsu-settings-description',description));
      section = el('div','nsu-settings-items'); fieldset.append(section); grid.append(fieldset); return fieldset;
    }
    function setting(key, label, description, options) {
      const row = el('div', 'nsu-setting'); const name = el('label', '', label); name.htmlFor = `nsu-setting-${key}`;
      if (description) { const hint=el('small','',description);hint.id=`nsu-hint-${key}`;name.append(hint); }
      let input;
      if (options) { input = el('select', 'nsu-select'); for (const [value, title] of options) { const option = el('option', '', title); option.value = value; input.append(option); } input.value = String(settings[key]); }
      else { input = el('input'); input.type = 'checkbox'; input.checked = settings[key]; }
      input.id = `nsu-setting-${key}`; if(description) input.setAttribute('aria-describedby',`nsu-hint-${key}`);
      input.addEventListener('change', () => setSettings({ [key]: input.type === 'checkbox' ? input.checked : key === 'fontSize' ? Number(input.value) : input.value })); row.append(name, input); section.append(row); return row;
    }
    group('appearance','外观');
    setting('theme', '明暗模式', '', [['system', '跟随系统'], ['light', '明亮'], ['dark', '深色']]);
    setting('palette', '色彩风格', '', [['waterlilies', '标准'], ['garden', '暖纸'], ['mist', '冷灰'], ['green', '石墨'], ['soft', '柔和']]);
    const swatches = el('div', 'nsu-palette-sample'); swatches.setAttribute('aria-hidden', 'true');
    for (const name of ['bg', 'surface', 'subtle', 'accent-soft', 'accent']) { const chip = el('span'); chip.style.backgroundColor = `var(--nsu-${name})`; swatches.append(chip); }
    section.append(swatches);
    setting('density', '列表密度', '', [['comfortable', '舒适'], ['compact', '紧凑']]);
    setting('fontSize', '正文字号', '', [15, 16, 17, 18, 19, 20].map(value => [String(value), `${value} px`]));
    group('browsing','浏览与阅读');
    setting('showHeaderNav','顶部板块入口','窄屏使用分类菜单');
    setting('quiet', '精简侧栏', '帖子页隐藏右侧栏；首页收起排行和统计');
    setting('infiniteFeed', '首页连续浏览', '接近列表末尾自动加载下一页');
    setting('continuous', '评论连续阅读', '向下续读；向上自动补载更早评论，替代分页');
    setting('readStyle', '已读显示', '', [['badge', '读过标签'], ['title', '标题变灰'], ['none', '不显示']]);
    group('discussion','评论与输入');
    setting('nested', '嵌套讨论', '明确引用归入父回复；缺失上下文按需加载');
    setting('signatures', '默认折叠签名', '每条签名仍可单独展开');
    setting('ctrlEnterSend', 'Ctrl+Enter 发送', '在评论或私信输入框中发送');
    group('profiles','用户公开资料','仅查询进入视野的用户，缓存最多 6 小时；缺失数据不显示。');
    setting('userDetails', '显示用户公开资料', '控制下方统计显示，不影响独立的估分开关');
    const stats=el('div','nsu-stat-settings'); section.append(stats);const mainSection=section;section=stats;
    for (const [key, , label] of PROFILE_FIELDS) setting(key, label, '');
    section=mainSection;
    group('estimate','信用估分 · Beta','基于公开资料的实验性参考，不代表可信认证或交易保障；默认关闭。');
    setting('showCreditScore','显示信用估分','独立开关；关闭不影响等级、加入天数等公开统计');
    group('data','本地数据与恢复','记录不上传；稍后读独立于原站收藏。');
    setting('history', '记住阅读进度', '保存最近阅读与位置，可随时清除');
    const footer = el('div', 'nsu-dialog-footer');
    footer.append(button('清除阅读记录', () => { library.recent = []; library.progress = {}; saveLibrary(true); refresh(); toast('已清除本地阅读记录'); }), button('恢复默认偏好', async () => { await setSettings({ ...DEFAULTS }); showSettings(); }), button('恢复原版界面', () => setSettings({ enabled: false })));
    section.append(footer,el('p','nsu-dialog-note','恢复原版后，可从浏览器扩展图标重新开启。'));
    body.append(grid);
  }
  function showLibrary(kind) {
    const saved = kind === 'saved'; const { body } = openDialog(saved ? '稍后读' : '最近阅读');
    body.append(el('p', 'nsu-dialog-note', saved ? '这是独立的本地阅读清单，不会修改原站收藏。最多保存 200 条。' : '此浏览器的最近阅读，不会同步或上传。最多保留 200 条。'));
    const entries = library[kind]; if (!entries.length) body.append(el('div', 'nsu-empty', saved ? '遇见好内容时，点一下书签。' : '读过的帖子会出现在这里。'));
    for (const item of entries) {
      const row = el('div', 'nsu-saved-item'); const link = el('a', '', item.title); link.href = item.url;
      link.append(el('span', 'nsu-saved-meta', `${item.category ? `${item.category} · ` : ''}${new Date(item.time).toLocaleDateString()}`));
      row.append(link, button('移除', () => { library[kind] = library[kind].filter(entry => entry.url !== item.url); saveLibrary(true); updateSaveButtons(); showLibrary(kind); })); body.append(row);
    }
  }
  function sanitizeArticle(article, base, allowImages = false) {
    const clean = el('div'); const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'S', 'DEL', 'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR', 'SPAN']);
    let remaining = 20000, nodes = 0;
    function copy(source, destination, depth = 0) {
      if (++nodes > 1200 || remaining <= 0 || depth > 30) return;
      if (source.nodeType === Node.TEXT_NODE) { const value = source.textContent.slice(0, remaining); remaining -= value.length; destination.append(document.createTextNode(value)); return; }
      if (source.nodeType !== Node.ELEMENT_NODE || source.hasAttribute('data-nsu-owned') || ['SCRIPT', 'STYLE', 'IFRAME', 'FORM', 'INPUT', 'BUTTON', 'OBJECT', 'EMBED', 'SVG'].includes(source.tagName)) return;
      // Images are intentionally omitted from fetched previews: do not trigger third-party trackers.
      if (source.tagName === 'IMG') {
        const url = safeURL(source.getAttribute('src'), base);
        if (allowImages && url) { const image = el('img'); image.src = url.href; image.alt = (source.alt || '').slice(0, 200); image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; if (source.classList.contains('sticker')) image.className = 'sticker'; destination.append(image); }
        else destination.append(el('span', '', `[图片${source.alt ? `：${source.alt.slice(0, 80)}` : ''}]`)); return;
      }
      if (!allowed.has(source.tagName)) { for (const child of source.childNodes) copy(child, destination, depth + 1); return; }
      const target = el(source.tagName.toLowerCase());
      if (source.tagName === 'A') { const url = safeURL(source.getAttribute('href'), base); if (url) { target.href = url.href; target.target = '_blank'; target.rel = 'noopener noreferrer'; } }
      for (const child of source.childNodes) copy(child, target, depth + 1); destination.append(target);
    }
    for (const child of article.childNodes) copy(child, clean); return clean;
  }
  async function fetchPageHTML(key, signal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (cache.has(key)) return cache.get(key);
    let request = pageRequests.get(key);
    if (!request) {
      const controller = new AbortController();
      request = { controller, users: 0 };
      const timeout = setTimeout(() => controller.abort(), 12000);
      request.promise = (async () => {
        const response = await fetch(key, { signal: controller.signal, credentials: 'same-origin', redirect: 'error' });
        if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html') || Number(response.headers.get('content-length')) > 1500000) throw new Error('unavailable');
        const html = await response.text(); if (html.length > 1500000) throw new Error('too large');
        cache.set(key, html); if (cache.size > 5) cache.delete(cache.keys().next().value);
        return html;
      })().finally(() => { clearTimeout(timeout); if (pageRequests.get(key) === request) pageRequests.delete(key); });
      pageRequests.set(key, request);
    }
    request.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (handler, value) => {
        if (finished) return; finished = true; signal?.removeEventListener('abort', abort);
        request.users--; if (!request.users && pageRequests.get(key) === request) request.controller.abort();
        handler(value);
      };
      const abort = () => finish(reject, new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      request.promise.then(value => finish(resolve, value), error => finish(reject, error));
    });
  }
  function avatarLink(target) {
    const link = target instanceof Element && target.closest('a[href]');
    if (!link || !q('img.avatar-normal',link) || link.closest('.hover-user-card')) return null;
    const comment = link.closest('.content-item'), meta = link.closest('.nsk-content-meta-info');
    const inComment = comment && meta?.parentElement === comment && link.parentElement?.classList.contains('avatar-wrapper');
    const inFeed = link.parentElement?.classList.contains('post-list-item');
    const url = safeURL(link.getAttribute('href'));
    return (inComment || inFeed) && url?.origin === location.origin && /^\/space\/\d+\/?$/.test(url.pathname) ? link : null;
  }
  function showAvatarFallback(link) {
    const url=safeURL(link.href), node=link.closest('.content-item,.post-list-item');
    const name=text(q(':scope > .nsk-content-meta-info .author-name',node)||q('.info-author a',node)) || q('img',link)?.alt || '用户';
    const {body}=openDialog(name);
    body.append(el('p','nsu-dialog-note','原站简介面板暂不可用，可打开个人主页查看完整公开资料。'));
    const profile=el('a','nsu-button','打开个人主页');profile.href=url.href;body.append(profile);
  }
  function initAvatarCards() {
    // The site binds initial images once; use one delegated adapter for images, link padding and imported rows.
    listen(document,'click',event=>{
      if(event.defaultPrevented || event.button!==0)return;
      const link=avatarLink(event.target);if(!link)return;
      // Keep modified link navigation while skipping the site's unconditional image-only preventDefault.
      if(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey){event.stopImmediatePropagation();return;}
      const url=safeURL(link.href),uid=url.pathname.match(/^\/space\/(\d+)/)[1];
      const rect=link.getBoundingClientRect(),request=`${Date.now()}-${Math.floor(Math.random()*100000)}`;
      let opened=false;
      const result=event=>{try{const data=JSON.parse(event.detail);if(data.request===request)opened=data.ok===true;}catch{}};
      document.addEventListener('nsu:avatar-result',result);
      document.dispatchEvent(new CustomEvent('nsu:avatar-request',{detail:JSON.stringify({request,uid,left:rect.left,top:rect.top})}));
      document.removeEventListener('nsu:avatar-result',result);
      event.preventDefault();event.stopImmediatePropagation();
      if(opened)avatarCardScroll={y:scrollY};
      else showAvatarFallback(link);
    },{capture:true});
  }
  function showImage(img) {
    const src = safeURL(img.currentSrc || img.src); if (!src) { toast('图片源不支持预览，请使用原站图片'); return; }
    const { body } = openDialog(img.alt || '图片预览', { lightbox: true }); const image = el('img', 'nsu-lightbox-image'); image.alt = img.alt || '帖子图片'; image.src = src.href; body.append(image);
  }
  function readListReturn() {
    try { const entry = JSON.parse(sessionStorage.getItem('nsu.listReturn') || 'null'); const url = safeURL(entry?.url); return entry && url?.origin === location.origin && !postInfo(url.href) && Date.now() - entry.time < 3600000 ? entry : null; } catch { return null; }
  }
  function storeListReturn() {
    try { sessionStorage.setItem('nsu.listReturn', JSON.stringify({ url: `${location.origin}${location.pathname}${location.search}`, y: scrollY, time: Date.now() })); } catch { /* no persistence in private mode */ }
  }
  function initListReturn() {
    if (pageType !== 'feed') return;
    listen(document, 'click', event => { if (event.target.closest('.post-list-item .post-title a') && !event.ctrlKey && !event.metaKey) storeListReturn(); }, { capture: true });
    const back = readListReturn();
    if (back && back.url === `${location.origin}${location.pathname}${location.search}` && !location.hash && back.y > 0) {
      requestAnimationFrame(() => requestAnimationFrame(() => scrollTo({ top: back.y, behavior: 'instant' })));
      try { sessionStorage.removeItem('nsu.listReturn'); } catch { /* optional */ }
    }
  }
  function initProfileObserver() {
    if (profileObserver || !enabled || !profilesWanted()) return;
    profileObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        profileObserver.unobserve(entry.target);
        const uid = authorOf(entry.target).match(/^\/space\/(\d+)\/?$/)?.[1];
        if (uid) queueProfile(uid);
      }
    }, { rootMargin: '100px' });
  }
  function observeProfile(node) {
    const uid = authorOf(node).match(/^\/space\/(\d+)\/?$/)?.[1]; if (!uid) return;
    node.dataset.nsuProfileUid = uid;
    if (publicProfiles[uid]?.schema === 2 && Date.now() - publicProfiles[uid].time < PROFILE_TTL) { renderProfile(uid); return; }
    initProfileObserver();
    if (profileObserver && !profileObserved.has(node)) { profileObserved.add(node); profileObserver.observe(node); }
  }
  function profileClean(detail, time = Date.now()) {
    const result = { time, schema: 2 };
    for (const [, key] of PROFILE_FIELDS) {
      const value = key === 'created' ? (typeof detail.created_at === 'string' ? Date.parse(detail.created_at) : detail.created) : detail[key];
      const valid = typeof value === 'number' && Number.isFinite(value) && (key === 'created' ? value > 0 && value <= Date.now() : Number.isSafeInteger(value) && (key === 'coin' || value >= 0) && (key !== 'rank' || value <= 100));
      result[key] = valid ? value : null;
    }
    return result;
  }
  // Heuristic profile score, not a verified reputation or trading guarantee.
  function creditEstimate(info) {
    if (!['created','coin','nPost','nComment','stardust'].every(key => typeof info[key] === 'number' && Number.isFinite(info[key]))) return null;
    const days = Math.max(0, (Date.now() - info.created) / 86400000);
    const boundedLog = (value, cap) => Math.min(1, Math.log1p(Math.max(0,value)) / Math.log1p(cap));
    // Coin, rank and participation are correlated: one capped 45-point bucket, no rank bonus.
    const participation = boundedLog(5 * info.nPost + info.nComment, 5000);
    const balance = boundedLog(info.coin, 3600);
    return Math.round(45 * boundedLog(days,1825) + 45 * (0.65 * balance + 0.35 * participation) + 10 * boundedLog(info.stardust,100));
  }
  function renderProfile(uid) {
    const info = publicProfiles[uid]; if (!info || !enabled || !profilesWanted()) return;
    const fields = PROFILE_FIELDS.filter(([option, key]) => settings.userDetails && settings[option] && typeof info[key] === 'number');
    for (const node of qa(`[data-nsu-profile-uid="${uid}"]`)) {
      const line = q(':scope > .nsk-content-meta-info .author-info', node) || q(':scope > .author-info', node); if (!line) continue;
      let scoreBadge = q('.nsu-credit-score', line);
      const score = settings.showCreditScore ? creditEstimate(info) : null;
      if (score !== null) {
        if (!scoreBadge) { scoreBadge = own(el('span','nsu-credit-score')); line.append(scoreBadge); }
        const label = `≈${score}/100`;
        const explanation = `信用估分：${score}/100。基于公开资料的非官方参考，不代表可信认证或交易保障。`;
        if (scoreBadge.textContent !== label) scoreBadge.textContent = label;
        if (scoreBadge.title !== explanation) scoreBadge.title = explanation;
        if (scoreBadge.getAttribute('role') !== 'note') scoreBadge.setAttribute('role','note');
        if (scoreBadge.getAttribute('aria-label') !== explanation) scoreBadge.setAttribute('aria-label', explanation);
      } else scoreBadge?.remove();
      let badge = q('.nsu-user-tenure', line);
      if (!fields.length) { badge?.remove(); continue; }
      if (!badge) { badge = own(el('span', 'nsu-user-tenure')); line.append(badge); }
      const fingerprint = fields.map(([, key]) => `${key}:${key === 'created' ? Math.max(0, Math.floor((Date.now()-info.created)/86400000)) : info[key]}`).join('|');
      if (badge.dataset.nsuFields === fingerprint) continue;
      badge.replaceChildren(...fields.map(([, key, label]) => {
        const value = key === 'created' ? `加入 ${Math.max(0, Math.floor((Date.now()-info.created)/86400000))} 天` : key === 'rank' ? `Lv.${info.rank}` : `${label} ${info[key].toLocaleString('zh-CN')}`;
        const item = el('span', key === 'rank' ? 'nsu-level' : 'nsu-user-stat', value); item.dataset.nsuStat = key; return item;
      }));
      badge.dataset.nsuFields = fingerprint;
      badge.title = '用户资料';
    }
  }
  function queueProfile(uid) {
    if (!enabled || !profilesWanted() || profilePending.has(uid) || profileRequests >= 50 || Date.now() - (profileFailures.get(uid) || 0) < 300000) return;
    if (publicProfiles[uid]?.schema === 2 && Date.now() - publicProfiles[uid].time < PROFILE_TTL) { renderProfile(uid); return; }
    profilePending.add(uid); profileQueue.push(uid); runProfiles();
  }
  function runProfiles() {
    while (profileActive < 2 && profileQueue.length && enabled && profilesWanted() && profileRequests < 50) {
      const uid = profileQueue.shift(); profileActive++; profileRequests++;
      loadProfile(uid).finally(() => { profileActive--; profilePending.delete(uid); runProfiles(); });
    }
  }
  async function loadProfile(uid) {
    const controller = new AbortController(); profileControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // Observed read-only endpoint used by the original public /space/{id} page.
      const response = await fetch(`/api/account/getInfo/${uid}?readme=1`, { credentials: 'same-origin', signal: controller.signal, redirect: 'error' });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('json') || Number(response.headers.get('content-length')) > 300000) throw new Error('unavailable');
      const body = await response.text(); if (body.length > 300000) throw new Error('too large');
      const result = JSON.parse(body), detail = result?.detail;
      if (!result.success || String(detail?.member_id) !== uid) throw new Error('invalid public data');
      if (!enabled || !profilesWanted() || controller.signal.aborted) return;
      publicProfiles[uid] = profileClean(detail);
      publicProfiles = Object.fromEntries(Object.entries(publicProfiles).sort((a, b) => a[1].time - b[1].time).slice(-200));
      renderProfile(uid); clearTimeout(profileWriteTimer);
      profileWriteTimer = setTimeout(() => storage.set('nsu.publicProfiles', publicProfiles), 500);
    } catch { if (!controller.signal.aborted) profileFailures.set(uid, Date.now()); }
    finally { clearTimeout(timeout); profileControllers.delete(controller); }
  }
  function stopProfiles() {
    profileObserver?.disconnect(); profileObserver = null; profileObserved = new WeakSet();
    for (const controller of profileControllers) controller.abort(); profileControllers.clear();
    profileQueue = []; profilePending.clear();
  }
  function nextCommentPage(doc = document, base = location.href) {
    if (pageType === 'feed') {
      const link = q('.pager-bottom .pager-next[href], .pager-top .pager-next[href]', doc); const url = link && safeURL(link.getAttribute('href'), base);
      if (!url || url.origin !== location.origin || postInfo(url.href) || !/^\/(?:page-\d+|categories\/[a-z-]+(?:\/page-\d+)?)/.test(url.pathname)) return null;
      url.hash = ''; return url.href;
    }
    const native = q('.post-bottom-pager .pager-next[href], .post-top-pager .pager-next[href]', doc);
    const url = native && safeURL(native.getAttribute('href'), base), current = postInfo(base);
    const candidate = url && postInfo(url.href);
    if (!url || !candidate || !current || candidate.id !== current.id || candidate.page <= current.page || url.origin !== location.origin) return null;
    url.hash = ''; return url.href;
  }
  function initStream() {
    if (stream || !enabled || !runtime) return;
    const isFeed = pageType === 'feed'; const anchor = isFeed ? q('.post-list:not(.topic-carousel-panel)') : q('.comments');
    if (!anchor || (isFeed ? !settings.infiniteFeed : !settings.continuous)) return;
    const node = own(el('section', 'nsu-stream')); node.id = 'nsu-stream'; node.setAttribute('aria-label', isFeed ? '连续浏览帖子' : '连续讨论');
    const status = el('p', 'nsu-stream-status'); status.setAttribute('role', 'status');
    const load = button('继续阅读', () => { if (stream) { stream.paused = false; if (stream.pages >= stream.limit) stream.limit += MAX_STREAM_PAGES; loadNextComments(); } }, 'nsu-button');
    const fallback = el('a', 'nsu-button', '在原站页面打开');
    node.append(status, load, fallback); anchor.after(node);
    stream = { node, status, load, fallback, kind: isFeed ? 'feed' : 'post', next: nextCommentPage(), loading: false, pages: 0, limit: MAX_STREAM_PAGES, paused: false, seenPages: new Set([location.origin + location.pathname]), controller: null };
    streamObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || !stream || stream.loading || stream.paused || dialogState || floatingEditor || stream.pages >= stream.limit) return;
      if (scrollY > 80 && !document.activeElement?.closest('#editor')) loadNextComments();
    }, { rootMargin: '450px' }); streamObserver.observe(node); streamStatus();
    listen(window, 'scroll', () => {
      if (!stream || stream.node !== node || scrollY <= 80 || stream.loading || stream.paused || dialogState || floatingEditor || stream.pages >= stream.limit || document.activeElement?.closest('#editor')) return;
      const box = node.getBoundingClientRect();
      if (box.top < innerHeight + 450 && box.bottom > -450) loadNextComments();
    }, { passive: true });
  }
  function streamStatus(message = '') {
    if (!stream) return;
    const unit = stream.kind === 'feed' ? '条讨论' : '条回复'; const countItems = stream.kind === 'feed' ? nativeRows().length : comments().length;
    stream.status.textContent = message || (stream.next ? `已加载 ${countItems} ${unit} · 滚动继续阅读` : `已经读到末尾 · ${countItems} ${unit}`);
    stream.load.hidden = !stream.next || stream.loading;
    stream.load.textContent = stream.paused ? '重试加载' : stream.pages >= stream.limit ? '继续接着读' : '继续阅读';
    stream.load.setAttribute('aria-label', stream.load.textContent); stream.load.title = stream.load.textContent;
    stream.fallback.hidden = !stream.next;
    if (stream.next) stream.fallback.href = stream.next;
  }
  function importFeedRow(source, pageURL) {
    const link = q('.post-title>a', source), url = link && safeURL(link.getAttribute('href'), pageURL); if (!url) return null;
    const row = own(el('li', 'post-list-item nsu-loaded-row')); const avatarLink = q(':scope > a', source), profile = avatarLink && safeURL(avatarLink.getAttribute('href'), pageURL);
    const avatar = q('img', avatarLink || source), imageURL = avatar && safeURL(avatar.getAttribute('src'), pageURL);
    if (profile && profile.origin === location.origin && imageURL && imageURL.origin === location.origin) {
      const a = el('a'); a.href = profile.href; const image = el('img', 'avatar-normal'); image.src = imageURL.href; image.alt = (avatar.alt || '').slice(0, 100); image.loading = 'lazy'; a.append(image); row.append(a);
    }
    const content = el('div', 'post-list-content'), title = el('div', 'post-title'); const a = el('a', '', text(link)); a.href = url.href; title.append(a); content.append(title);
    const info = el('div', 'post-info');
    for (const cls of ['info-author','info-views','info-comments-count','info-last-commenter','info-last-comment-time','post-category']) {
      const original = q(`.${cls}`, source); if (!original) continue;
      const isLink = original.matches('a'); const item = el(isLink ? 'a' : 'span', `info-item ${cls}`);
      if (isLink) { const target = safeURL(original.getAttribute('href'), pageURL); if (target) item.href = target.href; }
      const originalLink = !isLink && q('a[href]', original);
      if (originalLink) { const target = safeURL(originalLink.getAttribute('href'), pageURL); const inner = el('a', '', text(originalLink)); if (target) inner.href = target.href; item.append(inner); }
      else item.textContent = text(original);
      info.append(item);
    }
    content.append(info); row.append(content); return row;
  }
  let openingBusy = false, openingController = null;
  function initOpeningPost() {
    const info = postInfo(), container = q('.nsk-post');
    if (!settings.continuous || !info || info.page <= 1 || !container || q(':scope > .content-item .post-content', container) || q('#nsu-opening-status')) return;
    const status = own(button('加载主帖', loadOpeningPost, 'nsu-button')); status.id = 'nsu-opening-status'; container.append(status);
    loadOpeningPost();
  }
  async function loadOpeningPost() {
    if (openingBusy || !enabled || !settings.continuous) return;
    const status = q('#nsu-opening-status'); if (!status) return;
    openingBusy = true; status.disabled = true;
    const controller = new AbortController(); openingController = controller;
    try {
      const url = new URL(`/post-${postInfo().id}-1`, location.origin).href;
      const html = await fetchPageHTML(url, controller.signal);
      if (controller.signal.aborted || !enabled || !settings.continuous) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const source = q('.nsk-post .content-item[id="0"]', doc);
      if (!source || !q('.post-content', source)) throw new Error('missing opening post');
      // Capture the viewport immediately before insertion, not before the network request.
      const anchor = comments().find(n => n.getBoundingClientRect().bottom > 60);
      const top = anchor?.getBoundingClientRect().top;
      const node = importComment(source, url); if (!node) throw new Error('invalid opening post');
      node.dataset.nsuOpening = ''; status.replaceWith(node); enhanceComment(node); mountImportedActions();
      if (anchor?.isConnected && Number.isFinite(top)) scrollBy({top:anchor.getBoundingClientRect().top-top,behavior:'instant'});
      observer?.takeRecords();
    } catch { if (!controller.signal.aborted) status.textContent = '重试加载主帖'; }
    finally { openingBusy = false; status.disabled = false; }
  }
  const EARLIER_BATCH_PAGES = 3, EARLIER_INITIAL_PAGES = 2;
  let earlier = null;
  function earlierStatus() {
    if (!earlier) return;
    const active = earlier;
    if (active.page < 1) { active.observer?.disconnect(); active.node.remove(); return; }
    active.status.textContent = active.busy ? '正在补载更早的评论…' : active.paused ? '未能补载：网络、权限或验证限制。' : active.pages >= active.limit ? '已补载多页，更早的评论可继续加载。' : '向上滚动自动加载更早评论';
    active.load.hidden = active.busy || (!active.paused && active.pages < active.limit);
    const label = active.paused ? '重试加载前面的评论' : '继续加载更早评论';
    active.load.textContent = label; active.load.setAttribute('aria-label', label); active.load.title = label;
    active.fallback.href = `/post-${postInfo().id}-${active.page}`;
  }
  function maybeLoadEarlier() {
    const active = earlier;
    if (!active || !active.ready || !active.upward || active.busy || active.paused || active.page < 1 || active.pages >= active.limit || dialogState || floatingEditor || document.activeElement?.closest('#editor') || !enabled || !settings.continuous) return;
    const box = active.node.getBoundingClientRect();
    if (box.top < 500 && box.bottom > -450) loadEarlierComments();
  }
  function initEarlierComments() {
    const info = postInfo(), list = q('.comments');
    if (!settings.continuous || !info || info.page <= 1 || !list || earlier) return;
    const node = own(el('section','nsu-earlier')); node.id = 'nsu-earlier'; node.setAttribute('aria-label','更早的评论');
    const status = el('span','nsu-earlier-status'); status.setAttribute('role','status');
    const load = button('继续加载更早评论',()=>{
      if (!earlier) return;
      earlier.paused = false;
      if (earlier.pages >= earlier.limit) earlier.limit += MAX_STREAM_PAGES;
      loadEarlierComments();
    },'nsu-button');
    const fallback = el('a','nsu-earlier-source','在原站打开前一页');
    node.append(status,load,fallback); list.before(node);
    earlier = {node,status,load,fallback,page:info.page-1,pages:0,limit:MAX_STREAM_PAGES,busy:false,paused:false,ready:false,upward:false,lastY:scrollY,controller:null,observer:null};
    const active = earlier;
    active.observer = new IntersectionObserver(entries=>{if(earlier===active && entries.some(e=>e.isIntersecting)) maybeLoadEarlier();},{rootMargin:'450px'});
    active.observer.observe(node);
    listen(window,'scroll',()=>{
      if (earlier !== active) return;
      const delta = scrollY - active.lastY; active.lastY = scrollY;
      if (active.busy || !active.ready) { active.upward = false; return; }
      if (Math.abs(delta) < 1) return;
      active.upward = delta < 0; if (active.upward) maybeLoadEarlier();
    },{passive:true});
    earlierStatus();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(earlier===active)loadEarlierComments(EARLIER_INITIAL_PAGES);}));
  }
  async function loadEarlierComments(count = EARLIER_BATCH_PAGES) {
    const active = earlier;
    if (!active || active.busy || active.page < 1 || !enabled || !settings.continuous) return;
    active.busy = true; active.upward = false;
    const controller = new AbortController(); active.controller = controller; earlierStatus();
    try {
      for(let i=0;i<count && active.page>=1 && active.pages<active.limit;i++) {
        const url = new URL(`/post-${postInfo().id}-${active.page}`,location.origin).href;
        const html = await fetchPageHTML(url,controller.signal);
        if (earlier !== active || controller.signal.aborted || !enabled || !settings.continuous) return;
        const doc = new DOMParser().parseFromString(html,'text/html');
        const sources = qa('.comments > .content-item[id][data-comment-id]',doc).filter(n=>/^\d+$/.test(n.id) && /^\d+$/.test(n.dataset.commentId) && q(':scope > .post-content',n));
        if (!sources.length) { cache.delete(url); throw new Error('missing comments'); }
        // The reader may have moved while awaiting the network. Anchor their current own row.
        const headerBottom = q('#nsk-head')?.closest('header')?.getBoundingClientRect().bottom || 60;
        const anchor = comments().map(n=>q(':scope > .nsk-content-meta-info',n)||q(':scope > .post-content',n)||n).find(n=>n.getClientRects().length && n.getBoundingClientRect().bottom>headerBottom);
        const top = anchor?.getBoundingClientRect().top;
        restoreThreads();
        const seen = new Set(comments().map(n=>n.dataset.commentId)), floors = new Set(comments().map(n=>n.id));
        const fragment = document.createDocumentFragment();
        for (const source of sources) if (!seen.has(source.dataset.commentId) && !floors.has(source.id)) {
          const node = importComment(source,url); if(node){fragment.append(node);seen.add(source.dataset.commentId);floors.add(source.id);}
        }
        q('.comments').prepend(fragment); active.page--; active.pages++;
        refresh(); if(stream)streamStatus(); earlierStatus();
        if(anchor?.isConnected && Number.isFinite(top))scrollBy({top:anchor.getBoundingClientRect().top-top,behavior:'instant'});
        active.lastY=scrollY; active.upward=false; observer?.takeRecords();
      }
    } catch {
      if (earlier===active && !controller.signal.aborted) active.paused=true;
    } finally {
      if (earlier===active) {
        active.busy=false; active.ready=true; active.controller=null; earlierStatus();
        active.lastY=scrollY; active.upward=false;
      }
    }
  }
  function stopEarlierComments() {
    const active = earlier; earlier = null;
    active?.controller?.abort(); active?.observer?.disconnect(); active?.node.remove();
  }
  const importedActions = new Map();
  function commentData(doc, pageURL) {
    try {
      const raw = q('#temp-script', doc)?.textContent; if (!raw || raw.length > 2000000) return new Map();
      const config = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw.trim()), c => c.charCodeAt(0))));
      if (String(config.postData?.postId) !== String(postInfo()?.id)) return new Map();
      return new Map(config.postData.comments.map(c => {
        const comment = {};
        for (const key of ['commentId','floorIndex','markdown','time','liked','disliked','upvoted','likeCount','dislikeCount','upvoteCount','pined']) comment[key] = c[key];
        comment.poster = {uid:c.poster?.uid, name:c.poster?.name, isMe:c.poster?.isMe === true};
        return [String(c.commentId), {postId:config.postData.postId,comment}];
      }));
    } catch { return new Map(); }
  }
  function mountImportedActions() {
    const pending = [...importedActions].filter(([id]) => { const n = q(`.nsu-loaded-comment[data-comment-id="${id}"]`); return n && !n.dataset.nsuNativeActions; }).map(([,value]) => value);
    if (pending.length) document.dispatchEvent(new CustomEvent('nsu:mount-comments', {detail:JSON.stringify(pending.slice(0,100))}));
  }
  function importComment(source, pageURL) {
    const data = commentData(source.ownerDocument, pageURL).get(source.dataset.commentId);
    if (data) importedActions.set(source.dataset.commentId, data);
    const node = own(el('li', 'content-item nsu-loaded-comment'));
    node.id = source.id; node.dataset.commentId = source.dataset.commentId;
    node.dataset.nsuSourceUrl = `${pageURL}#${source.id}`;
    const metadata = el('div', 'nsk-content-meta-info'); const originalAuthor = q('.author-name', source);
    const authorURL = safeURL(originalAuthor?.getAttribute('href'), pageURL);
    const image = q('.avatar-wrapper img', source), src = image && safeURL(image.getAttribute('src'), pageURL);
    if (src && src.origin === location.origin) {
      const wrapper = el('div', 'avatar-wrapper'); const profile = el('a'); if (authorURL) profile.href = authorURL.href;
      const avatar = el('img', 'avatar-normal'); avatar.src = src.href; avatar.alt = text(originalAuthor); avatar.loading = 'lazy'; profile.append(avatar); wrapper.append(profile); metadata.append(wrapper);
    }
    const detail = el('div'), authorLine = el('div', 'author-info'), author = el('a', 'author-name', text(originalAuthor) || '社区用户');
    if (authorURL) author.setAttribute('href', `${authorURL.pathname}${authorURL.search}`);
    authorLine.append(author); if (q('.is-poster', source)) authorLine.append(el('span', 'is-poster role-tag nsk-badge', '楼主'));
    detail.append(authorLine, el('div', 'content-info', text(q('.date-created', source)))); metadata.append(detail);
    if (/^\d+$/.test(source.id)) {
      const floor = el('div','floor-link-wrapper'), link = el('a','floor-link',`#${source.id}`);
      link.href = `${pageURL}#${source.id}`; link.setAttribute('aria-label',`第 ${source.id} 楼（原帖）`); floor.append(link); metadata.append(floor);
    }
    node.append(metadata);
    const originalArticle = q('.post-content', source); if (!originalArticle) return null;
    const article = el('article', 'post-content'); article.append(...sanitizeArticle(originalArticle, pageURL, true).childNodes); node.append(article);
    const signature = q('.signature', source); if (signature) { const imported = el('div', 'signature'); imported.append(...sanitizeArticle(signature, pageURL).childNodes); node.append(imported); }
    const menu = el('div', 'comment-menu'); const original = el('a', 'nsu-button', '在原帖查看'); original.href = `${pageURL}#${source.id}`;
    const reply = button('回复', () => replyToImported(node, text(originalAuthor)), 'nsu-button', 'reply');
    menu.append(reply);
    const labels = new Set();
    for (const action of qa(':scope > .comment-menu .menu-item', source)) {
      const label = (action.getAttribute('title') || action.getAttribute('aria-label') || text(action)).trim();
      if (!/^(点赞|加鸡腿|喂鸡腿|投喂|反对|收藏|编辑|置顶|取消置顶|引用)$/.test(label) || labels.has(label)) continue;
      labels.add(label);
      const link = el('a', 'nsu-button', label); link.href = original.href;
      link.title = `${label}（原帖）`; link.setAttribute('aria-label', `${label}（在原帖操作）`); menu.append(link);
    }
    menu.append(original); node.append(menu);
    return node;
  }
  function replyToImported(node, author) {
    openFloatingEditor(node, document.activeElement);
    const request = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let timer;
    const result = event => {
      let value; try { value = JSON.parse(event.detail); } catch { return; }
      if (value?.request !== request) return;
      clearTimeout(timer); document.removeEventListener('nsu:reply-result', result);
      if (value.ok) toast('已在原站编辑器准备引用；确认内容后由你发布');
      else showReplyFallback(node, author);
    };
    document.addEventListener('nsu:reply-result', result);
    timer = setTimeout(() => { document.removeEventListener('nsu:reply-result', result); if (enabled) showReplyFallback(node, author); }, 600);
    document.dispatchEvent(new CustomEvent('nsu:reply-request', { detail: JSON.stringify({ request, url: commentURL(node), author }) }));
  }
  function showReplyFallback(node, author) {
    closeFloatingEditor(false);
    const { body } = openDialog('回复这条讨论');
    body.append(el('p', 'nsu-dialog-note', '未能安全连接原站编辑器。你可以复制引用后粘贴，或在原帖回复；不会自动发布。'));
    const url = commentURL(node), original = el('a', 'nsu-button', '前往原帖回复'); original.href = url;
    body.append(button('复制引用', () => copyText(`${author ? `@${author} ` : ''}[查看引用](${url})\n\n`)), original);
  }
  async function loadNextComments() {
    const active = stream; if (!active || !active.next || active.loading || !enabled || (active.kind === 'feed' ? !settings.infiniteFeed : !settings.continuous)) return;
    if (active.pages >= active.limit) { streamStatus('已连续读了多页，点一下继续接着读。'); return; }
    if (active.seenPages.has(active.next)) { active.next = null; streamStatus(); return; }
    const pageURL = active.next; active.loading = true; active.controller = new AbortController();
    const timeout = setTimeout(() => active.controller.abort(), 12000); streamStatus('正在续读下一段讨论…');
    try {
      const html = await fetchPageHTML(pageURL, active.controller.signal);
      if (stream !== active || !enabled || (active.kind === 'feed' ? !settings.infiniteFeed : !settings.continuous)) return;
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const candidates = active.kind === 'feed' ? qa('.post-list:not(.topic-carousel-panel) > .post-list-item', parsed) : qa('.comments > .content-item[data-comment-id]', parsed);
      if (!candidates.length || (active.kind === 'post' && !q('.nsk-post-wrapper', parsed))) { cache.delete(pageURL); throw new Error('verification or no content'); }
      const seen = new Set(active.kind === 'feed' ? nativeRows().map(node => canonical(q('.post-title>a', node)?.href)) : qa('.content-item[data-comment-id]').map(node => node.dataset.commentId));
      const fragment = document.createDocumentFragment();
      for (const source of candidates) {
        if (active.kind === 'feed') {
          const link = q('.post-title>a', source), safe = link && safeURL(link.getAttribute('href'), pageURL), url = safe && canonical(safe.href);
          if (!url || seen.has(url)) continue;
          const imported = importFeedRow(source, pageURL); if (imported) { fragment.append(imported); seen.add(url); }
        } else {
          if (seen.has(source.dataset.commentId) || !/^\d+$/.test(source.id) || !/^\d+$/.test(source.dataset.commentId)) continue;
          const imported = importComment(source, pageURL); if (imported) { fragment.append(imported); seen.add(source.dataset.commentId); }
        }
      }
      q(active.kind === 'feed' ? '.post-list:not(.topic-carousel-panel)' : '.comments').append(fragment); active.seenPages.add(pageURL); active.pages++;
      active.next = nextCommentPage(parsed, pageURL); if (active.next && active.seenPages.has(active.next)) active.next = null;
      active.loading = false; active.paused = false; refresh(); streamStatus();
      streamObserver?.unobserve(active.node); streamObserver?.observe(active.node);
    } catch {
      if (stream === active && enabled) { active.loading = false; active.paused = true; streamStatus('未能续读：网络、权限或验证限制。可重试，或在原站页面打开。'); }
    } finally { clearTimeout(timeout); }
  }
  function stopStream(removeImported = false) {
    streamObserver?.disconnect(); streamObserver = null; stream?.controller?.abort(); stream?.node.remove(); stream = null;
    if (removeImported) { openingController?.abort(); q('#nsu-opening-status')?.remove(); stopEarlierComments(); document.dispatchEvent(new CustomEvent('nsu:dispose-comments')); importedActions.clear(); restoreThreads(); qa('.nsu-loaded-comment,.nsu-loaded-row').forEach(node => node.remove()); }
  }
  function recordProgress() {
    const info = postInfo(); if (!enabled || !settings.history || pageType !== 'post' || !info) return;
    let floor = '';
    for (const node of comments()) { if (node.classList.contains('nsu-comment-hidden') || node.classList.contains('nsu-hot-comment')) continue; if (node.getBoundingClientRect().top <= 170) floor = node.id; }
    const source = floor && floorNode(floor); const sourceInfo = source ? postInfo(commentURL(source)) : null;
    library.progress[info.id] = { y: scrollY, floor, page: sourceInfo?.page || info.page, time: Date.now() };
    const entries = Object.entries(library.progress).sort((a, b) => a[1].time - b[1].time).slice(-200); library.progress = Object.fromEntries(entries); saveLibrary();
  }
  function onScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0; const progress = q('#nsu-progress');
      if (progress) { const max = document.documentElement.scrollHeight - innerHeight; progress.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1})`; }
      if (Math.abs(scrollY - lastScroll) < 8) return; lastScroll = scrollY;
      clearTimeout(progressTimer); progressTimer = setTimeout(recordProgress, 500);
    });
  }
  function refresh() {
    if (!enabled) return;
    qa('.nsu-profile-reference[data-nsu-owned]').forEach(node=>node.remove());
    applySettings(); initHeader(); syncAccountMenu(); syncMessages(); observeMessages(); initSidebar(); initMessagePage(); initRulingPage();
    if (pageType === 'feed') initFeed(); else if (pageType === 'post') { initPost(); mountImportedActions(); initEarlierComments(); initOpeningPost(); }
    for (const link of qa('a[data-nsu-reference]')) {
      const ref = postInfo(link.href);
      const redundant = settings.nested && ref && floorNode(ref.floor) && !link.closest('blockquote,pre,code') && /^(查看引用|查看引用的回复|#\d+)$/.test(text(link));
      link.classList.toggle('nsu-redundant-reference', Boolean(redundant));
    }
    applySettings();
    // Moving native reply nodes is our own work, not site hydration.
    observer?.takeRecords();
  }
  function initSendShortcut() {
    let lastSend = 0;
    listen(document, 'keydown', event => {
      if (!settings.ctrlEnterSend || !event.ctrlKey || event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.isComposing || event.repeat || event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('textarea,[contenteditable="true"],.CodeMirror')) return;
      const visible = node => node && node.getClientRects().length && !node.disabled && node.getAttribute('aria-disabled') !== 'true';
      let send;
      if (pageType === 'post' && target.closest('#editor')) send = q('#editor .topic-select .submit');
      else if (location.pathname === '/notification' && location.hash.startsWith('#/message')) {
        // Restrict discovery to the focused composer's ancestors; never click unrelated page actions.
        let scope = target.parentElement;
        for (let depth = 0; scope && depth < 5 && scope !== document.body; depth++, scope = scope.parentElement) {
          const candidates = qa('button,input[type="submit"],[role="button"],.btn', scope).filter(node => /^(发送|发送消息|发送私信)$/.test(text(node) || node.value || '') && visible(node));
          if (candidates.length === 1) { send = candidates[0]; break; }
          if (candidates.length > 1) return;
        }
      }
      if (!visible(send)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (Date.now() - lastSend < 1000) return;
      lastSend = Date.now(); send.click();
    }, { capture: true });
  }
  function enable() {
    if (enabled) return; enabled = true; runtime = new AbortController(); initSendShortcut(); initFloatingReplies(); initAvatarCards();
    listen(document,'nsu:identity',event=>{try { const value=JSON.parse(event.detail); currentIdentity = Number.isSafeInteger(value?.id) && value.id>0 && typeof value.name==='string' ? value : null; syncAccountMenu(); } catch {} });
    document.dispatchEvent(new CustomEvent('nsu:identity-request'));

    listen(window, 'scroll', () => {
      closeAccountMenu();
      // Ignore an already queued scroll event at the opening position, not subsequent reading movement.
      if(avatarCardScroll && Math.abs(scrollY-avatarCardScroll.y)<1)return;
      avatarCardScroll=null;
      for(const card of qa('.hover-user-card')) if(card.getClientRects().length)q('.closeBtn',card)?.click();
    }, {passive:true});
    pageType = q('.nsk-post-wrapper') && postInfo() ? 'post' : nativeRows().length || q('.post-list-controler') ? 'feed' : 'other';
    refresh(); initListReturn(); initMessageReturn();
    listen(window, 'scroll', onScroll, { passive: true });
    listen(window, 'resize', onScroll, { passive: true });
    const sidebar = q('#nsk-left-panel-container');
    listen(sidebar, 'keydown', event => {
      if (event.key === 'Escape') { root.dataset.nsuMobileNav = 'false'; const toggle = q('[aria-controls="nsk-left-panel-container"]'); toggle?.setAttribute('aria-expanded', 'false'); toggle?.focus(); }
    });
    listen(document, 'click', event => {
      if (root.dataset.nsuMobileNav === 'true' && !event.target.closest('#nsk-left-panel-container,[aria-controls="nsk-left-panel-container"]')) { root.dataset.nsuMobileNav = 'false'; q('[aria-controls="nsk-left-panel-container"]')?.setAttribute('aria-expanded', 'false'); }
    });
    listen(window, 'hashchange', () => { initMessagePage(); if (location.hash) q('#nsu-resume')?.remove(); const target = floorNode(location.hash.slice(1)); if (target) { clearAuthorFilter(); requestAnimationFrame(() => target.scrollIntoView({ block: 'start' })); } });
    listen(window, 'pagehide', () => { if (settings.history && pageType === 'post') recordProgress(); saveLibrary(true); });
    listen(media, 'change', () => applySettings());
    // Watch only structural changes to native content, never our own controls/text.
    const main = q('#nsk-body-left') || (location.pathname === '/ruling' ? q('#nsk-frame') : null);
    if (main) {
      observer = new MutationObserver(mutations => {
        const native = mutations.some(mutation => !mutation.target.closest?.('[data-nsu-owned]') && [...mutation.addedNodes, ...mutation.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute('data-nsu-owned')));
        if (!native) return; clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 100);
      }); observer.observe(main, { childList: true, subtree: true });
    }
    document.dispatchEvent(new CustomEvent('nsu:ready'));
  }
  function disable() {
    if (!enabled) return; enabled = false; closeFloatingEditor(false); closeDialog(); stopInlineContexts(); restoreThreads(); stopStream(true); stopProfiles(); runtime?.abort(); observer?.disconnect(); messageObserver?.disconnect(); messageObserver = null;
    clearTimeout(refreshTimer); clearTimeout(toastTimer); clearTimeout(progressTimer); cancelAnimationFrame(scrollFrame); scrollFrame = 0;
    qa('[data-nsu-owned]').forEach(node => node.remove());
    for (const [node, attrs] of originals) for (const [name, value] of attrs) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); }
    originals.clear();
    for (const node of qa('[class]')) for (const cls of [...node.classList]) if (cls.startsWith('nsu-')) node.classList.remove(cls);
    for (const node of qa('*')) for (const attr of [...node.attributes]) if (attr.name.startsWith('data-nsu-')) node.removeAttribute(attr.name);
    root.style.removeProperty('--nsu-focus-columns'); root.style.removeProperty('--nsu-focus-column'); root.style.removeProperty('--nsu-font-size'); avatarCardScroll=null; focusMode = false; authorFilter = ''; feedQuery = ''; unreadOnly = false; delete window.__NSU_ANCHOR_ALIGNED__;
  }
  function applyEarlyAppearance() {
    if (!settings.enabled) return;
    root.dataset.nsuEnabled = 'true';
    root.dataset.nsuTheme = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
    root.dataset.nsuSpace = String(/^\/space\/\d+\/?$/.test(location.pathname));
    root.dataset.nsuLucky = String(/^\/lucky\/?$/.test(location.pathname));
    root.dataset.nsuPalette = settings.palette; root.dataset.nsuDensity = settings.density; root.dataset.nsuQuiet = String(settings.quiet); root.dataset.nsuHeaderNav = String(settings.showHeaderNav);
    root.dataset.nsuContinuous = String(settings.continuous); root.dataset.nsuInfiniteFeed = String(settings.infiniteFeed);
    root.dataset.nsuNested = String(settings.nested);
    root.dataset.nsuPage = postInfo() ? 'post' : /^\/(?:$|page-|categories\/)/.test(location.pathname) ? 'feed' : 'other';
    root.style.setProperty('--nsu-font-size', `${settings.fontSize}px`);
  }
  async function start() {
    // CSS is injected at document_start; only preference lookup gates appearance, not data/DOM idle.
    const early = document.readyState === 'loading';
    if (early) root.dataset.nsuBoot = 'true';
    const release = setTimeout(() => { delete root.dataset.nsuBoot; }, 600);
    const raw = await storage.get('nsu.settings'); settings = settingsClean(raw);
    applyEarlyAppearance(); clearTimeout(release); delete root.dataset.nsuBoot;
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    account = q('.user-card .Username')?.getAttribute('href')?.match(/\/space\/(\d+)/)?.[1] || 'guest'; libraryKey = `nsu.library.${account}`;
    const [storedLibrary, profiles] = await Promise.all([storage.get(libraryKey), storage.get('nsu.publicProfiles')]);
    library = libraryClean(storedLibrary);
    if (profiles && typeof profiles === 'object') {
      for (const [uid, entry] of Object.entries(profiles).slice(-200)) {
        if (/^\d+$/.test(uid) && entry?.schema === 2 && Number.isFinite(entry.time) && entry.time <= Date.now() && Date.now() - entry.time < PROFILE_TTL) publicProfiles[uid] = profileClean(entry, entry.time);
      }
    }
    if (settings.enabled) enable();
    window.addEventListener('storage', event => { if (event.key === libraryKey) syncLibrary(); });
    window.addEventListener('focus', syncLibrary);
    window.addEventListener('resize', () => { if (enabled) { syncMessages(); syncAccountMenu(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncLibrary(); });
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[libraryKey]) acceptLibrary(changes[libraryKey].newValue);
      if (changes['nsu.settings']) { const next = settingsClean(changes['nsu.settings'].newValue); if (JSON.stringify(next) === JSON.stringify(settings)) return; settings = next; if (settings.enabled) { if (!enabled) enable(); else refresh(); } else disable(); }
    });
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (message?.type === 'nsu:settings') { if (!enabled) { settings.enabled = true; storage.set('nsu.settings', settings); enable(); } showSettings(); respond({ ok: true }); }
    });
  }
  window.__SEEKFLOW__ = { version: '1.0.0', refresh, destroy: disable };
  start().catch(() => { delete root.dataset.nsuBoot; if (enabled) disable(); else { for (const key of Object.keys(root.dataset)) if (key.startsWith('nsu')) delete root.dataset[key]; root.style.removeProperty('--nsu-focus-columns'); root.style.removeProperty('--nsu-focus-column'); root.style.removeProperty('--nsu-font-size'); } });
})();
