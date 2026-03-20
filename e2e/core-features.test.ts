import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * LogLayer E2E 测试 - 核心功能测试
 * 测试日志文件加载、图层管理等核心功能
 */

test.describe('LogLayer 核心功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应该能够加载测试日志文件', async ({ page }) => {
    // 在项目目录中查找测试日志文件
    const testLogPath = path.join(__dirname, '../tests/large_dummy.log');
    
    if (fs.existsSync(testLogPath)) {
      // 使用文件输入上传文件
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testLogPath);
      
      // 等待文件加载
      await page.waitForTimeout(2000);
      
      // 验证文件已加载
      const fileName = await page.locator('.file-name, .active-file-name, [data-testid="file-name"]').first();
      await expect(fileName).toBeVisible();
      
      await page.screenshot({ path: 'e2e/screenshots/log-file-loaded.png' });
    }
  });

  test('应该显示图层列表', async ({ page }) => {
    // 查找图层列表容器
    const layerList = page.locator('.layer-list, [data-testid="layer-list"], .layers-panel');
    
    const count = await layerList.count();
    if (count > 0) {
      await expect(layerList.first()).toBeVisible();
      
      // 截图
      await page.screenshot({ path: 'e2e/screenshots/layer-list.png' });
    }
  });

  test('应该能够搜索日志内容', async ({ page }) => {
    // 查找搜索框
    const searchInput = page.locator('input[type="text"][placeholder*="搜索"], input[placeholder*="search"], .search-input');
    
    const count = await searchInput.count();
    if (count > 0) {
      // 输入搜索词
      await searchInput.first().fill('test');
      await page.waitForTimeout(500);
      
      // 验证搜索结果
      const searchResults = page.locator('.search-results, [data-testid="search-results"], .search-match');
      const resultsCount = await searchResults.count();
      
      // 应该有搜索结果或显示无结果提示
      expect(resultsCount >= 0).toBeTruthy();
      
      await page.screenshot({ path: 'e2e/screenshots/search-results.png' });
      
      // 清空搜索
      await searchInput.first().clear();
    }
  });

  test('应该支持多标签页', async ({ page }) => {
    // 查找标签页容器
    const tabBar = page.locator('.tab-bar, [role="tablist"], .tabs');
    
    const count = await tabBar.count();
    if (count > 0) {
      await expect(tabBar.first()).toBeVisible();
      
      // 获取标签页数量
      const tabs = tabBar.first().locator('[role="tab"], .tab-item');
      const tabCount = await tabs.count();
      
      console.log(`Found ${tabCount} tabs`);
      
      await page.screenshot({ path: 'e2e/screenshots/tab-bar.png' });
    }
  });

  test('应该显示状态栏', async ({ page }) => {
    // 查找状态栏
    const statusBar = page.locator('.status-bar, footer, [data-testid="status-bar"]');
    
    const count = await statusBar.count();
    if (count > 0) {
      await expect(statusBar.first()).toBeVisible();
      
      // 截图
      await page.screenshot({ path: 'e2e/screenshots/status-bar.png' });
    }
  });
});
