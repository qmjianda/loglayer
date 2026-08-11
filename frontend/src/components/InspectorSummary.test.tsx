/**
 * InspectorSummary 统计加载骨架验收测试（perf-deepening / loading-skeletons）
 *
 * 追溯 spec: loading-skeletons → "统计加载骨架"
 * - 统计拉取中显示骨架条（非空白）
 * - 统计完成后骨架替换为真实数据
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InspectorSummary } from './InspectorSummary';
import type { FileData } from '../hooks/useFileManagement';
import type { LogLevelStats } from '../types';

const activeFile: FileData = {
  id: 'f1',
  name: 'app.log',
  path: '/logs/app.log',
  size: 1024,
  lineCount: 100,
  rawCount: 100,
  layers: [],
  isBridged: true,
};

const zeroStats: LogLevelStats = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 };

describe('InspectorSummary 统计骨架（统计加载骨架）', () => {
  it('loading 时渲染统计骨架条而非空白', () => {
    render(<InspectorSummary activeFile={activeFile} logLevelStats={zeroStats} loading />);
    expect(screen.getByTestId('summary-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('summary-stats')).toBeNull();
  });

  it('非 loading 渲染真实统计（骨架消失）', () => {
    const stats: LogLevelStats = { ERROR: 5, WARN: 0, INFO: 10, DEBUG: 0, TRACE: 0 };
    render(<InspectorSummary activeFile={activeFile} logLevelStats={stats} loading={false} />);
    expect(screen.queryByTestId('summary-skeleton')).toBeNull();
    expect(screen.getByTestId('summary-stats')).toBeTruthy();
    expect(screen.getByText(/ERROR/)).toBeTruthy();
  });
});
