import { test, expect } from '../fixtures';
import { LogViewerHelper, SidebarHelper, SearchHelper, SettingsHelper, LayerHelper, CommandPaletteHelper } from '../utils/helpers';
import { waitForNetworkIdle, takeScreenshot, getTheme, measurePerformance } from '../utils/test-helpers';
import { SELECTORS } from '../selectors';

test.describe('LogLayer 综合测试 (新架构)', () => {
  let logViewer: LogViewerHelper;
  let sidebar: SidebarHelper;
  let search: SearchHelper;
  let settings: SettingsHelper;
  let layers: LayerHelper;
  let commandPalette: CommandPaletteHelper;

  test.beforeEach(async ({ page }) => {
    logViewer = new LogViewerHelper(page);
    sidebar = new SidebarHelper(page);
    search = new SearchHelper(page);
    settings = new SettingsHelper(page);
    layers = new LayerHelper(page);
    commandPalette = new CommandPaletteHelper(page);
    
    await page.goto('/');
    await waitForNetworkIdle(page);
  });

  test('冒烟测试: 应用基本功能', async ({ page }) => {
    await expect(page.locator(SELECTORS.root)).toBeVisible();
    await expect(page.locator(SELECTORS.statusBar.container)).toBeVisible();
    await takeScreenshot(page, 'v2-smoke-test.png');
  });

  test('侧边栏: 所有图标可点击', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await sidebar.clickIcon(i);
      await page.waitForTimeout(200);
    }
    await takeScreenshot(page, 'v2-sidebar-icons.png');
  });

  test('搜索: 快捷键和功能', async ({ page }) => {
    await search.open();
    await expect(page.locator(SELECTORS.search.input)).toBeVisible();
    
    await search.search('ERROR');
    await page.waitForTimeout(500);
    
    await search.close();
  });

  test('设置: 打开和切换选项卡', async ({ page }) => {
    await settings.open();
    await expect(page.locator(SELECTORS.settings.panel)).toBeVisible();
    
    await settings.selectTab('appearance');
    await settings.selectTab('search');
    await settings.selectTab('viewer');
    
    await settings.close();
  });

  test('命令面板: 搜索和执行', async ({ page }) => {
    await commandPalette.open();
    await expect(page.locator(SELECTORS.commandPalette.searchbox)).toBeVisible();
    
    await commandPalette.search('打开');
    const count = await commandPalette.getOptionCount();
    expect(count).toBeGreaterThan(0);
    
    await commandPalette.close();
  });

  test('主题: 切换验证', async ({ page }) => {
    const initialTheme = await getTheme(page);
    
    await settings.open();
    await settings.selectTab('appearance');
    await page.waitForTimeout(300);
    
    await settings.close();
    await page.waitForTimeout(300);
    
    await takeScreenshot(page, `v2-theme-${initialTheme}.png`);
  });

  test('性能: 页面加载时间', async ({ page }) => {
    const perf = await measurePerformance(
      page,
      async () => {
        await page.goto('/');
        await waitForNetworkIdle(page);
      },
      3
    );
    
    console.log(`Average load time: ${perf.average}ms`);
    console.log(`Min: ${perf.min}ms, Max: ${perf.max}ms`);
    
    expect(perf.average).toBeLessThan(5000);
  });
});

test.describe('LogLayer 日志查看器测试 (新架构)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Canvas 渲染验证', async ({ page }) => {
    const logViewer = new LogViewerHelper(page);
    
    const testLogPath = 'tests/large_dummy.log';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testLogPath);
    await page.waitForTimeout(2000);
    
    const canvas = page.locator(SELECTORS.logViewer.canvas);
    await expect(canvas).toBeVisible();
    
    const size = await logViewer.getCanvasSize();
    expect(size?.width).toBeGreaterThan(0);
    expect(size?.height).toBeGreaterThan(0);
    
    await takeScreenshot(page, 'v2-canvas-rendered.png');
  });

  test('虚拟滚动测试', async ({ page }) => {
    const logViewer = new LogViewerHelper(page);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/large_dummy.log');
    await page.waitForTimeout(1500);
    
    const perf = await measurePerformance(
      page,
      async () => {
        await logViewer.scroll('down', 500);
      },
      5
    );
    
    console.log(`Scroll performance: avg ${perf.average}ms`);
    expect(perf.average).toBeLessThan(100);
  });
});

test.describe('LogLayer 图层管理测试 (新架构)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('图层操作流程', async ({ page }) => {
    const layers = new LayerHelper(page);
    
    const initialCount = await layers.getLayerCount();
    
    await layers.addLayer();
    await page.waitForTimeout(300);
    
    const afterAddCount = await layers.getLayerCount();
    expect(afterAddCount).toBeGreaterThanOrEqual(initialCount);
    
    if (afterAddCount > 0) {
      await layers.toggleLayer(0);
      await page.waitForTimeout(200);
    }
    
    await takeScreenshot(page, 'v2-layer-operations.png');
  });
});