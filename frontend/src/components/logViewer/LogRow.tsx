import React, { memo, useMemo } from 'react';
import { LogLayer, LogLine, SearchConfig } from '../../types';
import { LOG_VIEWER_COLORS } from '../../theme';
import { renderLayers, renderWithIsolation } from '../../rendering/registry';
import {
  computeGutterWidth,
  gutterDigits,
  gutterCharWidth,
  gutterStarSlot,
  GUTTER_PADDING,
} from '../../constants';

interface HighlightSegment {
  start: number;
  end: number;
  color: string;
  opacity: number;
  isSearch: boolean;
}

interface LogRowProps {
  index: number;
  line: LogLine | string | undefined;
  /** 当前文件的图层配置（仅渲染类，前端渲染器计算图层高亮/行样式，2.6 前端接管） */
  layers?: LogLayer[];
  /** 书签数据（物理行号 → 注释），isMarked 判定与书签样式数据源（fix-bookmark-filter-index：锚定物理行号） */
  bookmarks?: Record<number, string>;
  colors: typeof LOG_VIEWER_COLORS.DARK;
  lineHeight: number;
  gutterWidth: number;
  showLineNumbers: boolean;
  showWhitespace: boolean;
  fontSize: number;
  isHighlighted: boolean;
  wordWrap: boolean;
  fontFamily: string;
  onToggleBookmark?: (index: number) => void;
  searchQuery?: string;
  searchConfig?: SearchConfig;
  /** 原始文件行数（物理行号位数与虚拟列折叠判定依据） */
  rawLineCount: number;
  /** 当前可见行数（过滤后） */
  totalLines: number;
  /** 设置项：显示虚拟行号（默认 true） */
  showVirtualLineNumbers?: boolean;
}

/**
 * Merge potentially overlapping highlights into non-overlapping segments.
 * Later segments (by start position) win over earlier ones.
 */
function mergeHighlights(
  highlights: Array<{ start: number; end: number; color: string; opacity: number; isSearch?: boolean }>,
  contentLength: number
): HighlightSegment[] {
  if (!highlights || highlights.length === 0) {
    return contentLength > 0 ? [{ start: 0, end: contentLength, color: '', opacity: 100, isSearch: false }] : [];
  }
  const sorted = [...highlights].sort((a, b) => a.start - b.start || a.end - b.end);
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const h of sorted) {
    if (h.start > cursor) {
      segments.push({ start: cursor, end: h.start, color: '', opacity: 100, isSearch: false });
      cursor = h.start;
    }
    if (h.end <= cursor) continue;
    segments.push({ start: h.start, end: h.end, color: h.color, opacity: h.opacity, isSearch: !!h.isSearch });
    cursor = h.end;
    if (cursor >= contentLength) break;
  }
  if (cursor < contentLength) {
    segments.push({ start: cursor, end: contentLength, color: '', opacity: 100, isSearch: false });
  }
  return segments;
}

/**
 * LogRow - 单个日志行的 DOM 渲染组件。
 *
 * 由 react-virtuoso 虚拟化外壳按需渲染可见行。
 * - 原生 DOM 文本：浏览器处理选择/复制/中文/字体
 * - 高亮（搜索/图层）经 CSS 实现，与文字精确对齐
 * - 行号 gutter 为 sticky 列，水平滚动时固定
 */
