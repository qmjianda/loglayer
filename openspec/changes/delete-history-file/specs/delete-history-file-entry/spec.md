# Spec: delete-history-file-entry

## Requirement 1: 后端单条删除

**WHEN** 调用 `WorkspaceStore.delete_file(path)` 且该 path 存在于 files 表
**THEN** 该行被删除，返回 True

**WHEN** 调用 `WorkspaceStore.delete_file(path)` 且该 path 不存在
**THEN** 不报错，返回 True（幂等）

## Requirement 2: REST 删除端点

**WHEN** `POST /api/workspace/files/remove` 携带 `{folder_path, path}`
**THEN** 返回 True 且该文件从工作区历史中消失

## Requirement 3: 前端删除按钮

**WHEN** 历史文件列表中某条目 hover 并点击删除按钮
**THEN** 该条目从历史列表移除（不触发打开）
**AND** 后端持久化条目同步删除（刷新页面后不再出现）
