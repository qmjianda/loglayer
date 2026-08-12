# stats-follow-active-file 能力规范

## Purpose

定义文件统计信息的跟随行为：切 tab 后右侧文件概要随激活文件切换，首次打开时避免与索引并行的重复统计拉取，保证统计显示正确且不产生冗余请求。

## Requirements

### Requirement: 切 tab 后统计随激活文件切换

系统 SHALL 在切换激活文件 tab 时，将右侧文件概要的统计切换为当前激活文件的统计。

#### Scenario: 统计随 tab 切换

- **WHEN** 已打开两个文件 A（100 行 INFO）与 B（50 行 WARN），激活 tab 从 A 切到 B
- **THEN** 右侧文件概要显示 B 的统计（WARN 50）
- **AND** 再切回 A 时显示 A 的统计（INFO 100）

### Requirement: 首次打开时统计正常拉取

系统 SHALL 在打开新文件尚未加载完成时避免触发与索引并行的重复统计拉取，待文件加载完成后再正常显示统计。

#### Scenario: 首次打开不重复拉取

- **WHEN** 打开一个新文件（尚未加载完成）
- **THEN** 不触发重复统计拉取（避免与索引并行）
- **AND** 文件加载完成信号（fileLoaded）后统计正常显示
