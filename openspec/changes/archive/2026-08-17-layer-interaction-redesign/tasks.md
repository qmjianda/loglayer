## 1. 阶段 1：重命名与选中语义（spec: 图层选中与重命名语义）

- [x] 1.1 LayersPanel：移除"单击已选中图层切换折叠"逻辑——单击仅 `onSelect`，重复单击无副作用；折叠仅由箭头按钮触发
- [x] 1.2 LayersPanel：标题行 hover 增加铅笔图标按钮（`no-drag` 区），点击进入编辑（与双击共用 `setEditingId` 路径）
- [x] 1.3 单测：单击选中项不折叠、铅笔/双击进入编辑、Enter 提交 / Escape 取消（`frontend/src/components/LayersPanel.test.tsx` 或新增）

## 2. 阶段 2：创建路径与颜色选择器（spec: 右键创建带色高亮 / 快捷键高亮选中文本 / 颜色选择器能力）

- [x] 2.1 新建 `frontend/src/constants/colors.ts`：`RECOMMENDED_COLORS`（16 色 = 8 色相 × 2 明暗梯度）、`RECENT_COLORS_LIMIT=8`、`getRecentColors()`/`addRecentColor()`（localStorage `loglayer.recentColors`）
- [x] 2.2 ColorPicker 升级：推荐色板（两行 16 色）+ 最近使用 8 色 + HEX 输入 + 取色器（EyeDropper 特性检测，不支持时隐藏）
- [x] 2.3 ContextMenu："Add Highlight" 改为色板子菜单（顶部最近使用色 + 16 色网格），点色调用 `onAddHighlight(query, color)`；`Add Filter` 保持直接项
- [x] 2.4 useCommands：新增 `layer.highlightSelection` 命令（`Ctrl+Shift+H`），读取选中文本 + 最近使用色调用 `addLayer(HIGHLIGHT, ...)`；确认不与现有快捷键冲突
- [x] 2.5 可选（后置 task）：LogViewer 拖选浮动条 `SelectionToolbar`（仅拖选出现，高亮/过滤两按钮，高亮 hover 复用色板，选区右上角定位）——已从 spec 移除（verify 阶段决定：右键路径已验证可用，浮动条留待未来变更）
- [x] 2.6 单测：色板读写（localStorage）、最近色跨会话、EyeDropper 特性检测分支、快捷键命令注册

## 3. 阶段 3：图层项信息显示（spec: 图层项信息显示）

- [x] 3.1 LayersPanel：标题行颜色标识改为读取图层配置色（HIGHLIGHT/ROWTINT 等含 color 配置者显示真实色；无颜色配置者回退类型图标色）
- [x] 3.2 LayersPanel：标题行增加匹配文本预览（取配置 query/pattern，超宽截断 + ellipsis），保持计数徽章
- [x] 3.3 单测：颜色跟随配置变更、匹配文本截断、无配置色时回退逻辑

## 4. 阶段 4：布局结构重构（spec: 文件属性摘要 / 图层区完整交互 / 图层预设管理 / 移除独立统计视图）

- [x] 4.1 InspectorPanel：图层区改为纵向布局——属性区（自适应，上限 ~40%，未选中渲染 `InspectorSummary`、选中渲染紧凑 `DynamicForm`）+ 图层工具栏 + 图层列表（flex-1 滚动）；顶部固定 InspectorSummary 移除
- [x] 4.2 DynamicForm：紧凑单列化（HIGHLIGHT 专用布局保留但压缩纵向间距），支持 query 输入框 `autoFocus`
- [x] 4.3 LayersPanel：移除卡片内嵌表单展开逻辑；行高压缩（分区头 ≤24px，行 28px 左右）；保留处理层/渲染层分区
- [x] 4.4 InspectorPanel：移除"统计（第二版迭代）"占位折叠区；移除独立"预设"折叠区，预设列表移入"添加图层"下拉底部（点击应用、hover 删除、>8 显示"管理预设"弹层），"保存为预设"按钮保留工具栏
- [x] 4.5 InspectorBookmarks：行高压缩（保持折叠态与既有交互）
- [x] 4.6 数据层防抖：配置更新桥接层对 FILTERING/TRANSFORM 类别 400ms debounce，视觉层透传（防抖已实现；"重算中"提示 UI 未做，已从 spec 移除）
- [x] 4.7 新建图层后聚焦：`setSelectedLayerId` + 列表滚动到该项 + 属性区 query 输入框 autoFocus
- [x] 4.8 单测/集成：属性区两用切换、预设从下拉应用、统计区不存在、数据层防抖时序（fake timers）
