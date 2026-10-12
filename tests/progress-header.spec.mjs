/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
for(const width of [1432,390])test(`reading progress stays on header bottom ${width}`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nsu.settings',JSON.stringify({continuous:false,userDetails:false})));await page.setViewportSize({width,height:815});await page.goto('/post-100-1');
 const progress=page.locator('body > header > #nsu-progress');await expect(progress).toHaveCount(1);await expect(progress).toHaveCSS('position','absolute');await expect(progress).toHaveCSS('pointer-events','none');await expect(progress).toHaveAttribute('aria-hidden','true');
 const topControls=await page.locator('#nsk-head').evaluate(n=>{const h=n.getBoundingClientRect();return [...n.querySelectorAll('input,button,a')].filter(x=>x.getClientRects().length).every(x=>{const r=x.getBoundingClientRect();return r.top>=h.top-1&&r.bottom<=h.bottom+1})});expect(topControls).toBe(true);
 const geometry=()=>page.evaluate(()=>{const bar=document.querySelector('#nsu-progress'),head=document.querySelector('#nsk-head').closest('header');return {bottom:bar.getBoundingClientRect().bottom,headBottom:head.getBoundingClientRect().bottom,headTop:head.getBoundingClientRect().top,headHeight:head.getBoundingClientRect().height,progress:Number(getComputedStyle(bar).transform.match(/^matrix\(([^,]+)/)?.[1])}});
 expect((await geometry()).headHeight).toBe(44);
 const shell=await page.evaluate(()=>{const h=document.querySelector('#nsk-head'),outer=h.closest('header');return {innerBottom:h.getBoundingClientRect().bottom,outerBottom:outer.getBoundingClientRect().bottom}});expect(Math.abs(shell.innerBottom-shell.outerBottom)).toBeLessThanOrEqual(1);
 await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));await expect.poll(async()=>{const g=await geometry();return g.progress;}).toBeGreaterThan(0);
 for(const height of [44,60]){
  await page.evaluate(h=>document.querySelector('#nsk-head').closest('header').style.setProperty('height',`${h}px`,'important'),height);
  for(const y of [500,900]){await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);const g=await geometry();expect(g.headHeight).toBe(height);expect(g.headTop).toBe(0);expect(Math.abs(g.bottom-g.headBottom)).toBeLessThanOrEqual(1);}
 }
 await page.getByRole('button',{name:'专注阅读',exact:true}).click();await expect(progress).toBeHidden();await page.getByRole('button',{name:'退出专注',exact:true}).click();await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));await expect(progress).toBeVisible();await page.evaluate(()=>window.__SEEKFLOW__.refresh());await expect(progress).toHaveCount(1);await page.evaluate(()=>window.__SEEKFLOW__.destroy());await expect(page.locator('#nsu-progress')).toHaveCount(0);await expect(page.locator('body > header')).toHaveCount(1);
});
