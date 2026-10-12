/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import { test, expect } from '@playwright/test';
const chunk = `<div class="nsk-post-wrapper"><div class="comment-container"><ul class="comments"><li class="content-item" id="11" data-comment-id="129011"><div class="author-info"><a class="author-name" href="/space/101">Noomi</a></div><article class="post-content"><p>重复热门回复</p></article></li><li class="content-item" id="12" data-comment-id="129012"><div class="nsk-content-meta-info"><div><div class="author-info"><a class="author-name" href="/space/101">Noomi</a></div><div class="content-info"><span class="date-created">刚刚</span></div></div></div><article class="post-content"><p>续读成功：这是新的一条回复。</p><a href="/post-100-1#1">#1</a><script>window.hacked=true</script><iframe src="https://invalid.test"></iframe></article><div class="comment-menu"><div class="menu-item">回复</div></div></li></ul></div></div>`;

test('scroll continues comments, deduplicates hot replies and keeps correct source URLs', async ({page})=>{
  let requests=0; await page.route('**/post-100-2',route=>{requests++;return route.fulfill({contentType:'text/html',body:chunk});});
  await page.goto('/post-100-1'); await expect(page.locator('#nsu-stream')).toBeVisible(); expect(requests).toBe(0);
  await expect(page.locator('.floor-link-wrapper').first()).toBeVisible(); await expect(page.locator('.post-top-pager').first()).toBeHidden();
  await page.locator('#nsu-stream').scrollIntoViewIfNeeded(); await expect(page.locator('.nsu-loaded-comment')).toHaveCount(1); expect(requests).toBe(1);
  await expect(page.locator('.comments .content-item[id="11"]')).toHaveCount(1);
  await expect(page.locator('.nsu-loaded-comment')).toContainText('续读成功');
  await expect(page.locator('.nsu-loaded-comment > .nsk-content-meta-info .floor-link')).toHaveText('#12');await expect(page.locator('.nsu-loaded-comment > .nsk-content-meta-info .floor-link')).toHaveAttribute('href',/\/post-100-2#12$/);
  await expect(page.locator('.nsu-loaded-comment script,.nsu-loaded-comment iframe,.nsu-loaded-comment > .comment-menu .menu-item')).toHaveCount(0);
  await expect(page.locator('.nsu-loaded-comment a',{hasText:'在原帖查看'})).toHaveAttribute('href',/\/post-100-2#12$/);
  await page.evaluate(()=>{
    let draft='已有草稿，请保留'; const editor=document.querySelector('#editor .CodeMirror');
    editor.CodeMirror={getValue:()=>draft,lastLine:()=>draft.split('\n').length-1,getLine:n=>draft.split('\n')[n]||'',replaceRange:value=>{draft+=value;window.testDraft=draft;},setCursor:()=>{},focus:()=>document.querySelector('#editor textarea').focus()};
  });
  await page.locator('.nsu-loaded-comment button[aria-label="回复"]').click();
  await expect.poll(()=>page.evaluate(()=>window.testDraft)).toContain('已有草稿，请保留');
  expect(await page.evaluate(()=>window.testDraft)).toContain('[查看引用](/post-100-2#12)');
  expect(await page.evaluate(()=>window.nativeActions.submits)).toBe(0);
  await expect(page.locator('.nsu-stream-status')).toContainText('末尾');
  await page.locator('#nsu-header-actions button[aria-label="阅读设置"]').click(); await page.locator('#nsu-setting-continuous').uncheck(); await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect(page.locator('.nsu-loaded-comment')).toHaveCount(0); await expect(page.locator('.post-top-pager').first()).toBeVisible(); await expect(page.locator('.floor-link-wrapper').first()).toBeVisible();
});

test('failed continuous request is paused and only retries on explicit action', async ({page})=>{
  let requests=0;await page.route('**/post-100-2',route=>{requests++;return route.fulfill({status:403,body:'verify'});});
  await page.goto('/post-100-1');await page.locator('#nsu-stream').scrollIntoViewIfNeeded();await expect(page.locator('.nsu-stream-status')).toContainText('未能续读');
  await page.waitForTimeout(300);expect(requests).toBe(1);await page.getByRole('button',{name:'重试加载'}).click();await expect.poll(()=>requests).toBe(2);
});

test('feed auto-scroll appends real posts once, keeps filters and removes pager', async({page})=>{
  let requests=0;await page.route('**/page-2',route=>{requests++;return route.fulfill({contentType:'text/html',body:'<ul class="post-list"><li class="post-list-item"><div class="post-list-content"><div class="post-title"><a href="/post-101-1">重复</a></div></div></li><li class="post-list-item"><div class="post-list-content"><div class="post-title"><a href="/post-999-1">下一页的技术分享</a></div><div class="post-info"><span class="info-author"><a href="/space/101">Noomi</a></span><a class="post-category" href="/categories/tech">技术</a></div></div></li></ul>'});});
  await page.goto('/');await expect(page.locator('.pager-top').first()).toBeHidden();expect(requests).toBe(0);
  await page.locator('#nsu-stream').scrollIntoViewIfNeeded();await expect(page.locator('.nsu-loaded-row')).toHaveCount(1);await expect(page.locator('.nsu-loaded-row')).toContainText('下一页的技术分享');expect(requests).toBe(1);
  await page.locator('.nsu-feed-search').fill('下一页');await expect(page.locator('.post-list:not(.topic-carousel-panel)>.post-list-item:visible')).toHaveCount(1);
});

test('compact laptop sidebar fits without inner scroll and toolbar consumes one row',async({page})=>{
  await page.setViewportSize({width:1432,height:815});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-nsu-density','compact');
  const metrics=await page.evaluate(()=>{const side=document.querySelector('#nsk-left-panel-container'),list=document.querySelector('.category-list'),ctl=document.querySelector('.post-list-controler');return{sideTop:side.getBoundingClientRect().top,sideBottom:list.getBoundingClientRect().bottom,sideOverflow:getComputedStyle(side).overflowY,toolbar:ctl.getBoundingClientRect().height,first:document.querySelector('.post-list:not(.topic-carousel-panel)>.post-list-item').getBoundingClientRect().top,rows:[...document.querySelectorAll('.post-list:not(.topic-carousel-panel)>li')].filter(n=>n.getBoundingClientRect().bottom<=innerHeight).length};});
  expect(metrics.sideBottom).toBeLessThan(815);expect(metrics.sideOverflow).toBe('visible');expect(metrics.toolbar).toBeLessThan(45);expect(metrics.first).toBeLessThan(200);expect(metrics.rows).toBeGreaterThanOrEqual(8);
});
