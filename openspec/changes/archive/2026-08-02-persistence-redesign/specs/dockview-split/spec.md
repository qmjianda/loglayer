# dockview-split Delta

## MODIFIED Requirements

### Requirement: dockview 承载分屏渲染

系统 SHALL 使用 dockview 的 `DockviewReact` 渲染日志查看区域，面板以基于路径的稳定 id 标识，而非每次会话变化的 fileId。

#### Scenario: 面板标识稳定
- **WHEN** 应用为同一文件创建面板
- **THEN** 面板 id 基于文件路径生成且跨会话稳定
- **AND** 布局保存/恢复后仍能命中同一面板

### Requirement: 布局持久化

系统 SHALL 将 dockview 布局（分屏结构、叠放、面板位置与激活状态）持久化到统一工作区存储，而非浏览器 localStorage。

#### Scenario: 刷新后布局一致
- **WHEN** 用户打开若干文件（叠放或分屏）后刷新页面并重新打开工作区
- **THEN** 布局与刷新前一致恢复
- **AND** 不因 fileId 变化产生错误的分屏

#### Scenario: 布局随工作区迁移
- **WHEN** 用户复制 `.loglayer/` 到另一台机器并打开
- **THEN** 布局随工作区存储恢复
- **AND** 不依赖原浏览器的 localStorage
