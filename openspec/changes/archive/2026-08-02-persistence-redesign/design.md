# persistence-redesign Design

## Context

LogLayer 是桌面日志分析应用（React + FastAPI + pywebview）。当前持久化碎片化：

| 状态类别 | 当前位置 | 问题 |
|:---------|:---------|:-----|
| 布局（dockview） | 浏览器 `localStorage`（`loglayer_dockview_layout`） | 不随工作区走；view id 含每次变化的 `fileId`，刷新后恢复对不上 → 分屏错乱 |
| 文件历史 / wasOpen / 图层 | `.loglayer/config.json`（手写 JSON，`version=2`） | 手写 schema，无原子写、无校验、无迁移框架 |
| 书签 | 后端内存 + `session.rendering_cache`（书签存 session，未持久化） | 关闭即丢失 |
| 索引缓存 | SQLite `cache.db`（`SqliteMetadataCache`） | 已有 SQLite 基建，但只服务索引 |

**数据决策**：`.loglayer/config.json` 与 `.loglayer/cache.db` 的旧数据**不迁移、直接废弃删除**，全新起点。所有状态由新统一存储接管。

约束：
- 后端 Python 3.10+，仅依赖标准库 `sqlite3`，无 ORM
- 前端 React 19 + TS，无持久化库
- 桌面应用有工作区概念（`.loglayer/` 目录），`--no-ui` + 浏览器模式也要工作

## Goals / Non-Goals

**Goals:**
- 一个统一持久化底座，承载布局、图层、书签、文件历史、配置
- 工作区级状态随 `.loglayer/` 走，跨刷新/跨会话/跨机器一致恢复
- schema 版本化 + 原子写入 + 基本校验
- 修复布局恢复错乱（view id 与 fileId 解耦）
- 废弃并删除旧 `config.json` / `cache.db`

**Non-Goals:**
- 云同步 / 多用户
- 加密存储
- 迁移旧 `config.json` / `cache.db` 数据（直接删除）

## Decisions

### D1: 存储选型 → 后端 SQLite 单一文件（`workspace.db`），前端无本地状态库

调研了四类方案：

**A. 后端 SQLite（推荐）**：`.loglayer/workspace.db`，沿用项目已有的 sqlite3 基建。
- 支持：KV 表存各类状态、JSON 列存结构化数据、事务原子写、`schema_version` 表做迁移
- 一致性：所有工作区状态同源，跨设备（复制 `.loglayer/` 即迁移）
- 缺点：写操作需走后端 API（前端经 bridge 调用），增加一次 RPC；但现有 `save_workspace_config` 已是此模式

**B. 前端 IndexedDB（dexie/idb）**：布局/偏好纯前端，零 RPC。
- 缺点：IndexedDB 随浏览器/机器，不随工作区目录走；pywebview 与 `--no-ui` 浏览器两份存储不同步；且"复制 .loglayer 迁移"失效。与"工作区状态随项目走"目标冲突。

**C. 规范化 JSON 文档（`config.json` 增强）**：保留文件形式，加版本迁移。
- 缺点：仍是手写 JSON，大状态（布局/书签）每次全量读写，无原子性；本质是"屎上雕花"，违背本变更初衷。

**D. 开源文档库（lowdb/electron-store）**：electron-store 是桌面标准，但项目用 pywebview 非 Electron；lowdb 偏简单小数据。
- 缺点：引入 JS 依赖却只服务前端，后端仍需独立存储，割裂；收益有限。

**结论**：选 A（后端 SQLite 单一文件）。布局/图层/书签/历史/配置都进 `.loglayer/workspace.db`，用 KV + JSON 结构。前端状态经现有 REST bridge 读写。理由：一致性（工作区即一切）、跨设备、复用现有 sqlite 基建、避免前端引入依赖。

### D2: 面板 id 与 fileId 解耦 → 基于 path/uri 的稳定 id

现状 view id = `log-${fileId}`，fileId 每次会话重新生成 → 布局恢复必挂。

方案：view id = `log-view-${stableHash(uri)}`（uri 是绝对路径）。同一文件跨会话 id 稳定，`fromJSON` 直接命中。uri 变更（文件移动）导致 id 变化 → 可接受，属正常布局重置。

### D3: 存储结构 → 单库多表，废弃旧文件

`workspace.db`：
```
schema_version (k=v)      -- 版本记录（本次不做旧数据迁移，为未来升级预留）
kv (key TEXT PK, value TEXT)  -- 通用 KV：settings、bookmarks、layout
files (path TEXT PK, ...) -- 文件历史（原 config.json files[]）
```
- 布局/书签/设置等结构化数据存 `kv` 表 JSON 列
- 文件历史独立表，保留原语义
- **删除**旧 `.loglayer/config.json` 与 `.loglayer/cache.db`（索引缓存随新底座重建）

### D4: 原子写入

- 所有写走事务（`BEGIN ... COMMIT`），布局等用单行 REPLACE
- `schema_version` 表记录版本；本次 `version=1`，无迁移逻辑（迁移框架预留）

### D5: 后端 API

替换/扩展现有端点：
```
GET  /api/workspace/state?key=<key>   # 读一个 key
PUT  /api/workspace/state            # 原子写一个 key
GET  /api/workspace/files            # 读文件历史
PUT  /api/workspace/files            # 写文件历史
```
保持 `save_workspace_config`/`load_workspace_config` 兼容壳（内部转 KV/files）。移除旧 `cache.db` 相关读写。

## Risks / Trade-offs

- [前端状态读写的 RPC 延迟] → 布局防抖保存（现有 `SAVE_DELAY_MS`）；读按需、写合并
- [KV 全量 JSON 序列化大布局] → 布局单独成行，避免全库读写；书签按文件分组存
- [pywebview 与 --no-ui 浏览器状态不一致] → 状态唯一源在后端，前端只是镜像，天然一致
- [破坏性：废弃旧 config.json/cache.db 数据] → 本变更明示 BREAKING；用户历史布局/缓存/文件历史不保留（无迁移）
- [删除 cache.db 导致索引重建慢] → 索引本就按需构建，首次打开重建一次即可

## Migration Plan

1. 实现 `workspace.db` + 原子写 + KV/files API
2. `useWorkspaceConfig` 读写切到新后端 API；EditorArea 布局读写切到 `kv['layout']`；view id 改稳定 hash；移除 localStorage 布局
3. 删除旧 `.loglayer/config.json` 与 `.loglayer/cache.db`（启动时检测并移除）
4. 验证刷新/重开文件夹布局一致；跑现有 e2e（`test_cache_reopen_ui`、`test_large_file_rendering`）

## Open Questions

- 书签当前存内存是否需立刻持久化，还是本变更只搭底座、书签持久化放后续？（倾向：底座 + 布局迁移先落地，书签持久化作为底座能力的首批应用）
- `workspace.db` 与旧 `cache.db` 的索引缓存职责是否合并进 `workspace.db`？（倾向：索引缓存独立或合入，本次先删除旧 cache.db，索引按需重建）
