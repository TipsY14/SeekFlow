/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('credit estimate is bounded, ignores rank bonus, and omits incomplete profiles',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('nsu.settings'))localStorage.setItem('nsu.settings',JSON.stringify({showCreditScore:true}));});
 await page.route('**/api/account/getInfo/*?readme=1',r=>{const id=Number(new URL(r.request().url()).pathname.split('/').pop());return r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,detail:{member_id:id,rank:3,created_at:'2024-01-01T00:00:00Z',nPost:232,nComment:959,coin:3343,stardust:10}})});});
 await page.goto('/post-100-1');const score=page.locator('.nsu-credit-score').first();await expect(score).toHaveText(/^≈\d{1,3}\/100$/);await expect(score).toHaveAttribute('title',/信用估分[\s\S]*非官方参考[\s\S]*不代表可信认证或交易保障/);await expect(score).toHaveAccessibleName(/信用估分/);expect(await score.textContent()).not.toContain('信用估分');expect(await score.textContent()).not.toContain('Beta');expect(await score.getAttribute('title')).not.toContain('Beta');const initial=await score.textContent();const value=Number(initial.match(/(\d+)\/100/)[1]);expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(100);
 await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('nsu.publicProfiles')))).toBe(true);
 await page.evaluate(()=>{const cache=JSON.parse(localStorage.getItem('nsu.publicProfiles'));for(const entry of Object.values(cache))entry.rank=6;localStorage.setItem('nsu.publicProfiles',JSON.stringify(cache));});await page.reload();await expect(score).toHaveText(initial);
 await page.evaluate(()=>{const cache=JSON.parse(localStorage.getItem('nsu.publicProfiles'));for(const entry of Object.values(cache))delete entry.stardust;localStorage.setItem('nsu.publicProfiles',JSON.stringify(cache));});await page.reload();await expect(page.locator('.nsu-credit-score')).toHaveCount(0);
});
