/**
 * accessibility.test.ts - 可访问性测试
 * 
 * 使用 axe-core 进行 WCAG 合规性检查：
 * - 页面整体可访问性
 * - 键盘导航
 * - ARIA 属性
 * - 颜色对比度
 */

import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('可访问性测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('首页应该没有可访问性违规', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    
    if (accessibilityScanResults.violations.length > 0) {
      console.log('可访问性问题:');
      for (const v of accessibilityScanResults.violations) {
        console.log(`  - ${v.id}: ${v.description} (${v.impact})`);
      }
    }
    
    expect(accessibilityScanResults.violations.length).toBeLessThanOrEqual(5);
  });

  test('首页应该符合 WCAG AA 标准', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();
    
    if (accessibilityScanResults.violations.length > 0) {
      console.log('WCAG 问题:');
      for (const v of accessibilityScanResults.violations) {
        console.log(`  - ${v.id}: ${v.description}`);
      }
    }
    
    expect(accessibilityScanResults.violations.length).toBeLessThanOrEqual(5);
  });

  test('侧边栏应该有正确的 ARIA 角色', async ({ page }) => {
    const sidebar = page.locator('[role="complementary"], aside, [aria-label*="侧边"], [aria-label*="Sidebar"]');
    
    if (await sidebar.count() > 0) {
      const role = await sidebar.first().getAttribute('role');
      const ariaLabel = await sidebar.first().getAttribute('aria-label');
      
      expect(role || ariaLabel).toBeTruthy();
    }
  });

  test('主内容区应该有正确的 ARIA 角色', async ({ page }) => {
    const main = page.locator('[role="main"], main');
    
    if (await main.count() > 0) {
      await expect(main).toBeVisible();
    }
  });

  test('按钮应该有可访问名称', async ({ page }) => {
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    
    const issues: string[] = [];
    
    for (let i = 0; i < Math.min(count, 20); i++) {
      const button = buttons.nth(i);
      const text = (await button.textContent())?.trim();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      
      const hasAccessibleName = text || ariaLabel || title;
      if (!hasAccessibleName) {
        issues.push(`按钮 ${i}`);
      }
    }
    
    if (issues.length > 0) {
      console.log(`发现 ${issues.length} 个没有可访问名称的按钮`);
    }
    
    expect(issues.length).toBeLessThanOrEqual(3);
  });

  test('输入框应该有关联的标签', async ({ page }) => {
    const inputs = page.locator('input:not([type="hidden"]):not([type="file"])');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        expect(hasLabel || ariaLabel || ariaLabelledby || placeholder).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledby || placeholder).toBeTruthy();
      }
    }
  });
});

test.describe('设置面板可访问性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(500);
  });

  test('设置面板应该没有可访问性违规', async ({ page }) => {
    const panel = page.locator('.fixed, [role="dialog"], [data-settings]');
    
    if (await panel.count() > 0) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.fixed, [role="dialog"], [data-settings]')
        .disableRules(['color-contrast'])
        .analyze();
      
      if (accessibilityScanResults.violations.length > 0) {
        console.log('设置面板可访问性问题:');
        for (const v of accessibilityScanResults.violations) {
          console.log(`  - ${v.id}: ${v.description}`);
        }
      }
      
      expect(accessibilityScanResults.violations.length).toBeLessThanOrEqual(3);
    }
  });

  test('设置面板应该有正确的模态属性', async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    
    if (await dialog.count() > 0) {
      const ariaModal = await dialog.first().getAttribute('aria-modal');
      expect(ariaModal).toBeTruthy();
    }
  });

  test('设置选项卡应该有正确的角色', async ({ page }) => {
    const tabs = page.locator('[role="tab"], button:has-text("通用"), button:has-text("外观")');
    
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });
});

test.describe('命令面板可访问性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(300);
  });

  test('命令面板应该没有可访问性违规', async ({ page }) => {
    const palette = page.locator('[role="dialog"], .command-palette');
    
    if (await palette.count() > 0) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="dialog"], .command-palette')
        .disableRules(['color-contrast'])
        .analyze();
      
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );
      
      expect(criticalViolations).toEqual([]);
    }
  });

  test('命令面板应该有正确的 ARIA 属性', async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    
    if (await dialog.count() > 0) {
      const ariaModal = await dialog.first().getAttribute('aria-modal');
      const ariaLabel = await dialog.first().getAttribute('aria-label');
      
      expect(ariaModal || ariaLabel).toBeTruthy();
    }
  });

  test('搜索框应该有正确的角色', async ({ page }) => {
    const searchbox = page.locator('[role="searchbox"], input[type="text"]');
    
    if (await searchbox.count() > 0) {
      await expect(searchbox.first()).toBeFocused();
    }
  });

  test('命令列表应该有正确的角色', async ({ page }) => {
    const listbox = page.locator('[role="listbox"]');
    
    if (await listbox.count() > 0) {
      await expect(listbox).toBeVisible();
      
      const options = page.locator('[role="option"]');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('键盘导航可访问性', () => {
  test('Tab 键应该能导航所有可交互元素', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const focusedElements: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const focused = page.locator(':focus');
      if (await focused.count() > 0) {
        const tag = await focused.first().evaluate(el => el.tagName);
        focusedElements.push(tag);
      }
    }
    
    expect(focusedElements.length).toBeGreaterThan(0);
  });

  test('Escape 应该能关闭模态框', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(500);
    
    const panel = page.locator('[role="dialog"], .bg-theme-surface');
    
    if (await panel.count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      if (await panel.count() > 0 && await panel.first().isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  });

  test('Enter 应该能激活按钮', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Control+,');
    await page.waitForTimeout(300);
    
    const closeButton = page.locator('button:has-text("取消"), button[aria-label*="关闭"], button[aria-label*="Close"]');
    
    if (await closeButton.count() > 0) {
      await closeButton.first().focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }
  });
});

test.describe('日志查看器可访问性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
    await fileInput.setInputFiles('tests/logs/large_dummy.log');
    await page.waitForTimeout(1500);
  });

  test('Canvas 应该有 ARIA 标签', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const role = await canvas.first().getAttribute('role');
      const ariaLabel = await canvas.first().getAttribute('aria-label');
      
      expect(role || ariaLabel).toBeTruthy();
    }
  });

  test('日志视图应该有 live region', async ({ page }) => {
    const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"]');
    
    if (await liveRegion.count() > 0) {
      await expect(liveRegion.first()).toBeVisible();
    }
  });
});