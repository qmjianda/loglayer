# fix-ctrl-f-focus-race 设计

## Context

复现取证（`VITE_PROBE=1` 探针日志 + `workspace.db` 原始 JSON）：

```
[Probe:LogPanel] { dockviewId: 'log-view-x8om9c', paramPanelId: 'log-view-x8om9c', match: true  }  ← 正常面板
[Probe:LogPanel] { dockviewId: 'log-view-syw6zd', paramPanelId: '',                match: false }  ← 故障面板
```

故障面板在 `kv['layout']` 中 params 只有 `{fileId, uri}`——早于 87ba32d（2026-08-09 引入 per-tab find widget 与 `params.panelId`）的历史布局，经 toJSON/fromJSON 跨会话原样延续。双真相源在此分裂：请求链写 `tabs[dockview id]`，组件读 `tabs[params.panelId ?? '']`。

## Goals / Non-Goals

**Goals:**
- 面板身份单一来源：dockview `api.id`，从结构上消灭"副本失步"这一类问题。
- 净删代码：移除冗余参数与临时探针。

**Non-Goals:**
- 不实现 activePanelId 回退、focusRequest 哨兵、isActive 补聚焦（实测未触发，见 proposal Out-of-Scope）。
- 不处理后端/数据清理（由 `add-workspace-data-versioning` 负责）。

## Decisions

### D1: 身份源统一为 api.id（取代原 D0-D3 全部决策）

- `LogViewerPanel` 内 `const panelId = api.id`（原 `params.panelId ?? ''`）；`LogViewerPanelParams` 删除 `panelId` 字段；3 处 `addPanel` 删除该参数写入。
- **为什么是删除而不是兜底（`?? api.id`）**：兜底保留双源结构，未来任何写坏 params 的路径仍会复发；统一后该类脏数据从根上不可能再产生。用户明确倾向简洁与统一。
- **备选否决**：挂载时自愈写回 `updateParams({panelId})`——引入运行时写布局的副作用面（重存、事件循环风险），且同样保留双源。

### D2: 探针代码随变更一并清除

`utils/probe.ts` 及 searchStore/useUIState/EditorArea/EditorFindWidget 中的全部 `[Probe:*]` 调用点删除；验收依赖既有测试与新 e2e 场景，不留调试基建。

## Risks / Trade-offs

- [remapPanelIds 仍需存在] → 它服务旧 id 格式 `log-*` → `log-view-*` 的映射，与本变更正交，保持不动。
- [e2e 选择器依赖] → `[data-find-widget-panel]` 使用 widget prop（现在等于 api.id），值格式不变，无影响。
- [存量脏布局在版本框架上线前仍故障] → 两变更独立交付、顺序不敏感；若本变更先上，用户关闭重开该文件即自愈（新 addPanel 不再产生副本）。

## Migration Plan

纯前端净删改动，无迁移。回滚 revert 即可。

## Open Questions

（无）
