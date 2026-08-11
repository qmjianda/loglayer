# Design: perf-deepening

## Context

现状约束（详见 proposal.md - Why 与只读分析报告）：
- 前端渲染热路径：`LogViewer.tsx`（自研 DOM 虚拟滚动）→ `LogRow.tsx`（React.memo + useMemo）→ `rendering/registry.ts`（纯函数渲染器，零缓存）。
- 看门狗（LogViewer.tsx:135-150）逐帧常驻 rAF；dockview 面板切换归零滚动条且**不触发 scroll 事件**（时序异步，注释 :131-133 已验证）。
- 搜索触发：SearchPanel 200ms + useSearch 300ms 两层手写 setTimeout；`bridge_client.post()` 裸 fetch 无 AbortSignal；`pipelineFinished` 无过期校验。
- `LoadingOverlays.tsx` 已有 `IndexingOverlay`（未挂载）/`FileLoadingSkeleton`（已挂载）；统计拉取无 loading 态。
- 前端测试基建：vitest（`npm test`），测试与源码同目录；后端搜索取消（`_retire_worker`）与两级缓存已存在，本期不动。

## Goals / Non-Goals

**Goals（设计层）**：
- 所有热路径优化保持虚拟化 O(1)、缓存有界、调试开关默认关闭。
- 行为语义不变：滚动位置保持、搜索语义、加载态展示——只改成本与表现形态。
- 本期所有渲染改动可被 FPS 基线验证（接入 FPS 采集的原因）。

**Non-Goals**：
- 不重构 LogViewer 虚拟滚动核心（窗口/平移/缩放机制不动）。
- 不做快速滚动降质/预取/自适应 buffer 的**接线**（函数保留，二期）。
- 不动后端（搜索取消/缓存已具备）；不做同文件多 tab 搜索隔离（已知限制）。
- 不做 P2/P3 骨架项（AI 设置/文件树/路径选择器/书签 loading）。

## Decisions

### D1: 有界看门狗 —— 空闲睡眠 + 事件重新武装（方案1，老板已定）

实现：看门狗 tick 循环增加**稳定帧计数**——连续 N 帧（30 帧 ≈ 0.5s）满足 `top === state`（含 `top===0 && state===0`）且无纠正 → `cancelAnimationFrame` 睡眠；任一重新武装触发时重启循环。

**重新武装触发器**（复用既有监听，无新增轮询）：
- scroll 事件（现有 passive 监听器）
- resize（现有监听器）
- `fileId` 变化（现有 effect）
- 面板激活变化：`EditorArea.tsx:331` 已有 `onDidActivePanelChange` 挂点，经 props 传递 `isActive` 给 LogViewer，激活时武装一次
- `scrollToIndex` 程序化定位（现有 effect，保持其同步 ref 逻辑以不被误判）

保留的既有保护逻辑：80ms 用户滚动保护窗口（`lastScrollEventRef`）、纠正时 `el.scrollTop = state` + `setScrollTop(state)`、`LOGVIEWER_SCROLL_STORE` 跨重挂载持久化。

**备选**：事件驱动一次性恢复（`onDidActivePanelChange` 后恢复一次）——因归零时序异步（注释 :131-133），一次性恢复大概率打空，仅作为二期"武装时机的精确化"；MutationObserver 监听 `dv-active-group`——耦合 dockview DOM 内部，改版即碎，不用。

### D2: 渲染依赖引用稳定 —— module 常量 + useMemo

- `layers`/`bookmarks` 默认值：从函数默认参数 `= []` / `= {}`（每次新引用）改为 **module 级冻结常量** `EMPTY_LAYERS` / `EMPTY_BOOKMARKS`，重渲染间引用恒定。
- `colors`：`useMemo(() => getLogViewerColors(theme), [theme])`，主题未变引用不变。
- 父组件真实传值（EditorArea/App）若每次新造对象，一并收敛（本轮仅收敛 LogViewer 内默认值与派生值，父组件传值核查后按需稳定）。

**备选**：LogRow 自定义 memo 深比较——比较成本高于收益，不选。

### D3: 渲染结果跨行 LRU —— registry 层通用缓存

`rendering/registry.ts` 新增 `createRenderCache(limit = 500)`：Map 实现（命中即 delete+set 维持 LRU 序），key = `content + 渲染器配置签名`（JSON 序列化配置子集），value = `{ segments, rowStyle }` 不可变引用。

- 接入点：`renderLayers` 顶层入口统一走缓存；`renderWithIsolation` 保持单层语义（供直接调用方无缓存）。
- **无需显式失效**：key 含配置签名，配置变化自然 miss；LRU 天然淘汰，内存有界。
- 主要收益在 HIGHLIGHT（`matchAll` 全量扫描 + 正则构造）；LEVEL/ROWTINT 配置简单，同享机制。
- 重复日志行（心跳/错误风暴）命中率高，符合日志数据分布。

**备选**：无缓存（现状，每行重复构造）；`memoize-one` 每行（已被 LogRow useMemo 承担，跨行无共享）；WeakMap（无界淘汰策略，不选）。

### D4: FPS 采集接入 —— 精简 useVirtualScroll + 点亮 PerformanceIndicator

