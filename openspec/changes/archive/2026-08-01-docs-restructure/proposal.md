# Proposal: docs-restructure

## Why

`docs/` 下的文档是 2026-02 遗留的静态快照，此后 5 个月项目经 openspec 持续演进（dockview 分屏、preload 优化、AI 助手），docs 已严重过时且无维护机制。目标：让 AI 新会话通过一个入口快速建立项目心智模型（概况 + 规则 + 粗略架构），状态类信息不再入文档（由 openspec 查询），所有后续变更统一走 openspec。

## What Changes

- **AGENTS.md 重写为唯一启动入口**：项目概况 + 技术栈 + 命令 + 粗略架构地图（模块 + 数据流）+ 规范 + 导航指针。
- **删除 `docs/PROGRESS.md`**：开发状态不再手写，改由 `openspec-cn list/status --json` 实时查询。**BREAKING**：新会话不再依赖此文件。
- **删除 `docs/CONTEXT.md` 的现状部分**：模块地图移入 AGENTS.md 架构地图；关键接口与已知限制压入 AGENTS.md 小节，不再维护独立副本。
- **`docs/AI_SESSION.md` 移入 `.opencode/commands/`**：作为会话工作流模板而非文档。
- **`docs/TECHNICAL_DECISIONS.md` 分拆**：已决策的 TD-001~008 冻结为历史 ADR 保留；待决策的 TD-009~010 转为 openspec 变更 backlog（新提案）。
- **保留深潜文档**：`docs/LAYER_DEV_GUIDE.md`（图层开发指南）、`docs/INDEXING_OPTIMIZATION.md`（索引优化）按需留存，AGENTS.md 提供指针。
- **`docs/README.md`** 更新为精简导航或删除（并入 AGENTS.md）。

## Capabilities

### New Capabilities
- `project-docs`: 项目文档体系组织规则——AGENTS.md 作为唯一会话入口，状态类信息由 openspec 查询承载，深潜文档按需留存。

### Modified Capabilities
<!-- 无：现有 specs（dockview-split、preload-optimization）行为不受影响 -->

## Impact

- **文件**：`AGENTS.md`（重写）、`docs/`（删 PROGRESS/CONTEXT 现状、AI_SESSION 迁移、README 更新）、`.opencode/commands/`（新增）。
- **流程**：所有未来 AI 会话的启动路径改为「读 AGENTS.md + 查 openspec 状态」，不再读 4 个 docs 文件。
- **无代码变更**：不触碰前后端逻辑；`docs/` 引用方（AGENTS.md 内指针、e2e 等）需同步核对。
