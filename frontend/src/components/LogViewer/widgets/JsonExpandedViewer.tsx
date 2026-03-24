import React from 'react';
import { createPortal } from 'react-dom';
import { JsonTreeView } from '../../JsonTreeView';
import { detectJson } from '../../../utils/jsonTree';

interface LogLine {
  index: number;
  content: string;
  displayContent?: string;
}

interface JsonExpandedViewerProps {
  expandedJsonLine: number | null;
  bridgedLines: Map<number, string | LogLine>;
  onClose: () => void;
}

export const JsonExpandedViewer: React.FC<JsonExpandedViewerProps> = ({
  expandedJsonLine,
  bridgedLines,
  onClose,
}) => {
  if (expandedJsonLine === null) return null;

  const line = bridgedLines.get(expandedJsonLine);
  const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
  const { valid, data } = detectJson(content);

  return createPortal(
    <div className="fixed bottom-4 right-4 w-96 max-h-64 overflow-auto bg-elevated border border-default shadow-2xl rounded z-[1000]">
      <div className="flex justify-between items-center px-3 py-2 border-b border-subtle">
        <span className="text-sm font-medium text-primary">JSON 展开 (行 {expandedJsonLine + 1})</span>
        <button onClick={onClose} className="text-muted hover:text-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-2">
        {valid ? (
          <JsonTreeView jsonString={JSON.stringify(data, null, 2)} />
        ) : (
          <div className="text-error">无效的 JSON</div>
        )}
      </div>
    </div>,
    document.body
  );
};