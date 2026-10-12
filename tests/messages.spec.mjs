/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('essential messages stay available in focus mode and follow only native unread counts',async({page})=>{
 await page.goto('/post-100-1');await expect(page.locator('#nsu-messages')).toBeVisible();await expect(page.locator('#nsu-messages a')).toHaveCount(1);
 await page.evaluate(()=>{const card=document.querySelector('#nsk-right-panel-container .user-card');const a=document.createElement('a');a.href='/notification';a.textContent='通知 3';card.append(a);});
 await expect(page.locator('#nsu-notifications')).toHaveAttribute('aria-label','消息，3 条综合未读');await expect(page.locator('.nsu-unread')).toHaveText('3');
 await page.getByRole('button',{name:'专注阅读',exact:true}).click();await expect(page.locator('#nsk-right-panel-container')).toBeHidden();await expect(page.locator('#nsu-messages')).toBeHidden();await page.getByRole('button',{name:'退出专注',exact:true}).click();
 await page.evaluate(()=>[...document.querySelectorAll('#nsk-right-panel-container .user-card a[href="/notification"]')].find(n=>n.textContent.includes('通知')).textContent='通知 0');await expect(page.locator('.nsu-unread')).toBeHidden();
 await page.setViewportSize({width:390,height:815});await expect(page.locator('#nsu-notifications')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.__SEEKFLOW__.destroy());await expect(page.locator('#nsu-messages')).toHaveCount(0);
});
test('guest does not get fabricated account state',async({page})=>{
 await page.goto('/');await page.evaluate(()=>document.querySelector('#nsk-right-panel-container .user-card .Username').remove());await expect(page.locator('#nsu-messages')).toHaveCount(0);
});

test('message landing defaults to explicit list and preserves specific routes with a safe return link',async({page})=>{
 await page.goto('/');await page.evaluate(()=>sessionStorage.setItem('nsu.messageOrigin',JSON.stringify({url:location.origin+'/post-100-1#2',y:240,time:Date.now()})));
 const html=await (await page.request.get('/tests/fixtures/other.html')).text();await page.route('**/notification',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('/notification#/message');await expect(page).toHaveURL(/#\/message\?mode=list$/);await expect(page.getByRole('link',{name:'返回刚才的帖子'})).toHaveAttribute('href',/post-100-1#2$/);await expect(page.locator('#nsu-message-navigation a').last()).toHaveAttribute('href','/');
 await page.goto('/notification#/atMe');await expect(page).toHaveURL(/#\/atMe$/);
 await page.goto('/notification#/message?mode=talk&to=101');await expect(page).toHaveURL(/mode=talk&to=101$/);
 await page.goto('/notification');await expect(page).toHaveURL(/#\/reply$/);
});

test('focus hides header without shifting reading column and exits explicitly',async({page})=>{
 await page.goto('/post-100-1');const main=page.locator('#nsk-body-left');const before=await main.boundingBox();await page.getByRole('button',{name:'专注阅读',exact:true}).click();const after=await main.boundingBox();expect(Math.abs(before.x-after.x)).toBeLessThan(1);expect(Math.abs(before.width-after.width)).toBeLessThan(1);expect(Math.abs(before.y-after.y)).toBeLessThan(1);await expect(page.locator('body>header')).toBeHidden();await page.getByRole('button',{name:'退出专注',exact:true}).click();await expect(page.locator('body>header')).toBeVisible();
});
