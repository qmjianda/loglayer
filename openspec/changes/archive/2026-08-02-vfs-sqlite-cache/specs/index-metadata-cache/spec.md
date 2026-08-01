## ADDED Requirements

### Requirement: SQLite 元数据缓存

系统 SHALL 将行偏移索引持久化到 SQLite（`.loglayer/cache.db`），二次打开同一文件时跳过重新扫描。

#### Scenario: 首次打开建立缓存

- **WHEN** 首次打开一个日志文件并完成索引
- **THEN** 系统将行偏移索引连同文件哈希写入 SQLite 缓存

#### Scenario: 二次打开命中缓存

- **WHEN** 再次打开同一文件且文件哈希一致
- **THEN** 系统直接从缓存加载偏移索引
- **AND** 跳过重新扫描，打开耗时大幅下降

#### Scenario: 文件变更使缓存失效

- **WHEN** 打开的文件内容已变化（哈希不一致）
- **THEN** 系统丢弃旧缓存并重新构建索引

### Requirement: 文件哈希快速校验

系统 SHALL 用前 8KB + 后 8KB + 文件大小计算哈希，作为缓存有效性判据，兼顾速度与敏感度。

#### Scenario: 校验未变文件

- **WHEN** 文件未被修改
- **THEN** 哈希一致，缓存命中

#### Scenario: 校验已变文件

- **WHEN** 文件内容被修改
- **THEN** 哈希不一致，缓存失效并重建

### Requirement: 超大日志分块压缩存储

系统 SHALL 将行偏移数组分块并压缩后存储为 BLOB，适配千万行级超大日志。

#### Scenario: 存储大偏移数组

- **WHEN** 一个日志文件的偏移数组超过单块阈值
- **THEN** 系统分块序列化，并对每块进行 zlib 压缩后存入 SQLite

#### Scenario: 读取大偏移数组

- **WHEN** 从缓存加载一个大文件的偏移
- **THEN** 系统解压并合并所有块，还原完整偏移数组
