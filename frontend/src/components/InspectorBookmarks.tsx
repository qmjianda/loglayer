import React from 'react';

interface InspectorBookmarksProps {
  bookmarks: Record<number, string>;
  previews: Record<number, string>;
  onToggleBookmark: (lineIndex: number) => void;
  onClearBookmarks: () => void;
  onJumpToBookmark: (idx: number) => void;
}

export const InspectorBookmarks: React.FC<InspectorBookmarksProps> = ({
  bookmarks,
  previews,
  onToggleBookmark,
  onClearBookmarks,
  onJumpToBookmark,
}) => {
  return (
    <div className="flex flex-col">
      {Object.keys(bookmarks).length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-gray-600 italic">暂无书签。点击行号区域可添加。</p>
        </div>
      ) : (
        Object.entries(bookmarks)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([lineIdx, comment]) => {
            const idx = Number(lineIdx);
            const preview = previews[idx];
            return (
              <div
                key={idx}
                className="group flex flex-col px-3 py-2 hover:bg-white/5 cursor-pointer border-l-2 border-transparent hover:border-amber-500 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToBookmark(idx);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-[10px] font-mono">
                      #{(idx + 1).toLocaleString()}
                    </span>
                    {comment && (
                      <span className="text-[10px] text-theme-primary truncate max-w-[140px] font-medium">
                        {comment}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(idx);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-400 transition-all p-1"
                    title="删除书签"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                {preview ? (
                  <div className="text-[10px] text-theme-muted font-mono truncate bg-black/20 rounded px-1.5 py-0.5 border border-white/5 italic">
                    {preview}
                  </div>
                ) : (
                  <div className="text-[9px] text-gray-700 italic">正在加载预览...</div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
};
