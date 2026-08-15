# Design: fix-filter-scroll-stuck

## Context

动机见 proposal.md - Why。现状与约束：

- LogViewer 用「外层 `overflow-auto` 滚动容器 + spacer」实现 DOM 虚拟滚动；spacer（in-flow，`height = totalLines * lineHeight`）是唯一应决定 `scrollHeight` 的元素。
- Overview Ruler（右侧分布标尺）目前是滚动容器的**子元素**，用 `position: absolute + transform: translateY(scrollTop)` 模拟"固定视口顶部"的 sticky 效果。
- CSS Transforms Module §2 明确：`transform` 会**扩展** scrollable overflow area（"transforms can extend the size of the overflow area"）。当内容收缩（totalLines 减小）而 `scrollTop` state 未归零时，ruler 的 `translateY(旧值)` 把 `scrollHeight` 虚撑住，阻止浏览器原生 clamp → 死锁（复现数据见 proposal）。
- 成熟方案（已调研）：VS Code 的 minimap/overviewRuler 是滚动容器的**兄弟节点**（`overflowGuardContainer` 内、`scrollbar` 旁），`position:absolute` 定位在非滚动父容器上，不参与 scrollHeight。react-virtuoso / react-window 的 sticky 元素一律用 CSS `position:sticky`，不用 `translateY`。

## Goals / Non-Goals

**Goals:**
- 内容收缩后滚动条归零（`scrollTop` 回到合法范围 `[0, max]`），不再卡在越界旧位置。
- ruler 视觉行为不变：仍固定视口顶部，分布/书签/拇指指示器位置正确。
- 复用 VS Code 架构（overlay 移出滚动容器），不引入自研 clamp。

**Non-Goals:**
- 不改动 ruler 的渲染内容与数据来源（`layerStats` / `bookmarks` / `logicalScrollTop` 推导）。
- 不改动 fetch / 预取逻辑（属 fix-scroll-empty-screen，避免重叠）。
- 不迁移到 react-virtuoso（属更大范围的架构决策，另行评估）。

## Decisions

### D1: 将 ruler 移出滚动容器为兄弟节点（VS Code minimap 模式）

- 外层新增 `relative` 包裹层，滚动容器与 ruler 均为其子节点；ruler 用 `absolute right-0 top-0`，删除 `transform: translateY(scrollTop)`。
- **理由**：ruler 不再贡献 scrollable overflow，`scrollHeight` 仅由 spacer 决定，浏览器原生 clamp 恢复工作；与 VS Code minimap/overviewRuler 架构一致，零自研。
- **备选 A（`position: sticky`）**：适合 in-flow 的 header/group（react-virtuoso 做法）；LogLayer 的 ruler 是 `absolute` 右栏布局，改造需侵入行渲染，收益不如移出——否决。
- **备选 B（显式 clamp `scrollTop`）**：ngx-datatable 等社区的 workaround，属治标 band-aid，需在 render 后/paint 前精确触发、有竞态，且根因（transform 虚撑 overflow）仍在——否决。

### D2: ruler 内部指示器继续读组件级 scrollTop state

- ruler 的 thumb / 分布 / 书签位置由 `logicalScrollTop` / `realTotalHeight` 等**组件级状态**推导，移出滚动容器后仍可访问，无需依赖 DOM 滚动位置，零改动。

## Risks / Trade-offs

| 风险 | 缓解 |
|:---|:---|
| 外层包裹层改变 flex 布局 / 尺寸 | wrapper 用 `flex-1 min-w-0 min-h-0 relative`，滚动容器改 `h-full w-full`；e2e 断言容器高度仍为真实可视区（复用 `assert_not_blank_screen` 语义） |
| ruler 移出后与滚动条 / 内容边缘重叠 | ruler 仍 `right-0 top-0`、宽 12px 不变，与现状视觉一致 |
| 与 fix-scroll-empty-screen 同改 LogViewer.tsx | 代码区域不重叠（本变更改 render JSX，其改 fetch / 预取 hooks），但同文件有 git 合并风险；实现顺序建议在其落地后进行（见 tasks 0.x） |

## Migration Plan

- 纯前端 DOM 结构调整，无数据迁移。
- 回滚 = 还原 LogViewer.tsx 的 return JSX 结构（ruler 移回 + 恢复 translateY）。
- 验收：ATDD 按 `specs/render-throttling/spec.md` 的 3 个场景写验收测试，先红后绿。
