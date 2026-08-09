/**
 * per-tab 搜索状态机测试（2.11）：searchStore 的 TabState 生命周期与面板独立性。
 * 覆盖 ensureTab/destroyTab、面板独立状态、setActivePanel、clearSearch、getTabState。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore, selectActiveTab, selectActiveTabQuery } from './searchStore';

beforeEach(() => {
  // 重置 store 状态（保留 actions）
  useSearchStore.setState({ tabs: {}, activePanelId: null });
});

describe('TabState 生命周期', () => {
  it('ensureTab 创建默认状态（空词/rank -1/find 隐藏）', () => {
    useSearchStore.getState().ensureTab('panel-A');
    const tab = useSearchStore.getState().tabs['panel-A'];
    expect(tab.query).toBe('');
    expect(tab.config).toEqual({
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      mode: 'highlight',
    });
    expect(tab.currentMatchRank).toBe(-1);
    expect(tab.currentMatchIndex).toBe(-1);
    expect(tab.isSearching).toBe(false);
    expect(tab.isFindVisible).toBe(false);
    expect(tab.focusRequest).toBe(0); // Ctrl+F 聚焦请求计数默认 0
  });

  it('ensureTab 幂等（已存在不覆盖）', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().setQuery('panel-A', 'error');
    useSearchStore.getState().ensureTab('panel-A');
    expect(useSearchStore.getState().tabs['panel-A'].query).toBe('error');
  });

  it('destroyTab 删除面板状态并清理 activePanelId', () => {
    useSearchStore.getState().setActivePanel('panel-A');
    useSearchStore.getState().destroyTab('panel-A');
    expect(useSearchStore.getState().tabs['panel-A']).toBeUndefined();
    expect(useSearchStore.getState().activePanelId).toBeNull();
  });

  it('destroyTab 不影响其他面板', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().setQuery('panel-A', 'error');
    useSearchStore.getState().destroyTab('panel-B');
    expect(useSearchStore.getState().tabs['panel-A'].query).toBe('error');
  });
});

describe('面板级独立搜索状态', () => {
  it('各面板独立 query/config/rank', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().ensureTab('panel-B');
    useSearchStore.getState().setQuery('panel-A', 'error');
    useSearchStore.getState().setQuery('panel-B', 'timeout');
    useSearchStore.getState().setCurrentMatch('panel-A', 2, 10);

    expect(useSearchStore.getState().tabs['panel-A'].query).toBe('error');
    expect(useSearchStore.getState().tabs['panel-B'].query).toBe('timeout');
    expect(useSearchStore.getState().tabs['panel-A'].currentMatchRank).toBe(2);
    expect(useSearchStore.getState().tabs['panel-B'].currentMatchRank).toBe(-1); // 互不干扰
  });

  it('setConfig 按面板合并配置', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().setConfig('panel-A', { caseSensitive: true });
    const config = useSearchStore.getState().tabs['panel-A'].config;
    expect(config.caseSensitive).toBe(true);
    expect(config.regex).toBe(false); // 其余字段保留默认
  });

  it('setFindVisible 按面板记忆', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().ensureTab('panel-B');
    useSearchStore.getState().setFindVisible('panel-A', true);
    expect(useSearchStore.getState().tabs['panel-A'].isFindVisible).toBe(true);
    expect(useSearchStore.getState().tabs['panel-B'].isFindVisible).toBe(false);
  });

  it('requestFocus 展开 widget 并递增 focusRequest（Ctrl+F 重复按下可触发 focus+select）', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().requestFocus('panel-A');
    expect(useSearchStore.getState().tabs['panel-A'].isFindVisible).toBe(true);
    expect(useSearchStore.getState().tabs['panel-A'].focusRequest).toBe(1);
    useSearchStore.getState().requestFocus('panel-A');
    expect(useSearchStore.getState().tabs['panel-A'].focusRequest).toBe(2);
    useSearchStore.getState().ensureTab('panel-B');
    expect(useSearchStore.getState().tabs['panel-B'].focusRequest).toBe(0);
  });
});

describe('setActivePanel 与选择器', () => {
  it('setActivePanel 自动 ensureTab 并更新 activePanelId', () => {
    useSearchStore.getState().setActivePanel('panel-C');
    expect(useSearchStore.getState().activePanelId).toBe('panel-C');
    expect(useSearchStore.getState().tabs['panel-C']).toBeDefined();
  });

  it('selectActiveTab 返回激活面板状态', () => {
    useSearchStore.getState().setActivePanel('panel-A');
    useSearchStore.getState().setQuery('panel-A', 'error');
    const tab = selectActiveTab(useSearchStore.getState());
    expect(tab?.query).toBe('error');
  });

  it('selectActiveTab 无激活面板返回 null', () => {
    expect(selectActiveTab(useSearchStore.getState())).toBeNull();
  });

  it('selectActiveTabQuery 返回激活面板词', () => {
    useSearchStore.getState().setActivePanel('panel-A');
    useSearchStore.getState().setQuery('panel-A', 'hello');
    expect(selectActiveTabQuery(useSearchStore.getState())).toBe('hello');
  });
});

describe('clearSearch', () => {
  it('仅清空该面板的词/rank/搜索态，保留 config 与 find 可见性', () => {
    useSearchStore.getState().ensureTab('panel-A');
    useSearchStore.getState().setConfig('panel-A', { regex: true });
    useSearchStore.getState().setFindVisible('panel-A', true);
    useSearchStore.getState().setQuery('panel-A', 'error');
    useSearchStore.getState().setCurrentMatch('panel-A', 1, 5);
    useSearchStore.getState().setIsSearching('panel-A', true);

    useSearchStore.getState().clearSearch('panel-A');
    const tab = useSearchStore.getState().tabs['panel-A'];
    expect(tab.query).toBe('');
    expect(tab.currentMatchRank).toBe(-1);
    expect(tab.currentMatchIndex).toBe(-1);
    expect(tab.isSearching).toBe(false);
    expect(tab.config.regex).toBe(true); // 配置保留
    expect(tab.isFindVisible).toBe(true); // 可见性保留
  });

  it('getTabState 对不存在面板返回默认状态', () => {
    const tab = useSearchStore.getState().getTabState('nonexistent');
    expect(tab.query).toBe('');
    expect(tab.currentMatchRank).toBe(-1);
  });
});
