/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
function luminance(hex){const channels=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
function contrast(a,b){let x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('left navigation labels share one text column and header does not duplicate saved list',async({page})=>{
  await page.goto('/');await expect(page.locator('.category-list nav>.nsu-side-link')).toHaveCount(3);
  const xs=await page.locator('.category-list nav>.nsu-side-link>span').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().left));expect(Math.max(...xs)-Math.min(...xs)).toBeLessThan(.5);
  await expect(page.locator('#nsu-header-actions button[aria-label="稍后读"]')).toHaveCount(0);
  await page.setViewportSize({width:390,height:815});await page.locator('[aria-controls="nsk-left-panel-container"]').click();await page.locator('.category-list button[aria-label="稍后读"]').click();await expect(page.getByRole('dialog')).toContainText('稍后读');await expect(page.locator('html')).toHaveAttribute('data-nsu-mobile-nav','false');
});
test('role-based palettes are configurable, persistent solid colors with readable text in both modes',async({page})=>{
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-nsu-palette','waterlilies');
  await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').click();
  expect(await page.locator('#nsu-setting-palette option').allTextContents()).toEqual(['标准','暖纸','冷灰','石墨','柔和']);
  for(const palette of ['waterlilies','garden','mist','green','soft'])for(const theme of ['light','dark']){
    await page.locator('#nsu-setting-palette').selectOption(palette);await page.locator('#nsu-setting-theme').selectOption(theme);await expect(page.locator('html')).toHaveAttribute('data-nsu-theme',theme);
    const colors=await page.evaluate(()=>{const css=getComputedStyle(document.documentElement);return Object.fromEntries(['bg','surface','subtle','hover','text','muted','accent','accent-soft','on-accent'].map(k=>[k,css.getPropertyValue('--nsu-'+k).trim()]));});
    expect(contrast(colors.text,colors.surface)).toBeGreaterThan(7);expect(contrast(colors.muted,colors.bg)).toBeGreaterThanOrEqual(4.5);expect(contrast(colors.accent,colors.surface)).toBeGreaterThanOrEqual(4.5);expect(contrast(colors['on-accent'],colors.accent)).toBeGreaterThanOrEqual(4.5);
    for(const background of ['surface','subtle','hover','accent-soft']){expect(contrast(colors.text,colors[background])).toBeGreaterThanOrEqual(7);expect(contrast(colors.muted,colors[background]),palette+' '+theme+' muted on '+background).toBeGreaterThanOrEqual(4.5);expect(contrast(colors.accent,colors[background]),palette+' '+theme+' accent on '+background).toBeGreaterThanOrEqual(4.5);}
    if(theme==='light'){expect(luminance(colors.surface)).toBeLessThan(luminance('#ffffff'));expect(luminance(colors.surface)).toBeGreaterThan(luminance(colors.bg));}
    else expect(luminance(colors.surface)).toBeGreaterThan(luminance(colors.bg));
    expect(await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundImage)).toBe('none');
  }
  await page.locator('#nsu-setting-palette').selectOption('garden');await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-nsu-palette','garden');
  await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').click();await page.getByRole('button',{name:'恢复默认偏好'}).click();await expect(page.locator('html')).toHaveAttribute('data-nsu-palette','waterlilies');
});
test('palette selector in popup saves same preference and updates its own colors',async({page})=>{
  await page.addInitScript(()=>{let data={};window.chrome={storage:{local:{get:async key=>({[key]:data[key]}),set:async value=>{Object.assign(data,value);window.savedSettings=data['nsu.settings'];}}}};});
  await page.goto('/extension/popup.html');expect(await page.locator('#palette option').allTextContents()).toEqual(['标准','暖纸','冷灰','石墨','柔和']);await page.locator('#palette').selectOption('mist');await expect(page.locator('html')).toHaveAttribute('data-nsu-palette','mist');await expect.poll(()=>page.evaluate(()=>window.savedSettings?.palette)).toBe('mist');
});
