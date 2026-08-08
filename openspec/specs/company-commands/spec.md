# company-commands Specification

## Purpose
5 个 company-* 斜杠命令（`.opencode/commands/company-*.md`）的编排行为——各自触发哪些阶段、调用哪些现有基建（openspec-cn CLI、grill-me 技能、task() 子 Agent）、闸门如何暂停等待老板决策。作为一人公司模型的编排入口，覆盖立项、规格、评审、全流程驱动与状态汇报。

## Requirements

### Requirement: company 命令集提供完整编排入口

仓库 SHALL 提供 5 个斜杠命令（`.opencode/commands/company-*.md`）：`company-init`、`company-spec`、`company-review`、`company-run`、`company-report`，作为一人公司模型的编排入口，内部调用现有 openspec-* 技能/命令与子 Agent 调度。

#### Scenario: 5 个命令文件存在
- **WHEN** 检查 `.opencode/commands/` 目录
- **THEN** 存在 `company-init.md`、`company-spec.md`、`company-review.md`、`company-run.md`、`company-report.md` 五个文件

### Requirement: company-init 支持老板立项

`company-init` 命令 SHALL 引导老板登记新变更（描述要构建的内容）并创建 OpenSpec 变更骨架（调用 `openspec-cn new change`），输出变更名与下一步指引。

#### Scenario: 立项创建变更骨架
- **WHEN** 老板运行 `company-init` 并提供变更描述
- **THEN** 命令基于描述推导 kebab-case 变更名并调用 openspec-cn 创建变更骨架，输出变更名与后续步骤

### Requirement: company-spec 执行规格阶段

`company-spec` 命令 SHALL 驱动规格阶段：先用 grill-me 技能对变更方案做设计评审闸门，再按 OpenSpec 产出物顺序（proposal → specs → design → tasks）推进，并确保验收测试已从 specs 场景落地（先红）。

#### Scenario: 规格阶段含评审闸门
- **WHEN** 运行 `company-spec <变更名>`
- **THEN** 命令要求先经过 grill-me 设计评审（识别方案漏洞与歧义），评审通过后才继续生成 OpenSpec 产出物

#### Scenario: 规格阶段产出物完整
- **WHEN** 运行 `company-spec <变更名>` 且评审通过
- **THEN** 变更目录包含 proposal、specs、design、tasks 四类产出物，且每个 spec 场景可追溯到验收测试

### Requirement: company-review 执行回归阶段

`company-review` 命令 SHALL 执行回归闸门：运行 `openspec-cn validate`、相关验收测试与单测、静态门（`tsc --noEmit`/`ruff`）、git diff 越界检查，并生成汇报材料。UI/交互类变更追加 e2e 运行。

#### Scenario: 回归包含测试与静态门
- **WHEN** 运行 `company-review <变更名>`
- **THEN** 命令依次执行 openspec validate、相关测试（验收 + 单测）、静态门检查，并核对 git diff 文件范围与任务范围一致

#### Scenario: 回归连败触发熔断
- **WHEN** 回归中同一闸门连续失败达到 3 次
- **THEN** 命令停止自动重试并升级给老板，附失败证据与可能原因

### Requirement: company-run 一键串联全流程

`company-run` 命令 SHALL 按 设计评审 → 规格产出物 → 验收测试（红）→ 实现（绿）→ 回归 → 汇报 的顺序一键驱动完整循环，并在各闸门处暂停等待老板决策（立项已批准时）。

#### Scenario: 完整循环顺序执行
- **WHEN** 老板运行 `company-run <变更名>` 且立项已批准
- **THEN** 命令按顺序执行：设计评审闸门 → 规格产出物 → 验收测试（红）→ 实现 → 回归闸门 → 汇报，最后呈现报告等待老板交付审批

#### Scenario: 循环可拆分为独立阶段
- **WHEN** 老板只运行 `company-spec` 或 `company-review`
- **THEN** 对应阶段独立执行并输出该阶段的汇报摘要，不要求跑完整循环

### Requirement: company-report 呈现今日状态

`company-report` 命令 SHALL 汇总所有活跃变更的进度（基于 `openspec-cn list --json` 与 `docs/company-reports/`），列出各变更所处阶段与待老板决策项，供老板开机仪式使用。

#### Scenario: 报告列出变更与待决策项
- **WHEN** 老板运行 `company-report`
- **THEN** 输出包含：活跃变更清单及任务完成进度、各变更所处阶段、待老板决策/审批的事项列表
