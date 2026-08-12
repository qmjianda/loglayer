# Proposal: fix-stats-follow-tab-switch

## Why

GitHub issue #3：打开多个文件时，右侧属性栏"文件概要"的 ERROR/INFO 等
统计信息只显示**最后打开的文件**的统计；分屏/切 tab 后统计不随激活文件切换。

根因：`App.tsx` 的 `fetchLogLevelStats(fileId)` 仅在 `onFileLoaded`（文件
加载完成信号）时拉取一次。`useEffect([activeFileId])` 只在 `!activeFileId`
时清空统计，**不重新拉取**——切 tab 到已加载文件时统计停留在旧文件的值。

## What Changes

### 前端

1. **切 tab 重新拉取统计**
   - `useEffect` 监听 `activeFileId`：目标文件已加载（`getBridgedCount` 有值）
     时重新调用 `fetchLogLevelStats(activeFileId)`。
   - 文件尚未加载（首次打开/索引中）时不拉取（沿用 onFileLoaded 触发路径），
     避免与索引并行 + 重复请求。

## Out of Scope

- 统计接口后端性能优化（rg 扫描已足够快）。
- 多面板同时显示不同统计（当前右侧操作台为单例，随激活面板切换）。
