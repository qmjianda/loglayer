import React, { useState, useCallback } from 'react';
import { LogLayer, LayerConfig } from '../types';

interface QueryLayerConfigProps {
  fileId: string;
  layer: LogLayer;
  onUpdate: (layerId: string, config: LayerConfig) => void;
}

/**
 * Query Layer Configuration Component
 * 
 * Provides KQL-like query syntax input for advanced log filtering.
 * Supports: field:value, AND/OR/NOT, "exact phrase", *, exists(field), field>value
 */
export const QueryLayerConfig: React.FC<QueryLayerConfigProps> = ({
  fileId,
  layer,
  onUpdate,
}) => {
  const [query, setQuery] = useState(layer.config.query || '');
  const [caseSensitive, setCaseSensitive] = useState(layer.config.case_sensitive || false);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);

  const handleApply = useCallback(() => {
    onUpdate(layer.id, {
      ...layer.config,
      query,
      case_sensitive: caseSensitive,
    });
  }, [layer.id, layer.config, query, caseSensitive, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleApply();
    }
  }, [handleApply]);

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">查询语句</label>
        <button
          onClick={() => setShowSyntaxHelp(!showSyntaxHelp)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSyntaxHelp ? '隐藏语法' : '语法帮助'}
        </button>
      </div>

      {showSyntaxHelp && (
        <div className="text-xs bg-muted/50 rounded-md p-3 space-y-2 font-mono">
          <div className="font-semibold mb-2">查询语法示例:</div>
          <div>
            <code>level:ERROR</code> - 匹配包含 level:ERROR 的行
          </div>
          <div>
            <code>service:api AND level:ERROR</code> - 同时匹配 service 和 level
          </div>
          <div>
            <code>level:ERROR OR level:FATAL</code> - 匹配 ERROR 或 FATAL
          </div>
          <div>
            <code>NOT level:DEBUG</code> - 排除 DEBUG 级别
          </div>
          <div>
            <code>"connection timeout"</code> - 精确匹配短语
          </div>
          <div>
            <code>error*</code> - 通配符匹配 (error, errors, erroneous)
          </div>
          <div>
            <code>exists(user_id)</code> - 检查字段是否存在
          </div>
          <div>
            <code>status_code:&gt;=500</code> - 数值范围比较
          </div>
          <div className="text-muted-foreground mt-2">
            Ctrl+Enter 应用查询
          </div>
        </div>
      )}

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="level:ERROR AND service:api"
        className="w-full h-24 px-3 py-2 text-sm font-mono bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="case-sensitive"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
          className="rounded border-border"
        />
        <label htmlFor="case-sensitive" className="text-sm text-muted-foreground">
          区分大小写
        </label>
      </div>

      <button
        onClick={handleApply}
        className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        应用查询
      </button>

      {query && (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
          当前查询：<code className="font-mono">{query.length > 50 ? query.slice(0, 50) + '...' : query}</code>
        </div>
      )}
    </div>
  );
};
