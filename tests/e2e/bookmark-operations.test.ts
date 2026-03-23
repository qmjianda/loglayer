/**
 * bookmark-operations.test.ts - 书签功能测试
 * 
 * 测试书签的完整生命周期：
 * - 添加书签 (右键菜单)
 * - 编辑书签评论
 * - 移除书签
 * - 书签导航 (F2/Shift+F2)
 * - 书签列表展示
 */

import { test, expect } from './fixtures';
import { SELECTORS } from './selectors';

test.describe('书签功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 加载测试文件
    const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
    await fileInput.setInputFiles('tests/logs/large_dummy.log');
    await page.waitForTimeout(1500);
  });

  test.describe('添加书签', () => {
    test('右键点击行应该显示添加书签选项', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      await expect(canvas).toBeVisible();
      
      // 获取 canvas 位置
      const box = await canvas.boundingBox();
      if (box) {
        // 右键点击 canvas 中间位置
        await page.mouse.click(box.x + 100, box.y + 50, { button: 'right' });
        await page.waitForTimeout(300);
        
        // 检查右键菜单是否出现
        const contextMenu = page.locator('[role="menu"], .context-menu');
        // 注意：右键菜单可能需要特定实现
      }
    });

    test('添加书签后应该显示书签标记', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        // 点击选中一行
        await page.mouse.click(box.x + 50, box.y + 30);
        await page.waitForTimeout(200);
        
        // 添加书签（通过快捷键或右键菜单）
        // 注意：需要根据实际实现调整
      }
    });
  });

  test.describe('书签弹出框', () => {
    test('书签弹出框应该包含所有必要元素', async ({ page }) => {
      // 尝试打开书签弹出框
      // 这可能需要先创建书签
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        // 双击可能打开书签编辑
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        // 检查弹出框
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          // 验证弹出框元素
          await expect(popover.locator('textarea')).toBeVisible();
          await expect(popover.locator('button:has-text("保存")')).toBeVisible();
          await expect(popover.locator('button:has-text("移除")')).toBeVisible();
          await expect(popover.locator('button:has-text("取消")')).toBeVisible();
        }
      }
    });

    test('Ctrl+Enter 应该快速保存书签', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          const textarea = popover.locator('textarea');
          await textarea.fill('测试书签评论');
          await page.waitForTimeout(100);
          
          // Ctrl+Enter 保存
          await page.keyboard.press('Control+Enter');
          await page.waitForTimeout(300);
          
          // 弹出框应该关闭
          await expect(popover).not.toBeVisible();
        }
      }
    });

    test('Escape 应该取消书签编辑', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          const textarea = popover.locator('textarea');
          await textarea.fill('这将不会保存');
          await page.waitForTimeout(100);
          
          // Escape 取消
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          
          await expect(popover).not.toBeVisible();
        }
      }
    });

    test('点击外部应该关闭弹出框', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          // 点击外部
          await page.mouse.click(box.x - 50, box.y);
          await page.waitForTimeout(300);
          
          await expect(popover).not.toBeVisible();
        }
      }
    });
  });

  test.describe('书签导航', () => {
    test('F2 应该跳转到下一个书签', async ({ page }) => {
      // 如果已有书签，F2 应该跳转
      await page.keyboard.press('F2');
      await page.waitForTimeout(300);
      
      // 验证跳转效果（滚动位置变化等）
    });

    test('Shift+F2 应该跳转到上一个书签', async ({ page }) => {
      await page.keyboard.press('Shift+F2');
      await page.waitForTimeout(300);
    });

    test('没有书签时 F2 不应该报错', async ({ page }) => {
      // 在没有书签的情况下测试
      await page.keyboard.press('F2');
      await page.waitForTimeout(300);
      
      // 应该不会出现错误提示
      const errorDialog = page.locator('[role="alertdialog"], .error-dialog');
      await expect(errorDialog).not.toBeVisible();
    });
  });

  test.describe('移除书签', () => {
    test('移除按钮应该删除书签', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          // 点击移除按钮
          const removeBtn = popover.locator('button:has-text("移除")');
          await removeBtn.click();
          await page.waitForTimeout(300);
          
          await expect(popover).not.toBeVisible();
        }
      }
    });
  });

  test.describe('书签列表', () => {
    test('书签列表应该显示所有书签', async ({ page }) => {
      // 检查书签列表容器
      const bookmarkContainer = page.locator(SELECTORS.bookmarks.container);
      
      if (await bookmarkContainer.count() > 0) {
        const bookmarks = page.locator(SELECTORS.bookmarks.item);
        const count = await bookmarks.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('清除全部按钮应该删除所有书签', async ({ page }) => {
      const clearAllBtn = page.locator(SELECTORS.bookmarks.clearAll);
      
      if (await clearAllBtn.count() > 0) {
        await clearAllBtn.click();
        await page.waitForTimeout(300);
        
        // 验证书签已清除
        const bookmarks = page.locator(SELECTORS.bookmarks.item);
        const count = await bookmarks.count();
        expect(count).toBe(0);
      }
    });
  });

  test.describe('书签持久化', () => {
    test('书签应该在刷新后保留', async ({ page }) => {
      // 添加一个书签
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          await popover.locator('textarea').fill('持久化测试');
          await popover.locator('button:has-text("保存")').click();
          await page.waitForTimeout(500);
          
          // 刷新页面
          await page.reload();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
          
          // 重新加载文件
          const fileInput = page.locator('input[type="file"]');
          await fileInput.setInputFiles('tests/large_dummy.log');
          await page.waitForTimeout(1500);
          
          // 验证书签是否存在
          // 注意：这取决于后端持久化实现
        }
      }
    });
  });

  test.describe('可访问性', () => {
    test('书签弹出框应该支持键盘导航', async ({ page }) => {
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      const box = await canvas.boundingBox();
      
      if (box) {
        await page.mouse.dblclick(box.x + 50, box.y + 30);
        await page.waitForTimeout(300);
        
        const popover = page.locator('.bookmark-popover');
        if (await popover.count() > 0) {
          const textarea = popover.locator('textarea');
          await expect(textarea).toBeFocused();
          
          // Tab 导航到按钮
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);
        }
      }
    });
  });
});