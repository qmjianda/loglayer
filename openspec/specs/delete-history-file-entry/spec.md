# delete-history-file-entry 能力规范

## Purpose

定义历史文件条目的删除能力：后端提供单条删除的幂等操作与 REST 端点，前端在历史文件列表提供删除按钮，删除后持久化生效。

## Requirements

### Requirement: 后端单条删除

系统 SHALL 提供 `WorkspaceStore.delete_file(path)` 幂等删除指定路径的历史条目。

#### Scenario: 删除已存在条目

- **WHEN** 调用 `WorkspaceStore.delete_file(path)` 且该 path 存在于 files 表
- **THEN** 该行被删除，返回 True

#### Scenario: 删除不存在条目

- **WHEN** 调用 `WorkspaceStore.delete_file(path)` 且该 path 不存在
- **THEN** 不报错，返回 True（幂等）

### Requirement: REST 删除端点

系统 SHALL 提供 `POST /api/workspace/files/remove` 端点删除工作区历史文件条目。

#### Scenario: 通过端点删除

- **WHEN** `POST /api/workspace/files/remove` 携带 `{folder_path, path}`
- **THEN** 返回 True 且该文件从工作区历史中消失

### Requirement: 前端删除按钮

系统 SHALL 在历史文件列表条目 hover 时展示删除按钮，点击后从历史移除该条目并同步后端持久化。

#### Scenario: hover 删除

- **WHEN** 历史文件列表中某条目 hover 并点击删除按钮
- **THEN** 该条目从历史列表移除（不触发打开）
- **AND** 后端持久化条目同步删除（刷新页面后不再出现）
