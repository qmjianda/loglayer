## Context

动机与需求边界参见 proposal.md 与 specs/。本设计只补充实现层面的技术决策。关键现状约束（已核实源码）：

- **`LayersPanel.tsx`**：卡片式列表，配置表单（`DynamicForm`）内嵌展开在选中图层卡片内——空间膨胀的根源；单击已选中图层会切换折叠（与双击重命名打架）；标题行颜色按类型写死。
- **`DynamicForm.tsx` / `InputMapper.tsx` / `ColorPicker.tsx`**：schema 驱动表单，`ColorPicker` 是纯色盘无推荐色。
- **`ContextMenu.tsx`**（Radix）：正文右键菜单已有 Add Highlight / Add Filter，只传 query，无选色。
- **`InspectorPanel.tsx`**：折叠区（图层/预设/书签/统计占位）+ 顶部固定 `InspectorSummary`；`visibleLayers` 过滤系统托管图层。
- **`useCommands.ts`**：命令面板 + 快捷键监听（Ctrl+Shift+P/T/D/L 已占用）。
- **数据层生效**：配置 `onUpdate` 直接驱动 `sync_layers`（后端重算），无防抖。
- **`useLogStats` / `operationProgress`**：已有后端重算进度信号可复用。

## Goals / Non-Goals

**Goals:**
- 图层交互改为"属性区在上、列表在下"的紧凑结构，配置表单脱离图层卡。
- 提供创建路径（右键色板 / Ctrl+Shift+H / 添加下拉），颜色选择一步到位；拖选浮动条（D4）为规划中、未实现项。
- 图层项显示真实配置色 + 匹配文本预览。
- 单击/折叠/重命名语义分离，消除误触。
- 数据层配置防抖，避免打字过程狂打后端。

**Non-Goals:**
- 不改后端 registry / `ui_schema`（颜色与色板是纯前端概念）。
- 不做图层类型/引擎层面的新能力（沿用 `layer-system-v2`）。
- 不动书签数据模型与持久化（仅行高压缩）。
- 不做统计功能的新实现（移除占位，不补新统计区）。

## Decisions

### D1: 属性区与列表的布局实现 —— 单列 flex，属性区双状态

InspectorPanel 的"图层"折叠区内改为纵向布局：`属性区（自适应高度，上限 ~40%）` + `图层工具栏` + `图层列表（flex-1 滚动）`。属性区状态机：未选中 → 渲染 `InspectorSummary`（文件摘要）；已选中 → 渲染 `DynamicForm`（紧凑单列）。

- **备选 A**：配置表单放弹出 dialog——零布局耦合但多一次点击跳转，违反"视线不离开正文"。
- **备选 B**：表单留在卡片内展开——现状，空间膨胀的根源。
- **选择理由**：属性区两用（摘要/配置）复用已有组件，无新壳；列表始终紧凑可滚动。

### D2: 右键色板子菜单 —— Radix ContextMenu Sub

`ContextMenu.tsx` 的"Add Highlight"改为 Radix `Sub`（`ContextMenuSub`）展开色板子菜单：顶部最近使用色（2-3 个），下方 16 色网格（两行，同 ColorPicker 的推荐色板常量）。点色 → `onAddHighlight(query, color)`。`Add Filter` 保持直接项（过滤无颜色）。

- **备选 A**：菜单底部内联色板一行——菜单高度膨胀，二级结构更清晰。
- **备选 B**：两步走（先建后改色）——正是现状痛点，排除。
- **选择理由**：Radix Sub 原生支持键盘导航与定位，色板复用统一常量。

### D3: 推荐色板与最近使用色的统一数据源

新建 `frontend/src/constants/colors.ts`（或并入现有 constants）：导出 `RECOMMENDED_COLORS`（16 色 = 8 色相 × 2 明暗梯度，含日志语义色 ERROR 红/WARN 黄/INFO 绿/DEBUG 蓝）、`RECENT_COLORS_LIMIT=8`、`getRecentColors()`/`addRecentColor()`（localStorage 键 `loglayer.recentColors`，组件外读写，供右键子菜单、ColorPicker 共用）。

- **备选**：最近色放 React Context——跨组件但增加全局状态；localStorage 工具函数更轻，且持久化天然跨会话（spec 要求）。
- **选择理由**：三处入口（右键/浮动条/ColorPicker）需要同一份最近色数据，工具函数 + localStorage 满足且零全局状态。

