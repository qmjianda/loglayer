# fix-blank-rows-prefetch-holes 提案

## Why

日志视图偶发文件首/尾若干行（如 12 行）渲染为空白占位：行占空间但无文本与行号。根因是按需拉取链路的"失败即永久空洞"——前端先标记拉取区间再发起请求，任何一次空响应（后端 mmap 重建中返回 `[]`）、网络错误或管线竞态都会让该区间永久缺失；而窗口更新的滞后阈值（≥ windowBuffer*0.5 才平移）加上同区间去重使小幅滚动永不重拉，只有拖动进度条大距离移动才能覆盖空洞。另有同源隐患：后端 `read_processed_lines` 对异常行静默 `continue` 会压缩结果数组，导致前端按偏移回填时整段错位。

## What Changes

- 前端拉取对账机制：fetch 失败或返回行数不足时**不**标记区间为已拉取，允许重试；新增对已渲染窗口 `[windowStart, windowEnd)` 的覆盖校验，缺口子区间补拉。
- 后端 `read_processed_lines` 消除静默跳行的数组压缩语义（占位 null 或携带显式 index），保证请求 count 与返回结构一一对应。
- 探针支持：debug 日志记录每次 fetch 的 `{range, 返回行数, 耗时}`（遵循 LOGLAYER_DEBUG 开关规范）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `log-viewer-lazy-loading`: 新增需求——已渲染窗口内被占位的行 SHALL 在有限时间内被自动补齐（无需用户大幅滚动）；单次拉取失败 SHALL NOT 造成该区间的永久缺失。

## Impact

- **前端**：`frontend/src/components/LogViewer.tsx` 拉取 effect（lastFetchRef 标记时机、覆盖对账、缺口补拉）；可能新增 `frontend/src/utils/prefetchRange.ts` 的缺口计算辅助函数。
- **后端**：`backend/bridge/file_bridge.py` `read_processed_lines`（:1026-1097）返回结构语义修正；消费方（该端点唯一调用方是前端此路径）同步适配。
- **行为**：首/尾空白占位在数百毫秒内自动填充；行内容与行号错位的潜在隐患一并消除。
