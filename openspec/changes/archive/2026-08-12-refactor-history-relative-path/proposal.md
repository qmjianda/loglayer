# Proposal: refactor-history-relative-path

## Why

历史文件路径失效（issue #5）的**本质是"存储了绝对路径"**。绝对路径
包含平台相关信息（盘符、WSL 挂载点、目录层级），任何一环变化都会失效：

1. **跨平台**：`D:\logs\a.txt`（Windows）与 `/mnt/d/logs/a.txt`（WSL）
   互不相同，需要启发式转换；WSL 挂载点可配置、可无 `/mnt`，启发式不可靠。
2. **文件夹移动**：`a/a.txt` → `b/a/a.txt`，绝对路径每一层都可能变。

现状 `fix-history-file-path-changed` 用两种"打补丁"方式应对，均属治标：

- `convert_windows_path_to_linux` / `convert_linux_path_to_windows`：
  硬编码 `/mnt/<盘符>` 盘符映射，是"找 /mnt/d 这种特殊操作"。
- `_relocate_by_name`：原路径失效时**递归扫描整个工作区**找同名文件，
  大工作区性能差、同名多文件歧义、行为不可预测（用户明确要求去除）。

**根治方案**：历史路径改存**相对路径**（相对工作区根，POSIX `/` 分隔符）。
相对路径不含平台信息（无盘符、无挂载点），平台差异全部收敛到"工作区根"
这一个点——而根是**用户用当前平台路径指出来的**（打开文件夹 / 打开单文件
时文件所在目录即根，因为 `.loglayer/` 就建在那里）。于是：

- 平台兼容 = `os.path.join(root, rel)` 一个函数，win 自动用 `\`、
  linux 自动用 `/`，**零手写转换、零盘符映射**。
- 跨平台 / 文件夹整体移动后，用户重新"指"一次根，相对路径全部恢复。
- 删除工作区自动扫描：失效路径 → 非静默失败 + 提示重新选择。

## What Changes

### 存储层（`backend/loglayer/workspace_store.py` + `backend/bridge/file_bridge.py`）

1. **写入相对化**：`save_workspace_config` / `set_workspace_files` 写入前，
   将绝对路径转为相对工作区根的 POSIX 路径（`os.path.relpath` +
   `Path.as_posix()`）。工作区外的文件（跨盘 / `..` 溢出）用 try/except
   兜底：**能相对则相对，不能则存绝对路径**（读取时 `isabs` 判断自然兼容）。
2. **读取惰性兼容**：`load_workspace_config` / `get_workspace_files` 返回
   存储原样（相对或绝对），由前端 `resolvePath()` 拼根（前端已有此逻辑）。
   旧数据（绝对路径）零迁移、长期共存。
3. **书签 key 相对化**：`_persist_bookmarks` / `restore_bookmarks` 的
   KV key 从 `bookmarks.<abs_path>` 改为相对路径形式，避免跨平台/移文件夹
   后书签静默丢失。

### 删除（`backend/bridge/utils.py` + `backend/bridge/file_bridge.py`）

4. 删除 `convert_windows_path_to_linux`、`convert_linux_path_to_windows`。
5. 删除 `_relocate_by_name`、`_update_workspace_history` 及工作区递归扫描
   调用。
6. `resolve_file_path` 简化：去掉跨平台转换分支，保留"规范化 + 存在性
   检查 + 裸文件名归一化"（CLI 裸文件名场景依赖，见
   `tests/unit/test_cli_open_dedup.py`）。

### 保留不动

7. `get_log_files_recursive`：`list_logs_in_folder` REST API 仍在使用，
   仅移除 `_relocate_by_name` 内的调用。
8. `resolve_file_path` 骨架本身：`open_file` 入口与 CLI 裸文件名归一化
   仍需要。

### 测试

9. 重写 `tests/unit/test_history_path_relocation.py`：删除 `/mnt/d` 与
   重定位断言，改为相对路径存储/读取/书签 key 断言。
10. 更新 `tests/unit/test_bridge_modules.py:113`（断言
    `convert_windows_path_to_linux` 的行为将被删除）。

## Out of Scope

- `/mnt/d` 盘符映射兼容（旧数据中的跨平台绝对路径不再转换，失效则
  提示重选，不引入启发式）。
- 一次性 DB 迁移脚本（惰性兼容，不 bump schema）。
- 前端 UI 提示交互升级（沿用现有非静默日志）。

## Capabilities

- `history-file-path-storage`：历史文件路径的相对化存储、跨平台解析、
  书签相对化与旧数据兼容行为。

## 决策记录（探索模式已确认）

| 决策点 | 结论 |
|:-------|:-----|
| 旧数据绝对路径 | 惰性兼容（`isabs` 判断，零迁移） |
| 工作区外文件 | 存绝对路径兜底（try/except + `isabs` 兼容） |
| 书签 key | 本轮顺带相对化 |
| 原 `fix-history-file-path-changed` | 保留在历史，本变更作废其实现重写 |
