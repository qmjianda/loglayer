## MODIFIED Requirements

### Requirement: company-spec 执行规格阶段

`company-spec` 命令 SHALL 驱动规格阶段：先用 grill-me 技能对变更方案做设计评审闸门（每产出物至少 3 轮诘问、其中至少 1 条为「挑战隐含假设」类问题），再按 OpenSpec 产出物顺序（proposal → specs → design → tasks）推进，其中 proposal 须包含「根本问题」小节，并确保验收测试已从 specs 场景落地（先红）。

#### Scenario: 规格阶段含评审闸门

- **WHEN** 运行 `company-spec <变更名>`
- **THEN** 命令要求先经过 grill-me 设计评审（识别方案漏洞与歧义），评审通过后才继续生成 OpenSpec 产出物
- **AND** 评审量化要求：每产出物至少 3 轮诘问，其中至少 1 条为「挑战隐含假设」类问题

#### Scenario: 规格阶段产出物完整

- **WHEN** 运行 `company-spec <变更名>` 且评审通过
- **THEN** 变更目录包含 proposal、specs、design、tasks 四类产出物，且每个 spec 场景可追溯到验收测试
- **AND** proposal 包含「根本问题」小节，说明变更的根本动机、约束与为何现在

### Requirement: company-report 呈现今日状态

`company-report` 命令 SHALL 汇总所有活跃变更的进度（基于 `openspec-cn list --json` 与 `docs/company-reports/`），列出各变更所处阶段与待老板决策项，并汇总未提炼的复盘输入（「待提炼问题 N 条」），供老板开机仪式使用。

#### Scenario: 报告列出变更与待决策项

- **WHEN** 老板运行 `company-report`
- **THEN** 输出包含：活跃变更清单及任务完成进度、各变更所处阶段、待老板决策/审批的事项列表

#### Scenario: 报告显示待提炼问题汇总

- **WHEN** 老板运行 `company-report` 且存在含「本次循环问题」条目的报告
- **THEN** 输出包含「待提炼问题」汇总，列出未提炼问题的数量与来源报告
