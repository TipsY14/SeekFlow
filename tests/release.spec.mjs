/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {buildStyles,PALETTES} from '../scripts/build-styles.mjs';
import {buildUserscript} from '../scripts/build-userscript.mjs';
const manifest=JSON.parse(await fs.readFile('extension/manifest.json','utf8'));
const styles=await buildStyles(manifest.version);
const clean=html=>html.replace(/<link[^>]*href="\/extension\/[^\"]+"[^>]*>/g,'').replace(/<script[^>]*src="\/extension\/[^\"]+"[^>]*><\/script>/g,'');
async function nativePages(page){
 await page.route(/\/(?:post-100-1|css-home)$/,async route=>route.fulfill({contentType:'text/html',body:clean(await fs.readFile(route.request().url().endsWith('css-home')?'tests/fixtures/home.html':'tests/fixtures/post.html','utf8'))}));
}
test('release userscript is self-contained, versioned and contains no obsolete comment eye controls',async()=>{
 const script=await buildUserscript(manifest);new vm.Script(script);
 expect(script).toContain('// @version      '+manifest.version);expect(script).toContain('// @sandbox      JavaScript');
 expect(script).toContain('})(unsafeWindow, unsafeWindow.document, unsafeWindow.CustomEvent);');
 expect(script).toContain(await fs.readFile('extension/content.js','utf8'));
 for(const file of manifest.content_scripts.flatMap(s=>s.css||[]))expect(script).toContain(JSON.stringify(await fs.readFile('extension/'+file,'utf8')).slice(1,-1));
 for(const token of ['@require','@connect','GM_xmlhttpRequest','nsu-reference-preview','nsu-user-context','预览引用上下文'])expect(script).not.toContain(token);
 expect(script).toContain('// @license      Apache-2.0');expect(styles.usercss).toContain('@license Apache-2.0');
 for(const output of [script,styles.usercss,styles.render()]){
  expect(output).toContain('SPDX-License-Identifier: Apache-2.0');expect(output).toContain('Copyright 2026 TipsY14');expect(output).toContain('LICENSE / NOTICE: https://github.com/TipsY14/SeekFlow');
  expect(output).not.toContain('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION');
 }
 expect(styles.usercss).toContain('@preprocessor uso');expect(styles.usercss).toContain('@version '+manifest.version);expect(styles.usercss).toContain('@-moz-document domain("nodeseek.com")');
});
for(const width of [1432,390])for(const theme of ['light','dark'])test(`independent CSS shared palettes preserve native controls ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:815});await nativePages(page);
 for(const pathname of ['/css-home','/post-100-1']){
  await page.goto(pathname);const native=await page.evaluate(()=>{window.nativeHead=document.querySelector('#nsk-head');window.nativePager=document.querySelector('.nsk-pager');return {bg:getComputedStyle(document.body).backgroundColor,links:[...document.querySelectorAll('a[href]')].map(n=>n.getAttribute('href'))}});
  let style;
  for(const [id]of PALETTES){
   if(style)await style.evaluate(n=>n.remove());style=await page.addStyleTag({content:styles.render(id,theme)});
   const colors=await page.evaluate(()=>{const css=getComputedStyle(document.documentElement);const probe=document.createElement('i');document.body.append(probe);const result={};for(const key of ['bg','surface','accent','on-accent']){probe.style.color=css.getPropertyValue('--nsu-'+key);result[key]=getComputedStyle(probe).color}probe.remove();return result;});
   await expect(page.locator('body')).toHaveCSS('background-color',colors.bg);await expect(page.locator('body > header')).toHaveCSS('background-color',colors.surface);
   await expect(page.locator('.nsk-post,.post-list-item').first()).toHaveCSS('background-color',colors.surface);
   const primary=page.locator('.new-discussion').first();await primary.hover();await expect(primary).toHaveCSS('background-color',colors.accent);await expect(primary).toHaveCSS('color',colors['on-accent']);
   await expect(page.locator('.nav-menu')).toBeVisible();await expect(page.locator('.nsk-pager').first()).toBeVisible();
   expect(await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')))).toEqual(native.links);
   await expect(page.locator('html')).not.toHaveAttribute('data-nsu-enabled');await expect(page.locator('[data-nsu-owned]')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.evaluate(()=>window.nativeActions.submits+window.nativeActions.votes)).toBe(0);
  }
  await style.evaluate(n=>n.remove());await expect(page.locator('body')).toHaveCSS('background-color',native.bg);
  expect(await page.evaluate(()=>document.querySelector('#nsk-head')===window.nativeHead&&document.querySelector('.nsk-pager')===window.nativePager)).toBe(true);
 }
});
test('plain CSS follows native dark/light switching and UserCSS can follow system without JS',async({page})=>{
 await nativePages(page);await page.goto('/post-100-1');let style=await page.addStyleTag({content:styles.render('waterlilies','native')});
 await expect(page.locator('body')).toHaveCSS('background-color','rgb(243, 244, 246)');await page.evaluate(()=>document.body.className='bg1 dark-layout');await expect(page.locator('body')).toHaveCSS('background-color','rgb(27, 29, 33)');
 await page.evaluate(()=>document.body.className='bg1 light-layout');await expect(page.locator('body')).toHaveCSS('background-color','rgb(243, 244, 246)');await style.evaluate(n=>n.remove());
 style=await page.addStyleTag({content:styles.render('soft','system')});await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('body')).toHaveCSS('background-color','rgb(30, 32, 37)');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('body')).toHaveCSS('background-color','rgb(241, 242, 244)');
});
