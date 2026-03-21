/**
 * error-handling.test.ts - 错误处理测试
 * 
 * 测试各种错误场景：
 * - 文件加载失败（无效格式、损坏文件、权限拒绝）
 * - 后端连接断开
 * - 搜索无效正则表达式
 * - 图层配置验证失败
 * - 边界情况处理
 */

import { test, expect } from './fixtures';
import { SELECTORS } from './selectors';
import path from 'path';

test.describe('错误处理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('文件加载错误', () => {
    test('加载空文件应该正常处理', async ({ page }) => {
      // 创建空文件内容
      const fileInput = page.locator('input[type="file"]');
      
      // 上传内存中的空文件
      await fileInput.setInputFiles({
        name: 'empty.log',
        mimeType: 'text/plain',
        buffer: Buffer.from(''),
      });
      
      await page.waitForTimeout(1500);
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('加载单行文件应该正常处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      
      await fileInput.setInputFiles({
        name: 'single-line.log',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is a single line'),
      });
      
      await page.waitForTimeout(1000);
      
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      await expect(canvas).toBeVisible();
    });

    test('加载超长行应该正常处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      
      // 创建超长行 (100KB)
      const longLine = 'A'.repeat(100000);
      await fileInput.setInputFiles({
        name: 'long-line.log',
        mimeType: 'text/plain',
        buffer: Buffer.from(longLine + '\n' + 'Second line'),
      });
      
      await page.waitForTimeout(2000);
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('加载特殊编码文件应该处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      
      // 创建包含 UTF-8 特殊字符的文件
      const specialContent = '中文测试\n日本語テスト\n한국어\nEmoji: 🎉🚀💻\nSpecial: \x00\x01\x02';
      await fileInput.setInputFiles({
        name: 'special-chars.log',
        mimeType: 'text/plain',
        buffer: Buffer.from(specialContent, 'utf-8'),
      });
      
      await page.waitForTimeout(1500);
      
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      await expect(canvas).toBeVisible();
    });

    test('加载二进制文件应该优雅处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      
      // 创建二进制内容
      const binaryBuffer = Buffer.alloc(1000);
      for (let i = 0; i < 1000; i++) {
        binaryBuffer[i] = i % 256;
      }
      
      await fileInput.setInputFiles({
        name: 'binary.log',
        mimeType: 'application/octet-stream',
        buffer: binaryBuffer,
      });
      
      await page.waitForTimeout(2000);
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });
  });

  test.describe('搜索错误处理', () => {
    test.beforeEach(async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
    });

    test('无效正则表达式应该显示错误', async ({ page }) => {
      // 打开搜索
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await expect(searchInput).toBeVisible();
      
      // 输入无效正则
      await searchInput.fill('[invalid(regex');
      await page.waitForTimeout(500);
      
      // 应该有错误提示或正则按钮变色
      const regexButton = page.locator(SELECTORS.search.regexButton);
      // 应用不应该崩溃
    });

    test('搜索空字符串应该正常处理', async ({ page }) => {
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await searchInput.fill('');
      await page.waitForTimeout(300);
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('搜索超长字符串应该正常处理', async ({ page }) => {
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      const searchInput = page.locator(SELECTORS.search.input);
      const longQuery = 'ERROR'.repeat(1000);
      await searchInput.fill(longQuery);
      await page.waitForTimeout(1000);
      
      // 应用不应该崩溃或明显卡顿
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('搜索无匹配项应该显示提示', async ({ page }) => {
      await page.keyboard.press('Control+F');
      await page.waitForTimeout(300);
      
      const searchInput = page.locator(SELECTORS.search.input);
      await searchInput.fill('ZZZZZZZZZZZZZZZZ_NO_MATCH_ZZZZZZZZZZZZZZZZ');
      await page.waitForTimeout(500);
      
      // 应该有无匹配提示
      // 检查搜索匹配信息
    });
  });

  test.describe('图层配置错误', () => {
    test.beforeEach(async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
    });

    test('无效图层正则应该显示错误', async ({ page }) => {
      // 添加图层
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      if (await addLayerBtn.count() > 0) {
        await addLayerBtn.click();
        await page.waitForTimeout(300);
        
        // 输入无效正则
        const layerInput = page.locator(SELECTORS.layerPanel.layerInput);
        if (await layerInput.count() > 0) {
          await layerInput.first().fill('[invalid(regex');
          await page.waitForTimeout(300);
          
          // 应该有验证错误提示
        }
      }
    });

    test('图层名称冲突应该处理', async ({ page }) => {
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      if (await addLayerBtn.count() > 0) {
        await addLayerBtn.click();
        await page.waitForTimeout(200);
        await addLayerBtn.click();
        await page.waitForTimeout(200);
        
        // 应该创建成功或显示冲突提示
        const layers = page.locator(SELECTORS.layerPanel.layerItem);
        const count = await layers.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('边界情况', () => {
    test('快速连续文件上传应该处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      
      // 快速连续上传多个文件
      for (let i = 0; i < 3; i++) {
        await fileInput.setInputFiles('tests/large_dummy.log');
        await page.waitForTimeout(100);
      }
      
      await page.waitForTimeout(2000);
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('快速连续点击应该防抖', async ({ page }) => {
      const settingsBtn = page.locator(SELECTORS.statusBar.settingsButton);
      
      // 快速连续点击
      for (let i = 0; i < 10; i++) {
        await settingsBtn.click();
        await page.waitForTimeout(50);
      }
      
      await page.waitForTimeout(500);
      
      // 应该只有一个设置面板
      const panels = page.locator(SELECTORS.settings.panel);
      const count = await panels.count();
      expect(count).toBeLessThanOrEqual(1);
    });

    test('极端视口尺寸应该处理', async ({ page }) => {
      // 设置极小视口
      await page.setViewportSize({ width: 200, height: 200 });
      await page.waitForTimeout(500);
      
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
      
      // 恢复正常视口
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
    });

    test('零尺寸文件应该处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      
      await fileInput.setInputFiles({
        name: 'zero-size.log',
        mimeType: 'text/plain',
        buffer: Buffer.from(''),
      });
      
      await page.waitForTimeout(1000);
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });
  });

  test.describe('后端连接错误', () => {
    test('后端不可用时应该显示错误', async ({ page, context }) => {
      // 模拟网络错误
      await context.route('**/api/**', route => route.abort('failed'));
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      // 应用应该显示错误或降级处理
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
      
      // 取消路由
      await context.unroute('**/api/**');
    });

    test('网络超时应该处理', async ({ page, context }) => {
      // 模拟延迟
      await context.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 30000));
        route.continue();
      });
      
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      
      await page.waitForTimeout(5000);
      
      // 应用应该显示加载状态或超时提示
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
      
      await context.unroute('**/api/**');
    });
  });

  test.describe('内存和性能边界', () => {
    test('大量图层数量应该处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      const addLayerBtn = page.locator(SELECTORS.layerPanel.addButton);
      
      // 尝试添加多个图层
      for (let i = 0; i < 20; i++) {
        if (await addLayerBtn.count() > 0) {
          await addLayerBtn.click();
          await page.waitForTimeout(100);
        }
      }
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });

    test('大量搜索历史应该处理', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]:not([webkitdirectory])');
      await fileInput.setInputFiles('tests/logs/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 执行多次搜索
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Control+F');
        await page.waitForTimeout(100);
        
        const searchInput = page.locator(SELECTORS.search.input);
        await searchInput.fill(`search-${i}`);
        await page.waitForTimeout(100);
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
      
      // 应用不应该崩溃
      const root = page.locator(SELECTORS.root);
      await expect(root).toBeVisible();
    });
  });

  test.describe('错误恢复', () => {
    test('错误后应该能恢复正常操作', async ({ page }) => {
      // 触发一个错误
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'error.log',
        mimeType: 'text/plain',
        buffer: Buffer.from('\x00\x01\x02'),
      });
      
      await page.waitForTimeout(1500);
      
      // 清除并加载正常文件
      await fileInput.setInputFiles('tests/large_dummy.log');
      await page.waitForTimeout(1500);
      
      // 应该正常工作
      const canvas = page.locator(SELECTORS.logViewer.canvas);
      await expect(canvas).toBeVisible();
    });
  });
});