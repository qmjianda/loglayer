## Purpose

提供 e2e 测试基础设施的 大文件（1.3GB）测试与常规测试的隔离契约（heavy marker、默认不跑、显式运行）


## Requirements

### Requirement: 大文件测试标记为 heavy

打开 `tests/logs/large_test.log`（1.3GB，2200 万+ 行）的 e2e 测试必须使用 `@pytest.mark.heavy` 标记，使其可被 `-m` 表达式精确筛选。

#### Scenario: heavy 测试带标记

- **WHEN** 测试 `test_large_file_rendering.py` 中打开大文件的 4 个测试被执行收集
- **THEN** 每个测试都携带 `pytest.mark.heavy` 标记（文件级 `pytestmark`）
- **AND** pytest 无 unknown marker 警告（marker 已在 `pytest.ini` 注册）

### Requirement: 默认不运行 heavy 测试

编排脚本 SHALL 默认以 `-m "e2e and not heavy"` 运行测试，使常规套件不承担 1.3GB 索引的内存峰值与耗时。

#### Scenario: 默认运行排除大文件

- **WHEN** 执行 `npm run e2e` 或 `pytest tests/e2e -m "e2e and not heavy"`
- **THEN** heavy 测试被 deselected，不启动大日志索引
- **AND** 常规（light）测试全部运行

### Requirement: heavy 测试可显式运行

大文件测试必须能通过显式参数独立运行，用于大文件专项回归验证。

#### Scenario: --heavy 运行大文件专项

- **WHEN** 执行 `npm run e2e -- --heavy`（等价 `-m "e2e and heavy"`）
- **THEN** 仅运行 4 个 heavy 测试
- **AND** 大日志缺失时相关测试被 skip（`large_log_path` fixture）

### Requirement: 大日志行数统计只计算一次

1.3GB 文件的行数统计（`wc -l`，约 12s）必须在会话内只执行一次，通过会话级 fixture 缓存供多个测试复用。

#### Scenario: 行数统计会话级缓存

- **WHEN** 同一 pytest 会话内多个测试请求大日志行数
- **THEN** 仅首次请求执行 `wc -l`，后续请求返回缓存的会话级结果
