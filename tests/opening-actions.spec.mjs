/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
for(const width of [1432,390])test(`opening post has no reply-copy control but author comments retain theirs ${width}`,async({page})=>{
 await page.setViewportSize({width,height:815});await page.goto('/post-100-1');const opening=page.locator('.nsk-post > .content-item');await expect(opening).toHaveCount(1);
 const copy=':scope > .comment-menu > .nsu-content-actions > button[aria-label="复制这条回复的链接"]';await expect(opening.locator(copy)).toHaveCount(0);await expect(opening.locator(':scope > .comment-menu > .nsu-content-actions')).toHaveCount(0);await expect(opening.getByRole('button',{name:'复制代码',exact:true})).toHaveCount(1);
 for(const floor of ['1','2','4','6'])await expect(page.locator(`.comments .content-item[id="${floor}"]`).locator(copy)).toHaveCount(1);
 const preserved=await opening.evaluate(n=>{window.originalOpening=n;window.originalOpeningActions=[...n.querySelectorAll(':scope > .comment-menu .menu-item')];return window.originalOpeningActions.length});expect(preserved).toBe(6);
 // Refresh also removes the obsolete extension control without removing unrelated controls.
 await opening.evaluate(n=>{const controls=document.createElement('div');controls.className='nsu-content-actions';controls.dataset.nsuOwned='';const stale=document.createElement('button');stale.type='button';stale.className='nsu-copy-link';stale.setAttribute('aria-label','复制这条回复的链接');stale.textContent='复制这条回复的链接';controls.append(stale);n.querySelector(':scope > .comment-menu').prepend(controls);window.__SEEKFLOW__.refresh();});
 await expect(opening.locator(copy)).toHaveCount(0);await expect(opening.locator(':scope > .comment-menu > .nsu-content-actions')).toHaveCount(0);expect(await opening.evaluate(n=>window.originalOpening===n&&window.originalOpeningActions.every(x=>x.isConnected))).toBe(true);
 await page.evaluate(()=>window.__SEEKFLOW__.refresh());await expect(page.locator('.content-item[id="2"]').locator(copy)).toHaveCount(1);expect(await page.evaluate(()=>window.nativeActions.submits)).toBe(0);await page.evaluate(()=>window.__SEEKFLOW__.destroy());await expect(opening.locator(':scope > .comment-menu .menu-item')).toHaveCount(preserved);expect(await opening.evaluate(n=>window.originalOpeningActions.every(x=>x.isConnected))).toBe(true);
});
