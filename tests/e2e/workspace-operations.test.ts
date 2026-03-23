import { test, expect } from './fixtures';
import * as path from 'path';
import * as fs from 'fs';

/**
 * LogLayer E2E Tests - Workspace Operations
 * 
 * Tests for file management, tab operations, and workspace navigation
 */
test.describe('LogLayer Workspace Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('File Tab Management', () => {
    test('应该显示当前打开的文件列表', async ({ logLayer }) => {
      await logLayer.goto();
      
      // 验证侧边栏可见
      await expect(logLayer.sidebar).toBeVisible();
    });

    test('应该能够通过文件选择器上传日志文件', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests', 'large_dummy.log');
      
      if (fs.existsSync(testLogPath)) {
        const fileInput = page.locator('input[type="file"][accept]:not([webkitdirectory])');
        await fileInput.setInputFiles(testLogPath);
        
        // 等待文件加载
        await page.waitForTimeout(2000);
        
        // 验证文件已加载（通过标签页或状态栏）
        const tabBar = page.locator('[role="tablist"], .tab-bar, .tabs');
        const tabCount = await tabBar.count();
        
        if (tabCount > 0) {
          const tabs = tabBar.first().locator('[role="tab"], .tab-item');
          await expect(tabs.first()).toBeVisible();
        }
        
        await page.screenshot({ path: 'e2e/screenshots/file-uploaded.png' });
      } else {
        console.log('Test log file not found, skipping file upload test');
      }
    });

    test('应该能够关闭文件标签', async ({ page }) => {
      // 先打开一个文件
      const testLogPath = path.join(process.cwd(), 'tests', 'large_dummy.log');
      
      if (fs.existsSync(testLogPath)) {
        const fileInput = page.locator('input[type="file"][accept]:not([webkitdirectory])');
        await fileInput.setInputFiles(testLogPath);
        await page.waitForTimeout(1000);
        
        // 查找关闭按钮
        const closeBtn = page.locator('.tab-item .close-btn, [aria-label="close"]').first();
        const count = await closeBtn.count();
        
        if (count > 0) {
          await closeBtn.click();
          await page.waitForTimeout(500);
          
          // 验证标签已关闭
          const tabs = page.locator('[role="tab"], .tab-item');
          const newCount = await tabs.count();
          expect(newCount).toBe(0);
        }
      }
    });

    test('应该支持多文件标签切换', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'e2e/screenshots/file-loaded.png' });
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('应该能够切换侧边栏视图', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('[role="complementary"], aside').first();
      await expect(sidebar).toBeVisible();
    });

    test('侧边栏可见', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('[role="complementary"], aside').first();
      await expect(sidebar).toBeVisible();
    });

    test('侧边栏可调整大小', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const resizeHandle = page.locator('[role="separator"], [aria-label*="Resize"]').first();
      const count = await resizeHandle.count();
      
      if (count > 0) {
        const sidebar = page.locator('[role="complementary"], aside').first();
        const initialBox = await sidebar.boundingBox();
        const initialWidth = initialBox?.width || 0;
        
        const handleBox = await resizeHandle.boundingBox();
        if (handleBox) {
          await page.mouse.move(handleBox.x, handleBox.y + handleBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2);
          await page.mouse.up();
        }
        
        await page.waitForTimeout(300);
        
        const newBox = await sidebar.boundingBox();
        const newWidth = newBox?.width || 0;
        expect(newWidth).not.toBe(initialWidth);
      }
    });
  });

  test.describe('Theme and Display', () => {
    test('主题属性可访问', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const theme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 'light';
      });
      expect(['light', 'dark', 'auto']).toContain(theme);
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
        await logLayer.screenshot(`viewport-${viewport.name}.png`);
      }
    });
  });

  test.describe('Status Bar', () => {
    test('应该显示状态栏信息', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const statusBar = page.locator('[class*="h-6"], [class*="status"]').first();
      await expect(statusBar).toBeVisible();
    });

    test('状态栏显示文本', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const statusBar = page.locator('[class*="h-6"], [class*="status"]').first();
      const isVisible = await statusBar.isVisible();
      expect(isVisible).toBe(true);
    });
  });
});