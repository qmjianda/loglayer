# Spec: log-level-stats-resilience

## Purpose

ripgrep 二进制缺失或不可用时，日志级别统计与搜索/过滤管线不崩溃、不静默、不做慢速替代：统计返回全 0 并告警，搜索与过滤明确失败。

## Requirements

### Requirement 1: rg 路径缺失时 stats 降级不崩溃

日志级别统计在 ripgrep 不可用时返回全 0 计数并打印清晰告警，不抛异常，不启用慢速替代实现。

#### Scenario: rg 缺失时 stats 返回全 0 并告警

**WHEN** 计算日志级别统计且 ripgrep 二进制不可用（路径不存在或为 None）
**THEN** 接口不抛异常，返回各级别全 0 的计数 dict
**AND** 打印包含 `[LogLevelStats]` 前缀的 `rg unavailable` 告警日志

#### Scenario: rg 缺失时不启用慢速替代实现

**WHEN** 计算日志级别统计且 ripgrep 二进制不可用
**THEN** 不执行逐行读取整个文件的纯 Python 统计替代路径
**AND** 返回全 0 计数，不阻塞请求线程等待大文件扫描完成

### Requirement 2: rg 路径查找有系统 PATH 回退

`FileBridge._get_rg_path()` 在打包目录与开发目录都找不到 rg 二进制时回退系统 PATH，仍找不到返回 None。

#### Scenario: 候选目录失效时回退 PATH

**WHEN** `_get_rg_path()` 在打包目录与开发目录都找不到 rg 二进制
**THEN** 回退 `shutil.which("rg")` 查找系统 PATH

#### Scenario: 全部失败时返回 None 并告警

**WHEN** 候选目录与系统 PATH 都找不到 rg 二进制
**THEN** 返回 `None`，不返回不存在的路径字符串
**AND** 打印包含 `[Bridge]` 前缀的告警日志

### Requirement 3: StatsWorker 兼容 rg=None

`StatsWorker` 以 `rg_path=None` 构造时正常 emit 空结果，不抛异常。

#### Scenario: rg_path=None 时 emit 空结果

**WHEN** `StatsWorker` 以 `rg_path=None` 构造并运行
**THEN** 不抛异常，正常 emit 空结果 JSON（`"{}"`）

### Requirement 4: rg 不可用时搜索与过滤管线明确失败而非静默

ripgrep 不可用时，搜索与过滤管线必须产生可见的错误/告警，不得静默返回空结果掩盖问题。

#### Scenario: 搜索在 rg 缺失时返回空并告警

**WHEN** 执行搜索匹配计算且 rg 路径为 None
**THEN** 返回空匹配数组，不抛异常
**AND** 打印包含 `[Search]` 前缀的 `rg unavailable` 告警日志

#### Scenario: 过滤管线在 rg 缺失时给出明确错误

**WHEN** 过滤管线运行且 rg 路径为 None
**THEN** 通过错误信号发出明确的 `rg unavailable` 消息，而非抛隐晦的类型错误
