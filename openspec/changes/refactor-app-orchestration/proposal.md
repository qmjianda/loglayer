## Why

`frontend/src/App.tsx` 已达 1,190 行，混合了多种关注点：hooks 调用编排、桥接层信号回调（~100 行）、文件/远程打开逻辑、dockview 面板管理、大量 UI 状态、以及 ~500 行 JSX 布局。文件越大，改动回归风险越高、并行开发越困难、测试越难写。探索阶段（Q3=A）已确认这是下一个可维护性痛点的核心。

## What Changes

- **提取 JSX 布局为子组件**：将 App.tsx 中的 dockview 布局、工具栏、状态栏等 JSX 区块提取到 `frontend/src/components/layout/` 下的专用组件（如 `DockLayout.tsx`、`AppToolbar.tsx`），App.tsx 保留编排与状态。
- **提取文件操作编排为 hooks**：将 `handleOpen`、`openFileInEditor`、`handleFileActivateWithLoad` 等纯编排逻辑提取到 `frontend/src/hooks/useFileActions.ts`，接收跨组件依赖作为参数。
- **App.tsx 瘦身为编排层**：目标从 1,190 行降至 ~600 行，只保留 hooks 调用、信号绑定、状态与顶层 return。
- **纯搬移不改行为**：本次为结构重构，不修改任何交互逻辑、API 契约或渲染结果。

## Capabilities

### New Capabilities
- `app-orchestration-structure`: 定义前端根组件（App.tsx）的物理组织规则——编排层只负责状态与 hooks 绑定，布局 JSX 归属 `components/layout/`，可复用的操作编排归属 `hooks/`，组件行数警戒线。

### Modified Capabilities

（无既有能力的行为需求发生变化——纯结构重构，spec 层面行为不变。）

## Impact

- **修改**：`frontend/src/App.tsx`（瘦身）、新增 `frontend/src/components/layout/`（布局子组件）、新增 `frontend/src/hooks/useFileActions.ts`（文件操作编排）。
- **测试**：现有 54 个 vitest 测试 + 6 个 e2e 作为回归基线；新增组件冒烟测试（布局组件可渲染）。
- **不改动**：任何交互行为、REST/WS 接口、后端逻辑、渲染结果。
- **风险**：dockview 的 `dockApiRef` 跨组件传递需理顺；JSX 提取时 props 接口设计需保证行为一致。