- 删除空壳：`handleActivity` 空函数、空 idle 检测 interval、未用的 `updateCacheStats` 保留与否按消费点定（无消费则删）。
- 保留并标记二期：`isScrollingFast` / `predictNextVisibleRange` / `getRecommendedBuffer` / `getMomentum`（新增注释标注）。
- 接线：debugMode 时 LogViewer（或 App 级）调用 `useVirtualScroll({ debugMode, enabled })`，`metrics` 传给 StatusBar（其 `showPerformance = settings.debugMode && performanceMetrics` 条件已存在，仅需传入）与 PerformanceIndicator。
- 验收可测性：`calculateFps` 核心逻辑抽为纯函数导出（`computeAverageFps` 等），供 vitest 单测。

**备选**：不接（无法验证本期优化）——老板已否决；完整接入预测/降质——触碰热路径，留二期。

### D5: 统一搜索防抖 —— useDebouncedValue(250ms) 收敛到 useSearch

- 新增 `useDebouncedValue<T>(value, delay)`（内部用 `utils` 的 debounce 或直接 setTimeout，抽 hook 便于测试）。
- useSearch：对 `searchQuery` 应用 `useDebouncedValue(query, 250)`，effect 改监听去抖后的值触发 `syncAll`；删除现有 300ms setTimeout 手写逻辑。
- SearchPanel：移除 200ms useEffect 防抖，`onSearch` 直接 `setQuery`（防抖统一收敛到 useSearch）。
- EditorFindWidget：无需单独防抖（统一层已覆盖），仅确认其 `setQuery` 路径不经第二层防抖。

**备选**：store 层防抖（状态与副作用耦合，不选）；保留双层（延迟叠加/不一致，boss 已否决）。

### D6: 请求序号 + AbortSignal —— store 校验 + 请求可取消

- searchStore：`TabSearchState` 增加 `requestSeq: number`；action `bumpSeq(panelId)` 触发搜索时递增。
- 过期结果校验：App.tsx `onPipelineFinished` 应用结果前校验「信号对应面板」的 `requestSeq` 与 store 当前值一致，不一致则丢弃（不更新 matchCount/isSearching）。
- AbortSignal：`bridge_client.post()` 增加可选 `signal` 参数；`syncAll` 返回 `AbortController`（或接受外部 controller）；useSearch 在防抖清理与下一次触发时 abort 挂起请求；`AbortError` 静默吞掉（不抛未捕获异常）。

**备选**：仅靠后端 `_retire_worker` 取消（HTTP 在途浪费仍在，过期 pipelineFinished 仍可能覆盖 UI）——不满足 spec 的过期失效场景。

### D7: IndexingOverlay 挂载 —— EditorArea 组合渲染

- EditorArea 面板区域：`indexingFileIds.has(fileId)` 时在 `FileLoadingSkeleton` 之上叠加 `IndexingOverlay`（进度环覆盖中央），`fileLoaded` 后整体消失。
- 进度数据：App 已有 `loadingProgress`（operationProgress op='indexing' 驱动），经 props 传给 EditorArea → IndexingOverlay。
- 纯文字态（LogViewer 内 "正在构建索引... X%"）保留为兜底，不冲突（overlay 覆盖其上）。

### D8: 搜索结果/统计骨架 —— 复用设计语言

- 抽轻量 `SkeletonRows`（animate-pulse 行条，行数与视口相关）复用 `FileLoadingSkeleton` 的行样式常量。
- SearchResultsPanel：`isLoading` 时渲染 `SkeletonRows` 替代纯文字。
- 统计骨架：App 增加 `statsLoading` 状态（stats 请求发起到数据到达）；InspectorSummary 接收 `loading` prop，为真时渲染骨架条（级别条 + 数字占位）。

## Risks / Trade-offs

- [LRU 缓存 key 序列化开销] → key 构造仅序列化配置子集（小对象），content 直接用字符串引用；命中率足够高（重复行）时净收益为正；上限 500 条控制内存。
- [有界看门狗漏检窗口] → 睡眠仅在「连续 30 帧稳定」后进入，且面板激活/resize/fileId/scroll 均立即重新武装；dockview 归零恰发生在睡眠期且无任何事件触发的场景在当前交互模型下不存在（归零必伴随面板激活事件）。
- [FPS 采集影响测量本身] → 采集为纯只读（rAF 计数 + performance.now），开销可忽略；默认 debugMode 关闭。
- [AbortSignal 取消后端不生效] → abort 只省前端网络与避免响应处理；后端 pipeline 由下一次触发经 `_retire_worker` 取消（既有机制），双保险。
- [统一防抖改变既有 500ms 最坏延迟为固定 250ms] → 交互语义更一致；缓存命中场景重复查询本就毫秒级，去抖不构成瓶颈。

## Migration Plan

1. 纯增量改动，无数据迁移、无 API 破坏（AbortSignal 为可选参数，向后兼容）。
2. 回滚策略：各改动独立小步提交；看门狗/缓存/FPS 均可用 `git revert` 单点回退，互不依赖。
3. 验证顺序：验收测试红 → 实现绿 → vitest 全量 + tsc + lint → e2e（light）回归核心交互。

## Open Questions

无（两个分叉已在设计评审中由老板定夺：方案1 有界看门狗；FPS 接入删空壳；渲染器 LRU 纳入本期）。
