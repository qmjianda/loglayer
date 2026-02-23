import { useState } from 'react';

interface Shortcut {
  keys: string;
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: '导航',
    shortcuts: [
      { keys: 'Ctrl + G', description: '跳转到行' },
      { keys: 'Ctrl + Home', description: '跳转到文件开头' },
      { keys: 'Ctrl + End', description: '跳转到文件结尾' },
      { keys: 'Page Up', description: '向上滚动一页' },
      { keys: 'Page Down', description: '向下滚动一页' },
    ],
  },
  {
    name: '搜索',
    shortcuts: [
      { keys: 'Ctrl + F', description: '打开搜索' },
      { keys: 'F3', description: '下一个匹配' },
      { keys: 'Shift + F3', description: '上一个匹配' },
      { keys: 'Ctrl + H', description: '搜索历史' },
    ],
  },
  {
    name: '编辑',
    shortcuts: [
      { keys: 'Ctrl + C', description: '复制选中内容' },
      { keys: 'Ctrl + A', description: '全选' },
      { keys: 'Ctrl + Shift + L', description: '选中当前行' },
      { keys: 'Alt + ↑', description: '向上移动选区' },
      { keys: 'Alt + ↓', description: '向下移动选区' },
      { keys: 'Ctrl + Enter', description: '跳转到选中行' },
    ],
  },
  {
    name: '命令',
    shortcuts: [
      { keys: 'Ctrl + Shift + P', description: '命令面板' },
      { keys: 'Ctrl + O', description: '打开文件' },
      { keys: 'Ctrl + B', description: '切换侧边栏' },
      { keys: 'Ctrl + ,', description: '打开设置' },
    ],
  },
  {
    name: '图层',
    shortcuts: [
      { keys: 'Ctrl + Shift + L', description: '新建图层' },
      { keys: 'Ctrl + D', description: '收藏当前行' },
    ],
  },
];

interface KeyboardShortcutsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const KeyboardShortcutsPanel: React.FC<KeyboardShortcutsPanelProps> = ({ 
  isOpen: externalIsOpen, 
  onClose 
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen ?? internalIsOpen;
  const setIsOpen = onClose ? () => onClose() : setInternalIsOpen;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
      <div 
        className="bg-[#252526] border border-[#454545] rounded-lg shadow-2xl w-[600px] max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <h2 className="text-sm font-semibold text-white">键盘快捷键</h2>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          <div className="grid grid-cols-2 gap-4">
            {shortcutCategories.map(category => (
              <div key={category.name}>
                <h3 className="text-[10px] uppercase font-bold text-gray-500 mb-2">{category.name}</h3>
                <div className="space-y-1">
                  {category.shortcuts.map(shortcut => (
                    <div key={shortcut.keys} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{shortcut.description}</span>
                      <kbd className="px-1.5 py-0.5 bg-[#1e1e1e] border border-[#333] rounded text-gray-300 font-mono text-[10px]">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
