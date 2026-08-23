# fix-ctrl-g-duplicate-widget 提案

## Why

Ctrl+G 存在两套互不知情的全局 keydown 监听（`useUIState.ts` 的 App 级处理与 `LogViewer.tsx` 的组件级处理），一次按键会同时打开两个"跳转到行"输入框。更严重的是，LogViewer 内部的 widget 以 `absolute top-0` 渲染在滚动容器**内部**，其 autofocus 触发浏览器 scroll-into-view，把滚动容器拉回顶部——用户按 Ctrl+G 后文件意外跳到第 0 行位置，丢失当前浏览位置。

## What Changes

- 移除 `LogViewer.tsx` 内部的 Ctrl+G 监听与本地 `showGoToLine` state 及其内嵌的 `EditorGoToLineWidget`，跳转框收敛为 App 级单例（AppOverlays 渲染的那一个）。
- App 级 widget 定位改为不参与滚动容器内容流（`fixed` 或 portal 到 body），杜绝 autofocus 引发的 scroll-into-view 滚动。
- 全局 Ctrl+G 处理增加守卫：跳转框已打开时忽略重复触发（或聚焦已有输入框）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `jump-navigation`: 新增需求——Ctrl+G SHALL 只打开唯一的"跳转到行"输入框；打开跳转框及输入焦点变化 SHALL NOT 改变日志视图当前滚动位置。

## Impact

- **前端**：`frontend/src/components/LogViewer.tsx`（删除本地 Ctrl+G 分支、`showGoToLine` state、内嵌 widget JSX）；`frontend/src/hooks/useUIState.ts`（Ctrl+G 守卫）；`frontend/src/components/layout/AppOverlays.tsx`（widget 容器定位方式确认/调整）。
- **行为**：Ctrl+G 从"弹两个框 + 跳回顶部"变为"弹唯一框、滚动位置不动"；Enter 跳转逻辑不变（仍走 `onLineClick` + `scrollToLine` 链路）。
- **无后端改动、无 API 变化。**
