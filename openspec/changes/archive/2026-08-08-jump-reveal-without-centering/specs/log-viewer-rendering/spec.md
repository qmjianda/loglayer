# log-viewer-rendering Delta Specification

## MODIFIED Requirements

### Requirement: 键盘导航与辅助功能
系统 SHALL 支持键盘导航（跳转行号、全选、选区移动）并保持与现有一致的辅助功能标签。跳转行号遵循 jump-navigation 定位契约：目标行完整可见且不在视口边缘安全区内时不滚动，仅更新高亮；目标行贴近视口边缘（约 1 行安全区内）或完全在视口外时，滚动日志视图使目标行定位到视口正中并高亮。

#### Scenario: 跳转指定行居中
- **WHEN** 用户按 Ctrl+G 并输入一个位于视口外或视口边缘安全区内的行号
- **THEN** 日志区域滚动使该行定位到视口正中并高亮

#### Scenario: 跳转指定行可见时不滚动
- **WHEN** 用户按 Ctrl+G 并输入一个完整可见且距视口边缘超过 1 行的行号
- **THEN** 日志区域不发生滚动
- **AND** 该行以高亮标记

#### Scenario: 全选日志
- **WHEN** 用户按 Ctrl+A
- **THEN** 全部日志行被选中

#### Scenario: 辅助功能标签
- **WHEN** 日志区域渲染
- **THEN** 系统提供描述当前显示行范围与总行数的辅助功能标签（aria-label）
