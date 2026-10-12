/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import {test,expect} from '@playwright/test';
test('account menu links and dismissal preserve native content',async({page})=>{await page.goto('/post-100-1');await page.getByRole('button',{name:'我的账户',exact:true}).click();await expect(page.locator('#nsu-account-panel')).toBeVisible();await expect(page.locator('#nsu-account-panel').getByText('我的主题')).toHaveAttribute('href','/space/100#/discussions');await page.keyboard.press('Escape');await expect(page.locator('#nsu-account-panel')).toBeHidden();await page.goto('/');await expect(page.locator('#nsu-account')).toHaveCount(0);});
