# Spec: stats-follow-active-file

## Requirement 1: 切 tab 后统计随激活文件切换

**WHEN** 已打开两个文件 A（100 行 INFO）与 B（50 行 WARN），激活 tab 从 A 切到 B
**THEN** 右侧文件概要显示 B 的统计（WARN 50）
**AND** 再切回 A 时显示 A 的统计（INFO 100）

## Requirement 2: 首次打开时统计正常拉取

**WHEN** 打开一个新文件（尚未加载完成）
**THEN** 不触发重复统计拉取（避免与索引并行）
**AND** 文件加载完成信号（fileLoaded）后统计正常显示
