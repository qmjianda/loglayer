import React, { useState, useRef, useEffect } from 'react';
import { LogLayer, LayerType, LayerPreset, LayerRegistryEntry, LogLevelStats } from '../types';
import { LayersPanel } from './LayersPanel';
import { InspectorSummary } from './InspectorSummary';
import { InspectorBookmarks } from './InspectorBookmarks';
import { InspectorPresets } from './InspectorPresets';
import { useLayerRegistry } from '../hooks/useLayerRegistry';
import { FileData } from '../hooks/useFileManagement';

interface InspectorPanelProps {
  // 文件
  activeFile: FileData | undefined;

  // 图层
  layers: LogLayer[];
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  layerStats: Record<string, { count: number; distribution: number[] }>;
  onLayerRemove: (id: string) => void;
  onLayerToggle: (id: string) => void;
  onLayerUpdate: (id: string, update: Partial<LogLayer>) => void;
  onLayerDrop: (
    draggedId: string,
    targetId: string | null,
    position: 'inside' | 'before' | 'after',
  ) => void;
  onAddLayer: (type: LayerType) => void;
  onJumpToLine: (idx: number) => void;

  // 撤销/重做
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // 预设
  presets: LayerPreset[];
  onPresetApply: (preset: LayerPreset) => void;
  onPresetDelete: (id: string) => void;
  onSavePresetWithName: (name: string) => void;
  saveStatus: 'idle' | 'saved';

  // 书签
  bookmarks: Record<number, string>;
  bookmarkPreviews: Record<number, string>;
  onToggleBookmark: (lineIndex: number) => void;
  onClearBookmarks: () => void;
  onJumpToBookmark: (idx: number) => void;

  // 统计摘要
  logLevelStats: LogLevelStats;
  /** [perf-deepening] 统计拉取中（驱动 InspectorSummary 骨架屏） */
  statsLoading?: boolean;
}

