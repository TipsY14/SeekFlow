/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
for(const width of [1432,390])test(`real floor numbers remain beside native nested and continued replies ${width}`,async({page})=>{
 await page.setViewportSize({width,height:815});await page.route('**/post-100-2',r=>r.fulfill({contentType:'text/html',body:'<div class="nsk-post-wrapper"><ul class="comments"><li class="content-item" id="12" data-comment-id="129012"><div class="author-info"><a class="author-name" href="/space/101">User</a></div><article class="post-content"><p>Imported reply</p></article></li></ul></div>'}));
 await page.goto('/post-100-1');const floor=page.locator('.content-item[id="2"] > .nsk-content-meta-info .floor-link');await expect(floor).toHaveText('#2');await expect(floor).toHaveAttribute('href','#2');await floor.scrollIntoViewIfNeeded();await expect(floor).toBeVisible();
 const same=await floor.evaluate(n=>{window.originalFloor=n;const row=n.closest('.nsk-content-meta-info').getBoundingClientRect(),box=n.getBoundingClientRect();return box.left>=row.left&&box.right<=row.right+1});expect(same).toBe(true);
 const inset=await floor.evaluate(n=>n.closest('.nsk-content-meta-info').getBoundingClientRect().right-n.getBoundingClientRect().right);expect(inset).toBeGreaterThanOrEqual(7);
 await page.locator('#nsu-discussion-mode').click();await expect(floor).toHaveText('#2');await expect(floor).toBeVisible();expect(await floor.evaluate(n=>n===window.originalFloor)).toBe(true);
 await page.locator('#nsu-stream').scrollIntoViewIfNeeded();const loaded=page.locator('.nsu-loaded-comment[id="12"] > .nsk-content-meta-info .floor-link');await expect(loaded).toHaveText('#12');await expect(loaded).toHaveAttribute('href',/\/post-100-2#12$/);await expect(loaded).toBeVisible();expect(await loaded.evaluate(n=>n.closest('.nsk-content-meta-info').getBoundingClientRect().right-n.getBoundingClientRect().right)).toBeGreaterThanOrEqual(7);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.__SEEKFLOW__.destroy());await expect(page.locator('.nsu-loaded-comment')).toHaveCount(0);await expect(floor).toHaveText('#2');expect(await floor.evaluate(n=>n===window.originalFloor)).toBe(true);
});
