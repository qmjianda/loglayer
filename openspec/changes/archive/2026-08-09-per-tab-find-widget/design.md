# Design: Find Widget Per-Tab (对齐 VSCode)

## Context

当前 `EditorFindWidget` 在 `App.tsx` 根部渲染**单一实例**（`absolute top-2 right-8`，悬浮于整个主内容区右上角），而搜索**状态**已 per-tab 化（`searchStore.tabs[panelId]` 存 query/config/currentMatchRank/isFindVisible，面板生命周期绑定、布局恢复按稳定 panelId 重挂）。本次改动将**渲染实例**也 per-tab 化：每个 dockview 面板（tab）在自身右上角渲染独立的 find widget，行为与视觉对齐 VSCode，配色沿用项目主题 token（`index.css` 的 `--bg-*`/`--fg-*`/`--border-*`/`--input-bg`/`--color-primary` 体系）。

约束：无后端/API/依赖变更；性能红线（虚拟滚动 O(1)）不受影响；仓库规范要求 ATDD（spec 的 WHEN/THEN 场景先落测试再实现）。

## Goals / Non-Goals

**Goals:**
- 每面板独立渲染 find widget 实例，读写自己的 `tabs[panelId]` 状态
- VSCode 对齐的结构/尺寸/交互（初始宽 419px、高 34px、圆角 `--radius-lg`、元素顺序 `[输入框(内嵌切换)] [计数] [↑][↓] [✕]`、左侧 Sash 拖宽最小 419px + 双击最大化、slide-in 动画）
- 配色全部使用项目主题 token（dark/light 自动切换），不引入 VSCode 色值
- 分屏时非激活面板的 widget 可见但非交互（淡显 + `pointer-events-none`），点击激活后恢复
- 顺带修复分屏高亮串词：`LogViewer` 的 `searchQuery/searchConfig` 读本面板 tab 状态
- Ctrl+F 重复按下 = focus 输入框 + select 全选已有词；两段式 Esc 保留（作用于激活面板）

**Non-Goals:**
- 不新增搜索历史（Alt+↑/↓ 循环）——历史仍在侧边栏"搜索"面板，后续单独变更
- 不改 `EditorGoToLineWidget`（Ctrl+G 仍为全局单实例）
- 不改后端搜索/同步管线（`syncAll`/ripgrep/缓存均不动）
- 不迁移侧边栏 `SearchPanel`/`SearchResultsPanel`（保持现状，它们读 App 级 `useSearch` 返回值）
- **无运行时依赖变更**；允许新增前端测试基础设施 devDeps（`jsdom` + `@testing-library/react`——React 19 下 `react-test-renderer` 已废弃，组件测试需此组合）
- **分屏（dockview 多组并存）场景不做自动化测试**：产品当前无分屏入口，该场景由人工手动验证（tasks 6.4）；自动化覆盖单面板 per-tab 行为与组件级断言（分屏并存是 per-panel 渲染的顺带收益，非当前验收门槛）

## Decisions

### D1: Widget 渲染归属 —— 每面板一个实例（Q1=A）
`EditorFindWidget` 移入 `LogViewerPanel`（`EditorArea.tsx:80` 的 dockview 面板组件），在其 `relative` 容器内 `absolute top-2 right-8` 定位。每面板持有自己的 DOM 实例与状态。
- **备选**：全局单实例按激活面板改定位 —— 被否：分屏时无法同时显示两面板各自的 widget，不满足"每个 tab 一个"。
- 依据：VSCode 语义是每个 editor group（≈本应用每个面板）一个 widget；store 已按 panelId 隔离，渲染层补上实例层即可闭环。

