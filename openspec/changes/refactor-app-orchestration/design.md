## Context

`frontend/src/App.tsx` 达 1,190 行，混合五个关注点：hooks 调用编排、桥接层信号回调（onFileLoaded/onPipelineFinished 等 ~100 行）、文件/远程打开逻辑、dockview 面板管理（openFileInEditor）、~500 行 JSX 布局（dockview 主区 + 检视区 + 状态栏 + 浮层）。

探索阶段（Q3=A）原定"轻度：逻辑吸收入现有 hooks"。grill-me 评审发现：`openFileInEditor` 依赖 `dockApiRef`（dockview 实例）+ `files` + `handleFileActivate`，`handleOpen` 依赖 `hasNativeDialogs` + `remotePathPicker` + `setWorkspaceRoot`——跨组件状态依赖链深，直接搬进 hooks 需传 5+ 参数反而更乱。且"右检视面板之后再做 B"的前置条件（add-right-inspector-panel 变更）已归档消除。

**评审调整**：从"纯 A"升级为"A+B 轻度版"——布局 JSX 提取子组件 + 纯编排逻辑提取 hooks。

约束：
- 纯搬移不改行为（spec 锁定）。
- 现有 54 vitest + 6 e2e 作为回归基线。
- dockview 的 `dockApiRef` 是跨组件关键依赖，提取时需保持引用共享。

## Goals / Non-Goals

**Goals:**
- App.tsx 从 1,190 行降至 <700 行。
- 布局 JSX → `components/layout/` 子组件（props 契约接收数据与回调）。
- 文件操作编排 → `hooks/useFileActions.ts`（依赖作参数）。
- 布局组件冒烟测试。

**Non-Goals:**
- 不拆分桥接信号回调区（其逻辑与 App 状态耦合深，拆分收益低）。
- 不改任何交互行为、渲染结果、API 契约。
- 不做后端或 store 层改动。

## Decisions

### D1: 布局提取为 2 个组件 + 保持浮层在 App

**决策**：

```
frontend/src/components/layout/
├── EditorWorkspace.tsx   → dockview 主编辑器区（UnifiedPanel + InspectorPanel + 拖拽 handle）
└── AppShell.tsx          → 顶层壳（含 StatusBar + 浮层渲染槽）
```

App.tsx 顶层 return 保留 `<div className="h-screen flex flex-col">` 壳 + 挂载 AppShell/EditorWorkspace + 浮层（CommandPalette/SettingsPanel/DebugOverlay 等）。

**备选考虑**：
- *全部 JSX 提出（含浮层）*：浮层状态（isXxxVisible）由 App 管理，提出需大量 props 透传，收益低，排除。
- *拆 5+ 小组件*：粒度太碎，props 爆炸，排除。

**理由**：2 个布局组件是"收益/复杂度"平衡点；浮层状态留在 App 最自然。

### D2: 布局按"内聚边界"拆分，dockview 区留在 App

**决策**：不一次性提取 dockview 主区（实测耦合 52 个 App 符号，props 爆炸）。改为两个内聚子组件：

```
frontend/src/components/layout/
├── SidebarView.tsx   → Sidebar + 视图切换区（main/search/ai/help，~180 行）
└── InspectorDock.tsx → 右侧检视区（InspectorPanel + 拖拽 handle，~83 行）
```

dockview 主编辑器区（EditorArea，42 行 props 密集但逻辑薄，props 多为透传）**留在 App**——提取仅转移复杂度无净收益。

**备选考虑**：
- *EditorWorkspace 承载 dockview + 检视区*：52 个 props，复杂度转移非消除，排除。
- *全布局提取*：含视图切换，props 也超 40，排除。

**理由**：按"内聚性"而非"JSX 大小"拆——SidebarView（视图状态自洽）与 InspectorDock（检视状态自洽）是真正的内聚单元；dockview 区是透传层，保留在 App 最自然。

### D3: useFileActions 承载打开编排

**决策**：`useFileActions({ dockApiRef, files, handleFileActivate, hasNativeDialogs, remotePathPicker, setWorkspaceRoot, addNewFiles })` 返回 `{ handleOpen, openFileInEditor, handleFileActivateWithLoad, handleRemotePathSelected }`。

**备选考虑**：
- *逻辑留在 App*：不解决行数问题，排除。
- *拆进现有 useFileManagement*：useFileManagement 已有 355 行，且其定位是文件状态管理而非 dock 编排，混合职责，排除。

**理由**：独立 hook 承载"操作编排"关注点，与 useFileManagement（状态管理）职责分离。

### D4: 拆分顺序——先 hooks 后布局

**决策**：先提取 `useFileActions`（纯逻辑，无渲染影响，风险最低），跑测试确认绿；再提取 `EditorWorkspace`/`AppShell`（JSX 搬移），跑测试 + e2e 确认渲染一致。

**备选考虑**：
- *先布局后 hooks*：布局搬移涉及 JSX 细节，先做风险高的不合算，排除。

**理由**：先低风险后高风险，每步可验证、可回退。

## Risks / Trade-offs

- **[dockApiRef 跨组件引用断裂] → Mitigation**：`dockApiRef` 在 App 创建（useRef），以参数传入 useFileActions 与 EditorWorkspace 的 onApiReady 回调；提取后仍共享同一 ref 对象。
- **[props 契约遗漏导致渲染差异] → Mitigation**：提取时逐 prop 对照原 JSX；e2e（split_preserve_scroll/multi_panel_search）验证交互不变。
- **[布局组件行数过大] → Mitigation**：EditorWorkspace 可能达 400+ 行（含 InspectorPanel 拖拽逻辑），可后续再拆；本次以"App 瘦身"为验收标准，不追求组件也 <250 行。
- **[useFileActions 依赖参数过多] → Mitigation**：接受 5-8 个参数（均为跨组件依赖），hook 内部保持纯编排逻辑；若后续膨胀再评估 context。

## Migration Plan

1. 提取 `useFileActions.ts`（纯搬移 handleOpen/openFileInEditor 等），跑 vitest 确认绿。
2. 提取 `EditorWorkspace.tsx`（dockview + 检视区 JSX），App.tsx 挂载，跑 vitest + 抽 e2e。
3. 提取 `AppShell.tsx`（顶层壳 + StatusBar），跑 vitest。
4. 布局组件冒烟测试（EditorWorkspace 渲染）。
5. 全量回归：tsc + lint + format + vitest + build + 相关 e2e。
6. 更新 AGENTS.md 架构地图（App.tsx 描述）。

## Open Questions

- EditorWorkspace 的 props 数量可能达 15+（数据 + 回调），是否值得先合并为分组 props（如 `files`/`layers`/`callbacks` 对象）？倾向先平铺、超 20 再分组。
