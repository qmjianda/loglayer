import React, { useState, useEffect } from 'react';
import { Button } from './common/Button';
import { reloadPlugins } from '../bridge_client';

interface Plugin {
  name: string;
  type: string;
  description?: string;
  enabled: boolean;
}

interface PluginManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PluginManager: React.FC<PluginManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const [layers, setLayers] = useState<Plugin[]>([]);
  const [widgets, setWidgets] = useState<Plugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPlugins();
    }
  }, [isOpen]);

  const loadPlugins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/get_layer_registry');
      const data = await res.json();
      const layerPlugins: Plugin[] = data.map((l: any) => ({
        name: l.type,
        type: 'layer',
        description: l.description,
        enabled: true,
      }));
      setLayers(layerPlugins);

      const widgetRes = await fetch('/api/get_ui_widgets');
      const widgetData = await widgetRes.json();
      const widgetPlugins: Plugin[] = widgetData.map((w: any) => ({
        name: w.type,
        type: 'widget',
        description: w.display_name,
        enabled: true,
      }));
      setWidgets(widgetPlugins);
    } catch (e) {
      console.error('Failed to load plugins:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReload = async () => {
    setIsReloading(true);
    try {
      await reloadPlugins();
      await loadPlugins();
    } catch (e) {
      console.error('Failed to reload plugins:', e);
    } finally {
      setIsReloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg w-[600px] max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#3a3a3a]">
          <h2 className="text-lg font-medium text-white">插件管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="flex justify-end mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReload}
              disabled={isReloading}
            >
              {isReloading ? '重载中...' : '重载插件'}
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center text-gray-500 py-8">加载中...</div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">图层插件 ({layers.length})</h3>
                {layers.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-[#3a3a3a] rounded">
                    暂无图层插件
                  </div>
                ) : (
                  <div className="space-y-2">
                    {layers.map((layer) => (
                      <div
                        key={layer.name}
                        className="flex items-center justify-between p-3 bg-[#2a2a2a] rounded"
                      >
                        <div>
                          <div className="text-white font-medium">{layer.name}</div>
                          {layer.description && (
                            <div className="text-xs text-gray-500">{layer.description}</div>
                          )}
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                          图层
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">挂件插件 ({widgets.length})</h3>
                {widgets.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-[#3a3a3a] rounded">
                    暂无挂件插件
                  </div>
                ) : (
                  <div className="space-y-2">
                    {widgets.map((widget) => (
                      <div
                        key={widget.name}
                        className="flex items-center justify-between p-3 bg-[#2a2a2a] rounded"
                      >
                        <div>
                          <div className="text-white font-medium">{widget.name}</div>
                          {widget.description && (
                            <div className="text-xs text-gray-500">{widget.description}</div>
                          )}
                        </div>
                        <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">
                          挂件
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-[#3a3a3a]">
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
};