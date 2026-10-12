/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
const setup=async page=>{await page.route('**/post-100-2',route=>route.fulfill({contentType:'text/html',body:'<li class="content-item" id="12"><a class="author-name">Other Author</a><article class="post-content"><p>跨页引用无需点击</p><script>window.hacked=true</script><img src="https://tracker.invalid/x" onerror="window.hacked=true"><iframe src="https://tracker.invalid"></iframe></article></li>'}));await page.goto('/post-100-1');await expect(page.locator('#nsu-discussion-mode')).toBeVisible();};
test('explicit replies nest using original nodes, mode persists and rollback restores exact native order',async({page})=>{
  await setup(page);await expect(page.locator('.content-item[id="2"]')).toHaveAttribute('data-nsu-thread-parent','1');await expect(page.locator('.content-item[id="4"]')).toHaveAttribute('data-nsu-thread-parent','1');
  await expect(page.locator('.content-item[id="1"] > .nsu-thread-children > .content-item')).toHaveCount(2);await expect(page.locator('.content-item[id="2"] .nsu-reply-to').first()).toContainText('回复 @Noomi');
  await page.evaluate(()=>{window.replyNode=document.getElementById('2');document.querySelector('#editor textarea').value='保留草稿';});
  await page.locator('#nsu-discussion-mode').click();await expect(page.locator('html')).toHaveAttribute('data-nsu-nested','false');
  expect(await page.locator('.comments > .content-item').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual(['1','2','3','4','5','6','11']);
  expect(await page.evaluate(()=>document.getElementById('2')===window.replyNode)).toBe(true);await expect(page.locator('#editor textarea')).toHaveValue('保留草稿');
  await page.locator('#nsu-discussion-mode').click();await expect(page.locator('.content-item[id="2"]')).toHaveAttribute('data-nsu-thread-parent','1');
  await page.locator('.content-item[id="2"] > .comment-menu .menu-item[title="点赞"]').click();expect(await page.evaluate(()=>window.nativeActions.votes)).toBe(1);
  await page.locator('#nsu-discussion-mode').click();await page.reload();await expect(page.locator('#nsu-discussion-mode')).toContainText('按时间浏览');
  await page.evaluate(()=>window.__SEEKFLOW__.destroy());expect(await page.locator('.comments > .content-item').evaluateAll(nodes=>nodes.map(n=>n.id))).toEqual(['11','4','1','2','3','5','6']);await expect(page.locator('[data-nsu-thread-container]')).toHaveCount(0);
});
test('visible missing parent displays sanitized inline context without a preview click',async({page})=>{
  let requests=0;await page.route('**/post-100-2',route=>{requests++;return route.fulfill({contentType:'text/html',body:'<li class="content-item" id="12"><a class="author-name">Other Author</a><article class="post-content"><p>跨页引用无需点击</p><script>window.hacked=true</script><img src="https://tracker.invalid/x"><iframe src="https://tracker.invalid"></iframe></article></li>'});});
  await page.goto('/post-100-1');await page.locator('.content-item[id="3"] > .nsu-inline-reference').scrollIntoViewIfNeeded();
  await expect(page.locator('.content-item[id="3"] > .nsu-inline-reference')).toContainText('跨页引用无需点击');expect(requests).toBe(1);await expect(page.locator('.nsu-inline-reference script,.nsu-inline-reference img,.nsu-inline-reference iframe')).toHaveCount(0);expect(await page.evaluate(()=>window.hacked)).toBeUndefined();
  await expect(page.locator('.nsu-reference-preview,.nsu-user-context')).toHaveCount(0);
});
test('ambiguous mentions and circular references do not fabricate a thread',async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const set=(id,html)=>document.querySelector(`.content-item[id="${id}"] > .post-content`).innerHTML=html;
    set('1','<p><a href="/post-100-1#2">#2</a> circular A</p>');set('2','<p><a href="/post-100-1#1">#1</a> circular B</p>');
    set('4','<p><a href="/member?t=Noomi">@Noomi</a> 只提及用户</p>');set('5','<p><a href="/post-100-1#1">#1</a><a href="/post-100-1#2">#2</a> 多个引用</p>');window.__SEEKFLOW__.refresh();
  });
  for(const id of ['1','2','4','5']) await expect(page.locator(`.content-item[id="${id}"]`)).not.toHaveAttribute('data-nsu-thread-parent',/./);
  await expect(page.locator('.content-item[id="4"] > .post-content')).toContainText('@Noomi');
});
test('search geometry stays fixed on repeated hover and focus, mobile menu opens without moving search geometry',async({page})=>{
  await page.setViewportSize({width:1432,height:815});await page.goto('/');await page.addStyleTag({content:'header .search-box:hover{flex:1 1 170px;max-width:290px;transition:1s}header .search-box input{transition:.5s}'});
  const search=page.locator('.search-box'),before=await search.boundingBox();for(let i=0;i<4;i++){await search.hover();await page.mouse.move(20,100);}
  await page.locator('#search-site2').focus();const after=await search.boundingBox();expect(after.width).toBe(before.width);expect(after.x).toBe(before.x);expect(await search.evaluate(n=>getComputedStyle(n).transitionDuration)).toBe('0s');
  await expect(page.locator('[aria-controls="nsk-left-panel-container"]')).toBeHidden();await page.setViewportSize({width:390,height:815});await page.locator('[aria-controls="nsk-left-panel-container"]').click();await expect(page.locator('#nsk-left-panel-container')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#nsk-left-panel-container')).toBeHidden();
});
test('native submit text is vertically centered without submitting',async({page})=>{
  await setup(page);await page.addStyleTag({content:'.topic-select .submit{height:25px;line-height:25px;padding:0 16px}'});
  const metrics=await page.locator('#editor .submit').evaluate(n=>{const c=getComputedStyle(n);return{height:n.getBoundingClientRect().height,display:c.display,align:c.alignItems,padding:c.paddingTop};});expect(metrics).toEqual({height:36,display:'flex',align:'center',padding:'0px'});expect(await page.evaluate(()=>window.nativeActions.submits)).toBe(0);
});
