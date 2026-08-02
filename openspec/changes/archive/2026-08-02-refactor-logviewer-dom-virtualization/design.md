# Design: LogViewer DOM 虚拟化重构

## Context

当前 `LogViewer.tsx`（977 行）以手写 HTML5 Canvas 渲染日志行：`readProcessedLines` 按需拉取行数据到前端缓存窗口，`draw()` 每帧全量重绘可见区。这套实现因"用像素数学模拟浏览器原生能力"产生了系统性缺陷：

- **文本选择/复制不稳定**：手算 `charIndex`、自拼 `selectedText`、window 级事件监听
- **中文选中拆字**：假设等宽字符 `charWidthRef`，中文宽度不同导致光标定位错位
- **高亮与文字错位**：`fillRect` 用 `+2px` 魔法数对齐 baseline
- **行号随水平滚动**：canvas 整体 `translate3d`，gutter 未抵消 scrollLeft
- **字体大小导致行异常**：`charWidthRef` 仅在 mount 测量一次，改字号后不更新

现有约束：
- 后端 bridge 提供 `read_processed_lines(fileId, start, count)`，前端持有缓存窗口（`bridgedLines: Map<number, LogLine>`）
- 面板容器为 dockview 分屏（`EditorArea.tsx`），每个文件一个 `logViewer` 面板
- 亿行需求：浏览器滚动容器最大高度约 3355 万 px，1 亿行 × 20px = 20 亿 px 超限 60 倍；且拖动滚动条时后端逐行跑图层管线（`process_line`/`highlight_line`/搜索正则）产生延迟，当前表现为"拖动期间空白，停下才有文本"

## Goals / Non-Goals

**Goals:**
- 以 DOM 虚拟化替代手写 canvas，只渲染可见 ~100 行
- 获得浏览器原生的文本选择、复制、双击选词、中文字形宽度、字体缩放能力
- 行号侧边栏固定不随水平滚动
- 高亮/图层/书签以 CSS 实现，与文字精确对齐
- 支持固定行高（水平滚动）与动态行高（wordWrap）双模式
- 支撑 GB 级（数千万至亿行）日志，滚动定位精度与总行数解耦
- 快速滚动时渲染占位行，消除"拖动白屏"体验
- 保留现有按需拉取数据流（缓存窗口 + 滚动触发拉取）

**Non-Goals:**
- 不改变后端 bridge 的 `read_processed_lines` API 契约、图层管线、dockview 分屏容器、书签/搜索/设置的数据流
- 不引入日志分组展示（`GroupedVirtuoso` groupCounts）——列为后续独立变更（依赖分组元数据方案）
- 不做行懒加载的缓存预取调优（如动态预取窗口）——基础缓存窗口本次交付，预取策略列为后续优化

## Decisions

### D1: 渲染内核选用 react-virtuoso（而非 virtua / @tanstack/virtual / glide-data-grid / CodeMirror）

| 方案 | 结论 | 理由 |
|------|------|------|
| **react-virtuoso** | ✅ 选定 | `customScrollParent` 匹配 dockview 面板容器；`totalCount` + `rangeChanged` 完美对接按需拉取；固定/动态行高均原生支持；社区最大、文档最全、维护活跃（2026-07）、MIT、React 19 兼容 |
| virtua | ⚪ 次选 | 更小（3kB）、更快，但文档与社区规模较小，无 `totalCount` 语义，需自建懒加载桥 |
| @tanstack/virtual | ⚪ 备选 | headless 最灵活，但需手写全部行渲染样板，无 `customScrollParent` 语义，接入成本高 |
| glide-data-grid | ❌ 排除 | 数据网格（表格）语义，日志单列文本别扭；仍是 canvas，交互通病未解 |
| CodeMirror 6 | ❌ 排除 | 编辑器文档模型要求全文在内存，与"后端按需拉取"冲突；只读日志是反常规用法 |

**替代方案考量**：react-virtuoso 内部已含滚动容器与行位置计算，比自研 canvas 大幅减少"滚动数学"。其动态行高测量（ResizeObserver）在 wordWrap 模式自动工作。

### D2: 行渲染自研 `LogRow` 组件，而非使用开源日志行渲染器

后续功能（折叠、JSON 展开、图层、时间线）需要完全掌控行 DOM。因此虚拟化外壳用开源组件，行内容用自研 React 组件：
- 内容文本、`highlights` 分段着色（搜索/图层）、`rowStyle` 背景、书签指示全部由 `LogRow` 渲染
- 保持现有 `LogLine` 数据模型不变，桥接层无需改动

### D3: 亿行滚动定位——分段/行高估算替代线性压缩

DOM 虚拟化同样面对"浏览器滚动高度上限"。现有 `useScrollScaling` 线性压缩在千万行可用，但亿行时每行物理高度 <0.001px，滚动条定位精度急剧劣化。采用：

