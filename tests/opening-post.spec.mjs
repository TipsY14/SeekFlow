/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test('later page loads missing opening body without losing linked reply',async({page})=>{
 const full=await fs.readFile('tests/fixtures/post.html','utf8');
 await page.route('**/post-100-2',async r=>{await r.fulfill({contentType:'text/html',body:full.replace(/<div class="content-item" id="0"[\s\S]*?(?=<\/div><div class="comment-container")/,'')});});
 await page.goto('/post-100-2#6');
 // Explicitly emulate the native later-page title-only post container.
 await page.evaluate(()=>{document.querySelector('.nsk-post > .content-item')?.remove();window.__SEEKFLOW__.refresh();});
 await expect(page.locator('[data-nsu-opening] .post-content')).toBeVisible();await expect(page.locator('.content-item[id="6"]')).toHaveCount(1);await expect(page.locator('[data-nsu-opening]')).toHaveCount(1);
 await expect(page.locator('[data-nsu-opening] > .comment-menu button[aria-label="复制这条回复的链接"]')).toHaveCount(0);
 await expect(page.locator('.content-item[id="6"] > .comment-menu button[aria-label="复制这条回复的链接"]')).toHaveCount(1);
});
