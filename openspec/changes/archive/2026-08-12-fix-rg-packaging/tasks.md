# Tasks: fix-rg-packaging

## 1. 打包修复

- [x] 1.1 `tools/package_offline.py`: 移除 `current_platform` 过滤，直接 `copytree(bin_dir, target_bin, ignore=("ripgrep-*", "*.zip", "*.tar.gz"))` 拷双平台 bin（删除 if/else 与旧结构 fallback）
- [x] 1.2 `tools/package_offline.py`: 删除 `LogLayer.bat` / `LogLayer.sh` 生成段（bat/sh 内容、open/写入、os.chmod）
- [x] 1.3 手动验证：Linux 上跑打包（或模拟）后确认产物 `app/bin/{windows,linux}` 双目录存在、根目录无 bat/sh

## 2. 运行时收敛（回退多余修复）

- [x] 2.1 `backend/bridge/file_bridge.py`: 删除 `_python_level_stats()`；`_calculate_log_level_stats()` 缺 rg 时走全 0 兜底 + `[LogLevelStats] rg unavailable` 告警
- [x] 2.2 `backend/bridge/search_matching.py`: `compute_search_matches` 在 rg=None 时返回空数组并打印 `[Search] rg unavailable` 告警
- [x] 2.3 `backend/bridge/workers.py`: `PipelineWorker.run()` 开头 guard `rg_path=None` → `error.emit("rg unavailable ...")` 并 return，避免 `Popen([None,...])` TypeError
- [x] 2.4 `backend/bridge/workers.py`: `StatsWorker.run()` 保留 rg=None → `{}`，补 `[Stats] rg unavailable` 告警
- [x] 2.5 `backend/bridge/utils.py`: `find_rg_binary()` 在 POSIX 平台对候选做 `os.access(X_OK)` 检查，不可执行则 `os.chmod(+x)` 补齐；补齐失败放弃候选继续回退链

## 3. 测试与文档

- [x] 3.1 `tests/unit/test_rg_fallback.py`: 精简为 find_rg_binary 回退链 + stats 缺 rg 全 0 + 搜索缺 rg 空结果且告警（capsys 断言）
- [x] 3.2 `tests/unit/test_rg_fallback.py`: 新增 find_rg_binary 可执行性自检用例（POSIX chmod 补齐 / 补齐失败降级）
- [x] 3.3 `README.md`: 更新"快速开始"——源码包 `python app/main.py`、frozen 双击 exe，删除 bat/sh 引用
- [x] 3.4 `requirements.txt`: pin `pyinstaller` 到 6.x（消除 `_internal/` 结构歧义）
- [x] 3.5 运行 `python3 -m pytest tests/unit/test_rg_fallback.py` 与全量单测，确认红→绿