### D4: 拖选浮动条 —— LogViewer 内挂载，防误触门控

在 `LogViewer.tsx` 现有 `onSelectedTextChange` 链路旁检测"拖选"（`selectionchange` 事件中判断 `anchorOffset !== focusOffset` 且 `selection.isCollapsed === false` 且选区起点在日志容器内），选区右上角定位渲染 `SelectionToolbar`（绝对定位，`Highlighter` + `Filter` 两按钮，高亮按钮 hover 展开与 D2 相同的色板）。单击行（选区 collapsed）不显示。

- **备选 A**：浮动条放 App 层——需从 LogViewer 冒泡选区几何信息，跨层耦合；LogViewer 内挂载自包含。
- **备选 B**：复用右键菜单触发——无选区几何上下文，做不到"跟随选区右上角"。
- **选择理由**：`selectionchange` 是原生事件，性能 O(1)（仅选区变化时触发）；浮动条挂 LogViewer 内部，选区几何就地可得。

### D5: Ctrl+Shift+H 快捷键 —— useCommands 扩展

`useCommands.ts` 增加 `layer.highlightSelection` 命令（`Ctrl+Shift+H`）：读取当前选中文本（从 LogViewer 上报的 selectedText state 或直接 `window.getSelection()`），以最近使用色调用 `addLayer(HIGHLIGHT, { query, color })`。命令面板注册为可见命令，快捷键进入现有监听。

- **备选**：独立 keydown 监听——分散，命令面板已统一快捷键。
- **选择理由**：复用现有命令架构；`Ctrl+Shift+*` 系列未被占用（已验证 P/T/D/L）。

### D6: 数据层防抖 —— useLayerManagement 或属性区包装

在配置更新路径（`onLayerUpdate` → 触发 sync 的桥接层）对数据层图层（FILTERING/TRANSFORM 类别）做 400ms debounce；视觉层直接透传。用现有 `useLogStats`/`operationProgress` 信号驱动属性区"重算中"提示（数据层图层的更新在途时显示）。

- **备选**：防抖放 DynamicForm 输入侧——只防住打字，程序化更新（预设应用）仍会打爆后端；放更新桥接层覆盖全部路径。
- **选择理由**：单点拦截所有数据层配置变更；防抖窗口 400ms 与搜索防抖（`search-debounce` spec）一致。

### D7: 新建图层后聚焦 —— 属性区 autoFocus

新建图层后：`setSelectedLayerId(newId)` + 列表滚动到该项（LayersPanel 暴露 `scrollToLayer(id)` 或列表容器 ref 定位）+ 属性区 DynamicForm 的 query 输入框 `autoFocus`（HIGHLIGHT 专用布局已存在，加 autoFocus prop）。

- **选择理由**：现有"选中 + 属性区渲染表单"机制已具备，只加 autoFocus 与滚动定位，改动最小。

## Risks / Trade-offs

- [属性区两用切换闪烁] → DynamicForm 与 InspectorSummary 切换时用轻量过渡（透明度），且两组件均已存在，无数据重拉。
- [右键子菜单色板在窄面板下溢出] → 色板网格固定宽度，超出由 Radix 自动翻转定位；面板宽度 clamp 200-480px 内验证。
- [EyeDropper API 兼容性（Firefox/旧 WebView）] → 特性检测 `'EyeDropper' in window`，不支持时隐藏取色器按钮（spec 已约定）。
- [拖选浮动条误触干扰阅读] → 仅拖选出现（单击不触发），点击空白/选区清空即消失；按钮仅两个减少干扰。
- [数据层防抖改变生效时序] → 400ms 延迟换取后端不被打字打爆，属性区"重算中"提示缓解感知延迟；spec 已明确该策略。
- [LayersPanel 交互回归（拖拽/启停/增删）] → 布局重构保持既有 handler 契约（onDrop/onToggle/onRemove/onUpdate），仅 DOM 结构变化；e2e 回归覆盖。

## Migration Plan

- 前端逐步替换：先合入阶段 1（重命名语义）→ 阶段 2（创建路径+色板）→ 阶段 3（信息显示）→ 阶段 4（布局结构）。每阶段独立可运行、可验收。
- 无后端改动、无数据迁移；`.loglayer/` 工作区配置格式不变（图层数据结构不变，仅 UI 呈现变化）。
- 回滚：单阶段 revert 即可，不涉及数据兼容。
