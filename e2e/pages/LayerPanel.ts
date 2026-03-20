import { Page, Locator } from '@playwright/test';

/**
 * LogLayer 图层管理面板 Page Object
 */

export class LayerPanel {
  readonly page: Page;
  readonly panel: Locator;
  readonly layerList: Locator;
  readonly addLayerButton: Locator;
  readonly deleteLayerButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('.layer-panel, [data-testid="layer-panel"], [aria-label*="图层"]');
    this.layerList = page.locator('.layer-list, [data-testid="layer-list"]');
    this.addLayerButton = page.getByRole('button', { name: /添加图层|add.*layer/i });
    this.deleteLayerButton = page.getByRole('button', { name: /删除|delete/i });
  }

  /**
   * 等待面板可见
   */
  async waitForVisible() {
    await this.panel.waitFor({ state: 'visible' });
  }

  /**
   * 获取图层数量
   */
  async getLayerCount(): Promise<number> {
    const layers = this.layerList.locator('.layer-item, [data-testid="layer-item"]');
    return await layers.count();
  }

  /**
   * 获取所有图层名称
   */
  async getLayerNames(): Promise<string[]> {
    const layers = this.layerList.locator('.layer-item, [data-testid="layer-item"]');
    const names: string[] = [];
    const count = await layers.count();
    
    for (let i = 0; i < count; i++) {
      const name = await layers.nth(i).textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }

  /**
   * 添加图层
   */
  async addLayer(name?: string) {
    const count = await this.addLayerButton.count();
    if (count > 0) {
      await this.addLayerButton.first().click();
      await this.page.waitForTimeout(500);
      
      if (name) {
        const input = this.page.getByPlaceholder(/图层名称|layer name/i);
        const inputCount = await input.count();
        if (inputCount > 0) {
          await input.first().fill(name);
          await this.page.keyboard.press('Enter');
          await this.page.waitForTimeout(300);
        }
      }
    }
  }

  /**
   * 删除图层
   */
  async deleteLayer(index: number) {
    const layers = this.layerList.locator('.layer-item, [data-testid="layer-item"]');
    const layer = layers.nth(index);
    
    // 悬停显示操作按钮
    await layer.hover();
    await this.page.waitForTimeout(200);
    
    const deleteBtn = layer.getByRole('button', { name: /删除|delete/i });
    const count = await deleteBtn.count();
    if (count > 0) {
      await deleteBtn.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 切换图层可见性
   */
  async toggleLayerVisibility(index: number) {
    const layers = this.layerList.locator('.layer-item, [data-testid="layer-item"]');
    const visibilityToggle = layers.nth(index).locator('.visibility-toggle, input[type="checkbox"]');
    
    const count = await visibilityToggle.count();
    if (count > 0) {
      await visibilityToggle.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 拖拽图层排序
   */
  async dragLayer(fromIndex: number, toIndex: number) {
    const layers = this.layerList.locator('.layer-item, [data-testid="layer-item"]');
    const fromLayer = layers.nth(fromIndex);
    const toLayer = layers.nth(toIndex);
    
    await fromLayer.dragTo(toLayer);
    await this.page.waitForTimeout(500);
  }

  /**
   * 搜索图层
   */
  async searchLayer(query: string) {
    const searchInput = this.panel.getByPlaceholder(/搜索图层|search layer/i);
    const count = await searchInput.count();
    if (count > 0) {
      await searchInput.first().fill(query);
      await this.page.waitForTimeout(500);
    }
  }
}
