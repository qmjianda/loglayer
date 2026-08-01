## ADDED Requirements

### Requirement: 完整数据源抽象

系统 SHALL 通过 `ILogStreamProvider` 抽象文件访问，业务层不直接依赖具体文件系统实现。

#### Scenario: 打开文件

- **WHEN** 请求打开一个日志文件
- **THEN** 系统经 provider 打开并返回文件元数据（uri、行数、大小、编码）
- **AND** 业务层不感知底层是本地 mmap 还是远程流

#### Scenario: 读取行范围

- **WHEN** 请求读取某个视口区间的行
- **THEN** 系统经 provider 按行偏移读取并返回解码后的内容

#### Scenario: 获取行偏移

- **WHEN** 需要随机访问某行
- **THEN** 系统经 provider 获取全部行字节偏移

#### Scenario: provider 可替换

- **WHEN** 需要支持新的文件来源（如 S3、SSH）
- **THEN** 实现新的 provider 即可接入，无需改动业务层

### Requirement: 单阶段完整索引

系统 SHALL 以单阶段完整索引取代 preview 两阶段索引：打开文件时完整扫描行偏移，不先返回部分结果。

#### Scenario: 首次打开

- **WHEN** 首次打开一个未缓存的大文件
- **THEN** 系统完整扫描全部行偏移后，一次性发出文件加载完成信号
- **AND** 加载完成前不展示部分内容

#### Scenario: 无部分加载

- **WHEN** 文件加载中
- **THEN** 前端显示加载状态
- **AND** 完成前不会收到 `partial` 加载信号
