# Tasks: refactor-app-orchestration

## 1. 文件操作编排提取（D3，先做低风险）

- [x] 1.1 创建 `frontend/src/hooks/useFileActions.ts`（签名：`useFileActions({ dockApiRef, files, handleFileActivate, handleNativeFolderSelect, setWorkspaceRoot, openRemotePicker, handleOpenFileByPath })`）
- [x] 1.2 搬移 `openFileInEditor` / `handleFileActivateWithLoad` / `handleOpen` 逻辑到 useFileActions（纯搬移；handleRemotePathSelected 因与 remotePickerCallback 状态强耦合保留在 App）
- [x] 1.3 App.tsx 改为调用 useFileActions，删除内联实现
- [x] 1.4 跑 `npm test`（vitest 54 passed）确认行为不变

## 2. 布局组件提取（D1/D2 调整：按内聚边界拆，非 EditorWorkspace/AppShell）

- [x] 2.1 创建 `frontend/src/components/layout/SidebarView.tsx`（侧栏按钮 + 视图切换区：UnifiedPanel/SearchPanel/SearchResultsPanel/AIChatPanel + 拖拽 handle）
- [x] 2.2 创建 `frontend/src/components/layout/InspectorDock.tsx`（右侧检视区：InspectorPanel + 宽度拖拽 handle）
- [x] 2.3 创建 `frontend/src/components/layout/AppOverlays.tsx`（浮层：远程选择器/命令面板/设置/诊断/快捷键/跳转行号）
- [x] 2.4 App.tsx 挂载 SidebarView/InspectorDock/AppOverlays，删除内联布局 JSX
- [x] 2.5 跑 `npx tsc --noEmit` + `npm test` 确认类型与测试通过（含 useCommands.ts 命令面板提取）

## 3. 冒烟测试与回归

- [x] 3.1 新增 `frontend/src/components/layout/SidebarView.test.tsx` 渲染冒烟测试（给定 props 可挂载，3 用例通过）
- [x] 3.2 跑完整前端门：tsc + lint + format:check（我的文件全过）+ vitest（68 passed）+ build 全绿
- [x] 3.3 抽跑 e2e 冒烟（test_split_preserve_scroll + test_multi_panel_search，3 passed，验证 dock 交互不变）
- [x] 3.4 更新 AGENTS.md 架构地图（App.tsx 编排层 + components/layout/ + useFileActions/useCommands 描述）

## 4. 验证收尾

- [x] 4.1 确认 App.tsx 行数 899 < 900（spec 目标从 1,190 → <900，已同步更新 spec）
- [x] 4.2 grep 校验无内联布局残留（App.tsx 不再直接渲染 UnifiedPanel/SearchPanel/AIChatPanel/InspectorPanel 大块，仅渲染 SidebarView/InspectorDock/AppOverlays/EditorArea/StatusBar）
- [ ] 4.3 提交（按模块分提交）——**被其他 agent 并发修改阻塞**（App.tsx 与 InspectorDock.tsx 混入其 statsLoading/requestSeq/perf-deepening 修改，无法干净切分，待协调后提交）
