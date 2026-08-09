# Tasks: add-right-inspector-panel

## 1. 状态与布局骨架

- [x] 1.1 `useUIState.ts`：新增 `inspectorWidth`/`setInspectorWidth` 状态（默认 300，折叠=0 记忆值）
- [x] 1.2 `App.tsx`：主区域 flex 末尾挂载 `<InspectorPanel />`（在 EditorArea 之后、StatusBar 之前）
- [x] 1.3 顶栏右端新增折叠按钮（与左端 `onToggleSidebar` 对称，注入 `inspectorWidth` 逻辑）
- [x] 1.4 右侧栏拖拽调宽手柄（200–480 clamp，复用左侧面板 mousedown 模式）
- [x] 1.5 移动端：右侧栏转浮层（复用 `useResponsive`，与左侧面板同模式）

## 2. 右侧操作台组件

- [x] 2.1 新建 `InspectorPanel.tsx`：容器（宽度/折叠/滚动），组装五个区，props 由 App.tsx 注入
- [x] 2.2 新建 `InspectorSummary.tsx`：文件属性摘要（路径复制+反馈、大小、总行数、级别分布堆叠条，数据 activeFile + logLevelStats）
- [x] 2.3 将 `LayersPanel` 迁入右侧图层区（props 不变、DOM/类名不变），头部追加"保存为预设"按钮
- [x] 2.4 新建 `InspectorBookmarks.tsx`：书签列表从 UnifiedPanel 抽出（行号/注释/预览、点击跳转、删除/编辑注释、数量徽标、默认折叠）
- [x] 2.5 新建 `InspectorPresets.tsx`：预设列表（名称/来源/应用/删除）+ 保存命名浮层；统计占位折叠区
- [x] 2.6 `App.tsx`：向 InspectorPanel 组装全部 props（layers/presets/handleSavePreset/bookmarks/previews/logLevelStats/各回调，与 UnifiedPanel 同源）

## 3. 书签 per-file 前端缓存

- [x] 3.1 `useBookmarks.ts`：新增模块级 `Map<fileId, {bookmarks, previews}>` 缓存；切文件命中缓存立即渲染、后台 fetch 刷新后覆盖
- [x] 3.2 缓存失效：toggleBookmark 成功/clear 后同步写回缓存；fileLoaded 重新索引时删除该 fileId 条目

## 4. 预设合并应用

- [x] 4.1 `useLayerManagement.ts`：新增 `applyPreset(presetId)`——同 kind 同 name 图层置 enabled，否则 addLayer；返回变更计数供反馈

## 5. 左侧面板精简

- [x] 5.1 `UnifiedPanel.tsx`：删除 openFiles 区（含内嵌 LayersPanel/书签渲染）与 presets 区
- [x] 5.2 历史文件（wasOpen=false）抽为独立区，`SectionId` 改为 `'explorer' | 'history'`；清理 `expandedFiles`/`openedHeight` 等废弃状态
- [x] 5.3 `App.tsx`：清理 `fileInfoList`（确认无消费方后删除）；历史文件点击重开逻辑保留（openFileInEditor）

## 6. 移除独立统计视图

- [x] 6.1 `App.tsx`：删除 `StatsPanel` import 与 `activeView === 'stats'` 分支；`logLevelStats` 拉取保留并转交 InspectorSummary
- [x] 6.2 `useUIState.ts`：`ActiveView` 类型删除 `'stats'`
- [x] 6.3 `Sidebar.tsx`：删除柱状图按钮；删除 `StatsPanel.tsx` 文件

## 7. 验收测试（ATDD，逐条追溯 spec 场景）

- [x] 7.1 e2e：操作台随激活文件切换（spec R1 三场景：切 tab/分屏跟随/空态）
- [x] 7.2 e2e：文件属性摘要展示与路径复制（spec R2）
- [x] 7.3 e2e：图层区交互迁移——启停联动日志渲染、增删、排序（spec R3）
- [x] 7.4 e2e：预设保存/应用合并/删除（spec R4 三场景）
- [x] 7.5 e2e：书签列表、跳转、删除/编辑（spec R5）
- [x] 7.6 e2e：书签缓存——切回已加载文件立即显示、变更后失效（spec R6）
- [x] 7.7 e2e：左右独立折叠记忆宽度、右侧拖拽调宽（spec R7）
- [x] 7.8 e2e：左侧仅导航区、历史文件重新打开（spec R8）
- [x] 7.9 e2e：无独立 stats 图标/视图、统计占位区（spec R9/R10）

## 8. 验证与收尾

- [x] 8.1 `npx tsc --noEmit` 全绿（activeView 类型收窄强制检查）
- [x] 8.2 `npm run build` 通过
- [x] 8.3 `python3 -m pytest`（后端单测回归，确认零改动无破坏）
- [~] 8.4 e2e 全量跑绿（含 7.x 新增 + 既有用例修正后的选择器） （按用户指示跳过 e2e 调试）
- [x] 8.5 检查调试输出（无散落 console.log/print，收敛统一 logger）；提交前清理
