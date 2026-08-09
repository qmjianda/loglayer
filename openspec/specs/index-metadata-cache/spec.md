# index-metadata-cache Specification

## Purpose
TBD - created by change vfs-sqlite-cache. Update Purpose after archive.
## Requirements
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

### Requirement: 过滤结果缓存
系统 SHALL 将过滤管线结果（可见行集）按 `(file_path, file_hash, layers_hash)` 持久化到 SQLite，文件与图层配置未变时复用缓存、跳过过滤管线重跑。

#### Scenario: 二次同步命中过滤缓存
- **WHEN** 同一文件使用相同图层配置再次同步
- **THEN** 系统从缓存加载可见行集，跳过过滤管线计算

#### Scenario: 图层配置变更使过滤缓存失效
- **WHEN** 图层配置变化（layers_hash 不一致）
- **THEN** 系统丢弃该配置的过滤缓存并重新计算

### Requirement: 搜索匹配缓存
系统 SHALL 将搜索结果（匹配物理行号）按 `(file_path, file_hash, query_hash)` 持久化到 SQLite，相同文件相同搜索词复用缓存。

#### Scenario: 二次搜索命中缓存
- **WHEN** 同一文件使用相同搜索词与配置再次搜索
- **THEN** 系统从缓存加载匹配物理行号，不重新扫描文件

#### Scenario: 文件或搜索词变更使缓存失效
- **WHEN** 文件内容变化或搜索词/配置变化
- **THEN** 系统丢弃对应的搜索缓存并重新计算

### Requirement: 缓存条目 LRU 淘汰
系统 SHALL 对过滤/搜索缓存条目与其他缓存条目统一按字节上限执行 LRU 淘汰，热数据由内存缓存承接，冷数据落 SQLite。

#### Scenario: 内存与 SQLite 两级协同
- **WHEN** 缓存条目被高频访问
- **THEN** 条目驻留内存 LRU，读取无磁盘 IO

#### Scenario: 超限淘汰
- **WHEN** 缓存总占用超过字节上限
- **THEN** 系统按 LRU 淘汰最久未用条目（保留当前编辑中文件的条目）

