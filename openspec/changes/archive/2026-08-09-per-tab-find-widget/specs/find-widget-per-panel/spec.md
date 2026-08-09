# find-widget-per-panel Specification

## ADDED Requirements

### Requirement: 每面板独立渲染 find widget 实例

系统 SHALL 在每个 dockview 面板（tab）内独立渲染一个 find widget 实例，定位在该面板右上角；各实例读写各自面板的搜索状态（词/配置/可见性/当前匹配），互不干扰。

#### Scenario: 分屏时各面板各有 widget

- **WHEN** 用户将两个面板分屏显示且两个面板都展开了 find widget
- **THEN** 每个面板在自身右上角显示各自的 find widget

#### Scenario: 各面板 widget 状态独立

- **WHEN** 面板 A 的 find widget 搜索 "error"，面板 B 的 find widget 搜索 "timeout"
- **THEN** 两个 widget 各自显示自己的搜索词与匹配计数，互不影响

#### Scenario: 面板关闭后 widget 与状态销毁

- **WHEN** 用户关闭一个面板
- **THEN** 该面板的 find widget 随面板卸载，其搜索状态被释放

### Requirement: 非激活面板的 widget 可见但非交互

系统 SHALL 在面板非激活时仍显示该面板已展开的 find widget，但使其不可交互（输入不可编辑、按钮不可点击、不获取焦点），点击该区域可激活面板并恢复交互。

#### Scenario: 非激活面板 widget 保持可见

- **WHEN** 面板 A 展开 find widget 后用户激活面板 B
- **THEN** 面板 A 的 find widget 仍可见，并显示面板 A 自己的搜索词与计数

#### Scenario: 非激活面板 widget 不可交互

- **WHEN** 面板 A 处于非激活状态且其 find widget 可见
- **THEN** 面板 A 的 find widget 输入框与按钮均不可交互

#### Scenario: 点击非激活面板的 widget 激活该面板

- **WHEN** 用户点击非激活面板 A 可见的 find widget 区域
- **THEN** 面板 A 被激活，其 find widget 恢复可交互

### Requirement: Ctrl+F 打开/聚焦 find widget

系统 SHALL 在按下 Ctrl+F 时对**激活面板**执行：widget 未展开则展开并聚焦输入框；已展开则聚焦输入框并全选已有搜索词。

#### Scenario: Ctrl+F 打开 widget 并聚焦

- **WHEN** 激活面板的 find widget 未展开时用户按 Ctrl+F
- **THEN** 该面板的 find widget 展开且输入框获得焦点

#### Scenario: Ctrl+F 重复按下全选已有词

- **WHEN** 激活面板的 find widget 已展开且输入框已有搜索词时用户再次按 Ctrl+F
- **THEN** 输入框获得焦点且全部文字被选中

#### Scenario: 无激活面板时 Ctrl+F 不生效

- **WHEN** 当前没有激活面板时用户按 Ctrl+F
- **THEN** 不展开任何 find widget，无副作用

### Requirement: find widget 结构与交互对齐 VSCode

系统 SHALL 使 find widget 的布局结构、尺寸与交互对齐 VSCode：元素顺序为输入框（内嵌大小写/全字/正则切换）、匹配计数、上一/下一匹配按钮、关闭按钮；无匹配时计数显示"无结果"且呈错误态配色；Esc 第一段收起 widget 保留搜索词与高亮。

#### Scenario: 元素顺序对齐 VSCode

- **WHEN** find widget 展开
- **THEN** 从左到右依次为：输入框（含 Aa/全字/正则切换按钮）、匹配计数（如 "1/10"）、上一个、下一个、关闭按钮

#### Scenario: 无匹配提示

- **WHEN** 搜索词在当前面板文件中无任何匹配
- **THEN** widget 的计数区域显示"无结果"并以错误态颜色显示

#### Scenario: 输入框聚焦态样式

- **WHEN** find widget 的输入框获得焦点
- **THEN** 输入框显示聚焦边框（项目主题聚焦色）

### Requirement: find widget 使用项目主题配色

系统 SHALL 使用项目统一主题 token（`index.css` 的 `--bg-*`/`--fg-*`/`--border-*`/`--input-bg`/`--color-*` 体系）渲染 find widget，随 dark/light 主题自动切换，不引入 VSCode 主题色值。

#### Scenario: 暗色主题配色

- **WHEN** 应用为暗色主题时展开 find widget
- **THEN** widget 背景/边框/文本/输入框使用暗色主题的对应 token

#### Scenario: 亮色主题配色

- **WHEN** 应用为亮色主题时展开 find widget
- **THEN** widget 背景/边框/文本/输入框使用亮色主题的对应 token，保持可读对比度

### Requirement: find widget 支持拖拽调宽

系统 SHALL 支持通过 widget 左缘拖拽调整宽度，最小宽度为初始宽度；双击拖拽把手时最大化至面板可用宽度。

#### Scenario: 拖拽调整宽度

- **WHEN** 用户拖动 find widget 左缘把手
- **THEN** widget 宽度随拖动变化，且不小于初始宽度

#### Scenario: 双击最大化

- **WHEN** 用户双击 find widget 左缘把手
- **THEN** widget 宽度最大化至当前面板可用宽度

### Requirement: 保留高亮/过滤模式切换

系统 SHALL 在 find widget 中保留"高亮/过滤"模式切换按钮（VSCode 无此功能），以紧凑样式置于输入框左侧，用于切换仅高亮与过滤（隐藏不匹配行）两种搜索模式。

#### Scenario: 切换搜索模式

- **WHEN** 用户点击 find widget 的高亮/过滤切换按钮
- **THEN** 搜索模式在"仅高亮"与"过滤"之间切换，按钮显示当前模式
