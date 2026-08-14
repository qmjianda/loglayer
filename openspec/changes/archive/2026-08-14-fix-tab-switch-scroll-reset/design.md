# Design: fix-tab-switch-scroll-reset

## Context

动机见 proposal.md - Why。现状与约束：

- LogViewer 用「外层 `overflow-auto` 滚动容器 + spacer」实现 DOM 虚拟滚动，`scrollTop` 是物理滚动位置（DOM 属性），React state 通过 `onScroll` 同步。
- 滚动容器位于 dockview 面板内部。dockview 默认 `onlyWhenVisible` renderer 在切 tab 时对失活面板执行 `element.remove()`，重新激活时 `appendChild`，导致 `scrollTop` 归零且静默。
- 现有「滚动位置看门狗」（`render-throttling`）用 rAF 逐帧检测并拉回，属治标补丁。
- 根因已由源码（dockview-core 7.0.4）与运行时日志双重证实；`defaultRenderer="always"` 已在本项目实测根治归零、未触发 dockview 的 move 坑、内存无感。

## Goals / Non-Goals

**Goals:**
- 滚动位置在切 tab / 分屏切 tab 后原生保持，无需任何逐帧检测或拉回逻辑。
- 移除看门狗及相关配套代码，消除常驻 rAF 的空闲开销（对应原「常驻逐帧看门狗」的无效 CPU 占用）。
- 不破坏拖拽移动面板的行为（always 的已知坑不回归）。

**Non-Goals:**
- 不处理「切 tab 冗余 `syncAll`」（该问题归 Change B：空屏优化 + 去冗余 syncAll）。
- 不调整虚拟滚动的窗口/缓存策略（属 Change B）。
- 不迁移 `LOGVIEWER_SCROLL_STORE`（跨重挂载恢复滚动位置的既有机制保持不变）。

## Decisions

### D1: 用 `defaultRenderer="always"` 根治，而非「激活后确定性恢复」

- **理由**：`always` 让失活面板内容常驻 DOM（`visibility:hidden`），`scrollTop` 从源头不丢失，任何恢复逻辑都不需要；而「激活后确定性恢复」仍需处理 dockview re-parenting 时序 + `syncAll` 触发的污染性 scroll 事件，复杂且脆弱。
- **备选 A**（保留 `onlyWhenVisible` + `onDidActivePanelChange` 恢复）：需精确对齐 dockview 激活时序，且受 `syncAll` 污染影响——否决。
- **备选 B**（继续修看门狗）：已被两次历史变更（jump-reveal 2.5、perf-deepening 2.1）证明治标失败——否决。

### D2: 移除看门狗 rAF 循环及其「防误判」配套同步

- 移除 `LogViewer.tsx` 的看门狗 `useEffect`（逐帧检测 `top===0 && state>0` 并拉回）。
- 移除为防看门狗误判而存在的 `scrollStateRef` 同步：`onScroll` 中同步 ref、`scrollToIndex` 中同步 ref、文件切换恢复流程（`reassert`）中对 `scrollStateRef` 的断言。
- **理由**：`always` 下不再产生「DOM=0 但 state>0」的脱节，看门狗成为死代码；保留它意味着常驻 rAF 的空闲开销与无意义的状态同步。
- **边界**：`LOGVIEWER_SCROLL_STORE` 的读写（`onScroll` 存、挂载时恢复、卸载时存）保留——它负责「跨重挂载」恢复，与看门狗无关，且是 `always` 之外（如面板关闭重开）仍需要的机制。

### D3: 验收覆盖 always 的 move 坑

- dockview 官方注释记录 `always` 下「拖拽移动面板后内容可能不显示」。本项目实测未触发，但作为已知风险，在 spec 中新增「拖拽移动面板后内容仍显示」场景，验收测试与手动回归均覆盖。

## Risks / Trade-offs

| 风险 | 缓解 |
|:---|:---|
| `always` 下失活面板内容常驻 DOM，内存略增 | 仅失活面板的窗口内 DOM 节点（虚拟滚动，非全量内容）；实测无感；关闭文件仍释放（dockview removePanel → React unmount + 后端 close_file） |
| dockview 已知 move 坑（拖拽移动面板后内容不显示） | spec 新增场景 + 验收测试 + 手动回归覆盖；若实测触发则需额外兜底（当前未触发） |
| `always` 是 dockview 内部行为，未来版本可能变更 | 本变更为点状配置改动，回滚即还原一行（移除 `defaultRenderer="always"`） |

## Migration Plan

- 纯前端配置 + 死代码移除，无数据迁移。
- 发布即生效；回滚 = 移除 `defaultRenderer="always"` 一行 + 还原看门狗代码。
- 验收：ATDD 阶段按 `specs/render-throttling/spec.md` 的 3 个场景写验收测试（切 tab / 分屏切 tab 滚动位置保持、拖拽移动面板内容显示），先红后绿。
