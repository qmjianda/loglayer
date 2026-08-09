# Proposal: jump-reveal-without-centering

## Why

当前所有跳转操作（搜索 next/prev、搜索完成自动跳最近匹配、结果面板点击、F2/Shift+F2 书签跳转、Ctrl+G goto）都经 `scrollToIndex` 触发 LogViewer **居中滚动**（目标行定位到视口 1/3 处）。连续浏览匹配或书签时，页面随每次跳转反复抖动，阅读上下文被打断。用户诉求：跳转在当前可视区域内时**仅移动高亮光标，不挪动文件**。

## What Changes

- `scrollToIndex` 消费逻辑对齐 VS Code `revealPositionInCenterIfOutsideViewport`（源码 `viewLines.ts` `_computeScrollTopToRevealRange`，经确认）：
  - 目标行距视口顶 ≥1 行、且底部不越出视口 → **不滚动**，仅由 `highlightedIndex` 更新高亮
  - 否则（目标行贴近顶部/底部约 1 行内，或完全在视口外）→ **居中滚动**，目标行定位到视口正中（1/2 处，从现有 1/3 调整为正中）
  - 目标为最后一行 → 居中目标值超过 `maxLogicalScroll`，被浏览器 clamp 到底部 = **贴底**（文件 watch 滚底 / "新内容"按钮场景行为保持不变）
- 行级近似的可见性守卫：目标行在 `[topVisibleLine + 1, topVisibleLine + visibleRows - 1]` 内不滚（上下各留 1 行安全距，对应 VS Code 的 1 行 padding）；现有居中算法仅将 `viewportHeight / 3` 调整为 `viewportHeight / 2`，其余不变。
- 所有调用方（`handleJumpToLine`、`useBookmarkLogic`、watch 滚底）**零改动**，行为收敛到 LogViewer 内部（唯一知道视口位置的地方）。
- 非 **BREAKING**：不改变任何接口/信号签名，仅当目标行处于视口边缘安全区内时不再触发滚动。

## Capabilities

### New Capabilities
- `jump-navigation`: 跳转定位的统一契约（对齐 VS Code `CenterIfOutsideViewport`：目标行处于视口边缘安全区内（距顶/底约 1 行内）→ 居中滚动至正中；安全区外完整可见 → 不滚动仅高亮；末行贴底），覆盖搜索匹配跳转、书签跳转、goto 行跳转、搜索结果点击四类入口。

### Modified Capabilities
- `per-tab-search`: 「跳转行为」Requirement 澄清——匹配行**已在视野内时不滚动**，仅更新高亮；视野外时沿用现有居中滚动（现有措辞"滚动使匹配行进入视野"隐含此意，需显式化）。
- `log-viewer-rendering`: 「键盘导航与辅助功能」的"跳转指定行"场景澄清——目标行已在视野内时不滚动，仅更新高亮。

## Impact

- **代码**：`frontend/src/components/LogViewer.tsx`（`scrollToIndex` 消费的 `useEffect`，约 365-373 行）为唯一修改点：① 增加边缘安全区可见性守卫；② 居中系数 `viewportHeight / 3` → `viewportHeight / 2`；可视性判断所需的 `topVisibleLine` / `visibleRows` 变量已存在，无需新增状态。
- **调用方**：`useUIState.handleJumpToLine`、`useBookmarkLogic`、`useFileWatch` 滚底、`onScrollToNewContent` 均保持发信号不变，行为由 LogViewer 统一裁决。
- **信号复用**：`scrollToIndex` 的双用途（跳转居中 + 滚底贴底）天然兼容——末行的 1/2 居中目标仍超过 `maxLogicalScroll` 被 clamp 到底部即贴底，无需拆分信号。
- **API/依赖**：无后端、无 REST/WS、无依赖变更。
- **测试**：LogViewer 当前无覆盖测试（blast radius 显示），需在 ATDD 阶段补充边缘安全区守卫的验收测试（单测或 e2e）。
