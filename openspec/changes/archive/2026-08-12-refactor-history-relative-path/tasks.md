# Tasks: refactor-history-relative-path

## 1. 存储转换核心（backend/bridge/file_bridge.py + backend/loglayer/workspace_store.py）

- [x] 1.1 `backend/bridge/file_bridge.py`: 新增 `_to_stored_path(root, abs_path)` 辅助——`os.path.relpath` + `Path.as_posix()`，跨盘（ValueError）或 `..` 开头时返回原绝对路径
- [x] 1.2 `backend/bridge/file_bridge.py`: `save_workspace_config()` 写入前对 `files[]` 每条 path 调 `_to_stored_path()` 相对化
- [x] 1.3 `backend/bridge/file_bridge.py`: `set_workspace_files()` 写入前同样相对化（与 1.2 共用辅助）
- [x] 1.4 `backend/bridge/file_bridge.py`: `activeFilePath` KV 写入前相对化（`save_workspace_config` 内）

## 2. 读取兼容（backend/bridge/file_bridge.py）

- [x] 2.1 `backend/bridge/file_bridge.py`: `load_workspace_config()` 返回存储原样（相对或绝对），由前端 `resolvePath` 拼根——验证与前端行为匹配
- [x] 2.2 `backend/bridge/file_bridge.py`: 确认 `get_workspace_files()` 返回原样、`remove_workspace_file()` 用相对/绝对双形式均可匹配（或统一转换）

## 3. 书签 key 相对化（backend/search_mixin.py）

- [x] 3.1 `backend/search_mixin.py`: `_persist_bookmarks()` 的 KV key 改为 `BOOKMARK_KV_PREFIX + _to_stored_path(root, session.path)`
- [x] 3.2 `backend/search_mixin.py`: `restore_bookmarks()` 用同一转换恢复 key，保证读写一致

## 4. 删除跨平台启发式与重定位（backend/bridge/utils.py + backend/bridge/file_bridge.py）

- [x] 4.1 `backend/bridge/utils.py`: 删除 `convert_windows_path_to_linux` / `convert_linux_path_to_windows`
- [x] 4.2 `backend/bridge/utils.py`: `resolve_file_path` 简化——去掉平台分支，保留 `Path` 规范化 + 存在性检查 + 裸文件名归一化（`Path(file_path).resolve()` 或 cwd 拼接）
- [x] 4.3 `backend/bridge/__init__.py`: 移除已删除函数的导出（`convert_windows_path_to_linux` 等）
- [x] 4.4 `backend/bridge/file_bridge.py`: 删除 `_relocate_by_name()` 与 `_update_workspace_history()`；`open_file()` 移除重定位分支（失效直接 False + `[Bridge] File not found` 日志）
- [x] 4.5 `backend/bridge/file_bridge.py`: 移除 `get_log_files_recursive` 的导入（函数本体保留，`list_logs_in_folder` 仍用）

## 5. 测试更新

- [x] 5.1 重写 `tests/unit/test_history_path_relocation.py`: 删除 `/mnt/d` 转换与重定位断言；新增相对化写入/读取/书签 key 断言（对应 specs history-file-path-storage 各场景）
- [x] 5.2 `tests/unit/test_bridge_modules.py`: 移除 `convert_windows_path_to_linux` 断言（113 行附近），更新导出检查清单
- [x] 5.3 `tests/unit/test_workspace_store.py` 或新测试: `_to_stored_path` 单元测试（工作区内相对化、工作区外/跨盘绝对兜底、as_posix 分隔符）
- [x] 5.4 回归验证 `tests/unit/test_cli_open_dedup.py`: `resolve_file_path` 裸文件名归一化行为保留（4.2 改动后）

## 6. 收尾验证

- [x] 6.1 `python3 -m pytest tests/unit/ -k "history or workspace or bridge or cli"` 全绿
- [x] 6.2 `ruff check backend tests` 无 error
- [x] 6.3 手动验证：打开单文件 → 历史存相对路径；重开工作区 → 文件恢复；失效路径 → 非静默失败无扫描
