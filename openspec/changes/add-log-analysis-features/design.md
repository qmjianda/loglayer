## Context

LogLayer 是基于 pywebview + FastAPI 的桌面日志分析应用。前端使用 React + TypeScript，后端使用 Python。

当前状态：
- 已有虚拟滚动日志查看器
- 已有基于正则的搜索功能
- 已有 8 种图层（filter, highlight, level, time, range, rowtint, bookmark, replace）
- 已有主题系统

需要增加的功能：
1. SQL-like 查询 - 扩展搜索语法
2. 实时文件监视 - 追踪文件变化
3. JSON 树形视图 - 渲染 JSON 内容
4. 日志统计面板 - 错误统计

## Goals / Non-Goals

**Goals:**
- 实现 SQL-like 查询解析器和 UI
- 实现文件监视机制（polling 或 inotify）
- 实现 JSON 树形渲染组件
- 实现统计面板

**Non-Goals:**
- 不实现分布式日志收集
- 不实现日志告警规则
- 不实现插件系统

## Decisions

### 1. SQL-like 查询
- **方案**: 在前端解析 SQL-like 语法，转换为正则表达式
- **优点**: 简单，无需修改后端
- **备选**: 后端实现（复杂度高，暂不选）

### 2. 实时文件监视
- **方案**: 后端使用文件 modification time 轮询，前端定时拉取新行
- **优点**: 跨平台兼容
- **备选**: inotify/fswatch（需要系统特定实现）

### 3. JSON 树形视图
- **方案**: 检测日志行中的 JSON 字符串，渲染为可展开的树
- **优点**: 简单，按需渲染
- **备选**: 专门的 JSON 图层（暂不选）

### 4. 日志统计面板
- **方案**: 统计当前可见/过滤后的日志行，分类计算
- **优点**: 复用现有图层统计逻辑
- **备选**: 后端聚合（暂不选）

## Risks / Trade-offs

| 风险 | 缓解 |
|:-----|:-----|
| SQL 语法解析错误 | 提供语法提示和错误提示 |
| 大文件监视性能 | 限制轮询频率，最小化数据传输 |
| JSON 树渲染性能 | 懒渲染，只渲染可见区域 |
| 统计计算阻塞 UI | 使用 Web Worker 或后端计算 |
