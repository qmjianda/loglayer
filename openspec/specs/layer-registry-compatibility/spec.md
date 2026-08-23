# layer-registry-compatibility Specification

## Purpose
统一图层和 UIWidget 的注册元数据：内置图层与插件能力共用同一注册记录模型，旧基类别名与冻结 ID 机制全部移除。
## Requirements
### Requirement: 统一注册能力
注册门面 SHALL 支持 FILTER、TRANSFORM、RENDERING 和 UIWidget，并为每项保存稳定 ID、显示元数据、能力类型和版本信息。

#### Scenario: 注册标准图层
- **WHEN** 插件声明一个有效 FILTER、TRANSFORM 或 RENDERING 能力
- **THEN** 注册表保存其标准元数据并按类型提供给对应消费者

#### Scenario: 注册 UIWidget
- **WHEN** 插件声明一个有效 UIWidget 及其固定槽位
- **THEN** 注册表保存该 widget 元数据并拒绝未声明的槽位

### Requirement: 内置图层统一注册
内置图层和插件能力 SHALL 使用同一注册记录模型与查询接口。内置能力以固定来源标识注册，外部能力不得覆盖。

#### Scenario: 内置图层经统一记录可查
- **WHEN** 应用启动完成
- **THEN** 每个内置图层以稳定 ID 出现在统一注册记录中，并保留其类别、engine 和配置 schema

#### Scenario: 外部能力不得覆盖内置 ID
- **WHEN** 插件尝试注册与内置图层相同的 ID
- **THEN** 注册被拒绝并记录重复诊断，内置图层保持不变

### Requirement: 注册失败确定且隔离
注册表 SHALL 对重复 ID、未知能力和无效元数据给出确定失败结果，不得部分覆盖已注册能力。

#### Scenario: 重复能力 ID
- **WHEN** 插件注册已存在的能力 ID
- **THEN** 系统按固定重复策略拒绝或选择候选，并保持注册表状态一致

#### Scenario: 无效元数据
- **WHEN** 注册元数据不满足类型或槽位约束
- **THEN** 系统拒绝该项并保留其他已注册项

