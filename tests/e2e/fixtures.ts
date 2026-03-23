import { test as base } from '@playwright/test';
import { LogLayerPage } from './pages/LogLayerPage';
import { SettingsPanel } from './pages/SettingsPanel';
import { LayerPanel } from './pages/LayerPanel';
import { WorkspacePanel } from './pages/WorkspacePanel';
import { LogViewerPanel } from './pages/LogViewerPanel';

/**
 * 扩展 Playwright test，添加 Page Objects
 * 
 * 用法：
 * test('示例测试', async ({ logLayer, settingsPanel, workspacePanel, logViewerPanel }) => {
 *   await logLayer.goto();
 *   await logLayer.openSettings();
 *   await settingsPanel.selectTheme('dark');
 * });
 */

type Fixtures = {
  logLayer: LogLayerPage;
  settingsPanel: SettingsPanel;
  layerPanel: LayerPanel;
  workspacePanel: WorkspacePanel;
  logViewerPanel: LogViewerPanel;
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

  workspacePanel: async ({ page }, use) => {
    const workspacePanel = new WorkspacePanel(page);
    await use(workspacePanel);
  },

  logViewerPanel: async ({ page }, use) => {
    const logViewerPanel = new LogViewerPanel(page);
    await use(logViewerPanel);
  },
});

export { expect } from '@playwright/test';