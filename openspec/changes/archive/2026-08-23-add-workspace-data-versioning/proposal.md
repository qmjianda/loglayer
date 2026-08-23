# add-workspace-data-versioning 提案

## Why

`.loglayer/workspace.db` 的持久化数据没有可信版本记录，格式随功能演进时存量数据无法识别。已造成必现 bug：2026-08-09（87ba32d）引入 `params.panelId` 之前的旧布局恢复后缺失该字段，面板身份错位、该面板 Ctrl+F 永远无法弹出搜索框，且脏数据经 toJSON 跨会话永生。

现有 `schema_version` 表是摆设：`workspace_store.py:_init_schema` 每次启动用二进制当前版本无条件覆写，数据实际版本的记录从未保留。

当前为开发版本，策略从简：**版本不一致即整体删除重建**。真正的版本间迁移功能推迟到正式版出现重大数据格式决策时再实现。

## What Changes

- **修复版本号覆写缺陷**：启动时读取已存版本并与当前常量比较；仅在不一致处理完成后才写入新版本戳。
- **版本不一致 → 删除重建**：清空 `kv`、`files` 表全部数据并重建空表（布局、文件历史、书签、设置一并重置；cache.db 不在范围内）。
- **预留单一接缝**：版本判定与删除动作收敛在一个函数内（如 `ensure_data_version(store)`），未来实现真实迁移时只改这一处，不扩散。
- 用户可感知性：发生删除重建时打一条带 `[WorkspaceStore]` 前缀的日志说明旧数据被重置。

### Non-Goals

- 不做迁移步骤注册表、TRANSFORM 接口、备份机制、diagnostics 暴露——正式版按需再加。
- cache.db 不纳入版本管理。
- 不做 CLI 工具与手动迁移。

## Capabilities

### New Capabilities

- `workspace-data-versioning`: 工作区持久化数据的版本检测与不一致时删除重建。

### Modified Capabilities

（无）

## Impact

- **后端**：`backend/loglayer/workspace_store.py` 单文件改动（修覆写缺陷 + 版本比较 + 清空逻辑）。
- **前端**：无改动（数据被清空后走既有空工作区路径）。
- **行为**：存量用户首次启动后布局/文件历史/书签/设置一次性重置，此后仅在数据版本变更时再次发生。
- **关联**：与 `fix-ctrl-f-focus-race`（身份源统一为 api.id）独立交付，组合后彻底消除面板身份类问题。
