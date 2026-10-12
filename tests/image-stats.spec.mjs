/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('native and imported images open exactly one viewer and close once',async({page})=>{
 await page.route('**/post-100-2',r=>r.fulfill({contentType:'text/html',body:'<div class="nsk-post-wrapper"><ul class="comments"><li class="content-item" id="12" data-comment-id="129012"><a class="author-name" href="/space/101">Author</a><article class="post-content"><img src="/tests/fixtures/avatar.svg" alt="imported"></article></li></ul></div>'}));
 await page.goto('/post-100-1');await page.locator('.content-item[id="6"] > .post-content img').click();await expect(page.locator('#native-image-viewer')).toHaveCount(1);await expect(page.locator('#nsu-lightbox')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('#native-image-viewer,#nsu-lightbox')).toHaveCount(0);
 await page.locator('#nsu-stream').scrollIntoViewIfNeeded();await page.locator('.nsu-loaded-comment > .post-content img').click();await expect(page.locator('#nsu-lightbox')).toHaveCount(1);await expect(page.locator('#native-image-viewer')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('#native-image-viewer,#nsu-lightbox')).toHaveCount(0);
});
test('all public statistics toggle independently, zero is valid and missing fields stay absent',async({page})=>{
 let requests=0;await page.route('**/api/account/getInfo/*?readme=1',r=>{requests++;return r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,detail:{member_id:Number(new URL(r.request().url()).pathname.split('/').pop()),rank:3,created_at:'2024-01-01T00:00:00Z',nPost:18,nComment:122,coin:536,fans:0,stardust:3,bio:'never store'}})});});
 await page.goto('/post-100-1');await expect(page.locator('.nsu-user-tenure').first()).toContainText('Lv.3');await expect(page.locator('[data-nsu-stat="nPost"]')).toHaveCount(0);await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').click();
 for(const [option,key,value] of [['showPosts','nPost','主题帖 18'],['showComments','nComment','评论 122'],['showCoin','coin','鸡腿 536'],['showFans','fans','粉丝 0'],['showStardust','stardust','星辰 3']]){await page.locator('#nsu-setting-'+option).check();await expect(page.locator('[data-nsu-stat="'+key+'"]').first()).toHaveText(value);await page.locator('#nsu-setting-'+option).uncheck();await expect(page.locator('[data-nsu-stat="'+key+'"]')).toHaveCount(0);}
 await page.locator('#nsu-setting-showLevel').uncheck();await page.locator('#nsu-setting-showJoined').uncheck();await expect(page.locator('.nsu-user-tenure')).toHaveCount(0);await page.locator('#nsu-setting-showFans').check();await expect(page.locator('.nsu-user-tenure').first()).toHaveText('粉丝 0');expect(requests).toBe(2);
 await page.reload();await expect(page.locator('.nsu-user-tenure').first()).toHaveText('粉丝 0');
});
