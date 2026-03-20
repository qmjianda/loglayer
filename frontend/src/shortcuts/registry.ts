/**
 * shortcuts/registry.ts - Central keyboard shortcut definitions
 * 
 * This is the single source of truth for all keyboard shortcuts in LogLayer.
 * Each shortcut is defined with its ID, key combinations, description, category,
 * and context conditions.
 * 
 * To add a new shortcut:
 * 1. Add an entry to SHORTCUT_REGISTRY
 * 2. Use useShortcut('your-shortcut-id', handler) in your component
 * 
 * To modify a shortcut:
 * 1. Update the entry in SHORTCUT_REGISTRY
 * 2. UI panels will automatically reflect the change
 */

import type { ShortcutDefinition, ShortcutCategory } from './types';

/**
 * All keyboard shortcuts in LogLayer.
 * 
 * Categories:
 * - navigation: Line navigation, scrolling
 * - search: Find, search navigation
 * - edit: Copy, select, editing operations
 * - commands: Command palette, global commands
 * - layers: Layer creation and management
 * - panes: Split pane operations
 * - bookmarks: Bookmark navigation
 * - file: File operations
 * - view: View toggles
 * - tools: Tool windows
 */
export const SHORTCUT_REGISTRY = {
  // ===== Navigation =====
  gotoLine: {
    id: 'goto.line',
    keys: ['Ctrl+G'],
    description: '跳转到行',
    category: 'navigation' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  goToStart: {
    id: 'goto.start',
    keys: ['Ctrl+Home'],
    description: '跳转到文件开头',
    category: 'navigation' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  goToEnd: {
    id: 'goto.end',
    keys: ['Ctrl+End'],
    description: '跳转到文件结尾',
    category: 'navigation' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },

  // ===== Search =====
  find: {
    id: 'search.find',
    keys: ['Ctrl+F'],
    description: '查找',
    category: 'search' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  findNext: {
    id: 'search.next',
    keys: ['F3'],
    description: '下一个匹配',
    category: 'search' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  findPrev: {
    id: 'search.prev',
    keys: ['Shift+F3'],
    description: '上一个匹配',
    category: 'search' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  searchHistory: {
    id: 'search.history',
    keys: ['Ctrl+H'],
    description: '搜索历史',
    category: 'search' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },

  // ===== Edit =====
  copy: {
    id: 'edit.copy',
    keys: ['Ctrl+C'],
    description: '复制选中内容',
    category: 'edit' as ShortcutCategory,
    when: 'viewerFocus' as const,
    priority: 'high' as const,
  },
  selectAll: {
    id: 'edit.selectAll',
    keys: ['Ctrl+A'],
    description: '全选',
    category: 'edit' as ShortcutCategory,
    when: 'viewerFocus' as const,
    priority: 'high' as const,
  },
  selectLine: {
    id: 'edit.selectLine',
    keys: ['Ctrl+Shift+L'],
    description: '选中当前行',
    category: 'edit' as ShortcutCategory,
    when: 'viewerFocus' as const,
    priority: 'normal' as const,
  },
  moveSelectionUp: {
    id: 'edit.moveSelectionUp',
    keys: ['Alt+ArrowUp'],
    description: '向上移动选区',
    category: 'edit' as ShortcutCategory,
    when: 'viewerFocus' as const,
    priority: 'normal' as const,
  },
  moveSelectionDown: {
    id: 'edit.moveSelectionDown',
    keys: ['Alt+ArrowDown'],
    description: '向下移动选区',
    category: 'edit' as ShortcutCategory,
    when: 'viewerFocus' as const,
    priority: 'normal' as const,
  },
  jumpToSelection: {
    id: 'edit.jumpToSelection',
    keys: ['Ctrl+Enter'],
    description: '跳转到选中行',
    category: 'edit' as ShortcutCategory,
    when: 'viewerFocus' as const,
    priority: 'normal' as const,
  },

  // ===== Commands =====
  commandPalette: {
    id: 'command.palette',
    keys: ['Ctrl+Shift+P'],
    description: '命令面板',
    category: 'commands' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },

  // ===== File =====
  openFile: {
    id: 'file.open',
    keys: ['Ctrl+O'],
    description: '打开文件',
    category: 'file' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },
  openFolder: {
    id: 'file.openFolder',
    keys: ['Ctrl+Shift+O'],
    description: '打开文件夹',
    category: 'file' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },

  // ===== View =====
  toggleSidebar: {
    id: 'view.toggleSidebar',
    keys: ['Ctrl+B'],
    description: '切换侧边栏',
    category: 'view' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },
  openSettings: {
    id: 'settings.open',
    keys: ['Ctrl+,'],
    description: '打开设置',
    category: 'view' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },

  // ===== Layers =====
  newLayer: {
    id: 'layer.new',
    keys: ['Ctrl+Shift+L'],
    description: '新建图层',
    category: 'layers' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },

  // ===== Panes =====
  splitPaneRight: {
    id: 'pane.splitRight',
    keys: ['Ctrl+\\', 'Ctrl+Shift+ArrowRight'],
    description: '向右分屏',
    category: 'panes' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },
  splitPaneBottom: {
    id: 'pane.splitBottom',
    keys: ['Ctrl+Shift+\\', 'Ctrl+Shift+ArrowDown'],
    description: '向下分屏',
    category: 'panes' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },
  closePane: {
    id: 'pane.close',
    keys: ['Ctrl+W'],
    description: '关闭当前分屏',
    category: 'panes' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },

  // ===== Bookmarks =====
  nextBookmark: {
    id: 'bookmark.next',
    keys: ['F2'],
    description: '下一个书签',
    category: 'bookmarks' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  prevBookmark: {
    id: 'bookmark.prev',
    keys: ['Shift+F2'],
    description: '上一个书签',
    category: 'bookmarks' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },

  // ===== Tools =====
  toggleWatch: {
    id: 'tools.toggleWatch',
    keys: ['Ctrl+Shift+T'],
    description: '实时监视',
    category: 'tools' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'low' as const,
  },

  // ===== Undo/Redo =====
  undo: {
    id: 'edit.undo',
    keys: ['Ctrl+Z'],
    description: '撤销',
    category: 'edit' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },
  redo: {
    id: 'edit.redo',
    keys: ['Ctrl+Y', 'Ctrl+Shift+Z'],
    description: '重做',
    category: 'edit' as ShortcutCategory,
    when: 'notInput' as const,
    priority: 'normal' as const,
  },

  // ===== Escape (special handling) =====
  escape: {
    id: 'global.escape',
    keys: ['Escape'],
    description: '关闭面板/取消',
    category: 'commands' as ShortcutCategory,
    when: 'always' as const,
    priority: 'high' as const,
  },
} as const satisfies Record<string, ShortcutDefinition>;

/**
 * Type for all shortcut IDs.
 * Use this for type-safe shortcut references.
 */
export type ShortcutId = keyof typeof SHORTCUT_REGISTRY;

/**
 * Get a shortcut definition by ID.
 */
export function getShortcut(id: ShortcutId): ShortcutDefinition {
  return SHORTCUT_REGISTRY[id];
}

/**
 * Get all shortcuts grouped by category.
 */
export function getShortcutsByCategory(): Map<ShortcutCategory, ShortcutDefinition[]> {
  const map = new Map<ShortcutCategory, ShortcutDefinition[]>();
  
  for (const def of Object.values(SHORTCUT_REGISTRY)) {
    const category = def.category;
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category)!.push(def);
  }
  
  return map;
}