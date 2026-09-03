## MODIFIED Requirements

### Requirement: 发布包不包含启动脚本，rg 可执行性由应用自检

离线打包产物 SHALL 不生成启动脚本；rg 二进制的执行权限由应用在启动时自检补齐；打包脚本不再处理任何桌面壳（pywebview）相关钩子或隐藏窗口参数，产物以纯服务模式启动。

#### Scenario: POSIX 平台 rg 缺失执行权限时自检补齐

- **WHEN** 应用在 POSIX 平台定位到 rg 二进制但缺少执行权限
- **THEN** 尝试补齐执行权限（chmod +x）后继续使用

#### Scenario: 自检补齐失败时按 rg 缺失降级

- **WHEN** 应用尝试补齐 rg 执行权限失败
- **THEN** 按 rg 缺失路径降级（返回 None + 告警），不崩溃

#### Scenario: 发布包不包含启动脚本

- **WHEN** 检查离线发布包产物根目录
- **THEN** 不存在 `LogLayer.bat` 或 `LogLayer.sh`

#### Scenario: 自检失败不影响外部插件发现

- **WHEN** POSIX 平台补齐 rg 执行权限失败且 EXE 同级存在 plugins 目录
- **THEN** rg 按缺失路径降级并告警，应用仍可继续发现外部插件

#### Scenario: 打包产物不依赖 pywebview

- **WHEN** 在未安装 pywebview 的构建环境执行离线打包并在目标机器启动产物
- **THEN** 打包与启动均成功，应用以纯服务模式运行
