# per-tab-search Specification

## Purpose
TBD - created by archiving change logviewer-architecture-revamp. Update Purpose after archive.
## Requirements
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

### Requirement: 状态与面板生命周期绑定
系统 SHALL 将搜索状态与 dockview 面板生命周期绑定：面板关闭时销毁其搜索状态，布局恢复（面板 id 稳定）时状态可重新关联。

#### Scenario: 关闭面板销毁状态
- **WHEN** 用户关闭一个面板
- **THEN** 该面板的搜索状态被释放，不再占用内存

#### Scenario: 布局恢复后状态重挂
- **WHEN** 应用重启并按持久化布局恢复面板
- **THEN** 面板 id 稳定，搜索状态按面板 id 正确关联

### Requirement: 搜索交互对齐 VSCode
系统 SHALL 提供与 VSCode 对齐的搜索交互：Enter/Shift+Enter 下/上一个匹配、F3/Shift+F3 循环、Esc 两段式（第一次收起查找条保留高亮，第二次清空搜索）、无匹配时红框与"无结果"提示。

#### Scenario: Esc 两段式关闭
- **WHEN** 用户按下 Esc 且查找条展开
- **THEN** 查找条收起，搜索词与匹配高亮保留
- **AND** 再次按 Esc 时搜索被清空

#### Scenario: 无匹配提示
- **WHEN** 搜索词在当前文件中无任何匹配
- **THEN** 查找条显示"无结果"提示且输入框呈错误态样式

#### Scenario: F3 循环导航
- **WHEN** 用户在最后一个匹配处按 F3
- **THEN** 跳转到第一个匹配（循环）

### Requirement: 当前匹配与其它匹配异色
系统 SHALL 以不同视觉区分当前匹配与其他匹配：当前匹配使用强调色，其他匹配使用常规高亮色，使导航位置一目了然。

#### Scenario: 当前匹配强调色
- **WHEN** 存在多个匹配且导航到其中一个
- **THEN** 当前匹配以强调色显示，其余匹配以常规高亮色显示

#### Scenario: 导航更新当前匹配
- **WHEN** 用户按 Enter 跳转到下一个匹配
- **THEN** 强调色移动到新的当前匹配

### Requirement: 跳转行为
系统 SHALL 在导航到搜索匹配时遵循 jump-navigation 定位契约：匹配行完整可见且不在视口边缘安全区内（距顶部与底部均超过约 1 行）时，不滚动日志视图，仅更新高亮；匹配行贴近视口边缘（约 1 行安全区内）或完全在视口外时，滚动日志视图使匹配行定位到视口正中并高亮当前行，跳转后匹配文本可见。

#### Scenario: 匹配行可见时不滚动
- **WHEN** 用户导航到一个匹配，且该匹配行完整可见、距视口顶部与底部均超过 1 行
- **THEN** 日志视图不发生滚动
- **AND** 当前行以高亮标记，匹配文本可见

#### Scenario: 匹配行贴近边缘或不可见时居中
- **WHEN** 用户导航到一个匹配，且该匹配行贴近视口顶部或底部（1 行安全区内）或完全不可见
- **THEN** 日志视图滚动使匹配行定位到视口正中
- **AND** 当前行以高亮标记，匹配文本可见

