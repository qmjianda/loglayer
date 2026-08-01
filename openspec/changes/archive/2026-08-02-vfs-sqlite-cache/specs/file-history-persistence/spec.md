## ADDED Requirements

### Requirement: 文件历史完整保留

系统 SHALL 将打开过的文件记录完整保留在 `WorkspaceConfig.files[]` 中，永不删除。

#### Scenario: 关闭文件后记录保留

- **WHEN** 用户主动关闭一个面板或文件
- **THEN** 该文件仍保留在 `files[]` 中
- **AND** 其 `wasOpen` 标记被置为 `false`

#### Scenario: 历史文件不自动打开

- **WHEN** 用户再次进入该文件所在的项目目录
- **THEN** 仅 `wasOpen=true` 的文件被自动恢复打开
- **AND** `wasOpen=false` 的历史文件出现在文件列表中，但不自动打开

### Requirement: wasOpen 标记反映编辑区状态

系统 SHALL 在保存配置时，依据文件是否仍打开在编辑区设置 `wasOpen`。

#### Scenario: 文件保持打开

- **WHEN** 用户查看文件后不关闭，直接切换项目目录
- **THEN** 保存配置时该文件 `wasOpen=true`
- **AND** 再次进入该项目时自动恢复该文件

#### Scenario: 文件被关闭

- **WHEN** 用户主动关闭文件
- **THEN** 保存配置时该文件 `wasOpen=false`
- **AND** 再次进入项目时不自动恢复

### Requirement: 配置持久化文件历史

系统 SHALL 在 `WorkspaceConfig` 中为每个文件持久化 `wasOpen` 标记与既有图层配置。

#### Scenario: 保存配置

- **WHEN** 工作区配置被保存
- **THEN** `files[]` 中每个文件包含 `path`、`layers`、`wasOpen`
- **AND** 已关闭的文件以 `wasOpen=false` 保留

#### Scenario: 恢复配置

- **WHEN** 工作区配置被加载
- **THEN** 系统仅自动打开 `wasOpen=true` 的文件
- **AND** 全部历史文件（含 `wasOpen=false`）进入文件列表
