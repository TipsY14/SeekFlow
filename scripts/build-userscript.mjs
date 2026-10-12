/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
// Build the userscript from the same CSS, content logic and native bridge as the extension.
import fs from 'node:fs/promises';
export async function buildUserscript(manifest) {
  const cssFiles = manifest.content_scripts.flatMap(script => script.css || []);
  const css = (await Promise.all(cssFiles.map(file => fs.readFile(`extension/${file}`, 'utf8')))).join('\n');
  const content = await fs.readFile('extension/content.js', 'utf8');
  const main = await fs.readFile('extension/main.js', 'utf8');
  const bridge = main.replace('(() => {', '((window, document, CustomEvent) => {').replace(/\}\)\(\);\s*$/, '})(unsafeWindow, unsafeWindow.document, unsafeWindow.CustomEvent);');
  if (bridge === main || !bridge.endsWith('})(unsafeWindow, unsafeWindow.document, unsafeWindow.CustomEvent);')) throw new Error('Native bridge wrapper changed');
  const legal = '/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 TipsY14\nLICENSE / NOTICE: https://github.com/TipsY14/SeekFlow */\n';
  return `// ==UserScript==
// @name         SeekFlow
// @namespace    seekflow
// @author       TipsY14
// @license      Apache-2.0
// @version      ${manifest.version}
// @description  NodeSeek 阅读增强：连续讨论、嵌套回复、阅读记录与五套明暗配色。
// @match        https://www.nodeseek.com/*
// @match        https://nodeseek.com/*
// @run-at       document-start
// @noframes
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// ==/UserScript==

${legal}
(() => {
  'use strict';
  const listeners = new Set(), messages = new Set(), watched = new Set();
  function watch(key) {
    if (watched.has(key)) return;
    watched.add(key);
    GM_addValueChangeListener(key, (_name, oldValue, newValue) => {
      for (const listener of listeners) listener({ [key]: { oldValue, newValue } }, 'local');
    });
  }
  // Adapter only: each edition keeps independent, local preferences and reading data.
  const chrome = {
    storage: {
      local: {
        async get(key) { watch(key); return { [key]: GM_getValue(key, null) }; },
        async set(values) { for (const [key, value] of Object.entries(values)) { watch(key); GM_setValue(key, value); } }
      },
      onChanged: { addListener(listener) { listeners.add(listener); } }
    },
    runtime: { onMessage: { addListener(listener) { messages.add(listener); } } }
  };
  function boot() {
    GM_addStyle(${JSON.stringify(css)});
    // Direct access to the existing native editor/card; no eval or injected remote script.
${bridge}
${content}
    GM_registerMenuCommand('阅读设置', () => {
      for (const listener of messages) listener({ type: 'nsu:settings' }, null, () => {});
    });
    GM_registerMenuCommand('启用 / 恢复原版界面', () => {
      const settings = GM_getValue('nsu.settings', {}) || {};
      chrome.storage.local.set({ 'nsu.settings': { ...settings, enabled: settings.enabled === false } });
    });
  }
  if (document.documentElement) boot();
  else {
    const observer = new MutationObserver(() => {
      if (document.documentElement) { observer.disconnect(); boot(); }
    });
    observer.observe(document, { childList: true });
  }
})();
`;
}
