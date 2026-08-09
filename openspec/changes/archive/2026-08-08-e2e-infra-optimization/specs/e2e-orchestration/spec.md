## ADDED Requirements

### Requirement: 一条命令端到端编排

`npm run e2e`（内部调用 `scripts/e2e.sh`）必须完成：环境自检 →（按 flag 初始化/复用）→ 运行 pytest → 透传退出码。全程无交互，可直接被 CI 复用。

#### Scenario: 默认运行 light 套件

- **WHEN** 用户在项目根目录执行 `npm run e2e`
- **THEN** 脚本先运行环境自检，然后以 `-m "e2e and not heavy"` 运行 pytest 的 light 测试
- **AND** 脚本退出码等于 pytest 的退出码（0=全过，非 0=有失败）

#### Scenario: 首次初始化

- **WHEN** 用户执行 `npm run e2e -- --setup` 且环境缺依赖（playwright 包、chromium 浏览器、node_modules、大日志）
- **THEN** 脚本自动安装依赖并生成 `tests/logs/large_test.log`
- **AND** 安装失败时以非 0 退出码中止

#### Scenario: 显式运行大文件专项

- **WHEN** 用户执行 `npm run e2e -- --heavy`
- **THEN** 脚本以 `-m "e2e and heavy"` 运行 heavy 测试（打开 1.3GB 大文件）

#### Scenario: 运行全部测试

- **WHEN** 用户执行 `npm run e2e -- --all`
- **THEN** 脚本以 `-m "e2e"` 运行 light + heavy 全部测试

#### Scenario: 未知参数报错

- **WHEN** 用户向 `npm run e2e` 传入未定义的参数
- **THEN** 脚本打印未知参数并以退出码 2 中止

### Requirement: CI 兼容接口

编排脚本必须无交互（不读 stdin、不弹提示）、以环境变量控制行为、正确透传退出码，使其可在无人工干预的环境（CI）中运行。

#### Scenario: 环境变量控制复用

- **WHEN** CI 或脚本设置 `LOGLAYER_E2E_REUSE=1`
- **THEN** conftest 跳过杀进程/重启，直接探测并复用 12345/3000 上已在运行的实例
