# history-file-path-relocation 能力规范

## Purpose

定义历史文件路径的容错解析行为：支持 Linux→Windows 路径反向转换、文件夹移动后按文件名重定位，以及打开失败时的非静默提示，保证历史文件在路径变化后仍可打开。

## Requirements

### Requirement: Linux→Windows 路径反向转换

系统 SHALL 在 Windows 平台对形如 `/mnt/d/log/a.txt` 的旧 Linux 路径进行反向转换，优先返回存在的 Windows 路径；原路径不存在时返回规范化后的原始路径。

#### Scenario: 反向转换命中

- **WHEN** 平台为 Windows 且传入路径形如 `/mnt/d/log/a.txt`（原路径不存在）
- **THEN** `resolve_file_path()` 返回存在的 `D:\log\a.txt`（若存在）
- **AND** 不存在时返回规范化后的原始路径（不抛异常）

### Requirement: 文件夹移动后按文件名重定位

系统 SHALL 在 `open_file()` 原路径不存在但工作区已设置时，在工作区递归查找同名文件并重定位打开。

#### Scenario: 找到唯一匹配

- **WHEN** `open_file()` 原路径不存在，但工作区已设置
- **THEN** 在工作区递归查找同名文件
- **AND** 找到唯一匹配时用新路径打开，并返回 True
- **AND** 工作区历史中的旧路径条目被替换为新路径

#### Scenario: 无同名文件

- **WHEN** 工作区中无同名文件
- **THEN** 返回 False，打印 `[Bridge] File not found` 提示

### Requirement: 打开失败非静默

系统 SHALL 在前端激活文件但后端 `open_file()` 返回 False 时输出带模块前缀的失败日志。

#### Scenario: 激活失败有日志

- **WHEN** 前端激活文件而后端 open_file 返回 False
- **THEN** 前端打印 `[useFileManagement]` 前缀的失败日志
