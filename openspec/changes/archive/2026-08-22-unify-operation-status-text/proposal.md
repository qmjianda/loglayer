## Why

文件加载、图层流水线和搜索过程中目前使用多套近义文案，状态栏、覆盖层和日志视图的提示不一致，用户难以快速判断当前操作。issue #7 要求统一这些主操作状态的视觉文本，同时不牺牲已有进度和错误上下文。

## What Changes

- 统一文件打开/索引等待态的主文案为“文件加载中”。
- 统一 FILTER、TRANSFORM 等图层流水线等待态的主文案为“图层处理中”。
- 统一搜索等待态的主文案为“搜索中”。
- 在状态栏、索引覆盖层、文件加载骨架和日志视图中复用同一组文案常量。
- 保留百分比、文件名、待处理数量和错误信息等上下文，不改变后端信号或 API。
- 不调整 AI、远程目录、书签预览和分页加载等独立等待态。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `loading-skeletons`: 修改索引、搜索等待态的状态文字要求，并补充统一文案和上下文保留场景。

## Impact

- 影响 `frontend/src/components/StatusBar.tsx`、`LoadingOverlays.tsx`、`LogViewer.tsx` 及一个共享状态文案模块。
- 新增前端组件/格式化函数测试；不修改后端、协议、依赖或持久化数据。
