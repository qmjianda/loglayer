# Proposal: Find Widget Per-Tab (对齐 VSCode)

## Why

当前 Ctrl+F 悬浮窗（`EditorFindWidget`）在 App 根部**只渲染一份**，悬浮于整个主内容区右上角，不归属于任何 tab；而搜索**状态**（词/配置/rank/可见性）早已是 per-tab（`searchStore.tabs[panelId]`）。VSCode 中每个编辑器组（对应本应用每个 tab/面板）拥有各自独立的 find widget，悬浮于该面板右上角。需要将渲染实例 per-tab 化、UI 结构与行为对齐 VSCode（配色沿用项目主题 token），并顺带修复分屏时非激活面板高亮串用激活面板搜索词的潜在 bug。

## What Changes

- **`EditorFindWidget` 从 App 根部移入 `LogViewerPanel`**：每面板一个实例，`absolute` 定位在**本面板右上角**，读写自己的 `tabs[panelId]` 状态（词/配置/可见性/当前匹配），互不影响。
- **非激活面板的 widget 可见但非交互**：分屏时各面板可同时显示各自的 widget（带各自的词/计数），非激活的淡显 + `pointer-events-none`；点击即激活该面板并恢复交互。
- **UI 结构与尺寸对齐 VSCode**（配色全部用项目主题 token，不引入 VSCode 色值）：
  - 初始宽 419px、高 34px、圆角 `--radius-lg`、输入框 min-height 25px、按钮 22×22 热区
  - 元素顺序：`[输入框(内嵌 Aa/全字/正则)] [计数 N of M] [↑][↓] [✕]`
  - 输入框聚焦用 `border-theme-focus`；无结果计数用 `text-error`
  - 左侧拖宽把手保留（对齐 VSCode Sash：最小 419px + 双击最大化）
  - slide-in 动画沿用
- **保留"高亮/过滤"模式切换按钮**（VSCode 无此功能，压缩为输入框左侧紧凑小 chip，项目 token 样式）。
- **Ctrl+F 重复按下 = focus 输入框 + select 全选已有词**（对齐 VSCode）；未打开则打开并 focus。
- **两段式 Esc 保留**，作用于激活面板：第一下收起该面板 widget（词/高亮保留），第二下清空该面板搜索。
- **分屏高亮串词修复**：`LogViewer` 的 `searchQuery/searchConfig` 改为读**本面板**的 tab 状态（当前从 App 取激活面板的词，分屏时非激活面板高亮会串词）。
- **移除 App 根部全局 widget 渲染与 `isFindVisible` 双向同步逻辑**（面板直读 store）。

## Capabilities

### New Capabilities
- `find-widget-per-panel`: 每面板独立渲染的 find widget 实例；VSCode 对齐的结构/尺寸/交互（配色走项目主题 token）；非激活面板 widget 可见但非交互；Ctrl+F 重复按下 focus+select 已有词。

### Modified Capabilities
- `per-tab-search`: `LogViewer` 搜索高亮从"App 级激活面板的搜索词"改为"本面板的 tab 状态"，修复分屏下非激活面板串用激活面板搜索词的问题（含 `isFindVisible` 的渲染语义：全局单实例 → 每面板实例）。

## Impact

- **前端代码**：
  - `frontend/src/App.tsx`：删除全局 widget 渲染（L888-901）与 `isFindVisible` 双向同步（L292-311）；`Ctrl+F` 快捷键与 `onShowSearchHistory` 改为 `setFindVisible(activePanelId, true)` + focus 信号；无激活面板时 no-op
  - `frontend/src/components/EditorFindWidget.tsx`：重写为 VSCode 结构/尺寸 + 项目 token 配色；接收 per-panel 数据与回调
  - `frontend/src/components/EditorArea.tsx`：`LogViewerPanel` 内挂载每面板 widget（读 store + 上下文里的 `processedCache[本面板 fileId]`）；上下文可能新增导航回调
  - `frontend/src/components/LogViewer.tsx`：`searchQuery/searchConfig` 入参改为本面板 tab 状态（修复串词）
  - `frontend/src/store/searchStore.ts`：可能新增 focus 信号（`Ctrl+F` 重复按下触发 select）
- **测试**：`frontend/src/store/searchStore.test.ts` 现有 per-tab 测试保持绿；按 AC 新增单测/e2e（先红后绿）
- **无**：后端/API、依赖、构建配置变更
