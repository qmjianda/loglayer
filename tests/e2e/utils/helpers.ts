import { Page, Locator, expect } from '@playwright/test';
import { SELECTORS } from '../selectors';

export class LogViewerHelper {
  readonly page: Page;
  readonly canvas: Locator;
  readonly container: Locator;
  readonly statusAnnouncer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator(SELECTORS.logViewer.canvas);
    this.container = page.locator(SELECTORS.logViewer.container);
    this.statusAnnouncer = page.locator(SELECTORS.logViewer.statusAnnouncer);
  }

  async waitForReady(): Promise<void> {
    await this.canvas.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  async getCanvasSize(): Promise<{ width: number; height: number } | null> {
    const box = await this.canvas.boundingBox();
    return box ? { width: box.width, height: box.height } : null;
  }

  async clickAtLine(y: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not visible');
    await this.page.mouse.click(box.x + box.width / 2, box.y + y);
    await this.page.waitForTimeout(100);
  }

  async scroll(direction: 'up' | 'down', amount = 500): Promise<void> {
    const delta = direction === 'down' ? amount : -amount;
    await this.page.mouse.wheel(0, delta);
    await this.page.waitForTimeout(200);
  }

  async selectLines(startY: number, endY: number): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not visible');
    
    const x = box.x + 50;
    await this.page.mouse.move(x, box.y + startY);
    await this.page.mouse.down();
    await this.page.mouse.move(x, box.y + endY, { steps: 5 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(100);
  }

  async getAriaLabel(): Promise<string> {
    return await this.canvas.getAttribute('aria-label') || '';
  }
}

export class SidebarHelper {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(SELECTORS.sidebar.container);
  }

  async clickIcon(index: number): Promise<void> {
    const icons = this.page.locator(SELECTORS.sidebar.icons);
    await icons.nth(index).click();
    await this.page.waitForTimeout(200);
  }

  async clickWorkspace(): Promise<void> {
    await this.page.locator(SELECTORS.sidebar.workspace).click();
    await this.page.waitForTimeout(200);
  }

  async clickSettings(): Promise<void> {
    await this.page.locator(SELECTORS.sidebar.settings).click();
    await this.page.waitForTimeout(200);
  }
}

export class SearchHelper {
  readonly page: Page;
  readonly input: Locator;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(SELECTORS.search.container);
    this.input = page.locator(SELECTORS.search.input);
  }

  async open(): Promise<void> {
    await this.page.keyboard.press(SELECTORS.keyboard.find);
    await this.page.waitForTimeout(200);
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async search(query: string): Promise<void> {
    await this.input.fill(query);
    await this.page.waitForTimeout(500);
  }

  async toggleCaseSensitive(): Promise<void> {
    await this.page.locator(SELECTORS.search.caseButton).click();
    await this.page.waitForTimeout(100);
  }

  async toggleRegex(): Promise<void> {
    await this.page.locator(SELECTORS.search.regexButton).click();
    await this.page.waitForTimeout(100);
  }

  async next(): Promise<void> {
    await this.page.locator(SELECTORS.search.nextButton).click();
    await this.page.waitForTimeout(100);
  }

  async previous(): Promise<void> {
    await this.page.locator(SELECTORS.search.prevButton).click();
    await this.page.waitForTimeout(100);
  }
}

export class SettingsHelper {
  readonly page: Page;
  readonly panel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator(SELECTORS.settings.panel);
  }

  async open(): Promise<void> {
    await this.page.keyboard.press(SELECTORS.keyboard.settings);
    await this.page.waitForTimeout(300);
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async selectTab(tab: 'general' | 'appearance' | 'search' | 'viewer' | 'layers' | 'advanced'): Promise<void> {
    await this.page.locator(SELECTORS.settings.tabs[tab]).click();
    await this.page.waitForTimeout(200);
  }

  async setTheme(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    await this.selectTab('appearance');
    await this.page.locator(`button:contains("${theme === 'light' ? '亮色' : theme === 'dark' ? '深色' : '跟随系统'}")`).click();
    await this.page.waitForTimeout(200);
  }

  async save(): Promise<void> {
    await this.page.locator(SELECTORS.settings.saveButton).click();
    await this.page.waitForTimeout(300);
  }
}

export class LayerHelper {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(SELECTORS.layerPanel.container);
  }

  async addLayer(): Promise<void> {
    await this.page.locator(SELECTORS.layerPanel.addButton).click();
    await this.page.waitForTimeout(300);
  }

  async getLayerCount(): Promise<number> {
    return await this.page.locator(SELECTORS.layerPanel.layerItem).count();
  }

  async selectLayer(index: number): Promise<void> {
    const layers = this.page.locator(SELECTORS.layerPanel.layerItem);
    await layers.nth(index).click();
    await this.page.waitForTimeout(200);
  }

  async toggleLayer(index: number): Promise<void> {
    const toggleButtons = this.page.locator(SELECTORS.layerPanel.toggleButton);
    await toggleButtons.nth(index).click();
    await this.page.waitForTimeout(200);
  }

  async deleteLayer(index: number): Promise<void> {
    await this.selectLayer(index);
    await this.page.locator(SELECTORS.layerPanel.deleteButton).first().click();
    await this.page.waitForTimeout(200);
  }

  async dragLayer(fromIndex: number, toIndex: number): Promise<void> {
    const layers = this.page.locator(SELECTORS.layerPanel.layerItem);
    const fromBox = await layers.nth(fromIndex).boundingBox();
    const toBox = await layers.nth(toIndex).boundingBox();
    
    if (!fromBox || !toBox) throw new Error('Layer not found');
    
    await this.page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }
}

export class CommandPaletteHelper {
  readonly page: Page;
  readonly container: Locator;
  readonly searchbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(SELECTORS.commandPalette.container);
    this.searchbox = page.locator(SELECTORS.commandPalette.searchbox);
  }

  async open(): Promise<void> {
    await this.page.keyboard.press(SELECTORS.keyboard.commandPalette);
    await this.page.waitForTimeout(200);
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async search(query: string): Promise<void> {
    await this.searchbox.fill(query);
    await this.page.waitForTimeout(300);
  }

  async selectFirst(): Promise<void> {
    await this.page.locator(SELECTORS.commandPalette.option).first().click();
    await this.page.waitForTimeout(200);
  }

  async getOptionCount(): Promise<number> {
    return await this.page.locator(SELECTORS.commandPalette.option).count();
  }
}