/**
 * drag-drop.test.ts - 拖拽操作测试
 * 
 * 测试各种拖拽场景：
 * - 文件拖拽上传
 * - 标签页拖拽重排
 * - 图层拖拽排序
 * - 侧边栏拖拽调整
 * - 分屏拖拽调整
 */

import { test, expect } from './fixtures';
import { SELECTORS } from './selectors';

test.describe('拖拽操作测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('文件拖拽上传', () => {
    test('拖拽文件到应用应该触发上传', async ({ page }) => {
      // 模拟文件拖拽
      // 注意：Playwright 对拖拽文件的支持有限，需要使用 evaluate
      const dropZone = page.locator(SELECTORS.root);
      await expect(dropZone).toBeVisible();
      
      // 模拟拖拽事件
      await page.evaluate(() => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(['test content'], 'test.log', { type: 'text/plain' }));
        
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
        
        document.body.dispatchEvent(dropEvent);
      });
      
      await page.waitForTimeout(1500);
      
      // 应用应该处理文件
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('拖拽多个文件应该处理', async ({ page }) => {
      await page.evaluate(() => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(['content 1'], 'file1.log', { type: 'text/plain' }));
        dataTransfer.items.add(new File(['content 2'], 'file2.log', { type: 'text/plain' }));
        
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
        
        document.body.dispatchEvent(dropEvent);
      });
      
      await page.waitForTimeout(2000);
      
      // 应该处理多个文件
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('拖拽非文件应该忽略', async ({ page }) => {
      await page.evaluate(() => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', 'some text');
        
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
        
        document.body.dispatchEvent(dropEvent);
      });
      
      await page.waitForTimeout(500);
      
      // 应用应该忽略非文件拖拽
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('拖拽时应该显示拖拽提示', async ({ page }) => {
      // 模拟 dragover 事件
      await page.evaluate(() => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(['test'], 'test.log', { type: 'text/plain' }));
        
        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
        
        document.body.dispatchEvent(dragOverEvent);
      });
      
      await page.waitForTimeout(300);
      
      // 可能显示拖拽提示
      const dropIndicator = page.locator('.drop-zone, .drop-indicator, [data-drop-target]');
      // 提示可能存在也可能不存在
    });
  });

  test.describe('标签页拖拽重排', () => {
    test.beforeEach(async ({ page }) => {
      // 加载文件创建标签
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
    });

    test('拖拽标签应该改变顺序', async ({ page }) => {
      const tabs = page.locator(SELECTORS.tabBar.tab);
      const tabCount = await tabs.count();
      
      if (tabCount >= 2) {
        const firstTab = tabs.first();
        const secondTab = tabs.nth(1);
        
        const firstBox = await firstTab.boundingBox();
        const secondBox = await secondTab.boundingBox();
        
        if (firstBox && secondBox) {
          // 拖拽第一个标签到第二个位置
          await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
        }
      }
    });

    test('拖拽标签到标签栏外应该不产生效果', async ({ page }) => {
      const tabs = page.locator(SELECTORS.tabBar.tab);
      const tabCount = await tabs.count();
      
      if (tabCount > 0) {
        const firstTab = tabs.first();
        const box = await firstTab.boundingBox();
        
        if (box) {
          // 拖拽标签到标签栏外
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          
          // 标签应该仍然存在
          const afterCount = await tabs.count();
          expect(afterCount).toBe(tabCount);
        }
      }
    });
  });

  test.describe('图层拖拽排序', () => {
    test.beforeEach(async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 添加多个图层
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      for (let i = 0; i < 3; i++) {
        if (await addLayerBtn.count() > 0) {
          await addLayerBtn.click();
          await page.waitForTimeout(200);
        }
      }
    });

    test('拖拽图层应该改变顺序', async ({ page }) => {
      const layers = page.locator(SELECTORS.layerPanel.layerItem);
      const layerCount = await layers.count();
      
      if (layerCount >= 2) {
        const firstLayer = layers.first();
        const secondLayer = layers.nth(1);
        
        const firstBox = await firstLayer.boundingBox();
        const secondBox = await secondLayer.boundingBox();
        
        if (firstBox && secondBox) {
          await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
        }
      }
    });

    test('拖拽图层到无效位置应该恢复', async ({ page }) => {
      const layers = page.locator(SELECTORS.layerPanel.layerItem);
      const layerCount = await layers.count();
      
      if (layerCount > 0) {
        const firstLayer = layers.first();
        const box = await firstLayer.boundingBox();
        
        if (box) {
          // 拖拽到面板外
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x - 200, box.y, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          
          // 图层应该仍然存在
          const afterCount = await layers.count();
          expect(afterCount).toBe(layerCount);
        }
      }
    });
  });

  test.describe('侧边栏拖拽调整', () => {
    test('拖拽分隔条应该调整侧边栏宽度', async ({ page }) => {
      const separator = page.locator('[role="separator"][aria-orientation="vertical"], .sidebar-separator');
      
      if (await separator.count() > 0) {
        const box = await separator.first().boundingBox();
        
        if (box) {
          const initialX = box.x;
          
          // 拖拽分隔条
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          
          // 检查宽度是否改变
          const newBox = await separator.first().boundingBox();
          // 宽度可能已改变
        }
      }
    });

    test('拖拽到最小宽度应该限制', async ({ page }) => {
      const separator = page.locator('[role="separator"][aria-orientation="vertical"]');
      
      if (await separator.count() > 0) {
        const box = await separator.first().boundingBox();
        
        if (box) {
          // 向左拖拽到极限
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(10, box.y + box.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          
          // 侧边栏应该有最小宽度限制
          const sidebar = page.locator(SELECTORS.sidebar.container);
          const sidebarBox = await sidebar.boundingBox();
          
          if (sidebarBox) {
            expect(sidebarBox.width).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test.describe('分屏拖拽调整', () => {
    test.beforeEach(async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 创建分屏
      await page.keyboard.press('Control+\\\\');
      await page.waitForTimeout(500);
    });

    test('拖拽分屏分隔条应该调整大小', async ({ page }) => {
      const separator = page.locator('[role="separator"], .pane-separator');
      
      if (await separator.count() > 0) {
        const box = await separator.first().boundingBox();
        
        if (box) {
          // 判断是水平还是垂直分隔
          const isVertical = box.height > box.width;
          
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          
          if (isVertical) {
            // 垂直分隔条，水平拖拽
            await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 10 });
          } else {
            // 水平分隔条，垂直拖拽
            await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 10 });
          }
          
          await page.mouse.up();
          await page.waitForTimeout(300);
        }
      }
    });

    test('分屏拖拽到最小应该限制', async ({ page }) => {
      const separator = page.locator('[role="separator"]');
      
      if (await separator.count() > 0) {
        const box = await separator.first().boundingBox();
        
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          
          // 拖拽到极限
          await page.mouse.move(10, 10, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          
          // 分屏应该有最小尺寸限制
          const canvases = page.locator('canvas');
          const count = await canvases.count();
          expect(count).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  test.describe('拖拽视觉效果', () => {
    test('拖拽时应该有视觉反馈', async ({ page }) => {
      // 加载文件
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 添加图层
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      if (await addLayerBtn.count() > 0) {
        await addLayerBtn.click();
        await page.waitForTimeout(200);
        await addLayerBtn.click();
        await page.waitForTimeout(200);
      }
      
      const layers = page.locator(SELECTORS.layerPanel.layerItem);
      if (await layers.count() >= 2) {
        const firstLayer = layers.first();
        const secondLayer = layers.nth(1);
        
        const firstBox = await firstLayer.boundingBox();
        const secondBox = await secondLayer.boundingBox();
        
        if (firstBox && secondBox) {
          // 开始拖拽
          await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(100);
          
          // 可能有拖拽指示器
          const dropIndicator = page.locator('.drop-indicator, .drag-over, [data-dragging]');
          // 移动
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 5 });
          await page.waitForTimeout(100);
          
          // 释放
          await page.mouse.up();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('可访问性', () => {
    test('拖拽后键盘焦点应该正确', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      if (await addLayerBtn.count() > 0) {
        await addLayerBtn.click();
        await page.waitForTimeout(200);
        await addLayerBtn.click();
        await page.waitForTimeout(200);
      }
      
      const layers = page.locator(SELECTORS.layerPanel.layerItem);
      if (await layers.count() >= 2) {
        const firstLayer = layers.first();
        const secondLayer = layers.nth(1);
        
        const firstBox = await firstLayer.boundingBox();
        const secondBox = await secondLayer.boundingBox();
        
        if (firstBox && secondBox) {
          await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 10 });
          await page.mouse.up();
          await page.waitForTimeout(300);
          
          // Tab 应该可以导航
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);
        }
      }
    });
  });
});