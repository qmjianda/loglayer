# file-history-persistence Delta

## MODIFIED Requirements

### Requirement: 配置持久化文件历史

系统 SHALL 将文件历史持久化到统一工作区存储（原 `.loglayer/config.json`），且经统一底座读写，不再直接操作手写 JSON 文件。旧 `config.json` 数据废弃删除，不迁移。

#### Scenario: 文件历史写入统一存储
- **WHEN** 用户打开/关闭文件导致历史变化
- **THEN** 文件历史（含 `wasOpen`）经统一持久化底座原子写入
- **AND** 旧 `config.json` 不再作为写入目标，且启动时被移除

#### Scenario: 旧 config 数据废弃
- **WHEN** 打开含旧 `config.json` 的工作区
- **THEN** 旧文件历史数据不迁移、被删除
- **AND** 文件历史从空开始，由新统一存储接管

## ADDED Requirements

### Requirement: 文件历史读取接口

系统 SHALL 提供经统一存储读取文件历史的能力，供工作区恢复时获取 `wasOpen=true` 的文件列表。

#### Scenario: 恢复打开文件
- **WHEN** 用户重新进入工作区
- **THEN** 系统从统一存储读取文件历史
- **AND** 恢复所有 `wasOpen=true` 的文件
