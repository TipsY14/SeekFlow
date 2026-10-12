/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test('landing on later page backfills previous comments without dropping current reply',async({page})=>{
 let html=await fs.readFile('tests/fixtures/post.html','utf8');
 await page.route('**/post-100-2',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.route('**/post-100-1',r=>r.fulfill({contentType:'text/html',body:'<ul class="comments"><li class="content-item" id="99" data-comment-id="99000"><a class="author-name" href="/space/101">A</a><article class="post-content">earlier context</article></li></ul>'}));
 await page.goto('/post-100-2#6');await expect(page.locator('.nsu-loaded-comment')).toContainText('earlier context');await expect(page.locator('.content-item[id="6"]')).toHaveCount(1);await expect(page.locator('#nsu-earlier')).toHaveCount(0);
});
const priorRow=(page,index=0)=>{const floor=(page-1)*20+index+1;return `<li class="content-item" id="${floor}" data-comment-id="${129000+floor}"><div class="nsk-content-meta-info"><div><div class="author-info"><a class="author-name" href="/space/101">Earlier User</a></div></div></div><article class="post-content"><p>第 ${page} 页回复 ${floor}</p><p>${'测试讨论文本。'.repeat(35)}</p></article></li>`;};
async function priorFixture(page,start=8){
 const base=await fs.readFile('tests/fixtures/post.html','utf8');
 const current=base.replace(/<ul class="comments">[\s\S]*?<\/ul>/,`<ul class="comments">${Array.from({length:8},(_,i)=>priorRow(start,i)).join('')}</ul>`);
 await page.addInitScript(()=>localStorage.setItem('nsu.settings',JSON.stringify({userDetails:false})));
 await page.route(`**/post-100-${start}`,r=>r.fulfill({contentType:'text/html',body:current}));return current;
}
async function nearEarlier(page){
 // Read below the loaded start, then scroll upwards until the sentinel approaches.
 await page.evaluate(()=>{const n=document.querySelector('#nsu-earlier');window.scrollTo({top:scrollY+n.getBoundingClientRect().top+650,behavior:'instant'});});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.evaluate(()=>window.scrollBy({top:-320,behavior:'instant'}));
}
test('upward browsing automatically batches three pages, deduplicates and holds position after a slow response',async({page})=>{
 await page.setViewportSize({width:1432,height:815});await priorFixture(page);const requests=[];let release,waiting;
 const gate=new Promise(r=>release=r),started=new Promise(r=>waiting=r);
 await page.route(/\/post-100-[1-7]$/,async r=>{const p=Number(r.request().url().match(/-(\d+)$/)[1]);requests.push(p);if(p===5){waiting();await gate;}await r.fulfill({contentType:'text/html',body:`<ul class="comments">${priorRow(p)}${priorRow(p,1)}${priorRow(p,1)}</ul>`});});
 await page.goto('/post-100-8#145');await expect(page.locator('.nsu-loaded-comment')).toHaveCount(4);expect(requests).toEqual([7,6]);await expect(page.locator('#nsu-earlier button')).toBeHidden();
 await nearEarlier(page);await started;
 // The reader changes position while page 5 is fetching; insertion must follow the new position.
 await page.evaluate(()=>{const n=document.querySelector('.content-item[id="145"] > .nsk-content-meta-info');window.scrollTo({top:scrollY+n.getBoundingClientRect().top-170,behavior:'instant'});});
 const before=await page.locator('.content-item[id="145"] > .nsk-content-meta-info').evaluate(n=>n.getBoundingClientRect().top);release();
 await expect(page.locator('.nsu-loaded-comment')).toHaveCount(10);expect(requests).toEqual([7,6,5,4,3]);const after=await page.locator('.content-item[id="145"] > .nsk-content-meta-info').evaluate(n=>n.getBoundingClientRect().top);expect(Math.abs(after-before)).toBeLessThan(3);
 await expect(page.locator('.nsu-earlier-status')).toHaveText('向上滚动自动加载更早评论');await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));expect(requests).toHaveLength(5);
 await nearEarlier(page);await expect(page.locator('#nsu-earlier')).toHaveCount(0);expect(requests).toEqual([7,6,5,4,3,2,1]);await expect(page.locator('.comments .content-item[id="21"]')).toHaveCount(1);await expect(page.locator('.content-item[id="145"]')).toHaveCount(1);expect(await page.evaluate(()=>window.nativeActions.submits)).toBe(0);
});
test('failed earlier batch pauses until retry and respects the continuous discussion switch',async({page})=>{
 await priorFixture(page,5);let attempts=0;
 await page.route('**/post-100-4',r=>{attempts++;return attempts===1?r.fulfill({status:403,body:'verify'}):r.fulfill({contentType:'text/html',body:`<ul class="comments">${priorRow(4)}</ul>`});});
 for(const p of [1,2,3])await page.route(`**/post-100-${p}`,r=>r.fulfill({contentType:'text/html',body:`<ul class="comments">${priorRow(p)}</ul>`}));
 await page.goto('/post-100-5#85');await expect(page.locator('.nsu-earlier-status')).toContainText('未能补载');await nearEarlier(page);await expect(page.getByRole('button',{name:'重试加载前面的评论'})).toBeVisible();expect(attempts).toBe(1);
 await page.getByRole('button',{name:'重试加载前面的评论'}).click();await expect(page.locator('.nsu-loaded-comment')).toHaveCount(3);expect(attempts).toBe(2);await expect(page.locator('.nsu-earlier-source')).toHaveAttribute('href','/post-100-1');
 await page.getByRole('button',{name:'阅读设置',exact:true}).click();await page.locator('#nsu-setting-continuous').uncheck();await page.getByRole('button',{name:'关闭',exact:true}).click();await expect(page.locator('#nsu-earlier,.nsu-loaded-comment')).toHaveCount(0);await expect(page.locator('.content-item[id="85"]')).toHaveCount(1);await expect(page.locator('.post-top-pager').first()).toBeVisible();
});
test('automatic earlier loading is bounded and continues only after explicit extension of the limit',async({page})=>{
 await priorFixture(page,30);const requests=[];
 await page.route(/\/post-100-\d+$/,r=>{const p=Number(r.request().url().match(/-(\d+)$/)[1]);if(p===30)return r.fallback();requests.push(p);return r.fulfill({contentType:'text/html',body:`<ul class="comments">${priorRow(p)}${priorRow(p,1)}</ul>`});});
 await page.goto('/post-100-30#585');await expect(page.locator('.nsu-loaded-comment')).toHaveCount(4);
 for(const count of [10,16,22,28,30]){await nearEarlier(page);await expect(page.locator('.nsu-loaded-comment')).toHaveCount(count);}
 expect(requests).toHaveLength(15);await expect(page.getByRole('button',{name:'继续加载更早评论',exact:true})).toBeVisible();await nearEarlier(page);expect(requests).toHaveLength(15);await page.getByRole('button',{name:'继续加载更早评论',exact:true}).click();await expect(page.locator('.nsu-loaded-comment')).toHaveCount(36);expect(requests).toHaveLength(18);
 await page.evaluate(()=>window.__SEEKFLOW__.destroy());await expect(page.locator('.nsu-loaded-comment,#nsu-earlier')).toHaveCount(0);await expect(page.locator('.content-item[id="585"]')).toHaveCount(1);
});
test('destroy cancels a pending earlier request without inserting late content',async({page})=>{
 await priorFixture(page,4);let release,started;const gate=new Promise(r=>release=r),begin=new Promise(r=>started=r);
 await page.route('**/post-100-3',async r=>{started();await gate;await r.fulfill({contentType:'text/html',body:`<ul class="comments">${priorRow(3)}</ul>`});});await page.goto('/post-100-4#65');await begin;await page.evaluate(()=>window.__SEEKFLOW__.destroy());release();await expect(page.locator('.nsu-loaded-comment,#nsu-earlier')).toHaveCount(0);await expect(page.locator('.content-item[id="65"]')).toHaveCount(1);await expect(page.locator('html')).not.toHaveAttribute('data-nsu-enabled');
});
