/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const settingsButton = page => page.locator('#nsu-header-actions button[aria-label="阅读设置"]');
async function open(page, url = '/') { await page.goto(url); await expect(page.locator('html')).toHaveAttribute('data-nsu-enabled', 'true'); }
async function preferences(page) { await settingsButton(page).click(); await expect(page.getByRole('dialog')).toBeVisible(); }
async function close(page) { await page.getByRole('button', { name: '关闭', exact: true }).click(); }

test('feed preserves native links, separates search scopes, and keyboard native sorter', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  await expect(page.locator('.post-list:not(.topic-carousel-panel) > li')).toHaveCount(18);
  await expect(page.locator('.post-title a[href="/post-101-1"]')).toContainText('Komari');
  await expect(page.locator('#search-site2')).toHaveAttribute('aria-label', '原站论坛搜索');
  await page.getByRole('searchbox', { name: '筛选当前页帖子' }).fill('Komari');
  await expect(page.locator('.post-list:not(.topic-carousel-panel) > li:visible')).toHaveCount(1);
  await expect(page.locator('#nsu-feed-status')).toContainText('不会搜索未加载的页面');
  await page.getByRole('searchbox', { name: '筛选当前页帖子' }).fill('no-matching-title'); await expect(page.locator('#nsu-feed-empty')).toBeVisible();
  await page.getByRole('searchbox', { name: '筛选当前页帖子' }).fill('');
  await page.locator('[data-sort="postTime"]').focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.nativeActions.sorts)).toBe(1); expect(errors).toEqual([]);
});

test('local read-later persists, has honest labeling and removable entries', async ({ page }) => {
  await open(page); await page.locator('.nsu-save-button').first().click(); await expect(page.locator('.nsu-save-button').first()).toHaveAttribute('aria-pressed', 'true');
  await page.reload(); await expect(page.locator('.nsu-save-button').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.category-list button[aria-label="稍后读"]').click();
  await expect(page.getByRole('dialog')).toContainText('不会修改原站收藏'); await expect(page.locator('.nsu-saved-item')).toHaveCount(1);
  await page.getByRole('button', { name: '移除', exact: true }).click(); await expect(page.locator('.nsu-saved-item')).toHaveCount(0); await close(page);
  await expect(page.locator('.nsu-save-button').first()).toHaveAttribute('aria-pressed', 'false');
});

test('settings theme, density and font persist with contrast-friendly dark palette', async ({ page }) => {
  await open(page); await preferences(page); await page.locator('#nsu-setting-theme').selectOption('dark');
  await page.locator('#nsu-setting-density').selectOption('compact'); await page.locator('#nsu-setting-fontSize').selectOption('19');
  await expect(page.locator('html')).toHaveAttribute('data-nsu-theme', 'dark'); await close(page); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-nsu-density', 'compact'); await expect(page.locator('html')).toHaveAttribute('data-nsu-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nsu-font-size').trim())).toBe('19px');
});

test('system theme follows OS and removed command palette has no shortcut listener', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await open(page); await expect(page.locator('html')).toHaveAttribute('data-nsu-theme','dark');
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveAttribute('data-nsu-theme','light');
  await page.keyboard.press('Control+k'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'快捷导航',exact:true})).toHaveCount(0);
});

test('modal traps focus, Escape restores focus, background scroll is restored', async ({ page }) => {
  await open(page); const before = await page.evaluate(() => document.body.style.overflow); await preferences(page);
  await page.getByRole('button', { name: '恢复原版界面' }).focus(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(settingsButton(page)).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(before);
});

test('post keeps native action identities, does not submit, comment reply floats the native editor', async ({ page }) => {
  await open(page, '/post-100-1'); expect(await page.evaluate(() => window.nativeActions)).toEqual({ votes: 0, replies: 0, submits: 0, sorts: 0 });
  await expect(page.locator('#nsu-reading-toolbar button[aria-label="回复"]')).toHaveCount(0);
  await page.locator('.content-item[id="1"] > .comment-menu .menu-item[title="回复"]').click(); await expect(page.locator('#editor')).toHaveAttribute('data-nsu-floating','true'); await expect(page.locator('#editor textarea')).toBeFocused();
  await page.getByRole('button',{name:'收起编辑器',exact:true}).click();
  await page.locator('.comments .menu-item[title="点赞"]').first().focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.nativeActions.votes)).toBe(1); expect(await page.evaluate(() => window.nativeActions.submits)).toBe(0);
  await expect(page.locator('#nodeimage-status')).toContainText('NodeImage');
});

