# Design: fix-wheel-scroll-scaling

## Context

目标：超大文件（`useScaling` 启用）滚轮滚动手感与小文件一致，每格滚动行数不随缩放比放大。

现状（`LogViewer.tsx` 165-179）：

- `realTotalHeight = totalLines × lineHeight`；`useScaling = realTotalHeight > MAX_SCROLL_HEIGHT(30M)`。
- `maxPhysicalScroll ≈ 30M`，`maxLogicalScroll ≈ 4.58 亿`（2290 万行）；放大比 ~15.3x。
- 无 wheel handler，滚轮走浏览器原生，物理像素放大 15.3x → 每格 ~76 行。

### 成熟开源参照（拼好码策略）

VS Code / xterm.js 共用 Scrollable 基础设施，处理百万行编辑器的滚轮（xterm 由 VS Code fork）：

- `StandardWheelEvent`（`mouseEvent.ts`）：deltaMode 归一化（DOM_DELTA_LINE ÷1/÷3，DOM_DELTA_PIXEL ÷40）。
- `SCROLL_WHEEL_SENSITIVITY = 50`（`scrollableElement.ts`）：归一化值 × 灵敏度 → 像素。
- 应用到逻辑滚动位置（`setScrollPosition` 统一入口），不直接改物理 scrollTop。

## Goals / Non-Goals

**Goals:**
- `useScaling` 启用时，滚轮每格滚动恒定的逻辑行数（与小文件一致），不再放大。

**Non-Goals:**
- 不改滚动压缩映射本身。
- 不改拖滚动条（拖条本就按比例）。
- 不迁移 react-virtuoso。

## Decisions

### D1: 拦截 wheel，deltaY 归一化为逻辑像素

- `useScaling` 启用时对滚动容器加 `wheel` 监听（`passive: false`），`preventDefault()` 停原生滚动。
- 归一化（参照 VS Code `StandardWheelEvent`）：
  - `deltaMode === 0`（DOM_DELTA_PIXEL）→ `deltaY` 直接作为逻辑像素（100px ≈ 5 行）
  - `deltaMode === 1`（DOM_DELTA_LINE）→ `deltaY × lineHeight`
  - `deltaMode === 2`（DOM_DELTA_PAGE）→ `deltaY × viewportHeight`
- 逻辑像素 → 物理像素：`physical = logical × maxPhysicalScroll / maxLogicalScroll`。
- `el.scrollTop = clamp(el.scrollTop + physical, 0, maxPhysicalScroll)`。

### D2: 抽纯函数 `wheelDeltaToLogicalPx`

- 纯函数 `wheelDeltaToLogicalPx(deltaY, deltaMode, lineHeight, viewportHeight)`，单测 deltaMode 三分支。

## Risks / Trade-offs

| 风险 | 缓解 |
|:---|:---|
| 触控板/惯性滚动被 preventDefault 后变生硬 | 仅 useScaling 启用时拦截；像素模式 deltaY 原样透传，不做固定行数裁剪，保留触控板连续性 |
| wheel 监听影响横向滚动（shift+wheel / deltaX） | 仅处理 deltaY（纵向）；deltaX 不拦截 |
| 拖条与滚轮交互冲突 | 滚轮只改 scrollTop，不碰拖条逻辑 |

## Migration Plan

- 纯前端，无数据迁移。
- 回滚 = 移除 wheel 监听。
- 验收：ATDD 单测 `wheelDeltaToLogicalPx` 三分支 + heavy e2e 超大文件滚轮不跳行。
