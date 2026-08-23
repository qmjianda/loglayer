import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PluginWidgetSlot } from './PluginWidgetSlot';
import { registerWidgetRenderer } from '../rendering/registry';
import type { UIWidgetInfo } from '../hooks/usePluginWidgets';

function mockFetchSequence(responses: unknown[]) {
  const queue = [...responses];
  return vi.fn().mockImplementation(() => {
    const json = queue.shift() ?? [];
    return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue(json) });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetchSequence([[]]));
});
afterEach(() => {
  vi.restoreAllMocks();
});

function widget(overrides: Partial<UIWidgetInfo>): UIWidgetInfo {
  return {
    type: 'W_X',
    plugin_id: 'acme.p',
    display_name: 'X',
    description: '',
    slot: 'statusbar',
    renderer_id: '',
    config: {},
    role: 'statusbar',
    refresh_interval: 0,
    ...overrides,
  };
}

describe('PluginWidgetSlot 固定槽位宿主', () => {
  it('无插件时渲染 null（空槽位零占位）', async () => {
    const { container } = render(<PluginWidgetSlot slot="inspector" />);
    await vi.waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('sidebar 槽位渲染该槽位 widget 文本', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        [
          widget({
            type: 'W_SIDE',
            display_name: '侧栏挂件',
            slot: 'sidebar',
            role: 'sidebar',
            refresh_interval: 5,
          }),
        ],
        { text: '侧栏数据' },
      ]),
    );
    render(<PluginWidgetSlot slot="sidebar" />);
    await vi.waitFor(() => expect(screen.getByText('侧栏数据')).toBeTruthy());
  });

  it('editor_toolbar 槽位只消费本槽位数据', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        [
          widget({
            type: 'W_T',
            display_name: '工具挂件',
            slot: 'editor_toolbar',
            role: 'editor_toolbar',
            refresh_interval: 5,
          }),
          widget({ type: 'W_S', display_name: '状态挂件', slot: 'statusbar', role: 'statusbar' }),
        ],
        { text: '工具数据' },
      ]),
    );
    render(<PluginWidgetSlot slot="editor_toolbar" />);
    await vi.waitFor(() => expect(screen.getByText('工具数据')).toBeTruthy());
    expect(screen.queryByText('状态挂件')).not.toBeTruthy();
  });

  it('静态 renderer 参与渲染；renderer 抛错时降级为默认文本（widget 局部隔离）', async () => {
    registerWidgetRenderer('test.slot.upper', ({ data }) => ({
      text: String(data.text).toUpperCase(),
    }));
    registerWidgetRenderer('test.slot.boom', () => {
      throw new Error('broken');
    });
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        [
          widget({
            type: 'W_UP',
            display_name: 'fallback-up',
            renderer_id: 'test.slot.upper',
            refresh_interval: 5,
          }),
          widget({
            type: 'W_BOOM',
            display_name: 'fallback-boom',
            renderer_id: 'test.slot.boom',
            refresh_interval: 5,
          }),
        ],
        { text: 'hello' },
        { text: 'world' },
      ]),
    );
    render(<PluginWidgetSlot slot="statusbar" />);
    await vi.waitFor(() => expect(screen.getByText('HELLO')).toBeTruthy());
    expect(screen.getByText('world')).toBeTruthy();
  });
});
