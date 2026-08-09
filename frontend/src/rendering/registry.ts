// 前端渲染器注册表（图层协议 v2，design D5）
// type → render(content, config) → {segments, rowStyle}
// 渲染器为纯函数；所有调用经错误隔离包装，单个渲染器异常不影响其他图层与日志显示。
import { HighlightSegment, Renderer, RenderResult } from './types';

type RendererRegistry = Map<string, Renderer>;

const registry: RendererRegistry = new Map();

/** 注册渲染器（覆盖同 type） */
export function registerRenderer(type: string, renderer: Renderer): void {
  registry.set(type, renderer);
}

/** 获取渲染器，未注册返回 undefined */
export function getRenderer(type: string): Renderer | undefined {
  return registry.get(type);
}

/** 空结果：错误隔离降级目标 */
const NOOP_RESULT: RenderResult = { segments: [], rowStyle: undefined };

/**
 * 错误隔离渲染入口：未注册或渲染器抛错 → 降级为 no-op。
 * 渲染器内部只产出原始 segments（可重叠），由消费方 mergeHighlights 排序消解。
 */
export function renderWithIsolation(type: string, content: string, config: unknown): RenderResult {
  const renderer = registry.get(type);
  if (!renderer) return NOOP_RESULT;
  try {
    const result = renderer(content, config);
    return {
      segments: Array.isArray(result.segments) ? result.segments : [],
      rowStyle: result.rowStyle ?? undefined,
    };
  } catch {
    return NOOP_RESULT;
  }
}

/**
 * 多图层组合渲染：按顺序应用多个渲染器，聚合 segments 与 rowStyle。
 * 单个图层失败不影响其余图层。
 */
export function renderLayers(types: string[], content: string, configs: unknown[]): RenderResult {
  const segments: HighlightSegment[] = [];
  let rowStyle: RenderResult['rowStyle'];
  types.forEach((type, i) => {
    const result = renderWithIsolation(type, content, configs[i]);
    segments.push(...result.segments);
    if (result.rowStyle) {
      rowStyle = rowStyle ? { ...rowStyle, ...result.rowStyle } : result.rowStyle;
    }
  });
  return { segments, rowStyle };
}

// === 内置渲染器 ===

interface TextMatchConfig {
  query?: string;
  pattern?: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  color?: string;
  opacity?: number;
  [key: string]: unknown;
}

/** 从 config 解析匹配文本（query 优先，兼容 pattern） */
function matchSource(config: TextMatchConfig): string {
  return (config.query ?? config.pattern ?? '') as string;
}

/** 构造匹配用正则：字面量转义或透传 regex，默认大小写不敏感；matchAll 需要 g 标志（global=true 时追加） */
function buildMatcher(source: string, config: TextMatchConfig, global = false): RegExp {
  const baseFlags = config.caseSensitive ? '' : 'i';
  const flags = global && !baseFlags.includes('g') ? baseFlags + 'g' : baseFlags;
  const raw = config.regex ? source : source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const base = new RegExp(raw, flags);
  if (!config.wholeWord) return base;
  return new RegExp(`(?:^|[^\\w])(${base.source})(?=$|[^\\w])`, flags);
}

/** 提取整词正则的捕获组偏移（wholeWord 包裹时正文在 group 1） */
function matchedSpan(m: RegExpExecArray): [number, number] {
  const start =
    m[0].startsWith(m[1] ?? '') && m[1] !== undefined ? m.index + m[0].indexOf(m[1]) : m.index;
  const end = m[1] !== undefined ? start + m[1].length : m.index + m[0].length;
  return [start, end];
}

function defaultSegments(): { color: string; opacity: number; isSearch: boolean } {
  return { color: '#3b82f6', opacity: 100, isSearch: false };
}

/** HIGHLIGHT：按 pattern/query 匹配，逐段高亮 */
registerRenderer('HIGHLIGHT', ((content: string, rawConfig: unknown): RenderResult => {
  const config = (rawConfig ?? {}) as TextMatchConfig;
  const source = matchSource(config);
  if (!source) return { segments: [] };
  const re = buildMatcher(source, config, true);
  const { color, opacity, isSearch } = { ...defaultSegments(), ...pickStyle(config) };
  const segments: HighlightSegment[] = [];
  for (const m of content.matchAll(re)) {
    const [start, end] = matchedSpan(m as unknown as RegExpExecArray);
    if (end > start) segments.push({ start, end, color, opacity, isSearch });
  }
  return { segments };
}) as Renderer);

function pickStyle(config: TextMatchConfig): { color: string; opacity: number; isSearch: boolean } {
  const base = defaultSegments();
  return {
    color: (config.color as string) ?? base.color,
    opacity: (config.opacity as number) ?? base.opacity,
    isSearch: (config.isSearch as boolean) ?? base.isSearch,
  };
}

/** ROWTINT：匹配则整行着色 */
registerRenderer('ROWTINT', ((content: string, rawConfig: unknown): RenderResult => {
  const config = (rawConfig ?? {}) as TextMatchConfig;
  const source = matchSource(config);
  if (!source) return { segments: [], rowStyle: undefined };
  const re = buildMatcher(source, config);
  if (!re.test(content)) return { segments: [], rowStyle: undefined };
  const color = (config.color as string) ?? '#3b82f6';
  return { segments: [], rowStyle: { backgroundColor: color } };
}) as Renderer);

/** LEVEL：按日志级别着色（默认配色，可按 config.levels 覆盖） */ const LEVEL_DEFAULTS: Record<
  string,
  string
> = {
  ERROR: '#ef4444',
  WARN: '#f59e0b',
  INFO: '#3b82f6',
  DEBUG: '#10b981',
  TRACE: '#8b5cf6',
  FATAL: '#dc2626',
};

registerRenderer('LEVEL', ((content: string, rawConfig: unknown): RenderResult => {
  const config = (rawConfig ?? {}) as TextMatchConfig & { levels?: string[] };
  const levels = config.levels ?? Object.keys(LEVEL_DEFAULTS);
  const segments: HighlightSegment[] = [];
  for (const level of levels) {
    const color = LEVEL_DEFAULTS[level] ?? (config.color as string) ?? '#3b82f6';
    const re = new RegExp(`\\b${level}\\b`, 'gi');
    for (const m of content.matchAll(re)) {
      segments.push({
        start: m.index,
        end: m.index + m[0].length,
        color,
        opacity: 100,
        isSearch: false,
      });
    }
  }
  return { segments };
}) as Renderer);
