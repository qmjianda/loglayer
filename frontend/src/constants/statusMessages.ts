export type OperationStatusKind = 'indexing' | 'filtering' | 'transforming' | 'searching' | 'other';

export interface OperationStatus {
  op: string;
  progress: number;
  error?: string;
}

export const OPERATION_STATUS_MESSAGES: Record<OperationStatusKind, string> = {
  indexing: '文件加载中',
  filtering: '图层处理中',
  transforming: '图层处理中',
  searching: '搜索中',
  other: '图层处理中',
};

export function getOperationStatusMessage(op: string): string {
  if (op === 'indexing' || op === 'filtering' || op === 'transforming' || op === 'searching') {
    return OPERATION_STATUS_MESSAGES[op];
  }
  return OPERATION_STATUS_MESSAGES.other;
}

export function formatOperationStatus(status: OperationStatus): string {
  if (status.error) return `错误: ${status.error}`;
  const message = getOperationStatusMessage(status.op);
  const progress = status.progress > 0 ? ` (${Math.round(status.progress)}%)` : '';
  return `${message}...${progress}`;
}

export const FILE_LOADING_MESSAGE = OPERATION_STATUS_MESSAGES.indexing;
export const LAYER_PROCESSING_MESSAGE = OPERATION_STATUS_MESSAGES.other;
export const SEARCHING_MESSAGE = OPERATION_STATUS_MESSAGES.searching;