### D2: 数据流 —— widget 直读 store，导航仍走 App 级
- widget 通过 `useSearchStore` 读 **本面板** 的 `tabs[panelId]`：query / config / currentMatchRank / isFindVisible；写入直接调 `setQuery/setConfig/setFindVisible`。
- `matchCount` 从 `EditorAreaData.processedCache[本面板 fileId].searchMatchCount` 取（每面板自己的文件计数，不再依赖 App 级 `searchMatchCount`）。
- 导航（Enter/Shift+Enter/上/下箭头）回调由 App 级 `findNextSearchMatch` 提供，经 `EditorAreaData` 上下文下传；因**非激活面板不可交互**（见 D5），回调只会从激活面板触发，`activePanelId === 本面板`，天然一致。
- **备选**：每面板自含完整导航逻辑（直接调 bridge + 自管 scrollToIndex）—— 被否：重复实现搜索状态机，且激活面板导航已由 App 级实现、测试覆盖充分。
- 依据：导航的正确性前提"仅激活面板交互"由 D5 保证，数据流保持最小改动。

### D3: 移除 App 级 isFindVisible 双向同步，store 成为唯一真源
- 删除 `App.tsx:292-311` 的写回/恢复 effect 与 `useUIState` 里的 `isFindVisible` 本地态联动；面板内 widget 直接从 store 读自己的可见性。
- 快捷键改造：
  - `Ctrl+F`（命令面板 `search.focus`）与 `onShowSearchHistory` → `setFindVisible(activePanelId, true)` + 触发 focus 信号；无激活面板时 no-op。
  - 全局 Esc 第二段（清词）由现有全局 keydown 改读**激活面板** tab 状态：`!tabs[activePanelId]?.isFindVisible && tabs[activePanelId]?.query` 成立则 `clearSearch(activePanelId)`。第一段 Esc 在 widget 内部处理并 `stopPropagation`（现有逻辑保留）。

### D4: Ctrl+F 重复按下 focus+select（Q9=A）
`TabSearchState` 增加 `focusRequest: number`（单调递增计数器，默认 0）。快捷键每次按下 `setFindVisible(panelId, true)` 同时 `focusRequest+1`；widget 内 `useEffect` 监听 `focusRequest` 变化（含首帧）执行 `inputRef.focus()` + `select()`。
- **备选**：在 store 外传临时事件 —— 被否：与 per-panel 状态架构不符，跨面板广播易错。
- 首开（widget 刚 mount）时现有 `useEffect([], focus+select)` 已覆盖；重复按下靠 `focusRequest` 增量触发。

### D5: 非激活面板 widget 可见但非交互（Q7=A）
widget 比较 `store.activePanelId !== 本面板 panelId` 时，容器加 `pointer-events-none opacity-*`（淡显），输入框不 focus、按钮不可点；点击 widget 区域 → 触发 dockview 激活该面板（`onDidActivePanelChange` 会同步 `activePanelId`，widget 随之恢复交互）。
- 依据：VSCode 中每个 group 的 widget 独立常驻，聚焦决定可交互性；"点击非交互 widget 激活面板"与 dockview 点击激活行为一致。
- 注意：dockview 激活本身由点击 tab/内容触发；widget 内点击通过面板容器的点击冒泡激活（无需特殊处理，验证阶段确认）。

### D6: 视觉对齐 —— VSCode 结构 + 项目 token 配色（Q4=A）
- 结构/尺寸按 VSCode spec（已由 librarian 抓取源码确认）：初始宽 419px、高 34px、圆角 `--radius-lg`(8px)、`margin-top 4px`、阴影沿用 `shadow-2xl`（项目已有）、输入框 `min-height 25px`、字号 13px、计数 `min-width 69px`、按钮 22×22 热区（16px 图标 + 3px padding）、元素顺序 `[输入框(内嵌 Aa/全字/.*)] [计数 N of M] [↑][↓] [✕]`。
- 配色映射（不引入 VSCode 色值）：
  - widget 底 `bg-theme-surface`、边框 `border-theme-default`、文本 `text-theme-primary`
  - 输入框 `bg-theme-input`、占位 `text-theme-muted`、聚焦 `border-theme-focus`
  - 切换按钮激活态 `bg-primary-color text-white`（或 `border-theme-focus`），hover `bg-theme-hover`
  - 无结果计数 `text-error`；计数常规 `text-theme-secondary`
