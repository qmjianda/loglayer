import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePluginWidgets, isKnownSlot, type WidgetSlot } from './usePluginWidgets';

function mockFetch(jsonData: unknown, ok = true) {
  const json = vi.fn().mockResolvedValue(jsonData);
  return vi.fn().mockResolvedValue({ ok, json });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch([]));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('isKnownSlot', () => {
  it('returns true for all four fixed slots', () => {
    expect(isKnownSlot('sidebar')).toBe(true);
    expect(isKnownSlot('inspector')).toBe(true);
    expect(isKnownSlot('statusbar')).toBe(true);
    expect(isKnownSlot('editor_toolbar')).toBe(true);
  });

  it('returns false for unknown slots', () => {
    expect(isKnownSlot('header')).toBe(false);
    expect(isKnownSlot('')).toBe(false);
    expect(isKnownSlot('STATUSBAR')).toBe(false);
  });
});

describe('usePluginWidgets hook', () => {
  it('fetches widgets and filters by role (statusbar only)', async () => {
    const widgets = [
      { type: 'W_A', display_name: 'A', role: 'statusbar', refresh_interval: 0 },
      { type: 'W_B', display_name: 'B', role: 'sidebar', refresh_interval: 0 },
      { type: 'W_C', display_name: 'C', role: 'statusbar', refresh_interval: 0 },
    ];
    vi.stubGlobal('fetch', mockFetch(widgets));

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgets).toHaveLength(2);
    });
    expect(result.current.widgets.map((w) => w.type)).toEqual(['W_A', 'W_C']);
  });

  it('normalizes backend data — missing slot falls back to role', async () => {
    const widgets = [
      { type: 'W1', display_name: 'W1', role: 'editor_toolbar', refresh_interval: 0 },
    ];
    vi.stubGlobal('fetch', mockFetch(widgets));

    const { result } = renderHook(() => usePluginWidgets('editor_toolbar'));

    await waitFor(() => {
      expect(result.current.widgets).toHaveLength(1);
    });
    const w = result.current.widgets[0];
    expect(w.slot).toBe('editor_toolbar');
    expect(w.role).toBe('editor_toolbar');
    expect(w.plugin_id).toBe('');
    expect(w.description).toBe('');
    expect(w.renderer_id).toBe('');
    expect(w.config).toEqual({});
  });

  it('unknown slot in backend data falls back to statusbar', async () => {
    const widgets = [{ type: 'W1', display_name: 'W1', role: 'footer', refresh_interval: 0 }];
    vi.stubGlobal('fetch', mockFetch(widgets));

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgets).toHaveLength(1);
    });
    expect(result.current.widgets[0].slot).toBe('statusbar');
  });

  it('unknown role in backend data falls back to statusbar', async () => {
    const widgets = [{ type: 'W1', display_name: 'W1', role: 'unknown_role', refresh_interval: 0 }];
    vi.stubGlobal('fetch', mockFetch(widgets));

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgets).toHaveLength(1);
    });
    expect(result.current.widgets[0].role).toBe('statusbar');
  });

  it('fetches widget data for widgets with refresh_interval > 0', async () => {
    const widgets = [
      { type: 'W_LIVE', display_name: 'Live', role: 'statusbar', refresh_interval: 5 },
    ];
    const widgetData = { text: '12 files', color: '#0f0', tooltip: 'Open files' };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(widgets) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(widgetData) });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgetData['W_LIVE']).toBeDefined();
    });
    expect(result.current.widgetData['W_LIVE']?.text).toBe('12 files');
    expect(result.current.widgetData['W_LIVE']?.color).toBe('#0f0');
  });

  it('does not fetch data for widgets with refresh_interval = 0', async () => {
    const widgets = [
      { type: 'W_STATIC', display_name: 'Static', role: 'statusbar', refresh_interval: 0 },
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(widgets) });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgets).toHaveLength(1);
    });
    expect(Object.keys(result.current.widgetData)).toHaveLength(0);
  });

  it('normalizes widget data — extra fields go to extra, not any', async () => {
    const widgets = [{ type: 'W1', display_name: 'W1', role: 'statusbar', refresh_interval: 5 }];
    const raw = { text: 'hi', custom_field: 42, another: true };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(widgets) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(raw) });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgetData['W1']).toBeDefined();
    });
    const data = result.current.widgetData['W1']!;
    expect(data.text).toBe('hi');
    expect(data.extra).toEqual({ custom_field: 42, another: true });
  });

  it('gracefully handles non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgets).toEqual([]);
    });
  });

  it('gracefully handles fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const { result } = renderHook(() => usePluginWidgets('statusbar'));

    await waitFor(() => {
      expect(result.current.widgets).toEqual([]);
    });
  });
});
