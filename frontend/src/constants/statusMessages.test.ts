import { describe, expect, it } from 'vitest';
import {
  formatOperationStatus,
  getOperationStatusMessage,
  type OperationStatus,
} from './statusMessages';

describe('统一操作状态文案（issue #7）', () => {
  it('将索引状态统一为文件加载中', () => {
    expect(getOperationStatusMessage('indexing')).toBe('文件加载中');
  });

  it('将图层流水线状态统一为图层处理中', () => {
    expect(getOperationStatusMessage('filtering')).toBe('图层处理中');
    expect(getOperationStatusMessage('transforming')).toBe('图层处理中');
    expect(getOperationStatusMessage('other')).toBe('图层处理中');
  });

  it('将搜索状态统一为搜索中', () => {
    expect(getOperationStatusMessage('searching')).toBe('搜索中');
  });

  it('保留进度、错误和待处理数量等上下文', () => {
    const status: OperationStatus = { op: 'indexing', progress: 42.4 };
    expect(formatOperationStatus(status)).toBe('文件加载中... (42%)');
    expect(formatOperationStatus({ op: 'searching', progress: 0 })).toBe('搜索中...');
    expect(formatOperationStatus({ op: 'filtering', progress: 0, error: '失败' })).toBe(
      '错误: 失败',
    );
  });
});
