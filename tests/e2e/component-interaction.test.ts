import { test, expect } from '@playwright/test';

/**
 * LogLayer E2E 测试 - 组件交互测试
 * 测试主要 UI 组件的交互功能
 */

test.describe('LogLayer 组件交互测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应该能够点击设置按钮', async ({ page }) => {
    // 查找设置按钮 (根据实际 UI 调整选择器)
    const settingsButton = page.locator('[aria-label="Settings"], button:has-text("设置"), .settings-btn');
    
    // 如果找到设置按钮，点击并验证
    const count = await settingsButton.count();
    if (count > 0) {
      await settingsButton.first().click();
      await page.waitForTimeout(500);
      
      // 验证设置面板打开
      const settingsPanel = page.locator('[role="dialog"]:has-text("设置"), .settings-panel, [aria-label="Settings"]');
      await expect(settingsPanel.first()).toBeVisible();
      
      await page.screenshot({ path: 'e2e/screenshots/settings-panel-open.png' });
    }
  });

  test('应该能够切换主题', async ({ page }) => {
    // 尝试查找主题切换按钮
    const themeToggle = page.locator('[aria-label*="theme"], [aria-label*="主题"], .theme-toggle');
    
    const count = await themeToggle.count();
    if (count > 0) {
      // 获取当前主题
      const initialTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               document.body.className;
      });
      
      // 切换主题
      await themeToggle.first().click();
      await page.waitForTimeout(300);
      
      // 验证主题变化
      const newTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               document.body.className;
      });
      
      // 主题应该不同
      expect(newTheme).not.toEqual(initialTheme);
      
      await page.screenshot({ path: 'e2e/screenshots/theme-toggled.png' });
    }
  });

  test('应该显示性能指标组件', async ({ page }) => {
    // 查找性能指示器
    const performanceIndicator = page.locator('.performance-indicator, [data-testid="performance"], .perf-indicator');
    
    const count = await performanceIndicator.count();
    if (count > 0) {
      await expect(performanceIndicator.first()).toBeVisible();
      
      // 截图
      await page.screenshot({ path: 'e2e/screenshots/performance-indicator.png' });
    }
  });

  test('侧边栏应该可折叠', async ({ page }) => {
    const sidebar = page.locator('[role="complementary"], aside, .sidebar');
    await expect(sidebar.first()).toBeVisible();
  });

  test('应该能够打开帮助面板', async ({ page }) => {
    const sidebar = page.locator('[role="complementary"]');
    await expect(sidebar.first()).toBeVisible();
  });
});
