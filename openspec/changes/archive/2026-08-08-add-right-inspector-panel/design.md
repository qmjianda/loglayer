# Design: 新增右侧操作台（Right Inspector Panel）

## Context

当前布局（`frontend/src/App.tsx`）：顶栏 → 主区域（`flex-1 flex`）= `Sidebar` 图标栏 + 左侧面板（`width: sidebarWidth`，按 `activeView` 切换 `UnifiedPanel`/`SearchPanel`/`AIChatPanel`/`StatsPanel`）+ 中央区（`EditorArea` dockview 分屏）→ 底栏。

左侧 `UnifiedPanel`（`SectionId = 'openFiles' | 'explorer' | 'presets'`）承载五类内容：已打开文件树（每文件内嵌 `LayersPanel` 与书签列表）、历史文件、资源管理器、预设——288px 面板内信息密度过高。书签/图层等"当前文件操作"与文件导航混排。

已有可复用资产：
- `useLayerManagement`（App.tsx 单例）已管理 `layers`/`presets`/`handleSavePreset`/`saveStatus`/`undo`/`redo`（预设持久化于 localStorage，不变）
- `useBookmarks(activeFileId)` 已管理书签+预览（每次切文件重新 fetch，`getBookmarks` + `getLinesByIndices`）
- `logLevelStats` 已在 App.tsx 按 `activeFileId` 拉取
- `activeFileId` 由 dockview `onDidActivePanelChange` 驱动（分屏时=最后激活的 pane，满足"跟随点击的 pane"需求）

目标布局：`[Sidebar][左侧面板(导航)][中央 dockview][右侧操作台(当前文件)]`。已通过 `demo/layout-demo.html` 交互原型验证。

## Goals / Non-Goals

**Goals:**
- 新增右侧操作台：随 `activeFileId` 切换，五区 = 文件属性摘要（固定）/ 图层（默认展开）/ 预设（默认折叠）/ 书签（默认折叠）/ 统计（占位）
- 书签 per-file 前端缓存，切 tab 无闪烁
- 左侧回归纯导航：资源管理器 + 历史文件；删除已打开文件树与独立 stats 视图
- 左右两侧独立折叠、记忆宽度；右侧默认 300px 可拖 200–480px

**Non-Goals:**
- 统计区内容（第二版）、时间范围摘要（第二版）
- 图层引擎/后端管线改动（后端零改动）
- 右侧栏多视图切换器（固定为操作台，不做第二个 activeView 机制）
- 预设持久化模型改造（沿用 localStorage）

## Decisions

### D1. 布局骨架：右侧栏挂主区域 flex 末尾，与左侧对称

`App.tsx` 主区域（775 行 `flex-1 flex overflow-hidden`）内追加右侧节点：
`[Sidebar][左侧面板][中央 flex-1][<InspectorPanel />]`

- 备选 A：把操作台做成 dockview 面板 → 污染编辑器布局持久化（`kv['layout']`），分屏关闭/移动会误伤，否决。
- 备选 B：主区域外全高独立容器 → 与 StatusBar 相对位置复杂化，且失去与左侧的视觉对称，否决。

### D2. 宽度与折叠状态：扩展 `useUIState`（与 `sidebarWidth` 同模式）

- 新增 `inspectorWidth`（默认 300）与 `setInspectorWidth`；折叠 = 置 0，恢复 = 记忆值。
- 拖拽手柄复用左侧面板现有 mousedown 逻辑（200–480 clamp）；折叠按钮置于顶栏右端，与左端 `onToggleSidebar` 对称。
- 备选：App.tsx 本地 `useState` → 与现有 `sidebarWidth` 分散管理，否决。放 `useUIState` 保持一致性与可测试性。

### D3. 数据流：InspectorPanel 为受控组件，props 由 App.tsx 注入（与 UnifiedPanel 同源）

`InspectorPanel` 不自行调用数据 hooks，全部 props 来自 App.tsx：`activeFile`、`layers`、`selectedLayerId`、`updateLayers`/`addLayer`/`handleDrop`、`undo`/`redo`、`presets`/`setPresets`/`handleSavePreset`/`saveStatus`、`bookmarks`/`bookmarkPreviews`/`handleToggleBookmark`/`handleUpdateBookmarkComment`/`handleClearBookmarks`/`handleJumpToBookmark`、`logLevelStats`、`applyPreset`。

- 理由：`useLayerManagement` 在 App.tsx 实例化一次即单一真相源；右侧再自调 hook 会产生双实例、状态分叉。
- 备选：InspectorPanel 内部自调 `useBookmarks(activeFileId)` → 与左侧历史遗留不一致，且书签缓存需跨实例共享（见 D5 模块级缓存），否决。

### D4. 组件划分：LayersPanel 原样复用，书签抽组件

