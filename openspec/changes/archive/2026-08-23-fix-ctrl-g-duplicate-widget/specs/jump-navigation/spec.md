# jump-navigation Delta

## ADDED Requirements

### Requirement: Ctrl+G 打开唯一跳转框且不改变滚动位置

系统 SHALL 在用户按下 Ctrl+G（macOS 为 Cmd+G）时只显示一个"跳转到行"输入框；打开该输入框及输入框内焦点变化 SHALL NOT 改变日志视图的当前滚动位置。跳转框已打开时再次按下 Ctrl+G SHALL 聚焦既有输入框而非创建新实例。

#### Scenario: 一次按键只弹一个跳转框

- **WHEN** 用户在日志视图按下 Ctrl+G
- **THEN** 界面上只出现一个"跳转到行"输入框
- **AND** 输入框自动获得焦点

#### Scenario: 已打开时重复按键不新建

- **WHEN** 跳转框已处于打开状态，用户再次按下 Ctrl+G
- **THEN** 不出现第二个跳转框
- **AND** 既有输入框获得焦点并全选已有内容（若有）

#### Scenario: 打开跳转框不触发滚动

- **WHEN** 日志视图滚动到文件中部（scrollTop > 0），用户按下 Ctrl+G
- **THEN** 日志视图滚动位置保持不变
- **AND** 跳转框完整可见地悬浮于视口内

#### Scenario: 取消跳转不改变滚动位置

- **WHEN** 用户按 Escape 关闭跳转框
- **THEN** 日志视图滚动位置保持不变

### Requirement: 跳转框渲染不参与滚动内容流

跳转框 SHALL 以视口锚定方式（fixed 或等价机制）渲染，SHALL NOT 作为滚动容器的可滚动溢出内容存在，使得无论当前滚动到何处，输入框均出现在视口固定位置且不会因聚焦被滚入视图。

#### Scenario: 深处滚动位置下跳转框可见

- **WHEN** 用户滚动到第 1,000,000 行附近后按下 Ctrl+G
- **THEN** 跳转框出现在面板视口顶部居中位置
- **AND** 滚动条位置未发生变化
