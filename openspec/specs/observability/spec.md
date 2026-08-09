# observability Specification

## Purpose
TBD - created by archiving change logviewer-architecture-revamp. Update Purpose after archive.
## Requirements
### Requirement: 后端管线阶段计时
系统 SHALL 记录后端管线各阶段（过滤、转换、搜索、索引）的耗时，并可通过诊断接口获取。

#### Scenario: 查看搜索耗时
- **WHEN** 前端请求诊断数据
- **THEN** 返回搜索匹配计算耗时等各阶段耗时数据

#### Scenario: 查看过滤管线耗时
- **WHEN** 一次过滤管线执行完成
- **THEN** 该次管线的过滤耗时被记录并可供查询

### Requirement: 缓存命中统计
系统 SHALL 记录缓存命中/未命中统计（按缓存来源：内存 LRU、SQLite、实际计算），并可查询，作为缓存设计有效性的依据。

#### Scenario: 查看缓存命中率
- **WHEN** 前端请求诊断数据
- **THEN** 返回各缓存 key 的命中/未命中次数与来源

#### Scenario: 缓存来源可区分
- **WHEN** 某次搜索结果被读取
- **THEN** 统计中可区分其来自内存缓存、SQLite 缓存还是重新计算

### Requirement: 前端 per-tab 状态快照
系统 SHALL 提供前端诊断视图（Debug overlay），展示每个面板的搜索状态（搜索词、配置、当前匹配位置、匹配数）与最近事件流。

#### Scenario: 查看面板搜索状态
- **WHEN** 用户打开 Debug overlay
- **THEN** 每个面板的搜索词、配置、当前匹配位置与匹配数可见

#### Scenario: 查看事件流
- **WHEN** 用户打开 Debug overlay
- **THEN** 显示最近的关键事件（管线完成、搜索就绪、状态变更）及时间顺序

### Requirement: 诊断入口可开关
系统 SHALL 提供可开关的诊断入口（如快捷键），诊断功能不常驻 UI、不影响正常使用。

#### Scenario: 快捷键开关诊断
- **WHEN** 用户按下诊断快捷键
- **THEN** Debug overlay 显示或隐藏

#### Scenario: 诊断不干扰主界面
- **WHEN** Debug overlay 未打开
- **THEN** 主界面不渲染任何诊断 UI，不影响性能与交互