type InspectorSection = 'layers' | 'presets' | 'bookmarks' | 'stats';

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activeFile,
  layers,
  selectedLayerId,
  setSelectedLayerId,
  layerStats,
  onLayerRemove,
  onLayerToggle,
  onLayerUpdate,
  onLayerDrop,
  onAddLayer,
  onJumpToLine,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  presets,
  onPresetApply,
  onPresetDelete,
  onSavePresetWithName,
  saveStatus,
  bookmarks,
  bookmarkPreviews,
  onToggleBookmark,
  onClearBookmarks,
  onJumpToBookmark,
  logLevelStats,
  statsLoading,
}) => {
  // 各折叠区状态（默认：图层展开，其余折叠）
  const [sections, setSections] = useState<Record<InspectorSection, boolean>>({
    layers: false,
    presets: true,
    bookmarks: true,
    stats: true,
  });

  // 添加图层下拉菜单状态
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 保存为预设命名浮层状态
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const saveInputRef = useRef<HTMLInputElement>(null);

  const { registry } = useLayerRegistry();

  // 过滤系统托管图层
  const visibleLayers = layers.filter((l) => !l.isSystemManaged);

  // 点击外部关闭添加图层菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);

  // 打开命名浮层时聚焦输入框
  useEffect(() => {
    if (isSaveOpen) {
      setTimeout(() => saveInputRef.current?.focus(), 0);
    }
  }, [isSaveOpen]);

  const toggleSection = (section: InspectorSection) => {
    setSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const confirmSavePreset = () => {
    if (!presetName.trim()) return;
    onSavePresetWithName(presetName);
    setIsSaveOpen(false);
    setPresetName('');
  };

  const renderAddMenu = () => (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-44 bg-theme-surface border border-theme-default shadow-2xl rounded py-1 z-[100] animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Built-in Layers */}
      <div className="px-3 py-1.5 text-[9px] uppercase font-black text-theme-muted tracking-wider bg-theme-elevated border-b border-theme-subtle">
        核心图层
      </div>
      {Object.values(registry as Record<string, LayerRegistryEntry>)
        .filter((entry) => entry.is_builtin)
        .map((entry) => (
          <button
            key={entry.type}
            onMouseDown={(e) => {
              e.stopPropagation();
              onAddLayer(entry.type as LayerType);
              setIsAddMenuOpen(false);
            }}
            className="w-full flex items-center px-3 py-1.5 text-[11px] text-theme-primary hover:bg-blue-600 hover:text-white transition-colors"
          >
            <span className="mr-3 w-4 flex justify-center shrink-0">
              {(() => {
                const ICON_LIBRARY: Record<string, React.ReactNode> = {
                  filter: (
                    <svg
                      className="w-3.5 h-3.5 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 4h18l-7 9v6l-4 2V13L3 4z" />
                    </svg>
                  ),
                  highlight: (
                    <svg
                      className="w-3.5 h-3.5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 21a9 9 0 110-18 9 9 0 010 18z" />
                    </svg>
                  ),
                  range: (
                    <svg
                      className="w-3.5 h-3.5 text-teal-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M7 8l-4 4 4 4M17 8l4 4-4 4M13 4l-2 16" />
                    </svg>
                  ),
                  time: (
                    <svg
                      className="w-3.5 h-3.5 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  transform: (
                    <svg
                      className="w-3.5 h-3.5 text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 4h16v16H4V4zm4 4h8v8H8V8z" />
                    </svg>
                  ),
                  level: (
                    <svg
                      className="w-3.5 h-3.5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ),
                  default: (
                    <svg
                      className="w-3.5 h-3.5 text-theme-muted"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  ),
                };
                return ICON_LIBRARY[entry.icon] || (entry.is_builtin ? ICON_LIBRARY.default : null);
              })()}
            </span>
            <span className="truncate text-left">{entry.display_name}</span>
          </button>
        ))}

      {/* Plugin Layers */}
      {Object.values(registry as Record<string, LayerRegistryEntry>).some(
        (entry) => !entry.is_builtin,
      ) && (
        <>
          <div className="px-3 py-1.5 text-[9px] uppercase font-black text-theme-muted tracking-wider bg-theme-elevated border-y border-theme-subtle mt-1">
            扩展插件
          </div>
          {Object.values(registry as Record<string, LayerRegistryEntry>)
            .filter((entry) => !entry.is_builtin)
            .map((entry) => (
              <button
                key={entry.type}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onAddLayer(entry.type as LayerType);
                  setIsAddMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-1.5 text-[11px] text-theme-primary hover:bg-blue-600 hover:text-white transition-colors"
              >
                <span className="mr-3 w-4 flex justify-center shrink-0">
                  <svg
                    className="w-3.5 h-3.5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeWidth="2"
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                    />
                  </svg>
                </span>
                <span className="truncate text-left">{entry.display_name}</span>
              </button>
            ))}
        </>
      )}
    </div>
  );

  const SectionHeader: React.FC<{
    title: string;
    count?: number;
    section: InspectorSection;
    onToggle: () => void;
  }> = ({ title, count, section, onToggle }) => (
    <div
      className="flex items-center px-3 py-2 bg-header border-b border-theme-subtle cursor-pointer hover:bg-theme-elevated select-none shrink-0"
      onClick={onToggle}
    >
      <svg
        className={`w-3 h-3 mr-2 transition-transform ${sections[section] ? '' : 'rotate-90'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-[10px] uppercase font-black tracking-wider opacity-60">{title}</span>
      {count !== undefined && (
        <span className="ml-2 text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-gray-500 font-mono border border-white/5">
          {count}
        </span>
      )}
    </div>
  );

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-theme-muted italic select-none">
        未打开文件
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 1. 文件属性摘要（固定不折叠） */}
      <InspectorSummary
        activeFile={activeFile}
        logLevelStats={logLevelStats}
        loading={statsLoading}
      />

      {/* 可滚动区域：图层 / 预设 / 书签 / 统计 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-theme-surface min-h-0">
        {/* 2. 图层区（默认展开） */}
        <div className="border-b border-theme-subtle">
          <SectionHeader
            title="图层"
            count={visibleLayers.length}
            section="layers"
            onToggle={() => toggleSection('layers')}
          />
          {!sections.layers && (
            <div className="relative">
              {/* 工具栏：撤销/重做 + 添加图层 + 保存为预设 */}
              <div className="shrink-0 p-2 bg-theme-elevated border-b border-theme-subtle flex flex-wrap gap-1 items-center">
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`w-6 h-6 flex items-center justify-center rounded ${canUndo ? 'hover:bg-theme-elevated text-theme-primary' : 'opacity-30 cursor-not-allowed text-gray-600'}`}
                  title="撤销 (Ctrl+Z)"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={`w-6 h-6 flex items-center justify-center rounded ${canRedo ? 'hover:bg-theme-elevated text-theme-primary' : 'opacity-30 cursor-not-allowed text-gray-600'}`}
                  title="重做 (Ctrl+Y)"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                    />
                  </svg>
                </button>
                <div className="w-px h-4 bg-theme-subtle mx-0.5" />

                {/* 添加图层下拉 */}
                <div className="relative">
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsAddMenuOpen((prev) => !prev);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${isAddMenuOpen ? 'bg-blue-600 text-white' : 'bg-theme-header border border-theme-default text-theme-primary hover:border-blue-500/50'}`}
                    title="添加图层"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeWidth="3" d="M12 4v16m8-8H4" />
                    </svg>
                    添加图层
                  </button>
                  {isAddMenuOpen && renderAddMenu()}
                </div>

                {/* 新建分组 */}
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onAddLayer(LayerType.FOLDER);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-theme-header border border-theme-default text-theme-primary hover:border-blue-500/50 transition-colors"
                  title="新建分组"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  分组
                </button>

                <div className="flex-1" />

                {/* 保存为预设 */}
                <button
                  onClick={() => setIsSaveOpen(true)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'}`}
                  title="将当前图层配置保存为预设"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  {saveStatus === 'saved' ? '已保存' : '保存为预设'}
                </button>

                {/* 保存命名浮层 */}
                {isSaveOpen && (
                  <div
                    className="absolute right-2 top-full mt-1 w-56 bg-theme-surface border border-theme-default shadow-2xl rounded p-2 z-[100]"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={saveInputRef}
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmSavePreset();
                        if (e.key === 'Escape') {
                          setIsSaveOpen(false);
                          setPresetName('');
                        }
                      }}
                      placeholder="输入预设名称..."
                      className="w-full bg-theme-base border border-blue-500 text-[11px] px-2 py-1.5 rounded text-white outline-none mb-2"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={confirmSavePreset}
                        disabled={!presetName.trim()}
                        className="flex-1 py-1 rounded text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => {
                          setIsSaveOpen(false);
                          setPresetName('');
                        }}
                        className="flex-1 py-1 rounded text-[10px] bg-theme-header border border-theme-default text-theme-muted hover:text-theme-primary transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* LayersPanel 原样复用（DOM 结构/类名不变） */}
              <LayersPanel
                layers={visibleLayers}
                stats={layerStats}
                selectedId={selectedLayerId}
                fileId={activeFile.id}
                onSelect={setSelectedLayerId}
                onDrop={onLayerDrop}
                onRemove={onLayerRemove}
                onToggle={onLayerToggle}
                onUpdate={onLayerUpdate}
                onJumpToLine={onJumpToLine}
                isReadOnly={false}
              />
            </div>
          )}
        </div>

        {/* 3. 预设区（默认折叠） */}
        <div className="border-b border-theme-subtle">
          <SectionHeader
            title="预设"
            count={presets.length}
            section="presets"
            onToggle={() => toggleSection('presets')}
          />
          {!sections.presets && (
            <InspectorPresets
              presets={presets}
              onPresetApply={onPresetApply}
              onPresetDelete={onPresetDelete}
            />
          )}
        </div>

        {/* 4. 书签区（默认折叠） */}
        <div className="border-b border-theme-subtle">
          <div
            className="flex items-center px-3 py-2 bg-header border-b border-theme-subtle cursor-pointer hover:bg-theme-elevated select-none shrink-0"
            onClick={() => toggleSection('bookmarks')}
          >
            <svg
              className={`w-3 h-3 mr-2 transition-transform ${sections.bookmarks ? '' : 'rotate-90'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-[10px] uppercase font-black tracking-wider opacity-60">书签</span>
            <span className="ml-2 text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-gray-500 font-mono border border-white/5">
              {Object.keys(bookmarks).length}
            </span>
            {Object.keys(bookmarks).length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearBookmarks();
                }}
                className="ml-auto text-[9px] text-theme-muted hover:text-red-400 transition-colors"
              >
                清除全部
              </button>
            )}
          </div>
          {!sections.bookmarks && (
            <InspectorBookmarks
              bookmarks={bookmarks}
              previews={bookmarkPreviews}
              onToggleBookmark={onToggleBookmark}
              onClearBookmarks={onClearBookmarks}
              onJumpToBookmark={onJumpToBookmark}
            />
          )}
        </div>

        {/* 5. 统计区（默认折叠，占位） */}
        <div>
          <SectionHeader title="统计" section="stats" onToggle={() => toggleSection('stats')} />
          {!sections.stats && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-gray-600 italic">统计信息（第二版迭代）</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
