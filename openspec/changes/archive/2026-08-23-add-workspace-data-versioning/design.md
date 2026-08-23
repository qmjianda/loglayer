# add-workspace-data-versioning 设计

## Context

动机参见 proposal.md - Why。现状要点：

- `workspace_store.py:_init_schema` 每次启动无条件 `INSERT OR REPLACE` 当前版本常量到 `schema_version` 表——数据真实版本的记录从未保留，任何检测都无从谈起。
- 工作区数据集中在单 SQLite 文件 `.loglayer/workspace.db`（`kv` + `files` 两张业务表），已有 `threading.RLock` 串行化写入与显式事务先例（`set_files`）。
- 开发版策略：版本不一致即整体删除重建；真正的迁移功能推迟到正式版按需实现。

## Goals / Non-Goals

**Goals:**
- 版本记录可信：read-compare-decide，只在重置完成后推进版本戳。
- 不一致时一次性清空 `kv`、`files` 并重建空结构，行为可日志诊断。
- 未来接入真实迁移时只改一个函数，不扩散调用面。

**Non-Goals:**
- 不做注册表/步骤链/TRANSFORM 接口/备份（正式版再加）。
- cache.db 不纳入。
- 不提供 CLI 与手动迁移工具。

## Decisions

### D1: 单一版本入口函数 `ensure_data_version(store)`

- `WorkspaceStore.__init__` 调用它替代现在的无条件覆写。逻辑：
  1. 读 `schema_version` 表当前值；
  2. 等于 `DATA_VERSION` → 直接返回；
  3. 否则（含表不存在/无记录）→ 事务内 `DELETE FROM kv; DELETE FROM files; UPDATE schema_version`，并打印 `[WorkspaceStore]` 前缀日志（旧值 → 新值）。
- **备选否决**：在 main.py 启动流程做检查——存储职责泄漏到装配层，且绕过 store 内部锁。

### D2: 删除重建在同一事务内完成

- 复用既有显式事务模式（`isolation_level=None` + `BEGIN/COMMIT/ROLLBACK`）：清空两表与写版本戳原子生效，中途崩溃不会出现"数据已删但版本未推进"的半态（下次启动重做，幂等）。
- **备选否决**：删除整个 db 文件重建——连接持有中不可靠且过度。

### D3: 版本号语义为整数递增

- `DATA_VERSION: int = 2` 起始（1 视为"无版本机制的遗留数据"，天然触发一次重置，正好清除存量脏布局）。
- **备选否决**：semver 字符串——开发期只需单调递增，比较逻辑越简单越不容易出 bug。

## Risks / Trade-offs

- [用户书签/设置随重置丢失] → 开发版可接受（proposal 明示）；正式版引入真实迁移前不得随意 bump 版本号，code review 检查项。
- [并发请求在重置窗口读到空数据] → 重置发生在 `__init__`（REST 服务启动前），无并发窗口；RLock 兜底。
- [误 bump 版本号导致频繁重置] → 日志可见 + review 把关；开发期损失可控。

## Migration Plan

纯后端单文件改动。首次启动自动重置一次存量数据（预期行为），回滚 revert 即可。

## Open Questions

（无）
