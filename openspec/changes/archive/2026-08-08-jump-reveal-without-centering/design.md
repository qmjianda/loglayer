# Design: jump-reveal-without-centering

## Context

LogViewer（`frontend/src/components/LogViewer.tsx`）接收两个独立 prop：`highlightedIndex`（高亮光标，已实现"仅高亮不滚动"）与 `scrollToIndex`（滚动定位信号）。当前 `scrollToIndex` 的消费逻辑（365-373 行 useEffect）**无条件居中滚动**：`targetLogical = idx * lineHeight - viewportHeight / 3`，目标行定位到视口上 1/3 处。

所有跳转入口（搜索 next/prev、搜索完成自动跳、结果面板点击、F2 书签跳转、Ctrl+G goto）均经 `handleJumpToLine` / `useBookmarkLogic` 设置 `scrollToIndex`，导致连续浏览匹配/书签时页面反复抖动。唯一例外：文件 watch 滚底与顶部"新内容"按钮（`App.tsx` 传 `totalLines - 1`）依赖该信号"滚到底部"。

目标行为对齐 VS Code `revealPositionInCenterIfOutsideViewport`（源码 `viewLines.ts` `_computeScrollTopToRevealRange`）：目标行距视口边缘 ≥1 行时保持视口不动，仅移动高亮；贴近边缘（1 行内）或完全不可见时居中滚动至视口正中（1/2）。

## Goals / Non-Goals

**Goals:**
- 跳转在目标行完整可见时**不滚动页面**，仅移动高亮光标（连续浏览不抖）
- 目标行贴近边缘或不可见时**居中滚动至视口正中**（1/2，对齐 VS Code）
- 末行跳转保持**贴底**（watch 滚底 / "新内容"按钮行为不变）
- 行为收敛到 LogViewer 内部，所有调用方零改动

**Non-Goals:**
- 不改动 `highlightedIndex` 通道与高亮渲染（已是期望行为）
- 不拆分 `scrollToIndex` 信号（末行 clamp 贴底已验证，无需两套信号）
- 不处理 wordWrap 动态行高的像素级精度（沿用现有固定行高近似）
- 不新增设置项（安全区行数暂固定对齐 VS Code 的 1 行）

## Decisions

### D1: 可见性守卫采用行级近似（边缘安全区上下各 1 行）
目标行在 `[topVisibleLine + 1, topVisibleLine + visibleRows - 1]` 区间内 → 不滚动；否则居中滚动。

- **依据**：VS Code 以像素判断 `viewportStartY <= boxStartY && boxEndY <= viewportEndY`，其中 `boxStartY = targetTop - lineHeight`（`paddingTop` 恒为 1 行，因该路径 `minimalReveal=false`）。换算到固定行高的行级近似即上述区间。
- **备选 A**：目标行完整可见（含边缘）即不滚——更简单但**不忠实 VS Code**：目标行贴在视口顶/底边缘时 VS Code 会触发居中，用户实测已确认此差异。
- **备选 B**：像素级精确判断——LogViewer 当前 `topVisibleLine`/`visibleRows` 已是固定行高近似（wordWrap 下亦然），引入像素级判断收益有限且增加复杂度。

### D2: 居中系数从 `viewportHeight / 3` 改为 `viewportHeight / 2`
`targetLogical = max(0, idx * lineHeight - viewportHeight / 2)`，目标行滚到视口正中。

- **依据**：VS Code `newScrollTop = boxMiddleY - viewportHeight / 2`，真·正中。现有 1/3 是历史遗留。
- **备选**：保持 1/3——与 VS Code 不一致，否决。

### D3: 末行贴底依赖浏览器 clamp，不特殊处理
对 `idx = totalLines - 1`：`targetLogical = (totalLines-1) * lineHeight - viewportHeight/2`。与 `maxLogicalScroll = totalLines * lineHeight - viewportHeight` 之差恒为 `viewportHeight/2 - lineHeight > 0`（视口高度 ≥ 2 倍行高时必然成立），因此 `scrollTo` 被浏览器 clamp 到底部 = 贴底。

- **依据**：数学恒等式，无需分支。watch 滚底与"新内容"按钮（均传 `totalLines - 1`）自动获得贴底。
- **备选**：为滚底单独设 `scrollToBottom` 信号——信号拆分侵入调用方，否决。

### D4: 滚动目标沿用现有物理/逻辑映射（useScaling 兼容）
亿行压缩滚动模式下，`targetPhysical = (targetLogical / maxLogicalScroll) * maxPhysicalScroll` 的映射公式保持不变，仅替换 `targetLogical` 中的居中系数。可见性守卫判断使用 `logicalScrollTop` 推导的 `topVisibleLine`（已是逻辑坐标），无需额外换算。

### D5: 修改点收敛为单文件单函数
`LogViewer.tsx` 的 `scrollToIndex` useEffect：
```
若 scrollToIndex 目标行在安全区 [topVisibleLine+1, topVisibleLine+visibleRows-1] 内 → 直接 return（不滚动）
否则 → 按 D2 居中公式 scrollTo（useScaling 分支沿用 D4 映射）
```
`handleJumpToLine`（`useUIState.ts`）、`useBookmarkLogic`、watch 滚底均不修改。

## Risks / Trade-offs

| 风险 | 缓解 |
|:---|:---|
| wordWrap 开启时 `visibleRows` 是固定行高近似，安全区边界判断可能偏差 1-2 行，极端情况目标行贴近边缘时轻微误判（该滚未滚） | 偏差仅影响边缘 1 行内的场景；LogViewer 渲染本身已按此近似工作，用户观感无实质差异；e2e 验收覆盖固定行高主场景 |
| useScaling（亿行压缩滚动）下物理/逻辑坐标换算引入舍入误差，居中目标可能偏离 1-2px | 沿用现有映射公式（D4），误差量级与现状一致，不引入新问题 |
| 目标行滚入但数据未加载导致短暂占位渲染（高亮行空白） | 现有窗口 buffer（`windowBuffer = max(50, visibleRows)`）保证可视区及安全区内的行数据已拉取；居中滚动幅度小，触发的窗口平移先于渲染完成 |
| 连续快速跳转（Enter 连按）时多次 scrollTo 竞争 | 现有 `scrollToIndex` 150ms 清空机制已处理竞态（`useBookmarkLogic` 亦显式清 timeout），本次不改动该机制 |

## Migration Plan

- 纯前端行为变更，无数据/配置迁移。
- 发布即生效；回滚即还原 `LogViewer.tsx` 单函数改动。
- 验收：ATDD 阶段按 `specs/jump-navigation/spec.md` 场景编写验收测试，先红后绿。

## Open Questions

- 安全区行数固定为 1 行（对齐 VS Code）。日志场景是否需要可配置（如设置项 1~5 行）？——当前不引入，留待用户反馈。
- 居中系数 1/2 在"跳远距离"时下方留白较大（日志无内容），是否影响观感？——VS Code 同款行为，暂不调整。
