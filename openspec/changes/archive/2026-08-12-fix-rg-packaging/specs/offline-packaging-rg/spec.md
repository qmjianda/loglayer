# Spec: offline-packaging-rg

## Purpose

离线发布包必须包含 Windows 与 Linux 两个平台的 ripgrep 二进制，使单包在任一支持平台运行时可用的搜索与日志级别统计功能不因打包缺二进制而失效。

## ADDED Requirements

### Requirement: 发布包包含全部支持平台的 rg 二进制

离线打包产物必须同时包含 `bin/linux/rg` 与 `bin/windows/rg.exe`，运行时按当前平台选择对应的二进制。

#### Scenario: Linux 构建的发布包包含双平台 rg

**WHEN** 在 Linux 上执行离线打包
**THEN** 产物 `app/bin/` 下同时存在 `bin/linux/rg` 与 `bin/windows/rg.exe`

#### Scenario: Windows 构建的发布包包含双平台 rg

**WHEN** 在 Windows 上执行离线打包
**THEN** 产物 `app/bin/` 下同时存在 `bin/linux/rg` 与 `bin/windows/rg.exe`

#### Scenario: 运行时按平台选择 rg 二进制

**WHEN** 应用在 Windows 平台运行且定位 ripgrep
**THEN** 使用 `bin/windows/rg.exe`（存在时）

**WHEN** 应用在 Linux 平台运行且定位 ripgrep
**THEN** 使用 `bin/linux/rg`（存在时）

### Requirement: 发布包不包含启动脚本，rg 可执行性由应用自检

离线发布包不再生成 `LogLayer.bat` / `LogLayer.sh` 启动脚本；rg 二进制的执行权限由应用在启动时自检补齐。

#### Scenario: POSIX 平台 rg 缺失执行权限时自检补齐

**WHEN** 应用在 POSIX 平台定位到 rg 二进制但缺少执行权限
**THEN** 尝试补齐执行权限（chmod +x）后继续使用

#### Scenario: 自检补齐失败时按 rg 缺失降级

**WHEN** 应用尝试补齐 rg 执行权限失败
**THEN** 按 rg 缺失路径降级（返回 None + 告警），不崩溃

#### Scenario: 发布包不包含启动脚本

**WHEN** 检查离线发布包产物根目录
**THEN** 不存在 `LogLayer.bat` 或 `LogLayer.sh`
