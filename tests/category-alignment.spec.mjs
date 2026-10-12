/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
for(const width of [390,768,1432]) for(const theme of ['light','dark']) test(`category text centered ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:815});await page.goto('/');await page.locator('#nsu-header-actions').waitFor();await page.evaluate(t=>document.documentElement.dataset.nsuTheme=t,theme);
 const label=page.locator('.post-list:not(.topic-carousel-panel) .post-category').first();await expect(label).toHaveCSS('display','flex');await expect(label).toHaveCSS('align-items','center');await expect(label).toHaveCSS('line-height','11px');await expect(label).toHaveCSS('padding-top','0px');await expect(label).toHaveCSS('height','22px');
 const delta=await label.evaluate(n=>{const r=document.createRange();r.selectNodeContents(n);const text=r.getBoundingClientRect(),box=n.getBoundingClientRect();return Math.abs((text.top+text.bottom-box.top-box.bottom)/2)});expect(delta).toBeLessThanOrEqual(2);
});
