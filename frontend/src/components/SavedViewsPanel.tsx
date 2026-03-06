import React, { useState, useEffect, useCallback } from 'react';
import { fetchJson, getBackendUrl } from '../utils';

interface SavedView {
  name: string;
  created_at: string;
  updated_at: string;
  source: 'workspace' | 'global';
}

interface SavedViewsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentLayers: any[];
  onLoadView: (viewName: string, layers: any[]) => void;
}

/**
 * Saved Views Management Panel
 * 
 * Allows users to save, load, and manage view configurations.
 * Inspired by Kibana's saved objects and Grafana's dashboards.
 */
export const SavedViewsPanel: React.FC<SavedViewsPanelProps> = ({
  isOpen,
  onClose,
  currentLayers,
  onLoadView,
}) => {
  const [views, setViews] = useState<SavedView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load views when panel opens
  useEffect(() => {
    if (isOpen) {
      loadViews();
    }
  }, [isOpen]);

  const loadViews = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchJson<SavedView[]>('/api/views/list');
      setViews(response || []);
    } catch (err) {
      setError('加载视图列表失败');
      console.error('Failed to load views:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!newViewName.trim()) {
      setError('请输入视图名称');
      return;
    }

    try {
      await fetchJson('/api/views/save', 'POST', {
        name: newViewName.trim(),
        layers: currentLayers,
        workspace_only: false,
      });
      setSuccess(`视图 "${newViewName}" 已保存`);
      setNewViewName('');
      loadViews();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('保存视图失败');
      console.error('Failed to save view:', err);
    }
  }, [newViewName, currentLayers]);

  const handleLoad = useCallback(async (viewName: string) => {
    try {
      const view = await fetchJson<any>('/api/views/load', 'POST', {
        name: viewName,
        prefer_workspace: true,
      });
      if (view && view.layers) {
        onLoadView(viewName, view.layers);
      }
    } catch (err) {
      setError(`加载视图 "${viewName}" 失败`);
      console.error('Failed to load view:', err);
    }
  }, [onLoadView]);

  const handleDelete = useCallback(async (viewName: string) => {
    if (!confirm(`确定要删除视图 "${viewName}" 吗？`)) {
      return;
    }

    try {
      await fetchJson('/api/views/delete', 'POST', {
        name: viewName,
        from_workspace: false,
      });
      setSuccess(`视图 "${viewName}" 已删除`);
      loadViews();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`删除视图 "${viewName}" 失败`);
      console.error('Failed to delete view:', err);
    }
  }, []);

  const handleExport = useCallback(async () => {
    const input = prompt('请输入导出文件路径:', '~/loglayer-views-export.json');
    if (!input) return;

    try {
      await fetchJson('/api/views/export', 'POST', {
        output_path: input,
        view_names: null,
      });
      setSuccess('视图已导出');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('导出视图失败');
      console.error('Failed to export views:', err);
    }
  }, []);

  const handleImport = useCallback(async () => {
    const input = prompt('请输入导入文件路径:', '~/loglayer-views-import.json');
    if (!input) return;

    try {
      const results = await fetchJson<Record<string, boolean>>('/api/views/import', 'POST', {
        input_path: input,
        overwrite: false,
      });
      const successCount = Object.values(results).filter(Boolean).length;
      setSuccess(`成功导入 ${successCount} 个视图`);
      loadViews();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('导入视图失败');
      console.error('Failed to import views:', err);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">保存的视图</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Save new view */}
          <div className="space-y-2">
            <label className="text-sm font-medium">保存当前视图</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="视图名称..."
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              导出所有视图
            </button>
            <button
              onClick={handleImport}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              导入视图
            </button>
          </div>

          {/* Views list */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">已保存的视图</h3>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-4">加载中...</div>
            ) : views.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                暂无保存的视图
              </div>
            ) : (
              <div className="space-y-2">
                {views.map((view) => (
                  <div
                    key={view.name}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{view.name}</div>
                      <div className="text-xs text-muted-foreground">
                        更新于 {new Date(view.updated_at).toLocaleString()}
                        {view.source === 'workspace' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded">
                            工作区
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoad(view.name)}
                        className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                      >
                        加载
                      </button>
                      <button
                        onClick={() => handleDelete(view.name)}
                        className="px-3 py-1 text-xs border border-border rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-500/10 text-green-500 text-sm rounded-md">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
