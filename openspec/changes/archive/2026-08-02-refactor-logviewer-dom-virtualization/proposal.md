## Why

当前 `LogViewer` 是 977 行手写 Canvas 渲染（`frontend/src/components/LogViewer.tsx`），通过像素数学模拟浏览器原生已免费提供的文本能力，导致一系列稳定性与交互缺陷：文本选择/复制不稳定、中文字符选中拆字、高亮区域与文字错位（`+2px` 魔法数）、行号侧边栏随水平滚动进入内容区、修改字体大小后行显示异常。这些问题的共同根因是"用 canvas 手写渲染"本身——canvas 缺乏浏览器原生的文本布局、选区、复制与无障碍能力。

## What Changes

- 用开源的 **react-virtuoso**（MIT）虚拟列表替换手写 canvas 渲染内核，作为虚拟化外壳（只渲染可见 ~100 行 DOM）
- 自研 `LogRow` 行渲染组件（高亮/图层/书签/JSON 展示全部自己实现），保留最大后续定制空间
- 行内容渲染从 `ctx.fillText` 改为原生 DOM 文本，获得原生选择、复制、双击选词、中文字形宽度与字体缩放能力
- 行号侧边栏（gutter）改为独立 sticky 列，不再随水平滚动进入内容区
- 高亮（搜索/图层 `highlights`）改为 CSS `background-color`/`color` 实现，与文字自动对齐
- 支撑 GB 级日志文件（数千万至亿行）：滚动方案升级为分段/行高估算，突破线性压缩在亿行下的定位精度瓶颈
- 修复"拖动滚动条白屏"：快速滚动时经 virtuoso `scrollSeek` 渲染占位行（行号 + 骨架），停止后渲染真实行；配合后端行缓存增强
- 保留并复用现有按需拉取数据流（`readProcessedLines` + 前端缓存窗口），改挂到 virtuoso 的 `rangeChanged` 回调
- 支持固定行高（水平滚动）与动态行高（wordWrap 自动换行）两种显示模式，可通过设置切换
- **BREAKING**: 移除手写 canvas 渲染路径及 `useVirtualScroll`/`useCanvasRender`/`useSelection` 未使用 hook 的依赖
- **BREAKING**: 重写依赖 canvas 内部结构的 e2e 测试（`tests/e2e/test_large_file_rendering.py` 的 `collect_canvas_state` 等）

## Capabilities

### New Capabilities
- `log-viewer-rendering`: 日志查看区域的行渲染能力——DOM 虚拟化渲染（千万至亿行）、行号 gutter、原生文本交互（选择/复制/双击选词）、搜索与图层高亮、书签标记、字体缩放与自动换行、快速滚动占位渲染。
- `log-viewer-lazy-loading`: 日志行的按需拉取与预取——前端缓存窗口、滚动触发拉取、快速滚动占位显示，保证滚动体验不空白。

### Modified Capabilities
<!-- 无。现有 dockview-split 仅覆盖分屏容器，其面板渲染契约（fileId/uri 经 params 传递）不变。 -->

## Impact

- **前端组件**：`frontend/src/components/LogViewer.tsx`（重构）、`EditorArea.tsx`（面板参数透传）、`hooks/useVirtualScroll.ts`、`hooks/useCanvasRender.ts`、`hooks/useSelection.ts`（废案清理或复用）
- **新增依赖**：`react-virtuoso`（^4.x，MIT）
- **后端**：`backend/bridge.py` `read_processed_lines` 的行缓存增强（可选，缓解拖动白屏）
- **主题/常量**：`theme.ts`（`getLogViewerColors` 语义保持）、`constants.ts`（`LOG_VIEWER` 部分常量需调整）
- **e2e 测试**：`tests/e2e/test_large_file_rendering.py` 及 `helpers.py` 的 canvas 断言需重写
- **不受影响**：后端 bridge 的 `read_processed_lines` API 契约、图层管线、dockview 分屏容器、书签/搜索/设置的数据流
