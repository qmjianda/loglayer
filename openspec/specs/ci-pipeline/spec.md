# ci-pipeline Specification

## Purpose

定义 LogLayer 的 CI（GitHub Actions）质量验证策略：每次推送与 PR 自动运行后端与前端验证，任何一步失败即标记为红；大文件相关测试在 CI 中经可复现的降级样本运行；搜索测试复用仓库内 ripgrep 二进制，不依赖 CI 环境自带的系统 `rg`。

## Requirements

### Requirement: CI 自动验证

系统 SHALL 在 GitHub Actions 中为每次推送与 PR 自动运行质量验证，覆盖后端单测/集成测试、前端类型检查/单测/构建，任何一步失败即标记为红。

#### Scenario: 推送到 main 分支触发验证

- **WHEN** 代码推送到 `main` 分支
- **THEN** CI 自动运行后端 `pytest`（unit + integration）与前端 `tsc && vitest && vite build`
- **AND** 任一失败时 CI 状态为红，且输出可定位的失败步骤

#### Scenario: 创建 PR 触发验证

- **WHEN** 开发者创建或更新一个 PR
- **THEN** CI 在 PR 上自动运行与推送相同的验证
- **AND** PR 页面可见验证状态，作为合并前置信号

### Requirement: 大文件测试降级样本

系统 SHALL 在 CI 中生成可复现的大日志测试样本（如 100MB 量级），替代 gitignored 的 1.3GB `large_test.log`，使大文件相关测试在 CI 环境可运行。

#### Scenario: CI 生成降级样本

- **WHEN** CI 需要运行大文件渲染相关测试
- **THEN** 系统经 `python tests/benchmarks/gen_big_file.py` 生成降级样本
- **AND** 测试使用该样本而非依赖本机 1.3GB 文件

### Requirement: ripgrep 二进制注入

系统 SHALL 在 CI 中复用 `bin/<platform>/rg` 二进制（或等效注入策略），使搜索相关测试不依赖 CI 环境自带的系统 `rg`。

#### Scenario: CI 中运行搜索测试

- **WHEN** CI 运行依赖 ripgrep 的测试
- **THEN** 系统经 conftest 的 `rg_path` fixture 解析到仓库内二进制
- **AND** 搜索测试在 CI 与本地行为一致
