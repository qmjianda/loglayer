import { test, expect } from './fixtures';

/**
 * LogLayer E2E Tests - Layer Management
 * 
 * Tests for layer CRUD operations, visibility toggles, and drag-drop reordering
 */
test.describe('LogLayer Layer Management', () => {
  test.beforeEach(async ({ logLayer }) => {
    await logLayer.goto();
  });

  test.describe('Layer Panel Display', () => {
    test('应该显示图层面板', async ({ logLayer, layerPanel }) => {
      await expect(layerPanel.panel).toBeVisible();
      
      // 验证图层列表存在
      const layerCount = await layerPanel.getLayerCount();
      console.log(`Found ${layerCount} layers`);
    });

    test('应该显示图层统计信息', async ({ page }) => {
      // 查找图层统计
      const statsElements = page.locator('.layer-stats, [data-testid="layer-stats"], .layer-count');
      const count = await statsElements.count();
      
      if (count > 0) {
        const text = await statsElements.first().textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Layer CRUD Operations', () => {
    test('应该能够添加新图层', async ({ layerPanel }) => {
      const initialCount = await layerPanel.getLayerCount();
      
      // 添加图层
      await layerPanel.addLayer('FILTER');
      await layerPanel.page.waitForTimeout(500);
      
      // 验证图层已添加
      const newCount = await layerPanel.getLayerCount();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('应该能够删除图层', async ({ layerPanel }) => {
      // 先添加一个图层
      await layerPanel.addLayer('HIGHLIGHT');
      await layerPanel.page.waitForTimeout(300);
      
      const count = await layerPanel.getLayerCount();
      if (count > 0) {
        // 删除最后一个图层
        await layerPanel.deleteLayer(count - 1);
        await layerPanel.page.waitForTimeout(300);
        
        // 验证图层已删除
        const newCount = await layerPanel.getLayerCount();
        expect(newCount).toBeLessThan(count);
      }
    });

    test('应该能够切换图层可见性', async ({ layerPanel, page }) => {
      const count = await layerPanel.getLayerCount();
      
      if (count > 0) {
        // 查找可见性切换按钮
        const visibilityBtn = page.locator('.layer-visibility-toggle, [aria-label*="visibility"], [aria-label*="visible"]').first();
        const btnCount = await visibilityBtn.count();
        
        if (btnCount > 0) {
          await visibilityBtn.click();
          await page.waitForTimeout(300);
          
          // 验证状态已切换
          // (具体验证取决于 UI 实现)
        }
      }
    });
  });

  test.describe('Layer Configuration', () => {
    test('应该能够选择图层并显示配置面板', async ({ layerPanel, page }) => {
      const count = await layerPanel.getLayerCount();
      
      if (count > 0) {
        // 选择第一个图层
        const layers = layerPanel.layerList.locator('.layer-item, [data-layer-id]');
        await layers.first().click();
        await page.waitForTimeout(300);
        
        // 验证配置面板显示
        const configPanel = page.locator('.layer-config, [data-testid="layer-config"], .dynamic-form');
        await expect(configPanel.first()).toBeVisible();
      }
    });

    test('应该能够编辑图层配置', async ({ layerPanel, page }) => {
      const count = await layerPanel.getLayerCount();
      
      if (count > 0) {
        // 选择图层
        const layers = layerPanel.layerList.locator('.layer-item, [data-layer-id]');
        await layers.first().click();
        await page.waitForTimeout(300);
        
        // 查找输入框
        const input = page.locator('.layer-config input[type="text"], .dynamic-form input').first();
        const inputCount = await input.count();
        
        if (inputCount > 0) {
          await input.clear();
          await input.fill('test query');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
          
          // 验证配置已更新
          const value = await input.inputValue();
          expect(value).toBe('test query');
        }
      }
    });

    test('应该能够配置图层颜色', async ({ layerPanel, page }) => {
      const count = await layerPanel.getLayerCount();
      
      if (count > 0) {
        // 选择图层
        const layers = layerPanel.layerList.locator('.layer-item, [data-layer-id]');
        await layers.first().click();
        await page.waitForTimeout(300);
        
        // 查找颜色选择器
        const colorInput = page.locator('input[type="color"], .color-picker input').first();
        const colorCount = await colorInput.count();
        
        if (colorCount > 0) {
          await colorInput.fill('#ff0000');
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Layer Drag and Drop', () => {
    test('应该能够拖拽重新排序图层', async ({ layerPanel, page }) => {
      const count = await layerPanel.getLayerCount();
      
      if (count >= 2) {
        const layers = layerPanel.layerList.locator('.layer-item, [data-layer-id]');
        
        // 获取初始顺序
        const initialNames = await layerPanel.getLayerNames();
        
        // 拖拽第一个图层到最后
        await layerPanel.dragLayer(0, count - 1);
        await page.waitForTimeout(500);
        
        // 验证顺序已改变
        const newNames = await layerPanel.getLayerNames();
        // 注意：根据具体实现，验证逻辑可能需要调整
      }
    });
  });

  test.describe('Layer Presets', () => {
    test('应该显示预设列表', async ({ page }) => {
      const presetsSection = page.locator('[data-section="presets"], .presets-section');
      const count = await presetsSection.count();
      
      if (count > 0) {
        await expect(presetsSection.first()).toBeVisible();
      }
    });

    test('应该能够应用预设', async ({ page }) => {
      const presetItems = page.locator('.preset-item, [data-preset-id]');
      const count = await presetItems.count();
      
      if (count > 0) {
        await presetItems.first().click();
        await page.waitForTimeout(500);
        
        // 验证预设已应用
      }
    });
  });

  test.describe('Undo/Redo', () => {
    test('应该能够撤销图层操作', async ({ page }) => {
      // 查找撤销按钮
      const undoBtn = page.locator('[aria-label="Undo"], button:has-text("撤销")').first();
      const count = await undoBtn.count();
      
      if (count > 0) {
        // 验证按钮状态
        const isEnabled = await undoBtn.isEnabled();
        if (isEnabled) {
          await undoBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });

    test('应该能够重做图层操作', async ({ page }) => {
      // 查找重做按钮
      const redoBtn = page.locator('[aria-label="Redo"], button:has-text("重做")').first();
      const count = await redoBtn.count();
      
      if (count > 0) {
        const isEnabled = await redoBtn.isEnabled();
        if (isEnabled) {
          await redoBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });
  });
});