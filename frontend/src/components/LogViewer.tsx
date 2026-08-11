import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LogLine, LogLayer, LayerType } from '../types';
import { readProcessedLines } from '../bridge_client';
import { BookmarkPopover } from './BookmarkPopover';
import { EditorGoToLineWidget } from './EditorGoToLineWidget';
import { ErrorBoundary } from './ErrorBoundary';
import { JsonTreeView } from './JsonTreeView';
import { LOG_VIEWER, computeGutterWidth } from '../constants';
import { getLogViewerColors } from '../theme';
import { AppSettings } from '../hooks/useSettings';
import { detectJson } from '../utils/jsonTree';
import { LogRow } from './logViewer/LogRow';
import { computeRevealScrollTop } from '../utils/revealScroll';
import { useVirtualScroll } from '../hooks/useVirtualScroll';
import { PerformanceIndicator } from './PerformanceIndicator';

interface LogViewerProps {
  totalLines: number;
  fileId: string | null;
  /** 稳定标识（如文件路径），用于跨重挂载持久化滚动位置 */
  scrollKey?: string;
  searchQuery: string;
  searchConfig: { regex: boolean; caseSensitive: boolean; wholeWord?: boolean };
  scrollToIndex?: number | null;
  highlightedIndex?: number | null;
  isSearching?: boolean;
  isIndexing?: boolean;
  indexingProgress?: number;
  onLineClick?: (index: number) => void;
  onAddLayer?: (type: LayerType, config?: any) => void;
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
  onToggleBookmark?: (lineIndex: number) => void;
  onUpdateBookmarkComment?: (lineIndex: number, comment: string) => void;
  onSelectedTextChange?: (text: string) => void;
  onSendToAI?: (text: string) => void;
  updateTrigger?: number;
  /** 当前文件的图层列表（前端渲染器按此计算图层高亮/行样式，替代后端逐行计算） */
  layers?: LogLayer[];
  layerStats?: Record<string, { count: number; distribution: number[] }>;
  bookmarks?: Record<number, string>;
  settings?: AppSettings;
  resolvedTheme?: 'dark' | 'light';
  hasNewContent?: boolean;
  onScrollToNewContent?: () => void;
  /** 原始文件行数（物理行号显示与虚拟列折叠判定；缺省时退化为 totalLines） */
  rawLineCount?: number;
  /** 设置项：显示虚拟行号（默认 true） */
  showVirtualLineNumbers?: boolean;
}

// 浏览器滚动容器安全高度上限（Chrome ~33.5M px），留余量
const MAX_SCROLL_HEIGHT = 30_000_000;

// 滚动位置持久化：key 为稳定文件标识（uri）。LogViewer 因 fileId 变化/面板重建
// 而重挂载时，恢复此前进度，避免"每次切 tab / 加书签就跳回首行"。
const LOGVIEWER_SCROLL_STORE = new Map<string, { scrollTop: number }>();

// 渲染依赖引用稳定（React.memo 生效前提）：默认空配置用 module 级冻结常量，
// 重渲染间引用恒定，避免「未配置图层/书签」时每次新建对象导致 LogRow 浅比较失效。
const EMPTY_LAYERS: LogLayer[] = [];
Object.freeze(EMPTY_LAYERS);
const EMPTY_BOOKMARKS: Record<number, string> = {};
Object.freeze(EMPTY_BOOKMARKS);

