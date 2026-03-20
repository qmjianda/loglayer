import { test as base } from '@playwright/test';
import { LogLayerPage } from './pages/LogLayerPage';
import { SettingsPanel } from './pages/SettingsPanel';
import { LayerPanel } from './pages/LayerPanel';

/**
 * 扩展 Playwright test，添加 Page Objects
 * 
 * 用法：
 * test('示例测试', async ({ logLayer, settingsPanel }) => {
 *   await logLayer.goto();
 *   await logLayer.openSettings();
 *   await settingsPanel.selectTheme('dark');
 * });
 */

type Fixtures = {
  logLayer: LogLayerPage;
  settingsPanel: SettingsPanel;
  layerPanel: LayerPanel;
};

export const test = base.extend<Fixtures>({
  logLayer: async ({ page }, use) => {
    const logLayer = new LogLayerPage(page);
    await use(logLayer);
  },

  settingsPanel: async ({ page }, use) => {
    const settingsPanel = new SettingsPanel(page);
    await use(settingsPanel);
  },

  layerPanel: async ({ page }, use) => {
    const layerPanel = new LayerPanel(page);
    await use(layerPanel);
  },
});

export { expect } from '@playwright/test';
