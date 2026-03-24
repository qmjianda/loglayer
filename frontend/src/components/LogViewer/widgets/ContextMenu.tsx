import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LayerType } from '../../../types';
import { detectJson } from '../../../utils/jsonTree';

export interface ContextMenuState {
  x: number;
  y: number;
  text: string;
  lineIndex?: number;
}

interface ContextMenuProps {
  contextMenu: ContextMenuState | null;
  setContextMenu: (menu: null) => void;
  onAddLayer?: (type: LayerType, params: Record<string, unknown>) => void;
  onToggleBookmark?: (lineIndex: number) => void;
  onUpdateBookmarkComment?: (lineIndex: number, comment: string) => void;
  bridgedLines: Map<number, string | { content: string }>;
  setExpandedJsonLine: (index: number | null) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  setContextMenu,
  onAddLayer,
  onToggleBookmark,
  bridgedLines,
  setExpandedJsonLine,
}) => {
  const handleCopySelected = useCallback(() => {
    if (contextMenu?.text) {
      navigator.clipboard.writeText(contextMenu.text);
      setContextMenu(null);
    }
  }, [contextMenu, setContextMenu]);

  const handleHighlight = useCallback(() => {
    if (contextMenu?.text) {
      onAddLayer?.(LayerType.HIGHLIGHT, { query: contextMenu.text, color: '#facc15' });
      setContextMenu(null);
    }
  }, [contextMenu, onAddLayer, setContextMenu]);

  const handleFilter = useCallback(() => {
    if (contextMenu?.text) {
      onAddLayer?.(LayerType.FILTER, { query: contextMenu.text });
      setContextMenu(null);
    }
  }, [contextMenu, onAddLayer, setContextMenu]);

  const handleExpandJson = useCallback(() => {
    if (contextMenu?.lineIndex !== undefined) {
      setExpandedJsonLine(contextMenu.lineIndex);
      setContextMenu(null);
    }
  }, [contextMenu, setExpandedJsonLine, setContextMenu]);

  const handleToggleBookmark = useCallback(() => {
    if (contextMenu?.lineIndex !== undefined) {
      onToggleBookmark?.(contextMenu.lineIndex);
      setContextMenu(null);
    }
  }, [contextMenu, onToggleBookmark, setContextMenu]);

  const handleCopyLine = useCallback(() => {
    if (contextMenu?.lineIndex !== undefined) {
      const line = bridgedLines.get(contextMenu.lineIndex);
      const text = typeof line === 'string' ? line : (line as { content: string })?.content || '';
      navigator.clipboard.writeText(text);
      setContextMenu(null);
    }
  }, [contextMenu, bridgedLines, setContextMenu]);

  const handleBackdropClick = useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  const handleBackdropContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu(null);
  }, [setContextMenu]);

  const handleMenuMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const showJsonOption = contextMenu?.text && detectJson(contextMenu.text).valid;

  if (!contextMenu) return null;

  return createPortal(
    <>
      {/* Backdrop to capture click-outside */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={handleBackdropClick}
        onContextMenu={handleBackdropContextMenu}
      />
      <div
        className="fixed z-[1000] select-none scale-in-center bg-secondary/95 backdrop-blur-xl"
        style={{
          top: contextMenu.y,
          left: contextMenu.x,
          minWidth: 200,
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
          padding: '4px 0',
          fontSize: 12,
        }}
        onMouseDown={handleMenuMouseDown}
      >
        {contextMenu.text && (
          <>
            <button
              className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-primary hover:bg-theme-hover transition-colors duration-100"
              onClick={handleCopySelected}
            >
              <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" />
              </svg>
              <span className="flex-1">复制选中内容</span>
              <span className="text-muted text-[11px] ml-4">Ctrl+C</span>
            </button>
            <button
              className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-primary hover:bg-theme-hover transition-colors duration-100"
              onClick={handleHighlight}
            >
              <svg className="w-3.5 h-3.5 text-color-warning shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
              <span className="flex-1">以此高亮</span>
            </button>
            <button
              className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-primary hover:bg-theme-hover transition-colors duration-100"
              onClick={handleFilter}
            >
              <svg className="w-3.5 h-3.5 text-color-info shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              <span className="flex-1">以此过滤</span>
            </button>
            {showJsonOption && (
              <button
                className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-primary hover:bg-theme-hover transition-colors duration-100"
                onClick={handleExpandJson}
              >
                <svg className="w-3.5 h-3.5 text-color-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <span className="flex-1">展开 JSON</span>
              </button>
            )}
            <div className="mx-2 my-1" style={{ height: 1, background: 'var(--border-subtle)' }} />
          </>
        )}
        <button
          className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-primary hover:bg-theme-hover transition-colors duration-100"
          onClick={handleToggleBookmark}
        >
          <svg className="w-3.5 h-3.5 text-color-warning shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          <span className="flex-1">切换书签</span>
        </button>
        <button
          className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-primary hover:bg-theme-hover transition-colors duration-100"
          onClick={handleCopyLine}
        >
          <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
          <span className="flex-1">复制整行</span>
        </button>
      </div>
    </>,
    document.body
  );
};