/**
 * LogViewer - DOM 虚拟化重构版
 *
 * 外层真实滚动容器（spacer 撑高，超大文件压缩高度）+ 内层 react-virtuoso
 * 渲染窗口行。原生 DOM 文本提供选择/复制/中文/字体缩放能力。
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  totalLines,
  fileId,
  scrollKey,
  searchQuery,
  searchConfig,
  scrollToIndex,
  highlightedIndex,
  isSearching = false,
  isIndexing = false,
  indexingProgress = 0,
  onLineClick,
  onAddLayer,
  onVisibleRangeChange,
  onToggleBookmark,
  onUpdateBookmarkComment,
  onSelectedTextChange,
  onSendToAI,
  updateTrigger,
  layers = EMPTY_LAYERS,
  layerStats = {},
  bookmarks = EMPTY_BOOKMARKS,
  settings,
  resolvedTheme = 'dark',
  hasNewContent = false,
  onScrollToNewContent,
  rawLineCount,
  showVirtualLineNumbers = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollStateRef = useRef({ top: 0, left: 0 });
  const viewportHeightRef = useRef(0);

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  // 同步 viewportHeight 到 ref，供原生 scroll 监听读取
  useEffect(() => {
    viewportHeightRef.current = viewportHeight;
  }, [viewportHeight]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
    lineIndex?: number;
  } | null>(null);
  const [commentPopover, setCommentPopover] = useState<{
    x: number;
    y: number;
    lineIndex: number;
    comment: string;
  } | null>(null);
  const [expandedJsonLine, setExpandedJsonLine] = useState<number | null>(null);
  const [showGoToLine, setShowGoToLine] = useState(false);

  // 当前渲染窗口（逻辑行区间）
  const [windowStart, setWindowStart] = useState(0);

  const [bridgedLines, setBridgedLines] = useState<Map<number, LogLine | string>>(new Map());
  const lastFetchRef = useRef<{ start: number; end: number }>({ start: -1, end: -1 });

  // 最近一次由用户/原生滚动更新的时间（区分「用户滚到顶」与「外部把滚动条归零」）
  const lastScrollEventRef = useRef(0);

  // === 滚动位置看门狗 ===
  // dockview 激活/失活面板（切换 `dv-active-group` 等 class）时，浏览器会把面板内容的
  // DOM 滚动条归零，且不触发 scroll 事件（React state 仍是旧值），导致视觉上跳回首行。
  // 这里逐帧检测「DOM=0 但 state>0 且近期无用户滚动」的脱节，同帧拉回真实位置。
  // 用户真正滚动到顶时 scroll 事件会把 state 同步为 0，因此不会误干预。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const top = el.scrollTop;
      const state = scrollStateRef.current.top;
      if (top === 0 && state > 0 && performance.now() - lastScrollEventRef.current > 80) {
        el.scrollTop = state;
        setScrollTop(state);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { LINE_HEIGHT, SCROLL_MARGIN, FETCH_DEBOUNCE_MS } = LOG_VIEWER;

  // 原始行数（缺省退化为可见行数）：物理行号位数 / 虚拟列折叠判定 / ruler 基准
  const rawCount = rawLineCount ?? totalLines;
  // 虚拟列仅在有过滤（可见行 < 原始行）且设置开启时展开
  const virtualVisible = (showVirtualLineNumbers ?? true) && rawCount > totalLines;
  // gutter 宽度按当前字号计算，字号变化（设置）时随重渲染自动更新
  const fontSize = settings?.fontSize ?? 12;
  const gutterWidth = computeGutterWidth(rawCount, totalLines, virtualVisible, fontSize);

  const lineHeight = settings?.lineHeight ?? LINE_HEIGHT;
  const wordWrap = settings?.wordWrap ?? false;
  const showWhitespace = settings?.showWhitespace ?? false;
  const showLineNumbers = settings?.showLineNumbers ?? true;
  const showRuler = settings?.showRuler ?? true;
  const theme = resolvedTheme ?? 'dark';
  // 渲染依赖引用稳定：主题未变时 colors 引用不变，React.memo(LogRow) 浅比较可命中
  const colors = useMemo(() => getLogViewerColors(theme as 'dark' | 'light'), [theme]);

  // === FPS 采集（debugMode 专用）：默认关闭零开销，开启时仅只读测量（rAF 计数） ===
  // 采集结果仅在本组件内以 PerformanceIndicator 呈现（App 层不传 performanceMetrics 给
  // StatusBar，此处直接渲染最小侵入，避免改动 App.tsx）。
  const debugMode = settings?.debugMode ?? false;
  const { metrics } = useVirtualScroll({ debugMode, enabled: true });

  const fontFamily =
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  // === 滚动缩放（亿行支持，仅非 wordWrap 固定行高模式生效） ===
  const realTotalHeight = totalLines * lineHeight;
  const useScaling = realTotalHeight > MAX_SCROLL_HEIGHT;
  // spacer 高度：缩放时用上限，非缩放时至少覆盖视口（避免短文件出现假滚动条）
  const scaledHeight = useScaling ? MAX_SCROLL_HEIGHT : realTotalHeight;
  const virtualTotalHeight =
    Math.max(viewportHeight, scaledHeight) + (scaledHeight > viewportHeight ? SCROLL_MARGIN : 0);

  // 物理 scrollTop → 逻辑 scrollTop
  const maxPhysicalScroll = Math.max(0, virtualTotalHeight - viewportHeight);
  const maxLogicalScroll = Math.max(0, realTotalHeight - viewportHeight);
  const logicalScrollTop =
    useScaling && maxPhysicalScroll > 0
      ? (scrollTop / maxPhysicalScroll) * maxLogicalScroll
      : scrollTop;

  const topVisibleLine = Math.max(0, Math.floor(logicalScrollTop / lineHeight));
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / lineHeight));

  // === 渲染窗口（固定大小）：窗口随 topVisibleLine 平移 ===
  // 缓冲取可见行与固定下限的较大者；首屏挂载时可见行为 1，固定下限避免
  // 小文件被一次全量渲染（几 KB 文件几百行会导致首屏长任务阻塞）。
  const windowBuffer = Math.max(50, visibleRows);
  const windowSize = Math.min(totalLines, visibleRows + 2 * windowBuffer);
  const maxWindowStart = Math.max(0, totalLines - windowSize);

  const desiredWindowStart = Math.max(0, Math.min(topVisibleLine - windowBuffer, maxWindowStart));

  useEffect(() => {
    setWindowStart((prev) => {
      if (Math.abs(desiredWindowStart - prev) >= windowBuffer * 0.5) {
        return desiredWindowStart;
      }
      return prev;
    });
  }, [desiredWindowStart, windowBuffer]);

  const windowEnd = Math.min(totalLines, windowStart + windowSize);
  // 窗口内偏移（像素）：视口顶部应显示 topVisibleLine，窗口首行是 windowStart
  const windowOffsetPx = Math.max(0, topVisibleLine - windowStart) * lineHeight;
  // 窗口内渲染的行数
  const itemCount = windowEnd - windowStart;

  // === 尺寸监听：useLayoutEffect 同步测量确保 viewportHeight 立即可用 ===
  useLayoutEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const el = containerRef.current;
        const h = el.clientHeight;
        const w = el.clientWidth;
        if (h > 0) setViewportHeight(h);
        if (w > 0) setViewportWidth(w);
      }
    };
    measure();
    const handleResize = () => {
      measure();
    };
    window.addEventListener('resize', handleResize);
    // ResizeObserver 跟踪后续尺寸变化
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(measure);
      observer.observe(containerRef.current);
    }
    // 兜底：dockview 面板异步创建时，用 rAF+setTimeout 确保测量到
    const rafId = requestAnimationFrame(measure);
    const timerId = setTimeout(measure, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, []);

  // === 原生 scroll 监听：dockview 中 React onScroll 合成事件不可靠，
  // 改用原生 addEventListener 绑定容器，滚动事件经 rAF 同步到 state ===
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const top = el.scrollTop;
        const left = el.scrollLeft;
        scrollStateRef.current = { top, left };
        lastScrollEventRef.current = performance.now();
        if (scrollKey) LOGVIEWER_SCROLL_STORE.set(scrollKey, { scrollTop: top });
        if (viewportHeightRef.current === 0) {
          const h = el.clientHeight;
          if (h > 0) setViewportHeight(h);
        }
        setScrollTop(top);
        setScrollLeft(left);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollKey]);

  const prevFileIdRef = useRef<string | null | undefined>(undefined);

  // fileId/scrollKey 变化时重建行缓存并维持滚动位置。
  // - 首次挂载：有历史进度则恢复（跨重挂载保持位置），否则顶部。
  // - fileId 变化（同一面板，同一 uri，如工作区恢复换了 id）：保留当前滚动位置，
  //   只重建行缓存；期间外部（dockview 激活/失活）可能把 DOM 滚动条归零，从 store
  //   读回并连续几帧重新断言（与下方看门狗共同兜底）。
  useEffect(() => {
    const isFirst = prevFileIdRef.current === undefined;
    prevFileIdRef.current = fileId;
    if (isFirst) {
      const stored = scrollKey ? LOGVIEWER_SCROLL_STORE.get(scrollKey) : undefined;
      const restoreTop = stored ? stored.scrollTop : 0;
      setBridgedLines(new Map());
      lastFetchRef.current = { start: -1, end: -1 };
      setWindowStart(0);
      setScrollTop(restoreTop);
      if (containerRef.current) containerRef.current.scrollTop = restoreTop;
    } else {
      const stored = scrollKey ? LOGVIEWER_SCROLL_STORE.get(scrollKey) : undefined;
      const keepTop = stored ? stored.scrollTop : (containerRef.current?.scrollTop ?? 0);
      setBridgedLines(new Map());
      lastFetchRef.current = { start: -1, end: -1 };
      setWindowStart(0);
      if (keepTop > 0) {
        let frames = 0;
        const reassert = () => {
          if (containerRef.current && containerRef.current.scrollTop === 0 && keepTop > 0) {
            containerRef.current.scrollTop = keepTop;
            setScrollTop(keepTop);
            scrollStateRef.current.top = keepTop;
          }
          if (++frames < 3) requestAnimationFrame(reassert);
        };
        requestAnimationFrame(reassert);
      }
    }
    // dockview 面板切换/新文件时强制重新测量 viewport，避免空白
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const h = containerRef.current.clientHeight;
        if (h > 0) setViewportHeight(h);
        const w = containerRef.current.clientWidth;
        if (w > 0) setViewportWidth(w);
      }
    });
    // fileId 变化/新文件：重新测量 viewport 由上方 rAF 兜底，看门狗为常驻逐帧检测
  }, [fileId, scrollKey]);

  // 卸载时保存滚动位置，供重挂载恢复
  useEffect(() => {
    return () => {
      if (scrollKey) {
        const el = containerRef.current;
        if (el) LOGVIEWER_SCROLL_STORE.set(scrollKey, { scrollTop: el.scrollTop });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lastFetchRef.current = { start: -1, end: -1 };
  }, [updateTrigger]);

  // === 按需拉取行数据（窗口驱动） ===
  const fetchStart = windowStart;
  const fetchEnd = windowEnd;

  useEffect(() => {
    if (!fileId || totalLines === 0) return;
    const start = fetchStart;
    const end = fetchEnd;
    if (start === lastFetchRef.current.start && end === lastFetchRef.current.end) return;
    if (start >= end) return;

    lastFetchRef.current = { start, end };
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const count = end - start;
        const lines = await readProcessedLines(fileId, start, count);
        if (ignore) return;
        setBridgedLines((prev) => {
          const next = new Map(prev);
          lines.forEach((line, idx) => next.set(start + idx, line));
          if (next.size > LOG_VIEWER.MAX_CACHED_LINES) {
            const center = Math.floor((start + end) / 2);
            for (const key of next.keys()) {
              if (Math.abs(Number(key) - center) > LOG_VIEWER.CACHE_CLEAR_DISTANCE)
                next.delete(key);
            }
          }
          return next;
        });
      } catch (e) {
        console.error('Failed to fetch lines:', e);
      }
    }, FETCH_DEBOUNCE_MS);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchStart, fetchEnd, fileId, totalLines, updateTrigger, FETCH_DEBOUNCE_MS]);

  // === 可视范围上报 ===
  useEffect(() => {
    onVisibleRangeChange?.(fetchStart, fetchEnd);
  }, [fetchStart, fetchEnd, onVisibleRangeChange]);

  // === 外部 scrollToIndex 定位（对齐 VS Code：安全区外完整可见时不滚动，否则居中） ===
  useEffect(() => {
    if (scrollToIndex !== null && scrollToIndex !== undefined && containerRef.current) {
      const top = computeRevealScrollTop(
        topVisibleLine,
        visibleRows,
        viewportHeight,
        lineHeight,
        scrollToIndex,
        maxLogicalScroll,
        maxPhysicalScroll,
        useScaling,
      );
      if (top !== null) {
        containerRef.current.scrollTo({ top, behavior: 'auto' });
        // 同步 ref，防止滚动看门狗把「程序化滚动到顶(top=0)」误判为 dockview 归零而拉回旧位置
        scrollStateRef.current.top = top;
      }
    }
  }, [
    scrollToIndex,
    totalLines,
    viewportHeight,
    useScaling,
    maxLogicalScroll,
    maxPhysicalScroll,
    lineHeight,
    topVisibleLine,
    visibleRows,
  ]);

  // === 原生选择：向父组件报告选中文本 ===
  useEffect(() => {
    if (!onSelectedTextChange) return;
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString() : '';
      onSelectedTextChange(text.trim());
    };
    document.addEventListener('selectionchange', handleSelection);
    window.addEventListener('mouseup', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      window.removeEventListener('mouseup', handleSelection);
    };
  }, [onSelectedTextChange]);

  // === 键盘导航 ===
  const scrollToLine = useCallback(
    (index: number) => {
      if (!containerRef.current) return;
      const top = computeRevealScrollTop(
        topVisibleLine,
        visibleRows,
        viewportHeight,
        lineHeight,
        index,
        maxLogicalScroll,
        maxPhysicalScroll,
        useScaling,
      );
      if (top !== null) {
        containerRef.current.scrollTo({ top, behavior: 'auto' });
        scrollStateRef.current.top = top;
      }
    },
    [
      useScaling,
      maxLogicalScroll,
      maxPhysicalScroll,
      lineHeight,
      viewportHeight,
      topVisibleLine,
      visibleRows,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'g' && modifier && !e.shiftKey) {
        e.preventDefault();
        setShowGoToLine(true);
        return;
      }
      if (showGoToLine) return;

      // Ctrl+A 全选当前可视文本（虚拟化下仅可视区可原生选中）
      if (e.key === 'a' && modifier) {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && containerRef.current) {
          const range = document.createRange();
          range.selectNodeContents(containerRef.current);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return;
      }

      // Ctrl+Enter 跳转选中行（高亮行）
      if (e.key === 'Enter' && modifier && highlightedIndex !== null) {
        e.preventDefault();
        onLineClick?.(highlightedIndex);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGoToLine, highlightedIndex, onLineClick]);

  // === context menu ===
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const lineEl = (e.target as HTMLElement).closest('[data-log-index]') as HTMLElement | null;
    const index = lineEl ? Number(lineEl.dataset.logIndex) : null;
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selectedText,
      lineIndex: index ?? undefined,
    });
  };

  // === gutter 点击切换书签 / 内容点击选中行 ===
  const handleRowClick = (e: React.MouseEvent) => {
    const rowEl = (e.target as HTMLElement).closest('[data-log-index]') as HTMLElement | null;
    const gutterEl = (e.target as HTMLElement).closest('.log-row-gutter');
    if (!rowEl) return;
    const index = Number(rowEl.dataset.logIndex);
    const line = bridgedLines.get(index);
    const phys = line && typeof line !== 'string' ? (line as LogLine).index : index;
    if (gutterEl) {
      // 书签已有，点左侧打开评论；否则切换书签（均锚定物理行号）
      const comment = bookmarks[phys];
      if (comment !== undefined) {
        const rect = containerRef.current!.getBoundingClientRect();
        setCommentPopover({
          x: rect.left + gutterWidth,
          y: e.clientY,
          lineIndex: phys,
          comment: comment || '',
        });
      } else {
        onToggleBookmark?.(phys);
      }
      return;
    }
    onLineClick?.(index);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // 浏览器原生双击选词，这里不需要额外逻辑
    const rowEl = (e.target as HTMLElement).closest('[data-log-index]') as HTMLElement | null;
    if (rowEl) onLineClick?.(Number(rowEl.dataset.logIndex));
  };

  // === 渲染 ===
  const isContentReady = fileId && totalLines > 0 && viewportHeight > 0;
  const showLoading = fileId && !isContentReady;

  return (
    <div
      ref={containerRef}
      data-logviewer="true"
      className="flex-1 overflow-auto relative custom-scrollbar select-text"
      style={{ backgroundColor: colors.BACKGROUND }}
      onContextMenu={handleContextMenu}
      onClick={handleRowClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* 滚动 spacer：撑起滚动高度 */}
      <div style={{ height: virtualTotalHeight, width: 1, pointerEvents: 'none' }} />

      {/* 加载状态 */}
      {showLoading && (
        <div
          className="absolute top-0 left-0 flex items-center justify-center text-gray-500 text-sm"
          style={{ height: viewportHeight || 400, width: '100%' }}
        >
          {isIndexing ? (
            <>正在构建索引... {Math.round(indexingProgress)}%</>
          ) : isSearching ? (
            <>正在搜索... {totalLines.toLocaleString()} 行待处理</>
          ) : (
            <>Loading lines...</>
          )}
        </div>
      )}

      {/* 内容视口：translateY(scrollTop) 抵消物理滚动使内容固定，窗口内行用绝对定位渲染 */}
      {isContentReady && (
        <div className="absolute top-0 left-0" style={{ height: viewportHeight, width: '100%' }}>
          <ErrorBoundary>
            {/* 窗口内行：translateY(scrollTop - windowOffsetPx) 使窗口内容对齐到视口（视口在 content 坐标 scrollTop 处） */}
            <div
              style={{
                transform: `translateY(${scrollTop - windowOffsetPx}px)`,
                height: itemCount * lineHeight,
                width: '100%',
                willChange: 'transform',
              }}
            >
              {Array.from({ length: itemCount }, (_, i) => (
                <LogRow
                  key={windowStart + i}
                  index={windowStart + i}
                  line={bridgedLines.get(windowStart + i)}
                  layers={layers}
                  bookmarks={bookmarks}
                  colors={colors}
                  lineHeight={lineHeight}
                  gutterWidth={gutterWidth}
                  showLineNumbers={showLineNumbers}
                  showWhitespace={showWhitespace}
                  fontSize={fontSize}
                  isHighlighted={highlightedIndex === windowStart + i}
                  wordWrap={wordWrap}
                  fontFamily={fontFamily}
                  onToggleBookmark={onToggleBookmark}
                  searchQuery={searchQuery}
                  searchConfig={searchConfig}
                  rawLineCount={rawCount}
                  totalLines={totalLines}
                  showVirtualLineNumbers={showVirtualLineNumbers}
                />
              ))}
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Overview Ruler（右侧分布标尺，translateY 抵消滚动固定到视口） */}
      {showRuler && totalLines > 0 && (
        <div
          className="absolute right-0 top-0"
          style={{
            width: 12,
            height: viewportHeight,
            backgroundColor: colors.RULER,
            pointerEvents: 'none',
            zIndex: 5,
            overflow: 'hidden',
            transform: `translateY(${scrollTop}px)`,
          }}
        >
          {Object.entries(layerStats).map(([id, stats]: [string, any]) => {
            const color = id === 'search' ? colors.SEARCH_HIGHLIGHT : colors.LAYER_HIGHLIGHT;
            return (stats.distribution || []).map((v: number, idx: number) => {
              if (v <= 0) return null;
              const h = Math.max(2, v * (viewportHeight / 20));
              return (
                <div
                  key={`${id}-${idx}`}
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: idx * (viewportHeight / 20),
                    height: h,
                    width: 8,
                    backgroundColor: color,
                    opacity: 0.5,
                  }}
                />
              );
            });
          })}
          {Object.keys(bookmarks).map((idx) => {
            // 书签锚定物理行号：ruler 位置以原始行数为基准
            const yPos = (Number(idx) / Math.max(1, rawCount)) * viewportHeight;
            return (
              <div
                key={`bm-${idx}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: yPos,
                  height: 2,
                  width: 12,
                  backgroundColor: colors.BOOKMARK_INDICATOR,
                }}
              />
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: (logicalScrollTop / Math.max(1, realTotalHeight)) * viewportHeight,
              height: Math.max(5, (viewportHeight / Math.max(1, realTotalHeight)) * viewportHeight),
              width: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* FPS/内存调试指示器（仅 debugMode）：sticky 固定于视口右下角，不随内容滚动 */}
      {debugMode && (
        <div className="sticky bottom-2 z-20 flex justify-end pointer-events-none">
          <PerformanceIndicator metrics={metrics} visible={true} />
        </div>
      )}

      {contextMenu &&
        createPortal(
          <div
            className="context-menu-popup fixed bg-theme-surface border border-theme-default shadow-2xl rounded py-1 min-w-[160px] z-[1000] text-[12px] select-none"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {contextMenu.text && (
              <>
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
                  onClick={() => {
                    navigator.clipboard.writeText(contextMenu.text);
                    setContextMenu(null);
                  }}
                >
                  复制选中内容
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
                  onClick={() => {
                    onSendToAI?.(contextMenu.text);
                    setContextMenu(null);
                  }}
                >
                  发送给 AI
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
                  onClick={() => {
                    onAddLayer?.(LayerType.HIGHLIGHT, {
                      query: contextMenu.text,
                      color: '#facc15',
                    });
                    setContextMenu(null);
                  }}
                >
                  以此高亮
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
                  onClick={() => {
                    onAddLayer?.(LayerType.FILTER, { query: contextMenu.text });
                    setContextMenu(null);
                  }}
                >
                  以此过滤
                </button>
                {detectJson(contextMenu.text).valid && (
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
                    onClick={() => {
                      setExpandedJsonLine(contextMenu.lineIndex ?? null);
                      setContextMenu(null);
                    }}
                  >
                    展开 JSON
                  </button>
                )}
                <div className="h-[1px] bg-theme-subtle my-1" />
              </>
            )}
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
              onClick={() => {
                const line = bridgedLines.get(contextMenu.lineIndex!);
                const phys =
                  line && typeof line !== 'string'
                    ? (line as LogLine).index
                    : contextMenu.lineIndex!;
                onToggleBookmark?.(phys);
                setContextMenu(null);
              }}
            >
              切换书签
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200"
              onClick={() => {
                const line = bridgedLines.get(contextMenu.lineIndex!);
                navigator.clipboard.writeText(
                  typeof line === 'string' ? line : (line as LogLine)?.content || '',
                );
                setContextMenu(null);
              }}
            >
              复制整行
            </button>
          </div>,
          document.body,
        )}

      {commentPopover &&
        createPortal(
          <BookmarkPopover
            x={commentPopover.x}
            y={commentPopover.y}
            lineIndex={commentPopover.lineIndex}
            initialComment={commentPopover.comment}
            onSave={async (c) => {
              await onUpdateBookmarkComment?.(commentPopover.lineIndex, c);
              setCommentPopover(null);
            }}
            onRemove={() => {
              onToggleBookmark?.(commentPopover.lineIndex);
              setCommentPopover(null);
            }}
            onClose={() => setCommentPopover(null)}
          />,
          document.body,
        )}

      {expandedJsonLine !== null &&
        createPortal(
          <div className="fixed bottom-4 right-4 w-96 max-h-64 overflow-auto bg-theme-surface border border-theme-default shadow-2xl rounded z-[1000]">
            <div className="flex justify-between items-center px-3 py-2 border-b border-theme-subtle">
              <span className="text-sm font-medium text-theme-primary">
                JSON 展开 (行 {expandedJsonLine + 1})
              </span>
              <button
                onClick={() => setExpandedJsonLine(null)}
                className="text-theme-muted hover:text-theme-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-2">
              {(() => {
                const line = bridgedLines.get(expandedJsonLine);
                const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
                const { valid, data } = detectJson(content);
                if (!valid) return <div className="text-red-400">无效的 JSON</div>;
                return <JsonTreeView jsonString={JSON.stringify(data, null, 2)} />;
              })()}
            </div>
          </div>,
          document.body,
        )}

      {showGoToLine && (
        <EditorGoToLineWidget
          totalLines={totalLines}
          onGo={(lineNum) => {
            onLineClick?.(lineNum - 1);
            scrollToLine(lineNum - 1);
            setShowGoToLine(false);
          }}
          onClose={() => setShowGoToLine(false)}
        />
      )}

      {hasNewContent && onScrollToNewContent && (
        <button
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full shadow-lg z-[1000] flex items-center gap-2 animate-bounce"
          onClick={() => onScrollToNewContent()}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          <span>有新内容，点击滚动到底部</span>
        </button>
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {totalLines > 0 &&
          `日志视图，共 ${totalLines.toLocaleString()} 行。当前显示第 ${windowStart + 1} 到 ${windowEnd} 行`}
      </div>
    </div>
  );
};
