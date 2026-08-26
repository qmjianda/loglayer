# fix-blank-rows-prefetch-holes 提案

## Why

日志视图偶发两类空白（需分治，原提案仅覆盖第一类）：

**A. 骨架洞（小文件，12 行量级，有行号+灰条骨架）**：按需拉取链路的"失败即永久空洞"——前端先标记拉取区间再发起请求，任何一次空响应（后端 mmap 重建中返回 `[]`）、网络错误或管线竞态都会让该区间永久缺失；而窗口更新的滞后阈值（≥ windowBuffer*0.5 才平移）加上同区间去重使小幅滚动永不重拉，只有拖动进度条大距离移动才能覆盖空洞。另有同源隐患：后端 `read_processed_lines` 对异常行静默 `continue` 会压缩结果数组，导致前端按偏移回填时整段错位。

**B. 真空洞（1.2GB+ 超大文件，偶发，真空无行号，拖动大距离自愈）**：`realTotalHeight > MAX_SCROLL_HEIGHT(30M)` 触发滚动缩放（`useScaling=true`），`logicalScrollTop = scrollTop/maxPhysical*maxLogical` 与 `desiredWindowStart = topVisibleLine - windowBuffer` 依赖异步测量的 `viewportHeight`；缩放比在视口尺寸跳变时突变，`computeViewportTranslateY` 一帧内把 `[windowStart, windowEnd)` 移出视口，视口仅剩 spacer 背景，表象为无行号真空。此路径不经过拉取失败，修 A 类洞无法根治。

## What Changes

- 前端拉取对账机制（治 A）：fetch 失败或返回行数不足时**不**标记区间为已拉取，允许重试；新增对已渲染窗口 `[windowStart, windowEnd)` 的覆盖校验，缺口子区间补拉。判定含空数组 `[]`（`bridge_client` 吞错）与 `null` 占位。
- 后端 `read_processed_lines` 消除静默跳行的数组压缩语义（占位 null 或携带显式 index），保证请求 count 与返回结构一一对应。
- 视口探针与缩放对齐（诊 B/治 B 预研）：`LogViewer.tsx` 增加 `[Fetch]/[Reconcile]/[Viewport]` 三类门控日志（`LOGLAYER_DEBUG`/`VITE_DEBUG`，关闭零开销），记录 `windowStart/desired/topVisible/logical/physical/vpH/scaling/ratio/itemCount`；探针结论决定是否追加"缩放比快照/窗口强制对齐"修复（若 B 确认为主因，阈值策略需另议）。
- 探针支持：debug 日志记录每次 fetch 的 `{range, 返回行数, 耗时}` 与视口状态（遵循 LOGLAYER_DEBUG 开关规范）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `log-viewer-lazy-loading`: 新增需求——已渲染窗口内被占位的行 SHALL 在有限时间内被自动补齐（无需用户大幅滚动）；单次拉取失败 SHALL NOT 造成该区间的永久缺失。

## Impact

- **前端**：`frontend/src/components/LogViewer.tsx` 拉取 effect（lastFetchRef 标记时机、覆盖对账、缺口补拉）+ 视口/缩放链路（`windowStart` 阈值、`computeViewportTranslateY`、缩放比计算）；可能新增 `frontend/src/utils/prefetchRange.ts` 的缺口计算辅助函数。
- **后端**：`backend/bridge/file_bridge.py` `read_processed_lines`（:1026-1097）返回结构语义修正；消费方（该端点唯一调用方是前端此路径）同步适配。
- **行为**：A 类骨架洞在数百毫秒内自动填充；B 类真空洞经探针定性后按结论追加修复（若为缩放失步则为视口对齐，不再仅为拉取层）；行内容与行号错位的潜在隐患一并消除。
