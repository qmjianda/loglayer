# Design: refactor-history-relative-path

## Context

历史文件路径失效（issue #5）的根因是持久化存储了**绝对路径**，导致
路径与平台（盘符/WSL 挂载点）和位置（目录层级）耦合。前一轮变更
`fix-history-file-path-changed` 以 `/mnt/d` 盘符映射 + 工作区递归扫描
治标，本变更推翻该实现，改为**相对路径持久化**（参见 proposal.md - Why）。

现状关键事实：

- 工作区根是隐式锚点：`WorkspaceStore` 将 DB 建在 `<root>/.loglayer/`
  下，根 = 用户打开文件夹 / 单文件打开时的文件所在目录。
- 前端 `useWorkspaceConfig.loadConfig()` 的 `resolvePath()` 已支持
  "相对拼根、绝对原样"的读取逻辑，写入端未相对化（写的是原始绝对路径）。
- 书签 KV key 使用打开时的会话绝对路径（`bookmarks.<abs_path>`）。
- `resolve_file_path` 承担"规范化 + 存在性检查 + 裸文件名归一化"，
  CLI 裸文件名场景依赖其骨架（`tests/unit/test_cli_open_dedup.py`）。
- `get_log_files_recursive` 除重定位外仍被 `list_logs_in_folder` REST
  API 使用，函数本体保留。

## Goals / Non-Goals

**Goals**

- 持久化层（files 表 / activeFilePath / 书签 key）统一为相对路径存储。
- 平台兼容完全由 `os.path.join` / `pathlib.Path` 处理，代码中零盘符映射。
- 旧数据（绝对路径）惰性兼容，零迁移、不 bump schema。

**Non-Goals**

- 不做一次性 DB 迁移脚本。
- 不保留任何 `/mnt/<盘符>` 启发式转换（含旧数据读取路径）。
- 不实现工作区自动搜索/重定位。
- 不改变前端 `resolvePath` 的既有读取逻辑（已满足需求）。

## Decisions

### D1: 相对化写入的唯一入口在后端 `save_workspace_config`

- **选型**：`save_workspace_config(folder_path, config_json)` 内部对
  `files[]` 逐条做 `to_stored_path()`：`os.path.relpath(abs, root)` +
  `Path.as_posix()`；`relpath` 抛 `ValueError`（跨盘）或结果以 `..`
  开头（工作区外）时退回绝对路径原样存储。
- **备选**：前端保存时用 JS `path.relative` 转换。否——前端不持有根
  的权威定义（根由后端 `set_workspace_dir` 决定），且未来 CLI/其他
  客户端写入会绕过前端逻辑，后端收敛更稳。
- **关键点**：根以 `save_workspace_config` 的 `folder_path` 参数为准
  （与 `_current_workspace_store` 一致），不依赖 `self._workspace_dir`
  的隐式状态，避免测试/多工作区场景歧义。

### D2: 读取端 `from_stored_path()` 惰性兼容

- **选型**：`os.path.isabs(stored)` 为真 → 原样返回；否则
  `os.path.join(root, stored)`。此函数只在后端返回给前端前使用一次
  （或直接返回存储原样，由前端 `resolvePath` 处理——二者行为等价，
  具体位置以实现便利为准）。
- **备选**：读取时做迁移写回。否——写入路径一旦相对化，旧绝对条目
  自然成为少数残留，惰性兼容足够；迁移写回引入并发写风险，收益低。

### D3: 书签 key 相对化

- **选型**：`_persist_bookmarks` / `restore_bookmarks` 中
  `BOOKMARK_KV_PREFIX + session.path` 改为
  `BOOKMARK_KV_PREFIX + to_stored_path(root, session.path)`，读写两侧
  用同一转换，保证 key 一致。
- **备选**：书签 key 保持绝对路径。否——跨平台/移文件夹后书签静默丢
  失，与本次目标（路径可移植）直接冲突。
- **注意**：`session.path` 是打开时的解析后绝对路径，而历史 files 表
  里存的可能是相对路径；书签 key 用 `to_stored_path` 统一到同一坐标系。

### D4: 删除跨平台启发式，保留 `resolve_file_path` 骨架

- **选型**：删除 `convert_windows_path_to_linux` /
  `convert_linux_path_to_windows`；`resolve_file_path` 简化为
  "`Path` 规范化 + 存在性检查 + 裸文件名（`Path(file_path).resolve()` /
  cwd 拼接）归一化"，无任何平台分支。
- **备选**：整体删除 `resolve_file_path` 改用 `Path`。否——`open_file`
  入口和 CLI 裸文件名测试依赖其"归一化为可用绝对路径"的契约，保留
  最小骨架改动面最小。

### D5: 删除 `_relocate_by_name` / `_update_workspace_history`

- **选型**：从 `open_file` 移除重定位分支，路径失效直接返回 False +
  `[Bridge] File not found: <path>` 日志。
- **备选**：保留按文件名重定位。否——用户明确要求不自动搜索工作区
  （性能、歧义、不可预测），相对路径 + 重指根才是正解。

## Risks / Trade-offs

- [工作区外文件存绝对路径 → 跨平台后仍会失效] → 这是显式接受的兜底
  边界：此类文件本就无法相对化，失效时走非静默提示（spec Requirement 3）。
- [旧绝对路径数据与相对路径数据共存 → 去重/匹配可能漏] → 读取端
  `isabs` 判断统一坐标系；`handleOpenFileByPath` 去重在前端基于解析后
  绝对路径，不受影响。
- [`relpath` 大小写敏感（Windows 不区分大小写）] → 相对化结果以
  `relpath` 输出为准，同文件不同大小写写法视为不同路径，与现有
  PRIMARY KEY 语义一致，不额外处理（现有行为即如此）。
- [删除重定位后，纯"文件夹移动"场景用户需手动重选根/文件] → 前端
  已有失败日志提示（`[useFileManagement] Failed to open...`），行为可
  预测，符合用户"不要自动搜索"的要求。

## Migration Plan

1. 后端先上线存储转换（相对化写入 + 惰性读取兼容），旧绝对数据继续
   可读，无停机。
2. 删除启发式转换与重定位代码，更新单测。
3. 前端无需改动（`resolvePath` 已兼容相对路径读取）。
4. 回滚：代码回退即可，DB 无 schema 变更、无迁移副作用（相对路径
   写入是幂等的 `INSERT OR REPLACE`）。

## Open Questions

- 无。（三个决策点已在探索阶段与用户确认：旧数据惰性兼容 / 工作区外
  绝对兜底 / 书签顺带相对化。）
