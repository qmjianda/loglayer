import React, { memo, useMemo } from 'react';
import { LogLine } from '../../types';
import { LOG_VIEWER_COLORS } from '../../theme';

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
}) => {
  const logLine = line && typeof line !== 'string' ? (line as LogLine) : null;
  const content = typeof line === 'string' ? line : logLine?.content || '';
  const isMarked = logLine?.isMarked;
  const rowStyle = logLine?.rowStyle;
  const isLoaded = line !== undefined;

  const displayContent = useMemo(() => {
    if (!showWhitespace) return content;
    return content.replace(/ /g, '\u00B7').replace(/\t/g, '\u2192 ');
  }, [content, showWhitespace]);

  const segments = useMemo(
    () => mergeHighlights(logLine?.highlights || [], displayContent.length),
    [logLine?.highlights, displayContent.length]
  );

  const rowBackground = isHighlighted
    ? colors.HIGHLIGHT_LINE
    : rowStyle?.backgroundColor || (isMarked ? colors.BOOKMARK_BACKGROUND : 'transparent');

  const textColor = rowStyle?.color || colors.TEXT;

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
    textAlign: 'right',
    paddingRight: 10,
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
            onToggleBookmark?.(index);
          }}
        >
          {(index + 1).toLocaleString()}
          {isMarked ? (logLine?.bookmarkComment ? ' ★' : ' ●') : ''}
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
