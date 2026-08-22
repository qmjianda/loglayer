import { useState, useEffect } from 'react';

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

const BACKEND_URL = '';

export const usePluginWidgets = (role: WidgetSlot) => {
  const [widgets, setWidgets] = useState<UIWidgetInfo[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, UIWidgetData>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchWidgets = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/get_ui_widgets`);
        if (!res.ok) return;
        const raw: Array<Record<string, unknown>> = await res.json();
        const normalized = raw
          .map(normalizeWidgetInfo)
          .filter((w): w is UIWidgetInfo => w !== null && w.slot === role);
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
          setWidgetData((prev) => ({ ...prev, [widget.type]: normalizeWidgetData(raw) }));
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

function normalizeWidgetInfo(raw: Record<string, unknown>): UIWidgetInfo | null {
  const roleStr = asString(raw.role) ?? 'statusbar';
  const slotStr = asString(raw.slot) ?? roleStr;
  if (!isKnownSlot(slotStr)) return null;
  return {
    type: asString(raw.type) ?? '',
    plugin_id: asString(raw.plugin_id) ?? '',
    display_name: asString(raw.display_name) ?? '',
    description: asString(raw.description) ?? '',
    slot: slotStr,
    renderer_id: asString(raw.renderer_id) ?? '',
    config: asRecord(raw.config),
    role: isKnownSlot(roleStr) ? roleStr : slotStr,
    refresh_interval: typeof raw.refresh_interval === 'number' ? raw.refresh_interval : 0,
  };
}

function normalizeWidgetData(raw: Record<string, unknown>): UIWidgetData {
  const known = new Set(['text', 'color', 'tooltip', 'icon']);
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) extra[key] = value;
  }
  return {
    text: asString(raw.text),
    color: asString(raw.color),
    tooltip: asString(raw.tooltip),
    icon: asString(raw.icon),
    extra: Object.keys(extra).length > 0 ? extra : undefined,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
