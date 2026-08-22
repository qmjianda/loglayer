## Context

`StatusBar` 当前根据 operation code 和多个布尔状态拼接不同中文提示，`LoadingOverlays` 与 `LogViewer` 又各自维护索引/文件/搜索文案。视觉组件不同是有意的，但主状态词应保持一致。

## Decision

新增 `frontend/src/constants/statusMessages.ts`，集中定义以下主文案：

| 状态 | 文案 |
| --- | --- |
| 文件加载/索引 | 文件加载中 |
| 图层过滤、转换及其他图层流水线 | 图层处理中 |
| 搜索 | 搜索中 |

共享模块只负责文案，不抽象组件。各视觉表面继续保留自己的进度环、骨架、旋转图标和布局。

状态栏优先使用后端 `operationStatus.op`：`indexing` 映射文件加载，`filtering` 映射图层处理，`searching` 映射搜索，其他 operation 映射图层处理。错误优先于成功/等待文案。没有 operation status 时，已有的 `isProcessing`、`isLayerProcessing` 和待处理文件状态按文件加载 > 图层处理 > 待处理文件的顺序显示。

索引覆盖层和文件加载骨架使用“文件加载中”；日志视图的索引/搜索分支分别使用对应共享文案。百分比、文件名、待处理数量和现有错误文字继续由调用方渲染。

## Testing

- 共享模块单测覆盖三类映射、未知 operation、错误优先级和进度后缀。
- `StatusBar` 与 `LoadingOverlays` 组件测试覆盖主文案及现有上下文。
- `LogViewer` 的文本分支通过现有组件测试能力覆盖；若虚拟滚动依赖使其不适合单测，则用构建与手动运行验证，不改动测试基础设施。

## Non-goals

- 不改后端 operation 名称、WebSocket 信号、REST API 或状态时序。
- 不统一与这三类主操作无关的 AI、远程路径、书签和分页提示。
- 不引入完整国际化系统或改变视觉布局。
