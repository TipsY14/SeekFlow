/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('visible users show real rank and joined days, one request per user and cache survives reload',async({page})=>{
  let requests=0;await page.route('**/api/account/getInfo/*?readme=1',route=>{requests++;const uid=new URL(route.request().url()).pathname.split('/').pop();return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,detail:{member_id:Number(uid),rank:3,created_at:new Date(Date.now()-147*86400000).toISOString(),bio:'not persisted',coin:123}})});});
  await page.goto('/post-100-1');await expect(page.locator('.nsu-user-tenure').first()).toContainText('Lv.3');await expect(page.locator('.nsu-user-tenure').first()).toContainText('加入 147 天');
  await expect.poll(()=>requests).toBe(2);await page.waitForTimeout(700);await page.reload();await expect(page.locator('.nsu-user-tenure').first()).toContainText('加入 147 天');expect(requests).toBe(2);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nsu.publicProfiles')));expect(Object.values(stored).every(item=>Object.keys(item).sort().join(',')==='coin,created,fans,nComment,nPost,rank,schema,stardust,time')).toBe(true);
  await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').click();await page.locator('#nsu-setting-userDetails').uncheck();await expect(page.locator('.nsu-user-tenure')).toHaveCount(0);
});
test('invalid or unavailable profile data never fabricates level or join date',async({page})=>{
  await page.route('**/api/account/getInfo/*?readme=1',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,detail:{member_id:999,rank:3,created_at:'not a date'}})}));
  await page.goto('/post-100-1');await expect(page.locator('#nsu-reading-toolbar')).toBeVisible();await page.waitForTimeout(400);await expect(page.locator('.nsu-user-tenure')).toHaveCount(0);
});
test('short comments are a compact continuous list, not tall isolated cards',async({page})=>{
  await page.setViewportSize({width:1432,height:815});await page.goto('/post-100-1');await expect(page.locator('html')).toHaveAttribute('data-nsu-density','compact');
  const metrics=await page.locator('.content-item[id="1"]').evaluate(node=>{const c=getComputedStyle(node);return{height:node.getBoundingClientRect().height-(node.querySelector(':scope > [data-nsu-thread-container]')?.getBoundingClientRect().height||0),radius:c.borderRadius,margin:c.marginBottom};});
  expect(metrics.height).toBeLessThan(155);expect(metrics.radius).toBe('0px');expect(metrics.margin).toBe('0px');
});

test('reading page has no decorative rail and keeps useful controls and a bounded column',async({page})=>{
  await page.setViewportSize({width:1432,height:815});await page.goto('/post-100-1');
  await expect(page.locator('#nsu-reading-toolbar')).toBeVisible();
  await expect(page.locator('#nsu-reading-rail,.nsu-side-note')).toHaveCount(0);
  await expect(page.locator('#nsk-right-panel-container')).toBeHidden();
  const width=await page.locator('#nsk-body-left').evaluate(n=>n.getBoundingClientRect().width);expect(width).toBeGreaterThan(850);expect(width).toBeLessThanOrEqual(1000);
  await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').click();await page.locator('#nsu-setting-quiet').uncheck();await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect(page.locator('#nsk-right-panel-container')).toBeVisible();await expect(page.locator('#nsu-reading-rail')).toHaveCount(0);
});
