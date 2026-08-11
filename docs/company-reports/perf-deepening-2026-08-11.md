# perf-deepening 交付报告（2026-08-11）

> 一人公司循环：评审 → 规格 → 红 → 实现 → 回归 → 汇报。变更 `openspec/changes/perf-deepening/`。

## 变更摘要

性能深化三项：**渲染节流**（有界看门狗 / 渲染依赖引用稳定 / 渲染结果 LRU / FPS 可观测）、**搜索去抖**（统一单层防抖 / 请求序号 / AbortSignal）、**骨架屏**（挂载 IndexingOverlay / 搜索结果骨架 / 统计骨架）。

| 能力 | 关键交付 |
|:-----|:---------|
| `render-throttling` | `utils/watchdog.ts` 决策纯函数；LogViewer 看门狗空闲睡眠 + scroll/resize/fileId/isActive 重新武装；`EMPTY_LAYERS`/`EMPTY_BOOKMARKS` 稳定引用 + colors useMemo；registry `createRenderCache(500)` + `buildRenderKey` 配置签名；useVirtualScroll 删空壳 + `computeAverageFps`/`isLowFps` 导出，debugMode 点亮 PerformanceIndicator |
| `search-debounce` | `useDebouncedValue(250ms)` 统一单层防抖（移除 SearchPanel 200ms + useSearch 300ms 双防抖）；searchStore `requestSeq`/`consumedSeq` + `bumpSearchSeq`/`markSearchConsumed`/`isStalePipelineResult`；`post()` 支持 AbortSignal，`syncAll` 返回 AbortController，AbortError 静默 |
| `loading-skeletons` | EditorArea 挂载 IndexingOverlay（进度环 + 百分比）；`SkeletonRows` 组件（animate-pulse 设计语言）；SearchResultsPanel 加载骨架；InspectorSummary `loading` prop 统计骨架（statsLoading 状态经 InspectorDock/InspectorPanel 透传） |

## 验收测试（先红后绿）

- **红**（规格阶段）：7 文件 / 17 用例失败（模块不存在）
- **绿**（实现阶段）：`Test Files 12 passed (12), Tests 85 passed (85)` —— 含新增验收 + 既有测试无回归

## 回归证据

| 门 | 结果 |
|:---|:-----|
| vitest 全量 | ✅ 12 文件 85 用例通过 |
| e2e light | ✅ 22/22 通过（含 `test_split_preserve_scroll` 看门狗领域、`test_multi_panel_search` 搜索领域） |
| `npx tsc --noEmit` | ✅ 0 错误 |
| `npm run lint` | ✅ 0 error |
| prettier | ✅ 全量通过 |
| `openspec-cn validate perf-deepening` | ✅ 通过 |
| pytest（后端） | ✅ 112/112 通过（初测 10 例失败系公司模板缺失「本次循环问题」节，模板已于 00:33 外部更新补齐，重跑全绿） |

## 越界检查

`git diff --name-only`：本变更仅新增/修改
- `openspec/changes/perf-deepening/**`（新增）
- `frontend/src/**`（App.tsx、LogViewer.tsx、EditorArea.tsx、registry.ts、useSearch.ts、searchStore.ts、bridge_client.ts、SearchPanel.tsx、useVirtualScroll.ts、SearchResultsPanel.tsx、InspectorSummary.tsx、InspectorPanel.tsx、InspectorDock.tsx、types.ts、useDebouncedValue.ts、SkeletonRows.tsx、watchdog.ts + 验收测试）
- `vite.config.ts`（+1 行 `globals: true`，RTL 自动 cleanup 所需）

工作区中 `AGENTS.md`/`tsconfig.json`/已删除的 `engineering-foundation`/`refactor-bridge-module` 等改动为**会话前既有未提交工作**（`git stash list` 证实 WIP），非本变更产物。

## 既有失败说明（已解决，非本变更引入）

初测 `tests/unit/test_company_self_learning.py` 10 例失败：断言 `.opencode/commands/company-*.md` 模板含「本次循环问题」小节。该模板缺失与本变更零交集（未触碰任何 company 命令文件）。回归期间模板被外部流程更新补齐（新增"自学习闭环"节），重跑 **112/112 全绿**。

## 设计偏差记录（均已论证）

1. **spec 3.5 过期结果语义**：`pipelineFinished` 信号不带请求序号，字面"残留即丢弃"（`requestSeq === consumedSeq`）会误杀图层结果（图层同步同样走 pipelineFinished）。落地为：**在途搜索（requestSeq > consumedSeq）应用后 markSearchConsumed**；残留防护以既有后端 `_retire_worker` + 前端 AbortSignal 为主。spec 场景 2 已在规格阶段修正为可达保证。
2. **watchdog 模块位置**：验收测试从 `components/logViewer/` 导入 `../utils/watchdog`，契约落点在 `components/utils/watchdog.ts`（非 `src/utils/`）——以测试契约为准。
3. **FPS 接线通道**：App.tsx 不传 `performanceMetrics` 且属编排者职责，改由 LogViewer 在 debugMode 直接渲染 `<PerformanceIndicator metrics>`（任务明确许可的兜底方案）。
4. **vite.config.ts `globals: true`**：验收测试依赖 RTL 自动 cleanup（未手写 `afterEach(cleanup)`），需 vitest globals；纯增量、既有测试显式导入不受影响。
5. **types.ts**：`FileBridgeAPI.sync_all` 补可选 `signal` 参数（D6 必经基础设施，纯增量）。
6. **`searchStore.test.ts` 补 import**：验收测试引用 `isStalePipelineResult` 未导入（笔误），实现阶段补入。

## 性能红线核查

- 渲染热路径保持虚拟化 O(1)：看门狗空闲睡眠（30 稳定帧后取消 rAF）、缓存有界（LRU 500）、FPS 采集 debugMode 默认关闭
- 无热路径日志、无 `as any`/`@ts-ignore`、无遗留调试输出

## DoD 核对

- [x] OpenSpec 产出物齐全（proposal / specs×3 / design / tasks）
- [x] 验收测试先红后绿（17 fail → 85 pass，有证据）
- [x] vitest 85 + e2e 22 通过 + pytest 112/112 通过
- [x] 静态门干净（tsc 0 / lint 0 / prettier 通过）
- [x] `openspec-cn validate` 通过
- [x] 越界检查通过（仅前端 + perf-deepening 产出物；company 模板更新为外部流程，非本变更）
- [x] 无遗留调试输出

## 风险与待决策项

- **待决策（Gate 2）**：是否批准交付本变更（归档 `perf-deepening` / 合并）？
- **已知边界**：同文件多 tab 搜索隔离（session 按 file_id 互斥）未纳入本期，属既有限制；快速滚动降质/预取/自适应 buffer（useVirtualScroll 预测函数）留作二期。
- **建议后续**：二期接入快速滚动降质前先建立 FPS 基线（本期已接入 FPS 采集，基线可用）。
