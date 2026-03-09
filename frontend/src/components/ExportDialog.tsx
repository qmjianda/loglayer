import React, { useState } from 'react';
import { Button } from './common/Button';
import { Input } from './common/Input';

export type ExportFormat = 'txt' | 'csv' | 'json';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  onExport: (options: {
    fileId: string;
    outputPath: string;
    format: ExportFormat;
    includeLineNumbers: boolean;
    includeTimestamps: boolean;
  }) => Promise<void>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  fileId,
  fileName,
  onExport,
}) => {
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [outputPath, setOutputPath] = useState('');
  const [includeLineNumbers, setIncludeLineNumbers] = useState(true);
  const [includeTimestamps, setIncludeTimestamps] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!outputPath) return;
    setIsExporting(true);
    try {
      await onExport({
        fileId,
        outputPath,
        format,
        includeLineNumbers,
        includeTimestamps,
      });
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const formatOptions = [
    { value: 'txt', label: 'TXT (纯文本)', desc: '每行一个日志' },
    { value: 'csv', label: 'CSV (逗号分隔)', desc: '适合 Excel 分析' },
    { value: 'json', label: 'JSON', desc: '结构化数据' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-theme-surface border border-theme-default rounded-lg w-[480px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-theme-default">
          <h2 className="text-lg font-medium text-white">导出日志</h2>
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
          <div>
            <label className="block text-sm text-gray-400 mb-2">文件</label>
            <div className="px-3 py-2 bg-[#2a2a2a] rounded text-white">{fileName}</div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">导出格式</label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value as ExportFormat)}
                  className={`p-3 rounded border text-left transition-colors ${
                    format === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-[#3a3a3a] hover:border-gray-500 text-gray-300'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">输出路径</label>
            <Input
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder={format === 'csv' ? 'export.csv' : format === 'json' ? 'export.json' : 'export.txt'}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLineNumbers}
                onChange={(e) => setIncludeLineNumbers(e.target.checked)}
                className="w-4 h-4 rounded border-gray-500 bg-[#2a2a2a] text-blue-500"
              />
              <span className="text-sm text-gray-300">包含行号</span>
            </label>

            {format === 'json' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTimestamps}
                  onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-500 bg-[#2a2a2a] text-blue-500"
                />
                <span className="text-sm text-gray-300">包含时间戳</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-theme-default">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!outputPath || isExporting}
          >
            {isExporting ? '导出中...' : '导出'}
          </Button>
        </div>
      </div>
    </div>
  );
};