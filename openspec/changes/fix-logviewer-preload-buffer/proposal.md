# Proposal: 修复 LogViewer 预加载 buffer 不足问题

## Why

LogViewer 的虚拟滚动预加载功能存在延迟问题。当用户快速滚动时，预加载的 buffer (200-500 行) 不足以覆盖可视区域外的区域，导致需要等待后端返回数据才能渲染，出现空白或加载中的提示。

## What Changes

- 增大预加载 buffer 大小
- 优化动态 buffer 计算逻辑
- 调整 FETCH_DEBOUNCE_MS 减少不必要的请求

## Impact

- `frontend/src/constants.ts`: 调整预加载配置参数
- `frontend/src/components/LogViewer.tsx`: 优化动态 buffer 逻辑
