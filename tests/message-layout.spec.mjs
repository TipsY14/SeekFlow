/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('chat theme and composer stay within narrow viewport',async({page})=>{
 await page.setViewportSize({width:390,height:815});await page.goto('/');await page.locator('#nsu-header-actions').waitFor();await page.evaluate(()=>{document.documentElement.dataset.nsuTheme='dark';let n=document.createElement('div');n.className='nsk-notification';n.innerHTML='<div class="message-wrapper" style="margin:0 150px;background:#333"><div class="message-item" style="display:flex"><div class="content-column" style="min-width:0;flex:1"><div class="content text-content" style="background:#bcfcd1">Long message '+ 'abc'.repeat(100)+'</div><div class="msg-time">12:00</div></div></div></div><div class="message-input"><textarea style="background:#ffffee;width:100%">draft</textarea></div>';document.body.append(n)});
 const chat=page.locator('.nsk-notification');expect(await chat.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);await expect(chat.locator('textarea')).toHaveValue('draft');await expect(chat.locator('.message-wrapper')).toHaveCSS('margin-left','0px');expect(await chat.locator('.content').evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe('rgb(188, 252, 209)');
});
