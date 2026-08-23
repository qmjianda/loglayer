# fix-ctrl-f-focus-race 提案

## Why

**实测根因（探针复现取证，非最初假设的时序 race）**：面板身份存在双真相源——dockview `panel.id`（权威，激活事件/Ctrl+F 请求链使用）与 `params.panelId`（addPanel 时手工塞入的副本）靠约定保持一致。历史遗留布局（2026-08-09 87ba32d 引入该参数之前创建、经 `.loglayer` 持久化跨会话永生）缺失 `params.panelId`，导致：

```
Ctrl+F → requestFocus(dockview id) ✓ 写入 tabs[dockview id]
LogViewerPanel 读 tabs[params.panelId ?? ''] → 永远读到 null
→ tab?.isFindVisible 恒 false → widget 永不挂载 → 该面板 Ctrl+F 永远无响应
```

分屏两面板一好一坏、好面板一切正常——与探针日志完全吻合（`match: false`，`paramPanelId: ''`）。存量脏数据由 `add-workspace-data-versioning` 变更清除。

## What Changes

- **身份源统一**：面板身份唯一来源改为 dockview `api.id`；`LogViewerPanel` 不再读取 `params.panelId`。
- **删除冗余副本**：从 `LogViewerPanelParams` 接口移除 `panelId` 字段，3 处 `addPanel` 调用点不再写入该参数（净删代码）。
- 清理复现期间引入的临时探针代码（`utils/probe.ts` 及全部调用点）。

### Out of Scope（原设计 D1/D2/D3，经评审移除）

- ~~activePanelId 为空时回退选择面板~~、~~focusRequest ref 哨兵~~、~~isActive 翻转补聚焦~~：静态分析存在但实测未观测到触发（restore 时事件链已正确设置激活面板）；为未发生的 race 增加代码路径不符合简洁原则。若将来实测复现，另立最小变更。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `find-widget-per-panel`: 新增需求——面板身份 SHALL 以 dockview panel id 为唯一来源，任何来源的面板（新建/布局恢复）其 find widget 与 per-tab 搜索状态 SHALL 一致可达；Ctrl+F 打开/聚焦语义保持可靠。

## Impact

- **前端**：`frontend/src/components/EditorArea.tsx`（1 处读取改 `api.id`、接口瘦身、3 处 addPanel 删参数）、删除 `frontend/src/utils/probe.ts`。
- **行为**：任何面板的 Ctrl+F 均正常打开并聚焦搜索框。
- **无后端改动。**
