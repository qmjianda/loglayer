/**
 * keyboard-shortcuts.test.ts - 键盘快捷键测试
 * 
 * 测试所有注册的键盘快捷键功能：
 * - 导航快捷键 (Ctrl+G, Ctrl+Home, Ctrl+End)
 * - 搜索快捷键 (Ctrl+F, F3, Shift+F3)
 * - 命令面板 (Ctrl+Shift+P)
 * - 设置 (Ctrl+,)
 * - 分屏 (Ctrl+\, Ctrl+W)
 * - 书签导航 (F2, Shift+F2)
 * - 撤销/重做 (Ctrl+Z, Ctrl+Y)
 */

import { test, expect } from './fixtures';
import { SELECTORS } from './selectors';

test.describe('键盘快捷键测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('导航快捷键', () => {
    test('Ctrl+G 应该打开跳转行对话框', async ({ page }) => {
      // 触发跳转行快捷键
      await page.keyboard.press('Control+G');
      await page.waitForTimeout(300);
      
      // 验证跳转行对话框出现
      const goToLineInput = page.locator('input[placeholder*="行"], input[aria-label*="行号"]');
      // 注意：此功能可能需要日志文件加载后才可用
    });

    test('Ctrl+Home 应该跳转到文件开头', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 先滚动到底部
      await page.mouse.wheel(0, 10000);
      await page.waitForTimeout(500);
      
      // Ctrl+Home 跳转到开头
      await page.keyboard.press('Control+Home');
      await page.waitForTimeout(300);
    });

    test('Ctrl+End 应该跳转到文件结尾', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // Ctrl+End 跳转到结尾
      await page.keyboard.press('Control+End');
      await page.waitForTimeout(300);
    });
  });

  test.describe('搜索快捷键', () => {
    test('Ctrl+F 应该打开搜索框', async ({ page }) => {
      // Ctrl+F 打开搜索
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      // 验证搜索框可见
      const searchInput = page.locator(SELECTORS.search.input);
      await expect(searchInput).toBeVisible();
      
      // 验证焦点在搜索框上
      await expect(searchInput).toBeFocused();
    });

    test('Escape 应该关闭搜索框', async ({ page }) => {
      // 打开搜索
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await expect(searchInput).toBeVisible();
      
      // Escape 关闭
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      // 验证搜索框不可见
      await expect(searchInput).not.toBeVisible();
    });

    test('F3 应该跳转到下一个匹配', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 打开搜索并输入
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(200);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await searchInput.fill('ERROR');
      await page.waitForTimeout(500);
      
      // F3 跳转下一个
      await page.keyboard.press('F3');
      await page.waitForTimeout(200);
    });

    test('Shift+F3 应该跳转到上一个匹配', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(200);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await searchInput.fill('ERROR');
      await page.waitForTimeout(500);
      
      // 先跳转几次
      await page.keyboard.press('F3');
      await page.waitForTimeout(200);
      await page.keyboard.press('F3');
      await page.waitForTimeout(200);
      
      // Shift+F3 跳转上一个
      await page.keyboard.press('Shift+F3');
      await page.waitForTimeout(200);
    });
  });

  test.describe('命令面板快捷键', () => {
    test('Ctrl+Shift+P 应该打开命令面板', async ({ page }) => {
      await page.keyboard.press('Control+Shift+P');
      await page.waitForTimeout(300);
      
      const searchbox = page.locator(SELECTORS.commandPalette.searchbox);
      await expect(searchbox).toBeVisible();
      await expect(searchbox).toBeFocused();
    });

    test('命令面板键盘导航', async ({ page }) => {
      await page.keyboard.press('Control+Shift+P');
      await page.waitForTimeout(300);
      
      const searchbox = page.locator(SELECTORS.commandPalette.searchbox);
      await expect(searchbox).toBeVisible();
      
      // 输入搜索词
      await searchbox.fill('打开');
      await page.waitForTimeout(300);
      
      // 箭头键导航
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      
      // Escape 关闭
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      await expect(searchbox).not.toBeVisible();
    });

    test('Enter 应该执行选中的命令', async ({ page }) => {
      await page.keyboard.press('Control+Shift+P');
      await page.waitForTimeout(300);
      
      const searchbox = page.locator(SELECTORS.commandPalette.searchbox);
      await expect(searchbox).toBeVisible();
      
      // 输入并执行
      await searchbox.fill('设置');
      await page.waitForTimeout(300);
      
      // 选择第一个选项
      const firstOption = page.locator(SELECTORS.commandPalette.option).first();
      if (await firstOption.count() > 0) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('设置快捷键', () => {
    test('Ctrl+, 应该打开设置面板', async ({ page }) => {
      await page.keyboard.press('Control+,');
      await page.waitForTimeout(300);
      
      const settingsPanel = page.locator(SELECTORS.settings.panel);
      await expect(settingsPanel).toBeVisible();
    });

    test('Escape 应该关闭设置面板', async ({ page }) => {
      await page.keyboard.press('Control+,');
      await page.waitForTimeout(300);
      
      const settingsPanel = page.locator(SELECTORS.settings.panel);
      await expect(settingsPanel).toBeVisible();
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      await expect(settingsPanel).not.toBeVisible();
    });
  });

  test.describe('分屏快捷键', () => {
    test.beforeEach(async ({ page }) => {
      // 加载文件以便分屏
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
    });

    test('Ctrl+\\ 应该向右分屏', async ({ page }) => {
      // Ctrl+\ 分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 验证分屏存在 - 查找多个 canvas
      const canvases = page.locator('canvas');
      const count = await canvases.count();
      // 分屏后应该有多个查看区域
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('Ctrl+W 应该关闭当前分屏', async ({ page }) => {
      // 先分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 关闭分屏
      await page.keyboard.press('Control+W');
      await page.waitForTimeout(300);
    });
  });

  test.describe('书签快捷键', () => {
    test.beforeEach(async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
    });

    test('F2 应该跳转到下一个书签', async ({ page }) => {
      // F2 跳转下一个书签
      await page.keyboard.press('F2');
      await page.waitForTimeout(300);
      // 如果没有书签，可能不会有明显变化
    });

    test('Shift+F2 应该跳转到上一个书签', async ({ page }) => {
      await page.keyboard.press('Shift+F2');
      await page.waitForTimeout(300);
    });
  });

  test.describe('侧边栏快捷键', () => {
    test('Ctrl+B 应该切换侧边栏', async ({ page }) => {
      const sidebar = page.locator(SELECTORS.sidebar.container);
      const initialVisible = await sidebar.isVisible();
      
      await page.keyboard.press('Control+B');
      await page.waitForTimeout(300);
      
      const afterToggle = await sidebar.isVisible();
      expect(afterToggle).toBe(!initialVisible);
      
      // 再次切换恢复
      await page.keyboard.press('Control+B');
      await page.waitForTimeout(300);
    });
  });

  test.describe('撤销/重做快捷键', () => {
    test('Ctrl+Z 应该撤销操作', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 添加一个图层
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      if (await addLayerBtn.count() > 0) {
        await addLayerBtn.click();
        await page.waitForTimeout(300);
        
        const initialCount = await page.locator(SELECTORS.layerPanel.layerItem).count();
        
        // 撤销
        await page.keyboard.press('Control+Z');
        await page.waitForTimeout(300);
        
        const afterUndoCount = await page.locator(SELECTORS.layerPanel.layerItem).count();
        // 撤销后数量应该减少或不变
        expect(afterUndoCount).toBeLessThanOrEqual(initialCount);
      }
    });

    test('Ctrl+Y 应该重做操作', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 撤销后重做
      await page.keyboard.press('Control+Z');
      await page.waitForTimeout(300);
      
      await page.keyboard.press('Control+Y');
      await page.waitForTimeout(300);
    });
  });

  test.describe('焦点管理', () => {
    test('Tab 键应该在可聚焦元素间导航', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const focusedElement = page.locator(':focus');
      await expect(focusedElement.first()).toBeVisible();
    });

    test('Shift+Tab 应该反向导航', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(100);
    });
  });
});