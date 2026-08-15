# render-throttling Delta Specification

## ADDED Requirements

### Requirement: 滚动位置有效性（内容收缩后归零）

系统 SHALL 保证日志视图的滚动位置始终处于合法范围 `[0, maxScroll]`；当内容收缩（过滤图层减少可见行数）导致最大滚动量减小时，滚动位置 SHALL 收敛到新范围，不得停留在越界的旧位置（表现为视口空白、滚动条卡在旧位置）。滚动容器 SHALL 仅由 spacer（in-flow 元素）决定 `scrollHeight`；Overview Ruler 等视觉覆盖层 SHALL 不贡献 scrollable overflow。

#### Scenario: 过滤后滚动位置归零

- **WHEN** 用户在日志视图滚动到中部（非顶部）后，添加一个会大幅减少可见行数的过滤图层
- **THEN** 视图的 `scrollTop` 归零（回到顶部）
- **AND** 滚动容器的 `scrollHeight` 收敛到新内容高度（等于 spacer 高度，而非被覆盖层虚撑）

#### Scenario: 过滤后视口显示内容而非空白

- **WHEN** 上述过滤发生且过滤后内容高度小于视口高度
- **THEN** 视口显示过滤后的首行内容
- **AND** 不出现空白视口

#### Scenario: 视觉覆盖层不贡献滚动高度

- **WHEN** 日志视图渲染且含 Overview Ruler（右侧标尺）
- **THEN** 滚动容器的 `scrollHeight` 仅由内容（spacer）决定
- **AND** ruler 的存在不改变 `scrollHeight`（当内容高度小于视口高度时，`scrollHeight` 等于视口高度）
