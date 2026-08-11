# Spec: history-file-path-relocation

## Requirement 1: Linux→Windows 路径反向转换

**WHEN** 平台为 Windows 且传入路径形如 `/mnt/d/log/a.txt`（原路径不存在）
**THEN** `resolve_file_path()` 返回存在的 `D:\log\a.txt`（若存在）
**AND** 不存在时返回规范化后的原始路径（不抛异常）

## Requirement 2: 文件夹移动后按文件名重定位

**WHEN** `open_file()` 原路径不存在，但工作区已设置
**THEN** 在工作区递归查找同名文件
**AND** 找到唯一匹配时用新路径打开，并返回 True
**AND** 工作区历史中的旧路径条目被替换为新路径

**WHEN** 工作区中无同名文件
**THEN** 返回 False，打印 `[Bridge] File not found` 提示

## Requirement 3: 打开失败非静默

**WHEN** 前端激活文件而后端 open_file 返回 False
**THEN** 前端打印 `[useFileManagement]` 前缀的失败日志