test('poster filter, signatures and native hot comments are separate from chronology', async ({ page }) => {
  await open(page, '/post-100-1'); await expect(page.locator('.nsu-hot-comment')).toHaveCount(2);
  await page.getByRole('button', { name: '只看楼主', exact: true }).click(); await expect(page.locator('.comments .content-item:not(.nsu-thread-context-only):visible')).toHaveCount(3);
  await expect(page.locator('#nsu-comment-status')).toContainText('已加载回复');
  await page.getByRole('button', { name: '只看楼主', exact: true }).click();
  const signature = page.locator('.signature').first(); await expect(signature).toBeHidden();
  await page.getByRole('button', { name: '展开签名', exact: true }).first().click(); await expect(signature).toBeVisible();
  await preferences(page); await page.locator('#nsu-setting-signatures').uncheck(); await close(page); await expect(page.locator('.signature:visible')).toHaveCount(2);
});

for(const width of [1432,390])test(`chronological comments have no eye controls and preserve native links ${width}`, async ({ page }) => {
  await page.setViewportSize({width,height:815});
  await page.addInitScript(()=>localStorage.setItem('nsu.settings',JSON.stringify({nested:false,continuous:false,references:true,userDetails:false})));
  await open(page, '/post-100-1'); let requests=0;
  await page.route('**/post-100-2',route=>{requests++;return route.fulfill({status:403,body:'Forbidden'});});
  const assertNoEyes=async()=>{
    await expect(page.locator('.nsu-reference-preview,.nsu-user-context')).toHaveCount(0);
    await expect(page.locator('.comments button[aria-label="预览引用上下文"],.comments button[aria-label$="的本页互动"]')).toHaveCount(0);
  };
  await assertNoEyes();
  await expect(page.locator('.content-item[id="2"] > .post-content a')).toHaveAttribute('href','/post-100-1#1');
  await expect(page.locator('.content-item[id="3"] > .post-content a[href="/post-100-2#12"]')).toHaveAttribute('href','/post-100-2#12');
  await expect(page.locator('.content-item[id="1"] > .nsk-content-meta-info .author-name')).toHaveAttribute('href','/space/101');
  await page.evaluate(()=>{window.savedComment=document.getElementById('2');window.savedAuthor=document.querySelector('.content-item[id="1"] .author-name');document.querySelector('#editor textarea').value='保留草稿';});
  await page.locator('#nsu-discussion-mode').click();await page.locator('#nsu-discussion-mode').click();await assertNoEyes();
  await page.evaluate(()=>{window.__SEEKFLOW__.refresh();window.__SEEKFLOW__.refresh();});await assertNoEyes();
  expect(await page.evaluate(()=>document.getElementById('2')===window.savedComment&&document.querySelector('.content-item[id="1"] .author-name')===window.savedAuthor)).toBe(true);
  await expect(page.locator('#editor textarea')).toHaveValue('保留草稿');
  expect(await page.evaluate(()=>window.nativeActions.votes+window.nativeActions.submits)).toBe(0);
  expect(requests).toBe(0);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-nsu-nested','false');await assertNoEyes();
  await preferences(page);await expect(page.locator('#nsu-setting-references')).toHaveCount(0);await close(page);
});

