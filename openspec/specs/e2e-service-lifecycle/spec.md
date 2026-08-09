## Purpose

提供 e2e 测试基础设施的 服务生命周期契约（默认杀重启保证测最新代码、显式复用模式、并行就绪探测）


## Requirements

### Requirement: 默认测最新代码

e2e 会话启动前，conftest 必须强制终止所有占用后端（12345）与前端（3000）端口的既有进程，再以最新工作区代码启动新实例，保证测试结果不被旧实例污染。

#### Scenario: 启动前清理既有服务

- **WHEN** pytest 的 `servers` fixture 初始化且未设置 `LOGLAYER_E2E_REUSE`
- **THEN** 所有占用 12345/3000 端口的进程被 SIGTERM/SIGKILL 清理
- **AND** 等待端口完全释放后才启动新的 backend 与 vite

### Requirement: 显式复用已在运行的实例

设置 `LOGLAYER_E2E_REUSE=1` 时，conftest 必须跳过杀进程与重启，直接探测已在运行的 backend/vite 并复用；若 15s 内探测不到，必须以明确错误中止（提示检查端口）。

#### Scenario: 复用模式跳过重启

- **WHEN** 环境变量 `LOGLAYER_E2E_REUSE=1` 已设置且 12345/3000 上已有服务在运行
- **THEN** servers fixture 不杀进程、不启动新实例，仅等待已有服务就绪
- **AND** 测试结束后不关闭被复用的实例（由外部管理）

#### Scenario: 复用模式服务缺失时报错

- **WHEN** `LOGLAYER_E2E_REUSE=1` 已设置但 12345/3000 上无服务在运行
- **THEN** 15s 内就绪探测失败，抛出明确错误并提示"请确认端口已有服务在运行"

### Requirement: 并行就绪探测，快速失败

后端端口、后端 API（`/api/platform`）、前端端口三个就绪条件必须并行轮询，总超时 ≤15s（正常启动 <5s）；超时失败时输出 backend/vite 日志尾部辅助定位。

#### Scenario: 服务正常启动在预算内就绪

- **WHEN** backend 与 vite 在 15s 内完成启动
- **THEN** servers fixture 正常 yield，三个就绪条件全部满足

#### Scenario: 启动失败给出日志

- **WHEN** 任一就绪条件在 15s 内未满足
- **THEN** 抛出 `RuntimeError`，消息包含已启动服务的日志尾部（backend.log / vite.log）

### Requirement: 不预加载大日志

backend 启动命令不得以 `tests/logs/large_test.log`（1.3GB）作为 CLI 参数；需要大文件的测试必须通过 UI 远程路径选择器打开。

#### Scenario: backend 以无文件参数启动

- **WHEN** servers fixture 启动 backend
- **THEN** 启动命令为 `python backend/main.py --no-ui`，不附带任何文件路径
