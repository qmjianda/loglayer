import { test, expect } from '@playwright/test';

/**
 * LogLayer E2E 测试 - 视觉回归测试
 * 捕获关键 UI 状态的截图用于视觉对比
 */

test.describe('LogLayer 视觉回归测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('首页完整截图', async ({ page }) => {
    // 设置标准视口
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    // 全屏截图
    await page.screenshot({ 
      path: 'e2e/screenshots/visual/homepage-full.png',
      fullPage: true 
    });
  });

  test('暗色主题截图', async ({ page }) => {
    // 切换到暗色主题
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(300);
    
    await page.screenshot({ 
      path: 'e2e/screenshots/visual/dark-theme.png',
      fullPage: true 
    });
  });

  test('亮色主题截图', async ({ page }) => {
    // 切换到亮色主题
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(300);
    
    await page.screenshot({ 
      path: 'e2e/screenshots/visual/light-theme.png',
      fullPage: true 
    });
  });

  test('移动端视图截图', async ({ page }) => {
    // 模拟移动设备
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'e2e/screenshots/visual/mobile-view.png',
      fullPage: true 
    });
  });

  test('平板视图截图', async ({ page }) => {
    // 模拟平板设备
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'e2e/screenshots/visual/tablet-view.png',
      fullPage: true 
    });
  });
});
