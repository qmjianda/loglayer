import React, { useState, useEffect, useRef } from 'react';

interface EditorGoToLineWidgetProps {
  totalLines: number;
  onGo: (line: number) => void;
  onClose: () => void;
  /**
   * 聚焦请求计数（Ctrl+G 幂等守卫）：widget 已打开时再次按下 Ctrl+G，
   * 全局处理递增该计数 → 输入框重新聚焦并全选，不新建实例。
   */
  focusRequest?: number;
}

export const EditorGoToLineWidget: React.FC<EditorGoToLineWidgetProps> = ({
  totalLines,
  onGo,
  onClose,
  focusRequest = 0,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocusRequestRef = useRef(focusRequest);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // focusRequest 递增：重新聚焦已有输入框（不重建实例）
  useEffect(() => {
    if (focusRequest === lastFocusRequestRef.current) return;
    lastFocusRequestRef.current = focusRequest;
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, [focusRequest]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const lineNum = parseInt(value, 10);
      if (!isNaN(lineNum) && lineNum > 0 && lineNum <= totalLines) {
        onGo(lineNum);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const isValid = !value || (parseInt(value, 10) > 0 && parseInt(value, 10) <= totalLines);

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[60] w-[400px] animate-in slide-in-from-top-4 duration-150">
      <div className="bg-dark-1 shadow-2xl rounded-b border border-t-0 border-theme-default p-2">
        <div
          className={`flex items-center bg-theme-input border rounded overflow-hidden transition-colors ${isValid ? 'border-blue-500/50' : 'border-red-500'}`}
        >
          <div className="px-2 text-gray-500 text-xs select-none">:</div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={handleKeyDown}
            placeholder={`输入行号 (1 到 ${totalLines.toLocaleString()})`}
            className="bg-transparent text-white text-xs px-1 py-1.5 w-full focus:outline-none"
          />
        </div>
        {!isValid && (
          <div className="text-[10px] text-red-400 mt-1 px-1">
            行号必须在 1 到 {totalLines.toLocaleString()} 之间
          </div>
        )}
        <div className="mt-2 flex justify-between items-center px-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-tighter font-bold">
            跳转到行
          </span>
          <div className="flex space-x-2">
            <span className="text-[9px] text-gray-600 bg-black/20 px-1 rounded flex items-center">
              ENTER 跳转
            </span>
            <span className="text-[9px] text-gray-600 bg-black/20 px-1 rounded flex items-center">
              ESC 取消
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
