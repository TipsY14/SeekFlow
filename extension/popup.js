/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
'use strict';
const enabled = document.querySelector('#enabled');
const theme = document.querySelector('#theme');
const palette = document.querySelector('#palette');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function appearance() {
  document.documentElement.dataset.nsuTheme = theme.value === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme.value;
  document.documentElement.dataset.nsuPalette = palette.value;
}
systemTheme.addEventListener('change', appearance);
const status = document.querySelector('#status');
let settings = {};
async function load() {
  const data = await chrome.storage.local.get('nsu.settings'); settings = data['nsu.settings'] || {};
  enabled.checked = settings.enabled !== false; theme.value = settings.theme || 'system';
  palette.value = ['waterlilies','garden','mist','green','soft'].includes(settings.palette) ? settings.palette : 'waterlilies'; appearance();
}
async function update(patch) {
  const data = await chrome.storage.local.get('nsu.settings');
  settings = { ...data['nsu.settings'], ...patch };
  await chrome.storage.local.set({ 'nsu.settings': settings });
  status.textContent = enabled.checked ? '已开启。在 NodeSeek 页面即时生效。' : '已恢复原版，可随时重新开启。';
}
enabled.addEventListener('change', () => update({ enabled: enabled.checked }).catch(() => { status.textContent = '无法保存，请重试。'; }));
theme.addEventListener('change', () => { appearance(); update({ theme: theme.value }).catch(() => { status.textContent = '无法保存，请重试。'; }); });
palette.addEventListener('change', () => { appearance(); update({ palette: palette.value }).catch(() => { status.textContent = '无法保存，请重试。'; }); });
document.querySelector('#settings').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no tab');
    await chrome.tabs.sendMessage(tab.id, { type: 'nsu:settings' }); window.close();
  } catch { status.textContent = '请先打开或刷新 NodeSeek 页面，再打开设置。'; }
});
load().catch(() => { status.textContent = '设置加载失败，请重新打开扩展。'; });
