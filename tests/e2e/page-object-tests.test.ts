import { test, expect } from './fixtures';

test.describe('LogLayer 基础测试 (Page Object)', () => {
  test('应该加载首页', async ({ logLayer }) => {
    await logLayer.goto();
    await logLayer.waitForLoaded();
    
    await expect(logLayer.root).toBeVisible();
    
    await logLayer.screenshot('page-object-homepage.png');
  });

  test('应该支持响应式布局', async ({ logLayer }) => {
    await logLayer.goto();

    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];

    for (const viewport of viewports) {
      await logLayer.setViewport(viewport.width, viewport.height);
      await expect(logLayer.root).toBeVisible();
    }
  });

  test('应该显示状态栏', async ({ logLayer }) => {
    await logLayer.goto();
    await expect(logLayer.statusBar).toBeVisible();
  });
});

test.describe('LogLayer 侧边栏测试 (Page Object)', () => {
  test('应该显示侧边栏', async ({ logLayer }) => {
    await logLayer.goto();
    await expect(logLayer.sidebar).toBeVisible();
  });
});
