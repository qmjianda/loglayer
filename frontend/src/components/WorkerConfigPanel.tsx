import React, { useState, useEffect } from 'react';
import { Button } from './common/Button';
import { getWorkerConfig, setWorkerConfig } from '../bridge_client';

interface WorkerConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (maxWorkers: number) => void;
}

export const WorkerConfigPanel: React.FC<WorkerConfigPanelProps> = ({
  isOpen,
  onClose,
  onConfigChange,
}) => {
  const [maxWorkers, setMaxWorkers] = useState(4);
  const [currentWorkers, setCurrentWorkers] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const config = await getWorkerConfig();
      setMaxWorkers(config.maxWorkers);
      setCurrentWorkers(config.currentWorkers);
    } catch (e) {
      console.error('Failed to load worker config:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setWorkerConfig(maxWorkers);
      onConfigChange?.(maxWorkers);
      onClose();
    } catch (e) {
      console.error('Failed to save worker config:', e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const workerOptions = [1, 2, 4, 8, 16];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-secondary border-default rounded-lg w-[400px]">
        <div className="flex items-center justify-between p-4 border-b border-default">
          <h2 className="text-lg font-medium text-primary">Worker 配置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center text-gray-500 py-4">加载中...</div>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">最大 Worker 数量</label>
                <div className="grid grid-cols-5 gap-2">
                  {workerOptions.map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxWorkers(n)}
                      className={`p-2 rounded border text-center transition-colors ${
                        maxWorkers === n
                          ? 'border-primary-color bg-primary-color/10 text-primary'
                          : 'border-default hover:border-primary-color text-secondary'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  更多 Worker 可以提高并发处理能力，但也会占用更多资源
                </p>
              </div>

              <div className="p-3 bg-tertiary rounded">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">当前活跃 Worker</span>
                  <span className="text-primary">{currentWorkers}</span>
                </div>
              </div>

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                <p className="text-xs text-yellow-400">
                  修改将在下次启动时生效
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-default">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
};