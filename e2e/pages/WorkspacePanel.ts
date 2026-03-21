import { Page, Locator } from '@playwright/test';

/**
 * LogLayer Workspace Panel Page Object
 * 
 * Handles file tree operations, file tabs, and workspace navigation
 */
export class WorkspacePanel {
  readonly page: Page;
  readonly panel: Locator;
  readonly openFilesSection: Locator;
  readonly fileTree: Locator;
  readonly presetsSection: Locator;
  readonly addPresetButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('[data-testid="unified-panel"], .unified-panel, aside[role="complementary"]');
    
    // Open Files section
    this.openFilesSection = page.locator('[data-section="openFiles"], .open-files-section');
    
    // File tree / Explorer
    this.fileTree = page.locator('[data-testid="file-tree"], .file-tree, [data-section="explorer"]');
    
    // Presets section
    this.presetsSection = page.locator('[data-section="presets"], .presets-section');
    this.addPresetButton = page.getByRole('button', { name: /保存预设|save.*preset/i });
  }

  /**
   * Wait for panel to be visible
   */
  async waitForVisible() {
    await this.panel.waitFor({ state: 'visible' });
  }

  /**
   * Get list of open file tabs
   */
  async getOpenFiles(): Promise<string[]> {
    const fileItems = this.openFilesSection.locator('[data-file-id], .file-item, .tab-item');
    const count = await fileItems.count();
    const files: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = await fileItems.nth(i).getAttribute('data-name') || 
                   await fileItems.nth(i).textContent() || '';
      files.push(name.trim());
    }
    return files;
  }

  /**
   * Click on a file tab to activate it
   */
  async activateFile(fileName: string) {
    const fileTab = this.openFilesSection.locator(
      `[data-name="${fileName}"], :text("${fileName}")`
    ).first();
    await fileTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Close a file tab
   */
  async closeFile(fileName: string) {
    const fileTab = this.openFilesSection.locator(`[data-name="${fileName}"]`).first();
    const closeButton = fileTab.locator('.close-btn, [aria-label="close"], button:has-text("×")');
    const count = await closeButton.count();
    if (count > 0) {
      await closeButton.first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Check if a file is currently active
   */
  async isFileActive(fileName: string): Promise<boolean> {
    const fileTab = this.openFilesSection.locator(
      `[data-name="${fileName}"].active, [data-name="${fileName}"][aria-selected="true"]`
    );
    const count = await fileTab.count();
    return count > 0;
  }

  /**
   * Get file tree items in explorer
   */
  async getFileTreeItems(): Promise<string[]> {
    const items = this.fileTree.locator('.file-tree-item, [role="treeitem"], .tree-node');
    const count = await items.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = await items.nth(i).textContent() || '';
      names.push(name.trim());
    }
    return names;
  }

  /**
   * Click on a file in the file tree to open it
   */
  async openFileFromTree(fileName: string) {
    const fileNode = this.fileTree.locator(
      `[data-name="${fileName}"], :text("${fileName}")`
    ).first();
    await fileNode.dblclick();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get preset list
   */
  async getPresets(): Promise<string[]> {
    const presetItems = this.presetsSection.locator('.preset-item, [data-preset-id]');
    const count = await presetItems.count();
    const presets: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = await presetItems.nth(i).textContent() || '';
      presets.push(name.trim());
    }
    return presets;
  }

  /**
   * Apply a preset
   */
  async applyPreset(presetName: string) {
    const preset = this.presetsSection.locator(`:text("${presetName}")`).first();
    await preset.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Save current layers as preset
   */
  async savePreset() {
    const count = await this.addPresetButton.count();
    if (count > 0) {
      await this.addPresetButton.first().click();
      await this.page.waitForTimeout(300);
    }
  }
}