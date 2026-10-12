/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect,chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('mode changes and scroll correction complete synchronously even if storage write is slow',async({page})=>{
  await page.goto('/post-100-1');await expect(page.locator('#nsu-discussion-mode')).toBeVisible();
  const result=await page.evaluate(()=>{
    const oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){if(args[0]==='nsu.settings')window.layoutAtWrite={mode:document.documentElement.dataset.nsuNested,roots:[...document.querySelectorAll('.comments > .content-item')].map(n=>n.id)};return oldSet.apply(this,args);};
    const anchor=document.getElementById('1');window.scrollTo({top:scrollY+anchor.getBoundingClientRect().top-150,behavior:'instant'});const before=anchor.querySelector('.nsk-content-meta-info').getBoundingClientRect().top;
    document.getElementById('nsu-discussion-mode').click();return{mode:document.documentElement.dataset.nsuNested,before,after:anchor.querySelector('.nsk-content-meta-info').getBoundingClientRect().top,atWrite:window.layoutAtWrite};
  });
  expect(result.mode).toBe('false');expect(result.atWrite.mode).toBe('false');expect(result.atWrite.roots).toEqual(['1','2','3','4','5','6','11']);expect(Math.abs(result.after-result.before)).toBeLessThan(2);
  await page.waitForTimeout(200);await expect(page.locator('[data-nsu-switching]')).toHaveCount(0);
  const stable=await page.evaluate(()=>{let count=0;const observer=new MutationObserver(records=>{count+=records.filter(r=>r.type==='childList').length;});observer.observe(document.querySelector('.comments'),{subtree:true,childList:true});window.__SEEKFLOW__.refresh();observer.disconnect();return observer.takeRecords().length+count;});expect(stable).toBe(0);
});

test('search overlay uses a single thin focus border, keyboard buttons retain a subtle indicator',async({page})=>{
  await page.goto('/');await expect(page.locator('#nsu-header-actions')).toBeVisible();
  await page.evaluate(()=>{const div=document.createElement('div');div.className='search-overlay';div.innerHTML='<div class="glass-input-group"><input placeholder="search"></div>';document.body.append(div);});
  await page.addStyleTag({content:'.glass-input-group input:focus{box-shadow:0 0 0 2px green;outline:3px solid green;border:1px solid green}button:focus{box-shadow:0 0 0 3px green}'});
  await page.locator('.glass-input-group input').focus();const input=await page.locator('.glass-input-group input').evaluate(n=>{let c=getComputedStyle(n);return{outline:c.outlineStyle,shadow:c.boxShadow,border:c.borderTopWidth};});expect(input).toEqual({outline:'none',shadow:'none',border:'1px'});
  await page.locator('.search-overlay').evaluate(n=>n.remove());await page.keyboard.press('Tab');await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').focus();
  const button=await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').evaluate(n=>{let c=getComputedStyle(n);return{width:c.outlineWidth,style:c.outlineStyle,shadow:c.boxShadow};});expect(button.width).toBe('1px');expect(button.style).toBe('solid');expect(button.shadow).toBe('none');
});

test('document-start extension has appearance set before DOMContentLoaded and first content paint',async()=>{
  const extension=path.resolve('extension');const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const monitor=`<script>window.appearanceAtDOMContentLoaded=null;document.addEventListener('DOMContentLoaded',()=>{window.appearanceAtDOMContentLoaded={enabled:document.documentElement.dataset.nsuEnabled,theme:document.documentElement.dataset.nsuTheme,boot:document.documentElement.dataset.nsuBoot}});window.paintStates=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.paintStates.push({name:e.name,enabled:document.documentElement.dataset.nsuEnabled,visible:getComputedStyle(document.body).visibility,boot:document.documentElement.dataset.nsuBoot})}).observe({type:'paint',buffered:true});</script>`;
    await context.route('https://www.nodeseek.com/**',async route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==='/post-100-1'){
        let html=await fs.readFile('tests/fixtures/post.html','utf8');html=html.replace('<head>','<head>'+monitor).replace('<link rel="stylesheet" href="/extension/palettes.css">','').replace('<link rel="stylesheet" href="/extension/styles.css">','').replace('<script defer src="/extension/content.js"></script>','').replace('<script defer src="/extension/main.js"></script>','');await route.fulfill({contentType:'text/html',body:html});
      }else if(pathname==='/tests/fixtures/native.js'){
        await new Promise(resolve=>setTimeout(resolve,120));await route.fulfill({contentType:'text/javascript',body:await fs.readFile('.'+pathname,'utf8')});
      }else if(pathname.startsWith('/tests/fixtures/'))await route.fulfill({contentType:pathname.endsWith('.css')?'text/css':pathname.endsWith('.svg')?'image/svg+xml':'text/javascript',body:await fs.readFile('.'+pathname,'utf8')});
      else await route.abort();
    });
    const page=await context.newPage();await page.goto('https://www.nodeseek.com/post-100-1');await expect(page.locator('#nsu-discussion-mode')).toBeVisible();
    const before=await page.evaluate(()=>window.appearanceAtDOMContentLoaded);expect(before.enabled).toBe('true');expect(before.theme).toBe('light');expect(before.boot).toBeUndefined();
    await expect.poll(()=>page.evaluate(()=>window.paintStates.length)).toBeGreaterThan(0);
    const paints=await page.evaluate(()=>window.paintStates);expect(paints.every(p=>p.enabled==='true'||p.visible==='hidden')).toBe(true);
    expect(await page.locator('#nsk-right-panel-container').evaluate(n=>getComputedStyle(n).display)).toBe('none');
  }finally{await context.close();}
});
