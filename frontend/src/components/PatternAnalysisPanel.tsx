import React, { useState, useEffect } from 'react';
import { analyzeLogPattern, suggestLayers } from '../bridge_client';

interface PatternAnalysis {
  sample_size: number;
  timestamp_formats: Record<string, number>;
  dominant_timestamp_format: string | null;
  log_levels: Record<string, number>;
  log_formats: Record<string, number>;
  dominant_log_format: string | null;
  has_structured_logs: boolean;
  has_stacktraces: boolean;
}

interface LayerSuggestion {
  type: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface PatternAnalysisPanelProps {
  fileId: string | null;
  onApplySuggestion?: (suggestion: LayerSuggestion) => void;
}

const confidenceColors = {
  high: 'bg-green-500/20 text-green-400 border-green-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
};

export const PatternAnalysisPanel: React.FC<PatternAnalysisPanelProps> = ({ fileId, onApplySuggestion }) => {
  const [analysis, setAnalysis] = useState<PatternAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<LayerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (fileId && expanded) {
      loadAnalysis();
    }
  }, [fileId, expanded]);

  const loadAnalysis = async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const [analysisResult, suggestionsResult] = await Promise.all([
        analyzeLogPattern(fileId, 100),
        suggestLayers(fileId),
      ]);
      setAnalysis(analysisResult);
      setSuggestions(suggestionsResult.suggestions || []);
    } catch (e) {
      console.error('Failed to load pattern analysis:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!fileId) {
    return (
      <div className="p-4 text-theme-muted text-sm">
        未打开文件
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-medium text-theme-primary">📊 日志模式分析</h3>
        <button
          onClick={(e) => { e.stopPropagation(); loadAnalysis(); }}
          className="px-2 py-1 text-xs rounded border border-theme-subtle text-theme-secondary 
                     hover:border-theme-primary hover:text-theme-primary transition-colors"
          disabled={loading}
        >
          {loading ? '分析中...' : expanded ? '刷新' : '展开'}
        </button>
      </div>

      {!expanded ? (
        <div className="text-xs text-theme-muted">
          点击展开查看日志模式分析结果
        </div>
      ) : (
        <div className="space-y-4">
          {loading ? (
            <div className="text-theme-muted text-sm">正在分析日志模式...</div>
          ) : analysis ? (
            <>
              {/* Timestamp Format */}
              {analysis.dominant_timestamp_format && (
                <div className="space-y-1">
                  <div className="text-xs text-theme-secondary font-medium">时间戳格式</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/50">
                      {analysis.dominant_timestamp_format}
                    </span>
                    {Object.keys(analysis.timestamp_formats).length > 1 && (
                      <span className="text-xs text-theme-muted">
                        ({Object.keys(analysis.timestamp_formats).length} 种格式)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Log Format */}
              {analysis.dominant_log_format && (
                <div className="space-y-1">
                  <div className="text-xs text-theme-secondary font-medium">日志格式</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/50">
                      {analysis.dominant_log_format}
                    </span>
                  </div>
                </div>
              )}

              {/* Special Detections */}
              <div className="flex flex-wrap gap-2">
                {analysis.has_structured_logs && (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400 border border-green-500/50">
                    📦 JSON 日志
                  </span>
                )}
                {analysis.has_stacktraces && (
                  <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400 border border-red-500/50">
                    ⚠️ 堆栈跟踪
                  </span>
                )}
              </div>

              {/* Layer Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-theme-subtle">
                  <div className="text-xs text-theme-secondary font-medium">💡 推荐配置</div>
                  {suggestions.map((suggestion, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded border text-xs space-y-1 ${confidenceColors[suggestion.confidence]}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{suggestion.type.toUpperCase()}</span>
                        <span className="text-xs opacity-75">{suggestion.confidence === 'high' ? '高' : suggestion.confidence === 'medium' ? '中' : '低'}置信度</span>
                      </div>
                      <div className="opacity-90">{suggestion.reason}</div>
                      {onApplySuggestion && (
                        <button
                          onClick={() => onApplySuggestion(suggestion)}
                          className="mt-1 px-2 py-0.5 text-xs rounded bg-theme-primary/20 text-theme-primary 
                                     hover:bg-theme-primary/30 transition-colors"
                        >
                          应用此建议
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sample Info */}
              <div className="pt-2 border-t border-theme-subtle text-xs text-theme-muted">
                基于 {analysis.sample_size} 行样本分析
              </div>
            </>
          ) : (
            <div className="text-theme-muted text-sm">
              分析失败，请重试
            </div>
          )}
        </div>
      )}
    </div>
  );
};
