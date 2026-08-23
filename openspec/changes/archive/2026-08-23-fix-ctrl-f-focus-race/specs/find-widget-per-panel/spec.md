# find-widget-per-panel Delta

## ADDED Requirements

### Requirement: 面板身份单一来源

系统 SHALL 以 dockview panel id 作为面板身份的唯一来源，per-tab 搜索状态（词/配置/可见性/焦点请求）SHALL 按该身份读写；面板参数中 SHALL NOT 存在需要与 panel id 保持同步的冗余身份副本。

#### Scenario: 任意面板 Ctrl+F 均可用

- **WHEN** 用户点击任一日志面板（无论面板来自新建打开还是布局恢复）并按下 Ctrl+F
- **THEN** 该面板的 find widget 打开且输入框获得焦点

#### Scenario: 分屏下逐面板独立验证

- **WHEN** 两个面板垂直分屏，用户分别在两个面板上按 Ctrl+F
- **THEN** 每次都是当前激活面板的 find widget 打开并获得焦点，另一面板不受影响

### Requirement: Ctrl+F 始终打开并聚焦 find widget

系统 SHALL 保证用户按下 Ctrl+F（macOS 为 Cmd+F）后，激活面板的 find widget 打开且输入框获得焦点并全选已有搜索词；仅当界面上没有任何日志面板时才允许 no-op。

#### Scenario: 激活面板存在时打开并聚焦

- **WHEN** 用户已点击某个日志面板，按下 Ctrl+F
- **THEN** 该面板 find widget 打开
- **AND** 其输入框获得焦点并全选已有词（若有）

### Requirement: 重复 Ctrl+F 幂等聚焦

find widget 已打开时再次按下 Ctrl+F SHALL 使输入框重新获得焦点并全选已有词，SHALL NOT 关闭或重建 widget。

#### Scenario: 已打开时重复按键

- **WHEN** find widget 处于展开状态，用户再次按下 Ctrl+F
- **THEN** 输入框获得焦点且内容被全选
- **AND** widget 保持展开、无闪烁重建

#### Scenario: 焦点在其他输入框时按键不被吞

- **WHEN** 焦点位于其他输入控件（如图层配置表单），用户按下 Ctrl+F
- **THEN** find widget 仍按上述语义打开/聚焦（全局快捷键优先级不受 isInput 守卫影响的行为保持明确）
