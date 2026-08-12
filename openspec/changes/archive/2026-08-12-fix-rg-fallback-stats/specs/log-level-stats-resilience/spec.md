# Spec: log-level-stats-resilience

## Requirement 1: rg 路径缺失时 stats 降级不崩溃

**WHEN** `FileBridge._calculate_log_level_stats()` 被调用且 ripgrep 二进制不可用（路径不存在）
**THEN** 不抛异常，降级为纯 Python 逐行统计并返回真实级别计数 dict
**AND** 打印包含 `[LogLevelStats]` 前缀的降级提示日志

## Requirement 2: rg 路径查找有系统 PATH 回退

**WHEN** `FileBridge._get_rg_path()` 在打包目录与开发目录都找不到 rg 二进制
**THEN** 回退 `shutil.which("rg")` 查找系统 PATH
**AND** 仍找不到时返回 `None`，不返回不存在的路径字符串
**AND** 打印包含 `[Bridge]` 前缀的告警日志

## Requirement 3: StatsWorker 兼容 rg=None

**WHEN** `StatsWorker` 以 `rg_path=None` 构造并运行
**THEN** 不抛异常，正常 emit 空结果 JSON（`"{}"`）
