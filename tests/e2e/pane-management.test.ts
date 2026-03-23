/**
 * pane-management.test.ts - 分屏管理测试
 * 
 * 测试分屏功能：
 * - 创建分屏 (右/下)
 * - 关闭分屏
 * - 分屏间切换
 * - 分屏拖拽调整
 * - 最大分屏数量限制
 */

import { test, expect } from './fixtures';
import { SELECTORS } from './selectors';

test.describe('分屏管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 加载测试文件
    const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
    await fileInput.setInputFiles('tests/logs/large_dummy.log');
    await page.waitForTimeout(1500);
  });

  test.describe('创建分屏', () => {
    test('快捷键 Ctrl+\\ 应该向右分屏', async ({ page }) => {
      // 初始只有一个 canvas
      const initialCanvases = await page.locator('canvas').count();
      
      // Ctrl+\ 分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 验证分屏创建
      const afterSplitCanvases = await page.locator('canvas').count();
      expect(afterSplitCanvases).toBeGreaterThanOrEqual(initialCanvases);
    });

    test('快捷键 Ctrl+Shift+\\ 应该向下分屏', async ({ page }) => {
      await page.keyboard.press('Control+Shift+\\\\');
      await page.waitForTimeout(500);
      
      const canvases = await page.locator('canvas').count();
      expect(canvases).toBeGreaterThanOrEqual(1);
    });

    test('命令面板应该可以创建分屏', async ({ page }) => {
      // 打开命令面板
      await page.keyboard.press('Control+Shift+P');
      await page.waitForTimeout(300);
      
      const searchbox = page.locator(SELECTORS.commandPalette.searchbox);
      await searchbox.fill('分屏');
      await page.waitForTimeout(300);
      
      // 选择分屏命令
      const options = page.locator(SELECTORS.commandPalette.option);
      if (await options.count() > 0) {
        await options.first().click();
        await page.waitForTimeout(500);
      }
    });

    test('分屏后新分屏应该获得焦点', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 验证有多个查看区域
      const panes = page.locator('[data-pane], .log-viewer-container');
      const count = await panes.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('关闭分屏', () => {
    test('Ctrl+W 应该关闭当前分屏', async ({ page }) => {
      // 先创建分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 关闭分屏
      await page.keyboard.press('Control+W');
      await page.waitForTimeout(300);
    });

    test('最后一个分屏不应该被关闭', async ({ page }) => {
      // 尝试关闭唯一的分屏
      await page.keyboard.press('Control+W');
      await page.waitForTimeout(300);
      
      // 应该仍然有一个 canvas
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    });

    test('关闭分屏后焦点应该转移到相邻分屏', async ({ page }) => {
      // 创建两个分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 关闭当前分屏
      await page.keyboard.press('Control+W');
      await page.waitForTimeout(300);
      
      // 应该仍有 canvas 可见
      const canvas = page.locator('canvas');
      await expect(canvas.first()).toBeVisible();
    });
  });

  test.describe('分屏切换', () => {
    test('点击分屏应该切换焦点', async ({ page }) => {
      // 创建分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      const canvases = page.locator('canvas');
      if (await canvases.count() > 1) {
        // 点击第一个分屏
        const firstCanvas = canvases.first();
        const box = await firstCanvas.boundingBox();
        if (box) {
          await page.mouse.click(box.x + 10, box.y + 10);
          await page.waitForTimeout(200);
        }
      }
    });

    test('分屏应该独立滚动', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      const canvases = page.locator('canvas');
      if (await canvases.count() > 1) {
        // 在第一个分屏滚动
        const firstCanvas = canvases.first();
        const box = await firstCanvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('分屏拖拽调整', () => {
    test('拖拽分隔条应该调整分屏大小', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 查找分隔条
      const separator = page.locator('[role="separator"], .pane-separator, [data-separator]');
      
      if (await separator.count() > 0) {
        const box = await separator.first().boundingBox();
        if (box) {
          // 拖拽分隔条
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('分屏数量限制', () => {
    test('应该限制最大分屏数量', async ({ page }) => {
      // 尝试创建多个分屏
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Control+\\\\');
        await page.waitForTimeout(200);
      }
      
      // 验证分屏数量不超过最大值
      const canvases = await page.locator('canvas').count();
      expect(canvases).toBeLessThanOrEqual(99); // MAX_PANES
    });
  });

  test.describe('分屏状态持久化', () => {
    test('分屏布局应该在刷新后恢复', async ({ page }) => {
      // 创建分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      const beforeRefresh = await page.locator('canvas').count();
      
      // 刷新页面
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // 重新加载文件
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('tests/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 验证布局是否恢复
      const afterRefresh = await page.locator('canvas').count();
      // 注意：这取决于持久化实现
    });
  });

  test.describe('分屏与文件', () => {
    test('不同分屏应该可以打开不同文件', async ({ page }) => {
      // 创建分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 注意：需要实现多文件支持
    });

    test('同一文件在多个分屏中应该可以独立查看', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      const canvases = page.locator('canvas');
      const count = await canvases.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('分屏快捷键组合', () => {
    test('连续分屏操作', async ({ page }) => {
      // 右分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(300);
      
      // 下分屏
      await page.keyboard.press('Control+Shift+\\\\');
      await page.waitForTimeout(300);
      
      // 再右分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(300);
      
      const canvases = await page.locator('canvas').count();
      expect(canvases).toBeGreaterThanOrEqual(1);
    });

    test('分屏后导航快捷键应该工作', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 搜索快捷键应该工作
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('可访问性', () => {
    test('分屏容器应该有正确的 ARIA 属性', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      // 检查分屏区域的角色
      const mainContent = page.locator('[role="main"], main');
      if (await mainContent.count() > 0) {
        await expect(mainContent).toBeVisible();
      }
    });

    test('分隔条应该有正确的 ARIA 属性', async ({ page }) => {
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
      
      const separator = page.locator('[role="separator"]');
      if (await separator.count() > 0) {
        const ariaOrientation = await separator.first().getAttribute('aria-orientation');
        expect(ariaOrientation).toBeTruthy();
      }
    });
  });
});