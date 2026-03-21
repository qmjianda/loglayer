import { Page, Locator } from '@playwright/test';

/**
 * LogLayer Log Viewer Page Object
 * 
 * Handles log canvas interactions, scrolling, selection, and bookmarks
 */
export class LogViewerPanel {
  readonly page: Page;
  readonly canvas: Locator;
  readonly container: Locator;
  readonly statusBar: Locator;
  readonly gutter: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Main canvas container
    this.container = page.locator('[data-testid="log-viewer"], .log-viewer-container, .canvas-container').first();
    
    // Canvas element for virtual scrolling
    this.canvas = page.locator('canvas').first();
    
    // Status bar at bottom
    this.statusBar = page.locator('[data-testid="status-bar"], .status-bar, footer[role="contentinfo"]').first();
    
    // Gutter (line numbers)
    this.gutter = page.locator('.gutter, .line-numbers').first();
  }

  /**
   * Wait for log viewer to be visible
   */
  async waitForVisible() {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Check if canvas is rendered
   */
  async isCanvasRendered(): Promise<boolean> {
    const count = await this.canvas.count();
    if (count === 0) return false;
    
    const box = await this.canvas.boundingBox();
    return box !== null && box.width > 0 && box.height > 0;
  }

  /**
   * Get total line count from status bar
   */
  async getTotalLines(): Promise<number> {
    const text = await this.statusBar.textContent() || '';
    // Match patterns like "Ln 1/1000" or "1000 lines"
    const match = text.match(/(\d+)\s*lines?|Ln\s*\d+\/(\d+)/i);
    if (match) {
      return parseInt(match[1] || match[2], 10);
    }
    return 0;
  }

  /**
   * Get current visible line range
   */
  async getVisibleRange(): Promise<{ start: number; end: number }> {
    const text = await this.statusBar.textContent() || '';
    const match = text.match(/Ln\s*(\d+)/i);
    if (match) {
      return { start: parseInt(match[1], 10), end: parseInt(match[1], 10) + 50 };
    }
    return { start: 0, end: 0 };
  }

  /**
   * Scroll to a specific line (approximate, based on canvas height)
   */
  async scrollToLine(lineNumber: number, totalLines: number) {
    const box = await this.canvas.boundingBox();
    if (!box) return;
    
    // Calculate scroll position based on line ratio
    const scrollContainer = this.container;
    const scrollHeight = await scrollContainer.evaluate(
      el => el.scrollHeight || document.documentElement.scrollHeight
    );
    
    const ratio = lineNumber / totalLines;
    const targetY = scrollHeight * ratio;
    
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.wheel(0, targetY);
    await this.page.waitForTimeout(300);
  }

  /**
   * Click on a line (approximate position)
   */
  async clickLine(lineIndex: number) {
    const box = await this.canvas.boundingBox();
    if (!box) return;
    
    // Each line is approximately 20px tall (LOG_VIEWER.LINE_HEIGHT)
    const lineHeight = 20;
    const y = box.y + 40 + (lineIndex * lineHeight); // 40px offset for header
    
    await this.page.mouse.click(box.x + box.width / 2, y);
    await this.page.waitForTimeout(200);
  }

  /**
   * Select text range in canvas (simulated)
   */
  async selectText(startLine: number, endLine: number) {
    const box = await this.canvas.boundingBox();
    if (!box) return;
    
    const lineHeight = 20;
    const startY = box.y + 40 + (startLine * lineHeight);
    const endY = box.y + 40 + (endLine * lineHeight);
    
    await this.page.mouse.move(box.x + 50, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 50, endY);
    await this.page.mouse.up();
    await this.page.waitForTimeout(200);
  }

  /**
   * Get current search match info from status bar
   */
  async getSearchMatchInfo(): Promise<{ current: number; total: number }> {
    const text = await this.statusBar.textContent() || '';
    const match = text.match(/(\d+)\s*\/\s*(\d+)\s*matches?/i);
    if (match) {
      return { current: parseInt(match[1], 10), total: parseInt(match[2], 10) };
    }
    return { current: 0, total: 0 };
  }

  /**
   * Check if indexing is in progress
   */
  async isIndexing(): Promise<boolean> {
    const text = await this.statusBar.textContent() || '';
    return text.includes('索引') || text.includes('indexing');
  }

  /**
   * Get encoding from status bar
   */
  async getEncoding(): Promise<string> {
    const text = await this.statusBar.textContent() || '';
    const encodings = ['UTF-8', 'GBK', 'GB2312', 'ASCII', 'Latin-1'];
    for (const enc of encodings) {
      if (text.includes(enc)) return enc;
    }
    return 'Unknown';
  }

  /**
   * Get memory usage from status bar
   */
  async getMemoryUsage(): Promise<string> {
    const text = await this.statusBar.textContent() || '';
    const match = text.match(/MEM:\s*([\d.]+%?)/i);
    return match ? match[1] : '';
  }

  /**
   * Get CPU usage from status bar
   */
  async getCPUUsage(): Promise<string> {
    const text = await this.statusBar.textContent() || '';
    const match = text.match(/CPU:\s*([\d.]+%?)/i);
    return match ? match[1] : '';
  }

  /**
   * Take screenshot of the log viewer canvas
   */
  async screenshot(name: string) {
    await this.canvas.screenshot({ path: `e2e/screenshots/${name}` });
  }
}