## Why

一人公司模型目前只有"账本"（openspec 状态 + 报告归档），**没有反馈闭环**：每道闸门的报告写完即落盘，没有任何机制把循环中暴露的问题、反复踩的坑提炼回流程本身，流程无法自我进化。同时设计评审闸门（grill-me）只有"要评审"的定性要求、无量化约束，容易走过场；产出物易继承隐含假设（"因为旧流程这么做的"），缺乏第一性原理审视。趁试点刚跑顺、流程尚未固化，把"自学习闭环 + 评审量化 + 轻量第一性原理"植入，让流程从"静态手册"变为"可进化的操作系统"。

## What Changes

- **新增自学习闭环**：每道闸门报告增加「本次循环问题」小节沉淀复盘输入；`company-report` 汇总显示「待提炼问题 N 条」；提炼由老板触发，产出为改进提案清单；改进落地走立项审批（`/company-init`）后再修改流程文件——符合"模型自身变更走 OpenSpec"。
- **强化对抗式评审**：company-spec 的 grill-me 闸门量化——每产出物至少 3 轮诘问，其中至少 1 条为「挑战隐含假设」类问题，防止评审走过场。
- **轻量第一性原理**：proposal 生成须包含「根本问题」小节（该变更解决的根本问题/约束/为何现在），并在评审中挑战隐含假设。
- **范围**：仅修改 `docs/COMPANY_MODEL.md` 与 `.opencode/commands/company-*.md` 及验收测试；**不触碰 AGENTS.md 与业务代码**（老板 Gate 1 确认）。

## Capabilities

### New Capabilities

- `company-self-learning`: 一人公司流程的自学习闭环——复盘输入沉淀（报告「本次循环问题」小节）、待提炼状态可见（company-report 汇总）、老板触发提炼、改进提案经立项审批后落地流程文件。

### Modified Capabilities

- `company-operating-model`: 运营手册需新增"流程演进与自学习"内容（自学习闭环机制、评审量化约束、第一性原理要求）。
- `company-commands`: company-spec 评审闸门量化约束（每产出物 ≥3 轮诘问、含挑战隐含假设、proposal 含根本问题小节）；company-report 增加「待提炼问题」汇总。
- `company-reports`: 落盘报告内容结构新增「本次循环问题」小节（复盘输入载体）。

## Impact

- **修改文件**：
  - `docs/COMPANY_MODEL.md`（自学习闭环章节 + 评审量化约束 + 第一性原理要求）
  - `.opencode/commands/company-spec.md`（评审量化 + proposal 根本问题小节 + 报告模板）
  - `.opencode/commands/company-review.md`（报告模板加「本次循环问题」）
  - `.opencode/commands/company-run.md`（引用自学习闭环说明）
  - `.opencode/commands/company-report.md`（「待提炼问题 N 条」汇总）
- **测试**：`tests/unit/test_company_commands.py` 扩展 + 新增 `tests/unit/test_company_self_learning.py`
- **无影响**：后端/前端业务代码、API、依赖、CI 均不受影响
- **不修改**：`AGENTS.md`（老板 Gate 1 确认范围）