export const LogRow: React.FC<LogRowProps> = memo(({
  index,
  line,
  colors,
  lineHeight,
  gutterWidth,
  showLineNumbers,
  showWhitespace,
  fontSize,
  isHighlighted,
  wordWrap,
  fontFamily,
  onToggleBookmark,
  layers = [],
  bookmarks = {},
  searchQuery = '',
  searchConfig,
  rawLineCount,
  totalLines,
  showVirtualLineNumbers = true,
}) => {
  const logLine = line && typeof line !== 'string' ? (line as LogLine) : null;
  const content = typeof line === 'string' ? line : logLine?.content || '';
  // 物理行号（0-based）：对象形态取 line.index；纯字符串形态退化用视觉索引兜底（D5）
  const physIndex = logLine?.index ?? index;
  const isMarked = bookmarks[physIndex] !== undefined;
  const isLoaded = line !== undefined;
  // 虚拟列仅在有过滤且设置开启时展开
  const virtualVisible = showVirtualLineNumbers && rawLineCount > totalLines;
  // 字符宽/星标槽按实际字号计算（等宽字体 ch≈0.6em），字号变化时随重渲染自动跟随
  const charWidth = gutterCharWidth(fontSize);
  const starSlot = gutterStarSlot(fontSize);
  const physDigits = gutterDigits(rawLineCount, 3);
  const virtDigits = gutterDigits(totalLines, 2);

  const displayContent = useMemo(() => {
    if (!showWhitespace) return content;
    return content.replace(/ /g, '\u00B7').replace(/\t/g, '\u2192 ');
  }, [content, showWhitespace]);

  // 前端按 per-tab 词/配置即时计算搜索高亮（memoize by content+query）
  const searchSegments = useMemo(() => {
    if (!searchQuery) return [];
    const result = renderWithIsolation('HIGHLIGHT', content, {
      query: searchQuery,
      regex: searchConfig?.regex ?? false,
      caseSensitive: searchConfig?.caseSensitive ?? false,
      wholeWord: searchConfig?.wholeWord ?? false,
      color: isHighlighted ? colors.CURRENT_LINE : colors.SEARCH_HIGHLIGHT,
      opacity: 100,
      isSearch: true,
    });
    return result.segments;
  }, [content, searchQuery, searchConfig, isHighlighted, colors]);

  // 前端按图层配置即时计算图层高亮/行样式（memoize by content+layers，替代后端逐行计算）
  const layerResult = useMemo(() => {
    const active = layers.filter(l => l.enabled && !l.isSystemManaged);
    if (active.length === 0) return { segments: [] as HighlightSegment[], rowStyle: undefined };
    return renderLayers(
      active.map(l => l.type as string),
      content,
      active.map(l => l.config)
    );
  }, [layers, content]);

  const segments = useMemo(() => {
    const layerHighlights = (layerResult.segments || []).filter(h => !h.isSearch);
    return mergeHighlights([...layerHighlights, ...searchSegments], displayContent.length);
  }, [layerResult.segments, searchSegments, displayContent.length]);

  const rowBackground = isHighlighted
    ? colors.HIGHLIGHT_LINE
    : layerResult.rowStyle?.backgroundColor || (isMarked ? colors.BOOKMARK_BACKGROUND : 'transparent');

  const textColor = layerResult.rowStyle?.color || colors.TEXT;

  const rowStyleCSS: React.CSSProperties = {
    height: lineHeight,
    lineHeight: `${lineHeight}px`,
    backgroundColor: rowBackground,
    fontFamily,
    fontSize,
    display: 'flex',
    alignItems: 'stretch',
    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
    wordBreak: wordWrap ? 'break-all' : undefined,
  };

  const gutterStyle: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    width: gutterWidth,
    flexShrink: 0,
    backgroundColor: isHighlighted ? colors.HIGHLIGHT_LINE : colors.GUTTER,
    color: isHighlighted ? colors.CURRENT_LINE : colors.GUTTER_TEXT,
    cursor: 'pointer',
    userSelect: 'none',
    borderRight: `1px solid ${colors.RULER}`,
  };

  return (
    <div
      className="log-row"
      data-log-index={index}
      style={rowStyleCSS}
    >
      {showLineNumbers && (
        <span
          className="log-row-gutter"
          style={gutterStyle}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark?.(physIndex);
          }}
        >
          <span
            className="gutter-inner"
            style={{
              display: 'flex',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {/* 物理列（主）：星标槽 + 物理行号，数字右对齐且不被星标覆盖 */}
            <span className="gutter-physical" style={{ flexShrink: 0 }}>
              <span
                className="gutter-star"
                style={{
                  width: starSlot,
                  display: 'inline-block',
                  textAlign: 'center',
                  flexShrink: 0,
                  color: colors.BOOKMARK_INDICATOR,
                  fontWeight: 700,
                }}
              >
                {isMarked ? (bookmarks[physIndex] ? '★' : '●') : '\u00A0'}
              </span>
              <span
                className="gutter-number"
                style={{ minWidth: physDigits * charWidth, textAlign: 'right', flexShrink: 0, overflow: 'hidden' }}
              >
                {(physIndex + 1).toLocaleString()}
              </span>
            </span>
            {/* 虚拟列（辅）：过滤序号，无过滤时折叠为 0 宽（150ms 过渡） */}
            <span
              className={`gutter-virtual${virtualVisible ? '' : ' collapsed'}`}
              aria-hidden={virtualVisible ? undefined : 'true'}
              style={{
                width: virtualVisible ? virtDigits * charWidth + GUTTER_PADDING : 0,
                minWidth: 0,
                flexShrink: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textAlign: 'right',
                fontSize: '0.9em',
                opacity: virtualVisible ? 1 : 0,
                paddingLeft: 4,
                borderLeft: `1px dashed ${isHighlighted ? colors.CURRENT_LINE : colors.RULER}`,
                transition: 'width 150ms ease, opacity 150ms ease',
              }}
            >
              {(index + 1).toLocaleString()}
            </span>
          </span>
        </span>
      )}
      {isLoaded ? (
        <span className="log-row-content" style={{ flex: 1, minWidth: 0, color: textColor }}>
          {segments.map((seg, i) => {
            const text = displayContent.substring(seg.start, seg.end);
            if (seg.isSearch) {
              return (
                <mark key={i} style={{ backgroundColor: seg.color, color: '#000' }}>
                  {text}
                </mark>
              );
            }
            if (seg.color) {
              const alphaHex = Math.max(0, Math.min(255, Math.floor(((seg.opacity ?? 100) / 100) * 255)))
                .toString(16)
                .padStart(2, '0');
              return (
                <span key={i} style={{ color: seg.color.startsWith('#') ? `${seg.color}${alphaHex}` : seg.color }}>
                  {text}
                </span>
              );
            }
            return <span key={i}>{text}</span>;
          })}
        </span>
      ) : (
        // 骨架占位：数据未加载时显示行号 + 灰色骨架条，滚动期间位置/行号即时可见
        <span className="log-row-content log-row-skeleton" style={{ flex: 1, minWidth: 0 }} aria-busy="true">
          <span
            style={{
              display: 'inline-block',
              width: Math.min(60 + (index % 40) * 3, 80) + '%',
              height: Math.max(10, lineHeight - 8),
              marginTop: Math.max(2, (lineHeight - 12) / 2),
              backgroundColor: colors.GUTTER_TEXT,
              opacity: 0.35,
              borderRadius: 2,
            }}
          />
        </span>
      )}
    </div>
  );
});

LogRow.displayName = 'LogRow';
