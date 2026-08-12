# Proposal: fix-rg-packaging

## Why

GitHub issue #1（`[LogLevelStats] Error calculating stats: [WinError 2]`）的**根本原因是打包未包含跨平台 rg 二进制**：
`tools/package_offline.py` 只拷贝构建机当前平台的 `bin/<platform>/`（在 WSL/Linux 上打包 → 产物只有 `bin/linux/`），
产物拷到 Windows 后 `rg.exe` 缺失，叠加旧版 `_get_rg_path()` 在目录缺失时返回"不存在的路径"而非 None，产生 WinError 2。

前一个变更 `fix-rg-fallback-stats` 绕开了根因（其 proposal 将打包修复列为 Out of Scope），改为运行时降级工程：
新增 `_python_level_stats()` 第二统计引擎（1.3GB 文件同步逐行读，违反性能红线）、搜索/统计静默返回空结果（掩盖问题）、
135 行测试固化降级行为。本次变更**修正打包根因，并回退这些过度修复**，运行时收敛为"快速失败 + 清晰告警"。

## What Changes

### 打包修复（主修复）

- `tools/package_offline.py`：移除 `current_platform` 过滤，将 `bin/`（`windows/` + `linux/`）整体拷入发布包 `app/bin/`。
  PyInstaller `--add-data` 拷贝的是 `dist_offline/app/bin`，自动跟随；README 本就承诺"支持 Windows 和 Linux 的自包含绿色版"，
  两个 rg 各 2-5MB，体积可接受。移除对旧目录结构的 fallback 分支。

### 运行时收敛（回退 fix-rg-fallback-stats 的多余修复）

- **移除** `FileBridge._python_level_stats()`：rg 缺失时 stats 返回全 0 + 一行 `[LogLevelStats] rg unavailable` 清晰告警
  （恢复修复前的诚实行为，把 WinError 2 换成可读消息；不再维护第二个统计引擎）。
- `compute_search_matches`：rg=None 时返回空数组，但打印 `[Search] rg unavailable` 明确告警（不再完全静默）。
- `StatsWorker`：保留 `rg_path=None` → 空结果 guard（无害），仅补充清晰告警。
- `PipelineWorker`：补充 `rg_path=None` 保护，`error.emit` 明确 "ripgrep unavailable" 消息
  （替代当前 `Popen([None, ...])` 抛 TypeError 的隐晦崩溃）。
- **保留** `find_rg_binary()` / `_get_rg_path()` → None + 告警（正确的加固：不再返回不存在的路径）。

### 启动方式收敛（删除多余 launcher）

- **删除** 打包脚本生成 `LogLayer.bat` / `LogLayer.sh` 的逻辑（`tools/package_offline.py`）。
  理由：frozen 用户直接双击 exe；源码用户需已装 Python，`python app/main.py` 一行即可
  （资源定位走 `__file__`/`_MEIPASS`，不依赖 cwd；`cd` 仅服务于只有一个 demo 插件的
  plugins cwd 定位，属冗余防御）。脚本自身存在 frozen 路径错、pythonw 检测错位等缺陷，维护成本高。
- **rg 可执行性自检下沉**：`find_rg_binary()` 在 POSIX 平台找到候选后检查 `os.access(X_OK)`，
  不可执行则 `os.chmod(+x)` 补齐；修复失败按缺失路径降级（返回 None + 告警）。
  替代原 sh 脚本的 `chmod` 逻辑，一处 Python 实现、跨平台、可单测。
- **README** 更新"快速开始"：源码包 `python app/main.py`、frozen 双击 exe，删除对 bat/sh 的引用。
- **BREAKING（产物级）**：离线发布包不再包含 `LogLayer.bat` / `LogLayer.sh`。

### 测试

- 精简 `tests/unit/test_rg_fallback.py`：只保留 `find_rg_binary()` 回退链、stats 缺 rg 不崩（全 0）、搜索缺 rg 明确告警。
- 新增 `find_rg_binary` 可执行性自检用例（POSIX 下 chmod 补齐 / 失败降级）。
- 新增打包断言：打包产物包含 `bin/windows/` 与 `bin/linux/`。

## Capabilities

### New Capabilities

- `offline-packaging-rg`: 离线发布包必须包含全部支持平台（windows/linux）的 ripgrep 二进制，运行时按当前平台选择。

### Modified Capabilities

- `log-level-stats-resilience`（由 fix-rg-fallback-stats 引入，尚未归档同步）:
  Requirement 1 从"rg 缺失时降级 Python 统计返回真实计数"改为"rg 缺失时返回全 0 + 清晰告警"。

## Impact

- `tools/package_offline.py`：打包逻辑（双平台 bin）+ 删除 launcher 生成段。
- `backend/bridge/file_bridge.py`：移除 `_python_level_stats`、stats 缺 rg 告警。
- `backend/bridge/search_matching.py`：rg=None 明确告警。
- `backend/bridge/workers.py`：StatsWorker / PipelineWorker 缺 rg 告警。
- `backend/bridge/utils.py`：`find_rg_binary` 增加 POSIX 可执行性自检（chmod 补齐）。
- `README.md`：启动说明更新（源码命令 / frozen 双击）。
- `requirements.txt`：pin `pyinstaller` 版本（消除 5.x/6.x `_internal/` 结构歧义，可选顺手项）。
- `tests/unit/test_rg_fallback.py`：精简 + 新增可执行性自检与打包断言。
- **流程前置**：`fix-rg-fallback-stats` 尚未归档，需先归档（sync specs → archive），使
  `log-level-stats-resilience` 进入主 specs，本变更再以 delta 修改之。
