/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import fs from 'node:fs/promises';
export const PALETTES = [['waterlilies','标准'],['garden','暖纸'],['mist','冷灰'],['green','石墨'],['soft','柔和']];
const THEMES = { 'system:跟随系统*': '', 'native:跟随原站': 'html:has(body.dark-layout){color-scheme:dark}html:has(body.light-layout){color-scheme:light}', 'light:明亮': 'html{color-scheme:light}', 'dark:深色': 'html{color-scheme:dark}' };
export async function buildStyles(version) {
  const paletteCSS = await fs.readFile('extension/palettes.css', 'utf8');
  const blocks = [...paletteCSS.matchAll(/\/\* (标准|暖纸|冷灰|石墨|柔和) \/ (light|dark) \*\/[\s\S]*?\{([^}]+)\}/g)];
  const tokens = new Map(blocks.map(([, label, theme, body]) => [`${label}/${theme}`, Object.fromEntries([...body.matchAll(/--nsu-([\w-]+):(#\w+);/g)].map(([, key, value]) => [key, value]))]));
  const palettes = Object.fromEntries(PALETTES.map(([id, label], i) => {
    const light = tokens.get(`${label}/light`), dark = tokens.get(`${label}/dark`);
    if (!light || !dark) throw new Error('Missing CSS palette: ' + label);
    const colors = Object.entries(light).map(([key, value]) => `--nsu-${key}:light-dark(${value},${dark[key]});`).join('');
    return [`${id}:${label}${i === 0 ? '*' : ''}`, colors + '--nsu-water:var(--nsu-subtle);--nsu-petal:var(--nsu-accent-soft);'];
  }));
  let css = await fs.readFile('styles/lite.css', 'utf8');
  // Independent page-specific presentation rules, with no data attributes or hidden native controls.
  const account = (await fs.readFile('extension/account-settings.css', 'utf8')).replace(/html\[data-nsu-enabled\]\[data-nsu-theme="dark"\] #user-setting-panel\s*\{[^}]+\}/, '').replaceAll('html[data-nsu-enabled]', 'html');
  const space = (await fs.readFile('extension/space.css', 'utf8')).replaceAll('html[data-nsu-enabled][data-nsu-space="true"]', 'html:has(#nsk-frame .head-container):not(:has(#user-setting-panel))');
  const lucky = (await fs.readFile('extension/lucky.css', 'utf8')).replaceAll('html[data-nsu-enabled][data-nsu-lucky="true"]', 'html:has(.sample-panel)');
  css += `\n${account}\n${space}\n${lucky}\nhtml #user-setting-panel{--nsu-settings-error:var(--nsu-error);--nsu-settings-warning:var(--nsu-warning);--nsu-settings-success:var(--nsu-success)}\n`;
  const legal = '/* SPDX-License-Identifier: Apache-2.0 | Copyright 2026 TipsY14\nLICENSE / NOTICE: https://github.com/TipsY14/SeekFlow */\n';
  css = legal + css;
  const usercss = `/* ==UserStyle==
@name SeekFlow CSS
@namespace seekflow
@version ${version}
@description NodeSeek 纯 CSS 阅读样式，五套明暗配色，保留原站操作与分页。
@author TipsY14
@license Apache-2.0
@preprocessor uso
@var select palette "色彩风格" ${JSON.stringify(palettes, null, 2)}
@var select theme "主题" ${JSON.stringify(THEMES, null, 2)}
==/UserStyle== */
@-moz-document domain("nodeseek.com") {
${css}}
`;
  function render(palette = 'waterlilies', theme = 'system') {
    const key = Object.keys(palettes).find(k => k.startsWith(palette + ':'));
    const mode = Object.keys(THEMES).find(k => k.startsWith(theme + ':'));
    if (!key || !mode) throw new Error('Unknown style configuration');
    return css.replace('/*[[palette]]*/', palettes[key]).replace('/*[[theme]]*/', THEMES[mode]);
  }
  return { usercss, render };
}
