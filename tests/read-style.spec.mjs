/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('read presentation switches immediately and persists independently of history',async({page,context})=>{
 await page.goto('/');const post=await context.newPage();await post.goto('/post-100-1');const row=page.locator('.post-list-item').filter({has:page.locator('a[href="/post-100-1"]')}).first();await expect(row.locator('.nsu-read-badge')).toHaveText('读过');await post.close();
 await page.getByRole('button',{name:'阅读设置',exact:true}).click();await page.locator('#nsu-setting-readStyle').selectOption('title');await expect(row.locator('.nsu-read-badge')).toHaveCount(0);await expect(row.locator('a[data-nsu-read-title]')).toHaveCount(1);await expect(row).toHaveAttribute('data-nsu-read','true');
 await page.reload();await expect(row.locator('a[data-nsu-read-title]')).toHaveCount(1);await page.getByRole('button',{name:'阅读设置',exact:true}).click();await page.locator('#nsu-setting-readStyle').selectOption('none');await expect(row.locator('a[data-nsu-read-title],.nsu-read-badge')).toHaveCount(0);await expect(row).toHaveAttribute('data-nsu-read','true');
 await page.locator('#nsu-setting-readStyle').selectOption('badge');await expect(row.locator('.nsu-read-badge')).toHaveCount(1);await page.locator('#nsu-setting-history').uncheck();await expect(row.locator('.nsu-read-badge')).toHaveCount(0);
});
