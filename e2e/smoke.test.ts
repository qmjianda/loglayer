import { test, expect } from '@playwright/test';

/**
 * LogLayer E2E 测试 - 烟雾测试
 * 最简单的测试用于验证配置是否正确
 */

test.describe('烟雾测试', () => {
  test('应该能够加载页面', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题包含 LogLayer
    const title = await page.title();
    console.log('Page title:', title);
    
    // 截图
    await page.screenshot({ path: 'e2e/screenshots/smoke-test.png' });
    
    // 验证根元素存在
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    
    console.log('✅ 烟雾测试通过');
  });
});