test('image lightbox and long quote remain keyboard accessible', async ({ page }) => {
  await open(page, '/post-100-1'); const quote = page.locator('.nsu-quote-collapsed'); await expect(quote).toHaveCount(1);
  await page.getByRole('button', { name: '展开长引用' }).click(); await expect(page.locator('.nsu-quote-collapsed')).toHaveCount(0);
  await page.getByRole('button', { name: '放大图片：监控截图' }).focus(); await page.keyboard.press('Enter'); await expect(page.locator('#native-image-viewer')).toBeVisible(); await expect(page.locator('#nsu-lightbox')).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(page.locator('#native-image-viewer')).toHaveCount(0); await expect(page.getByRole('button', { name: '放大图片：监控截图' })).toBeFocused();
});

test('appended chronological comments do not recreate eye controls', async ({ page }) => {
  await page.addInitScript(()=>localStorage.setItem('nsu.settings',JSON.stringify({nested:false,userDetails:false})));
  await page.route('**/post-100-2',r=>r.fulfill({contentType:'text/html',body:'<div class="nsk-post-wrapper"><ul class="comments"><li class="content-item" id="12" data-comment-id="129012"><a class="author-name" href="/space/101">User</a><article class="post-content"><a href="/post-100-1#1">#1</a> 补载内容</article></li></ul></div>'}));
  await open(page,'/post-100-1');await page.locator('#nsu-stream').scrollIntoViewIfNeeded();await expect(page.locator('.nsu-loaded-comment')).toHaveCount(1);
  await expect(page.locator('.nsu-reference-preview,.nsu-user-context')).toHaveCount(0);
  await expect(page.locator('.nsu-loaded-comment > .post-content a')).toHaveAttribute('href',/\/post-100-1#1$/);
  await expect(page.locator('.nsu-loaded-comment > .comment-menu button[aria-label="回复"]')).toBeVisible();
  expect(await page.evaluate(()=>window.nativeActions.votes+window.nativeActions.submits)).toBe(0);
});

test('read progress offers resume but never overwrites a direct floor anchor', async ({ page }) => {
  await open(page, '/post-100-1'); await page.locator('.content-item[id="5"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(1100); await page.reload();
  await expect(page.locator('#nsu-resume')).toBeVisible();
  await page.goto('/post-100-1#2'); await expect(page.locator('html')).toHaveAttribute('data-nsu-enabled','true'); await expect(page.locator('#nsu-resume')).toHaveCount(0); expect(page.url()).toContain('#2');
  await expect.poll(()=>page.locator('.content-item[id="2"]').evaluate(n=>n.getBoundingClientRect().top)).toBeLessThan(170);
});

test('feed return restores scroll and read badges', async ({ page }) => {
  await open(page); const row = page.locator('.post-list:not(.topic-carousel-panel) > li').nth(10); await row.scrollIntoViewIfNeeded(); const y = await page.evaluate(()=>scrollY);
  await row.locator('.post-title a').click(); await expect(page.locator('#nsu-reading-toolbar')).toBeVisible();
  await page.getByRole('link',{name:'全部讨论',exact:true}).click(); await expect(page.locator('#nsu-feed-toolbar')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(y-100); await expect(page.locator('.nsu-read-badge')).toHaveCount(1);
});

test('destroy restores native attributes and removes every generated control', async ({ page }) => {
  await open(page, '/post-100-1'); await preferences(page); await page.getByRole('button', { name: '恢复原版界面' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-nsu-enabled','true'); await expect(page.locator('[data-nsu-owned]')).toHaveCount(0);
  await expect(page.locator('.comments .menu-item').first()).not.toHaveAttribute('role','button'); await expect(page.locator('.comments .signature').first()).toBeVisible();
  await expect(page.locator('.post-content')).toHaveCount(8); expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
});

test('idempotence and hydration observer produce one set of controls', async ({ page }) => {
  await open(page); await page.addScriptTag({url:'/extension/content.js'}); await expect(page.locator('#nsu-feed-toolbar')).toHaveCount(1); await expect(page.locator('.nsu-save-button')).toHaveCount(18);
  await page.evaluate(()=>{const list=document.querySelector('.post-list:not(.topic-carousel-panel)'); const row=list.children[1].cloneNode(true);row.querySelectorAll('[data-nsu-owned]').forEach(n=>n.remove());list.append(row);});
  await expect(page.locator('.nsu-save-button')).toHaveCount(19); await page.waitForTimeout(300); await expect(page.locator('.nsu-save-button')).toHaveCount(19);
});

test('other page and missing nodes gracefully preserve the site', async ({ page }) => {
  const errors = []; page.on('pageerror', e=>errors.push(e.message)); await open(page,'/tests/fixtures/other.html'); await expect(page.locator('#nsu-reading-toolbar')).toHaveCount(0);
  await page.evaluate(()=>document.querySelector('#nsk-body').remove()); await page.evaluate(()=>window.__SEEKFLOW__.refresh()); expect(errors).toEqual([]);
});

for (const width of [390,768,1440]) for (const kind of ['home','post']) test(`${kind} layout ${width}px: no horizontal overflow and legible screenshot`, async ({page})=>{
  await page.setViewportSize({width,height:1000}); await open(page,kind==='home'?'/':'/post-100-1');
  const size = await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})); expect(size.scroll).toBeLessThanOrEqual(size.client+1);
  if(width===390){await page.locator('#nsu-header-actions button[aria-label="分类导航"]').click();await expect(page.locator('#nsk-left-panel-container')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#nsk-left-panel-container')).toBeHidden();}
  await page.screenshot({path:`artifacts/after-${kind}-${width}.png`,fullPage:false});
  await preferences(page); await page.locator('#nsu-setting-theme').selectOption('dark'); await close(page); await page.screenshot({path:`artifacts/after-${kind}-${width}-dark.png`,fullPage:false});
});

test('real MV3 package runs in Chromium isolated content-script world', async () => {
  const extension = path.resolve('extension');
  const context = await chromium.launchPersistentContext('', { channel:'chromium', headless:true, args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`] });
  try {
    await context.route('https://www.nodeseek.com/**', async route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==='/' || pathname.startsWith('/post-')){
        let html=await fs.readFile(pathname==='/'?'tests/fixtures/home.html':'tests/fixtures/post.html','utf8');
        html=html.replace('<link rel="stylesheet" href="/extension/palettes.css">','').replace('<link rel="stylesheet" href="/extension/styles.css">','').replace('<script defer src="/extension/content.js"></script>','');
        await route.fulfill({contentType:'text/html',body:html});
      } else if(pathname.startsWith('/tests/fixtures/')) await route.fulfill({contentType:pathname.endsWith('.css')?'text/css':'text/javascript',body:await fs.readFile('.'+pathname,'utf8')});
      else await route.abort();
    });
    const page=await context.newPage(); await page.goto('https://www.nodeseek.com/'); await expect(page.locator('#nsu-feed-toolbar')).toBeVisible();
    expect(await page.evaluate(()=>!!window.__SEEKFLOW__)).toBe(false);
    await page.locator('.nsu-save-button').first().click(); await page.reload(); await expect(page.locator('.nsu-save-button').first()).toHaveAttribute('aria-pressed','true');
    await preferences(page); await page.getByRole('button',{name:'恢复原版界面'}).click(); await expect(page.locator('#nsu-feed-toolbar')).toHaveCount(0);
    await page.reload(); await expect(page.locator('html')).not.toHaveAttribute('data-nsu-enabled','true');
  } finally {await context.close();}
});

test('reading in another tab updates existing list without reload',async({page,context})=>{
 await page.goto('/');const row=page.locator('.post-list-item').filter({has:page.locator('a[href="/post-100-1"]')}).first();await expect(row.locator('.nsu-read-badge')).toHaveCount(0);
 const post=await context.newPage();await post.goto('/post-100-1');await expect(row.locator('.nsu-read-badge')).toHaveText('读过');await post.close();await page.bringToFront();await expect(row.locator('.nsu-read-badge')).toHaveText('读过');
});
