/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('native transfer dialog follows both themes without changing fields or submitting',async({page})=>{
 await page.setViewportSize({width:390,height:700});await page.goto('/');await page.locator('#nsu-header-actions').waitFor();
 await page.evaluate(()=>{
  document.body.classList.add('dark-layout');
  const legacy=document.createElement('style');legacy.textContent='.dark-layout .stardust-panel form{background:#3b3b3b}.stardust-panel input:disabled{color:black!important}.stardust-panel form:hover{background:white}';document.head.append(legacy);
  const panel=document.createElement('div');panel.className='stardust-panel with-mask';panel.style.cssText='display:flex;position:fixed;inset:0;align-items:center;justify-content:center';
  panel.innerHTML='<form class="pure-form"><div><h2>Stardust转账</h2><svg></svg></div><fieldset><legend>数额</legend><input type="number" class="stardust-item-input con-input pure-u-1" placeholder="请输入数额"></fieldset><fieldset><legend>收款人UID</legend><input type="number" value="1234" disabled></fieldset><fieldset><legend>Ref ID</legend><input type="number" value="100"></fieldset><fieldset class="op-buttons"><button class="pure-button pure-button-primary" disabled>发送星辰币</button></fieldset></form>';
  document.body.append(panel);window.transferSubmits=0;panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.transferSubmits++});window.originalTransferInput=panel.querySelector('input');
 });
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.nsuTheme=t,theme);
  const form=page.locator('.stardust-panel form');const before=await form.evaluate(n=>({bg:getComputedStyle(n).backgroundColor,text:getComputedStyle(n).color,surface:getComputedStyle(document.documentElement).getPropertyValue('--nsu-surface').trim()}));
  expect(before.bg).not.toBe(before.text);await form.hover();expect(await form.evaluate(n=>getComputedStyle(n).backgroundColor)).toBe(before.bg);
  expect(await form.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await expect(form.locator('input').nth(1)).toBeDisabled();await expect(form.locator('input').nth(1)).toHaveValue('1234');await expect(form.locator('input').nth(2)).toHaveValue('100');await expect(form.locator('button')).toBeDisabled();await expect(form.locator('input').first()).toHaveCSS('box-shadow','none');
 }
 expect(await page.evaluate(()=>window.transferSubmits)).toBe(0);expect(await page.evaluate(()=>window.originalTransferInput===document.querySelector('.stardust-panel input'))).toBe(true);
});
