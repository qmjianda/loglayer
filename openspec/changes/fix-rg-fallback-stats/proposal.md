# Proposal: fix-rg-fallback-stats

## Why

GitHub issue #1：Windows 平台（pywebview 模式）打开日志文件后，
`[LogLevelStats] Error calculating stats: [WinError 2] 系统找不到指定的文件。`

根因：

1. `FileBridge._get_rg_path()` 的候选路径（`backend/bin/<platform>/rg`、
   仓库根 `bin/<platform>/rg`）在打包目录缺失时，回退链末端返回一个
   **不存在的路径**，而不是 None 或系统 PATH 查找。
2. `_calculate_log_level_stats()` 直接用该路径 `subprocess.run(...)`，
   rg 缺失时抛 `FileNotFoundError`（WinError 2），stats 拉取失败且无降级。

## What Changes

### 后端

1. **`_get_rg_path()` 健壮化**
   - 候选路径都不存在时，回退 `shutil.which("rg")`（系统 PATH）。
   - 仍找不到则返回 `None`，并打印清晰警告（`[Bridge] ripgrep not found ...`）。
   - 现有调用方需兼容 `None` 返回值。

2. **`_calculate_log_level_stats()` Python 降级**
   - rg 不可用（None / 文件不存在）时，降级为纯 Python 逐行统计
     （读文件行 + 正则匹配级别词），保证 stats 接口始终可用。
   - 降级路径打印一次提示（`[LogLevelStats] rg unavailable, using Python fallback`）。

3. **StatsWorker 兼容 rg=None**
   - `StatsWorker` / `compute_search_matches` 在 rg 缺失时静默返回空结果，
     不抛异常（与管线其余部分一致的降级行为）。

## Out of Scope

- 搜索功能的纯 Python 全文降级（已有独立备选路径，见 AGENTS.md 已知限制）。
- Windows 打包流程补齐 `bin/windows/`（属于发布脚本问题，另立变更）。
