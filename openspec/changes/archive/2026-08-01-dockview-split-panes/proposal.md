## Why

当前分屏为自研实现（`useFileManagement` 维护扁平 `Pane[]` 数组 + App.tsx 内 `panes.map` 渲染 flex 布局），缺少拖拽分屏、嵌套分屏、分割线调整、布局持久化等能力，且每新增功能都需自研维护，bug 多、演进成本高。loglayer_ps 已用成熟开源组件 dockview 实现完整分屏（拖拽、嵌套、布局序列化、面板 params 传参），方案验证成熟。目标：完全替换自研分屏，用 dockview 承载分屏与面板生命周期。

## What Changes

- 引入 `dockview` 依赖，用 `DockviewReact` 替换 App.tsx 中 `panes.map` 的 flex 分屏渲染
- **BREAKING** 移除 `useFileManagement` 中的 `panes`/`activePaneId` 自研状态；`activeFileId` 改由 dockview `onDidActiveChange` 驱动
- 新建 `EditorArea` 组件（dockview 容器），注册 `logViewer` 面板组件，通过面板 `params` 传递 `fileId`/`uri`
- `logViewer` 面板渲染现有 `LogViewer` 组件（保留不替换），并绑定面板激活/关闭生命周期
- 布局持久化到 localStorage（dockview `toJSON`/`fromJSON`）
- 现有命令面板、文件树点击、拖放打开等入口改为通过 dockview API 打开面板

## Capabilities

### New Capabilities
- `dockview-split`: 基于 dockview 的分屏与面板生命周期管理，支持拖拽分屏、嵌套、布局持久化

### Modified Capabilities
<!-- 若修改现有行为 -->

## Impact

- `frontend/package.json`: 新增 `dockview` 依赖
- `frontend/src/hooks/useFileManagement.ts`: 移除 panes/activePaneId 状态；activeFileId 由外部驱动
- `frontend/src/App.tsx`: 渲染区替换为 EditorArea；迁移命令/快捷键/文件打开入口
- `frontend/src/components/LogViewer.tsx`: **不改动**（保留现有实现）
- 新增 `frontend/src/components/EditorArea.tsx`、面板组件
- `frontend/src/bridge_client.ts`: 不改动
