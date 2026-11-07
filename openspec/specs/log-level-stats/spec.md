# Spec: log-level-stats

## Purpose

定义文件级日志级别统计的可信口径与性能契约：按行计数、进程内缓存与失效、并发去重，以及前端只接受当前激活文件统计结果的竞态约束。

## Requirements

### Requirement: 按行计数与级别优先级

系统 SHALL 以"行"为统计单位计算文件级日志级别分布：每一行最多计入一个级别，优先级为 `FATAL > ERROR > WARN > INFO > DEBUG > TRACE`，级别识别大小写不敏感。响应字段名（`FATAL`/`ERROR`/`WARN`/`INFO`/`DEBUG`/`TRACE`）保持不变。

#### Scenario: 同一行重复 token 只计一次
- **WHEN** 一行内容为 `ERROR ERROR something failed`
- **THEN** `ERROR` 计数增加 1
- **AND** 不会因为出现两次而增加 2

#### Scenario: 多级别行归入最高优先级
- **WHEN** 一行同时包含 `WARN` 与 `ERROR`
- **THEN** 该行只计入 `ERROR`
- **AND** `WARN` 计数不因该行增加

#### Scenario: 大小写不敏感
- **WHEN** 一行内容为 `error lower case`
- **THEN** 该行计入 `ERROR`

#### Scenario: 各级别计数之和不超过有级别的行数
- **WHEN** 对任意文件完成统计
- **THEN** 各字段计数之和等于"至少包含一个级别 token 的行数"
- **AND** 不会超过文件总行数

### Requirement: 统计缓存与失效

系统 SHALL 缓存文件级级别统计，缓存键包含文件真实路径、文件大小与修改时间；命中缓存时 SHALL NOT 启动 ripgrep 扫描。文件大小或修改时间变化时，对应缓存 MUST 失效并在下次请求时重新计算。缓存容量 SHALL 有上限并按最近使用淘汰。

#### Scenario: 缓存命中跳过扫描
- **WHEN** 同一文件在未发生变化的情况下连续请求两次统计
- **THEN** 第二次请求直接返回缓存结果
- **AND** 不启动新的 ripgrep 进程

#### Scenario: 文件变化使缓存失效
- **WHEN** 文件大小或修改时间发生变化后再次请求统计
- **THEN** 系统重新扫描文件并返回新结果
- **AND** 旧缓存条目不再被使用

#### Scenario: 缓存容量有界
- **WHEN** 请求统计的文件数量超过缓存上限
- **THEN** 系统按最近最少使用淘汰旧条目
- **AND** 缓存占用不会随文件数量无界增长

### Requirement: 并发统计请求去重

系统 SHALL 对同一文件的并发统计请求去重：同一缓存键最多只有一个扫描在执行，其余请求等待并复用该结果。不同文件的统计请求 SHALL 可以并行执行，互不阻塞。

#### Scenario: 同一文件并发请求只扫描一次
- **WHEN** 同一文件同时收到多个统计请求
- **THEN** 只启动一次 ripgrep 扫描
- **AND** 所有请求返回相同结果

#### Scenario: 不同文件并发不互相阻塞
- **WHEN** 文件 A 与文件 B 同时请求统计
- **THEN** 两个文件的扫描可以并行进行
- **AND** 一个文件的扫描失败或超时不影响另一个文件返回结果

### Requirement: 前端统计请求竞态约束

前端 SHALL 只接受"当前激活文件"的统计响应；当激活文件已切换时，过期响应 MUST 被丢弃，且不得修改统计数值或加载态。

#### Scenario: 过期响应被丢弃
- **WHEN** 用户从文件 A 切换到文件 B，A 的统计响应在 B 之后返回
- **THEN** 界面保留文件 B 的统计数值
- **AND** 不会短暂显示文件 A 的统计

#### Scenario: 加载态只由当前请求结束
- **WHEN** 文件 A 的请求尚未返回时用户切换到文件 B
- **THEN** 文件 B 的统计加载态由其自身请求的完成情况决定
- **AND** 文件 A 的迟到响应不会提前关闭文件 B 的加载态

### Requirement: 统计缓存可观测与可清理

系统 SHALL 在诊断接口中暴露统计缓存的命中与未命中次数；清理缓存的操作 SHALL 同时清理统计缓存。

#### Scenario: 诊断接口展示统计缓存指标
- **WHEN** 调用 `/api/diagnostics`
- **THEN** 返回结果包含统计缓存的 hit 与 miss 计数

#### Scenario: 清理缓存同时清理统计缓存
- **WHEN** 调用 `/api/cache/clear`
- **THEN** 统计缓存被清空
- **AND** 后续统计请求重新扫描文件