| 组件（新增） | 职责 |
|:--|:--|
| `InspectorPanel.tsx` | 右侧栏容器：宽度/折叠/拖拽手柄/滚动容器，组装五个区 |
| `InspectorSummary.tsx` | 文件属性摘要：路径复制、大小、总行数、级别分布堆叠条（数据 `activeFile` + `logLevelStats`） |
| （复用）`LayersPanel.tsx` | 图层区原样迁入（props 不变），**DOM 结构/类名不变**以保护测试；头部追加"保存为预设"按钮 |
| `InspectorPresets.tsx` | 预设区：列表（名称/来源/应用/删除）+ 保存命名浮层，应用走 `applyPreset` 合并语义 |
| `InspectorBookmarks.tsx` | 书签列表：从 UnifiedPanel 内联代码抽出（跳转/删除/注释/数量徽标） |
| （占位）统计区 | 折叠区 + "统计信息（第二版迭代）"文案 |

- 理由：LayersPanel 完整复用避免重复实现；书签/预设目前是 UnifiedPanel 内联 JSX，迁出需组件化。

### D5. 书签 per-file 前端缓存（仿 processedCache 模式）

- `useBookmarks.ts` 内新增**模块级** `Map<fileId, { bookmarks, previews }>`（跨 hook 实例共享）。
- 切换 `activeFileId`：命中缓存 → 立即渲染缓存值（同步返回），同时后台 fetch 刷新后覆盖；未命中 → fetch 后入缓存。
- 失效：`toggleBookmark` 成功 / `clear` 后同步写回缓存；`fileLoaded`（重新索引）时删除该 fileId 条目。
- 备选：不做缓存 → 分屏快速切换反复"清空→加载中→显示"，违背 grilling 定稿的零闪烁要求，否决。

### D6. 预设应用 = 合并语义（`useLayerManagement` 新增 `applyPreset`）

- `applyPreset(presetId)`：遍历预设图层 → 当前文件已存在**同 kind 同 name** 图层则置 `enabled=true`，否则 `addLayer` 新增。
- 保存：复用现有 `handleSavePreset`（localStorage key 不变），仅 UI 入口从左侧迁至右侧图层区头部。
- 备选：替换语义（清空现有图层再应用）→ 破坏用户已配置图层，否决。

### D7. 移除独立 stats 视图

- `App.tsx`：删除 `StatsPanel` import 与 `activeView === 'stats'` 分支；`logLevelStats` 拉取逻辑**保留**并转交 `InspectorSummary`。
- `useUIState.ts`：`ActiveView` 类型删 `'stats'`（变为 `'main' | 'search' | 'ai' | 'help'`）。
- `Sidebar.tsx`：删除柱状图按钮。
- 删除 `StatsPanel.tsx` 文件（git 可恢复）。

### D8. 左侧 UnifiedPanel 精简

- `SectionId` 变为 `'explorer' | 'history'`；删除 openFiles 区（含内嵌 LayersPanel/书签）与 presets 区；历史文件（`wasOpen === false`）抽为独立区，点击重新打开逻辑保留（`openFileInEditor`）。
- 清理废弃状态：`expandedFiles`、`openedHeight`、`fileInfoList`（App.tsx 若不再消费则删）等。
- 资源管理器（FileTree）原样保留。

## Risks / Trade-offs

- **e2e 测试选择器失效**（图层/书签/预设 DOM 位置迁移）→ 保持 `LayersPanel` 内部 DOM/类名不变 + 迁移后全量跑 `tests/e2e` 修正选择器。
- **书签缓存一致性**（后端书签被外部修改）→ toggle/clear 同步缓存；重新索引时失效；缓存只做"显示垫底"，后台 fetch 总会刷新。
- **UnifiedPanel 大改回归** → 分步实施（先加右侧栏、再精简左侧、最后删 stats），每步 `npx tsc --noEmit` + e2e 绿后再继续。
- **activeView 类型收窄**（删 'stats'）→ 全仓 `tsc` 强制检查，任何遗漏引用编译期暴露。
- **右侧栏占用横向空间**（300px）→ 可折叠+记忆宽度+移动端转浮层（复用 `useResponsive`），用户可随时收起。

## Migration Plan

1. **步骤 1（新增右侧栏）**：`useUIState` 加 `inspectorWidth`；建 `InspectorPanel` 及子组件（复用 LayersPanel、迁书签/预设 JSX）；书签缓存落地；App.tsx 组装 props。此时左/右并存，行为无回退。
2. **步骤 2（精简左侧）**：UnifiedPanel 删 openFiles/presets 区、历史文件独立；清理 `fileInfoList` 等。
3. **步骤 3（删 stats）**：移除 StatsPanel 分支、Sidebar 图标、ActiveView 类型；删文件。
4. 每步独立可运行、可回滚（git revert 单步提交）。

## Open Questions

1. 历史文件区独立后是否保留"最近打开时间"列（现状已含）——实现时按现有数据直接保留。
2. 预设合并应用时"同 kind 同 name"的匹配是否需放开为"同 kind 即可"——实现时按 demo 已验证的 kind 匹配为准（同 kind 启用）。
