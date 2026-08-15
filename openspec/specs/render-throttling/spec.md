# render-throttling Specification

## Purpose
定义前端渲染热路径的节流与缓存能力：滚动位置在面板切换/重挂载时保持（dockview always 渲染策略，失活面板内容常驻 DOM，scrollTop 原生保持）、渲染依赖 props 引用稳定（React.memo 生效）、重复内容行的渲染结果跨行复用（有界 LRU）、以及调试模式下的前端帧率/内存可观测。
## Requirements
### Requirement: 滚动位置保持

系统 SHALL 在 dockview 面板切换（激活/失活）时保持日志视图的滚动位置，不因面板失活/激活导致滚动容器 scrollTop 归零；通过 dockview `always` 渲染策略使失活面板内容常驻 DOM（以 visibility:hidden 隐藏），scrollTop 原生保持，无需逐帧检测与拉回。

#### Scenario: 面板切换不跳回首行

- **WHEN** 用户在面板 A 滚动到第 5000 行后切换到面板 B 再切回面板 A
- **THEN** 面板 A 视口保持在原滚动位置
- **AND** 不出现跳回首行

#### Scenario: 分屏切 tab 不跳回首行

- **WHEN** 分屏模式下，用户在面板 A 滚动到某位置后切换到面板 B 再切回面板 A
- **THEN** 面板 A 视口保持在原滚动位置
- **AND** 不出现跳回首行

#### Scenario: 拖拽移动面板后内容仍显示

- **WHEN** 用户拖拽一个已打开日志文件的面板移动到另一个分组（或从分屏中移出）
- **THEN** 面板内容仍正常显示，不出现空白

### Requirement: 渲染依赖引用稳定

系统 SHALL 保证 LogRow 渲染依赖的 `layers`/`bookmarks`/`colors` 等引用在渲染间稳定（配置未变时引用不变），使 React.memo 浅比较与 useMemo 缓存恢复效力，避免滚动/状态更新引发无关重渲染时重跑图层渲染器。

#### Scenario: 滚动重渲染不重跑渲染器

- **WHEN** 滚动引起 LogViewer 重渲染而图层配置、书签、主题均未变化
- **THEN** 已渲染过的行不重算图层渲染结果（memo/浅比较命中，渲染器不重复执行）

#### Scenario: 默认空配置引用稳定

- **WHEN** 未配置图层/书签（使用默认值）且组件多次重渲染
- **THEN** 每次渲染传入 LogRow 的 layers/bookmarks 引用保持一致（同一引用，非每次新建对象）

### Requirement: 渲染结果跨行缓存

系统 SHALL 对相同内容与相同渲染配置的行复用渲染结果（有界 LRU 缓存），避免每行重复构造正则与全量匹配；缓存 SHALL 有容量上限并在达到上限时淘汰最久未用条目；渲染配置变化时按配置签名区分，不会串用旧配置结果。

#### Scenario: 重复内容行共享结果

- **WHEN** 同一文件中存在多条内容完全相同的行且渲染配置相同
- **THEN** 后渲染的行直接复用缓存中的渲染结果，不重新执行正则构造与 matchAll

#### Scenario: 缓存有界淘汰

- **WHEN** 缓存条目数超过上限
- **THEN** 最久未被使用的条目被淘汰，缓存容量保持在限制内

#### Scenario: 配置变化不串用结果

- **WHEN** 图层配置变化后再次渲染与旧配置相同内容的行
- **THEN** 使用新配置对应的渲染结果（缓存 key 含配置签名，新旧配置不互相命中）

### Requirement: 前端帧率可观测

系统 SHALL 在调试模式下（debugMode）采集前端渲染帧率（FPS）与内存占用，并经 PerformanceIndicator / 状态栏展示；采集 SHALL 默认关闭、开启时无侵入性副作用（仅只读测量）。

#### Scenario: 调试模式显示实时 FPS

- **WHEN** debugMode 开启且存在活动日志视图
- **THEN** 界面展示最近时段的平均 FPS 与内存占用

#### Scenario: 低帧率标记

- **WHEN** 平均 FPS 低于阈值（30）
- **THEN** 指标呈现低帧率标记（isLowFps）

#### Scenario: 调试关闭零开销

- **WHEN** debugMode 关闭
- **THEN** 不启动 FPS 采集循环，不产生测量开销

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

