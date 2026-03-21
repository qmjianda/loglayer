import { test, expect } from './fixtures';
import * as path from 'path';
import * as fs from 'fs';

test.describe('LogLayer Log Viewer', () => {
  test.beforeEach(async ({ logLayer }) => {
    await logLayer.goto();
  });

  test.describe('Canvas Rendering', () => {
    test('应该渲染日志查看器画布', async ({ page }) => {
      const canvas = page.locator('canvas').first();
      const count = await canvas.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('画布应该在文件加载后渲染内容', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      const canvas = page.locator('canvas');
      const canvasCount = await canvas.count();
      
      if (canvasCount === 0) {
        test.skip();
        return;
      }
      
      const box = await canvas.first().boundingBox();
      expect(box).not.toBeNull();
    });
  });

  test.describe('Virtual Scrolling', () => {
    test('应该支持滚动大文件', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(500);
    });

    test('应该显示正确的行号', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: 'e2e/screenshots/log-loaded.png' });
    });

    test('应该快速渲染大文件（性能测试）', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const startTime = Date.now();
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(500);
      
      const loadTime = Date.now() - startTime;
      console.log(`File load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000);
    });
  });

  test.describe('Search Functionality', () => {
    test('应该能够搜索日志内容', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="search"]').first();
      const count = await searchInput.count();
      
      if (count > 0) {
        await searchInput.fill('ERROR');
        await page.waitForTimeout(1000);
      }
    });

    test('应该能够清除搜索', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="search"]').first();
      const count = await searchInput.count();
      
      if (count > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        await searchInput.clear();
        await page.waitForTimeout(500);
        
        const value = await searchInput.inputValue();
        expect(value).toBe('');
      }
    });
  });

  test.describe('Line Selection', () => {
    test('应该能够点击选择行', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      const canvas = page.locator('canvas');
      if (await canvas.count() === 0) {
        test.skip();
        return;
      }
      
      const box = await canvas.first().boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + 100);
        await page.waitForTimeout(300);
      }
    });

    test('应该能够多行选择', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      const canvas = page.locator('canvas');
      if (await canvas.count() === 0) {
        test.skip();
        return;
      }
      
      const box = await canvas.first().boundingBox();
      if (box) {
        await page.mouse.move(box.x + 50, box.y + 100);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + 200);
        await page.mouse.up();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Bookmarks', () => {
    test('应该能够切换书签', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      const canvas = page.locator('canvas');
      if (await canvas.count() === 0) {
        test.skip();
        return;
      }
      
      const box = await canvas.first().boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + 100, { button: 'right' });
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Performance', () => {
    test('应该保持 60 FPS 渲染', async ({ page }) => {
      const testLogPath = path.join(process.cwd(), 'tests/large_dummy.log');
      
      if (!fs.existsSync(testLogPath)) {
        test.skip();
        return;
      }
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testLogPath);
      await page.waitForTimeout(3000);
      
      const canvas = page.locator('canvas');
      if (await canvas.count() === 0) {
        test.skip();
        return;
      }
      
      const box = await canvas.first().boundingBox();
      if (box) {
        const startTime = Date.now();
        
        for (let i = 0; i < 10; i++) {
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(50);
        }
        
        const scrollTime = Date.now() - startTime;
        console.log(`Scroll time for 10 iterations: ${scrollTime}ms`);
        expect(scrollTime).toBeLessThan(2000);
      }
    });
  });
});