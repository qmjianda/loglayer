# Proposal: perf-deepening

## Why

大型日志文件（GB 级、千万行）下，核心交互仍有可感知的性能缺口，且当前**缺少前端帧率测量手段**导致优化只能"凭感觉"。三项具体问题：

1. **渲染节流**：LogRow 的 memo/useMemo 缓存层因 `layers`/`bookmarks`/`colors` 引用不稳定而频繁失效（每帧重跑图层渲染器）；滚动位置看门狗逐帧常驻轮询 DOM（空闲也有开销）；渲染器零缓存导致重复行反复构造正则。同时 326 行 `useVirtualScroll` 死代码中的 FPS 采集完全未接入——性能优化无法用数据验证。
2. **搜索去抖**：防抖逻辑分散为两层手写 setTimeout（SearchPanel 200ms + useSearch 300ms，最坏串联 ~500ms），未复用 `utils` 的通用 debounce；bridge_client 请求无取消、无请求序号，过期 `pipelineFinished` 结果可能覆盖新结果。
3. **骨架屏**：已实现的 `IndexingOverlay`（进度环 + 百分比）从未挂载，索引进度只剩纯文字；搜索结果列表与统计加载无骨架占位，出现"数据跳变"。

## What Changes

- **渲染节流（render-throttling）**：
  - 滚动位置看门狗改为**有界**：空闲睡眠（连续 N 帧稳定即取消 rAF），在 scroll / dockview 激活与布局事件 / fileId 变化 / resize / scrollToIndex 时重新武装。滚动位置在面板切换时仍保持（行为不变，成本归零）。
  - 稳定 LogRow 渲染依赖的 `layers`/`bookmarks`/`colors` 引用，使 React.memo 浅比较恢复效力。
  - 渲染器结果引入**有界 LRU 缓存**（key=content+配置签名），重复内容行共享渲染结果，消除每行重复 `new RegExp` + `matchAll`。
  - 接入 `useVirtualScroll` 的 FPS/内存采集，点亮 `PerformanceIndicator`（debugMode 下）；删除空壳代码（`handleActivity` 空函数、空 idle 检测）；预测/降质/自适应 buffer 函数保留并标记为二期候选。
- **搜索去抖（search-debounce）**：
  - 统一为**单层 250ms 防抖**（集中到 useSearch，复用 utils debounce），移除 SearchPanel 200ms 与 useSearch 300ms 的双重防抖，两个入口延迟一致。
  - 搜索状态维护**请求序号**：新搜索使旧 `pipelineFinished` 结果失效，丢弃过期结果。
  - bridge_client `post()` 支持 **AbortSignal**，防抖窗口内新触发时取消挂起的在途请求。
- **骨架屏（loading-skeletons）**：
  - **挂载已实现的 `IndexingOverlay`**（索引构建时显示进度环 + 百分比，替代纯文字）。
  - 搜索结果列表加载中显示**行级骨架占位**（animate-pulse，复用 `FileLoadingSkeleton` 设计语言）。
  - InspectorSummary 统计加载中显示**骨架条**，消除切文件后的数字跳变。

## Capabilities

### New Capabilities

- `render-throttling`: 渲染热路径的节流与缓存：滚动位置保持（有界看门狗）、渲染 props 引用稳定、渲染结果跨行 LRU 缓存、前端帧率可观测。
- `search-debounce`: 搜索触发链路的去抖与竞态控制：统一单层防抖、过期结果失效、在途请求取消。
- `loading-skeletons`: 核心等待场景的骨架屏与进度反馈：索引构建进度环、搜索结果行级骨架、统计加载骨架。

### Modified Capabilities

（无——既有 specs 无需求层面的行为变更；本变更均为新增行为。）

## Impact

- **前端**（主要）：
  - `frontend/src/components/LogViewer.tsx`（有界看门狗、props 稳定化、FPS 接线）
  - `frontend/src/components/logViewer/LogRow.tsx`（间接：依赖 props 稳定生效）
  - `frontend/src/rendering/registry.ts`（渲染结果 LRU 缓存层）
  - `frontend/src/hooks/useSearch.ts` + `frontend/src/components/SearchPanel.tsx` + `EditorFindWidget.tsx`（统一防抖）
  - `frontend/src/store/searchStore.ts`（请求序号）
  - `frontend/src/bridge_client.ts`（AbortSignal）
  - `frontend/src/hooks/useVirtualScroll.ts` + `PerformanceIndicator.tsx` + `StatusBar.tsx`（FPS 采集接入、删空壳）
  - `frontend/src/components/LoadingOverlays.tsx` + `EditorArea.tsx` + `SearchResultsPanel.tsx` + `InspectorSummary.tsx`（骨架屏挂载）
- **后端**：无改动（搜索取消机制 `_retire_worker`/缓存已存在，仅被前端更少地触发）。
- **测试**：新增 vitest 验收测试（渲染器缓存、请求序号、防抖、看门狗），既有测试保持绿。
- **性能红线**：所有渲染热路径改动保持虚拟化 O(1)；缓存有界；调试开关默认关闭；不新增热路径日志。
