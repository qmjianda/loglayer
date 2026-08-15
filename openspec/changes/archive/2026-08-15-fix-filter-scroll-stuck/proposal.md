# Proposal: fix-filter-scroll-stuck

## Why

添加过滤图层后，日志内容从多页缩到 1 页，但滚动条仍停留在旧位置（如第 10 页），视口显示空白——需手动滚回顶部才能看到过滤后的内容。

**根因（已由复现 + 布局 dump + A/B 测试确认，非猜测）：**

Overview Ruler（右侧分布标尺）用 `transform: translateY(scrollTop)` 实现"固定在视口顶部"的 sticky 效果。这个 transform 基于 React 的 `scrollTop` **state**，而 state 在内容收缩后不会自动归零。于是形成死锁：

```
加 FILTER → totalLines 3000→30 → spacer 60100px→805px（正确缩小）
  → 但 scrollTop state 仍是 8050（第10页）
  → Ruler transform: translateY(8050px) → 视觉位置 y=8050..8855
  → 该 transform 贡献给 scrollable overflow → scrollHeight 被虚撑到 8855
  → scrollTop=8050 仍是"合法"值（max = 8855-805 = 8050）
  → 浏览器不 clamp，不触发 scroll 事件 → scrollTop state 永不归零 → 死锁
```

关键证据（Playwright 实测，`[data-logviewer]` 布局）：

| 指标 | 过滤前 | 过滤后 |
|---|---|---|
| totalLines | 3000 | 30 ✓ |
| spacer height | 60100px | 805px ✓ |
| **scrollTop** | 8050 | **8050（卡住）** |
| **scrollHeight** | 60100 | **8855（未缩到 805）** |
| Ruler transform | translateY(8050px) | translateY(8050px) |

`scrollHeight 8855 = 8050(旧 scrollTop) + 805(clientHeight)`，即被 ruler 的 transform 虚撑。

**A/B 测试结论**：将 `LogViewer.tsx`/`EditorArea.tsx` 还原到 HEAD（`onlyWhenVisible` + 有看门狗）后复现，行为完全一致——本 bug 为 pre-existing，与 `2026-08-14-fix-tab-switch-scroll-reset` 变更无关。

## What Changes

- **根因修复（复用 VS Code 成熟架构）**：将 Overview Ruler 从滚动容器内部移出，改为滚动容器的**兄弟节点**，`position: absolute` 定位在外层非滚动 `relative` 包裹层上，删除 `translateY(scrollTop)`。这是 VS Code `minimap`/`overviewRuler` 的既有一致做法（`src/vs/editor/browser/view.ts`：minimap/overviewRuler 均为 `overflowGuardContainer` 的子节点、scrollbar 的兄弟，`position:absolute`，不参与 scrollHeight）。移出后 ruler 不再贡献 scrollable overflow，浏览器原生 clamp 恢复工作，"内容收缩→滚动条归零"零成本。
- **为何不选其它方案**：
  - `position: sticky`（react-virtuoso 做法）：适合 header/group 等 in-flow 元素，但 LogLayer 的 ruler 是 `absolute` 右栏布局，改造需侵入行渲染，收益不如移出。
  - 显式 clamp `scrollTop`（ngx-datatable 等社区 workaround）：属治标 band-aid，需在 render 后/paint 前精确触发，有竞态；根因（transform 虚撑 overflow）仍在。

## 调研结论（拼好码：优先复用成熟方案）

- **VS Code/Monaco**：minimap + overviewRuler 是滚动容器的兄弟节点（`position:absolute`，非滚动父容器内），是"编辑器 + 右侧标尺"场景的权威实现——与 LogLayer 完全同构。
- **react-virtuoso / react-window**：sticky 元素一律用 CSS `position: sticky`，不用 `transform: translateY`；且不程序化 clamp scrollTop，信任浏览器原生 clamp（react-window `useVirtualizer.ts` 注释「Guard against temporarily invalid indices that may occur when item count decreases」）。
- **CSS Transforms Module §2**：`transform` 会扩展（不缩小）overflow area；`position: sticky` 仅按静态位置参与 scrollHeight。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `render-throttling`: 「滚动位置保持」requirement 的语义从"面板切换/重挂载时保持"扩展为"内容收缩后滚动位置归零（不再卡在越界位置）"。

## Impact

- **前端**：`frontend/src/components/LogViewer.tsx`（Overview Ruler 移出滚动容器为兄弟节点 + 外层 relative 包裹层，删除 `translateY(scrollTop)`）。
- **测试**：e2e（滚到中部 → 加过滤 → 断言 `scrollTop` 归零、`scrollHeight` 收敛到新内容高、视图非空白）+ 组件级回归（ruler 仍固定在视口顶部、分布/书签/拇指指示器位置正确）。
- **性能红线**：纯 DOM 结构调整，无热路径改动；ruler 渲染逻辑不变（仅定位方式改变）。
