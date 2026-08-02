# dockview-split Specification

## Purpose
TBD - created by archiving change dockview-split-panes. Update Purpose after archive.
## Requirements
### Requirement: dockview 承载分屏渲染

系统 SHALL 使用 dockview 的 `DockviewReact` 渲染日志查看区域，面板以基于路径的稳定 id 标识，而非每次会话变化的 fileId。

#### Scenario: 面板渲染

- **WHEN** 应用加载且存在已打开的文件
- **THEN** 系统经 dockview 渲染每个文件为一个 `logViewer` 面板
- **AND** 每个面板经 `params` 携带其基于路径的稳定 id 与 `uri`

#### Scenario: 面板标识稳定

- **WHEN** 应用为同一文件创建面板
- **THEN** 面板 id 基于文件路径生成且跨会话稳定
- **AND** 布局保存/恢复后仍能命中同一面板

#### Scenario: 拖拽分屏

- **WHEN** 用户拖拽面板或触发分屏命令
- **THEN** 系统经 dockview 创建嵌套或并排面板
- **AND** 每个面板可独立关闭、移动、调整大小

### Requirement: 面板生命周期驱动激活文件

系统 SHALL 通过 dockview 的 `onDidActiveChange` 更新当前激活文件的 `activeFileId`，不再依赖自研 `panes` 数组。

#### Scenario: 切换激活面板

- **WHEN** 用户点击或激活某个面板
- **THEN** 系统将 `activeFileId` 更新为该面板的 `fileId`
- **AND** 依赖 `activeFileId` 的 UI（侧边栏、状态栏、搜索）随之更新

#### Scenario: 关闭面板

- **WHEN** 用户关闭一个面板
- **THEN** 系统释放该面板对应文件的会话（在无其他引用时）
- **AND** 若关闭的是激活面板，激活状态转移到剩余面板或清空

### Requirement: 布局持久化

系统 SHALL 将 dockview 布局（分屏结构、叠放、面板位置与激活状态）持久化到统一工作区存储，而非浏览器 localStorage。

#### Scenario: 布局保存

- **WHEN** 用户调整分屏布局（拖拽、增删面板）
- **THEN** 系统经 dockview `toJSON` 保存布局到统一工作区存储

#### Scenario: 布局恢复

- **WHEN** 应用启动且存在已保存布局
- **THEN** 系统经 `fromJSON` 恢复面板布局
- **AND** 恢复失败时回退到默认单面板布局

#### Scenario: 刷新后布局一致

- **WHEN** 用户打开若干文件（叠放或分屏）后刷新页面并重新打开工作区
- **THEN** 布局与刷新前一致恢复
- **AND** 不因 fileId 变化产生错误的分屏

#### Scenario: 布局随工作区迁移

- **WHEN** 用户复制 `.loglayer/` 到另一台机器并打开
- **THEN** 布局随工作区存储恢复
- **AND** 不依赖原浏览器的 localStorage

### Requirement: 现有 LogViewer 面板复用

系统 SHALL 在 dockview 面板中渲染现有的 `LogViewer` 组件，不得重写或替换其交互逻辑。

#### Scenario: 面板内渲染

- **WHEN** 一个 `logViewer` 面板激活
- **THEN** 该面板渲染现有 `LogViewer`，传入其 fileId 对应的行数、搜索、书签等数据
- **AND** `LogViewer` 的选择、右键、书签、CJK 测量等行为保持不变

### Requirement: 外部打开入口接入 dockview

系统 SHALL 将文件打开入口（文件树点击、命令面板、拖放）迁移到 dockview API。

#### Scenario: 打开文件

- **WHEN** 用户在文件树点击或拖放一个文件到编辑器区
- **THEN** 系统经 dockview 打开（或激活已存在的）对应面板
- **AND** 新文件加入文件列表并加载

#### Scenario: 空面板兜底

- **WHEN** 没有已打开的面板
- **THEN** 系统显示一个默认的空编辑器占位，而非空白区域
