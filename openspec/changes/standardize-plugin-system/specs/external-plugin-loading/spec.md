## Purpose

定义开发环境和 PyInstaller onedir EXE 的外部插件路径、加载和 reload 行为。

## ADDED Requirements

### Requirement: 外部路径解析
系统 SHALL 支持开发环境插件目录、EXE 同级 `plugins/` 目录和用户插件目录，并按固定优先级解析为规范化绝对路径。

#### Scenario: Frozen EXE 同级目录
- **WHEN** 应用以 PyInstaller onedir 方式运行且 EXE 同级存在 `plugins/`
- **THEN** 系统从 EXE 所在目录解析该插件目录，而不是从当前工作目录解析

#### Scenario: 开发环境目录
- **WHEN** 应用以开发环境运行并配置外部插件目录
- **THEN** 系统使用配置目录解析插件，不要求当前工作目录恰好是项目根目录

#### Scenario: 用户目录与应用目录冲突
- **WHEN** 用户目录和应用目录提供相同插件 ID
- **THEN** 系统按定义的固定优先级选择结果并记录冲突

### Requirement: 加载与 reload
系统 SHALL 以 manifest 为边界加载外部插件，并提供显式 reload，使一次 reload 的结果可重复且不留下旧注册项。

#### Scenario: reload 有效插件
- **WHEN** 用户修改外部插件后触发 reload
- **THEN** 系统重新读取 manifest 和入口，并以新结果替换该插件的旧注册项

#### Scenario: reload 失败
- **WHEN** reload 后的新插件无法校验或加载
- **THEN** 系统移除或禁用该插件的本次注册，保留其他插件，并返回失败原因
