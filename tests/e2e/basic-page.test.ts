import { test, expect } from '@playwright/test';

/**
 * LogLayer E2E 测试 - 基础页面测试
 * 测试应用的基本加载和核心 UI 元素
 */

test.describe('LogLayer 应用基础测试', () => {
  // 测试前钩子 - 确保应用已加载
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该成功加载首页', async ({ page }) => {
    // 等待页面加载
    await expect(page).toHaveTitle(/LogLayer/);
    
    // 截图保存
    await page.screenshot({ path: 'e2e/screenshots/homepage-loaded.png' });
  });

  test('应该显示主要 UI 元素', async ({ page }) => {
    // 等待应用加载完成
    await page.waitForLoadState('networkidle');
    
    // 检查主要容器是否存在
    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();
    
    // 截图保存
    await page.screenshot({ path: 'e2e/screenshots/main-ui-elements.png' });
  });

  test('应该响应式布局', async ({ page }) => {
    // 测试不同屏幕尺寸
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // 等待响应式布局应用
      
      // 截图保存不同视口
      await page.screenshot({ 
        path: `e2e/screenshots/responsive-${viewport.name}.png` 
      });
      
      // 验证页面仍然可见
      await expect(page.locator('#root')).toBeVisible();
    }
  });
});
