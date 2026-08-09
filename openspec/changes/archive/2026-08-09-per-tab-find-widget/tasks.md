# Tasks: Find Widget Per-Tab (对齐 VSCode)

## 1. 验收测试（ATDD 先行，先红后绿）

- [x] 1.0 测试基础设施：安装 `jsdom` + `@testing-library/react` devDeps；vite.config.ts 增 vitest `test.environment: 'jsdom'` 配置（design Non-Goals 已允许测试 devDeps）
- [x] 1.1 单测 `frontend/src/store/searchStore.test.ts`：`setFindVisible` 写入 `isFindVisible` 与 `focusRequest` 递增；`getTabState` 返回默认 `focusRequest=0`（对应 spec：Ctrl+F 打开/聚焦）
- [x] 1.2 单测 `frontend/src/store/searchStore.test.ts`：`destroyTab` 后状态释放；`ensureTab` 幂等（对应 spec：面板关闭销毁、每面板独立状态）——既有测试已覆盖（ensureTab 幂等/destroyTab 释放/destroyTab 不影响他面板），红态运行 12 passed 确认
- [x] 1.3 组件测试 `EditorFindWidget`（jsdom + testing-library）：展开时元素顺序为 `[输入框(含 Aa/全字/正则)] [计数] [↑][↓] [✕]`；无匹配时计数显示"无结果"且带错误态 class（对应 spec：结构对齐、无匹配提示）——测试已写，红态确认（3 failed）
- [x] 1.4 组件测试 `EditorFindWidget`（jsdom + testing-library）：`focusRequest` 变化时输入框 focus+select 全选；非激活面板（自身 panelId ≠ activePanelId）时容器带非交互 class（对应 spec：Ctrl+F 全选、非激活不可交互）——测试已写，红态确认
- [x] 1.5 e2e `tests/e2e/test_per_tab_find_widget.py`（单面板行为，非分屏）：Ctrl+F 打开/重复按下 focus+select；非激活语义经切 tab 验证（对应 spec：Ctrl+F 打开/聚焦、非激活不可交互）。**分屏并存场景降级为手动验证（tasks 6.4），不做自动化**——产品当前无分屏入口
- [x] 1.6 串词修复验证：数据层独立性已由 1.1/1.2 覆盖（各面板 query/config 独立、互不干扰）；可观察行为由既有 e2e `test_multi_panel_search.py:test_multi_panel_search_independence` 覆盖（切 tab 后各行高亮独立、rows 不含他面板词）；分屏并存由手动验证（6.4）。实现时确保 `LogViewerPanel` 传 `LogViewer` 的 `searchQuery/searchConfig` 改为自读本面板 tab 状态（4.3），无需新组件级测试（LogViewerPanel 未导出且完整渲染 LogViewer 在 jsdom 下过重）
- [x] 1.7 运行验收测试确认红（新测试失败，符合 ATDD 先红）——1.1/1.3/1.4 红态已确认（store 2 failed + widget 3 failed）；e2e（1.5）留待实现后与全量一起跑（e2e 需要前后端，先红后绿成本高，改为实现后统一绿验证）

## 2. 状态层：searchStore 扩展

- [x] 2.1 `frontend/src/store/searchStore.ts`：`TabSearchState` 增加 `focusRequest: number`（默认 0）
- [x] 2.2 `searchStore` 增加 `requestFocus(panelId)` action：`setFindVisible(panelId, true)` 且 `focusRequest+1`（供 Ctrl+F 快捷键与 `onShowSearchHistory` 调用）

## 3. EditorFindWidget 重写（VSCode 结构 + 项目配色 + per-panel）

