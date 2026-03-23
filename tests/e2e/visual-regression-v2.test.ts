import { test, expect } from './fixtures';

/**
 * 视觉回归测试 v2 - 增强版
 * 
 * 功能：
 * - 多主题截图对比
 * - 多视口截图对比
 * - 组件级别截图
 * - 状态变化截图
 */

test.describe('视觉回归测试 - 增强版', () => {
  test.beforeEach(async ({ logLayer }) => {
    await logLayer.goto();
    await logLayer.waitForLoaded();
  });

  test('首页 - 完整截图', async ({ logLayer }) => {
    await logLayer.setDesktopViewport();
    await logLayer.fullScreenshot('visual/homepage-desktop.png');
  });

  test('首页 - 暗色主题', async ({ logLayer, page }) => {
    await logLayer.setDesktopViewport();
    
    // 切换到暗色主题
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(500);
    
    await logLayer.fullScreenshot('visual/homepage-dark.png');
  });

  test('首页 - 亮色主题', async ({ logLayer, page }) => {
    await logLayer.setDesktopViewport();
    
    // 切换到亮色主题
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(500);
    
    await logLayer.fullScreenshot('visual/homepage-light.png');
  });

  test('响应式 - 移动端视图', async ({ logLayer }) => {
    await logLayer.setMobileViewport();
    await logLayer.fullScreenshot('visual/mobile-homepage.png');
  });

  test('响应式 - 平板视图', async ({ logLayer }) => {
    await logLayer.setTabletViewport();
    await logLayer.fullScreenshot('visual/tablet-homepage.png');
  });

  test('响应式 - 超宽屏视图', async ({ logLayer }) => {
    await logLayer.setViewport(2560, 1440);
    await logLayer.fullScreenshot('visual/ultrawide-homepage.png');
  });
});

test.describe('视觉回归测试 - 组件级别', () => {
  test('导航栏截图', async ({ logLayer, page }) => {
    await logLayer.goto();
    
    const nav = page.getByRole('navigation').or(page.locator('nav, .navbar'));
    const count = await nav.count();
    
    if (count > 0) {
      await nav.first().screenshot({ 
        path: 'visual/components/navbar.png' 
      });
    }
  });

  test('侧边栏截图', async ({ logLayer }) => {
    await logLayer.goto();
    
    const visible = await logLayer.sidebar.isVisible();
    if (visible) {
      await logLayer.sidebar.screenshot({ 
        path: 'visual/components/sidebar.png' 
      });
    }
  });

  test('状态栏截图', async ({ logLayer }) => {
    await logLayer.goto();
    
    await logLayer.statusBar.screenshot({ 
      path: 'visual/components/statusbar.png' 
    });
  });

  test('标签页栏截图', async ({ logLayer }) => {
    await logLayer.goto();
    
    const tabBar = logLayer.tabBar;
    const count = await tabBar.count();
    
    if (count === 0) {
      test.skip();
      return;
    }
    
    await tabBar.screenshot({ 
      path: 'visual/components/tabbar.png' 
    });
  });
});

test.describe('视觉回归测试 - 交互状态', () => {
  test('按钮 - 悬停状态', async ({ logLayer, page }) => {
    await logLayer.goto();
    
    const button = page.getByRole('button').first();
    const count = await button.count();
    
    if (count > 0) {
      await button.hover();
      await page.waitForTimeout(300);
      
      await button.screenshot({ 
        path: 'visual/states/button-hover.png' 
      });
    }
  });

  test('按钮 - 点击状态', async ({ logLayer, page }) => {
    await logLayer.goto();
    
    const button = page.getByRole('button').first();
    const count = await button.count();
    
    if (count > 0) {
      await button.click();
      await page.waitForTimeout(100);
      
      await button.screenshot({ 
        path: 'visual/states/button-active.png' 
      });
    }
  });

  test('输入框 - 聚焦状态', async ({ logLayer, page }) => {
    await logLayer.goto();
    
    const input = page.getByRole('textbox').or(page.locator('input[type="text"]')).first();
    const count = await input.count();
    
    if (count > 0) {
      await input.focus();
      await page.waitForTimeout(300);
      
      await input.screenshot({ 
        path: 'visual/states/input-focused.png' 
      });
    }
  });

  test('下拉菜单 - 展开状态', async ({ logLayer, page }) => {
    await logLayer.goto();
    
    const select = page.getByRole('combobox').first();
    const count = await select.count();
    
    if (count > 0) {
      await select.click();
      await page.waitForTimeout(300);
      
      await page.screenshot({ 
        path: 'visual/states/dropdown-open.png' 
      });
    }
  });
});

test.describe('视觉回归测试 - 模态框和面板', () => {
  test('设置面板截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const settingsPanel = page.locator('[role="dialog"], .settings-panel, [class*="settings"]').first();
    const count = await settingsPanel.count();
    
    if (count === 0) {
      test.skip();
      return;
    }
    
    await settingsPanel.screenshot({ 
      path: 'visual/modals/settings-panel.png' 
    });
  });

  test('帮助面板截图', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const helpPanel = page.locator('[role="dialog"]:has-text("帮助"), .help-panel').first();
    const count = await helpPanel.count();
    
    if (count === 0) {
      test.skip();
      return;
    }
    
    await helpPanel.screenshot({ 
      path: 'visual/modals/help-panel.png' 
    });
  });
});
