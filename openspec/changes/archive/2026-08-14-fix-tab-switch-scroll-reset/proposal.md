# Proposal: fix-tab-switch-scroll-reset

## Why

切 tab / 分屏切 tab 时，日志视图的滚动位置会归零（跳回首行）。根因（已由源码 + 运行时日志证实）：dockview 默认渲染策略 `onlyWhenVisible` 在切 tab 时对失活面板执行 `element.remove()`（把内容 DOM 移出文档树），重新激活时 `appendChild` 插回；而 `removeChild` 会销毁滚动布局导致 `scrollTop` 归零，且全程不触发 scroll 事件（静默）。此前的「滚动位置看门狗」（`render-throttling` 的「滚动位置保持」requirement）是逐帧检测 DOM 归零并拉回的治标补丁——它在失活期间对隐藏元素拉回无效，激活后又被切 tab 冗余 `syncAll` 触发的污染性 scroll 事件打断，从未根治。

## What Changes

- 将 dockview 渲染策略从默认 `onlyWhenVisible` 改为 `always`（`<DockviewReact defaultRenderer="always">`）：失活面板不再从 DOM 移除，改用 `visibility:hidden` 隐藏，`scrollTop` 原生保持。
- 移除已失效的滚动位置看门狗：`LogViewer.tsx` 中逐帧检测「DOM 归零但 state>0」并拉回的 rAF 循环，以及为防看门狗误判而同步 `scrollStateRef` 的配套逻辑（`onScroll` 同步、`scrollToIndex` 同步、文件切换恢复流程中的 ref 断言）。

## Capabilities

### New Capabilities

（无 —— 本变更为修复既有行为，不引入新能力。）

### Modified Capabilities

- `render-throttling`: 「滚动位置保持」requirement 的机制从「常驻逐帧看门狗拉回」改为「dockview `always` 渲染策略使滚动位置原生保持」，移除看门狗相关场景（常驻逐帧检测、用户滚顶/程序化跳顶不被误干预、外部归零不被延迟恢复）。

## Impact

- **前端**：`frontend/src/components/EditorArea.tsx`（`defaultRenderer="always"`）、`frontend/src/components/LogViewer.tsx`（移除看门狗 rAF 循环与 `scrollStateRef` 同步逻辑）。
- **无后端改动、无 REST/WS 变更、无依赖变更。**
- **行为边界**：`always` 模式下失活面板内容常驻 DOM（用 `visibility:hidden` 隐藏），内存占用略增（仅失活面板的窗口内 DOM 节点，非全量内容）；dockview 官方注释记录的已知限制——`always` 下拖拽移动面板后内容可能不显示——需在验收中覆盖（本项目实测未复现）。
- **测试**：`render-throttling` 原看门狗单测无独立文件（当前无覆盖）；需在 ATDD 阶段新增「切 tab / 分屏切 tab 后滚动位置保持」的验收测试（e2e 或组件级），并清理原看门狗相关规格场景。