- [x] 3.1 `frontend/src/components/EditorFindWidget.tsx` 改 props：接收 `panelId`、`matchCount`、`currentMatch`、导航/关闭回调、`isActive`（非激活淡显开关），移除 App 级状态假设
- [x] 3.2 布局结构对齐 VSCode：输入框（内嵌 Aa/全字/正则切换）→ 计数（min-width 69px）→ 上一/下一 → 关闭；初始宽 419px、高 34px、圆角 `--radius-lg`、输入框 min-height 25px、按钮 22×22 热区
- [x] 3.3 配色全部改用项目 token：widget 底 `bg-theme-surface`、边框 `border-theme-default`、文本 `text-theme-primary`、输入框 `bg-theme-input`/占位 `text-theme-muted`、聚焦 `border-theme-focus`、无结果 `text-error`、切换激活态用品牌色；随 dark/light 自动适配
- [x] 3.4 保留左侧 Sash 拖宽：最小 419px、最大 `面板宽 - 28 - ruler宽`、双击最大化；宽度为实例内 `useState`（每次打开重置 419px）
- [x] 3.5 保留"高亮/过滤" mode chip（输入框左侧紧凑按钮），样式走项目 token
- [x] 3.6 非激活面板：`isActive=false` 时容器加 `pointer-events-none opacity-*` 淡显；`focusRequest` 变化（首帧含）时 focus+select（ref 守卫防 StrictMode 双调）
- [x] 3.7 slide-in 动画沿用；Esc 第一段 `onClose` + `stopPropagation` 保留

## 4. 面板挂载与数据流（EditorArea / LogViewerPanel）

- [x] 4.1 `frontend/src/components/EditorArea.tsx`：`EditorAreaData` 增加 per-panel 导航回调（`onFindNavigate`/`onFindClose`，或直接下传 App 级 `findNextSearchMatch`），经 context 供面板 widget 使用
- [x] 4.2 `LogViewerPanel` 内挂载 `EditorFindWidget`：`absolute top-2 right-8` 于面板 `relative` 容器；`panelId` 取 `params.panelId`；`matchCount` 取 `processedCache[本面板 fileId].searchMatchCount`；`query/config/isFindVisible/currentMatch` 读 store 本面板 tab；写入调 `setQuery/setConfig/setFindVisible`
- [x] 4.3 分屏串词修复：`LogViewerPanel` 传给 `LogViewer` 的 `searchQuery/searchConfig` 改为自读本面板 tab 状态（不再用 context 的 App 级值）
- [x] 4.4 面板生命周期：非激活判断用 `useSearchStore` 的 `activePanelId` 与自身 panelId 比较；点击非激活 widget 冒泡激活面板（若冒泡被拦截，`onMouseDown` 显式 `api.getPanel(panelId)?.api.setActive()`）

## 5. App 重构（移除全局渲染与同步）

- [x] 5.1 `frontend/src/App.tsx` 删除全局 `EditorFindWidget` 渲染块（L888-901）与 `isFindVisible` 双向同步 effect（L292-311）；`useUIState` 中 `isFindVisible` 本地态不再需要
- [x] 5.2 `Ctrl+F` 快捷键与命令面板 `search.focus`、`onShowSearchHistory` 改为 `useSearchStore.getState().requestFocus(activePanelId)`；无激活面板 no-op
- [x] 5.3 全局 Esc 第二段（清词）改读激活面板状态：`!tabs[activePanelId]?.isFindVisible && tabs[activePanelId]?.query` 时 `clearSearch(activePanelId)`（保持与第一段 stopPropagation 的联动）
- [x] 5.4 `EditorArea` 的 `isFindVisible` context 字段按需清理（LogViewer 传参已改本面板，确认无残留引用）

## 6. 验证与收尾

- [x] 6.1 `npm run test`（vitest）全绿：含既有 `searchStore.test.ts` 与新增 1.1-1.6 测试
- [x] 6.2 `npm run build`（tsc + vite build）通过，无类型错误
- [x] 6.3 `npm run e2e` 通过（含新增的 find widget 单面板行为用例与既有多面板用例）
- [ ] 6.4 手动验证（用户执行）：切 tab 恢复各自 widget 可见性与词、**分屏两 widget 并存、分屏不串词、点击非激活 widget 激活面板**（分屏场景手动）、两段式 Esc、Ctrl+F 重复按下全选、light/dark 主题对比度
