# Tasks: fix-history-file-path-changed

## 1. Backend

- [x] 1.1 `backend/bridge/utils.py`: 新增 `convert_linux_path_to_windows()` + `resolve_file_path()` 双向转换
- [x] 1.2 `backend/bridge/file_bridge.py`: `open_file()` 原路径不存在时工作区同名重定位
- [x] 1.3 `backend/bridge/file_bridge.py`: 重定位成功后更新工作区历史路径

## 2. Frontend

- [x] 2.1 `frontend/src/hooks/useFileManagement.ts`: `handleFileActivate` 打开失败打印 `[useFileManagement]` 日志

## 3. Tests

- [x] 3.1 `tests/unit/test_bridge_modules.py` 或新文件: `resolve_file_path` Linux→Windows 转换（monkeypatch platform）
- [x] 3.2 `tests/unit/test_bridge_core.py` 或新文件: `open_file` 同名重定位（移动后路径）
- [x] 3.3 `tests/unit/test_bridge_core.py`: 无同名文件时返回 False + `[Bridge]` 日志
