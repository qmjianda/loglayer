## Purpose

保留离线包的双平台 ripgrep 行为，并增加 PyInstaller onedir 外部插件目录约定。

## MODIFIED Requirements

### Requirement: 发布包包含全部支持平台的 rg 二进制
原要求：离线打包产物必须同时包含 `bin/linux/rg` 与 `bin/windows/rg.exe`，运行时按当前平台选择对应的二进制。

原场景：
- **WHEN** 在 Linux 上执行离线打包
- **THEN** 产物 `app/bin/` 下同时存在 `bin/linux/rg` 与 `bin/windows/rg.exe`
- **WHEN** 在 Windows 上执行离线打包
- **THEN** 产物 `app/bin/` 下同时存在 `bin/linux/rg` 与 `bin/windows/rg.exe`
- **WHEN** 应用在 Windows 平台运行且定位 ripgrep
- **THEN** 使用 `bin/windows/rg.exe`（存在时）
- **WHEN** 应用在 Linux 平台运行且定位 ripgrep
- **THEN** 使用 `bin/linux/rg`（存在时）

#### Scenario: Linux 构建的发布包包含双平台 rg
- **WHEN** 在 Linux 上执行离线打包
- **THEN** 产物 `app/bin/` 下同时存在 `bin/linux/rg` 与 `bin/windows/rg.exe`

#### Scenario: Windows 构建的发布包包含双平台 rg
- **WHEN** 在 Windows 上执行离线打包
- **THEN** 产物 `app/bin/` 下同时存在 `bin/linux/rg` 与 `bin/windows/rg.exe`

#### Scenario: 运行时按平台选择 rg 二进制
- **WHEN** 应用在 Windows 平台运行且定位 ripgrep
- **THEN** 使用 `bin/windows/rg.exe`（存在时）
- **WHEN** 应用在 Linux 平台运行且定位 ripgrep
- **THEN** 使用 `bin/linux/rg`（存在时）

修改后：离线打包产物必须同时包含 `bin/linux/rg` 与 `bin/windows/rg.exe`，运行时按当前平台选择对应的二进制。该行为不因外部插件目录而改变。

#### Scenario: 外部插件不改变 rg 选择
- **WHEN** 冻结应用同时存在 EXE 同级 `plugins/` 目录并定位 ripgrep
- **THEN** 仍按当前平台选择包内对应的 rg 二进制

### Requirement: Frozen EXE 外部插件目录
PyInstaller onedir 产物 SHALL 约定 EXE 所在目录的 `plugins/` 为外部插件目录；插件路径不得依赖启动时当前工作目录。

#### Scenario: onedir EXE 加载同级插件
- **WHEN** 用户从任意当前工作目录启动 onedir EXE，且 EXE 同级存在有效 `plugins/`
- **THEN** 应用从 EXE 所在目录加载该目录中的插件

#### Scenario: 缺少外部插件目录
- **WHEN** onedir EXE 同级没有 `plugins/`
- **THEN** 应用正常启动并继续提供内置能力，不因外部插件目录缺失而崩溃

### Requirement: 发布包不包含启动脚本，rg 可执行性由应用自检
原要求：离线发布包 SHALL 不再生成 `LogLayer.bat` / `LogLayer.sh` 启动脚本；rg 二进制的执行权限由应用在启动时自检补齐。

原场景：
- **WHEN** 应用在 POSIX 平台定位到 rg 二进制但缺少执行权限
- **THEN** 尝试补齐执行权限（chmod +x）后继续使用
- **WHEN** 应用尝试补齐 rg 执行权限失败
- **THEN** 按 rg 缺失路径降级（返回 None + 告警），不崩溃
- **WHEN** 检查离线发布包产物根目录
- **THEN** 不存在 `LogLayer.bat` 或 `LogLayer.sh`

#### Scenario: POSIX 平台 rg 缺失执行权限时自检补齐
- **WHEN** 应用在 POSIX 平台定位到 rg 二进制但缺少执行权限
- **THEN** 尝试补齐执行权限（chmod +x）后继续使用

#### Scenario: 自检补齐失败时按 rg 缺失降级
- **WHEN** 应用尝试补齐 rg 执行权限失败
- **THEN** 按 rg 缺失路径降级（返回 None + 告警），不崩溃

#### Scenario: 发布包不包含启动脚本
- **WHEN** 检查离线发布包产物根目录
- **THEN** 不存在 `LogLayer.bat` 或 `LogLayer.sh`

修改后：离线发布包 SHALL 不再生成启动脚本；rg 二进制的执行权限由应用在启动时自检补齐，同时外部插件目录按冻结应用路径规则解析。

#### Scenario: 自检失败不影响外部插件发现
- **WHEN** POSIX 平台补齐 rg 执行权限失败且 EXE 同级存在 plugins 目录
- **THEN** rg 按缺失路径降级并告警，应用仍可继续发现外部插件
