# per-tab-search Specification (Delta)

## MODIFIED Requirements

### Requirement: 面板级独立搜索状态

系统 SHALL 以面板（Tab）为单位维护独立搜索状态，包括搜索词、搜索配置（大小写/全字/正则）、当前匹配位置（rank）；切换面板时各自状态互不干扰，切换后自动恢复该面板上次的搜索词与导航位置。搜索高亮与匹配行样式 SHALL 按**本面板**的搜索状态渲染（含分屏时非激活面板），不使用激活面板的搜索词。

#### Scenario: 各面板独立搜索词

- **WHEN** 面板 A 搜索 "error" 后切换到面板 B 搜索 "timeout"
- **THEN** 面板 B 的搜索状态独立生效
- **AND** 切回面板 A 后仍显示 "error" 及其匹配状态

#### Scenario: 面板间互不干扰

- **WHEN** 在面板 B 按 F3 导航匹配
- **THEN** 面板 A 的当前匹配位置保持不变

#### Scenario: 切换面板恢复状态

- **WHEN** 从面板 A 切走再切回
- **THEN** 面板 A 恢复其搜索词、配置与当前匹配位置

#### Scenario: 分屏时非激活面板按自身搜索词渲染高亮

- **WHEN** 面板 A 与面板 B 分屏显示，面板 A 搜索 "error" 且处于激活态，面板 B 搜索 "timeout" 处于非激活态
- **THEN** 面板 A 的行内仅 "error" 被高亮
- **AND** 面板 B 的行内仅 "timeout" 被高亮，不使用面板 A 的搜索词

#### Scenario: 面板可见性独立记忆

- **WHEN** 面板 A 展开 find widget 后切换到面板 B，再切回面板 A
- **THEN** 面板 A 的 find widget 可见性恢复为展开状态（面板 B 的可见性不受影响）
