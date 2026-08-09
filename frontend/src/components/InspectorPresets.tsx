import React from 'react';
import { LayerPreset } from '../types';

interface InspectorPresetsProps {
  presets: LayerPreset[];
  onPresetApply: (preset: LayerPreset) => void;
  onPresetDelete: (id: string) => void;
}

export const InspectorPresets: React.FC<InspectorPresetsProps> = ({
  presets,
  onPresetApply,
  onPresetDelete,
}) => {
  if (presets.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-[10px] text-gray-600 italic">暂无预设，可在图层区保存当前配置。</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1.5">
      {presets.map((preset) => {
        const isDefault = preset.name === '默认预设' || preset.name === 'Default';
        const layerCount = preset.layers.filter((l) => l.type !== 'FOLDER').length;
        return (
          <div
            key={preset.id}
            onClick={() => onPresetApply(preset)}
            className={`group relative rounded p-2 transition-all cursor-pointer ${
              isDefault
                ? 'bg-blue-900/10 border border-blue-500/30 hover:bg-blue-900/20'
                : 'bg-theme-header border border-theme-default hover:border-blue-500/50'
            }`}
            title="点击应用预设（合并语义：同类型图层启用，缺失图层新增）"
          >
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-medium truncate ${isDefault ? 'text-blue-400' : 'text-theme-primary'}`}
                >
                  {preset.name}
                </div>
                <div className="text-[9px] text-theme-muted truncate">{layerCount} 个图层</div>
              </div>
              <div className="flex items-center shrink-0 gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPresetApply(preset);
                  }}
                  className="p-1 text-theme-muted hover:text-blue-400 transition-colors"
                  title="应用预设"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
                {!isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPresetDelete(preset.id);
                    }}
                    className="p-1 text-theme-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                    title="删除预设"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
