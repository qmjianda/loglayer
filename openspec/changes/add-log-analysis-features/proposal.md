## Why

LogLayer 目前已有核心的日志查看和搜索能力，但相比主流日志工具缺少几个高价值功能：
- 用户需要更强大的查询能力（SQL-like）来过滤复杂日志
- 实时监控日志文件变化是常见需求
- JSON 格式日志日益增多，需要树形展开查看
- 快速了解错误分布需要统计面板

## What Changes

1. **SQL-like 查询**：在搜索面板添加类 SQL 语法支持（如 `level=ERROR AND message CONTAINS "timeout"`）
2. **实时文件监视**：支持 tail -f 模式，自动追踪文件新增内容
3. **JSON 树形视图**：日志行中的 JSON 内容可展开/折叠为树形结构
4. **日志统计面板**：显示错误/警告数量、时间分布图表

## Capabilities

### New Capabilities
- `sql-query`: 支持类 SQL 语法过滤日志
- `file-watch`: 实时监视文件变化，自动加载新行
- `json-tree-view`: JSON 内容树形展开/折叠
- `log-stats`: 日志统计面板（错误数、时间分布）

### Modified Capabilities
- `search`: 扩展搜索能力以支持 SQL-like 语法
- `log-viewer`: 添加 JSON 树形渲染模式

## Impact

- 前端：SearchPanel、LogViewer、StatsPanel 组件
- 后端：可能需要扩展搜索 API
- 无新依赖
