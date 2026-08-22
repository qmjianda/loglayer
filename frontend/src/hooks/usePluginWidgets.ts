import { useState, useEffect } from 'react';

// ── Slot & Role 类型 ─────────────────────────────────────────────

export type WidgetSlot = 'sidebar' | 'inspector' | 'statusbar' | 'editor_toolbar';

const KNOWN_SLOTS: ReadonlySet<string> = new Set<string>([
  'sidebar',
  'inspector',
  'statusbar',
  'editor_toolbar',
]);

export function isKnownSlot(role: string): role is WidgetSlot {
  return KNOWN_SLOTS.has(role);
}

// ── Widget metadata 类型 ─────────────────────────────────────────

export interface UIWidgetInfo {
  type: string;
  plugin_id: string;
  display_name: string;
  description: string;
  slot: WidgetSlot;
  renderer_id: string;
  config: Record<string, unknown>;
  role: WidgetSlot;
  refresh_interval: number;
}

export interface UIWidgetData {
  text?: string;
  color?: string;
  tooltip?: string;
  icon?: string;
  extra?: Record<string, unknown>;
}

// ── Widget Renderer 类型 ─────────────────────────────────────────

export interface WidgetRenderInput {
  data: UIWidgetData;
  config: Record<string, unknown>;
  widget: UIWidgetInfo;
}

export interface WidgetRenderOutput {
  text?: string;
  color?: string;
  tooltip?: string;
  icon?: string;
  className?: string;
}

export type WidgetRenderer = (input: WidgetRenderInput) => WidgetRenderOutput;

// ── Hook ─────────────────────────────────────────────────────────

const BACKEND_URL = '';

export const usePluginWidgets = (role: WidgetSlot) => {
  const [widgets, setWidgets] = useState<UIWidgetInfo[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, UIWidgetData>>({});

  // 1. 获取挂件元数据（仅声明式，不加载代码）
  useEffect(() => {
    let cancelled = false;

    const fetchWidgets = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/get_ui_widgets`);
        if (!res.ok) return;
        const raw: Array<Record<string, unknown>> = await res.json();

        const normalized: UIWidgetInfo[] = raw
          .map((item) => normalizeWidgetInfo(item))
          .filter((w) => w.slot === role);

        if (!cancelled) setWidgets(normalized);
      } catch (e) {
        console.error('[PluginWidgets] Failed to fetch widgets:', e);
      }
    };

    fetchWidgets();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // 2. 定时刷新挂件数据
  useEffect(() => {
    const timers: number[] = [];

    widgets.forEach((widget) => {
      if (widget.refresh_interval <= 0) return;

      const fetchOnce = async () => {
        try {
          const res = await fetch(
            `${BACKEND_URL}/api/get_widget_data?type_id=${encodeURIComponent(widget.type)}`,
          );
          if (!res.ok) return;
          const raw: Record<string, unknown> = await res.json();
          const data = normalizeWidgetData(raw);
          setWidgetData((prev) => ({ ...prev, [widget.type]: data }));
        } catch (e) {
          console.error(`[PluginWidgets] Failed to fetch data for ${widget.type}:`, e);
        }
      };

      fetchOnce();
      const timer = window.setInterval(fetchOnce, widget.refresh_interval * 1000);
      timers.push(timer);
    });

    return () => timers.forEach((t) => clearInterval(t));
  }, [widgets]);

  return { widgets, widgetData };
};

// ── 内部工具函数 ─────────────────────────────────────────────────

function normalizeWidgetInfo(raw: Record<string, unknown>): UIWidgetInfo {
  const roleStr = asString(raw['role']) ?? 'statusbar';
  const slotStr = asString(raw['slot']) ?? roleStr;

  return {
    type: asString(raw['type']) ?? '',
    plugin_id: asString(raw['plugin_id']) ?? '',
    display_name: asString(raw['display_name']) ?? '',
    description: asString(raw['description']) ?? '',
    slot: isKnownSlot(slotStr) ? slotStr : 'statusbar',
    renderer_id: asString(raw['renderer_id']) ?? '',
    config: asRecord(raw['config']),
    role: isKnownSlot(roleStr) ? roleStr : 'statusbar',
    refresh_interval: typeof raw['refresh_interval'] === 'number' ? raw['refresh_interval'] : 0,
  };
}

// 将后端原始 widget data 对象规范化为 UIWidgetData。
// 未知字段放入 extra（Record<string, unknown>），避免 any 逃生。
function normalizeWidgetData(raw: Record<string, unknown>): UIWidgetData {
  const known = new Set(['text', 'color', 'tooltip', 'icon']);
  const extra: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (!known.has(k)) {
      extra[k] = v;
    }
  }

  return {
    text: asString(raw['text']),
    color: asString(raw['color']),
    tooltip: asString(raw['tooltip']),
    icon: asString(raw['icon']),
    extra: Object.keys(extra).length > 0 ? extra : undefined,
  };
}

function asString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function asRecord(val: unknown): Record<string, unknown> {
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}
