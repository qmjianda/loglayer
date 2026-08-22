# fix-ctrl-g-duplicate-widget 设计

## Context

当前存在两处独立的 Ctrl+G 处理：

1. `frontend/src/hooks/useUIState.ts` 全局 `keydown`（约 :198-200）→ `setIsGoToLineVisible(true)` → `AppOverlays.tsx` 渲染 App 级 `<EditorGoToLineWidget>`。
2. `frontend/src/components/LogViewer.tsx` 自挂的 `window keydown`（约 :478-481）→ 本地 `showGoToLine` state → 在滚动容器内部渲染第二个 `<EditorGoToLineWidget>`（:779-788）。

两个 widget 的输入框都在挂载时 `focus()`。LogViewer 内嵌实例为 `absolute top-0` 定位，位于滚动容器的可滚动溢出区内：scrollTop > 0 时该元素在视口外，聚焦触发浏览器 scroll-into-view，把容器拉回顶部。

跳转执行链路：App 级 `onGoToLine`（App.tsx 约 :888）与 LogViewer 内嵌 `onGo` 均最终走 `onLineClick` + `scrollToLine`（基于 `computeRevealScrollTop`），此链路本身正确，保留不动。

## Goals / Non-Goals

**Goals:**

- Ctrl+G 单一入口、单一 widget 实例。
- 打开/关闭跳转框对 scrollTop 零副作用。
- 保留现有 Enter 跳转、Escape 关闭行为。

**Non-Goals:**

- 不改动 `computeRevealScrollTop` 跳转定位算法（归 jump-navigation 既有需求管）。
- 不处理其他快捷键的双监听审计（如发现同类问题另立变更）。

## Decisions

### D1: 收敛到 App 级单例，删除 LogViewer 内部实现

- 删除 LogViewer.tsx 中 Ctrl+G 分支、`showGoToLine` state、内嵌 `<EditorGoToLineWidget>` JSX 及相关 import。
- 保留 useUIState → AppOverlays 链路作为唯一入口。
- **备选**：保留组件级、删 App 级——否决，因为组件级 widget 必须渲染在面板内部才能拿到局部上下文，而它正是 scroll-into-view 问题的根源；AppOverlays 已有完整的 `onGoToLine` 接线，收敛成本最低。

### D2: App 级 widget 用 fixed/portal 锚定视口

- 确认 AppOverlays 的 widget 容器不位于任何滚动容器的内容流中；若当前为 absolute 且祖先含滚动容器，改为 `fixed` 定位（或 createPortal 到 body）。
- **备选**：保留 absolute 但给 input 加 `preventScroll` focus 选项——作为兜底防御一并加上（`inputRef.current?.focus({ preventScroll: true })`），双保险，成本低。

### D3: 全局 Ctrl+G 幂等守卫

- useUIState 中 `isGoToLineVisible === true` 时再按 Ctrl+G 不重复 setState，仅让既有输入框重新聚焦（可通过给 EditorGoToLineWidget 加 focusRequest 计数 prop 实现，与 find widget 的 `requestFocus` 模式一致，复用既有模式）。
- **备选**：不做守卫（setState 同值无副作用）——但"再次按下聚焦已有框"是更好的语义且与 VS Code 一致。

## Risks / Trade-offs

- [删除组件级快捷键后，dockview 多面板场景下跳转目标面板歧义] → 与现状一致：App 级 `onGoToLine` 已定义目标面板解析逻辑，本变更不改变该语义。
- [focusRequest 模式引入轻微状态复杂度] → 复用 searchStore 已验证的模式，认知成本低。
- [`focus({ preventScroll })` 在个别浏览器版本不支持选项] → 主路径靠 fixed 定位已消除问题，preventScroll 仅兜底。

## Migration Plan

纯前端改动，无数据迁移。回滚即 revert 提交。

## Open Questions

（无）
