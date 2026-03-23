import { Page, Locator, expect } from '@playwright/test';
import { SELECTORS } from '../selectors';

export async function waitForStable(page: Page, selector: string, timeout = 5000): Promise<void> {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible', timeout });
  await page.waitForTimeout(100);
}

export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const path = `e2e/screenshots/${name}`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

export async function getTheme(page: Page): Promise<string> {
  return await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });
}

export async function setTheme(page: Page, theme: 'light' | 'dark' | 'auto'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(100);
}

export async function pressShortcut(page: Page, shortcut: string): Promise<void> {
  await page.keyboard.press(shortcut);
  await page.waitForTimeout(200);
}

export async function uploadTestFile(page: Page, fileName: string): Promise<void> {
  const fileInput = page.locator('input[type="file"][accept]:not([webkitdirectory])');
  await fileInput.setInputFiles(fileName);
  await page.waitForTimeout(1500);
}

export async function measurePerformance(
  page: Page,
  action: () => Promise<void>,
  iterations = 5
): Promise<{ average: number; min: number; max: number }> {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await action();
    times.push(Date.now() - start);
    await page.waitForTimeout(100);
  }
  
  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

export async function scrollCanvas(
  page: Page,
  container: Locator,
  direction: 'up' | 'down',
  amount = 500
): Promise<void> {
  const delta = direction === 'down' ? amount : -amount;
  await page.mouse.wheel(0, delta);
  await page.waitForTimeout(200);
}

export async function clickCanvasAt(
  page: Page,
  canvas: Locator,
  x: number | 'center',
  y: number
): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const clickX = x === 'center' ? box.x + box.width / 2 : box.x + x;
  const clickY = box.y + y;
  
  await page.mouse.click(clickX, clickY);
  await page.waitForTimeout(100);
}

export async function dragElement(
  page: Page,
  element: Locator,
  targetX: number,
  targetY: number
): Promise<void> {
  const box = await element.boundingBox();
  if (!box) throw new Error('Element not found');
  
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

export async function resizeViewport(
  page: Page,
  width: number,
  height: number
): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(200);
}

export async function isVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

export async function getElementText(locator: Locator): Promise<string> {
  return (await locator.textContent()) || '';
}

export async function getElementCount(locator: Locator): Promise<number> {
  return await locator.count();
}

export class TestReporter {
  private results: Array<{
    scenario: string;
    step: string;
    status: 'pass' | 'fail';
    duration?: number;
    error?: string;
    screenshot?: string;
  }> = [];

  addResult(result: {
    scenario: string;
    step: string;
    status: 'pass' | 'fail';
    duration?: number;
    error?: string;
    screenshot?: string;
  }): void {
    this.results.push(result);
  }

  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    results: typeof this.results;
  } {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      results: this.results,
    };
  }

  toJSON(): string {
    return JSON.stringify(this.getSummary(), null, 2);
  }
}