import { create } from 'zustand';
import type { SearchConfig } from '../types';

/**
 * per-tab 搜索状态 store（Phase 2 D4 决策）
 *
 * 状态 key 用 panelId（dockview 面板 id，`log-view-<hash>`）而非 fileId：
 * - 与 dockview 生命周期绑定，onDidRemovePanel 时 destroyTab
 * - 布局恢复时 panelId 稳定，状态自然重挂
 * - 同文件多面板（未来分屏）天然支持
 */

export interface TabSearchState {
  query: string;
  config: SearchConfig;
  /** 当前匹配 rank（0-based，-1 = 无匹配/未导航） */
  currentMatchRank: number;
  /** 当前匹配的物理行索引快照（仅导航所需，全量数组走后端缓存） */
  currentMatchIndex: number;
  isSearching: boolean;
  /** find widget 是否展开（per-tab 记忆，切 tab 恢复） */
  isFindVisible: boolean;
  /** Ctrl+F 聚焦请求计数：每次 requestFocus 递增，widget 侧监听变化执行 focus+select */
  focusRequest: number;
}

export interface SearchStore {
  tabs: Record<string, TabSearchState>;
  activePanelId: string | null;
  // actions
  ensureTab: (panelId: string) => void;
  destroyTab: (panelId: string) => void;
  setActivePanel: (panelId: string | null) => void;
  setQuery: (panelId: string, query: string) => void;
  setConfig: (panelId: string, patch: Partial<SearchConfig>) => void;
  setCurrentMatch: (panelId: string, rank: number, index: number) => void;
  setIsSearching: (panelId: string, searching: boolean) => void;
  setFindVisible: (panelId: string, visible: boolean) => void;
  requestFocus: (panelId: string) => void;
  clearSearch: (panelId: string) => void;
  getTabState: (panelId: string) => TabSearchState;
}

const DEFAULT_CONFIG: SearchConfig = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  mode: 'highlight',
};

function defaultTabState(): TabSearchState {
  return {
    query: '',
    config: { ...DEFAULT_CONFIG },
    currentMatchRank: -1,
    currentMatchIndex: -1,
    isSearching: false,
    isFindVisible: false,
    focusRequest: 0,
  };
}

export const useSearchStore = create<SearchStore>()((set, get) => ({
  tabs: {},
  activePanelId: null,

  ensureTab: (panelId) =>
    set((state) => {
      if (state.tabs[panelId]) return state;
      return { tabs: { ...state.tabs, [panelId]: defaultTabState() } };
    }),

  destroyTab: (panelId) =>
    set((state) => {
      const tabs = { ...state.tabs };
      delete tabs[panelId];
      return {
        tabs,
        activePanelId: state.activePanelId === panelId ? null : state.activePanelId,
      };
    }),

  setActivePanel: (panelId) => {
    if (panelId) get().ensureTab(panelId);
    set({ activePanelId: panelId });
  },

  setQuery: (panelId, query) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: { ...tab, query, currentMatchRank: -1, currentMatchIndex: -1 },
        },
      };
    }),

  setConfig: (panelId, patch) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: { ...tab, config: { ...tab.config, ...patch } },
        },
      };
    }),

  setCurrentMatch: (panelId, rank, index) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: { ...tab, currentMatchRank: rank, currentMatchIndex: index },
        },
      };
    }),

  setIsSearching: (panelId, searching) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: { ...tab, isSearching: searching },
        },
      };
    }),

  setFindVisible: (panelId, visible) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: { ...tab, isFindVisible: visible },
        },
      };
    }),

  requestFocus: (panelId) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: { ...tab, isFindVisible: true, focusRequest: tab.focusRequest + 1 },
        },
      };
    }),

  clearSearch: (panelId) =>
    set((state) => {
      const tab = state.tabs[panelId];
      if (!tab) return state;
      return {
        tabs: {
          ...state.tabs,
          [panelId]: {
            ...tab,
            query: '',
            currentMatchRank: -1,
            currentMatchIndex: -1,
            isSearching: false,
          },
        },
      };
    }),

  getTabState: (panelId) => get().tabs[panelId] ?? defaultTabState(),
}));

// 便捷选择器：activePanel 的 TabState
export const selectActiveTab = (state: SearchStore): TabSearchState | null => {
  if (!state.activePanelId) return null;
  return state.tabs[state.activePanelId] ?? null;
};

export const selectActiveTabQuery = (state: SearchStore): string =>
  selectActiveTab(state)?.query ?? '';
