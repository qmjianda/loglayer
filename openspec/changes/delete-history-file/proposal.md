# Proposal: delete-history-file

## Why

GitHub issue #4：历史文件列表无法删除不需要的条目。用户只能手动删除
`.loglayer/` 目录才能清掉历史文件和缓存，体验差。

现状：`WorkspaceStore` 的 `files` 表只有 `set_files`（批量写），没有单条
删除方法；REST 层无删除端点；前端历史文件列表（`UnifiedPanel`）无删除按钮。

## What Changes

### 后端

1. **`WorkspaceStore.delete_file(path)`**
   - `backend/loglayer/workspace_store.py` 新增单条删除：`DELETE FROM files WHERE path = ?`。

2. **`FileBridge.remove_workspace_file(folder_path, path)`**
   - `backend/bridge/file_bridge.py` 新增桥接方法，转发到 store。

3. **REST 端点 `POST /api/workspace/files/remove`**
   - `backend/main.py` 新增：body `{folder_path, path}`，删除历史文件条目。
   - 同时删除该文件关联的 KV 状态（书签等，`kv` 键含路径的条目）？——第一版仅删 files 行，
     书签等 KV 键为 `bookmarks.<path>` 前缀，一并清理。

### 前端

4. **`bridge_client.ts` 新增 `removeWorkspaceFile(folderPath, path)`**

5. **`UnifiedPanel` 历史文件列表加删除按钮**
   - 每条历史文件 hover 显示 ✕ 按钮，点击删除（`stopPropagation` 防止触发打开）。
   - 删除后从 `files` 状态移除该条目，并同步后端。

6. **`App.tsx` 传递 `onFileRemoveFromHistory(fileId)`**
   - 从 `files` 移除该文件 + 调用后端删除持久化条目。

## Out of Scope

- 一键清空全部历史（后续可加"清空历史"按钮）。
- 删除当前打开文件的磁盘文件（仅删历史记录，不删磁盘）。
