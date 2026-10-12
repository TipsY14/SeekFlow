/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
/* Runs in the site's MAIN world to use its original CodeMirror editor and public profile card.

 * No account APIs, network interception, token access, or automatic submission. */

(() => {

  'use strict';

  if (window.__NSU_EDITOR_BRIDGE__) return;

  window.__NSU_EDITOR_BRIDGE__ = true;

  // Reuse the site's already loaded component; never import or evaluate remote code.

  const mounted = new Map();

  function publishIdentity() {
    const user = window.__config__?.user;
    const identity = Number.isSafeInteger(user?.member_id) && typeof user.member_name === 'string' ? {id:user.member_id,name:user.member_name.slice(0,100)} : null;
    document.dispatchEvent(new CustomEvent('nsu:identity', {detail:JSON.stringify(identity)}));
  }
  document.addEventListener('nsu:identity-request', publishIdentity);
  publishIdentity();
  document.addEventListener('nsu:mount-comments', event => {

    if (document.documentElement.dataset.nsuEnabled !== 'true') return;

    let entries; try { entries = JSON.parse(event.detail); } catch { return; }

    const config = window.__config__;

    const template = [...document.querySelectorAll('.comment-menu')].map(n => n.__vue__).find(vm => vm?.setIndex && vm?.$options?.render);

    if (!template || !Array.isArray(entries) || entries.length > 100 || !config?.postData?.comments) return;

    for (const entry of entries) {

      let vm;

      try {

        if (String(entry.postId) !== String(config.postData.postId)) continue;

        const c = entry.comment;

        if (!Number.isSafeInteger(c?.commentId) || !Number.isSafeInteger(c.floorIndex) || c.floorIndex < 0 || typeof c.markdown !== 'string' || c.markdown.length > 200000 || !c.poster || !Number.isSafeInteger(c.poster.uid)) continue;

        const node = document.getElementById(String(c.floorIndex));

        if (!node?.classList.contains('nsu-loaded-comment') || node.dataset.commentId !== String(c.commentId) || mounted.has(node)) continue;

        const holder = node.querySelector(':scope > .comment-menu'); if (!holder) continue;

        let index = config.postData.comments.findIndex(item => item.commentId === c.commentId);

        if (index < 0) { index = config.postData.comments.length; config.postData.comments.push(c); }

        vm = new template.constructor(template.$options); vm.setIndex(index);

        const nativeEdit = vm.edit;

        vm.edit = function(...args) {

          const draft = window.editor?.cme?.()?.getValue?.() || '';

          if (draft && !window.confirm('编辑会替换当前草稿，继续？')) return;

          return nativeEdit.apply(this, args);

        };

        vm.$mount(); holder.replaceWith(vm.$el); mounted.set(node, vm);

        node.dataset.nsuNativeActions = 'true';

      } catch { vm?.$destroy?.(); }

    }

  });

  document.addEventListener('nsu:dispose-comments', () => {

    for (const [node, vm] of mounted) { vm.$destroy(); mounted.delete(node); }

    // Keep appended data indices stable: original editor and open native dialogs may reference them.

  });

  document.addEventListener('nsu:avatar-request', event => {
    let payload;try { payload=JSON.parse(event.detail); } catch { return; }
    if (!payload || typeof payload.request !== 'string' || !/^\d+-\d+$/.test(payload.request)) return;
    const finish=ok=>document.dispatchEvent(new CustomEvent('nsu:avatar-result',{detail:JSON.stringify({request:payload.request,ok})}));
    try {
      if(document.documentElement.dataset.nsuEnabled!=='true' || typeof payload.uid!=='string' || !/^\d+$/.test(payload.uid) || !Number.isSafeInteger(Number(payload.uid)) || Number(payload.uid)<=0 || !Number.isFinite(payload.left) || !Number.isFinite(payload.top)) { finish(false);return; }
      // Invoke the already mounted native card. Never create fake follow/transfer controls or a second Vue instance.
      const card=[...document.querySelectorAll('.hover-user-card')].map(node=>node.__vue__).find(vm=>vm?.isHoverCard && typeof vm.loadUser==='function' && typeof vm.show==='function' && vm.$el?.isConnected);
      if(!card) { finish(false);return; }
      card.left=Math.max(12,Math.min(payload.left,document.documentElement.clientWidth-Math.min(290,document.documentElement.clientWidth-24)-12));
      card.top=Math.max(56,Math.min(payload.top,Math.max(56,innerHeight-340)));
      card.loadUser(Number(payload.uid));card.show();finish(true);
    } catch { finish(false); }
  });

  document.addEventListener('nsu:editor-layout', () => {
    if (document.documentElement.dataset.nsuEnabled !== 'true' || !/^\/post-\d+-\d+\/?$/.test(location.pathname)) return;
    try {
      const cm = document.querySelector('#editor .CodeMirror')?.CodeMirror || window.editor?.cm?.();
      cm?.refresh?.();
    } catch { /* Unavailable native editor stays untouched. */ }
  });

  document.addEventListener('nsu:reply-request', event => {

    let payload;

    try { payload = JSON.parse(event.detail); } catch { return; }

    if (!payload || typeof payload.request !== 'string' || !/^\d+-\d+$/.test(payload.request)) return;

    const finish = ok => document.dispatchEvent(new CustomEvent('nsu:reply-result', { detail: JSON.stringify({ request: payload.request, ok }) }));

    try {

      if (document.documentElement.dataset.nsuEnabled !== 'true' || typeof payload.url !== 'string' || typeof payload.author !== 'string') { finish(false); return; }

      const url = new URL(payload.url, location.href), current = location.pathname.match(/^\/post-(\d+)-\d+$/), target = url.pathname.match(/^\/post-(\d+)-\d+$/);

      if (url.origin !== location.origin || !current || !target || current[1] !== target[1] || !/^#\d+$/.test(url.hash) || payload.author.length > 100) { finish(false); return; }

      const editor = document.querySelector('#editor .CodeMirror')?.CodeMirror || window.editor?.cm?.();

      if (!editor || typeof editor.getValue !== 'function' || typeof editor.replaceRange !== 'function') { finish(false); return; }

      const name = payload.author.replace(/[\r\n\[\]()*`<>]/g, '').trim();

      const reply = `${name ? `@${name} ` : ''}[查看引用](${url.pathname}${url.hash})\n\n`;

      const existing = editor.getValue(); const last = editor.lastLine(); const line = editor.getLine(last);

      editor.replaceRange(`${existing && !existing.endsWith('\n') ? '\n\n' : ''}${reply}`, { line: last, ch: line.length }, undefined, '+input');

      editor.setCursor({ line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length });

      if (document.querySelector('#editor')?.dataset.nsuFloating !== 'true') document.querySelector('#editor')?.scrollIntoView({ block: 'center', behavior: 'auto' });
      editor.focus(); finish(true);

    } catch { finish(false); }

  });

})();
