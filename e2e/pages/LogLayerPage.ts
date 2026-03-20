import { Page, Locator } from '@playwright/test';

/**
 * LogLayer Page Object - 基础页面
 * 
 * 封装常用操作，提供可复用的测试抽象层
 */

export class LogLayerPage {
  readonly page: Page;
  readonly root: Locator;
  readonly settingsButton: Locator;
  readonly helpButton: Locator;
  readonly searchInput: Locator;
  readonly sidebar: Locator;
  readonly statusBar: Locator;
  readonly tabBar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('#root');
    
    // 使用语义化选择器（根据实际 UI 调整）
    this.settingsButton = page.getByRole('button', { name: /设置|settings/i });
    this.helpButton = page.getByRole('button', { name: /帮助|help/i });
    this.searchInput = page.getByPlaceholder(/搜索|search/i);
    this.sidebar = page.getByRole('complementary').or(page.locator('.sidebar, aside'));
    this.statusBar = page.getByRole('contentinfo').or(page.locator('.status-bar, footer'));
    this.tabBar = page.getByRole('tablist').or(page.locator('.tab-bar, .tabs'));
  }

  /**
   * 导航到首页
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 等待页面加载完成
   */
  async waitForLoaded() {
    await this.root.waitFor({ state: 'visible' });
  }

  /**
   * 打开设置面板
   */
  async openSettings() {
    const count = await this.settingsButton.count();
    if (count > 0) {
      await this.settingsButton.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 打开帮助面板
   */
  async openHelp() {
    const count = await this.helpButton.count();
    if (count > 0) {
      await this.helpButton.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 搜索日志内容
   */
  async search(query: string) {
    const count = await this.searchInput.count();
    if (count > 0) {
      await this.searchInput.first().fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 清除搜索
   */
  async clearSearch() {
    const count = await this.searchInput.count();
    if (count > 0) {
      await this.searchInput.first().clear();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 切换侧边栏
   */
  async toggleSidebar() {
    const sidebarToggle = this.page.getByRole('button', { name: /侧边|sidebar/i });
    const count = await sidebarToggle.count();
    if (count > 0) {
      await sidebarToggle.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 获取当前主题
   */
  async getCurrentTheme(): Promise<string> {
    return await this.page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') || 
             document.body.getAttribute('data-theme') || 
             'light';
    });
  }

  /**
   * 切换主题
   */
  async toggleTheme() {
    const themeToggle = this.page.getByRole('button', { name: /主题|theme/i });
    const count = await themeToggle.count();
    if (count > 0) {
      await themeToggle.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(1000);
  }

  /**
   * 获取标签页数量
   */
  async getTabCount(): Promise<number> {
    const tabs = this.tabBar.locator('[role="tab"], .tab-item');
    return await tabs.count();
  }

  /**
   * 切换到指定标签页
   */
  async switchToTab(index: number) {
    const tabs = this.tabBar.locator('[role="tab"], .tab-item');
    await tabs.nth(index).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 关闭标签页
   */
  async closeTab(index: number) {
    const tabs = this.tabBar.locator('[role="tab"], .tab-item');
    const closeBtn = tabs.nth(index).locator('.close-btn, button[aria-label="close"]');
    const count = await closeBtn.count();
    if (count > 0) {
      await closeBtn.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 截图
   */
  async screenshot(name: string) {
    await this.page.screenshot({ 
      path: `e2e/screenshots/${name}`,
      fullPage: false 
    });
  }

  /**
   * 全屏截图
   */
  async fullScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `e2e/screenshots/${name}`,
      fullPage: true 
    });
  }

  /**
   * 设置视口大小
   */
  async setViewport(width: number, height: number) {
    await this.page.setViewportSize({ width, height });
    await this.page.waitForTimeout(300);
  }

  /**
   * 模拟移动设备
   */
  async setMobileViewport() {
    await this.setViewport(375, 667);
  }

  /**
   * 模拟平板设备
   */
  async setTabletViewport() {
    await this.setViewport(768, 1024);
  }

  /**
   * 模拟桌面设备
   */
  async setDesktopViewport() {
    await this.setViewport(1920, 1080);
  }
}
