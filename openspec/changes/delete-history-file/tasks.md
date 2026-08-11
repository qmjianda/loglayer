# Tasks: delete-history-file

## 1. Backend

- [x] 1.1 `backend/loglayer/workspace_store.py`: 新增 `delete_file(path)` 方法
- [x] 1.2 `backend/bridge/file_bridge.py`: 新增 `remove_workspace_file(folder_path, path)` 桥接
- [x] 1.3 `backend/main.py`: 新增 `POST /api/workspace/files/remove` 端点

## 2. Frontend

- [x] 2.1 `frontend/src/bridge_client.ts`: 新增 `removeWorkspaceFile(folderPath, path)`
- [x] 2.2 `frontend/src/components/UnifiedPanel.tsx`: 历史列表 hover 显示删除按钮
- [x] 2.3 `frontend/src/App.tsx`: 传递 `onFileRemoveFromHistory`，删除时同步后端

## 3. Tests

- [x] 3.1 `tests/unit/test_workspace_store.py`: `delete_file` 存在/不存在均幂等返回 True
- [x] 3.2 `tests/unit/test_bridge_modules.py` 或新文件: `remove_workspace_file` 删除后 get_files 不含该路径
- [x] 3.3 `tests/e2e/test_right_inspector_panel.py` 或 sidebar 相关: 历史列表删除按钮移除条目
