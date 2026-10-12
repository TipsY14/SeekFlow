/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('Ctrl Enter activates native composer button only when enabled',async({page})=>{
 await page.goto('/post-100-1');await page.evaluate(()=>{window.sendClicks=0;document.querySelector('#editor .submit').addEventListener('click',e=>{e.preventDefault();window.sendClicks++})});const input=page.locator('#editor textarea');await input.fill('test');await input.press('Control+Enter');expect(await page.evaluate(()=>window.sendClicks)).toBe(1);
 await page.getByRole('button',{name:'阅读设置',exact:true}).click();await page.locator('#nsu-setting-ctrlEnterSend').uncheck();await page.keyboard.press('Escape');await input.press('Control+Enter');expect(await page.evaluate(()=>window.sendClicks)).toBe(1);
});
test('focus toolbar no longer sticks and progress is hidden',async({page})=>{await page.goto('/post-100-1');await page.getByRole('button',{name:'专注阅读',exact:true}).click();await expect(page.locator('#nsu-reading-toolbar')).toHaveCSS('position','static');await expect(page.locator('#nsu-progress')).toBeHidden();});
for(const width of [1432,390])test(`reading actions scroll away by default without entering focus ${width}`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nsu.settings',JSON.stringify({continuous:false,userDetails:false})));await page.setViewportSize({width,height:815});await page.goto('/post-100-1');
 const bar=page.locator('#nsu-reading-toolbar'),filter=bar.locator('#nsu-author-filter');await expect(bar).toBeVisible();await expect(bar).toHaveCSS('position','static');await expect(bar).toHaveCSS('top','auto');await expect(page.locator('html')).toHaveAttribute('data-nsu-focus','false');
 const origin=await bar.evaluate(n=>{window.originalReadingBar=n;return n.getBoundingClientRect().top+scrollY});await filter.click();await expect(filter).toHaveAttribute('aria-pressed','true');await filter.click();await expect(filter).toHaveAttribute('aria-pressed','false');
 await page.evaluate(()=>window.scrollTo({top:700,behavior:'instant'}));await expect(bar).not.toBeInViewport();expect(Math.abs(await bar.evaluate(n=>n.getBoundingClientRect().top+scrollY)-origin)).toBeLessThan(1);
 await expect(page.locator('body > header')).toHaveCSS('position','fixed');await expect.poll(()=>page.locator('body > header > #nsu-progress').evaluate(n=>n.getBoundingClientRect().bottom)).toBe(44);await expect(page.locator('html')).toHaveAttribute('data-nsu-focus','false');
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await expect(bar).toBeInViewport();await bar.getByRole('button',{name:'专注阅读',exact:true}).click();await expect(bar).toHaveCSS('position','static');await page.getByRole('button',{name:'退出专注',exact:true}).click();await expect(bar).toHaveCSS('position','static');expect(await bar.evaluate(n=>n===window.originalReadingBar)).toBe(true);expect(await page.evaluate(()=>window.nativeActions.submits)).toBe(0);
});
