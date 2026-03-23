export const SELECTORS = {
  root: '#root',
  
  sidebar: {
    container: '[aria-label="Sidebar"], .sidebar, aside',
    toggle: '[aria-label*="sidebar"], [aria-label*="侧边"]',
    icons: '.sidebar-icon, nav button',
    workspace: 'nav button:has(svg path[d^="M13 2H6"])',
    help: 'nav button:has(svg path[d^="M8.228"])',
    settings: 'nav button:last-child',
    indicator: '.absolute.left-0.w-0\\.5',
  },
  
  logViewer: {
    canvas: 'canvas[role="log"], canvas',
    container: '.log-viewer-container, [aria-label^="日志视图"]',
    scrollbar: '.custom-scrollbar',
    statusAnnouncer: 'div[role="status"][aria-live="polite"]',
  },
  
  layerPanel: {
    container: '.layers-panel, [data-layers]',
    processingSection: 'span:contains("处理层")',
    renderingSection: 'span:contains("渲染层")',
    layerItem: 'div[draggable="true"]',
    layerInput: 'input.bg-theme-input',
    addButton: 'button:has(svg path[d="M12 4v16m8-8H4"])',
    toggleButton: 'button:has(svg path[d="M12 4.5C7"])',
    deleteButton: 'button:has(svg path[d="M19 7"])',
  },
  
  workspacePanel: {
    container: '.workspace-panel, [data-workspace]',
    openFiles: 'span:contains("已打开")',
    explorer: 'span:contains("资源管理器")',
    presets: 'span:contains("预设")',
    fileTree: '.custom-scrollbar.select-none',
    fileNode: 'div[role="treeitem"]',
    activeFile: '.bg-theme-active',
    undoButton: 'button[title="撤销"]',
    redoButton: 'button[title="重做"]',
    openButton: 'button:contains("浏览并打开")',
  },
  
  statusBar: {
    container: '.h-6.bg-theme-active, [class*="status"]',
    spinner: 'svg.animate-spin',
    watchingIndicator: '.text-green-400:contains("监视中")',
    lineCount: '.font-mono:contains("Lines")',
    fileSize: 'div:contains("Size:")',
    position: '.font-mono:contains("Ln")',
    shortcutsButton: 'button:contains("⌨")',
    settingsButton: 'button:contains("⚙")',
  },
  
  settings: {
    panel: '.fixed.inset-0.z-\\[100\\], [data-settings]',
    dialog: '.bg-theme-surface.border',
    closeButton: 'button:contains("取消"), button[title="Close"]',
    saveButton: 'button:contains("保存")',
    resetButton: 'button:contains("重置")',
    tabs: {
      general: 'button:contains("通用")',
      appearance: 'button:contains("外观")',
      search: 'button:contains("搜索")',
      viewer: 'button:contains("查看器")',
      layers: 'button:contains("图层")',
      advanced: 'button:contains("高级")',
    },
    checkbox: 'input[type="checkbox"]',
    numberInput: 'input[type="number"]',
    textInput: 'input[type="text"]',
    select: 'select',
  },
  
  search: {
    container: '.absolute.top-2.right-8',
    input: 'input[placeholder="查找"]',
    caseButton: 'button:contains("Aa")',
    wordButton: 'button:contains("≡")',
    regexButton: 'button:contains(".*")',
    prevButton: 'button:has(svg path[d="M5 15"])',
    nextButton: 'button:has(svg path[d="M19 9"])',
    closeButton: 'button:has(svg path[d="M6 18"])',
    history: 'div.absolute.top-full',
  },
  
  commandPalette: {
    container: '[role="dialog"], .command-palette',
    searchbox: '[role="searchbox"], input[aria-label="Search commands"]',
    listbox: '[role="listbox"]',
    option: '[role="option"]',
    selected: '[aria-selected="true"]',
    disabled: '[aria-disabled="true"]',
  },
  
  tabBar: {
    container: '.flex.items-center.bg-secondary, .tab-bar',
    tab: '[role="tab"], .tab-item',
    activeTab: '.bg-theme-active',
    closeButton: 'button[title="Close"]',
  },
  
  bookmarks: {
    container: '.bookmark-popover, [data-bookmarks]',
    item: '.text-amber-500',
    clearAll: 'button:contains("清除全部")',
  },
  
  modals: {
    dialog: '[role="dialog"], .modal',
    overlay: '.fixed.inset-0',
    close: 'button:has(svg path[d="M6 18"])',
    confirm: 'button:contains("确认"), button:contains("确定")',
    cancel: 'button:contains("取消")',
  },
  
  keyboard: {
    find: 'Control+F',
    goToLine: 'Control+G',
    settings: 'Control+,',
    commandPalette: 'Control+Shift+P',
    sidebar: 'Control+B',
    escape: 'Escape',
    undo: 'Control+Z',
    redo: 'Control+Y',
  },
  
  theme: {
    attribute: 'data-theme',
    light: 'light',
    dark: 'dark',
    auto: 'auto',
  },
  
  aria: {
    logViewer: {
      role: 'log',
      label: /^日志视图/,
    },
    commandPalette: {
      role: 'dialog',
      modal: 'true',
      label: 'Command palette',
    },
    searchbox: {
      role: 'searchbox',
      label: 'Search commands',
    },
  },
} as const;

export type SelectorKey = keyof typeof SELECTORS;
export type SidebarSelectors = typeof SELECTORS.sidebar;
export type LogViewerSelectors = typeof SELECTORS.logViewer;
export type LayerPanelSelectors = typeof SELECTORS.layerPanel;