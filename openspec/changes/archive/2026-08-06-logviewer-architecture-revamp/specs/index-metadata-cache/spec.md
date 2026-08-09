# index-metadata-cache Specification (Delta)

## ADDED Requirements

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
