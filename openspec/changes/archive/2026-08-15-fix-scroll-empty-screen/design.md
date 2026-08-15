# Design: fix-scroll-empty-screen

## Context

目标：滚动（滚轮 / 拖进度条）时「尽可能」显示真实文本，允许偶发占位。度量 = 「行进入视口时是否已在 `bridgedLines`」。

现状与约束（`LogViewer.tsx`）：

- fetch 由渲染窗口驱动，`windowBuffer = Math.max(50, visibleRows)` 硬编码；`constants.ts` 的 `BUFFER_NORMAL = 800` 已定义但从未接线。
- fetch 用「50ms 防抖 + cleanup 设 `ignore=true`」→ 连续滚动时在途结果全被丢弃，缓存无法在滚动中填充。
- `useVirtualScroll` 的预测函数（`predictNextVisibleRange` 等）为未接线死代码，正确性未知。
- `updateTrigger`（文件重索引 / 管线重跑）时未清空 `bridgedLines`，当前靠整窗重拉覆盖陈旧行。
- 千万行是硬需求：`useScaling`（`MAX_SCROLL_HEIGHT = 30M`）压缩物理滚动高度并做物理→逻辑映射。

### 成熟开源参照（拼好码策略）

| 参数 | 成熟参照 | 取值 | 本项目采用 |
|:---|:---|:---|:---|
| 渲染 overscan | react-window `overscanCount` / react-virtualized `overscanRowCount` / AG Grid `rowBuffer` | 3 / 10 / 10 | 渲染窗口保持小（≈50 行，不动） |
| 拉取块大小 | AG Grid `cacheBlockSize` | 100 | `PREFETCH_BUFFER` 默认 100（可调） |
| 拉取时机 | AG Grid `blockLoadDebounceMillis` | 0 | 无时间防抖/节流，靠 re-anchor 滞后限流 |
| 并发 | AG Grid `maxConcurrentDatasourceRequests` | 2 | 在途不取消 + 幂等合并 |
| 淘汰 | AG Grid `maxBlocksInCache`（LRU） | — | 沿用 `MAX_CACHED_LINES` 淘汰 |

## Goals / Non-Goals

**Goals:**
- 滚动时持续填充缓存：可视区 ± M 始终在拉取中，真实文本尽量就绪。
- 数据变化时立即清空缓存，绝不显示陈旧文本（正确性不变式）。

**Non-Goals:**
- 方向/速度预测预取（弃用 `useVirtualScroll`）。
- 缓存命中跳过（接受重叠冗余）。
- 字节预算缓存、去冗余 syncAll、可见区优先分片（另行评估 / 后续可选）。
- 迁移到 react-virtuoso（见 D4）。
- 不改变虚拟滚动渲染模型（仍为固定窗口平移）。
- 不保证快速滚动/拖条跳转时零占位（尽力而为）。

## Decisions

### D1: 静态对称预取 —— 拉取「可视区 ± M」，M 为配置常量

- **取什么**：`[topVisibleLine - M, topVisibleLine + visibleRows + M)`，M 为配置（`PREFETCH_BUFFER`，默认 100，成熟参照 AG Grid `cacheBlockSize=100`，后续调参）。
- **无方向、无速度、无动态**：主流虚拟滚动库均为静态对称 overscan，不做方向/速度自适应。
- **渲染窗口不动**：fetch 范围与渲染窗口解耦，渲染 overscan 保持小（≈50 行），不扩大渲染 DOM 行数（虚拟化 O(1) 红线）。

### D2: 在途不取消 + 幂等合并 —— 无时间防抖/节流

- **触发时机**：窗口 re-anchor 时立即拉取，不做时间防抖/节流（成熟参照 AG Grid `blockLoadDebounceMillis=0`）；re-anchor 滞后（`windowBuffer * 0.5`）自然限流。
- **在途请求不取消**：返回后按行号幂等合并（同 index 后写覆盖先写，内容一致无副作用）。
- **根因**：原「防抖 + 取消」导致连续滚动零命中，是空白屏的结构性主因。

### D3: 数据变化清空缓存（正确性不变式）

- `updateTrigger`（文件重索引 / 图层 / 搜索变化）变化时 `setBridgedLines(new Map())` 清空，再走 D1 重拉。
- 否则陈旧 visual-index → 行 映射会残留并显示错误文本。

### D4: 保留自研虚拟化外壳，不迁移 react-virtuoso

- **硬需求**：千万行滚动缩放。react-virtuoso / react-window 的滚动高度 = `总行数 × 行高`，千万行会溢出浏览器滚动上限（~3350万 px），后半部分行无法滚动到。
- **现状**：react-virtuoso 已在 package.json 但从未接线（`3a9b38c` Canvas→DOM 重构误留的死依赖 + 旧注释）。
- **结论**：自研滚动外壳属于「开源不满足需求的差异点」（AGENTS.md 允许，自研部分有 `revealScroll.test.ts` 覆盖）；本次只改 fetch 策略，fetch 参数语义照抄 react-virtuoso / AG Grid。

## Risks / Trade-offs

| 风险 | 缓解 |
|:---|:---|
| 重叠冗余：滚动回头会重复拉已缓存行 | re-anchor 滞后限流 + 本机 localhost 往返快，可接受；后续可选「整段已缓存则跳过」 |
| M 过大导致单次 payload 大 | M 为配置、默认取成熟量级（100）；`MAX_CACHED_LINES = 5000` 天然兜住上界 |
| 在途请求并发（re-anchor 间积压） | localhost 快，在途数少；合并幂等无竞态 |
| 数据变化漏清 → 陈旧文本 | `updateTrigger` 显式纳入 fetch effect 依赖 + 清空 |

## Migration Plan

- 纯前端逻辑，无数据迁移。
- 回滚 = 还原 `LogViewer.tsx` / `constants.ts` 相关改动。
- 验收：ATDD 按 2 个 delta spec 场景写测试（静态对称预取范围、数据变化清空缓存），先红后绿。
