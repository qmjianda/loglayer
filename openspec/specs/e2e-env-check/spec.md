## Purpose

提供 e2e 测试基础设施的 运行前环境自检（依赖/内存/端口检测与 .wslconfig 建议）


## Requirements

### Requirement: 运行前环境自检

`npm run e2e`（及独立的 `npm run e2e:env`）必须先执行环境自检，检查基础命令（python3/node/npx）、node_modules、Playwright 包与 chromium 浏览器、大日志文件是否存在。

#### Scenario: 环境就绪报告

- **WHEN** 环境满足所有检查项（依赖齐备、内存充足、大日志存在或可生成）
- **THEN** 自检输出"就绪"并以退出码 0 结束
- **AND** 编排脚本继续执行测试

#### Scenario: 关键项缺失阻止运行

- **WHEN** 存在关键缺失（如无 playwright 包、无 chromium、内存 <3GB）
- **THEN** 自检输出缺失项并以退出码 2 结束
- **AND** `npm run e2e` 中止并提示"首次运行请加 --setup"

#### Scenario: 非关键缺失仅警告

- **WHEN** 仅存在非关键缺失（如大日志不存在、端口被占用）
- **THEN** 自检以退出码 1 输出警告，不阻止测试运行（heavy 会因大日志缺失而 skip）

### Requirement: 内存预警与 .wslconfig 建议

在 WSL2 下，backend 索引 1.3GB 大日志峰值内存 2.4GB+。当可用内存 <3GB 时，自检必须给出明确的 OOM 预警，并输出 `.wslconfig` 调参建议（memory=12GB / swap=8GB）。

#### Scenario: 低内存预警

- **WHEN** `/proc/meminfo` 显示可用内存 <3GB
- **THEN** 自检标记为 crit（退出码 2），提示大日志索引会被 OOM 杀死
- **AND** 若检测到 WSL2 环境（/proc/version 含 microsoft），输出 `.wslconfig` 配置建议

#### Scenario: swap 耗尽警告

- **WHEN** swap 已用 >90%
- **THEN** 自检输出内存压力警告（不阻止运行，退出码 1）
