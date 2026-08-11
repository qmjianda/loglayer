# Proposal: fix-history-file-path-changed

## Why

GitHub issue #5：历史文件中文件名相同但路径已变的文件无法打开。两类场景：

1. **文件夹移动**：`a/a.txt` 所在文件夹被挪到 `b/a/a.txt`，历史记录里的旧
   路径失效，点击无法打开（无任何提示，静默失败）。
2. **WSL↔Windows 路径**：WSL 中打开的 `/mnt/d/log/a.txt`，切到 Windows 后
   变为 `D:\log\a.txt`。`resolve_file_path` 只做 Windows→Linux 单向转换
   （`D:\...` → `/mnt/d/...`），**缺少 Linux→Windows 反向转换**，Windows 上
   直接 `os.path.exists('/mnt/d/...')` 为 False，打开失败。

## What Changes

### 后端

1. **`resolve_file_path()` 双向路径转换**（`backend/bridge/utils.py`）
   - 在 Windows 平台上，当原路径不存在时，尝试将 `/mnt/<盘符>/...` 转换为
     `<盘符>:\...` 再检查存在性。
   - 新增 `convert_linux_path_to_windows()` 辅助函数。

2. **`open_file()` 失败时按文件名在历史中重定位**（`backend/bridge/file_bridge.py`）
   - 原路径不存在时，若已设置工作区，在工作区目录下递归查找同名文件
     （`get_log_files_recursive`），找到唯一匹配则用新路径打开，并更新
     工作区历史中的路径（旧条目删除、新路径写入），解决文件夹移动场景。
   - 找不到匹配时返回 False 并打印明确原因（`[Bridge] File not found: ...`）。

### 前端

3. **打开失败提示**
   - `handleFileActivate` 打开失败时不再静默：打印 `[useFileManagement] ...`，
     若历史文件路径已失效，提示用户重新选择文件（最小改动：仅日志，不改 UI）。

## Out of Scope

- 全盘搜索同名文件（仅限工作区目录，避免扫描整个磁盘）。
- 前端 toast 交互（本期仅日志；后续体验迭代）。
