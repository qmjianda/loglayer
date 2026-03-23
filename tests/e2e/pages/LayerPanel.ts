import { Page, Locator } from '@playwright/test';

export class LayerPanel {
  readonly page: Page;
  readonly panel: Locator;
  readonly layerList: Locator;
  readonly addLayerButton: Locator;
  readonly deleteLayerButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('[role="complementary"], aside').first();
    this.layerList = page.locator('div[draggable="true"]').first();
    this.addLayerButton = page.locator('button:has(svg path[d="M12 4v16m8-8H4"])');
    this.deleteLayerButton = page.locator('button:has(svg path[d="M19 7"])');
  }

  async waitForVisible() {
    await this.panel.waitFor({ state: 'visible' });
  }

  async getLayerCount(): Promise<number> {
    return await this.page.locator('div[draggable="true"]').count();
  }

  async getLayerNames(): Promise<string[]> {
    const layers = this.page.locator('div[draggable="true"]');
    const names: string[] = [];
    const count = await layers.count();
    
    for (let i = 0; i < count; i++) {
      const name = await layers.nth(i).textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }

  async addLayer(name?: string) {
    const count = await this.addLayerButton.count();
    if (count > 0) {
      await this.addLayerButton.first().click();
      await this.page.waitForTimeout(500);
    }
  }

  async deleteLayer(index: number) {
    const layers = this.page.locator('div[draggable="true"]');
    await layers.nth(index).click();
    await this.page.waitForTimeout(200);
    
    const count = await this.deleteLayerButton.count();
    if (count > 0) {
      await this.deleteLayerButton.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  async toggleLayerVisibility(index: number) {
    const toggleButtons = this.page.locator('button:has(svg path[d="M12 4.5C7"])');
    await toggleButtons.nth(index).click();
    await this.page.waitForTimeout(300);
  }

  async dragLayer(fromIndex: number, toIndex: number) {
    const layers = this.page.locator('div[draggable="true"]');
    const fromLayer = layers.nth(fromIndex);
    const toLayer = layers.nth(toIndex);
    
    await fromLayer.dragTo(toLayer);
    await this.page.waitForTimeout(500);
  }

  async searchLayer(query: string) {
    await this.page.waitForTimeout(300);
  }
}
