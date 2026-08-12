# Design: fix-rg-packaging

## Context

参见 proposal.md - Why。核心矛盾：离线打包脚本 `tools/package_offline.py` 只拷贝构建机当前平台的 `bin/<platform>/`，
跨平台分发时另一平台 rg 缺失；前变更 `fix-rg-fallback-stats` 为此构建了过度的运行时降级
（`_python_level_stats` 第二统计引擎、静默空结果）。本设计收敛运行时行为并修复打包根因。

## Goals / Non-Goals

**Goals**
- 打包产物包含全部支持平台的 rg 二进制，单包跨平台可用。
- 运行时缺 rg 时：快速失败 + 可见告警，不崩、不静默、不慢速替代。

**Non-Goals**
- 为搜索/统计在缺 rg 时提供功能替代（纯 Python 搜索/统计引擎）——明确排除，属于独立特性。
- 修改 `find_rg_binary()` 的查找约定（候选目录 → PATH → None）——保持不变。

## Decisions

### D1: 打包拷整个 bin/，保留 `<bin>/<platform>/rg[.exe]` 目录结构

`tools/package_offline.py` 删除 `current_platform` 过滤，直接 `copytree(bin_dir, target_bin,
ignore=("ripgrep-*", "*.zip", "*.tar.gz"))`（即现有旧结构 fallback 分支的逻辑，去掉 if/else）。

- **理由**：`find_rg_binary()` 已按 `<dir>/<platform>/rg[.exe]` 约定查找，目录结构不变则运行时零改动；
  两个 rg 各 2-5MB，体积可接受；README 本就承诺双平台单包。
- **备选（否决）**：合并单目录 + 运行时改名选择 —— 破坏 find_rg_binary 约定，改动大。

### D2: 移除 `_python_level_stats`，stats 缺 rg 返回全 0 + 可读告警

删除 `FileBridge._python_level_stats()`；`_calculate_log_level_stats()` 在 `_rg_path` 缺失/失效时
直接走既有 `except → 全 0` 兜底（恢复 fix 前行为），告警消息改为 `[LogLevelStats] rg unavailable ...`。

- **理由**：打包修复后缺 rg 属异常环境；Python 逐行替代在 1.3GB 文件上同步阻塞请求线程，
  违反性能红线，且是第二份需长期对齐语义的实现。
- **备选（否决）**：保留 Python 统计 —— 维持性能违规路径，且"想得太多"的方向。

### D3: 缺 rg 时明确告警而非静默

- `compute_search_matches(rg_path=None)`：返回空数组 + `[Search] rg unavailable` 告警。
- `PipelineWorker.run()` 开头 `rg_path=None` 时 `error.emit("rg unavailable ...")` 并 return
  （替代当前 `Popen([None, ...])` 抛 TypeError 的隐晦崩溃）。
- `StatsWorker.run()` 保留 `rg_path=None → emit("{}")`，补一行 `[Stats] rg unavailable` 告警。

- **理由**：异常环境的正确行为是"看得见的错误"，静默空结果会伪装成"无匹配/全 0 是真实结果"。

### D4: 测试策略

- 精简 `tests/unit/test_rg_fallback.py`：`find_rg_binary` 回退链（保留现有 3 例）、
  stats 缺 rg 返回全 0 不抛异常、搜索缺 rg 返回空且打印 `[Search]` 告警（capsys 断言）。
- 打包产物断言：不直接单测打包脚本（依赖 npm build），改为 e2e/手动打包后检查产物
  `app/bin/{windows,linux}` 双目录存在；或在轻量单测中验证 bin 双平台源目录齐全。

### D5: 删除 launcher 脚本，启动方式收敛为两种

删除 `package_offline.py` 中生成 `LogLayer.bat` / `LogLayer.sh` 的整段代码（含 os.chmod）。

- **理由**：frozen 用户双击 exe；源码用户已装 Python，`python app/main.py` 即可
  （main.py:512 www 走 `__file__`、frozen 走 `_MEIPASS`、workspace 存用户目录，
  cwd 唯一消费者是 file_bridge.py:84 的 plugins 定位，而 plugins 只有 demo.py 且
  registry 对缺失静默容忍 —— cd 是冗余防御）。
- **备选（否决）**：保留并修 bug —— 维护两份语法不同、无法单测的脚本，服务伪便利路径。

### D6: rg 可执行性自检下沉 `find_rg_binary`

`find_rg_binary()` 在 POSIX 平台对候选返回前检查 `os.access(p, os.X_OK)`，不可执行则
`os.chmod(p, 0o755)` 补齐；补齐失败则放弃该候选继续回退链（最终 None + 告警）。
Windows 平台跳过（.exe 无执行位概念）。

- **理由**：替代原 sh 脚本的 `find ... -exec chmod +x`；一处 Python 实现覆盖源码/frozen
  两条路径，可单测（mock chmod / access）。
- **备选（否决）**：PyInstaller `--add-binary` 显式带权限 —— 仅覆盖 frozen 路径，源码包仍缺。

### D7: 配套收敛

- `README.md` "快速开始"：源码包写 `python app/main.py`，frozen 写双击 `LogLayer.exe`，删 bat/sh 引用。
- `requirements.txt`：`pyinstaller` pin 到 6.x（消除 5.x 根目录 / 6.x `_internal/` 结构歧义，
  与 D5 后唯一 frozen 入口 exe 双击的行为一致）。

## Risks / Trade-offs

- [包体积增加 ~5-10MB] → 可接受：README 承诺双平台，rg 二进制本身小巧。
- [缺 rg 时 stats 显示全 0 可能误导] → 控制台有 `[LogLevelStats] rg unavailable` 告警；
  打包修复后此场景仅存于异常环境（手动删 bin）。
- [删除 launcher 后源码用户需手动敲命令] → 目标用户为工程师且源码模式已要求装 Python；
  README 提供一行命令。frozen 用户不受影响（双击 exe）。
- [回退改变了 fix-rg-fallback-stats 已发布行为] → 该变更尚未归档、无外部消费者，回退安全；
  归档顺序已处理（fix-rg-fallback-stats 已归档，本变更以 delta 修改其能力）。

## Migration Plan

无数据/API 迁移。部署 = 重新打包分发。回滚 = 恢复 package_offline.py 平台过滤（git revert）。

## Open Questions

无。
