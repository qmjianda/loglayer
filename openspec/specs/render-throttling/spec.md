# render-throttling Specification

## Purpose
定义前端渲染热路径的节流与缓存能力：滚动位置在面板切换/重挂载时保持（看门狗空闲睡眠、事件重新武装）、渲染依赖 props 引用稳定（React.memo 生效）、重复内容行的渲染结果跨行复用（有界 LRU）、以及调试模式下的前端帧率/内存可观测。
## Requirements
### Requirement: 滚动位置保持（有界看门狗）

系统 SHALL 在 dockview 面板激活/失活导致滚动容器被外部归零（不触发 scroll 事件）时，将滚动位置恢复至真实位置；同时看门狗 SHALL 为**有界**运行——连续多帧无需纠正且无滚动/面板事件时停止逐帧检测，并在 scroll 事件、面板激活/布局变化、fileId 变化、窗口尺寸变化、程序化跳转时重新武装。

#### Scenario: 面板切换不跳回首行

- **WHEN** 用户在面板 A 滚动到第 5000 行后切换到面板 B 再切回面板 A
- **THEN** 面板 A 视口保持在原滚动位置
- **AND** 不出现跳回首行（DOM 滚动条被外部归零后被拉回）

#### Scenario: 空闲时看门狗停止检测

- **WHEN** 无滚动、无面板切换、无程序化跳转且滚动位置已稳定连续多帧
- **THEN** 看门狗取消逐帧检测（rAF 循环停止），不再每帧读取 DOM scrollTop

#### Scenario: 用户主动滚到顶部不被误干预

- **WHEN** 用户通过滚动事件主动将滚动条滚到顶部（真实位置为 0）
- **THEN** 看门狗不把该行为误判为外部归零，不拉回旧位置

#### Scenario: 程序化跳转到顶部不被误干预

- **WHEN** 执行 scrollToIndex 且目标位置为顶部（scrollTop=0）
- **THEN** 看门狗识别其为程序化定位，不同帧拉回旧位置

#### Scenario: 面板切换后立即重新武装

- **WHEN** 面板激活或布局发生变化
- **THEN** 看门狗在事件发生时刻重新开始检测，覆盖该次归零风险窗口

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

