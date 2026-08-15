# Proposal: fix-wheel-scroll-scaling

## Why

超大文件（>150 万行，`useScaling` 启用）滚轮滚动过快：滚一格跳几十~上百行，无法精确定位。根因（已由代码分析确认，非猜测）：

1. 滚动缩放把物理滚动高度压缩到 `MAX_SCROLL_HEIGHT = 3000万 px`，逻辑高度 = 总行数 × 行高（2290 万行 ≈ 4.58 亿 px）。
2. 滚轮是浏览器**原生**滚动，移动物理 `scrollTop`（每格 ~100px），经 `logicalScrollTop = scrollTop/maxPhysical × maxLogical` 放大 **~15.3 倍** → 每格 ~76 行。
3. `WHEEL_LINES_PER_TICK = 3` 常量已定义但全项目 0 处使用，滚轮 handler 从未接线。

## What Changes

- **滚轮按逻辑行滚动**：`useScaling` 启用时拦截 `wheel` 事件，按 `deltaMode` 归一化 `deltaY` 为逻辑像素，再反算物理滚动量，使每格滚动的行数与文件大小/缩放比无关（与小文件原生滚动手感一致）。

## 本次不做的范围

- 不迁移到 react-virtuoso（千万行滚动缩放是硬需求，见 fix-scroll-empty-screen design D4）。
- 不改滚动压缩映射本身（压缩高度 + 物理→逻辑映射保留）。
- 不改拖滚动条（拖条 teleport 本就按比例，正确）。

## Capabilities

### New Capabilities

（无 —— 本变更为修正/补强既有行为，不引入新能力。）

### Modified Capabilities

- `log-viewer-rendering`: 补充「滚轮滚动按逻辑行、不随缩放放大」的滚动一致性语义（新增 Requirement）。

## Impact

- **前端**：`frontend/src/components/LogViewer.tsx`（`useScaling` 时拦截 wheel + deltaMode 归一化）、`frontend/src/utils/wheelDelta.ts`（纯函数 `wheelDeltaToLogicalPx`）。
- **测试**：单测（deltaMode 0/1/2 三分支）+ heavy e2e（超大文件滚轮不跳行）。
- **性能红线**：滚轮 handler O(1)；调试日志走统一开关。
