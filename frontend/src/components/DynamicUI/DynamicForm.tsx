
import React, { useState } from 'react';
import { LayerRegistryEntry, LayerUIField } from '../../types';
import { InputMapper } from './InputMapper';

const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol + '//' + window.location.host;
  }
  return '';
};

interface TimeRangeAIButtonsProps {
  fileId: string | null;
  onApply: (updates: any) => void;
}

const TimeRangeAIButtons: React.FC<TimeRangeAIButtonsProps> = ({ fileId, onApply }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleDetect = async () => {
    if (!fileId) return;
    setIsDetecting(true);
    try {
      const BACKEND_URL = getBackendUrl();
      const linesRes = await fetch(`${BACKEND_URL}/api/read_processed_lines?file_id=${fileId}&start=0&count=100`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const lines = await linesRes.json();
      const content = lines.map((l: any) => l.content).join('\n');

      const detectRes = await fetch(`${BACKEND_URL}/api/ai/detect-timestamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (detectRes.ok) {
        const result = await detectRes.json();
        onApply({
          pattern: result.pattern,
          format: result.format,
          start: result.start_time || '',
          end: result.end_time || ''
        });
      }
    } catch (err) {
      console.error('Timestamp detection failed:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSuggest = async () => {
    if (!fileId) return;
    setIsSuggesting(true);
    try {
      const BACKEND_URL = getBackendUrl();
      const linesRes = await fetch(`${BACKEND_URL}/api/read_processed_lines?file_id=${fileId}&start=0&count=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const lines = await linesRes.json();
      const content = lines.map((l: any) => l.content).join('\n');

      const suggestRes = await fetch(`${BACKEND_URL}/api/ai/suggest-time-range`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (suggestRes.ok) {
        const suggestions = await suggestRes.json();
        if (suggestions && suggestions.length > 0) {
          const first = suggestions[0];
          onApply({ start: first.start, end: first.end });
        }
      }
    } catch (err) {
      console.error('Time range suggestion failed:', err);
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleDetect}
        disabled={!fileId || isDetecting}
        className="flex-1 px-2 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-theme-default disabled:cursor-not-allowed text-white rounded transition-colors"
      >
        {isDetecting ? '检测中...' : '🤖 AI 检测'}
      </button>
      <button
        onClick={handleSuggest}
        disabled={!fileId || isSuggesting}
        className="flex-1 px-2 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-theme-default disabled:cursor-not-allowed text-white rounded transition-colors"
      >
        {isSuggesting ? '分析中...' : '💡 AI 建议'}
      </button>
    </div>
  );
};

interface DynamicFormProps {
    registryEntry: LayerRegistryEntry;
    config: any;
    onUpdate: (update: any) => void;
    fileId?: string | null;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
    registryEntry,
    config,
    onUpdate,
    fileId
}) => {
    const fields = registryEntry.ui_schema;

    // Special layout for TIME_RANGE - add AI buttons
    if (registryEntry.type === 'TIME_RANGE') {
        return (
            <div className="space-y-3">
                {fields.map(field => (
                    <div key={field.name} className="flex flex-col space-y-1">
                        {field.type !== 'bool' && (
                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">
                                {field.display_name}
                            </span>
                        )}
                        <InputMapper
                            field={field}
                            value={config[field.name]}
                            onChange={(v) => onUpdate({ [field.name]: v })}
                        />
                    </div>
                ))}
                <TimeRangeAIButtons fileId={fileId || null} onApply={onUpdate} />
            </div>
        );
    }

    // Generic rendering for all layers
    // Special layout for HIGHLIGHT
    if (registryEntry.type === 'HIGHLIGHT') {
        const queryField = fields.find(f => f.name === 'query');
        const colorField = fields.find(f => f.name === 'color');
        const opacityField = fields.find(f => f.name === 'opacity');

        return (
            <div className="space-y-3">
                {queryField && (
                    <InputMapper
                        field={queryField}
                        value={config[queryField.name]}
                        onChange={(v) => onUpdate({ [queryField.name]: v })}
                        searchConfig={{
                            regex: config['regex'],
                            caseSensitive: config['caseSensitive'],
                            wholeWord: config['wholeWord']
                        }}
                        onSearchConfigChange={(upd) => onUpdate(upd)}
                    />
                )}

                <div className="flex space-x-4 items-start">
                    {colorField && (
                        <div className="shrink-0 flex flex-col space-y-1">
                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">图层颜色</span>
                            <InputMapper
                                field={colorField}
                                value={config[colorField.name]}
                                onChange={(v) => onUpdate({ [colorField.name]: v })}
                            />
                        </div>
                    )}
                    {opacityField && (
                        <div className="flex-1 flex flex-col space-y-1 pt-0.5">
                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">不透明度</span>
                            <InputMapper
                                field={opacityField}
                                value={config[opacityField.name]}
                                onChange={(v) => onUpdate({ [opacityField.name]: v })}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            {fields.map(field => {
                // Skip hidden fields if any (not in schema yet)
                return (
                    <div key={field.name} className="flex flex-col space-y-1">
                        {field.type !== 'bool' && (
                            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">
                                {field.display_name}
                            </span>
                        )}
                        <InputMapper
                            field={field}
                            value={config[field.name]}
                            onChange={(v) => onUpdate({ [field.name]: v })}
                            searchConfig={field.type === 'search' ? {
                                regex: config['regex'],
                                caseSensitive: config['caseSensitive'],
                                wholeWord: config['wholeWord']
                            } : undefined}
                            onSearchConfigChange={field.type === 'search' ? (upd) => onUpdate(upd) : undefined}
                        />
                        {field.info && (
                            <span className="text-[9px] text-gray-600 italic leading-tight">{field.info}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
