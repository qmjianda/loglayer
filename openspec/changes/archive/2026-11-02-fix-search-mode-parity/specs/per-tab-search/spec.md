# per-tab-search Delta

## MODIFIED Requirements

### Requirement: 面板级独立搜索状态
系统 SHALL 以面板（Tab）为单位维护独立搜索状态，包括搜索词、搜索配置（大小写/整词/正则/模式）、当前匹配位置（rank）；切换面板时各自状态互不干扰，切换后自动恢复该面板上次的搜索词与导航位置。搜索高亮、匹配计数、当前匹配导航与匹配行样式 SHALL 按**本面板**的完整搜索配置（含大小写、整词、正则）计算，前后端语义一致，不使用激活面板的搜索状态。

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

#### Scenario: 整词配置参与匹配集与计数
- **WHEN** 文件中同时存在 `ERROR` 与 `ERROR_CODE`，用户以整词模式搜索 `ERROR`
- **THEN** 匹配计数只包含整词 `ERROR` 所在行，不包含 `ERROR_CODE` 所在行

#### Scenario: 整词配置参与导航
- **WHEN** 用户以整词模式搜索 `ERROR` 并按 Enter/F3 逐个导航
- **THEN** 导航只停留在整词匹配的行，不跳到 `ERROR_CODE` 等子串命中行

#### Scenario: 整词与大小写/正则组合一致
- **WHEN** 用户组合开启整词、大小写或正则选项后发起搜索
- **THEN** 匹配集、匹配计数、当前匹配导航与行内高亮使用同一组配置，结果一致
