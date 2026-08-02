# persistence-redesign Proposal

## Why

当前持久化**碎片化且各自为政**，导致两类问题：

1. **状态丢失/错乱**：布局存浏览器 `localStorage`（`loglayer_dockview_layout`），不随工作区走；且 view id 依赖每次变化的 `fileId`，刷新后 `fromJSON` 恢复对不上，出现"打开 3 个文件未分屏，刷新后自动恢复却变水平分屏"的 bug。
2. **无统一底座**：`.loglayer/config.json` 是手写 schema（version/files/activeFilePath），布局、图层、书签、设置各自为政地散落在 localStorage / 手写 JSON / SQLite（`cache.db`）中，无版本迁移、无原子写入、无 schema 校验，后续每加一类状态都要"屎上雕花"。

需要一个**健全、可扩展、跨设备一致的持久化底座**，统一承载布局、图层、书签、配置等各类参数。

## What Changes

- **调研并选型**一个持久化方案（开放选项：SQLite 统一存储、规范化 JSON 文档 + 版本迁移、浏览器 IndexedDB、或开源方案评估），以 proposal 和 design 阶段的对比结论为准，**不继续在当前 config.json 上手写扩展**。
- 引入**统一持久化抽象层**：所有"工作区级状态"（布局、图层、书签、设置、文件历史）经同一接口读写，屏蔽底层存储细节。
- **废弃旧存储**：`.loglayer/config.json` 与 `.loglayer/cache.db` 不再使用，直接删除；所有状态由新统一存储接管，**无数据迁移**（旧数据不保留，全新起点）。
- 布局持久化**迁移**：布局从 `localStorage` 迁入统一存储，view id 与 fileId 解耦（改为基于 path/uri 的稳定标识），保证刷新/重开文件夹后布局一致恢复。**BREAKING**：旧 localStorage 布局格式不再读取。
- **schema 版本化**：存储格式带版本号，为未来升级留迁移框架，但本次不迁移任何旧数据。
- 明确各状态归属：**工作区级**（布局/图层/书签，随项目走）vs **设备级**（UI 偏好，随浏览器/机器走）分开存储。

## Capabilities

### New Capabilities

- `workspace-persistence`: 统一的工作区持久化层——所有工作区级状态（布局、图层、书签、文件历史、设置）经统一接口持久化，带 schema 版本，保证状态可跨刷新/跨会话一致恢复。

### Modified Capabilities

- `file-history-persistence`: 现有文件历史/`wasOpen` 恢复逻辑迁移到新的统一持久化层；`WorkspaceConfig.files[]` 的 schema 与读写由统一底座接管，旧 `config.json` 数据废弃。
- `dockview-split`: 布局的保存/恢复从 `localStorage` 迁移到统一持久化层，且面板标识与 `fileId` 解耦，保证刷新后布局（含分屏/叠放）与关闭前一致。

## Impact

- 前端：`frontend/src/components/EditorArea.tsx`（布局保存/恢复）、`frontend/src/hooks/useWorkspaceConfig.ts`（config 读写）、`frontend/src/bridge_client.ts`（`WorkspaceConfig` schema）、`frontend/src/hooks/useBookmarks.ts`（书签）。
- 后端：`backend/bridge.py`（`save_workspace_config`/`load_workspace_config`）、新增存储模块；`backend/loglayer/metadata_cache.py`（现有 SQLite，评估是否复用）。
- 依赖：可能引入新的存储库（待 design 调研确定）。
- 数据：`.loglayer/config.json` 与 `.loglayer/cache.db` 废弃删除；localStorage 布局字段废弃。
