import { Page, Locator } from '@playwright/test';

/**
 * LogLayer 设置面板 Page Object
 */

export class SettingsPanel {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly themeSelector: Locator;
  readonly languageSelector: Locator;
  readonly fontSizeSlider: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('[role="dialog"]:has-text("设置"), .settings-panel, [aria-label="Settings"]');
    this.closeButton = page.getByRole('button', { name: /关闭|close/i }).or(page.locator('.close-btn'));
    this.themeSelector = page.getByRole('combobox', { name: /主题|theme/i }).or(page.locator('.theme-selector'));
    this.languageSelector = page.getByRole('combobox', { name: /语言|language/i }).or(page.locator('.language-selector'));
    this.fontSizeSlider = page.getByRole('slider', { name: /字体|font/i }).or(page.locator('.font-size-slider'));
  }

  /**
   * 等待面板打开
   */
  async waitForOpen() {
    await this.panel.waitFor({ state: 'visible' });
  }

  /**
   * 等待面板关闭
   */
  async waitForClose() {
    await this.panel.waitFor({ state: 'hidden' });
  }

  /**
   * 关闭面板
   */
  async close() {
    const count = await this.closeButton.count();
    if (count > 0) {
      await this.closeButton.first().click();
      await this.waitForClose();
    }
  }

  /**
   * 选择主题
   */
  async selectTheme(theme: 'light' | 'dark' | 'auto') {
    const count = await this.themeSelector.count();
    if (count > 0) {
      await this.themeSelector.first().selectOption(theme);
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 选择语言
   */
  async selectLanguage(language: string) {
    const count = await this.languageSelector.count();
    if (count > 0) {
      await this.languageSelector.first().selectOption(language);
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 设置字体大小
   */
  async setFontSize(size: number) {
    const count = await this.fontSizeSlider.count();
    if (count > 0) {
      await this.fontSizeSlider.first().fill(size.toString());
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 获取当前设置
   */
  async getCurrentSettings() {
    return await this.page.evaluate(() => {
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        language: document.documentElement.getAttribute('lang'),
      };
    });
  }
}