- 拖宽把手保留（VSCode 亦支持）：左缘 2px Sash，最小 419px、最大 `面板宽 - 28 - ruler宽`，双击最大化；宽度为 widget 实例内 `useState`（每次打开重置 419px，与 VSCode 一致）。
- "高亮/过滤" mode chip（Q8=A）：保留为输入框左侧紧凑小按钮，样式走 `bg-theme-input`/激活 `bg-blue-600`（沿用现有交互）。

### D7: 分屏高亮串词修复（Q5=B）
`LogViewerPanel` 不再从 context 取 App 级 `searchQuery/searchConfig`（那是激活面板的词），改为自读 `tabs[panelId].query/config` 传入 `LogViewer`。`EditorAreaData` 中的 `searchQuery/searchConfig` 字段对 LogViewer 的传参职责移除（context 保留给其他用途或后续清理）。

### D8: 宽度/交互状态生命周期
widget 实例内 `useState` 持有宽度与拖拽中状态；`query/config/visible` 在 store。面板关闭 → `destroyTab` 释放 store 状态（现有）；widget 随面板卸载，宽度丢弃。布局恢复（刷新后 fromJSON）→ 面板按稳定 panelId 重挂，store 状态重新关联（现有机制）。

## Risks / Trade-offs

- [matchCount 对非激活面板是"上次激活时"的缓存值，非实时] → widget 只读且非交互，计数展示的是该面板搜索时的快照，语义可接受；面板重新激活时 App 级同步会刷新。
- [store 增 `focusRequest` 字段影响现有测试] → 字段有默认值（0），`searchStore.test.ts` 现有断言不受影响；新增针对 `setFindVisible+focusRequest` 的测试。
- [React StrictMode 双调用导致 focus effect 重复] → `focusRequest` 增量比较 + ref 守卫，只在值变化时执行一次。
- [非激活 widget 点击激活面板行为依赖 dockview 冒泡] → 验证阶段用 e2e/手动确认；若冒泡被 widget 容器拦截，则在 widget 容器上加 `onMouseDown` 显式激活面板（`api.getPanel(panelId)?.api.setActive()`）。
- [Esc 全局第二段与 widget 内第一段的 stopPropagation 链] → 现有机制已工作（widget keydown 内 `stopPropagation`），per-panel 化后仅改读激活面板状态，回归风险低。
- [视觉对齐引入回归（light 主题对比度）] → 全部走 token 体系，dark/light 自动适配；验证阶段检查 light 主题下无结果红/聚焦蓝对比度。

## Migration Plan

1. **specs**：新增 `find-widget-per-panel` spec + `per-tab-search` delta spec（AC 场景）
2. **ATDD**：按 AC 写验收测试（单测：store `focusRequest`/可见性路由；组件测试或 e2e：每面板实例、非激活淡显、分屏不串词）
3. **实现**（顺序）：
   - `searchStore`：加 `focusRequest`
   - `EditorFindWidget`：VSCode 结构/尺寸 + token 配色 + per-panel props（接收自身 panelId、matchCount、导航回调）
   - `EditorArea`：`LogViewerPanel` 挂载 widget + context 增导航回调 + LogViewer 传参改本面板状态
   - `App`：删全局渲染与同步、改快捷键与 Esc 第二段
4. **验证**：`npm run build`（tsc）+ 单测 + e2e；手动验证分屏/切 tab/两段 Esc
5. **回滚**：纯前端改动，单 commit revert 即可；无数据迁移

## Open Questions

- 无阻塞性问题。验证阶段需确认：非激活 widget 点击能否冒泡激活 dockview 面板（D5 风险项）；若不能，按 D5 风险预案处理。
