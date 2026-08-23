# plugin-discovery Specification

## Purpose
规定已安装、外部目录和旧插件的统一发现顺序与失败行为。
## Requirements
### Requirement: 发现已安装插件
系统 SHALL 使用 Python `importlib.metadata` 发现固定 entry point group `loglayer.plugins` 的已安装插件，并按其 manifest 注册。

#### Scenario: 发现已安装 entry point
- **WHEN** 已安装发行包在 `loglayer.plugins` 组声明插件
- **THEN** 启动发现该 entry point 并按 manifest 注册插件

#### Scenario: 未声明固定组
- **WHEN** 发行包只声明其他 entry point 组
- **THEN** 系统不把它当作 LogLayer 插件

### Requirement: 发现外部开发插件
系统 SHALL 发现授权外部插件目录中的 manifest 插件，并支持开发环境中的可重复加载。

#### Scenario: 外部目录含有效 manifest
- **WHEN** 外部目录包含有效 manifest 及其入口模块
- **THEN** 系统发现并注册该插件

#### Scenario: 外部目录插件加载失败
- **WHEN** 外部 manifest 或入口模块无效
- **THEN** 系统记录该插件的失败原因并继续发现其他来源

### Requirement: 仅 manifest 发现
系统 SHALL 不提供任何散文件扫描通道：目录中不存在 manifest 的 Python 文件不得被执行或注册，旧基类与冻结 ID 机制全部移除。

#### Scenario: 无 manifest 的 Python 文件被忽略
- **WHEN** 插件目录中存在不带 `loglayer.plugin.json` 的 `.py` 文件
- **THEN** 系统不执行、不注册该文件，也不产生诊断噪声