- **固定行高模式（默认）**：行高已知，滚动条高度按 `totalCount × lineHeight` 映射，配合 **`scrollToIndex` 精确二分定位**，将"滚动位置 ↔ 逻辑行"换算与总高度解耦，精度 O(log n)
- **wordWrap 动态行高模式**：virtuoso 自动逐行测量；行高缓存按需维护
- 保留现有 `VIRTUAL_HEIGHT_LIMIT` 作为物理高度压缩上限，但定位不再依赖线性比例

**待实现验证**：virtuoso 在虚拟高度容器下的 `scrollToIndex` 精度表现；必要时引入分段滚动（`scrollMargin`，每段固定行数）作为兜底。

### D4: 拖动白屏修复——scrollSeek 占位 + 后端缓存

拖动白屏的根因是后端对每行同步执行图层管线（`process_line`/`highlight_line`/搜索正则），新区域行未算完时前端无数据可画。两级修复：

- **前端**：virtuoso `scrollSeekConfiguration` + `ScrollSeekPlaceholder`——滚动速度超过阈值（如 200px/s）时渲染占位行（行号 + 骨架条），`velocity < 30px/s` 退出占位，拉取完成渲染真实行。拖动期间位置/行号即时可见，不空白
- **后端**：扩大 `rendering_cache`（当前 LRU 5000）或对超大文件采用"先返回纯文本行、异步补高亮"的分层响应

### D5: 双模式行高

- **水平滚动模式（默认）**：固定行高，`defaultItemHeight` + `white-space: nowrap`，外层容器横向滚动
- **自动换行模式**：动态行高，virtuoso 自动测量，`wordWrap` 切换时清空行高缓存
- 与现有 `settings.wordWrap` 打通

### D5: 双模式行高

- **水平滚动模式（默认）**：固定行高，`defaultItemHeight` + `white-space: nowrap`，外层容器横向滚动
- **自动换行模式**：动态行高，virtuoso 自动测量，`wordWrap` 切换时清空行高缓存
- 与现有 `settings.wordWrap` 打通

### D6: 行号 gutter 独立 sticky 列

行号列不再绘制于 canvas 内，改为虚拟化容器左侧的独立 sticky 列，与行内容垂直对齐，天然不随水平滚动移动。行号生成基于当前可见行区间。

### D7: 数据拉取挂到 rangeChanged

现有 `bridgedLines` 缓存窗口与 fetch 去重逻辑保留，将触发点从"canvas 的 startIndex/endIndex 计算"迁移到 virtuoso 的 `rangeChanged` 回调，保持对 `readProcessedLines` 的既有调用契约。

### D8: 日志分组展示（后续独立变更，不在本次实现）

`GroupedVirtuoso` + `groupCounts` + `groupContent` 支持按级别/时间片/来源分组，组头 sticky 吸顶。本次**不实现**，因依赖"每行属于哪个组"的元数据方案（后端算 vs 前端算），需单独提案。

## Risks / Trade-offs

- [亿行滚动定位精度] → 固定行高下用 `scrollToIndex` 二分定位，与总高度解耦；必要时引入分段滚动兜底；e2e 用大文件（2290 万行）回归验证
- [wordWrap 动态行高在亿行下的测量开销] → 仅在开启 wordWrap 时启用动态测量；默认固定行高；行高按 `defaultItemHeight` 预估
- [拖动白屏在占位模式下的残留] → 占位行只显示行号/骨架；若图层处理仍慢，评估后端分层响应（先纯文本后补高亮）
- [e2e 测试破坏] → 重写 `tests/e2e/test_large_file_rendering.py` 与 `helpers.collect_canvas_state`，改为断言 DOM 结构（可见行数、aria-label、gutter 固定性）
- [dockview 分屏多面板] → 每个面板独立 Virtuoso 实例；用 `customScrollParent` 绑定各自面板容器；验证面板切换时滚动位置保持
- [字体缩放后行高缓存失效] → 修改 `fontSize`/`lineHeight` 时强制重建 Virtuoso（`key` 变更）或清空缓存，确保重新测量
- [引入新依赖] → react-virtuoso 体积 ~15kB gzip、MIT、零传递依赖，风险低

## Migration Plan

1. 引入 `react-virtuoso` 依赖
2. 新建 `LogRow` 行渲染组件（先并行实现，不改动现有 LogViewer）
3. 重构 `LogViewer.tsx` 渲染路径为 Virtuoso + `LogRow`，保留按需拉取与滚动缩放
4. 重写 e2e 测试断言（canvas → DOM）
5. 手动验证：千万行文件滚动、中文选择、字体缩放、gutter 固定、wordWrap 双模式
6. 回滚：保留 git 历史，LogViewer 单文件重构可整体 revert

## Open Questions

- virtuoso 在滚动缩放容器下的 `scrollToIndex` 精度表现（需在实现中验证，必要时引入分段滚动）
- 动态行高模式下亿行的实际测量开销（若超标，wordWrap 默认固定行高压缩）
- 后端 `rendering_cache` 扩大 vs 分层响应（先纯文本后补高亮）的选择（影响拖动白屏缓解程度）
- `useVirtualScroll`/`useCanvasRender`/`useSelection` 废案 hook 是否清理（倾向复用其滚动预测思路或删除）
