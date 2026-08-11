# app-orchestration-structure 能力规范

## Purpose

定义 `frontend/src/App.tsx` 编排层的结构约束：App.tsx 保持瘦身（仅 hooks 调用、信号绑定、UI 状态与顶层 return），内聚布局 JSX 归属 `components/layout/` 专用组件，可复用的文件操作编排归属 `hooks/useFileActions.ts`，以提升可维护性与可测试性。

## Requirements

### Requirement: App.tsx 编排层瘦身

系统 SHALL 将 `frontend/src/App.tsx` 从超过 1,000 行瘦身为编排层：只保留 hooks 调用、信号绑定、UI 状态与顶层 return；布局 JSX 与可复用的操作编排归属各自专用文件。

#### Scenario: App.tsx 行数受控

- **WHEN** 完成拆分后统计 `frontend/src/App.tsx` 行数
- **THEN** 行数低于 900 行（从 1,190 行拆分，提取布局/命令/文件操作编排后）
- **AND** 文件仅包含 hooks 调用、状态声明、信号回调绑定与顶层 return

#### Scenario: 行为保持不变

- **WHEN** 拆分完成后运行现有前端测试与 e2e
- **THEN** 全部通过（无断言修改）
- **AND** 无任何交互逻辑改动

### Requirement: 布局 JSX 归属专用组件

系统 SHALL 将 App.tsx 中的内聚布局 JSX（侧栏视图切换区、右侧检视区）提取到 `frontend/src/components/layout/` 下的专用组件，各组件通过 props 接收数据与回调。

#### Scenario: 布局组件可独立渲染

- **WHEN** 导入 `components/layout/` 下的布局组件并传入 props
- **THEN** 组件可独立渲染且不直接依赖 App 内部状态
- **AND** 组件通过 props 契约接收数据（activeFile/layers 等）与回调（onOpen/onLayerRemove 等）

#### Scenario: 布局组件有冒烟测试

- **WHEN** 运行布局组件测试
- **THEN** 至少一个布局组件（如侧栏视图区或检视区）有渲染冒烟测试
- **AND** 测试验证组件在给定 props 下可挂载渲染

### Requirement: 文件操作编排归属 hooks

系统 SHALL 将 App.tsx 中可复用的文件操作编排（统一打开、编辑器内打开、激活加载）提取到 `frontend/src/hooks/useFileActions.ts`，跨组件依赖（dock 实例、文件列表、激活回调）作为参数传入。

#### Scenario: 文件操作钩子可复用

- **WHEN** `useFileActions` 被 App.tsx 调用并传入依赖
- **THEN** 返回 handleOpen/openFileInEditor/handleFileActivateWithLoad 等函数
- **AND** 函数行为与提取前一致（dock 面板创建/激活、统一打开流程不变）
