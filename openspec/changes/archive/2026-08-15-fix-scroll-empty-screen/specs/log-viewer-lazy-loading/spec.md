# log-viewer-lazy-loading Delta Specification

## MODIFIED Requirements

### Requirement: 按需拉取行数据

系统 SHALL 按需从后端拉取日志行，仅拉取可视区及其周边缓存窗口内的行，不一次性加载全量日志；数据变化（文件重新索引 / 图层 / 搜索）时清空缓存重新拉取。

#### Scenario: 滚动触发拉取

- **WHEN** 用户滚动到新的可视区
- **THEN** 系统经 `readProcessedLines` 拉取该区域及周边缓存窗口的行数据
- **AND** 已拉取的行缓存在前端（重叠区间允许重复拉取，结果幂等合并）

#### Scenario: 缓存窗口有上限

- **WHEN** 缓存的行数超过上限
- **THEN** 系统淘汰远离当前可视区的缓存行，控制前端内存占用

#### Scenario: 数据变化缓存失效

- **WHEN** 文件重新索引或图层/搜索配置变化（管线重跑）
- **THEN** 系统清空前端已缓存行并重新拉取
- **AND** 不显示与当前管线结果不符的陈旧文本
