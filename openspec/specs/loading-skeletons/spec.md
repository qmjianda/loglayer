# loading-skeletons Specification

## Purpose
定义核心等待场景的骨架屏与进度反馈能力：文件索引构建时展示进度环（挂载已实现的 IndexingOverlay）、搜索结果加载中展示行级骨架占位、统计拉取中展示骨架条，消除纯文字加载态与"数据跳变"，提升大文件场景的等待体验。
## Requirements
### Requirement: 索引构建进度环

系统 SHALL 在文件索引构建期间展示进度环（圆形 SVG 进度 + 百分比 + 状态文字，即 IndexingOverlay），替代纯文字加载提示；索引完成（fileLoaded）后进度环消失并展示日志内容。

#### Scenario: 索引中显示进度环

- **WHEN** 文件正在构建索引（indexingFileIds 包含该文件）
- **THEN** 面板区域展示圆形进度环 + 百分比 + "正在构建索引" 状态文字
- **AND** 展示的不是纯文字行（进度环组件已挂载生效）

#### Scenario: 索引完成隐藏进度环

- **WHEN** 索引构建完成（fileLoaded 信号到达）
- **THEN** 进度环消失
- **AND** 日志内容正常渲染

### Requirement: 搜索结果行级骨架

系统 SHALL 在搜索结果加载中展示行级骨架占位（animate-pulse，复用 FileLoadingSkeleton 的设计语言）；结果到达后骨架替换为真实结果行。

#### Scenario: 搜索中显示骨架占位

- **WHEN** 搜索结果加载中（isLoading 为真）
- **THEN** 结果列表区域展示若干行级骨架占位（脉冲动画），而非仅纯文字 "加载中..."

#### Scenario: 结果到达替换骨架

- **WHEN** 搜索结果返回
- **THEN** 骨架占位被真实结果行替换
- **AND** 不残留骨架元素

### Requirement: 统计加载骨架

系统 SHALL 在日志级别统计拉取中展示骨架条（模拟级别分布条与数字的占位），消除切文件后统计区域从有数据变为空白再跳变的视觉缺口；统计完成（statsFinished / 数据到达）后骨架替换为真实统计。

#### Scenario: 统计拉取中显示骨架

- **WHEN** 切换文件后统计请求进行中（stats 尚未返回）
- **THEN** InspectorSummary 统计区域展示骨架条占位（非空白）

#### Scenario: 统计完成替换骨架

- **WHEN** 统计数据返回
- **THEN** 骨架条替换为真实级别分布与计数

