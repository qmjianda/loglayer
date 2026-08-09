# Proposal: 新增右侧操作台（Right Inspector Panel）

## Why

当前左侧 `UnifiedPanel` 将文件树、已打开文件、图层、书签、预设、历史文件集中在一个 288px 面板中，五合一信息密度过高、职责混杂；"当前文件相关的操作信息"（图层、书签）与文件导航混排，专业用户配置图层与浏览书签需要频繁在拥挤列表中操作，布局信息架构不清晰。

本变更新增**右侧操作台**（right inspector panel）：将"当前激活文件的属性与操作"（文件属性摘要、图层、预设、书签、统计）集中到右侧独立栏，随激活 tab 跟随切换；左侧回归纯导航职责。经过 `demo/layout-demo.html` 交互原型验证，三栏布局（左导航 / 中央分屏 / 右操作台）信息架构更清晰，操作连续性强。

## What Changes

- **新增右侧操作台**（核心）：跟随 `activeFileId`（分屏时跟随最后激活的 pane），从上到下五个区域：
  1. **文件属性摘要**（固定不折叠）：路径（可复制）、大小、总行数、级别分布堆叠条——**首版**字段，全部来自现有接口；时间范围留第二版
  2. **图层**（默认展开）：处理层 / 渲染层两区，完整保留现有 `LayersPanel` 全部交互（增删、启停、拖拽排序、编辑参数）；头部新增"保存为预设"按钮
  3. **预设**（默认折叠）：图层模板库，全局共享（跨文件可应用）；条目含名称、来源文件、应用、删除；应用为**合并语义**（当前文件已有同 kind 图层则启用之，否则新增）
  4. **书签**（默认折叠）：列表 + 点击跳转 + 删除/注释，带数量徽标
  5. **统计**（折叠占位）：第二版迭代位
- **书签 per-file 前端缓存**：仿 `processedCache` 模式新增书签前端缓存层，切 tab 时免去"清空→加载中→显示"闪烁（复用内存缓存，后台静默刷新）
- **左侧 `UnifiedPanel` 精简**：
  - 删除"已打开文件"树（文件导航交给 dockview tab）
  - 删除独立 StatsPanel 视图及左侧"柱状图"图标（`activeView='stats'` 分支移除）；统计并入右侧操作台
  - 保留：资源管理器（FileTree）、历史文件
- **预设 UI 迁移**：预设区从左侧迁至右侧操作台（图层区下方），存储模型不变
- **左右折叠能力**：左右两侧独立折叠按钮、各自记忆折叠前宽度、恢复还原；右侧栏默认 300px、可拖拽 200–480px；移动端转浮层（复用现有 `useResponsive`）

## Capabilities

### New Capabilities

- `right-inspector-panel`: 右侧操作台能力——随激活 tab/pane 切换的当前文件属性面板，包含文件属性摘要、图层管理、预设（图层模板保存/应用/合并）、书签、统计占位五区结构，以及 per-file 书签前端缓存与左右折叠交互

### Modified Capabilities

无。本变更不改变现有能力的行为需求：
- `layer-system-v2`：图层引擎的执行位置/注册/渲染行为不变，仅图层的**配置 UI 所在位置**变化
- `workspace-persistence`：持久化模型不变（预设存储、书签 KV、工作区布局均沿用）
- `dockview-split`：分屏与 `activeFileId` 驱动机制不变，操作台消费现有激活语义
- `per-tab-search`：搜索状态机制不变

## Impact

- **前端（主要）**：
  - `frontend/src/App.tsx`：布局骨架新增右侧栏
  - 新增右侧操作台组件（文件摘要 + 图层 + 预设 + 书签 + 统计区）
  - `frontend/src/components/UnifiedPanel.tsx`：精简（删已打开文件树、删预设区、删 stats）
  - `frontend/src/components/LayersPanel.tsx`、书签渲染：从 UnifiedPanel 迁至右侧操作台
  - `frontend/src/hooks/useBookmarks.ts`：新增 per-file 缓存层
  - `frontend/src/components/Sidebar.tsx`：移除柱状图图标；`activeView='stats'` 分支移除
  - 左侧/右侧折叠与拖拽调宽交互（复用现有 sidebar 拖拽机制）
- **后端**：零改动（首版摘要字段全部来自现有接口：`open_file`、`log_level_stats`、`getBookmarks`）
- **依赖**：无新增
