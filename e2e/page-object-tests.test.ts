import { test, expect } from './fixtures';

/**
 * LogLayer E2E 测试 - 使用 Page Object 模式重构
 * 
 * 展示如何使用 Page Objects 编写更简洁、可维护的测试
 */

test.describe('LogLayer 基础测试 (Page Object)', () => {
  test('应该加载首页', async ({ logLayer }) => {
    await logLayer.goto();
    await logLayer.waitForLoaded();
    
    // 验证根元素可见
    await expect(logLayer.root).toBeVisible();
    
    // 截图
    await logLayer.screenshot('page-object-homepage.png');
  });

  test('应该支持响应式布局', async ({ logLayer }) => {
    await logLayer.goto();

    // 测试不同视口
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

test.describe('LogLayer 设置功能测试 (Page Object)', () => {
  test('应该能够打开设置面板', async ({ logLayer, settingsPanel }) => {
    await logLayer.goto();
    await logLayer.openSettings();
    
    await settingsPanel.waitForOpen();
    await logLayer.screenshot('settings-panel-open.png');
    
    // 关闭设置面板
    await settingsPanel.close();
    await settingsPanel.waitForClose();
  });

  test('应该能够切换主题', async ({ logLayer }) => {
    await logLayer.goto();
    
    // 获取初始主题
    const initialTheme = await logLayer.getCurrentTheme();
    
    // 切换主题
    await logLayer.toggleTheme();
    const newTheme = await logLayer.getCurrentTheme();
    
    // 验证主题变化
    expect(newTheme).not.toEqual(initialTheme);
    
    await logLayer.screenshot(`theme-${newTheme}.png`);
  });

  test('应该能够搜索日志', async ({ logLayer }) => {
    await logLayer.goto();
    
    // 执行搜索
    await logLayer.search('test');
    await logLayer.screenshot('search-results.png');
    
    // 清除搜索
    await logLayer.clearSearch();
  });

  test('应该能够切换侧边栏', async ({ logLayer }) => {
    await logLayer.goto();
    
    // 获取初始状态
    const initialVisible = await logLayer.sidebar.isVisible();
    
    // 切换侧边栏
    await logLayer.toggleSidebar();
    const newVisible = await logLayer.sidebar.isVisible();
    
    // 验证状态变化
    expect(newVisible).not.toEqual(initialVisible);
    
    await logLayer.screenshot('sidebar-toggled.png');
  });
});

test.describe('LogLayer 标签页测试 (Page Object)', () => {
  test('应该显示标签页栏', async ({ logLayer }) => {
    await logLayer.goto();
    
    const count = await logLayer.getTabCount();
    console.log(`Found ${count} tabs`);
    
    await expect(logLayer.tabBar).toBeVisible();
  });

  test('应该能够切换标签页', async ({ logLayer }) => {
    await logLayer.goto();
    
    const tabCount = await logLayer.getTabCount();
    if (tabCount > 1) {
      // 切换到第二个标签页
      await logLayer.switchToTab(1);
      await logLayer.screenshot('tab-switched.png');
    }
  });
});
